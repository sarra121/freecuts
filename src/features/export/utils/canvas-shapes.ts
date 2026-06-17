/**
 * Canvas Shape Rendering System
 *
 * Renders all shape types with full styling support for client-side export.
 * Leverages existing shape-path utilities and converts SVG paths to Path2D.
 */

import type { ShapeItem } from '@/types/timeline'
import type { ResolvedTransform } from '@/types/transform'
import { getShapePath, rotatePath } from '@/features/export/deps/composition-runtime'
import {
  darken,
  ellipsePerimeter,
  computeDash,
  computeSpinDashOffset,
  connectorEndpoints,
} from '@/features/export/deps/shapes-konva'
import { svgPathToPath2D } from './canvas-masks'
import type { RenderImageSource } from './canvas-item-renderer/types'
import { createLogger } from '@/shared/logging/logger'

const log = createLogger('CanvasShapes')

/**
 * Canvas dimensions + frame context for shape rendering.
 *
 * `frame` / `fps` carry the absolute project frame and the export FPS so
 * frame-locked shapes (field-ring spin, timer countdown) can compute their
 * state as a pure function of the playhead — exactly as the Konva preview does.
 */
interface ShapeCanvasSettings {
  width: number
  height: number
  frame: number
  fps: number
  /** Preloaded picture for the image-overlay shape (resolved + decoded by the
   *  export engine). Undefined for every other shape type. */
  imageSource?: RenderImageSource
}

/**
 * Get a Path2D for a shape at its current transform.
 *
 * @param shape - The shape item
 * @param transform - Resolved transform (possibly animated)
 * @param canvas - Canvas dimensions
 * @returns Path2D ready for canvas rendering
 */
function getShapePath2D(
  shape: ShapeItem,
  transform: ResolvedTransform,
  canvas: ShapeCanvasSettings,
): Path2D {
  // Use existing shape-path utility to generate SVG path
  const svgPath = getShapePath(
    shape,
    {
      x: transform.x,
      y: transform.y,
      width: transform.width,
      height: transform.height,
      rotation: 0, // Rotation handled separately
      opacity: transform.opacity,
    },
    {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    },
  )

  // Apply rotation by baking it into the path coordinates
  let finalPath = svgPath
  if (transform.rotation !== 0) {
    const centerX = canvas.width / 2 + transform.x
    const centerY = canvas.height / 2 + transform.y
    finalPath = rotatePath(svgPath, transform.rotation, centerX, centerY)
  }

  return svgPathToPath2D(finalPath)
}

// MatchView defaults — kept aligned with utils/defaults.ts in the
// shapes-konva feature. Duplicated rather than imported because the
// export feature must not cross-import from shapes-konva (the
// `check:boundaries` rule), and these are constants the renderer
// needs as fallbacks when the item leaves them unset.
const ARROW_FALLBACK = {
  stroke: '#FFFFFF',
  fill: '#FFFFFF',
  strokeWidth: 5,
  pointerLength: 20,
  pointerWidth: 20,
  shadowColor: 'rgba(0, 0, 0, 0.6)',
  shadowBlur: 4,
  shadowOffsetX: 1,
  shadowOffsetY: 1,
  shadowOpacity: 0.35,
}
const FREE_POLY_FALLBACK = {
  fill: 'rgba(255, 255, 255, 0.18)',
  stroke: '#FFFFFF',
  strokeWidth: 2,
}
// Mirror of FIELD_RING_DEFAULTS in shapes-konva/utils/defaults.ts. Duplicated
// (not imported) because defaults.ts lives behind the shapes-konva feature and
// only the pure geometry is worker-safe to import; these are the renderer's
// fallbacks when the item leaves a field unset.
const FIELD_RING_FALLBACK = {
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
}
// Mirror of CONNECTED_RINGS_DEFAULTS in shapes-konva/utils/defaults.ts.
const CONNECTED_RINGS_FALLBACK = {
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
}

// Shape types that getShapePath() actually understands (everything else hits
// its rectangle fallback). Used to gate the parametric path so un-mirrored
// shapes don't paint a full fillColor rectangle.
const PARAMETRIC_SHAPE_TYPES = new Set<string>([
  'rectangle',
  'circle',
  'ellipse',
  'triangle',
  'star',
  'polygon',
  'heart',
  'path',
])

