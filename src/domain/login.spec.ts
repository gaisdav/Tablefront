import { describe, expect, it } from 'vitest'
import { validateLogin } from '@/domain/login'

describe('validateLogin', () => {
  it('accepts an email and a password', () => {
    expect(validateLogin({ email: 'admin@tablefront.test', password: 'x' })).toEqual({})
  })

  it('requires both', () => {
    expect(validateLogin({ email: '  ', password: '' })).toEqual({
      email: 'Email is required',
      password: 'Password is required',
    })
  })

  it.each(['admin', 'admin@', '@tablefront.test', 'a b@c.de', 'admin@tablefront'])(
    'rejects the email %j',
    (email) => {
      expect(validateLogin({ email, password: 'x' }).email).toBe('Email looks invalid')
    },
  )

  it('does not trim the password: spaces may be part of it', () => {
    expect(validateLogin({ email: 'a@b.cd', password: '   ' })).toEqual({})
  })
})
