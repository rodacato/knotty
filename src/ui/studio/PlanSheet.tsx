import { ArrowCounterClockwise, Check, Plus, Trash, Warning } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { currentPlan } from '../../application/useCases'
import type { BedPlan } from '../../domain/modules/bed'
import { CABINET_LABELS, type CabinetConstruction, type CabinetPlan } from '../../domain/modules/cabinet'
import { describePlanChanges, type FurniturePlan } from '../../domain/modules/plan'
import type { TablePlan } from '../../domain/modules/table'
import { TableFields } from './TableFields'
import { BedFields } from './BedFields'
import { NumberField, optionsOf, Segmented, Stepper } from './PlanControls'
import type { Cell, Column } from '../../domain/reading/reading'
import type { DesignState } from '../../domain/session/state'
import { useServices } from '../services'
import { Button } from '../system/components'
import { useStore } from '../store'

// The plan as a form: every decision that shapes the piece of furniture, applied at once and without the expert.

const CONSTRUCTION = (Object.keys(CABINET_LABELS.construction) as (keyof CabinetConstruction)[]).map((key) => ({ key, label: CABINET_LABELS.construction[key].label, options: Object.entries(CABINET_LABELS.construction[key].options) }))
const CONTENTS = Object.entries(CABINET_LABELS.cell) as [Cell['content'], string][]
const BASES = optionsOf(CABINET_LABELS.base)
const newCell = (): Cell => ({ height: 1, content: 'open', shelves: 0, doors: null })
const percent = (value: number, all: number[]) => Math.round((value / (all.reduce((s, v) => s + v, 0) || 1)) * 100)

function CellRow({ cell, heights, index, onChange, onRemove }: { cell: Cell; heights: number[]; index: number; onChange: (c: Cell) => void; onRemove: (() => void) | null }) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-xl bg-bone px-2 py-1.5">
      <select
        aria-label={`Hueco ${index + 1}`}
        value={cell.content}
        onChange={(e) => {
          const content = e.target.value as Cell['content']
          onChange({ ...cell, content, shelves: content === 'open' || content === 'door' ? (cell.shelves ?? 0) : null, doors: content === 'door' ? (cell.doors ?? 1) : null })
        }}
        className="rounded-lg border border-line bg-paper px-1.5 py-1 text-xs"
      >
        {CONTENTS.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-xs text-graphite-2">
        alto
        <input
          type="number"
          min={1}
          max={100}
          value={percent(cell.height, heights)}
          onChange={(e) => onChange({ ...cell, height: Math.max(1, Number(e.target.value)) / 100 })}
          aria-label={`Alto del hueco ${index + 1} en porcentaje`}
          className="numerals w-14 rounded-lg border border-line bg-paper px-1 py-0.5 text-right text-xs"
        />
        %
      </label>
      {(cell.content === 'open' || cell.content === 'door') && (
        <span className="flex items-center gap-1 text-xs text-graphite-2">
          repisas <Stepper value={cell.shelves ?? 0} min={0} max={8} onChange={(shelves) => onChange({ ...cell, shelves })} label="repisas" />
        </span>
      )}
      {cell.content === 'door' && <Segmented label="Hojas" value={String(cell.doors ?? 1)} options={[['1', '1 hoja'], ['2', '2 hojas']]} onChange={(v) => onChange({ ...cell, doors: Number(v) })} />}
      {onRemove && (
        <button type="button" aria-label={`Quitar hueco ${index + 1}`} onClick={onRemove} className="ml-auto text-graphite-2 hover:text-rust">
          <Trash size={14} />
        </button>
      )}
    </li>
  )
}

