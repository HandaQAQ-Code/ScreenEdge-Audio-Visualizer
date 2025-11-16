import { createRouter, createWebHistory } from 'vue-router'
import Visualize from '@/pages/Setting.vue'
import Setting from '@/pages/Visualize.vue'
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'visualize',
      component: Visualize,
    },
    {
      path: '/setting',
      name: 'setting',
      component: Setting,
    },
  ],
})

export default router
