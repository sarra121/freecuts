import { useCallback, useRef, useEffect, memo, Activity } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Disc,
  Egg,
  Flashlight,
  Hexagon,
  Image as ImageIcon,
  MoveUpRight,
  Pentagon,
  Square,
  Timer as TimerIcon,
  Triangle,
  Type,
  Waypoints,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEditorStore } from '@/shared/state/editor'
import { MediaLibrary } from '@/features/editor/deps/media-library'
import {
  EDITOR_LAYOUT_CSS_VALUES,
  clampLeftEditorSidebarWidth,
  getEditorLayout,
} from '@/config/editor-layout'
import { useSettingsStore } from '@/features/editor/deps/settings'
// MatchView: useProjectStore was used by the previous click-to-add-at-center
// implementation that read project fps. The new click-to-place tool reads fps
// from the timeline store at click time inside use-place-parametric-tool, so
// this import is unused here. Restore if reverting to the simpler
// create-at-centre flow.
// import { useProjectStore } from '@/features/editor/deps/projects'
import {
  useDrawToolStore,
  type ParametricShapeType,
  createImageShape,
} from '@/features/editor/deps/shapes-konva'
// MatchView: createParametricShape is no longer called directly from the
// media-sidebar — the parametric tool is started via startParametric() (in
// useDrawToolStore) and the actual createParametricShape call happens inside
// usePlaceParametricTool when the user clicks the stage. The type import is
// still needed for the button onClick handler's argument; it now comes through
// the editor deps adapter alongside useDrawToolStore above (boundary fix).
// (If ever restored, createParametricShape should be re-exported through the
// editor deps adapter too — not imported from the shapes-konva barrel here.)

