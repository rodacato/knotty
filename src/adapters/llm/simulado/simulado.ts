import { desde, entre, pieza, ref, tramo, union } from '../../../domain/diseno/construir'
import type { Diseno } from '../../../domain/diseno/esquema'
import { alacena } from '../../../domain/fixtures/alacena'
import { buro } from '../../../domain/fixtures/buro'
import { librero } from '../../../domain/fixtures/librero'
import type { Operacion } from '../../../domain/operaciones/esquema'
import type { PhotoReading } from '../../../domain/reading/reading'
import { veredictoDe } from '../../../domain/viabilidad/viabilidad'
import type { BedPlan } from '../../../domain/modules/bed'
import { TABLE_NAMES, type TablePlan } from '../../../domain/modules/table'
import type { LLMProvider, Respuesta, RespuestaAjuste, RespuestaDictamen, RespuestaPlan, RespuestaReconstruccion, SolicitudDictamen } from '../../../ports/LLMProvider'

// Respuestas fijas para desarrollar sin API: reconoce unos cuantos pedidos por palabras clave sobre los muebles de ejemplo.

const ORIGEN = { promptId: 'simulado@1', proveedor: 'simulado', modelo: 'reglas' }
const espera = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(t), reject(new DOMException('Cancelado', 'AbortError'))))
  })

const respuesta = <T>(valor: T): Respuesta<T> => ({ valor, origen: ORIGEN, consumo: {} })

const ajuste = (parcial: Partial<RespuestaAjuste> & Pick<RespuestaAjuste, 'explicacion' | 'resumen'>): RespuestaAjuste => ({
  sugerencias: ['Hazlo de 90 cm de ancho', 'Que aguante libros pesados', 'Agrega un cajón abajo'],
  operaciones: [],
  preguntas: [],
  fotosSolicitadas: [],
  requisitos: { agregar: [], quitar: [] },
  decisiones: [],
  aceptaRiesgo: [],
  ...parcial,
})

const HEADBOARD: Record<BedPlan['headboard']['style'], string> = { none: 'sin cabecera', plain: 'cabecera lisa', bookcase: 'cabecera tipo librero', storage: 'cabecera con un compartimento a la altura de la almohada y repisas arriba' }
const WORDS: Record<string, number> = { un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4 }

/** "3 cajones", "dos entrepaños": the number said right before a word. */
function countBefore(text: string, word: string): number | null {
  const said = new RegExp(`(\\d|un|uno|dos|tres|cuatro)\\s+${word}`).exec(text)?.[1]
  return said ? (WORDS[said] ?? Number(said)) : null
}

const TABLES: [TablePlan['use'], RegExp, { width: number; height: number; depth: number }][] = [
  ['desk', /escritorio/, { width: 1200, height: 750, depth: 600 }],
  ['coffee', /mesa de centro|mesa de caf/, { width: 1000, height: 420, depth: 550 }],
  ['side', /mesa lateral|mesa de noche|mesita/, { width: 500, height: 550, depth: 400 }],
  ['dining', /\bmesa\b/, { width: 1500, height: 750, depth: 900 }],
]

/** A table or desk read from the request's words, or null if it is neither. */
function tableFrom(notes: string, measures: { ancho: number; alto: number; fondo: number } | null): TablePlan | null {
  const text = notes.toLowerCase()
  const found = TABLES.find(([, pattern]) => pattern.test(text))
  if (!found) return null
  const [use, , dimensions] = found
  const name = TABLE_NAMES[use]
  const drawers = use === 'desk' && /caj/.test(text) ? (countBefore(text, 'caj') ?? 3) : 0
  return {
    kind: 'table',
    use,
    name: drawers ? `${name} con cajonera` : name,
    material: 'T18',
    dimensions: measures ? { width: measures.ancho, height: measures.alto, depth: measures.fondo } : dimensions,
    overhang: use === 'dining' ? 50 : 0,
    shelf: use === 'coffee' || use === 'side',
    pedestal: { side: drawers ? (/izquier/.test(text) ? 'left' : 'right') : 'none', drawers: Math.min(4, drawers) },
  }
}

