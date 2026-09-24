import { desde, entre, pieza, ref, tramo, union } from '../../../domain/diseno/construir'
import type { Diseno } from '../../../domain/diseno/esquema'
import { alacena } from '../../../domain/fixtures/alacena'
import { buro } from '../../../domain/fixtures/buro'
import { librero } from '../../../domain/fixtures/librero'
import type { Operacion } from '../../../domain/operaciones/esquema'
import type { LLMProvider, Respuesta, RespuestaAjuste, RespuestaReconstruccion } from '../../../ports/LLMProvider'

// Respuestas fijas para desarrollar sin API: reconoce unos cuantos pedidos por palabras clave sobre los muebles de ejemplo.

const ORIGEN = { promptId: 'simulado@1', proveedor: 'simulado', modelo: 'reglas' }
const espera = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(t), reject(new DOMException('Cancelado', 'AbortError'))))
  })

const respuesta = <T>(valor: T): Respuesta<T> => ({ valor, origen: ORIGEN, consumo: {} })

const ajuste = (parcial: Partial<RespuestaAjuste> & Pick<RespuestaAjuste, 'explicacion' | 'resumen'>): RespuestaAjuste => ({
  operaciones: [],
  preguntas: [],
  requisitos: { agregar: [], quitar: [] },
  decisiones: [],
  aceptaRiesgo: [],
  ...parcial,
})

function elegirFixture(ancho: number, alto: number): Diseno {
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
    { op: 'agregarUnion', union: union('u-div-piso', 'divisor', 'piso', 'tope-tornillo', [{ herrajeId: 'tornillo-8x2', cantidad: null }]) },
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

function proponer(peticion: string, d: Diseno, pendientes: Operacion[] | null): RespuestaAjuste {
  const texto = peticion.toLowerCase()
  const cm = /(\d+(?:[.,]\d+)?)\s*(cm|mm)/.exec(texto)
  const medida = cm ? Number(cm[1].replace(',', '.')) * (cm[2] === 'cm' ? 10 : 1) : null

  if (/divisor|apoyo/.test(texto) && d.piezas.some((p) => p.id === 'lat-izq') && !d.piezas.some((p) => p.id === 'divisor'))
    return ajuste({
      explicacion: 'Pongo un divisor vertical al centro, de piso a techo, y parto cada entrepaño en dos; abajo agrego un apoyo central para el piso. Así cada tramo queda con la mitad de claro y aguanta los libros sin pandearse.',
      resumen: pendientes ? 'Ensanchar con divisor al centro' : 'Agregar divisor al centro',
      operaciones: [...(pendientes ?? []), ...opsDivisor(d)],
      decisiones: [{ tema: 'divisor', texto: 'Divisor al centro para que los entrepaños no se pandeen con el ancho nuevo' }],
    })

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
      operaciones: horizontalesConCarga(d).map((p): Operacion => ({ op: 'cambiarPropiedades', id: p.id, nombre: null, rol: null, veta: null, carga: 'pesada', apoyo: null, cantos: null })),
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
    preguntas: [{ texto: 'Pedidos de ejemplo', opciones: ['Hazlo de 90 cm de ancho', 'Que aguante libros pesados', 'Baja una repisa 10 cm', 'Agrega un divisor al centro'] }],
  })
}

export function crearSimulado(retraso = 900): LLMProvider {
  return {
    id: 'simulado',
    etiqueta: 'Simulado',
    async reconstruir(s, signal) {
      await espera(retraso * 2, signal)
      const base = elegirFixture(s.medidas.ancho, s.medidas.alto)
      const valor: RespuestaReconstruccion = {
        explicacion: `Veo un ${base.nombre.toLowerCase()} de triplay. Lo armé con tus medidas; ${base.observaciones.charAt(0).toLowerCase()}${base.observaciones.slice(1)}`,
        diseno: { ...structuredClone(base), dimensiones: s.medidas },
        preguntas: [{ texto: '¿Qué vas a guardar principalmente?', opciones: ['Libros', 'Ropa doblada', 'Decoración'] }],
        fotosSolicitadas: s.fotos.some((f) => f.angulo === 'interior') ? [] : [{ angulo: 'interior', motivo: 'para confirmar cómo va fijada la trasera' }],
        requisitos: [],
      }
      return respuesta(valor)
    },
    async proponerAjuste(s, signal) {
      await espera(retraso, signal)
      return respuesta(proponer(s.peticion, s.diseno, s.propuesta))
    },
  }
}
