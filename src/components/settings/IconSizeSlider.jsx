import { Label } from '../ui/Label'

/**
 * @param {{ label: string, hint?: string, value: number, min: number, max: number, onChange: (n: number) => void, preview?: import('react').ReactNode }} props
 */
export function IconSizeSlider({ label, hint, value, min, max, onChange, preview }) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200/90 bg-slate-50/50 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="!mb-0">{label}</Label>
        <span className="text-sm font-semibold tabular-nums text-indigo-700">{value}px</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-indigo-600"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      />
      <div className="flex justify-between text-[11px] font-medium text-slate-400">
        <span>Small</span>
        <span>Large</span>
      </div>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {preview ? <div className="pt-1">{preview}</div> : null}
    </div>
  )
}
