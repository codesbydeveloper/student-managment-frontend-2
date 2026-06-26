import { ROLES, STORAGE_KEYS } from './constants'

/**
 * Student IDs linked to a parent account (API auth user + optional persisted parents cache).
 */
export function getLinkedStudentIdsForParent(authUser, parentsFromApp) {
  if (!authUser || authUser.role !== ROLES.PARENT) return []

  const parents = Array.isArray(parentsFromApp) ? parentsFromApp : []

  const byId = parents.find((p) => p.id === authUser.id)
  if (byId?.studentIds?.length) return [...byId.studentIds]

  const em = (authUser.email || '').trim().toLowerCase()
  const byEmail = parents.find((p) => (p.email || '').trim().toLowerCase() === em)
  if (byEmail?.studentIds?.length) return [...byEmail.studentIds]

  if (Array.isArray(authUser.children) && authUser.children.length) {
    return [...authUser.children]
  }

  return []
}

/** Read parents from localStorage app bundle (used at login before React hydrates). */
export function readParentsFromStoredAppData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.APP_DATA)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data?.parents) ? data.parents : []
  } catch {
    return []
  }
}
