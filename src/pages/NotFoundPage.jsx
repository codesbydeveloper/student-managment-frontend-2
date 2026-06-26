import { Link } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="pointer-events-none absolute left-1/4 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-600/30 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-64 w-64 translate-x-1/2 rounded-full bg-violet-600/25 blur-[90px]" />
      <Card className="max-w-md text-center shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-indigo-600">404</p>
        <h1 className="mt-3 bg-gradient-to-r from-slate-900 to-indigo-900 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
          Page not found
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          This address is not available. Check the URL or return to your workspace.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/login">
            <Button variant="secondary">Sign in</Button>
          </Link>
          <Link to="/dashboard">
            <Button>Dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
