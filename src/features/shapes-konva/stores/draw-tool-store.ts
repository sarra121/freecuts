import { create } from 'zustand'
import type { DrawState, ParametricShapeKind } from '../types'

interface DrawToolStore {
  state: DrawState
  startArrow(): void
  startPolygon(): void
  startParametric(shapeType: ParametricShapeKind): void
  startFieldRing(): void
  startConnectedRings(): void
  startSpotlight(): void
  startText(): void
  startTimer(): void
  setArrowTail(x: number, y: number): void
  appendPolygonVertex(x: number, y: number): void
  appendConnectedRingsVertex(x: number, y: number): void
  cancel(): void
}

/**
 * State for the canvas drawing tools. The single `state` value follows a
 * small state machine: `idle`, `drawing-arrow`, `drawing-polygon`,
 * `placing-parametric`. Pointer-event handlers on the Konva stage read
 * the kind and feed vertex / tail data back through these actions.
 *
 * `placing-parametric` is the click-to-place tool for the 5 parametric
 * shapes; it stays active across placements so users can drop multiple
 * shapes without re-selecting the tool.
 */
export const useDrawToolStore = create<DrawToolStore>()((set) => ({
  state: { kind: 'idle' },

  startArrow: () => set({ state: { kind: 'drawing-arrow', tail: null } }),

  startPolygon: () => set({ state: { kind: 'drawing-polygon', vertices: [] } }),

  startParametric: (shapeType) =>
    set({ state: { kind: 'placing-parametric', shapeType } }),

  startFieldRing: () => set({ state: { kind: 'placing-field-ring' } }),

  startConnectedRings: () => set({ state: { kind: 'drawing-connected-rings', vertices: [] } }),

  startSpotlight: () => set({ state: { kind: 'placing-spotlight' } }),

  startText: () => set({ state: { kind: 'placing-text' } }),

  startTimer: () => set({ state: { kind: 'placing-timer' } }),

  setArrowTail: (x, y) =>
    set((s) =>
      s.state.kind === 'drawing-arrow' ? { state: { kind: 'drawing-arrow', tail: { x, y } } } : s,
    ),

  appendPolygonVertex: (x, y) =>
    set((s) =>
      s.state.kind === 'drawing-polygon'
        ? { state: { kind: 'drawing-polygon', vertices: [...s.state.vertices, x, y] } }
        : s,
    ),

  appendConnectedRingsVertex: (x, y) =>
    set((s) =>
      s.state.kind === 'drawing-connected-rings'
        ? { state: { kind: 'drawing-connected-rings', vertices: [...s.state.vertices, x, y] } }
        : s,
    ),

  cancel: () => set({ state: { kind: 'idle' } }),
}))
