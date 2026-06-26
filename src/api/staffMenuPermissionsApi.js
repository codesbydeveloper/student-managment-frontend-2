import { API_BASE_URL } from '../utils/constants'

/**
 * @typedef {'view' | 'edit' | 'create' | 'delete'} MenuPermissionType
 * @typedef {{ type: MenuPermissionType, label: string }} MenuPermissionRow
 * @typedef {{
 *   key: string,
 *   label: string,
 *   section?: string,
 *   permissions: MenuPermissionRow[],
 *   requiredForApprove?: boolean,
 *   optional?: boolean,
 * }} MenuPermissionField
 * @typedef {{
 *   key: string,
 *   label: string,
 *   permissions: MenuPermissionRow[],
 *   fields?: MenuPermissionField[],
 *   screenOnly?: boolean,
 * }} MenuPermissionScreen
 * @typedef {{ key: string, label: string, screens: MenuPermissionScreen[] }} MenuPermissionGroup
 * @typedef {{
 *   permissionTypes?: MenuPermissionType[],
 *   rules?: { editIncludesView?: boolean, note?: string, detailFieldsNote?: string, screenOnly?: boolean },
 *   groups: MenuPermissionGroup[],
 *   screenOnly?: boolean,
 * }} MenuPermissionsCatalog
 * @typedef {{
 *   view?: boolean,
 *   edit?: boolean,
 *   create?: boolean,
 *   delete?: boolean,
 *   fields?: Record<string, { view?: boolean, edit?: boolean, create?: boolean, delete?: boolean }>,
 * }} ScreenPermissionEntry
 * @typedef {Record<string, ScreenPermissionEntry>} NavPermissionsMap
 */

const PERMISSION_TYPES = new Set(['view', 'edit', 'create', 'delete'])

const SECTION_LABELS = {
  detail: 'Detail fields',
  form: 'Form fields',
  action: 'Actions',
}

function formatError(data, status) {
  if (data == null) return `Could not load menu access (${status})`
  if (typeof data === 'string' && data) return data
  if (typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
  }
  return `Could not load menu access (${status})`
}

/**
 * @param {unknown} raw
 * @returns {MenuPermissionRow | null}
 */
function normalizePermissionRow(raw) {
  if (!raw || typeof raw !== 'object') return null
  const type = String(raw.type ?? '').trim().toLowerCase()
  if (!PERMISSION_TYPES.has(type)) return null
  const label = String(raw.label ?? '').trim()
  if (!label) return null
  return { type, label }
}

/**
 * @param {unknown} raw
 * @returns {MenuPermissionField | null}
 */
function normalizeField(raw) {
  if (!raw || typeof raw !== 'object') return null
  const key = String(raw.key ?? '').trim()
  const label = String(raw.label ?? '').trim()
  if (!key || !label) return null
  const permissions = (Array.isArray(raw.permissions) ? raw.permissions : [])
    .map(normalizePermissionRow)
    .filter(Boolean)
  if (!permissions.length) return null
  const section = String(raw.section ?? '').trim().toLowerCase() || undefined
  return {
    key,
    label,
    section,
    permissions,
    requiredForApprove: raw.requiredForApprove === true,
    optional: raw.optional === true,
  }
}

/**
 * @param {unknown} raw
 * @returns {MenuPermissionScreen | null}
 */
function normalizeScreen(raw) {
  if (!raw || typeof raw !== 'object') return null
  const key = String(raw.key ?? '').trim()
  const label = String(raw.label ?? '').trim()
  if (!key || !label) return null

  const permissions = (Array.isArray(raw.permissions) ? raw.permissions : [])
    .map(normalizePermissionRow)
    .filter(Boolean)
  const fields = (Array.isArray(raw.fields) ? raw.fields : [])
    .map(normalizeField)
    .filter(Boolean)

  if (!permissions.length && !fields.length) {
    return { key, label, permissions: [], screenOnly: true }
  }

  return { key, label, permissions, fields: fields.length ? fields : undefined }
}

/**
 * @param {unknown} raw
 * @returns {MenuPermissionGroup | null}
 */
function normalizeGroup(raw) {
  if (!raw || typeof raw !== 'object') return null
  const key = String(raw.key ?? '').trim()
  const label = String(raw.label ?? '').trim()
  if (!key || !label) return null
  const screens = (Array.isArray(raw.screens) ? raw.screens : [])
    .map(normalizeScreen)
    .filter(Boolean)
  if (!screens.length) return null
  return { key, label, screens }
}