// Mirror of SPOTLIGHT_DEFAULTS in shapes-konva/utils/defaults.ts.
const SPOTLIGHT_FALLBACK = {
  fill: '#ffd900',
  intensity: 1,
  pool: true,
  bloom: true,
  cutout: true,
  cutoutWidth: 52,
  cutoutHeight: 180,
}

/** `rgba()` string from a 6-digit hex + alpha (mirrors spotlight-shape's rgba). */
function hexRgba(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  let r = 255
  let g = 217
  let b = 0
  if (m) {
    const n = parseInt(m[1]!, 16)
    r = (n >> 16) & 255
    g = (n >> 8) & 255
    b = n & 255
  }
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function dashToArray(
  dash: 'solid' | 'dashed' | 'dotted' | undefined,
): number[] | undefined {
  if (dash === 'dashed') return [10, 6]
  if (dash === 'dotted') return [2, 6]
  return undefined
}

/**
 * Render an arrow item to the export canvas.
 *
 * The arrow stores its geometry as absolute canvas-pixel coordinates
 * (fromX, fromY, toX, toY, controlX/Y for the curved variant) — it
 * does NOT use the transform.x/y/width/height system the parametric
 * shapes use. So we ignore that part of the transform entirely and
 * draw directly into the canvas. Only `transform.opacity` is honored.
 *
 * Mirrors the preview render in `shapes-konva/shapes/arrow-shape.tsx`:
 *  - When `controlX/Y` are set, draw a quadratic Bezier body and orient
 *    the arrowhead along the tangent at t=1 (= 2·(P2−P1)).
 *  - Otherwise draw a straight line and orient the head along it.
 *  - Body and head share the stroke; only the head is filled.
 *  - Drop shadow + dash style match the Konva-side defaults.
 */
function renderArrowToCanvas(
  ctx: OffscreenCanvasRenderingContext2D,
  shape: ShapeItem,
  opacity: number,
): void {
  const a = shape.arrowData
  if (!a) return
  const stroke = shape.strokeColor ?? ARROW_FALLBACK.stroke
  const fill = shape.fillColor ?? ARROW_FALLBACK.fill
  const strokeWidth = shape.strokeWidth ?? ARROW_FALLBACK.strokeWidth
  const pointerLength = a.pointerLength ?? ARROW_FALLBACK.pointerLength
  const pointerWidth = a.pointerWidth ?? ARROW_FALLBACK.pointerWidth
  const dash = dashToArray(a.dash)
  const hasControl = a.controlX != null && a.controlY != null

  ctx.globalAlpha = opacity
  ctx.shadowColor = ARROW_FALLBACK.shadowColor
  ctx.shadowBlur = ARROW_FALLBACK.shadowBlur
  ctx.shadowOffsetX = ARROW_FALLBACK.shadowOffsetX
  ctx.shadowOffsetY = ARROW_FALLBACK.shadowOffsetY

  // Body (line or quadratic Bezier). Stroke only — no fill.
  ctx.beginPath()
  ctx.moveTo(a.fromX, a.fromY)
  if (hasControl) {
    ctx.quadraticCurveTo(a.controlX!, a.controlY!, a.toX, a.toY)
  } else {
    ctx.lineTo(a.toX, a.toY)
  }
  ctx.strokeStyle = stroke
  ctx.lineWidth = strokeWidth
  if (dash) ctx.setLineDash(dash)
  ctx.stroke()
  ctx.setLineDash([]) // clear so the head stays solid even on dashed arrows

  // Arrowhead — closed filled triangle, oriented along the tangent.
  // For the curved variant the tangent at t=1 is 2·(P2−P1); for the
  // straight variant it's just the line direction.
  const tx = hasControl ? a.toX - a.controlX! : a.toX - a.fromX
  const ty = hasControl ? a.toY - a.controlY! : a.toY - a.fromY
  const angle = Math.atan2(ty, tx)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const baseX = a.toX - pointerLength * cos
  const baseY = a.toY - pointerLength * sin
  const halfW = pointerWidth / 2
  const leftX = baseX + halfW * sin
  const leftY = baseY - halfW * cos
  const rightX = baseX - halfW * sin
  const rightY = baseY + halfW * cos

  ctx.beginPath()
  ctx.moveTo(a.toX, a.toY)
  ctx.lineTo(leftX, leftY)
  ctx.lineTo(rightX, rightY)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.stroke()
}

/**
 * Render a free-polygon item to the export canvas.
 *
 * Vertices are stored as `[x0, y0, x1, y1, …]` in absolute canvas-pixel
 * coords (same model as Arrow above). When `closed` is true, the path
 * closes and gets a fill; when false, just stroke a polyline.
 *
 * Mirrors `shapes-konva/shapes/free-polygon-shape.tsx`.
 */
function renderFreePolygonToCanvas(
  ctx: OffscreenCanvasRenderingContext2D,
  shape: ShapeItem,
  opacity: number,
): void {
  const data = shape.freePolygonData
  if (!data) return
  const v = data.vertices
  if (v.length < 4) return
  const stroke = shape.strokeColor ?? FREE_POLY_FALLBACK.stroke
  const fill = shape.fillColor ?? FREE_POLY_FALLBACK.fill
  const strokeWidth = shape.strokeWidth ?? FREE_POLY_FALLBACK.strokeWidth

  ctx.globalAlpha = opacity
  ctx.beginPath()
  ctx.moveTo(v[0]!, v[1]!)
  for (let i = 2; i < v.length; i += 2) {
    ctx.lineTo(v[i]!, v[i + 1]!)
  }
  if (data.closed) ctx.closePath()

  if (data.closed && fill) {
    ctx.fillStyle = fill
    ctx.fill()
  }
  if (strokeWidth > 0 && stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = strokeWidth
    ctx.stroke()
  }
}

// The per-ring appearance shared by a standalone field-ring and every node of
// a connected-rings group (mirrors FieldRingData minus the spin fields, which
// are folded into the precomputed dashOffset).
interface RingStyle {
  fill: string
  bandThickness: number
  segments: number
  continuous: boolean
  gapRatio: number
  roundedEnds: boolean
  extrusionHeight: number
  contactShadow: boolean
}

/**
 * Draw ONE field ring centred at (cx, cy) in the current canvas coordinate
 * space. Mirrors `fieldRingNodes()` in shapes-konva exactly: an optional
 * contact shadow, a stack of darkened "wall" ellipse strokes (the extrusion),
 * then the bright top band — all dashed ellipse strokes sharing one dash
 * offset so the segments appear to spin.
 *
 * `dashOffset` is the caller-precomputed, frame-locked spin phase. Resets the
 * line dash on exit so a following solid stroke (e.g. connector links) starts
 * clean.
 */
function drawFieldRingAt(
  ctx: OffscreenCanvasRenderingContext2D,
  cx: number,
  cy: number,
  radiusX: number,
  squash: number,
  style: RingStyle,
  dashOffset: number,
): void {
  if (radiusX <= 0) return
  const radiusY = radiusX * squash
  const perimeter = ellipsePerimeter(radiusX, radiusY)
  const dash = computeDash(perimeter, style.segments, style.gapRatio, style.continuous)
  const lineCap: CanvasLineCap = style.roundedEnds ? 'round' : 'butt'

  // Contact shadow: a soft dark ellipse sitting just below the ring base.
  if (style.contactShadow) {
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.ellipse(cx, cy + style.extrusionHeight + 3, radiusX, Math.max(radiusY, 6), 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.30)'
    ctx.fill()
    ctx.restore()
  }

  ctx.setLineDash(dash ?? [])
  ctx.lineDashOffset = dashOffset
  ctx.lineCap = lineCap

  // Extruded wall: darker copies stacked downward, painted back-to-front.
  for (let i = style.extrusionHeight; i >= 1; i--) {
    const f = 0.34 + 0.26 * (1 - i / Math.max(style.extrusionHeight, 1))
    ctx.beginPath()
    ctx.ellipse(cx, cy + i, radiusX, radiusY, 0, 0, Math.PI * 2)
    ctx.strokeStyle = darken(style.fill, f)
    ctx.lineWidth = Math.max(style.bandThickness - 1, 1)
    ctx.stroke()
  }

  // Bright top band.
  ctx.beginPath()
  ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2)
  ctx.strokeStyle = style.fill
  ctx.lineWidth = style.bandThickness
  ctx.stroke()

  ctx.setLineDash([]) // leave dashing clean for any following solid stroke
}

