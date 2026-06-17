/**
 * Sports-themed brand backdrop: a stadium floodlight glow from the top and a
 * football pitch drawn in a gentle perspective. Shared by the landing page and
 * the workspace-gate splash.
 *
 * Pitch lines use `currentColor` (bound to `text-foreground`) so they stay
 * visible in both light and dark themes; the blue floodlight glow reads on both.
 * Render inside a `relative` container — this fills it as an absolute layer.
 */
export function PitchBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Stadium floodlight glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 55% 60% at 50% -8%, rgba(24, 69, 200, 0.5), transparent 72%)',
        }}
      />
      {/* Perspective pitch */}
      <svg
        className="absolute inset-0 h-full w-full text-foreground"
        viewBox="0 0 380 240"
        preserveAspectRatio="xMidYMax slice"
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          opacity={0.22}
        >
          {/* outline, halfway line, center circle */}
          <polygon points="20,238 360,238 285,76 95,76" />
          <line x1="61" y1="150" x2="319" y2="150" />
          <ellipse cx="190" cy="150" rx="36" ry="14" />
          {/* near goal: penalty box + goal box */}
          <polygon points="105,238 275,238 266,200 114,200" />
          <polygon points="145,238 235,238 233,221 147,221" />
          {/* far goal: penalty box + goal box */}
          <polygon points="143,76 238,76 244,106 136,106" />
          <polygon points="165,76 215,76 217,89 163,89" />
        </g>
      </svg>
    </div>
  )
}