/**
 * @param {unknown} data
 * @returns {MenuPermissionsCatalog | null}
 */
export function normalizeMenuPermissionsCatalog(data) {
  const envelope =
    data && typeof data === 'object' && !Array.isArray(data) && data.data && typeof data.data === 'object'
      ? data.data
      : data
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return null

  const groups = (Array.isArray(envelope.groups) ? envelope.groups : [])
    .map(normalizeGroup)
    .filter(Boolean)

  const permissionTypes = Array.isArray(envelope.permissionTypes)
    ? envelope.permissionTypes
        .map((t) => String(t ?? '').trim().toLowerCase())
        .filter((t) => PERMISSION_TYPES.has(t))
    : ['view', 'edit', 'create', 'delete']

  const rules =
    envelope.rules && typeof envelope.rules === 'object'
      ? {
          editIncludesView: envelope.rules.editIncludesView !== false,
          note: typeof envelope.rules.note === 'string' ? envelope.rules.note : undefined,
          detailFieldsNote:
            typeof envelope.rules.detailFieldsNote === 'string' ? envelope.rules.detailFieldsNote : undefined,
          screenOnly: envelope.rules.screenOnly === true,
        }
      : { editIncludesView: true }

  const screenOnly =
    envelope.screenOnly === true ||
    rules.screenOnly === true ||
    /:\s*true/.test(String(rules.note ?? '')) ||
    groups.every((group) => group.screens.every((screen) => screen.screenOnly))

  return { permissionTypes, rules, groups, screenOnly }
}

/**
 * GET /api/staff/menu-access
 * @param {string} token
 */
