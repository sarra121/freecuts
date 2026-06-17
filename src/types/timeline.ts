import type { CropSettings, TransformProperties } from './transform'
import type { ItemEffect } from './effects'
import type { BlendMode } from './blend-modes'
import type { AudioEqSettings } from './audio'
import type { TextStylePresetId } from '@/shared/typography/text-style-preset-ids'

export interface TimelineItemCornerPin {
  topLeft: [number, number]
  topRight: [number, number]
  bottomRight: [number, number]
  bottomLeft: [number, number]
  referenceWidth?: number
  referenceHeight?: number
}

// Base type for all timeline items (following Composition pattern)
type BaseTimelineItem = {
  id: string
  trackId: string
  from: number // Start frame (Composition convention)
  durationInFrames: number // Duration in frames (Composition convention)
  label: string
  mediaId?: string
  compositionId?: string // Reference to a sub-composition for compound wrappers
  originId?: string // Tracks lineage - items from same split share this for stable React keys
  linkedGroupId?: string // Links paired timeline items like synced video/audio companions
  // Trim properties for media items
  trimStart?: number // Frames trimmed from start of source media
  trimEnd?: number // Frames trimmed from end of source media
  sourceStart?: number // Original start frame in source media (default 0)
  sourceEnd?: number // Original end frame in source media (default sourceDuration)
  sourceDuration?: number // Total duration of source media in frames (for boundary checks)
  sourceFps?: number // Source media frame rate used for source* frame conversions
  speed?: number // Playback speed multiplier (default 1.0, range 0.1-10.0)
  isReversed?: boolean // Play media source range from end to start
  reverseConformSrc?: string // Full-res prepared reversed media blob URL for export
  reverseConformPath?: string // OPFS/workspace cache path for the full-res reversed media
  reverseConformKey?: string // Cache key describing the full-res reversed source range
  reverseConformPreviewSrc?: string // Proxy/preview prepared reversed media blob URL for smooth playback
  reverseConformPreviewPath?: string // OPFS/workspace cache path for the preview reversed media
  reverseConformPreviewKey?: string // Cache key describing the preview reversed source range
  reverseConformPreviewUsesProxy?: boolean // Whether the preview reversed media was generated from a proxy
  reverseConformStatus?: 'pending' | 'ready' | 'error'
  // Timeline-frame offset into reverseConform{Src,PreviewSrc} where this clip starts
  // playing. Set on split halves so they share the parent's conform but read
  // different ranges. Omit/0 = play from the start of the conform.
  reverseConformLocalStart?: number
  // Transform properties (optional - defaults computed at render time)
  transform?: TransformProperties
  // Source-relative media crop (normalized edge ratios)
  crop?: CropSettings
  // Audio properties (for video/audio items)
  volume?: number // Volume in dB, -60 to +12 (default: 0)
  audioFadeIn?: number // Audio fade in duration in seconds (default: 0)
  audioFadeOut?: number // Audio fade out duration in seconds (default: 0)
  audioFadeInCurve?: number // Audio fade in curve shape (-1..1, default: 0 linear)
  audioFadeOutCurve?: number // Audio fade out curve shape (-1..1, default: 0 linear)
  audioFadeInCurveX?: number // Audio fade in curve horizontal bias (0..1, default: ~0.52)
  audioFadeOutCurveX?: number // Audio fade out curve horizontal bias (0..1, default: ~0.52)
  audioPitchSemitones?: number // Clip pitch offset in semitones (-12..12)
  audioPitchCents?: number // Fine pitch offset in cents (-100..100)
  audioEqEnabled?: boolean // Master clip EQ on/off (default: true)
  audioEqOutputGainDb?: number // Post-EQ output trim in dB
  audioEqBand1Enabled?: boolean // Outer left EQ band on/off
  audioEqBand1Type?: import('@/types/audio').AudioEqBand1Type
  audioEqBand1FrequencyHz?: number
  audioEqBand1GainDb?: number
  audioEqBand1Q?: number
  audioEqBand1SlopeDbPerOct?: 6 | 12 | 18 | 24
  audioEqLowCutEnabled?: boolean // Enable low cut / high-pass filter
  audioEqLowCutFrequencyHz?: number // Low cut frequency in Hz
  audioEqLowCutSlopeDbPerOct?: 6 | 12 | 18 | 24 // Low cut slope
  audioEqLowEnabled?: boolean
  audioEqLowType?: import('@/types/audio').AudioEqInnerBandType
  audioEqLowGainDb?: number // Low shelf EQ gain in dB (default: 0)
  audioEqLowFrequencyHz?: number // Low shelf center frequency in Hz
  audioEqLowQ?: number // Low band Q for peak/notch/shelf shape
  audioEqLowMidEnabled?: boolean
  audioEqLowMidType?: import('@/types/audio').AudioEqInnerBandType
  audioEqLowMidGainDb?: number // Low-mid peaking EQ gain in dB (default: 0)
  audioEqLowMidFrequencyHz?: number // Low-mid center frequency in Hz
  audioEqLowMidQ?: number // Low-mid bandwidth/Q
  audioEqMidGainDb?: number // Legacy center band gain in dB (default: 0)
  audioEqHighMidEnabled?: boolean
  audioEqHighMidType?: import('@/types/audio').AudioEqInnerBandType
  audioEqHighMidGainDb?: number // High-mid peaking EQ gain in dB (default: 0)
  audioEqHighMidFrequencyHz?: number // High-mid center frequency in Hz
  audioEqHighMidQ?: number // High-mid bandwidth/Q
  audioEqHighEnabled?: boolean
  audioEqHighType?: import('@/types/audio').AudioEqInnerBandType
  audioEqHighGainDb?: number // High shelf EQ gain in dB (default: 0)
  audioEqHighFrequencyHz?: number // High shelf center frequency in Hz
  audioEqHighQ?: number // High band Q for peak/notch/shelf shape
  audioEqBand6Enabled?: boolean // Outer right EQ band on/off
  audioEqBand6Type?: import('@/types/audio').AudioEqBand6Type
  audioEqBand6FrequencyHz?: number
  audioEqBand6GainDb?: number
  audioEqBand6Q?: number
  audioEqBand6SlopeDbPerOct?: 6 | 12 | 18 | 24
  audioEqHighCutEnabled?: boolean // Enable high cut / low-pass filter
  audioEqHighCutFrequencyHz?: number // High cut frequency in Hz
  audioEqHighCutSlopeDbPerOct?: 6 | 12 | 18 | 24 // High cut slope
  // Video properties (for video items)
  fadeIn?: number // Video fade in duration in seconds (default: 0)
  fadeOut?: number // Video fade out duration in seconds (default: 0)
  // Visual effects (GPU shader effects)
  effects?: ItemEffect[]
  // Blend mode for layer compositing (default: 'normal')
  blendMode?: BlendMode
  // Corner pin transform (perspective warp)
  cornerPin?: TimelineItemCornerPin
}

