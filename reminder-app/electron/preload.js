const { contextBridge, ipcRenderer } = require('electron')

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取设置
  getSettings: () => ipcRenderer.invoke('get-settings'),

  // 保存设置
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // 设置开机自启
  setAutoLaunch: (enable) => ipcRenderer.invoke('set-auto-launch', enable),

  // 触发提醒（发送到宠物窗口）
  triggerReminder: (data) => ipcRenderer.send('trigger-reminder', data),

  // 设置宠物显示模式（发送到宠物窗口）
  setPetDisplayMode: (mode) => ipcRenderer.send('set-pet-display-mode', mode),

  // 同步宠物状态（发送到宠物窗口）
  syncPetState: (data) => ipcRenderer.send('sync-pet-state', data),

  // 监听宠物窗口消息（宠物窗口使用）
  onPetMessage: (callback) => {
    ipcRenderer.on('pet-message', (event, data) => callback(event, data))
  },

  // 移除宠物消息监听
  removePetListener: () => {
    ipcRenderer.removeAllListeners('pet-message')
  },

  // 平台信息
  platform: process.platform
})
