import { ArrowCounterClockwise, CaretRight, Minus, Plus, Swap } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { describeChange } from '../../domain/editing/changes/changes'
import type { DesignState } from '../../domain/session/state'
import { useServices } from '../services'
import { useStore } from '../store'

// Under each change: what it did to the pieces, with a way back for each piece and for the whole change.

const ICON = { added: <Plus size={11} weight="bold" />, removed: <Minus size={11} weight="bold" />, changed: <Swap size={11} weight="bold" /> }
const BACK = { added: 'Quitar', removed: 'Regresar', changed: 'Regresar' }

/** Under the person's message it is a quiet line; inside the expert's bubble it follows a hairline. */
export function ChangeList({ state, version, inBubble = false }: { state: DesignState; version: number; inBubble?: boolean }) {
  const { catalog } = useServices()
  const restore = useStore((s) => s.restoreFromVersion)
  const undo = useStore((s) => s.undoChange)
  const select = useStore((s) => s.select)
  const thinking = useStore((s) => s.thinking)
  const [error, setError] = useState<string | null>(null)
  const change = useMemo(() => {
    const ordered = [...state.versions].sort((a, b) => a.n - b.n)
    const i = ordered.findIndex((v) => v.n === version)
    return i > 0 ? describeChange(ordered[i - 1].design, ordered[i].design, catalog) : null
  }, [state.versions, version, catalog])
  if (!change || (!change.direct.length && !change.dimensions)) return null
  const run = (r: { ok: true } | { ok: false; message: string }) => setError(r.ok ? null : r.message)
  const count = change.direct.length + (change.dimensions ? 1 : 0)

  return (
    <details className={`group text-sm ${inBubble ? 'mt-3 border-t border-line pt-1' : ''}`}>
      <summary
        className={`flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md text-xs text-graphite-2 hover:text-graphite [&::-webkit-details-marker]:hidden ${inBubble ? '-mb-2' : '-my-3 ml-auto w-fit'}`}
      >
        <CaretRight className="shrink-0 transition group-open:rotate-90" />
        Qué cambió ({count}){change.followed.length ? ` · ${change.followed.length} ${change.followed.length === 1 ? 'pieza se ajustó sola' : 'piezas se ajustaron solas'}` : ''}
      </summary>
      <ul className={`mt-2 flex flex-col gap-1 ${inBubble ? '' : 'pl-4'}`}>
        {change.dimensions && <li className="text-xs">Medidas del mueble: {change.dimensions}</li>}
        {change.direct.map((c) => (
          <li key={c.id} className="flex items-center gap-2">
            <span className={`grid size-5 shrink-0 place-items-center rounded-full ${c.kind === 'removed' ? 'bg-rust/15 text-rust' : c.kind === 'added' ? 'bg-slate/15 text-slate' : 'bg-graphite/10 text-graphite'}`}>{ICON[c.kind]}</span>
            <button type="button" className="min-w-0 flex-1 truncate text-left text-xs hover:underline" onClick={() => c.kind !== 'removed' && select(c.id)} title={c.detail}>
              <span className="font-medium">{c.name}</span>
              {c.detail && <span className="text-graphite-2"> · {c.detail}</span>}
            </button>
            <button type="button" disabled={thinking} onClick={() => run(restore(version, [c.id]))} className="shrink-0 text-xs text-graphite-2 hover:text-graphite hover:underline disabled:opacity-40">
              {BACK[c.kind]}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" disabled={thinking} onClick={() => run(undo(version))} className={`mt-2 flex items-center gap-1 text-xs font-medium hover:underline disabled:opacity-40 ${inBubble ? '' : 'ml-4'}`}>
        <ArrowCounterClockwise /> Deshacer este cambio
      </button>
      {error && <p className={`mt-1 text-xs text-rust ${inBubble ? '' : 'pl-4'}`}>{error}</p>}
    </details>
  )
}
