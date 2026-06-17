import type { ShapeItem } from '@/types/timeline'
import { useTimelineStore } from '../../deps/timeline'
import { usePlaybackStore } from '../../deps/playback'
import { CONNECTED_RINGS_DEFAULTS } from '../../utils/defaults'
import { ensureShapeTrackForRange } from './ensure-shape-track'

interface CreateConnectedRingsInput {
  /** Absolute canvas-pixel node centres, flat [x0, y0, x1, y1, …] (>= 2 nodes). */
  vertices: number[]
  fps: number
}

/**
 * Create a connected-rings group from a click-to-draw gesture. Node centres
 * are stored in `freePolygonData` (absolute canvas-pixel coords), reusing the
 * free-polygon editing infra; the shared ring look + connector style live in
 * `connectedRingsData`. Returns the new item id, or null if too few nodes.
 */
export function createConnectedRings(input: CreateConnectedRingsInput): string | null {
  const { vertices, fps } = input
  if (vertices.length < 4 || vertices.length % 2 !== 0) {
    return null // need at least 2 nodes
  }
  const frame = usePlaybackStore.getState().currentFrame
  const durationInFrames = fps * 5
  const trackId = ensureShapeTrackForRange(frame, durationInFrames)
  const state = useTimelineStore.getState()

  const id = crypto.randomUUID()
  const item: ShapeItem = {
    id,
    type: 'shape',
    trackId,
    from: frame,
    durationInFrames,
    label: 'Connected rings',
    shapeType: 'connected-rings',
    fillColor: CONNECTED_RINGS_DEFAULTS.connectorColor,
    freePolygonData: {
      vertices: [...vertices],
      closed: false,
    },
    connectedRingsData: {
      nodeRadius: CONNECTED_RINGS_DEFAULTS.nodeRadius,
      connectorColor: CONNECTED_RINGS_DEFAULTS.connectorColor,
      connectorWidth: CONNECTED_RINGS_DEFAULTS.connectorWidth,
      ring: { ...CONNECTED_RINGS_DEFAULTS.ring },
    },
  }
  state.addItem(item)
  return id
}
