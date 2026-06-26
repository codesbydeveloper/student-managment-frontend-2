import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { registerAccount } from '../api/authRegister'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { Label } from '../components/ui/Label'
import { Select } from '../components/ui/Select'
import { useAuth } from '../context/AuthContext'
import { LOGIN_ROLE_OPTIONS, ROLE_LABELS, ROLES } from '../utils/constants'
import { email, minLength, required } from '../utils/validators'

export default function RegisterPage() {
  const { isAuthenticated, ready } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    role: ROLES.ADMIN,
    fullName: '',
    email: '',
    subject: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  if (ready && isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const eName = required(form.fullName, 'Full name')
    const eEmailReq = required(form.email, 'Email')
    const eEmailFmt = email(form.email)
    const ePass = required(form.password, 'Password') || minLength(form.password, 6, 'Password')
    const eConfirm =
      required(form.confirmPassword, 'Confirm password') ||
      (form.password !== form.confirmPassword ? 'Passwords do not match' : '')

    const eSubject = form.role === ROLES.TEACHER ? required(form.subject, 'Subject focus') : ''

    const next = {
      fullName: eName,
      email: eEmailReq || eEmailFmt,
      password: ePass,
      confirmPassword: eConfirm,
      subject: eSubject,
    }
    setErrors(next)
    if (eName || eEmailReq || eEmailFmt || ePass || eConfirm || eSubject) return

    setSubmitting(true)
    const res = await registerAccount(form)
    setSubmitting(false)

    if (!res.ok) {
      toast.error(res.error)
      return
    }

    toast.success('Account created — you can sign in now.')
    navigate('/login', {
      replace: false,
      state: {
        registeredEmail: form.email.trim().toLowerCase(),
      },
    })
  }

  const isTeacher = form.role === ROLES.TEACHER

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-semibold text-slate-900">Create account</h2>
      <p className="mt-1.5 text-sm text-slate-600">
        Create your school account, then sign in with the same email and password.
      </p>
      <form className="mt-6 space-y-5" onSubmit={onSubmit} noValidate>
        <div>
          <Label htmlFor="reg-role">I am registering as</Label>
          <Select
            id="reg-role"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            {LOGIN_ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="reg-name" required>Full name</Label>
          <Input
            id="reg-name"
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            error={errors.fullName}
          />
          {errors.fullName ? <p className="mt-1.5 text-xs font-medium text-red-600">{errors.fullName}</p> : null}
        </div>
        <div>
          <Label htmlFor="reg-email" required>Email</Label>
          <Input
            id="reg-email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            error={errors.email}
          />
          {errors.email ? <p className="mt-1.5 text-xs font-medium text-red-600">{errors.email}</p> : null}
        </div>
        {isTeacher ? (
          <div>
            <Label htmlFor="reg-subject" required>Subject focus</Label>
            <Input
              id="reg-subject"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              error={errors.subject}
              placeholder="e.g. Mathematics"
            />
            {errors.subject ? <p className="mt-1.5 text-xs font-medium text-red-600">{errors.subject}</p> : null}
          </div>
        ) : null}
        <div>
          <Label htmlFor="reg-password" required>Password</Label>
          <PasswordInput
            id="reg-password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            error={errors.password}
          />
          {errors.password ? <p className="mt-1.5 text-xs font-medium text-red-600">{errors.password}</p> : null}
          <p className="mt-1.5 text-xs text-slate-500">At least 6 characters (match your server rules).</p>
        </div>
        <div>
          <Label htmlFor="reg-confirm" required>Confirm password</Label>
          <PasswordInput
            id="reg-confirm"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            error={errors.confirmPassword}
          />
          {errors.confirmPassword ? (
            <p className="mt-1.5 text-xs font-medium text-red-600">{errors.confirmPassword}</p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-8 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-500"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
