import { Plus, Trash } from '@phosphor-icons/react'
import { CABINET_LABELS } from '../../domain/furniture/modules/cabinet'
import type { Cell, Column } from '../../domain/furniture/reading/reading'
import { Button } from '../system/components'
import { Segmented, Stepper } from './PlanControls'

// A cabinet's columns and their cells: the one part of a plan that no generic field can draw.

const CONTENTS = Object.entries(CABINET_LABELS.cell) as [Cell['content'], string][]
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

/** Left to right, each column with its cells from top to bottom as the person sees them. */
export function CabinetColumns({ label, value: columns, onChange }: { label: string; value: Column[]; onChange: (columns: Column[]) => void }) {
  const setColumn = (i: number, column: Column) => onChange(columns.map((c, j) => (j === i ? column : c)))
  const widths = columns.map((c) => c.width)
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">{label}</h3>
        <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => onChange([...columns, { width: columns.reduce((s, c) => s + c.width, 0) / columns.length, cells: [newCell()] }])}>
          <Plus /> Columna
        </Button>
      </div>
      {columns.map((column, i) => {
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
              {columns.length > 1 && (
                <button type="button" aria-label={`Quitar columna ${i + 1}`} onClick={() => onChange(columns.filter((_, j) => j !== i))} className="ml-auto text-graphite-2 hover:text-rust">
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
  )
}
