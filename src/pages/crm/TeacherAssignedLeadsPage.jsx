import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { SearchableStageFilterSelect } from '../../components/SearchableStageSelect'
import { LEAD_STAGE_LABELS } from '../../data/phase6Constants'
import { fetchTeacherLeads } from '../../api/leadsApi'
import { ListPagination } from '../../components/ui/ListPagination'
import { syncPageFromApi } from '../../utils/pagination'

const PAGE_LIMIT = 20

export default function TeacherAssignedLeadsPage() {
  const { token } = useAuth()

  const [q, setQ] = useState('')
  const [stage, setStage] = useState('')
  const [page, setPage] = useState(1)

  /** null while loading; [] when loaded with zero matches */
  const [leads, setLeads] = useState(null)
  const [total, setTotal] = useState(0)
  const [listError, setListError] = useState('')

  const abortRef = useRef(null)

  const load = useCallback(
    async (nextPage, nextQ, nextStage) => {
      if (!token) {
        setLeads([])
        setTotal(0)
        return
      }
      const usePage = Math.max(1, Number(nextPage) || 1)
      const useQ = String(nextQ ?? '').trim()
      const useStage = String(nextStage ?? '').trim()
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setListError('')
      const res = await fetchTeacherLeads(token, {
        q: useQ,
        stage: useStage,
        page: usePage,
        limit: PAGE_LIMIT,
        signal: controller.signal,
      })
      if (controller.signal.aborted || res.aborted) return
      if (!res.ok) {
        setListError(res.error || 'Could not load leads.')
        setLeads([])
        setTotal(0)
        return
      }
      setLeads(res.leads)
      setTotal(res.total)
      syncPageFromApi(setPage, res.page || usePage)
    },
    [token],
  )

  useEffect(() => {
    setLeads(null)
    const handle = setTimeout(() => {
      void load(1, q, stage)
      setPage(1)
    }, 250)
    return () => clearTimeout(handle)
  }, [q, stage, load])

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

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
            void load(page, q, stage)
          }}
        >
          Refresh
        </Button>
      </div>

      <Card>
        <p className="mb-4 max-w-2xl text-xs leading-relaxed text-slate-500">
          Leads assigned by your admin. Update stage, notes, and follow-ups here.
        </p>

        <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_220px]">
          <Input
            placeholder="Search by student, parent, phone, teacher, stage…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <SearchableStageFilterSelect
            id="teacher-leads-stage-filter"
            value={stage}
            onChange={setStage}
          />
        </div>

        {leads === null ? (
          <div className="overflow-hidden rounded-xl border border-slate-200/80">
            <div className="flex min-h-[12rem] items-center justify-center bg-slate-50/50 px-4 py-10">
              <p className="text-sm text-slate-600">Loading leads…</p>
            </div>
          </div>
        ) : null}

        {listError ? (
          <p className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-center text-sm text-amber-950">
            {listError}
          </p>
        ) : null}

        {leads !== null && leads.length === 0 && !listError ? (
          <div className="overflow-hidden rounded-xl border border-slate-200/80">
            <div className="overflow-x-auto">
              <table className="app-data-table">
                <thead>
                  <tr className="app-table-head">
                    <th className="px-3 py-2.5">Student</th>
                    <th className="px-3 py-2.5">Parent</th>
                    <th className="px-3 py-2.5">Phone</th>
                    <th className="px-3 py-2.5">Teacher</th>
                    <th className="px-3 py-2.5">Stage</th>
                    <th className="px-3 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <p className="text-sm font-medium text-slate-700">
                        {q || stage ? 'No leads match your filters.' : 'No leads assigned to you yet.'}
                      </p>
                      {!q && !stage ? (
                        <p className="mt-1 text-xs text-slate-500">
                          When your admin assigns leads, they will appear in this table.
                        </p>
                      ) : null}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {Array.isArray(leads) && leads.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200/80">
            <table className="app-data-table">
              <thead>
                <tr className="app-table-head">
                  <th className="px-3 py-2.5">Student</th>
                  <th className="px-3 py-2.5">Parent</th>
                  <th className="px-3 py-2.5">Phone</th>
                  <th className="px-3 py-2.5">Teacher</th>
                  <th className="px-3 py-2.5">Stage</th>
                  <th className="px-3 py-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((l) => (
                  <tr key={l.id} className="transition hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-medium text-slate-900">{l.studentName}</td>
                    <td className="px-3 py-2 text-slate-700">{l.parentName}</td>
                    <td className="px-3 py-2 text-slate-600">{l.phone}</td>
                    <td className="px-3 py-2 text-xs text-indigo-700">
                      {l.assignedTeacherName}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                        {LEAD_STAGE_LABELS[l.stage] ?? l.stage}
                      </span>
                    </td>
                    <td className="px-3 py-2">
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
              void load(page - 1, q, stage)
            }}
            onNext={() => {
              setLeads(null)
              void load(page + 1, q, stage)
            }}
          />
        ) : null}
      </Card>
    </div>
  )
}
