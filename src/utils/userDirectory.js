import { STORAGE_KEYS } from './constants'

function readCustomUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_USERS)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function isEmailTaken(email) {
  const n = email.trim().toLowerCase()
  return readCustomUsers().some((u) => u.email.toLowerCase() === n)
}


export function isEmailRegisteredAnywhere(email, teachers = [], parents = []) {
  const n = email.trim().toLowerCase()
  if (isEmailTaken(email)) return true
  if (teachers.some((t) => (t.email || '').trim().toLowerCase() === n)) return true
  if (parents.some((p) => (p.email || '').trim().toLowerCase() === n)) return true
  return false
}


export function appendCustomDirectoryUser({ fullName, email, password, role }) {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? `u-${crypto.randomUUID()}`
      : `u-${Date.now()}`
  const user = {
    id,
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    password: String(password),
    role,
  }
  const list = readCustomUsers()
  localStorage.setItem(STORAGE_KEYS.CUSTOM_USERS, JSON.stringify([...list, user]))
  return user
}
