<script setup>
import { Edit, Delete } from '@element-plus/icons-vue'

const props = defineProps({
  reminder: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['edit', 'delete', 'toggle'])

function formatInterval(minutes) {
  if (minutes < 60) {
    return `每 ${minutes} 分钟`
  } else if (minutes === 60) {
    return '每 1 小时'
  } else {
    return `每 ${Math.floor(minutes / 60)} 小时 ${minutes % 60 ? minutes % 60 + ' 分钟' : ''}`
  }
}
</script>

<template>
  <el-card class="reminder-card" shadow="hover">
    <div class="card-content">
      <div class="card-left">
        <el-switch
          :model-value="reminder.enabled"
          @change="emit('toggle')"
        />
      </div>

      <div class="card-main">
        <div class="reminder-content">{{ reminder.content }}</div>
        <div class="reminder-meta">
          <el-tag size="small" type="info">
            {{ formatInterval(reminder.interval) }}
          </el-tag>
          <el-tag v-if="reminder.autoClose" size="small" type="success">
            {{ reminder.autoCloseDelay }}秒后关闭
          </el-tag>
        </div>
      </div>

      <div class="card-actions">
        <el-button
          :icon="Edit"
          size="small"
          text
          @click="emit('edit')"
        />
        <el-button
          :icon="Delete"
          size="small"
          text
          type="danger"
          @click="emit('delete')"
        />
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.reminder-card {
  margin-bottom: 12px;
}

.card-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-left {
  flex-shrink: 0;
}

.card-main {
  flex: 1;
  min-width: 0;
}

.reminder-content {
  font-size: 14px;
  color: #303133;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reminder-meta {
  display: flex;
  gap: 8px;
}

.card-actions {
  flex-shrink: 0;
  display: flex;
  gap: 4px;
}
</style>
