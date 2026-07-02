# 提醒小助手 🐾

一个带 **Live2D 桌面宠物**的提醒工具——由两只二次元萌妹（左 22、右 33）在桌面上提醒你喝水、休息、活动，比冷冰冰的弹窗更温馨有趣。

基于 Electron + Vue 3 + Element Plus + pixi-live2d-display 实现。

## ✨ 核心功能

- 🐱 **双宠物陪伴** — 左右两只 Live2D 萌妹，呼吸、眨眼、表情变化
- 💬 **宠物说话提醒** — 由宠物弹出对话气泡提醒，可确认 / 推迟
- 👗 **服装更换** — 每只宠物可切换 19 套服装（圣诞、校服、夏装…）
- 🔍 **大小调节** — 滑块无极调节宠物大小（左右共同，0.2~0.5）
- 😊 **心情系统** — 确认提醒→开心，忽略→难过/生气；四档情绪循环轮换
- 🖥️ **灵活显示** — 常驻桌面 / 仅提醒时出现
- 🌅 **时段问候** — 到达工作时段起/止时间，宠物提醒开工 / 下班（纯消息气泡，不影响好感度）
- 🕐 **工作时段 / 空闲检测 / 全局暂停 / 开机自启 / 系统托盘**

## 🛠 技术栈

Electron 41 · Vue 3 (script setup) · Vite · Element Plus · Pinia · vue-router · pixi-live2d-display (PixiJS 6) · electron-store

## 📁 项目结构

详细设计见 [PROJECT_PLAN.md](PROJECT_PLAN.md)。主代码在 `reminder-app/`，采用**双窗口架构**：

- **主窗口**（`index.html` → `main.js` → `App.vue`）：提醒管理、设置
- **宠物窗口**（`pet.html` → `pet-main.js` → `PetApp.vue`）：透明、始终置顶的 Live2D 宠物

## 🎀 模型来源

Live2D 模型来自 [imuncle/live2d](https://github.com/imuncle/live2d)，⚠️ 仅限学习 / 非商业用途。

## 🙏 致谢

感谢 [LINUX DO](https://linux.do) 社区的支持。
