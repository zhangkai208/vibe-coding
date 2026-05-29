<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePetStore } from '@/stores/pet'
import { useSettingsStore } from '@/stores/settings'
import { ArrowLeft } from '@element-plus/icons-vue'

const router = useRouter()
const petStore = usePetStore()
const settingsStore = useSettingsStore()

const happinessPercent = computed(() => petStore.happiness ?? 50)
const progressColor = computed(() => {
  const h = happinessPercent.value
  if (h >= 70) return '#67c23a'
  if (h >= 40) return 'var(--primary)'
  return '#f56c6c'
})

async function handleDisplayModeChange() {
  await settingsStore.saveSettings({
    pet: {
      mood: petStore.mood,
      happiness: petStore.happiness,
      displayMode: petStore.displayMode,
      position: petStore.position
    }
  })
  if (window.electronAPI?.setPetDisplayMode) {
    window.electronAPI.setPetDisplayMode(petStore.displayMode)
  }
}

async function handleSoundChange() {
  await settingsStore.saveSettings({ sound: { ...settingsStore.sound } })
}

async function handleWorkingHoursChange() {
  await settingsStore.saveSettings({ workingHours: { ...settingsStore.workingHours } })
}

async function handleIdleThresholdChange() {
  await settingsStore.saveSettings({ idleThreshold: settingsStore.idleThreshold })
}

async function handleReminderDefaultsChange() {
  await settingsStore.saveSettings({ reminderDefaults: { ...settingsStore.reminderDefaults } })
}

async function handleAutoLaunchChange() {
  await settingsStore.setAutoLaunch(settingsStore.autoLaunch)
}

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']
const weekdayValues = [1, 2, 3, 4, 5, 6, 7]

function isWeekdaySelected(val) {
  return settingsStore.workingHours.weekdays.includes(val)
}

function toggleWeekday(val) {
  const idx = settingsStore.workingHours.weekdays.indexOf(val)
  if (idx !== -1) {
    settingsStore.workingHours.weekdays.splice(idx, 1)
  } else {
    settingsStore.workingHours.weekdays.push(val)
  }
  settingsStore.workingHours.weekdays.sort()
  handleWorkingHoursChange()
}
</script>

<template>
  <div class="settings">
    <!-- 顶部装饰 -->
    <div class="settings-wave"></div>

    <!-- 头部 -->
    <div class="header">
      <button class="back-btn" @click="router.push('/')">
        <el-icon><ArrowLeft /></el-icon>
      </button>
      <h1 class="page-title">设置</h1>
      <div style="width: 36px;"></div>
    </div>

    <div class="settings-list">
      <div class="setting-card">
        <div class="card-header">
          <span class="card-dot dot-pink"></span>
          <span class="card-title">宠物设置</span>
        </div>
        <div class="card-body">
          <div class="setting-row">
            <span class="setting-label">显示模式</span>
            <div class="setting-control">
              <el-radio-group v-model="petStore.displayMode" @change="handleDisplayModeChange" size="small">
                <el-radio value="always">常驻桌面</el-radio>
                <el-radio value="reminder-only">仅提醒时</el-radio>
              </el-radio-group>
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">好感度</span>
            <div class="setting-control happiness-control">
              <div class="happiness-bar-wrap">
                <div class="happiness-bar" :style="{ width: happinessPercent + '%' }"></div>
              </div>
              <span class="happiness-value">{{ petStore.happinessDesc }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 提醒设置 -->
      <div class="setting-card">
        <div class="card-header">
          <span class="card-dot dot-lavender"></span>
          <span class="card-title">提醒设置</span>
        </div>
        <div class="card-body">
          <div class="setting-row">
            <span class="setting-label">工作时段</span>
            <div class="setting-control">
              <el-switch v-model="settingsStore.workingHours.enabled" @change="handleWorkingHoursChange" />
            </div>
          </div>

          <template v-if="settingsStore.workingHours.enabled">
            <div class="setting-row column">
              <span class="setting-label">工作日</span>
              <div class="weekday-chips">
                <button
                  v-for="(label, i) in weekdayLabels"
                  :key="weekdayValues[i]"
                  :class="['weekday-chip', { active: isWeekdaySelected(weekdayValues[i]) }]"
                  @click="toggleWeekday(weekdayValues[i])"
                >
                  {{ label }}
                </button>
              </div>
            </div>
            <div class="time-range">
              <div class="time-field">
                <span class="time-label">开始</span>
                <input type="time" class="time-input" v-model="settingsStore.workingHours.start" @change="handleWorkingHoursChange" />
              </div>
              <span class="time-sep">→</span>
              <div class="time-field">
                <span class="time-label">结束</span>
                <input type="time" class="time-input" v-model="settingsStore.workingHours.end" @change="handleWorkingHoursChange" />
              </div>
            </div>
          </template>

          <div class="setting-row">
            <span class="setting-label">推迟时长</span>
            <div class="setting-control">
              <select class="custom-select" v-model="settingsStore.reminderDefaults.postponeMinutes" @change="handleReminderDefaultsChange">
                <option :value="1">1 分钟</option>
                <option :value="5">5 分钟</option>
                <option :value="10">10 分钟</option>
                <option :value="15">15 分钟</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- 通知设置 -->
      <div class="setting-card">
        <div class="card-header">
          <span class="card-dot dot-mint"></span>
          <span class="card-title">通知设置</span>
        </div>
        <div class="card-body">
          <div class="setting-row">
            <span class="setting-label">提醒声音</span>
            <div class="setting-control">
              <el-switch v-model="settingsStore.sound.enabled" @change="handleSoundChange" />
            </div>
          </div>
          <div v-if="settingsStore.sound.enabled" class="setting-row column">
            <span class="setting-label">音量</span>
            <el-slider v-model="settingsStore.sound.volume" :min="0" :max="1" :step="0.1" :format-tooltip="(val) => Math.round(val * 100) + '%'" @change="handleSoundChange" />
          </div>
        </div>
      </div>

      <!-- 应用设置 -->
      <div class="setting-card">
        <div class="card-header">
          <span class="card-dot dot-orange"></span>
          <span class="card-title">应用设置</span>
        </div>
        <div class="card-body">
          <div class="setting-row">
            <span class="setting-label">开机自启</span>
            <div class="setting-control">
              <el-switch v-model="settingsStore.autoLaunch" @change="handleAutoLaunchChange" />
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">关闭到托盘</span>
            <div class="setting-control">
              <el-switch v-model="settingsStore.closeToTray" @change="() => settingsStore.saveSettings({})" />
            </div>
          </div>
          <div class="setting-row">
            <span class="setting-label">空闲阈值</span>
            <div class="setting-control">
              <select class="custom-select" v-model="settingsStore.idleThreshold" @change="handleIdleThresholdChange">
                <option :value="180">3 分钟</option>
                <option :value="300">5 分钟</option>
                <option :value="600">10 分钟</option>
                <option :value="900">15 分钟</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings {
  height: 100vh;
  background: linear-gradient(168deg, var(--bg-warm) 0%, var(--bg-cream) 50%, #FFF0F5 100%);
  overflow-y: auto;
  box-sizing: border-box;
  position: relative;
}

.settings-wave {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(135deg, var(--lavender-light) 0%, var(--sakura-light) 50%, var(--bg-peach) 100%);
  border-radius: 0 0 32px 32px;
  z-index: 0;
}

.header {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 20px 16px;
}

.back-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(8px);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.25s ease;
}
.back-btn:hover {
  background: rgba(255, 255, 255, 0.8);
  transform: scale(1.08);
}

.page-title {
  font-size: 18px;
  font-weight: 700;
  color: white;
  text-shadow: 0 2px 8px rgba(196, 176, 212, 0.3);
}

.settings-list {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 16px 20px;
}

/* 设置卡片 */
.setting-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(6px);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border-soft);
  transition: all 0.3s ease;
}
.setting-card:hover {
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 4px 20px rgba(255, 183, 197, 0.12);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px 0;
}

