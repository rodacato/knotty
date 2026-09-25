// Reference drawings for each capture angle: how the furniture should look in the photo.

const stroke = 'fill-none stroke-current [stroke-width:1.6] [stroke-linejoin:round] [stroke-linecap:round]'

const DRAWINGS: Record<string, React.ReactNode> = {
  front: (
    <>
      <rect className={stroke} x="16" y="8" width="32" height="60" />
      <path className={stroke} d="M16 23h32M16 38h32M16 53h32" />
      <path className={`${stroke} opacity-50`} d="M8 72h48" />
    </>
  ),
  'three-quarter': (
    <>
      <path className={stroke} d="M14 16l22-8 16 6v52l-16 6-22-8z" />
      <path className={stroke} d="M36 8v64M14 16l22 6 16-8M36 22v50" />
      <path className={`${stroke} opacity-60`} d="M14 34l22 6M14 52l22 6" />
    </>
  ),
  side: (
    <>
      <rect className={stroke} x="24" y="8" width="16" height="60" />
      <path className={`${stroke} opacity-50`} d="M8 72h48M24 4h16" />
      <path className={`${stroke} opacity-60`} d="M20 4v4M44 4v4" />
    </>
  ),
  inside: (
    <>
      <rect className={stroke} x="14" y="8" width="36" height="60" />
      <path className={`${stroke} opacity-40`} d="M18 12l6 6M18 24l12 12M26 12l18 18M38 12l8 8M18 44l18 18M30 44l16 16" />
      <path className={stroke} d="M14 28h36M14 48h36" />
    </>
  ),
  joints: (
    <>
      <path className={stroke} d="M14 14h14v44H14zM28 44h26v14H28z" />
      <circle className={stroke} cx="21" cy="51" r="2.5" />
      <path className={`${stroke} opacity-60`} d="M36 10a14 14 0 1 1 0 28a14 14 0 1 1 0-28zM46 34l10 10" />
    </>
  ),
}

export function Silhouette({ angle }: { angle: string }) {
  return (
    <svg viewBox="0 0 64 80" className="h-14 w-12 text-grafito-2" aria-hidden>
      {DRAWINGS[angle]}
    </svg>
  )
}
