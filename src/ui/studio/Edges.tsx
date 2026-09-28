import { useState } from 'react'
import { EDGE_LABEL, edgeNeighbours, profilesOf } from '../../domain/design/edges'
import type { Geometry } from '../../domain/design/resolve'
import type { Axis, Design, Edge, Piece } from '../../domain/design/schema'
import { DEFAULT_EDGE_PROFILE, EDGE_PROFILE_IDS, EDGE_PROFILES, profileFit, type EdgeProfileId } from '../../domain/materials/edgeProfiles'
import { TERMS, type TermKey } from '../glossary'
import { useStore } from '../store'
import { Chip, Title } from '../system/components'
import { HelpButton, HelpPanel, useHelp } from '../system/Help'

// The edges of the selected piece that show, and the profile the person gives them (acabados.md §11). The 3D still draws them straight.

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
const H = 110
const PAD = 26

function FaceDrawing({ piece, geo, chosen, against, name }: { piece: Piece; geo: Geometry; chosen: Set<Edge>; against: Map<Edge, string | null>; name: (id: string) => string }) {
  const box = geo.boxes.get(piece.id)!
  const { across, up, sides } = VIEW[piece.normal]
  const [a, u] = [box[`${across}1`] - box[`${across}0`], box[`${up}1`] - box[`${up}0`]]
  const scale = Math.min((W - 2 * PAD) / a, (H - 2 * PAD) / u)
  const [w, h] = [Math.max(24, a * scale), Math.max(16, u * scale)]
  const [x0, y0] = [(W - w) / 2, (H - h) / 2]
  const lines: Record<Side, [number, number, number, number]> = { top: [x0, y0, x0 + w, y0], bottom: [x0, y0 + h, x0 + w, y0 + h], left: [x0, y0, x0, y0 + h], right: [x0 + w, y0, x0 + w, y0 + h] }
  const label = (edge: Edge) => {
    const other = against.get(edge)
    return other ? `${EDGE_LABEL[edge]} · contra ${name(other).toLowerCase()}` : EDGE_LABEL[edge]
  }
  const where: Record<Side, { x: number; y: number; anchor: 'middle' | 'end' | 'start' }> = {
    top: { x: W / 2, y: y0 - 7, anchor: 'middle' },
    bottom: { x: W / 2, y: y0 + h + 15, anchor: 'middle' },
    left: { x: x0 - 5, y: y0 + h / 2 + 4, anchor: 'end' },
    right: { x: x0 + w + 5, y: y0 + h / 2 + 4, anchor: 'start' },
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`La cara de ${piece.name.toLowerCase()} con sus cuatro cantos`}>
      <rect x={x0} y={y0} width={w} height={h} className="fill-kraft-2" />
      {(Object.keys(sides) as Side[]).map((side) => {
        const edge = sides[side]
        const [x1, y1, x2, y2] = lines[side]
        const style = chosen.has(edge) ? 'stroke-amber' : against.get(edge) ? 'stroke-graphite-2/40' : 'stroke-graphite-2'
        return (
          <g key={side}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} className={style} strokeWidth={chosen.has(edge) ? 4 : 1.5} strokeLinecap="round" />
            <text x={where[side].x} y={where[side].y} textAnchor={where[side].anchor} className="fill-graphite-2 text-[9px]">
              {side === 'top' || side === 'bottom' ? label(edge) : (SHORT[edge] ?? EDGE_LABEL[edge])}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const listed = (words: string[]) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} y ${words.at(-1)!.toLowerCase()}` : (words[0] ?? ''))

export function EdgesSection({ design, geo, piece, editable }: { design: Design; geo: Geometry; piece: Piece; editable: boolean }) {
  const level = useStore((s) => s.catalogSettings.toolLevel)
  const choose = useStore((s) => s.chooseEdgeProfiles)
  const help = useHelp<EdgeProfileId>()
  const [error, setError] = useState<string | null>(null)
  const neighbours = edgeNeighbours(design, geo, piece.id)
  const against = new Map(neighbours.map((n) => [n.edge, n.against]))
  const stored = profilesOf(design, piece.id).filter((c) => against.has(c.edge) && !against.get(c.edge))
  const chosen = new Set(stored.map((c) => c.edge))
  const profile = stored.length && stored.every((c) => c.profile === stored[0].profile) ? stored[0].profile : null
  const thickness = geo.thicknesses.get(piece.id)!
  const name = (id: string) => design.pieces.find((p) => p.id === id)?.name ?? id
  const apply = (edges: Edge[], id: EdgeProfileId | null) => {
    const r = choose(piece.id, edges, edges.length ? id : null)
    setError(r.ok ? null : r.message)
  }
  const toggle = (edge: Edge) => apply(chosen.has(edge) ? [...chosen].filter((e) => e !== edge) : [...chosen, edge], profile ?? DEFAULT_EDGE_PROFILE)
  const banded = [...chosen].filter((e) => piece.edges.includes(e))

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-3">
      <div className="flex items-baseline justify-between">
        <Title className="text-lg">Cantos</Title>
        <span className="text-xs text-graphite-2">Los que se ven</span>
      </div>
      <FaceDrawing piece={piece} geo={geo} chosen={chosen} against={against} name={name} />
      <div className="flex flex-wrap gap-1.5">
        {neighbours.map(({ edge, against: other }) => (
          <Chip key={edge} active={chosen.has(edge)} aria-pressed={chosen.has(edge)} disabled={!editable || !!other} title={other ? `Queda contra ${name(other).toLowerCase()}: no se ve` : undefined} onClick={() => toggle(edge)}>
            {EDGE_LABEL[edge]}
          </Chip>
        ))}
      </div>
      <p className="text-sm text-graphite">{chosen.size ? `Perfil de ${chosen.size === 1 ? 'el canto elegido' : `los ${chosen.size} cantos elegidos`}` : 'Elige los cantos que quieres perfilar; los demás quedan rectos.'}</p>
      <div role="radiogroup" aria-label="Perfil del canto" className="flex flex-col gap-2">
        {EDGE_PROFILE_IDS.map((id) => {
          const p = EDGE_PROFILES[id]
          const fit = profileFit(id, level, thickness)
          const thin = !fit.ok && fit.reason === 'thin'
          const disabled = !editable || !chosen.size || thin
          return (
            <div key={id} className="flex flex-col gap-2">
              <label className={`flex items-start gap-3 rounded-2xl border p-3 text-sm transition ${profile === id && chosen.size ? 'border-2 border-graphite' : 'border-line'} ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-kraft'}`}>
                <input type="radio" name={`profile-${piece.id}`} checked={profile === id && chosen.size > 0} disabled={disabled} onChange={() => apply([...chosen], id)} className="mt-1 accent-graphite" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-1">
                    <span className="font-semibold">{p.name}</span>
                    <HelpButton term={TERMS[TERM[id]]} open={help.open === id} onToggle={() => help.toggle(id)} />
                    {!fit.ok && fit.reason === 'router' && <span className="ml-auto shrink-0 rounded-full border border-line px-2 py-0.5 text-xs font-medium">No con tu herramienta</span>}
                  </span>
                  <span className="text-xs text-graphite-2">{p.detail}</span>
                  {!fit.ok && fit.reason === 'router' && <span className="text-xs text-graphite-2">Puedes pedirlo en la maderería.</span>}
                  {thin && <span className="text-xs text-graphite-2">Pide un tablero de al menos {fit.minThickness} mm; esta pieza es de {thickness} mm.</span>}
                </span>
              </label>
              {help.open === id && <HelpPanel term={TERMS[TERM[id]]} onClose={help.close} />}
            </div>
          )
        })}
      </div>
      {profile && EDGE_PROFILES[profile].cut && banded.length > 0 && (
        <p className="text-xs text-graphite">
          {listed(banded.map((e) => EDGE_LABEL[e]))} {banded.length === 1 ? 'lleva' : 'llevan'} cubrecanto: un perfil cortado y el cubrecanto de chapa no van juntos. Para un canto perfilado sin capas a la vista se usa canto macizo.
        </p>
      )}
      {error && <p className="text-xs text-rust">{error}</p>}
    </section>
  )
}
