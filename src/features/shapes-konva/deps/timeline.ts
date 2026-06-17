/**
 * Deps adapter — shapes-konva consumers import the timeline store/types from
 * here (satisfies `check:boundaries`). The raw cross-feature import lives in
 * `./timeline-contract` (satisfies `check:deps-contracts`); `@/types/*` is not a
 * feature import, so the type re-export can stay inline.
 */
export { useTimelineStore } from './timeline-contract'
export type { TimelineItem, ShapeItem } from '@/types/timeline'
