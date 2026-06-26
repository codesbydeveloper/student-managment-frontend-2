import { useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { fetchSmtpSettings, testSmtpSettings, updateSmtpSettings } from '../../api/settingsApi'
import { SettingsNav } from '../../components/settings/SettingsNav'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { Label } from '../../components/ui/Label'

export default function SmtpSettingsPage() {
  const { token } = useAuth()
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpFrom, setSmtpFrom] = useState('')
  const [smtpPass, setSmtpPass] = useState('')
  const [hasPassword, setHasPassword] = useState(false)
  const [testToEmail, setTestToEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [loadError, setLoadError] = useState('')

  const load = useAsyncLoader(async () => {
    if (!token) {
      setLoading(false)
      setLoadError('Sign in to manage SMTP settings.')
      return
    }
    setLoading(true)
    setLoadError('')
    const res = await fetchSmtpSettings(token)
    setLoading(false)
    if (!res.ok) {
      setLoadError(res.error || 'Could not load SMTP settings.')
      return
    }
    const s = res.settings
    const loadedUser = s?.smtpUser ?? ''
    setSmtpUser(loadedUser)
    setSmtpFrom(s?.smtpFrom ?? '')
    setHasPassword(Boolean(s?.hasPassword))
    setSmtpPass('')
    setTestToEmail((prev) => prev.trim() || loadedUser)
  }, [token])

  const onSave = async () => {
    if (!token) {
      toast.error('Sign in to save SMTP settings.')
      return
    }
    const user = smtpUser.trim()
    const from = smtpFrom.trim()
    if (!user) {
      toast.error('SMTP user (email) is required.')
      return
    }
    if (!from) {
      toast.error('From address is required.')
      return
    }
    if (!hasPassword && !smtpPass.trim()) {
      toast.error('SMTP password is required for a new configuration.')
      return
    }

    setSaving(true)
    const res = await updateSmtpSettings(token, {
      smtpUser: user,
      smtpFrom: from,
      smtpPass: smtpPass.trim() || undefined,
    })
    setSaving(false)

    if (!res.ok) {
      toast.error(res.error || 'Could not save SMTP settings.')
      return
    }

    setSmtpPass('')
    if (res.settings) {
      setSmtpUser(res.settings.smtpUser ?? user)
      setSmtpFrom(res.settings.smtpFrom ?? from)
      setHasPassword(Boolean(res.settings.hasPassword) || Boolean(smtpPass.trim()))
    } else {
      setHasPassword(true)
    }
    toast.success('SMTP settings saved.')
  }

  const onSendTest = async () => {
    if (!token) {
      toast.error('Sign in to send a test email.')
      return
    }
    const to = testToEmail.trim()
    if (!to) {
      toast.error('Enter the email address to test.')
      return
    }

    setTesting(true)
    const res = await testSmtpSettings(token, to)
    setTesting(false)

    if (!res.ok) {
      toast.error(res.error || 'Test email could not be sent.')
      return
    }
    toast.success(res.message || `Test email sent to ${to}.`)
  }

  return (
    <div className="space-y-6">
      <SettingsNav active="smtp" />

      <Card>
        <CardHeader
          title="Email (SMTP)"
          
        />

        {loading ? (
          <p className="text-sm text-slate-600">Loading SMTP settings…</p>
        ) : null}

        {!loading && loadError ? (
          <p className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            {loadError}
          </p>
        ) : null}

        {!loading ? (
          <div className="space-y-5">
            <div>
              <Label variant="compact" htmlFor="smtp-user" required>
                SMTP user (email)
              </Label>
              <Input
                id="smtp-user"
                type="email"
                autoComplete="username"
                className="mt-1"
                placeholder="notifications@yourschool.edu"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
              />
            </div>

            <div>
              <Label variant="compact" htmlFor="smtp-from" required>
                From address
              </Label>
              <Input
                id="smtp-from"
                type="email"
                autoComplete="email"
                className="mt-1"
                placeholder="School Name <notifications@yourschool.edu>"
                value={smtpFrom}
                onChange={(e) => setSmtpFrom(e.target.value)}
              />
            </div>

            <div>
              <Label variant="compact" htmlFor="smtp-pass" required={!hasPassword}>
                SMTP password
              </Label>
              <PasswordInput
                id="smtp-pass"
                autoComplete="new-password"
                className="mt-1"
                placeholder={hasPassword ? 'Leave blank to keep current password' : 'App password or SMTP password'}
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
              />
              {hasPassword ? (
                <p className="mt-1.5 text-xs text-slate-500">A password is already stored on the server.</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={saving} onClick={() => void onSave()}>
                {saving ? 'Saving…' : 'Save SMTP settings'}
              </Button>
              <Button type="button" variant="secondary" disabled={loading || saving} onClick={() => void load()}>
                Reload
              </Button>
              <Link to="/dashboard">
                <Button type="button" variant="secondary">
                  Dashboard
                </Button>
              </Link>
            </div>

            <div className="border-t border-slate-200/90 pt-6">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Test delivery</p>
            
              <div className="mt-3">
                <Label variant="compact" htmlFor="smtp-test-to" required>
                  Send test to
                </Label>
                <div className="mt-1 flex flex-wrap items-center gap-2 sm:max-w-xl">
                  <Input
                    id="smtp-test-to"
                    type="email"
                    autoComplete="email"
                    className="min-w-[12rem] flex-1"
                    placeholder="you@example.com"
                    value={testToEmail}
                    onChange={(e) => setTestToEmail(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loading || saving || testing}
                    onClick={() => void onSendTest()}
                  >
                    {testing ? 'Sending…' : 'Send test email'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