/**
 * Render a standalone field-ring item to the export canvas.
 *
 * Coordinate model: like the parametric shapes, the ring is centre-relative —
 * its centre in canvas pixels is `canvasCentre + transform.x/y` and the radius
 * comes from `transform.width / 2`. Rotation/flip are already applied to the
 * context by applyItemTransformToContext() in render-item.ts (around this same
 * centre), so we don't rotate again here.
 *
 * Spin: the preview uses a wall-clock RAF ticker, but export MUST be a pure
 * function of the output frame, so we use `computeSpinDashOffset(frame,
 * shape.from, fps, …)` — the deterministic, frame-locked formula.
 */
function renderFieldRingToCanvas(
  ctx: OffscreenCanvasRenderingContext2D,
  shape: ShapeItem,
  transform: ResolvedTransform,
  canvas: ShapeCanvasSettings,
): void {
  const d = shape.fieldRingData
  const radiusX = transform.width / 2
  if (radiusX <= 0) return
  const squash = d?.squash ?? FIELD_RING_FALLBACK.squash
  const spin = d?.spin ?? FIELD_RING_FALLBACK.spin
  const spinSpeed = d?.spinSpeed ?? FIELD_RING_FALLBACK.spinSpeed
  const style: RingStyle = {
    fill: shape.fillColor ?? FIELD_RING_FALLBACK.fill,
    bandThickness: d?.bandThickness ?? FIELD_RING_FALLBACK.bandThickness,
    segments: d?.segments ?? FIELD_RING_FALLBACK.segments,
    continuous: d?.continuous ?? FIELD_RING_FALLBACK.continuous,
    gapRatio: d?.gapRatio ?? FIELD_RING_FALLBACK.gapRatio,
    roundedEnds: d?.roundedEnds ?? FIELD_RING_FALLBACK.roundedEnds,
    extrusionHeight: d?.extrusionHeight ?? FIELD_RING_FALLBACK.extrusionHeight,
    contactShadow: d?.contactShadow ?? FIELD_RING_FALLBACK.contactShadow,
  }
  const perimeter = ellipsePerimeter(radiusX, radiusX * squash)
  const dashOffset = spin
    ? computeSpinDashOffset(canvas.frame, shape.from, canvas.fps, spinSpeed, perimeter)
    : 0

  const cx = canvas.width / 2 + transform.x
  const cy = canvas.height / 2 + transform.y

  ctx.globalAlpha = transform.opacity
  drawFieldRingAt(ctx, cx, cy, radiusX, squash, style, dashOffset)
}

