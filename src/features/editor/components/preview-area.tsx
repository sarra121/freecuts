import { useState, useEffect, useRef, memo, useMemo } from 'react'
import {
  VideoPreview,
  PlaybackControls,
  TimecodeDisplay,
  PreviewZoomControls,
  InlineSourcePreview,
  InlineCompositionPreview,
} from '@/features/editor/deps/preview'
import { useTimelineStore } from '@/features/editor/deps/timeline-store'
import { useProjectStore } from '@/features/editor/deps/projects'
import { useSettingsStore } from '@/features/editor/deps/settings'
import { useEditorStore } from '@/shared/state/editor'
import { EDITOR_LAYOUT_CSS_VALUES, getEditorLayout } from '@/config/editor-layout'
import { ErrorBoundary } from '@/app/error-boundary'

interface PreviewAreaProps {
  project: {
    width: number
    height: number
    fps: number
  }
}

const DEFAULT_EMPTY_TIMELINE_SECONDS = 10
const PREVIEW_RESIZE_MIN_UPDATE_MS = 33

const ProgramPreviewSurface = memo(function ProgramPreviewSurface({
  project,
  containerSize,
}: {
  project: {
    width: number
    height: number
    fps: number
    backgroundColor?: string
  }
  containerSize: {
    width: number
    height: number
  }
}) {
  const mediaSkimPreviewMediaId = useEditorStore((s) => s.mediaSkimPreviewMediaId)
  const mediaSkimPreviewFrame = useEditorStore((s) => s.mediaSkimPreviewFrame)
  const compoundClipSkimPreviewCompositionId = useEditorStore(
    (s) => s.compoundClipSkimPreviewCompositionId,
  )
  const compoundClipSkimPreviewFrame = useEditorStore((s) => s.compoundClipSkimPreviewFrame)
  const skimPreviewOverlay = compoundClipSkimPreviewCompositionId ? (
    <InlineCompositionPreview
      compositionId={compoundClipSkimPreviewCompositionId}
      seekFrame={compoundClipSkimPreviewFrame}
      containerSize={containerSize}
    />
  ) : mediaSkimPreviewMediaId ? (
    <InlineSourcePreview
      mediaId={mediaSkimPreviewMediaId}
      seekFrame={mediaSkimPreviewFrame}
      containerSize={containerSize}
    />
  ) : null

  return (
    <ErrorBoundary level="component">
      <div className="relative w-full h-full">
        <VideoPreview
          project={project}
          containerSize={containerSize}
          suspendOverlay={false}
        />
        {skimPreviewOverlay && (
          <div className="absolute inset-0 z-40 bg-video-preview-background">
            {skimPreviewOverlay}
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
})

/**
 * Preview Area Component
 *
 * Modular composition of preview-related components:
 * - VideoPreview: Canvas with grid, rulers, frame counter
 * - PlaybackControls: Transport controls with React 19 patterns
 * - TimecodeDisplay: Current time display
 * - PreviewZoomControls: Fit-to-panel zoom control
 *
 * Uses granular Zustand selectors in child components
 */
export const PreviewArea = memo(function PreviewArea({ project }: PreviewAreaProps) {
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const editorDensity = useSettingsStore((s) => s.editorDensity)
  const editorLayout = getEditorLayout(editorDensity)

  // Read current project from store for live updates (e.g., dimension swaps)
  // Use granular selectors to avoid re-renders when unrelated properties change
  const projectWidth = useProjectStore((s) => s.currentProject?.metadata.width)
  const projectHeight = useProjectStore((s) => s.currentProject?.metadata.height)
  const projectFps = useProjectStore((s) => s.currentProject?.metadata.fps)
  const projectBgColor = useProjectStore((s) => s.currentProject?.metadata.backgroundColor)

  const width = projectWidth ?? project.width
  const height = projectHeight ?? project.height
  const fps = projectFps ?? project.fps
  const backgroundColor = projectBgColor ?? '#000000'

  // Derive timeline end frame directly from store state to avoid recreating selector functions.
  const timelineEndFrame = useTimelineStore((s) => {
    if (s.items.length === 0) return null
    let maxFrame = 0
    for (const item of s.items) {
      const itemEnd = item.from + item.durationInFrames
      if (itemEnd > maxFrame) {
        maxFrame = itemEnd
      }
    }
    return maxFrame
  })

  const totalFrames = timelineEndFrame ?? fps * DEFAULT_EMPTY_TIMELINE_SECONDS

  // Measure preview container size for zoom calculations
  useEffect(() => {
    const element = previewContainerRef.current
    if (!element) return
    let rafId: number | null = null
    let lastUpdateTs = 0

    const updateSize = () => {
      const rect = element.getBoundingClientRect()
      const nextWidth = Math.max(0, Math.floor(rect.width - editorLayout.previewPadding))
      const nextHeight = Math.max(0, Math.floor(rect.height - editorLayout.previewPadding))

      // Bail out when dimensions are unchanged to avoid redundant re-renders.
      setContainerSize((prev) => {
        if (prev.width === nextWidth && prev.height === nextHeight) {
          return prev
        }
        return { width: nextWidth, height: nextHeight }
      })
    }

    const scheduleUpdate = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        const now = performance.now()
        if (now - lastUpdateTs < PREVIEW_RESIZE_MIN_UPDATE_MS) {
          rafId = requestAnimationFrame(() => {
            rafId = null
            lastUpdateTs = performance.now()
            updateSize()
          })
          return
        }
        rafId = null
        lastUpdateTs = now
        updateSize()
      })
    }

    updateSize()

    const resizeObserver = new ResizeObserver(scheduleUpdate)
    resizeObserver.observe(element)

    return () => {
      resizeObserver.disconnect()
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [editorLayout.previewPadding])

  const liveProject = useMemo(
    () => ({ width, height, fps, backgroundColor }),
    [width, height, fps, backgroundColor],
  )

  return (
    <div
      className="flex-1 flex min-h-0 min-w-0 relative"
      role="region"
      aria-label="Preview area"
    >
      <div
        className="flex flex-col flex-1 min-w-0 min-h-0"
        role="region"
        aria-label="Program monitor"
      >
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div
            ref={previewContainerRef}
            className="flex-1 min-h-0 relative overflow-hidden"
            aria-label="Preview canvas region"
          >
            <ProgramPreviewSurface
              project={liveProject}
              containerSize={containerSize}
            />
          </div>

          <div className="flex flex-col flex-shrink-0">
            {/* Playback controls row */}
            <div
              className="@container border-t border-border panel-header relative flex items-center px-3 overflow-hidden"
              style={{ height: EDITOR_LAYOUT_CSS_VALUES.previewControlsHeight }}
            >
              <div className="flex-shrink-0">
                <TimecodeDisplay fps={fps} totalFrames={totalFrames} />
              </div>

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-2.5 pointer-events-auto">
                  <PlaybackControls totalFrames={totalFrames} fps={fps} />
                </div>
              </div>

              <div className="ml-auto flex-shrink-0">
                <PreviewZoomControls />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
