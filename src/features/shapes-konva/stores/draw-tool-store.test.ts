import { describe, it, expect, beforeEach } from 'vitest'
import { useDrawToolStore } from './draw-tool-store'

describe('draw-tool-store', () => {
  beforeEach(() => {
    useDrawToolStore.setState({ state: { kind: 'idle' } })
  })

  it('starts idle', () => {
    expect(useDrawToolStore.getState().state.kind).toBe('idle')
  })

  it('startArrow puts the store into drawing-arrow with no tail yet', () => {
    useDrawToolStore.getState().startArrow()
    expect(useDrawToolStore.getState().state).toEqual({ kind: 'drawing-arrow', tail: null })
  })

  it('startPolygon puts the store into drawing-polygon with empty vertices', () => {
    useDrawToolStore.getState().startPolygon()
    expect(useDrawToolStore.getState().state).toEqual({ kind: 'drawing-polygon', vertices: [] })
  })

  it('appendPolygonVertex pushes to the vertex list', () => {
    useDrawToolStore.getState().startPolygon()
    useDrawToolStore.getState().appendPolygonVertex(10, 20)
    useDrawToolStore.getState().appendPolygonVertex(30, 40)
    expect(useDrawToolStore.getState().state).toEqual({
      kind: 'drawing-polygon',
      vertices: [10, 20, 30, 40],
    })
  })

  it('appendPolygonVertex is a no-op when not in drawing-polygon', () => {
    useDrawToolStore.getState().startArrow()
    useDrawToolStore.getState().appendPolygonVertex(10, 20)
    expect(useDrawToolStore.getState().state.kind).toBe('drawing-arrow')
  })

  it('setArrowTail stores the tail position', () => {
    useDrawToolStore.getState().startArrow()
    useDrawToolStore.getState().setArrowTail(50, 60)
    expect(useDrawToolStore.getState().state).toEqual({
      kind: 'drawing-arrow',
      tail: { x: 50, y: 60 },
    })
  })

  it('setArrowTail is a no-op when not in drawing-arrow', () => {
    useDrawToolStore.getState().startPolygon()
    useDrawToolStore.getState().setArrowTail(50, 60)
    expect(useDrawToolStore.getState().state.kind).toBe('drawing-polygon')
  })

  it('startFieldRing puts the store into placing-field-ring', () => {
    useDrawToolStore.getState().startFieldRing()
    expect(useDrawToolStore.getState().state).toEqual({ kind: 'placing-field-ring' })
  })

  it('cancel returns to idle from any state', () => {
    useDrawToolStore.getState().startPolygon()
    useDrawToolStore.getState().appendPolygonVertex(1, 2)
    useDrawToolStore.getState().cancel()
    expect(useDrawToolStore.getState().state.kind).toBe('idle')
  })
})
