import type { ReactNode } from 'react'
import { JointDiagram } from './JointDiagram'

// A small drawing per option of a choice, by the field's key (UI-39): a field listed here shows its options as cards.

const WOOD = 'fill-kraft-2 stroke-graphite-2'
const METAL = 'fill-none stroke-graphite'

const draw = (children: ReactNode) => (
  <svg viewBox="0 0 80 60" aria-hidden className="w-full">
    {children}
  </svg>
)
const floor = <line x1="4" y1="54.5" x2="76" y2="54.5" className="stroke-graphite-2" strokeDasharray="2 2" />

/** A cabinet from the front, down to `bottom`, with what stands under it. */
const cabinet = (bottom: number, under?: ReactNode) =>
  draw(
    <>
      {under}
      <rect x="16" y="6" width="48" height={bottom - 6} className={WOOD} />
      <line x1="40" y1="6" x2="40" y2={bottom} className="stroke-graphite-2" />
      {floor}
    </>,
  )

/** Two legs under a box, each from its top to the floor. */
const legs = (left: string, right: string) =>
  draw(
    <>
      <rect x="10" y="6" width="60" height="14" className={WOOD} />
      <polygon points={left} className={WOOD} />
      <polygon points={right} className={WOOD} />
      {floor}
    </>,
  )

/** A shelf between two sides, cut through. */
const shelf = (held: ReactNode) =>
  draw(
    <>
      <rect x="10" y="4" width="10" height="52" className={WOOD} />
      <rect x="60" y="4" width="10" height="52" className={WOOD} />
      <rect x="20" y="26" width="40" height="8" className={WOOD} />
      {held}
    </>,
  )
const PIN_HOLES = [12, 19, 41, 48].flatMap((y) => [17, 63].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" className="fill-graphite-2" />))

export const OPTION_DIAGRAMS: Record<string, Record<string, ReactNode>> = {
  assembly: {
    glued: <JointDiagram joint="butt-screw" className="w-full" />,
    bolts: <JointDiagram joint="connector-bolt" className="w-full" />,
    cams: <JointDiagram joint="cam-lock" className="w-full" />,
  },
  base: {
    kick: cabinet(46, <rect x="20" y="46" width="40" height="8" className="fill-graphite-2/50 stroke-graphite-2" />),
    floor: cabinet(54),
    legs: cabinet(
      40,
      <>
        <rect x="19" y="40" width="5" height="14" className={WOOD} />
        <rect x="56" y="40" width="5" height="14" className={WOOD} />
      </>,
    ),
  },
  legStyle: {
    straight: legs('18,20 28,20 28,54 18,54', '52,20 62,20 62,54 52,54'),
    tapered: legs('18,20 28,20 23,54 18,54', '52,20 62,20 62,54 57,54'),
    splayed: legs('18,20 28,20 19,54 14,54', '52,20 62,20 66,54 61,54'),
  },
  'construction.shelves': {
    movable: shelf(
      <>
        {PIN_HOLES}
        <line x1="14" y1="35.5" x2="25" y2="35.5" className={METAL} strokeWidth="2" strokeLinecap="round" />
        <line x1="55" y1="35.5" x2="66" y2="35.5" className={METAL} strokeWidth="2" strokeLinecap="round" />
      </>,
    ),
    fixed: shelf(
      <>
        <path d="M10 27 L10 33 L13 30 Z M70 27 L70 33 L67 30 Z" className="fill-graphite" />
        <line x1="13" y1="30" x2="30" y2="30" className={METAL} strokeWidth="1.5" />
        <line x1="67" y1="30" x2="50" y2="30" className={METAL} strokeWidth="1.5" />
      </>,
    ),
  },
}
