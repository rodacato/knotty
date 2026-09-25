import { create, type StoreApi } from 'zustand'
import { ErrorExperto, type AlAvanzar, type Etapa, type FotoEnviada, type PieceEdit, type PieceEditResult } from '../application/casosDeUso'
import type { Notice } from '../application/notices'
import type { Fix } from '../domain/fixes/fixes'
import { trayRequest, type TrayItem } from '../domain/tray/tray'
import type { FurniturePlan } from '../domain/modules/plan'
import type { TraceEntry } from '../domain/trace/trace'
import { analizar } from '../domain/analisis'
import type { Dimensiones, Diseno, Eje, Pieza } from '../domain/diseno/esquema'
import type { Caja } from '../domain/diseno/resolver'
import { diferencias } from '../domain/diseno/diff'
import { disenoActual, marcarRespondida, type EstadoDiseno, type Miniatura } from '../domain/sesion/estado'
import type { Foto } from '../ports/LLMProvider'
import type { EstadoBoveda } from '../ports/Preferencias'
import { aplicarAjustes, SIN_AJUSTES, type AjustesCatalogo } from '../domain/materiales/catalogo'
import type { Servicios } from './servicios'

export type Fase = 'inicio' | 'captura' | 'analizando' | 'estudio'
export type Vista = 'frente' | 'lado' | 'tres-cuartos' | 'arriba'

export interface EntradaCaptura {
  medidas: Dimensiones | null
  fotos: Foto[]
  miniaturas: Miniatura[]
  notas: string
}

interface Tienda {
  servicios: Servicios | null
  estado: EstadoDiseno | null
  fase: Fase
  etapa: { nombre: Etapa; intento: number; progress?: { done: number; total: number } } | null
  pensando: boolean
  errorReconstruccion: string | null
  /** What the expert did in a design attempt that failed, for «Ver qué pasó». */
  failedTrace: TraceEntry[]
  /** Lo último que se mandó a diseñar, para no perderlo si falla y poder reintentar. */
  borrador: EntradaCaptura | null
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
  /** El carpintero está revisando la compra; va aparte del chat para no bloquearlo. */
  dictaminando: AbortController | null
  errorDictamen: string | null

