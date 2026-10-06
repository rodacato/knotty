import type { Geometry } from '../../domain/design/resolve'
import { CABINET_LABELS, choicesFor, shelvesFor, type CabinetPlan, type CellChoice, type PlanCell } from '../../domain/furniture/modules/cabinet'
import { cellAt, cellLayout, chooseInCell, joinCells, joinSides, splitCell, type CellPath, type JoinSide } from '../../domain/furniture/modules/cabinetCells'
import { Chip } from '../system/components'
import { useStore } from '../store'
import { Segmented, Stepper } from './PlanControls'

// The chosen cell of the interior view takes the panel, like a chosen piece: what it holds, and how to cut or join it.

const JOIN_WORDS: Record<JoinSide, string> = { up: 'Con el de arriba', down: 'Con el de abajo', left: 'Con el de la izquierda', right: 'Con el de la derecha' }

/** A void goes only at an end of one of the furniture's own columns. */
const canBeVoid = (plan: CabinetPlan, path: CellPath) => path.length === 2 && plan.columns[path[0]].cells.length > 1 && (path[1] === 0 || path[1] === plan.columns[path[0]].cells.length - 1)

export function CellSheet({ plan, path, geo }: { plan: CabinetPlan; path: CellPath; geo: Geometry }) {
  const editPlan = useStore((s) => s.editPlan)
  const selectCell = useStore((s) => s.selectCell)
  const cell = cellAt(plan, path)
  if (!cell) return null
  const rect = cellLayout(plan, geo.boxes)?.cells.find((c) => c.path.join('.') === path.join('.'))
  const change = (patch: Partial<PlanCell>) => {
    const next = structuredClone(plan)
    const target = cellAt(next, path)!
    Object.assign(target, patch)
    for (const key of ['back', 'own'] as const) if (key in patch && patch[key] === undefined) delete target[key]
    editPlan(next)
  }
  const choose = (content: PlanCell['content']) =>
    change({ content, shelves: shelvesFor(cell, content), doors: content === 'door' ? (cell.doors ?? 1) : null, ...(content === 'void' ? { back: undefined } : {}), ...(choicesFor({ ...cell, content }).length ? {} : { own: undefined }) })
  const cut = (direction: 'columns' | 'rows', n: number) => {
    const next = splitCell(plan, path, direction, n)
    if (!next) return
    editPlan(next)
    selectCell(cellAt(next, path) ? path : [...path, 0, 0])
  }
  const join = (side: JoinSide) => {
    const r = joinCells(plan, path, side)
    if (!r) return
    editPlan(r.plan)
    selectCell(r.path)
  }
  const voidable = canBeVoid(plan, path)
  const contents = (Object.entries(CABINET_LABELS.cell) as [PlanCell['content'], string][]).filter(([id]) => id !== 'void' || voidable || cell.content === 'void')
  const own = (key: CellChoice, value: string) => {
    const next = chooseInCell(plan, path, key, value === 'inherit' ? undefined : (value as CabinetPlan['construction'][typeof key]))
    if (next) editPlan(next)
  }
  const inherited = plan.construction.back === 'nailed' ? 'con trasera' : 'sin trasera'
  const build = (patch: Partial<CabinetPlan['construction']>) => editPlan({ ...plan, construction: { ...plan.construction, ...patch } })
  const { doors, drawerFronts } = CABINET_LABELS.construction
  const sides = joinSides(plan, path)

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="Hueco elegido">
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg leading-tight font-semibold">Hueco elegido</h2>
            {rect && (
              <p className="numerals font-mono text-sm text-graphite-2">
                {Math.round(rect.x1 - rect.x0)} × {Math.round(rect.y1 - rect.y0)} mm
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-graphite-2">Qué lleva</span>
          <Segmented label="Qué lleva" value={cell.content} options={contents} onChange={(v) => choose(v as PlanCell['content'])} />
          {!voidable && cell.content !== 'void' && <p className="text-xs text-graphite-2">«Vacío» va en el hueco de arriba o de abajo de una columna, para que esa columna no llegue al piso o al techo.</p>}
        </div>
        {(cell.content === 'open' || cell.content === 'door') && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-graphite-2">Repisas adentro</span>
            <Stepper label="repisas" value={cell.shelves ?? 0} min={0} max={8} onChange={(shelves) => change({ shelves })} />
          </div>
        )}
        {cell.content === 'chest' && (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-graphite-2">Fondo</span>
            <Segmented label="Fondo del baúl" value={cell.shelves ? 'raised' : 'floor'} options={[['raised', 'A media altura'], ['floor', 'Hasta abajo']]} onChange={(v) => change({ shelves: v === 'raised' ? 1 : 0 })} />
            <p className="text-xs text-graphite-2">Abre por arriba: su tapa es el piso del hueco abierto de encima, con bisagra de piano y compás.</p>
          </div>
        )}
        {cell.content === 'door' && (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-graphite-2">Cómo cierran</span>
            <Segmented label="Cómo cierran las puertas" value={plan.construction.doors} options={Object.entries(doors.options)} onChange={(v) => build({ doors: v as CabinetPlan['construction']['doors'] })} />
            <p className="text-xs text-graphite-2">Cambia todas las puertas del mueble.</p>
          </div>
        )}
        {cell.content === 'drawer' && (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-graphite-2">Frente del cajón</span>
            <Segmented label="Frentes de cajón" value={plan.construction.drawerFronts} options={Object.entries(drawerFronts.options)} onChange={(v) => build({ drawerFronts: v as CabinetPlan['construction']['drawerFronts'] })} />
            <p className="text-xs text-graphite-2">Cambia los frentes de todos los cajones del mueble.</p>
          </div>
        )}
        {choicesFor(cell).map((key) => {
          const { label, options } = CABINET_LABELS.construction[key]
          const furniture = (options as Record<string, string>)[plan.construction[key]]
          return (
            <div key={key} className="flex flex-col gap-2">
              <span className="text-sm text-graphite-2">{label}</span>
              <Segmented label={label} value={cell.own?.[key] ?? 'inherit'} options={[['inherit', `Como el mueble (${furniture.toLowerCase()})`], ...Object.entries(options)]} onChange={(v) => own(key, v)} />
            </div>
          )
        })}
        {cell.content === 'door' && (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-graphite-2">Hojas</span>
            <Segmented label="Hojas" value={String(cell.doors ?? 1)} options={[['1', '1 hoja'], ['2', '2 hojas']]} onChange={(v) => change({ doors: Number(v) })} />
          </div>
        )}
        {cell.content !== 'void' && (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-graphite-2">Trasera</span>
            <Segmented
              label="Trasera"
              value={cell.back === undefined ? 'inherit' : String(cell.back)}
              options={[['inherit', `Como el mueble (${inherited})`], ['true', 'Con trasera'], ['false', 'Sin trasera']]}
              onChange={(v) => change({ back: v === 'inherit' ? undefined : v === 'true' })}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-sm text-graphite-2">Dividir</span>
          <div className="flex flex-wrap gap-2">
            {([['columns', 2, '2 columnas'], ['columns', 3, '3 columnas'], ['rows', 2, '2 filas'], ['rows', 3, '3 filas']] as const).map(([direction, n, label]) => (
              <Chip key={label} onClick={() => cut(direction, n)}>
                {label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm text-graphite-2">Juntar</span>
          {sides.length ? (
            <div className="flex flex-wrap gap-2">
              {sides.map((side) => (
                <Chip key={side} onClick={() => join(side)}>
                  {JOIN_WORDS[side]}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="text-xs text-graphite-2">Nada que juntar: este hueco no salió de dividir uno junto a él.</p>
          )}
        </div>
      </div>
    </section>
  )
}
