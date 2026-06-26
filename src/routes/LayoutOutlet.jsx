import { Outlet, useLocation } from 'react-router-dom'

/** Remount page content when the URL changes (prevents stale screen after sidebar click). */
export function LayoutOutlet() {
  const location = useLocation()
  return <Outlet key={location.pathname} />
}
