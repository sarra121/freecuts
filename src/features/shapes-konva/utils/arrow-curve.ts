/**
 * Math helpers for the curved-arrow (quadratic Bezier) variant.
 *
 * Data model recap (see `ArrowData` in `types/timeline.ts`):
 *  - `fromX/Y, toX/Y` — the two endpoints (P0, P2).
 *  - `controlX/Y` — optional quadratic-Bezier control point (P1). When
 *    undefined, the arrow renders as a straight line.
 *
 * UX model: the "curve handle" the user drags is rendered at the visible
 * apex of the curve (i.e. on the curve at t=0.5), NOT at the control point
 * P1 (which sits off the curve for any non-zero curvature). So we need two
 * conversions:
 *  - `curveMidpoint(from, to, control)` — where to draw the handle.
 *  - `controlFromMidpoint(from, to, mid)` — where to put P1 so that the
 *    curve passes through `mid` at t=0.5 when the user drags the handle.
 *
 * Quadratic Bezier:  B(t) = (1-t)² P0 + 2(1-t)t P1 + t² P2
 *
 *   B(0.5) = 0.25 P0 + 0.5 P1 + 0.25 P2
 *          ⇒ P1 = 2 B(0.5) − 0.5 (P0 + P2)
 *
 * That's all this file is. Stays pure / no React.
 */

import type { ArrowData } from '@/types/timeline'

export interface Point {
  x: number
  y: number
}

/** Visible apex of the curve at t=0.5 (where we draw the curve handle). */
export function curveMidpoint(from: Point, to: Point, control: Point): Point {
  return {
    x: 0.25 * from.x + 0.5 * control.x + 0.25 * to.x,
    y: 0.25 * from.y + 0.5 * control.y + 0.25 * to.y,
  }
}

/** Inverse of `curveMidpoint`: given a desired apex, return the P1
 *  control point that makes the Bezier pass through it at t=0.5. */
export function controlFromMidpoint(from: Point, to: Point, mid: Point): Point {
  return {
    x: 2 * mid.x - 0.5 * (from.x + to.x),
    y: 2 * mid.y - 0.5 * (from.y + to.y),
  }
}

/** Straight-line midpoint of the two endpoints — used as the default
 *  curve-handle position when no control point is set yet (a "flat"
 *  curve is one whose apex equals the line midpoint). */
export function lineMidpoint(from: Point, to: Point): Point {
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
}

/** Tangent direction at t=1 of a quadratic Bezier — used to orient the
 *  arrowhead when rendering the curved variant.
 *  dB/dt at t=1 = 2 (P2 − P1). */
export function tangentAtEnd(to: Point, control: Point): Point {
  return { x: 2 * (to.x - control.x), y: 2 * (to.y - control.y) }
}

/** Decompose a point into chord-relative fractions: `along` (projection on
 *  the from→to direction) and `bow` (perpendicular offset), both as
 *  fractions of the chord length so the shape scales/rotates with the chord. */
function decomposeChord(from: Point, to: Point, p: Point): { along: number; bow: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len // along-unit
  const px = p.x - from.x
  const py = p.y - from.y
  return {
    along: (px * ux + py * uy) / len,
    bow: (px * -uy + py * ux) / len, // perpendicular = (-uy, ux)
  }
}

/** Inverse of decomposeChord: rebuild the point for a (possibly new) chord. */
function recomposeChord(from: Point, to: Point, rel: { along: number; bow: number }): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  return {
    x: from.x + rel.along * len * ux + rel.bow * len * -uy,
    y: from.y + rel.along * len * uy + rel.bow * len * ux,
  }
}

/**
 * Move one arrow endpoint (index 0 = from, 1 = to), returning a full new
 * ArrowData. If the arrow is curved, the control point is RE-ANCHORED so the
 * bend keeps its shape relative to the chord — otherwise the absolute control
 * point would warp the curve when an endpoint moves (the reported bug).
 */
export function moveArrowEndpoint(
  a: ArrowData,
  index: 0 | 1,
  x: number,
  y: number,
): ArrowData {
  const oldFrom: Point = { x: a.fromX, y: a.fromY }
  const oldTo: Point = { x: a.toX, y: a.toY }
  const next: ArrowData = { ...a }
  if (index === 0) {
    next.fromX = x
    next.fromY = y
  } else {
    next.toX = x
    next.toY = y
  }
  if (a.controlX != null && a.controlY != null) {
    // Preserve the visible bend: capture the apex relative to the OLD chord,
    // then rebuild the control point for the NEW chord.
    const apex = curveMidpoint(oldFrom, oldTo, { x: a.controlX, y: a.controlY })
    const rel = decomposeChord(oldFrom, oldTo, apex)
    const newFrom: Point = { x: next.fromX, y: next.fromY }
    const newTo: Point = { x: next.toX, y: next.toY }
    const newApex = recomposeChord(newFrom, newTo, rel)
    const control = controlFromMidpoint(newFrom, newTo, newApex)
    next.controlX = control.x
    next.controlY = control.y
  }
  return next
}
