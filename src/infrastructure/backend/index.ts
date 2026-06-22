/**
 * Backend adapter barrel — the public surface for talking to the MatchView
 * coordinator service. Import from `@/infrastructure/backend`, never from the
 * file directly, so the internal layout can change freely.
 */

export {
  createBackendClient,
  getBackendClient,
  type BackendClient,
  type BackendConfig,
  type StartUploadResponse,
  type UploadPart,
  type UploadPartRef,
  type ProjectMeta,
  type MediaMeta,
} from './backend-client'
