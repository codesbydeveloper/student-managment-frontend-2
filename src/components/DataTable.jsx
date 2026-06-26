import { useEffect, useMemo, useState } from 'react'
import { Input } from './ui/Input'
import { ListPagination } from './ui/ListPagination'
import { filterRowsByTableSearch } from '../utils/tableQuery'

/**
 * Data table with search and client-side paging.
 * @param {object[]} columns { key, header, thClassName?, tdClassName?, render?(row) }
 * @param {object[]} rows
 * @param {string[]} [searchKeys]
 */
export function DataTable({
  columns,
  rows,
  searchKeys,
  searchPlaceholder = 'Search…',
  pageSize = 5,
  emptyMessage = 'No records found.',
  toolbar,
  /** When true, `rows` is one server page; use `serverTotal` + `serverPage` + `onServerPageChange` for paging. */
  serverPagination = false,
  serverTotal = 0,
  serverPage = 1,
  onServerPageChange,
  showSearch = true,
  /** Called with the rows currently rendered in the table (one client/server page, after search filter). */
  onDisplayedRowsChange,
  /** When set with `onExternalSearchQueryChange`, search text is controlled by the parent (same string as table). */
  externalSearchQuery,
  onExternalSearchQueryChange,
  /** Client-side only: reports 1-based current page so parents (e.g. export) can match the table. */
  onClientPageChange,
}) {
  const [internalQuery, setInternalQuery] = useState('')
  const [page, setPage] = useState(1)
  const controlledSearch = typeof onExternalSearchQueryChange === 'function'
  const query = controlledSearch ? (externalSearchQuery ?? '') : internalQuery

  const filtered = useMemo(() => {
    if (serverPagination && controlledSearch) return rows
    return filterRowsByTableSearch(rows, searchKeys, query)
  }, [rows, searchKeys, query, serverPagination, controlledSearch])

  const clientTotalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const serverTotalPages = Math.max(1, Math.ceil((serverTotal || 0) / pageSize))
  const totalPages = serverPagination ? serverTotalPages : clientTotalPages

  const currentPage = serverPagination ? Math.min(Math.max(1, serverPage), serverTotalPages) : page

  const pageRows = useMemo(() => {
    if (serverPagination) return filtered
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [serverPagination, filtered, page, pageSize, totalPages])

  useEffect(() => {
    if (serverPagination) return
    const tid = window.setTimeout(() => setPage(1), 0)
    return () => window.clearTimeout(tid)
  }, [query, serverPagination])

  useEffect(() => {
    onDisplayedRowsChange?.(pageRows)
  }, [pageRows, onDisplayedRowsChange])

  useEffect(() => {
    if (serverPagination) return
    onClientPageChange?.(currentPage)
  }, [serverPagination, currentPage, onClientPageChange])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {showSearch ? (
          <div className="w-full max-w-xs">
            <Input
              value={query}
              onChange={(e) =>
                controlledSearch
                  ? onExternalSearchQueryChange(e.target.value)
                  : setInternalQuery(e.target.value)
              }
              placeholder={searchPlaceholder}
              aria-label="Search table"
            />
          </div>
        ) : (
          <div />
        )}
        {toolbar ? <div className="flex flex-wrap gap-2">{toolbar}</div> : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg shadow-slate-900/[0.04] ring-1 ring-slate-900/[0.02]">
        <div className="overflow-x-auto">
          <table className="app-data-table">
            <thead>
              <tr className="app-table-head">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-4 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-indigo-100/95 ${col.thClassName || ''}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-14 text-center text-sm font-medium text-slate-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                pageRows.map((row, idx) => (
                  <tr
                    key={row.id ?? row.key}
                    className={`transition-colors hover:bg-indigo-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3.5 text-center text-slate-800 ${col.tdClassName || ''}`}
                      >
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <ListPagination
          borderTop
          className="!mt-0 rounded-b-2xl"
          page={currentPage}
          totalPages={totalPages}
          total={serverPagination ? serverTotal : filtered.length}
          pageSize={pageSize}
          onPrev={() => {
            if (serverPagination) {
              onServerPageChange?.(Math.max(1, currentPage - 1))
            } else {
              setPage((p) => Math.max(1, p - 1))
            }
          }}
          onNext={() => {
            if (serverPagination) {
              onServerPageChange?.(Math.min(totalPages, currentPage + 1))
            } else {
              setPage((p) => Math.min(totalPages, p + 1))
            }
          }}
        />
      </div>
    </div>
  )
}
