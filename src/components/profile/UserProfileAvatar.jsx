import { Link } from 'react-router-dom'

/**
 * Header / profile avatar — photo or initial letter.
 * @param {{ displayName: string, profileImage?: string, size?: 'md' | 'lg', linkToProfile?: boolean, onPhotoClick?: () => void, className?: string }} props
 */
export function UserProfileAvatar({
  displayName,
  profileImage = '',
  size = 'md',
  linkToProfile = true,
  onPhotoClick,
  className = '',
}) {
  const letter = (displayName || '?').charAt(0).toUpperCase()
  const box =
    size === 'lg'
      ? 'h-24 w-24 rounded-2xl text-2xl shadow-lg'
      : 'h-11 w-11 rounded-2xl text-sm font-bold shadow-md shadow-indigo-500/25'

  const inner = profileImage ? (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-white ring-2 ring-white ${box} ${className}`}
    >
      <img src={profileImage} alt="" className="h-full w-full object-cover" decoding="async" />
    </span>
  ) : (
    <span
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 text-white ${box} ${className}`}
    >
      {letter}
    </span>
  )

  if (profileImage && onPhotoClick) {
    return (
      <button
        type="button"
        onClick={onPhotoClick}
        title="View full photo"
        aria-label="View profile photo full size"
        className={`cursor-pointer rounded-2xl transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${className}`}
      >
        {inner}
      </button>
    )
  }

  if (!linkToProfile) return inner

  return (
    <Link
      to="/profile"
      title="Edit profile"
      aria-label="Edit profile"
      className="rounded-2xl transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
    >
      {inner}
    </Link>
  )
}
