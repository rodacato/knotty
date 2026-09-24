import { Wrench } from '@phosphor-icons/react'
import type { Diseno } from '../../domain/diseno/esquema'
import type { Alternativa, Hallazgo, Severidad } from '../../domain/estructura/hallazgo'
import { Boton, Chip, Sello } from '../sistema/componentes'
import { useTienda } from '../tienda'

const TITULOS: Record<string, string> = {
  R1_FLECHA: 'Entrepaños que se pandean',
  R2_ESPESOR_UNION: 'Espesor para la unión',
  R3_TORNILLOS: 'Tornillos',
  R4_VUELCO: 'Riesgo de vuelco',
  R5_ESCUADRADO: 'Escuadrado',
  R6_PUERTAS: 'Puertas',
  R7_BASE: 'Base',
  R8_VETA: 'Veta',
}

const SEVERIDADES: { id: Severidad; plural: [string, string] }[] = [
  { id: 'critico', plural: ['crítico', 'críticos'] },
  { id: 'recomendacion', plural: ['recomendación', 'recomendaciones'] },
  { id: 'detalle', plural: ['detalle', 'detalles'] },
]

/** Hallazgos de la misma regla y severidad se leen como uno, con todas sus piezas. */
function agrupar(hallazgos: Hallazgo[]) {
  const grupos = new Map<string, Hallazgo[]>()
  for (const h of hallazgos) grupos.set(`${h.codigo}|${h.severidad}`, [...(grupos.get(`${h.codigo}|${h.severidad}`) ?? []), h])
  return [...grupos.values()]
}

const detalleAlternativa = (a: Alternativa) =>
  a.datos.flecha !== undefined ? ` (~${a.datos.flecha} mm)` : a.clave === 'claro-maximo' && a.datos.claro !== undefined ? ` (${a.datos.claro} mm)` : ''

function Tarjeta({ grupo, diseno, alPedir }: { grupo: Hallazgo[]; diseno: Diseno; alPedir: (texto: string) => void }) {
  const seleccionar = useTienda((s) => s.seleccionar)
  const pensando = useTienda((s) => s.pensando)
  const [primero] = grupo
  const piezas = [...new Set(grupo.flatMap((h) => h.piezas))]
  const unicas = [...new Map(grupo.flatMap((h) => h.alternativas).map((a) => [a.descripcion, a])).values()]
  const alternativas = unicas.filter((a) => a.clave !== 'claro-maximo')
  const informativas = primero.alternativas.filter((a) => a.clave === 'claro-maximo')
  const nombre = (id: string) => diseno.piezas.find((p) => p.id === id)?.nombre ?? id
  return (
    <li className={`animate-aparecer flex flex-col gap-3 rounded-2xl border p-4 ${primero.severidad === 'critico' ? 'border-oxido/30 bg-oxido/5' : 'border-linea bg-hueso'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{TITULOS[primero.codigo] ?? primero.codigo}</span>
        <Sello severidad={primero.severidad} />
      </div>
      <p className="text-[15px] leading-snug">
        {primero.mensaje}
        {grupo.length > 1 && <span className="text-grafito-2"> Y {grupo.length - 1 === 1 ? 'otra pieza' : `${grupo.length - 1} piezas más`} igual.</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {piezas.map((id) => (
          <button key={id} type="button" onClick={() => seleccionar(id)} className="rounded-full border border-linea px-2.5 py-0.5 text-xs text-grafito-2 transition hover:border-ambar hover:text-grafito">
            {nombre(id)}
          </button>
        ))}
      </div>
      {informativas.map((a) => (
        <p key={a.clave} className="text-xs text-grafito-2">
          {a.descripcion}
          {detalleAlternativa(a)}
        </p>
      ))}
      {alternativas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium tracking-wide text-grafito-2 uppercase">Cómo resolverlo</p>
          <div className="flex flex-wrap gap-2">
            {alternativas.map((a) => (
              <Chip key={a.descripcion} disabled={pensando} onClick={() => alPedir(`${primero.mensaje} ${a.descripcion}.`)}>
                {a.descripcion}
                {detalleAlternativa(a)}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <Boton variante="fantasma" className="min-h-8 self-start px-2 text-xs underline" disabled={pensando} onClick={() => alPedir(`Corrige esto: ${primero.mensaje}`)}>
        Que el experto decida cómo corregirlo
      </Boton>
    </li>
  )
}

export function Revision({ hallazgos, incumplidos, diseno, alPedir }: { hallazgos: Hallazgo[]; incumplidos: string[]; diseno: Diseno; alPedir: (texto: string) => void }) {
  const pensando = useTienda((s) => s.pensando)
  const conteo = SEVERIDADES.map((s) => ({ ...s, n: hallazgos.filter((h) => h.severidad === s.id).length + (s.id === 'critico' ? incumplidos.length : 0) })).filter((s) => s.n > 0)

  if (!conteo.length)
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center text-grafito-2">
        <Wrench size={28} weight="duotone" className="text-ambar" />
        <p className="font-medium text-grafito">Sin observaciones</p>
        <p className="text-sm">Revisé flecha de entrepaños, espesores por unión, tornillos, vuelco, escuadrado, puertas, base y veta.</p>
      </div>
    )

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-sm text-grafito-2">
        {conteo.map((c, i) => (
          <span key={c.id}>
            {i > 0 && ' · '}
            <span className={c.id === 'critico' ? 'font-medium text-oxido' : 'text-grafito'}>
              {c.n} {c.plural[c.n === 1 ? 0 : 1]}
            </span>
          </span>
        ))}
      </p>
      <ul className="flex flex-col gap-3">
        {incumplidos.map((m) => (
          <li key={m} className="animate-aparecer flex flex-col gap-3 rounded-2xl border border-oxido/30 bg-oxido/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">Tus requisitos</span>
              <Sello severidad="critico" />
            </div>
            <p className="text-[15px] leading-snug">{m}</p>
            <Boton variante="secundario" className="min-h-9 self-start text-xs" disabled={pensando} onClick={() => alPedir(`Ajusta el diseño para cumplir esto: ${m}`)}>
              Pedir al experto que lo ajuste
            </Boton>
          </li>
        ))}
        {agrupar(hallazgos).map((g) => (
          <Tarjeta key={`${g[0].codigo}-${g[0].severidad}-${g[0].piezas.join()}`} grupo={g} diseno={diseno} alPedir={alPedir} />
        ))}
      </ul>
    </div>
  )
}