/** A bed read from the request's words, or null if it is not a bed. */
function bedFrom(notes: string): BedPlan | null {
  const text = notes.toLowerCase()
  if (!/\bcama\b/.test(text)) return null
  const mattress = (['king', 'queen', 'matrimonial', 'individual'] as const).find((m) => text.includes(m)) ?? 'individual'
  const drawers = /caj[oó]n/.test(text)
  const both = /(dos|ambos) lados|cada lado/.test(text)
  return {
    kind: 'bed',
    name: `Cama ${mattress}${drawers ? ' con cajones' : ''}`,
    mattress,
    material: 'T18',
    height: 400,
    drawers: {
      side: !drawers ? 'none' : both ? 'both' : /derech/.test(text) ? 'right' : 'left',
      count: Math.min(4, Math.max(1, countBefore(text, 'caj') ?? 3)),
      position: /\bpie\b/.test(text) ? 'foot' : /centro/.test(text) ? 'center' : 'head',
    },
    headboard: {
      style: /sin cabecera/.test(text) ? 'none' : /cerrad|compartimento|almohada/.test(text) ? 'storage' : /librer|repisa|entrepa/.test(text) ? 'bookcase' : 'plain',
      height: 1100,
      depth: 250,
      shelves: countBefore(text, 'entrepa') ?? countBefore(text, 'repisa') ?? 2,
    },
  }
}

/** El simulado solo conoce sus tres muebles de ejemplo; ante otra cosa lo dice en vez de inventar un librero. */
export class MuebleDesconocido extends Error {
  constructor() {
    super('El modo simulado solo sabe armar libreros, burós y alacenas de ejemplo. Para diseñar este mueble conecta un experto real (Claude, OpenAI o SheLLM) en el engrane.')
  }
}

function elegirFixture(medidas: { ancho: number; alto: number } | null, descripcion = ''): Diseno {
  const d = descripcion.toLowerCase()
  // Primero el nombre del mueble: "repisa" o "puertas" también salen al describir un buró.
  if (/bur[oó]|mesa de noche|mesita/.test(d)) return buro
  if (/alacena|gabinete/.test(d)) return alacena
  if (/librer|estante|libros/.test(d)) return librero
  if (/repisa/.test(d)) return librero
  if (/puertas/.test(d)) return alacena
  if (d.trim()) throw new MuebleDesconocido()
  if (!medidas) return librero
  const { ancho, alto } = medidas
  if (alto > ancho * 1.8) return librero
  if (alto < 650) return buro
  return alacena
}

const horizontalesConCarga = (d: Diseno) => d.piezas.filter((p) => p.normal === 'y' && (p.rol === 'entrepano' || p.rol === 'piso'))
const entrepanos = (d: Diseno) => d.piezas.filter((p) => p.rol === 'entrepano').sort((a, b) => a.id.localeCompare(b.id))

function opsDivisor(d: Diseno): Operacion[] {
  const ops: Operacion[] = [
    {
      op: 'agregarPieza',
      pieza: pieza({ id: 'divisor', nombre: 'Divisor', rol: 'divisor', material: 'T18', normal: 'x', x: desde(entre('lat-izq.x1', 'lat-der.x0', 0.5, -9)), y: tramo(ref('piso.y1'), ref('techo.y0')), z: tramo(ref('trasera.z1'), ref('mueble.z1')) }),
    },
    { op: 'agregarUnion', union: union('u-div-piso', 'piso', 'divisor', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]) },
    { op: 'agregarUnion', union: union('u-div-techo', 'techo', 'divisor', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]) },
    { op: 'agregarUnion', union: union('u-div-trasera', 'trasera', 'divisor', 'clavo-pegamento', [{ herrajeId: 'clavo-sin-cabeza-1', cantidad: null }]) },
  ]
  if (d.piezas.some((p) => p.id === 'zoclo'))
    ops.push(
      {
        op: 'agregarPieza',
        pieza: pieza({ id: 'apoyo-piso', nombre: 'Apoyo central del piso', rol: 'refuerzo', material: 'T18', normal: 'x', x: desde(entre('lat-izq.x1', 'lat-der.x0', 0.5, -9)), y: tramo(ref('mueble.y0'), ref('piso.y0')), z: tramo(ref('trasera.z1'), ref('zoclo.z0')) }),
      },
      { op: 'agregarUnion', union: union('u-apoyo-piso', 'piso', 'apoyo-piso', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]) },
      { op: 'agregarUnion', union: union('u-apoyo-zoclo', 'zoclo', 'apoyo-piso', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: 2 }]) },
      { op: 'agregarUnion', union: union('u-apoyo-trasera', 'trasera', 'apoyo-piso', 'clavo-pegamento', [{ herrajeId: 'clavo-sin-cabeza-1', cantidad: null }]) },
    )
  for (const e of entrepanos(d)) {
    const der = `${e.id}-der`
    ops.push(
      { op: 'redimensionar', id: e.id, eje: 'x', extremo: 'hasta', cota: ref('divisor.x0') },
      { op: 'duplicarPieza', id: e.id, nuevoId: der, nombre: `${e.nombre} derecho`, eje: 'x', cota: ref('divisor.x1') },
      { op: 'redimensionar', id: der, eje: 'x', extremo: 'hasta', cota: ref('lat-der.x0') },
      ...d.uniones.filter((u) => u.a === e.id && u.b === 'lat-der').map((u): Operacion => ({ op: 'eliminarUnion', id: u.id })),
      { op: 'agregarUnion', union: union(`u-${e.id}-div`, e.id, 'divisor', 'soporte-repisa', [{ herrajeId: 'soporte-repisa-5', cantidad: 2 }]) },
      { op: 'agregarUnion', union: union(`u-${der}-div`, der, 'divisor', 'soporte-repisa', [{ herrajeId: 'soporte-repisa-5', cantidad: 2 }]) },
    )
  }
  return ops
}

