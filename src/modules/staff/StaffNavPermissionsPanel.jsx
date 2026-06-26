import { useCallback, useState } from 'react'
import {
  countScreenPermissionsSelected,
  getFieldPermissionEntry,
  getScreenPermissionEntry,
  groupFieldsBySection,
  isMenuPermissionChecked,
  isScreenAccessEnabled,
  setFieldMenuPermission,
  setScreenAccess,
  setScreenMenuPermission,
} from '../../api/staffMenuPermissionsApi'

/**
 * @typedef {import('../../api/staffMenuPermissionsApi').MenuPermissionGroup} MenuPermissionGroup
 * @typedef {import('../../api/staffMenuPermissionsApi').MenuPermissionScreen} MenuPermissionScreen
 * @typedef {import('../../api/staffMenuPermissionsApi').MenuPermissionField} MenuPermissionField
 * @typedef {import('../../api/staffMenuPermissionsApi').NavPermissionsMap} NavPermissionsMap
 */

export function emptyNavPermissions() {
  return {}
}

/**
 * @param {{
 *   perm: { type: string, label: string },
 *   checked: boolean,
 *   disabled?: boolean,
 *   onChange: (checked: boolean) => void,
 * }} props
 */
function PermissionCheckboxRow({ perm, checked, disabled = false, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100/80">
      <span>{perm.label}</span>
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 rounded border-slate-300"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

/**
 * @param {{
 *   screen: MenuPermissionScreen,
 *   permissions: NavPermissionsMap,
 *   onChange: (next: NavPermissionsMap) => void,
 *   disabled?: boolean,
 * }} props
 */
function ScreenOnlyCheckboxRow({ screen, permissions, onChange, disabled = false }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50">
      <span className="min-w-0 truncate" title={screen.label}>
        {screen.label}
      </span>
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 rounded border-slate-300"
        checked={isScreenAccessEnabled(permissions, screen.key)}
        disabled={disabled}
        onChange={(e) => onChange(setScreenAccess(permissions, screen.key, e.target.checked))}
      />
    </label>
  )
}

/**
 * @param {{
 *   field: MenuPermissionField,
 *   screen: MenuPermissionScreen,
 *   permissions: NavPermissionsMap,
 *   onChange: (next: NavPermissionsMap) => void,
 *   disabled?: boolean,
 * }} props
 */
function FieldPermissionBlock({ field, screen, permissions, onChange, disabled = false }) {
  const rowPerms = getFieldPermissionEntry(permissions, screen.key, field.key)

  return (
    <div className="rounded-md border border-slate-200/80 bg-white">
      <div className="border-b border-slate-100 px-4 py-2">
        <p className="text-sm font-medium text-slate-800">{field.label}</p>
        {field.requiredForApprove ? (
          <p className="text-[11px] text-amber-700">Required for approve</p>
        ) : field.optional ? (
          <p className="text-[11px] text-slate-500">Optional</p>
        ) : null}
      </div>
      <ul className="divide-y divide-slate-100">
        {field.permissions.map((perm) => (
          <li key={`${screen.key}-${field.key}-${perm.type}`}>
            <PermissionCheckboxRow
              perm={perm}
              checked={isMenuPermissionChecked(rowPerms, perm.type)}
              disabled={disabled}
              onChange={(checked) => onChange(setFieldMenuPermission(permissions, screen, field, perm.type, checked))}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * @param {{
 *   screen: MenuPermissionScreen,
 *   permissions: NavPermissionsMap,
 *   onChange: (next: NavPermissionsMap) => void,
 *   disabled?: boolean,
 *   expanded: boolean,
 *   onToggle: () => void,
 * }} props
 */
function ScreenPermissionAccordion({
  screen,
  permissions,
  onChange,
  disabled = false,
  expanded,
  onToggle,
}) {
  const rowPerms = getScreenPermissionEntry(permissions, screen.key)
  const selectedCount = countScreenPermissionsSelected(screen, permissions)
  const fieldSections = screen.fields?.length ? groupFieldsBySection(screen.fields) : []

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center text-slate-400 transition-transform ${
            expanded ? 'rotate-90 text-indigo-600' : ''
          }`}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="min-w-0 flex-1 truncate" title={screen.label}>
          {screen.label}
        </span>
        {selectedCount > 0 ? (
          <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
            {selectedCount} selected
          </span>
        ) : null}
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/80 p-3">
          {screen.permissions.length ? (
            <ul className="overflow-hidden divide-y divide-slate-100 rounded-md border border-slate-200/80 bg-white">
              {screen.permissions.map((perm) => (
                <li key={`${screen.key}-${perm.type}`}>
                  <PermissionCheckboxRow
                    perm={perm}
                    checked={isMenuPermissionChecked(rowPerms, perm.type)}
                    disabled={disabled}
                    onChange={(checked) =>
                      onChange(setScreenMenuPermission(permissions, screen, perm.type, checked))
                    }
                  />
                </li>
              ))}
            </ul>
          ) : null}

          {fieldSections.length ? (
            <div className="space-y-3">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                View modal fields
              </p>
              {fieldSections.map((section) => (
                <div key={`${screen.key}-${section.key}`} className="space-y-2">
                  <p className="px-1 text-xs font-medium text-slate-600">{section.label}</p>
                  {section.fields.map((field) => (
                    <FieldPermissionBlock
                      key={`${screen.key}-${field.key}`}
                      field={field}
                      screen={screen}
                      permissions={permissions}
                      onChange={onChange}
                      disabled={disabled}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * @param {{
 *   groups: MenuPermissionGroup[],
 *   permissions: NavPermissionsMap,
 *   onChange: (next: NavPermissionsMap) => void,
 *   loading?: boolean,
 *   error?: string,
 *   disabled?: boolean,
 *   screenOnly?: boolean,
 *   requireSelection?: boolean,
 * }} props
 */
export function StaffNavPermissionsPanel({
  groups,
  permissions,
  onChange,
  loading = false,
  error = '',
  disabled = false,
  screenOnly = true,
  requireSelection = false,
}) {
  const hasRows = groups.some((group) => group.screens.length > 0)
  const [expandedKeys, setExpandedKeys] = useState(() => ({}))

  const toggleScreen = useCallback((navKey) => {
    setExpandedKeys((prev) => ({
      ...prev,
      [navKey]: !prev[navKey],
    }))
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-slate-200 bg-slate-50/60">
      <div className="shrink-0 border-b border-slate-200 px-4 py-3">
        <h4 className="text-sm font-semibold text-slate-900">Menu access</h4>
        <p className="mt-1 text-xs text-slate-500">
          {screenOnly
            ? 'Check each screen this user can open after login.'
            : 'Open a screen to choose permissions. Only checked items appear for this user after login.'}
          {requireSelection ? ' At least one screen is required.' : ''}
        </p>
        {error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading menu access…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !hasRows ? (
          <p className="text-sm text-slate-500">No menu items available.</p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              if (!group.screens.length) return null

              return (
                <section key={group.key}>
                  <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {group.label}
                  </p>
                  <div className="space-y-2">
                    {group.screens.map((screen) =>
                      screenOnly || screen.screenOnly ? (
                        <ScreenOnlyCheckboxRow
                          key={screen.key}
                          screen={screen}
                          permissions={permissions}
                          onChange={onChange}
                          disabled={disabled}
                        />
                      ) : (
                        <ScreenPermissionAccordion
                          key={screen.key}
                          screen={screen}
                          permissions={permissions}
                          onChange={onChange}
                          disabled={disabled}
                          expanded={Boolean(expandedKeys[screen.key])}
                          onToggle={() => toggleScreen(screen.key)}
                        />
                      ),
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
