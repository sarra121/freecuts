import type { ShapeItem } from '@/types/timeline'
import { useTimelineStore } from '../../deps/timeline'
import { usePlaybackStore } from '../../deps/playback'
import { mediaLibraryService, useMediaLibraryStore } from '../../deps/media-library'
import { IMAGE_DEFAULTS } from '../../utils/defaults'
import { ensureShapeTrackForRange } from './ensure-shape-track'

interface CreateImageShapeInput {
  /** The picked image file. */
  file: File
  /** Drop position in canvas-pixel coords. When omitted, spawns at centre. */
  position?: { x: number; y: number }
  canvasWidth?: number
  canvasHeight?: number
}

/** Read an image file's intrinsic pixel size. */
async function readNaturalSize(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  const size = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return size
}

/**
 * Create an image-overlay shape from a picked file. Imports the file into the
 * project's media library (so it persists + reloads via mediaId), then drops a
 * 5s image shape at the playhead, aspect-fit so its longest side is
 * IMAGE_DEFAULTS.maxSize. Returns the new item id, or null if there's no
 * project context or the file isn't a decodable image.
 */
export async function createImageShape(input: CreateImageShapeInput): Promise<string | null> {
  const { file, position, canvasWidth, canvasHeight } = input
  const projectId = useMediaLibraryStore.getState().currentProjectId
  if (!projectId) return null

  let naturalWidth: number
  let naturalHeight: number
  try {
    const size = await readNaturalSize(file)
    naturalWidth = size.width
    naturalHeight = size.height
  } catch {
    return null
  }

  // Aspect-fit the longest side to maxSize.
  const longest = Math.max(naturalWidth, naturalHeight, 1)
  const scale = IMAGE_DEFAULTS.maxSize / longest
  const width = Math.max(1, Math.round(naturalWidth * scale))
  const height = Math.max(1, Math.round(naturalHeight * scale))

  const saved = await mediaLibraryService.importGeneratedImage(file, projectId, {
    width: naturalWidth,
    height: naturalHeight,
    tags: ['image-overlay'],
    codec: file.type.includes('png') ? 'png' : file.type.split('/')[1] || 'image',
  })
  useMediaLibraryStore.getState().prependMediaItem(saved)

  const facade = useTimelineStore.getState()
  const fps = facade.fps
  const frame = usePlaybackStore.getState().currentFrame
  const durationInFrames = fps * 5
  const trackId = ensureShapeTrackForRange(frame, durationInFrames)

  const positionOffset =
    position && canvasWidth != null && canvasHeight != null
      ? { x: position.x - canvasWidth / 2, y: position.y - canvasHeight / 2 }
      : { x: 0, y: 0 }

  const id = crypto.randomUUID()
  const item: ShapeItem = {
    id,
    type: 'shape',
    trackId,
    from: frame,
    durationInFrames,
    label: file.name || 'Image',
    shapeType: 'image',
    // fillColor is required by ShapeItem but unused by the image renderer.
    fillColor: '#FFFFFF',
    transform: { x: positionOffset.x, y: positionOffset.y, width, height },
    imageShapeData: {
      mediaId: saved.id,
      naturalWidth,
      naturalHeight,
      skewX: IMAGE_DEFAULTS.skewX,
      skewY: IMAGE_DEFAULTS.skewY,
    },
  }
  facade.addItem(item)
  return id
}
