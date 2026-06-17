import { useEffect, useState } from 'react'
import { computeSpinDashOffset } from '../utils/field-ring-geometry'

/**
 * Returns a live, continuously-advancing dash offset for a spinning ring.
 *
 * Driven by a requestAnimationFrame ticker (real time) rather than the
 * timeline frame, so the ring visibly spins in the editor preview even while
 * playback is paused — toggling spin on shows motion immediately. Returns 0
 * (and runs no ticker) when spin is off.
 *
 * NOTE: this is the editor-preview animation. A future export renderer must
 * compute the offset per output frame instead (see computeSpinDashOffset,
 * which stays the deterministic, frame-locked version used by tests/export).
 */
export function useFieldRingSpin(enabled: boolean, spinSpeed: number, perimeter: number): number {
  const [nowMs, setNowMs] = useState(0)

  useEffect(() => {
    if (!enabled || spinSpeed === 0 || perimeter <= 0) return
    let raf = 0
    const loop = () => {
      setNowMs(performance.now())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [enabled, spinSpeed, perimeter])

  if (!enabled || perimeter <= 0) return 0
  // Reuse the deterministic formula, treating elapsed real seconds as the
  // time base: pass a synthetic frame so fps cancels out (frame/fps = seconds).
  const elapsedSec = nowMs / 1000
  return computeSpinDashOffset(elapsedSec, 0, 1, spinSpeed, perimeter)
}
