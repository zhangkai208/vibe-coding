<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as PIXI from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display'
import SpeechBubble from './SpeechBubble.vue'
import { usePetStore } from '@/stores/pet'

// 注册 PIXI Ticker（pixi-live2d-display 需要）
Live2DModel.registerTicker(PIXI.Ticker)

const props = defineProps({
  position: {
    type: String,
    default: 'left' // 'left' | 'right'
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
const isSpeaking = ref(false)
const speechContent = ref('')
const isLoading = ref(true)

// 拖拽相关
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })

// 位置样式 - 固定默认位置（左下角/右下角，不遮挡界面）
const positionStyle = ref({
  x: props.position === 'left' ? -80 : window.innerWidth - 220,
  y: window.innerHeight - 400
})

// 开始拖拽
function startDrag(e) {
  isDragging.value = true
  const clientX = e.clientX || e.touches?.[0]?.clientX
  const clientY = e.clientY || e.touches?.[0]?.clientY
  dragStartPos.value = {
    x: clientX - positionStyle.value.x,
    y: clientY - positionStyle.value.y
  }
  e.preventDefault()
}

// 拖拽中
function onDrag(e) {
  if (!isDragging.value) return
  const clientX = e.clientX || e.touches?.[0]?.clientX
  const clientY = e.clientY || e.touches?.[0]?.clientY
  positionStyle.value = {
    x: clientX - dragStartPos.value.x,
    y: clientY - dragStartPos.value.y
  }
}

// 结束拖拽
function endDrag() {
  isDragging.value = false
  // 不保存位置，刷新后恢复默认
}

// 加载 Live2D 模型
async function loadModel() {
  try {
    // 创建 PixiJS 应用
    pixiApp.value = new PIXI.Application({
      view: canvas.value,
      width: 300,
      height: 400,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    })

    // 加载模型（使用 CDN 加载更稳定）
    const cdnPath = props.position === 'left'
      ? 'https://cdn.jsdelivr.net/gh/imuncle/live2d/model/22/model.default.json'
      : 'https://cdn.jsdelivr.net/gh/imuncle/live2d/model/33/model.default.json'

    model.value = await Live2DModel.from(cdnPath)
    pixiApp.value.stage.addChild(model.value)

    // 设置模型位置和缩放
    model.value.anchor.set(0.5, 0.5)
    model.value.scale.set(0.3)
    model.value.x = 150
    model.value.y = 200

    // 启动空闲动画
    model.value.motion('idle')

    isLoading.value = false
  } catch (error) {
    console.error('加载 Live2D 模型失败:', error)
    isLoading.value = false
  }
}

// 触发提醒
function triggerReminder(content) {
  isSpeaking.value = true
  speechContent.value = content

  // 播放动作
  if (model.value) {
    model.value.motion('tap_body')
    updateExpression()
  }
}

// 更新表情
function updateExpression() {
  if (!model.value) return
  try {
    const moodMap = {
      happy: 'happy',
      normal: 'normal',
      sad: 'sad',
      angry: 'angry'
    }
    model.value.expression(moodMap[petStore.mood])
  } catch (e) {
    // 模型可能不支持某些表情
  }
}

// 气泡关闭
function onBubbleClose() {
  isSpeaking.value = false
}

// 监听提醒事件
function handleReminderTriggered(event) {
  triggerReminder(event.detail.content)
}

// 监听心情变化
watch(() => petStore.mood, () => {
  updateExpression()
})

// 暴露方法给父组件
defineExpose({
  triggerReminder
})

onMounted(() => {
  loadModel()
  window.addEventListener('reminder-triggered', handleReminderTriggered)

  // 添加全局拖拽监听
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', endDrag)
  window.addEventListener('touchmove', onDrag)
  window.addEventListener('touchend', endDrag)
})

onUnmounted(() => {
  window.removeEventListener('reminder-triggered', handleReminderTriggered)
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', endDrag)
  window.removeEventListener('touchmove', onDrag)
  window.removeEventListener('touchend', endDrag)
  if (pixiApp.value) {
    pixiApp.value.destroy(true)
  }
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

    <!-- 对话气泡 -->
    <SpeechBubble
      v-if="isSpeaking"
      :content="speechContent"
      @close="onBubbleClose"
    />

    <!-- 加载中 -->
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
  color: #666;
  font-size: 14px;
}

.drag-hint {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: rgba(0, 0, 0, 0.3);
  pointer-events: none;
}
</style>
