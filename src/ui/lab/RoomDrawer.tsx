import { ArrowClockwise, Door, Plus, SquareSplitVertical, Trash } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Button } from '../system/components'
import { Field, Input, Select } from '../system/Field'
import { CONFLICT_TEXT, conflicts, type Opening, type Room, type Wall } from './room'
import { useModels } from './roomModels'
import { useRoom } from './roomStore'
import { matchesText } from './variants'

// «Cuarto»: the room's measures, the fichas on its floor, and the catalog to add more. The room itself is drawn in the main area while this is open.

const MEASURES: [keyof Room, string][] = [
  ['width', 'Ancho'],
  ['depth', 'Fondo'],
  ['height', 'Alto'],
]

const WALLS: [Wall, string][] = [
  ['back', 'Fondo'],
  ['left', 'Izquierdo'],
  ['right', 'Derecho'],
  ['front', 'Frente'],
]

const iconButton = 'relative grid size-9 shrink-0 place-items-center rounded-full text-graphite-2 hover:bg-kraft before:absolute before:-inset-1 before:content-[""]'

export function RoomDrawer() {
  const { room, items, openings, selected, setRoom, add, turn, remove, select, addOpening, changeOpening, removeOpening } = useRoom()
  const models = useModels()
  const [text, setText] = useState('')
  const bad = useMemo(() => conflicts(room, items, (code) => models.get(code)?.design.dimensions, openings), [room, items, models, openings])
  const found = useMemo(() => [...models.values()].filter((m) => matchesText(m.reference, text)), [models, text])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex min-h-15 shrink-0 flex-col justify-center pr-14 pl-4">
        <h2 className="font-display text-lg leading-tight font-semibold">Cuarto</h2>
        <p className="text-xs leading-snug text-graphite-2">Acomoda fichas en un cuarto: arrástralas sobre el piso, se pegan a los muros y a sus vecinas. No se guarda.</p>
      </div>

      <section className="grid grid-cols-3 gap-2 px-3 pb-3" aria-label="Medidas del cuarto">
        {MEASURES.map(([key, label]) => (
          <Field key={key} label={label}>
            <Input type="number" inputMode="numeric" unit="mm" min={500} max={10000} value={room[key]} onChange={(e) => e.target.valueAsNumber > 0 && setRoom({ [key]: e.target.valueAsNumber })} />
          </Field>
        ))}
      </section>

      <section className="flex flex-col gap-2 border-t border-line px-3 py-3" aria-label="Puertas y ventanas">
        <div className="flex items-center gap-2 px-1">
          <h3 className="flex-1 text-sm font-semibold">Puertas y ventanas</h3>
          <Button variant="ghost" className="px-2 text-xs" onClick={() => addOpening('door')}>
            <Door /> Puerta
          </Button>
          <Button variant="ghost" className="px-2 text-xs" onClick={() => addOpening('window')}>
            <SquareSplitVertical /> Ventana
          </Button>
        </div>
        {openings.map((o) => (
          <OpeningRow key={o.key} opening={o} onChange={(change) => changeOpening(o.key, change)} onRemove={() => removeOpening(o.key)} />
        ))}
      </section>

      <section className="flex flex-col gap-1 border-t border-line px-3 py-3" aria-label="En el cuarto">
        <h3 className="px-1 text-sm font-semibold">En el cuarto</h3>
        {!items.length && <p className="px-1 text-xs text-graphite-2">Todavía nada. Agrega una ficha de abajo.</p>}
        {items.map((item) => {
          const model = models.get(item.code)
          return (
            <div key={item.key} className={`flex min-h-11 items-center gap-2 rounded-lg border px-2 ${selected === item.key ? 'border-amber bg-amber-soft' : 'border-transparent'}`}>
              <button type="button" className="flex min-w-0 flex-1 flex-col text-left" onClick={() => select(item.key)}>
                <span className="truncate text-sm font-medium">{model?.reference.name ?? item.code}</span>
                <span className="font-mono text-[11px] text-graphite-2">
                  {item.code} · {item.turn}°{bad.has(item.key) ? ` · ${bad.get(item.key)!.map((c) => CONFLICT_TEXT[c]).join(', ')}` : ''}
                </span>
              </button>
              <button type="button" className={iconButton} aria-label={`Girar ${model?.reference.name ?? item.code}`} onClick={() => turn(item.key)}>
                <ArrowClockwise />
              </button>
              <button type="button" className={iconButton} aria-label={`Quitar ${model?.reference.name ?? item.code}`} onClick={() => remove(item.key)}>
                <Trash />
              </button>
            </div>
          )
        })}
      </section>

      <section className="flex flex-col gap-2 border-t border-line px-3 py-3" aria-label="Agregar una ficha">
        <h3 className="px-1 text-sm font-semibold">Agregar</h3>
        <Field label="Buscar una ficha" hiddenLabel>
          <Input type="search" placeholder="Código o nombre: GN-CAM-02, librero" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <div className="flex flex-col">
          {found.map(({ reference: r, design }) => (
            <button key={r.code} type="button" onClick={() => add(r.code)} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-left hover:bg-kraft">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{r.name}</span>
                <span className="numerals font-mono text-[11px] text-graphite-2">
                  {r.code} · {Math.round(design.dimensions.width)} × {Math.round(design.dimensions.depth)} mm
                </span>
              </span>
              <Plus className="shrink-0 text-graphite-2" aria-hidden />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

/** A door or a window: its wall, where it starts along it, and its size; a window also says how high its sill is. */
function OpeningRow({ opening: o, onChange, onRemove }: { opening: Opening; onChange: (change: Partial<Opening>) => void; onRemove: () => void }) {
  const name = o.kind === 'door' ? 'Puerta' : 'Ventana'
  const measures: [keyof Opening, string][] = [['offset', 'Desde la esquina'], ['width', 'Ancho'], ['height', 'Alto'], ...(o.kind === 'window' ? [['sill', 'Antepecho'] as [keyof Opening, string]] : [])]
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line p-2">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-medium">{name}</span>
        <Field label={`Muro de la ${name.toLowerCase()}`} hiddenLabel>
          <Select size="sm" value={o.wall} onChange={(e) => onChange({ wall: e.target.value as Wall })}>
            {WALLS.map(([wall, label]) => (
              <option key={wall} value={wall}>
                Muro {label.toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <button type="button" className={iconButton} aria-label={`Quitar la ${name.toLowerCase()}`} onClick={onRemove}>
          <Trash />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {measures.map(([key, label]) => (
          <Field key={key} label={label}>
            <Input size="sm" type="number" inputMode="numeric" unit="mm" min={0} value={o[key] as number} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && onChange({ [key]: e.target.valueAsNumber })} />
          </Field>
        ))}
      </div>
    </div>
  )
}
