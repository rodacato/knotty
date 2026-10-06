import { useMemo } from 'react'
import { analyze } from '../../domain/checks/analysis'
import type { Design } from '../../domain/design/schema'
import { fittedJoints } from '../../domain/furniture/modules/assembly'
import { counted } from '../../domain/furniture/modules/parts'
import { useServices } from '../services'
import { draftOf, useStore } from '../store'
import { Title } from '../system/components'

// Where a knocked-down furniture comes apart: each joint that takes a fitting, by the names of its two pieces, with the way to see it in the 3D.

const FITTING = { 'connector-bolt': { one: 'perno M6', many: 'pernos M6' }, 'cam-lock': { one: 'minifix', many: 'minifix' } }
const fittings = (n: number, type: keyof typeof FITTING) => counted(n, FITTING[type].one, FITTING[type].many)

export function FittingsSection({ design: applied }: { design: Design }) {
  const { catalog } = useServices()
  // The choice not yet applied is the one on screen, as in the 3D.
  const design = useStore(draftOf)?.design ?? applied
  const flagged = useStore((s) => s.flagged)
  const flag = useStore((s) => s.flag)
  const fitted = useMemo(() => {
    const geo = analyze(design, catalog).geo
    return geo ? fittedJoints(design, geo) : []
  }, [design, catalog])
  if (!fitted.length) return null
  const name = (id: string) => design.pieces.find((p) => p.id === id)?.name ?? id
  const isMarked = (ids: string[]) => ids.length === flagged.length && ids.every((id) => flagged.includes(id))
  const all = [...new Set(fitted.flatMap(({ joint }) => [joint.a, joint.b]))]
  const totals = (['connector-bolt', 'cam-lock'] as const).flatMap((type) => {
    const n = fitted.filter(({ joint }) => joint.type === type).reduce((sum, f) => sum + f.count, 0)
    return n ? [fittings(n, type)] : []
  })
  return (
    <section className="flex flex-col gap-3">
      <Title className="text-lg">Dónde se desarma</Title>
      <p className="text-sm text-graphite-2">
        {totals.join(' y ')} en {counted(fitted.length, 'unión', 'uniones')}. Lo demás va atornillado en su lugar.
      </p>
      <button type="button" aria-pressed={isMarked(all)} onClick={() => flag(all)} className="min-h-11 self-start text-sm font-medium underline">
        {isMarked(all) ? 'Quitar la marca' : 'Ver todas en el 3D'}
      </button>
      <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
        {fitted.map(({ joint, count }) => {
          const pair = [joint.a, joint.b]
          const marked = isMarked(pair)
          return (
            <li key={joint.id}>
              <button type="button" aria-pressed={marked} onClick={() => flag(pair)} className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm ${marked ? 'bg-amber-soft' : ''}`}>
                <span className="min-w-0 flex-1">
                  {name(joint.a)} con {name(joint.b).toLowerCase()}
                </span>
                <span className="numerals shrink-0 font-mono text-xs text-graphite-2">{fittings(count, joint.type as keyof typeof FITTING)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
