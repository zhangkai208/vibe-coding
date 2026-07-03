# 提醒小助手 (Reminder App) - 实现计划

## 项目概述
一个**带 Live2D 桌面宠物**的提醒工具，由可爱的二次元萌妹提醒你休息/喝水/活动，基于 Electron + Vue 3 + Element Plus + Live2D 实现。

## 核心特色 ⭐

| 特色 | 描述 |
|------|------|
| **Live2D 萌妹宠物** | 使用开源 Live2D 模型，会呼吸、眨眼、表情变化 |
| **宠物说话提醒** | 由宠物来说话提醒，比冷冰冰的弹窗更温馨有趣 |
| **灵活显示模式** | 可选：常驻桌面 / 仅提醒时出现 |
| **服装更换** | 左右两只宠物各自可切换 19 套服装（圣诞/校服/夏装等） |
| **宠物大小调整** | 滑块无极调节宠物大小（左右共同，0.2~0.5） |
| **心情系统** | 确认提醒→开心，忽略→难过/生气；四档情绪循环轮换 |

## 需求确认

### 核心功能

| 功能 | 描述 | 状态 |
|------|------|------|
| 多个提醒 | 可添加多个提醒，如"喝水"每30分钟，"休息"每1小时 | ✅ |
| 宠物提醒 | 由 Live2D 宠物说话提醒，显示对话气泡 | ✅ |
| 宠物显示模式 | 常驻桌面 / 仅提醒时出现（用户可选） | ✅ |
| 关闭方式 | 支持手动关闭 + 自动消失两种模式 | ✅ |
| 自动消失时间 | 每个提醒可单独设置自动消失时间 | ✅ |
| 心情系统 | 按时响应→开心，忽略→难过 | ✅ |
| 全局暂停 | 一键暂停所有提醒（开会/看电影时） | ✅ |
| 时段问候 | 到达工作时段起/止时间，宠物弹"开工/下班"问候（纯消息气泡，无按钮、不影响好感度，每天各一次） | ✅ |
| 系统托盘 | 最小化到托盘，后台运行 | ✅ |
| 开机自启 | 可选择开机自动启动 | ✅ |
| 本地存储 | 设置保存在本地文件 | ✅ |

### 设计风格

| 方面 | 选择 |
|------|------|
| 视觉风格 | **简约风** - 干净简洁，宠物是亮点 |
| 宠物形象 | **Live2D 二次元萌妹**（开源模型） |

### 不需要的功能

| 功能 | 原因 |
|------|------|
| 声音提醒 | 宠物视觉提醒足够 |
| 统计功能 | 用户不需要 |
| 历史记录 | 用户不需要 |

## 技术栈

- **前端框架**: Vue 3 + Vite
- **桌面框架**: Electron
- **UI 组件**: Element Plus
- **Live2D**: pixi-live2d-display (基于 PixiJS)
- **本地存储**: electron-store (JSON 文件)
- **状态管理**: Pinia

## Live2D 资源

### 模型来源（已确认可用）

