import { useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { Arrow } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useDrawToolStore } from '../stores/draw-tool-store'
import { createArrow } from '../stores/actions/create-arrow'
import { useTimelineStore } from '../deps/timeline'
import { useSelectionStore } from '../deps/selection'
import { ARROW_DEFAULTS } from '../utils/defaults'

const MIN_DRAG_DISTANCE = 10

export interface DrawArrowToolHandlers {
  onPointerDown(e: KonvaEventObject<PointerEvent>): void
  onPointerMove(e: KonvaEventObject<PointerEvent>): void
  onPointerUp(): void
  preview: ReactNode
}

/**
 * Click-and-drag draw tool for arrows. Mousedown sets the tail, drag
 * rubber-bands the head, mouseup commits via createArrow (or cancels
 * if the drag was too short to be intentional).
 *
 * Returns handlers to attach to the Konva Stage + a `preview` ReactNode
 * to render inside the Layer. Handlers are no-ops when the draw-tool
 * store is not in `drawing-arrow` mode, so the ShapesStage can attach
 * both tool hooks unconditionally.
 */
export function useDrawArrowTool(): DrawArrowToolHandlers {
  const state = useDrawToolStore((s) => s.state)
  const setTail = useDrawToolStore((s) => s.setArrowTail)
  const cancel = useDrawToolStore((s) => s.cancel)
  const fps = useTimelineStore((s) => s.fps)
  const selectItems = useSelectionStore((s) => s.selectItems)
  const [head, setHead] = useState<{ x: number; y: number } | null>(null)

  const onPointerDown = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (state.kind !== 'drawing-arrow') return
      const stage = e.target.getStage()
      const pos = stage?.getPointerPosition()
      if (!stage || !pos) return
      // Stage is scaled (display/project); divide by scale to get project coords.
      const px = pos.x / stage.scaleX()
      const py = pos.y / stage.scaleY()
      setTail(px, py)
      setHead({ x: px, y: py })
    },
    [state.kind, setTail],
  )

  const onPointerMove = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (state.kind !== 'drawing-arrow' || state.tail === null) return
      const stage = e.target.getStage()
      const pos = stage?.getPointerPosition()
      if (!stage || !pos) return
      const px = pos.x / stage.scaleX()
      const py = pos.y / stage.scaleY()
      setHead({ x: px, y: py })
    },
    [state],
  )

  const onPointerUp = useCallback(() => {
    if (state.kind !== 'drawing-arrow') return
    const tail = state.tail
    if (!tail || !head) {
      cancel()
      setHead(null)
      return
    }
    const dx = head.x - tail.x
    const dy = head.y - tail.y
    if (Math.hypot(dx, dy) < MIN_DRAG_DISTANCE) {
      // Too short — treat as misclick.
      cancel()
      setHead(null)
      return
    }
    // createArrow reads the live playhead from the playback store at commit
    // time, so we don't pass `frame` here — that avoids stale closures when
    // playback is running between mouse-down and mouse-up.
    const id = createArrow({
      fromX: tail.x,
      fromY: tail.y,
      toX: head.x,
      toY: head.y,
      fps,
    })
    cancel()
    setHead(null)
    if (id) selectItems([id])
  }, [state, head, cancel, fps, selectItems])

  let preview: ReactNode = null
  if (state.kind === 'drawing-arrow' && state.tail !== null && head !== null) {
    preview = (
      <Arrow
        points={[state.tail.x, state.tail.y, head.x, head.y]}
        fill={ARROW_DEFAULTS.fill}
        stroke={ARROW_DEFAULTS.stroke}
        strokeWidth={ARROW_DEFAULTS.strokeWidth}
        pointerLength={ARROW_DEFAULTS.pointerLength}
        pointerWidth={ARROW_DEFAULTS.pointerWidth}
        opacity={0.7}
        listening={false}
      />
    )
  }

  return { onPointerDown, onPointerMove, onPointerUp, preview }
}
