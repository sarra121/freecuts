/**
 * Deps adapter — shapes-konva consumers import media-library access from here
 * (satisfies `check:boundaries`). The raw cross-feature import lives in
 * `./media-library-contract` (satisfies `check:deps-contracts`).
 */
export { mediaLibraryService, useMediaLibraryStore } from './media-library-contract'