export interface GeneratedCaptionSource {
  /**
   * `transcript` — generated from whisper speech-to-text segments.
   * `ai-captions` — generated from vision-language-model frame descriptions
   *   (e.g. LFM captioning). Distinguished so replace/remove flows can target
   *   one kind without disturbing the other on the same clip.
   * `subtitle-import` — imported from a sidecar subtitle file such as SRT/VTT.
   * `embedded-subtitles` — extracted from an embedded media subtitle track.
   */
  type: 'transcript' | 'ai-captions' | 'subtitle-import' | 'embedded-subtitles'
  clipId: string
  mediaId: string
  fileName?: string
  format?: 'srt' | 'vtt'
  importedAt?: number
}

// Discriminated union types for different item types
export type VideoItem = BaseTimelineItem & {
  type: 'video'
  src: string
  audioSrc?: string // Optional source used for audio playback when visuals use a silent proxy
  thumbnailUrl?: string
  offset?: number // Trim offset in source video
  embeddedAudioMuted?: boolean // Suppress embedded audio after unlinking from audio companion
  // Source dimensions (intrinsic size from media metadata)
  sourceWidth?: number
  sourceHeight?: number
}

export type AudioItem = BaseTimelineItem & {
  type: 'audio'
  src: string
  waveformData?: number[]
  offset?: number // Trim offset in source audio
}

