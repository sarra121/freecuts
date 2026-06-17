/**
 * Broadcast-clean default styling for new shapes. Tuned to read on grass
 * and bright kit colors — drop shadow on arrows, semi-transparent white
 * fill on zones, full-opacity white strokes everywhere. User-applied
 * properties override these.
 *
 * See docs/superpowers/specs/2026-05-24-konva-shape-renderer-design.md.
 */

export const ARROW_DEFAULTS = {
  stroke: '#FFFFFF',
  fill: '#FFFFFF',
  // Bumped 3 → 5 so the arrow reads at typical playback zoom levels without
  // looking miniscule. The pointer head sizes are bumped proportionally
  // (head ~3x stroke width keeps the head from looking puny on the line).
  strokeWidth: 5,
  pointerLength: 20,
  pointerWidth: 20,
  dash: 'solid' as const,
  shadowColor: 'rgba(0, 0, 0, 0.6)',
  shadowBlur: 4,
  shadowOffsetX: 1,
  shadowOffsetY: 1,
  shadowOpacity: 0.35,
}

export const FREE_POLYGON_DEFAULTS = {
  fill: 'rgba(255, 255, 255, 0.18)',
  stroke: '#FFFFFF',
  strokeWidth: 2,
  closed: true,
}

export const PARAMETRIC_SHAPE_DEFAULTS = {
  fill: 'rgba(255, 255, 255, 0.18)',
  stroke: '#FFFFFF',
  strokeWidth: 2,
}

/**
 * Default field-ring config. `fill` is the band colour; the rest map to
 * FieldRingData. Tuned to read on grass. See
 * docs/superpowers/specs/2026-06-04-field-ring-shape-design.md.
 */
export const FIELD_RING_DEFAULTS = {
  fill: '#2f97ff',
  squash: 0.34,
  bandThickness: 14,
  segments: 6,
  continuous: false,
  gapRatio: 0.42,
  roundedEnds: true,
  extrusionHeight: 6,
  spin: true,
  spinSpeed: 0.25,
  contactShadow: true,
} as const

/**
 * Defaults for a connected-rings group. `ring` is the shared appearance for
 * every node ring (a FieldRingData). nodeRadius is the shared ring radius;
 * connectorColor/Width style the undirected links between rings.
 */
export const CONNECTED_RINGS_DEFAULTS = {
  nodeRadius: 70,
  connectorColor: '#2f97ff',
  connectorWidth: 6,
  ring: {
    squash: 0.34,
    bandThickness: 12,
    segments: 6,
    continuous: false,
    gapRatio: 0.42,
    roundedEnds: true,
    extrusionHeight: 5,
    spin: true,
    spinSpeed: 0.25,
    contactShadow: true,
  },
} as const

/**
 * Default player spotlight. `fill` is the light colour. width/height are the
 * default beam footprint (beam width = 2× base radius is enforced by the
 * renderer, which derives the base from transform.width).
 */
export const SPOTLIGHT_DEFAULTS = {
  fill: '#ffd900',
  width: 120,
  height: 340,
  intensity: 1,
  pool: true,
  bloom: true,
  cutout: true,
  cutoutWidth: 52,
  cutoutHeight: 180,
} as const

/**
 * Default editable text label. `fill` is the text colour; width is the default
 * wrap width (transform.width). Tuned to read on grass.
 */
export const TEXT_DEFAULTS = {
  fill: '#FFFFFF',
  content: 'Double-click to edit',
  fontSize: 48,
  fontFamily: 'Arial, sans-serif',
  align: 'left' as const,
  skewX: 0,
  skewY: 0,
  width: 360,
} as const

/**
 * Default image overlay. A freshly placed image is fit so its longest side is
 * `maxSize` px (aspect preserved), drawn fully opaque and unskewed; the user
 * then adjusts opacity/skew in the properties panel.
 */
export const IMAGE_DEFAULTS = {
  maxSize: 320,
  skewX: 0,
  skewY: 0,
} as const

/**
 * Default timeline-synced timer. Monospace so the digits don't jitter as the
 * clock ticks. Green broadcast colour like the legacy timer.
 */
export const TIMER_DEFAULTS = {
  fill: '#00FF41',
  mode: 'up' as const,
  offsetSec: 0,
  durationSec: 60,
  format: 'mm:ss' as const,
  fontSize: 56,
  fontFamily: "'Courier New', monospace",
  width: 240,
} as const

export interface TacticalPresetColor {
  id: string
  label: string
  hex: string
}

export const TACTICAL_PRESET_COLORS: readonly TacticalPresetColor[] = [
  { id: 'red', label: 'Attack', hex: '#E63946' },
  { id: 'blue', label: 'Defense', hex: '#1845C8' },
  { id: 'yellow', label: 'Ball / Key', hex: '#F5A623' },
  { id: 'white', label: 'Neutral', hex: '#FFFFFF' },
  { id: 'green', label: 'Open space', hex: '#2A9D8F' },
  { id: 'orange', label: 'Pressure', hex: '#F4A261' },
]

/**
 * Convert a `dash` style to a Konva `dash` array.
 * Returns `undefined` for solid lines so Konva omits the dash attribute.
 */
export function dashToArray(
  dash: 'solid' | 'dashed' | 'dotted' | undefined,
): number[] | undefined {
  if (dash === 'dashed') return [10, 6]
  if (dash === 'dotted') return [2, 6]
  return undefined
}
