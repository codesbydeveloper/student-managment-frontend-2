/** PTM lifecycle — core rows + school workflow statuses from the API */
export const PTM_STATUS = {
  REQUESTED: 'requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
  PENDING_PRINCIPAL: 'pending_principal',
  PRINCIPAL_REJECTED: 'principal_rejected',
}

/** Final lead pipeline — only these 6 stages (UI + API payload). */
export const LEAD_STAGES = ['new', 'contacted', 'visit', 'not_interested', 'enrolled', 'closed']

/** Same 6 values sent to PATCH `/api/leads/:id/stage` and GET `?stage=`. */
export const LEAD_STAGE_API_OPTIONS = [...LEAD_STAGES]

/** Update-stage dropdown — same as pipeline. */
export const LEAD_STAGE_UPDATE_OPTIONS = [...LEAD_STAGES]

export const LEAD_STAGE_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  visit: 'Visit',
  not_interested: 'Not interested',
  enrolled: 'Enrolled',
  closed: 'Closed',
}

/** Old API/DB values → one of the 6 canonical stages (for display + filters). */
const LEGACY_STAGE_TO_CANONICAL = {
  visit_scheduled: 'visit',
  visited: 'visit',
  applied: 'enrolled',
  admitted: 'enrolled',
  lost: 'closed',
}

/**
 * Normalize any stage string to one of {@link LEAD_STAGES}.
 * @param {string} stage
 */
export function normalizeLeadStage(stage) {
  const s = String(stage ?? '').toLowerCase().trim()
  if (!s) return LEAD_STAGES[0]
  if (LEAD_STAGES.includes(s)) return s
  if (LEGACY_STAGE_TO_CANONICAL[s]) return LEGACY_STAGE_TO_CANONICAL[s]
  if (s.startsWith('visit')) return 'visit'
  return LEAD_STAGES[0]
}

export function leadStageIndexForStepper(stage) {
  const canonical = normalizeLeadStage(stage)
  const i = LEAD_STAGES.indexOf(canonical)
  return i >= 0 ? i : 0
}

/** Map API stage → dropdown / stepper value (always one of the 6). */
export function apiStageToUiStage(apiStage) {
  return normalizeLeadStage(apiStage)
}

/**
 * Map UI stage → PATCH body. Payload uses exactly the 6 keys:
 * `new` | `contacted` | `visit` | `not_interested` | `enrolled` | `closed`
 */
export function uiStageToApiStage(uiStage) {
  return normalizeLeadStage(uiStage)
}

/** GET `?stage=` filter — single canonical stage per selection. */
export function encodeLeadStageFilterForQuery(stageParam) {
  const s = String(stageParam ?? '').toLowerCase().trim()
  if (!s) return ''
  const canonical = normalizeLeadStage(s)
  return LEAD_STAGES.includes(canonical) ? canonical : ''
}

export const PTM_STATUS_LABELS = {
  [PTM_STATUS.REQUESTED]: 'Requested',
  [PTM_STATUS.APPROVED]: 'Approved',
  [PTM_STATUS.REJECTED]: 'Rejected',
  [PTM_STATUS.COMPLETED]: 'Completed',
  [PTM_STATUS.PENDING_PRINCIPAL]: 'pending ',
  [PTM_STATUS.PRINCIPAL_REJECTED]: 'declined',
}
