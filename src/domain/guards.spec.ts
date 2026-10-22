import { describe, expect, it } from 'vitest'
import { isRecord } from '@/domain/guards'

describe('isRecord', () => {
  it('accepts plain objects', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ a: 1 })).toBe(true)
  })

  it.each([[null], [undefined], [[]], [[1, 2]], ['text'], [42], [true]])('rejects %j', (value) => {
    expect(isRecord(value)).toBe(false)
  })
})
