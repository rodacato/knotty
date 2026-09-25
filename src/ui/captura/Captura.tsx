import { ArrowClockwise, ArrowLeft, ArrowRight, Key, Question, Robot, Trash, Warning } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import type { Dimensiones } from '../../domain/diseno/esquema'
import { faltante } from '../../ports/Preferencias'
import { useServicios } from '../servicios'
import { Boton, cm, Titulo } from '../sistema/componentes'
import { TomarFoto } from '../sistema/TomarFoto'
import { useTienda } from '../tienda'
import { Silueta } from './Siluetas'

const ANGULOS = [
  { id: 'frente', nombre: 'Frente', pista: 'De frente, a media altura', requerida: true },
  { id: '3/4', nombre: '3/4', pista: 'Desde una esquina: frente y lado', requerida: true },
  { id: 'lateral', nombre: 'Lateral', pista: 'De lado, para ver el fondo', requerida: false },
  { id: 'interior', nombre: 'Interior', pista: 'Abierto: entrepaños y trasera', requerida: false },
  { id: 'uniones', nombre: 'Uniones', pista: 'De cerca: cómo se juntan', requerida: false },
] as const

const MEDIDAS: { clave: keyof Dimensiones; nombre: string; min: number; max: number }[] = [
  { clave: 'alto', nombre: 'Alto', min: 200, max: 2400 },
  { clave: 'ancho', nombre: 'Ancho', min: 200, max: 2400 },
  { clave: 'fondo', nombre: 'Fondo', min: 150, max: 1200 },
]

/** Sin fotos, el experto trabaja con lo que le cuentes: pide una descripción con algo de sustancia. */
const MINIMO_DESCRIPCION = 15

interface FotoTomada {
  angulo: string
  base64: string
  miniatura: string
}

function CampoMedida({ nombre, valor, min, max, onCambio }: { nombre: string; valor: number; min: number; max: number; onCambio: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-2 rounded-2xl border border-linea bg-hueso/70 p-4">
      <span className="flex items-baseline justify-between">
        <span className="font-medium">{nombre}</span>
        <span className="cifras text-sm text-grafito-2">{cm(valor)}</span>
      </span>
      <span className="flex items-baseline gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={10}
          value={valor || ''}
          onChange={(e) => onCambio(Number(e.target.value))}
          className="cifras w-full bg-transparent text-4xl font-medium outline-none"
        />
        <span className="cifras text-grafito-2">mm</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={10}
        value={Math.min(max, Math.max(min, valor))}
        onChange={(e) => onCambio(Number(e.target.value))}
        aria-label={`${nombre} en milímetros`}
        className="h-7 w-full cursor-pointer appearance-none rounded bg-[repeating-linear-gradient(90deg,var(--linea)_0_1px,transparent_1px_10px),repeating-linear-gradient(90deg,var(--grafito-2)_0_1px,transparent_1px_50px)] bg-[length:100%_40%,100%_75%] bg-bottom bg-no-repeat accent-ambar"
      />
    </label>
  )
}

function Ranura({ angulo, foto, onFoto, onQuitar, procesando }: { angulo: (typeof ANGULOS)[number]; foto?: FotoTomada; onFoto: (f: File) => void; onQuitar: () => void; procesando: boolean }) {
  return (
    <div className={`animate-aparecer relative flex min-h-60 flex-col overflow-hidden rounded-2xl border ${foto ? 'border-transparent' : 'border-dashed border-grafito/25 bg-hueso/60'}`}>
      {foto ? (
        <>
          <img src={foto.miniatura} alt={`Foto ${angulo.nombre}`} className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute top-2 left-2 rounded-full bg-grafito/80 px-2 py-0.5 text-xs font-medium text-hueso">{angulo.nombre}</span>
          <button type="button" onClick={onQuitar} aria-label={`Quitar foto ${angulo.nombre}`} className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-hueso/90 text-grafito shadow">
            <Trash />
          </button>
        </>
      ) : (
        <div className="flex h-full flex-col justify-between gap-1 p-3">
          <div>
            <p className="font-medium">
              {angulo.nombre} {angulo.requerida && <span className="text-ambar">•</span>}
            </p>
            <p className="text-xs leading-snug text-grafito-2">{angulo.pista}</p>
          </div>
          <div className="grid flex-1 place-items-center">
            <Silueta angulo={angulo.id} />
          </div>
          <div className="flex gap-1.5">
            <TomarFoto alElegir={onFoto} deshabilitado={procesando} compacto />
          </div>
        </div>
      )}
    </div>
  )
}

