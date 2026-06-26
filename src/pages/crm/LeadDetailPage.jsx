import { useCallback, useEffect, useState } from 'react'
import { useAsyncLoader } from '../../hooks/useAsyncLoader'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { PhoneInput } from '../../components/ui/PhoneInput'
import { isPhone10Digits, sanitizePhoneDigits } from '../../utils/phoneInput'
import { LeadStageStepper } from '../../components/phase6/LeadStageStepper'
import { formatApiTimestampShort12h } from '../../utils/notificationTimestamps'
import { Label } from '../../components/ui/Label'
import { SearchableClassSelect } from '../../components/SearchableClassSelect'
import { SearchableStageUpdateSelect } from '../../components/SearchableStageSelect'
import { SearchableTeacherSelect } from '../../components/SearchableTeacherSelect'
import {
  LEAD_STAGE_LABELS,
  apiStageToUiStage,
  uiStageToApiStage,
} from '../../data/phase6Constants'
import { ROLES } from '../../utils/constants'
import {
  fetchLeadById,
  fetchLeadActivities,
  updateLead,
  updateLeadStage,
  createLeadNote,
} from '../../api/leadsApi'
import { fetchTeachersPicker } from '../../api/teachersApi'
import { fetchClassesSummary } from '../../api/classesApi'

function fmt(iso) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    )
  } catch {
    return '—'
  }
}

function fmtActivityAt(activity) {
  const raw = String(activity?.atDisplay ?? '').trim()
  if (raw) return formatApiTimestampShort12h(raw)
  return fmt(activity?.at)
}

