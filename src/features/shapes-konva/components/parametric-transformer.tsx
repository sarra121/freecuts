import { useEffect, useRef } from 'react'
import { Transformer } from 'react-konva'
import type Konva from 'konva'
import type { ShapeItem } from '@/types/timeline'
import { commitShapeUpdate } from '../stores/actions/commit-shape-update'

// Visual constants for the parametric Transformer anchors.
//
// Why these specific values:
//  - `ANCHOR_SIZE = 7` — Konva's default is 10. We've gone smaller because
//    the parametric transformer shows up to 9 anchors per shape (4 corners
//    + 4 sides + 1 rotate). Tightly packed handles dominate a small shape
//    if each is too thick. 7 still gives a 7×7 click target which, with
//    the stroke fattening it, lands in ~10×10 hit-test territory — fine
//    for mouse, slightly tight for touch (we'll bump this in a touch pass).
//  - `anchorCornerRadius = ANCHOR_SIZE / 2` — rounds the square Rects into
//    perfect circles so the visual language matches EndpointHandle.
//  - `ANCHOR_STROKE_WIDTH = 1.5` — thinner than the polygon handle's 2.5
//    because that one is meant to read as a draggable nub against an
//    organic line; these read as resize handles against a rigid bounding
//    box and benefit from being delicate.
//  - The shadow in `anchorStyleFunc` is removed for the parametric anchors
//    on purpose. Stage-scaled shadow blur radius ≈ 4 stage units = a
//    sizeable on-screen halo at typical zooms. On nine packed anchors,
//    those halos overlap and bulk up the apparent footprint. The bounding
//    box border provides enough visual anchoring without the shadow.
const ANCHOR_SIZE = 7
const ANCHOR_FILL = '#FFFFFF'
const ANCHOR_STROKE = '#1845C8' // Tactical "Defense" blue
const ANCHOR_STROKE_WIDTH = 1.5
const BORDER_STROKE = '#1845C8'
const BORDER_STROKE_WIDTH = 1.25

interface ParametricTransformerProps {
  items: ShapeItem[]
  canvasWidth: number
  canvasHeight: number
}

/**
 * Konva `<Transformer>` attached to one or more parametric shape Groups
 * (rectangle, circle, ellipse, triangle, regular-polygon). The Groups must
 * have Konva-side `id` attributes matching their `ShapeItem.id` (set by
 * `ParametricShapeBody` and the arrow / free-polygon Group wrappers).
 *
 * Behavior:
 *  - On selection change, the Transformer rebinds to the new set of nodes
 *    via `stage.findOne('#${id}')`.
 *  - On `transformend`, each node's post-transform geometry is read back:
 *    its `scaleX`/`scaleY` are multiplied into `transform.width`/`.height`,
 *    rotation is captured, position is converted from Stage-absolute pixels
 *    to FreeCut's centre-relative `transform.x`/`.y`, then scale is reset
 *    to 1 (Konva-standard "bake the scale into intrinsic size" idiom).
 *  - `keepRatio` is `true` only when single-select on a circle — multi-
 *    select is intentionally aspect-free (M1 design choice) so the user
 *    can resize a mixed group without per-shape locks blocking the gesture.
 */
