import { memo, useCallback, useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { RgbaColorPicker } from 'react-colorful'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { PropertyRow } from './property-row'
import './color-picker.css'

interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** Parse a hex (#rrggbb / #rrggbbaa) or rgb()/rgba() string into {r,g,b,a}. */
function parseColor(input: string): Rgba {
  if (input) {
    if (input.startsWith('#')) {
      const hex = input.slice(1)
      if (hex.length === 6 || hex.length === 8) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
        }
      }
    }
    const m = /rgba?\(([^)]+)\)/i.exec(input)
    if (m) {
      const p = m[1]!.split(',').map((s) => parseFloat(s.trim()))
      return { r: p[0] ?? 255, g: p[1] ?? 255, b: p[2] ?? 255, a: p[3] ?? 1 }
    }
  }
  return { r: 255, g: 255, b: 255, a: 1 }
}

/** Serialise back to a CSS string: hex when fully opaque (backward-compatible
 *  with the hex-only paths), rgba() once opacity is dialled below 1. */
function toColorString(c: Rgba): string {
  if (c.a >= 1) {
    const h = (n: number) => `0${Math.round(n).toString(16)}`.slice(-2)
    return `#${h(c.r)}${h(c.g)}${h(c.b)}`
  }
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${Math.round(c.a * 100) / 100})`
}

interface ColorPickerProps {
  /** Current color value (hex or rgba string) */
  color: string
  /** Called when color is committed (picker closed) */
  onChange: (color: string) => void
  /** Called during drag for live preview */
  onLiveChange?: (color: string) => void
  /** Optional reset handler */
  onReset?: () => void
  /** Default color for reset comparison */
  defaultColor?: string
  /** Disable the picker */
  disabled?: boolean
  /** Preset color swatches to show */
  presets?: string[]
  /** Label for PropertyRow wrapper (omit for inline mode) */
  label?: string
}

/**
 * Unified color picker — saturation + hue + ALPHA via react-colorful's
 * RgbaColorPicker, in a Radix Popover (portaled + viewport-clamped, so it's
 * never clipped by the sidebar). Output is hex when fully opaque, rgba()
 * otherwise. Can be inline or wrapped in a PropertyRow.
 */
export const ColorPicker = memo(function ColorPicker({
  color,
  onChange,
  onLiveChange,
  onReset,
  defaultColor,
  disabled,
  presets,
  label,
}: ColorPickerProps) {
  const [localColor, setLocalColor] = useState(color)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setLocalColor(color)
  }, [color])

  const handlePickerChange = useCallback(
    (rgba: Rgba) => {
      const next = toColorString(rgba)
      setLocalColor(next)
      onLiveChange?.(next)
    },
    [onLiveChange],
  )

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onChange(localColor) // commit on close (outside-click / Esc via Radix)
      setIsOpen(open)
    },
    [localColor, onChange],
  )

  const handlePresetClick = useCallback(
    (preset: string) => {
      setLocalColor(preset)
      onChange(preset)
    },
    [onChange],
  )

  const pickerContent = (
    <div className="flex items-center gap-1 w-full">
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            type="button"
            className={`flex items-center gap-2 flex-1 min-w-0 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={disabled}
          >
            <div
              className="w-6 h-6 rounded border border-border flex-shrink-0"
              style={{ backgroundColor: localColor }}
            />
            <span className="text-xs font-mono text-muted-foreground uppercase truncate">
              {localColor}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-auto p-2">
          {presets && presets.length > 0 && (
            <div className="flex gap-1 mb-2">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className="w-6 h-6 rounded border border-border hover:ring-1 hover:ring-ring transition-all"
                  style={{ backgroundColor: preset }}
                  title={preset}
                />
              ))}
            </div>
          )}
          <div className="cp-picker">
            <RgbaColorPicker color={parseColor(localColor)} onChange={handlePickerChange} />
          </div>
        </PopoverContent>
      </Popover>

      {onReset && defaultColor && color !== defaultColor && !disabled && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={onReset}
          title="Reset"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  )

  if (label) {
    return <PropertyRow label={label}>{pickerContent}</PropertyRow>
  }

  return pickerContent
})
