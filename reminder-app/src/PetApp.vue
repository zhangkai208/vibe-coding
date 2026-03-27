<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Live2DPet from '@/components/Live2DPet.vue'
import { usePetStore } from '@/stores/pet'
import { useSettingsStore } from '@/stores/settings'

const petStore = usePetStore()
const settingsStore = useSettingsStore()

// 当前是否显示宠物
const showPets = ref(true)

// 左边宠物 ref
const leftPetRef = ref(null)
// 右边宠物 ref
const rightPetRef = ref(null)

// 监听来自主窗口的消息
function handleIPCMessage(event, data) {
  if (data.type === 'trigger-reminder') {
    // 触发对应位置的宠物提醒
    const position = data.position || 'left'
    if (position === 'left' && leftPetRef.value) {
      leftPetRef.value.triggerReminder(data.content)
    } else if (position === 'right' && rightPetRef.value) {
      rightPetRef.value.triggerReminder(data.content)
    }
  } else if (data.type === 'set-display-mode') {
    showPets.value = data.mode === 'always'
    petStore.displayMode = data.mode
  } else if (data.type === 'sync-pet-state') {
    // 同步宠物状态
    if (data.happiness !== undefined) {
      petStore.happiness = data.happiness
    }
    if (data.mood !== undefined) {
      petStore.mood = data.mood
    }
  }
}

onMounted(async () => {
  // 加载设置
  const settings = await settingsStore.loadSettings()

  // 恢复宠物状态
  if (settings?.pet) {
    petStore.happiness = settings.pet.happiness ?? 50
    petStore.displayMode = settings.pet.displayMode ?? 'always'
    showPets.value = petStore.displayMode === 'always'
  }

  // 监听 IPC 消息（从主进程）
  if (window.electronAPI?.onPetMessage) {
    window.electronAPI.onPetMessage(handleIPCMessage)
  }
})

onUnmounted(() => {
  if (window.electronAPI?.removePetListener) {
    window.electronAPI.removePetListener()
  }
})
</script>

<template>
  <div class="pet-window">
    <!-- 左下角宠物 -->
    <Live2DPet
      v-if="showPets"
      ref="leftPetRef"
      position="left"
      model-path="model/22"
    />

    <!-- 右下角宠物 -->
    <Live2DPet
      v-if="showPets"
      ref="rightPetRef"
      position="right"
      model-path="model/33"
    />
  </div>
</template>

<style scoped>
.pet-window {
  width: 100%;
  height: 100%;
  background: transparent;
  pointer-events: none;
  position: relative;
}

.pet-window > * {
  pointer-events: auto;
}
</style>
