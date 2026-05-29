<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useReminderStore } from '@/stores/reminder'
import { usePetStore } from '@/stores/pet'
import { useSettingsStore } from '@/stores/settings'
import ReminderCard from '@/components/ReminderCard.vue'
import AddReminder from '@/components/AddReminder.vue'
import { PRESET_REMINDERS } from '@/constants/presets'
import {
  Setting, Plus, VideoPause, VideoPlay,
  Coffee, Sunny, Timer, Aim,
  WindPower, Monitor
} from '@element-plus/icons-vue'

const router = useRouter()
const reminderStore = useReminderStore()
const petStore = usePetStore()
const settingsStore = useSettingsStore()

const showAddDialog = ref(false)
const editingReminder = ref(null)

// 预设图标映射
const presetIcons = [Coffee, Sunny, Aim, WindPower, Monitor, Timer]

function handleAdd() {
  editingReminder.value = null
  showAddDialog.value = true
}

function handlePresetAdd(preset) {
  const reminder = reminderStore.addReminder({
    content: preset.content,
    interval: preset.interval,
    autoClose: settingsStore.reminderDefaults.autoClose,
    autoCloseDelay: settingsStore.reminderDefaults.autoCloseDelay,
    soundEnabled: settingsStore.reminderDefaults.soundEnabled
  })
  const count = reminderStore.reminders.length
  reminderStore.updateReminder(reminder.id, {
    position: count % 2 === 0 ? 'left' : 'right'
  })
  saveReminders()
}

function handleEdit(reminder) {
  editingReminder.value = { ...reminder }
  showAddDialog.value = true
}

async function handleSave(reminder) {
  if (editingReminder.value) {
    reminderStore.updateReminder(editingReminder.value.id, reminder)
  } else {
    const newReminder = reminderStore.addReminder(reminder)
    const count = reminderStore.reminders.length
    reminderStore.updateReminder(newReminder.id, {
      position: count % 2 === 0 ? 'left' : 'right'
    })
  }
  showAddDialog.value = false
  await saveReminders()
}

async function handleDelete(id) {
  reminderStore.removeReminder(id)
  await saveReminders()
}

async function handleToggle(reminder) {
  reminderStore.updateReminder(reminder.id, { enabled: !reminder.enabled })
  await saveReminders()
}

async function saveReminders() {
  await settingsStore.saveSettings({
    reminders: JSON.parse(JSON.stringify(reminderStore.reminders))
  })
}
</script>

<template>
  <div class="home">
    <!-- 头部 -->
    <div class="header">
      <div class="header-info">
        <h1 class="app-title">提醒小助手</h1>
        <p class="app-subtitle">{{ petStore.happinessDesc }}</p>
      </div>
      <div class="header-actions">
        <button
          :class="['icon-btn', { active: reminderStore.globalPaused }]"
          @click="reminderStore.toggleGlobalPaused()"
          :title="reminderStore.globalPaused ? '恢复提醒' : '暂停提醒'"
        >
          <el-icon><component :is="reminderStore.globalPaused ? VideoPlay : VideoPause" /></el-icon>
        </button>
        <button class="icon-btn" @click="router.push('/settings')" title="设置">
          <el-icon><Setting /></el-icon>
        </button>
      </div>
    </div>

    <!-- 暂停横幅 -->
    <div v-if="reminderStore.globalPaused" class="pause-banner">
      提醒已暂停
    </div>

    <!-- 下一个提醒 -->
    <div v-if="!reminderStore.globalPaused && reminderStore.nextReminder" class="next-bar">
      <div class="next-dot"></div>
      <span class="next-content">{{ reminderStore.nextReminder.content }}</span>
      <span class="next-time">{{ reminderStore.minutesUntilNext }} 分钟后</span>
    </div>

    <!-- 提醒列表（可滚动区域） -->
    <div class="scroll-area">
      <!-- 有提醒时显示列表 -->
      <TransitionGroup v-if="reminderStore.reminders.length > 0" name="list" tag="div" class="reminder-list">
        <ReminderCard
          v-for="reminder in reminderStore.reminders"
          :key="reminder.id"
          :reminder="reminder"
          @edit="handleEdit"
          @delete="handleDelete"
          @toggle="handleToggle(reminder)"
        />
      </TransitionGroup>

      <!-- 空状态提示 -->
      <div v-if="reminderStore.reminders.length === 0" class="empty-hint">
        <p>还没有提醒，点击模板快速添加</p>
      </div>

      <!-- 快速添加（始终显示） -->
      <div class="preset-section">
        <div class="preset-header">快速添加</div>
        <div class="preset-grid">
          <div
            v-for="(preset, i) in PRESET_REMINDERS"
            :key="preset.label"
            class="preset-card"
            @click="handlePresetAdd(preset)"
          >
            <div :class="['preset-icon-wrap', 'dot-' + (i % 6)]">
              <el-icon :size="16"><component :is="presetIcons[i]" /></el-icon>
            </div>
            <div class="preset-text">
              <span class="preset-label">{{ preset.label }}</span>
              <span class="preset-desc">{{ preset.description }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加按钮 -->
    <button class="add-btn" @click="handleAdd">
      <el-icon><Plus /></el-icon>
      <span>添加提醒</span>
    </button>

    <AddReminder
      v-model:visible="showAddDialog"
      :reminder="editingReminder"
      @save="handleSave"
    />
  </div>
</template>

<style scoped>
.home {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(168deg, var(--bg-warm) 0%, var(--bg-cream) 50%, #FFF0F5 100%);
  box-sizing: border-box;
  overflow: hidden;
}

/* 头部 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 12px;
  flex-shrink: 0;
}

.app-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.app-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--border-soft);
  background: white;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 15px;
}

.icon-btn:hover {
  color: var(--primary);
  border-color: var(--sakura);
  background: var(--sakura-light);
}

.icon-btn.active {
  color: #E6A23C;
  border-color: #FFE0B2;
  background: #FFF8F0;
}

/* 暂停横幅 */
.pause-banner {
  margin: 0 20px 10px;
  padding: 8px 14px;
  background: #FFF8F0;
  border-radius: var(--radius-sm);
  color: #E6A23C;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid #FFE0B2;
  flex-shrink: 0;
}

/* 下一个提醒 */
.next-bar {
  margin: 0 20px 10px;
  padding: 8px 12px;
  background: white;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border-soft);
  flex-shrink: 0;
}

.next-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
  flex-shrink: 0;
}

