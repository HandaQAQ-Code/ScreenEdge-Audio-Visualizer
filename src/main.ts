import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import BambooDesign from 'bamboo-design'
import 'bamboo-design/es/style.css'
const app = createApp(App)

app.use(router)
app.use(BambooDesign)

app.mount('#app')
