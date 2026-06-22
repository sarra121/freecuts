# MatchView Cloud Backend + AI Pipeline — Design (Demo Edition)

**Date:** 2026-06-17
**Status:** Design — pending review
**Scope:** An *exclusive demo* of cloud-backed video analysis. Auth is deliberately deferred (shared-secret gate). One environment only (`localhost` + free hosting tiers). Full cross-device workspace sync is a later phase, not this one.

---

## 1. What we're building (in one breath)

A user opens the MatchView editor, uploads a long match video, and **watches computer-vision results — boxes around players and the ball — stream in live as the footage is analyzed**, instead of waiting for the whole thing to finish. The heavy lifting happens on a GPU server; the video itself never passes through our own backend.

The emphasis of this demo is the **AI server** and the **backend that glues everything together**.

---

## 2. Why this shape (the decisions already made)

These were settled through discussion and are **not** up for re-litigation here:

- **Storage = Cloudflare R2.** Zero egress fees, so the AI server can pull footage for free. Holds raw uploads.
- **AI = a GPU server on Azure.** Cloudflare has no GPUs; computer vision needs them. The AI server pulls video straight from R2.
- **Backend = a normal containerized Node server (not a Worker).** The decider: results stream over **one long-lived, mostly-idle connection for the length of an hour of analysis**. That's the natural home of an always-on server, not a burst-billed Worker. Bonus: we use the standard S3 SDK and standard Postgres tooling.
- **Database = Postgres (Neon free tier).** Standard, portable, scales to zero when idle.
- **Backend host = Render or Railway** (git push → live public URL). The public URL also lets the Azure AI server call back without tunnels. *Not* Cloudflare Containers (extra Docker/registry friction).
- **Gate = one shared secret**, sent as a header, checked by both backend and AI server. Swapped for real accounts later with no other rework.

> **Honest caveat carried forward:** Workers *can* technically stream SSE and presign uploads — we chose the container for *comfort, standard tooling, and the long-lived-connection fit*, not because Workers are incapable.

---

## 3. The four components

### 3.1 Frontend — the existing MatchView editor (runs locally for the demo)
New responsibilities only:
- Ask the backend for upload URLs, then **upload the video in chunks directly to R2** (never through the backend).
- Kick off an analysis job.
- Open a **live results stream (SSE)** and **draw detection boxes over the video preview** as chunks arrive.
- Send the shared secret on every backend call.

### 3.2 Backend container — Node + Hono
The "traffic cop." Holds no video. Responsibilities:
- **Gate:** reject any request without the correct `X-Demo-Secret` header.
- **Uploads:** start an R2 multipart upload, hand back presigned part URLs, finalize on completion.
- **Analysis:** create a job, tell the Azure AI server "analyze video XYZ" (hand it a presigned *download* URL for the footage).
- **Streaming relay:** receive result chunks from the AI server and push them down the SSE pipe to the browser.
- **Persistence:** record videos, jobs, and results in Postgres.

### 3.3 Object storage — Cloudflare R2
- One bucket: `matchview-media-dev`.
- Receives chunked uploads directly from the browser.
- Serves the footage to the AI server via short-lived presigned GET URLs.

### 3.4 Azure AI server — GPU, computer vision
- Python (Ultralytics YOLO family — strong, pretrained player/ball detection out of the box).
- Given a presigned R2 URL, pulls the video, decodes frames (sampled — e.g. every Nth frame — to stay near real-time), runs detection.
- Emits results **as a stream of chunks** back to the backend (HTTP POST per chunk), so the user sees progress instead of a final dump.
- Checks the same shared secret.

---

## 4. Data flow (the whole trip)

```
1. UPLOAD
   Browser → Backend:  "I have a 5 GB video"  (POST /uploads)
   Backend → R2:       start multipart, get N presigned part URLs
   Backend → Browser:  uploadId + part URLs
   Browser → R2:       upload chunks DIRECTLY (backend not involved)
   Browser → Backend:  "done"  (POST /uploads/:id/complete)
   Backend → R2:       finalize multipart

2. ANALYZE
   Browser → Backend:  "analyze video XYZ"  (POST /analyze)
   Backend → R2:       mint a presigned GET URL for the footage
   Backend → Azure:    "analyze this URL, here's the job id"
   Backend → Browser:  jobId

3. STREAM RESULTS
   Browser → Backend:  open SSE  (GET /jobs/:id/stream)
   Azure  → R2:        pull footage (free egress), analyze frame-by-frame
   Azure  → Backend:   POST result chunk  (repeated, as detections are produced)
   Backend → Browser:  forward each chunk down the SSE pipe
   Browser:            draw boxes over the preview in real time
```

