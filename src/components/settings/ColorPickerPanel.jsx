import { useCallback, useEffect, useRef, useState } from 'react'
import { Input } from '../ui/Input'
import {
  hexToHsv,
  hsvToHex,
  hsvToRgb,
  parseHexColor,
  rgbToHex,
} from '../../utils/appBackgroundTheme'

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

/**
 * Saturation/value square + hue slider + hex field (image 2 style).
 * @param {{ value: string, onChange: (hex: string) => void }} props
 */
export function ColorPickerPanel({ value, onChange }) {
  const [hsv, setHsv] = useState(() => hexToHsv(value))
  const sbRef = useRef(null)
  const hueRef = useRef(null)
  const draggingSb = useRef(false)
  const draggingHue = useRef(false)

  useEffect(() => {
    setHsv(hexToHsv(value))
  }, [value])

  const emitHex = useCallback(
    (nextHsv) => {
      const hex = hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v)
      onChange(hex)
    },
    [onChange],
  )

  const updateFromSb = useCallback(
    (clientX, clientY) => {
      const el = sbRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const s = clamp((clientX - rect.left) / rect.width, 0, 1)
      const v = clamp(1 - (clientY - rect.top) / rect.height, 0, 1)
      const next = { ...hsv, s, v }
      setHsv(next)
      emitHex(next)
    },
    [emitHex, hsv],
  )

  const updateFromHue = useCallback(
    (clientX) => {
      const el = hueRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const h = clamp(((clientX - rect.left) / rect.width) * 360, 0, 360)
      const next = { ...hsv, h }
      setHsv(next)
      emitHex(next)
    },
    [emitHex, hsv],
  )

  useEffect(() => {
    const onMove = (e) => {
      if (draggingSb.current) updateFromSb(e.clientX, e.clientY)
      if (draggingHue.current) updateFromHue(e.clientX)
    }
    const onUp = () => {
      draggingSb.current = false
      draggingHue.current = false
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [updateFromHue, updateFromSb])

  const onHexInput = (e) => {
    const raw = e.target.value
    if (!raw.startsWith('#')) return
    const parsed = parseHexColor(raw)
    if (!parsed) return
    const next = hexToHsv(rgbToHex(parsed.r, parsed.g, parsed.b))
    setHsv(next)
    onChange(rgbToHex(parsed.r, parsed.g, parsed.b))
  }

  const hueRgb = hsvToRgb(hsv.h, 1, 1)
  const hueColor = rgbToHex(hueRgb.r, hueRgb.g, hueRgb.b)
  const currentRgb = hsvToRgb(hsv.h, hsv.s, hsv.v)
  const currentHex = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b)

  const sbX = `${hsv.s * 100}%`
  const sbY = `${(1 - hsv.v) * 100}%`

  return (
    <div className="w-full max-w-[280px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-indigo-700">Color conversion</p>

      <div
        ref={sbRef}
        className="relative h-44 w-full cursor-crosshair rounded-lg"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
        }}
        onPointerDown={(e) => {
          draggingSb.current = true
          updateFromSb(e.clientX, e.clientY)
        }}
      >
        <div
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/20"
          style={{ left: sbX, top: sbY, backgroundColor: currentHex }}
        />
      </div>

      <div
        ref={hueRef}
        className="relative mt-3 h-3 w-full cursor-pointer rounded-full"
        style={{
          background:
            'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
        }}
        onPointerDown={(e) => {
          draggingHue.current = true
          updateFromHue(e.clientX)
        }}
      >
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/15"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueColor }}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Input
          value={currentHex}
          onChange={onHexInput}
          className="font-mono text-sm uppercase"
          spellCheck={false}
          maxLength={7}
        />
        <div
          className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 shadow-inner"
          style={{ backgroundColor: currentHex }}
          title={currentHex}
        />
      </div>
    </div>
  )
}
