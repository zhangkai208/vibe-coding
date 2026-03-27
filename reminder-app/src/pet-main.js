import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PetApp from './PetApp.vue'

const app = createApp(PetApp)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
