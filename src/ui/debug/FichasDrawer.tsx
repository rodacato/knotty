import { Cube, XCircle } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Thumbnail } from '../capture/Thumbnail'
import { ANY, roomChips, type CatalogQuery } from '../capture/catalog'
import { fichasOf, listFichas, type FichaRow } from '../lab/variants'
import { useServices } from '../services'
import { useStore } from '../store'
import { Chip } from '../system/components'
import { Field, Input } from '../system/Field'

// «Fichas»: the reference furniture by room, each one a door into the Studio on a throwaway design.

function FichaCard({ row, selected, onOpen }: { row: FichaRow; selected: boolean; onOpen: () => void }) {
  const { reference: r, verdict, notes, boxes } = row
  return (
    <button type="button" aria-pressed={selected} onClick={onOpen} className="group flex flex-col gap-1 rounded-xl text-left">
      <span
        className={`relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border p-3 transition group-active:scale-[0.98] ${selected ? 'border-amber bg-amber-soft' : 'border-line bg-kraft group-hover:bg-kraft-2'}`}
      >
        {boxes ? <Thumbnail boxes={boxes} /> : <Cube className="size-6 text-graphite-2" />}
        {verdict === 'invalid' && <XCircle weight="fill" size={18} aria-label="Inválida" className="absolute top-1.5 right-1.5 text-rust" />}
      </span>
      <span className={`text-sm leading-snug ${selected ? 'font-semibold' : 'font-medium'}`}>{r.name}</span>
      <span className="flex flex-wrap items-baseline gap-x-2 font-mono text-[11px] text-graphite-2">
        <span>
          {r.code} v{r.version}
        </span>
        {verdict === 'note' && (
          <span title={notes.join('\n')} className="font-sans underline decoration-dotted underline-offset-2">
            {notes.length} {notes.length === 1 ? 'aviso' : 'avisos'}
          </span>
        )}
      </span>
    </button>
  )
}

export function FichasDrawer() {
  const { references, catalog } = useServices()
  const sandboxed = useStore((s) => s.sandboxed)
  const sandboxExample = useStore((s) => s.sandboxExample)
  const rows = useMemo(() => listFichas(references.all(), catalog), [references, catalog])
  const [query, setQuery] = useState<CatalogQuery>(ANY)
  const [opened, setOpened] = useState<string | null>(null)
  const shown = fichasOf(rows, query)
  const current = sandboxed ? opened : null
  const chips = useMemo(() => roomChips(rows.map((r) => r.reference), query), [rows, query])
  const set = (change: Partial<CatalogQuery>) => setQuery((q) => ({ ...q, ...change }))

  const open = ({ reference: r }: FichaRow) => {
    setOpened(r.code)
    sandboxExample({ name: r.name, plan: r.plan, notes: r.notes, code: r.code, version: r.version, ...(r.kind ? { kind: r.kind } : {}), ...(r.finish ? { finish: r.finish } : {}) }, r.code)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex min-h-15 shrink-0 flex-col justify-center pr-14 pl-4">
        <h2 className="font-display text-lg leading-tight font-semibold">Fichas</h2>
        <p className="text-xs leading-snug text-graphite-2">Los muebles de referencia de Knotty. Ábrelos, mejóralos con el experto y exporta el plan.</p>
      </div>
      <div className="flex flex-col gap-2 px-3 pt-1 pb-3">
        <Field label="Buscar una ficha" hiddenLabel>
          <Input type="search" placeholder="Código o nombre: KC-LIB-03, escritorio" value={query.text} onChange={(e) => set({ text: e.target.value })} />
        </Field>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Cuarto">
          {chips.map(({ room, label, count }) => (
            <Chip key={room} active={query.room === room} aria-pressed={query.room === room} onClick={() => set({ room })}>
              {label} <span className="numerals text-graphite-2">{count}</span>
            </Chip>
          ))}
        </div>
      </div>
      {shown.length ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 px-3 pb-4">
          {shown.map((row) => (
            <FichaCard key={row.reference.code} row={row} selected={current === row.reference.code} onOpen={() => open(row)} />
          ))}
        </div>
      ) : (
        <p className="px-4 pb-4 text-sm text-graphite-2">{query.text ? `Ninguna ficha${query.room === 'all' ? '' : ' de ese cuarto'} tiene «${query.text}» en su código o su nombre.` : 'Ese cuarto no tiene fichas.'}</p>
      )}
    </div>
  )
}
