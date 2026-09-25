// The Knotty brand: a wood knot as the emblem and as the «o» of the logo.

/** The knot alone, for the «o» of the logo or as an ornament; it inherits the text size. */
export function Knot({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <g fill="none" transform="rotate(-8 32 34)">
        <ellipse cx="32" cy="34" rx="27" ry="19" stroke="#7A5230" strokeWidth="5" />
        <ellipse cx="32" cy="34" rx="16" ry="10.5" stroke="#5A3A20" strokeWidth="5" />
      </g>
      <ellipse cx="32" cy="34" rx="7.5" ry="4.2" transform="rotate(-8 32 34)" fill="#4A2F1A" />
    </svg>
  )
}

/** «Knotty» with the knot in place of the «o». */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline font-display font-semibold tracking-tight [font-variation-settings:'opsz'_144] ${className}`} aria-label="Knotty" role="img">
      <span aria-hidden>Kn</span>
      <Knot className="mx-[0.015em] inline-block size-[0.56em] translate-y-[0.03em] dark:brightness-150" />
      <span aria-hidden>tty</span>
    </span>
  )
}

/** The app's emblem: pine wood with the knot. */
export function Emblem({ className = '' }: { className?: string }) {
  return <img src="./icon-192.png" alt="" className={`rounded-[22%] ${className}`} />
}
