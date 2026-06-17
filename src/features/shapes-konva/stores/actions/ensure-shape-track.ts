import type { TimelineItem, TimelineTrack } from '@/types/timeline'
import { useTimelineStore } from '../../deps/timeline'

const SHAPE_TRACK_NAME = 'Shapes'
const SHAPE_TRACK_HEIGHT = 56

/**
 * Find an existing shape track with free space at [from, from + durationInFrames],
 * or create a new shape track on top if none has room.
 *
 * Behaviour (sports-analysis annotation model):
 *  - The clip is anchored to the current playhead — `from` is never shifted.
 *  - Multiple shape tracks may stack on top of each other; each acts like a
 *    Photoshop layer for annotations.
 *  - We scan shape tracks from top to bottom (lowest `order` first). The first
 *    track with no overlap at the requested range wins.
 *  - If every shape track has a conflict, we create a fresh shape track at the
 *    top (`order = minOrder - 1`) so the new clip lands there without
 *    disturbing existing annotations.
 *
 * Returns the track id to attach the new shape item to. Always succeeds.
 */
export function ensureShapeTrackForRange(from: number, durationInFrames: number): string {
  const state = useTimelineStore.getState()
  const candidateEnd = from + durationInFrames

  const shapeTracks = state.tracks
    .filter((t: TimelineTrack) => t.kind === 'shape' && !t.isGroup)
    .sort((a: TimelineTrack, b: TimelineTrack) => (a.order ?? 0) - (b.order ?? 0))

  if (shapeTracks.length > 0) {
    const itemsByTrack = new Map<string, TimelineItem[]>()
    for (const item of state.items) {
      const bucket = itemsByTrack.get(item.trackId)
      if (bucket) bucket.push(item)
      else itemsByTrack.set(item.trackId, [item])
    }

    for (const track of shapeTracks) {
      const items = itemsByTrack.get(track.id) ?? []
      const hasConflict = items.some((existing) => {
        const existingEnd = existing.from + existing.durationInFrames
        return from < existingEnd && candidateEnd > existing.from
      })
      if (!hasConflict) return track.id
    }
  }

  // No shape track has room at the requested range — create a new one above
  // every existing track. Lower `order` = visually higher per the project's
  // track-ordering convention.
  const minOrder =
    state.tracks.length > 0
      ? Math.min(...state.tracks.map((t: TimelineTrack) => t.order ?? 0))
      : 0

  const id = crypto.randomUUID()
  const newTrack: TimelineTrack = {
    id,
    name: SHAPE_TRACK_NAME,
    kind: 'shape',
    height: SHAPE_TRACK_HEIGHT,
    locked: false,
    visible: true,
    muted: false,
    solo: false,
    order: minOrder - 1,
    items: [],
  }

  state.setTracks([newTrack, ...state.tracks])
  return id
}
