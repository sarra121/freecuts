/**
 * Tool shortcuts: V (Select), T (Trim Edit), C (Razor), Shift+C (Split at cursor), R (Rate Stretch).
 */

import { useHotkeys } from 'react-hotkeys-hook'
import { usePlaybackStore } from '@/shared/state/playback'
import { useTimelineStore } from '../../stores/timeline-store'
import { useSelectionStore } from '@/shared/state/selection'
import { HOTKEY_OPTIONS } from '@/config/hotkeys'
import type { TimelineShortcutCallbacks } from '../use-timeline-shortcuts'
import { useResolvedHotkeys } from '@/features/timeline/deps/settings'
import { SLIP_SLIDE_TOOLS_ENABLED } from '../../constants'

export function useToolShortcuts(callbacks: TimelineShortcutCallbacks) {
  const hotkeys = useResolvedHotkeys()
  const activeTool = useSelectionStore((s) => s.activeTool)
  const setActiveTool = useSelectionStore((s) => s.setActiveTool)

  // Tool: V - Selection Tool
  useHotkeys(
    hotkeys.SELECTION_TOOL,
    (event) => {
      event.preventDefault()
      setActiveTool('select')
    },
    HOTKEY_OPTIONS,
    [setActiveTool],
  )

  // Tool: T - Toggle Trim Edit Tool
  useHotkeys(
    hotkeys.TRIM_EDIT_TOOL,
    (event) => {
      event.preventDefault()
      setActiveTool(activeTool === 'trim-edit' ? 'select' : 'trim-edit')
    },
    HOTKEY_OPTIONS,
    [activeTool, setActiveTool],
  )

  // Tool: C - Toggle Razor/Cut Mode
  useHotkeys(
    hotkeys.RAZOR_TOOL,
    (event) => {
      event.preventDefault()
      setActiveTool(activeTool === 'razor' ? 'select' : 'razor')
    },
    HOTKEY_OPTIONS,
    [activeTool, setActiveTool],
  )

  // Tool: Shift+C - Split hovered item at gray playhead (or main playhead)
  useHotkeys(
    hotkeys.SPLIT_AT_CURSOR,
    (event) => {
      event.preventDefault()
      const { previewFrame, previewItemId, currentFrame } = usePlaybackStore.getState()
      const splitFrame = previewFrame ?? currentFrame
      const { items, splitItem } = useTimelineStore.getState()

      // If hovering over a specific item, split only that item
      if (previewItemId) {
        const item = items.find((i) => i.id === previewItemId)
        if (item && splitFrame > item.from && splitFrame < item.from + item.durationInFrames) {
          splitItem(item.id, splitFrame)
          if (callbacks.onSplit) {
            callbacks.onSplit()
          }
        }
      }
    },
    HOTKEY_OPTIONS,
    [callbacks],
  )

  // Tool: R - Toggle Rate Stretch Tool
  // MatchView strip-down: the Rate Stretch tool button was removed from the
  // timeline header, so this shortcut is disabled to avoid stranding the user
  // in an invisible tool. The binding/handler are kept here (commented) rather
  // than deleted, so the feature can be restored. The HOTKEYS config and the
  // rate-stretch engine code are untouched.
  // useHotkeys(
  //   hotkeys.RATE_STRETCH_TOOL,
  //   (event) => {
  //     event.preventDefault()
  //     setActiveTool(activeTool === 'rate-stretch' ? 'select' : 'rate-stretch')
  //   },
  //   HOTKEY_OPTIONS,
  //   [activeTool, setActiveTool],
  // )

  // Tool: Y - Toggle Slip Tool
  useHotkeys(
    hotkeys.SLIP_TOOL,
    (event) => {
      event.preventDefault()
      setActiveTool(activeTool === 'slip' ? 'select' : 'slip')
    },
    { ...HOTKEY_OPTIONS, enabled: SLIP_SLIDE_TOOLS_ENABLED },
    [activeTool, setActiveTool],
  )

  // Tool: U - Toggle Slide Tool
  useHotkeys(
    hotkeys.SLIDE_TOOL,
    (event) => {
      event.preventDefault()
      setActiveTool(activeTool === 'slide' ? 'select' : 'slide')
    },
    { ...HOTKEY_OPTIONS, enabled: SLIP_SLIDE_TOOLS_ENABLED },
    [activeTool, setActiveTool],
  )
}
