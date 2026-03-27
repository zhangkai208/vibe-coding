import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  // 开机自启
  const autoLaunch = ref(false)

  // 关闭到托盘
  const closeToTray = ref(true)

  // 从 electron-store 加载设置
  async function loadSettings() {
    if (window.electronAPI) {
      const settings = await window.electronAPI.getSettings()
      autoLaunch.value = settings.autoLaunch ?? false
      closeToTray.value = settings.closeToTray ?? true
      return settings
    }
    return null
  }

  // 保存设置到 electron-store
  async function saveSettings(settings) {
    if (window.electronAPI) {
      await window.electronAPI.saveSettings({
        autoLaunch: autoLaunch.value,
        closeToTray: closeToTray.value,
        ...settings
      })
    }
  }

  // 设置开机自启
  async function setAutoLaunch(enabled) {
    autoLaunch.value = enabled
    if (window.electronAPI) {
      await window.electronAPI.setAutoLaunch(enabled)
    }
  }

  return {
    autoLaunch,
    closeToTray,
    loadSettings,
    saveSettings,
    setAutoLaunch
  }
})
