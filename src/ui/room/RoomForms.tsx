import { useState, type FormEvent } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import { Button } from '../system/components'
import { Field, Input, Select } from '../system/Field'
import { openingProblem, rectOf, validSpace, WALLS, type Item, type Layout, type Opening } from './layout'
import { useRoom } from './store'

const mm = (v: string) => (v.trim() ? Number(v.replace(',', '.')) * 10 : NaN)
const cm = (v: number) => String(Math.round(v) / 10)
const finite = (v: string) => Number.isFinite(mm(v))
const positive = (v: string) => finite(v) && mm(v) > 0 && mm(v) <= 15000
function Measure({ label, value, change, error, commit }: { label: string; value: string; change: (v: string) => void; error?: string | null; commit?: () => void }) {
  return (
    <Field label={`${label} (cm)`} error={error} className="min-w-0">
      <Input inputMode="decimal" value={value} invalid={!!error} onChange={(e) => change(e.target.value)} onBlur={commit} />
    </Field>
  )
}

/** Where the chosen piece sits, applied on Enter or on leaving a field. The height is the one measure the plan cannot drag. */
export function PlacementForm({ item }: { item: Item }) {
  const r = rectOf(item)
  const placed = [cm(r.x0), cm(r.z0), cm(item.elevation)]
  const [seen, setSeen] = useState(placed.join())
  const [left, setLeft] = useState(placed[0]),
    [back, setBack] = useState(placed[1]),
    [up, setUp] = useState(placed[2])
  const [error, setError] = useState<string | null>(null)
  if (seen !== placed.join()) {
    setSeen(placed.join())
    setLeft(placed[0])
    setBack(placed[1])
    setUp(placed[2])
    setError(null)
  }
  const apply = () => {
    if ([left, back, up].join() === placed.join()) return
    const values = [mm(left), mm(back), mm(up)]
    if (!values.every(Number.isFinite) || values[2] < 0) {
      setError('Escribe distancias numéricas y una altura de cero o más.')
      return
    }
    useRoom.getState().move(item.id, {
      x: values[0] + (r.x1 - r.x0) / 2,
      z: values[1] + (r.z1 - r.z0) / 2,
      elevation: values[2],
    })
    setError(null)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    apply()
  }
  const wallError = (v: string) => (error && !finite(v) ? 'Escribe una distancia numérica.' : null)
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-placement>
      <Measure label="Altura sobre el piso" value={up} change={setUp} commit={apply} error={error && (!finite(up) || mm(up) < 0) ? 'Escribe cero o más.' : null} />
      <details className="rounded-xl border border-line p-3" open={!!(wallError(left) || wallError(back)) || undefined}>
        <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">Distancia exacta a las paredes</summary>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Measure label="A la pared izquierda" value={left} change={setLeft} commit={apply} error={wallError(left)} />
          <Measure label="A la pared de arriba" value={back} change={setBack} commit={apply} error={wallError(back)} />
        </div>
      </details>
      <button type="submit" hidden />
    </form>
  )
}

function SpaceForm({ layout }: { layout: Layout }) {
  const [width, setWidth] = useState(cm(layout.room.width)),
    [depth, setDepth] = useState(cm(layout.room.depth)),
    [height, setHeight] = useState(cm(layout.room.height))
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const room = { width: mm(width), depth: mm(depth), height: mm(height) }
        if (!validSpace(room)) {
          setError('Escribe medidas entre 50 y 1,500 cm.')
          return
        }
        useRoom.getState().setRoom(room)
        setError(null)
      }}
    >
      <p className="font-medium">Medidas interiores</p>
      <div className="grid grid-cols-3 gap-2">
        <Measure label="Ancho" value={width} change={setWidth} error={error && (!finite(width) || mm(width) < 500 || mm(width) > 15000) ? error : null} />
        <Measure label="Fondo" value={depth} change={setDepth} error={error && (!finite(depth) || mm(depth) < 500 || mm(depth) > 15000) ? error : null} />
        <Measure label="Alto" value={height} change={setHeight} error={error && (!finite(height) || mm(height) < 500 || mm(height) > 15000) ? error : null} />
      </div>
      <Button variant="ghost" type="submit" className="min-h-11 justify-center border border-line">
        Aplicar medidas
      </Button>
    </form>
  )
}

