
export const PHONE_MAX_LENGTH = 10

export function sanitizePhoneDigits(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .slice(0, PHONE_MAX_LENGTH)
}

export function isPhone10Digits(value) {
  return sanitizePhoneDigits(value).length === PHONE_MAX_LENGTH
}
