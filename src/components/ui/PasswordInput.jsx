import { useState } from 'react'
import { Input } from './Input'

function EyeIcon({ className = 'h-4 w-4', open }) {
  if (open) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.58 10.58a2 2 0 002.83 2.83M9.88 5.09A10.94 10.94 0 0112 5c5.52 0 10 4.48 10 7a11.28 11.28 0 01-2.16 2.73M6.12 6.12A10.94 10.94 0 002 12c0 2.52 4.48 7 10 7 1.55 0 3-.35 4.24-.94"
        />
      </svg>
    )
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Password field with show/hide toggle. */
export function PasswordInput({ className = '', error, id, ...rest }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        error={error}
        className={`pr-10 ${className}`.trim()}
        {...rest}
      />
      <button
        type="button"
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        <EyeIcon open={visible} />
      </button>
    </div>
  )
}
