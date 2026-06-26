export function Input({ className = '', error, id, ...rest }) {
  return (
    <input
      id={id}
      className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
        error ? 'border-red-400 ring-1 ring-red-200' : 'border-slate-200/90'
      } ${className}`}
      {...rest}
    />
  )
}
