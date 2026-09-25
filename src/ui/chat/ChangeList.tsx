import { ArrowCounterClockwise, Minus, Plus, Swap } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { describeChange } from '../../domain/changes/changes'
import type { EstadoDiseno } from '../../domain/sesion/estado'
import { useServicios } from '../servicios'
import { useTienda } from '../tienda'

// Under each change: what it did to the pieces, with a way back for each piece and for the whole change.

const ICON = { added: <Plus size={11} weight="bold" />, removed: <Minus size={11} weight="bold" />, changed: <Swap size={11} weight="bold" /> }
const BACK = { added: 'Quitar', removed: 'Regresar', changed: 'Regresar' }

export function ChangeList({ estado, version }: { estado: EstadoDiseno; version: number }) {
  const { catalogo } = useServicios()
  const restore = useTienda((s) => s.restoreFromVersion)
  const undo = useTienda((s) => s.undoChange)
  const seleccionar = useTienda((s) => s.seleccionar)
  const pensando = useTienda((s) => s.pensando)
  const [error, setError] = useState<string | null>(null)
  const change = useMemo(() => {
    const ordered = [...estado.versiones].sort((a, b) => a.n - b.n)
    const i = ordered.findIndex((v) => v.n === version)
    return i > 0 ? describeChange(ordered[i - 1].diseno, ordered[i].diseno, catalogo) : null
  }, [estado.versiones, version, catalogo])
  if (!change || (!change.direct.length && !change.dimensions)) return null
  const run = (r: { ok: true } | { ok: false; message: string }) => setError(r.ok ? null : r.message)
  const count = change.direct.length + (change.dimensions ? 1 : 0)

  return (
    <details className="rounded-2xl border border-linea bg-hueso/70 px-3 py-2 text-sm">
      <summary className="cursor-pointer text-xs text-grafito-2">
        Qué cambió ({count}){change.followed.length ? ` · ${change.followed.length} ${change.followed.length === 1 ? 'pieza se ajustó sola' : 'piezas se ajustaron solas'}` : ''}
      </summary>
      <ul className="mt-2 flex flex-col gap-1">
        {change.dimensions && <li className="text-xs">Medidas del mueble: {change.dimensions}</li>}
        {change.direct.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <span className={`grid size-5 shrink-0 place-items-center rounded-full ${c.kind === 'removed' ? 'bg-oxido/15 text-oxido' : c.kind === 'added' ? 'bg-pizarra/15 text-pizarra' : 'bg-ambar-suave text-grafito'}`}>{ICON[c.kind]}</span>
            <button type="button" className="min-w-0 flex-1 truncate text-left text-xs hover:underline" onClick={() => c.kind !== 'removed' && seleccionar(c.id)} title={c.detail}>
              <span className="font-medium">{c.name}</span>
              {c.detail && <span className="text-grafito-2"> · {c.detail}</span>}
            </button>
            <button type="button" disabled={pensando} onClick={() => run(restore(version, [c.id]))} className="shrink-0 text-xs text-grafito-2 underline hover:text-grafito disabled:opacity-40">
              {BACK[c.kind]}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" disabled={pensando} onClick={() => run(undo(version))} className="mt-2 flex items-center gap-1 text-xs font-medium underline disabled:opacity-40">
        <ArrowCounterClockwise /> Deshacer este cambio
      </button>
      {error && <p className="mt-1 text-xs text-oxido">{error}</p>}
    </details>
  )
}
