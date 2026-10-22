<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import AppBrand from '@/components/AppBrand.vue'
</script>

<template>
  <div class="layout">
    <a class="skip-link" href="#main">Skip to content</a>

    <header class="header">
      <div class="container header__inner">
        <AppBrand />
        <nav aria-label="Main">
          <RouterLink :to="{ name: 'menu' }" class="nav-link">Menu</RouterLink>
        </nav>
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
  min-height: 100vh;
  min-height: 100dvh;
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
