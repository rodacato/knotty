import { CaretDown, CaretUp, Warning } from '@phosphor-icons/react'
import { useId, useState } from 'react'
import { EDGE_LABEL, edgeNeighbours, profilesOf } from '../../domain/design/edges'
import type { Geometry } from '../../domain/design/resolve'
import type { Axis, Design, Edge, Piece } from '../../domain/design/schema'
import { DEFAULT_EDGE_PROFILE, EDGE_PROFILE_IDS, EDGE_PROFILES, profileFit, type EdgeProfileId } from '../../domain/materials/edgeProfiles'
import { TERMS, type TermKey } from '../glossary'
import { countEdges } from './edgeCounts'
import { useStore } from '../store'
import { Chip, Title } from '../system/components'
import { HelpButton, HelpPanel, useHelp } from '../system/Help'

// The edges of the selected piece and the profile the person gives them (acabados.md §11). Nothing is locked: what will not show, or the board or the tools do not allow, gets a warning that says why.

const TERM: Record<EdgeProfileId, TermKey> = { eased: 'easedEdge', 'roundover-3': 'roundover', 'roundover-6': 'roundover', chamfer: 'chamfer' }

type Side = 'top' | 'bottom' | 'left' | 'right'
/** How the face is drawn: which axis runs across, which runs up, and which edge lies on each side of the drawing. */
const VIEW: Record<Axis, { across: Axis; up: Axis; sides: Record<Side, Edge> }> = {
  y: { across: 'x', up: 'z', sides: { top: 'back', bottom: 'front', left: 'left', right: 'right' } },
  x: { across: 'z', up: 'y', sides: { top: 'top', bottom: 'bottom', left: 'back', right: 'front' } },
  z: { across: 'x', up: 'y', sides: { top: 'top', bottom: 'bottom', left: 'left', right: 'right' } },
}

/** Beside a narrow drawing there is room for a short word only. */
const SHORT: Partial<Record<Edge, string>> = { left: 'Izq.', right: 'Der.' }

const W = 280
const H = 132
const PAD_X = 36
const PAD_Y = 36
/** The piece an edge rests against, drawn as a hatched strip outside the face. */
const BAND = 9

