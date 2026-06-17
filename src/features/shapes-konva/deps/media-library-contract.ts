/**
 * Cross-feature import seam (contract) for shapes-konva -> media-library.
 *
 * Per `check:deps-contracts`, the raw `@/features/media-library/*` imports live
 * here; the sibling `media-library.ts` adapter re-exports from this file. Used
 * by the image-overlay shape to import the picked file and resolve a stored
 * media id back to a blob for rendering.
 */
export { mediaLibraryService } from '@/features/media-library/services/media-library-service'
export { useMediaLibraryStore } from '@/features/media-library/stores/media-library-store'
