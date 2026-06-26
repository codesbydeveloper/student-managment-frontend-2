import { Link } from 'react-router-dom'
import { ChildCard } from './ChildCard'
import { ParentRecentMessages } from './ParentRecentMessages'

/**
 * Parent-only home: welcome + child cards.
 * @param {{ parentName: string, childRows: { student: object, cls: object|null }[], childrenLoading?: boolean, childrenSubtitle?: string, myDriverRows?: object[], myDriverLoading?: boolean, myDriverError?: string }} props
 */
export function ParentDashboard({
  parentName,
  childRows,
  childrenLoading = false,
  childrenSubtitle,
  myDriverRows = [],
  myDriverLoading = false,
  myDriverError = '',
}) {
  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border border-teal-400/25 bg-gradient-to-br from-teal-800 via-cyan-900 to-indigo-950 p-6 text-white shadow-xl shadow-teal-950/35 sm:rounded-3xl sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200/95">Family</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Welcome, {parentName}</h1>
          <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-teal-50/95">
            Latest school messages appear below. View your children and other family tools on this page.
          </p>
        </div>
      </div>

      <ParentRecentMessages />

      <div>
        <h2 className="text-lg font-bold text-slate-900">Your children</h2>
        <p className="mt-1 text-sm text-slate-600">
          {childrenSubtitle ||
            'Names and classes come from your school. Section shows when the school provides it.'}
        </p>
        {childrenLoading && childRows.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            Loading your children…
          </p>
        ) : null}
        {!childrenLoading && childRows.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm font-medium text-amber-950">
            No linked students yet. Ask your school admin to connect your account to your children in Parents.
          </p>
        ) : null}
        {childRows.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {childRows.map(({ student, cls }) => (
              <ChildCard
                key={student.id}
                studentName={student.fullName}
                className={cls?.name}
                section={cls?.section}
                relationship={student.relationshipToChild}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div>
        <h2 className="text-lg font-bold text-slate-900">Your child’s bus driver</h2>
        {/* <p className="mt-1 text-sm text-slate-600">
          From your school (GET /api/parents/my-driver). This is who is assigned to transport for your linked
          students when your school enables it.
        </p> */}
        {myDriverLoading ? (
          <p className="mt-4 rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            Loading driver details…
          </p>
        ) : null}
        {!myDriverLoading && myDriverError ? (
          <p className="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
            {myDriverError}
          </p>
        ) : null}
        {!myDriverLoading && !myDriverError && myDriverRows.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            No bus driver is linked yet, or your school has not published this information. You can still open{' '}
            <Link to="/parent-bus" className="font-semibold text-indigo-700 underline decoration-indigo-300/80">
              Bus tracking
            </Link>{' '}
            when a route is active.
          </p>
        ) : null}
        {!myDriverLoading && myDriverRows.length > 0 ? (
          <ul className="mt-5 space-y-3">
            {myDriverRows.map((row, idx) => (
              <li
                key={`${row.studentId || idx}-${row.driverUserId || row.driverName}-${row.assignedBus}`}
                className="rounded-2xl border border-indigo-200/60 bg-indigo-50/40 px-4 py-4 sm:px-5"
              >
                {row.studentName ? (
                  <p className="text-xs font-bold uppercase tracking-wide text-indigo-600/90">
                    For {row.studentName}
                  </p>
                ) : null}
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Driver</p>
                    <p className="mt-0.5 font-semibold text-slate-900">{row.driverName}</p>
                    {row.driverUserId ? (
                      <p className="mt-1 font-mono text-xs text-slate-500">Account id {row.driverUserId}</p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Vehicle / bus id</p>
                    <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">{row.assignedBus}</p>
                    {row.phone ? <p className="mt-1 text-sm text-slate-600">{row.phone}</p> : null}
                    {row.licenseNumber ? (
                      <p className="mt-1 text-xs text-slate-500">License {row.licenseNumber}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {myDriverRows.length > 0 ? (
          <div className="mt-4">
            <Link
              to="/parent-bus"
              className="inline-flex items-center justify-center rounded-xl border border-indigo-200/90 bg-white px-5 py-2.5 text-sm font-bold text-indigo-900 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
            >
              Open live bus tracking
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}
