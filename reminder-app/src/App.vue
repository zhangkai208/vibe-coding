<script setup>
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useReminderStore } from '@/stores/reminder'
import { usePetStore } from '@/stores/pet'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const reminderStore = useReminderStore()
const petStore = usePetStore()
const settingsStore = useSettingsStore()

// 同步宠物状态到宠物窗口
function syncPetStateToWindow() {
  if (window.electronAPI?.syncPetState) {
    window.electronAPI.syncPetState({
      happiness: petStore.happiness,
      mood: petStore.mood
    })
  }
}

onMounted(async () => {
  // 加载设置
  const settings = await settingsStore.loadSettings()

  // 恢复提醒列表
  if (settings?.reminders) {
    settings.reminders.forEach(r => {
      reminderStore.reminders.push(r)
    })
    reminderStore.initTimers()
  }

  // 恢复宠物状态
  if (settings?.pet) {
    petStore.happiness = settings.pet.happiness ?? 50
    petStore.displayMode = settings.pet.displayMode ?? 'always'
    if (settings.pet.position) {
      petStore.setPosition(settings.pet.position.x, settings.pet.position.y)
    }
  }

  // 同步宠物显示模式到宠物窗口
  if (window.electronAPI?.setPetDisplayMode) {
    window.electronAPI.setPetDisplayMode(petStore.displayMode)
  }

  // 同步宠物状态
  syncPetStateToWindow()
})

// 监听显示模式变化，同步到宠物窗口
watch(() => petStore.displayMode, (newMode) => {
  if (window.electronAPI?.setPetDisplayMode) {
    window.electronAPI.setPetDisplayMode(newMode)
  }
})

// 监听心情/好感度变化，同步到宠物窗口
watch(() => petStore.happiness, () => {
  syncPetStateToWindow()
})

watch(() => petStore.mood, () => {
  syncPetStateToWindow()
})
</script>

<template>
  <div class="app-container">
    <router-view />
  </div>
</template>

<style scoped>
.app-container {
  width: 100%;
  height: 100vh;
}
</style>
