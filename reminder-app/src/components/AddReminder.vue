<script setup>
import { ref, watch } from 'vue'
import { Close, Bell } from '@element-plus/icons-vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  reminder: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:visible', 'save'])

const form = ref({
  content: '',
  interval: 30,
  autoClose: true,
  autoCloseDelay: 30,
  position: 'left'
})

// 监听 reminder 变化，填充表单
watch(() => props.reminder, (newVal) => {
  if (newVal) {
    form.value = {
      content: newVal.content || '',
      interval: newVal.interval || 30,
      autoClose: newVal.autoClose ?? true,
      autoCloseDelay: newVal.autoCloseDelay || 30,
      position: newVal.position || 'left'
    }
  } else {
    form.value = {
      content: '',
      interval: 30,
      autoClose: true,
      autoCloseDelay: 30,
      position: 'left'
    }
  }
}, { immediate: true })

function handleClose() {
  emit('update:visible', false)
}

function handleSubmit() {
  if (!form.value.content.trim()) return
  emit('save', { ...form.value })
}
</script>

<template>
  <el-dialog
    class="add-reminder-dialog"
    modal-class="add-reminder-modal"
    :model-value="visible"
    width="90%"
    top="5vh"
    :show-close="false"
    @close="handleClose"
  >
    <template #header>
      <div class="dialog-header">
        <div class="dialog-title-wrap">
          <span class="dialog-title-icon">
            <el-icon :size="16"><Bell /></el-icon>
          </span>
          <span class="dialog-title">{{ reminder ? '编辑提醒' : '添加提醒' }}</span>
        </div>
        <button class="dialog-close" @click="handleClose" title="关闭">
          <el-icon :size="16"><Close /></el-icon>
        </button>
      </div>
    </template>
    <el-form :model="form" label-position="top" size="small">
      <el-form-item label="提醒内容" required>
        <el-input
          v-model="form.content"
          placeholder="请输入提醒内容，如：该喝水了"
          maxlength="50"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="间隔时间（分钟）">
        <el-input-number
          v-model="form.interval"
          :min="1"
          :max="480"
          :step="5"
        />
      </el-form-item>

      <el-form-item label="自动关闭">
        <el-switch v-model="form.autoClose" />
      </el-form-item>

      <el-form-item v-if="form.autoClose" label="自动关闭延迟（秒）">
        <el-input-number
          v-model="form.autoCloseDelay"
          :min="5"
          :max="120"
          :step="5"
        />
      </el-form-item>

      <el-form-item label="播报宠物">
        <el-radio-group v-model="form.position">
          <el-radio value="left">左侧（22）</el-radio>
          <el-radio value="right">右侧（33）</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSubmit">
        {{ reminder ? '保存' : '添加' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dialog-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dialog-title-icon {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--sakura) 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3px 8px rgba(255, 123, 123, 0.35);
}

.dialog-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.dialog-close {
  width: 30px;
  height: 30px;
  border: none;
  background: rgba(255, 255, 255, 0.65);
  border-radius: 50%;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s ease;
  font-family: inherit;
}

.dialog-close:hover {
  background: var(--primary);
  color: #fff;
  transform: rotate(90deg);
}
</style>

<!-- 非 scoped：el-dialog 会 teleport 到 body，scoped 选择器无法命中其根元素 -->
<style>
.add-reminder-dialog {
  border-radius: var(--radius-lg) !important;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(255, 123, 123, 0.22),
              0 8px 24px rgba(74, 59, 92, 0.1) !important;
  border: 1px solid var(--border-soft);
}

/* 隐藏弹窗滚动条（仍可用滚轮/触控板滚动，只是不显示那条丑陋的竖条） */
.add-reminder-modal .el-overlay-dialog {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.add-reminder-modal .el-overlay-dialog::-webkit-scrollbar {
  display: none;
}

/* 标题栏：顶部跟随弹窗圆角、底部弧线过渡，上下都不再是方正直角 */
.add-reminder-dialog .el-dialog__header {
  border-radius: 22px 22px 24px 24px;
}

.add-reminder-dialog .el-dialog__body {
  background: linear-gradient(180deg, #FFFFFF 0%, var(--bg-warm) 100%) !important;
}

.add-reminder-dialog .el-dialog__footer {
  background: var(--bg-warm) !important;
  border-top: 1px dashed var(--border-soft);
  border-radius: 0 0 22px 22px;
}

/* 取消按钮未写 type，渲染为 .el-button（不带 --default），全局 default 圆角规则不命中，这里统一补上 */
.add-reminder-dialog .el-dialog__footer .el-button {
  border-radius: var(--radius-pill) !important;
}
</style>
