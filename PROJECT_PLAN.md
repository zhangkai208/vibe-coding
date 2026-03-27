# 提醒小助手 (Reminder App) - 实现计划

## 项目概述
一个类似 Stretchly/Workrave 的桌面提醒工具，支持自定义提醒内容，基于 Electron + Vue 3 + Element Plus 实现。

## 需求确认

### 核心功能

| 功能 | 描述 | 状态 |
|------|------|------|
| 多个提醒 | 可添加多个提醒，如"喝水"每30分钟，"休息"每1小时 | ✅ |
| 右下角弹窗 | 小窗口提醒，不打断工作 | ✅ |
| 关闭方式 | 支持手动关闭 + 自动消失两种模式 | ✅ |
| 自动消失时间 | 每个提醒可单独设置自动消失时间 | ✅ |
| 全局暂停 | 一键暂停所有提醒（开会/看电影时） | ✅ |
| 系统托盘 | 最小化到托盘，后台运行 | ✅ |
| 开机自启 | 可选择开机自动启动 | ✅ |
| 本地存储 | 设置保存在本地文件 | ✅ |

### 不需要的功能

| 功能 | 原因 |
|------|------|
| 声音提醒 | 用户不需要 |
| 统计功能 | 用户不需要 |
| 历史记录 | 用户不需要 |

## 技术栈

- **前端框架**: Vue 3 + Vite
- **桌面框架**: Electron
- **UI 组件**: Element Plus
- **本地存储**: electron-store (JSON 文件)
- **状态管理**: Pinia

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

### 全局设置 (Settings)

```typescript
interface Settings {
  reminders: Reminder[]     // 提醒列表
  globalPaused: boolean     // 全局暂停
  autoLaunch: boolean       // 开机自启
  closeToTray: boolean      // 关闭时最小化到托盘
}
```

## 项目结构

```
reminder-app/
├── electron/
│   ├── main.js             # Electron 主进程
│   ├── preload.js          # 预加载脚本（IPC 桥接）
│   └── tray.js             # 托盘管理
├── src/
│   ├── views/
│   │   ├── Home.vue        # 主页（提醒列表）
│   │   └── Settings.vue    # 全局设置页面
│   ├── components/
│   │   ├── ReminderCard.vue    # 单个提醒卡片
│   │   ├── ReminderPopup.vue   # 提醒弹窗组件
│   │   └── AddReminder.vue     # 添加/编辑提醒弹窗
│   ├── stores/
│   │   ├── reminder.js     # 提醒状态管理
│   │   └── settings.js     # 设置状态管理
│   ├── utils/
│   │   └── timer.js        # 定时器工具
│   ├── App.vue
│   └── main.js
├── package.json
├── vite.config.js
└── electron-builder.json   # 打包配置
```

## 页面设计

### 1. 主页 (Home.vue)
- 显示所有提醒列表
- 每个提醒显示：内容、间隔、状态开关
- 添加新提醒按钮
- 编辑/删除提醒
- 全局暂停开关

### 2. 设置页面 (Settings.vue)
- 开机自启开关
- 关闭到托盘开关
- 关于信息

### 3. 提醒弹窗 (ReminderPopup.vue)
- 显示提醒内容
- 倒计时（如果设置了自动关闭）
- 关闭按钮

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
3. 配置 Vite + Electron 集成
4. 创建基础项目结构

### 第二阶段：Electron 主进程
1. main.js - 窗口管理、生命周期
2. preload.js - IPC 通信桥接
3. tray.js - 系统托盘图标和菜单
4. electron-store 持久化存储

### 第三阶段：提醒核心功能
1. 定时器服务 - 管理多个提醒间隔
2. 提醒弹窗 - BrowserWindow 显示
3. 全局暂停功能

### 第四阶段：界面开发
1. 主页 - 提醒列表管理
2. 添加/编辑提醒弹窗
3. 设置页面
4. 托盘菜单

### 第五阶段：打包发布
1. 配置 electron-builder
2. 打包 Windows 安装包

## 关键代码示例

### 定时器管理
```javascript
// src/utils/timer.js
class ReminderTimer {
  constructor() {
    this.timers = new Map() // reminderId -> timerId
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
2. 添加多个提醒，设置不同间隔
3. 验证提醒弹窗正常弹出
4. 测试自动关闭功能
5. 测试全局暂停功能
6. 重启电脑，验证开机自启
7. 关闭应用，重新打开，验证设置已保存

## 文件清单

| 文件 | 用途 |
|------|------|
| electron/main.js | Electron 主进程 |
| electron/preload.js | IPC 桥接 |
| electron/tray.js | 托盘管理 |
| src/main.js | Vue 入口 |
| src/App.vue | 根组件 |
| src/views/Home.vue | 主页 |
| src/views/Settings.vue | 设置页 |
| src/components/ReminderCard.vue | 提醒卡片 |
| src/components/ReminderPopup.vue | 提醒弹窗 |
| src/components/AddReminder.vue | 添加提醒 |
| src/stores/reminder.js | 提醒状态 |
| src/stores/settings.js | 设置状态 |
| src/utils/timer.js | 定时器工具 |
| package.json | 依赖配置 |
| vite.config.js | Vite 配置 |
