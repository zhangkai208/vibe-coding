<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  content: {
    type: String,
    required: true
  },
  autoClose: {
    type: Boolean,
    default: true
  },
  autoCloseDelay: {
    type: Number,
    default: 5
  }
})

const emit = defineEmits(['close'])

const displayText = ref('')
const isTyping = ref(false)
let typingTimer = null
let closeTimer = null

// 打字机效果
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
      isTyping.value = false

      // 自动关闭
      if (props.autoClose) {
        closeTimer = setTimeout(() => {
          emit('close')
        }, props.autoCloseDelay * 1000)
      }
    }
  }, 100)
}

function handleClose() {
  if (typingTimer) clearInterval(typingTimer)
  if (closeTimer) clearTimeout(closeTimer)
  emit('close')
}

onMounted(() => {
  typeWriter()
})
</script>

<template>
  <div class="speech-bubble">
    <div class="bubble-content">
      {{ displayText }}
      <span v-if="isTyping" class="cursor">|</span>
    </div>
    <div class="bubble-arrow"></div>
  </div>
</template>

<style scoped>
.speech-bubble {
  position: absolute;
  top: -80px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 150px;
  max-width: 250px;
}

.bubble-content {
  font-size: 14px;
  color: #303133;
  line-height: 1.5;
  word-break: break-word;
}

.cursor {
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.bubble-arrow {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid white;
}
</style>
