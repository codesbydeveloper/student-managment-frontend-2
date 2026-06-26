function parseDdMmYyyyCommaTimeIstToMs(s) {
  if (typeof s !== 'string') return null
  const m = s
    .trim()
    .match(/^(\d{2})-(\d{2})-(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)(?:\s*IST)?$/i)
  if (!m) return null
  const day = m[1]
  const month = m[2]
  const year = m[3]
  let hour = parseInt(m[4], 10)
  const minute = m[5]
  const sec = m[6]
  const ap = m[7].toUpperCase()
  if (ap === 'PM' && hour < 12) hour += 12
  if (ap === 'AM' && hour === 12) hour = 0
  const ds = `${year}-${month}-${day}T${String(hour).padStart(2, '0')}:${minute}:${sec}+05:30`
  const ms = Date.parse(ds)
  return Number.isFinite(ms) ? ms : null
}

export function parseDashboardTimestampMs(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') {
    if (v > 0 && v < 1e11) return v * 1000
    return Number.isFinite(v) ? v : null
  }
  if (typeof v === 'string') {
    const t = Date.parse(v)
    if (Number.isFinite(t)) return t
    const ist = parseDdMmYyyyCommaTimeIstToMs(v)
    if (ist != null) return ist
  }
  return null
}
