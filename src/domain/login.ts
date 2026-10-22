export interface LoginForm {
  email: string
  password: string
}

export type LoginErrors = Partial<Record<keyof LoginForm, string>>

// Deliberately loose: it only catches typos like a missing "@". The server decides what is valid.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateLogin(form: LoginForm): LoginErrors {
  const errors: LoginErrors = {}
  const email = form.email.trim()
  if (email === '') errors.email = 'Email is required'
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Email looks invalid'
  if (form.password === '') errors.password = 'Password is required'
  return errors
}
