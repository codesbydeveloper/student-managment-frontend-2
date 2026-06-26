import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PhoneInput } from '../../components/ui/PhoneInput'
import { isPhone10Digits, sanitizePhoneDigits } from '../../utils/phoneInput'
import { Label } from '../../components/ui/Label'
import { SearchableClassSelect } from '../../components/SearchableClassSelect'
import { SearchableStageFilterSelect } from '../../components/SearchableStageSelect'
import { SearchableTeacherSelect } from '../../components/SearchableTeacherSelect'
import { LEAD_STAGE_LABELS } from '../../data/phase6Constants'
import { createLead, fetchLeads } from '../../api/leadsApi'
import { fetchClassesSummary } from '../../api/classesApi'
import { fetchTeachersPicker } from '../../api/teachersApi'
import { ListPagination } from '../../components/ui/ListPagination'
import { syncPageFromApi } from '../../utils/pagination'

const PAGE_LIMIT = 10

export default function AdminLeadsPage() {
  const { token } = useAuth()

  const [leads, setLeads] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [listError, setListError] = useState('')
  const [q, setQ] = useState('')
  const [stageFilter, setStageFilter] = useState('')

  const [studentName, setStudentName] = useState('')
  const [parentName, setParentName] = useState('')
  const [phone, setPhone] = useState('')
  const [assignId, setAssignId] = useState('')
  const [classId, setClassId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  /** Teacher options from `/api/teachers/picker`. null while loading. */
  const [teacherOpts, setTeacherOpts] = useState(null)
  const [teacherOptsError, setTeacherOptsError] = useState('')

  /** Class options from `/api/classes/summary`. null while loading. */
  const [classOpts, setClassOpts] = useState(null)
  const [classOptsError, setClassOptsError] = useState('')

  const abortRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function loadTeachers() {
      if (!token) {
        setTeacherOpts([])
        return
      }
      setTeacherOptsError('')
      const res = await fetchTeachersPicker(token)
      if (cancelled) return
      if (!res.ok) {
        setTeacherOptsError(res.error || 'Could not load teachers.')
        setTeacherOpts([])
        return
      }
      setTeacherOpts(res.options)
    }
    void loadTeachers()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    let cancelled = false
    async function loadClasses() {
      if (!token) {
        setClassOpts([])
        return
      }
      setClassOptsError('')
      const res = await fetchClassesSummary(token)
      if (cancelled) return
      if (!res.ok) {
        setClassOptsError(res.error || 'Could not load classes.')
        setClassOpts([])
        return
      }
      setClassOpts(res.options)
    }
    void loadClasses()
    return () => {
      cancelled = true
    }
  }, [token])

  const load = useCallback(
    async (nextPage, query, stage) => {
      if (!token) {
        setLeads([])
        return
      }
      if (abortRef.current) abortRef.current.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setListError('')
      const res = await fetchLeads(token, {
        q: query,
        stage,
        page: nextPage,
        limit: PAGE_LIMIT,
        signal: ctrl.signal,
      })
      if (abortRef.current !== ctrl) return
      if (res.aborted) return
      if (!res.ok) {
        setListError(res.error || 'Could not load leads.')
        setLeads([])
        setTotal(0)
        toast.error(res.error)
        return
      }
      setLeads(res.leads)
      setTotal(res.total)
      syncPageFromApi(setPage, res.page || nextPage)
    },
    [token],
  )

  /** Debounce the search input so we hit the server at most once per ~350ms while typing. */
  useEffect(() => {
    setLeads(null)
    const handle = setTimeout(() => {
      setPage(1)
      void load(1, q, stageFilter)
    }, 350)
    return () => clearTimeout(handle)
  }, [q, stageFilter, load])

  useEffect(
    () => () => {
      if (abortRef.current) abortRef.current.abort()
    },
    [],
  )

  const onCreate = async (e) => {
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
        assignedTeacherId: assignId || null,
        classId: classId || null,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Lead created.')
      setStudentName('')
      setParentName('')
      setPhone('')
      setAssignId('')
      setClassId('')
      setQ('')
      await load(1, '', stageFilter)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link to="/dashboard">
          <Button type="button" size="sm" variant="secondary">
            Dashboard
          </Button>
        </Link>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setLeads(null)
            void load(page, q, stageFilter)
          }}
        >
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader
          title="Create lead"
          subtitle="Assign a teacher now or open the lead later from the detail screen."
        />
        <form onSubmit={onCreate} className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label variant="compact" htmlFor="admin-lead-student" required>
              Student name
            </Label>
            <Input
              id="admin-lead-student"
              className="mt-1"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div>
            <Label variant="compact" htmlFor="admin-lead-parent" required>
              Parent / guardian
            </Label>
            <Input
              id="admin-lead-parent"
              className="mt-1"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div>
            <Label variant="compact" htmlFor="admin-lead-phone" required>
              Phone
            </Label>
            <PhoneInput
              id="admin-lead-phone"
              className="mt-1"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <div>
            <SearchableTeacherSelect
              id="admin-lead-teacher"
              value={assignId}
              onChange={setAssignId}
              options={teacherOpts ?? []}
              loading={teacherOpts === null}
              disabled={submitting}
            />
            {teacherOptsError ? (
              <p className="mt-1 text-xs text-amber-700">{teacherOptsError}</p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <SearchableClassSelect
              id="admin-lead-class"
              value={classId}
              onChange={setClassId}
              options={classOpts ?? []}
              loading={classOpts === null}
              disabled={submitting}
            />
            {classOptsError ? (
              <p className="mt-1 text-xs text-amber-700">{classOptsError}</p>
            ) : null}
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
          title="Lead dashboard"
          subtitle="Search and open a lead to change stage, notes, and follow-ups."
        />
        <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_220px]">
          <Input
            placeholder="Search by student, parent, phone, teacher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <SearchableStageFilterSelect
            id="admin-leads-stage-filter"
            value={stageFilter}
            onChange={setStageFilter}
          />
        </div>

        {leads === null ? (
          <p className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            Loading leads…
          </p>
        ) : null}

        {listError ? (
          <p className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
            {listError}
          </p>
        ) : null}

        {leads !== null && leads.length === 0 && !listError ? (
          <p className="text-sm text-slate-600">
            {q || stageFilter ? 'No leads match your filters.' : 'No leads yet.'}
          </p>
        ) : null}

        {Array.isArray(leads) && leads.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="app-data-table">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Parent</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Teacher</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Created by</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((l) => (
                  <tr key={l.id} className="align-top transition hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-medium text-slate-900">{l.studentName}</td>
                    <td className="px-3 py-2 text-slate-700">{l.parentName}</td>
                    <td className="px-3 py-2 text-slate-600">{l.phone}</td>
                    <td className="px-3 py-2 text-xs text-indigo-700">
                      {l.assignedTeacherName}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                        {LEAD_STAGE_LABELS[l.stage] || l.stage}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{l.createdByName || '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <Link to={`/leads/${l.id}`}>
                        <Button type="button" size="sm" variant="secondary">
                          Open
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {total > 0 ? (
          <ListPagination
            className="mt-4 rounded-b-xl"
            page={page}
            total={total}
            pageSize={PAGE_LIMIT}
            loading={leads === null}
            onPrev={() => {
              setLeads(null)
              void load(page - 1, q, stageFilter)
            }}
            onNext={() => {
              setLeads(null)
              void load(page + 1, q, stageFilter)
            }}
          />
        ) : null}
      </Card>
    </div>
  )
}
