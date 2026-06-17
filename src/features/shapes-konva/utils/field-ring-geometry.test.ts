import { describe, it, expect } from 'vitest'
import {
  ellipsePerimeter,
  computeDash,
  computeSpinDashOffset,
  ellipseRadiusInDirection,
  connectorEndpoints,
} from './field-ring-geometry'

describe('ellipsePerimeter', () => {
  it('matches the circle circumference when rx === ry', () => {
    const r = 50
    expect(ellipsePerimeter(r, r)).toBeCloseTo(2 * Math.PI * r, 5)
  })

  it('is between the bounds for a squashed ellipse', () => {
    const p = ellipsePerimeter(100, 34)
    // Loose sanity bounds for a real ellipse perimeter.
    expect(p).toBeGreaterThan(2 * Math.PI * 34)
    expect(p).toBeLessThan(2 * Math.PI * 100)
  })
})

describe('computeDash', () => {
  it('returns undefined when continuous', () => {
    expect(computeDash(300, 6, 0.4, true)).toBeUndefined()
  })

  it('returns undefined when segments <= 0', () => {
    expect(computeDash(300, 0, 0.4, false)).toBeUndefined()
  })

  it('splits the perimeter into segment + gap by gapRatio', () => {
    const dash = computeDash(300, 6, 0.4, false)
    expect(dash).toBeDefined()
    const [seg, gap] = dash as number[]
    expect(seg).toBeCloseTo(50 * 0.6, 5) // spacing = 300/6 = 50
    expect(gap).toBeCloseTo(50 * 0.4, 5)
  })
})

describe('computeSpinDashOffset', () => {
  it('is zero at the item start frame', () => {
    expect(computeSpinDashOffset(10, 10, 30, 0.25, 300)).toBe(0)
  })

  it('advances one full perimeter per revolution', () => {
    // 0.25 rev/sec * 4 sec = 1 revolution -> wraps to 0 offset.
    const fps = 30
    const frame = 10 + 4 * fps
    expect(computeSpinDashOffset(frame, 10, fps, 0.25, 300)).toBeCloseTo(0, 5)
  })

  it('is a fraction of perimeter mid-revolution', () => {
    const fps = 30
    // 0.25 rev/sec * 2 sec = 0.5 rev -> half the perimeter.
    const frame = 10 + 2 * fps
    expect(computeSpinDashOffset(frame, 10, fps, 0.25, 300)).toBeCloseTo(-150, 5)
  })

  it('returns 0 for non-positive fps', () => {
    expect(computeSpinDashOffset(100, 0, 0, 0.25, 300)).toBe(0)
  })
})

describe('ellipseRadiusInDirection', () => {
  it('returns the radius in any direction for a circle', () => {
    expect(ellipseRadiusInDirection(10, 10, 1, 0)).toBeCloseTo(10, 5)
    expect(ellipseRadiusInDirection(10, 10, 1, 1)).toBeCloseTo(10, 5)
  })

  it('returns rx along x and ry along y for an ellipse', () => {
    expect(ellipseRadiusInDirection(40, 12, 1, 0)).toBeCloseTo(40, 5)
    expect(ellipseRadiusInDirection(40, 12, 0, 1)).toBeCloseTo(12, 5)
  })
})

describe('connectorEndpoints', () => {
  it('pulls both ends back to the ring edges (circles on x axis)', () => {
    // Two r=10 circles 100 apart → link from x=10 to x=90.
    expect(connectorEndpoints(0, 0, 100, 0, 10, 10, 0)).toEqual([10, 0, 90, 0])
  })

  it('adds the buffer to each end', () => {
    expect(connectorEndpoints(0, 0, 100, 0, 10, 10, 2)).toEqual([12, 0, 88, 0])
  })

  it('returns null when rings overlap', () => {
    expect(connectorEndpoints(0, 0, 15, 0, 10, 10, 0)).toBeNull()
  })

  it('returns null for coincident centres', () => {
    expect(connectorEndpoints(5, 5, 5, 5, 10, 10, 0)).toBeNull()
  })
})