export function Captura() {
  const { imagenes, preferencias } = useServicios()
  const reconstruir = useTienda((s) => s.reconstruir)
  const error = useTienda((s) => s.errorReconstruccion)
  const abrirAjustes = useTienda((s) => s.abrirAjustes)
  const ajustesAbiertos = useTienda((s) => s.ajustesAbiertos)
  const borrador = useTienda((s) => s.borrador)
  const [paso, setPaso] = useState<'medidas' | 'fotos'>(borrador ? 'fotos' : 'medidas')
  const [medidas, setMedidas] = useState<Dimensiones>(borrador?.medidas ?? { ancho: 600, alto: 1800, fondo: 300 })
  const [conMedidas, setConMedidas] = useState(!borrador || borrador.medidas !== null)
  const [fotos, setFotos] = useState<FotoTomada[]>(
    () => borrador?.fotos.map((f) => ({ ...f, miniatura: borrador.miniaturas.find((m) => m.angulo === f.angulo)?.dataUrl ?? '' })) ?? [],
  )
  const [notas, setNotas] = useState(borrador?.notas ?? '')
  const [procesando, setProcesando] = useState(false)
  const [conSimulado, setConSimulado] = useState(borrador !== null)
  // Se relee al cerrar los ajustes para que el aviso desaparezca en cuanto conectes un experto.
  const config = useMemo(() => preferencias.cargar(), [preferencias, ajustesAbiertos])
  const falta = faltante(config)
  const simulado = config.activo === 'simulado'

  const agregar = async (angulo: string, archivo: File) => {
    setProcesando(true)
    try {
      const r = await imagenes.reducir(archivo)
      setFotos((f) => [...f.filter((x) => x.angulo !== angulo), { angulo, ...r }])
    } finally {
      setProcesando(false)
    }
  }

  const sinFotos = fotos.length === 0
  const descripcionSuficiente = notas.trim().length >= MINIMO_DESCRIPCION
  const puedeAnalizar = !falta && !procesando && (!simulado || conSimulado) && (!sinFotos || descripcionSuficiente || simulado)
  const medidasValidas = MEDIDAS.every((m) => medidas[m.clave] >= m.min && medidas[m.clave] <= m.max)
  const faltanRequeridas = ANGULOS.filter((a) => a.requerida && !fotos.some((f) => f.angulo === a.id))
  const analizar = () =>
    reconstruir({ medidas: conMedidas ? medidas : null, fotos: fotos.map((f) => ({ angulo: f.angulo, base64: f.base64 })), miniaturas: fotos.map((f) => ({ angulo: f.angulo, dataUrl: f.miniatura })), notas: notas.trim() })

  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex items-center gap-3">
        <span className="cifras rounded-full bg-grafito px-2.5 py-1 text-xs text-hueso">{paso === 'medidas' ? '1' : '2'} / 2</span>
        <Titulo>{paso === 'medidas' ? '¿Cuánto mide?' : 'Fotos o descripción'}</Titulo>
      </header>

      {simulado && !conSimulado && (
        <div className="flex flex-col gap-3 rounded-2xl border border-ambar/40 bg-ambar-suave p-4">
          <p className="flex items-start gap-2 font-medium">
            <Robot className="mt-0.5 shrink-0" weight="bold" /> Conecta tu experto para diseñar tu mueble
          </p>
          <p className="text-sm text-grafito-2">
            Sin una API key solo responde el modo simulado, que no entiende tu mueble: arma uno de tres ejemplos (librero, buró o alacena). Con Claude, OpenAI o SheLLM el experto sí lee
            tus fotos y tu descripción.
          </p>
          <div className="flex flex-wrap gap-2">
            <Boton variante="primario" onClick={() => abrirAjustes(true)}>
              <Key weight="bold" /> Conectar experto
            </Boton>
            <Boton variante="fantasma" className="underline" onClick={() => setConSimulado(true)}>
              Probar con los ejemplos simulados
            </Boton>
          </div>
        </div>
      )}

      {paso === 'medidas' ? (
        <>
          <p className="-mt-4 text-grafito-2">Las medidas generales por fuera, en milímetros. Con cinta métrica basta.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {MEDIDAS.map((m) => (
              <CampoMedida key={m.clave} nombre={m.nombre} valor={medidas[m.clave]} min={m.min} max={m.max} onCambio={(v) => setMedidas((d) => ({ ...d, [m.clave]: v }))} />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Boton
              variante="fantasma"
              onClick={() => {
                setConMedidas(false)
                setPaso('fotos')
              }}
            >
              <Question /> No sé las medidas
            </Boton>
            <Boton
              variante="primario"
              className="min-h-12 px-6"
              disabled={!medidasValidas}
              onClick={() => {
                setConMedidas(true)
                setPaso('fotos')
              }}
            >
              Siguiente <ArrowRight weight="bold" />
            </Boton>
          </div>
        </>
      ) : (
        <>
          {!conMedidas && (
            <p className="-mt-4 text-sm text-grafito-2">Sin medidas: el experto propone unas típicas para ese mueble y luego las ajustas en el chat.</p>
          )}
          <p className={conMedidas ? '-mt-4 text-grafito-2' : 'text-grafito-2'}>
            Con fotos, frente y 3/4 son las importantes; se reducen en tu teléfono antes de enviarse. ¿No tienes el mueble enfrente? Descríbelo abajo y el experto lo arma con eso.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {ANGULOS.map((a) => (
              <Ranura
                key={a.id}
                angulo={a}
                foto={fotos.find((f) => f.angulo === a.id)}
                procesando={procesando}
                onFoto={(f) => void agregar(a.id, f)}
                onQuitar={() => setFotos((f) => f.filter((x) => x.angulo !== a.id))}
              />
            ))}
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">{sinFotos ? 'Describe el mueble' : '¿Algo que el experto deba saber?'}</span>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={sinFotos ? 4 : 2}
              placeholder={
                sinFotos
                  ? 'Ej. librero de 5 repisas para libros, sin puertas, con zoclo al frente y un cajón abajo; lo quiero pegado a la pared'
                  : 'Ej. va a cargar libros; mi espacio mide 90 cm de ancho'
              }
              className="rounded-2xl border border-linea bg-hueso/70 p-3 outline-none focus:border-ambar"
            />
            {sinFotos && (
              <span className="text-xs text-grafito-2">
                Ayuda decir qué es, cuántas repisas, puertas o cajones lleva, qué va a cargar y cómo te lo imaginas. Lo que no digas, el experto lo pregunta.
              </span>
            )}
          </label>
          {error && (
            <p className="flex items-start gap-2 rounded-xl border border-oxido/30 bg-oxido/10 p-3 text-sm text-oxido">
              <Warning className="mt-0.5 shrink-0" weight="bold" />
              <span className="flex-1">
                {error} Tus fotos y tu descripción siguen aquí.
              </span>
              {puedeAnalizar && (
                <Boton variante="fantasma" className="min-h-8 shrink-0 px-2 text-oxido underline" onClick={analizar}>
                  <ArrowClockwise weight="bold" /> Reintentar
                </Boton>
              )}
            </p>
          )}
          {falta && (
            <p className="flex flex-wrap items-center gap-2 rounded-xl border border-ambar/40 bg-ambar-suave p-3 text-sm">
              <Key weight="bold" /> {falta}
              <Boton variante="fantasma" className="min-h-8 px-2 underline" onClick={() => abrirAjustes(true)}>
                Configurar
              </Boton>
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <Boton variante="fantasma" onClick={() => setPaso('medidas')}>
              <ArrowLeft /> {conMedidas ? 'Medidas' : 'Poner medidas'}
            </Boton>
            <div className="flex items-center gap-3">
              {faltanRequeridas.length > 0 && fotos.length > 0 && <span className="hidden text-xs text-grafito-2 sm:inline">Falta: {faltanRequeridas.map((a) => a.nombre).join(', ')}</span>}
              <Boton variante="primario" className="min-h-12 px-6" disabled={!puedeAnalizar} onClick={analizar}>
                {sinFotos ? 'Diseñar sin fotos' : 'Analizar'} <ArrowRight weight="bold" />
              </Boton>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