/** Format an ISO string for an `<input type="datetime-local">`. */
function toLocalInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`
}

function describeActivity(act) {
  if (!act) return ''
  if (act.type === 'stage_change') {
    const from = act.meta?.from ? LEAD_STAGE_LABELS[act.meta.from] ?? act.meta.from : '—'
    const to = act.meta?.to ? LEAD_STAGE_LABELS[act.meta.to] ?? act.meta.to : '—'
    return `Stage changed: ${from} → ${to}${act.text ? ` · ${act.text}` : ''}`
  }
  if (act.type === 'follow_up_done' || act.type === 'follow_up' || act.type === 'followup_done') {
    return `Follow-up done${act.text ? ` · ${act.text}` : ''}`
  }
  return act.text || act.type
}

export default function LeadDetailPage() {
  const { leadId } = useParams()
  const { user, token } = useAuth()

  /** undefined = loading, null = not found / no access, object = loaded */
  const [lead, setLead] = useState(undefined)
  const [loadError, setLoadError] = useState('')

  const [teacherOpts, setTeacherOpts] = useState(null)
  const [teacherOptsError, setTeacherOptsError] = useState('')

  const [classOpts, setClassOpts] = useState(null)
  const [classOptsError, setClassOptsError] = useState('')

  const [activities, setActivities] = useState([])
  const [activitiesError, setActivitiesError] = useState('')

  const [stageDraft, setStageDraft] = useState('')
  const [stageNote, setStageNote] = useState('')
  const [savingStage, setSavingStage] = useState(false)

  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    studentName: '',
    parentName: '',
    phone: '',
    assignedTeacherId: '',
    classId: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  const isAdmin = user?.role === ROLES.ADMIN
  const isPrincipal = user?.role === ROLES.PRINCIPAL
  const isTeacher = user?.role === ROLES.TEACHER
  const canViewLeadActivity = isAdmin || isPrincipal || isTeacher
  /** Only admin and principal may edit lead details (contact, assignment, class). */
  const canEditLeadDetails = isAdmin || isPrincipal

  useAsyncLoader(
    async () => {
      if (!token) {
        setTeacherOpts([])
        return
      }
      setTeacherOptsError('')
      const res = await fetchTeachersPicker(token)
      if (!res.ok) {
        setTeacherOptsError(res.error || 'Could not load teachers.')
        setTeacherOpts([])
        return
      }
      setTeacherOpts(res.options)
    },
    [token],
    { enabled: isAdmin || isPrincipal },
  )

  useAsyncLoader(
    async () => {
      if (!token || !canEditLeadDetails) {
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
    },
    [token, canEditLeadDetails],
    { enabled: canEditLeadDetails },
  )

  const load = useAsyncLoader(async () => {
    setLead(undefined)
    setActivities([])
    setActivitiesError('')
    if (!token || !leadId) {
      setLead(null)
      return
    }
    setLoadError('')
    const res = await fetchLeadById(token, leadId)
    if (!res.ok) {
      setLoadError(res.error || 'Lead not found.')
      setLead(null)
      return
    }
    setLead(res.lead)
  }, [token, leadId])

  const loadActivities = useAsyncLoader(
    async () => {
      if (!token || !leadId || !canViewLeadActivity) return
      setActivitiesError('')
      const res = await fetchLeadActivities(token, leadId)
      if (!res.ok) {
        setActivitiesError(res.error || 'Could not load activity.')
        setActivities([])
        return
      }
      setActivities(res.activities)
    },
    [token, leadId, canViewLeadActivity, lead?.id],
    { enabled: Boolean(lead && canViewLeadActivity) },
  )

  useEffect(() => {
    if (lead && typeof lead === 'object') {
      setStageDraft(apiStageToUiStage(lead.stage))
      setEditForm({
        studentName: lead.studentName || '',
        parentName: lead.parentName || '',
        phone: sanitizePhoneDigits(lead.phone || ''),
        assignedTeacherId: lead.assignedTeacherUserId ? String(lead.assignedTeacherUserId) : '',
        classId: lead.classId ? String(lead.classId) : '',
      })
    }
  }, [
    lead?.id,
    lead?.assignedTeacherUserId,
    lead?.stage,
    lead?.studentName,
    lead?.parentName,
    lead?.phone,
    lead?.classId,
  ])

  const canAccess =
    lead &&
    (isAdmin ||
      isPrincipal ||
      (isTeacher && String(lead.assignedTeacherUserId) === String(user?.id)))

  if (lead === undefined) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Loading lead…</p>
      </div>
    )
  }

  if (lead === null) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{loadError || 'Lead not found.'}</p>
        <Link to={isAdmin || isPrincipal ? '/leads' : '/assigned-leads'}>
          <Button type="button" variant="secondary" size="sm">
            Back to list
          </Button>
        </Link>
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-amber-900">You do not have access to this lead.</p>
        <Link to="/dashboard">
          <Button type="button" variant="secondary" size="sm">
            Dashboard
          </Button>
        </Link>
      </div>
    )
  }

  /* -------------------- Admin / principal handlers -------------------- */

  const onSubmitEditLeadDetails = async (e) => {
    e?.preventDefault?.()
    if (savingEdit) return
    if (!editForm.studentName.trim() || !editForm.parentName.trim() || !editForm.phone.trim()) {
      toast.error('Student name, parent name, and phone are required.')
      return
    }
    if (!isPhone10Digits(editForm.phone)) {
      toast.error('Phone must be exactly 10 digits.')
      return
    }
    const body = {}
    if (editForm.studentName.trim() && editForm.studentName.trim() !== lead.studentName) {
      body.studentName = editForm.studentName.trim()
    }
    if (editForm.parentName.trim() && editForm.parentName.trim() !== lead.parentName) {
      body.parentName = editForm.parentName.trim()
    }
    const phoneDigits = sanitizePhoneDigits(editForm.phone)
    if (phoneDigits && phoneDigits !== sanitizePhoneDigits(lead.phone)) {
      body.phone = phoneDigits
    }

    const curTeacher = lead.assignedTeacherUserId ? String(lead.assignedTeacherUserId) : ''
    const nextTeacher = String(editForm.assignedTeacherId || '').trim()
    const curClass = lead.classId ? String(lead.classId) : ''
    const nextClass = String(editForm.classId || '').trim()

    if (nextTeacher !== curTeacher) {
      body.assignedTeacherId = nextTeacher || null
    }
    if (nextClass !== curClass) {
      body.classId = nextClass || null
    }

    if (Object.keys(body).length === 0) {
      toast.info('Nothing to update.')
      return
    }
    setSavingEdit(true)
    try {
      const res = await updateLead(token, lead.id, body)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (res.lead) setLead(res.lead)
      else await load()
      toast.success('Lead updated.')
      setEditOpen(false)
      if (canViewLeadActivity) await loadActivities()
    } finally {
      setSavingEdit(false)
    }
  }

  /* -------------------- Teacher + staff lead actions (shared API) -------------------- */

  const onChangeStageTeacher = async () => {
    if (!stageDraft || savingStage) return
    const nextApiStage = uiStageToApiStage(stageDraft)
    if (nextApiStage === lead.stage && !stageNote.trim()) {
      toast.info('Stage unchanged.')
      return
    }
    setSavingStage(true)
    try {
      const res = await updateLeadStage(token, lead.id, {
        stage: nextApiStage,
        note: stageNote.trim(),
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Stage updated.')
      setStageNote('')
      await load()
      if (canViewLeadActivity) await loadActivities()
    } finally {
      setSavingStage(false)
    }
  }

  const onAddNoteTeacher = async () => {
    const text = noteText.trim()
    if (!text || savingNote) return
    setSavingNote(true)
    try {
      const res = await createLeadNote(token, lead.id, { text })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success('Note added.')
      setNoteText('')
      if (canViewLeadActivity) await loadActivities()
    } finally {
      setSavingNote(false)
    }
  }

  const teacherPickOpts = canEditLeadDetails
    ? (() => {
        const base = [...(teacherOpts || [])]
        const tid = lead?.assignedTeacherUserId ? String(lead.assignedTeacherUserId) : ''
        if (tid && !base.some((t) => String(t.value) === tid)) {
          base.push({
            value: tid,
            label: lead.assignedTeacherName || 'Teacher',
          })
        }
        return base
      })()
    : []

  const classPickOpts = canEditLeadDetails
    ? (() => {
        const base = [...(classOpts || [])]
        const cid = lead?.classId ? String(lead.classId) : ''
        if (cid && !base.some((c) => String(c.value) === cid)) {
          base.push({
            value: cid,
            label: lead.className || 'Current class',
            subtext: '',
          })
        }
        return base
      })()
    : []

  const viewTeacherLabel = lead?.assignedTeacherUserId
    ? lead.assignedTeacherName || '—'
    : 'Unassigned'

  const viewClassLabel = (() => {
    const cid = lead?.classId ? String(lead.classId) : ''
    if (!cid) return 'No class'
    const o = (classOpts || []).find((c) => String(c.value) === cid)
    if (o) return o.subtext ? `${o.label} — ${o.subtext}` : o.label
    return lead?.className || '—'
  })()

  /* -------------------- Render -------------------- */

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link to={isAdmin || isPrincipal ? '/leads' : '/assigned-leads'}>
          <Button type="button" size="sm" variant="secondary">
            All leads
          </Button>
        </Link>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            void load()
            if (canViewLeadActivity) void loadActivities()
          }}
        >
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader
          title={lead.studentName}
          subtitle={`${lead.parentName} · ${lead.phone} · Created ${fmt(lead.createdAt)}`}
        />
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Pipeline</p>
            <div className="mt-2">
              <LeadStageStepper currentStage={lead.stage} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Current stage:{' '}
              <span className="font-medium text-slate-700">
                {LEAD_STAGE_LABELS[lead.stage] ?? lead.stage}
              </span>
              {lead.nextFollowUpAt ? (
                <>
                  {' '}
                  · Next follow-up:{' '}
                  <span className="font-medium text-slate-700">{fmt(lead.nextFollowUpAt)}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </Card>

      {canEditLeadDetails ? (
        <Card>
          <CardHeader
            title="Edit lead"
            subtitle="Assign a teacher now or open the lead later from the detail screen."
          />
          {!editOpen ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
              Edit details
            </Button>
          ) : (
            <form onSubmit={onSubmitEditLeadDetails} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label variant="compact" htmlFor="lead-edit-student" required>
                  Student name
                </Label>
                <Input
                  id="lead-edit-student"
                  className="mt-1"
                  value={editForm.studentName}
                  onChange={(e) => setEditForm((f) => ({ ...f, studentName: e.target.value }))}
                  disabled={savingEdit}
                />
              </div>
              <div>
                <Label variant="compact" htmlFor="lead-edit-parent" required>
                  Parent / guardian
                </Label>
                <Input
                  id="lead-edit-parent"
                  className="mt-1"
                  value={editForm.parentName}
                  onChange={(e) => setEditForm((f) => ({ ...f, parentName: e.target.value }))}
                  disabled={savingEdit}
                />
              </div>
              <div>
                <Label variant="compact" htmlFor="lead-edit-phone" required>
                  Phone
                </Label>
                <PhoneInput
                  id="lead-edit-phone"
                  className="mt-1"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  disabled={savingEdit}
                />
              </div>
              <div>
                <SearchableTeacherSelect
                  id="lead-detail-teacher"
                  value={editForm.assignedTeacherId}
                  onChange={(val) => setEditForm((f) => ({ ...f, assignedTeacherId: val }))}
                  options={teacherPickOpts}
                  loading={teacherOpts === null}
                  disabled={savingEdit}
                />
                {teacherOptsError ? (
                  <p className="mt-1 text-xs text-amber-700">{teacherOptsError}</p>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <SearchableClassSelect
                  id="lead-detail-class"
                  value={editForm.classId}
                  onChange={(val) => setEditForm((f) => ({ ...f, classId: val }))}
                  options={classPickOpts}
                  loading={classOpts === null}
                  disabled={savingEdit}
                />
                {classOptsError ? (
                  <p className="mt-1 text-xs text-amber-700">{classOptsError}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" size="sm" disabled={savingEdit}>
                  {savingEdit ? 'Saving…' : 'Save changes'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditOpen(false)
                    setEditForm({
                      studentName: lead.studentName || '',
                      parentName: lead.parentName || '',
                      phone: sanitizePhoneDigits(lead.phone || ''),
                      assignedTeacherId: lead.assignedTeacherUserId
                        ? String(lead.assignedTeacherUserId)
                        : '',
                      classId: lead.classId ? String(lead.classId) : '',
                    })
                  }}
                  disabled={savingEdit}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Card>
      ) : null}

      {isTeacher ? (
        <Card>
          <CardHeader
            title="View lead"
            subtitle="These details are read-only. Use Update stage and Add a note below to record progress."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Student name
              </label>
              <p className="mt-1 rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-2.5 text-sm text-slate-800">
                {lead.studentName || '—'}
              </p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Parent / guardian
              </label>
              <p className="mt-1 rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-2.5 text-sm text-slate-800">
                {lead.parentName || '—'}
              </p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Phone</label>
              <p className="mt-1 rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-2.5 text-sm text-slate-800">
                {lead.phone || '—'}
              </p>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Assign teacher
              </label>
              <p className="mt-1 rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-2.5 text-sm text-slate-800">
                {viewTeacherLabel}
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Class</label>
              <p className="mt-1 rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-2.5 text-sm text-slate-800">
                {viewClassLabel}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {canViewLeadActivity ? (
        <>
          <Card>
            <CardHeader title="Update stage" subtitle="Optional note becomes part of the activity log." />
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-48 flex-1 sm:max-w-xs">
                <SearchableStageUpdateSelect
                  id="lead-detail-stage"
                  value={stageDraft}
                  onChange={setStageDraft}
                  disabled={savingStage}
                />
              </div>
              <Input
                placeholder="Optional note (why this stage?)"
                value={stageNote}
                onChange={(e) => setStageNote(e.target.value)}
                disabled={savingStage}
              />
              <Button type="button" size="sm" onClick={onChangeStageTeacher} disabled={savingStage}>
                {savingStage ? 'Saving…' : 'Save stage'}
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Add a note" subtitle="Appended to the lead's activity log." />
            <div className="flex gap-2">
              <Input
                placeholder="Add a note…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                disabled={savingNote}
              />
              <Button type="button" onClick={onAddNoteTeacher} disabled={savingNote || !noteText.trim()}>
                {savingNote ? 'Saving…' : 'Add'}
              </Button>
            </div>
          </Card>
        </>
      ) : null}

      {canViewLeadActivity ? (
        <Card>
          <CardHeader title="Activity" subtitle="Notes, stage changes, and follow-ups. Newest first." />
          {activitiesError ? (
            <p className="mb-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
              {activitiesError}
            </p>
          ) : null}
          <ul className="space-y-2 text-sm">
            {activities.length === 0 && !activitiesError ? (
              <li className="text-xs text-slate-500">No activity yet.</li>
            ) : null}
            {activities.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
              >
                <p className="text-xs text-slate-500">
                  {a.actorName || 'Someone'} · {fmtActivityAt(a)}
                </p>
                <p className="mt-1 text-slate-800">{describeActivity(a)}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}
