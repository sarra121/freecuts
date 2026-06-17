import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Shapes,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ShapeItem, TimelineItem } from '@/types/timeline'
import {
  useShapeEditStore,
  commitShapeUpdate,
  type PropertiesPreview,
} from '@/features/editor/deps/shapes-konva'
import {
  PropertySection,
  PropertyRow,
  NumberInput,
  SliderInput,
  ColorPicker,
} from '../components'

// MatchView shape properties panel.
//
// Live-preview pattern: every NumberInput / ColorPicker that supports
// `onLiveChange` writes a per-item override to `useShapeEditStore.
// propertiesPreview` on each tick. The shapes-konva ShapeRouter merges
// that override into the rendered item, so the canvas updates in real
// time without producing 60+ undo entries per second. `onChange` then
// clears the preview and commits the final value via the timeline
// store's `updateItem` (one undo entry per slider release).

/**
 * Compute one field's shared value across all selected shapes.
 * Returns `undefined` when items disagree (the "mixed" state, in which
 * case leaf controls show a placeholder and edits write to ALL items).
 */
function shared<T>(items: ShapeItem[], read: (item: ShapeItem) => T): T | undefined {
  if (items.length === 0) return undefined
  const first = read(items[0]!)
  for (let i = 1; i < items.length; i++) {
    if (read(items[i]!) !== first) return undefined
  }
  return first
}

/** Pretty label for a shape type — shown as a chip at the top of the
 *  section so the user knows what they're editing without scanning. */
function shapeTypeLabel(shapeType: ShapeItem['shapeType'] | undefined): string {
  switch (shapeType) {
    case 'rectangle': return 'Rectangle'
    case 'circle': return 'Circle'
    case 'ellipse': return 'Ellipse'
    case 'triangle': return 'Triangle'
    case 'polygon': return 'Polygon'
    case 'arrow': return 'Arrow'
    case 'free-polygon': return 'Free polygon'
    case 'field-ring': return 'Field ring'
    case 'connected-rings': return 'Connected rings'
    case 'spotlight': return 'Spotlight'
    case 'text': return 'Text'
    case 'timer': return 'Timer'
    case 'star': return 'Star'
    case 'heart': return 'Heart'
    case 'path': return 'Path'
    default: return 'Mixed'
  }
}

/** Small monochrome divider with an uppercase label — visually breaks
 *  the panel into "Style / Geometry / Arrow / Polygon" subsections
 *  without nesting another PropertySection. */
function Subheading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-3 pb-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  )
}

interface ShapePropertiesProps {
  items: TimelineItem[]
}

