import { useRef } from 'react'
import { TbCalendar } from 'react-icons/tb'

/**
 * datetime-local with a visible calendar control (native picker icon is inconsistent across browsers).
 */
export function DateTimeInput({ className = '', error, id, ...rest }) {
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
        type="datetime-local"
        className={`datetime-input w-full rounded-md border bg-white py-2 pl-3 pr-10 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
          error ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-200/90'
        } ${className}`}
        {...rest}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Open date and time picker"
        disabled={rest.disabled}
        onClick={openPicker}
        className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-indigo-700 disabled:pointer-events-none disabled:opacity-40"
      >
        <TbCalendar className="size-5 shrink-0" aria-hidden />
      </button>
    </div>
  )
}
