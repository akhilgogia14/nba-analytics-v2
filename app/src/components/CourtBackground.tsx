/**
 * A half basketball court drawn as faint lines behind the page, in the team's accent colour. The lines draw themselves in
 * when the page opens and again whenever the team changes (the caller sets key={team}); after that the whole drawing drifts
 * very slowly. It is decoration only: hidden from screen readers and from the mouse, and still (fully drawn) when the
 * visitor has asked for reduced motion.
 */
export function CourtBackground() {
  // Units are 20 per foot: a 50 x 47 foot half court, baseline at the top, the basket near it.
  const line = { fill: 'none', stroke: 'var(--accent)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-[0.11]"
      viewBox="0 0 1000 940"
      preserveAspectRatio="xMidYMid slice"
    >
      <g className="court-drift">
        <rect className="court-line" pathLength={1} x={2} y={2} width={996} height={936} {...line} />
        <rect className="court-line" pathLength={1} x={340} y={2} width={320} height={378} {...line} />
        <circle className="court-line" pathLength={1} cx={500} cy={380} r={120} {...line} />
        <path className="court-line" pathLength={1} d="M60 2 V242 A475 475 0 0 0 940 242 V2" {...line} />
        <path className="court-line" pathLength={1} d="M420 63 A80 80 0 0 0 580 63 M470 40 H530" {...line} />
        <circle className="court-line" pathLength={1} cx={500} cy={63} r={9} {...line} />
        <path className="court-line" pathLength={1} d="M380 938 A120 120 0 0 1 620 938" {...line} />
      </g>
    </svg>
  )
}
