import { LEAD_STAGES, LEAD_STAGE_LABELS, leadStageIndexForStepper } from '../../data/phase6Constants'

export function LeadStageStepper({ currentStage }) {
  const idx = leadStageIndexForStepper(currentStage)
  return (
    <div className="flex flex-wrap items-center gap-1 sm:gap-2" aria-label="Lead stage">
      {LEAD_STAGES.map((stage, i) => {
        const done = i < idx
        const active = i === idx
        return (
          <div key={stage} className="flex items-center gap-1 sm:gap-2">
            {i > 0 ? (
              <span
                className={`hidden h-px w-4 sm:block ${done || active ? 'bg-indigo-400' : 'bg-slate-200'}`}
                aria-hidden
              />
            ) : null}
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide sm:text-xs ${
                active
                  ? 'sm-btn-active-pill shadow-md ring-1 ring-black/10'
                  : done
                    ? 'bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200/80'
                    : 'bg-slate-100 text-slate-400 ring-1 ring-slate-200/80'
              }`}
            >
              {LEAD_STAGE_LABELS[stage] ?? stage}
            </span>
          </div>
        )
      })}
    </div>
  )
}
