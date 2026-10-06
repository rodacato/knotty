import type { ReactNode } from 'react'
import type { GuideJoint } from '../../domain/design/jointGuide'

// Each joint as a cut through the corner: a board on its side (right) and the one that meets its face (left), with what holds them.

const WOOD = 'fill-kraft-2 stroke-graphite-2'
const METAL = 'fill-none stroke-graphite'
const SOLID = 'fill-graphite'

const side = <rect x="52" y="4" width="12" height="52" className={WOOD} />
const shelf = <rect x="6" y="24" width="46" height="12" className={WOOD} />
const corner = (
  <>
    {side}
    {shelf}
  </>
)
const thread = (from: number, to: number) =>
  Array.from({ length: Math.floor((from - to) / 4) }, (_, i) => <line key={i} x1={from - 2 - i * 4} y1="28" x2={from - 4 - i * 4} y2="32" className={METAL} strokeWidth="1" />)

const DRAWINGS: Record<GuideJoint, ReactNode> = {
  'butt-screw': (
    <>
      {corner}
      <path d="M64 26 L64 34 L60 30 Z" className={SOLID} />
      <line x1="60" y1="30" x2="34" y2="30" className={METAL} strokeWidth="1.5" />
      {thread(52, 34)}
    </>
  ),
  'pocket-screw': (
    <>
      {corner}
      <path d="M28 36 L40 36 L44 32 Z" className="fill-bone stroke-graphite-2" />
      <line x1="38" y1="35" x2="60" y2="27" className={METAL} strokeWidth="1.5" />
      <circle cx="37" cy="35.4" r="2" className={SOLID} />
    </>
  ),
  dowel: (
    <>
      {corner}
      <rect x="40" y="27.5" width="19" height="5" rx="1.5" className="fill-pine stroke-graphite" />
    </>
  ),
  'plugged-dowel': (
    <>
      {corner}
      <rect x="38" y="27.5" width="26" height="5" rx="1.5" className="fill-pine stroke-graphite" />
      <rect x="60" y="27.5" width="4" height="5" className="fill-walnut" />
    </>
  ),
  confirmat: (
    <>
      {corner}
      <path d="M64 26 L64 34 L61 32 L52 32 L52 28 L61 28 Z" className={SOLID} />
      <line x1="52" y1="30" x2="32" y2="30" className={METAL} strokeWidth="2.5" />
      {thread(52, 32)}
    </>
  ),
  'cam-lock': (
    <>
      {corner}
      <line x1="58" y1="30" x2="38" y2="30" className={METAL} strokeWidth="1.5" />
      <circle cx="42" cy="30" r="1.6" className={SOLID} />
      <circle cx="36" cy="30" r="5" className="fill-bone stroke-graphite" strokeWidth="1.5" />
      <path d="M33 30 H39 M36 27 V33" className={METAL} strokeWidth="1" />
    </>
  ),
  'connector-bolt': (
    <>
      {corner}
      <rect x="64" y="24" width="4" height="12" rx="1" className={SOLID} />
      <line x1="64" y1="30" x2="34" y2="30" className={METAL} strokeWidth="1.5" />
      <circle cx="34" cy="30" r="4" className="fill-bone stroke-graphite" strokeWidth="1.5" />
      <line x1="34" y1="27.5" x2="34" y2="32.5" className={METAL} strokeWidth="1" />
    </>
  ),
  'glue-nail': (
    <>
      <rect x="52" y="4" width="5" height="52" className={WOOD} />
      {shelf}
      <line x1="57" y1="27" x2="42" y2="27" className={METAL} strokeWidth="1" />
      <line x1="57" y1="33" x2="42" y2="33" className={METAL} strokeWidth="1" />
    </>
  ),
  bracket: (
    <>
      {corner}
      <path d="M38 37.5 H50.5 V50" className={METAL} strokeWidth="2.5" strokeLinejoin="round" />
      <line x1="43" y1="38" x2="43" y2="31" className={METAL} strokeWidth="1" />
      <line x1="50" y1="45" x2="57" y2="45" className={METAL} strokeWidth="1" />
    </>
  ),
  dado: (
    <>
      {side}
      <rect x="6" y="24" width="52" height="12" className={WOOD} />
    </>
  ),
  rabbet: (
    <>
      <path d="M52 22 H58 V10 H64 V56 H52 Z" className={WOOD} />
      <rect x="6" y="10" width="52" height="12" className={WOOD} />
    </>
  ),
  finger: (
    <>
      <rect x="10" y="6" width="42" height="48" className={WOOD} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x="52" y={6 + i * 8} width="12" height="8" className={i % 2 ? 'fill-kraft-2' : 'fill-pine stroke-graphite-2'} />
      ))}
      <rect x="52" y="6" width="12" height="48" className="fill-none stroke-graphite-2" />
    </>
  ),
}

/** Decorative: the joint's name and definition sit beside it. */
export function JointDiagram({ joint, className = '' }: { joint: GuideJoint; className?: string }) {
  return (
    <svg viewBox="0 0 80 60" aria-hidden className={className}>
      {DRAWINGS[joint]}
    </svg>
  )
}
