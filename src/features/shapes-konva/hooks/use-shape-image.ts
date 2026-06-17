import { useEffect, useState } from 'react'
import { blobUrlManager } from '@/infrastructure/browser/blob-url-manager'
import { mediaLibraryService } from '../deps/media-library'

/**
 * Resolve a media id to a decoded HTMLImageElement for Konva rendering.
 *
 * Tries the in-session blob-URL cache first (just-imported images), then
 * re-reads the file from storage and acquires a fresh URL — this covers a
 * project reload, where the original object URL no longer exists but the
 * mediaId still does. Returns null while loading or when the media is gone.
 */
export function useShapeImage(mediaId: string | undefined): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!mediaId) {
      setImage(null)
      return
    }
    let cancelled = false
    setImage(null)

    const img = new Image()
    img.onload = () => {
      if (!cancelled) setImage(img)
    }

    void (async () => {
      let url = blobUrlManager.get(mediaId)
      if (!url) {
        const blob = await mediaLibraryService.getMediaFile(mediaId)
        if (!blob || cancelled) return
        url = blobUrlManager.acquire(mediaId, blob)
      }
      img.src = url
    })()

    return () => {
      cancelled = true
    }
  }, [mediaId])

  return image
}
