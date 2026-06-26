import { API_BASE_URL } from '../utils/constants'

function formatErrorPayload(data, status) {
  if (data == null || typeof data !== 'object') {
    return `Request failed (${status})`
  }
  if (typeof data.message === 'string' && data.message) return data.message
  if (typeof data.error === 'string' && data.error) return data.error
  if (Array.isArray(data.errors)) {
    const parts = data.errors
      .map((e) => (typeof e === 'string' ? e : e?.msg || e?.message))
      .filter(Boolean)
    if (parts.length) return parts.join(' ')
  }
  return `Request failed (${status})`
}

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

/**
 * POST /api/auth/forgot-password/request — request OTP for the email.
 * @returns {Promise<{ ok: true, data: object } | { ok: false, error: string }>}
 */
export async function requestForgotPassword(email) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizeEmail(email) }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: formatErrorPayload(data, res.status) }
    }
    return { ok: true, data }
  } catch (e) {
    const msg = e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * POST /api/auth/verify-otp — verify the emailed OTP.
 * @returns {Promise<{ ok: true, data: object } | { ok: false, error: string }>}
 */
export async function verifyForgotPasswordOtp(email, otp) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizeEmail(email),
        otp: String(otp ?? '').trim(),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: formatErrorPayload(data, res.status) }
    }
    return { ok: true, data }
  } catch (e) {
    const msg = e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}

/**
 * POST /api/auth/reset-password — set new password after OTP verification (server rules apply).
 * @returns {Promise<{ ok: true, data: object } | { ok: false, error: string }>}
 */
export async function resetForgottenPassword(email, newPassword) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizeEmail(email),
        newPassword: String(newPassword ?? ''),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return { ok: false, error: formatErrorPayload(data, res.status) }
    }
    return { ok: true, data }
  } catch (e) {
    const msg = e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg }
  }
}