.card-dot {
  width: 10px;
  height: 10px;
  border-radius: 4px;
  flex-shrink: 0;
}
.card-dot.dot-pink { background: var(--primary); }
.card-dot.dot-lavender { background: var(--lavender); }
.card-dot.dot-mint { background: var(--mint); }
.card-dot.dot-orange { background: #FFB347; }

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-body {
  padding: 12px 18px 16px;
}

/* 设置行 */
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  min-height: 36px;
}
.setting-row + .setting-row {
  border-top: 1px solid rgba(255, 183, 197, 0.12);
}
.setting-row.column {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.setting-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.setting-control {
  flex-shrink: 0;
}

/* 好感度条 */
.happiness-control {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  margin-left: 16px;
}

.happiness-bar-wrap {
  flex: 1;
  height: 8px;
  background: var(--sakura-light);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.happiness-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--sakura));
  border-radius: var(--radius-pill);
  transition: width 0.5s ease;
}

.happiness-value {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  min-width: 60px;
  text-align: right;
}

/* 星期选择 */
.weekday-chips {
  display: flex;
  gap: 6px;
}

.weekday-chip {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: 1.5px solid var(--border-soft);
  background: rgba(255, 255, 255, 0.6);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  font-family: inherit;
}
.weekday-chip:hover {
  border-color: var(--sakura);
  background: var(--sakura-light);
}
.weekday-chip.active {
  background: linear-gradient(135deg, var(--primary), var(--sakura));
  border-color: transparent;
  color: white;
  box-shadow: 0 2px 8px rgba(255, 123, 123, 0.3);
}

/* 时间选择 */
.time-range {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0 8px;
}
.time-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.time-label {
  font-size: 11px;
  color: var(--text-muted);
}
.time-input {
  width: 100%;
  padding: 8px 10px;
  border: 1.5px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  color: var(--text-primary);
  font-family: inherit;
  outline: none;
  transition: all 0.2s;
}
.time-input:focus {
  border-color: var(--sakura);
  background: white;
}
.time-sep {
  color: var(--text-muted);
  font-size: 16px;
  margin-top: 18px;
}

/* 自定义 select */
.custom-select {
  padding: 6px 10px;
  border: 1.5px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  color: var(--text-primary);
  font-family: inherit;
  outline: none;
  cursor: pointer;
  transition: all 0.2s;
}
.custom-select:focus {
  border-color: var(--sakura);
  background: white;
}
</style>
