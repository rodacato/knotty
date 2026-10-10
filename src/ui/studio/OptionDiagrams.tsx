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

const HOLLOW = 'fill-bone stroke-graphite-2'
const LINE = 'stroke-graphite-2'

/** One opening of a cabinet from the front, with what it holds. */
const opening = (inside: ReactNode, frame = HOLLOW) =>
  draw(
    <>
      <rect x="18" y="6" width="44" height="48" className={frame} />
      {inside}
    </>,
  )
/** An opening with nothing in front: its back and its sides are seen, so it does not read as a front. */
const hollow = (inside: ReactNode) =>
  opening(
    <>
      <rect x="26" y="13" width="28" height="34" className="fill-kraft-2/40 stroke-graphite-2" />
      <path d="M18 6 L26 13 M62 6 L54 13 M18 54 L26 47 M62 54 L54 47" className={LINE} />
      {inside}
    </>,
  )
const shelfIn = (y: number) => <polygon points={`18,${y + 4} 62,${y + 4} 54,${y} 26,${y}`} className={WOOD} />
/** A table from a corner: its top over what holds it, drawn first so the top covers it. */
const table = (under: ReactNode) =>
  draw(
    <>
      {under}
      <polygon points="6,20 48,10 74,18 32,28" className={WOOD} />
      <polygon points="6,20 32,28 32,31 6,23" className={WOOD} />
      <polygon points="32,28 74,18 74,21 32,31" className={WOOD} />
    </>,
  )
const leg = (x: number, y: number) => <rect key={`${x}-${y}`} x={x} y={y} width="3.5" height="26" className={WOOD} />
const knob = (x: number, y: number) => <circle cx={x} cy={y} r="1.6" className="fill-graphite" />
const bar = (x: number, y: number) => <line x1={x - 5} y1={y} x2={x + 5} y2={y} className={METAL} strokeWidth="2" strokeLinecap="round" />
/** A front that covers its opening's frame, or sits inside it. */
const front = (inset: boolean, split: 'door' | 'drawers') => {
  const [x, y, w, h] = inset ? [22, 10, 36, 40] : [18, 6, 44, 48]
  return opening(
    <>
      <rect x={x} y={y} width={w} height={h} className={WOOD} />
      {split === 'drawers' ? <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} className={LINE} /> : knob(x + w - 5, y + h / 2)}
    </>,
    inset ? WOOD : HOLLOW,
  )
}
/** A drawer front, alone, with what opens it. */
const pulled = (pull: ReactNode) =>
  draw(
    <>
      <rect x="12" y="18" width="56" height="26" className={WOOD} />
      {pull}
    </>,
  )
/** Four legs from above, with what joins them low. */
const fromAbove = (joined: ReactNode) =>
  draw(
    <>
      <rect x="10" y="10" width="60" height="40" className="fill-none stroke-graphite-2" strokeDasharray="2 2" />
      {joined}
      {[14, 60].flatMap((x) => [14, 40].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="6" height="6" className={WOOD} />))}
    </>,
  )
/** A bed from its side, the head to the left, with what stands at its head. */
const bed = (head: ReactNode) =>
  draw(
    <>
      {head}
      <rect x="14" y="38" width="58" height="10" className={WOOD} />
      <rect x="16" y="32" width="54" height="6" rx="2" className={HOLLOW} />
      {floor}
    </>,
  )
const GROOVES = [26, 34, 42, 50].map((x) => <line key={x} x1={x} y1="8" x2={x} y2="52" className={LINE} />)

const PULLS = {
  none: pulled(null),
  notch: pulled(<path d="M34 18 a6 6 0 0 0 12 0" className={HOLLOW} />),
  handle: pulled(bar(40, 31)),
}
const MOUNT = { overlay: front(false, 'drawers'), inset: front(true, 'drawers') }
const FRONTS = { flat: opening(null, WOOD), grooved: opening(GROOVES, WOOD) }

