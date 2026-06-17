import { useCallback } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useDrawToolStore } from '../stores/draw-tool-store'
import { createParametricShape } from '../stores/actions/create-parametric-shape'
import { createFieldRing } from '../stores/actions/create-field-ring'
import { createSpotlight } from '../stores/actions/create-spotlight'
import { createText } from '../stores/actions/create-text'
import { createTimer } from '../stores/actions/create-timer'
import { useTimelineStore } from '../deps/timeline'
import { useSelectionStore } from '../deps/selection'

export interface PlaceParametricToolHandlers {
  /** Forward this from the Konva <Stage>'s onClick. No-op unless the tool
   *  is active (state.kind === 'placing-parametric'). */
  onClick(e: KonvaEventObject<MouseEvent>): void
}

/**
 * Click-to-place tool for the 5 parametric shapes (rectangle, circle,
 * ellipse, triangle, regular-polygon). Each click on the Konva Stage
 * drops one shape centred on the click point. The tool **stays active**
 * after each placement so the user can drop multiple shapes in a row
 * without re-selecting the tool — they cancel by clicking the rail
 * button again or by picking a different tool.
 *
 * The hook reads the currently-selected shapeType from `useDrawToolStore`,
 * the project canvas dimensions from the props passed in, and the project
 * fps from the timeline store. The created shape is auto-selected so the
 * transformer (Phase 3) attaches immediately.
 */
export function usePlaceParametricTool(
  canvasWidth: number,
  canvasHeight: number,
): PlaceParametricToolHandlers {
  const state = useDrawToolStore((s) => s.state)
  const fps = useTimelineStore((s) => s.fps)
  const selectItems = useSelectionStore((s) => s.selectItems)

  const onClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (
        state.kind !== 'placing-parametric' &&
        state.kind !== 'placing-field-ring' &&
        state.kind !== 'placing-spotlight' &&
        state.kind !== 'placing-text' &&
        state.kind !== 'placing-timer'
      )
        return
      const stage = e.target.getStage()
      const pos = stage?.getPointerPosition()
      if (!stage || !pos) return

      // Only place a new shape when the click landed on the EMPTY Stage
      // background. If the click hit an existing shape (Group or any
      // descendant), the shape's own onClick handler will select it; we
      // must no-op here so we don't drop a new shape on top.
      //
      // Konva sets `e.target` to the Stage itself only for background
      // clicks. Any populated node (Group, Rect, Line, Transformer anchor)
      // is a non-Stage target.
      if (e.target !== stage) return

      // The Stage is scaled (display/project). Divide by scale to get
      // project-pixel coords for the click — same coordinate space as
      // canvasWidth/canvasHeight.
      const px = pos.x / stage.scaleX()
      const py = pos.y / stage.scaleY()

      const id =
        state.kind === 'placing-field-ring'
          ? createFieldRing({ fps, position: { x: px, y: py }, canvasWidth, canvasHeight })
          : state.kind === 'placing-spotlight'
            ? createSpotlight({ fps, position: { x: px, y: py }, canvasWidth, canvasHeight })
            : state.kind === 'placing-text'
              ? createText({ fps, position: { x: px, y: py }, canvasWidth, canvasHeight })
              : state.kind === 'placing-timer'
                ? createTimer({ fps, position: { x: px, y: py }, canvasWidth, canvasHeight })
                : createParametricShape({
                shapeType: state.shapeType,
                fps,
                position: { x: px, y: py },
                canvasWidth,
                canvasHeight,
              })
      // Auto-select the new shape so the user sees the transformer.
      // The tool itself stays active for the next placement.
      selectItems([id])
    },
    [state, fps, canvasWidth, canvasHeight, selectItems],
  )

  return { onClick }
}
