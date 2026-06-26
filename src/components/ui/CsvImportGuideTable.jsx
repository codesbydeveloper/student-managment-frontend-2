/**
 * Import CSV modal — shows exact column names users must put in the file.
 */

function ExampleRoomCell({ value }) {
  const rooms = String(value ?? '')
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (!rooms.length) return <span className="text-slate-400">—</span>

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {rooms.map((room) => (
        <span
          key={room}
          className="inline-flex shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-950 ring-1 ring-amber-200/90"
        >
          ({room})
        </span>
      ))}
    </span>
  )
}

export function CsvImportGuideTable({
  headers,
  requiredHeaders = [],
  exampleRow,
  sampleHref,
  roomPillHeaders = [],
  footnote,
}) {
  const required = new Set(requiredHeaders)
  const roomPills = new Set(roomPillHeaders)

  return (
    <div className="min-w-0 max-w-full rounded-xl border border-slate-200/80 bg-slate-50/60 px-3 py-3.5 sm:px-4">
      <p className="text-sm font-semibold text-slate-900">Your CSV must use these exact column names</p>
      {footnote ? <p className="mt-1 text-xs leading-relaxed text-slate-600">{footnote}</p> : null}

      <div className="mt-3 max-w-full overflow-x-auto rounded-xl border border-slate-200/90 bg-white">
        <table className="w-max min-w-full border-collapse text-xs app-data-table">
          <thead>
            <tr className="bg-indigo-50/90">
              {headers.map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap border-b border-indigo-100 px-3 py-2.5 text-center align-middle text-xs font-semibold text-slate-800"
                >
                  <span className="inline-flex items-center gap-0.5">
                    <span>{h}</span>
                    {required.has(h) ? (
                      <span className="text-rose-500" title="Required">
                        *
                      </span>
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              {headers.map((h, i) => {
                const cell = String(exampleRow[i] ?? '').trim()
                const isRoom = roomPills.has(h)
                const isEmpty = !cell

                return (
                  <td
                    key={h}
                    className={`border-b border-slate-100 px-3 py-3 text-center align-middle text-slate-800 ${
                      h === 'Email' ? 'max-w-[11rem]' : 'whitespace-nowrap'
                    }`}
                  >
                    {isRoom && !isEmpty ? (
                      <ExampleRoomCell value={cell} />
                    ) : (
                      <span
                        className={`${h === 'Email' ? 'block truncate' : ''} ${isEmpty ? 'text-slate-400' : ''}`}
                        title={cell || undefined}
                      >
                        {isEmpty ? '—' : cell}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {sampleHref ? (
        <p className="mt-2.5">
          <a
            href={sampleHref}
            download
            className="text-xs font-semibold text-indigo-600 underline-offset-2 hover:text-indigo-800 hover:underline"
          >
            Download sample CSV
          </a>
        </p>
      ) : null}
    </div>
  )
}
