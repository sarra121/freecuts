/**
 * The ONE place cloud-sync is allowed to reach into the media-library feature.
 *
 * The feature-boundary checks forbid cross-feature imports everywhere except a
 * `*-contract.ts` file inside this feature's `deps/`. Everything cloud-sync
 * needs from media-library is funnelled through here.
 */

export { mediaLibraryService } from '@/features/media-library'
