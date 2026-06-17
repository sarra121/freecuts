/**
 * Adapter exports for shapes-konva dependencies used by the export pipeline.
 *
 * Only PURE, worker-safe utilities may be re-exported here. The export render
 * loop runs inside a Web Worker, so anything that transitively imports Konva /
 * react-konva (which need the DOM) must NOT be pulled in. The modules below
 * import only `@/types` and plain math — no Konva — so they bundle cleanly
 * into the worker.
 */

export { resolveShapeAtFrame } from '@/features/shapes-konva/utils/shape-keyframes'
export {
  darken,
  ellipsePerimeter,
  computeDash,
  computeSpinDashOffset,
  connectorEndpoints,
} from '@/features/shapes-konva/utils/field-ring-geometry'
