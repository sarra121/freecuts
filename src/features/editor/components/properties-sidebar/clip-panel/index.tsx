import { memo, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSelectionStore } from '@/shared/state/selection'
import { useItemsStore } from '@/features/editor/deps/timeline-store'
import { useProjectStore } from '@/features/editor/deps/projects'
import type { SelectionState, SelectionActions } from '@/shared/state/selection'
import type { TimelineItem } from '@/types/timeline'
import { ShapeProperties } from './shape-properties'

/**
 * Format a frame count to a seconds string with 2 decimal places.
 */
function framesToSeconds(frames: number, fps: number): string {
  return (frames / fps).toFixed(2) + 's'
}

/**
 * Clip info panel (read-only) — shown when one or more clips are selected.
 * Displays clip name, start time, and duration. No editing controls.
 */
export const ClipPanel = memo(function ClipPanel() {
  const selectedItemIds = useSelectionStore(
    (s: SelectionState & SelectionActions) => s.selectedItemIds,
  )
  const projectFps = useProjectStore((s) => s.currentProject?.metadata.fps ?? 30)
  const selectedItems = useItemsStore(
    useShallow(
      useCallback(
        (s) => {
          const items: TimelineItem[] = []
          for (const itemId of selectedItemIds) {
            const item = s.itemById[itemId]
            if (item) {
              items.push(item)
            }
          }
          return items
        },
        [selectedItemIds],
      ),
    ),
  )

  if (selectedItems.length === 0) {
    return null
  }

  // When every selected item is a shape, render the editing controls
  // above the read-only info cards. Mixed selections (shape + other)
  // skip the shape panel because the per-shape sections can't disambiguate.
  const allShapes =
    selectedItems.length > 0 && selectedItems.every((item) => item.type === 'shape')

  return (
    <div className="space-y-3">
      {allShapes && <ShapeProperties items={selectedItems} />}
      {selectedItems.map((item) => (
        <div
          key={item.id}
          className="rounded-md border border-border bg-muted/30 px-3 py-2 space-y-1.5"
        >
          {item.label ? (
            <p className="text-xs font-medium truncate" title={item.label}>
              {item.label}
            </p>
          ) : (
            <p className="text-xs font-medium text-muted-foreground italic">Untitled clip</p>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>Type</span>
            <span className="text-foreground capitalize">{item.type}</span>
            <span>Start</span>
            <span className="text-foreground">{framesToSeconds(item.from, projectFps)}</span>
            <span>Duration</span>
            <span className="text-foreground">
              {framesToSeconds(item.durationInFrames, projectFps)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
})
