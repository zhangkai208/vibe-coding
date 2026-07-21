# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

「提醒小助手」——一个带 Live2D 桌面宠物（左 22、右 33 两只萌妹）的提醒工具。由宠物弹对话气泡提醒喝水/休息，按时确认则开心、忽略则掉好感。Electron 41 + Vue 3 (script setup) + Vite + Element Plus + Pinia + pixi-live2d-display (PixiJS 6) + electron-store。

主代码在 `reminder-app/`。详细设计文档见 `PROJECT_PLAN.md`。

## 常用命令

所有命令在 `reminder-app/` 下执行：

```bash
npm run electron:dev     # 开发：并行启动 vite (5173) + Electron 主进程，连本地 dev server
npm run dev              # 仅前端（无 Electron，window.electronAPI 不存在，宠物/提醒功能不可用）
npm run electron:build   # 生产打包：vite build + electron-builder → release/（NSIS Windows 安装包）
npm run electron:preview # 跑打包后的 dist 产物（NODE_ENV=production）
```

注意：`npm run dev` 单独跑前端时没有 Electron 主进程，所有 IPC 依赖会失效，调试宠物/提醒必须在 `electron:dev` 下进行。

无测试、无 lint 配置。

## 架构

### 双窗口架构（核心）

应用有两个独立的 Electron 窗口，各自挂一套独立的 Vue 应用，靠主进程中转 IPC 通信：

- **主窗口**（`index.html` → `src/main.js` → `App.vue`）：420×640 无边框窗口。承担提醒管理 UI、设置页、**提醒调度器**、**心情衰减循环**。`frame: false` 用自定义标题栏（`TitleBar.vue`）。
- **宠物窗口**（`pet.html` → `src/pet-main.js` → `PetApp.vue`）：全屏透明、`alwaysOnTop`、`skipTaskbar`、`focusable: false` 的覆盖层。只负责渲染 Live2D 模型 + 对话气泡。

关键约束：**调度器和好感度循环跑在主窗口渲染进程里**。主窗口被收进托盘时 Chromium 会节流隐藏页面定时器，所以主窗口的 `webPreferences.backgroundThrottling` 必须保持 `false`（否则提醒迟到、心情衰减变慢）。也正因此，"关闭到托盘"关闭时是整体退出而非只关主窗口——否则宠物窗口会变成"看着还在、永远不再提醒"的半死状态。

### 三窗口间 IPC 数据流

主进程（`electron/main.js`）是两个窗口之间的唯一中转，窗口之间**不直接通信**：

```
主窗口渲染进程 ──ipcRenderer.send──► 主进程 ──webContents.send('pet-message')──► 宠物窗口
   ▲                                                                                    │
   └──'reminder-response'── 主进程 ──ipcRenderer.send('reminder-acknowledged/...')───┘
```

- 主窗口 → 宠物：`trigger-reminder` / `set-pet-display-mode` / `set-pet-skin` / `set-pet-scale` / `sync-pet-state` / `preview-reminder` / `trigger-greeting`。宠物窗口统一用 `onPetMessage` 监听 `pet-message` 事件，按 `data.type` 分发。
- 宠物 → 主窗口：用户点确认/推迟/忽略时，宠物窗口 send 出去，主进程中转成 `reminder-response` 推回主窗口，主窗口据此更新心情和调度。
- 托盘菜单 → 主窗口：`pause-state-changed` / `trigger-next-reminder`。
- 主进程 → 主窗口：空闲检测 `idle-state-changed`。

`electron/preload.js` 通过 `contextBridge.exposeInMainWorld('electronAPI', ...)` 暴露所有 API；每个 listener 都保存回调引用以便精确移除（替换监听先调对应的 `removeXxxListener`）。`contextIsolation: true`、`nodeIntegration: false`，不要破坏这个安全边界。

**IPC 序列化约束**：Electron IPC 用结构化克隆传输数据，**Vue 响应式对象（Proxy）不可克隆**，直接 send 会抛 `An object could not be cloned` 并静默失败。跨 IPC 传 Pinia store 的 ref 值前必须先 `JSON.parse(JSON.stringify(payload))` 转成纯对象（见 `stores/settings.js` 的 `saveSettings`）。新写 IPC 发送端时默认套这层深拷贝。

**托盘菜单直读 store**：托盘的"下一个提醒倒计时"是主进程里 `getNextReminderInfo()` 直接读 electron-store 重算的，与渲染进程的倒计时是两份独立逻辑；`save-settings` 会顺带 `updateTrayMenu()` 刷新。改提醒数据结构时这两处要一起动。

### 提醒调度（`src/stores/reminder.js`）

不是按提醒个数起 N 个 `setInterval`，而是**单调度器 10 秒 tick**（`TICK_INTERVAL`），每次 tick 遍历所有提醒检查是否到点：

