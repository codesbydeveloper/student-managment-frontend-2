import { useCallback, useState } from 'react'
import { toast } from 'react-toastify'
import { rejectUpcomingPtmMeeting, updateUpcomingPtmMeeting } from '../api/ptmApi'
import { buildApprovedPtmFormDefaults } from '../components/ptm/StaffApprovedPtmActions'
import { ptmLocalDatetimeToIso } from '../utils/ptmStaffUi'

/**
 * Edit or cancel upcoming approved PTMs (admin / principal).
 */
export function useStaffApprovedPtmUiActions({ token, setRows, closeView, onReload }) {
  const [formById, setFormById] = useState({})
  const [busyById, setBusyById] = useState({})

  const getFormForRow = useCallback(
    (row) => {
      if (!row?.id) return buildApprovedPtmFormDefaults(null)
      return formById[row.id] || buildApprovedPtmFormDefaults(row)
    },
    [formById],
  )

  const patchForm = useCallback((rowId, patch) => {
    setFormById((prev) => ({
      ...prev,
      [rowId]: { ...buildApprovedPtmFormDefaults(null), ...prev[rowId], ...patch },
    }))
  }, [])

  const clearBusy = (id) =>
    setBusyById((m) => {
      const next = { ...m }
      delete next[id]
      return next
    })

  const applyRowUpdate = useCallback(
    (rowId, mappedRow) => {
      if (!mappedRow) return
      setRows((prev) => {
        const list = Array.isArray(prev) ? prev : []
        return list.map((row) => (row.id === rowId ? { ...row, ...mappedRow } : row))
      })
    },
    [setRows],
  )

  const removeRow = useCallback(
    (rowId) => {
      setRows((prev) => {
        const list = Array.isArray(prev) ? prev : []
        return list.filter((row) => row.id !== rowId)
      })
    },
    [setRows],
  )

  const onSaveEdit = async (row) => {
    if (!token || !row?.id || busyById[row.id]) return
    const form = getFormForRow(row)
    const scheduledAt = ptmLocalDatetimeToIso(form.meetingLocal)
    if (!scheduledAt) {
      toast.error('Pick a meeting date and time.')
      return
    }
    setBusyById((m) => ({ ...m, [row.id]: 'saving' }))
    try {
      const res = await updateUpcomingPtmMeeting(token, row.id, {
        scheduledAt,
        meetingNote: form.meetingNote.trim() || undefined,
      })
      if (!res.ok) {
        toast.error(res.error || 'Could not update meeting.')
        return
      }
      if (res.request) applyRowUpdate(row.id, res.request)
      toast.success(res.message || 'Meeting updated.')
      closeView?.()
      await onReload?.()
    } finally {
      clearBusy(row.id)
    }
  }

  const onReject = async (row) => {
    if (!token || !row?.id || busyById[row.id]) return
    const form = getFormForRow(row)
    const rejectionNote = (form.rejectNote || '').trim()
    if (!rejectionNote) {
      toast.error('Add a note for the parent before cancelling.')
      return
    }
    setBusyById((m) => ({ ...m, [row.id]: 'rejecting' }))
    try {
      const res = await rejectUpcomingPtmMeeting(token, row.id, { rejectionNote })
      if (!res.ok) {
        toast.error(res.error || 'Could not cancel meeting.')
        return
      }
      removeRow(row.id)
      toast.success(res.message || 'Meeting cancelled. Parent notified.')
      closeView?.()
      await onReload?.()
    } finally {
      clearBusy(row.id)
    }
  }

  return {
    formById,
    busyById,
    getFormForRow,
    patchForm,
    onSaveEdit,
    onReject,
  }
}
