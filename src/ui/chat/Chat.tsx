import { ArrowCounterClockwise, Camera, Eye, EyeSlash, PaperPlaneRight, PencilSimple, Stop, Warning } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import type { Etapa } from '../../application/casosDeUso'
import { claveFoto, clavePregunta, type EstadoDiseno, type Mensaje } from '../../domain/sesion/estado'
import { Boton, Chip, Lapiz, Sello } from '../sistema/componentes'
import { useServicios } from '../servicios'
import { TomarFoto } from '../sistema/TomarFoto'
import { useTienda } from '../tienda'

const ETAPAS: Record<Etapa, string> = {
  'mirando-fotos': 'Mirando las fotos…',
  proponiendo: 'Pensando el cambio…',
  revisando: 'Revisando que todo cierre…',
  estructura: 'Revisando la estructura…',
  corrigiendo: 'Corrigiendo un detalle…',
}

const SUGERENCIAS = ['Hazlo de 90 cm de ancho', 'Que aguante libros pesados', 'Baja una repisa 10 cm', 'Refuerza la base']

/** Varias piezas con el mismo problema se cuentan en una sola línea. */
function agrupar<T extends { codigo: string }>(criticos: T[]) {
  const grupos = new Map<string, T[]>()
  for (const c of criticos) grupos.set(c.codigo, [...(grupos.get(c.codigo) ?? []), c])
  return [...grupos.values()].map((g) => ({ primero: g[0], mas: g.length - 1 }))
}

