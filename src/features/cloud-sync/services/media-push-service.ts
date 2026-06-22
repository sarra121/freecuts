/**
 * Media push — get a project's media bytes into the cloud.
 *
 * For each media a project uses: if the cloud doesn't already have it, upload
 * the bytes to R2 (chunked) and register a media record so other devices can
 * find and download it.
 *
 * Dependencies are injected (with real defaults) so the unit test can run with
 * fakes — no real media library, no network.
 */

import type { MediaMetadata } from '@/types/storage'
import type { BackendClient } from '@/infrastructure/backend'
import { uploadFileToR2, type UploadOptions, type UploadResult } from '@/infrastructure/backend'

import { mediaLibraryService } from '../deps/media-library'

/** The slimmed-down media shape this service actually needs. */
export interface MediaToPush {
  id: string
  fileName: string
  size: number
  contentType: string
  updatedAt: number
}

/** Progress for one media as its bytes upload. */
export interface MediaPushProgress {
  mediaId: string
  fileName: string
  /** 1-based position in the push queue. */
  index: number
  /** Total media being considered this push. */
  total: number
  /** 0..1 for THIS media's bytes. */
  fraction: number
}

export interface MediaPushOptions {
  onProgress?: (progress: MediaPushProgress) => void
}

/** What pushProjectMedia reports back. */
export interface MediaPushResult {
  /** Ids newly uploaded + registered this run. */
  uploaded: string[]
  /** Ids skipped because the cloud already had them. */
  skippedAlreadyInCloud: string[]
  /** Ids that could not be pushed, with a reason. */
  failed: { mediaId: string; reason: string }[]
}

/**
 * Injectable seams. Defaults wire to the real media library + uploader; tests
 * pass fakes so nothing touches disk or network.
 */
export interface MediaPushDeps {
  listProjectMedia: (projectId: string) => Promise<MediaToPush[]>
  getMediaBytes: (mediaId: string) => Promise<Blob | null>
  uploadFile: (file: File, client: BackendClient, opts?: UploadOptions) => Promise<UploadResult>
}

/** Map the media library's full metadata down to what we need to push. */
function toMediaToPush(m: MediaMetadata): MediaToPush {
  return {
    id: m.id,
    fileName: m.fileName,
    size: m.fileSize,
    contentType: m.mimeType,
    updatedAt: m.updatedAt,
  }
}

/** The real dependencies, used in the app (overridden in tests). */
export const defaultMediaPushDeps: MediaPushDeps = {
  listProjectMedia: async (projectId) => {
    const media = await mediaLibraryService.getMediaForProject(projectId)
    return media.map(toMediaToPush)
  },
  getMediaBytes: (mediaId) => mediaLibraryService.getMediaFile(mediaId),
  uploadFile: uploadFileToR2,
}

/**
 * Push every media a project uses into the cloud (skipping ones already there).
 *
 * @param projectId which project's media to push
 * @param client    the backend client
 */
export async function pushProjectMedia(
  projectId: string,
  client: BackendClient,
  options: MediaPushOptions = {},
  deps: MediaPushDeps = defaultMediaPushDeps,
): Promise<MediaPushResult> {
  const items = await deps.listProjectMedia(projectId)

  // One round-trip to learn what the cloud already holds, so we never re-upload.
  const cloud = await client.listMedia()
  const inCloud = new Set(cloud.media.map((m) => m.id))

  const result: MediaPushResult = { uploaded: [], skippedAlreadyInCloud: [], failed: [] }

  let index = 0
  for (const item of items) {
    index += 1

    if (inCloud.has(item.id)) {
      result.skippedAlreadyInCloud.push(item.id)
      continue
    }

    const blob = await deps.getMediaBytes(item.id)
    if (!blob) {
      result.failed.push({ mediaId: item.id, reason: 'no local bytes available' })
      continue
    }

    try {
      // Wrap the bytes as a File so the uploader has a name + content type.
      const file = new File([blob], item.fileName, { type: item.contentType })

      const { r2Key } = await deps.uploadFile(file, client, {
        onProgress: (fraction) =>
          options.onProgress?.({
            mediaId: item.id,
            fileName: item.fileName,
            index,
            total: items.length,
            fraction,
          }),
      })

      // Register the record so other devices can list + download it.
      await client.putMedia(item.id, {
        fileName: item.fileName,
        size: item.size,
        contentType: item.contentType,
        r2Key,
        updatedAt: item.updatedAt,
      })

      result.uploaded.push(item.id)
    } catch (error) {
      result.failed.push({ mediaId: item.id, reason: String(error) })
    }
  }

  return result
}
