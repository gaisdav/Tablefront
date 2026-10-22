import { effectScope } from 'vue'
import { describe, expect, it } from 'vitest'
import { useConfirm } from '@/composables/useConfirm'

const question = { title: 'Delete?', message: 'Sure?', confirmLabel: 'Delete' }

function setup() {
  const scope = effectScope()
  const confirm = scope.run(() => useConfirm())
  if (confirm === undefined) throw new Error('scope did not run')
  return { ...confirm, scope }
}

describe('useConfirm', () => {
  it('has no question until one is asked', () => {
    expect(setup().request.value).toBeNull()
  })

  it('shows the question and resolves with the answer', async () => {
    const { confirm, answer, request } = setup()

    const result = confirm(question)
    expect(request.value).toEqual(question)
    answer(true)

    expect(await result).toBe(true)
    expect(request.value).toBeNull()
  })

  it('resolves false for "no"', async () => {
    const { confirm, answer } = setup()

    const result = confirm(question)
    answer(false)

    expect(await result).toBe(false)
  })

  it('answers an open question "no" when a new one is asked', async () => {
    const { confirm, answer, request } = setup()

    const first = confirm(question)
    const second = confirm({ ...question, title: 'Other?' })

    expect(await first).toBe(false)
    expect(request.value?.title).toBe('Other?')
    answer(true)
    expect(await second).toBe(true)
  })

  it('answers "no" when the page goes away, so nothing waits forever', async () => {
    const { confirm, scope } = setup()

    const result = confirm(question)
    scope.stop()

    expect(await result).toBe(false)
  })

  it('ignores an answer when nothing is asked', () => {
    expect(() => {
      setup().answer(true)
    }).not.toThrow()
  })
})
