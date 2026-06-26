import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { coerceHexColor } from '../../utils/appBackgroundTheme'

export function CompactColorField({ label, value, onChange, hint }) {
  const safe = coerceHexColor(value, '#ffffff')

  const onHexInput = (e) => {
    const next = e.target.value.trim()
    if (/^#[0-9A-Fa-f]{0,6}$/.test(next)) onChange(next)
  }

  const onHexBlur = (e) => {
    onChange(coerceHexColor(e.target.value, safe))
  }

  return (
    <div className="min-w-0 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <Label variant="compact" className="mb-2 text-slate-800">
        {label}
      </Label>
      <div className="flex items-center gap-2.5">
        <label className="relative shrink-0 cursor-pointer">
          <span
            className="block h-11 w-11 rounded-lg border border-slate-200 shadow-inner"
            style={{ backgroundColor: safe }}
          />
          <input
            type="color"
            value={safe}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${label} color picker`}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
        <Input
          value={safe}
          onChange={onHexInput}
          onBlur={onHexBlur}
          className="font-mono text-sm uppercase"
          spellCheck={false}
          maxLength={7}
        />
      </div>
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}