使用 **[imuncle/live2d](https://github.com/imuncle/live2d)** 开源模型库：

| 项目 | 内容 |
|------|------|
| 模型数量 | **128 个**（102 个 Cubism 2 + 26 个 Cubism 3） |
| 模型格式 | `.moc` (Cubism 2) ✅ pixi-live2d-display 兼容 |
| 包含内容 | 表情文件 + 动作文件 + 材质贴图 |
| 在线预览 | [imuncle.github.io/live2d](https://imuncle.github.io/live2d) |
| 版权 | ⚠️ 仅限学习/非商业用途 |

### 选定模型

用户已选择以下两个模型，分别显示在屏幕左右下角：

| 位置 | 模型路径 | CDN 加载地址 |
|------|----------|--------------|
| **左下角** | model/22 | `https://cdn.jsdelivr.net/gh/imuncle/live2d/model/22/model.default.json` |
| **右下角** | model/33 | `https://cdn.jsdelivr.net/gh/imuncle/live2d/model/33/model.default.json` |

### 模型结构
```
model/
├── model.default.json   # 配置文件（必需）
├── model.moc            # 模型本体（必需）
├── textures/            # 材质贴图
└── motions/             # 动作文件（可选）
```

### 加载方式

**本地优先、CDN 兜底**：模型资源已下载到 `public/models/{22,33}/`，运行时优先从本地加载（离线可用、更快），本地失败再回退 CDN。服装切换通过加载不同的 `model.*.json`（共用同一 `.moc`、只换 `closet.*` 服装贴图）实现。Live2D 运行时脚本（`live2d.min.js`、`live2dcubismcore.min.js`）同样本地化到 `public/lib/`，HTML 中通过 `onerror` 回退 CDN，保证断网冷启动也能加载。

```javascript
const modelDir = position === 'left' ? '22' : '33'
const localUrl = `./models/${modelDir}/${skinFile}`
const cdnUrl   = `https://cdn.jsdelivr.net/gh/imuncle/live2d/model/${modelDir}/${skinFile}`

try {
  model = await Live2DModel.from(localUrl)   // 本地优先（离线也可用）
} catch {
  model = await Live2DModel.from(cdnUrl)     // 本地失败再走 CDN 兜底
}
```

## 数据结构设计

### 提醒项 (Reminder)

```typescript
interface Reminder {
  id: string
  content: string           // 提醒内容
  interval: number          // 间隔时间（分钟）
  autoClose: boolean        // 是否自动关闭
  autoCloseDelay: number    // 自动关闭延迟（秒）
  enabled: boolean          // 是否启用
  lastTriggered: Date | null// 上次触发时间
}
```

### 宠物状态 (PetState)

```typescript
interface PetState {
  mood: 'happy' | 'normal' | 'sad' | 'angry'  // 心情状态（阈值 75/50/25 四等分）
  happiness: number         // 快乐值 0-100（确认重置到 95，每 20 秒 -1）
  displayMode: 'always' | 'reminder-only'    // 显示模式
  position: { x: number, y: number }         // 桌面位置（旧字段，已不使用）
  positions: {                               // 左右宠物各自拖动后的落点（重启恢复；null=默认左下/右下角）
    left: { x: number, y: number } | null
    right: { x: number, y: number } | null
  }
  skins: { left: string, right: string }     // 左/右宠物服装 id（见 constants/skins.js）
  petScale: number                            // 宠物大小 0.2~0.5（左右共同）
}
```

### 全局设置 (Settings)

```typescript
interface Settings {
  reminders: Reminder[]          // 提醒列表
  pet: PetState                  // 宠物状态
  globalPaused: boolean          // 全局暂停
  autoLaunch: boolean            // 开机自启
  closeToTray: boolean           // 关闭时最小化到托盘
  workingHours: {                // 工作时段
    enabled: boolean
    start: string                // '09:00'
    end: string                  // '18:00'
    weekdays: number[]           // [1,2,3,4,5]
  }
  idleThreshold: number          // 空闲阈值（秒）
  reminderDefaults: {            // 提醒默认值
    autoClose: boolean
    autoCloseDelay: number       // 秒
    postponeMinutes: number
  }
}
```

## 项目结构

```
reminder-app/
├── electron/
│   ├── main.js             # 主进程（窗口/托盘/IPC/存储/空闲检测）
│   ├── preload.js          # IPC 桥接
│   └── dev.js              # 开发环境启动入口
├── src/
│   ├── main.js             # 主窗口 Vue 入口（index.html）
│   ├── pet-main.js         # 宠物窗口 Vue 入口（pet.html）
│   ├── App.vue             # 主窗口根组件
│   ├── PetApp.vue          # 宠物窗口根组件
│   ├── router/index.js     # 主窗口路由（hash history）
│   ├── views/
│   │   ├── Home.vue        # 主页（提醒列表）
│   │   └── Settings.vue    # 设置页
│   ├── components/
│   │   ├── Live2DPet.vue       # Live2D 宠物组件
│   │   ├── SpeechBubble.vue    # 宠物对话气泡
│   │   ├── ReminderCard.vue    # 提醒卡片
│   │   ├── AddReminder.vue     # 添加/编辑提醒弹窗
│   │   └── TitleBar.vue        # 自定义标题栏
│   ├── stores/
│   │   ├── reminder.js     # 提醒状态 + 调度器
│   │   ├── pet.js          # 宠物状态（心情/服装/大小）
│   │   └── settings.js     # 设置状态
│   ├── constants/
│   │   ├── skins.js        # 服装清单（22/33 共用 19 套）
│   │   └── presets.js      # 预设提醒
│   └── utils/time.js       # 时间工具
├── public/
│   ├── icon.png            # 应用图标
│   └── models/{22,33}/     # Live2D 模型资源（本地优先加载）
├── index.html              # 主窗口入口
├── pet.html                # 宠物窗口入口（透明置顶）
├── package.json
└── vite.config.js          # 多入口构建（index + pet）
```

## 页面设计

### 1. 主页 (Home.vue)
- 显示所有提醒列表
- 每个提醒显示：内容、间隔、状态开关
- 添加新提醒按钮
- 编辑/删除提醒
- 全局暂停开关
- 宠物显示模式切换

### 2. 设置页面 (Settings.vue)
- 宠物显示模式（常驻 / 仅提醒时）
- 好感度展示
- 左 / 右宠物服装选择（各 19 套）
- 宠物大小滑块（左右共同，0.2~0.5）
- 工作时段（工作日 + 起止时间）
- 推迟时长
- 开机自启 / 关闭到托盘
- 空闲阈值

### 3. Live2D 宠物组件 (Live2DPet.vue)
- 渲染 Live2D 模型
- 空闲时：呼吸、眨眼、小动作
- 提醒时：挥手、说话动画 + 表情变化
- 可拖拽移动位置
- 根据心情显示不同表情

### 4. 对话气泡 (SpeechBubble.vue)
- 显示提醒内容
- 打字机效果
- 自动消失（可配置）

## IPC 通信接口

```javascript
// 渲染进程 -> 主进程
electronAPI.getSettings()           // 获取所有设置
electronAPI.saveSettings(settings)  // 保存设置
electronAPI.setAutoLaunch(enable)   // 设置开机自启
electronAPI.showPopup(reminder)     // 显示提醒弹窗
electronAPI.closePopup()            // 关闭提醒弹窗
```

## 实现步骤

### 第一阶段：项目初始化
1. 创建 Vue 3 + Vite 项目
2. 安装 Electron + Element Plus + electron-store
3. 安装 pixi-live2d-display + pixi.js
4. 配置 Vite + Electron 集成
5. 创建基础项目结构

### 第二阶段：Electron 主进程
1. main.js - 窗口管理、生命周期
2. preload.js - IPC 通信桥接
3. tray.js - 系统托盘图标和菜单
4. **透明窗口** - 宠物窗口需要透明背景
5. electron-store 持久化存储

### 第三阶段：Live2D 宠物
1. 集成 pixi-live2d-display
2. 加载开源 Live2D 模型
3. 实现空闲动画（呼吸、眨眼）
4. 实现提醒动画（挥手、说话）
5. 实现心情表情切换
6. 实现可拖拽移动

### 第四阶段：提醒核心功能
1. 定时器服务 - 管理多个提醒间隔
2. 宠物说话提醒 - 对话气泡组件
3. 心情系统 - 响应/忽略影响心情
4. 全局暂停功能

### 第五阶段：界面开发
1. 主页 - 提醒列表管理
2. 添加/编辑提醒弹窗
3. 设置页面
4. 托盘菜单

### 第六阶段：打包发布
1. 配置 electron-builder
2. 打包 Windows 安装包（包含 Live2D 资源）

## 关键代码示例

### Live2D 宠物组件
```vue
<!-- src/components/Live2DPet.vue -->
<template>
  <div class="pet-container" :style="{ left: petX + 'px', top: petY + 'px' }">
    <canvas ref="canvas"></canvas>
    <SpeechBubble v-if="isSpeaking" :content="speechContent" />
  </div>
</template>

<script setup>
import * as PIXI from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display'

const canvas = ref(null)
const model = ref(null)
const isSpeaking = ref(false)
const speechContent = ref('')

// 加载 Live2D 模型
async function loadModel() {
  const app = new PIXI.Application({
    view: canvas.value,
    transparent: true,
    autoStart: true,
  })

  model.value = await Live2DModel.from('./models/22/model.default.json')  // 本地优先（22/33 各一套）
  app.stage.addChild(model.value)

  // 默认空闲动画
  model.value.motion('Idle')
}

// 触发提醒
function triggerReminder(content) {
  isSpeaking.value = true
  speechContent.value = content
  model.value.motion('Tap')  // 挥手动作
  model.value.expression('happy')  // 开心表情
}

// 更换表情
function setMood(mood) {
  const expressions = {
    happy: 'happy',
    normal: 'normal',
    sad: 'sad',
    angry: 'angry'
  }
  model.value.expression(expressions[mood])
}
</script>
```

### 心情系统
```javascript
// src/stores/pet.js —— 心情系统（四档循环轮换，让用户体会每种情绪）
// 节奏：每 30~45 分钟确认一次，一个周期内 happy→normal→sad→angry 各约 8 分钟
const happiness = ref(50)
const mood = ref('normal')

// 确认提醒 → 重置到高位，从 happy 重新衰减
function onResponseReminder() {
  happiness.value = 95
  updateMood()
}

// 忽略提醒 → 扣分（下限 0）
function onIgnoreReminder() {
  happiness.value = Math.max(0, happiness.value - 15)
  updateMood()
}

// 阈值四等分，确保四种情绪都有等量区间
function updateMood() {
  if (happiness.value >= 75) mood.value = 'happy'
  else if (happiness.value >= 50) mood.value = 'normal'
  else if (happiness.value >= 25) mood.value = 'sad'
  else mood.value = 'angry'
}

// 自然衰减：每 20 秒 -1（≈每分钟 -3），最低扣到 0
function startHappinessDecay() {
  setInterval(() => {
    if (happiness.value > 0) {
      happiness.value = Math.max(0, happiness.value - 1)
      updateMood()
    }
  }, 20 * 1000)
}
```

### 透明窗口配置
```javascript
// electron/main.js - 宠物窗口
const petWindow = new BrowserWindow({
  width: 300,
  height: 400,
  transparent: true,      // 透明背景
  frame: false,           // 无边框
  alwaysOnTop: true,      // 始终置顶
  skipTaskbar: true,      // 不显示在任务栏
  resizable: false,
})
```

### 定时器管理
```javascript
// src/utils/timer.js
class ReminderTimer {
  constructor() {
    this.timers = new Map()
  }

  start(reminder, callback) {
    const timerId = setInterval(() => {
      if (!reminder.globalPaused && reminder.enabled) {
        callback(reminder)
      }
    }, reminder.interval * 60 * 1000)
    this.timers.set(reminder.id, timerId)
  }

  stop(reminderId) {
    clearInterval(this.timers.get(reminderId))
    this.timers.delete(reminderId)
  }
}
```

### 开机自启
```javascript
// electron/main.js
ipcMain.handle('set-auto-launch', (event, enable) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    openAsHidden: true
  })
})
```

## 验证方式

1. 启动应用，验证托盘图标显示
2. 验证 Live2D 宠物正常显示
3. 添加多个提醒，设置不同间隔
4. 验证宠物说话提醒（对话气泡）
5. 测试心情系统（响应/忽略观察表情变化）
6. 测试宠物显示模式切换
7. 测试全局暂停功能
8. 重启电脑，验证开机自启
9. 关闭应用，重新打开，验证设置已保存

## 文件清单

| 文件 | 用途 |
|------|------|
| electron/main.js | 主进程（窗口/托盘/IPC/存储/空闲检测） |
| electron/preload.js | IPC 桥接 |
| electron/dev.js | 开发环境启动 |
| src/main.js | 主窗口 Vue 入口 |
| src/pet-main.js | 宠物窗口 Vue 入口 |
| src/App.vue | 主窗口根组件 |
| src/PetApp.vue | 宠物窗口根组件 |
| src/router/index.js | 主窗口路由 |
| src/views/Home.vue | 主页 |
| src/views/Settings.vue | 设置页 |
| src/components/Live2DPet.vue | Live2D 宠物组件 |
| src/components/SpeechBubble.vue | 对话气泡 |
| src/components/ReminderCard.vue | 提醒卡片 |
| src/components/AddReminder.vue | 添加/编辑提醒 |
| src/components/TitleBar.vue | 自定义标题栏 |
| src/stores/reminder.js | 提醒状态 + 调度器 |
| src/stores/pet.js | 宠物状态（心情/服装/大小） |
| src/stores/settings.js | 设置状态 |
| src/constants/skins.js | 服装清单（22/33 共用） |
| src/constants/presets.js | 预设提醒 |
| src/utils/time.js | 时间工具 |
| public/models/{22,33} | Live2D 模型资源（本地优先加载） |
| index.html / pet.html | 双窗口入口 |
| package.json / vite.config.js | 依赖与多入口构建配置 |