export type TextSpan = {
  text: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold'
  fontStyle?: 'normal' | 'italic'
  underline?: boolean
  color?: string
  letterSpacing?: number
}

export type TextSingleLayoutDraft = {
  text: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold'
  fontStyle?: 'normal' | 'italic'
  underline?: boolean
  color?: string
  letterSpacing?: number
}

export type TextLayoutDrafts = {
  single?: TextSingleLayoutDraft
  twoSpans?: TextSpan[]
  threeSpans?: TextSpan[]
}

export type TextItem = BaseTimelineItem & {
  type: 'text'
  text: string
  textSpans?: TextSpan[]
  textLayoutDrafts?: TextLayoutDrafts
  textStylePresetId?: TextStylePresetId
  textStyleScale?: number
  textRole?: 'caption'
  captionSource?: GeneratedCaptionSource
  // Typography
  fontSize?: number // Font size in pixels (default: 60)
  fontFamily?: string // Font family name (default: 'Inter')
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold' // Font weight (default: 'normal')
  fontStyle?: 'normal' | 'italic' // Font style (default: 'normal')
  underline?: boolean // Underline text decoration (default: false)
  // Colors
  color: string // Text color (hex or oklch)
  backgroundColor?: string // Background color behind text (optional)
  backgroundRadius?: number // Background box radius in pixels (default: 0)
  // Text layout
  textAlign?: 'left' | 'center' | 'right' // Horizontal alignment (default: 'center')
  verticalAlign?: 'top' | 'middle' | 'bottom' // Vertical alignment (default: 'middle')
  lineHeight?: number // Line height multiplier (default: 1.2)
  letterSpacing?: number // Letter spacing in pixels (default: 0)
  textPadding?: number // Inset padding inside the text box in pixels (default: 16)
  // Text effects
  textShadow?: {
    offsetX: number
    offsetY: number
    blur: number
    color: string
  }
  stroke?: {
    width: number
    color: string
  }
}

export type ImageItem = BaseTimelineItem & {
  type: 'image'
  src: string
  thumbnailUrl?: string
  // Source dimensions (intrinsic size from media metadata)
  sourceWidth?: number
  sourceHeight?: number
}

export type ShapeType =
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'ellipse'
  | 'star'
  | 'polygon'
  | 'heart'
  | 'path'
  // MatchView additions — see docs/superpowers/specs/2026-05-24-konva-shape-renderer-design.md
  | 'arrow'
  | 'free-polygon'
  // Field-level player ring — see docs/superpowers/specs/2026-06-04-field-ring-shape-design.md
  | 'field-ring'
  // Connected group of field rings (loop/chain of player rings with links).
  | 'connected-rings'
  // Player spotlight — light beam + ground pool + soft figure cutout.
  | 'spotlight'
  // Editable on-canvas text label (Konva).
  | 'text'
  // Timeline-synced match clock / drill countdown.
  | 'timer'
  // Image overlay (logo / headshot / marker) — skewable, opacity-adjustable.
  | 'image'

/** Free-form arrow with two endpoints + parametric pointer head.
 *  Used when `shapeType === 'arrow'`. Coordinates are item-local
 *  (relative to ShapeItem.x / y). */