/**
 * Render a connected-rings group to the export canvas.
 *
 * Mirrors `ConnectedRingsShape` in shapes-konva: ring centres are the
 * `freePolygonData.vertices` (absolute canvas-pixel coords, like arrow /
 * free-polygon — so we ignore transform position/size and only honour
 * `transform.opacity`). Consecutive centres are joined by an undirected link
 * that stops at each ring's edge (plus the closing pair when `closed`); links
 * render BEHIND the rings. Every ring shares one frame-locked spin phase.
 */
function renderConnectedRingsToCanvas(
  ctx: OffscreenCanvasRenderingContext2D,
  shape: ShapeItem,
  transform: ResolvedTransform,
  canvas: ShapeCanvasSettings,
): void {
  const poly = shape.freePolygonData
  if (!poly || poly.vertices.length < 2) return
  const data = shape.connectedRingsData
  const nodeRadius = data?.nodeRadius ?? CONNECTED_RINGS_FALLBACK.nodeRadius
  const ring = data?.ring ?? CONNECTED_RINGS_FALLBACK.ring
  const connectorColor = data?.connectorColor ?? CONNECTED_RINGS_FALLBACK.connectorColor
  const connectorWidth = data?.connectorWidth ?? CONNECTED_RINGS_FALLBACK.connectorWidth

  const radiusX = nodeRadius
  const radiusY = nodeRadius * ring.squash
  const perimeter = ellipsePerimeter(radiusX, radiusY)
  const dashOffset = ring.spin
    ? computeSpinDashOffset(canvas.frame, shape.from, canvas.fps, ring.spinSpeed, perimeter)
    : 0

  const v = poly.vertices
  const count = Math.floor(v.length / 2)
  const centres: { x: number; y: number }[] = []
  for (let i = 0; i < count; i++) {
    centres.push({ x: v[i * 2] ?? 0, y: v[i * 2 + 1] ?? 0 })
  }

  ctx.globalAlpha = transform.opacity

  // Connectors first (behind the rings). Undirected links pulled back to each
  // ring's edge; skipped when the rings overlap (connectorEndpoints → null).
  ctx.setLineDash([])
  ctx.lineCap = 'round'
  ctx.strokeStyle = connectorColor
  ctx.lineWidth = connectorWidth
  const lastIndex = poly.closed ? count : count - 1
  for (let i = 0; i < lastIndex; i++) {
    const a = centres[i]!
    const b = centres[(i + 1) % count]!
    const pts = connectorEndpoints(a.x, a.y, b.x, b.y, radiusX, radiusY, 2)
    if (!pts) continue
    ctx.beginPath()
    ctx.moveTo(pts[0], pts[1])
    ctx.lineTo(pts[2], pts[3])
    ctx.stroke()
  }

  // Rings on top — every node shares the group's appearance + spin phase.
  const style: RingStyle = {
    fill: shape.fillColor ?? connectorColor,
    bandThickness: ring.bandThickness,
    segments: ring.segments,
    continuous: ring.continuous,
    gapRatio: ring.gapRatio,
    roundedEnds: ring.roundedEnds,
    extrusionHeight: ring.extrusionHeight,
    contactShadow: ring.contactShadow,
  }
  for (const c of centres) {
    drawFieldRingAt(ctx, c.x, c.y, radiusX, ring.squash, style, dashOffset)
  }
}

