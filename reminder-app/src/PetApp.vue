<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Live2DPet from '@/components/Live2DPet.vue'
import { usePetStore } from '@/stores/pet'
import { useSettingsStore } from '@/stores/settings'

const petStore = usePetStore()
const settingsStore = useSettingsStore()

const petsVisible = ref(true)
const isTemporarilyShown = ref(false)
const leftPetRef = ref(null)
const rightPetRef = ref(null)

// 鼠标穿透控制：当鼠标在宠物/气泡上时允许交互，其他区域穿透
function handleMouseMove(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY)
  if (!el) return

  // 检查鼠标是否在交互元素上（宠物容器、气泡、按钮等）
  const interactive = el.closest('.live2d-pet, .speech-bubble, .pet-window')
  const isOnPet = !!interactive && !interactive.classList.contains('pet-window')

  if (window.electronAPI?.setPetInteractable) {
    window.electronAPI.setPetInteractable(isOnPet)
  }
}

function handleIPCMessage(event, data) {
  if (data.type === 'trigger-reminder') {
    if (petStore.displayMode === 'reminder-only' && !petsVisible.value) {
      petsVisible.value = true
      isTemporarilyShown.value = true
    }

    const position = data.position || 'left'
    const speakingPet = position === 'left' ? leftPetRef.value : rightPetRef.value
    const otherPet = position === 'left' ? rightPetRef.value : leftPetRef.value

    // 说话的宠物显示气泡
    if (speakingPet) speakingPet.triggerReminder(data)
    // 另一个宠物也做动作（不说话）
    if (otherPet) otherPet.triggerPreview()

  } else if (data.type === 'set-display-mode') {
    petStore.displayMode = data.mode
    petsVisible.value = data.mode === 'always'
    isTemporarilyShown.value = false
  } else if (data.type === 'sync-pet-state') {
    if (data.happiness !== undefined) petStore.happiness = data.happiness
    if (data.mood !== undefined) petStore.mood = data.mood
  } else if (data.type === 'preview-reminder') {
    const position = data.position || 'left'
    const pet = position === 'left' ? leftPetRef.value : rightPetRef.value
    if (pet) pet.triggerPreview()
  }
}

function onBubbleClosed() {
  if (isTemporarilyShown.value) {
    setTimeout(() => {
      petsVisible.value = false
      isTemporarilyShown.value = false
    }, 1000)
  }
}

onMounted(async () => {
  // 监听鼠标移动实现穿透控制
  document.addEventListener('mousemove', handleMouseMove)

  try {
    const settings = await settingsStore.loadSettings()
    if (settings?.pet) {
      petStore.happiness = settings.pet.happiness ?? 50
      petStore.displayMode = settings.pet.displayMode ?? 'always'
      petsVisible.value = petStore.displayMode === 'always'
    }
  } catch {}

  if (window.electronAPI?.onPetMessage) {
    window.electronAPI.onPetMessage(handleIPCMessage)
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  if (window.electronAPI?.removePetListener) {
    window.electronAPI.removePetListener()
  }
})
</script>

<template>
  <div class="pet-window">
    <Live2DPet
      ref="leftPetRef"
      :class="{ 'pet-hidden': !petsVisible }"
      position="left"
      model-path="model/22"
      @bubble-closed="onBubbleClosed"
    />

    <Live2DPet
      ref="rightPetRef"
      :class="{ 'pet-hidden': !petsVisible }"
      position="right"
      model-path="model/33"
      @bubble-closed="onBubbleClosed"
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
  transition: opacity 0.4s ease;
}

.pet-hidden {
  opacity: 0 !important;
  pointer-events: none !important;
}
</style>
