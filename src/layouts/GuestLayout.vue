<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import AppBrand from '@/components/AppBrand.vue'
import CartHost from '@/layouts/CartHost.vue'
import { useMyOrdersStore } from '@/stores/myOrders'

const myOrders = useMyOrdersStore()
</script>

<template>
  <div class="layout">
    <a class="skip-link" href="#main">Skip to content</a>

    <header class="header">
      <div class="container header__inner">
        <AppBrand />
        <div class="header__actions">
          <nav aria-label="Main">
            <RouterLink :to="{ name: 'menu' }" class="nav-link">Menu</RouterLink>
            <!-- Only once there is something to show; until then it would just be an empty page. -->
            <RouterLink v-if="!myOrders.isEmpty" :to="{ name: 'orders' }" class="nav-link">
              Orders
            </RouterLink>
          </nav>
          <CartHost />
        </div>
      </div>
    </header>

    <main id="main" class="container main" tabindex="-1">
      <RouterView />
    </main>

    <footer class="footer">
      <div class="container footer__inner">
        <small class="text-muted">Tablefront is a demo; nothing here is a real order.</small>
        <RouterLink :to="{ name: 'admin-login' }">Staff login</RouterLink>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - var(--reserved-bottom, 0px));
  min-height: calc(100dvh - var(--reserved-bottom, 0px));
}

.header {
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

nav {
  display: flex;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  min-height: var(--tap-size);
  padding-inline: var(--space-3);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-weight: var(--weight-medium);
  text-decoration: none;
}

.nav-link:hover {
  background: var(--color-surface-sunken);
}

.nav-link[aria-current='page'] {
  color: var(--color-accent-text);
}

.main {
  flex: 1;
  padding-block: var(--space-5) var(--space-7);
}

.footer {
  border-top: 1px solid var(--color-border);
}

.footer__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-4);
  padding-block: var(--space-4);
}

.footer a {
  display: inline-flex;
  align-items: center;
  min-height: var(--tap-size);
  font-size: var(--text-sm);
}
</style>
