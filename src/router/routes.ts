import type { RouteRecordRaw } from 'vue-router'
import GuestLayout from '@/layouts/GuestLayout.vue'

// Route meta is typed here once; `requiresAuth` is enforced by the guard added with admin auth.
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}

// Every page and the admin layout are lazy-loaded, so a guest never downloads admin code.
// GuestLayout is imported eagerly because it is part of the first paint.
export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: GuestLayout,
    children: [
      { path: '', name: 'menu', component: () => import('@/pages/MenuPage.vue') },
      { path: 'checkout', name: 'checkout', component: () => import('@/pages/CheckoutPage.vue') },
      { path: 'orders/:id', name: 'order', component: () => import('@/pages/OrderPage.vue') },
      // Last child, so the guest layout stays mounted when navigating to an unknown address.
      {
        path: ':pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/pages/NotFoundPage.vue'),
      },
    ],
  },
  {
    // No layout: the login page is a single centred card.
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/pages/admin/AdminLoginPage.vue'),
  },
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true },
    redirect: { name: 'admin-orders' },
    children: [
      {
        path: 'orders',
        name: 'admin-orders',
        component: () => import('@/pages/admin/AdminOrdersPage.vue'),
      },
      {
        path: 'menu',
        name: 'admin-menu',
        component: () => import('@/pages/admin/AdminMenuPage.vue'),
      },
    ],
  },
]
