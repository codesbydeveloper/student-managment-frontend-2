import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { Modal } from '../components/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { Label } from '../components/ui/Label'
import {
  requestForgotPassword,
  verifyForgotPasswordOtp,
  resetForgottenPassword,
} from '../api/authForgotPassword'
import { email, minLength, required } from '../utils/validators'
import { useLoginBranding } from '../hooks/useLoginBranding'
import { resolvePostLoginPath } from '../utils/postLoginPath'

function initialLoginForm(locationState) {
  const regEmail = locationState?.registeredEmail
  const emailVal =
    typeof regEmail === 'string' && regEmail.trim() ? regEmail.trim().toLowerCase() : ''
  return { email: emailVal, password: '' }
}

export default function LoginPage() {
  const branding = useLoginBranding()
  const { login, isAuthenticated, ready, user } = useAuth()
  const signInButtonStyle = branding.buttonColor
    ? {
        backgroundColor: branding.buttonColor,
        borderColor: branding.buttonColor,
      }
    : undefined
  const navigate = useNavigate()
  const location = useLocation()
  const fromPath = location.state?.from?.pathname

  const [form, setForm] = useState(() => initialLoginForm(location.state))
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const [forgotOpen, setForgotOpen] = useState(false)
  /** @type {'email' | 'verify' | 'reset'} */
  const [forgotStep, setForgotStep] = useState('email')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotOtp, setForgotOtp] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('')
  const [forgotErrors, setForgotErrors] = useState({})
  const [forgotSending, setForgotSending] = useState(false)

  const openForgotModal = () => {
    setForgotEmail(form.email.trim())
    setForgotStep('email')
    setForgotOtp('')
    setForgotNewPassword('')
    setForgotConfirmPassword('')
    setForgotErrors({})
    setForgotOpen(true)
  }

  const closeForgotModal = () => {
    setForgotOpen(false)
    setForgotStep('email')
    setForgotEmail('')
    setForgotOtp('')
    setForgotNewPassword('')
    setForgotConfirmPassword('')
    setForgotErrors({})
    setForgotSending(false)
  }

  const goBackForgotStep = () => {
    if (forgotStep === 'reset') {
      setForgotStep('verify')
      setForgotNewPassword('')
      setForgotConfirmPassword('')
      setForgotErrors({})
      return
    }
    if (forgotStep === 'verify') {
      setForgotStep('email')
      setForgotOtp('')
      setForgotErrors({})
    }
  }

  const onForgotOtpInput = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4)
    setForgotOtp(raw)
  }

  const onForgotSubmit = async (e) => {
    e.preventDefault()
    if (forgotStep === 'email') {
      const e1 = required(forgotEmail, 'Email')
      const e2 = email(forgotEmail)
      const next = { email: e1 || e2 }
      setForgotErrors(next)
      if (e1 || e2) return

      setForgotSending(true)
      try {
        const res = await requestForgotPassword(forgotEmail)
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        const serverMsg =
          res.data && typeof res.data === 'object' && typeof res.data.message === 'string'
            ? res.data.message.trim()
            : ''
        toast.success(
          serverMsg ||
            'If that email is registered, check your inbox for a 4-digit code. Enter it on the next step.',
        )
        setForgotStep('verify')
        setForgotOtp('')
        setForgotNewPassword('')
        setForgotConfirmPassword('')
        setForgotErrors({})
      } finally {
        setForgotSending(false)
      }
      return
    }

    if (forgotStep === 'verify') {
      const eOtp = required(forgotOtp, 'Code')
      const eOtpFmt =
        !eOtp && !/^\d{4}$/.test(forgotOtp.trim()) ? 'Enter the 4-digit code from your email' : ''
      const next = { otp: eOtp || eOtpFmt }
      setForgotErrors(next)
      if (next.otp) return

      setForgotSending(true)
      try {
        const res = await verifyForgotPasswordOtp(forgotEmail, forgotOtp.trim())
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        toast.success('Code verified. Choose a new password.')
        setForgotStep('reset')
        setForgotNewPassword('')
        setForgotConfirmPassword('')
        setForgotErrors({})
      } finally {
        setForgotSending(false)
      }
      return
    }

    const ePass = required(forgotNewPassword, 'New password') || minLength(forgotNewPassword, 6, 'New password')
    const eConfirm =
      required(forgotConfirmPassword, 'Confirm password') ||
      (forgotNewPassword !== forgotConfirmPassword ? 'Passwords do not match' : '')
    const next = { newPassword: ePass, confirmPassword: eConfirm }
    setForgotErrors(next)
    if (next.newPassword || next.confirmPassword) return

    setForgotSending(true)
    try {
      const res = await resetForgottenPassword(forgotEmail, forgotNewPassword)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Password updated. Sign in with your new password.')
      closeForgotModal()
    } finally {
      setForgotSending(false)
    }
  }

  if (ready && isAuthenticated) {
    return <Navigate to={resolvePostLoginPath(fromPath, user?.role, user?.menuAccess)} replace />
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const e1 = required(form.email, 'Email')
    const e2 = email(form.email)
    const e3 = required(form.password, 'Password')
    const next = { email: e1 || e2, password: e3 }
    setErrors(next)
    if (e1 || e2 || e3) return

    setSubmitting(true)
    try {
      const res = await login(form.email, form.password)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Welcome back — redirecting to your workspace.')
      navigate(resolvePostLoginPath(fromPath, res.user?.role, res.user?.menuAccess), { replace: true })
    } catch {
      toast.error('Sign in failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:p-8">
      <h2 className="text-lg font-semibold text-slate-900">Sign in</h2>
      <p className="mt-1 text-sm text-slate-600 max-h-[640px]:text-xs">
        Use the email and password for your school account.
      </p>
      <form className="mt-4 space-y-4 sm:mt-6 sm:space-y-5" onSubmit={onSubmit} noValidate>
        <div>
          <Label htmlFor="email" required>Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            error={errors.email}
          />
          {errors.email ? <p className="mt-1.5 text-xs font-medium text-red-600">{errors.email}</p> : null}
        </div>
        <div>
          <Label htmlFor="password" required>Password</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            error={errors.password}
          />
          {errors.password ? (
            <p className="mt-1.5 text-xs font-medium text-red-600">{errors.password}</p>
          ) : null}
          <p className="mt-1.5 text-right text-sm">
            <button
              type="button"
              className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2"
              onClick={openForgotModal}
            >
              Forgot password?
            </button>
          </p>
        </div>
        <Button type="submit" className="w-full" style={signInButtonStyle} disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <Modal
        open={forgotOpen}
        title={
          forgotStep === 'email' ? 'Forgot password' : forgotStep === 'verify' ? 'Enter code' : 'New password'
        }
        onClose={closeForgotModal}
        size="sm"
        footer={
          <>
            {forgotStep !== 'email' ? (
              <Button type="button" variant="secondary" onClick={goBackForgotStep}>
                Back
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={closeForgotModal}>
              Cancel
            </Button>
            <Button type="submit" form="forgot-password-form" disabled={forgotSending}>
              {forgotStep === 'email'
                ? forgotSending
                  ? 'Sending…'
                  : 'Send code'
                : forgotStep === 'verify'
                  ? forgotSending
                    ? 'Checking…'
                    : 'Verify code'
                  : forgotSending
                    ? 'Saving…'
                    : 'Set new password'}
            </Button>
          </>
        }
      >
        <form id="forgot-password-form" className="space-y-4" onSubmit={onForgotSubmit} noValidate>
          {forgotStep === 'email' ? (
            <>
              <p className="text-sm leading-relaxed text-slate-600">
                Enter your account email. If it is valid, we will send a 4-digit code to that inbox (same message
                whether or not the account exists).
              </p>
              <div>
                <Label htmlFor="forgot-email" required>Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  className="mt-1.5"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  error={forgotErrors.email}
                />
                {forgotErrors.email ? (
                  <p className="mt-1.5 text-xs font-medium text-red-600">{forgotErrors.email}</p>
                ) : null}
              </div>
            </>
          ) : forgotStep === 'verify' ? (
            <>
              <p className="text-sm leading-relaxed text-slate-600">
                Enter the 4-digit code from your email. After it is verified, you will set a new password.
              </p>
              <div>
                <Label htmlFor="forgot-email-readonly">Email</Label>
                <Input
                  id="forgot-email-readonly"
                  type="email"
                  className="mt-1.5 bg-slate-50 text-slate-600"
                  value={forgotEmail}
                  readOnly
                  disabled={forgotSending}
                />
              </div>
              <div>
                <Label htmlFor="forgot-otp" required>4-digit code</Label>
                <Input
                  id="forgot-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  placeholder="0000"
                  className="mt-1.5 font-mono tracking-widest"
                  value={forgotOtp}
                  onChange={onForgotOtpInput}
                  error={forgotErrors.otp}
                />
                {forgotErrors.otp ? (
                  <p className="mt-1.5 text-xs font-medium text-red-600">{forgotErrors.otp}</p>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-slate-600">
                Choose a new password (at least 6 characters), then sign in with it.
              </p>
              <div>
                <Label htmlFor="forgot-email-readonly-reset">Email</Label>
                <Input
                  id="forgot-email-readonly-reset"
                  type="email"
                  className="mt-1.5 bg-slate-50 text-slate-600"
                  value={forgotEmail}
                  readOnly
                  disabled={forgotSending}
                />
              </div>
              <div>
                <Label htmlFor="forgot-new-password" required>New password</Label>
                <PasswordInput
                  id="forgot-new-password"
                  autoComplete="new-password"
                  className="mt-1.5"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  error={forgotErrors.newPassword}
                />
                {forgotErrors.newPassword ? (
                  <p className="mt-1.5 text-xs font-medium text-red-600">{forgotErrors.newPassword}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="forgot-confirm-password" required>Confirm new password</Label>
                <PasswordInput
                  id="forgot-confirm-password"
                  autoComplete="new-password"
                  className="mt-1.5"
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotConfirmPassword(e.target.value)}
                  error={forgotErrors.confirmPassword}
                />
                {forgotErrors.confirmPassword ? (
                  <p className="mt-1.5 text-xs font-medium text-red-600">{forgotErrors.confirmPassword}</p>
                ) : null}
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  )
}