/**
 * Render an image-overlay shape to the export canvas.
 *
 * Mirrors `ImageShape` in shapes-konva: the picture is drawn into the
 * transform's box (centre-relative like the parametric shapes) with the same
 * skew shear as the preview. The picture itself is preloaded by the export
 * engine and handed in via `canvas.imageSource`; opacity is already applied to
 * the context by render-item.ts, and rotation/flip by applyItemTransformToContext.
 *
 * Konva's `skew(sx, sy)` composes to the matrix [1, sy, sx, 1]; the canvas
 * equivalent is `ctx.transform(1, skewY, skewX, 1, 0, 0)` with skew as a tan()
 * factor of the stored degrees — identical shear to the preview.
 */
function renderImageShapeToCanvas(
  ctx: OffscreenCanvasRenderingContext2D,
  shape: ShapeItem,
  transform: ResolvedTransform,
  canvas: ShapeCanvasSettings,
): void {
  const src = canvas.imageSource
  if (!src) return // not loaded / unavailable — skip rather than draw garbage
  const width = transform.width
  const height = transform.height
  if (width <= 0 || height <= 0) return

  const d = shape.imageShapeData
  const skewX = Math.tan(((d?.skewX ?? 0) * Math.PI) / 180)
  const skewY = Math.tan(((d?.skewY ?? 0) * Math.PI) / 180)

  const left = canvas.width / 2 + transform.x - width / 2
  const top = canvas.height / 2 + transform.y - height / 2

  ctx.translate(left, top)
  ctx.transform(1, skewY, skewX, 1, 0, 0)
  ctx.drawImage(src, 0, 0, width, height)
}

// Mirror of TEXT_DEFAULTS in shapes-konva/utils/defaults.ts.
const TEXT_SHAPE_FALLBACK = {
  fill: '#FFFFFF',
  content: '',
  fontSize: 48,
  fontFamily: 'Arial, sans-serif',
  align: 'left' as const,
  skewX: 0,
  skewY: 0,
}

/** Greedy word-wrap at `maxWidth`, honouring explicit newlines. ctx.font must
 *  already be set. Mirrors the Konva <Text> wrap (no padding). */
function wrapTextForWidth(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (para === '') {
      out.push('')
      continue
    }
    let line = ''
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word
      if (line && ctx.measureText(test).width > maxWidth) {
        out.push(line)
        line = word
      } else {
        line = test
      }
    }
    if (line) out.push(line)
  }
  return out.length > 0 ? out : ['']
}

