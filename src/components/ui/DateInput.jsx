import { useRef } from 'react'
import { TbCalendar } from 'react-icons/tb'

/**
 * Date field with a visible calendar button (native picker icon is inconsistent across browsers).
 */
export function DateInput({ className = '', error, id, ...rest }) {
  const inputRef = useRef(null)

  const openPicker = () => {
    const el = inputRef.current
    if (!el || rest.disabled) return
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker()
        return
      } catch {
        /* fall through */
      }
    }
    el.focus()
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="date"
        className={`date-input w-full min-h-11 rounded-xl border bg-white px-3.5 py-2.5 pr-11 text-sm text-slate-900 shadow-inner shadow-slate-900/[0.03] transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 ${
          error ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-200/90'
        } ${className}`}
        {...rest}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open calendar"
        disabled={rest.disabled}
        onClick={openPicker}
        className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-indigo-700 disabled:pointer-events-none disabled:opacity-40"
      >
        <TbCalendar className="size-5 shrink-0" aria-hidden />
      </button>
    </div>
  )
}
