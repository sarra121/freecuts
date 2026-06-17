import { useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Circle, Line } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useDrawToolStore } from '../stores/draw-tool-store'
import { createFreePolygon } from '../stores/actions/create-free-polygon'
import { useTimelineStore } from '../deps/timeline'
import { useSelectionStore } from '../deps/selection'
import { FREE_POLYGON_DEFAULTS } from '../utils/defaults'

const CLOSE_LOOP_RADIUS = 8

export interface DrawPolygonToolHandlers {
  onClick(e: KonvaEventObject<MouseEvent>): void
  onPointerMove(e: KonvaEventObject<PointerEvent>): void
  onDblClick(): void
  preview: ReactNode
}

/**
 * Click-to-add-vertex draw tool for free polygons.
 *
 * - Click: add vertex
 * - Click within CLOSE_LOOP_RADIUS of the first vertex: close + commit
 * - Double-click anywhere: commit with the current vertex list
 * - Enter key: same as double-click
 * - Esc key: cancel
 *
 * Returns handlers + a `preview` ReactNode. Handlers are no-ops when
 * the draw-tool store isn't in `drawing-polygon` mode.
 */
export function useDrawPolygonTool(): DrawPolygonToolHandlers {
  const state = useDrawToolStore((s) => s.state)
  const append = useDrawToolStore((s) => s.appendPolygonVertex)
  const cancel = useDrawToolStore((s) => s.cancel)
  const fps = useTimelineStore((s) => s.fps)
  const selectItems = useSelectionStore((s) => s.selectItems)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)

  const finish = useCallback(
    (vertices: number[]) => {
      if (vertices.length < 6) {
        cancel()
        setCursor(null)
        return
      }
      // createFreePolygon reads the live playhead from the playback store at
      // commit time, so we don't pass `frame` here — that avoids stale closures
      // when playback is running between draw clicks.
      const id = createFreePolygon({ vertices, fps })
      cancel()
      setCursor(null)
      if (id) selectItems([id])
    },
    [cancel, fps, selectItems],
  )

  const onClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (state.kind !== 'drawing-polygon') return
      const stage = e.target.getStage()
      const pos = stage?.getPointerPosition()
      if (!stage || !pos) return
      // Stage is scaled (display/project); divide by scale to get project coords.
      const px = pos.x / stage.scaleX()
      const py = pos.y / stage.scaleY()
      const v = state.vertices
      // Close-loop click on the first vertex (radius is in project space).
      if (v.length >= 6) {
        const fx = v[0] ?? 0
        const fy = v[1] ?? 0
        if (Math.hypot(px - fx, py - fy) <= CLOSE_LOOP_RADIUS / stage.scaleX()) {
          finish(v)
          return
        }
      }
      append(px, py)
    },
    [state, append, finish],
  )

  const onPointerMove = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (state.kind !== 'drawing-polygon') return
      const stage = e.target.getStage()
      const pos = stage?.getPointerPosition()
      if (!stage || !pos) return
      setCursor({ x: pos.x / stage.scaleX(), y: pos.y / stage.scaleY() })
    },
    [state.kind],
  )

  const onDblClick = useCallback(() => {
    if (state.kind !== 'drawing-polygon') return
    finish(state.vertices)
  }, [state, finish])

  useEffect(() => {
    if (state.kind !== 'drawing-polygon') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        finish(state.vertices)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancel()
        setCursor(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state, finish, cancel])

  let preview: ReactNode = null
  if (state.kind === 'drawing-polygon') {
    const previewPoints =
      cursor && state.vertices.length >= 2
        ? [...state.vertices, cursor.x, cursor.y]
        : state.vertices
    preview = (
      <>
        {previewPoints.length >= 4 && (
          <Line
            points={previewPoints}
            stroke={FREE_POLYGON_DEFAULTS.stroke}
            strokeWidth={FREE_POLYGON_DEFAULTS.strokeWidth}
            dash={[6, 4]}
            opacity={0.75}
            listening={false}
          />
        )}
        {Array.from({ length: state.vertices.length / 2 }, (_, i) => (
          <Circle
            key={i}
            x={state.vertices[i * 2] ?? 0}
            y={state.vertices[i * 2 + 1] ?? 0}
            radius={4}
            fill="#FFFFFF"
            stroke="#1845C8"
            strokeWidth={1.5}
            listening={false}
          />
        ))}
      </>
    )
  }

  return { onClick, onPointerMove, onDblClick, preview }
}
