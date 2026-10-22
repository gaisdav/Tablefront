import { onScopeDispose, shallowRef, type ShallowRef } from 'vue'

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel: string
  /** Styles the confirm button as dangerous (a deletion). */
  destructive?: boolean
}

/**
 * Asks the user a yes/no question and resolves with the answer: `await confirm({...})`.
 * Pair it with `<ConfirmDialog :request="request" @answer="answer" />`.
 * A new question while one is open answers the open one "no"; so does the page going away.
 */
export function useConfirm(): {
  request: Readonly<ShallowRef<ConfirmRequest | null>>
  confirm: (request: ConfirmRequest) => Promise<boolean>
  answer: (yes: boolean) => void
} {
  const request = shallowRef<ConfirmRequest | null>(null)
  let resolve: ((yes: boolean) => void) | null = null

  function answer(yes: boolean): void {
    const pending = resolve
    resolve = null
    request.value = null
    pending?.(yes)
  }

  function confirm(next: ConfirmRequest): Promise<boolean> {
    answer(false)
    request.value = next
    return new Promise((done) => {
      resolve = done
    })
  }

  onScopeDispose(() => {
    answer(false)
  })

  return { request, confirm, answer }
}
