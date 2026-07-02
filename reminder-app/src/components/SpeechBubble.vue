<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  content: {
    type: String,
    required: true
  },
  reminderId: {
    type: String,
    default: ''
  },
  autoClose: {
    type: Boolean,
    default: true
  },
  autoCloseDelay: {
    type: Number,
    default: 30
  },
  // 是否显示"知道了/稍后"操作按钮；时段问候等纯消息气泡传 false
  showActions: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['close', 'acknowledge', 'postpone', 'auto-expire'])

const displayText = ref('')
const isTyping = ref(false)
const remainingSeconds = ref(props.autoCloseDelay)
const showCountdown = ref(props.autoClose)

let typingTimer = null
let closeTimer = null
let countdownTimer = null

function typeWriter() {
  isTyping.value = true
  displayText.value = ''
  let index = 0

  typingTimer = setInterval(() => {
    if (index < props.content.length) {
      displayText.value += props.content[index]
      index++
    } else {
      clearInterval(typingTimer)
      typingTimer = null
      isTyping.value = false
      if (props.autoClose) {
        startCountdown()
      }
    }
  }, 80)
}

function startCountdown() {
  remainingSeconds.value = props.autoCloseDelay
  showCountdown.value = true

  countdownTimer = setInterval(() => {
    remainingSeconds.value--
    if (remainingSeconds.value <= 0) {
      clearInterval(countdownTimer)
      countdownTimer = null
      cleanup()
      emit('auto-expire', props.reminderId)
    }
  }, 1000)
}

function cleanup() {
  if (typingTimer) { clearInterval(typingTimer); typingTimer = null }
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null }
}

function handleClose() {
  cleanup()
  emit('close')
}

function handleAcknowledge() {
  cleanup()
  emit('acknowledge', props.reminderId)
}

function handlePostpone() {
  cleanup()
  emit('postpone', props.reminderId)
}

import { computed } from 'vue'

const countdownPercent = computed(() => {
  return Math.max(0, (remainingSeconds.value / props.autoCloseDelay) * 100)
})

onMounted(() => { typeWriter() })
onUnmounted(() => { cleanup() })
</script>

<template>
  <div class="speech-bubble" @click.stop>
    <!-- 关闭 -->
    <button class="bubble-close" @click="handleClose">✕</button>

    <!-- 头部装饰点 -->
    <div class="bubble-dots">
      <span></span><span></span><span></span>
    </div>

    <!-- 内容 -->
    <div class="bubble-content">
      {{ displayText }}
      <span v-if="isTyping" class="cursor">|</span>
    </div>

    <!-- 倒计时 -->
    <div v-if="showCountdown && !isTyping" class="bubble-countdown">
      <div class="countdown-track">
        <div class="countdown-fill" :style="{ width: countdownPercent + '%' }"></div>
      </div>
      <span class="countdown-label">{{ remainingSeconds }}s</span>
    </div>

    <!-- 操作 -->
    <div v-if="!isTyping && showActions" class="bubble-actions">
      <button class="btn-ok" @click="handleAcknowledge">
        知道了
      </button>
      <button class="btn-later" @click="handlePostpone">
        稍后
      </button>
    </div>

    <!-- 箭头 -->
    <div class="bubble-arrow"></div>
  </div>
</template>

<style scoped>
.speech-bubble {
  position: absolute;
  top: -140px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  border-radius: 20px;
  padding: 16px 18px 14px;
  box-shadow:
    0 4px 24px rgba(255, 123, 123, 0.12),
    0 1px 4px rgba(196, 176, 212, 0.1);
  min-width: 210px;
  max-width: 280px;
  z-index: 10;
  border: 1.5px solid var(--border-soft);
  animation: bubble-in 0.35s ease;
}

@keyframes bubble-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

.bubble-close {
  position: absolute;
  top: 8px;
  right: 10px;
  background: none;
  border: none;
  font-size: 13px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 6px;
  line-height: 1;
  transition: all 0.2s;
}
.bubble-close:hover {
  background: var(--sakura-light);
  color: var(--primary);
}

.bubble-dots {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}
.bubble-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sakura-light);
}
.bubble-dots span:nth-child(2) {
  background: var(--lavender-light);
}
.bubble-dots span:nth-child(3) {
  background: var(--mint-light);
}

.bubble-content {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.7;
  word-break: break-word;
  padding-right: 16px;
  font-weight: 500;
}

.cursor {
  animation: blink 1s infinite;
  color: var(--primary);
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.bubble-countdown {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.countdown-track {
  flex: 1;
  height: 4px;
  background: var(--sakura-light);
  border-radius: 2px;
  overflow: hidden;
}

.countdown-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--sakura));
  border-radius: 2px;
  transition: width 1s linear;
}

.countdown-label {
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 600;
  min-width: 20px;
  text-align: right;
}

.bubble-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.btn-ok, .btn-later {
  flex: 1;
  padding: 8px 0;
  border: none;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
}

.btn-ok {
  background: linear-gradient(135deg, var(--primary), #FF9A9A);
  color: white;
  box-shadow: 0 3px 10px rgba(255, 123, 123, 0.3);
}
.btn-ok:hover {
  box-shadow: 0 4px 14px rgba(255, 123, 123, 0.45);
  transform: translateY(-1px);
}

.btn-later {
  background: var(--sakura-light);
  color: var(--primary-dark);
  border: 1.5px solid transparent;
}
.btn-later:hover {
  background: white;
  border-color: var(--sakura);
}

.bubble-arrow {
  position: absolute;
  bottom: -9px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 10px solid rgba(255, 255, 255, 0.96);
  filter: drop-shadow(0 2px 2px rgba(255, 183, 197, 0.1));
}
</style>
