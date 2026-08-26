import { createRouter, createWebHistory } from 'vue-router'
import SignalView from '../views/SignalView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'signal',
      component: SignalView,
    },
    {
      path: '/send',
      name: 'send',
      // route level code-splitting: the demo screens are not needed to read the
      // dashboard, so they load on visit.
      component: () => import('../views/SendDataView.vue'),
    },
    {
      path: '/connect',
      name: 'connect',
      component: () => import('../views/ConnectView.vue'),
    },
    {
      path: '/feedback-wizard',
      name: 'feedbackWizard',
      component: () => import('../views/FeedbackWizardView.vue'),
    },
  ],
})

export default router
