// The Knotty brand: a wood knot, alone or on the pine of the emblem.

/** The knot alone, as an ornament; its size comes from the class. */
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

/** The app's emblem: pine wood with the knot. */
export function Emblem({ className = '' }: { className?: string }) {
  return <img src="./icon-192.png" alt="" className={`rounded-[22%] ${className}`} />
}
