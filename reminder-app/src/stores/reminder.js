import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useSettingsStore } from './settings'
import { isWithinWorkingHours } from '@/utils/time'

// 调度器 Tick 间隔（毫秒）
const TICK_INTERVAL = 10 * 1000 // 10 秒，兼顾精度和性能

export const useReminderStore = defineStore('reminder', () => {
  // 提醒列表
  const reminders = ref([])

  // 全局暂停
  const globalPaused = ref(false)

  // 系统空闲状态
  const isIdle = ref(false)

  // 调度器定时器 ID
  let schedulerId = null

  // 响应式时钟（每秒更新一次）：让"下次提醒"倒计时能实时走秒。
  // Date.now() 不是响应式的，直接用它的 computed 只会在提醒列表变化时才重算
  const nowMs = ref(Date.now())
  let clockId = null

  // 已发送预告的提醒 ID 集合
  const previewSent = new Set()

  // ===== 计算属性 =====

  // 下一个即将触发的提醒
  const nextReminder = computed(() => {
    const now = nowMs.value
    let nearest = null
    let nearestTime = Infinity

    for (const r of reminders.value) {
      if (!r.enabled) continue
      const last = r.lastTriggered ? new Date(r.lastTriggered).getTime() : 0
      const remaining = r.interval * 60 * 1000 - (now - last)
      if (remaining < nearestTime) {
        nearestTime = remaining
        nearest = r
      }
    }
    return nearest
  })

  // 距离下一次提醒的毫秒数（随 nowMs 每秒刷新，界面可倒计时到秒）
  const msUntilNext = computed(() => {
    const r = nextReminder.value
    if (!r) return Infinity

    const last = r.lastTriggered ? new Date(r.lastTriggered).getTime() : 0
    const remaining = r.interval * 60 * 1000 - (nowMs.value - last)
    return Math.max(0, remaining)
  })

  // ===== 提醒 CRUD =====

  // 添加提醒
  function addReminder(reminder) {
    const newReminder = {
      id: Date.now().toString(),
      content: reminder.content,
      interval: reminder.interval || 30,
      autoClose: reminder.autoClose ?? true,
      autoCloseDelay: reminder.autoCloseDelay || 30,
      enabled: reminder.enabled ?? true,
      position: reminder.position || 'left',
      lastTriggered: null
    }
    reminders.value.push(newReminder)
    return newReminder
  }

  // 更新提醒
  function updateReminder(id, updates) {
    const index = reminders.value.findIndex(r => r.id === id)
    if (index !== -1) {
      reminders.value[index] = { ...reminders.value[index], ...updates }
    }
  }

  // 删除提醒
  function removeReminder(id) {
    const index = reminders.value.findIndex(r => r.id === id)
    if (index !== -1) {
      reminders.value.splice(index, 1)
    }
    previewSent.delete(id)
  }

  // ===== 调度器 =====

  // 启动调度器
  function startScheduler() {
    stopScheduler()
    schedulerId = setInterval(schedulerTick, TICK_INTERVAL)
    clockId = setInterval(() => { nowMs.value = Date.now() }, 1000)
    // 启动时立即执行一次 Tick
    schedulerTick()
  }

  // 停止调度器
  function stopScheduler() {
    if (schedulerId) {
      clearInterval(schedulerId)
      schedulerId = null
    }
    if (clockId) {
      clearInterval(clockId)
      clockId = null
    }
  }

  // 调度器 Tick
  function schedulerTick() {
    if (globalPaused.value || isIdle.value) return

    // 工作时段：开关打开、且当前不在选定的工作日/时段内时，不预告也不触发
    const settingsStore = useSettingsStore()
    if (
      settingsStore.workingHours.enabled &&
      !isWithinWorkingHours(settingsStore.workingHours)
    ) return

    const now = Date.now()

    for (let i = 0; i < reminders.value.length; i++) {
      const reminder = reminders.value[i]
      if (!reminder.enabled) continue

      const last = reminder.lastTriggered ? new Date(reminder.lastTriggered).getTime() : 0
      const elapsed = now - last
      const targetMs = reminder.interval * 60 * 1000

      // 预告：触发前 10 秒
      if (elapsed >= targetMs - 10000 && elapsed < targetMs && !previewSent.has(reminder.id)) {
        previewSent.add(reminder.id)
        sendPreview(reminder)
      }

      // 触发
      if (elapsed >= targetMs) {
        triggerReminder(reminder)
        // 直接修改数组元素的属性（保持响应式）
        reminders.value[i] = {
          ...reminder,
          lastTriggered: new Date().toISOString()
        }
        previewSent.delete(reminder.id)
      }
    }
  }

  // 发送预告（10 秒前的预警告）
  function sendPreview(reminder) {
    if (window.electronAPI?.previewReminder) {
      window.electronAPI.previewReminder({
        position: reminder.position
      })
    }
  }

  // 触发提醒
  function triggerReminder(reminder) {
    // 通过 IPC 发送到宠物窗口
    if (window.electronAPI?.triggerReminder) {
      window.electronAPI.triggerReminder({
        content: reminder.content,
        reminderId: reminder.id,
        autoClose: reminder.autoClose,
        autoCloseDelay: reminder.autoCloseDelay,
        position: reminder.position
      })
    }
  }

  // ===== 推迟提醒 =====

  function postponeReminder(reminderId, delayMinutes) {
    const index = reminders.value.findIndex(r => r.id === reminderId)
    if (index !== -1) {
      // 将 lastTriggered 设置为 (now - interval + postponeDelay)
      // 这样下次 tick 会在 postponeDelay 分钟后触发
      const reminder = reminders.value[index]
      const postponeMs = delayMinutes * 60 * 1000
      const effectiveLast = Date.now() - (reminder.interval * 60 * 1000 - postponeMs)
      reminders.value[index] = {
        ...reminder,
        lastTriggered: new Date(effectiveLast).toISOString()
      }
    }
  }

  // 立即触发下一个提醒
  function triggerNextReminder() {
    if (globalPaused.value) return

    const r = nextReminder.value
    if (r) {
      triggerReminder(r)
      const index = reminders.value.findIndex(rem => rem.id === r.id)
      if (index !== -1) {
        reminders.value[index] = {
          ...r,
          lastTriggered: new Date().toISOString()
        }
      }
    }
  }

  // 切换全局暂停
  function toggleGlobalPaused() {
    globalPaused.value = !globalPaused.value
  }

  // 设置空闲状态
  function setIdle(idle) {
    isIdle.value = idle
  }

  return {
    reminders,
    globalPaused,
    isIdle,
    nextReminder,
    msUntilNext,
    addReminder,
    updateReminder,
    removeReminder,
    startScheduler,
    stopScheduler,
    postponeReminder,
    triggerNextReminder,
    toggleGlobalPaused,
    setIdle
  }
})
