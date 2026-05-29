<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as PIXI from 'pixi.js'
import SpeechBubble from './SpeechBubble.vue'
import { usePetStore } from '@/stores/pet'

const props = defineProps({
  position: {
    type: String,
    default: 'left'
  },
  modelPath: {
    type: String,
    required: true
  }
})

const petStore = usePetStore()
const container = ref(null)
const canvas = ref(null)
const pixiApp = ref(null)
const model = ref(null)

// 气泡状态
const isSpeaking = ref(false)
const speechContent = ref('')
const speechReminderId = ref('')
const speechAutoClose = ref(true)
const speechAutoCloseDelay = ref(30)

const isLoading = ref(true)
const debugMsg = ref('初始化...')
function debug(msg) {
  debugMsg.value = msg
  console.log('[Pet:' + props.position + '] ' + msg)
}

// 拖拽相关
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })

// 位置样式
const positionStyle = ref({
  x: props.position === 'left' ? 20 : window.innerWidth - 320,
  y: window.innerHeight - 420
})

function startDrag(e) {
  isDragging.value = true
  const clientX = e.clientX || e.touches?.[0]?.clientX
  const clientY = e.clientY || e.touches?.[0]?.clientY
  dragStartPos.value = { x: clientX - positionStyle.value.x, y: clientY - positionStyle.value.y }
  e.preventDefault()
}

function onDrag(e) {
  if (!isDragging.value) return
  const clientX = e.clientX || e.touches?.[0]?.clientX
  const clientY = e.clientY || e.touches?.[0]?.clientY
  positionStyle.value = { x: clientX - dragStartPos.value.x, y: clientY - dragStartPos.value.y }
}

function endDrag() {
  isDragging.value = false
}

// 等待 Live2D 运行时加载
function waitForRuntime(timeout = 10000) {
  return new Promise((resolve, reject) => {
    // 检查 Live2DModelWebGL (Cubism 2) 是否可用
    const check = () => {
      if (typeof window.Live2DModelWebGL !== 'undefined') {
        resolve(true)
        return
      }
      // 有些版本用不同的全局变量名
      if (typeof window.Live2D !== 'undefined') {
        resolve(true)
        return
      }
      return false
    }

    if (check()) return

    const start = Date.now()
    const interval = setInterval(() => {
      if (check()) {
        clearInterval(interval)
        return
      }
      if (Date.now() - start > timeout) {
        clearInterval(interval)
        // 即使超时也继续，可能运行时以其他方式存在
        resolve(false)
      }
    }, 200)
  })
}

// 加载 Live2D 模型
async function loadModel() {
  debug('开始加载...')

  try {
    debug('等待 Live2D 运行时...')
    await waitForRuntime()
    debug('运行时已就绪')

    // 动态导入 pixi-live2d-display（确保运行时已加载）
    debug('导入 pixi-live2d-display...')
    const { Live2DModel } = await import('pixi-live2d-display')

    debug('注册 Ticker...')
    Live2DModel.registerTicker(PIXI.Ticker)

    debug('创建 PIXI 应用...')
    pixiApp.value = new PIXI.Application({
      view: canvas.value,
      width: 300,
      height: 400,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    })
    debug('PIXI 就绪，开始加载模型...')

    const modelDir = props.position === 'left' ? '22' : '33'
    const cdnUrl = `https://cdn.jsdelivr.net/gh/imuncle/live2d/model/${modelDir}/model.default.json`

    debug('加载模型: CDN')
    let loadedModel
    try {
      loadedModel = await Live2DModel.from(cdnUrl)
      debug('CDN 模型加载成功')
    } catch (cdnErr) {
      debug('CDN 失败: ' + cdnErr.message + '，尝试本地')
      const localUrl = `./models/${modelDir}/model.default.json`
      loadedModel = await Live2DModel.from(localUrl)
      debug('本地模型加载成功')
    }

    model.value = loadedModel
    pixiApp.value.stage.addChild(model.value)
    model.value.anchor.set(0.5, 0.5)
    model.value.scale.set(0.3)
    model.value.x = 150
    model.value.y = 200
    model.value.motion('idle')
    isLoading.value = false
    debug('模型就绪!')

  } catch (error) {
    debug('失败: ' + error.message)
    console.error('[Live2DPet] 完整错误:', error)
    isLoading.value = false
  }
}

// 触发提醒
function triggerReminder(data) {
  const content = data.content || data
  const reminderId = data.reminderId || ''

  isSpeaking.value = true
  speechContent.value = content
  speechReminderId.value = reminderId
  speechAutoClose.value = data.autoClose !== false
  speechAutoCloseDelay.value = data.autoCloseDelay || 30

  if (model.value) {
    model.value.motion('tap_body')
  }
}

// 预告动作
function triggerPreview() {
  if (model.value) {
    model.value.motion('tap_body')
  }
}

// 气泡事件
function onBubbleClose() { isSpeaking.value = false }

function onBubbleAcknowledge(reminderId) {
  if (window.electronAPI?.acknowledgeReminder) {
    window.electronAPI.acknowledgeReminder(reminderId)
  }
  isSpeaking.value = false
  if (model.value) model.value.motion('thanking')
}

function onBubblePostpone(reminderId) {
  if (window.electronAPI?.postponeReminder) {
    window.electronAPI.postponeReminder({ reminderId, delay: 5 })
  }
  isSpeaking.value = false
}

function onBubbleAutoExpire(reminderId) {
  if (window.electronAPI?.ignoreReminder) {
    window.electronAPI.ignoreReminder(reminderId)
  }
  isSpeaking.value = false
}

watch(() => petStore.mood, (newMood) => {
  if (!model.value) return
  if (newMood === 'happy') model.value.motion('thanking')
})

defineExpose({ triggerReminder, triggerPreview })

onMounted(() => {
  loadModel()
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', endDrag)
  window.addEventListener('touchmove', onDrag)
  window.addEventListener('touchend', endDrag)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', endDrag)
  window.removeEventListener('touchmove', onDrag)
  window.removeEventListener('touchend', endDrag)
  if (pixiApp.value) pixiApp.value.destroy(true)
})
</script>

<template>
  <div
    ref="container"
    class="live2d-pet"
    :style="{ left: positionStyle.x + 'px', top: positionStyle.y + 'px' }"
    @mousedown="startDrag"
    @touchstart="startDrag"
  >
    <canvas ref="canvas"></canvas>

    <SpeechBubble
      v-if="isSpeaking"
      :content="speechContent"
      :reminder-id="speechReminderId"
      :auto-close="speechAutoClose"
      :auto-close-delay="speechAutoCloseDelay"
      @close="onBubbleClose"
      @acknowledge="onBubbleAcknowledge"
      @postpone="onBubblePostpone"
      @auto-expire="onBubbleAutoExpire"
    />

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading">
      加载中...
    </div>
  </div>
</template>

<style scoped>
.live2d-pet {
  position: fixed;
  width: 300px;
  height: 400px;
  z-index: 1;
  cursor: grab;
  user-select: none;
}

.live2d-pet:active {
  cursor: grabbing;
}

.live2d-pet canvas {
  pointer-events: none;
}

.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--text-muted, #999);
  font-size: 12px;
}
</style>
