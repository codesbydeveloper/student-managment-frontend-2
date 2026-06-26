const VARIANT_CLASS = {
  default: 'mb-1.5 block text-sm font-medium text-slate-700',
  compact: 'block text-xs font-bold uppercase tracking-wide text-slate-500',
}

/** Red asterisk for required form fields. */
export function RequiredMark({ className = '' }) {
  return (
    <span className={`ml-0.5 font-normal text-red-500 ${className}`} title="Required" aria-hidden="true">
      *
    </span>
  )
}

export function Label({ children, htmlFor, className = '', required = false, variant = 'default' }) {
  return (
    <label
      htmlFor={htmlFor}
      className={`${VARIANT_CLASS[variant] ?? VARIANT_CLASS.default} ${className}`}
    >
      {children}
      {required ? <RequiredMark /> : null}
    </label>
  )
}