export function ShapeProperties({ items }: ShapePropertiesProps) {
  const { t } = useTranslation()
  const setPropertiesPreview = useShapeEditStore((s) => s.setPropertiesPreview)
  const clearPropertiesPreview = useShapeEditStore((s) => s.clearPropertiesPreview)

  const shapeItems = useMemo(
    () => items.filter((item): item is ShapeItem => item.type === 'shape'),
    [items],
  )

  const itemIds = useMemo(() => shapeItems.map((it) => it.id), [shapeItems])

  const sharedValues = useMemo(() => {
    if (shapeItems.length === 0) return null
    return {
      shapeType: shared(shapeItems, (i) => i.shapeType),
      fillColor: shared(shapeItems, (i) => i.fillColor),
      strokeColor: shared(shapeItems, (i) => i.strokeColor ?? ''),
      strokeWidth: shared(shapeItems, (i) => i.strokeWidth ?? 0),
      cornerRadius: shared(shapeItems, (i) => i.cornerRadius ?? 0),
      direction: shared(shapeItems, (i) => i.direction ?? 'up'),
      points: shared(shapeItems, (i) => i.points ?? 6),
      pointerLength: shared(shapeItems, (i) => i.arrowData?.pointerLength ?? 20),
      pointerWidth: shared(shapeItems, (i) => i.arrowData?.pointerWidth ?? 20),
      dash: shared(shapeItems, (i) => i.arrowData?.dash ?? 'solid'),
      isCurved: shared(shapeItems, (i) =>
        i.arrowData?.controlX != null && i.arrowData?.controlY != null,
      ),
      closed: shared(shapeItems, (i) => i.freePolygonData?.closed ?? true),
      opacity: shared(shapeItems, (i) => i.transform?.opacity ?? 1),
      skewX: shared(shapeItems, (i) => i.imageShapeData?.skewX ?? 0),
      skewY: shared(shapeItems, (i) => i.imageShapeData?.skewY ?? 0),
    }
  }, [shapeItems])

  /**
   * Commit a patch to every selected shape. `commitShapeUpdate` updates the
   * base config AND records the change as a keyframe on that clip at the
   * current playhead frame, in one undo entry.
   */
  const updateAll = useCallback(
    (updates: Partial<ShapeItem>) => {
      for (const item of shapeItems) commitShapeUpdate(item.id, updates)
    },
    [shapeItems],
  )

  /** Commit a nested `arrowData` patch on every selected arrow. */
  const updateArrowData = useCallback(
    (patch: Partial<NonNullable<ShapeItem['arrowData']>>) => {
      for (const item of shapeItems) {
        if (item.shapeType !== 'arrow' || !item.arrowData) continue
        commitShapeUpdate(item.id, { arrowData: { ...item.arrowData, ...patch } })
      }
    },
    [shapeItems],
  )

  /** Commit a nested `freePolygonData` patch on every selected free-polygon. */
  const updatePolygonData = useCallback(
    (patch: Partial<NonNullable<ShapeItem['freePolygonData']>>) => {
      for (const item of shapeItems) {
        if (item.shapeType !== 'free-polygon' || !item.freePolygonData) continue
        commitShapeUpdate(item.id, {
          freePolygonData: { ...item.freePolygonData, ...patch },
        })
      }
    },
    [shapeItems],
  )

  /** Commit a nested `fieldRingData` patch on every selected field-ring. */
  const updateFieldRingData = useCallback(
    (patch: Partial<NonNullable<ShapeItem['fieldRingData']>>) => {
      for (const item of shapeItems) {
        if (item.shapeType !== 'field-ring' || !item.fieldRingData) continue
        commitShapeUpdate(item.id, { fieldRingData: { ...item.fieldRingData, ...patch } })
      }
    },
    [shapeItems],
  )

  /** Commit a connectedRingsData patch (nodeRadius / connector style). */
  const updateConnectedData = useCallback(
    (patch: Partial<NonNullable<ShapeItem['connectedRingsData']>>) => {
      for (const item of shapeItems) {
        if (item.shapeType !== 'connected-rings' || !item.connectedRingsData) continue
        commitShapeUpdate(item.id, { connectedRingsData: { ...item.connectedRingsData, ...patch } })
      }
    },
    [shapeItems],
  )

  /** Commit a patch to the shared ring appearance of every selected group. */
  const updateConnectedRing = useCallback(
    (patch: Partial<NonNullable<ShapeItem['fieldRingData']>>) => {
      for (const item of shapeItems) {
        if (item.shapeType !== 'connected-rings' || !item.connectedRingsData) continue
        commitShapeUpdate(item.id, {
          connectedRingsData: {
            ...item.connectedRingsData,
            ring: { ...item.connectedRingsData.ring, ...patch },
          },
        })
      }
    },
    [shapeItems],
  )

  /** Toggle open/closed for connected-rings (stored in freePolygonData). */
  const updateConnectedClosed = useCallback(
    (closed: boolean) => {
      for (const item of shapeItems) {
        if (item.shapeType !== 'connected-rings' || !item.freePolygonData) continue
        commitShapeUpdate(item.id, { freePolygonData: { ...item.freePolygonData, closed } })
      }
    },
    [shapeItems],
  )

  /** Commit a nested `spotlightData` patch on every selected spotlight. */
  const updateSpotlightData = useCallback(
    (patch: Partial<NonNullable<ShapeItem['spotlightData']>>) => {
      for (const item of shapeItems) {
        if (item.shapeType !== 'spotlight' || !item.spotlightData) continue
        commitShapeUpdate(item.id, { spotlightData: { ...item.spotlightData, ...patch } })
      }
    },
    [shapeItems],
  )

  /** Commit a nested `textShapeData` patch on every selected text label. */
  const updateTextData = useCallback(
    (patch: Partial<NonNullable<ShapeItem['textShapeData']>>) => {
      for (const item of shapeItems) {
        if (item.shapeType !== 'text' || !item.textShapeData) continue
        commitShapeUpdate(item.id, { textShapeData: { ...item.textShapeData, ...patch } })
      }
    },
    [shapeItems],
  )

  /** Commit a nested `timerData` patch on every selected timer. */
  const updateTimerData = useCallback(
    (patch: Partial<NonNullable<ShapeItem['timerData']>>) => {
      for (const item of shapeItems) {
        if (item.shapeType !== 'timer' || !item.timerData) continue
        commitShapeUpdate(item.id, { timerData: { ...item.timerData, ...patch } })
      }
    },
    [shapeItems],
  )

  /** Commit a transform patch (size/rotation) on every selected spotlight.
   *  The spotlight has no on-canvas transformer, so size/rotation are edited
   *  here. */
  const updateSpotlightTransform = useCallback(
    (patch: { width?: number; height?: number; rotation?: number }) => {
      const item = shapeItems.find((it) => it.shapeType === 'spotlight')
      if (!item) return
      // Go through updateAll so the edit is RECORDED at the current frame like
      // every other change — otherwise a drag-recorded transform keyframe would
      // mask these sliders (the old freeze). Merge onto the existing transform
      // so we don't drop x/y/the other fields.
      updateAll({ transform: { ...(item.transform ?? {}), ...patch } })
    },
    [shapeItems, updateAll],
  )

  /** Commit per-clip opacity (transform.opacity, 0–1) on every selected shape.
   *  Works for ALL shape types — semi-transparent rings, text, images, etc. */
  const updateOpacity = useCallback(
    (opacity: number) => {
      for (const item of shapeItems) {
        commitShapeUpdate(item.id, { transform: { ...(item.transform ?? {}), opacity } })
      }
    },
    [shapeItems],
  )

  /** Commit a nested `imageShapeData` patch (skew) on every selected image. */
  const updateImageData = useCallback(
    (patch: Partial<NonNullable<ShapeItem['imageShapeData']>>) => {
      for (const item of shapeItems) {
        if (item.shapeType !== 'image' || !item.imageShapeData) continue
        commitShapeUpdate(item.id, { imageShapeData: { ...item.imageShapeData, ...patch } })
      }
    },
    [shapeItems],
  )

  /** Broadcast a per-item preview override for live drag. ShapeRouter
   *  reads this map and merges it into the rendered item. */
  const previewAll = useCallback(
    (patch: Partial<ShapeItem>) => {
      const preview: PropertiesPreview = {}
      for (const id of itemIds) preview[id] = patch
      setPropertiesPreview(preview)
    },
    [itemIds, setPropertiesPreview],
  )

  /** Same but routes the patch into the nested `arrowData` slot. */
  const previewArrowData = useCallback(
    (patch: Partial<NonNullable<ShapeItem['arrowData']>>) => {
      const preview: PropertiesPreview = {}
      for (const id of itemIds) preview[id] = { arrowData: patch as ShapeItem['arrowData'] }
      setPropertiesPreview(preview)
    },
    [itemIds, setPropertiesPreview],
  )

  if (shapeItems.length === 0 || !sharedValues) return null

  const t1 = sharedValues.shapeType
  const showCornerRadius = t1 === 'rectangle'
  const showDirection = t1 === 'triangle'
  const showPoints = t1 === 'polygon'
  const showArrow = t1 === 'arrow'
  const showFreePolygon = t1 === 'free-polygon'
  const showFieldRing = t1 === 'field-ring'
  const showConnected = t1 === 'connected-rings'
  const showSpotlight = t1 === 'spotlight'
  const showText = t1 === 'text'
  const showTimer = t1 === 'timer'
  const showImage = t1 === 'image'
  const hasGeometrySection =
    showCornerRadius || showDirection || showPoints

  // The MatchView shapes (field-ring / connected-rings / spotlight / text /
  // timer) have their own controls and ignore the generic stroke; hide it for
  // them. Fill stays (it's the band/light/text colour).
  const showGenericStroke =
    !showFieldRing && !showConnected && !showSpotlight && !showText && !showTimer && !showImage
  const showStrokeColor =
    showGenericStroke &&
    (sharedValues.strokeWidth === undefined ||
      (typeof sharedValues.strokeWidth === 'number' && sharedValues.strokeWidth > 0))

  // First selected item's nested config (these panels edit one at a time).
  const fr = showFieldRing ? shapeItems[0]!.fieldRingData : undefined
  const cr = showConnected ? shapeItems[0]!.connectedRingsData : undefined
  const crClosed = shapeItems[0]?.freePolygonData?.closed ?? false
  const sl = showSpotlight ? shapeItems[0]!.spotlightData : undefined
  const slT = showSpotlight ? shapeItems[0]!.transform : undefined
  const tx = showText ? shapeItems[0]!.textShapeData : undefined
  const tm = showTimer ? shapeItems[0]!.timerData : undefined

  return (
    <PropertySection title={t('editor.shapeSection.shape')} icon={Shapes} defaultOpen={true}>
      {/* Top chip: shape type + selection count */}
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-foreground/80">
          {shapeTypeLabel(t1)}
        </span>
        {shapeItems.length > 1 && (
          <span className="text-[10px] text-muted-foreground">
            {shapeItems.length} selected
          </span>
        )}
      </div>

      {/* ── Style ──────────────────────────────────────────── */}
      <Subheading>Style</Subheading>

      <ColorPicker
        label={t('editor.shapeSection.fill')}
        color={sharedValues.fillColor ?? '#FFFFFF'}
        onChange={(value) => {
          clearPropertiesPreview()
          updateAll({ fillColor: value })
        }}
        onLiveChange={(value) => previewAll({ fillColor: value })}
      />

      <PropertyRow label="Opacity">
        <SliderInput
          value={Math.round((sharedValues.opacity ?? 1) * 100)}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={(v) => updateOpacity(v / 100)}
          className="flex-1 min-w-0"
        />
      </PropertyRow>

      {showGenericStroke && (
        <PropertyRow label={t('editor.shapeSection.strokeWidth')}>
          <NumberInput
            value={sharedValues.strokeWidth === undefined ? 'mixed' : sharedValues.strokeWidth}
            onChange={(value) => {
              clearPropertiesPreview()
              updateAll({ strokeWidth: value })
            }}
            onLiveChange={(value) => previewAll({ strokeWidth: value })}
            min={0}
            max={50}
            step={1}
            unit="px"
            className="flex-1 min-w-0"
          />
        </PropertyRow>
      )}

      {showStrokeColor && (
        <ColorPicker
          label={t('editor.shapeSection.stroke')}
          color={!sharedValues.strokeColor ? '#FFFFFF' : sharedValues.strokeColor}
          onChange={(value) => {
            clearPropertiesPreview()
            updateAll({ strokeColor: value || undefined })
          }}
          onLiveChange={(value) => previewAll({ strokeColor: value })}
        />
      )}

      {/* ── Geometry (rect / triangle / polygon) ─────────────── */}
      {hasGeometrySection && <Subheading>Geometry</Subheading>}

      {showCornerRadius && (
        <PropertyRow label={t('editor.shapeSection.radius')}>
          <NumberInput
            value={sharedValues.cornerRadius === undefined ? 'mixed' : sharedValues.cornerRadius}
            onChange={(value) => {
              clearPropertiesPreview()
              updateAll({ cornerRadius: value })
            }}
            onLiveChange={(value) => previewAll({ cornerRadius: value })}
            min={0}
            max={100}
            step={1}
            unit="px"
            className="flex-1 min-w-0"
          />
        </PropertyRow>
      )}

      {showDirection && (
        <PropertyRow label={t('editor.shapeSection.direction')}>
          <div className="inline-flex rounded-md border border-border bg-secondary/30 p-0.5">
            {(
              [
                { value: 'up', icon: ChevronUp },
                { value: 'down', icon: ChevronDown },
                { value: 'left', icon: ChevronLeft },
                { value: 'right', icon: ChevronRight },
              ] as const
            ).map(({ value, icon: Icon }) => {
              const active = sharedValues.direction === value
              return (
                <Button
                  key={value}
                  variant="ghost"
                  size="icon"
                  className={`h-6 w-6 rounded-sm ${active ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
                  onClick={() => updateAll({ direction: value })}
                >
                  <Icon className="w-3.5 h-3.5" />
                </Button>
              )
            })}
          </div>
        </PropertyRow>
      )}

      {showPoints && (
        <PropertyRow label={t('editor.shapeSection.points')}>
          <NumberInput
            value={sharedValues.points === undefined ? 'mixed' : sharedValues.points}
            onChange={(value) => {
              clearPropertiesPreview()
              updateAll({ points: value })
            }}
            onLiveChange={(value) => previewAll({ points: value })}
            min={3}
            max={12}
            step={1}
            className="flex-1 min-w-0"
          />
        </PropertyRow>
      )}

      {/* ── Arrow ────────────────────────────────────────────── */}
      {showArrow && (
        <>
          <Subheading>Arrow</Subheading>
          <PropertyRow label="Tip length">
            <NumberInput
              value={sharedValues.pointerLength === undefined ? 'mixed' : sharedValues.pointerLength}
              onChange={(value) => {
                clearPropertiesPreview()
                updateArrowData({ pointerLength: value })
              }}
              onLiveChange={(value) => previewArrowData({ pointerLength: value })}
              min={4}
              max={80}
              step={1}
              unit="px"
              className="flex-1 min-w-0"
            />
          </PropertyRow>
          <PropertyRow label="Tip width">
            <NumberInput
              value={sharedValues.pointerWidth === undefined ? 'mixed' : sharedValues.pointerWidth}
              onChange={(value) => {
                clearPropertiesPreview()
                updateArrowData({ pointerWidth: value })
              }}
              onLiveChange={(value) => previewArrowData({ pointerWidth: value })}
              min={4}
              max={80}
              step={1}
              unit="px"
              className="flex-1 min-w-0"
            />
          </PropertyRow>
          <PropertyRow label="Style">
            <Select
              value={sharedValues.dash}
              onValueChange={(value) =>
                updateArrowData({ dash: value as 'solid' | 'dashed' | 'dotted' })
              }
            >
              <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                <SelectValue placeholder="mixed" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid" className="text-xs">Solid</SelectItem>
                <SelectItem value="dashed" className="text-xs">Dashed</SelectItem>
                <SelectItem value="dotted" className="text-xs">Dotted</SelectItem>
              </SelectContent>
            </Select>
          </PropertyRow>
          {sharedValues.isCurved === true && (
            <PropertyRow label="Curve">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 flex-1 min-w-0"
                onClick={() =>
                  updateArrowData({ controlX: undefined, controlY: undefined })
                }
              >
                <Minus className="w-3.5 h-3.5" />
                Reset to straight
              </Button>
            </PropertyRow>
          )}
        </>
      )}

      {/* ── Free polygon ─────────────────────────────────────── */}
      {showFreePolygon && (
        <>
          <Subheading>Polygon</Subheading>
          <PropertyRow label="Closed">
            <Switch
              checked={sharedValues.closed === true}
              onCheckedChange={(checked) => updatePolygonData({ closed: checked })}
              disabled={sharedValues.closed === undefined}
            />
          </PropertyRow>
        </>
      )}

      {/* ── Field ring ───────────────────────────────────────── */}
      {showFieldRing && fr && (
        <>
          <Subheading>Ring</Subheading>
          <PropertyRow label={t('editor.shapeSection.squash')}>
            <NumberInput
              value={fr.squash}
              onChange={(v) => updateFieldRingData({ squash: v })}
              min={0.12}
              max={1}
              step={0.02}
              className="flex-1 min-w-0"
            />
          </PropertyRow>
          <PropertyRow label={t('editor.shapeSection.bandThickness')}>
            <NumberInput
              value={fr.bandThickness}
              onChange={(v) => updateFieldRingData({ bandThickness: v })}
              min={2}
              max={60}
              step={1}
              unit="px"
              className="flex-1 min-w-0"
            />
          </PropertyRow>
          <PropertyRow label={t('editor.shapeSection.extrusionHeight')}>
            <NumberInput
              value={fr.extrusionHeight}
              onChange={(v) => updateFieldRingData({ extrusionHeight: v })}
              min={0}
              max={30}
              step={1}
              unit="px"
              className="flex-1 min-w-0"
            />
          </PropertyRow>
          <PropertyRow label={t('editor.shapeSection.continuous')}>
            <Switch
              checked={fr.continuous}
              onCheckedChange={(c) => updateFieldRingData({ continuous: c })}
            />
          </PropertyRow>
          {!fr.continuous && (
            <>
              <PropertyRow label={t('editor.shapeSection.segments')}>
                <NumberInput
                  value={fr.segments}
                  onChange={(v) => updateFieldRingData({ segments: v })}
                  min={2}
                  max={48}
                  step={1}
                  className="flex-1 min-w-0"
                />
              </PropertyRow>
              <PropertyRow label={t('editor.shapeSection.gap')}>
                <NumberInput
                  value={fr.gapRatio}
                  onChange={(v) => updateFieldRingData({ gapRatio: v })}
                  min={0}
                  max={0.8}
                  step={0.02}
                  className="flex-1 min-w-0"
                />
              </PropertyRow>
              <PropertyRow label={t('editor.shapeSection.roundedEnds')}>
                <Switch
                  checked={fr.roundedEnds}
                  onCheckedChange={(c) => updateFieldRingData({ roundedEnds: c })}
                />
              </PropertyRow>
            </>
          )}
          <PropertyRow label={t('editor.shapeSection.spin')}>
            <Switch checked={fr.spin} onCheckedChange={(c) => updateFieldRingData({ spin: c })} />
          </PropertyRow>
          {fr.spin && (
            <PropertyRow label={t('editor.shapeSection.spinSpeed')}>
              <NumberInput
                value={fr.spinSpeed}
                onChange={(v) => updateFieldRingData({ spinSpeed: v })}
                min={-2}
                max={2}
                step={0.05}
                className="flex-1 min-w-0"
              />
            </PropertyRow>
          )}
          <PropertyRow label={t('editor.shapeSection.contactShadow')}>
            <Switch
              checked={fr.contactShadow}
              onCheckedChange={(c) => updateFieldRingData({ contactShadow: c })}
            />
          </PropertyRow>
        </>
      )}

      {/* ── Connected rings ──────────────────────────────────── */}
      {showConnected && cr && (
        <>
          <Subheading>Connectors</Subheading>
          <PropertyRow label={t('editor.shapeSection.closed')}>
            <Switch checked={crClosed} onCheckedChange={(c) => updateConnectedClosed(c)} />
          </PropertyRow>
          <ColorPicker
            label={t('editor.shapeSection.connectorColor')}
            color={cr.connectorColor}
            onChange={(v) => updateConnectedData({ connectorColor: v })}
          />
          <PropertyRow label={t('editor.shapeSection.connectorWidth')}>
            <NumberInput
              value={cr.connectorWidth}
              onChange={(v) => updateConnectedData({ connectorWidth: v })}
              min={1}
              max={30}
              step={1}
              unit="px"
              className="flex-1 min-w-0"
            />
          </PropertyRow>
          <PropertyRow label={t('editor.shapeSection.nodeRadius')}>
            <NumberInput
              value={cr.nodeRadius}
              onChange={(v) => updateConnectedData({ nodeRadius: v })}
              min={20}
              max={200}
              step={1}
              unit="px"
              className="flex-1 min-w-0"
            />
          </PropertyRow>

          <Subheading>Ring</Subheading>
          <PropertyRow label={t('editor.shapeSection.squash')}>
            <NumberInput
              value={cr.ring.squash}
              onChange={(v) => updateConnectedRing({ squash: v })}
              min={0.12}
              max={1}
              step={0.02}
              className="flex-1 min-w-0"
            />
          </PropertyRow>
          <PropertyRow label={t('editor.shapeSection.bandThickness')}>
            <NumberInput
              value={cr.ring.bandThickness}
              onChange={(v) => updateConnectedRing({ bandThickness: v })}
              min={2}
              max={60}
              step={1}
              unit="px"
              className="flex-1 min-w-0"
            />
          </PropertyRow>
          <PropertyRow label={t('editor.shapeSection.continuous')}>
            <Switch
              checked={cr.ring.continuous}
              onCheckedChange={(c) => updateConnectedRing({ continuous: c })}
            />
          </PropertyRow>
          {!cr.ring.continuous && (
            <>
              <PropertyRow label={t('editor.shapeSection.segments')}>
                <NumberInput
                  value={cr.ring.segments}
                  onChange={(v) => updateConnectedRing({ segments: v })}
                  min={2}
                  max={48}
                  step={1}
                  className="flex-1 min-w-0"
                />
              </PropertyRow>
              <PropertyRow label={t('editor.shapeSection.gap')}>
                <NumberInput
                  value={cr.ring.gapRatio}
                  onChange={(v) => updateConnectedRing({ gapRatio: v })}
                  min={0}
                  max={0.8}
                  step={0.02}
                  className="flex-1 min-w-0"
                />
              </PropertyRow>
              <PropertyRow label={t('editor.shapeSection.roundedEnds')}>
                <Switch
                  checked={cr.ring.roundedEnds}
                  onCheckedChange={(c) => updateConnectedRing({ roundedEnds: c })}
                />
              </PropertyRow>
            </>
          )}
          <PropertyRow label={t('editor.shapeSection.spin')}>
            <Switch
              checked={cr.ring.spin}
              onCheckedChange={(c) => updateConnectedRing({ spin: c })}
            />
          </PropertyRow>
          {cr.ring.spin && (
            <PropertyRow label={t('editor.shapeSection.spinSpeed')}>
              <NumberInput
                value={cr.ring.spinSpeed}
                onChange={(v) => updateConnectedRing({ spinSpeed: v })}
                min={-2}
                max={2}
                step={0.05}
                className="flex-1 min-w-0"
              />
            </PropertyRow>
          )}
          <PropertyRow label={t('editor.shapeSection.contactShadow')}>
            <Switch
              checked={cr.ring.contactShadow}
              onCheckedChange={(c) => updateConnectedRing({ contactShadow: c })}
            />
          </PropertyRow>
        </>
      )}

      {/* ── Spotlight ────────────────────────────────────────── */}
      {showSpotlight && sl && (
        <>
          <Subheading>Size</Subheading>
          <PropertyRow label="Width">
            <SliderInput
              value={slT?.width ?? 120}
              min={30}
              max={600}
              step={1}
              unit="px"
              onChange={(v) => updateSpotlightTransform({ width: v })}
              className="flex-1 min-w-0"
            />
          </PropertyRow>
          <PropertyRow label="Height">
            <SliderInput
              value={slT?.height ?? 340}
              min={60}
              max={1200}
              step={1}
              unit="px"
              onChange={(v) => updateSpotlightTransform({ height: v })}
              className="flex-1 min-w-0"
            />
          </PropertyRow>
          <PropertyRow label="Rotation">
            <SliderInput
              value={slT?.rotation ?? 0}
              min={-180}
              max={180}
              step={1}
              unit="°"
              onChange={(v) => updateSpotlightTransform({ rotation: v })}
              className="flex-1 min-w-0"
            />
          </PropertyRow>

          <Subheading>Light</Subheading>
          <PropertyRow label="Intensity">
            <SliderInput
              value={sl.intensity}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateSpotlightData({ intensity: v })}
              className="flex-1 min-w-0"
            />
          </PropertyRow>
          <PropertyRow label="Ground pool">
            <Switch checked={sl.pool} onCheckedChange={(c) => updateSpotlightData({ pool: c })} />
          </PropertyRow>
          <PropertyRow label="Bloom">
            <Switch checked={sl.bloom} onCheckedChange={(c) => updateSpotlightData({ bloom: c })} />
          </PropertyRow>
          <PropertyRow label="Player cutout">
            <Switch
              checked={sl.cutout}
              onCheckedChange={(c) => updateSpotlightData({ cutout: c })}
            />
          </PropertyRow>
          {sl.cutout && (
            <>
              <PropertyRow label="Cutout width">
                <SliderInput
                  value={sl.cutoutWidth}
                  min={10}
                  max={160}
                  step={1}
                  unit="px"
                  onChange={(v) => updateSpotlightData({ cutoutWidth: v })}
                  className="flex-1 min-w-0"
                />
              </PropertyRow>
              <PropertyRow label="Cutout height">
                <SliderInput
                  value={sl.cutoutHeight}
                  min={40}
                  max={400}
                  step={1}
                  unit="px"
                  onChange={(v) => updateSpotlightData({ cutoutHeight: v })}
                  className="flex-1 min-w-0"
                />
              </PropertyRow>
            </>
          )}
        </>
      )}

      {/* ── Text ─────────────────────────────────────────────── */}
      {showText && tx && (
        <>
          <Subheading>Text</Subheading>
          <textarea
            value={tx.content}
            onChange={(e) => updateTextData({ content: e.target.value })}
            rows={2}
            className="w-full text-xs bg-secondary border border-input rounded-md px-2 py-1 resize-none outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <PropertyRow label="Font size">
            <SliderInput
              value={tx.fontSize}
              min={8}
              max={200}
              step={1}
              unit="px"
              onChange={(v) => updateTextData({ fontSize: v })}
              className="flex-1 min-w-0"
            />
          </PropertyRow>
          <PropertyRow label="Font">
            <Select value={tx.fontFamily} onValueChange={(v) => updateTextData({ fontFamily: v })}>
              <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Arial, sans-serif" className="text-xs">
                  Sans (Arial)
                </SelectItem>
                <SelectItem value="Georgia, serif" className="text-xs">
                  Serif (Georgia)
                </SelectItem>
                <SelectItem value="'Courier New', monospace" className="text-xs">
                  Mono
                </SelectItem>
                <SelectItem value="Impact, sans-serif" className="text-xs">
                  Impact
                </SelectItem>
              </SelectContent>
            </Select>
          </PropertyRow>
          <PropertyRow label="Align">
            <div className="inline-flex rounded-md border border-border bg-secondary/30 p-0.5">
              {(
                [
                  { value: 'left', icon: AlignLeft },
                  { value: 'center', icon: AlignCenter },
                  { value: 'right', icon: AlignRight },
                ] as const
              ).map(({ value, icon: Icon }) => (
                <Button
                  key={value}
                  variant="ghost"
                  size="icon"
                  className={`h-6 w-6 rounded-sm ${tx.align === value ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
                  onClick={() => updateTextData({ align: value })}
                >
                  <Icon className="w-3.5 h-3.5" />
                </Button>
              ))}
            </div>
          </PropertyRow>
          <PropertyRow label="Skew X">
            <SliderInput
              value={tx.skewX}
              min={-60}
              max={60}
              step={1}
              unit="°"
              onChange={(v) => updateTextData({ skewX: v })}
              className="flex-1 min-w-0"
            />
          </PropertyRow>
          <PropertyRow label="Skew Y">
            <SliderInput
              value={tx.skewY}
              min={-60}
              max={60}
              step={1}
              unit="°"
              onChange={(v) => updateTextData({ skewY: v })}
              className="flex-1 min-w-0"
            />
          </PropertyRow>
        </>
      )}

      {/* ── Image ────────────────────────────────────────────── */}
      {showImage && (
        <>
          <Subheading>Image</Subheading>
          <PropertyRow label="Skew X">
            <SliderInput
              value={sharedValues.skewX ?? 0}
              min={-60}
              max={60}
              step={1}
              unit="°"
              onChange={(v) => updateImageData({ skewX: v })}
              className="flex-1 min-w-0"
            />
          </PropertyRow>
          <PropertyRow label="Skew Y">
            <SliderInput
              value={sharedValues.skewY ?? 0}
              min={-60}
              max={60}
              step={1}
              unit="°"
              onChange={(v) => updateImageData({ skewY: v })}
              className="flex-1 min-w-0"
            />
          </PropertyRow>
        </>
      )}

      {/* ── Timer ────────────────────────────────────────────── */}
      {showTimer && tm && (
        <>
          <Subheading>Timer</Subheading>
          <PropertyRow label="Mode">
            <div className="flex flex-1 min-w-0 gap-0.5 rounded-md border border-input bg-secondary/40 p-0.5">
              {(
                [
                  { v: 'up', l: 'Count up' },
                  { v: 'down', l: 'Countdown' },
                ] as const
              ).map(({ v, l }) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={tm.mode === v}
                  onClick={() => updateTimerData({ mode: v })}
                  className={`flex-1 h-6 rounded-[5px] text-[11px] font-medium transition-colors ${
                    tm.mode === v
                      ? 'bg-primary/15 text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </PropertyRow>
          <PropertyRow label={tm.mode === 'up' ? 'Start at' : 'Duration'}>
            <div className="flex items-center gap-1 w-full">
              <NumberInput
                value={Math.floor((tm.mode === 'up' ? tm.offsetSec : tm.durationSec) / 60)}
                onChange={(m) => {
                  const base = tm.mode === 'up' ? tm.offsetSec : tm.durationSec
                  const next = Math.max(0, m) * 60 + (base % 60)
                  updateTimerData(tm.mode === 'up' ? { offsetSec: next } : { durationSec: next })
                }}
                min={0}
                max={999}
                step={1}
                unit="m"
                className="flex-1 min-w-0"
              />
              <NumberInput
                value={(tm.mode === 'up' ? tm.offsetSec : tm.durationSec) % 60}
                onChange={(s) => {
                  const base = tm.mode === 'up' ? tm.offsetSec : tm.durationSec
                  const next = Math.floor(base / 60) * 60 + Math.max(0, Math.min(59, s))
                  updateTimerData(tm.mode === 'up' ? { offsetSec: next } : { durationSec: next })
                }}
                min={0}
                max={59}
                step={1}
                unit="s"
                className="flex-1 min-w-0"
              />
            </div>
          </PropertyRow>
          <PropertyRow label="Format">
            <Select
              value={tm.format}
              onValueChange={(v) =>
                updateTimerData({ format: v as NonNullable<ShapeItem['timerData']>['format'] })
              }
            >
              <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mm:ss" className="text-xs">
                  mm:ss
                </SelectItem>
                <SelectItem value="hh:mm:ss" className="text-xs">
                  hh:mm:ss
                </SelectItem>
                <SelectItem value="mm:ss:cc" className="text-xs">
                  mm:ss:cc
                </SelectItem>
                <SelectItem value="ss:cc" className="text-xs">
                  ss:cc
                </SelectItem>
                <SelectItem value="ss" className="text-xs">
                  ss
                </SelectItem>
              </SelectContent>
            </Select>
          </PropertyRow>
          <PropertyRow label="Font size">
            <SliderInput
              value={tm.fontSize}
              min={8}
              max={200}
              step={1}
              unit="px"
              onChange={(v) => updateTimerData({ fontSize: v })}
              className="flex-1 min-w-0"
            />
          </PropertyRow>
          <PropertyRow label="Font">
            <Select value={tm.fontFamily} onValueChange={(v) => updateTimerData({ fontFamily: v })}>
              <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="'Courier New', monospace" className="text-xs">
                  Mono (stable digits)
                </SelectItem>
                <SelectItem value="Arial, sans-serif" className="text-xs">
                  Sans (Arial)
                </SelectItem>
                <SelectItem value="Impact, sans-serif" className="text-xs">
                  Impact
                </SelectItem>
              </SelectContent>
            </Select>
          </PropertyRow>
        </>
      )}
    </PropertySection>
  )
}
