
export function formatPtmDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso))
  } catch {
    return String(iso)
  }
}

export function truncatePtmText(text, max = 56) {
  const s = String(text ?? '').trim()
  if (!s) return '—'
  if (s.length <= max) return s
  return `${s.slice(0, max)}…`
}
