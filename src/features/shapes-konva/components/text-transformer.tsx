import { useEffect, useRef } from 'react'
import { Transformer } from 'react-konva'
import type Konva from 'konva'
import type { ShapeItem } from '@/types/timeline'
import type { ShapeCallbacks } from '../types'
import { konvaPositionToTransform } from '../utils/parametric-position'

interface TextTransformerProps {
  item: ShapeItem
  callbacks: ShapeCallbacks
  canvasWidth: number
  canvasHeight: number
}

/**
 * Transformer for the text shape. Only width (middle-left / middle-right)
 * anchors + rotate — resizing changes the text BOX width, not the font.
 *
 * The live `onTransform` handler converts the in-progress scaleX into the
 * Konva text node's width on every move and resets the group scale to 1, so
 * the text RE-WRAPS continuously instead of stretching and then snapping back
 * on release (the legacy Text2D trick). `onTransformEnd` commits the final
 * width + position + rotation to the item.
 */
export function TextTransformer({
  item,
  callbacks,
  canvasWidth,
  canvasHeight,
}: TextTransformerProps) {
  const trRef = useRef<Konva.Transformer | null>(null)

  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    const stage = tr.getStage()
    if (!stage) return
    const node = stage.findOne(`#${item.id}`)
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [item.id])

  const liveRewrap = () => {
    const tr = trRef.current
    if (!tr) return
    const node = tr.nodes()[0] as Konva.Group | undefined
    if (!node) return
    const textNode = node.findOne('Text') as Konva.Text | undefined
    if (!textNode) return
    const sx = node.scaleX()
    if (sx !== 1) {
      textNode.width(Math.max(20, textNode.width() * sx))
    }
    // Reset group scale every move so nothing stretches; width carries the size.
    node.scaleX(1)
    node.scaleY(1)
  }

  return (
    <Transformer
      ref={trRef}
      rotateEnabled
      rotateAnchorOffset={14}
      rotationSnaps={[0, 45, 90, 135, 180, -135, -90, -45]}
      rotationSnapTolerance={3}
      // Width-only handles → resize the text box (re-wrap), never the font.
      enabledAnchors={['middle-left', 'middle-right']}
      ignoreStroke
      anchorSize={7}
      anchorCornerRadius={3.5}
      anchorFill="#FFFFFF"
      anchorStroke="#1845C8"
      anchorStrokeWidth={1.5}
      borderStroke="#1845C8"
      borderStrokeWidth={1.25}
      borderDash={[6, 4]}
      onTransform={liveRewrap}
      onTransformEnd={() => {
        const tr = trRef.current
        if (!tr) return
        const node = tr.nodes()[0] as Konva.Group | undefined
        if (!node) return
        const textNode = node.findOne('Text') as Konva.Text | undefined
        const nextWidth = textNode ? textNode.width() : (item.transform?.width ?? 360)
        const pos = konvaPositionToTransform(node.x(), node.y(), canvasWidth, canvasHeight)
        node.scaleX(1)
        node.scaleY(1)
        callbacks.onUpdateData(item.id, {
          transform: {
            ...item.transform,
            x: pos.x,
            y: pos.y,
            width: Math.max(20, nextWidth),
            rotation: node.rotation(),
          },
        })
        tr.getLayer()?.batchDraw()
      }}
    />
  )
}