export const MediaSidebar = memo(function MediaSidebar() {
  const { t } = useTranslation()
  const editorDensity = useSettingsStore((s) => s.editorDensity)
  const editorLayout = getEditorLayout(editorDensity)
  // Use granular selectors - Zustand v5 best practice
  const leftSidebarOpen = useEditorStore((s) => s.leftSidebarOpen)
  const toggleLeftSidebar = useEditorStore((s) => s.toggleLeftSidebar)
  const mediaFullColumn = useEditorStore((s) => s.mediaFullColumn)
  const toggleMediaFullColumn = useEditorStore((s) => s.toggleMediaFullColumn)
  const sidebarWidth = useEditorStore((s) => s.sidebarWidth)
  const setSidebarWidth = useEditorStore((s) => s.setSidebarWidth)
  const drawState = useDrawToolStore((s) => s.state)
  const startPolygon = useDrawToolStore((s) => s.startPolygon)
  const startArrow = useDrawToolStore((s) => s.startArrow)
  const startParametric = useDrawToolStore((s) => s.startParametric)
  const startFieldRing = useDrawToolStore((s) => s.startFieldRing)
  const startConnectedRings = useDrawToolStore((s) => s.startConnectedRings)
  const startSpotlight = useDrawToolStore((s) => s.startSpotlight)
  const startText = useDrawToolStore((s) => s.startText)
  const startTimer = useDrawToolStore((s) => s.startTimer)
  const cancelDraw = useDrawToolStore((s) => s.cancel)
  const drawingPolygon = drawState.kind === 'drawing-polygon'
  const drawingArrow = drawState.kind === 'drawing-arrow'
  const placingFieldRing = drawState.kind === 'placing-field-ring'
  const drawingConnectedRings = drawState.kind === 'drawing-connected-rings'
  const placingSpotlight = drawState.kind === 'placing-spotlight'
  const placingText = drawState.kind === 'placing-text'
  const placingTimer = drawState.kind === 'placing-timer'
  const placingShapeType =
    drawState.kind === 'placing-parametric' ? drawState.shapeType : null

  // MatchView: previous click-to-add-at-centre handler. Replaced by the
  // tool-based `handleToggleParametric` below. Kept here for restoration
  // if we ever revert to the simpler "drop at canvas centre" flow.
  // const projectFps = useProjectStore((s) => s.currentProject?.metadata.fps ?? 30)
  // const handleCreateParametric = useCallback(
  //   (shapeType: ParametricShapeType) => {
  //     createParametricShape({ shapeType, fps: projectFps })
  //   },
  //   [projectFps],
  // )

  // Image overlay: a file-picker tool (not click-to-place). The button opens
  // a hidden <input>; the chosen file becomes an image shape at the playhead.
  const imageInputRef = useRef<HTMLInputElement>(null)
  const handleImageFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so re-picking the same file fires onChange
    if (!file) return
    await createImageShape({ file })
  }, [])

  const handleToggleParametric = useCallback(
    (shapeType: ParametricShapeType) => {
      // Click while this tool is already active → cancel (return to idle).
      // Click while idle or while a different tool is active → start this one.
      if (placingShapeType === shapeType) {
        cancelDraw()
      } else {
        startParametric(shapeType)
      }
    },
    [placingShapeType, startParametric, cancelDraw],
  )

  // Resize handle logic
  const isResizingRef = useRef(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isResizingRef.current = true
      startXRef.current = e.clientX
      startWidthRef.current = sidebarWidth
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [sidebarWidth],
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return
      const delta = e.clientX - startXRef.current
      const newWidth = clampLeftEditorSidebarWidth(startWidthRef.current + delta, editorLayout)
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      if (!isResizingRef.current) return
      isResizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      isResizingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [editorLayout, setSidebarWidth])

  return (
    <div className="flex h-full flex-shrink-0">
      {/* Vertical Rail — collapse/expand button only */}
      <div
        className="panel-header border-r border-border flex flex-col items-center flex-shrink-0"
        style={{ width: EDITOR_LAYOUT_CSS_VALUES.sidebarRailWidth }}
      >
        {/* Header row - aligned with content panel header */}
        <div
          className="flex items-center justify-center border-b border-border w-full"
          style={{ height: EDITOR_LAYOUT_CSS_VALUES.sidebarHeaderHeight }}
        >
          <button
            onClick={toggleLeftSidebar}
            className="rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            style={{
              width: EDITOR_LAYOUT_CSS_VALUES.sidebarHeaderButtonSize,
              height: EDITOR_LAYOUT_CSS_VALUES.sidebarHeaderButtonSize,
            }}
            data-tooltip={
              leftSidebarOpen
                ? t('editor.mediaSidebar.collapsePanel')
                : t('editor.mediaSidebar.expandPanel')
            }
            data-tooltip-side="right"
          >
            {leftSidebarOpen ? (
              <ChevronLeft className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Shape tools.
            This is the rail where Media / Text / Shapes / Effects /
            Transitions / AI tabs used to live before the strip-down.
            Parametric shapes (Rectangle / Circle / Ellipse / Triangle /
            Regular Polygon) are click-to-place: click the button → tool
            stays active → click on the canvas → shape drops at the click
            point at the default 25%-of-min-dimension size. The tool
            remains active for multiple placements; click the button again
            (or pick a different tool) to cancel. Free Polygon + Arrow are
            click-and-drag on the canvas. */}
        <div className="flex flex-col items-center gap-1 py-1.5 flex-1 min-h-0 overflow-y-auto">
          <button
            onClick={() => handleToggleParametric('rectangle')}
            aria-pressed={placingShapeType === 'rectangle'}
            aria-label="Add rectangle"
            data-tooltip="Add rectangle"
            data-tooltip-side="right"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              placingShapeType === 'rectangle'
                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToggleParametric('circle')}
            aria-pressed={placingShapeType === 'circle'}
            aria-label="Add circle"
            data-tooltip="Add circle"
            data-tooltip-side="right"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              placingShapeType === 'circle'
                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <Circle className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToggleParametric('ellipse')}
            aria-pressed={placingShapeType === 'ellipse'}
            aria-label="Add ellipse"
            data-tooltip="Add ellipse"
            data-tooltip-side="right"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              placingShapeType === 'ellipse'
                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <Egg className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToggleParametric('triangle')}
            aria-pressed={placingShapeType === 'triangle'}
            aria-label="Add triangle"
            data-tooltip="Add triangle"
            data-tooltip-side="right"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              placingShapeType === 'triangle'
                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <Triangle className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToggleParametric('polygon')}
            aria-pressed={placingShapeType === 'polygon'}
            aria-label="Add regular polygon"
            data-tooltip="Add regular polygon"
            data-tooltip-side="right"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              placingShapeType === 'polygon'
                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <Pentagon className="w-4 h-4" />
          </button>
          <button
            onClick={() => (drawingPolygon ? cancelDraw() : startPolygon())}
            aria-pressed={drawingPolygon}
            aria-label="Draw polygon"
            data-tooltip="Draw polygon"
            data-tooltip-side="right"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              drawingPolygon
                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <Hexagon className="w-4 h-4" />
          </button>
          <button
            onClick={() => (drawingArrow ? cancelDraw() : startArrow())}
            aria-pressed={drawingArrow}
            aria-label="Draw arrow"
            data-tooltip="Draw arrow"
            data-tooltip-side="right"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              drawingArrow
                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <MoveUpRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => (placingFieldRing ? cancelDraw() : startFieldRing())}
            aria-pressed={placingFieldRing}
            aria-label="Place field ring"
            data-tooltip="Place field ring"
            data-tooltip-side="right"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              placingFieldRing
                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <Disc className="w-4 h-4" />
          </button>
          <button
            onClick={() => (drawingConnectedRings ? cancelDraw() : startConnectedRings())}
            aria-pressed={drawingConnectedRings}
            aria-label="Draw connected rings"
            data-tooltip="Draw connected rings"
            data-tooltip-side="right"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              drawingConnectedRings
                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <Waypoints className="w-4 h-4" />
          </button>
          <button
            onClick={() => (placingSpotlight ? cancelDraw() : startSpotlight())}
            aria-pressed={placingSpotlight}
            aria-label="Place spotlight"
            data-tooltip="Place spotlight"
            data-tooltip-side="right"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              placingSpotlight
                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <Flashlight className="w-4 h-4" />
          </button>
          <button
            onClick={() => (placingText ? cancelDraw() : startText())}
            aria-pressed={placingText}
            aria-label="Place text"
            data-tooltip="Place text"
            data-tooltip-side="right"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              placingText
                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <Type className="w-4 h-4" />
          </button>
          <button
            onClick={() => (placingTimer ? cancelDraw() : startTimer())}
            aria-pressed={placingTimer}
            aria-label="Place timer"
            data-tooltip="Place timer"
            data-tooltip-side="right"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              placingTimer
                ? 'bg-primary/15 text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            <TimerIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => imageInputRef.current?.click()}
            aria-label="Add image overlay"
            data-tooltip="Add image overlay"
            data-tooltip-side="right"
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleImageFile(e)}
          />
        </div>
      </div>

      {/* Content Panel */}
      <div
        className={`panel-bg border-r border-border overflow-hidden relative ${
          leftSidebarOpen ? '' : 'w-0'
        }`}
        style={
          leftSidebarOpen
            ? { width: sidebarWidth, transition: isResizingRef.current ? 'none' : 'width 200ms' }
            : { transition: 'width 200ms' }
        }
      >
        {/* Use Activity for React 19 performance optimization - defers updates when hidden */}
        <Activity mode={leftSidebarOpen ? 'visible' : 'hidden'}>
          <div className="h-full min-h-0 flex flex-col" style={{ width: sidebarWidth }}>
            {/* Panel Header */}
            <div
              className="flex items-center justify-between px-3 border-b border-border flex-shrink-0"
              style={{ height: EDITOR_LAYOUT_CSS_VALUES.sidebarHeaderHeight }}
            >
              <span className="text-sm font-medium text-foreground">
                {t('editor.mediaSidebar.media')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                style={{
                  width: EDITOR_LAYOUT_CSS_VALUES.sidebarHeaderButtonSize,
                  height: EDITOR_LAYOUT_CSS_VALUES.sidebarHeaderButtonSize,
                }}
                onClick={toggleMediaFullColumn}
                data-tooltip={
                  mediaFullColumn
                    ? t('editor.propertiesSidebar.dockToPreview')
                    : t('editor.propertiesSidebar.expandFullColumn')
                }
                data-tooltip-side="bottom"
              >
                {mediaFullColumn ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </Button>
            </div>

            {/* Media Library — always visible */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <MediaLibrary />
            </div>
          </div>
        </Activity>
        {/* Resize Handle */}
        {leftSidebarOpen && (
          <div
            data-resize-handle
            onMouseDown={handleResizeStart}
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/50 active:bg-primary/50 transition-colors z-10"
          />
        )}
      </div>
    </div>
  )
})
