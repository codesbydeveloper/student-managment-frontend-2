/**
 * Sidebar / compact institution logo from login appearance (image or letter).
 * @param {{ branding: { logoImage?: string, logoLetter?: string }, size?: 'md' | 'sm' }} props
 */
export function InstitutionBrandMark({ branding, size = 'md' }) {
  const box =
    size === 'sm'
      ? 'h-9 w-9 rounded-lg text-xs'
      : 'h-11 w-11 rounded-xl text-sm shadow-lg shadow-indigo-500/30'

  if (branding?.logoImage) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden bg-white/95 p-1 ring-1 ring-white/10 ${box}`}
      >
        <img
          src={branding.logoImage}
          alt=""
          className="max-h-full max-w-full object-contain"
          decoding="async"
        />
      </div>
    )
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 font-bold text-white ${box}`}
    >
      {branding?.logoLetter || 'S'}
    </div>
  )
}
