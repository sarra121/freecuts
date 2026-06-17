import { describe, it, expect } from 'vitest'
import { deepMergePatch, resolveShapeAtFrame, mergeKeyframe } from './shape-keyframes'
import type { ShapeItem } from '@/types/timeline'

function baseItem(extra: Partial<ShapeItem> = {}): ShapeItem {
  return {
    id: 's1',
    type: 'shape',
    trackId: 't1',
    from: 0,
    durationInFrames: 100,
    label: 'Spotlight',
    shapeType: 'spotlight',
    fillColor: '#ffffff',
    transform: { x: 0, y: 0, width: 100, height: 200 },
    spotlightData: {
      intensity: 1,
      pool: true,
      bloom: true,
      cutout: true,
      cutoutWidth: 50,
      cutoutHeight: 180,
    },
    ...extra,
  } as ShapeItem
}

describe('deepMergePatch', () => {
  it('recurses into plain objects but replaces arrays + primitives', () => {
    const target = {
      transform: { x: 1, y: 2 },
      freePolygonData: { vertices: [0, 0, 1, 1], closed: false },
      fillColor: '#000',
    }
    // Typed as a generic record so the test can pass intentionally-partial
    // nested patches (the whole point of the deep merge) without the inferred
    // full-object types rejecting them.
    const out = deepMergePatch<Record<string, unknown>>(target, {
      transform: { x: 9 }, // merges → keeps y
      freePolygonData: { vertices: [5, 5] }, // array → replaces wholesale
      fillColor: '#fff', // primitive → replaces
    })
    expect(out.transform).toEqual({ x: 9, y: 2 }) // object merges → keeps y
    expect(out.freePolygonData).toEqual({ vertices: [5, 5], closed: false }) // object merges; array inside replaces
    expect(out.fillColor).toBe('#fff') // primitive replaces
  })
})

describe('resolveShapeAtFrame', () => {
  it('returns the SAME reference when there are no keyframes (memo fast-path)', () => {
    const item = baseItem()
    expect(resolveShapeAtFrame(item, 50)).toBe(item)
  })

  it('applies only patches with frame <= playhead, in order', () => {
    const item = baseItem({
      keyframes: [
        { frame: 0, patch: { fillColor: '#111' } },
        { frame: 30, patch: { fillColor: '#222' } },
        { frame: 60, patch: { fillColor: '#333' } },
      ],
    })
    expect(resolveShapeAtFrame(item, 15).fillColor).toBe('#111')
    expect(resolveShapeAtFrame(item, 45).fillColor).toBe('#222')
    expect(resolveShapeAtFrame(item, 999).fillColor).toBe('#333')
  })

  it('keyframes the new shape-specific blobs (spotlightData) field-by-field', () => {
    const item = baseItem({
      keyframes: [
        { frame: 0, patch: { spotlightData: { intensity: 0.3 } as ShapeItem['spotlightData'] } },
      ],
    })
    const r = resolveShapeAtFrame(item, 10)
    expect(r.spotlightData?.intensity).toBe(0.3)
    expect(r.spotlightData?.pool).toBe(true) // untouched field survives the merge
  })
})

describe('mergeKeyframe', () => {
  it('inserts a keyframe and auto-baselines frame 0 on the first change past 0', () => {
    const item = baseItem()
    const next = mergeKeyframe(item.keyframes, 30, { fillColor: '#222' }, item)
    expect(next.map((k) => k.frame)).toEqual([0, 30])
    expect(next[0]!.patch.fillColor).toBe('#ffffff') // baseline captured pre-change
    expect(next[1]!.patch.fillColor).toBe('#222')
  })

  it('merges into an existing entry at the same frame (one mark per frame)', () => {
    const item = baseItem({ keyframes: [{ frame: 30, patch: { fillColor: '#222' } }] })
    const next = mergeKeyframe(item.keyframes, 30, { strokeWidth: 4 }, item)
    expect(next).toHaveLength(1)
    expect(next[0]!.patch).toEqual({ fillColor: '#222', strokeWidth: 4 })
  })

  it('no auto-baseline when the first change is at frame 0', () => {
    const item = baseItem()
    const next = mergeKeyframe(item.keyframes, 0, { fillColor: '#222' }, item)
    expect(next).toHaveLength(1)
    expect(next[0]!.frame).toBe(0)
  })
})
