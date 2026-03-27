<script setup>
import { ref, watch } from 'vue'

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
  autoCloseDelay: 10
})

// 监听 reminder 变化，填充表单
watch(() => props.reminder, (newVal) => {
  if (newVal) {
    form.value = { ...newVal }
  } else {
    form.value = {
      content: '',
      interval: 30,
      autoClose: true,
      autoCloseDelay: 10
    }
  }
}, { immediate: true })

function handleClose() {
  emit('update:visible', false)
}

function handleSubmit() {
  if (!form.value.content.trim()) {
    return
  }
  emit('save', { ...form.value })
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="reminder ? '编辑提醒' : '添加提醒'"
    width="90%"
    @close="handleClose"
  >
    <el-form :model="form" label-position="top">
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
          :max="60"
        />
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
