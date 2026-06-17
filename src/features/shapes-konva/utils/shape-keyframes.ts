import type { ShapeItem, ShapeKeyframe } from '@/types/timeline'

/** True for a mergeable plain object (not null, not an array). */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Deep-merge `patch` onto `target`, returning a new object. Plain objects
 * recurse (so `{transform:{x}}` keeps the other transform fields); arrays and
 * primitives REPLACE wholesale (so `freePolygonData.vertices` swaps atomically).
 */
export function deepMergePatch<T extends Record<string, unknown>>(
  target: T,
  patch: Partial<T>,
): T {
  const out: Record<string, unknown> = { ...target }
  for (const key of Object.keys(patch)) {
    const pv = (patch as Record<string, unknown>)[key]
    const tv = out[key]
    out[key] = isPlainObject(pv) && isPlainObject(tv) ? deepMergePatch(tv, pv) : pv
  }
  return out as T
}

/**
 * Effective shape at a clip-relative frame: fold every keyframe with
 * `kf.frame <= frame` onto the base item. Step playback. Returns the SAME
 * reference when nothing applies, so memoised consumers don't re-render.
 */
export function resolveShapeAtFrame(item: ShapeItem, frame: number): ShapeItem {
  const kfs = item.keyframes
  if (!kfs || kfs.length === 0) return item
  let merged: ShapeItem | null = null
  for (const kf of kfs) {
    if (kf.frame > frame) break // kept sorted by mergeKeyframe
    merged = deepMergePatch(
      (merged ?? item) as unknown as Record<string, unknown>,
      kf.patch as Record<string, unknown>,
    ) as unknown as ShapeItem
  }
  return merged ?? item
}

/**
 * Append/merge a keyframe at `frame`, returning a new sorted array.
 *  - First change at frame > 0 → also record a frame-0 baseline capturing the
 *    pre-change values of exactly the keys in `patch` (so scrubbing before the
 *    first keyframe shows the original, not the just-edited, value).
 *  - A keyframe already at `frame` → deep-merge the patch into it (so multiple
 *    edits at one playhead collapse to one mark).
 */
export function mergeKeyframe(
  existing: ShapeKeyframe[] | undefined,
  frame: number,
  patch: Partial<ShapeItem>,
  baseline: ShapeItem,
): ShapeKeyframe[] {
  const list: ShapeKeyframe[] = existing
    ? existing.map((k) => ({ frame: k.frame, patch: { ...k.patch } }))
    : []

  if (list.length === 0 && frame > 0) {
    const basePatch: Partial<ShapeItem> = {}
    for (const key of Object.keys(patch) as (keyof ShapeItem)[]) {
      // Snapshot the whole pre-change value for this key (objects included).
      ;(basePatch as Record<string, unknown>)[key as string] = baseline[key]
    }
    list.push({ frame: 0, patch: basePatch })
  }

  const at = list.find((k) => k.frame === frame)
  if (at) {
    at.patch = deepMergePatch(
      at.patch as Record<string, unknown>,
      patch as Record<string, unknown>,
    ) as Partial<ShapeItem>
  } else {
    list.push({ frame, patch: { ...patch } })
  }
  list.sort((a, b) => a.frame - b.frame)
  return list
}
