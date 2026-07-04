import { useMemo, useState } from 'react'
import { Badge } from '../ui/Badge'
import { audienceSummaryNoun, expandAudienceLabels } from '../../utils/notificationAudience'

const CHIP_CLASS = 'bg-indigo-50 text-indigo-900 ring-indigo-300/40'
const INITIAL_VISIBLE = 6

/**
 * “For” row — split classes into chips; first 6 shown, then show all (wraps, no scrollbar).
 */
export function AudienceForSection({
  labels,
  label: fallbackLabel,
  className = '',
  compact = false,
}) {
  const [expanded, setExpanded] = useState(false)

  const items = useMemo(() => {
    const fromLabels = expandAudienceLabels(labels)
    if (fromLabels.length) return fromLabels
    const fallback = String(fallbackLabel ?? '').trim()
    return fallback ? expandAudienceLabels([fallback]) : []
  }, [labels, fallbackLabel])

  if (!items.length) return null

  const noun = audienceSummaryNoun(items)
  const showToggle = items.length > INITIAL_VISIBLE
  const visible = expanded || !showToggle ? items : items.slice(0, INITIAL_VISIBLE)

  return (
    <div
      className={`${compact ? 'mt-4' : ''} border-t border-slate-100 pt-4 ${className}`.trim()}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">For</p>
        {items.length > 1 ? (
          <span className="text-xs font-medium text-slate-500">
            {items.length} {noun}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {visible.map((name) => (
          <Badge key={name} className={CHIP_CLASS}>
            {name}
          </Badge>
        ))}
      </div>

      {showToggle ? (
        <button
          type="button"
          className="mt-2 text-sm font-semibold text-indigo-600 transition hover:text-indigo-800"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : `Show all ${items.length} ${noun}`}
        </button>
      ) : null}
    </div>
  )
}
