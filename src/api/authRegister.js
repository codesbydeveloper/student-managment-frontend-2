import { API_BASE_URL, ROLES } from '../utils/constants'


export function buildRegisterRequestBody(form) {
  const role = form.role
  const fullName = form.fullName.trim()
  const email = form.email.trim().toLowerCase()
  const password = form.password
  const confirmPassword = form.confirmPassword

  if (role === ROLES.TEACHER) {
    return {
      role,
      fullName,
      email,
      password,
      confirmPassword,
      subjectFocus: (form.subject || '').trim(),
    }
  }

  return { role, fullName, email, password, confirmPassword }
}

function formatErrorPayload(data, status) {
  if (data == null || typeof data !== 'object') {
    return `Registration failed (${status})`
  }
  if (typeof data.message === 'string' && data.message) return data.message
  if (typeof data.error === 'string' && data.error) return data.error
  if (Array.isArray(data.errors)) {
    const parts = data.errors
      .map((e) => (typeof e === 'string' ? e : e?.msg || e?.message))
      .filter(Boolean)
    if (parts.length) return parts.join(' ')
  }
  return `Registration failed (${status})`
}

/**
 * @returns {Promise<{ ok: true, data: unknown } | { ok: false, error: string }>}
 */
export async function registerAccount(form) {
  const body = buildRegisterRequestBody(form)
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
