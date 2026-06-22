import { describe, it, expect } from 'vitest'
import { pushProjectMedia, type MediaPushDeps, type MediaToPush } from './media-push-service'
import type { BackendClient } from '@/infrastructure/backend'

/**
 * A fake backend client. listMedia reports what the cloud already has; putMedia
 * records registrations. Only the methods the push service uses are real.
 */
function makeClient(alreadyInCloud: string[]) {
  const registered: string[] = []
  const client = {
    listMedia: async () => ({
      media: alreadyInCloud.map((id) => ({
        id,
        fileName: `${id}.mp4`,
        size: 1,
        contentType: 'video/mp4',
        r2Key: `videos/${id}/source.mp4`,
        updatedAt: 1,
      })),
    }),
    putMedia: async (id: string) => {
      registered.push(id)
      return { ok: true as const, id }
    },
  } as unknown as BackendClient
  return { client, registered }
}

/** Build injectable deps from simple in-memory data. */
function makeDeps(
  items: MediaToPush[],
  bytesById: Record<string, Blob | null>,
): { deps: MediaPushDeps; uploadedFiles: string[] } {
  const uploadedFiles: string[] = []
  const deps: MediaPushDeps = {
    listProjectMedia: async () => items,
    getMediaBytes: async (id) => bytesById[id] ?? null,
    uploadFile: async (file, _client, opts) => {
      uploadedFiles.push(file.name)
      opts?.onProgress?.(1) // simulate a completed upload
      return { r2Key: `videos/${file.name}/source.mp4` }
    },
  }
  return { deps, uploadedFiles }
}

const item = (id: string): MediaToPush => ({
  id,
  fileName: `${id}.mp4`,
  size: 10,
  contentType: 'video/mp4',
  updatedAt: 100,
})

describe('pushProjectMedia', () => {
  it('uploads + registers media that is not yet in the cloud', async () => {
    const { client, registered } = makeClient([]) // cloud empty
    const { deps, uploadedFiles } = makeDeps([item('a'), item('b')], {
      a: new Blob(['aaa']),
      b: new Blob(['bbb']),
    })

    const result = await pushProjectMedia('proj1', client, {}, deps)

    expect(result.uploaded).toEqual(['a', 'b'])
    expect(result.skippedAlreadyInCloud).toEqual([])
    expect(result.failed).toEqual([])
    expect(uploadedFiles).toEqual(['a.mp4', 'b.mp4'])
    expect(registered).toEqual(['a', 'b'])
  })

  it('skips media the cloud already has (no upload, no register)', async () => {
    const { client, registered } = makeClient(['a']) // cloud already has "a"
    const { deps, uploadedFiles } = makeDeps([item('a'), item('b')], {
      a: new Blob(['aaa']),
      b: new Blob(['bbb']),
    })

    const result = await pushProjectMedia('proj1', client, {}, deps)

    expect(result.skippedAlreadyInCloud).toEqual(['a'])
    expect(result.uploaded).toEqual(['b'])
    expect(uploadedFiles).toEqual(['b.mp4']) // "a" was never uploaded
    expect(registered).toEqual(['b'])
  })

  it('records a failure when local bytes are missing', async () => {
    const { client, registered } = makeClient([])
    const { deps } = makeDeps([item('a')], { a: null }) // no bytes for "a"

    const result = await pushProjectMedia('proj1', client, {}, deps)

    expect(result.uploaded).toEqual([])
    expect(result.failed).toEqual([{ mediaId: 'a', reason: 'no local bytes available' }])
    expect(registered).toEqual([])
  })

  it('reports per-media progress with index/total', async () => {
    const { client } = makeClient([])
    const { deps } = makeDeps([item('a'), item('b')], {
      a: new Blob(['aaa']),
      b: new Blob(['bbb']),
    })
    const seen: { mediaId: string; index: number; total: number; fraction: number }[] = []

    await pushProjectMedia(
      'proj1',
      client,
      {
        onProgress: ({ mediaId, index, total, fraction }) =>
          seen.push({ mediaId, index, total, fraction }),
      },
      deps,
    )

    expect(seen).toEqual([
      { mediaId: 'a', index: 1, total: 2, fraction: 1 },
      { mediaId: 'b', index: 2, total: 2, fraction: 1 },
    ])
  })
})