const PREGUNTA_TRASERA = '¿La trasera va clavada por detrás o metida en un canal?'

function proponer(peticion: string, d: Diseno, pendientes: Operacion[] | null, conFoto: boolean): RespuestaAjuste {
  const texto = peticion.toLowerCase()
  const trasera = d.piezas.find((p) => p.id === 'trasera' && p.confianza !== 'alta')
  if (trasera && (conFoto || /clavada|canal|no sé|trasera/.test(texto))) {
    const canal = /canal/.test(texto) && !conFoto
    return ajuste({
      explicacion: conFoto
        ? 'Con la foto se ve que la trasera va clavada por detrás, sobre los cantos de laterales, piso y techo. Lo dejo confirmado.'
        : canal
          ? 'Un canal pide router y sacarlo con precisión; para armarlo en casa te propongo dejarla clavada y pegada por detrás, que escuadra igual de bien con 6 mm. La marco como confirmada.'
          : 'Perfecto: la trasera va clavada y pegada por detrás. La marco como confirmada.',
      resumen: 'Confirmar la trasera',
      operaciones: [{ op: 'cambiarPropiedades', id: trasera.id, nombre: null, rol: null, veta: null, carga: null, apoyo: null, cantos: null, confianza: 'alta' }],
      decisiones: [{ tema: 'trasera', texto: 'Trasera clavada y pegada por detrás, sin canal' }],
    })
  }
  const cm = /(\d+(?:[.,]\d+)?)\s*(cm|mm)/.exec(texto)
  const medida = cm ? Number(cm[1].replace(',', '.')) * (cm[2] === 'cm' ? 10 : 1) : null

  if (/divisor|apoyo/.test(texto) && d.piezas.some((p) => p.id === 'lat-izq') && !d.piezas.some((p) => p.id === 'divisor'))
    return ajuste({
      explicacion: 'Pongo un divisor vertical al centro, de piso a techo, y parto cada entrepaño en dos; abajo agrego un apoyo central para el piso. Así cada tramo queda con la mitad de claro y aguanta los libros sin pandearse.',
      resumen: pendientes ? 'Ensanchar con divisor al centro' : 'Agregar divisor al centro',
      operaciones: [...(pendientes ?? []), ...opsDivisor(d)],
      decisiones: [{ tema: 'divisor', texto: 'Divisor al centro para que los entrepaños no se pandeen con el ancho nuevo' }],
    })

  if (/fondo|profund/.test(texto) && medida && !/caj[oó]n/.test(texto))
    return ajuste({
      explicacion: `Cambio el fondo a ${medida / 10} cm. Laterales, piso, techo y entrepaños se alargan hacia el frente.`,
      resumen: `Fondo de ${medida / 10} cm`,
      operaciones: [{ op: 'cambiarDimensionGlobal', eje: 'z', valor: medida, regla: 'estirar' }],
    })

  const hueco = ['piso', ...entrepanos(d).map((p) => p.id)]
  if (/caj[oó]n/.test(texto) && hueco.length > 1 && d.piezas.some((p) => p.id === 'lat-izq') && !d.piezas.some((p) => p.rol === 'puerta')) {
    const n = new Set(d.piezas.filter((p) => p.grupo?.startsWith('cajon-')).map((p) => p.grupo)).size + 1
    const abajo = n === 1 ? 'piso' : hueco[n - 1]
    const arriba = hueco[n]
    if (arriba)
      return ajuste({
        explicacion: `Pongo un cajón ${abajo === 'piso' ? 'entre el piso y el primer entrepaño' : 'en el siguiente hueco entre entrepaños'}, con correderas telescópicas y frente embutido. La caja es de 15 mm atornillada, con fondo de 6 mm clavado; la corredera la elijo según el fondo del mueble.`,
        resumen: `Agregar cajón ${n}`,
        operaciones: [
          {
            op: 'agregarCajon',
            grupo: `cajon-${n}`,
            nombre: `Cajón ${n}`,
            izquierda: 'lat-izq.x1',
            derecha: 'lat-der.x0',
            abajo: `${abajo}.y1`,
            arriba: `${arriba}.y0`,
            frente: 'mueble.z1',
            fondo: 'trasera.z1',
            material: 'T15',
            materialFondo: 'TR6',
          },
        ],
        decisiones: [{ tema: 'cajones', texto: 'Cajones con frente embutido y correderas telescópicas; caja de 15 mm' }],
      })
  }

  if (/ancho|anch|espacio/.test(texto) && medida)
    return ajuste({
      explicacion: `Cambio el ancho total a ${medida / 10} cm. Los laterales se recorren y el piso, el techo y los entrepaños se estiran para llenar el espacio.`,
      resumen: `Ensanchar a ${medida / 10} cm`,
      operaciones: [{ op: 'cambiarDimensionGlobal', eje: 'x', valor: medida, regla: 'estirar' }],
      requisitos: { agregar: [{ id: 'espacio-ancho', texto: `El espacio mide ${medida / 10} cm de ancho`, tipo: 'espacio', eje: 'x', min: null, max: medida }], quitar: [] },
    })

  if (/libro|pesad/.test(texto))
    return ajuste({
      explicacion: 'Marco los entrepaños y el piso para carga de libros. Con eso la revisión calcula cuánto se pandearían.',
      resumen: 'Preparar para libros',
      operaciones: horizontalesConCarga(d).map((p): Operacion => ({ op: 'cambiarPropiedades', id: p.id, nombre: null, rol: null, veta: null, carga: 'pesada', apoyo: null, cantos: null, confianza: null })),
      requisitos: { agregar: [{ id: 'carga-libros', texto: 'Va a cargar libros', tipo: 'carga', eje: null, min: null, max: null }], quitar: [] },
    })

  if (/muro|ancla|vuelco/.test(texto) && !d.anclajeMuro)
    return ajuste({
      explicacion: 'Lo marco para ir anclado al muro: con un kit antivuelco atornillado a la pared ya no se va de frente aunque lo jalen.',
      resumen: 'Anclar al muro',
      operaciones: [{ op: 'cambiarAnclajeMuro', valor: true }],
      decisiones: [{ tema: 'anclaje', texto: 'Anclado al muro con kit antivuelco por ser alto y poco profundo' }],
    })

  const primero = entrepanos(d)[0]
  if (/baja|sube/.test(texto) && primero) {
    const delta = (medida ?? 100) * (/baja/.test(texto) ? -1 : 1)
    const actual = primero.y.desde ?? primero.y.hasta
    const cota = actual && actual.tipo !== 'mm' ? { ...actual, mas: actual.mas + delta } : null
    if (cota)
      return ajuste({
        explicacion: `${delta < 0 ? 'Bajo' : 'Subo'} ${primero.nombre.toLowerCase()} ${Math.abs(delta) / 10} cm.`,
        resumen: `${delta < 0 ? 'Bajar' : 'Subir'} ${primero.nombre.toLowerCase()}`,
        operaciones: [{ op: 'mover', id: primero.id, eje: 'y', cota }],
      })
  }

  if (/refuerz|base/.test(texto) && d.piezas.some((p) => p.id === 'zoclo') && !d.piezas.some((p) => p.id === 'refuerzo-base'))
    return ajuste({
      explicacion: 'Agrego un travesaño trasero bajo el piso, con tornillos de bolsillo a los laterales. Junto con el zoclo, el piso queda apoyado adelante y atrás y la base ya no se tuerce.',
      resumen: 'Reforzar la base',
      operaciones: [
        {
          op: 'agregarPieza',
          pieza: pieza({ id: 'refuerzo-base', nombre: 'Travesaño trasero', rol: 'refuerzo', material: 'T18', normal: 'z', x: tramo(ref('lat-izq.x1'), ref('lat-der.x0')), y: tramo(ref('mueble.y0'), ref('piso.y0')), z: desde(ref('trasera.z1')) }),
        },
        { op: 'agregarUnion', union: union('u-refuerzo-izq', 'refuerzo-base', 'lat-izq', 'bolsillo', [{ herrajeId: 'tornillo-bolsillo-1-1/4', cantidad: 2 }]) },
        { op: 'agregarUnion', union: union('u-refuerzo-der', 'refuerzo-base', 'lat-der', 'bolsillo', [{ herrajeId: 'tornillo-bolsillo-1-1/4', cantidad: 2 }]) },
        { op: 'agregarUnion', union: union('u-refuerzo-piso', 'piso', 'refuerzo-base', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]) },
        { op: 'agregarUnion', union: union('u-refuerzo-trasera', 'trasera', 'refuerzo-base', 'clavo-pegamento', [{ herrajeId: 'clavo-sin-cabeza-1', cantidad: null }]) },
      ],
      decisiones: [{ tema: 'base', texto: 'Travesaño trasero bajo el piso además del zoclo' }],
    })

  return ajuste({
    explicacion: 'En modo simulado solo entiendo algunos pedidos. Prueba con uno de estos:',
    resumen: 'Sin cambios',
    preguntas: [{ texto: 'Pedidos de ejemplo', opciones: ['Hazlo de 90 cm de ancho', 'Que aguante libros pesados', 'Hazlo de 50 cm de fondo', 'Agrega un cajón abajo'] }],
  })
}

