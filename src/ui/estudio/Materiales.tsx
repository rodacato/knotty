import { ArrowCounterClockwise, Check, Info, PencilSimple, Sliders } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import type { Diseno } from '../../domain/diseno/esquema'
import type { Geometria } from '../../domain/diseno/resolver'
import type { AcomodoMaterial } from '../../domain/materiales/acomodo'
import { aplicarAjustes, type Acomodo, type Catalogo } from '../../domain/materiales/catalogo'
import { estimarCompra } from '../../domain/materiales/compra'
import { Titulo } from '../sistema/componentes'
import { useTienda } from '../tienda'
import { Piezas } from './Paneles'

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const porcentaje = (f: number) => `${Math.round(f * 100)} %`
const metros = (mm: number) => `${(mm / 1000).toLocaleString('es-MX', { maximumFractionDigits: 2 })} m`

/** Un precio que el usuario puede corregir con el de su tienda; el cambio vive en su dispositivo. */
function Precio({ id, valor, base, unidad }: { id: string; valor: number | null; base: number | null; unidad: string }) {
  const ajustes = useTienda((s) => s.ajustesCatalogo)
  const guardar = useTienda((s) => s.guardarAjustesCatalogo)
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const cambiado = id in ajustes.precios

  const confirmar = () => {
    const n = Number(texto.replace(/[$,\s]/g, ''))
    guardar({ ...ajustes, precios: { ...ajustes.precios, [id]: texto.trim() === '' || !Number.isFinite(n) ? null : n } })
    setEditando(false)
  }
  const restablecer = () => {
    const { [id]: _, ...resto } = ajustes.precios
    guardar({ ...ajustes, precios: resto })
  }

  if (editando)
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault()
          confirmar()
        }}
      >
        <input
          autoFocus
          inputMode="decimal"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label="Precio en pesos"
          className="cifras w-20 rounded-lg border border-ambar bg-hueso px-2 py-1 text-right text-xs outline-none"
        />
        <button type="submit" aria-label="Guardar precio" className="grid size-7 place-items-center rounded-full bg-grafito text-hueso">
          <Check size={12} weight="bold" />
        </button>
      </form>
    )
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => {
          setTexto(valor === null ? '' : String(valor))
          setEditando(true)
        }}
        className={`cifras inline-flex items-center gap-1 rounded-md px-1 text-xs transition hover:bg-kraft ${cambiado ? 'text-grafito' : 'text-grafito-2'}`}
        title="Cambiar por el precio de tu tienda"
      >
        {valor === null ? 'sin precio' : `${pesos.format(valor)} ${unidad}`} <PencilSimple size={11} />
      </button>
      {cambiado && valor !== base && (
        <button type="button" onClick={restablecer} aria-label="Volver al precio del catálogo" title="Volver al precio del catálogo" className="text-grafito-2 hover:text-grafito">
          <ArrowCounterClockwise size={11} />
        </button>
      )}
    </span>
  )
}

