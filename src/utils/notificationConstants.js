/** Server limit for notice banner uploads (multipart `banner_image`). */
export const NOTIFICATION_BANNER_MAX_BYTES = 380 * 1024

export const NOTIFICATION_CATEGORIES = {
  ADMINISTRATIVE: 'administrative',
  ACADEMIC: 'academic',
}

export const NOTIFICATION_CATEGORY_LABELS = {
  [NOTIFICATION_CATEGORIES.ADMINISTRATIVE]: 'Administrative',
  [NOTIFICATION_CATEGORIES.ACADEMIC]: 'Academic',
}

/** Display label for API category values (`administrative`, `academic`, or legacy text). */
export function getNotificationCategoryLabel(category) {
  const key = String(category ?? '').trim().toLowerCase()
  if (NOTIFICATION_CATEGORY_LABELS[key]) return NOTIFICATION_CATEGORY_LABELS[key]
  if (key === 'administrative' || key.includes('administr')) {
    return NOTIFICATION_CATEGORY_LABELS[NOTIFICATION_CATEGORIES.ADMINISTRATIVE]
  }
  if (key === 'academic' || key.includes('academic')) {
    return NOTIFICATION_CATEGORY_LABELS[NOTIFICATION_CATEGORIES.ACADEMIC]
  }
  const raw = String(category ?? '').trim()
  if (/^administrative$/i.test(raw)) return NOTIFICATION_CATEGORY_LABELS[NOTIFICATION_CATEGORIES.ADMINISTRATIVE]
  if (/^academic$/i.test(raw)) return NOTIFICATION_CATEGORY_LABELS[NOTIFICATION_CATEGORIES.ACADEMIC]
  return raw || '—'
}

export const NOTIFICATION_TARGET_TYPES = {
  CLASS: 'class',
  SECTION: 'section',
  STUDENT: 'student',
  /** Server sent a free-text targets line (e.g. Webpushr segments) instead of class/student ids. */
  AUDIENCE: 'audience',
}

export const NOTIFICATION_TARGET_LABELS = {
  [NOTIFICATION_TARGET_TYPES.CLASS]: 'Class',
  [NOTIFICATION_TARGET_TYPES.SECTION]: 'Section',
  [NOTIFICATION_TARGET_TYPES.STUDENT]: 'Student',
  [NOTIFICATION_TARGET_TYPES.AUDIENCE]: 'Targets',
}

export const NOTIFICATION_STATUSES = {
  PENDING_ADMIN: 'pending_admin',
  PENDING_PRINCIPAL: 'pending_principal',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}