export interface ArrowData {
  fromX: number
  fromY: number
  toX: number
  toY: number
  pointerLength?: number // default 16
  pointerWidth?: number // default 16
  dash?: 'solid' | 'dashed' | 'dotted' // default 'solid'
  // v1 breadcrumb — reserved for the curved-arrow variant. Undefined in
  // v0 = straight arrow; setting these promotes the arrow to curved
  // without a project-data migration.
  controlX?: number
  controlY?: number
}

/** Free-form polygon vertices. Used when `shapeType === 'free-polygon'`.
 *  Distinct from the existing `ShapeItem.points` number field (which is
 *  the SIDES COUNT for the parametric regular-polygon N-gon). */
export interface FreePolygonData {
  /** Flat [x0, y0, x1, y1, …] in item-local coordinates. */
  vertices: number[]
  closed: boolean
}

/** Field-level ring under a player. Used when shapeType === 'field-ring'.
 *  The ellipse bounding box comes from ShapeItem.transform: radiusX =
 *  transform.width / 2, radiusY = radiusX * squash. Band color = fillColor. */
export interface FieldRingData {
  squash: number // 0.12–1   radiusY / radiusX (low = flat field ring)
  bandThickness: number // px band/stroke weight
  segments: number // chopped segment count (default 6)
  continuous: boolean // true = unbroken band (segments/gap ignored)
  gapRatio: number // 0–0.8   gap fraction between segments
  roundedEnds: boolean // round vs square (butt) segment caps
  extrusionHeight: number // px  0 = flat 2D
  spin: boolean
  spinSpeed: number // revolutions/sec, signed (sign = direction)
  contactShadow: boolean
}

/** Connected group of field rings. Used when shapeType === 'connected-rings'.
 *  Node positions + open/closed reuse `freePolygonData` (vertices are absolute
 *  canvas-pixel coords, like free-polygon). This holds the shared ring look,
 *  the node radius, and the connector (link) styling. */
export interface ConnectedRingsData {
  nodeRadius: number // shared radiusX of every ring (px); radiusY = nodeRadius * ring.squash
  ring: FieldRingData // shared appearance applied to every node ring
  connectorColor: string
  connectorWidth: number
}

/** Player spotlight. Used when shapeType === 'spotlight'. A vertical light
 *  beam landing on a ground pool, with a soft "figure" cutout so the player
 *  shows through. Position/size come from ShapeItem.transform (beam width =
 *  transform.width, height = transform.height); light colour = fillColor. */
export interface SpotlightData {
  intensity: number // 0–1 master alpha for the beam + pool
  pool: boolean // show the ground pool ellipse
  bloom: boolean // show the bright bloom where the beam meets the ground
  cutout: boolean // punch the soft figure cutout so the player shows through
  cutoutWidth: number // px width of the cutout figure
  cutoutHeight: number // px height of the cutout figure (head→feet)
}

/** Editable on-canvas text label. Used when shapeType === 'text'. Content +
 *  font live here; colour = fillColor; wrap width = transform.width. Distinct
 *  from the top-level TextItem (type: 'text') used by the composition. */
export interface TextShapeData {
  content: string
  fontSize: number
  fontFamily: string
  align: 'left' | 'center' | 'right'
  /** Affine shear (degrees) so the label can lie on the pitch. Vector — text
   *  stays crisp/editable; no rasterization. */
  skewX: number
  skewY: number
}

/** Timeline-synced timer. Used when shapeType === 'timer'. The displayed time
 *  is a pure function of the playhead frame:
 *   - 'up'   (match clock): offsetSec + elapsed
 *   - 'down' (drill):       max(0, durationSec - elapsed)
 *  where elapsed = (currentFrame - item.from) / fps. Colour = fillColor. */
export interface TimerData {
  mode: 'up' | 'down'
  offsetSec: number // 'up' start value (real match time at clip start)
  durationSec: number // 'down' countdown start
  format: 'hh:mm:ss' | 'mm:ss' | 'mm:ss:cc' | 'ss:cc' | 'ss'
  fontSize: number
  fontFamily: string
}

