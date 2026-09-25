import { ArrowClockwise, CheckCircle, Hammer, Lightbulb, Stop, Warning, WarningCircle, Wrench, XCircle } from '@phosphor-icons/react'
import type { Design } from '../../domain/diseno/schema'
import type { PurchaseReview as DatosDictamen } from '../../domain/sesion/state'
import type { Check, Verdict } from '../../domain/viabilidad/viability'
import { Boton, Lapiz } from '../sistema/componentes'
import { useTienda } from '../tienda'

const VEREDICTOS: Record<Verdict, { titulo: string; clase: string; icono: React.ReactNode }> = {
  viable: { titulo: 'Se puede hacer', clase: 'border-pizarra/40 bg-pizarra/10 text-pizarra', icono: <CheckCircle weight="fill" /> },
  'con-cambios': { titulo: 'Arréglalo antes de comprar', clase: 'border-ambar/50 bg-ambar-suave text-grafito', icono: <WarningCircle weight="fill" className="text-ambar" /> },
  'no-viable': { titulo: 'Así no se puede hacer', clase: 'border-oxido/40 bg-oxido/10 text-oxido', icono: <XCircle weight="fill" /> },
}

const ICONO_COMPROBACION: Record<Check['estado'], React.ReactNode> = {
  ok: <CheckCircle weight="fill" className="text-pizarra" />,
  aviso: <WarningCircle weight="fill" className="text-ambar" />,
  falla: <XCircle weight="fill" className="text-oxido" />,
}

const GRAVEDAD = { alta: 'border-oxido/40 text-oxido', media: 'border-ambar/60 text-grafito', baja: 'border-linea text-grafito-2' }

const QUE_REVISA = ['Que las medidas cierren', 'Que cada pieza quepa en la hoja real', 'Estructura y estabilidad', 'Que se pueda cortar y armar', 'Que las medidas tengan sentido para ese mueble']

/** Antes de la lista de compra: nadie debería comprar sin que alguien revise el plano. */
export function PuertaRevision({ desactualizado }: { desactualizado: boolean }) {
  const dictaminar = useTienda((s) => s.dictaminar)
  const cancelar = useTienda((s) => s.cancelarDictamen)
  const dictaminando = useTienda((s) => s.dictaminando)
  const error = useTienda((s) => s.errorDictamen)

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-linea bg-hueso p-4">
      <p className="flex items-start gap-2 font-medium">
        <Hammer weight="duotone" className="mt-1 shrink-0 text-ambar" /> {desactualizado ? 'Cambió el diseño o los ajustes de corte: hay que revisar de nuevo' : 'Antes de comprar, una revisión'}
      </p>
      <p className="text-sm text-grafito-2">
        Un carpintero revisa tu diseño completo para que no compres algo que no se puede armar. Tarda unos segundos; con tu experto conectado, hasta un par de minutos.
      </p>
      <ul className="flex flex-col gap-1 text-sm">
        {QUE_REVISA.map((q) => (
          <li key={q} className="flex items-center gap-2 text-grafito-2">
            <CheckCircle className="shrink-0 text-grafito/30" /> {q}
          </li>
        ))}
      </ul>
      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-oxido/30 bg-oxido/10 p-3 text-sm text-oxido">
          <Warning className="mt-0.5 shrink-0" weight="bold" /> {error}
        </p>
      )}
      {dictaminando ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-kraft/60 px-3 py-2 text-sm" aria-live="polite">
          <span className="flex items-center gap-2">
            <Lapiz className="h-5 w-12 text-ambar" /> Revisando el plano…
          </span>
          <Boton variante="fantasma" className="min-h-8 px-2 text-xs" onClick={cancelar}>
            <Stop weight="fill" /> Cancelar
          </Boton>
        </div>
      ) : (
        <Boton variante="primario" className="min-h-11 self-start px-5" onClick={() => void dictaminar()}>
          {error ? <ArrowClockwise weight="bold" /> : <Hammer weight="bold" />} {error ? 'Reintentar' : desactualizado ? 'Revisar de nuevo' : 'Revisar y ver materiales'}
        </Boton>
      )}
    </section>
  )
}

