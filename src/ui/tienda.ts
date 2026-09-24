import { create } from 'zustand'
import type { Etapa } from '../application/casosDeUso'
import { analizar } from '../domain/analisis'
import type { Dimensiones, Diseno } from '../domain/diseno/esquema'
import { diferencias } from '../domain/diseno/diff'
import { disenoActual, type EstadoDiseno, type Miniatura } from '../domain/sesion/estado'
import type { Foto } from '../ports/LLMProvider'
import type { Servicios } from './servicios'

export type Fase = 'inicio' | 'captura' | 'analizando' | 'estudio'
export type Vista = 'frente' | 'lado' | 'tres-cuartos' | 'arriba'

interface Tienda {
  servicios: Servicios | null
  estado: EstadoDiseno | null
  fase: Fase
  etapa: { nombre: Etapa; intento: number } | null
  pensando: boolean
  errorReconstruccion: string | null
  controlador: AbortController | null
  seleccion: string | null
  explosion: boolean
  cotas: boolean
  vista: { nombre: Vista; vez: number }
  verPropuesta: boolean
  resaltadas: { ids: string[]; vez: number }
  /** Sube cada vez que el diseño aparece desde cero, para animar del boceto a la madera. */
  revelado: number
  ajustesAbiertos: boolean

  iniciar(servicios: Servicios): void
  nuevoDiseno(): void
  empezarCaptura(): void
  desdeEjemplo(diseno: Diseno): void
  reconstruir(entrada: { medidas: Dimensiones; fotos: Foto[]; miniaturas: Miniatura[]; notas: string }): Promise<void>
  ajustar(peticion: string, respondeA?: string | null): Promise<void>
  cancelar(): void
  aplicarPropuesta(): void
  descartarPropuesta(): void
  seleccionar(id: string | null): void
  alternarExplosion(): void
  alternarCotas(): void
  verDesde(vista: Vista): void
  alternarPropuesta(): void
  abrirAjustes(abierto: boolean): void
}

function cambiadas(antes: EstadoDiseno, despues: EstadoDiseno, catalogo: Servicios['catalogo']) {
  const a = disenoActual(antes)
  const b = despues.propuesta?.diseno ?? disenoActual(despues)
  const ga = analizar(a, catalogo)
  const gb = analizar(b, catalogo)
  if (!ga.valido || !gb.valido) return []
  const d = diferencias(a, ga.geo.cajas, b, gb.geo.cajas)
  return [...d.agregadas, ...d.modificadas]
}

export const useTienda = create<Tienda>((set, get) => ({
  servicios: null,
  estado: null,
  fase: 'inicio',
  etapa: null,
  pensando: false,
  errorReconstruccion: null,
  controlador: null,
  seleccion: null,
  explosion: false,
  cotas: true,
  vista: { nombre: 'tres-cuartos', vez: 0 },
  verPropuesta: true,
  resaltadas: { ids: [], vez: 0 },
  revelado: 0,
  ajustesAbiertos: false,

  iniciar(servicios) {
    const estado = servicios.casos.cargar()
    set({ servicios, estado, fase: estado ? 'estudio' : 'inicio', revelado: estado ? 1 : 0 })
  },

  nuevoDiseno() {
    get().controlador?.abort()
    get().servicios?.casos.nuevoDiseno()
    set({ estado: null, fase: 'captura', seleccion: null, explosion: false, errorReconstruccion: null, pensando: false, etapa: null })
  },

  empezarCaptura: () => set({ fase: 'captura', errorReconstruccion: null }),

  desdeEjemplo(diseno) {
    const { servicios } = get()
    if (!servicios) return
    set((s) => ({ estado: servicios.casos.desdeEjemplo(diseno), fase: 'estudio', revelado: s.revelado + 1, vista: { nombre: 'tres-cuartos', vez: s.vista.vez + 1 } }))
  },

  async reconstruir(entrada) {
    const { servicios } = get()
    if (!servicios) return
    const controlador = new AbortController()
    set({ fase: 'analizando', controlador, etapa: { nombre: 'mirando-fotos', intento: 0 }, errorReconstruccion: null })
    try {
      const estado = await servicios.casos.reconstruir(entrada, controlador.signal, (nombre, intento) => set({ etapa: { nombre, intento } }))
      set((s) => ({ estado, fase: 'estudio', etapa: null, controlador: null, revelado: s.revelado + 1, vista: { nombre: 'tres-cuartos', vez: s.vista.vez + 1 } }))
    } catch (e) {
      const cancelado = controlador.signal.aborted
      set({ fase: 'captura', etapa: null, controlador: null, errorReconstruccion: cancelado ? null : e instanceof Error ? e.message : 'Algo falló al analizar las fotos.' })
    }
  },

  async ajustar(peticion, respondeA = null) {
    const { servicios, estado, pensando } = get()
    if (!servicios || !estado || pensando || !peticion.trim()) return
    const controlador = new AbortController()
    const pendiente = { id: 'pendiente', autor: 'usuario' as const, texto: peticion.trim(), fecha: new Date().toISOString(), preguntas: [], respondida: false, version: null, propuesta: null, error: false }
    const optimista = { ...estado, chat: [...estado.chat.map((m) => (m.id === respondeA ? { ...m, respondida: true } : m)), pendiente] }
    set({ pensando: true, controlador, etapa: { nombre: 'proponiendo', intento: 0 }, estado: optimista })
    const nuevo = await servicios.casos.ajustar(estado, peticion.trim(), controlador.signal, (nombre, intento) => set({ etapa: { nombre, intento } }), respondeA)
    const ids = cambiadas(estado, nuevo, servicios.catalogo)
    set((s) => ({ estado: nuevo, pensando: false, etapa: null, controlador: null, verPropuesta: true, resaltadas: { ids, vez: s.resaltadas.vez + 1 } }))
  },

  cancelar: () => get().controlador?.abort(),

  aplicarPropuesta() {
    const { servicios, estado } = get()
    if (!servicios || !estado) return
    set({ estado: servicios.casos.aplicarPropuesta(estado) })
  },

  descartarPropuesta() {
    const { servicios, estado } = get()
    if (!servicios || !estado) return
    set({ estado: servicios.casos.descartarPropuesta(estado) })
  },

  seleccionar: (id) => set((s) => ({ seleccion: s.seleccion === id ? null : id })),
  alternarExplosion: () => set((s) => ({ explosion: !s.explosion })),
  alternarCotas: () => set((s) => ({ cotas: !s.cotas })),
  verDesde: (nombre) => set((s) => ({ vista: { nombre, vez: s.vista.vez + 1 } })),
  alternarPropuesta: () => set((s) => ({ verPropuesta: !s.verPropuesta })),
  abrirAjustes: (ajustesAbiertos) => set({ ajustesAbiertos }),
}))
