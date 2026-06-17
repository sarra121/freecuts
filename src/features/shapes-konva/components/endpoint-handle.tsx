import { useState } from 'react'
import { Circle } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'

interface EndpointHandleProps {
  x: number
  y: number
  /** Called once when the drag finishes — this is the authoritative commit
   *  (goes through the timeline store + adds an undo entry). */
  onDrag(x: number, y: number): void
  /** Optional. Called on every dragmove tick. Wire this to a cheap preview
   *  store (e.g. useShapeEditStore) to drive rubber-band rendering of the
   *  polygon/arrow line during drag without touching the timeline store. */
  onDragLive?(x: number, y: number): void
}

// MatchView handle palette — kept in one place so polygon vertex / arrow
// endpoint handles and the parametric Transformer anchors stay in sync.
const HANDLE_RADIUS = 9
const HANDLE_RADIUS_HOVER = 11
const HANDLE_FILL = '#FFFFFF'
const HANDLE_STROKE = '#1845C8' // Tactical "Defense" blue from utils/defaults
const HANDLE_STROKE_HOVER = '#0F3296'
const HANDLE_STROKE_WIDTH = 2.5
const HANDLE_SHADOW = 'rgba(0, 0, 0, 0.35)'

/**
 * Shared draggable handle used by ArrowTransformer (2 endpoints) and
 * PolygonTransformer (N vertices). Centered on the vertex.
 *
 * Drag protocol — two callbacks for the "preview during drag, commit on
 * release" pattern (mirrors `useGizmoStore.previewTransform` for parametric
 * shapes):
 *
 *  - `onDragLive(x, y)` (optional): fires on every dragmove. Should write
 *    to a cheap preview store so the parent shape's line/path rubber-bands
 *    with the cursor. NEVER write to the timeline store here — that
 *    creates an undo snapshot per pixel of drag and stalls the UI.
 *  - `onDrag(x, y)`: fires once on dragEnd. This is the authoritative
 *    commit — goes through `updateVertex` → timeline `execute()` → adds
 *    a single undo entry covering the whole drag.
 */
export function EndpointHandle({ x, y, onDrag, onDragLive }: EndpointHandleProps) {
  const [isHovering, setIsHovering] = useState(false)

  return (
    <Circle
      x={x}
      y={y}
      radius={isHovering ? HANDLE_RADIUS_HOVER : HANDLE_RADIUS}
      fill={HANDLE_FILL}
      stroke={isHovering ? HANDLE_STROKE_HOVER : HANDLE_STROKE}
      strokeWidth={HANDLE_STROKE_WIDTH}
      shadowColor={HANDLE_SHADOW}
      shadowBlur={4}
      shadowOpacity={1}
      shadowOffsetX={0}
      shadowOffsetY={1}
      draggable
      onDragMove={
        onDragLive
          ? (e: KonvaEventObject<DragEvent>) => onDragLive(e.target.x(), e.target.y())
          : undefined
      }
      onDragEnd={(e: KonvaEventObject<DragEvent>) => onDrag(e.target.x(), e.target.y())}
      onMouseEnter={(e) => {
        setIsHovering(true)
        const container = e.target.getStage()?.container()
        if (container) container.style.cursor = 'move'
      }}
      onMouseLeave={(e) => {
        setIsHovering(false)
        const container = e.target.getStage()?.container()
        if (container) container.style.cursor = ''
      }}
    />
  )
}
