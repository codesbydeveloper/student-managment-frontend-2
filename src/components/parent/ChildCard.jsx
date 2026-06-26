/**
 * Summary card for one child on the parent dashboard.
 * @param {{ studentName: string, className?: string, section?: string, relationship?: string }} props
 */
export function ChildCard({ studentName, className, section, relationship }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-teal-100/90 bg-gradient-to-br from-white via-white to-teal-50/40 p-5 shadow-md shadow-teal-900/[0.06] ring-1 ring-inset ring-teal-100/60">
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-teal-400/15 blur-2xl" />
      <p className="text-xs font-bold uppercase tracking-wider text-teal-700">Child</p>
      <p className="mt-2 text-lg font-bold tracking-tight text-slate-900">{studentName}</p>
      {relationship ? (
        <p className="mt-1 text-xs font-medium capitalize text-slate-500">Relationship: {relationship}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
        {className ? (
          <span className="rounded-lg bg-slate-100/90 px-2.5 py-1 font-medium text-slate-800">{className}</span>
        ) : (
          <span className="rounded-lg bg-slate-100/90 px-2.5 py-1 font-medium text-slate-500">Class —</span>
        )}
        {section ? (
          <span className="rounded-lg bg-teal-50 px-2.5 py-1 font-medium text-teal-900 ring-1 ring-teal-200/60">
            Section {section}
          </span>
        ) : null}
      </div>
    </div>
  )
}
