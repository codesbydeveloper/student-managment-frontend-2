
export function decodeJwtPayload(token) {
  if (typeof token !== 'string' || token.startsWith('sms.')) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (base64.length % 4)) % 4
  const padded = base64 + '='.repeat(padLen)
  try {
    return JSON.parse(atob(padded))
  } catch {
    try {
      return JSON.parse(atob(base64))
    } catch {
      return null
    }
  }
}

export function createFakeToken(payload) {
  const body = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  }
  const encoded = btoa(JSON.stringify(body))
  return `sms.${encoded}.v1`
}

export function decodeFakeToken(token) {
  if (!token || typeof token !== 'string' || !token.startsWith('sms.')) {
    return null
  }
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    return JSON.parse(atob(parts[1]))
  } catch {
    return null
  }
}

export function isTokenExpired(token) {
  if (!token) return true
  if (token.startsWith('sms.')) {
    const payload = decodeFakeToken(token)
    if (!payload?.exp) return true
    return Date.now() > payload.exp
  }
  const jwtPayload = decodeJwtPayload(token)
  if (!jwtPayload?.exp) return false
  return Date.now() >= jwtPayload.exp * 1000
}


export function tokenMatchesStoredUser(token, user) {
  if (!token || !user?.id) return false
  if (token.startsWith('sms.')) {
    const payload = decodeFakeToken(token)
    return Boolean(payload && String(payload.sub) === String(user.id))
  }
  const p = decodeJwtPayload(token)
  if (!p) return true
  const sub = p.sub ?? p.userId ?? p.id
  if (sub == null || sub === '') return true
  return String(sub) === String(user.id)
}