/** Image overlay. Used when shapeType === 'image'. The picture is sourced from
 *  a media-library entry (`mediaId` is the source of truth; the renderer resolves
 *  it to a URL), so nothing ephemeral is persisted in the project. Size/position
 *  come from ShapeItem.transform and opacity from transform.opacity; skew lets
 *  the image lie on the pitch with perspective (mirrors TextShapeData). */
export interface ImageShapeData {
  mediaId: string
  /** Intrinsic pixel size — for aspect-correct default sizing. */
  naturalWidth: number
  naturalHeight: number
  /** Affine shear (degrees). Vector skew applied by the renderer as a factor. */
  skewX: number
  skewY: number
  /** Ephemeral resolved object URL (set by resolveMediaUrls for the render
   *  pipelines; never the source of truth — `mediaId` is). Used by the export
   *  worker to preload the image since it can't reach the media store. */
  src?: string
}

/** One recorded change for a shape clip: at clip-relative `frame`, apply
 *  `patch` (any subset of the shape's fields). Step playback — no interpolation.
 *  Resolved on top of the base item by resolveShapeAtFrame. */
export interface ShapeKeyframe {
  frame: number
  patch: Partial<ShapeItem>
}

export type ShapeItem = BaseTimelineItem & {
  type: 'shape'
  shapeType: ShapeType
  // Fill
  fillColor: string
  // Stroke
  strokeColor?: string
  strokeWidth?: number
  // Shape-specific
  cornerRadius?: number // Rect, Triangle, Star, Polygon
  direction?: 'up' | 'down' | 'left' | 'right' // Triangle only
  points?: number // Star (5 default), Polygon (6 default)
  innerRadius?: number // Star only (ratio 0-1 of outer)
  // Path shape (custom bezier path drawn with pen tool)
  pathVertices?: import('@/types/masks').MaskVertex[] // Normalized 0-1 vertices for 'path' shapeType
  // MatchView additions — used by `shapeType: 'arrow'` and `shapeType: 'free-polygon'` respectively.
  arrowData?: ArrowData
  freePolygonData?: FreePolygonData
  // Field-ring config — used when shapeType === 'field-ring'.
  fieldRingData?: FieldRingData
  // Connected-rings config — used when shapeType === 'connected-rings'.
  // (node positions + closed live in freePolygonData, reused.)
  connectedRingsData?: ConnectedRingsData
  // Spotlight config — used when shapeType === 'spotlight'.
  spotlightData?: SpotlightData
  // Text-label config — used when shapeType === 'text'.
  textShapeData?: TextShapeData
  // Timer config — used when shapeType === 'timer'.
  timerData?: TimerData
  // Image-overlay config — used when shapeType === 'image'.
  imageShapeData?: ImageShapeData
  // Change registry for this clip (frame-relative). Resolved on top of the
  // base item by resolveShapeAtFrame. Optional → old projects have none.
  keyframes?: ShapeKeyframe[]
  // Mask properties
  isMask?: boolean // When true, shape acts as mask for lower tracks
  maskType?: 'clip' | 'alpha' // clip = hard edges, alpha = soft edges
  maskFeather?: number // Feather amount for alpha masks (0-100px, default: 10)
  maskInvert?: boolean // Invert mask (show outside, hide inside)
}

// Adjustment layer - applies effects to all items on tracks ABOVE this track
export type AdjustmentItem = BaseTimelineItem & {
  type: 'adjustment'
  // Uses existing effects?: ItemEffect[] from BaseTimelineItem
  // Effects apply to all items on tracks ABOVE this track (higher track order)

  // Optional: intensity control for all effects
  effectOpacity?: number // 0-1, defaults to 1
}

// Composition item - references a sub-composition (pre-comp)
export type CompositionItem = BaseTimelineItem & {
  type: 'composition'
  compositionId: string // References a SubComposition in compositions-store
  // Dimensions of the sub-composition canvas
  compositionWidth: number
  compositionHeight: number
}

