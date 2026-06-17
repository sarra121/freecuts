import { Rect } from 'react-konva'
import { useEffect, useRef } from 'react'
import { createLogger } from '@/shared/logging/logger'
import type { ShapeProps } from '../types'

const log = createLogger('shapes-konva')

/**
 * Translucent placeholder rendered for deferred shape types (`star`,
 * `heart`, `path`). Their data is preserved in the project file; the
 * placeholder communicates that the Konva component for these variants
 * ships in a later spec. See
 * docs/superpowers/specs/2026-05-24-konva-shape-renderer-design.md.
 */
export function DeferredShapePlaceholder({ item }: Pick<ShapeProps, 'item'>) {
  const warnedRef = useRef(false)
  useEffect(() => {
    if (warnedRef.current) return
    warnedRef.current = true
    log.warn('Deferred shape type rendered as placeholder', {
      shapeType: item.shapeType,
      itemId: item.id,
    })
  }, [item.shapeType, item.id])
  const x = item.transform?.x ?? 0
  const y = item.transform?.y ?? 0
  const width = item.transform?.width ?? 80
  const height = item.transform?.height ?? 80
  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill="rgba(255, 255, 255, 0.06)"
      stroke="rgba(255, 255, 255, 0.35)"
      strokeWidth={1}
      dash={[4, 4]}
      listening={false}
    />
  )
}
