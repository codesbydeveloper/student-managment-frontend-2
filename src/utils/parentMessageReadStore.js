const STORAGE_KEY = 'scs_parent_read_message_ids'

function loadIds() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map((id) => String(id)))
  } catch {
    return new Set()
  }
}

function saveIds(set) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    /* ignore quota / private mode */
  }
}

export function rememberParentMessageRead(messageId) {
  const id = String(messageId ?? '').trim()
  if (!id) return
  const set = loadIds()
  if (set.has(id)) return
  set.add(id)
  saveIds(set)
}

export function isParentMessageReadLocally(messageId) {
  const id = String(messageId ?? '').trim()
  if (!id) return false
  return loadIds().has(id)
}


export function applyParentMessageReadOverrides(messages) {
  if (!Array.isArray(messages) || !messages.length) return messages
  const readIds = loadIds()
  if (!readIds.size) return messages
  return messages.map((m) => {
    if (!m || m.isRead) return m
    if (readIds.has(String(m.id))) return { ...m, isRead: true }
    return m
  })
}
