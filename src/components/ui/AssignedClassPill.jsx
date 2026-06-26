/**
 * Class assignment chip: name or id + optional room in brackets.
 */
export function AssignedClassPill({ label, room, compact = false, title }) {
  const roomText = String(room ?? '').trim()
  const roomInParens = roomText ? (roomText.startsWith('(') ? roomText : `(${roomText})`) : ''

  if (!label && !roomInParens) return null

  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-baseline gap-0.5 rounded-md border border-indigo-100/90 bg-indigo-50/70 ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
      }`}
    >
      <span className={`truncate font-semibold text-indigo-900 ${compact ? '' : 'text-sm'}`}>
        {label || '—'}
      </span>
      {roomInParens ? (
        <span className={`shrink-0 font-medium text-slate-600 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
          {roomInParens}
        </span>
      ) : null}
    </span>
  )
}

/** One CSV token: "5 (201)" → { label: "5", room: "201" }. */
export function parseAssignedClassCsvToken(token) {
  const s = String(token ?? '').trim()
  if (!s) return { label: '', room: '' }
  const match = s.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (match) {
    return { label: match[1].trim(), room: match[2].trim() }
  }
  return { label: s, room: '' }
}
