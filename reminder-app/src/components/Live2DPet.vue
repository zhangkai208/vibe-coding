<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import * as PIXI from 'pixi.js'
import SpeechBubble from './SpeechBubble.vue'
import { usePetStore } from '@/stores/pet'
import { createMoodOverlay } from '@/utils/moodOverlay'

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
  },
  petScale: {
    type: Number,
    default: 0.3
  },
  // 宠物当前是否可见（「仅提醒时出现」模式会隐身）；隐身时停掉渲染省资源
  visible: {
    type: Boolean,
    default: true
  },
  // 上次拖动保存的落点 {x,y}；null 表示没拖过，用默认位置（左下/右下角）
  initialPos: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['bubble-closed', 'position-changed'])

// 整体缩放：以 BASE_SCALE 为画布内基准，petScale 的变化交给容器 CSS transform 处理，
// 让「模型」和「四周透明占位框」同步缩放，避免缩放后模型变小、固定透明框残留的违和感。
const BASE_SCALE = 0.3
const containerScale = computed(() => props.petScale / BASE_SCALE)

const petStore = usePetStore()
const container = ref(null)
const canvas = ref(null)
const pixiApp = ref(null)
const model = ref(null)
// 心情参数叠加控制器（非响应式，跟随模型生命周期）
let moodOverlay = null

// 气泡状态
const isSpeaking = ref(false)
const speechContent = ref('')
const speechReminderId = ref('')
const speechAutoClose = ref(true)
const speechAutoCloseDelay = ref(30)
// 问候模式：气泡不带操作按钮，自动消失也不回传"忽略"（不影响好感度）
const isGreeting = ref(false)

const isLoading = ref(true)
const debugMsg = ref('初始化...')
function debug(msg) {
  debugMsg.value = msg
  console.log('[Pet:' + props.position + '] ' + msg)
}

// 拖拽相关
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })
// 本次按下后是否真的拖动过（区分"点了一下"和"拖走了"，前者不必存盘）
let dragMoved = false

// 恢复保存的落点时夹回屏幕内（换显示器/改分辨率后坐标可能整个跑出屏幕）。
// 边界按"最小缩放下也至少露出约 60px 可点区域"取值；左右宠物的缩放锚点
// 分别在左下/右下角，所以横向界限不同
function clampToScreen(pos) {
  if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return null
  const minX = props.position === 'left' ? -140 : -240
  const maxX = props.position === 'left' ? window.innerWidth - 60 : window.innerWidth - 160
  return {
    x: Math.min(Math.max(pos.x, minX), maxX),
    y: Math.min(Math.max(pos.y, -340), window.innerHeight - 200)
  }
}

// 位置样式：优先用上次拖动保存的落点，没有则回默认位置（左下/右下角）
const positionStyle = ref(
  clampToScreen(props.initialPos) || {
    x: props.position === 'left' ? 20 : window.innerWidth - 320,
    y: window.innerHeight - 420
  }
)

// 窗口尺寸变化时（主进程在屏幕就绪后 setBounds 纠正、或用户改了分辨率）重算落点：
// 默认位置按新尺寸重算到左下/右下角；拖动落点按新屏幕重新夹紧——否则开机自启时
// 宠物会一直停在旧小窗口算出的左上坐标里
function handleResize() {
  if (props.initialPos) {
    const clamped = clampToScreen(props.initialPos)
    if (clamped) positionStyle.value = clamped
  } else {
    positionStyle.value = {
      x: props.position === 'left' ? 20 : window.innerWidth - 320,
      y: window.innerHeight - 420
    }
  }
}

function startDrag(e) {
  isDragging.value = true
  dragMoved = false
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
  dragMoved = true
}