/** Sin criterio propio: se queda con el veredicto de las cuentas y da consejos de siempre. */
function dictaminar(s: SolicitudDictamen): RespuestaDictamen {
  const veredicto = veredictoDe(s.comprobaciones)
  return {
    veredicto,
    resumen:
      veredicto === 'viable'
        ? `Tu ${s.diseno.nombre.toLowerCase()} se puede comprar y armar así. (Esto es el modo simulado: conecta un experto real para una revisión con criterio.)`
        : `Antes de comprar hay que resolver lo marcado en las cuentas. (Esto es el modo simulado: conecta un experto real para una revisión con criterio.)`,
    problemas: [],
    consejos: ['Mide el espesor real de tus hojas antes de cortar: el triplay de 18 mm suele medir un poco menos.', 'Pide los cortes largos en la tienda y deja los chicos para casa.'],
  }
}

export function crearSimulado(retraso = 900): LLMProvider {
  return {
    id: 'simulado',
    etiqueta: 'Simulado',
    async reconstruir(s, signal) {
      await espera(retraso * 2, signal)
      const sinFotos = s.fotos.length === 0 && !s.lectura
      const base = elegirFixture(s.medidas, s.notas)
      const diseno = { ...structuredClone(base), dimensiones: s.medidas ?? base.dimensiones }
      const trasera = diseno.piezas.find((p) => p.id === 'trasera')
      if (trasera) trasera.confianza = 'baja'
      const quiereCajon = /caj[oó]n/i.test(s.notas) && base === librero
      const detalle = `${base.observaciones.charAt(0).toLowerCase()}${base.observaciones.slice(1)}`
      const valor: RespuestaReconstruccion = {
        explicacion: sinFotos
          ? `Con tu descripción armé un ${base.nombre.toLowerCase()} de triplay${s.medidas ? ' con tus medidas' : ''}: ${detalle} No dijiste cómo va la trasera, así que la dejé en boceto.${quiereCajon ? ' El cajón lo agrego en cuanto me confirmes.' : ''}`
          : `Veo un ${base.nombre.toLowerCase()} de triplay. Lo armé con tus medidas; ${detalle} No alcanzo a ver cómo va la trasera, así que la dejé en boceto.`,
        diseno,
        preguntas: [
          { texto: PREGUNTA_TRASERA, opciones: ['Clavada', 'En canal', 'No sé'] },
          quiereCajon
            ? { texto: '¿Agrego el cajón que mencionaste?', opciones: ['Agrega un cajón abajo', 'Sin cajón por ahora'] }
            : { texto: '¿Qué vas a guardar principalmente?', opciones: ['Libros', 'Ropa doblada', 'Decoración'] },
        ],
        fotosSolicitadas: sinFotos || s.fotos.some((f) => f.angulo === 'interior') ? [] : [{ angulo: 'interior', motivo: 'Para ver cómo va fijada la trasera' }],
        requisitos: [],
        sugerencias: ['Que aguante libros pesados', 'Hazlo de 90 cm de ancho', 'Hazlo de 50 cm de fondo'],
      }
      return respuesta(valor)
    },
    async proponerAjuste(s, signal) {
      await espera(retraso, signal)
      return respuesta(proponer(s.peticion, s.diseno, s.propuesta, s.fotos.length > 0))
    },
    // Only beds come from a plan: its demo adjustments name the pieces of its fixtures, so those are designed whole.
    async planDesign(s, signal) {
      await espera(retraso, signal)
      const bed = bedFrom(s.notas)
      const table = bed ? null : tableFrom(s.notas, s.medidas)
      if (table)
        return respuesta<RespuestaPlan>({
          explicacion: `Armé ${table.use === 'desk' ? 'un escritorio' : `una ${table.name.toLowerCase()}`} de ${table.dimensions.width / 10} × ${table.dimensions.depth / 10} cm y ${table.dimensions.height / 10} cm de alto${table.pedestal.side === 'none' ? '' : `, con una cajonera de ${table.pedestal.drawers} cajones a la ${table.pedestal.side === 'left' ? 'izquierda' : 'derecha'}`}. Todo lo puedes cambiar en la ficha, en la pestaña Mueble.`,
          cabinet: null,
          bed: null,
          table,
          preguntas: [],
          fotosSolicitadas: [],
          requisitos: [],
          sugerencias: table.use === 'desk' ? ['Hazlo de 1.40 m', 'Cajonera del otro lado'] : ['Hazla más larga', 'Con repisa abajo'],
        })
      return respuesta<RespuestaPlan>({
        explicacion: bed
          ? `Armé una cama ${bed.mattress} con base de ${bed.height / 10} cm, ${bed.drawers.side === 'none' ? 'sin cajones' : `${bed.drawers.count} cajones ${bed.drawers.side === 'both' ? 'de cada lado' : `del lado ${bed.drawers.side === 'left' ? 'izquierdo' : 'derecho'}`}`} y ${HEADBOARD[bed.headboard.style]}. Todo lo puedes cambiar en la ficha, en la pestaña Mueble.`
          : '',
        cabinet: null,
        bed,
        table: null,
        preguntas: bed ? [{ texto: '¿Cuánto peso va a cargar la cama?', opciones: ['Una persona', 'Dos personas'] }] : [],
        fotosSolicitadas: [],
        requisitos: [],
        sugerencias: bed ? ['Súbela a 45 cm', 'Cabecera tipo librero', 'Cajones de los dos lados'] : [],
      })
    },
    adjustPlan: null,
    async readPhoto(r, signal) {
      await espera(retraso, signal)
      const base = elegirFixture(null, `${r.context} ${r.photo.note ?? ''}`)
      const front = r.photo.angulo !== 'lateral'
      return respuesta<PhotoReading>({
        kind: base.nombre.toLowerCase(),
        confidence: 'medium',
        description: `Parece un ${base.nombre.toLowerCase()} de triplay. (Lectura simulada.)`,
        proportions: { height: base.dimensiones.alto / base.dimensiones.ancho, width: 1, depth: base.dimensiones.fondo / base.dimensiones.ancho },
        base: base === librero ? 'kick' : 'floor',
        topOverhangs: false,
        columns: front ? [{ width: 1, cells: [{ height: 1, content: base === alacena ? 'door' : 'open', shelves: base === librero ? 4 : 1, doors: base === alacena ? 2 : null }] }] : null,
        details: [],
        doubts: ['No se ve cómo va fijada la trasera'],
      })
    },
    async dictaminar(s, signal) {
      await espera(retraso, signal)
      return respuesta(dictaminar(s))
    },
  }
}