/**
 * Render a text-label shape to the export canvas. Mirrors `TextShape` in
 * shapes-konva (a Konva <Text> inside a non-centred ParametricShapeBody): the
 * label's top-left is `canvasCentre + transform.x/y`, it word-wraps at
 * transform.width, and skewX/skewY shear it (tan() of the stored degrees) just
 * like the preview. Opacity/rotation are already applied to the context by
 * render-item.ts. Konva's default lineHeight is 1 → line spacing = fontSize.
 */
function renderTextShapeToCanvas(
  ctx: OffscreenCanvasRenderingContext2D,
  shape: ShapeItem,
  transform: ResolvedTransform,
  canvas: ShapeCanvasSettings,
): void {
  const d = shape.textShapeData
  const content = d?.content ?? TEXT_SHAPE_FALLBACK.content
  if (!content) return
  const fontSize = d?.fontSize ?? TEXT_SHAPE_FALLBACK.fontSize
  const fontFamily = d?.fontFamily ?? TEXT_SHAPE_FALLBACK.fontFamily
  const align = d?.align ?? TEXT_SHAPE_FALLBACK.align
  const fill = shape.fillColor ?? TEXT_SHAPE_FALLBACK.fill
  const wrapWidth = Math.max(1, transform.width)
  const skewX = Math.tan(((d?.skewX ?? 0) * Math.PI) / 180)
  const skewY = Math.tan(((d?.skewY ?? 0) * Math.PI) / 180)

  const left = canvas.width / 2 + transform.x
  const top = canvas.height / 2 + transform.y

  ctx.font = `${fontSize}px ${fontFamily}`
  ctx.fillStyle = fill
  ctx.textBaseline = 'top'

  const lines = wrapTextForWidth(ctx, content, wrapWidth)

  // Work in label-local space so skew shears from the text's top-left (= Konva
  // node origin), matching the preview.
  ctx.translate(left, top)
  ctx.transform(1, skewY, skewX, 1, 0, 0)

  for (let i = 0; i < lines.length; i++) {
    let x: number
    if (align === 'center') {
      ctx.textAlign = 'center'
      x = wrapWidth / 2
    } else if (align === 'right') {
      ctx.textAlign = 'right'
      x = wrapWidth
    } else {
      ctx.textAlign = 'left'
      x = 0
    }
    ctx.fillText(lines[i]!, x, i * fontSize)
  }
}

/**
 * Render a player spotlight to the export canvas — exact parity with
 * `SpotlightShape` in shapes-konva: a faded-top light beam, a solid ground
 * pool, a base bloom, and a soft rectangular cutout punched out so the player
 * shows through.
 *
 * The cutout uses `destination-out`, which carves whatever is already on the
 * target. To keep it from erasing OTHER clips, we draw the whole spotlight into
 * a temp OffscreenCanvas first (so the cutout only carves the spotlight), then
 * composite that temp onto the main canvas. Opacity + rotation are already on
 * the main ctx (from render-item.ts), so the single drawImage picks them up.
 *
 * Position model mirrors the preview (non-centred body, drawn centred at local
 * 0,0): the spotlight centre is `canvasCentre + transform.x/y`; feet at +H/2.
 */
