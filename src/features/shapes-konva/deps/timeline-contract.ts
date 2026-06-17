/**
 * Cross-feature import seam (contract) for shapes-konva -> timeline.
 *
 * Per `check:deps-contracts`, the raw `@/features/timeline/*` import lives here;
 * the sibling `timeline.ts` adapter re-exports from this file.
 */
export { useTimelineStore } from '@/features/timeline/stores/timeline-store-facade'
