import { describe, it, expect } from 'vitest'
import { createBackendClient } from './backend-client'

/**
 * A fake `fetch` that records the last call and returns a canned JSON response.
 * Because the client takes `fetchImpl` as config, we can test every method
 * without a network or a running backend.
 */
function makeFetch(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit | undefined }[] = []
  const fake = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof fetch
  return { fake, calls }
}

const cfg = (fetchImpl: typeof fetch) => ({
  baseUrl: 'http://localhost:8787',
  secret: 'test-secret',
  fetchImpl,
})

/** Read a header off the recorded RequestInit regardless of how it was set. */
function header(init: RequestInit | undefined, name: string): string | undefined {
  const h = init?.headers as Record<string, string> | undefined
  return h?.[name]
}

describe('backend client', () => {
  it('POSTs startUpload to /uploads and returns the parsed body', async () => {
    const { fake, calls } = makeFetch({ videoId: 'v1', key: 'videos/v1/source.mp4', uploadId: 'u1', partSize: 5, parts: [] })
    const client = createBackendClient(cfg(fake))

    const res = await client.startUpload({ filename: 'm.mp4', contentType: 'video/mp4', size: 10 })

    expect(calls[0]?.url).toBe('http://localhost:8787/uploads')
    expect(calls[0]?.init?.method).toBe('POST')
    expect(res.videoId).toBe('v1')
  })

  it('attaches the content-type and x-demo-secret headers on every call', async () => {
    const { fake, calls } = makeFetch({ projects: [] })
    const client = createBackendClient(cfg(fake))

    await client.listProjects()

    expect(header(calls[0]?.init, 'content-type')).toBe('application/json')
    expect(header(calls[0]?.init, 'x-demo-secret')).toBe('test-secret')
  })

  it('strips a trailing slash from baseUrl so paths never double up', async () => {
    const { fake, calls } = makeFetch({ media: [] })
    const client = createBackendClient({ baseUrl: 'http://localhost:8787/', secret: 's', fetchImpl: fake })

    await client.listMedia()

    expect(calls[0]?.url).toBe('http://localhost:8787/media')
  })

  it('builds the media download URL path and encodes the id', async () => {
    const { fake, calls } = makeFetch({ url: 'https://r2.example/x' })
    const client = createBackendClient(cfg(fake))

    const res = await client.getMediaUrl('a b/c')

    expect(calls[0]?.url).toBe('http://localhost:8787/media/a%20b%2Fc/url')
    expect(res.url).toBe('https://r2.example/x')
  })

  it('throws a descriptive error on a non-2xx response', async () => {
    const { fake } = makeFetch({ error: 'nope' }, 401)
    const client = createBackendClient(cfg(fake))

    await expect(client.listProjects()).rejects.toThrow(/401/)
  })
})