/** El acomodo de una hoja como en un plano: refilado rayado, piezas en madera, sobrante en blanco. */
function DiagramaHoja({ a, indice, total }: { a: AcomodoMaterial; indice: number; total: number }) {
  const seleccion = useTienda((s) => s.seleccion)
  const seleccionar = useTienda((s) => s.seleccionar)
  const hoja = a.hojas[indice]
  const refilado = (a.hoja.largo - a.util.largo) / 2
  const patron = `rayado-${a.material}-${indice}`
  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="flex items-baseline justify-between text-xs text-grafito-2">
        <span>
          Hoja {indice + 1} de {total}
        </span>
        <span className="cifras">desperdicio {porcentaje(hoja.desperdicio)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${a.hoja.largo} ${a.hoja.ancho}`} className="w-full rounded-md border border-linea" role="img" aria-label={`Acomodo de la hoja ${indice + 1}`}>
        <defs>
          <pattern id={patron} width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="40" stroke="var(--grafito-2)" strokeOpacity="0.25" strokeWidth="6" />
          </pattern>
        </defs>
        <rect width={a.hoja.largo} height={a.hoja.ancho} fill={`url(#${patron})`} />
        <rect x={refilado} y={refilado} width={a.util.largo} height={a.util.ancho} fill="var(--hueso)" />
        {hoja.colocadas.map((c) => {
          const activa = seleccion === c.id
          const grande = c.w > 360 && c.h > 110
          return (
            <g key={c.id} onClick={() => seleccionar(c.id)} className="cursor-pointer">
              <rect x={refilado + c.x} y={refilado + c.y} width={c.w} height={c.h} fill={activa ? '#d98a2b' : '#e2c9a2'} stroke="#2b2825" strokeOpacity="0.6" strokeWidth="5" />
              {grande && (
                <text x={refilado + c.x + c.w / 2} y={refilado + c.y + c.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(64, c.h * 0.32)} fill="#2b2825" style={{ fontFamily: 'var(--font-sans)' }}>
                  {c.nombre}
                  <tspan x={refilado + c.x + c.w / 2} dy="1.2em" fontSize={Math.min(52, c.h * 0.26)} fillOpacity="0.7" style={{ fontFamily: 'var(--font-mono)' }}>
                    {Math.round(c.rotada ? c.h : c.w)} × {Math.round(c.rotada ? c.w : c.h)}
                  </tspan>
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

function AjustesCorte({ base }: { base: Acomodo }) {
  const ajustes = useTienda((s) => s.ajustesCatalogo)
  const guardar = useTienda((s) => s.guardarAjustesCatalogo)
  const actual = ajustes.acomodo ?? base
  const campos: { clave: keyof Acomodo; nombre: string; ayuda: string }[] = [
    { clave: 'refilado', nombre: 'Refilado', ayuda: 'Canto de fábrica que se recorta por lado' },
    { clave: 'sierra', nombre: 'Corte', ayuda: 'Lo que se come la sierra' },
    { clave: 'holgura', nombre: 'Holgura', ayuda: 'Margen por pieza' },
  ]
  return (
    <details className="rounded-2xl border border-linea bg-hueso p-4 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <Sliders /> Ajustes de corte
      </summary>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {campos.map((c) => (
          <label key={c.clave} className="flex flex-col gap-1" title={c.ayuda}>
            <span className="text-xs text-grafito-2">{c.nombre}</span>
            <span className="flex items-baseline gap-1 rounded-xl border border-linea px-2 focus-within:border-ambar">
              <input
                type="number"
                min={0}
                step={1}
                value={actual[c.clave]}
                onChange={(e) => guardar({ ...ajustes, acomodo: { ...actual, [c.clave]: Math.max(0, Number(e.target.value)) } })}
                className="cifras min-h-9 w-full bg-transparent outline-none"
              />
              <span className="cifras text-xs text-grafito-2">mm</span>
            </span>
          </label>
        ))}
      </div>
      {ajustes.acomodo && (
        <button type="button" className="mt-2 text-xs text-grafito-2 underline" onClick={() => guardar({ ...ajustes, acomodo: null })}>
          Volver a los valores del catálogo
        </button>
      )}
    </details>
  )
}

export function Materiales({ diseno, geo, catalogo }: { diseno: Diseno; geo: Geometria; catalogo: Catalogo }) {
  const ajustes = useTienda((s) => s.ajustesCatalogo)
  const efectivo = useMemo(() => aplicarAjustes(catalogo, ajustes), [catalogo, ajustes])
  const compra = useMemo(() => estimarCompra(diseno, geo, efectivo), [diseno, geo, efectivo])
  const base = (id: string) => [...catalogo.materiales, ...catalogo.herrajes].find((x) => x.id === id)?.precio ?? null
  const totalHojas = compra.hojas.reduce((s, h) => s + h.hojas, 0)

  return (
    <div className="flex flex-col gap-4 p-4">
      <section className="flex flex-col gap-2 rounded-2xl border border-linea bg-hueso p-4">
        <p className="text-xs font-medium tracking-wide text-grafito-2 uppercase">Para comprar</p>
        <p className="font-titulo text-4xl font-semibold tracking-tight [font-variation-settings:'opsz'_96]">
          {pesos.format(compra.costo.total)}
          <span className="ml-2 align-middle text-sm font-normal text-grafito-2">aprox.</span>
        </p>
        <p className="text-sm text-grafito-2">
          {totalHojas} {totalHojas === 1 ? 'hoja' : 'hojas'} de triplay, herrajes y cubrecanto.
        </p>
        <p className="flex items-start gap-2 rounded-xl bg-ambar-suave px-3 py-2 text-xs">
          <Info className="mt-0.5 shrink-0" />
          <span>
            Es una estimación para comprar, no un plano de corte. {catalogo.notaPrecios}
            {compra.costo.faltanPrecios.length > 0 && ` Sin precio: ${compra.costo.faltanPrecios.join(', ')}.`}
          </span>
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <Titulo className="text-lg">Hojas de triplay</Titulo>
        {compra.hojas.map((h) => {
          const a = compra.acomodo.find((x) => x.material === h.material.id)!
          return (
            <div key={h.material.id} className="flex flex-col gap-3 rounded-2xl border border-linea bg-hueso p-4">
              <div className="flex items-start gap-3">
                <span className="cifras grid size-10 shrink-0 place-items-center rounded-xl bg-grafito text-lg font-medium text-hueso">{h.hojas}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{h.material.nombre}</p>
                  <p className="cifras text-xs text-grafito-2">
                    {metros(h.material.hoja.ancho)} × {metros(h.material.hoja.largo)} · desperdicio {porcentaje(h.desperdicio)}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="cifras text-sm font-medium">{h.costo === null ? '—' : pesos.format(h.costo)}</span>
                  <Precio id={h.material.id} valor={h.material.precio} base={base(h.material.id)} unidad="por hoja" />
                </div>
              </div>
              {a.sinLugar.length > 0 && <p className="text-xs text-oxido">No caben en una hoja: {a.sinLugar.map((p) => p.nombre).join(', ')}. Cuentan como hoja aparte.</p>}
              {a.hojas.map((_, i) => (
                <DiagramaHoja key={i} a={a} indice={i} total={a.hojas.length} />
              ))}
            </div>
          )
        })}
        <AjustesCorte base={catalogo.acomodo} />
      </section>

      <section className="flex flex-col gap-3">
        <Titulo className="text-lg">Herrajes y consumibles</Titulo>
        <ul className="flex flex-col divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-hueso">
          {compra.herrajes.map((r) => (
            <li key={r.herraje.id} className="flex items-center gap-3 px-4 py-3">
              <span className="cifras min-w-12 shrink-0 text-sm font-medium">
                {r.cantidad}
                {r.herraje.unidad === 'metro' ? ' m' : ''}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{r.herraje.nombre}</span>
                {r.paquetes !== null && (
                  <span className="block text-xs text-grafito-2">
                    {r.paquetes} {r.paquetes === 1 ? 'paquete' : 'paquetes'} de {r.herraje.porPaquete}
                  </span>
                )}
              </span>
              <span className="flex flex-col items-end">
                <span className="cifras text-sm">{r.costo === null ? '—' : pesos.format(r.costo)}</span>
                <Precio id={r.herraje.id} valor={r.herraje.precio} base={base(r.herraje.id)} unidad={r.herraje.porPaquete ? 'por paquete' : r.herraje.unidad === 'metro' ? 'por metro' : 'c/u'} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="-mx-4 flex flex-col">
        <Titulo className="px-4 text-lg">Lista de corte</Titulo>
        <Piezas diseno={diseno} geo={geo} />
      </section>
    </div>
  )
}
