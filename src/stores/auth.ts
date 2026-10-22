import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { authApi } from '@/api/authApi'
import { loadToken, saveToken } from '@/stores/authStorage'
import type { LoginRequest } from '@/types/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(loadToken())
  const isAuthenticated = computed(() => token.value !== null)

  /** Rejects with the API's error (wrong credentials, network); the caller decides what to show. */
  async function login(credentials: LoginRequest): Promise<void> {
    const response = await authApi.login(credentials)
    token.value = response.token
  }

  function logout(): void {
    token.value = null
  }

  // Side effect: the token survives a reload of the tab, and only of the tab. `sync`, so storage
  // never lags behind the store: a reload right after signing in or out sees the new state.
  watch(
    token,
    (value) => {
      saveToken(value)
    },
    { flush: 'sync' },
  )

  return { token, isAuthenticated, login, logout }
})