function OpeningForm({ layout, opening: o }: { layout: Layout; opening: Opening }) {
  const [wall, setWall] = useState(o.wall),
    [offset, setOffset] = useState(cm(o.offset)),
    [width, setWidth] = useState(cm(o.width)),
    [height, setHeight] = useState(cm(o.height)),
    [sill, setSill] = useState(cm(o.sill))
  const [hinge, setHinge] = useState(o.hinge),
    [swing, setSwing] = useState(o.swing),
    [error, setError] = useState<string | null>(null)
  const length = wall === 'back' || wall === 'front' ? layout.room.width : layout.room.depth
  const tooWide = finite(offset) && finite(width) && mm(offset) + mm(width) > length
  const bottom = o.kind === 'door' ? 0 : mm(sill)
  const tooHigh = Number.isFinite(bottom) && finite(height) && bottom + mm(height) > layout.room.height
  const offsetError = error && (!finite(offset) || mm(offset) < 0 || tooWide) ? 'Revisa la distancia y el ancho: deben caber en esa pared.' : null
  const widthError = error && (!finite(width) || mm(width) <= 0 || tooWide) ? 'El ancho debe ser positivo y caber en esa pared.' : null
  const heightError = error && (!finite(height) || mm(height) <= 0 || tooHigh) ? 'El alto debe ser positivo y quedar debajo del techo.' : null
  const sillError = error && (!finite(sill) || mm(sill) < 0 || tooHigh) ? 'El inicio debe ser cero o más y dejar espacio hasta el techo.' : null
  return (
    <form
      className="flex flex-col gap-3 pt-3"
      onSubmit={(e) => {
        e.preventDefault()
        const updated: Opening = {
          ...o,
          wall,
          offset: mm(offset),
          width: mm(width),
          height: mm(height),
          sill: o.kind === 'door' ? 0 : mm(sill),
          hinge,
          swing,
        }
        const problem = openingProblem(layout.room, updated, layout.openings)
        if (problem) {
          setError(problem)
          return
        }
        useRoom.getState().setOpening(updated)
        setError(null)
      }}
    >
      <Field label="Pared" error={error?.includes('otra abertura') ? error : null}>
        <Select invalid={!!error?.includes('otra abertura')} value={wall} onChange={(e) => setWall(e.target.value as Opening['wall'])}>
          {WALLS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Measure label="Desde la esquina izquierda o de arriba" value={offset} change={setOffset} error={offsetError} />
      <div className="grid grid-cols-2 gap-3">
        <Measure label="Ancho de la abertura" value={width} change={setWidth} error={widthError} />
        <Measure label="Alto de la abertura" value={height} change={setHeight} error={heightError} />
      </div>
      {o.kind === 'window' ? (
        <Measure label="Del piso al inicio de la ventana" value={sill} change={setSill} error={sillError} />
      ) : (
        <>
          <Field label="Cómo abre">
            <Select value={swing} onChange={(e) => setSwing(e.target.value as Opening['swing'])}>
              <option value="inside">Hacia adentro</option>
              <option value="outside">Hacia afuera</option>
              <option value="sliding">Corrediza / paso sin hoja</option>
            </Select>
          </Field>
          {swing !== 'sliding' && (
            <Field label="Bisagra, vista desde el plano">
              <Select value={hinge} onChange={(e) => setHinge(e.target.value as Opening['hinge'])}>
                <option value="start">Extremo izquierdo o de arriba</option>
                <option value="end">Extremo derecho o de abajo</option>
              </Select>
            </Field>
          )}
        </>
      )}
      <div className="flex gap-2">
        <Button variant="ghost" type="submit" className="min-h-11 flex-1 justify-center border border-line">
          Aplicar abertura
        </Button>
        <Button variant="ghost" aria-label={`Quitar ${o.kind === 'door' ? 'puerta' : 'ventana'}`} onClick={() => useRoom.getState().removeOpening(o.id)}>
          <Trash />
        </Button>
      </div>
    </form>
  )
}

export function BlockForm() {
  const [name, setName] = useState('Mueble existente'),
    [width, setWidth] = useState('90'),
    [depth, setDepth] = useState('60'),
    [height, setHeight] = useState('100')
  const [error, setError] = useState<string | null>(null)
  return (
    <details className="rounded-xl border border-line p-3">
      <summary className="min-h-11 cursor-pointer content-center font-medium">Representar un espacio ocupado</summary>
      <form
        className="flex flex-col gap-3 pt-2"
        onSubmit={(e) => {
          e.preventDefault()
          const size = {
            width: mm(width),
            depth: mm(depth),
            height: mm(height),
          }
          if (!name.trim() || !Object.values(size).every((n) => Number.isFinite(n) && n > 0 && n <= 15000)) {
            setError('Pon un nombre y medidas positivas de hasta 1,500 cm.')
            return
          }
          useRoom.getState().addBlock(name.trim(), size)
        }}
      >
        <p className="text-sm text-graphite-2">Una cama que ya tienes, un refrigerador o una columna: se representa con un bloque.</p>
        <Field label="Nombre" error={error && !name.trim() ? 'Pon un nombre para reconocerlo.' : null}>
          <Input invalid={!!error && !name.trim()} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Measure label="Ancho" value={width} change={setWidth} error={error && !positive(width) ? 'Escribe una medida positiva de hasta 1,500 cm.' : null} />
          <Measure label="Fondo" value={depth} change={setDepth} error={error && !positive(depth) ? 'Escribe una medida positiva de hasta 1,500 cm.' : null} />
          <Measure label="Alto" value={height} change={setHeight} error={error && !positive(height) ? 'Escribe una medida positiva de hasta 1,500 cm.' : null} />
        </div>
        <Button variant="ghost" type="submit" className="min-h-11 justify-center border border-line">
          <Plus /> Agregar bloque
        </Button>
      </form>
    </details>
  )
}

export function SpaceEditor({ layout }: { layout: Layout }) {
  const chosen = useRoom((s) => s.opening)
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-graphite-2">
        Comparamos las medidas exteriores de los muebles cerrados; los huecos internos no se descuentan. Las ventanas se comprueban en su pared y a su altura; falta revisar cómo abren y el espacio
        para usar cajones y pasos. El armado se revisa en el Studio.
      </p>
      <p className="text-sm text-graphite-2">Empezamos con un cuarto de ejemplo, una puerta y una ventana. Puedes acercarlo a tu espacio.</p>
      <SpaceForm key={`${layout.room.width}:${layout.room.depth}:${layout.room.height}`} layout={layout} />
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" className="min-h-11 border border-line" onClick={() => useRoom.getState().addOpening('door')}>
          <Plus /> Puerta
        </Button>
        <Button variant="ghost" className="min-h-11 border border-line" onClick={() => useRoom.getState().addOpening('window')}>
          <Plus /> Ventana
        </Button>
      </div>
      {layout.openings.map((o, index) => (
        <details
          key={o.id}
          className="rounded-xl border border-line p-3"
          open={chosen === o.id}
          onToggle={(e) => {
            if (e.currentTarget.open !== (chosen === o.id)) useRoom.getState().chooseOpening(e.currentTarget.open ? o.id : null)
          }}
        >
          <summary className="min-h-11 cursor-pointer content-center font-medium">
            {o.kind === 'door' ? 'Puerta' : 'Ventana'} {layout.openings.slice(0, index + 1).filter((other) => other.kind === o.kind).length}
            {openingProblem(layout.room, o, layout.openings) ? ' · revisar medidas' : ''}
          </summary>
          <OpeningForm key={JSON.stringify(o)} layout={layout} opening={o} />
        </details>
      ))}
      <BlockForm />
    </div>
  )
}
