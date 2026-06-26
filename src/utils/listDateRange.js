
export const NOTICE_HISTORY_PAGE_SIZE = 50

export const NOTICE_HISTORY_PAGE_SIZE_OPTIONS = [10, 30, 50, 80, 100]

export const DATE_RANGE_PRESETS = [
  { key: 'today', label: 'Today', apiValue: 'today' },
  { key: '3d', label: 'Last 3 days', apiValue: '3days' },
  { key: '7d', label: 'Last 7 days', apiValue: '7days' },
  { key: '15d', label: 'Last 15 days', apiValue: '15days' },
  { key: '30d', label: 'Last 30 days', apiValue: '30days' },
  { key: 'all', label: 'All', apiValue: null },
]

/**
 * Map UI key to API `dateRange` query value (e.g. `7days`).
 * @param {string | undefined} rangeKey
 * @returns {string | null}
 */
export function toApiDateRangeValue(rangeKey) {
  if (!rangeKey || rangeKey === 'all') return null
  const preset = DATE_RANGE_PRESETS.find((p) => p.key === rangeKey)
  return preset?.apiValue ?? null
}

/**
 * Append `dateRange=7days` style param for notice list APIs.
 * @param {URLSearchParams} params
 * @param {string | undefined} rangeKey
 */
export function appendDateRangeToSearchParams(params, rangeKey) {
  const apiValue = toApiDateRangeValue(rangeKey)
  if (apiValue) {
    params.set('dateRange', apiValue)
  }
}
