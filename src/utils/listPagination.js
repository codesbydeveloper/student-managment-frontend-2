/**
 * @param {number} current
 * @param {number} totalPages
 * @returns {(number | '…')[]}
 */
export function buildPageNumberList(current, totalPages) {
  const total = Math.max(1, Number(totalPages) || 1)
  const cur = Math.min(Math.max(1, Number(current) || 1), total)
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = new Set([1, total, cur, cur - 1, cur + 1, cur - 2, cur + 2])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  /** @type {(number | '…')[]} */
  const out = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('…')
    out.push(sorted[i])
  }
  return out
}
