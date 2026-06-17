/**
 * Pure time math + formatting for the timer shape. Dependency-free so the
 * Konva renderer and a future export mirror share identical output, and so the
 * logic is unit-testable without Konva.
 */

export type TimerMode = 'up' | 'down'
export type TimerFormat = 'hh:mm:ss' | 'mm:ss' | 'mm:ss:cc' | 'ss:cc' | 'ss'

/**
 * The timer's value in seconds at a given elapsed time.
 *  - 'up'   → offsetSec + elapsed (match clock counting up from a real time)
 *  - 'down' → max(0, durationSec - elapsed) (drill countdown to zero)
 * Negative elapsed (playhead before the clip) is clamped to 0.
 */
export function timerValueSeconds(
  mode: TimerMode,
  offsetSec: number,
  durationSec: number,
  elapsedSec: number,
): number {
  const elapsed = Math.max(0, elapsedSec)
  if (mode === 'down') return Math.max(0, durationSec - elapsed)
  return offsetSec + elapsed
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

/**
 * Format a value in seconds to the requested clock string. `mm` uses TOTAL
 * minutes (so a match clock reads `90:00`, not `1:30:00`); only `hh:mm:ss`
 * rolls minutes into hours. `cc` is centiseconds.
 */
export function formatTimer(valueSeconds: number, format: TimerFormat): string {
  const totalCS = Math.max(0, Math.round(valueSeconds * 100))
  const cc = totalCS % 100
  const totalSec = Math.floor(totalCS / 100)
  const sec = totalSec % 60
  const totalMin = Math.floor(totalSec / 60)
  const min = totalMin % 60
  const hours = Math.floor(totalMin / 60)

  switch (format) {
    case 'hh:mm:ss':
      return `${pad2(hours)}:${pad2(min)}:${pad2(sec)}`
    case 'mm:ss:cc':
      return `${pad2(totalMin)}:${pad2(sec)}:${pad2(cc)}`
    case 'ss:cc':
      return `${pad2(totalSec)}:${pad2(cc)}`
    case 'mm:ss':
      return `${pad2(totalMin)}:${pad2(sec)}`
    case 'ss':
      return `${pad2(totalSec)}`
    default:
      return `${pad2(totalMin)}:${pad2(sec)}`
  }
}
