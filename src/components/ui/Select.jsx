export function Select({ className = '', error, id, children, ...rest }) {
  return (
    <select
      id={id}
      className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
        error ? 'border-red-400' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </select>
  )
}
