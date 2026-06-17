import { useRef } from 'react'
import { Text } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { ShapeProps } from '../types'
import type { TextShapeData } from '@/types/timeline'
import { TEXT_DEFAULTS } from '../utils/defaults'
import { resolveParametricPosition } from '../utils/parametric-position'
import { ParametricShapeBody } from '../components/parametric-shape-body'

/**
 * Spawn an HTML <textarea> overlay aligned over the Konva text node for
 * on-canvas editing (ported from the legacy Text2D). All sizes are multiplied
 * by the stage scale so the overlay matches the rendered text on screen.
 * `onDone(value)` is called with the new text on commit, or null on cancel —
 * the caller is responsible for re-showing the hidden node either way.
 */
function openTextEditor(node: Konva.Text, initial: string, onDone: (value: string | null) => void) {
  const stage = node.getStage()
  if (!stage) {
    onDone(null)
    return
  }
  const scale = stage.scaleX() || 1
  const abs = node.absolutePosition()
  const box = stage.container().getBoundingClientRect()

  const area = document.createElement('textarea')
  document.body.appendChild(area)
  area.value = initial
  area.style.position = 'absolute'
  area.style.top = `${box.top + abs.y}px`
  area.style.left = `${box.left + abs.x}px`
  area.style.width = `${Math.max(node.width(), 40) * scale}px`
  area.style.height = `${(node.height() + 6) * scale}px`
  area.style.fontSize = `${node.fontSize() * scale}px`
  area.style.fontFamily = node.fontFamily()
  area.style.color = node.fill() as string
  area.style.lineHeight = String(node.lineHeight())
  area.style.textAlign = node.align()
  area.style.border = 'none'
  area.style.padding = '0'
  area.style.margin = '0'
  area.style.overflow = 'hidden'
  area.style.background = 'none'
  area.style.outline = 'none'
  area.style.resize = 'none'
  // Edit upright: the editor textarea is shown flat (no rotation/skew) for
  // easy typing; the skew/rotation re-applies to the Konva text on commit.
  area.style.transformOrigin = 'left top'
  area.style.zIndex = '10000'
  area.focus()
  area.select()

  let finished = false
  const finish = (value: string | null) => {
    if (finished) return
    finished = true
    window.removeEventListener('mousedown', onOutside, true)
    area.remove()
    onDone(value)
  }
  const onOutside = (e: MouseEvent) => {
    if (e.target !== area) finish(area.value)
  }
  area.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      finish(area.value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      finish(null)
    }
  })
  // Defer so the dblclick that opened the editor doesn't immediately close it.
  setTimeout(() => window.addEventListener('mousedown', onOutside, true))
}

/**
 * Editable on-canvas text label. Renders a react-konva <Text> inside the
 * shared ParametricShapeBody (drag / select / position / transformer). The
 * wrap width is transform.width, so the parametric transformer's resize
 * re-wraps the text rather than stretching the font. Double-click opens an
 * HTML textarea overlay to edit the content; the value is committed to the
 * timeline item (single source of truth).
 */
export function TextShape(props: ShapeProps) {
  const { item, canvasWidth, canvasHeight, callbacks } = props
  const d = item.textShapeData
  const textRef = useRef<Konva.Text>(null)

  const { width } = resolveParametricPosition(item, canvasWidth, canvasHeight)
  const content = d?.content ?? TEXT_DEFAULTS.content
  const fontSize = d?.fontSize ?? TEXT_DEFAULTS.fontSize
  const fontFamily = d?.fontFamily ?? TEXT_DEFAULTS.fontFamily
  const align = d?.align ?? TEXT_DEFAULTS.align
  // Stored as degrees (intuitive in the panel); Konva skew is a shear FACTOR,
  // so convert via tan().
  const toFactor = (deg: number) => Math.tan((deg * Math.PI) / 180)
  const skewX = toFactor(d?.skewX ?? TEXT_DEFAULTS.skewX)
  const skewY = toFactor(d?.skewY ?? TEXT_DEFAULTS.skewY)
  const fill = item.fillColor ?? TEXT_DEFAULTS.fill

  const beginEdit = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true
    const node = textRef.current
    if (!node) return
    node.hide()
    node.getLayer()?.batchDraw()
    openTextEditor(node, content, (value) => {
      node.show()
      node.getLayer()?.batchDraw()
      if (value === null) return
      const next: TextShapeData = {
        content: value,
        fontSize,
        fontFamily,
        align,
        skewX: d?.skewX ?? TEXT_DEFAULTS.skewX,
        skewY: d?.skewY ?? TEXT_DEFAULTS.skewY,
      }
      callbacks.onUpdateData(item.id, { textShapeData: next })
    })
  }

  return (
    <ParametricShapeBody {...props} centerOrigin={false}>
      <Text
        ref={textRef}
        text={content}
        width={width}
        fontSize={fontSize}
        fontFamily={fontFamily}
        align={align}
        skewX={skewX}
        skewY={skewY}
        fill={fill}
        onDblClick={beginEdit}
        onDblTap={beginEdit}
      />
    </ParametricShapeBody>
  )
}
