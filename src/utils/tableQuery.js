/**
 * Client-side table search (same rules as DataTable).
 * @param {object[]} rows
 * @param {string[]|undefined} searchKeys — if empty/undefined, match any string field
 * @param {string} query
 */
export function filterRowsByTableSearch(rows, searchKeys, query) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) => {
    if (searchKeys?.length) {
      return searchKeys.some((k) => String(row[k] ?? '').toLowerCase().includes(q))
    }
    return Object.values(row).some((v) =>
      String(v ?? '')
        .toLowerCase()
        .includes(q),
    )
  })
}
