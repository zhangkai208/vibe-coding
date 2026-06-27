<script setup>
import { ref } from 'vue'
import { formatInterval } from '@/utils/time'

const props = defineProps({
  reminder: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['edit', 'delete', 'toggle'])

const showDeleteConfirm = ref(false)

function handleDelete() {
  showDeleteConfirm.value = true
  setTimeout(() => { showDeleteConfirm.value = false }, 3000)
}

function confirmDelete() {
  showDeleteConfirm.value = false
  emit('delete', props.reminder.id)
}
</script>

<template>
  <div :class="['reminder-card', { disabled: !reminder.enabled }]">
    <!-- 开关 -->
    <button
      :class="['toggle-switch', { on: reminder.enabled }]"
      @click="emit('toggle')"
    >
      <span class="toggle-knob"></span>
    </button>

    <!-- 内容区 -->
    <div class="card-main" @click="emit('edit', props.reminder)">
      <div class="reminder-content">{{ reminder.content }}</div>
      <div class="reminder-tags">
        <span class="tag tag-interval">{{ formatInterval(reminder.interval) }}</span>
        <span v-if="reminder.autoClose" class="tag tag-auto">{{ reminder.autoCloseDelay }}s</span>
        <span :class="['tag', reminder.position === 'left' ? 'tag-left' : 'tag-right']">
          {{ reminder.position === 'left' ? '左' : '右' }}
        </span>
      </div>
    </div>

    <!-- 操作 -->
    <div class="card-actions">
      <button class="action-btn edit-btn" @click.stop="emit('edit', props.reminder)" title="编辑">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button
        :class="['action-btn', showDeleteConfirm ? 'delete-confirm' : 'delete-btn']"
        @click.stop="showDeleteConfirm ? confirmDelete() : handleDelete()"
        :title="showDeleteConfirm ? '确认删除？' : '删除'"
      >
        <svg v-if="!showDeleteConfirm" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        <span v-else class="confirm-text">确认?</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.reminder-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(6px);
  border-radius: var(--radius-md);
  border: 1.5px solid transparent;
  margin-bottom: 8px;
  transition: all 0.3s ease;
}

.reminder-card:hover {
  background: rgba(255, 255, 255, 0.95);
  border-color: var(--border-soft);
  box-shadow: 0 4px 16px rgba(255, 183, 197, 0.12);
}

.reminder-card.disabled {
  opacity: 0.5;
}
.reminder-card.disabled:hover {
  opacity: 0.7;
}

/* 自定义开关 */
.toggle-switch {
  position: relative;
  width: 38px;
  height: 22px;
  border-radius: 11px;
  border: none;
  background: #E0D6E8;
  cursor: pointer;
  transition: all 0.3s ease;
  flex-shrink: 0;
  padding: 0;
}

.toggle-switch.on {
  background: linear-gradient(135deg, var(--primary), var(--sakura));
  box-shadow: 0 2px 8px rgba(255, 123, 123, 0.3);
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  transition: all 0.3s ease;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.toggle-switch.on .toggle-knob {
  left: 18px;
}

/* 内容 */
.card-main {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.reminder-content {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

.reminder-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  font-size: 10px;
  font-weight: 500;
  line-height: 18px;
}

.tag-interval {
  background: var(--lavender-light);
  color: #7B6B8F;
}

.tag-auto {
  background: var(--mint-light);
  color: #5A9B7F;
}

.tag-left {
  background: var(--sakura-light);
  color: var(--primary-dark);
}

.tag-right {
  background: #FFF3E0;
  color: #E6A23C;
}

/* 操作按钮 */
.card-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  color: var(--text-muted);
  font-family: inherit;
}

.edit-btn:hover {
  background: var(--lavender-light);
  color: #7B6B8F;
}

.delete-btn:hover {
  background: #FFE8E8;
  color: #F56C6C;
}

.delete-confirm {
  background: #F56C6C;
  color: white;
  width: auto;
  padding: 0 8px;
}

.confirm-text {
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}
</style>
