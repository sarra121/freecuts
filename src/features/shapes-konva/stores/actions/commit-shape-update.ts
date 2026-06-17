import type { ShapeItem } from '@/types/timeline'
import { useTimelineStore } from '../../deps/timeline'
import { usePlaybackStore } from '../../deps/playback'
import { mergeKeyframe } from '../../utils/shape-keyframes'

/**
 * The single write path for shape edits. Updates the base item AND records a
 * keyframe of `patch` at the current clip-relative frame — in ONE updateItem
 * call, so it's a single undo entry (the timeline store is zundo-wrapped).
 * Used by every edit surface (panel, body drag, transformer, vertex).
 * `patch` is any subset of ShapeItem fields.
 */
export function commitShapeUpdate(itemId: string, patch: Partial<ShapeItem>): void {
  const state = useTimelineStore.getState()
  const item = state.items.find((it) => it.id === itemId) as ShapeItem | undefined
  if (!item || item.type !== 'shape') return

  const frame = usePlaybackStore.getState().currentFrame
  const rel = Math.max(0, Math.min(item.durationInFrames - 1, frame - item.from))
  const keyframes = mergeKeyframe(item.keyframes, rel, patch, item)

  state.updateItem(itemId, { ...patch, keyframes })
}