function endDrag() {
  if (!isDragging.value) return
  isDragging.value = false
  // 拖动落点交给父组件持久化（PetApp 写入 pet.positions，重启恢复）
  if (dragMoved) emit('position-changed', { ...positionStyle.value })
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
  model.value.scale.set(BASE_SCALE)
  model.value.x = 150
  model.value.y = 200
  model.value.motion('idle')

  // 挂载心情叠加层（换装会重建模型，这里统一销毁重建）
  moodOverlay?.destroy()
  moodOverlay = createMoodOverlay(loadedModel, {
    awaySign: props.position === 'left' ? -1 : 1
  })
  moodOverlay.setMood(petStore.mood, { instant: true })

  // 挂载时如果正处于隐身状态（仅提醒时模式），立即停渲染
  if (!props.visible) setRendering(false)
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

// ===== 说话队列 =====
// 同一只宠物话没说完又来新内容时排队，说完一条停顿片刻再说下一条——不覆盖、不丢失。
// 停顿同时保证气泡组件先卸载再重建，打字机和倒计时能重新播放
const speechQueue = []
let nextSpeechTimer = null
const SPEECH_GAP_MS = 450

// 触发提醒
function triggerReminder(data) {
  enqueueSpeech({ kind: 'reminder', data: typeof data === 'string' ? { content: data } : data })
}

// 时段问候（上/下班）：纯消息气泡，15 秒自动消失
function triggerGreeting(content) {
  enqueueSpeech({ kind: 'greeting', content })
}

function enqueueSpeech(item) {
  if (isSpeaking.value || nextSpeechTimer) {
    // 同一条提醒已在排队就不重复排（比如手动关闭的气泡一直开着，提醒又到点了）
    if (
      item.kind === 'reminder' &&
      item.data.reminderId &&
      speechQueue.some(q => q.kind === 'reminder' && q.data.reminderId === item.data.reminderId)
    ) return
    speechQueue.push(item)
    return
  }
  showSpeech(item)
}

function showSpeech(item) {
  if (item.kind === 'greeting') {
    isGreeting.value = true
    speechContent.value = item.content
    speechReminderId.value = ''
    speechAutoClose.value = true
    speechAutoCloseDelay.value = 15
  } else {
    const data = item.data
    isGreeting.value = false
    speechContent.value = data.content || ''
    speechReminderId.value = data.reminderId || ''
    speechAutoClose.value = data.autoClose !== false
    speechAutoCloseDelay.value = data.autoCloseDelay || 30
  }
  isSpeaking.value = true

  if (model.value) {
    model.value.motion('tap_body')
  }
}

// 气泡关闭后的公共收尾：队列里还有话就接着说；全说完了才通知父组件
// （「仅提醒时」模式靠这个通知谢幕隐身，排队期间不能提前发）
function finishSpeech() {
  isSpeaking.value = false
  const next = speechQueue.shift()
  if (next) {
    nextSpeechTimer = setTimeout(() => {
      nextSpeechTimer = null
      showSpeech(next)
    }, SPEECH_GAP_MS)
    return
  }
  emit('bubble-closed')
}

// 预告动作
function triggerPreview() {
  if (model.value) {
    model.value.motion('tap_body')
  }
}

// 气泡事件 —— 统一走 finishSpeech 收尾（排队/谢幕逻辑见上）
function onBubbleClose() {
  finishSpeech()
}

function onBubbleAcknowledge(reminderId) {
  if (window.electronAPI?.acknowledgeReminder) {
    window.electronAPI.acknowledgeReminder(reminderId)
  }
  if (model.value) model.value.motion('thanking')
  finishSpeech()
}

function onBubblePostpone(reminderId) {
  // 推迟时长由主窗口按设置里的"推迟时长"决定，这里只上报"用户点了稍后"
  if (window.electronAPI?.postponeReminder) {
    window.electronAPI.postponeReminder({ reminderId })
  }
  finishSpeech()
}

function onBubbleAutoExpire(reminderId) {
  // 问候气泡到点消失是正常谢幕，不算"忽略提醒"，不回传、不扣好感
  if (!isGreeting.value && window.electronAPI?.ignoreReminder) {
    window.electronAPI.ignoreReminder(reminderId)
  }
  finishSpeech()
}

watch(() => petStore.mood, (newMood) => {
  moodOverlay?.setMood(newMood)
  if (!model.value) return
  if (newMood === 'happy') model.value.motion('thanking')
})

// 视线跟随：把屏幕坐标换算到画布内部坐标系（300x400）后交给 focus()。
// getBoundingClientRect 已含容器 CSS 缩放，比例换算天然抵消。生气时故意躲开鼠标。
function lookAt(clientX, clientY) {
  if (!model.value || !canvas.value) return
  const rect = canvas.value.getBoundingClientRect()
  if (!rect.width) return
  let x = (clientX - rect.left) * (300 / rect.width)
  const y = (clientY - rect.top) * (400 / rect.height)
  if (petStore.mood === 'angry') x = 300 - x
  model.value.focus(x, y)
}

// ===== 隐身省资源 =====
// 「仅提醒时出现」模式下宠物用 CSS 隐身，但 PIXI 还在每秒 60 帧地画看不见的画面。
// 隐身时把渲染循环和模型更新（呼吸/眨眼/物理）一起停掉，现身时恢复
function setRendering(on) {
  if (pixiApp.value) {
    on ? pixiApp.value.start() : pixiApp.value.stop()
  }
  if (model.value) {
    model.value.autoUpdate = on
  }
}

watch(() => props.visible, (v) => setRendering(v))

// 服装变化时重新加载模型
watch(() => props.skinFile, (file) => {
  if (file) changeSkin(file)
})

// 大小缩放改由容器 CSS transform 处理（见模板 :style 的 transform），这里不再操作 PIXI。

defineExpose({ triggerReminder, triggerGreeting, triggerPreview, lookAt })

onMounted(() => {
  loadModel()
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', endDrag)
  window.addEventListener('touchmove', onDrag)
  window.addEventListener('touchend', endDrag)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', endDrag)
  window.removeEventListener('touchmove', onDrag)
  window.removeEventListener('touchend', endDrag)
  window.removeEventListener('resize', handleResize)
  if (nextSpeechTimer) {
    clearTimeout(nextSpeechTimer)
    nextSpeechTimer = null
  }
  moodOverlay?.destroy()
  if (pixiApp.value) pixiApp.value.destroy(true)
})
</script>

<template>
  <div
    ref="container"
    class="live2d-pet"
    :style="{
      left: positionStyle.x + 'px',
      top: positionStyle.y + 'px',
      transform: 'scale(' + containerScale + ')',
      transformOrigin: position === 'left' ? 'left bottom' : 'right bottom'
    }"
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
      :show-actions="!isGreeting"
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