  iniciar(servicios: Servicios): void
  nuevoDiseno(): void
  empezarCaptura(): void
  desdeEjemplo(diseno: Diseno): void
  reconstruir(entrada: EntradaCaptura): Promise<void>
  ajustar(peticion: string, respondeA?: string | null, foto?: FotoEnviada | null): Promise<void>
  cancelar(): void
  /** Corta la reconstrucción en curso y la vuelve a pedir con lo mismo. */
  reintentarReconstruccion(): void
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
  confirmarPieza(id: string): void
  agregarNota(texto: string): void
  quitarNota(id: string): void
  quitarDecision(tema: string): void
  guardarAjustesCatalogo(a: AjustesCatalogo): void
  dictaminar(): Promise<void>
  /** Rebuilds the design from an edited plan; the result says why when it cannot be built. */
  applyPlan(plan: FurniturePlan): { ok: true; notes: string[] } | { ok: false; message: string }
  /** A hand edit on one piece; when it cannot hold, the result says why and what could. */
  /** A solution shown in 3D before applying it. */
  preview: { design: Diseno; label: string } | null
  previewFix(fix: Fix | null): void
  applyFix(fix: Fix): void
  /** Puts an item in the tray, replaces the one from the same origin, or takes it out. */
  toggleTray(item: TrayItem): void
  /** The tray and what was typed, to the expert in one request. */
  sendTray(typed?: string): Promise<void>
  acceptNotice(notice: Notice): void
  reopenNotice(notice: Notice): void
  restoreFromVersion(n: number, ids: string[]): { ok: true } | { ok: false; message: string }
  undoChange(n: number): { ok: true } | { ok: false; message: string }
  editPiece(id: string, edit: PieceEdit): PieceEditResult
  resizeFurniture(axis: Eje, value: number): PieceEditResult
  cancelarDictamen(): void
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

type Set = StoreApi<Tienda>['setState']
type Get = StoreApi<Tienda>['getState']

/** A request to the expert: the message shows at once, and the answer replaces the state when it arrives. */
async function askExpert(set: Set, get: Get, texto: string, respondeA: string | null, miniatura: string | null, call: (signal: AbortSignal, alAvanzar: AlAvanzar) => Promise<EstadoDiseno>) {
  const { servicios, estado, pensando } = get()
  if (!servicios || !estado || pensando) return
  const controlador = new AbortController()
  const pendiente = { id: 'pendiente', autor: 'usuario' as const, texto, fecha: new Date().toISOString(), preguntas: [], respondida: false, version: null, propuesta: null, error: false, fotosPedidas: [], miniatura, respuestas: [], sugerencias: [] }
  const optimista = { ...estado, tray: [], chat: [...marcarRespondida(estado.chat, respondeA), pendiente] }
  set({ pensando: true, controlador, etapa: { nombre: 'proponiendo', intento: 0 }, estado: optimista })
  const nuevo = await call(controlador.signal, (nombre, intento) => set({ etapa: { nombre, intento } }))
  set((s) => ({
    estado: nuevo,
    pensando: false,
    etapa: null,
    controlador: null,
    verPropuesta: true,
    versionVista: null,
    cambios: transicion(mostrado(estado), mostrado(nuevo), servicios.catalogo, s.cambios.vez + 1),
  }))
}

export const useTienda = create<Tienda>((set, get) => ({
  servicios: null,
  estado: null,
  fase: 'inicio',
  etapa: null,
  pensando: false,
  errorReconstruccion: null,
  failedTrace: [],
  borrador: null,
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
  preview: null,
  dictaminando: null,
  errorDictamen: null,

  iniciar(servicios) {
    const estado = servicios.casos.cargar()
    set({ servicios, estado, fase: estado ? 'estudio' : 'inicio', revelado: estado ? 1 : 0, boveda: servicios.preferencias.boveda(), ajustesCatalogo: servicios.materiales.ajustes() })
  },

  nuevoDiseno() {
    get().controlador?.abort()
    get().servicios?.casos.nuevoDiseno()
    set({ estado: null, fase: 'captura', seleccion: null, explosion: false, errorReconstruccion: null, borrador: null, pensando: false, etapa: null })
  },

  empezarCaptura: () => set({ fase: 'captura', errorReconstruccion: null, borrador: null }),

  desdeEjemplo(diseno) {
    const { servicios } = get()
    if (!servicios) return
    set((s) => ({ estado: servicios.casos.desdeEjemplo(diseno), fase: 'estudio', revelado: s.revelado + 1, vista: { nombre: 'tres-cuartos', vez: s.vista.vez + 1 } }))
  },

  async reconstruir(entrada) {
    const { servicios } = get()
    if (!servicios) return
    const controlador = new AbortController()
    set({ fase: 'analizando', controlador, etapa: { nombre: entrada.fotos.length ? 'leyendo-fotos' : 'mirando-fotos', intento: 0 }, errorReconstruccion: null, borrador: entrada })
    // Un reintento deja huérfana a la petición anterior: lo que conteste ya no cuenta.
    const vigente = () => get().controlador === controlador
    try {
      const estado = await servicios.casos.reconstruir(entrada, controlador.signal, (nombre, intento, progress) => vigente() && set({ etapa: { nombre, intento, progress } }))
      if (!vigente()) return
      set((s) => ({ estado, fase: 'estudio', etapa: null, controlador: null, borrador: null, revelado: s.revelado + 1, vista: { nombre: 'tres-cuartos', vez: s.vista.vez + 1 } }))
    } catch (e) {
      if (!vigente()) return
      const cancelado = controlador.signal.aborted
      set({
        fase: 'captura',
        etapa: null,
        controlador: null,
        errorReconstruccion: cancelado ? null : e instanceof Error ? e.message : 'Algo falló al analizar las fotos.',
        failedTrace: e instanceof ErrorExperto ? e.trace : [],
      })
    }
  },

  ajustar(peticion, respondeA = null, foto = null) {
    const { servicios, estado } = get()
    if (!servicios || !estado || !peticion.trim()) return Promise.resolve()
    return askExpert(set, get, peticion.trim(), respondeA, foto?.miniatura ?? null, (signal, alAvanzar) => servicios.casos.ajustar(estado, peticion.trim(), signal, alAvanzar, respondeA, foto))
  },

  toggleTray(item) {
    const { servicios, estado } = get()
    if (!servicios || !estado) return
    set({ estado: servicios.casos.toggleTray(estado, item) })
  },

  sendTray(typed = '') {
    const { servicios, estado } = get()
    if (!servicios || !estado || (!estado.tray.length && !typed.trim())) return Promise.resolve()
    const { text, answers } = trayRequest(estado.tray, typed)
    return askExpert(set, get, text, answers, null, (signal, alAvanzar) => servicios.casos.sendTray(estado, typed, signal, alAvanzar))
  },

  cancelar: () => get().controlador?.abort(),

  reintentarReconstruccion() {
    const { borrador, controlador } = get()
    if (!borrador) return
    controlador?.abort()
    void get().reconstruir(borrador)
  },

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

  confirmarPieza(id) {
    const { servicios, estado } = get()
    if (!servicios || !estado) return
    const nuevo = servicios.casos.confirmarPieza(estado, id)
    set((s) => ({ estado: nuevo, cambios: transicion(mostrado(estado), mostrado(nuevo), servicios.catalogo, s.cambios.vez + 1) }))
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

  previewFix: (fix) => set({ preview: fix ? { design: fix.design, label: fix.label } : null, versionVista: null }),

  applyFix(fix) {
    const { servicios, estado } = get()
    if (!servicios || !estado) return
    const nuevo = servicios.casos.applyFix(estado, fix)
    set((s) => ({ estado: nuevo, preview: null, versionVista: null, cambios: transicion(mostrado(estado), mostrado(nuevo), servicios.catalogo, s.cambios.vez + 1) }))
  },

  acceptNotice(notice) {
    const { servicios, estado } = get()
    if (!servicios || !estado) return
    set({ estado: servicios.casos.acceptNotice(estado, notice.findings, notice.title) })
  },

  reopenNotice(notice) {
    const { servicios, estado } = get()
    if (!servicios || !estado) return
    set({ estado: servicios.casos.reopenNotice(estado, notice.findings) })
  },

  restoreFromVersion(n, ids) {
    const { servicios, estado } = get()
    if (!servicios || !estado) return { ok: false, message: 'No hay un diseño abierto.' }
    const r = servicios.casos.restoreFromVersion(estado, n, ids)
    if (!r.ok) return r
    set((s) => ({ estado: r.estado, versionVista: null, cambios: transicion(mostrado(estado), mostrado(r.estado), servicios.catalogo, s.cambios.vez + 1) }))
    return { ok: true }
  },

  undoChange(n) {
    const { servicios, estado } = get()
    if (!servicios || !estado) return { ok: false, message: 'No hay un diseño abierto.' }
    const r = servicios.casos.undoChange(estado, n)
    if (!r.ok) return r
    set((s) => ({ estado: r.estado, versionVista: null, cambios: transicion(mostrado(estado), mostrado(r.estado), servicios.catalogo, s.cambios.vez + 1) }))
    return { ok: true }
  },

  editPiece(id, edit) {
    const { servicios, estado } = get()
    if (!servicios || !estado) return { ok: false, message: 'No hay un diseño abierto.', alternatives: [] }
    const r = servicios.casos.editPiece(estado, id, edit)
    if (r.ok) set((s) => ({ estado: r.estado, versionVista: null, cambios: transicion(mostrado(estado), mostrado(r.estado), servicios.catalogo, s.cambios.vez + 1) }))
    return r
  },

  resizeFurniture(axis, value) {
    const { servicios, estado } = get()
    if (!servicios || !estado) return { ok: false, message: 'No hay un diseño abierto.', alternatives: [] }
    const r = servicios.casos.resizeFurniture(estado, axis, value)
    if (r.ok) set((s) => ({ estado: r.estado, versionVista: null, cambios: transicion(mostrado(estado), mostrado(r.estado), servicios.catalogo, s.cambios.vez + 1) }))
    return r
  },

  applyPlan(plan) {
    const { servicios, estado } = get()
    if (!servicios || !estado) return { ok: false, message: 'No hay un diseño abierto.' }
    const r = servicios.casos.applyPlan(estado, plan)
    if (!r.ok) return r
    set((s) => ({ estado: r.estado, versionVista: null, cambios: transicion(mostrado(estado), mostrado(r.estado), servicios.catalogo, s.cambios.vez + 1) }))
    return { ok: true, notes: r.notes }
  },

  async dictaminar() {
    const { servicios, estado, ajustesCatalogo, dictaminando } = get()
    if (!servicios || !estado || dictaminando) return
    const controlador = new AbortController()
    set({ dictaminando: controlador, errorDictamen: null })
    try {
      const dictamen = await servicios.casos.dictaminar(estado, aplicarAjustes(servicios.catalogo, ajustesCatalogo), controlador.signal)
      // Si mientras tanto cambió el diseño, su firma ya no coincide y se ve como desactualizado.
      const vigente = get().estado
      set({ estado: vigente ? servicios.casos.guardarDictamen(vigente, dictamen) : null, dictaminando: null })
    } catch (e) {
      set({ dictaminando: null, errorDictamen: controlador.signal.aborted ? null : e instanceof Error ? e.message : 'No se pudo revisar la compra.' })
    }
  },

  cancelarDictamen: () => get().dictaminando?.abort(),

  guardarAjustesCatalogo(ajustesCatalogo) {
    get().servicios?.materiales.guardarAjustes(ajustesCatalogo)
    set({ ajustesCatalogo })
  },

  refrescarBoveda() {
    const { servicios } = get()
    if (servicios) set({ boveda: servicios.preferencias.boveda() })
  },
}))