- `lastTriggered` 记录上次触发时间，`elapsed >= interval` 即触发并刷新 `lastTriggered`。推迟 = 把 `lastTriggered` 回拨到 `now - interval + postponeDelay`。
- **积压过期提醒静默丢弃**（`MISSED_GRACE_MS = 60s`）：关机/休眠/暂停期间错过的提醒不补触发，只重置计时——避免唤醒瞬间多个气泡互相覆盖。
- 触发前 10 秒发"预告"（`previewSent` Set 去重）。
- tick 早返回条件：全局暂停 / 系统空闲 / 不在工作时段内（且工作时段开关打开）。
- `nowMs` 是每秒刷新的响应式时钟，专门给"下次提醒倒计时"computed 用——`Date.now()` 非响应式，直接用会导致倒计时不动。

### 心情系统（`src/stores/pet.js`）

`happiness` 0–100，每 20 秒自然衰减 1。阈值 75/50/25 四等分对应 happy/normal/sad/angry 四档循环。确认提醒重置到 95，忽略扣 15（下限 0）。心情变化通过 `sync-pet-state` IPC 推到宠物窗口换表情。

### 设置持久化（electron-store）

主进程用 `electron-store` 存单个 `settings` key。`save-settings` IPC 做**深度合并**（`deepMerge`），不是整体覆盖——渲染进程只传改动字段即可。`get-settings` 带完整默认值兜底。

### Live2D 模型加载

模型来自 [imuncle/live2d](https://github.com/imuncle/live2d)（⚠️ 仅学习/非商业用途）。模型资源本地化到 `public/models/{22,33}/`，运行时**本地优先、CDN 兜底**：先 `Live2DModel.from('./models/...')`，catch 后回退 `cdn.jsdelivr.net`。服装切换通过加载不同 `model.*.json`（共用 `.moc`、只换贴图）实现，服装清单见 `src/constants/skins.js`（19 套，22/33 通用）。Live2D 运行时脚本（`live2d.min.js` / `live2dcubismcore.min.js`）在 `public/lib/`，HTML 里 `onerror` 回退 CDN。

### 开机自启与静默启动

开机自启靠 `app.setLoginItemSettings({ openAsHidden: true, args: ['--hidden'] })`，并在 Windows 启动参数里注入 `--hidden`。主进程读 `process.argv.includes('--hidden')` 判断是否静默启动——若是则主窗口 `ready-to-show` 时**不 show**，只挂托盘等用户点击唤出。这是主进程与自启配置之间的隐式契约，改自启相关逻辑时别破坏 `--hidden` 这个握手参数。

### 空闲检测（双触发）

主进程 `startIdleMonitor` 同时挂两条触发：一是每 10 秒轮询 `powerMonitor.getSystemIdleTime()` 对比 `idleThreshold`；二是监听 `powerMonitor` 的 `user-did-become-active`，用户一回活动就**立即**把 `idle-state-changed(false)` 推给主窗口（不等下一轮 tick）。状态变化时才推送，靠 `lastIdleState` 去抖。

### 透明窗口点击穿透

宠物窗口默认 `setIgnoreMouseEvents(true, { forward: true })`（透明区穿透、但 forward mousemove）。当鼠标进入宠物/气泡区域时，渲染进程通过 `set-pet-interactable` IPC 切换为 `false` 以接收点击，离开再切回穿透。

### 宠物拖动位置持久化

左右宠物各自可拖动，落点存在设置的 `pet.positions.{left,right}`（`null` = 没拖过，用组件内默认的左下/右下角位置）。拖动结束时 `Live2DPet.vue` emit `position-changed`，`PetApp.vue` 按侧调 `saveSettings({ pet: { positions: { [side]: pos } } })`——靠 `save-settings` 的深度合并，改一侧不影响另一侧；启动时从设置恢复传入 `initialPos` prop。注意：`pet.position`（单数）是旧字段，已废弃不使用。

### 单实例锁

`app.requestSingleInstanceLock()`：抢不到锁直接退出（否则两层宠物叠在一起、提醒响两遍、两套存储互相覆盖）。第二个实例启动时由 `second-instance` 把已有主窗口唤到前台。

### 多入口构建

`vite.config.js` 用 `rollupOptions.input` 配置 `index.html` + `pet.html` 双入口，`base: './'`、`assetsInlineLimit: 0`（确保 Live2D 模型文件不被内联）。

## 编辑约定

- 所有源码注释和用户对话使用中文。
- 改代码前先简要说明思路，遇到多方案时列出选项让用户选择（不要直接动手）。
- 修改认证/安全相关代码前主动提示安全影响。
- IPC 通道名、`pet-message` 的 `type` 取值是跨进程契约，改动需同时更新发送端（preload + main）、接收端、以及对方的监听逻辑。
- 新增跨窗口通信时务必走主进程中转，不要在渲染进程间假设直接可达。