function renderSpotlightToCanvas(
  ctx: OffscreenCanvasRenderingContext2D,
  shape: ShapeItem,
  transform: ResolvedTransform,
  canvas: ShapeCanvasSettings,
): void {
  const width = transform.width
  const height = transform.height
  if (width <= 0 || height <= 0) return

  const d = shape.spotlightData
  const fill = shape.fillColor ?? SPOTLIGHT_FALLBACK.fill
  const intensity = d?.intensity ?? SPOTLIGHT_FALLBACK.intensity
  const showPool = d?.pool ?? SPOTLIGHT_FALLBACK.pool
  const showBloom = d?.bloom ?? SPOTLIGHT_FALLBACK.bloom
  const showCutout = d?.cutout ?? SPOTLIGHT_FALLBACK.cutout
  const cw = d?.cutoutWidth ?? SPOTLIGHT_FALLBACK.cutoutWidth
  const ch = d?.cutoutHeight ?? SPOTLIGHT_FALLBACK.cutoutHeight

  const rX = width / 2
  const baseRY = rX * 0.4
  const H = height
  const feetY = H / 2
  const topY = -H / 2
  const feather = Math.max(12, cw * 0.55)

  const cx = canvas.width / 2 + transform.x
  const cy = canvas.height / 2 + transform.y

  // Self-contained layer so destination-out carves only the spotlight.
  const temp = new OffscreenCanvas(canvas.width, canvas.height)
  const tctx = temp.getContext('2d')
  if (!tctx) return
  tctx.translate(cx, cy) // local (0,0) = spotlight centre, matching preview

  // Beam — faded top, brightest just above the ground.
  const beam = tctx.createLinearGradient(0, feetY, 0, topY)
  beam.addColorStop(0, hexRgba(fill, 0))
  beam.addColorStop(0.1, hexRgba(fill, 0.34 * intensity))
  beam.addColorStop(0.42, hexRgba(fill, 0.28 * intensity))
  beam.addColorStop(0.78, hexRgba(fill, 0.07 * intensity))
  beam.addColorStop(1, hexRgba(fill, 0))
  tctx.fillStyle = beam
  tctx.fillRect(-rX, topY, 2 * rX, H)

  // Ground pool — solid disk, only the upper edge fades into the beam.
  if (showPool) {
    const pool = tctx.createLinearGradient(0, feetY + baseRY, 0, feetY - baseRY)
    pool.addColorStop(0, hexRgba(fill, 0.55 * intensity))
    pool.addColorStop(0.5, hexRgba(fill, 0.52 * intensity))
    pool.addColorStop(1, hexRgba(fill, 0.26 * intensity))
    tctx.fillStyle = pool
    tctx.beginPath()
    tctx.ellipse(0, feetY, rX, baseRY, 0, 0, Math.PI * 2)
    tctx.fill()
  }

  // Base bloom.
  if (showBloom) {
    const r = rX * 0.5
    const bloom = tctx.createRadialGradient(0, feetY, 0, 0, feetY, r)
    bloom.addColorStop(0, hexRgba('#fff2a8', 0.55 * intensity))
    bloom.addColorStop(1, hexRgba('#fff2a8', 0))
    tctx.fillStyle = bloom
    tctx.beginPath()
    tctx.ellipse(0, feetY, r, baseRY * 0.5, 0, 0, Math.PI * 2)
    tctx.fill()
  }

  // Player cutout — applied as a soft alpha MASK via destination-in, so the
  // beam/pool/bloom stay crisp and ONLY the cut gets soft edges (the previous
  // whole-layer blur made everything fuzzy). destination-in is the proven mask
  // op from canvas-masks.ts (unlike destination-out, it renders in the worker).
  //
  // The mask is opaque (keep) everywhere except the player strip, where its
  // alpha follows the SAME gradient as the Konva cutout — strong erase at the
  // feet fading to none at the top (keep-alpha = 1 - erase) — then blurred so
  // the strip edges are soft.
  if (showCutout) {
    const mask = new OffscreenCanvas(canvas.width, canvas.height)
    const mctx = mask.getContext('2d')
    if (mctx) {
      mctx.translate(cx, cy)
      // Opaque everywhere EXCEPT the strip (clip out the strip, then fill white).
      mctx.save()
      mctx.beginPath()
      mctx.rect(-cx, -cy, canvas.width, canvas.height)
      mctx.rect(-cw / 2, feetY - ch, cw, ch)
      mctx.clip('evenodd')
      mctx.fillStyle = '#ffffff'
      mctx.fillRect(-cx, -cy, canvas.width, canvas.height)
      mctx.restore()
      // Paint the strip with the keep-alpha gradient (= 1 - Konva erase).
      const keep = mctx.createLinearGradient(0, feetY, 0, feetY - ch)
      keep.addColorStop(0, 'rgba(255,255,255,0.1)') // feet — mostly cut
      keep.addColorStop(0.55, 'rgba(255,255,255,0.25)')
      keep.addColorStop(1, 'rgba(255,255,255,1)') // top — no cut
      mctx.fillStyle = keep
      mctx.fillRect(-cw / 2, feetY - ch, cw, ch)

      // Soften the cut edges by blurring the MASK (drawImage blur works).
      let finalMask: OffscreenCanvas = mask
      const blurredMask = new OffscreenCanvas(canvas.width, canvas.height)
      const bmctx = blurredMask.getContext('2d')
      if (bmctx) {
        bmctx.filter = `blur(${feather}px)`
        bmctx.drawImage(mask, 0, 0)
        finalMask = blurredMask
      }

      // Keep the spotlight only where the mask is opaque → soft hole, crisp beam.
      tctx.save()
      tctx.setTransform(1, 0, 0, 1, 0, 0)
      tctx.globalCompositeOperation = 'destination-in'
      tctx.drawImage(finalMask, 0, 0)
      tctx.restore()
    }
  }

  ctx.drawImage(temp, 0, 0)
}