export async function fetchStaffMenuAccess(token) {
  if (!token) {
    return { ok: false, error: 'Not signed in', catalog: null }
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/staff/menu-access`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: formatError(data, res.status), catalog: null, httpStatus: res.status }
    }
    const catalog = normalizeMenuPermissionsCatalog(data)
    if (!catalog?.groups?.length) {
      return { ok: false, error: 'Menu access list is empty.', catalog: null }
    }
    return { ok: true, catalog }
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message.includes('fetch') ? 'Cannot reach server.' : 'Network error.'
    return { ok: false, error: msg, catalog: null }
  }
}

/**
 * @param {NavPermissionsMap} permissions
 * @param {string} screenKey
 * @returns {ScreenPermissionEntry}
 */
export function getScreenPermissionEntry(permissions, screenKey) {
  const entry = permissions?.[screenKey]
  if (entry === true) {
    return { view: true, edit: true, create: true, delete: true }
  }
  return entry && typeof entry === 'object' ? entry : {}
}

/**
 * @param {unknown} entry
 */
export function isScreenEntryEnabled(entry) {
  if (entry === true) return true
  if (!entry || typeof entry !== 'object') return false
  return Boolean(entry.enabled || entry.view || entry.edit || entry.create || entry.delete)
}

/**
 * @param {NavPermissionsMap} permissions
 * @param {string} screenKey
 */
export function isScreenAccessEnabled(permissions, screenKey) {
  return isScreenEntryEnabled(getScreenPermissionEntry(permissions, screenKey))
}

/**
 * @param {NavPermissionsMap} permissions
 * @param {string} screenKey
 * @param {boolean} checked
 */
export function setScreenAccess(permissions, screenKey, checked) {
  if (!checked) {
    const next = { ...permissions }
    delete next[screenKey]
    return next
  }
  return {
    ...permissions,
    [screenKey]: { view: true, edit: true, create: true, delete: true },
  }
}

/**
 * @param {MenuPermissionsCatalog | null | undefined} catalog
 */
export function catalogUsesScreenOnlyAccess(catalog) {
  return catalog?.screenOnly === true
}

/**
 * @param {NavPermissionsMap} permissions
 * @param {string} screenKey
 * @param {string} fieldKey
 */
export function getFieldPermissionEntry(permissions, screenKey, fieldKey) {
  return getScreenPermissionEntry(permissions, screenKey).fields?.[fieldKey] || {}
}

/**
 * @param {Record<string, boolean | undefined>} rowPerms
 * @param {MenuPermissionType} type
 */
export function isMenuPermissionChecked(rowPerms, type) {
  return Boolean(rowPerms[type])
}

/**
 * @param {MenuPermissionRow[]} permissionRows
 * @param {Record<string, boolean | undefined>} rowPerms
 */
function countPermissionRowsSelected(permissionRows, rowPerms) {
  return permissionRows.filter((perm) => isMenuPermissionChecked(rowPerms, perm.type)).length
}

/**
 * @param {MenuPermissionScreen} screen
 * @param {NavPermissionsMap} permissions
 */
export function countScreenPermissionsSelected(screen, permissions = {}) {
  if (screen.screenOnly) {
    return isScreenAccessEnabled(permissions, screen.key) ? 1 : 0
  }

  const entry = getScreenPermissionEntry(permissions, screen.key)
  let count = countPermissionRowsSelected(screen.permissions, entry)

  for (const field of screen.fields || []) {
    count += countPermissionRowsSelected(field.permissions, getFieldPermissionEntry(permissions, screen.key, field.key))
  }

  return count
}

/**
 * @param {MenuPermissionRow[]} allowedRows
 * @param {Record<string, boolean | undefined>} rowPerms
 */
function sanitizePermissionFlags(allowedRows, rowPerms = {}) {
  const allowed = new Set(allowedRows.map((p) => p.type))
  return {
    view: allowed.has('view') ? Boolean(rowPerms.view) : false,
    edit: allowed.has('edit') ? Boolean(rowPerms.edit) : false,
    create: allowed.has('create') ? Boolean(rowPerms.create) : false,
    delete: allowed.has('delete') ? Boolean(rowPerms.delete) : false,
  }
}

/**
 * @param {MenuPermissionRow[]} allowedRows
 * @param {Record<string, boolean | undefined>} prev
 * @param {MenuPermissionType} type
 * @param {boolean} checked
 */
function applyPermissionToggle(allowedRows, prev, type, checked) {
  const allowed = new Set(allowedRows.map((p) => p.type))
  if (!allowed.has(type)) return prev

  const next = sanitizePermissionFlags(allowedRows, prev)
  next[type] = checked

  if (type === 'edit' && checked) {
    next.view = true
  }
  if ((type === 'create' || type === 'delete') && checked) {
    next.view = true
    if (allowed.has('edit')) next.edit = true
  }
  if (type === 'view' && !checked) {
    if (allowed.has('edit')) next.edit = false
    if (allowed.has('create')) next.create = false
    if (allowed.has('delete')) next.delete = false
  }

  return next
}

/**
 * @param {NavPermissionsMap} permissions
 * @param {MenuPermissionScreen} screen
 * @param {MenuPermissionType} type
 * @param {boolean} checked
 */
export function setScreenMenuPermission(permissions, screen, type, checked) {
  const allowed = new Set(screen.permissions.map((p) => p.type))
  if (!allowed.has(type)) return permissions

  const prev = getScreenPermissionEntry(permissions, screen.key)
  const nextFlags = applyPermissionToggle(screen.permissions, prev, type, checked)

  return {
    ...permissions,
    [screen.key]: {
      ...prev,
      ...nextFlags,
    },
  }
}

/**
 * @param {NavPermissionsMap} permissions
 * @param {MenuPermissionScreen} screen
 * @param {MenuPermissionField} field
 * @param {MenuPermissionType} type
 * @param {boolean} checked
 */
export function setFieldMenuPermission(permissions, screen, field, type, checked) {
  const allowed = new Set(field.permissions.map((p) => p.type))
  if (!allowed.has(type)) return permissions

  const screenEntry = getScreenPermissionEntry(permissions, screen.key)
  const prevField = getFieldPermissionEntry(permissions, screen.key, field.key)
  const nextField = applyPermissionToggle(field.permissions, prevField, type, checked)

  return {
    ...permissions,
    [screen.key]: {
      ...screenEntry,
      fields: {
        ...(screenEntry.fields || {}),
        [field.key]: nextField,
      },
    },
  }
}

/**
 * @param {MenuPermissionField[]} fields
 */
export function groupFieldsBySection(fields) {
  /** @type {{ key: string, label: string, fields: MenuPermissionField[] }[]} */
  const sections = []
  const byKey = new Map()

  for (const field of fields) {
    const sectionKey = field.section || 'other'
    if (!byKey.has(sectionKey)) {
      const label = SECTION_LABELS[sectionKey] || 'Fields'
      const section = { key: sectionKey, label, fields: [] }
      byKey.set(sectionKey, section)
      sections.push(section)
    }
    byKey.get(sectionKey).fields.push(field)
  }

  return sections
}

export function getSectionLabel(sectionKey) {
  return SECTION_LABELS[sectionKey] || 'Fields'
}

const FLAG_KEYS = ['view', 'edit', 'create', 'delete']

/**
 * @param {Record<string, boolean | undefined>} entry
 */
function pickActiveFlags(entry = {}) {
  /** @type {Record<string, boolean>} */
  const out = {}
  for (const key of FLAG_KEYS) {
    if (entry[key]) out[key] = true
  }
  return out
}

/**
 * @param {NavPermissionsMap} permissions
 * @param {{ screenOnly?: boolean }} [options]
 */
export function buildMenuAccessPayload(permissions = {}, options = {}) {
  const screenOnly = options.screenOnly === true

  if (screenOnly) {
    /** @type {Record<string, boolean>} */
    const out = {}
    for (const [screenKey, entry] of Object.entries(permissions)) {
      if (isScreenEntryEnabled(entry)) out[screenKey] = true
    }
    return out
  }

  /** @type {Record<string, object>} */
  const out = {}

  for (const [screenKey, entry] of Object.entries(permissions)) {
    if (!entry || typeof entry !== 'object') continue

    const screen = pickActiveFlags(entry)
    if (entry.fields && typeof entry.fields === 'object') {
      /** @type {Record<string, Record<string, boolean>>} */
      const fieldsOut = {}
      for (const [fieldKey, fieldEntry] of Object.entries(entry.fields)) {
        const fieldFlags = pickActiveFlags(fieldEntry)
        if (Object.keys(fieldFlags).length) {
          fieldsOut[fieldKey] = fieldFlags
        }
      }
      if (Object.keys(fieldsOut).length) {
        screen.fields = fieldsOut
      }
    }

    if (Object.keys(screen).length) {
      out[screenKey] = screen
    }
  }

  return out
}

/**
 * @param {unknown} menuAccess
 * @returns {NavPermissionsMap}
 */
export function parseMenuAccessFromApi(menuAccess) {
  if (menuAccess == null) return {}

  if (typeof menuAccess === 'string') {
    const trimmed = menuAccess.trim()
    if (!trimmed) return {}
    try {
      return parseMenuAccessFromApi(JSON.parse(trimmed))
    } catch {
      return {}
    }
  }

  if (Array.isArray(menuAccess)) {
    /** @type {NavPermissionsMap} */
    const out = {}
    for (const key of menuAccess) {
      const screenKey = String(key ?? '').trim()
      if (!screenKey) continue
      out[screenKey] = { view: true, edit: true, create: true, delete: true }
    }
    return out
  }

  if (typeof menuAccess !== 'object') return {}

  /** @type {NavPermissionsMap} */
  const out = {}

  for (const [screenKey, entry] of Object.entries(menuAccess)) {
    if (entry === true) {
      out[screenKey] = { view: true, edit: true, create: true, delete: true }
      continue
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue

    if (entry.enabled === true) {
      out[screenKey] = { view: true, edit: true, create: true, delete: true }
      continue
    }

    /** @type {ScreenPermissionEntry} */
    const screenEntry = {
      view: Boolean(entry.view),
      edit: Boolean(entry.edit),
      create: Boolean(entry.create),
      delete: Boolean(entry.delete),
    }

    if (entry.fields && typeof entry.fields === 'object' && !Array.isArray(entry.fields)) {
      /** @type {NonNullable<ScreenPermissionEntry['fields']>} */
      const fields = {}
      for (const [fieldKey, fieldEntry] of Object.entries(entry.fields)) {
        if (!fieldEntry || typeof fieldEntry !== 'object' || Array.isArray(fieldEntry)) continue
        fields[fieldKey] = {
          view: Boolean(fieldEntry.view),
          edit: Boolean(fieldEntry.edit),
          create: Boolean(fieldEntry.create),
          delete: Boolean(fieldEntry.delete),
        }
      }
      if (Object.keys(fields).length) {
        screenEntry.fields = fields
      }
    }

    out[screenKey] = screenEntry
  }

  return out
}
