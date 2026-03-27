<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReminderStore } from '@/stores/reminder'
import { usePetStore } from '@/stores/pet'
import { useSettingsStore } from '@/stores/settings'
import ReminderCard from '@/components/ReminderCard.vue'
import AddReminder from '@/components/AddReminder.vue'
import { Setting, Plus, VideoPause, VideoPlay } from '@element-plus/icons-vue'

const router = useRouter()
const reminderStore = useReminderStore()
const petStore = usePetStore()
const settingsStore = useSettingsStore()

const showAddDialog = ref(false)
const editingReminder = ref(null)

// 处理提醒触发
function handleReminderTriggered(event) {
  const reminder = event.detail
  // TODO: 显示提醒气泡
  console.log('提醒触发:', reminder.content)
}

onMounted(() => {
  window.addEventListener('reminder-triggered', handleReminderTriggered)
})

onUnmounted(() => {
  window.removeEventListener('reminder-triggered', handleReminderTriggered)
})

// 添加提醒
function handleAdd() {
  editingReminder.value = null
  showAddDialog.value = true
}

// 编辑提醒
function handleEdit(reminder) {
  editingReminder.value = { ...reminder }
  showAddDialog.value = true
}

// 保存提醒
async function handleSave(reminder) {
  if (editingReminder.value) {
    reminderStore.updateReminder(editingReminder.value.id, reminder)
  } else {
    reminderStore.addReminder(reminder)
  }
  showAddDialog.value = false

  // 保存到本地
  await settingsStore.saveSettings({
    reminders: reminderStore.reminders,
    pet: {
      mood: petStore.mood,
      happiness: petStore.happiness,
      displayMode: petStore.displayMode,
      position: petStore.position
    }
  })
}

// 删除提醒
async function handleDelete(id) {
  reminderStore.removeReminder(id)
  await settingsStore.saveSettings({
    reminders: reminderStore.reminders
  })
}

// 切换提醒开关
async function handleToggle(reminder) {
  reminderStore.updateReminder(reminder.id, { enabled: !reminder.enabled })
  await settingsStore.saveSettings({
    reminders: reminderStore.reminders
  })
}
</script>

<template>
  <div class="home">
    <!-- 头部 -->
    <div class="header">
      <h1>提醒小助手</h1>
      <div class="header-actions">
        <el-button
          :type="reminderStore.globalPaused ? 'warning' : 'default'"
          :icon="reminderStore.globalPaused ? VideoPlay : VideoPause"
          @click="reminderStore.toggleGlobalPaused"
          circle
        />
        <el-button :icon="Setting" @click="router.push('/settings')" circle />
      </div>
    </div>

    <!-- 全局暂停提示 -->
    <el-alert
      v-if="reminderStore.globalPaused"
      title="提醒已暂停"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 16px;"
    />

    <!-- 提醒列表 -->
    <div class="reminder-list">
      <ReminderCard
        v-for="reminder in reminderStore.reminders"
        :key="reminder.id"
        :reminder="reminder"
        @edit="handleEdit"
        @delete="handleDelete"
        @toggle="handleToggle(reminder)"
      />

      <!-- 空状态 -->
      <el-empty
        v-if="reminderStore.reminders.length === 0"
        description="暂无提醒，点击下方按钮添加"
      />
    </div>

    <!-- 添加按钮 -->
    <el-button
      type="primary"
      :icon="Plus"
      class="add-btn"
      @click="handleAdd"
    >
      添加提醒
    </el-button>

    <!-- 添加/编辑弹窗 -->
    <AddReminder
      v-model:visible="showAddDialog"
      :reminder="editingReminder"
      @save="handleSave"
    />
  </div>
</template>

<style scoped>
.home {
  padding: 16px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  box-sizing: border-box;
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header h1 {
  font-size: 20px;
  margin: 0;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.reminder-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.add-btn {
  margin-top: 16px;
  width: 100%;
}
</style>
