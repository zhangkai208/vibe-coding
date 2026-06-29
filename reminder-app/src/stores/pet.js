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

  // 服装（左/右宠物各自的皮肤 id，见 constants/skins.js）
  const skins = ref({ left: 'default', right: 'default' })

  // 宠物大小（左右共同，Live2D 模型缩放比例）
  const petScale = ref(0.3)

  // 好感度衰减定时器
  let decayTimer = null

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

  // 好感度描述
  const happinessDesc = computed(() => {
    const h = happiness.value
    if (h >= 80) return '非常开心！'
    if (h >= 60) return '心情不错~'
    if (h >= 40) return '还不错吧'
    if (h >= 20) return '有点不开心...'
    return '很不高兴！'
  })

  // 用户响应提醒（开心）：重置到高位，确保下一轮从 happy 稳定衰减到底、走完四种情绪
  function onResponseReminder() {
    happiness.value = 95
    updateMood()
  }

  // 用户忽略提醒（难过）
  function onIgnoreReminder() {
    happiness.value = Math.max(0, happiness.value - 15)
    updateMood()
  }

  // 更新心情（阈值四等分：每档 25，确保四种情绪都能被经历到）
  function updateMood() {
    if (happiness.value >= 75) {
      mood.value = 'happy'
    } else if (happiness.value >= 50) {
      mood.value = 'normal'
    } else if (happiness.value >= 25) {
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

  // 设置服装（positionKey: 'left' | 'right'）
  function setSkin(positionKey, id) {
    skins.value = { ...skins.value, [positionKey]: id }
  }

  // 设置宠物大小（左右共同）
  function setScale(s) {
    petScale.value = s
  }

  // 启动好感度衰减（每 20 秒 -1，≈每分钟 -3）：配合 30~45 分钟确认节奏，
  // 让数值在一个周期内从高位扫到 0，轮换经历四种情绪
  function startHappinessDecay() {
    stopHappinessDecay()
    decayTimer = setInterval(() => {
      if (happiness.value > 0) {
        happiness.value = Math.max(0, happiness.value - 1) // 最低扣到 0，不低于
        updateMood()
      }
    }, 20 * 1000) // 每 20 秒 -1
  }

  // 停止好感度衰减
  function stopHappinessDecay() {
    if (decayTimer) {
      clearInterval(decayTimer)
      decayTimer = null
    }
  }

  return {
    mood,
    happiness,
    displayMode,
    position,
    skins,
    petScale,
    moodEmoji,
    happinessDesc,
    onResponseReminder,
    onIgnoreReminder,
    setDisplayMode,
    setPosition,
    setSkin,
    setScale,
    startHappinessDecay,
    stopHappinessDecay
  }
})
