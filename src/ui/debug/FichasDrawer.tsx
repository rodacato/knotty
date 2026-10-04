import { Cube, WarningCircle, XCircle } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Thumbnail } from '../capture/Thumbnail'
import { FICHA_FILTERS, fichasOf, listFichas, type FichaFilter, type FichaRow } from '../lab/variants'
import { useServices } from '../services'
import { useStore } from '../store'
import { Chip } from '../system/components'

// «Fichas»: the reference furniture as the home screen shows it, each one a door into the Studio on a throwaway design.

const FLAG = {
  note: { icon: WarningCircle, className: 'text-graphite', label: 'Con avisos' },
  invalid: { icon: XCircle, className: 'text-rust', label: 'Inválida' },
}

function FichaCard({ row, selected, onOpen }: { row: FichaRow; selected: boolean; onOpen: () => void }) {
  const { reference: r, verdict, boxes } = row
  const flag = verdict === 'ok' ? null : FLAG[verdict]
  return (
    <button type="button" aria-pressed={selected} onClick={onOpen} className="group flex flex-col gap-1 rounded-xl text-left">
      <span
        className={`relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border p-3 transition group-active:scale-[0.98] ${selected ? 'border-amber bg-amber-soft' : 'border-line bg-kraft group-hover:bg-kraft-2'}`}
      >
        {boxes ? <Thumbnail boxes={boxes} /> : <Cube className="size-6 text-graphite-2" />}
        {flag && <flag.icon weight="fill" size={18} aria-label={flag.label} className={`absolute top-1.5 right-1.5 ${flag.className}`} />}
      </span>
      <span className={`text-sm leading-snug ${selected ? 'font-semibold' : 'font-medium'}`}>{r.name}</span>
      <span className="font-mono text-[11px] text-graphite-2">
        {r.code} v{r.version}
      </span>
    </button>
  )
}

export function FichasDrawer() {
  const { references, catalog } = useServices()
  const sandboxed = useStore((s) => s.sandboxed)
  const sandboxExample = useStore((s) => s.sandboxExample)
  const rows = useMemo(() => listFichas(references.all(), catalog), [references, catalog])
  const [filter, setFilter] = useState<FichaFilter>('all')
  const [opened, setOpened] = useState<string | null>(null)
  const shown = fichasOf(rows, filter)
  const current = sandboxed ? opened : null

  const open = ({ reference: r }: FichaRow) => {
    setOpened(r.code)
    sandboxExample({ name: r.name, plan: r.plan, notes: r.notes, ...(r.kind ? { kind: r.kind } : {}), ...(r.finish ? { finish: r.finish } : {}) }, r.code)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex min-h-15 shrink-0 flex-col justify-center pr-14 pl-4">
        <h2 className="font-display text-lg leading-tight font-semibold">Fichas</h2>
        <p className="text-xs leading-snug text-graphite-2">Los muebles de referencia de Knotty. Ábrelos, mejóralos con el experto y exporta el plan.</p>
      </div>
      <div className="flex flex-wrap gap-1.5 px-3 pt-1 pb-3">
        {FICHA_FILTERS.map(([id, label]) => (
          <Chip key={id} active={filter === id} aria-pressed={filter === id} onClick={() => setFilter(id)}>
            {label} <span className="numerals text-graphite-2">{fichasOf(rows, id).length}</span>
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 px-3 pb-4">
        {shown.map((row) => (
          <FichaCard key={row.reference.code} row={row} selected={current === row.reference.code} onOpen={() => open(row)} />
        ))}
      </div>
    </div>
  )
}
