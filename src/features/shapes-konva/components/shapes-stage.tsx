import { useMemo } from 'react'
import { Stage, Layer } from 'react-konva'
import { useTimelineStore } from '../deps/timeline'
import { usePlaybackStore } from '../deps/playback'
import { useSelectionStore } from '../deps/selection'
import { useDrawToolStore } from '../stores/draw-tool-store'
import { resolveShapeAtFrame } from '../utils/shape-keyframes'
import { ShapeRouter } from './shape-router'
import { ShapeTransformer } from './shape-transformer'
import { useDrawArrowTool } from '../hooks/use-draw-arrow-tool'
import { useDrawPolygonTool } from '../hooks/use-draw-polygon-tool'
import { useDrawConnectedRingsTool } from '../hooks/use-draw-connected-rings-tool'
import { usePlaceParametricTool } from '../hooks/use-place-parametric-tool'
import { useShapesStageScale } from '../hooks/use-shapes-stage-scale'
import { useVisibleShapes } from '../hooks/use-visible-shapes'
import { useShapeCallbacks } from '../hooks/use-shape-callbacks'

interface ShapesStageProps {
  /** CSS display size of the preview canvas (Konva Stage rendered at this size). */
  displayWidth: number
  displayHeight: number
  /** Project canvas resolution. Shape coords are stored in this space; the
   *  Stage applies scaleX/Y = display/project so children draw correctly
   *  inside the display container without overflow. */
  projectWidth: number
  projectHeight: number
}

/**
 * One Konva `<Stage>` + `<Layer>` mounted above the preview composite.
 * Hosts every shape item visible at the current frame, dispatches draw /
 * placement tool gestures, and mounts a `ShapeTransformer` that renders
 * resize/rotate handles for whatever's selected.
 *
 * Pointer-events policy (Phase 3 fix):
 *  - Stage is `pointer-events: auto` whenever there are visible shapes OR
 *    a draw tool is active. This lets the user click a shape to select it
 *    even when nothing else is selected (previously the chicken-and-egg
 *    bug: clicks fell through because nothing was selected).
 *  - Clicks landing on the empty Stage background trigger
 *    `clearItemSelection()`, so clicking outside any shape deselects it.
 *  - When there are no visible shapes AND no draw tool, the Stage is
 *    `pointer-events: none` so clicks fall through to the underlying DOM
 *    layers (the existing player / preview / etc.).
 */
export function ShapesStage({
  displayWidth,
  displayHeight,
  projectWidth,
  projectHeight,
}: ShapesStageProps) {
  const items = useTimelineStore((s) => s.items)
  const tracks = useTimelineStore((s) => s.tracks)
  const currentFrame = usePlaybackStore((s) => s.currentFrame)
  const selectedItemIds = useSelectionStore((s) => s.selectedItemIds)
  const clearItemSelection = useSelectionStore((s) => s.clearItemSelection)
  const drawKind = useDrawToolStore((s) => s.state.kind)

  const { scaleX, scaleY } = useShapesStageScale(
    displayWidth,
    displayHeight,
    projectWidth,
    projectHeight,
  )
  const visibleShapes = useVisibleShapes(items, tracks, currentFrame)
  const callbacks = useShapeCallbacks()

  const selectedSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds])

  // Shapes currently selected. Apply the keyframe change log at the
  // current frame BEFORE handing them to the transformer — without
  // this the handles render at raw `item.arrowData` / `freePolygonData`
  // and lag the keyframe-resolved body that ShapeRouter draws.
  // Parametric shapes are unaffected (their transformer attaches to the
  // Konva node by id and follows the already-rendered position).
  const selectedShapes = useMemo(
    () =>
      visibleShapes
        .filter((s) => selectedSet.has(s.id))
        .map((s) => resolveShapeAtFrame(s, currentFrame - s.from)),
    [visibleShapes, selectedSet, currentFrame],
  )

  const arrowTool = useDrawArrowTool()
  const polygonTool = useDrawPolygonTool()
  const connectedRingsTool = useDrawConnectedRingsTool()
  const parametricTool = usePlaceParametricTool(projectWidth, projectHeight)

  // Stage is interactive whenever there are shapes to click OR a draw tool
  // is active. The previous `selectedItemIds.length > 0` gate created the
  // click-to-select bug — clicks never landed if nothing was already selected.
  const interactive = drawKind !== 'idle' || visibleShapes.length > 0

  return (
    <div
      aria-hidden={!interactive}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: interactive ? 'auto' : 'none',
        cursor: drawKind !== 'idle' ? 'crosshair' : undefined,
      }}
      // Stop React synthetic click propagation at the wrapper level. The
      // preview wraps this stage in two divs (preview-stage.tsx:125, 131)
      // that both register `onClick={handleBackgroundClick}` — which calls
      // `clearItemSelection()` for any click not hitting a [data-gizmo]
      // ancestor. The Konva canvas doesn't qualify, so without this guard
      // every shape click was selected-then-wiped within the same event
      // (Konva's native onClick fires first, then React's delegated
      // synthetic dispatch runs handleBackgroundClick).
      //
      // Note: we still call `clearItemSelection()` ourselves in the Konva
      // Stage's onClick when the user clicks the empty stage with no tool
      // active. So this stopPropagation doesn't suppress the intended
      // "click outside a shape to deselect" behaviour — it only prevents
      // the unintended double-clear from the preview's wrapper handlers.
      //
      // Why a React `onClick` instead of `e.evt.stopPropagation()` inside
      // Konva: Konva's event uses the native DOM event, but React 18's
      // event system dispatches via a single delegated listener at the
      // React root — stopping the native event AFTER Konva's listener ran
      // is too late to prevent React's dispatch.
      onClick={(e) => e.stopPropagation()}
    >
      <Stage
        width={displayWidth}
        height={displayHeight}
        scaleX={scaleX}
        scaleY={scaleY}
        onPointerDown={arrowTool.onPointerDown}
        onPointerMove={(e) => {
          arrowTool.onPointerMove(e)
          polygonTool.onPointerMove(e)
          connectedRingsTool.onPointerMove(e)
        }}
        onPointerUp={arrowTool.onPointerUp}
        onClick={(e) => {
          // Tool-specific handlers — they self-no-op when their tool isn't active.
          polygonTool.onClick(e)
          connectedRingsTool.onClick(e)
          parametricTool.onClick(e)
          // Empty-stage click with no tool → clear item selection. Konva sets
          // `e.target` to the Stage itself when the click hit the background.
          if (e.target === e.target.getStage() && drawKind === 'idle') {
            clearItemSelection()
          }
        }}
        onDblClick={() => {
          polygonTool.onDblClick()
          connectedRingsTool.onDblClick()
        }}
      >
        <Layer>
          {visibleShapes.map((item) => (
            <ShapeRouter
              key={item.id}
              item={item}
              frame={currentFrame}
              isSelected={selectedSet.has(item.id)}
              callbacks={callbacks}
              canvasWidth={projectWidth}
              canvasHeight={projectHeight}
            />
          ))}
          {arrowTool.preview}
          {polygonTool.preview}
          {connectedRingsTool.preview}
          {/* Transformer mounts last so it renders ON TOP of all shapes. */}
          <ShapeTransformer
            selectedShapes={selectedShapes}
            callbacks={callbacks}
            canvasWidth={projectWidth}
            canvasHeight={projectHeight}
          />
        </Layer>
      </Stage>
    </div>
  )
}
