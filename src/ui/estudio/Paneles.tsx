import { X } from '@phosphor-icons/react'
import type { Diseno, TipoUnion } from '../../domain/diseno/esquema'
import { medidasCara, type Geometria } from '../../domain/diseno/resolver'
import type { Catalogo } from '../../domain/materiales/catalogo'
import { despiece } from '../../domain/materiales/despiece'
import { cm } from '../sistema/componentes'
import { useTienda } from '../tienda'
import { PieceEditor } from './PieceEditor'

const UNIONES: Record<TipoUnion, string> = {
  'tope-tornillo': 'tornillo al canto',
  bolsillo: 'tornillo de bolsillo',
  tarugo: 'tarugos',
  minifix: 'minifix',
  canal: 'canal',
  rebaje: 'rebaje',
  escuadra: 'escuadra',
  'clavo-pegamento': 'clavo y pegamento',
  'soporte-repisa': 'soportes de repisa',
  'bisagra-cazoleta': 'bisagras de cazoleta',
  corredera: 'correderas',
}

const VETA = { largo: 'a lo largo', ancho: 'a lo ancho', libre: 'libre' }

export function Piezas({ diseno, geo }: { diseno: Diseno; geo: Geometria }) {
  const seleccionar = useTienda((s) => s.seleccionar)
  const seleccion = useTienda((s) => s.seleccion)
  const lista = despiece(diseno, geo)
  const total = lista.reduce((n, r) => n + r.cantidad, 0)
  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-sm text-grafito-2">
        {total} piezas en {new Set(lista.map((r) => r.espesor)).size} espesores. Toca una para verla.
      </p>
      <ul className="flex flex-col divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-hueso">
        {lista.map((r) => (
          <li key={r.ids.join()}>
            <button
              type="button"
              onClick={() => seleccionar(r.ids[0])}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-kraft ${r.ids.includes(seleccion ?? '') ? 'bg-ambar-suave' : ''}`}
            >
              <span className="cifras grid size-8 shrink-0 place-items-center rounded-lg bg-kraft text-sm font-medium">{r.cantidad}×</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.nombre}</span>
                <span className="cifras block text-xs text-grafito-2">
                  {r.largo} × {r.ancho} mm · {cm(r.largo)} × {cm(r.ancho)}
                </span>
              </span>
              <span className="cifras shrink-0 rounded-full border border-linea px-2 py-0.5 text-xs">{r.espesor} mm</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function FichaPieza({ diseno, geo, catalogo, editable = false }: { diseno: Diseno; geo: Geometria; catalogo: Catalogo; editable?: boolean }) {
  const confirmarPieza = useTienda((s) => s.confirmarPieza)
  const seleccion = useTienda((s) => s.seleccion)
  const seleccionar = useTienda((s) => s.seleccionar)
  const p = diseno.piezas.find((x) => x.id === seleccion)
  const caja = p && geo.cajas.get(p.id)
  if (!p || !caja) return null
  const [largo, ancho] = medidasCara(caja, p.normal)
  const material = catalogo.materiales.find((m) => m.id === p.material)
  const nombre = (id: string) => diseno.piezas.find((x) => x.id === id)?.nombre ?? id
  const uniones = diseno.uniones.filter((u) => u.a === p.id || u.b === p.id)
  return (
    <div className="animate-aparecer pointer-events-auto w-full max-w-sm rounded-2xl md:w-80 border border-linea bg-hueso/95 p-4 shadow-[0_18px_40px_-20px_rgba(43,40,37,.5)] backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-titulo text-lg font-semibold">{p.nombre}</p>
          <p className="text-xs text-grafito-2">{material?.nombre ?? p.material}</p>
        </div>
        <button type="button" onClick={() => seleccionar(null)} aria-label="Cerrar" className="grid size-8 place-items-center rounded-full hover:bg-kraft">
          <X />
        </button>
      </div>
      <dl className="cifras mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ['Largo', largo],
          ['Ancho', ancho],
          ['Espesor', geo.espesores.get(p.id)!],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-kraft px-2 py-2">
            <dt className="font-sans text-[10px] tracking-wide text-grafito-2 uppercase">{k}</dt>
            <dd className="text-base font-medium">{Math.round(v as number)}</dd>
            <dd className="text-[10px] text-grafito-2">{cm(v as number)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-grafito-2">Veta {VETA[p.veta]}</p>
      <PieceEditor key={p.id} piece={p} box={caja} catalog={catalogo} enabled={editable} />
      {p.confianza === 'baja' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-papel px-3 py-2 text-xs text-grafito">
          <span className="flex-1">El experto no pudo confirmar esta pieza con las fotos.</span>
          <button type="button" onClick={() => confirmarPieza(p.id)} className="rounded-full bg-grafito px-3 py-1 font-medium text-hueso">
            Está bien así
          </button>
        </div>
      )}
      {uniones.length > 0 && (
        <ul className="mt-3 flex max-h-36 flex-col gap-1 overflow-y-auto border-t border-linea pt-3 text-sm">
          {uniones.map((u) => {
            const otra = u.a === p.id ? u.b : u.a
            const cantidad = u.herrajes.reduce((n, h) => n + (h.cantidad ?? 0), 0)
            return (
              <li key={u.id} className="flex gap-2">
                <span className="text-ambar">→</span>
                <span>
                  <button type="button" className="font-medium underline decoration-linea underline-offset-2 hover:decoration-ambar" onClick={() => seleccionar(otra)}>
                    {nombre(otra)}
                  </button>
                  : {cantidad ? `${cantidad} ` : ''}
                  {UNIONES[u.tipo]}
                  {u.pegamento && u.tipo !== 'clavo-pegamento' ? ' con pegamento' : ''}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
