/**
 * MatchView backend client — the single place the browser talks to our
 * coordinator service (chunked uploads, project sync, media catalog).
 *
 * Deliberately standalone: no React, no feature imports, none of FreeCut's
 * feature-boundary conventions. It is a pure network adapter built around an
 * injectable `fetch`, so it can be unit-tested with a fake and could be lifted
 * out of this app unchanged.
 *
 * Every request (except the backend's own /health, which we don't call here)
 * carries the shared demo secret in the `x-demo-secret` header. Auth is
 * deliberately deferred for the demo — this secret is NOT real security, and
 * because it ships in the browser bundle it is effectively public. It only
 * gates casual access until real accounts replace it.
 */

/* ───────────────────────────── Wire shapes ───────────────────────────────
 * These mirror exactly what the backend returns/accepts (see backend/src/*).
 * Kept here so the rest of the frontend gets types without importing backend
 * code.
 */

/** One presigned chunk URL handed back by POST /uploads. */
export interface UploadPart {
  partNumber: number
  url: string
}

/** Response of POST /uploads — everything needed to upload a file in chunks. */
export interface StartUploadResponse {
  videoId: string
  key: string
  uploadId: string
  partSize: number
  parts: UploadPart[]
}

/** One finished chunk, reported back to POST /uploads/complete. */
export interface UploadPartRef {
  partNumber: number
  etag: string
}

/** Lightweight project record returned by GET /projects. */
export interface ProjectMeta {
  id: string
  name: string
  updatedAt: number
}

/** Lightweight media record returned by GET /media. */
export interface MediaMeta {
  id: string
  fileName: string
  size: number
  contentType: string
  r2Key: string
  updatedAt: number
}

/* ───────────────────────────── Config ──────────────────────────────────── */

export interface BackendConfig {
  /** Base URL of the backend, e.g. `http://localhost:8787`. Trailing slashes ok. */
  baseUrl: string
  /** Shared demo secret, sent as `x-demo-secret` on every request. */
  secret: string
  /** Injectable fetch — defaults to the global one. Lets tests pass a fake. */
  fetchImpl?: typeof fetch
}

/* ───────────────────────────── Client ──────────────────────────────────── */

/**
 * Build a backend client bound to one config. Returns plain async methods —
 * one per backend endpoint. Construct it yourself in tests (with a fake fetch),
 * or use `getBackendClient()` below for the app's env-configured singleton.
 */
export function createBackendClient(config: BackendConfig) {
  // Drop any trailing slashes so `${baseUrl}${path}` never doubles up the `/`.
  const baseUrl = config.baseUrl.replace(/\/+$/, '')
  const doFetch = config.fetchImpl ?? fetch

  /**
   * The one HTTP primitive every method goes through. Adds the JSON + secret
   * headers, throws a descriptive Error on any non-2xx, and parses the JSON
   * body for the caller. `T` is the expected response shape.
   */
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await doFetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-demo-secret': config.secret,
        ...init?.headers,
      },
    })
    if (!res.ok) {
      // Pull the body for context, but never let that read mask the real error.
      const detail = await res.text().catch(() => '')
      throw new Error(`Backend ${init?.method ?? 'GET'} ${path} failed: ${res.status} ${detail}`)
    }
    return res.json() as Promise<T>
  }

  // Path-safe id: project/media ids are UUIDs today, but encode defensively so
  // an unexpected character can never break out of the URL path.
  const enc = (id: string): string => encodeURIComponent(id)

  return {
    /* ---- Uploads (big video bytes go straight to R2, not through us) ---- */

    /** Start a chunked upload; returns the upload id + a signed URL per chunk. */
    startUpload(input: { filename: string; contentType: string; size: number }) {
      return request<StartUploadResponse>('/uploads', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    /** Finalize a chunked upload once every part has been PUT to R2. */
    completeUpload(input: { key: string; uploadId: string; parts: UploadPartRef[] }) {
      return request<{ ok: true; key: string }>('/uploads/complete', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },

    /* ---- Projects (the small editable document) ---- */

    /** Push one project's JSON + its name/timestamp to the cloud. */
    putProject(id: string, input: { name: string; updatedAt: number; project: unknown }) {
      return request<{ ok: true; id: string }>(`/projects/${enc(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      })
    },

    /** List every project in the cloud (newest edit first). */
    listProjects() {
      return request<{ projects: ProjectMeta[] }>('/projects')
    },

    /** Pull one project's full JSON back. */
    getProject(id: string) {
      return request<{ id: string; project: unknown }>(`/projects/${enc(id)}`)
    },

    /* ---- Media (the heavy bytes' catalog + download links) ---- */

    /** Register/refresh a media record (the bytes themselves go via uploads). */
    putMedia(
      id: string,
      input: {
        fileName: string
        size: number
        contentType: string
        r2Key: string
        updatedAt: number
      },
    ) {
      return request<{ ok: true; id: string }>(`/media/${enc(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      })
    },

    /** List every media record in the cloud (newest change first). */
    listMedia() {
      return request<{ media: MediaMeta[] }>('/media')
    },

    /** Read one media record. */
    getMedia(id: string) {
      return request<{ media: MediaMeta }>(`/media/${enc(id)}`)
    },

    /** Get a short-lived signed URL to download this media's bytes from R2. */
    getMediaUrl(id: string) {
      return request<{ url: string }>(`/media/${enc(id)}/url`)
    },
  }
}

/** The shape of a built client — handy for typing function params elsewhere. */
export type BackendClient = ReturnType<typeof createBackendClient>

/* ───────────────────────────── Env singleton ───────────────────────────── */

let singleton: BackendClient | null = null

/**
 * Read the backend config from Vite env vars. Kept lazy (called on first use,
 * not at import) so a missing var can't crash app startup — it only fails the
 * moment cloud sync is actually used.
 *
 * Set these in a `.env.local` (gitignored):
 *   VITE_BACKEND_URL=http://localhost:8787
 *   VITE_DEMO_SECRET=<the same value as the backend's DEMO_SECRET>
 */
function readEnvConfig(): BackendConfig {
  const baseUrl = import.meta.env.VITE_BACKEND_URL as string | undefined
  const secret = import.meta.env.VITE_DEMO_SECRET as string | undefined
  if (!baseUrl || !secret) {
    throw new Error(
      'Cloud sync is not configured: set VITE_BACKEND_URL and VITE_DEMO_SECRET in .env.local',
    )
  }
  return { baseUrl, secret }
}

/** The app-wide client, built once from env on first use. */
export function getBackendClient(): BackendClient {
  if (!singleton) singleton = createBackendClient(readEnvConfig())
  return singleton
}
