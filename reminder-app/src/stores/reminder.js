import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { usePetStore } from './pet'

export const useReminderStore = defineStore('reminder', () => {
  // 提醒列表
  const reminders = ref([])

  // 全局暂停
  const globalPaused = ref(false)

  // 定时器 Map
  const timers = new Map()

  // 添加提醒
  function addReminder(reminder) {
    const newReminder = {
      id: Date.now().toString(),
      content: reminder.content,
      interval: reminder.interval || 30,
      autoClose: reminder.autoClose ?? true,
      autoCloseDelay: reminder.autoCloseDelay || 10,
      enabled: reminder.enabled ?? true,
      lastTriggered: null
    }
    reminders.value.push(newReminder)
    if (newReminder.enabled) {
      startTimer(newReminder)
    }
    return newReminder
  }

  // 更新提醒
  function updateReminder(id, updates) {
    const index = reminders.value.findIndex(r => r.id === id)
    if (index !== -1) {
      const oldEnabled = reminders.value[index].enabled
      reminders.value[index] = { ...reminders.value[index], ...updates }

      // 如果启用状态改变，处理定时器
      if (updates.enabled !== undefined && updates.enabled !== oldEnabled) {
        if (updates.enabled) {
          startTimer(reminders.value[index])
        } else {
          stopTimer(id)
        }
      }
    }
  }

  // 删除提醒
  function removeReminder(id) {
    stopTimer(id)
    const index = reminders.value.findIndex(r => r.id === id)
    if (index !== -1) {
      reminders.value.splice(index, 1)
    }
  }

  // 启动定时器
  function startTimer(reminder) {
    if (timers.has(reminder.id)) {
      clearInterval(timers.get(reminder.id))
    }

    const timerId = setInterval(() => {
      if (!globalPaused.value && reminder.enabled) {
        triggerReminder(reminder)
      }
    }, reminder.interval * 60 * 1000)

    timers.set(reminder.id, timerId)
  }

  // 停止定时器
  function stopTimer(id) {
    if (timers.has(id)) {
      clearInterval(timers.get(id))
      timers.delete(id)
    }
  }

  // 触发提醒
  function triggerReminder(reminder) {
    reminder.lastTriggered = new Date()

    // 更新好感度（在主窗口）
    const petStore = usePetStore()
    petStore.onResponseReminder()

    // 触发提醒事件（由组件监听）
    window.dispatchEvent(new CustomEvent('reminder-triggered', {
      detail: reminder
    }))

    // 通过 IPC 发送到宠物窗口
    if (window.electronAPI?.triggerReminder) {
      window.electronAPI.triggerReminder({
        content: reminder.content,
        position: 'left' // 默认左边宠物说话
      })
    }
  }

  // 切换全局暂停
  function toggleGlobalPaused() {
    globalPaused.value = !globalPaused.value
  }

  // 初始化定时器
  function initTimers() {
    reminders.value.forEach(reminder => {
      if (reminder.enabled) {
        startTimer(reminder)
      }
    })
  }

  return {
    reminders,
    globalPaused,
    addReminder,
    updateReminder,
    removeReminder,
    toggleGlobalPaused,
    initTimers
  }
})