> **One deferred detail:** who physically holds the result pipe — the backend relays (default, shown above) **or** Azure streams SSE straight to the browser. Default to backend-relay for the demo; both work with a container. Decide at build time.

---

## 5. The CV output (what a result chunk contains)

Player + ball detection. Each chunk covers a sampled moment of video:

```jsonc
{
  "jobId": "…",
  "tMs": 12480,                 // timestamp in the video, milliseconds
  "detections": [
    { "cls": "player", "conf": 0.91, "box": { "x": 0.42, "y": 0.30, "w": 0.05, "h": 0.12 } },
    { "cls": "ball",   "conf": 0.78, "box": { "x": 0.55, "y": 0.61, "w": 0.01, "h": 0.02 } }
  ]
}
```

- Boxes are **normalized 0–1** (fractions of width/height) so they map onto any preview size without rescaling math.
- `cls` is `player` or `ball` for the demo. Tracking, heatmaps, and event detection are **explicitly later phases** that sit on top of this.

---

## 6. Data model (Postgres — demo-minimal)

| Table | Columns (essentials) | Purpose |
|---|---|---|
| `videos` | `id`, `filename`, `r2_key`, `status`, `created_at` | one row per uploaded file |
| `jobs` | `id`, `video_id`, `status`, `created_at`, `finished_at` | one analysis run |
| `detections` | `id`, `job_id`, `t_ms`, `payload` (jsonb) | result chunks, stored as they stream in |

`status` enums kept tiny: video `uploading|ready`; job `queued|running|done|failed`.

---

## 7. Backend API surface (demo)

| Method + path | Does |
|---|---|
| `GET /health` | liveness check |
| `POST /uploads` | create video row, start R2 multipart, return part URLs |
| `POST /uploads/:id/complete` | finalize multipart, mark video `ready` |
| `POST /analyze` | create job, presign GET, tell Azure to start |
| `POST /jobs/:id/results` | **AI→backend** ingest a result chunk (secret-gated) |
| `GET /jobs/:id/stream` | **browser** SSE subscription; forwards chunks |

Every route except `/health` requires the `X-Demo-Secret` header.

---

## 8. Out of scope for this demo (deliberately)

- Real authentication / user accounts (shared secret stands in).
- Full cross-device **workspace sync** (the original journey — a later phase; the `videos`/`jobs` tables are the seed of it).
- Staging/production environments, edge router, custom domains.
- Server-side transcoding.
- Tracking, heatmaps, event detection, auto-segmentation (phase 2, built on detection).

---

## 9. Build order (independently verifiable slices)

Each slice is something we can run and *see work* before moving on.

1. **Backend skeleton** — Hono server, `/health`, secret gate, Postgres connection. *Verify: health returns ok; wrong secret is rejected.*
2. **R2 multipart upload** — presign + complete; a real file uploaded from a test page lands in the bucket. *Verify: file appears in R2.*
3. **Azure AI CV server (standalone)** — hand it a presigned URL, it runs YOLO and prints detections for a sample clip. *Verify: detections on a known clip.*
4. **Orchestration + SSE** — backend starts the AI job, AI POSTs chunks, backend streams them to a bare test page. *Verify: chunks appear live.*
5. **Frontend integration** — upload from the editor, draw boxes over the preview as they stream. *Verify: boxes track the action.*

---

## 10. Testing approach

- **Backend:** unit-test the secret gate and the presign/complete logic (mock the S3 SDK); a manual smoke test for SSE.
- **AI server:** run against a checked-in short sample clip; assert it emits well-formed chunks.
- **End-to-end:** manual — upload → analyze → watch boxes — since the payoff is visual and real-time.

---

## 11. Open questions to resolve during planning

1. **SSE pipe owner:** backend-relay (default) vs Azure-direct-to-browser.
2. **Frame sampling rate** on the AI server (every Nth frame / target FPS) to balance "real-time feel" vs accuracy.
3. **Exact YOLO model/weights** (generic COCO has `person` + `sports ball`; a sports-tuned model is better but heavier).
4. **Where the demo's shared secret lives** on the frontend (build-time env var vs a tiny "enter access code" box).
