import { useEffect, useRef, useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { syncPageFromApi } from '../../utils/pagination'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PhoneInput } from '../../components/ui/PhoneInput'
import { isPhone10Digits, sanitizePhoneDigits } from '../../utils/phoneInput'
import { createLead, fetchMyLeads } from '../../api/leadsApi'
import { fetchClassesSummary } from '../../api/classesApi'
import { Label } from '../../components/ui/Label'
import { SearchableClassSelect } from '../../components/SearchableClassSelect'
import { LEAD_STAGE_LABELS } from '../../data/phase6Constants'
import { ROLES } from '../../utils/constants'
import { ListPagination } from '../../components/ui/ListPagination'

const MINE_PAGE_LIMIT = 10

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso))
  } catch {
    return '—'
  }
}

function classCell(lead) {
  if (lead.className) return lead.className
  if (lead.classId) return String(lead.classId)
  return '—'
}

/**
 * Self-serve lead intake for roles that cannot assign a teacher.
 * Admins and principals use `/leads` (full form including assignment).
 */
export default function CreateLeadPage() {
  const { token, user } = useAuth()
  const role = user?.role

  const [studentName, setStudentName] = useState('')
  const [parentName, setParentName] = useState('')
  const [phone, setPhone] = useState('')
  const [classId, setClassId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [classOpts, setClassOpts] = useState(null)
  const [classOptsError, setClassOptsError] = useState('')

  const [minePage, setMinePage] = useState(1)
  const [mineLeads, setMineLeads] = useState(null)
  const [mineTotal, setMineTotal] = useState(0)
  const [mineError, setMineError] = useState('')
  const mineAbortRef = useRef(null)
  const mineLoadGenRef = useRef(0)

  const loadClasses = useAsyncLoader(async () => {
    if (!token) {
      setClassOpts([])
      return
    }
    setClassOptsError('')
    const res = await fetchClassesSummary(token)
    if (!res.ok) {
      setClassOptsError(res.error || 'Could not load classes.')
      setClassOpts([])
      return
    }
    setClassOpts(res.options)
  }, [token])

  useEffect(() => {
    setMinePage(1)
    setMineLeads(null)
  }, [token])

  const loadMine = useAsyncLoader(async () => {
    if (!token) {
      setMineLeads([])
      setMineTotal(0)
      return
    }
    const p = Math.max(1, Number(minePage) || 1)
    const loadGen = ++mineLoadGenRef.current
    if (mineAbortRef.current) mineAbortRef.current.abort()
    const ctrl = new AbortController()
    mineAbortRef.current = ctrl
    setMineError('')
    const res = await fetchMyLeads(token, {
      page: p,
      limit: MINE_PAGE_LIMIT,
      signal: ctrl.signal,
    })
    if (loadGen !== mineLoadGenRef.current) return
    if (ctrl.signal.aborted || res.aborted) return
    if (!res.ok) {
      setMineError(res.error || 'Could not load your leads.')
      setMineLeads([])
      setMineTotal(0)
      return
    }
    setMineLeads(res.leads)
    setMineTotal(res.total)
    syncPageFromApi(setMinePage, res.page || p)
  }, [token, minePage])

  useEffect(
    () => () => {
      if (mineAbortRef.current) mineAbortRef.current.abort()
    },
    [],
  )

  const onSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (!studentName.trim() || !parentName.trim() || !phone.trim()) {
      toast.error('Student name, parent name, and phone are required.')
      return
    }
    if (!isPhone10Digits(phone)) {
      toast.error('Phone must be exactly 10 digits.')
      return
    }
    setSubmitting(true)
    try {
      const res = await createLead(token, {
        studentName: studentName.trim(),
        parentName: parentName.trim(),
        phone: sanitizePhoneDigits(phone),
        classId: classId || null,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Lead submitted. Staff can assign a teacher when ready.')
      setStudentName('')
      setParentName('')
      setPhone('')
      setClassId('')
      setMinePage(1)
      void loadMine()
    } finally {
      setSubmitting(false)
    }
  }

  const backTo =
    role === ROLES.PARENT
      ? '/dashboard'
      : role === ROLES.DRIVER
        ? '/driver/map'
        : '/dashboard'

  const totalMinePages = Math.max(1, Math.ceil(mineTotal / MINE_PAGE_LIMIT))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link to={backTo}>
          <Button type="button" size="sm" variant="secondary">
            {role === ROLES.PARENT ? 'Dashboard' : role === ROLES.DRIVER ? 'My trip' : 'Dashboard'}
          </Button>
        </Link>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            void loadMine()
          }}
        >
          Refresh history
        </Button>
      </div>

      <Card>
        <CardHeader
          title="Create lead"
          subtitle="Only admins and principals can assign a teacher. Your submission will be queued for assignment."
        />
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label variant="compact" htmlFor="create-lead-student" required>
              Student name
            </Label>
            <Input
              id="create-lead-student"
              className="mt-1"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div>
            <Label variant="compact" htmlFor="create-lead-parent" required>
              Parent / guardian
            </Label>
            <Input
              id="create-lead-parent"
              className="mt-1"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="sm:col-span-2">
            <Label variant="compact" htmlFor="create-lead-phone" required>
              Phone
            </Label>
            <PhoneInput
              id="create-lead-phone"
              className="mt-1"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div className="sm:col-span-2">
            <SearchableClassSelect
              id="create-lead-class"
              value={classId}
              onChange={setClassId}
              options={classOpts ?? []}
              loading={classOpts === null}
              disabled={submitting}
            />
            {classOptsError ? <p className="mt-1 text-xs text-amber-700">{classOptsError}</p> : null}
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Create lead'}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Leads history"
          subtitleCompact
          subtitle="Your submissions from this account. Read-only list."
        />
        {mineError ? (
          <p className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-center text-sm text-amber-950">
            {mineError}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200/90">
          <table className="app-data-table min-w-[720px] w-full border-collapse">
            <thead>
              <tr className="app-table-head">
                <th className="px-3 py-2.5">Student</th>
                <th className="px-3 py-2.5">Parent / guardian</th>
                <th className="px-3 py-2.5">Phone</th>
                <th className="px-3 py-2.5">Class</th>
                <th className="px-3 py-2.5">Assigned teacher</th>
                <th className="px-3 py-2.5">Stage</th>
                <th className="px-3 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody>
              {mineLeads === null ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-sm text-slate-600">
                    Loading…
                  </td>
                </tr>
              ) : mineLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <p className="text-sm font-medium text-slate-700">No leads yet.</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Create a lead above and it will appear in this table.
                    </p>
                  </td>
                </tr>
              ) : (
                mineLeads.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2.5 text-slate-800">{row.studentName || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-800">{row.parentName || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-800">{row.phone || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-800">{classCell(row)}</td>
                    <td className="px-3 py-2.5 text-slate-800">{row.assignedTeacherName || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-800">
                      {LEAD_STAGE_LABELS[row.stage] ?? row.stage ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{fmtDate(row.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {mineLeads !== null && mineTotal > 0 ? (
          <ListPagination
            className="mt-3 rounded-b-xl"
            page={minePage}
            total={mineTotal}
            pageSize={MINE_PAGE_LIMIT}
            onPrev={() => setMinePage((p) => Math.max(1, p - 1))}
            onNext={() => setMinePage((p) => Math.min(totalMinePages, p + 1))}
          />
        ) : null}
      </Card>
    </div>
  )
}