function CabinetFields({ draft, set }: { draft: CabinetPlan; set: (change: Partial<CabinetPlan>) => void }) {
  const { catalog } = useServices()
  const setColumn = (i: number, column: Column) => set({ columns: draft.columns.map((c, j) => (j === i ? column : c)) })
  const boards = catalog.materials.filter((m) => m.type === 'plywood')
  const widths = draft.columns.map((c) => c.width)
  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className="font-display text-base font-semibold">Medidas</h3>
        <div className="grid grid-cols-3 gap-2">
          <NumberField label="Alto" suffix="mm" value={draft.dimensions.height} onChange={(height) => set({ dimensions: { ...draft.dimensions, height } })} />
          <NumberField label="Ancho" suffix="mm" value={draft.dimensions.width} onChange={(width) => set({ dimensions: { ...draft.dimensions, width } })} />
          <NumberField label="Fondo" suffix="mm" value={draft.dimensions.depth} onChange={(depth) => set({ dimensions: { ...draft.dimensions, depth } })} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-display text-base font-semibold">Cómo se arma</h3>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Triplay</span>
            <Segmented label="Triplay" value={draft.material} options={boards.map((m) => [m.id, `${m.thickness} mm`])} onChange={(material) => set({ material })} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Base</span>
            <Segmented label="Base" value={draft.base} options={BASES} onChange={(base) => set({ base: base as CabinetPlan['base'] })} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Anclado al muro</span>
            <Segmented label="Anclado al muro" value={draft.wallMounted ? 'yes' : 'no'} options={[['yes', 'Sí'], ['no', 'No']]} onChange={(v) => set({ wallMounted: v === 'yes' })} />
          </div>
          {CONSTRUCTION.map((c) => (
            <div key={c.key} className="flex flex-wrap items-center justify-between gap-2">
              <span>{c.label}</span>
              <Segmented label={c.label} value={draft.construction[c.key]} options={c.options} onChange={(v) => set({ construction: { ...draft.construction, [c.key]: v } })} />
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">Columnas y huecos</h3>
          <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => set({ columns: [...draft.columns, { width: draft.columns.reduce((s, c) => s + c.width, 0) / draft.columns.length, cells: [newCell()] }] })}>
            <Plus /> Columna
          </Button>
        </div>
        {draft.columns.map((column, i) => {
          const heights = column.cells.map((c) => c.height)
          return (
            <div key={i} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-kraft/40 p-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Columna {i + 1}</span>
                <label className="flex items-center gap-1 text-xs text-graphite-2">
                  ancho
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={percent(column.width, widths)}
                    onChange={(e) => setColumn(i, { ...column, width: Math.max(1, Number(e.target.value)) / 100 })}
                    aria-label={`Ancho de la columna ${i + 1} en porcentaje`}
                    className="numerals w-14 rounded-lg border border-line bg-paper px-1 py-0.5 text-right text-xs"
                  />
                  %
                </label>
                {draft.columns.length > 1 && (
                  <button type="button" aria-label={`Quitar columna ${i + 1}`} onClick={() => set({ columns: draft.columns.filter((_, j) => j !== i) })} className="ml-auto text-graphite-2 hover:text-rust">
                    <Trash size={14} />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-graphite-2">De arriba hacia abajo</p>
              <ol className="flex flex-col gap-1">
                {column.cells
                  .map((cell, j) => ({ cell, j }))
                  .reverse()
                  .map(({ cell, j }) => (
                    <CellRow
                      key={j}
                      cell={cell}
                      heights={heights}
                      index={j}
                      onChange={(c) => setColumn(i, { ...column, cells: column.cells.map((x, k) => (k === j ? c : x)) })}
                      onRemove={column.cells.length > 1 ? () => setColumn(i, { ...column, cells: column.cells.filter((_, k) => k !== j) }) : null}
                    />
                  ))}
              </ol>
              <button type="button" onClick={() => setColumn(i, { ...column, cells: [...column.cells, newCell()] })} className="self-start text-xs text-graphite-2 underline">
                Agregar un hueco arriba
              </button>
            </div>
          )
        })}
      </section>
    </>
  )
}

function Fields({ draft, set }: { draft: FurniturePlan; set: (change: Partial<CabinetPlan> | Partial<BedPlan> | Partial<TablePlan>) => void }) {
  switch (draft.kind) {
    case 'cabinet':
      return <CabinetFields draft={draft} set={set} />
    case 'bed':
      return <BedFields draft={draft} set={set} />
    case 'table':
      return <TableFields draft={draft} set={set} />
    default:
      return draft satisfies never
  }
}

export function PlanSheet({ state }: { state: DesignState }) {
  const applyPlan = useStore((s) => s.applyPlan)
  const source = useMemo(() => currentPlan(state), [state])
  const [draft, setDraft] = useState<FurniturePlan | null>(source.plan)
  const [message, setMessage] = useState<{ kind: 'error' | 'note'; text: string } | null>(null)
  // A new plan from outside (another version, the expert) replaces the draft.
  const [synced, setSynced] = useState(source.plan)
  if (synced !== source.plan) {
    setSynced(source.plan)
    setDraft(source.plan)
  }

  if (!source.plan || !draft)
    return (
      <div className="flex flex-col gap-2 p-6 text-center text-sm text-graphite-2">
        <p className="font-medium text-graphite">Este mueble no tiene ficha</p>
        <p>La ficha aparece cuando el mueble es un gabinete (librero, buró, cajonera, alacena…), una cama, una mesa o un escritorio. Lo demás se ajusta con el experto.</p>
      </div>
    )

  const changes = describePlanChanges(source.plan, draft)
  const set = (change: Partial<CabinetPlan> | Partial<BedPlan> | Partial<TablePlan>) => {
    setMessage(null)
    setDraft({ ...draft, ...change } as FurniturePlan)
  }

  const apply = () => {
    const r = applyPlan(draft)
    setMessage(r.ok ? (r.notes.length ? { kind: 'note', text: r.notes.join(' ') } : null) : { kind: 'error', text: r.message })
  }

  return (
    <div className="flex flex-col gap-5 p-4 pb-28">
      {source.diverged && (
        <p className="flex items-start gap-2 rounded-xl border border-amber/40 bg-amber-soft p-3 text-xs">
          <Warning className="mt-0.5 shrink-0" weight="bold" /> Desde la v{source.since} hubo cambios con el experto que no están en la ficha. Si aplicas la ficha, el mueble vuelve a armarse desde ella y esos cambios se pierden.
        </p>
      )}

      {!source.diverged && source.extras.length > 0 && (
        <p className="rounded-xl bg-kraft/60 p-3 text-xs text-graphite-2">
          Encima de la ficha {source.extras.length === 1 ? 'hay un cambio hecho' : `hay ${source.extras.length} cambios hechos`} con el experto. Se conservan al aplicar; si alguno ya no tiene dónde ir, te aviso.
        </p>
      )}

      <Fields draft={draft} set={set} />

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur">
        {message && <p className={`text-xs ${message.kind === 'error' ? 'text-rust' : 'text-graphite-2'}`}>{message.text}</p>}
        <p className="text-xs text-graphite-2">{changes.length ? `Cambios: ${changes.join(', ')}.` : 'Sin cambios todavía.'}</p>
        <div className="flex gap-2">
          <Button variant="primary" className="min-h-10 flex-1" disabled={!changes.length} onClick={apply}>
            <Check weight="bold" /> Aplicar
          </Button>
          <Button variant="ghost" className="min-h-10" disabled={!changes.length} onClick={() => set(source.plan!)}>
            <ArrowCounterClockwise /> Descartar
          </Button>
        </div>
      </div>
    </div>
  )
}
