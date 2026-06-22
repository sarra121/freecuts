import { describe, it, expect } from 'vitest'
import { uploadFileToR2, downloadMediaFromR2 } from './media-transfer'
import type { BackendClient } from './backend-client'

/**
 * A fake backend client that hands out two presigned part URLs and records what
 * completeUpload was called with. Only the methods the uploader uses are real;
 * the rest throw if touched (so a test mistake is loud).
 */
function makeClient(partSize: number) {
  const completed: { key: string; uploadId: string; parts: unknown[] }[] = []
  const client = {
    startUpload: async () => ({
      videoId: 'vid1',
      key: 'videos/vid1/source.mp4',
      uploadId: 'up1',
      partSize,
      parts: [
        { partNumber: 1, url: 'https://r2.example/part1' },
        { partNumber: 2, url: 'https://r2.example/part2' },
      ],
    }),
    completeUpload: async (input: { key: string; uploadId: string; parts: unknown[] }) => {
      completed.push(input)
      return { ok: true as const, key: input.key }
    },
  } as unknown as BackendClient
  return { client, completed }
}

/**
 * A fake fetch for the PUT-to-R2 calls. Records each call's URL + body size and
 * returns 200 with an ETag header (as a CORS-correct R2 would).
 */
function makePutFetch(withEtag = true) {
  const puts: { url: string; size: number }[] = []
  const fake = (async (url: string | URL | Request, init?: RequestInit) => {
    const body = init?.body as Blob
    puts.push({ url: String(url), size: body.size })
    return new Response(null, {
      status: 200,
      headers: withEtag ? { etag: `"etag-${puts.length}"` } : {},
    })
  }) as unknown as typeof fetch
  return { fake, puts }
}

/** Build a File of `size` bytes (content doesn't matter, only the length). */
function fileOfSize(size: number): File {
  return new File([new Uint8Array(size)], 'match.mp4', { type: 'video/mp4' })
}

describe('uploadFileToR2', () => {
  it('uploads each chunk to its presigned URL and finalizes with ETags', async () => {
    const partSize = 6
    const { client, completed } = makeClient(partSize)
    const { fake, puts } = makePutFetch()
    // 10 bytes over a 6-byte part size => part1 = 6 bytes, part2 = 4 bytes.
    const file = fileOfSize(10)

    const result = await uploadFileToR2(file, client, { fetchImpl: fake })

    // Each part went to its own URL with the correct byte slice.
    expect(puts).toEqual([
      { url: 'https://r2.example/part1', size: 6 },
      { url: 'https://r2.example/part2', size: 4 },
    ])
    // Finalized once, with both parts' numbers + ETags, and returns the key.
    expect(completed).toHaveLength(1)
    expect(completed[0]?.parts).toEqual([
      { partNumber: 1, etag: '"etag-1"' },
      { partNumber: 2, etag: '"etag-2"' },
    ])
    expect(result.r2Key).toBe('videos/vid1/source.mp4')
  })

  it('reports progress reaching 1 when done', async () => {
    const { client } = makeClient(6)
    const { fake } = makePutFetch()
    const seen: number[] = []

    await uploadFileToR2(fileOfSize(10), client, {
      fetchImpl: fake,
      onProgress: (f) => seen.push(f),
    })

    expect(seen[seen.length - 1]).toBe(1)
    // Progress is monotonically non-decreasing.
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
  })

  it('throws a CORS-pointing error when a chunk returns no ETag', async () => {
    const { client } = makeClient(6)
    const { fake } = makePutFetch(false) // no ETag header

    await expect(
      uploadFileToR2(fileOfSize(10), client, { fetchImpl: fake }),
    ).rejects.toThrow(/ETag|CORS/)
  })
})

/**
 * A fake client whose getMediaUrl returns a fixed signed URL, plus a fake fetch
 * that serves canned bytes from that URL. Lets us test the downloader offline.
 */
function makeDownloadClient(signedUrl: string) {
  const calls: string[] = []
  const client = {
    getMediaUrl: async (id: string) => {
      calls.push(id)
      return { url: signedUrl }
    },
  } as unknown as BackendClient
  return { client, calls }
}

describe('downloadMediaFromR2', () => {
  it('resolves the signed URL by id and returns the fetched bytes as a Blob', async () => {
    const signedUrl = 'https://r2.example/videos/v1/source.mp4?signed'
    const { client, calls } = makeDownloadClient(signedUrl)
    const fetched: string[] = []
    const fake = (async (url: string | URL | Request) => {
      fetched.push(String(url))
      return new Response('the-bytes', { status: 200 })
    }) as unknown as typeof fetch

    const blob = await downloadMediaFromR2('media-1', client, { fetchImpl: fake })

    // Asked the backend for THIS media's URL, then fetched THAT url.
    expect(calls).toEqual(['media-1'])
    expect(fetched).toEqual([signedUrl])
    // jsdom's Blob has no .text(); size proves the 9-byte body came through.
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBe('the-bytes'.length)
  })

  it('throws a descriptive error when the download is not ok', async () => {
    const { client } = makeDownloadClient('https://r2.example/x?signed')
    const fake = (async () =>
      new Response('nope', { status: 403 })) as unknown as typeof fetch

    await expect(
      downloadMediaFromR2('media-1', client, { fetchImpl: fake }),
    ).rejects.toThrow(/403/)
  })
})
