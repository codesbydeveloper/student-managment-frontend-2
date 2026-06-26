import { isPhone10Digits, sanitizePhoneDigits } from './phoneInput'

export { sanitizePhoneDigits }

export function required(value, label = 'This field') {
  const v = typeof value === 'string' ? value.trim() : value
  if (v === undefined || v === null || v === '') {
    return `${label} is required`
  }
  return ''
}

export function email(value) {
  const v = (value || '').trim()
  if (!v) return ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return 'Enter a valid email'
  }
  return ''
}

export function minLength(value, min, label = 'This field') {
  const v = (value || '').trim()
  if (v.length > 0 && v.length < min) {
    return `${label} must be at least ${min} characters`
  }
  return ''
}


export function phone10Digits(value, label = 'Phone', { required: requiredField = true } = {}) {
  const digits = sanitizePhoneDigits(value)
  if (!digits) return requiredField ? `${label} is required` : ''
  if (!isPhone10Digits(digits)) return `${label} must be exactly 10 digits`
  return ''
}
