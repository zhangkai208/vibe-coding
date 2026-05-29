import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import PetApp from './PetApp.vue'

// 注入宠物窗口需要的 CSS 变量（不引入 style.css，避免覆盖透明背景）
const style = document.createElement('style')
style.textContent = `
  :root {
    --bg-warm: #FFF8F3;
    --bg-cream: #FFF1EB;
    --primary: #FF7B7B;
    --primary-light: #FFB3B3;
    --primary-dark: #E85D5D;
    --sakura: #FFB7C5;
    --sakura-light: #FFD4DE;
    --lavender: #C4B0D4;
    --lavender-light: #E3D5F0;
    --mint: #A8D8C8;
    --mint-light: #D0F0E4;
    --text-primary: #4A3B5C;
    --text-secondary: #8B7DA0;
    --text-muted: #B8A9C9;
    --card-bg: #FFFFFF;
    --border-soft: rgba(255, 183, 197, 0.3);
    --radius-sm: 10px;
    --radius-md: 16px;
    --radius-lg: 22px;
    --radius-pill: 999px;
  }
`
document.head.appendChild(style)

const app = createApp(PetApp)
const pinia = createPinia()

app.use(pinia)
app.use(ElementPlus)
app.mount('#app')