function Renglon({ c, diseno, alPedir }: { c: Check; diseno: Design; alPedir: (texto: string) => void }) {
  const seleccionar = useTienda((s) => s.seleccionar)
  const pensando = useTienda((s) => s.pensando)
  const pieza = c.piezas.find((id) => diseno.piezas.some((p) => p.id === id))
  return (
    <li className="flex items-start gap-2 py-2 text-sm">
      <span className="mt-0.5 shrink-0">{ICONO_COMPROBACION[c.estado]}</span>
      <span className="min-w-0 flex-1">
        <span className="font-medium">{c.titulo}</span>
        <span className={`block text-xs ${c.estado === 'ok' ? 'text-grafito-2' : ''}`}>{c.detalle}</span>
        {pieza && (
          <button type="button" className="text-xs text-grafito-2 underline" onClick={() => seleccionar(pieza)}>
            Ver en 3D
          </button>
        )}
        {c.estado !== 'ok' && c.pedido && (
          <Boton variante="secundario" className="mt-1.5 min-h-8 text-xs" disabled={pensando} onClick={() => alPedir(c.pedido!)}>
            <Wrench /> {c.pedido}
          </Boton>
        )}
      </span>
    </li>
  )
}

export function TarjetaDictamen({ dictamen, diseno, alPedir }: { dictamen: DatosDictamen; diseno: Design; alPedir: (texto: string) => void }) {
  const dictaminar = useTienda((s) => s.dictaminar)
  const dictaminando = useTienda((s) => s.dictaminando)
  const pensando = useTienda((s) => s.pensando)
  const v = VEREDICTOS[dictamen.veredicto]
  const c = dictamen.carpintero

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-linea bg-hueso p-4">
      <div className={`flex items-center gap-2 self-start rounded-full border px-3 py-1 text-sm font-medium ${v.clase}`}>
        {v.icono} {v.titulo}
      </div>
      {c ? (
        <p className="text-[15px] leading-relaxed">{c.resumen}</p>
      ) : (
        <p className="text-sm text-grafito-2">
          El carpintero no contestó{dictamen.error ? `: ${dictamen.error}` : '.'} Lo de abajo son las cuentas, que valen igual.
        </p>
      )}

      {c && c.problemas.length > 0 && (
        <ul className="flex flex-col gap-2">
          {c.problemas.map((p, i) => (
            <li key={i} className={`flex flex-col gap-1.5 rounded-xl border bg-papel/60 p-3 ${GRAVEDAD[p.gravedad]}`}>
              <span className="text-sm font-medium">{p.titulo}</span>
              <span className="text-sm text-grafito">{p.detalle}</span>
              {p.pedido && (
                <Boton variante="secundario" className="min-h-8 self-start text-xs" disabled={pensando} onClick={() => alPedir(p.pedido!)}>
                  <Wrench /> {p.pedido}
                </Boton>
              )}
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="text-xs font-medium tracking-wide text-grafito-2 uppercase">Las cuentas</p>
        <ul className="divide-y divide-linea">
          {dictamen.comprobaciones.map((x) => (
            <Renglon key={x.id} c={x} diseno={diseno} alPedir={alPedir} />
          ))}
        </ul>
      </div>

      {c && c.consejos.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-ambar-suave px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <Lightbulb weight="fill" className="text-ambar" /> Para el taller
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {c.consejos.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      <Boton variante="fantasma" className="min-h-8 self-start px-2 text-xs text-grafito-2" disabled={!!dictaminando} onClick={() => void dictaminar()}>
        <ArrowClockwise /> {dictaminando ? 'Revisando…' : 'Revisar de nuevo'}
      </Boton>
    </section>
  )
}
