import { create } from 'zustand'
import type { Etapa } from '../application/casosDeUso'
import { analizar } from '../domain/analisis'
import type { Dimensiones, Diseno, Pieza } from '../domain/diseno/esquema'
import type { Caja } from '../domain/diseno/resolver'
import { diferencias } from '../domain/diseno/diff'
import { disenoActual, type EstadoDiseno, type Miniatura } from '../domain/sesion/estado'
import type { Foto } from '../ports/LLMProvider'
import type { EstadoBoveda } from '../ports/Preferencias'
import { SIN_AJUSTES, type AjustesCatalogo } from '../domain/materiales/catalogo'
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
  /** Lo que cambió en la última transición, para animarlo: nuevas caen, modificadas brillan, eliminadas se desvanecen. */
  cambios: Cambios
  /** Versión anterior que se está viendo sin restaurarla. */
  versionVista: number | null
  /** Sube cada vez que el diseño aparece desde cero, para animar del boceto a la madera. */
  revelado: number
  ajustesAbiertos: boolean
  boveda: EstadoBoveda
  /** El aviso de llaves al llegar ya se atendió o se pospuso. */
  puertaCerrada: boolean
  /** Precios y parámetros de corte del usuario sobre el catálogo. */
  ajustesCatalogo: AjustesCatalogo

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
  desbloquear(frase: string): Promise<void>
  olvidarLlaves(): void
  usarSimulado(): void
  cerrarPuerta(): void
  /** Tras guardar ajustes, la bóveda pudo cambiar. */
  refrescarBoveda(): void
  verVersion(n: number | null): void
  volverAVersion(n: number): void
  agregarNota(texto: string): void
  quitarNota(id: string): void
  quitarDecision(tema: string): void
  guardarAjustesCatalogo(a: AjustesCatalogo): void
}

export interface Cambios {
  agregadas: string[]
  modificadas: string[]
  eliminadas: { pieza: Pieza; caja: Caja }[]
  vez: number
}

const mostrado = (e: EstadoDiseno) => e.propuesta?.diseno ?? disenoActual(e)

/** Lo que la escena muestra: una versión anterior, la propuesta o el diseño vigente. */
export function disenoVisible(s: Pick<Tienda, 'estado' | 'versionVista' | 'verPropuesta'>): Diseno | null {
  if (!s.estado) return null
  if (s.versionVista !== null) return s.estado.versiones.find((v) => v.n === s.versionVista)?.diseno ?? disenoActual(s.estado)
  return s.estado.propuesta && s.verPropuesta ? s.estado.propuesta.diseno : disenoActual(s.estado)
}