function Burbuja({ m, estado }: { m: Mensaje; estado: EstadoDiseno }) {
  const ajustar = useTienda((s) => s.ajustar)
  const pensando = useTienda((s) => s.pensando)
  const aplicarPropuesta = useTienda((s) => s.aplicarPropuesta)
  const descartarPropuesta = useTienda((s) => s.descartarPropuesta)
  const verPropuesta = useTienda((s) => s.verPropuesta)
  const alternarPropuesta = useTienda((s) => s.alternarPropuesta)
  const verVersion = useTienda((s) => s.verVersion)
  const versionVista = useTienda((s) => s.versionVista)

  if (m.autor === 'usuario')
    return (
      <div className="animate-aparecer ml-10 flex flex-col items-end gap-1.5 self-end">
        {m.miniatura && <img src={m.miniatura} alt="Foto enviada" className="h-24 rounded-xl border border-linea object-cover shadow-sm" />}
        <div className="rounded-2xl rounded-br-md bg-grafito px-4 py-2.5 text-[15px] leading-snug text-hueso shadow-sm">{m.texto}</div>
      </div>
    )

  const pendiente = m.propuesta === 'pendiente' && estado.propuesta
  return (
    <div className="animate-aparecer mr-6 flex flex-col gap-2.5 self-start">
      <div className={`rounded-2xl rounded-bl-md border px-4 py-3 text-[15px] leading-relaxed shadow-sm ${m.error ? 'border-oxido/30 bg-oxido/5' : 'border-linea bg-hueso'}`}>
        <div className="mb-1 flex items-center gap-2 text-xs text-grafito-2">
          <PencilSimple weight="duotone" className="text-ambar" /> Experto
          {m.version &&
            (m.version === estado.actual || !estado.versiones.some((v) => v.n === m.version) ? (
              <span className="cifras rounded-full bg-kraft px-1.5 py-px text-[10px] text-grafito">v{m.version}</span>
            ) : (
              <button
                type="button"
                onClick={() => verVersion(versionVista === m.version ? null : m.version)}
                title="Ver esta versión"
                aria-label={`Ver la versión ${m.version}`}
                className={`cifras rounded-full px-1.5 py-px text-[10px] underline decoration-dotted underline-offset-2 transition ${versionVista === m.version ? 'bg-ambar text-grafito' : 'bg-kraft text-grafito hover:bg-ambar-suave'}`}
              >
                v{m.version}
              </button>
            ))}
          {m.propuesta === 'aplicada' && <span className="text-[10px]">· aplicada</span>}
          {m.propuesta === 'descartada' && <span className="text-[10px]">· sin aplicar</span>}
        </div>
        {m.error && <Warning className="float-left mt-1 mr-2 text-oxido" weight="bold" />}
        {m.texto.split('\n\n').map((p, i) => (
          <p key={i} className={i ? 'mt-2' : ''}>
            {p}
          </p>
        ))}
      </div>

      {pendiente && (
        <div className="rounded-2xl border border-oxido/25 bg-kraft/60 p-3">
          <p className="mb-2 text-xs font-medium tracking-wide text-grafito-2 uppercase">Propuesta sin aplicar</p>
          <ul className="flex flex-col gap-2">
            {agrupar(estado.propuesta!.criticos).map(({ primero, mas }, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Sello severidad="critico" />
                <span>
                  {primero.mensaje}
                  {mas > 0 && <span className="text-grafito-2"> Y {mas === 1 ? 'otra pieza' : `${mas} piezas más`} con el mismo problema.</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Boton variante="secundario" className="min-h-9 text-xs" onClick={alternarPropuesta}>
              {verPropuesta ? <EyeSlash /> : <Eye />} {verPropuesta ? 'Ver el actual' : 'Ver propuesta'}
            </Boton>
            <Boton variante="fantasma" className="min-h-9 text-xs" onClick={aplicarPropuesta} disabled={pensando}>
              Aplicar así, bajo mi riesgo
            </Boton>
            <Boton variante="fantasma" className="min-h-9 text-xs" onClick={descartarPropuesta} disabled={pensando}>
              <ArrowCounterClockwise /> Descartar
            </Boton>
          </div>
        </div>
      )}

      {m.fotosPedidas.map((f) => (
        <FotoPedida key={f.angulo} angulo={f.angulo} motivo={f.motivo} mensaje={m} />
      ))}

      {m.preguntas.map((p, i) => (
        <div key={i} className="flex flex-col gap-2">
          {m.preguntas.length > 1 || p.texto !== m.texto ? <p className="text-sm font-medium">{p.texto}</p> : null}
          {p.opciones && (
            <div className="flex flex-wrap gap-2">
              {p.opciones.map((o) => (
                <Chip key={o} disabled={m.respondida || m.respuestas.includes(clavePregunta(i)) || pensando} onClick={() => void ajustar(o, `${m.id}#${clavePregunta(i)}`)}>
                  {o}
                </Chip>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/** El experto pidió una foto: se toma aquí y viaja con el siguiente mensaje. */
function FotoPedida({ angulo, motivo, mensaje }: { angulo: string; motivo: string; mensaje: Mensaje }) {
  const { imagenes } = useServicios()
  const ajustar = useTienda((s) => s.ajustar)
  const pensando = useTienda((s) => s.pensando)
  const [procesando, setProcesando] = useState(false)
  const enviar = async (archivo: File) => {
    setProcesando(true)
    try {
      const r = await imagenes.reducir(archivo)
      await ajustar(`Te mando la foto: ${angulo}`, `${mensaje.id}#${claveFoto(angulo)}`, { angulo, base64: r.base64, miniatura: r.miniatura })
    } finally {
      setProcesando(false)
    }
  }
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-grafito/30 bg-hueso/70 p-3">
      <p className="flex items-start gap-2 text-sm">
        <Camera className="mt-0.5 shrink-0 text-ambar" weight="duotone" />
        <span>
          <span className="font-medium">Foto: {angulo}.</span> <span className="text-grafito-2">{motivo}</span>
        </span>
      </p>
      <div className="flex gap-2">
        <TomarFoto alElegir={(f) => void enviar(f)} deshabilitado={mensaje.respondida || mensaje.respuestas.includes(claveFoto(angulo)) || pensando || procesando} />
      </div>
    </div>
  )
}

export function Chat({ estado }: { estado: EstadoDiseno }) {
  const ajustar = useTienda((s) => s.ajustar)
  const pensando = useTienda((s) => s.pensando)
  const etapa = useTienda((s) => s.etapa)
  const cancelar = useTienda((s) => s.cancelar)
  const [texto, setTexto] = useState('')
  const lista = useRef<HTMLDivElement>(null)

  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: 'smooth' })
  }, [estado.chat.length, pensando])

  const enviar = () => {
    if (!texto.trim() || pensando) return
    void ajustar(texto)
    setTexto('')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={lista} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-3" role="log" aria-live="polite" aria-label="Conversación con el experto">
        {estado.chat.map((m) => (
          <Burbuja key={m.id} m={m} estado={estado} />
        ))}
        {pensando && (
          <div className="flex items-center gap-2 self-start rounded-2xl border border-linea bg-hueso px-4 py-2.5 text-sm text-grafito-2" aria-live="polite">
            <Lapiz className="h-5 w-12 text-ambar" /> {etapa ? ETAPAS[etapa.nombre] : 'Pensando…'}
          </div>
        )}
      </div>
      {estado.chat.length <= 1 && !pensando && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {SUGERENCIAS.map((s) => (
            <Chip key={s} className="shrink-0" onClick={() => void ajustar(s)}>
              {s}
            </Chip>
          ))}
        </div>
      )}
      <form
        className="flex items-end gap-2 border-t border-linea bg-hueso/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault()
          enviar()
        }}
      >
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              enviar()
            }
          }}
          rows={1}
          placeholder="Pide un cambio: «refuerza la base»…"
          aria-label="Mensaje para el experto"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-linea bg-hueso px-4 py-2.5 text-[15px] outline-none [field-sizing:content] focus:border-ambar"
        />
        {pensando ? (
          <Boton variante="secundario" className="size-11 shrink-0 rounded-full p-0" onClick={cancelar} aria-label="Cancelar">
            <Stop weight="fill" />
          </Boton>
        ) : (
          <Boton type="submit" variante="primario" className="size-11 shrink-0 rounded-full p-0" disabled={!texto.trim()} aria-label="Enviar">
            <PaperPlaneRight weight="fill" />
          </Boton>
        )}
      </form>
    </div>
  )
}
