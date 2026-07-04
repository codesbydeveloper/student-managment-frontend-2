import { Link } from 'react-router-dom'
import { SettingsNav } from '../../components/settings/SettingsNav'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'

export default function SettingsHubPage() {
  return (
    <div className="space-y-6">
      <SettingsNav active="hub" />

      <Card>
        <CardHeader title="Institution settings" subtitle="Admin and principal only." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/settings/site-branding"
            className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50 p-5 shadow-md shadow-slate-900/[0.04] transition hover:border-indigo-300 hover:from-indigo-50/80 hover:to-violet-50/50"
          >
            <p className="text-lg font-bold text-slate-900">Site identity</p>
            <p className="mt-2 text-sm text-slate-600">
              App name in the sidebar and header, plus the browser tab favicon.
            </p>
            <span className="mt-4 inline-block text-sm font-bold text-indigo-700">Open →</span>
          </Link>

          <Link
            to="/settings/login-branding"
            className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50 p-5 shadow-md shadow-slate-900/[0.04] transition hover:border-indigo-300 hover:from-indigo-50/80 hover:to-violet-50/50"
          >
            <p className="text-lg font-bold text-slate-900">Login appearance</p>
            <p className="mt-2 text-sm text-slate-600">Logo, title, and subtitle on the sign-in page.</p>
            <span className="mt-4 inline-block text-sm font-bold text-indigo-700">Open →</span>
          </Link>

          <Link
            to="/settings/smtp"
            className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50 p-5 shadow-md shadow-slate-900/[0.04] transition hover:border-indigo-300 hover:from-indigo-50/80 hover:to-violet-50/50"
          >
            <p className="text-lg font-bold text-slate-900">Email (SMTP)</p>
            <p className="mt-2 text-sm text-slate-600">SMTP user, password, and from address for outgoing mail.</p>
            <span className="mt-4 inline-block text-sm font-bold text-indigo-700">Open →</span>
          </Link>

          <Link
            to="/settings/background"
            className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50 p-5 shadow-md shadow-slate-900/[0.04] transition hover:border-indigo-300 hover:from-indigo-50/80 hover:to-violet-50/50"
          >
            <p className="text-lg font-bold text-slate-900">Background appearance</p>
            <p className="mt-2 text-sm text-slate-600">
              Sidebar and main content colors or images, with opacity control.
            </p>
            <span className="mt-4 inline-block text-sm font-bold text-indigo-700">Open →</span>
          </Link>

          <Link
            to="/settings/sidebar-menu"
            className="rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50 p-5 shadow-md shadow-slate-900/[0.04] transition hover:border-indigo-300 hover:from-indigo-50/80 hover:to-violet-50/50"
          >
            <p className="text-lg font-bold text-slate-900">Sidebar menu appearance</p>
            <p className="mt-2 text-sm text-slate-600">
              Menu labels, icons, icon sizes, and text colors for default, hover, and active states.
            </p>
            <span className="mt-4 inline-block text-sm font-bold text-indigo-700">Open →</span>
          </Link>
        </div>

        <div className="mt-6">
          <Link to="/dashboard">
            <Button type="button" variant="secondary" size="sm">
              Back to dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