/** Qué cambia al pasar de un diseño a otro, con la caja de lo que desaparece para dibujar su fantasma. */
function transicion(antes: Diseno, despues: Diseno, catalogo: Servicios['catalogo'], vez: number): Cambios {
  const ga = analizar(antes, catalogo)
  const gb = analizar(despues, catalogo)
  if (!ga.valido || !gb.valido) return { agregadas: [], modificadas: [], eliminadas: [], vez }
  const d = diferencias(antes, ga.geo.cajas, despues, gb.geo.cajas)
  const eliminadas = d.eliminadas.map((id) => ({ pieza: antes.piezas.find((p) => p.id === id)!, caja: ga.geo.cajas.get(id)! }))
  return { agregadas: d.agregadas, modificadas: d.modificadas, eliminadas, vez }
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
  cambios: { agregadas: [], modificadas: [], eliminadas: [], vez: 0 },
  versionVista: null,
  revelado: 0,
  ajustesAbiertos: false,
  boveda: 'sin-boveda',
  puertaCerrada: false,
  ajustesCatalogo: SIN_AJUSTES,

  iniciar(servicios) {
    const estado = servicios.casos.cargar()
    set({ servicios, estado, fase: estado ? 'estudio' : 'inicio', revelado: estado ? 1 : 0, boveda: servicios.preferencias.boveda(), ajustesCatalogo: servicios.materiales.ajustes() })
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
    set((s) => ({
      estado: nuevo,
      pensando: false,
      etapa: null,
      controlador: null,
      verPropuesta: true,
      versionVista: null,
      cambios: transicion(mostrado(estado), mostrado(nuevo), servicios.catalogo, s.cambios.vez + 1),
    }))
  },

  cancelar: () => get().controlador?.abort(),

  aplicarPropuesta() {
    const { servicios, estado } = get()
    if (!servicios || !estado) return
    set({ estado: servicios.casos.aplicarPropuesta(estado), versionVista: null })
  },

  descartarPropuesta() {
    const { servicios, estado } = get()
    if (!servicios || !estado) return
    const nuevo = servicios.casos.descartarPropuesta(estado)
    set((s) => ({ estado: nuevo, cambios: transicion(mostrado(estado), mostrado(nuevo), servicios.catalogo, s.cambios.vez + 1) }))
  },

  seleccionar: (id) => set((s) => ({ seleccion: s.seleccion === id ? null : id })),
  alternarExplosion: () => set((s) => ({ explosion: !s.explosion })),
  alternarCotas: () => set((s) => ({ cotas: !s.cotas })),
  verDesde: (nombre) => set((s) => ({ vista: { nombre, vez: s.vista.vez + 1 } })),
  alternarPropuesta() {
    const antes = disenoVisible(get())
    set((s) => ({ verPropuesta: !s.verPropuesta }))
    const despues = disenoVisible(get())
    const { servicios } = get()
    if (servicios && antes && despues) set((s) => ({ cambios: transicion(antes, despues, servicios.catalogo, s.cambios.vez + 1) }))
  },
  abrirAjustes: (ajustesAbiertos) => set({ ajustesAbiertos }),

  async desbloquear(frase) {
    const { servicios } = get()
    if (!servicios) return
    await servicios.preferencias.desbloquear(frase)
    set({ boveda: servicios.preferencias.boveda() })
  },

  olvidarLlaves() {
    const { servicios } = get()
    if (!servicios) return
    servicios.preferencias.olvidarLlaves()
    set({ boveda: servicios.preferencias.boveda() })
  },

  usarSimulado() {
    const { servicios } = get()
    if (!servicios) return
    void servicios.preferencias.guardar({ ...servicios.preferencias.cargar(), activo: 'simulado' }).catch(() => {})
    set({ puertaCerrada: true })
  },

  cerrarPuerta: () => set({ puertaCerrada: true }),

  verVersion(versionVista) {
    const antes = disenoVisible(get())
    set({ versionVista, seleccion: null })
    const despues = disenoVisible(get())
    const { servicios } = get()
    if (servicios && antes && despues && antes !== despues) set((s) => ({ cambios: transicion(antes, despues, servicios.catalogo, s.cambios.vez + 1) }))
  },

  volverAVersion(n) {
    const { servicios, estado, versionVista } = get()
    if (!servicios || !estado) return
    const nuevo = servicios.casos.volverAVersion(estado, n)
    const antes = versionVista !== null ? (estado.versiones.find((v) => v.n === versionVista)?.diseno ?? mostrado(estado)) : mostrado(estado)
    set((s) => ({ estado: nuevo, versionVista: null, cambios: transicion(antes, mostrado(nuevo), servicios.catalogo, s.cambios.vez + 1) }))
  },

  agregarNota(texto) {
    const { servicios, estado } = get()
    if (servicios && estado) set({ estado: servicios.casos.agregarRequisito(estado, texto) })
  },

  quitarNota(id) {
    const { servicios, estado } = get()
    if (servicios && estado) set({ estado: servicios.casos.quitarRequisito(estado, id) })
  },

  quitarDecision(tema) {
    const { servicios, estado } = get()
    if (servicios && estado) set({ estado: servicios.casos.quitarDecision(estado, tema) })
  },

  guardarAjustesCatalogo(ajustesCatalogo) {
    get().servicios?.materiales.guardarAjustes(ajustesCatalogo)
    set({ ajustesCatalogo })
  },

  refrescarBoveda() {
    const { servicios } = get()
    if (servicios) set({ boveda: servicios.preferencias.boveda() })
  },
}))
