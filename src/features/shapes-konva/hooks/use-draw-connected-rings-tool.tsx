import { useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Circle, Line } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useDrawToolStore } from '../stores/draw-tool-store'
import { createConnectedRings } from '../stores/actions/create-connected-rings'
import { useTimelineStore } from '../deps/timeline'
import { useSelectionStore } from '../deps/selection'
import { CONNECTED_RINGS_DEFAULTS } from '../utils/defaults'

export interface DrawConnectedRingsToolHandlers {
  onClick(e: KonvaEventObject<MouseEvent>): void
  onPointerMove(e: KonvaEventObject<PointerEvent>): void
  onDblClick(): void
  preview: ReactNode
}

/**
 * Click-to-place draw tool for a connected-rings group. Mirrors the
 * free-polygon tool but commits a connected-rings item (>= 2 nodes).
 *
 * - Click: drop a node
 * - Double-click / Enter: finish with the current nodes
 * - Esc: cancel
 *
 * Handlers no-op unless the draw-tool store is in `drawing-connected-rings`.
 */
export function useDrawConnectedRingsTool(): DrawConnectedRingsToolHandlers {
  const state = useDrawToolStore((s) => s.state)
  const append = useDrawToolStore((s) => s.appendConnectedRingsVertex)
  const cancel = useDrawToolStore((s) => s.cancel)
  const fps = useTimelineStore((s) => s.fps)
  const selectItems = useSelectionStore((s) => s.selectItems)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)

  const finish = useCallback(
    (vertices: number[]) => {
      if (vertices.length < 4) {
        cancel()
        setCursor(null)
        return
      }
      const id = createConnectedRings({ vertices, fps })
      cancel()
      setCursor(null)
      if (id) selectItems([id])
    },
    [cancel, fps, selectItems],
  )

  const onClick = useCallback(
    (e: KonvaEventObject<MouseEvent>) => {
      if (state.kind !== 'drawing-connected-rings') return
      const stage = e.target.getStage()
      const pos = stage?.getPointerPosition()
      if (!stage || !pos) return
      const px = pos.x / stage.scaleX()
      const py = pos.y / stage.scaleY()
      append(px, py)
    },
    [state, append],
  )

  const onPointerMove = useCallback(
    (e: KonvaEventObject<PointerEvent>) => {
      if (state.kind !== 'drawing-connected-rings') return
      const stage = e.target.getStage()
      const pos = stage?.getPointerPosition()
      if (!stage || !pos) return
      setCursor({ x: pos.x / stage.scaleX(), y: pos.y / stage.scaleY() })
    },
    [state.kind],
  )

  const onDblClick = useCallback(() => {
    if (state.kind !== 'drawing-connected-rings') return
    finish(state.vertices)
  }, [state, finish])

  useEffect(() => {
    if (state.kind !== 'drawing-connected-rings') return
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
  if (state.kind === 'drawing-connected-rings') {
    const previewPoints =
      cursor && state.vertices.length >= 2
        ? [...state.vertices, cursor.x, cursor.y]
        : state.vertices
    preview = (
      <>
        {previewPoints.length >= 4 && (
          <Line
            points={previewPoints}
            stroke={CONNECTED_RINGS_DEFAULTS.connectorColor}
            strokeWidth={CONNECTED_RINGS_DEFAULTS.connectorWidth}
            dash={[6, 4]}
            opacity={0.7}
            listening={false}
          />
        )}
        {Array.from({ length: state.vertices.length / 2 }, (_, i) => (
          <Circle
            key={i}
            x={state.vertices[i * 2] ?? 0}
            y={state.vertices[i * 2 + 1] ?? 0}
            radius={5}
            fill="#FFFFFF"
            stroke={CONNECTED_RINGS_DEFAULTS.connectorColor}
            strokeWidth={1.5}
            listening={false}
          />
        ))}
      </>
    )
  }

  return { onClick, onPointerMove, onDblClick, preview }
}
