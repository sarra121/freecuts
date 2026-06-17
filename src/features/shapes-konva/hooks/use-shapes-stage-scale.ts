import { useMemo } from 'react'

export interface ShapesStageScale {
  scaleX: number
  scaleY: number
}

/**
 * Compute the Konva Stage's `scaleX` / `scaleY` so children draw in
 * project-pixel coordinates but render at display-pixel size.
 *
 * `Math.max(_, 1)` guards against division by zero in the brief window
 * before the project's dimensions are loaded.
 */
export function useShapesStageScale(
  displayWidth: number,
  displayHeight: number,
  projectWidth: number,
  projectHeight: number,
): ShapesStageScale {
  return useMemo(
    () => ({
      scaleX: displayWidth / Math.max(projectWidth, 1),
      scaleY: displayHeight / Math.max(projectHeight, 1),
    }),
    [displayWidth, displayHeight, projectWidth, projectHeight],
  )
}
