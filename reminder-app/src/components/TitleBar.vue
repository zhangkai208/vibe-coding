<script setup>
import { Minus, Close } from '@element-plus/icons-vue'
import iconUrl from '@/assets/icon.png'

function minimize() {
  window.electronAPI?.minimizeWindow?.()
}
function close() {
  window.electronAPI?.closeWindow?.()
}
</script>

<template>
  <div class="title-bar">
    <div class="title-left">
      <img :src="iconUrl" class="title-icon" alt="logo" />
      <span class="title-text">提醒小助手</span>
    </div>
    <div class="title-buttons">
      <button class="title-btn" title="最小化" @click="minimize">
        <el-icon :size="14"><Minus /></el-icon>
      </button>
      <button class="title-btn close-btn" title="关闭" @click="close">
        <el-icon :size="14"><Close /></el-icon>
      </button>
    </div>
  </div>
</template>

<style scoped>
.title-bar {
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 6px 0 14px;
  background: linear-gradient(135deg, var(--lavender-light) 0%, var(--sakura-light) 100%);
  border-bottom: 1px solid var(--border-soft);
  -webkit-app-region: drag;
  user-select: none;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.title-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.title-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.title-buttons {
  display: flex;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.title-btn {
  width: 32px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  -webkit-app-region: no-drag;
  font-family: inherit;
}

.title-btn:hover {
  background: rgba(255, 255, 255, 0.7);
  color: var(--primary);
}

.close-btn:hover {
  background: var(--primary);
  color: #fff;
}
</style>
