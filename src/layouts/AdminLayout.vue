<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import AppBrand from '@/components/AppBrand.vue'
</script>

<template>
  <div class="admin">
    <a class="skip-link" href="#main">Skip to content</a>

    <aside class="sidebar">
      <AppBrand>
        <span class="badge">Admin</span>
      </AppBrand>
      <nav class="sidebar__nav" aria-label="Admin">
        <RouterLink :to="{ name: 'admin-orders' }" class="nav-link">Orders</RouterLink>
        <RouterLink :to="{ name: 'admin-menu' }" class="nav-link">Menu</RouterLink>
      </nav>
      <RouterLink :to="{ name: 'menu' }" class="nav-link sidebar__back">Back to site</RouterLink>
    </aside>

    <main id="main" class="admin__main" tabindex="-1">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
/* Phone: a header bar with scrollable tabs. Desktop: a fixed sidebar. */
.admin {
  min-height: 100vh;
  min-height: 100dvh;
}

.sidebar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1) var(--space-3);
  padding: var(--space-1) var(--gutter);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.sidebar__nav {
  display: flex;
  gap: var(--space-1);
  order: 3;
  width: 100%;
  overflow-x: auto;
}

.sidebar__back {
  margin-left: auto;
}

.badge {
  padding: 0.125rem var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-accent-soft);
  color: var(--color-accent-text);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
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
  white-space: nowrap;
}

.nav-link:hover {
  background: var(--color-surface-sunken);
}

.nav-link[aria-current='page'] {
  background: var(--color-accent-soft);
  color: var(--color-accent-text);
}

.admin__main {
  padding: var(--space-5) var(--gutter) var(--space-7);
}

@media (min-width: 64rem) {
  .admin {
    display: grid;
    grid-template-columns: 15rem 1fr;
  }

  .sidebar {
    position: sticky;
    top: 0;
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: stretch;
    gap: var(--space-4);
    height: 100vh;
    height: 100dvh;
    padding: var(--space-4);
    border-right: 1px solid var(--color-border);
    border-bottom: 0;
  }

  .sidebar__nav {
    flex-direction: column;
    order: 0;
    width: auto;
  }

  .sidebar__back {
    margin: auto 0 0;
  }

  .admin__main {
    max-width: 70rem;
  }
}
</style>
