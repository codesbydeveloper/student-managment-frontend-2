import { Input } from './Input'
import { PHONE_MAX_LENGTH, sanitizePhoneDigits } from '../../utils/phoneInput'

/**
 * Phone field — digits only, max 10 (e.g. Indian mobile).
 */
export function PhoneInput({ value, onChange, className = '', placeholder, ...rest }) {
  const handleChange = (e) => {
    const next = sanitizePhoneDigits(e.target.value)
    if (onChange) {
      onChange({
        ...e,
        target: { ...e.target, value: next },
      })
    }
  }

  return (
    <Input
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      maxLength={PHONE_MAX_LENGTH}
      placeholder={placeholder ?? '10 digit mobile number'}
      value={value ?? ''}
      onChange={handleChange}
      className={className}
      {...rest}
    />
  )
}
