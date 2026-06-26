import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { fetchClassesAssigned } from '../../api/classesApi'
import { fetchAllStudentsAssignedMinimal } from '../../api/studentsApi'
import { buildTeacherNotificationBody, postTeacherNotification } from '../../api/notificationsApi'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Select } from '../ui/Select'
import { TargetSelector } from './TargetSelector'
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_TARGET_TYPES,
} from '../../utils/notificationConstants'

export function NotificationForm() {
  const navigate = useNavigate()
  const { token } = useAuth()
  const { classes, students } = useAppData()
  /** When set (including `[]`), class/section targets use GET /api/classes/assigned; when `undefined`, use app context classes. */
  const [summaryClasses, setSummaryClasses] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    async function loadSummary() {
      if (!token) {
        setSummaryClasses(undefined)
        return
      }
      const res = await fetchClassesAssigned(token)
      if (cancelled) return
      if (res.ok) {
        setSummaryClasses(res.classes)
      } else {
        setSummaryClasses(undefined)
      }
    }
    void loadSummary()
    return () => {
      cancelled = true
    }
  }, [token])

  const classesForTargets = summaryClasses !== undefined ? summaryClasses : classes

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState(NOTIFICATION_CATEGORIES.ADMINISTRATIVE)
  const [targetType, setTargetType] = useState(NOTIFICATION_TARGET_TYPES.CLASS)
  const [targetIds, setTargetIds] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [studentTargetsLoading, setStudentTargetsLoading] = useState(false)
  const [studentTargetsFromApi, setStudentTargetsFromApi] = useState(null)

  useEffect(() => {
    if (targetType !== NOTIFICATION_TARGET_TYPES.STUDENT) {
      setStudentTargetsFromApi(null)
      setStudentTargetsLoading(false)
      return
    }
    if (!token) {
      setStudentTargetsFromApi(null)
      setStudentTargetsLoading(false)
      return
    }
    let cancelled = false
    setStudentTargetsLoading(true)
    setStudentTargetsFromApi(null)
    ;(async () => {
      const res = await fetchAllStudentsAssignedMinimal(token)
      if (cancelled) return
      setStudentTargetsLoading(false)
      if (res.ok) {
        setStudentTargetsFromApi(res.students)
      } else {
        setStudentTargetsFromApi([])
        toast.error(res.error || 'Could not load students for targeting.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [targetType, token])

  const studentsForTargets =
    targetType === NOTIFICATION_TARGET_TYPES.STUDENT && token
      ? studentTargetsFromApi ?? []
      : students

  const invalid = useMemo(() => {
    return (
      !title.trim() ||
      !message.trim() ||
      !targetIds.length
    )
  }, [title, message, targetIds])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (invalid) return
    if (!token) {
      toast.error('Sign in to send a notification.')
      return
    }

    setSubmitting(true)
    try {
      const body = buildTeacherNotificationBody({
        title,
        message,
        category,
        targetType,
        targetIds,
      })
      const apiRes = await postTeacherNotification(token, body)
      if (!apiRes.ok) {
        toast.error(apiRes.error || 'Could not send notification.')
        return
      }
      const msg =
        (apiRes.data && typeof apiRes.data.message === 'string' && apiRes.data.message) ||
        'Notification sent.'
      toast.success(msg)
      navigate('/notifications')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit} noValidate>
      <div>
        <Label htmlFor="nf-title" required>Title</Label>
        <Input
          id="nf-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short headline"
        />
      </div>
      <div>
        <Label htmlFor="nf-message" required>Message</Label>
        <textarea
          id="nf-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          placeholder="What should families or staff know?"
          className="w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-inner shadow-slate-900/[0.03] transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="nf-category">Category</Label>
          <Select
            id="nf-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value={NOTIFICATION_CATEGORIES.ADMINISTRATIVE}>
              {NOTIFICATION_CATEGORY_LABELS[NOTIFICATION_CATEGORIES.ADMINISTRATIVE]}
            </option>
            <option value={NOTIFICATION_CATEGORIES.ACADEMIC}>
              {NOTIFICATION_CATEGORY_LABELS[NOTIFICATION_CATEGORIES.ACADEMIC]}
            </option>
          </Select>
          <p className="mt-1.5 text-xs text-slate-500">
            Administrative → admin approval. Academic → principal approval.
          </p>
        </div>
        <div>
          <Label htmlFor="nf-target-type" required>Target type</Label>
          <Select
            id="nf-target-type"
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value)
              setTargetIds([])
            }}
          >
            <option value={NOTIFICATION_TARGET_TYPES.CLASS}>Class</option>
            <option value={NOTIFICATION_TARGET_TYPES.SECTION}>Section</option>
            <option value={NOTIFICATION_TARGET_TYPES.STUDENT}>Student</option>
          </Select>
        </div>
      </div>

      {targetType === NOTIFICATION_TARGET_TYPES.STUDENT && token && studentTargetsLoading ? (
        <p className="text-sm text-slate-500">Loading students assigned to you…</p>
      ) : null}
      <TargetSelector
        targetType={targetType}
        value={targetIds}
        onChange={setTargetIds}
        disabled={submitting || (targetType === NOTIFICATION_TARGET_TYPES.STUDENT && token && studentTargetsLoading)}
        classes={classesForTargets}
        students={studentsForTargets}
      />

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="secondary" onClick={() => navigate('/notifications')} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={invalid || submitting}>
          {submitting ? 'Sending…' : 'Send notification'}
        </Button>
      </div>
    </form>
  )
}
