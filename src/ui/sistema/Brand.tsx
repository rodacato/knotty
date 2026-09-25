// La marca Knotty: un nudo de madera como símbolo y como la «o» del logotipo.

/** El nudo solo, para la «o» del logotipo o como adorno; hereda el tamaño del texto. */
export function Nudo({ className = '' }: { className?: string }) {
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

/** «Knotty» con el nudo en lugar de la «o». */
export function Logotipo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline font-titulo font-semibold tracking-tight [font-variation-settings:'opsz'_144] ${className}`} aria-label="Knotty" role="img">
      <span aria-hidden>Kn</span>
      <Nudo className="mx-[0.015em] inline-block size-[0.56em] translate-y-[0.03em] dark:brightness-150" />
      <span aria-hidden>tty</span>
    </span>
  )
}

/** El símbolo de la app: madera de pino con el nudo. */
export function Simbolo({ className = '' }: { className?: string }) {
  return <img src="./icono-192.png" alt="" className={`rounded-[22%] ${className}`} />
}
