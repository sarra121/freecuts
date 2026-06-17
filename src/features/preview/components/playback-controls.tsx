import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { i18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Zap,
  Camera,
  Loader2,
} from 'lucide-react'
import { usePlaybackStore } from '@/shared/state/playback'
import { useSelectionStore } from '@/shared/state/selection'
import { usePreviewBridgeStore } from '@/shared/state/preview-bridge'
import { EDITOR_LAYOUT_CSS_VALUES } from '@/config/editor-layout'
import {
  insertFreezeFrame,
  useItemsStore,
  useTimelineStore,
} from '@/features/preview/deps/timeline-store'
import { toast } from 'sonner'
import { MonitorVolumeControl } from './monitor-volume-control'

interface PlaybackControlsProps {
  totalFrames: number
  fps: number
}

/**
 * Pick the video clip a freeze-frame should split: prefer the selected clip
 * when it's a video the playhead sits inside, otherwise the top-most (lowest
 * track `order`) video clip covering the playhead. Returns null when no video
 * covers the playhead. Edge frames are excluded (strict inequality) because
 * insertFreezeFrame needs room on both sides of the split.
 */
function findFreezeTargetClipId(frame: number): string | null {
  const items = useItemsStore.getState().items
  const covers = (it: (typeof items)[number]) =>
    it.type === 'video' && frame > it.from && frame < it.from + it.durationInFrames

  const selectedIds = useSelectionStore.getState().selectedItemIds
  const selected = items.find((it) => selectedIds.includes(it.id) && covers(it))
  if (selected) return selected.id

  const tracks = useTimelineStore.getState().tracks
  const orderOf = (trackId: string) =>
    tracks.find((tr) => tr.id === trackId)?.order ?? Number.POSITIVE_INFINITY
  const candidate = items
    .filter(covers)
    .sort((a, b) => orderOf(a.trackId) - orderOf(b.trackId))[0]
  return candidate?.id ?? null
}

/**
 * Playback Controls Component
 *
 * Transport controls with:
 * - Play/Pause toggle
 * - Frame navigation (previous/next)
 * - Skip to start/end
 * - Frame capture
 * - Volume control
 */
const btnSize = {
  width: EDITOR_LAYOUT_CSS_VALUES.toolbarButtonSize,
  height: EDITOR_LAYOUT_CSS_VALUES.toolbarButtonSize,
} as const

