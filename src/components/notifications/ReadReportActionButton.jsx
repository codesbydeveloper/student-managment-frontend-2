/**
 * Table action — opens parent read report for a notice.
 */
export function ReadReportActionButton({ disabled, onClick, className = '' }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-indigo-200 bg-gradient-to-b from-white to-indigo-50/80 px-3.5 py-2 text-xs font-semibold text-indigo-900 shadow-sm ring-1 ring-indigo-100/80 transition hover:border-indigo-300 hover:from-indigo-50 hover:to-indigo-100/90 hover:shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:pointer-events-none disabled:opacity-50 ${className}`}
    >
      <svg
        aria-hidden
        className="size-3.5 shrink-0 text-indigo-600"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
      Read report
    </button>
  )
}
