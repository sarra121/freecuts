import { Text } from 'react-konva'
import type { ShapeProps } from '../types'
import { TIMER_DEFAULTS } from '../utils/defaults'
import { resolveParametricPosition } from '../utils/parametric-position'
import { ParametricShapeBody } from '../components/parametric-shape-body'
import { timerValueSeconds, formatTimer } from '../utils/timer-format'
import { useTimelineStore } from '../deps/timeline'

/**
 * Timeline-synced timer (match clock counting up, or drill countdown). The
 * displayed time is a pure function of the playhead frame, so it ticks during
 * playback, shows the correct value when scrubbing, and (eventually) matches an
 * export render. Reuses the shared text styling via Konva <Text> inside
 * ParametricShapeBody (drag to move; size/format via properties — no
 * transformer).
 */
export function TimerShape(props: ShapeProps) {
  const { item, frame, canvasWidth, canvasHeight } = props
  const d = item.timerData
  const fps = useTimelineStore((s) => s.fps)

  const { width } = resolveParametricPosition(item, canvasWidth, canvasHeight)
  const fill = item.fillColor ?? TIMER_DEFAULTS.fill
  const mode = d?.mode ?? TIMER_DEFAULTS.mode
  const offsetSec = d?.offsetSec ?? TIMER_DEFAULTS.offsetSec
  const durationSec = d?.durationSec ?? TIMER_DEFAULTS.durationSec
  const format = d?.format ?? TIMER_DEFAULTS.format
  const fontSize = d?.fontSize ?? TIMER_DEFAULTS.fontSize
  const fontFamily = d?.fontFamily ?? TIMER_DEFAULTS.fontFamily

  const elapsedSec = fps > 0 ? (frame - item.from) / fps : 0
  const value = timerValueSeconds(mode, offsetSec, durationSec, elapsedSec)
  const text = formatTimer(value, format)

  return (
    <ParametricShapeBody {...props} centerOrigin={false}>
      <Text
        text={text}
        width={width}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontStyle="bold"
        align="center"
        fill={fill}
        shadowColor="rgba(0,0,0,0.5)"
        shadowBlur={3}
        shadowOffsetY={1}
      />
    </ParametricShapeBody>
  )
}
