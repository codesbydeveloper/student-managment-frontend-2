/** One CSV line → cells (double-quoted fields). */
export function parseCsvLine(line) {
  const cells = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      cells.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  cells.push(cur.trim())
  return cells
}

/**
 * @param {string} text
 * @returns {{ headers: string[], rows: Record<string, string>[] }}
 */
export function parseCsv(text) {
  const raw = String(text).replace(/^\uFEFF/, '')
  const lines = raw.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim())
  if (!lines.length) return { headers: [], rows: [] }
  const headerCells = parseCsvLine(lines[0])
  const headers = headerCells.map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_'),
  )
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cells = parseCsvLine(line)
    if (cells.every((c) => !c)) continue
    const rec = {}
    headers.forEach((h, j) => {
      rec[h] = cells[j] ?? ''
    })
    rows.push(rec)
  }
  return { headers, rows }
}
