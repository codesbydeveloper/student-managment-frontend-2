/**
 * Apply API page number without triggering a redundant re-render / reload loop.
 * @param {React.Dispatch<React.SetStateAction<number>>} setPage
 * @param {unknown} apiPage
 */
export function syncPageFromApi(setPage, apiPage) {
  setPage((prev) => {
    const next = Number(apiPage)
    if (!Number.isFinite(next) || next < 1) return prev
    return next === prev ? prev : next
  })
}
