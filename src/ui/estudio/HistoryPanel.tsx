import { ArrowCounterClockwise, Eye, EyeSlash } from '@phosphor-icons/react'
import { disenoActual, type EstadoDiseno } from '../../domain/sesion/estado'
import { ChangeList } from '../chat/ChangeList'
import { Boton } from '../sistema/componentes'
import { useTienda } from '../tienda'
import { TraceLog } from './TraceLog'

// Every version, newest first, with what changed in each and how to go back: seen from the header, not a tab.

const relative = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' })

function ago(date: string) {
  const seconds = (new Date(date).getTime() - Date.now()) / 1000
  if (Number.isNaN(seconds)) return ''
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  return 'hace un momento'
}

const PROVIDER: Record<string, string> = { simulado: 'Simulado', anthropic: 'Claude', openai: 'OpenAI', shellm: 'SheLLM' }

export function HistoryPanel({ estado }: { estado: EstadoDiseno }) {
  const versionVista = useTienda((s) => s.versionVista)
  const verVersion = useTienda((s) => s.verVersion)
  const volverAVersion = useTienda((s) => s.volverAVersion)
  const pensando = useTienda((s) => s.pensando)
  const versions = [...estado.versiones].sort((a, b) => b.n - a.n)

  return (
    <div className="flex flex-col gap-4 p-4">
      <ol className="relative flex flex-col gap-3 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-linea">
        {versions.map((v) => {
          const current = v.n === estado.actual
          const viewing = v.n === versionVista
          return (
            <li key={v.n} className="animate-aparecer relative flex gap-3">
              <span className={`z-10 mt-1 grid size-6 shrink-0 place-items-center rounded-full border-2 ${current ? 'border-ambar bg-ambar' : viewing ? 'border-ambar bg-hueso' : 'border-linea bg-hueso'}`}>
                {current && <span className="size-2 rounded-full bg-hueso" />}
              </span>
              <div className={`flex min-w-0 flex-1 flex-col gap-1.5 rounded-2xl border p-3 transition ${viewing ? 'border-ambar bg-ambar-suave' : 'border-linea bg-hueso'}`}>
                <div className="flex items-baseline gap-2">
                  <span className="cifras text-xs text-grafito-2">v{v.n}</span>
                  <span className="min-w-0 flex-1 leading-snug font-medium">{v.resumen}</span>
                  {current && <span className="rounded-full bg-grafito px-2 py-px text-[10px] font-medium text-hueso">Actual</span>}
                </div>
                {v.motivo && v.motivo !== v.resumen && !v.motivo.startsWith('Volver a v') && <p className="line-clamp-3 text-sm whitespace-pre-line text-grafito-2" title={v.motivo}>«{v.motivo}»</p>}
                <p className="text-[11px] text-grafito-2">
                  {ago(v.fecha)}
                  {v.origen && ` · ${PROVIDER[v.origen.proveedor] ?? v.origen.proveedor}`}
                  {v.operaciones.length > 0 && ` · ${v.operaciones.length} ${v.operaciones.length === 1 ? 'operación' : 'operaciones'}`}
                </p>
                <ChangeList estado={estado} version={v.n} />
                {!current && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Boton variante="secundario" className="min-h-8 px-3 text-xs" onClick={() => verVersion(viewing ? null : v.n)}>
                      {viewing ? <EyeSlash /> : <Eye />} {viewing ? 'Dejar de ver' : 'Ver'}
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
      <details className="rounded-2xl border border-linea bg-hueso/60 p-3">
        <summary className="cursor-pointer text-sm font-medium">Bitácora: qué hizo el experto</summary>
        <div className="mt-3">
          <TraceLog trace={estado.trace} pieces={disenoActual(estado).piezas} />
        </div>
      </details>
    </div>
  )
}
