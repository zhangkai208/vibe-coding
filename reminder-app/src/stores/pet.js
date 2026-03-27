import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const usePetStore = defineStore('pet', () => {
  // 心情状态
  const mood = ref('normal') // 'happy' | 'normal' | 'sad' | 'angry'

  // 快乐值 0-100
  const happiness = ref(50)

  // 显示模式
  const displayMode = ref('always') // 'always' | 'reminder-only'

  // 位置
  const position = ref({ x: 50, y: 0 })

  // 计算心情表情
  const moodEmoji = computed(() => {
    const emojis = {
      happy: '😊',
      normal: '😐',
      sad: '😢',
      angry: '😠'
    }
    return emojis[mood.value]
  })

  // 用户响应提醒（开心）
  function onResponseReminder() {
    happiness.value = Math.min(100, happiness.value + 10)
    updateMood()
  }

  // 用户忽略提醒（难过）
  function onIgnoreReminder() {
    happiness.value = Math.max(0, happiness.value - 15)
    updateMood()
  }

  // 更新心情
  function updateMood() {
    if (happiness.value >= 70) {
      mood.value = 'happy'
    } else if (happiness.value >= 40) {
      mood.value = 'normal'
    } else if (happiness.value >= 20) {
      mood.value = 'sad'
    } else {
      mood.value = 'angry'
    }
  }

  // 设置显示模式
  function setDisplayMode(mode) {
    displayMode.value = mode
  }

  // 设置位置
  function setPosition(x, y) {
    position.value = { x, y }
  }

  return {
    mood,
    happiness,
    displayMode,
    position,
    moodEmoji,
    onResponseReminder,
    onIgnoreReminder,
    setDisplayMode,
    setPosition
  }
})
