import { useMemo } from 'react'
import { analyze } from '../../domain/checks/analysis'
import type { Design } from '../../domain/design/schema'
import { fittedJoints, gluedBlocks } from '../../domain/furniture/modules/assembly'
import { counted } from '../../domain/furniture/modules/parts'
import { useServices } from '../services'
import { draftOf, useStore } from '../store'
import { Title } from '../system/components'

// How a knocked-down furniture comes apart: the parts that arrive glued and each joint between them that takes a fitting, with the way to see them in the 3D.

const FITTING = { 'connector-bolt': { one: 'perno M6', many: 'pernos M6' }, 'cam-lock': { one: 'minifix', many: 'minifix' } }
const fittings = (n: number, type: keyof typeof FITTING) => counted(n, FITTING[type].one, FITTING[type].many)

/** `apart`: the plan asks for it knocked down. A bed with no headboard then has no fitting at all, and still says how it travels. */
export function FittingsSection({ design: applied, apart }: { design: Design; apart: boolean }) {
  const { catalog } = useServices()
  // The choice not yet applied is the one on screen, as in the 3D.
  const design = useStore(draftOf)?.design ?? applied
  const flagged = useStore((s) => s.flagged)
  const flag = useStore((s) => s.flag)
  const fitted = useMemo(() => {
    const geo = analyze(design, catalog).geo
    return geo ? fittedJoints(design, geo) : []
  }, [design, catalog])
  if (!apart) return null
  const name = (id: string) => design.pieces.find((p) => p.id === id)?.name ?? id
  const isMarked = (ids: string[]) => ids.length === flagged.length && ids.every((id) => flagged.includes(id))
  const all = [...new Set(fitted.flatMap(({ joint }) => [joint.a, joint.b]))]
  const totals = (['connector-bolt', 'cam-lock'] as const).flatMap((type) => {
    const n = fitted.filter(({ joint }) => joint.type === type).reduce((sum, f) => sum + f.count, 0)
    return n ? [fittings(n, type)] : []
  })
  const blocks = gluedBlocks(design)
  const row = (key: string, ids: string[], text: string, detail: string) => (
    <li key={key}>
      <button type="button" aria-pressed={isMarked(ids)} onClick={() => flag(ids)} className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm ${isMarked(ids) ? 'bg-amber-soft' : ''}`}>
        <span className="min-w-0 flex-1">{text}</span>
        <span className="numerals shrink-0 font-mono text-xs text-graphite-2">{detail}</span>
      </button>
    </li>
  )
  const listed = (pieces: { name: string }[]) => {
    const [first, ...rest] = pieces.slice(0, 3).map((p) => p.name)
    return [first, ...rest.map((n) => n.toLowerCase())].join(', ') + (pieces.length > 3 ? ` y ${pieces.length - 3} más` : '')
  }
  const list = 'flex flex-col divide-y divide-line rounded-2xl border border-line'
  return (
    <section className="flex flex-col gap-3">
      <Title className="text-lg">Cómo se desarma</Title>
      <p className="text-sm text-graphite-2">
        {blocks.length > 0 && `${counted(blocks.length, 'parte se pega y llega armada', 'partes se pegan y llegan armadas')}. `}
        {fitted.length > 0 ? `${totals.join(' y ')} en ${counted(fitted.length, 'unión', 'uniones')}; lo demás va atornillado en su lugar.` : 'No hace falta herraje.'}
      </p>
      {fitted.length > 0 && (
        <button type="button" aria-pressed={isMarked(all)} onClick={() => flag(all)} className="min-h-11 self-start text-sm font-medium underline">
          {isMarked(all) ? 'Quitar la marca' : 'Ver las uniones en el 3D'}
        </button>
      )}
      {blocks.length > 0 && (
        <>
          <h3 className="text-sm font-semibold">Se pegan</h3>
          <ul className={list}>{blocks.map((pieces) => row(pieces[0].id, pieces.map((p) => p.id), listed(pieces), counted(pieces.length, 'pieza', 'piezas')))}</ul>
        </>
      )}
      {fitted.length > 0 && (
        <>
          <h3 className="text-sm font-semibold">Llevan herraje</h3>
          <ul className={list}>{fitted.map(({ joint, count }) => row(joint.id, [joint.a, joint.b], `${name(joint.a)} con ${name(joint.b).toLowerCase()}`, fittings(count, joint.type as keyof typeof FITTING)))}</ul>
        </>
      )}
    </section>
  )
}
