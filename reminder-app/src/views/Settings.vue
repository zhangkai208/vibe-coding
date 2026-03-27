<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { usePetStore } from '@/stores/pet'
import { ArrowLeft } from '@element-plus/icons-vue'

const router = useRouter()
const settingsStore = useSettingsStore()
const petStore = usePetStore()

// 加载设置
onMounted(async () => {
  const settings = await settingsStore.loadSettings()
  if (settings?.pet) {
    petStore.happiness = settings.pet.happiness ?? 50
    petStore.displayMode = settings.pet.displayMode ?? 'always'
  }
})

async function handleDisplayModeChange(value) {
  await settingsStore.saveSettings({
    pet: {
      mood: petStore.mood,
      happiness: petStore.happiness,
      displayMode: value,
      position: petStore.position
    }
  })
}
</script>

<template>
  <div class="settings">
    <!-- 头部 -->
    <div class="header">
      <el-button :icon="ArrowLeft" @click="router.push('/')" text />
      <h1>设置</h1>
      <div style="width: 32px;"></div>
    </div>

    <!-- 设置列表 -->
    <div class="settings-list">
      <!-- 宠物设置 -->
      <el-card header="宠物设置" shadow="never">
        <el-form label-position="top">
          <el-form-item label="显示模式">
            <el-radio-group
              v-model="petStore.displayMode"
              @change="handleDisplayModeChange"
            >
              <el-radio value="always">常驻桌面</el-radio>
              <el-radio value="reminder-only">仅提醒时显示</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="好感度">
            <el-progress
              :percentage="petStore.happiness"
              :stroke-width="20"
              :show-text="false"
              :color="petStore.happiness >= 70 ? '#67c23a' : petStore.happiness >= 40 ? '#409eff' : '#f56c6c'"
            />
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.settings {
  padding: 16px;
  height: 100vh;
  background: #f5f7fa;
  overflow-y: auto;
  box-sizing: border-box;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header h1 {
  font-size: 18px;
  margin: 0;
  color: #303133;
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
