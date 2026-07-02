<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Live2DPet from '@/components/Live2DPet.vue'
import { usePetStore } from '@/stores/pet'
import { useSettingsStore } from '@/stores/settings'
import { skinToFile } from '@/constants/skins'

const petStore = usePetStore()
const settingsStore = useSettingsStore()

const petsVisible = ref(true)
const isTemporarilyShown = ref(false)
const leftPetRef = ref(null)
const rightPetRef = ref(null)

// 设置加载完成后再挂载宠物，确保初始皮肤文件名就绪
const ready = ref(false)
const leftSkinFile = ref('model.default.json')
const rightSkinFile = ref('model.default.json')
const petScale = ref(0.3)

// 鼠标穿透控制：当鼠标在宠物/气泡上时允许交互，其他区域穿透。
// mousemove 每秒可触发上百次，缓存上次状态，只在进入/离开宠物区域的翻转瞬间才发 IPC
let lastInteractable = null
function handleMouseMove(e) {
  // 视线跟随：每次移动都喂坐标（focus 内部自带平滑；生气时的躲闪在 lookAt 里处理）
  if (petsVisible.value) {
    leftPetRef.value?.lookAt(e.clientX, e.clientY)
    rightPetRef.value?.lookAt(e.clientX, e.clientY)
  }

  const el = document.elementFromPoint(e.clientX, e.clientY)
  if (!el) return

  // 检查鼠标是否在交互元素上（宠物容器、气泡、按钮等）
  const interactive = el.closest('.live2d-pet, .speech-bubble, .pet-window')
  const isOnPet = !!interactive && !interactive.classList.contains('pet-window')

  if (isOnPet === lastInteractable) return
  lastInteractable = isOnPet

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

  } else if (data.type === 'greeting') {
    // 时段问候：复用提醒的出场逻辑（仅提醒时模式下临时现身），气泡是纯消息
    if (petStore.displayMode === 'reminder-only' && !petsVisible.value) {
      petsVisible.value = true
      isTemporarilyShown.value = true
    }

    const speakingPet = data.position === 'right' ? rightPetRef.value : leftPetRef.value
    const otherPet = data.position === 'right' ? leftPetRef.value : rightPetRef.value

    if (speakingPet) speakingPet.triggerGreeting(data.content)
    if (otherPet) otherPet.triggerPreview()

  } else if (data.type === 'set-display-mode') {
    petStore.displayMode = data.mode
    petsVisible.value = data.mode === 'always'
    isTemporarilyShown.value = false
  } else if (data.type === 'set-skin') {
    // 主窗口切换了某侧宠物的服装，更新 skinFile 触发 Live2DPet 重载
    if (data.position === 'left') leftSkinFile.value = data.file
    else if (data.position === 'right') rightSkinFile.value = data.file
  } else if (data.type === 'set-scale') {
    petScale.value = data.scale
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
      petStore.updateMood()  // 启动即按存盘的好感度算出心情，叠加层第一帧就是对的脸色
      petStore.displayMode = settings.pet.displayMode ?? 'always'
      petsVisible.value = petStore.displayMode === 'always'
      // 恢复两侧宠物服装（id -> model.*.json）
      const skins = settings.pet.skins || {}
      leftSkinFile.value = skinToFile(skins.left)
      rightSkinFile.value = skinToFile(skins.right)
      if (settings.pet.petScale !== undefined) {
        petScale.value = settings.pet.petScale
      }
    }
  } catch {}
  ready.value = true

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
      v-if="ready"
      ref="leftPetRef"
      :class="{ 'pet-hidden': !petsVisible }"
      position="left"
      model-path="model/22"
      :skin-file="leftSkinFile"
      :pet-scale="petScale"
      :visible="petsVisible"
      @bubble-closed="onBubbleClosed"
    />

    <Live2DPet
      v-if="ready"
      ref="rightPetRef"
      :class="{ 'pet-hidden': !petsVisible }"
      position="right"
      model-path="model/33"
      :skin-file="rightSkinFile"
      :pet-scale="petScale"
      :visible="petsVisible"
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