.next-content {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.next-time {
  font-size: 11px;
  color: var(--primary);
  font-weight: 600;
  white-space: nowrap;
  background: var(--sakura-light);
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}

/* 可滚动区域 */
.scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
  min-height: 0;
}

/* 提醒列表 */
.reminder-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 空状态 */
.empty-hint {
  text-align: center;
  padding: 20px 0 12px;
  color: var(--text-muted);
  font-size: 13px;
}

/* 快速添加（始终显示） */
.preset-section {
  margin-top: 16px;
  padding-bottom: 8px;
}

.preset-header {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}

.preset-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.preset-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: white;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1.5px solid transparent;
}

.preset-card:hover {
  border-color: var(--sakura);
  box-shadow: 0 2px 12px rgba(255, 183, 197, 0.15);
}

.preset-card:active {
  transform: scale(0.97);
}

.preset-icon-wrap {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.preset-icon-wrap.dot-0 { background: linear-gradient(135deg, #FFB3B3, #FF7B7B); }
.preset-icon-wrap.dot-1 { background: linear-gradient(135deg, #B8E6D0, #7EC8A8); }
.preset-icon-wrap.dot-2 { background: linear-gradient(135deg, #C4B0D4, #9B8BB8); }
.preset-icon-wrap.dot-3 { background: linear-gradient(135deg, #FFE0B2, #FFB347); }
.preset-icon-wrap.dot-4 { background: linear-gradient(135deg, #B3D4F0, #7BB3E0); }
.preset-icon-wrap.dot-5 { background: linear-gradient(135deg, #FFD4DE, #FFB7C5); }

.preset-text {
  flex: 1;
  min-width: 0;
}

.preset-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.preset-desc {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 添加按钮 */
.add-btn {
  margin: 10px 20px 14px;
  padding: 11px 0;
  background: linear-gradient(135deg, var(--primary) 0%, #FF9A9A 100%);
  color: white;
  border: none;
  border-radius: var(--radius-pill);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 4px 14px rgba(255, 123, 123, 0.3);
  transition: all 0.25s ease;
  font-family: inherit;
  flex-shrink: 0;
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(255, 123, 123, 0.45);
}

.add-btn:active {
  transform: translateY(0) scale(0.98);
}

/* 列表动画 */
.list-enter-active { transition: all 0.3s ease; }
.list-leave-active { transition: all 0.2s ease; }
.list-enter-from { opacity: 0; transform: translateY(8px); }
.list-leave-to { opacity: 0; transform: translateX(-16px); }
</style>