/**
 * A single cue inside a {@link SubtitleSegmentItem}. Times are seconds
 * relative to the segment's `from` (after speed scaling) — i.e. the same
 * model as imported SRT/VTT, so a cue payload survives `from` changes,
 * trims, and splits without rewriting timestamps.
 */
export interface SubtitleSegmentCue {
  id: string
  startSeconds: number
  endSeconds: number
  text: string
}

/**
 * One timeline item that owns an entire subtitle track's cues.
 *
 * Replaces the historical "one TextItem per cue" approach for
 * embedded-subtitle / SRT-import flows: instead of stamping out N
 * caption items, we get one segment that renders the active cue per
 * frame from `cues`, applying the segment's style block uniformly.
 *
 * Style fields mirror the subset of {@link TextItem}'s typography that
 * makes sense applied to all cues at once. Per-cue styling can be
 * layered on later via `cue.style?` if needed.
 */
export type SubtitleSegmentItem = BaseTimelineItem & {
  type: 'subtitle'
  /** Source-track origin (e.g. "Squid.Game.S02E01.mkv - en (Track 6)"). */
  sourceLabel?: string
  /** How the cues were obtained — drives replace/refresh affordances. */
  source: SubtitleSegmentSource
  /** Cue list, sorted by `startSeconds`. Times are segment-relative. */
  cues: SubtitleSegmentCue[]
  // Typography (same defaults as TextItem)
  fontSize?: number
  fontFamily?: string
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold'
  fontStyle?: 'normal' | 'italic'
  underline?: boolean
  color: string
  backgroundColor?: string
  backgroundRadius?: number
  textAlign?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  lineHeight?: number
  letterSpacing?: number
  textPadding?: number
  textShadow?: {
    offsetX: number
    offsetY: number
    blur: number
    color: string
  }
  stroke?: {
    width: number
    color: string
  }
}

export type SubtitleSegmentSource =
  | {
      type: 'transcript'
      mediaId: string
      clipId: string
    }
  | {
      type: 'embedded-subtitles'
      mediaId: string
      clipId: string
      trackNumber: number
      language?: string
      trackName?: string
      codecId?: string
      importedAt: number
    }
  | {
      type: 'subtitle-import'
      fileName: string
      format: 'srt' | 'vtt'
      importedAt: number
    }

// Union type for all timeline items
export type TimelineItem =
  | VideoItem
  | AudioItem
  | TextItem
  | ImageItem
  | ShapeItem
  | AdjustmentItem
  | CompositionItem
  | SubtitleSegmentItem

export interface TimelineTrack {
  id: string
  name: string
  // 'shape' is a MatchView addition — annotation overlay tracks that host
  // ShapeItem clips. From the user's perspective, tracks fall into two
  // surfaces: "media" (video/audio) and "shapes". Existing code that
  // checks kind === 'video' / kind === 'audio' is unaffected; shape
  // tracks are treated as neither.
  kind?: 'video' | 'audio' | 'shape'
  height: number
  locked: boolean
  syncLock?: boolean // Defaults to true - controls whether ripple edits propagate to this track
  visible: boolean // Visual visibility (Eye icon)
  muted: boolean // Audio muting (Volume icon)
  solo: boolean
  volume?: number // Track gain in dB (default: 0)
  audioEq?: AudioEqSettings // Per-track EQ (separate from per-clip EQ)
  color?: string // Optional - tracks are generic containers, items have colors
  order: number
  items: TimelineItem[]
  // Track grouping (subsequences)
  parentTrackId?: string // ID of the group track this track belongs to
  isGroup?: boolean // true = container track (no items, only children)
  isCollapsed?: boolean // Whether the group's children are collapsed
}

// Project markers (user-created timeline markers)
export interface ProjectMarker {
  id: string
  frame: number
  label?: string
  color: string
}