export function ParametricTransformer({
  items,
  canvasWidth,
  canvasHeight,
}: ParametricTransformerProps) {
  const trRef = useRef<Konva.Transformer | null>(null)

  // Build a lookup so the onTransformEnd handler can recover the item's
  // current transform when writing back (we preserve fields we don't touch:
  // opacity, anchorX/Y, cornerRadius, flips, etc.).
  const itemsById = useRef<Record<string, ShapeItem>>({})
  itemsById.current = Object.fromEntries(items.map((it) => [it.id, it]))

  // Attach Konva nodes by id whenever the selection changes.
  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    const stage = tr.getStage()
    if (!stage) return

    const nodes = items
      .map((item) => stage.findOne(`#${item.id}`))
      .filter((n): n is Konva.Node => !!n)

    tr.nodes(nodes)
    tr.getLayer()?.batchDraw()
  }, [items])

  // Lock aspect ratio for a single circle (radius) and for the timer (its
  // resize scales the font uniformly). Mixed/other selections are aspect-free.
  const keepRatio =
    items.length === 1 &&
    (items[0]?.shapeType === 'circle' || items[0]?.shapeType === 'timer')

  return (
    <Transformer
      ref={trRef}
      keepRatio={keepRatio}
      // Rotate handle ON, but pulled in close to the box. Konva's default
      // is 50 units, which creates a long "lollipop stick" of empty space
      // above the shape that bulks up the transformer's apparent footprint.
      // 14 is tight enough that it reads as part of the shape, not floating.
      rotateEnabled
      rotateAnchorOffset={14}
      rotationSnaps={[0, 45, 90, 135, 180, -135, -90, -45]}
      rotationSnapTolerance={3}
      // Only 4 corner anchors, no side-midpoints. Figma/Photoshop style.
      // Corners still let the user resize on both axes; killing the 4
      // mid-edge anchors removes 4 handles from the visual count
      // (9 → 5 total: 4 corners + 1 rotate).
      enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
      ignoreStroke
      // Tight, delicate anchors — fully circular (cornerRadius =
      // anchorSize/2). Single source of truth at the top of the file.
      anchorSize={ANCHOR_SIZE}
      anchorCornerRadius={ANCHOR_SIZE / 2}
      anchorFill={ANCHOR_FILL}
      anchorStroke={ANCHOR_STROKE}
      anchorStrokeWidth={ANCHOR_STROKE_WIDTH}
      borderStroke={BORDER_STROKE}
      borderStrokeWidth={BORDER_STROKE_WIDTH}
      borderDash={[6, 4]}
      onTransformEnd={() => {
        const tr = trRef.current
        if (!tr) return
        const nodes = tr.nodes()
        for (const node of nodes) {
          const id = node.id()
          const currentItem = itemsById.current[id]
          if (!currentItem) continue

          const scaleX = node.scaleX()
          const scaleY = node.scaleY()
          const rotation = node.rotation()
          // Group position is in Stage-absolute pixels.
          // FreeCut's transform.x/y is centre-relative (offset from canvas centre),
          // so we invert what resolveParametricPosition does at render time.
          const nextTransformX = node.x() - canvasWidth / 2
          const nextTransformY = node.y() - canvasHeight / 2

          // Bake scale into width/height. The "intrinsic" size lives in
          // item.transform.width/height — the Konva node reads from there.
          const currentWidth = currentItem.transform?.width ?? Math.min(canvasWidth, canvasHeight) * 0.25
          const currentHeight = currentItem.transform?.height ?? Math.min(canvasWidth, canvasHeight) * 0.25
          const nextWidth = Math.max(1, currentWidth * scaleX)
          const nextHeight = Math.max(1, currentHeight * scaleY)

          // Reset Konva-side scale: the new width/height is now the truth.
          node.scaleX(1)
          node.scaleY(1)

          const nextTransform = {
            ...(currentItem.transform ?? {}),
            x: nextTransformX,
            y: nextTransformY,
            width: nextWidth,
            height: nextHeight,
            rotation,
          }

          // Timer: the resize scales the FONT (and box) uniformly rather than
          // just the box, so the digits actually grow. keepRatio makes
          // scaleX === scaleY, so either factor works.
          if (currentItem.shapeType === 'timer' && currentItem.timerData) {
            const factor = scaleX
            commitShapeUpdate(id, {
              transform: nextTransform,
              timerData: {
                ...currentItem.timerData,
                fontSize: Math.max(1, Math.round(currentItem.timerData.fontSize * factor)),
              },
            })
            continue
          }

          commitShapeUpdate(id, { transform: nextTransform })
        }
        tr.getLayer()?.batchDraw()
      }}
    />
  )
}
