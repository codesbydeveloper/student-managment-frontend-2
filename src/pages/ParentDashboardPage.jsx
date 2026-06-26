import { Navigate } from 'react-router-dom'

/** Legacy route — parent home is /dashboard (School overview). */
export default function ParentDashboardPage() {
  return <Navigate to="/dashboard" replace />
}