function FaceDrawing({ piece, geo, chosen, against, name }: { piece: Piece; geo: Geometry; chosen: Set<Edge>; against: Map<Edge, string | null>; name: (id: string) => string }) {
  const box = geo.boxes.get(piece.id)!
  const { across, up, sides } = VIEW[piece.normal]
  const [a, u] = [box[`${across}1`] - box[`${across}0`], box[`${up}1`] - box[`${up}0`]]
  const scale = Math.min((W - 2 * PAD_X) / a, (H - 2 * PAD_Y) / u)
  const [w, h] = [Math.max(24, a * scale), Math.max(16, u * scale)]
  const [x0, y0] = [(W - w) / 2, (H - h) / 2]
  const lines: Record<Side, [number, number, number, number]> = { top: [x0, y0, x0 + w, y0], bottom: [x0, y0 + h, x0 + w, y0 + h], left: [x0, y0, x0, y0 + h], right: [x0 + w, y0, x0 + w, y0 + h] }
  const label = (edge: Edge) => {
    const other = against.get(edge)
    return other ? `${EDGE_LABEL[edge]} · contra ${name(other).toLowerCase()}` : EDGE_LABEL[edge]
  }
  const pad = (side: Side) => (against.get(sides[side]) ? BAND + 3 : 0)
  const where: Record<Side, { x: number; y: number; anchor: 'middle' | 'end' | 'start' }> = {
    top: { x: W / 2, y: y0 - 8 - pad('top'), anchor: 'middle' },
    bottom: { x: W / 2, y: y0 + h + 17 + pad('bottom'), anchor: 'middle' },
    left: { x: x0 - 5 - pad('left'), y: y0 + h / 2 + 4, anchor: 'end' },
    right: { x: x0 + w + 5 + pad('right'), y: y0 + h / 2 + 4, anchor: 'start' },
  }
  const bands: Record<Side, [number, number, number, number]> = { top: [x0, y0 - BAND, w, BAND], bottom: [x0, y0 + h, w, BAND], left: [x0 - BAND, y0, BAND, h], right: [x0 + w, y0, BAND, h] }
  const hatch = `hatch-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`La cara de ${piece.name.toLowerCase()} con sus cuatro cantos`}>
      <defs>
        <pattern id={hatch} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" className="stroke-graphite-2/60" strokeWidth="1.5" />
        </pattern>
      </defs>
      <rect x={x0} y={y0} width={w} height={h} className="fill-kraft-2" />
      {(Object.keys(sides) as Side[]).map((side) => {
        const other = against.get(sides[side])
        if (!other) return null
        const [bx, by, bw, bh] = bands[side]
        return (
          <rect key={`against-${side}`} x={bx} y={by} width={bw} height={bh} fill={`url(#${hatch})`} className="stroke-graphite-2/40" strokeWidth="0.75">
            <title>{`Queda contra ${name(other).toLowerCase()}: no se ve`}</title>
          </rect>
        )
      })}
      {(Object.keys(sides) as Side[]).map((side) => {
        const edge = sides[side]
        const [x1, y1, x2, y2] = lines[side]
        const style = chosen.has(edge) ? 'stroke-amber' : against.get(edge) ? 'stroke-graphite-2/40' : 'stroke-graphite-2'
        return (
          <g key={side}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} className={style} strokeWidth={chosen.has(edge) ? 4 : 1.5} strokeLinecap="round" strokeDasharray={chosen.has(edge) && against.get(edge) ? '2 6' : undefined} />
            <text x={where[side].x} y={where[side].y} textAnchor={where[side].anchor} className="fill-graphite-2 text-[11px]">
              {side === 'top' || side === 'bottom' ? label(edge) : (SHORT[edge] ?? EDGE_LABEL[edge])}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const listed = (words: string[]) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} y ${words.at(-1)!.toLowerCase()}` : (words[0] ?? ''))

/** A warning the person opens by tapping it, like the help: a touch screen has no hover. */
function AlertButton({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault()
        onToggle()
      }}
      className="-my-2.5 grid size-11 shrink-0 place-items-center rounded-full"
    >
      <span className={`grid size-5 place-items-center rounded-full transition ${open ? 'bg-graphite text-bone' : 'bg-kraft text-graphite'}`}>
        <Warning size={12} weight="bold" />
      </span>
    </button>
  )
}

function AlertNote({ children }: { children: string }) {
  return (
    <p role="note" className="animate-appear rounded-xl border border-line bg-paper p-3 text-[13px] leading-snug">
      {children}
    </p>
  )
}

export function EdgesSection({ design, geo, piece, editable }: { design: Design; geo: Geometry; piece: Piece; editable: boolean }) {
  const level = useStore((s) => s.catalogSettings.toolLevel)
  const choose = useStore((s) => s.chooseEdgeProfiles)
  const help = useHelp<EdgeProfileId>()
  const alert = useHelp<string>()
  const [error, setError] = useState<string | null>(null)
  const neighbours = edgeNeighbours(design, geo, piece.id)
  const against = new Map(neighbours.map((n) => [n.edge, n.against]))
  const stored = profilesOf(design, piece.id).filter((c) => against.has(c.edge))
  const chosen = new Set(stored.map((c) => c.edge))
  const [changing, setChanging] = useState(false)
  const [open, setOpen] = useState(stored.length > 0)
  const body = useId()
  const profile = stored.length && stored.every((c) => c.profile === stored[0].profile) ? stored[0].profile : null
  const thickness = geo.thicknesses.get(piece.id)!
  const name = (id: string) => design.pieces.find((p) => p.id === id)?.name ?? id
  const apply = (edges: Edge[], id: EdgeProfileId | null) => {
    const r = choose(piece.id, edges, edges.length ? id : null)
    setError(r.ok ? null : r.message)
  }
  const toggle = (edge: Edge) => apply(chosen.has(edge) ? [...chosen].filter((e) => e !== edge) : [...chosen, edge], profile ?? DEFAULT_EDGE_PROFILE)
  const { shown, hidden: hiddenChosen } = countEdges([...chosen], against)
  const banded = shown.filter((e) => piece.edges.includes(e))
  const summary = !shown.length ? 'Rectos' : profile ? `${shown.length} con ${EDGE_PROFILES[profile].name.toLowerCase()}` : `${shown.length} con perfil`
  const collapsed = profile !== null && shown.length > 0 && !changing

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-1">
      <Title className="text-lg">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={body} className="-mx-1 flex min-h-11 w-full items-center gap-2 rounded-lg px-1 text-left">
          <span>Cantos</span>
          <span className="flex-1 truncate text-right font-sans text-xs font-normal tracking-normal text-graphite-2">{summary}</span>
          {open ? <CaretUp className="text-graphite-2" /> : <CaretDown className="text-graphite-2" />}
        </button>
      </Title>
      {open && (
        <div id={body} className="flex flex-col gap-3">
          <FaceDrawing piece={piece} geo={geo} chosen={chosen} against={against} name={name} />
          <div className="flex flex-wrap gap-1.5">
            {neighbours.map(({ edge, against: other }) => (
              <Chip key={edge} active={chosen.has(edge)} aria-pressed={chosen.has(edge)} disabled={!editable} onClick={() => toggle(edge)}>
                {EDGE_LABEL[edge]}
                {other && <Warning size={14} weight="bold" aria-label="No se ve" />}
              </Chip>
            ))}
          </div>
          {hiddenChosen.length > 0 && (
            <p className="flex items-start gap-2 text-xs text-graphite">
              <Warning size={14} weight="bold" className="mt-0.5 shrink-0" />
              <span>
                {listed(hiddenChosen.map((e) => `${EDGE_LABEL[e]} (contra ${name(against.get(e)!).toLowerCase()})`))} {hiddenChosen.length === 1 ? 'queda' : 'quedan'} donde no se ve, así que {hiddenChosen.length === 1 ? 'su perfil no se dibuja' : 'sus perfiles no se dibujan'} ni {hiddenChosen.length === 1 ? 'entra' : 'entran'} en la lista de compra.
              </span>
            </p>
          )}
          <p className="text-sm text-graphite">{shown.length ? shown.length === 1 ? 'Perfil del canto elegido' : `Perfil de los ${shown.length} cantos elegidos` : chosen.size ? 'Ninguno de los cantos elegidos se ve; elige uno que sí se vea para perfilarlo.' : 'Elige los cantos que quieres perfilar; los demás quedan rectos.'}</p>
          <div role="radiogroup" aria-label="Perfil del canto" className="flex flex-col gap-2">
            {(collapsed ? [profile!] : EDGE_PROFILE_IDS).map((id) => {
              const p = EDGE_PROFILES[id]
              const fit = profileFit(id, level, thickness)
              const why = fit.ok ? null : fit.reason === 'thin' ? `Necesita un tablero de al menos ${fit.minThickness} mm; esta pieza es de ${thickness} mm. Se puede elegir, pero no sale como se dibuja.` : 'Solo se hace con router y en tu nivel de herramienta no lo tienes. Puedes pedirlo en la maderería.'
              const disabled = !editable || !chosen.size
              return (
                <div key={id} className="flex flex-col gap-2">
                  <label className={`flex items-start gap-3 rounded-2xl border p-3 text-sm transition ${profile === id && chosen.size ? 'border-amber bg-amber-soft' : 'border-line'} ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-kraft'}`}>
                    <input type="radio" name={`profile-${piece.id}`} checked={profile === id && chosen.size > 0} disabled={disabled} onChange={() => {
                      apply([...chosen], id)
                      setChanging(false)
                    }} className="mt-1 accent-graphite" />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-center gap-1">
                        <span className="font-semibold">{p.name}</span>
                        <HelpButton term={TERMS[TERM[id]]} open={help.open === id} onToggle={() => help.toggle(id)} />
                        {why && (
                          <span className="ml-auto">
                            <AlertButton label={`Aviso de ${p.name}`} open={alert.open === id} onToggle={() => alert.toggle(id)} />
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-graphite-2">{p.detail}</span>
                    </span>
                  </label>
                  {why && alert.open === id && <AlertNote>{why}</AlertNote>}
                  {help.open === id && <HelpPanel term={TERMS[TERM[id]]} onClose={help.close} />}
                </div>
              )
            })}
          </div>
          {collapsed && editable && (
            <button type="button" onClick={() => setChanging(true)} className="-mt-1 min-h-11 self-start rounded-lg px-1 text-sm font-medium underline underline-offset-2">
              Cambiar perfil
            </button>
          )}
          {profile && EDGE_PROFILES[profile].cut && banded.length > 0 && (
            <p className="flex items-start gap-2 text-xs text-graphite">
              <Warning size={14} weight="bold" className="mt-0.5 shrink-0" />
              <span>
                {listed(banded.map((e) => EDGE_LABEL[e]))} {banded.length === 1 ? 'lleva' : 'llevan'} cubrecanto: un perfil cortado y el cubrecanto de chapa no van juntos. Para un canto perfilado sin capas a la vista se usa canto macizo.
              </span>
            </p>
          )}
          {error && <p className="text-xs text-rust">{error}</p>}
        </div>
      )}
    </section>
  )
}