/**
 * Render a shape item to canvas.
 *
 * Dispatches:
 *  - `arrow` and `free-polygon` → dedicated direct-canvas renderers
 *    (they don't use the transform-based bounding-box model the
 *    parametric shapes use).
 *  - Everything else → the existing `getShapePath` → Path2D path.
 *
 * @param ctx - Canvas 2D context
 * @param shape - The shape item to render
 * @param transform - Resolved transform (possibly animated)
 * @param canvas - Canvas dimensions
 */
export function renderShape(
  ctx: OffscreenCanvasRenderingContext2D,
  shape: ShapeItem,
  transform: ResolvedTransform,
  canvas: ShapeCanvasSettings,
): void {
  // Don't render masks as shapes - they're handled by the mask system
  if (shape.isMask) return

  ctx.save()

  try {
    if (shape.shapeType === 'arrow') {
      renderArrowToCanvas(ctx, shape, transform.opacity)
      return
    }
    if (shape.shapeType === 'free-polygon') {
      renderFreePolygonToCanvas(ctx, shape, transform.opacity)
      return
    }
    if (shape.shapeType === 'field-ring') {
      renderFieldRingToCanvas(ctx, shape, transform, canvas)
      return
    }
    if (shape.shapeType === 'connected-rings') {
      renderConnectedRingsToCanvas(ctx, shape, transform, canvas)
      return
    }
    if (shape.shapeType === 'image') {
      renderImageShapeToCanvas(ctx, shape, transform, canvas)
      return
    }
    if (shape.shapeType === 'text') {
      renderTextShapeToCanvas(ctx, shape, transform, canvas)
      return
    }
    if (shape.shapeType === 'spotlight') {
      renderSpotlightToCanvas(ctx, shape, transform, canvas)
      return
    }

    // Anything past this point goes through getShapePath(). CRITICAL: that
    // helper's `default` case falls back to a full-size RECTANGLE for any
    // shapeType it doesn't recognise, so an un-mirrored MatchView shape
    // (connected-rings, spotlight, text, timer) would otherwise be filled
    // edge-to-edge with its fillColor. Only let genuine parametric shapes
    // through; skip (render nothing) for anything without a real mirror yet.
    if (!PARAMETRIC_SHAPE_TYPES.has(shape.shapeType)) {
      log.warn('No export renderer for shape type; skipping to avoid fallback fill', {
        shapeId: shape.id,
        shapeType: shape.shapeType,
      })
      return
    }

    // Parametric shapes — existing path.
    const path = getShapePath2D(shape, transform, canvas)

    // Apply opacity
    ctx.globalAlpha = transform.opacity

    // Fill the shape
    if (shape.fillColor) {
      ctx.fillStyle = shape.fillColor
      ctx.fill(path)
    }

    // Stroke the shape
    if (shape.strokeWidth && shape.strokeWidth > 0 && shape.strokeColor) {
      ctx.strokeStyle = shape.strokeColor
      ctx.lineWidth = shape.strokeWidth
      ctx.stroke(path)
    }

    // Apply corner radius clipping if needed
    if (transform.cornerRadius > 0) {
      // Note: Corner radius is typically baked into the shape path
      // for rectangles. For other shapes, it's handled by the shape generator.
      log.debug('Corner radius applied via shape path', {
        shapeId: shape.id,
        cornerRadius: transform.cornerRadius,
      })
    }
  } finally {
    ctx.restore()
  }
}
