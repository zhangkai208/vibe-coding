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
npm run electron:preview # 跑打包后的 dist 产物（NODE_ENV=production，需先 vite build，否则 dist 不存在）
```

注意：`npm run dev` 单独跑前端时没有 Electron 主进程，所有 IPC 依赖会失效，调试宠物/提醒必须在 `electron:dev` 下进行。

**`electron:dev` 为何走 `node electron/dev.js` 而非 `electron .`**：VSCode（及任何 Electron 宿主）会向派生子进程注入 `ELECTRON_RUN_AS_NODE=1`，让 electron 以「纯 Node」模式启动——此时 `app`/`BrowserWindow` 为 undefined，窗口起不来、preload/IPC/electron-store 全失效（典型表现：界面看着在，但设置存不进去）。`dev.js` 在 spawn electron 前先 `delete process.env.ELECTRON_RUN_AS_NODE`（设空串无效，electron 只要检测到该变量存在就当 Node 模式）。这个包装脚本不能省，也别在终端里直接跑 `electron .` 调试。

无测试、无 lint 配置。

## 架构

### 代码地图（按职责，快速定位）

主进程 `electron/`：
- `main.js` — 双窗口创建、所有 IPC 中转、托盘、空闲检测、显示器指纹看门狗、开机自启。两个窗口之间不直接通信，全部经此中转。
- `preload.js` — `contextBridge` 暴露的 `window.electronAPI`：一批发送方法 + 若干 `onXxx` / `removeXxxListener` 监听对（每对都存回调引用以便精确移除）。
- `dev.js` — dev 启动包装器，唯一目的：spawn electron 前删掉 `ELECTRON_RUN_AS_NODE`（见「常用命令」）。

渲染进程 `src/`：
- `App.vue` — 主窗口根。**运行时入口都在 `onMounted`**：加载设置 → 恢复提醒/宠物状态 → `reminderStore.startScheduler()` + `petStore.startHappinessDecay()` → 挂 4 个 IPC 监听（提醒响应 / 空闲 / 暂停 / 跳到下一条）。`watch` 负责把状态写回 electron-store。
- `PetApp.vue` — 宠物窗口根。监听 `onPetMessage` 按 `type` 分发给左右两只宠物；鼠标穿透的翻转判定也在这里（`elementFromPoint` + 状态缓存）。
- `components/Live2DPet.vue` — 单只宠物：模型加载（本地优先 CDN 兜底）、挂 `moodOverlay`、拖拽落点、监听 `resize` 重算落点、视线跟随。
- `components/SpeechBubble.vue` — 对话气泡：打字机文案 + 确认/推迟/忽略按钮 + 自动消失倒计时；`showActions=false` 时为纯消息气泡（时段问候用）。
- `stores/{reminder,pet,settings}.js` — 三个 Pinia store（调度 / 心情 / 设置），职责与下文各小节一一对应。
- `utils/moodOverlay.js` `utils/time.js` — 心情参数叠加层 / 工作时段与时间格式化。
- `constants/skins.js`（19 套服装清单）`constants/presets.js`（提醒预设）。
- `views/{Home,Settings}.vue`（主窗口两个 hash 路由页）+ `components/{TitleBar,AddReminder,ReminderCard}.vue`（标题栏 / 增删 / 列表 UI）。

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
- **时段问候**是调度 tick 的另一条产物：每个 tick 跨过工作时段起/止点的那一分钟，发一条纯消息气泡（`trigger-greeting` → 宠物窗口 `greeting` 类型：无按钮、自动消失、**不影响好感度**），起/止各每天只发一次（靠内存里的 `greetingSentOn` 去重，不持久化）。开工问候固定走左侧 22、下班走右侧 33。

### 心情系统（`src/stores/pet.js`）

`happiness` 0–100，每 20 秒自然衰减 1。阈值 75/50/25 四等分对应 happy/normal/sad/angry 四档循环。确认提醒重置到 95，忽略扣 15（下限 0）。心情变化通过 `sync-pet-state` IPC 推到宠物窗口换表情。

**表情不是 Live2D expression/motion，而是参数叠加层**（`src/utils/moodOverlay.js`）：挂在 pixi-live2d-display 的 `beforeModelUpdate` 钩子上，每帧用与眨眼/呼吸相同的方式把心情偏移叠加到 Cubism 参数（角度/脸红/眼型走 `addToParamFloat` 叠加，眼睛开合走乘法以保留眨眼），靠引擎的 `saveParam`/`loadParam` 机制保证不累积漂移，切换时指数插值平滑过渡。调表情观感改 `MOOD_OVERLAYS` 数值表即可，别去改动作文件。

### 设置持久化（electron-store）

主进程用 `electron-store` 存单个 `settings` key。`save-settings` IPC 做**深度合并**（`deepMerge`），不是整体覆盖——渲染进程只传改动字段即可。`get-settings` 带完整默认值兜底。

### 渲染进程生命周期与持久化的非显然点

- **推迟时长来自全局默认，不在提醒上**：用户点「推迟」时宠物窗口只回传 `reminderId`，主窗口 `App.vue` 的 `handleReminderResponse` 用 `settingsStore.reminderDefaults.postponeMinutes`（默认 5）当推迟分钟数。改推迟行为改这里，不是改 `reminder.js`。
- **好感度落盘被节流**：自然衰减每 20 秒 -1，逐次写盘无意义；`App.vue` 的 watch 把 happiness 持久化节流到 5 分钟一次，但确认/忽略造成的跳变（`|Δ|>1`）仍立即落盘。
- **宠物窗口写设置必须绕开 `settingsStore.saveSettings`**：`PetApp.vue` 的 `savePetPosition` 直接调 `window.electronAPI.saveSettings`，**不**走 store 包装器——后者会把本窗口启动时加载的 `autoLaunch`/`workingHours`/`idleThreshold` 等旧值一并写回，覆盖用户随后在主窗口改的新设置。宠物窗口写设置时一律只传**改动的那一个字段**（靠主进程 `deepMerge` 只合并这一处）。主窗口用 store 包装器没问题，因为它持有这些字段的最新值。

### Live2D 模型加载

模型来自 [imuncle/live2d](https://github.com/imuncle/live2d)（⚠️ 仅学习/非商业用途）。模型资源本地化到 `public/models/{22,33}/`，运行时**本地优先、CDN 兜底**：先 `Live2DModel.from('./models/...')`，catch 后回退 `cdn.jsdelivr.net`。服装切换通过加载不同 `model.*.json`（共用 `.moc`、只换贴图）实现，服装清单见 `src/constants/skins.js`（19 套，22/33 通用）。Live2D 运行时脚本（`live2d.min.js` / `live2dcubismcore.min.js`）在 `public/lib/`，HTML 里 `onerror` 回退 CDN。

### 开机自启与静默启动

开机自启靠 `app.setLoginItemSettings({ openAsHidden: true, args: ['--hidden'] })`，并在 Windows 启动参数里注入 `--hidden`。主进程读 `process.argv.includes('--hidden')` 判断是否静默启动——若是则主窗口 `ready-to-show` 时**不 show**，只挂托盘等用户点击唤出。这是主进程与自启配置之间的隐式契约，改自启相关逻辑时别破坏 `--hidden` 这个握手参数。

### 空闲检测（双触发）

主进程 `startIdleMonitor` 同时挂两条触发：一是每 10 秒轮询 `powerMonitor.getSystemIdleTime()` 对比 `idleThreshold`；二是监听 `powerMonitor` 的 `user-did-become-active`，用户一回活动就**立即**把 `idle-state-changed(false)` 推给主窗口（不等下一轮 tick）。状态变化时才推送，靠 `lastIdleState` 去抖。

### 透明窗口点击穿透

宠物窗口默认 `setIgnoreMouseEvents(true, { forward: true })`（透明区穿透、但 forward mousemove）。当鼠标进入宠物/气泡区域时，渲染进程通过 `set-pet-interactable` IPC 切换为 `false` 以接收点击，离开再切回穿透。

### 宠物窗口的层级与 bounds 需主动自愈

宠物窗口 `focusable: false`，出问题无法靠用户点击自救，主进程必须主动修两类失配：

- **层级掉落**：Windows 的 always-on-top 不是一劳永逸，别的置顶窗口后弹出、全屏、锁屏、系统唤醒都可能把它压下去（表现：气泡被挡住）。
- **bounds 失配**：开机自启时屏幕分辨率/DPI 尚未就绪，窗口按临时小 workArea 创建（宠物变小、挤在左上角）；休眠唤醒/锁屏/拔显示器后 bounds 也会与屏幕失配（宠物只剩半只或整只消失）。

自愈机制（`electron/main.js`）：`refitPetWindow()` 按最新 `workArea` 重新 `setBounds`；`bringPetToFront()` = refit + `setAlwaysOnTop(true, 'screen-saver')` + `moveTop()`。触发点有三处：每次冒气泡（提醒/预告/问候）前、`screen` 的 `display-metrics-changed/added/removed`、`powerMonitor` 的 `resume`/`unlock-screen`（后两者分别挂在 `createPetWindow` / `startIdleMonitor` 里）。**新增任何"让宠物说话"的路径都要先调 `bringPetToFront()`**。渲染侧 `Live2DPet.vue` 监听 window `resize`：主进程纠正 bounds 后重算宠物落点（拖过的位置重新夹紧进屏幕，默认位置重算到左下/右下角）。

**上述 refit 全都信任 `screen` 模块，但开机自启/休眠唤醒后 `screen` 本身可能整体停在错误读数**（如实际 1707×912@1.5 却一直报 1920×1080@1，且 `display-metrics-changed` 不补发）——此时 refit 空转，永远修不好。兜底是 `runDisplayWatchdog(trigger, allowRelaunch)`：上次正常会话的显示器指纹持久化在 electron-store 的 `lastDisplaySignature` key；`--hidden` 自启和 `resume`/`unlock-screen` 时若读数与指纹不符，轮询等 90 秒，等不来任何 display 事件就判定读数陈旧、`app.relaunch()` 静默重启一次（重启参数强制带 `--hidden`，并带 `--dpi-relaunched` 标记防循环；boot 场景重启后仍不符则接受当前读数——视为用户真的换了屏；唤醒时主窗口正被使用则不重启只等事件）。指纹比对宽高容忍 ±2px（Windows 缩放下 workArea 有 1707/1708 抖动）。另：宠物窗口是透明（layered）窗口，Windows 上其构造选项 `skipTaskbar` 不可靠——开机自启时 explorer/DPI 未就绪的竞态下会钻进任务栏，形成"点了没反应的幽灵图标"（`focusable:false` 导致点不动）。单靠 `refitPetWindow` 的重申不够（refit 只在冒气泡/显示器事件时才跑，开机后到首次冒气泡之间没有重申机会）。`createPetWindow` 用三道防线确保不进任务栏：构造 `show:false`、创建后立即显式 `setSkipTaskbar(true)`、`ready-to-show` 里"先 skip 再 show"且 show 后 1.5s 兜底重申一次；各点把执行动作与 `isVisible()` 落盘到 `pet-window-debug.log` 便于核验。注意 BrowserWindow **没有 `isSkipTaskbar()` getter**，调用会抛 TypeError 中断后续 `createTray`（托盘图标消失），切勿使用。主窗口静默启动期间也 skipTaskbar、`show` 时恢复。

排查这类问题看 `%APPDATA%/reminder-app`（`userData`）下的 `pet-window-debug.log`——打包后没有终端、`console.log` 会丢，主进程把 bounds 失配诊断落盘到这里（仅真失配时记录，不刷屏）。

### 宠物拖动位置持久化

左右宠物各自可拖动，落点存在设置的 `pet.positions.{left,right}`（`null` = 没拖过，用组件内默认的左下/右下角位置）。拖动结束时 `Live2DPet.vue` emit `position-changed`，`PetApp.vue` 按侧调 `saveSettings({ pet: { positions: { [side]: pos } } })`——靠 `save-settings` 的深度合并，改一侧不影响另一侧；启动时从设置恢复传入 `initialPos` prop。注意：`pet.position`（单数）是旧字段，已废弃不使用。

### 单实例锁

`app.requestSingleInstanceLock()`：抢不到锁直接退出（否则两层宠物叠在一起、提醒响两遍、两套存储互相覆盖）。第二个实例启动时由 `second-instance` 把已有主窗口唤到前台。

### 多入口构建

`vite.config.js` 用 `rollupOptions.input` 配置 `index.html` + `pet.html` 双入口，`base: './'`、`assetsInlineLimit: 0`（确保 Live2D 模型文件不被内联）。主窗口路由用 `createWebHashHistory`（`#/`），不能用默认的 HTML5 history——生产环境主进程用 `loadFile(dist/index.html)` 走 `file://` 协议，history 模式在 `file://` 下刷新/深链会 404。

## 编辑约定

- 所有源码注释和用户对话使用中文。
- 改代码前先简要说明思路，遇到多方案时列出选项让用户选择（不要直接动手）。
- 修改认证/安全相关代码前主动提示安全影响。
- IPC 通道名、`pet-message` 的 `type` 取值是跨进程契约，改动需同时更新发送端（preload + main）、接收端、以及对方的监听逻辑。
- 新增跨窗口通信时务必走主进程中转，不要在渲染进程间假设直接可达。
