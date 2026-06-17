/**
 * Pure geometry + spin math for the field-ring shape. Kept dependency-free
 * so the Konva renderer and a future Canvas-2D export mirror can share the
 * exact same numbers (so preview and export match).
 */

/**
 * Darken a 6-digit hex colour by a factor (0..1). Falls back to the input if
 * the colour is not a 6-digit hex (e.g. an rgba string) — extrusion then just
 * reuses the same colour. Lives here (dependency-free) so both the Konva
 * preview and the Canvas-2D export mirror produce identical wall shading.
 */
export function darken(hex: string, f: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1]!, 16)
  const r = ((n >> 16) & 255) * f
  const g = ((n >> 8) & 255) * f
  const b = (n & 255) * f
  return `rgb(${r | 0}, ${g | 0}, ${b | 0})`
}

/** Ramanujan's approximation of an ellipse perimeter. */
export function ellipsePerimeter(rx: number, ry: number): number {
  if (rx <= 0 && ry <= 0) return 0
  const h = Math.pow(rx - ry, 2) / Math.pow(rx + ry, 2)
  return Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
}

/**
 * Dash array [segmentLength, gapLength] for the band, distributed evenly
 * over the perimeter. Returns undefined for a continuous (unbroken) band.
 */
export function computeDash(
  perimeter: number,
  segments: number,
  gapRatio: number,
  continuous: boolean,
): number[] | undefined {
  if (continuous || segments <= 0 || perimeter <= 0) return undefined
  const spacing = perimeter / segments
  const gap = Math.min(Math.max(gapRatio, 0), 0.9)
  return [Math.max(spacing * (1 - gap), 0.5), Math.max(spacing * gap, 0.5)]
}

/**
 * Frame-locked dash offset for spin. Pure function of the timeline frame so
 * scrubbing shows the correct phase and a future export renderer matches.
 * spinSpeed is revolutions/sec (signed). Result is negative so segments
 * appear to march "forward" around the ring.
 */
export function computeSpinDashOffset(
  frame: number,
  fromFrame: number,
  fps: number,
  spinSpeed: number,
  perimeter: number,
): number {
  if (fps <= 0 || perimeter <= 0) return 0
  const elapsedSec = (frame - fromFrame) / fps
  const revolutions = spinSpeed * elapsedSec
  const frac = revolutions - Math.floor(revolutions) // 0..1, handles negatives
  return frac === 0 ? 0 : -frac * perimeter // avoid -0
}

/**
 * Distance from an ellipse centre to its boundary in the direction (dx, dy).
 * Used to attach connectors to the ring edge instead of the centre.
 */
export function ellipseRadiusInDirection(rx: number, ry: number, dx: number, dy: number): number {
  const len = Math.hypot(dx, dy)
  if (len === 0) return 0
  const cos = dx / len
  const sin = dy / len
  const denom = Math.sqrt((ry * cos) ** 2 + (rx * sin) ** 2)
  return denom === 0 ? 0 : (rx * ry) / denom
}

/**
 * Endpoints [ax', ay', bx', by'] of an undirected link between two ring
 * centres, each pulled back to that ring's edge plus a buffer so the
 * connector lingers OUTSIDE the rings (mirrors the reference
 * getConnectorPoints, adapted to squashed ellipses). Returns null when the
 * rings are so close the link would invert (overlapping rings → no link).
 */
export function connectorEndpoints(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  rx: number,
  ry: number,
  buffer = 0,
): [number, number, number, number] | null {
  const dx = bx - ax
  const dy = by - ay
  const dist = Math.hypot(dx, dy)
  if (dist === 0) return null
  const ux = dx / dist
  const uy = dy / dist
  const ra = ellipseRadiusInDirection(rx, ry, dx, dy) + buffer
  const rb = ellipseRadiusInDirection(rx, ry, -dx, -dy) + buffer
  if (ra + rb >= dist) return null // rings overlap — skip the link
  return [ax + ux * ra, ay + uy * ra, bx - ux * rb, by - uy * rb]
}
