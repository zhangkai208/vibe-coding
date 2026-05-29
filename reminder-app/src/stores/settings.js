import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  // 开机自启
  const autoLaunch = ref(false)

  // 关闭到托盘
  const closeToTray = ref(true)

  // 工作时段
  const workingHours = ref({
    enabled: false,
    start: '09:00',
    end: '18:00',
    weekdays: [1, 2, 3, 4, 5]
  })

  // 声音设置
  const sound = ref({
    enabled: true,
    volume: 0.7
  })

  // 空闲阈值（秒）
  const idleThreshold = ref(300)

  // 提醒默认值
  const reminderDefaults = ref({
    autoClose: true,
    autoCloseDelay: 30,
    soundEnabled: true,
    postponeMinutes: 5
  })

  // 从 electron-store 加载设置
  async function loadSettings() {
    if (window.electronAPI) {
      const settings = await window.electronAPI.getSettings()

      autoLaunch.value = settings.autoLaunch ?? false
      closeToTray.value = settings.closeToTray ?? true

      if (settings.workingHours) {
        workingHours.value = { ...workingHours.value, ...settings.workingHours }
      }
      if (settings.sound) {
        sound.value = { ...sound.value, ...settings.sound }
      }
      if (settings.idleThreshold !== undefined) {
        idleThreshold.value = settings.idleThreshold
      }
      if (settings.reminderDefaults) {
        reminderDefaults.value = { ...reminderDefaults.value, ...settings.reminderDefaults }
      }

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
        workingHours: workingHours.value,
        sound: sound.value,
        idleThreshold: idleThreshold.value,
        reminderDefaults: reminderDefaults.value,
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
    workingHours,
    sound,
    idleThreshold,
    reminderDefaults,
    loadSettings,
    saveSettings,
    setAutoLaunch
  }
})
