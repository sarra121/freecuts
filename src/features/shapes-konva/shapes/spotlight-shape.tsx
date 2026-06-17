import { useEffect, useRef } from 'react'
import { Group, Line, Ellipse, Rect } from 'react-konva'
import Konva from 'konva'
import type { ShapeProps } from '../types'
import { SPOTLIGHT_DEFAULTS } from '../utils/defaults'
import { resolveParametricPosition } from '../utils/parametric-position'
import { ParametricShapeBody } from '../components/parametric-shape-body'

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return { r: 255, g: 217, b: 0 }
  const n = parseInt(m[1]!, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
function rgba(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/**
 * Player spotlight: a faded-top light beam landing on a solid ground pool, with
 * a tight rectangular cutout punched out (Konva destination-out) so the player
 * shows through. The cutout is a narrow vertical strip whose erase strength is
 * strong at the feet and fades to nothing toward the top, and it's lightly
 * blurred so the side edges aren't hard.
 *
 * Two caches:
 *  - the cutout sub-group is cached + Blur-filtered (soft side edges) and
 *    carries globalCompositeOperation 'destination-out';
 *  - the main group is cached so destination-out only carves THIS shape's
 *    pixels, not other shapes on the layer.
 *
 * Coordinates: drawn centred at local (0,0); feet at y = +height/2. Beam is a
 * straight column (taper default 0) and the pool radius = beam half-width, so
 * the disk spans the full beam width.
 */
export function SpotlightShape(props: ShapeProps) {
  const { item, canvasWidth, canvasHeight } = props
  const d = item.spotlightData
  const mainRef = useRef<Konva.Group>(null)
  const cutoutRef = useRef<Konva.Group>(null)

  const { width, height } = resolveParametricPosition(item, canvasWidth, canvasHeight)
  const fill = item.fillColor ?? SPOTLIGHT_DEFAULTS.fill
  const intensity = d?.intensity ?? SPOTLIGHT_DEFAULTS.intensity
  const showPool = d?.pool ?? SPOTLIGHT_DEFAULTS.pool
  const showBloom = d?.bloom ?? SPOTLIGHT_DEFAULTS.bloom
  const showCutout = d?.cutout ?? SPOTLIGHT_DEFAULTS.cutout
  const cw = d?.cutoutWidth ?? SPOTLIGHT_DEFAULTS.cutoutWidth
  const ch = d?.cutoutHeight ?? SPOTLIGHT_DEFAULTS.cutoutHeight

  const H = height
  const rX = width / 2
  const baseRY = rX * 0.4
  const feetY = H / 2
  const topY = -H / 2
  const feather = Math.max(12, cw * 0.55) // soft cutout edges on all sides

  // Feather the cutout: cache its sub-group + Blur. Declared FIRST so it
  // caches before the main-group cache captures the blurred result.
  useEffect(() => {
    const n = cutoutRef.current
    if (!n) return
    n.clearCache()
    if (showCutout) {
      n.cache()
      n.filters([Konva.Filters.Blur])
      n.blurRadius(feather)
    }
  }, [showCutout, cw, ch, feather, width, height])

  // Cache the whole spotlight so destination-out is self-contained.
  useEffect(() => {
    const g = mainRef.current
    if (!g) return
    g.clearCache()
    g.cache()
    g.getLayer()?.batchDraw()
  }, [width, height, fill, intensity, showPool, showBloom, showCutout, cw, ch, feather])

  // Straight rectangular column (no taper — not a cone).
  const beamPoints = [-rX, topY, rX, topY, rX, feetY, -rX, feetY]

  return (
    <ParametricShapeBody {...props} centerOrigin={false}>
      <Group ref={mainRef}>
        {/* Beam — faded upper, brightest just above the ground. */}
        <Line
          closed
          points={beamPoints}
          fillLinearGradientStartPoint={{ x: 0, y: feetY }}
          fillLinearGradientEndPoint={{ x: 0, y: topY }}
          fillLinearGradientColorStops={[
            0, rgba(fill, 0), // bottom edge melts into the disk (no hard line)
            0.10,rgba(fill, 0.34 * intensity), // bright right down to the pool
            0.42, rgba(fill, 0.28 * intensity),
            0.78, rgba(fill, 0.07 * intensity),
            1, rgba(fill, 0), // top — fully faded
          ]}
        />

        {/* Ground pool — solid disk (hard sides, no rim fade). Only the upper
            half fades a little so it blends into the beam. Diameter = beam width. */}
        {showPool && (
          <Ellipse
            x={0}
            y={feetY}
            radiusX={rX}
            radiusY={baseRY}
            fillLinearGradientStartPoint={{ x: 0, y: baseRY }}
            fillLinearGradientEndPoint={{ x: 0, y: -baseRY }}
            fillLinearGradientColorStops={[
              0, rgba(fill, 0.55 * intensity), // bottom — solid
              0.5, rgba(fill, 0.52 * intensity), // lower/centre — solid
              1, rgba(fill, 0.26 * intensity), // upper edge — fades a bit into the beam
            ]}
          />
        )}

        {/* Base bloom */}
        {showBloom && (
          <Ellipse
            x={0}
            y={feetY}
            radiusX={rX * 0.5}
            radiusY={baseRY * 0.5}
            fillRadialGradientStartPoint={{ x: 0, y: 0 }}
            fillRadialGradientStartRadius={0}
            fillRadialGradientEndPoint={{ x: 0, y: 0 }}
            fillRadialGradientEndRadius={rX * 0.5}
            fillRadialGradientColorStops={[0, rgba('#fff2a8', 0.55 * intensity), 1, rgba('#fff2a8', 0)]}
          />
        )}

        {/* Tight rectangular cutout — strong erase at the feet, fading to none
            at the top so the player shows through without trapping them. */}
        {showCutout && (
          <Group ref={cutoutRef} globalCompositeOperation="destination-out">
            <Rect
              x={-cw / 2}
              y={feetY - ch}
              width={cw}
              height={ch}
              fillLinearGradientStartPoint={{ x: 0, y: ch }}
              fillLinearGradientEndPoint={{ x: 0, y: 0 }}
              fillLinearGradientColorStops={[
                0, 'rgba(0,0,0,0.9)',
                0.55, 'rgba(0,0,0,0.75)',
                1, 'rgba(0,0,0,0)',
              ]}
            />
          </Group>
        )}
      </Group>
    </ParametricShapeBody>
  )
}
