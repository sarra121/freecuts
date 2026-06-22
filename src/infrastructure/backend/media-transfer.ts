/**
 * Media byte transfer — the actual pushing/pulling of video bytes to and from
 * R2, built on top of the backend client's presigned URLs.
 *
 * Like the backend client, this is pure transport: no React, no feature
 * imports. The bytes travel BROWSER <-> R2 directly; our backend only ever
 * hands out the signed URLs, it never touches the file.
 *
 * Holds both directions: uploadFileToR2 (push) and downloadMediaFromR2 (pull).
 */

import type { BackendClient, UploadPartRef } from './backend-client'

/** Optional knobs for an upload. */
export interface UploadOptions {
  /**
   * Called after each chunk finishes, with overall progress as a fraction
   * 0..1. Granularity is per-chunk, which is plenty for a progress bar.
   */
  onProgress?: (fraction: number) => void
  /** Injectable fetch (defaults to global) so tests can avoid the network. */
  fetchImpl?: typeof fetch
}

/** What the uploader returns once the file is fully stored in R2. */
export interface UploadResult {
  /** The object's key (path) inside the bucket, e.g. videos/<id>/source.mp4. */
  r2Key: string
}

/**
 * Upload one file to R2 in chunks, end to end.
 *
 * @param file   the browser File/Blob to upload (needs name, type, size)
 * @param client the backend client (gives us start/complete + presigned URLs)
 */
export async function uploadFileToR2(
  file: File,
  client: BackendClient,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const doFetch = options.fetchImpl ?? fetch

  // 1. Ask the backend to start a multipart upload. It returns the object key,
  //    an uploadId, the chunk size it chose, and one presigned URL per chunk.
  const start = await client.startUpload({
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
  })

  // Collected as we go; completeUpload needs every part's number + ETag.
  const finishedParts: UploadPartRef[] = []
  let uploadedBytes = 0

  // 2. Upload each chunk straight to its presigned URL.
  for (const part of start.parts) {
    // Byte range for this 1-based part: [(n-1)*size, n*size). slice() clamps
    // the end, so the final (short) chunk is handled automatically.
    const begin = (part.partNumber - 1) * start.partSize
    const chunk = file.slice(begin, begin + start.partSize)

    const res = await doFetch(part.url, { method: 'PUT', body: chunk })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Chunk ${part.partNumber} upload failed: ${res.status} ${detail}`)
    }

    // R2 returns the chunk's fingerprint in the ETag response header. The
    // browser can only READ that header if the bucket's CORS config exposes
    // it (ExposeHeaders: ETag). A missing ETag here almost always means CORS,
    // not a failed upload — so say so clearly.
    const etag = res.headers.get('etag')
    if (!etag) {
      throw new Error(
        `Chunk ${part.partNumber} returned no ETag. The R2 bucket's CORS config ` +
          `must allow PUT from this origin and expose the ETag header.`,
      )
    }

    finishedParts.push({ partNumber: part.partNumber, etag })
    uploadedBytes += chunk.size
    options.onProgress?.(uploadedBytes / file.size)
  }

  // 3. Tell the backend to finalize — R2 stitches the chunks into one object.
  await client.completeUpload({
    key: start.key,
    uploadId: start.uploadId,
    parts: finishedParts,
  })

  return { r2Key: start.key }
}

/** Optional knobs for a download. */
export interface DownloadOptions {
  /** Injectable fetch (defaults to global) so tests can avoid the network. */
  fetchImpl?: typeof fetch
}

/**
 * Download one media's bytes from R2 by id, end to end.
 *
 * @param mediaId the cloud media record id (the same id used in PUT /media/:id)
 * @param client  the backend client (gives us the short-lived signed GET URL)
 * @returns the file's bytes as a Blob
 */
export async function downloadMediaFromR2(
  mediaId: string,
  client: BackendClient,
  options: DownloadOptions = {},
): Promise<Blob> {
  const doFetch = options.fetchImpl ?? fetch

  // 1. Ask the backend for a temporary signed URL pointing at the bytes in R2.
  const { url } = await client.getMediaUrl(mediaId)

  // 2. Fetch the bytes straight from R2 (the backend never streams them).
  const res = await doFetch(url)
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Media ${mediaId} download failed: ${res.status} ${detail}`)
  }

  // 3. Hand back the whole response body as a Blob.
  return res.blob()
}
