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
  },
  skinFile: {
    type: String,
    default: 'model.default.json'
  }
})

const emit = defineEmits(['bubble-closed'])

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

// Live2DModel 构造器（首次 import 后缓存，供换装复用）
let Live2DModelCtor = null

// 把已加载的模型挂到舞台并定位
function applyModel(loadedModel) {
  model.value = loadedModel
  pixiApp.value.stage.addChild(model.value)
  model.value.anchor.set(0.5, 0.5)
  model.value.scale.set(0.3)
  model.value.x = 150
  model.value.y = 200
  model.value.motion('idle')
}

// 按服装文件名加载模型：本地优先，CDN 兜底
async function fetchModel(file) {
  const modelDir = props.position === 'left' ? '22' : '33'
  const localUrl = `./models/${modelDir}/${file}`
  const cdnUrl = `https://cdn.jsdelivr.net/gh/imuncle/live2d/model/${modelDir}/${file}`

  debug('加载模型(本地): ' + file)
  try {
    const m = await Live2DModelCtor.from(localUrl)
    debug('本地模型加载成功')
    return m
  } catch (localErr) {
    debug('本地失败: ' + localErr.message + '，尝试 CDN')
    const m = await Live2DModelCtor.from(cdnUrl)
    debug('CDN 模型加载成功')
    return m
  }
}

// 初始加载：创建 PIXI 应用 + 加载当前皮肤模型
async function loadModel() {
  debug('开始加载...')

  try {
    debug('等待 Live2D 运行时...')
    await waitForRuntime()
    debug('运行时已就绪')

    // 动态导入 pixi-live2d-display（确保运行时已加载）
    debug('导入 pixi-live2d-display...')
    Live2DModelCtor = (await import('pixi-live2d-display')).Live2DModel

    debug('注册 Ticker...')
    Live2DModelCtor.registerTicker(PIXI.Ticker)

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

    applyModel(await fetchModel(props.skinFile))
    isLoading.value = false
    debug('模型就绪!')

  } catch (error) {
    debug('失败: ' + error.message)
    console.error('[Live2DPet] 完整错误:', error)
    isLoading.value = false
  }
}

// 切换服装（运行时复用同一 PIXI 应用，只替换舞台上的模型）
async function changeSkin(file) {
  if (!pixiApp.value || !Live2DModelCtor) return
  isLoading.value = true

  // 先移除并销毁旧模型，避免叠影 / 内存泄漏
  if (model.value) {
    try {
      pixiApp.value.stage.removeChild(model.value)
      model.value.destroy()
    } catch (e) {
      console.error('[Live2DPet] 销毁旧模型失败:', e)
    }
    model.value = null
  }

  try {
    applyModel(await fetchModel(file))
    debug('换装完成: ' + file)
  } catch (error) {
    debug('换装失败: ' + error.message)
    console.error('[Live2DPet] 换装错误:', error)
  } finally {
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

// 气泡事件 —— 关闭后通知父组件，用于「仅提醒时」模式下隐藏宠物
function onBubbleClose() {
  isSpeaking.value = false
  emit('bubble-closed')
}

function onBubbleAcknowledge(reminderId) {
  if (window.electronAPI?.acknowledgeReminder) {
    window.electronAPI.acknowledgeReminder(reminderId)
  }
  isSpeaking.value = false
  if (model.value) model.value.motion('thanking')
  emit('bubble-closed')
}

function onBubblePostpone(reminderId) {
  if (window.electronAPI?.postponeReminder) {
    window.electronAPI.postponeReminder({ reminderId, delay: 5 })
  }
  isSpeaking.value = false
  emit('bubble-closed')
}

function onBubbleAutoExpire(reminderId) {
  if (window.electronAPI?.ignoreReminder) {
    window.electronAPI.ignoreReminder(reminderId)
  }
  isSpeaking.value = false
  emit('bubble-closed')
}

watch(() => petStore.mood, (newMood) => {
  if (!model.value) return
  if (newMood === 'happy') model.value.motion('thanking')
})

// 服装变化时重新加载模型
watch(() => props.skinFile, (file) => {
  if (file) changeSkin(file)
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
