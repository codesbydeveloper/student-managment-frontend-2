import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../../context/AuthContext'
import { Card, CardHeader } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Label } from '../../components/ui/Label'
import { SearchableSingleSelect } from '../../components/SearchableSingleSelect'
import { fetchParentMyStudents } from '../../api/parentsApi'
import { fetchTeachersPicker } from '../../api/teachersApi'
import { createPtmRequest } from '../../api/ptmApi'
import { ROLES } from '../../utils/constants'

export default function ParentPtmRequestPage() {
  const { user, token } = useAuth()

  const [myStudents, setMyStudents] = useState(null)
  const [studentId, setStudentId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [reason, setReason] = useState('')

  /** GET /api/teachers/picker — null while loading, [] when API failed, array of `{value,label,subtext}` on success. */
  const [pickerTeachers, setPickerTeachers] = useState(null)
  const [pickerError, setPickerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token || user?.role !== ROLES.PARENT) {
      setMyStudents(null)
      return
    }
    let cancelled = false
    void (async () => {
      const res = await fetchParentMyStudents(token)
      if (cancelled) return
      setMyStudents(res.ok ? res.students : [])
      if (!res.ok) toast.error(res.error)
    })()
    return () => {
      cancelled = true
    }
  }, [token, user?.role])

  useEffect(() => {
    if (!token || user?.role !== ROLES.PARENT) {
      setPickerTeachers(null)
      setPickerError('')
      return
    }
    let cancelled = false
    setPickerError('')
    void (async () => {
      const res = await fetchTeachersPicker(token)
      if (cancelled) return
      if (res.ok) {
        setPickerTeachers(res.options)
      } else {
        setPickerTeachers([])
        setPickerError(res.error || 'Could not load teachers.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, user?.role])

  const studentOptions = useMemo(() => {
    if (!Array.isArray(myStudents)) return []
    return myStudents
      .map((s) => ({
        value: String(s.id),
        label: s.fullName || `Student ${s.id}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [myStudents])

  const teacherOptions = useMemo(() => {
    if (!Array.isArray(pickerTeachers)) return []
    return pickerTeachers
      .map((opt) => ({
        id: String(opt.value),
        fullName: opt.label,
        subtext: opt.subtext || '',
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [pickerTeachers])

  const selectedStudent = useMemo(() => {
    if (!Array.isArray(myStudents) || !studentId) return null
    return myStudents.find((s) => String(s.id) === String(studentId)) || null
  }, [myStudents, studentId])

  const selectedTeacher = useMemo(() => {
    if (!teacherId) return null
    return teacherOptions.find((t) => String(t.id) === String(teacherId)) || null
  }, [teacherOptions, teacherId])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    if (!studentId || !teacherId || !reason.trim()) {
      toast.error('Choose a child, teacher, and enter a reason.')
      return
    }
    if (!token) {
      toast.error('Sign in again to send a PTM request.')
      return
    }

    setSubmitting(true)
    try {
      const apiRes = await createPtmRequest(token, {
        studentId,
        teacherId,
        reason,
      })
      if (!apiRes.ok) {
        toast.error(apiRes.error)
        return
      }

      toast.success('PTM request sent.')
      setReason('')
      setStudentId('')
      setTeacherId('')
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
        <Link to="/parent/ptm/history">
          <Button type="button" size="sm" variant="secondary">
            PTM history
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader
          title="Request a parent–teacher meeting"
          
        />
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <SearchableSingleSelect
              id="ptm-child"
              label="Child"
              required
              options={studentOptions}
              value={studentId}
              onChange={setStudentId}
              disabled={myStudents === null}
              placeholder={myStudents === null ? 'Loading children…' : 'Select child…'}
              searchPlaceholder="Search by child name…"
              emptyText="No children match your search."
              panelMaxHeightClass="max-h-56"
            />
            {Array.isArray(myStudents) && myStudents.length === 0 ? (
              <p className="mt-2 text-xs text-amber-800">
                No linked students. Ask your school to connect your account first.
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="ptm-teacher-trigger" required>
              Teacher
            </Label>
            <SearchableSingleSelect
              id="ptm-teacher"
              options={teacherOptions.map((t) => ({
                value: t.id,
                label: t.fullName,
                subtext: t.subtext || '',
              }))}
              value={teacherId}
              onChange={setTeacherId}
              disabled={pickerTeachers === null}
              placeholder={pickerTeachers === null ? 'Loading teachers…' : 'Select teacher…'}
              searchPlaceholder="Search teachers…"
              emptyText="No teachers found."
              panelMaxHeightClass="max-h-56"
            />
            {pickerError ? (
              <p className="mt-2 text-xs text-amber-800">
                Could not load teachers from your school ({pickerError}).
              </p>
            ) : null}
            {!pickerError && Array.isArray(pickerTeachers) && pickerTeachers.length === 0 ? (
              <p className="mt-2 text-xs text-amber-800">
                Your school has not published any teachers yet.
              </p>
            ) : null}
          </div>

          <div>
            <Label variant="compact" htmlFor="ptm-reason" required>
              Reason for meeting
            </Label>
            <textarea
              id="ptm-reason"
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              placeholder="Briefly describe what you would like to discuss."
            />
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send request'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
