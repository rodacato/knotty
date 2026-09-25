import { ArrowCounterClockwise, Eye, EyeSlash, Plus, X } from '@phosphor-icons/react'
import { useState } from 'react'
import { disenoActual, type EstadoDiseno } from '../../domain/sesion/estado'
import { Boton } from '../sistema/componentes'
import { useTienda } from '../tienda'
import { TraceLog } from './TraceLog'

const relativo = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' })

function hace(fecha: string) {
  const segundos = (new Date(fecha).getTime() - Date.now()) / 1000
  if (Number.isNaN(segundos)) return ''
  const unidades: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unidad, tamano] of unidades) if (Math.abs(segundos) >= tamano) return relativo.format(Math.round(segundos / tamano), unidad)
  return 'hace un momento'
}

const ORIGEN: Record<string, string> = { simulado: 'Simulado', anthropic: 'Claude', openai: 'OpenAI', shellm: 'SheLLM' }

/** Lo que el experto recuerda entre cambios: requisitos del usuario y decisiones de diseño. Se pueden quitar o agregar notas. */
function Memoria({ estado }: { estado: EstadoDiseno }) {
  const agregarNota = useTienda((s) => s.agregarNota)
  const quitarNota = useTienda((s) => s.quitarNota)
  const quitarDecision = useTienda((s) => s.quitarDecision)
  const [nota, setNota] = useState('')
  const ficha = (texto: string, alQuitar: () => void, clave: string) => (
    <li key={clave} className="animate-aparecer flex items-start gap-2 rounded-xl bg-kraft px-3 py-2 text-sm">
      <span className="flex-1 leading-snug">{texto}</span>
      <button type="button" onClick={alQuitar} aria-label={`Quitar: ${texto}`} className="mt-0.5 text-grafito-2 hover:text-oxido">
        <X size={14} />
      </button>
    </li>
  )
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-linea bg-hueso p-4">
      <div>
        <h3 className="font-titulo text-base font-semibold">Lo que el experto recuerda</h3>
        <p className="text-xs text-grafito-2">Se lo recuerda en cada cambio. Quita lo que ya no aplique.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium tracking-wide text-grafito-2 uppercase">Tus requisitos</p>
        {estado.requisitos.length ? (
          <ul className="flex flex-col gap-1.5">{estado.requisitos.map((r) => ficha(r.texto, () => quitarNota(r.id), r.id))}</ul>
        ) : (
          <p className="text-sm text-grafito-2">Nada todavía: dile al experto cosas como «mi espacio mide 90 cm».</p>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            agregarNota(nota)
            setNota('')
          }}
        >
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Agregar una nota: «lo voy a pintar»"
            aria-label="Nota para el experto"
            className="min-h-10 flex-1 rounded-xl border border-linea bg-hueso px-3 text-sm outline-none focus:border-ambar"
          />
          <Boton type="submit" variante="secundario" className="min-h-10 px-3" disabled={!nota.trim()} aria-label="Agregar nota">
            <Plus weight="bold" />
          </Boton>
        </form>
      </div>
      {estado.decisiones.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-wide text-grafito-2 uppercase">Decisiones de diseño</p>
          <ul className="flex flex-col gap-1.5">{estado.decisiones.map((d) => ficha(d.texto, () => quitarDecision(d.tema), d.tema))}</ul>
        </div>
      )}
    </section>
  )
}

export function Historial({ estado }: { estado: EstadoDiseno }) {
  const versionVista = useTienda((s) => s.versionVista)
  const verVersion = useTienda((s) => s.verVersion)
  const volverAVersion = useTienda((s) => s.volverAVersion)
  const pensando = useTienda((s) => s.pensando)
  const versiones = [...estado.versiones].sort((a, b) => b.n - a.n)

  return (
    <div className="flex flex-col gap-4 p-4">
      <Memoria estado={estado} />
      {estado.miniaturas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="font-titulo text-base font-semibold">Tus fotos</h3>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {estado.miniaturas.map((m) => (
              <figure key={m.angulo} className="flex shrink-0 flex-col items-center gap-1">
                <img src={m.dataUrl} alt={`Foto ${m.angulo}`} className="size-20 rounded-xl border border-linea object-cover" />
                <figcaption className="text-[11px] text-grafito-2">{m.angulo}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
      <section>
        <h3 className="mb-3 font-titulo text-base font-semibold">Versiones</h3>
        <ol className="relative flex flex-col gap-3 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-linea">
          {versiones.map((v) => {
            const actual = v.n === estado.actual
            const viendo = v.n === versionVista
            return (
              <li key={v.n} className="animate-aparecer relative flex gap-3">
                <span className={`z-10 mt-1 grid size-6 shrink-0 place-items-center rounded-full border-2 ${actual ? 'border-ambar bg-ambar' : viendo ? 'border-ambar bg-hueso' : 'border-linea bg-hueso'}`}>
                  {actual && <span className="size-2 rounded-full bg-hueso" />}
                </span>
                <div className={`flex min-w-0 flex-1 flex-col gap-1.5 rounded-2xl border p-3 transition ${viendo ? 'border-ambar bg-ambar-suave' : 'border-linea bg-hueso'}`}>
                  <div className="flex items-baseline gap-2">
                    <span className="cifras text-xs text-grafito-2">v{v.n}</span>
                    <span className="min-w-0 flex-1 font-medium leading-snug">{v.resumen}</span>
                    {actual && <span className="rounded-full bg-grafito px-2 py-px text-[10px] font-medium text-hueso">Actual</span>}
                  </div>
                  {v.motivo && v.motivo !== v.resumen && !v.motivo.startsWith('Volver a v') && <p className="text-sm text-grafito-2">«{v.motivo}»</p>}
                  <p className="text-[11px] text-grafito-2">
                    {hace(v.fecha)}
                    {v.origen && ` · ${ORIGEN[v.origen.proveedor] ?? v.origen.proveedor}`}
                    {v.operaciones.length > 0 && ` · ${v.operaciones.length} ${v.operaciones.length === 1 ? 'operación' : 'operaciones'}`}
                  </p>
                  {!actual && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Boton variante="secundario" className="min-h-8 px-3 text-xs" onClick={() => verVersion(viendo ? null : v.n)}>
                        {viendo ? <EyeSlash /> : <Eye />} {viendo ? 'Dejar de ver' : 'Ver'}
                      </Boton>
                      <Boton variante="fantasma" className="min-h-8 px-3 text-xs" disabled={pensando} onClick={() => volverAVersion(v.n)}>
                        <ArrowCounterClockwise /> Volver a esta
                      </Boton>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </section>
      <details className="rounded-2xl border border-linea bg-hueso/60 p-3">
        <summary className="cursor-pointer text-sm font-medium">Bitácora: qué hizo el experto</summary>
        <div className="mt-3">
          <TraceLog trace={estado.trace} pieces={disenoActual(estado).piezas} />
        </div>
      </details>
    </div>
  )
}
