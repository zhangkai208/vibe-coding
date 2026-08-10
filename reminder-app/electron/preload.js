const { contextBridge, ipcRenderer } = require('electron')

// 保存回调引用，用于精确移除
let petMessageCallback = null
let reminderResponseCallback = null
let idleStateChangedCallback = null
let pauseStateChangedCallback = null
let triggerNextReminderCallback = null

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // ===== 设置 =====
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  setAutoLaunch: (enable) => ipcRenderer.invoke('set-auto-launch', enable),

  // ===== 主窗口 -> 宠物窗口（通过主进程中转）=====
  triggerReminder: (data) => ipcRenderer.send('trigger-reminder', data),
  setPetDisplayMode: (mode) => ipcRenderer.send('set-pet-display-mode', mode),
  setPetSkin: (data) => ipcRenderer.send('set-pet-skin', data),
  setPetScale: (scale) => ipcRenderer.send('set-pet-scale', scale),
  syncPetState: (data) => ipcRenderer.send('sync-pet-state', data),
  previewReminder: (data) => ipcRenderer.send('preview-reminder', data),
  triggerGreeting: (data) => ipcRenderer.send('trigger-greeting', data),

  // ===== 宠物窗口 -> 主窗口（通过主进程中转）=====
  acknowledgeReminder: (reminderId) => ipcRenderer.send('reminder-acknowledged', reminderId),
  postponeReminder: (data) => ipcRenderer.send('reminder-postponed', data),
  ignoreReminder: (reminderId) => ipcRenderer.send('reminder-ignored', reminderId),

  // ===== 鼠标穿透控制 =====
  setPetInteractable: (interactable) => ipcRenderer.send('set-pet-interactable', interactable),

  // ===== 空闲检测 =====
  getIdleTime: () => ipcRenderer.invoke('get-idle-time'),

  // ===== 宠物窗口监听（来自主进程的消息）=====
  onPetMessage: (callback) => {
    petMessageCallback = (event, data) => callback(event, data)
    ipcRenderer.on('pet-message', petMessageCallback)
  },
  removePetListener: () => {
    if (petMessageCallback) {
      ipcRenderer.removeListener('pet-message', petMessageCallback)
      petMessageCallback = null
    }
  },

  // ===== 主窗口监听（宠物窗口的响应）=====
  onReminderResponse: (callback) => {
    reminderResponseCallback = (event, data) => callback(event, data)
    ipcRenderer.on('reminder-response', reminderResponseCallback)
  },
  removeReminderResponseListener: () => {
    if (reminderResponseCallback) {
      ipcRenderer.removeListener('reminder-response', reminderResponseCallback)
      reminderResponseCallback = null
    }
  },

  // ===== 主窗口监听（空闲状态变化）=====
  onIdleStateChanged: (callback) => {
    idleStateChangedCallback = (event, data) => callback(event, data)
    ipcRenderer.on('idle-state-changed', idleStateChangedCallback)
  },
  removeIdleStateListener: () => {
    if (idleStateChangedCallback) {
      ipcRenderer.removeListener('idle-state-changed', idleStateChangedCallback)
      idleStateChangedCallback = null
    }
  },

  // ===== 主窗口监听（暂停状态变化，来自托盘菜单）=====
  onPauseStateChanged: (callback) => {
    pauseStateChangedCallback = (event, data) => callback(event, data)
    ipcRenderer.on('pause-state-changed', pauseStateChangedCallback)
  },
  removePauseStateListener: () => {
    if (pauseStateChangedCallback) {
      ipcRenderer.removeListener('pause-state-changed', pauseStateChangedCallback)
      pauseStateChangedCallback = null
    }
  },

  // ===== 主窗口监听（跳到下一个提醒，来自托盘菜单）=====
  onTriggerNextReminder: (callback) => {
    triggerNextReminderCallback = (event, data) => callback(event, data)
    ipcRenderer.on('trigger-next-reminder', triggerNextReminderCallback)
  },
  removeTriggerNextReminderListener: () => {
    if (triggerNextReminderCallback) {
      ipcRenderer.removeListener('trigger-next-reminder', triggerNextReminderCallback)
      triggerNextReminderCallback = null
    }
  },

  // ===== 自定义标题栏：窗口控制 =====
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // ===== 渲染进程诊断与就绪信号 =====
  // 渲染进程关键状态/错误经此通道写入主进程的 pet-window-debug.log（打包后 console.log 会丢）
  rendererLog: (msg) => ipcRenderer.send('renderer-log', msg),
  // 渲染进程初始化完成时通知主进程（清除就绪看门狗超时；超时主进程会 reload 自愈）
  petRendererReady: () => ipcRenderer.send('pet-renderer-ready'),

  // ===== 平台信息 =====
  platform: process.platform
})
