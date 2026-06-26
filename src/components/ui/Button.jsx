const variants = {
  primary: 'sm-btn-primary border text-white',
  secondary:
    'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-400',
  ghost: 'border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'border border-red-700 bg-red-700 text-white hover:bg-red-800 hover:border-red-800',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-4 py-2 text-sm rounded-md',
  lg: 'px-5 py-2.5 text-sm rounded-md',
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sm-button-focus,#4338ca)] disabled:pointer-events-none disabled:opacity-50 ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
