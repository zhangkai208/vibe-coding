<script setup>
import { onMounted, watch, ref } from 'vue'
import { useRouter } from 'vue-router'
import TitleBar from '@/components/TitleBar.vue'
import { useReminderStore } from '@/stores/reminder'
import { usePetStore } from '@/stores/pet'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const reminderStore = useReminderStore()
const petStore = usePetStore()
const settingsStore = useSettingsStore()

// 是否已完成初始化
const isInitialized = ref(false)

// 同步宠物状态到宠物窗口
function syncPetStateToWindow() {
  if (window.electronAPI?.syncPetState) {
    window.electronAPI.syncPetState({
      happiness: petStore.happiness,
      mood: petStore.mood
    })
  }
}

// 保存所有状态
async function saveAllState() {
  if (!isInitialized.value) return

  await settingsStore.saveSettings({
    reminders: JSON.parse(JSON.stringify(reminderStore.reminders)),
    pet: {
      mood: petStore.mood,
      happiness: petStore.happiness,
      displayMode: petStore.displayMode,
      position: petStore.position
    },
    globalPaused: reminderStore.globalPaused
  })
  syncPetStateToWindow()
}

// 处理宠物窗口的用户响应
function handleReminderResponse(event, data) {
  if (data.type === 'acknowledged') {
    petStore.onResponseReminder()
  } else if (data.type === 'ignored') {
    petStore.onIgnoreReminder()
  } else if (data.type === 'postponed') {
    // 推迟提醒
    const delayMinutes = data.delay || 5
    reminderStore.postponeReminder(data.reminderId, delayMinutes)
  }
}

// 处理空闲状态变化
function handleIdleStateChanged(event, isIdle) {
  reminderStore.setIdle(isIdle)
}

// 处理暂停状态变化（来自托盘菜单）
function handlePauseStateChanged(event, isPaused) {
  if (isPaused) {
    reminderStore.globalPaused = true
  } else {
    reminderStore.globalPaused = false
  }
}

// 处理"跳到下一个提醒"（来自托盘菜单）
function handleTriggerNextReminder() {
  reminderStore.triggerNextReminder()
}

onMounted(async () => {
  // 加载设置
  const settings = await settingsStore.loadSettings()

  // 恢复提醒列表
  if (settings?.reminders) {
    settings.reminders.forEach(r => {
      reminderStore.reminders.push(r)
    })
  }

  // 恢复全局暂停状态
  if (settings?.globalPaused) {
    reminderStore.globalPaused = true
  }

  // 恢复宠物状态
  if (settings?.pet) {
    petStore.happiness = settings.pet.happiness ?? 50
    petStore.displayMode = settings.pet.displayMode ?? 'always'
    if (settings.pet.position) {
      petStore.setPosition(settings.pet.position.x, settings.pet.position.y)
    }
    petStore.updateMood?.()
  }

  // 同步宠物显示模式到宠物窗口
  if (window.electronAPI?.setPetDisplayMode) {
    window.electronAPI.setPetDisplayMode(petStore.displayMode)
  }

  // 同步宠物状态
  syncPetStateToWindow()

  // 启动调度器
  reminderStore.startScheduler()

  // 启动好感度衰减
  petStore.startHappinessDecay()

  // 监听宠物窗口的用户响应
  if (window.electronAPI?.onReminderResponse) {
    window.electronAPI.onReminderResponse(handleReminderResponse)
  }

  // 监听空闲状态
  if (window.electronAPI?.onIdleStateChanged) {
    window.electronAPI.onIdleStateChanged(handleIdleStateChanged)
  }

  // 监听暂停状态（来自托盘菜单）
  if (window.electronAPI?.onPauseStateChanged) {
    window.electronAPI.onPauseStateChanged(handlePauseStateChanged)
  }

  // 监听"跳到下一个提醒"（来自托盘菜单）
  if (window.electronAPI?.onTriggerNextReminder) {
    window.electronAPI.onTriggerNextReminder(handleTriggerNextReminder)
  }

  // 标记初始化完成
  isInitialized.value = true
})

// 监听显示模式变化
watch(() => petStore.displayMode, (newMode) => {
  if (window.electronAPI?.setPetDisplayMode) {
    window.electronAPI.setPetDisplayMode(newMode)
  }
  saveAllState()
})

// 监听好感度变化
watch(() => petStore.happiness, () => {
  syncPetStateToWindow()
  saveAllState()
})

// 监听心情变化
watch(() => petStore.mood, () => {
  syncPetStateToWindow()
})

// 监听全局暂停
watch(() => reminderStore.globalPaused, () => {
  saveAllState()
})
</script>

<template>
  <div class="app-container">
    <TitleBar />
    <div class="app-content">
      <router-view />
    </div>
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
