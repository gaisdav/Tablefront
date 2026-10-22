<script setup lang="ts">
import { nextTick, reactive, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isApiError } from '@/api/errors'
import { safeRedirect } from '@/auth/installSession'
import AppBrand from '@/components/AppBrand.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import { validateLogin, type LoginErrors, type LoginForm } from '@/domain/login'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive<LoginForm>({ email: '', password: '' })
const errors = ref<LoginErrors>({})
/** A failure that belongs to no field: wrong credentials, no network. */
const problem = ref('')
const submitting = ref(false)
const attempted = ref(false)

const formElement = useTemplateRef<HTMLFormElement>('formEl')
const problemElement = useTemplateRef<HTMLElement>('problemEl')

// After the first failed attempt a field is checked again as it is edited, so its message goes
// away the moment it is fixed; before that nothing nags while the user is still typing.
function recheck(field: keyof LoginForm): void {
  if (!attempted.value) return
  const message = validateLogin(form)[field]
  const others = Object.fromEntries(Object.entries(errors.value).filter(([key]) => key !== field))
  errors.value = message === undefined ? others : { ...others, [field]: message }
}
watch(
  () => form.email,
  () => {
    recheck('email')
  },
)
watch(
  () => form.password,
  () => {
    recheck('password')
  },
)

async function focusFirstProblem(): Promise<void> {
  await nextTick()
  const field = formElement.value?.querySelector<HTMLElement>('[aria-invalid="true"]')
  ;(field ?? problemElement.value)?.focus()
}

async function submit(): Promise<void> {
  if (submitting.value) return
  attempted.value = true
  problem.value = ''
  errors.value = validateLogin(form)
  if (Object.keys(errors.value).length > 0) {
    await focusFirstProblem()
    return
  }

  submitting.value = true
  try {
    await auth.login({ email: form.email.trim(), password: form.password })
    await router.replace(safeRedirect(router, route.query.redirect))
  } catch (caught) {
    problem.value = isApiError(caught) ? caught.message : 'Something went wrong. Please try again.'
    await focusFirstProblem()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="page">
    <section class="login" aria-labelledby="login-heading">
      <AppBrand />
      <h1 id="login-heading" class="login__title">Staff sign in</h1>

      <form ref="formEl" class="form" novalidate @submit.prevent="submit">
        <div v-if="problem" ref="problemEl" class="problem" role="alert" tabindex="-1">
          {{ problem }}
        </div>

        <BaseInput
          v-model="form.email"
          label="Email"
          name="email"
          type="email"
          autocomplete="username"
          :error="errors.email"
        />
        <BaseInput
          v-model="form.password"
          label="Password"
          name="password"
          type="password"
          autocomplete="current-password"
          :error="errors.password"
        />

        <BaseButton type="submit" block :loading="submitting">Sign in</BaseButton>
      </form>

      <p class="hint text-muted">
        Demo credentials: <code>admin@tablefront.test</code> / <code>admin123</code>
      </p>
    </section>
  </main>
</template>

<style scoped>
.page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: var(--space-6) var(--gutter);
}

.login {
  display: grid;
  gap: var(--space-4);
  width: min(24rem, 100%);
  margin: var(--space-5) auto 0;
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.login__title {
  font-size: var(--text-xl);
}

.form {
  display: grid;
  gap: var(--space-4);
}

.problem {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.hint {
  font-size: var(--text-sm);
}

.hint code {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: var(--text-xs);
  overflow-wrap: anywhere;
}
</style>