/** The choices of one opening, which are not fields of a plan: what it holds, its leaves, what goes inside. */
export const CELL_DIAGRAMS = {
  content: {
    open: hollow(shelfIn(28)),
    drawer: opening(
      <>
        <rect x="18" y="6" width="44" height="24" className={WOOD} />
        <rect x="18" y="30" width="44" height="24" className={WOOD} />
        {bar(40, 18)}
        {bar(40, 42)}
      </>,
    ),
    door: opening(
      <>
        <rect x="18" y="6" width="44" height="48" className={WOOD} />
        {knob(56, 30)}
      </>,
    ),
    closed: opening(null, WOOD),
    chest: draw(
      <>
        <rect x="14" y="24" width="52" height="30" className={WOOD} />
        <polygon points="14,24 66,24 62,10 18,14" className={HOLLOW} />
      </>,
    ),
    void: draw(<rect x="18" y="6" width="44" height="48" className="fill-none stroke-graphite-2" strokeDasharray="3 3" />),
  },
  leaves: {
    1: opening(
      <>
        <rect x="18" y="6" width="44" height="48" className={WOOD} />
        {knob(56, 30)}
      </>,
    ),
    2: opening(
      <>
        <rect x="18" y="6" width="22" height="48" className={WOOD} />
        <rect x="40" y="6" width="22" height="48" className={WOOD} />
        {knob(36, 30)}
        {knob(44, 30)}
      </>,
    ),
  },
  inside: {
    shelves: hollow(
      <>
        {shelfIn(20)}
        {shelfIn(34)}
      </>,
    ),
    rod: hollow(
      <>
        <line x1="20" y1="15" x2="60" y2="15" className={METAL} strokeWidth="2" />
        <path d="M40 15 v5 l-11 7 h22 l-11 -7" className="fill-none stroke-graphite-2" />
      </>,
    ),
  },
  drawerFronts: MOUNT,
} satisfies Record<string, Record<string, ReactNode>>

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
  legs: {
    panel: table(
      <>
        <polygon points="50,14 72,21 72,49 50,42" className={WOOD} />
        <polygon points="8,23 30,30 30,56 8,49" className={WOOD} />
      </>,
    ),
    legs: table([leg(47, 14), leg(70, 20), leg(7, 22), leg(30, 30)]),
    none: draw(
      <>
        <rect x="8" y="36" width="64" height="18" className={WOOD} />
        {floor}
      </>,
    ),
  },
  stretcher: {
    none: fromAbove(null),
    ends: fromAbove(
      <>
        <rect x="15.5" y="20" width="3" height="20" className={WOOD} />
        <rect x="61.5" y="20" width="3" height="20" className={WOOD} />
      </>,
    ),
    h: fromAbove(
      <>
        <rect x="15.5" y="20" width="3" height="20" className={WOOD} />
        <rect x="61.5" y="20" width="3" height="20" className={WOOD} />
        <rect x="18.5" y="28.5" width="43" height="3" className={WOOD} />
      </>,
    ),
  },
  corners: {
    square: draw(<rect x="10" y="12" width="60" height="36" className={WOOD} />),
    rounded: draw(<rect x="10" y="12" width="60" height="36" rx="9" className={WOOD} />),
  },
  pulls: PULLS,
  'pedestal.pulls': PULLS,
  'drawers.pulls': PULLS,
  'drawers.mount': MOUNT,
  'drawers.style': FRONTS,
  front: {
    open: opening(
      <>
        <line x1="18" y1="22" x2="62" y2="26" className={LINE} strokeWidth="2" />
        <line x1="18" y1="38" x2="62" y2="42" className={LINE} strokeWidth="2" />
      </>,
    ),
    doors: opening(
      <>
        <rect x="18" y="6" width="22" height="48" className={WOOD} />
        <rect x="40" y="6" width="22" height="48" className={WOOD} />
        {knob(36, 30)}
        {knob(44, 30)}
      </>,
    ),
  },
  platform: {
    panel: draw(<rect x="10" y="12" width="60" height="36" className={WOOD} />),
    slats: draw(
      <>
        <rect x="10" y="12" width="60" height="36" className="fill-none stroke-graphite-2" />
        {[16, 26, 36, 46, 56].map((x) => (
          <rect key={x} x={x} y="12" width="6" height="36" className={WOOD} />
        ))}
      </>,
    ),
  },
  'headboard.style': {
    none: bed(null),
    plain: bed(<rect x="10" y="10" width="4" height="38" className={WOOD} />),
    bookcase: bed(
      <>
        <rect x="4" y="10" width="10" height="38" className={WOOD} />
        <line x1="4" y1="22" x2="14" y2="22" className={LINE} />
        <line x1="4" y1="34" x2="14" y2="34" className={LINE} />
      </>,
    ),
    storage: bed(
      <>
        <rect x="4" y="18" width="10" height="30" className={WOOD} />
        <rect x="3" y="15" width="12" height="3" className={WOOD} />
      </>,
    ),
    daybed: bed(
      <>
        <rect x="14" y="14" width="58" height="24" className="fill-kraft-2/50 stroke-graphite-2" />
        <rect x="10" y="20" width="4" height="28" className={WOOD} />
        <rect x="72" y="20" width="4" height="28" className={WOOD} />
      </>,
    ),
  },
  'construction.doors': {
    overlay: front(false, 'door'),
    inset: front(true, 'door'),
    sliding: opening(
      <>
        <rect x="18" y="6" width="26" height="48" className={WOOD} />
        <rect x="36" y="6" width="26" height="48" className={WOOD} />
        <path d="M30 30 h20 M33 27 l-3 3 l3 3 M47 27 l3 3 l-3 3" className="fill-none stroke-graphite" />
      </>,
    ),
  },
  'construction.drawerFronts': MOUNT,
  'construction.fronts': FRONTS,
  'construction.pulls': PULLS,
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