export function PlaybackControls({ totalFrames }: PlaybackControlsProps) {
  const { t } = useTranslation()
  const [isSavingFrame, setIsSavingFrame] = useState(false)

  // Use granular selectors - Zustand v5 best practice
  // NOTE: Don't subscribe to currentFrame - only needed in click handlers
  // Read from store directly when needed to avoid re-renders every frame
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const useProxy = usePlaybackStore((s) => s.useProxy)
  const togglePlayPause = usePlaybackStore((s) => s.togglePlayPause)
  const setCurrentFrame = usePlaybackStore((s) => s.setCurrentFrame)
  const setPreviewFrame = usePlaybackStore((s) => s.setPreviewFrame)
  const toggleUseProxy = usePlaybackStore((s) => s.toggleUseProxy)
  const setDisplayedFrame = usePreviewBridgeStore((s) => s.setDisplayedFrame)

  // Note: Automatic playback loop is now handled by Composition Player
  // The Player controls frame advancement via frameupdate events

  // Note: totalFrames is the count, so valid frame indices are [0, totalFrames - 1]
  const lastValidFrame = Math.max(0, totalFrames - 1)

  const commitTimelineSeek = (frame: number) => {
    // Transport seeks should exit hover-scrub state so Player rendering
    // follows the actual playhead immediately.
    setPreviewFrame(null)
    setDisplayedFrame(null)
    setCurrentFrame(frame)
  }

  const handleGoToStart = () => commitTimelineSeek(0)
  const handleGoToEnd = () => commitTimelineSeek(lastValidFrame)
  const handlePreviousFrame = () => {
    const currentFrame = usePlaybackStore.getState().currentFrame
    commitTimelineSeek(Math.max(0, currentFrame - 1))
  }
  const handleNextFrame = () => {
    const currentFrame = usePlaybackStore.getState().currentFrame
    commitTimelineSeek(Math.min(lastValidFrame, currentFrame + 1))
  }

  // Camera button: freeze the frame at the playhead and splice it in as a
  // still image. insertFreezeFrame splits the target video at the playhead,
  // extracts the source frame at native resolution, stores it as a media item,
  // and ripples the right half + everything after — all in one undo step.
  const handleFreezeFrame = async () => {
    if (isSavingFrame) return

    setIsSavingFrame(true)
    try {
      const playback = usePlaybackStore.getState()
      const frame = Math.round(playback.previewFrame ?? playback.currentFrame)

      const clipId = findFreezeTargetClipId(frame)
      if (!clipId) {
        toast.error(i18n.t('preview.controls.saveFrameFailed'))
        return
      }

      const inserted = await insertFreezeFrame(clipId, frame)
      if (inserted) {
        toast.success(i18n.t('preview.controls.frameSaved'))
      } else {
        toast.error(i18n.t('preview.controls.saveFrameFailed'))
      }
    } catch {
      toast.error(i18n.t('preview.controls.saveFrameFailed'))
    } finally {
      setIsSavingFrame(false)
    }
  }

  return (
    <>
      {/* Transport Controls */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
          style={btnSize}
          onClick={handleGoToStart}
          data-tooltip={t('preview.controls.goToStartTooltip')}
          aria-label={t('preview.controls.goToStart')}
        >
          <SkipBack className="w-3.5 h-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
          style={btnSize}
          onClick={handlePreviousFrame}
          data-tooltip={t('preview.controls.prevFrameTooltip')}
          aria-label={t('preview.controls.prevFrame')}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>

        <Button
          size="icon"
          className="flex-shrink-0"
          style={btnSize}
          onClick={togglePlayPause}
          data-tooltip={
            isPlaying ? t('preview.controls.pauseTooltip') : t('preview.controls.playTooltip')
          }
          aria-label={isPlaying ? t('preview.player.pause') : t('preview.player.play')}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
          style={btnSize}
          onClick={handleNextFrame}
          data-tooltip={t('preview.controls.nextFrameTooltip')}
          aria-label={t('preview.controls.nextFrame')}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
          style={btnSize}
          onClick={handleGoToEnd}
          data-tooltip={t('preview.controls.goToEndTooltip')}
          aria-label={t('preview.controls.goToEnd')}
        >
          <SkipForward className="w-3.5 h-3.5" />
        </Button>

        <MonitorVolumeControl buttonStyle={btnSize} />
      </div>

      {/* Save frame — hidden at narrow widths */}
      <div className="hidden @min-[440px]:flex items-center gap-0.5 flex-shrink-0">
        <Separator orientation="vertical" className="h-4 flex-shrink-0" />

        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
          style={btnSize}
          onClick={() => {
            void handleFreezeFrame()
          }}
          disabled={isSavingFrame}
          data-tooltip={
            isSavingFrame
              ? t('preview.controls.savingFrameTooltip')
              : t('preview.controls.saveFrameTooltip')
          }
          aria-label={
            isSavingFrame ? t('preview.controls.savingFrame') : t('preview.controls.saveFrame')
          }
        >
          {isSavingFrame ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Camera className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* Proxy toggle — hidden at narrow widths */}
      <div className="hidden @min-[440px]:flex items-center gap-0.5 flex-shrink-0">
        <Separator orientation="vertical" className="h-4 flex-shrink-0" />

        <Button
          variant="ghost"
          size="icon"
          style={btnSize}
          className={`flex-shrink-0 ${
            useProxy
              ? 'text-green-500 hover:text-green-400 hover:bg-green-500/10'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={toggleUseProxy}
          data-tooltip={
            useProxy
              ? t('preview.controls.proxyPlaybackOn')
              : t('preview.controls.proxyPlaybackOff')
          }
          aria-label={
            useProxy
              ? t('preview.controls.disableProxyPlayback')
              : t('preview.controls.enableProxyPlayback')
          }
        >
          <Zap className="w-3.5 h-3.5" />
        </Button>
      </div>
    </>
  )
}
