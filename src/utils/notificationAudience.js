/**
 * @param {string[] | string | null | undefined} input
 * @returns {string[]}
 */
export function expandAudienceLabels(input) {
  const rawList = Array.isArray(input)
    ? input
    : typeof input === 'string' && input.trim()
      ? [input]
      : []

  const out = []
  const seen = new Set()

  const add = (label) => {
    const s = String(label ?? '').trim()
    if (!s) return
    const key = s.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(s)
  }

  for (const label of rawList) {
    const s = String(label ?? '').trim()
    if (!s) continue

    if (s.includes(',') && /\bclass\s+[\w]/i.test(s)) {
      const parts = s.split(/,\s*(?=Class\s)/i).map((p) => p.trim()).filter(Boolean)
      if (parts.length > 1) {
        parts.forEach(add)
        continue
      }
    }

    if (s.includes(',') && s.length > 60) {
      const parts = s.split(/,\s+/).map((p) => p.trim()).filter(Boolean)
      if (parts.length > 1) {
        parts.forEach(add)
        continue
      }
    }

    add(s)
  }

  return out
}

/** @param {string[]} items */
export function audienceSummaryNoun(items) {
  if (!items.length) return 'recipients'
  if (items.every((n) => /^class\s/i.test(n))) {
    return items.length === 1 ? 'class' : 'classes'
  }
  return items.length === 1 ? 'recipient' : 'recipients'
}
