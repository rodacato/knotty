import { z } from 'zod'
import { CaraRef, Canto, Carga, Confianza, Cota, Eje, Pieza, PiezaId, Rol, Union, Veta } from '../diseno/esquema'

// Lo único que el LLM puede hacer con un diseño existente. Todos los campos van siempre (nullable si no aplica) por la salida estricta.

export const Operacion = z.discriminatedUnion('op', [
  z.object({ op: z.literal('agregarPieza'), pieza: Pieza }),
  z.object({ op: z.literal('eliminarPieza'), id: PiezaId }).describe('Quita la pieza y sus uniones; las cotas que la referían quedan fijas en mm'),
  z.object({ op: z.literal('eliminarGrupo'), grupo: z.string() }),
  z.object({ op: z.literal('duplicarPieza'), id: PiezaId, nuevoId: PiezaId, nombre: z.string(), eje: Eje, cota: Cota }).describe('Copia la pieza y sus uniones y la coloca con su cara menor en la cota'),
  z.object({ op: z.literal('redimensionar'), id: PiezaId, eje: Eje, extremo: z.enum(['desde', 'hasta']), cota: Cota }).describe('Mueve un extremo; el otro se queda. No aplica al eje normal'),
  z.object({ op: z.literal('mover'), id: PiezaId, eje: Eje, cota: Cota }).describe('Coloca la cara menor en la cota conservando el largo'),
  z.object({ op: z.literal('distribuir'), ids: z.array(PiezaId).min(1), eje: Eje, a: CaraRef, b: CaraRef }).describe('Reparte piezas con huecos iguales entre dos caras, en su eje normal'),
  z.object({ op: z.literal('cambiarEspesor'), ids: z.array(PiezaId).min(1), material: z.string() }),
  z.object({
    op: z.literal('cambiarPropiedades'),
    id: PiezaId,
    nombre: z.string().nullable(),
    rol: Rol.nullable(),
    veta: Veta.nullable(),
    carga: Carga.nullable(),
    apoyo: z.enum(['fijo', 'movil']).nullable(),
    cantos: z.array(Canto).nullable(),
    confianza: Confianza.nullable().describe('"alta" cuando la persona o una foto confirman la pieza'),
  }),
  z.object({ op: z.literal('agregarUnion'), union: Union }),
  z.object({ op: z.literal('cambiarUnion'), union: Union }).describe('Reemplaza la unión con el mismo id'),
  z.object({ op: z.literal('eliminarUnion'), id: z.string() }),
  z
    .object({ op: z.literal('cambiarDimensionGlobal'), eje: Eje, valor: z.number().positive(), regla: z.enum(['estirar', 'proporcional']) })
    .describe('estirar: lo referido a las caras del mueble se estira o se recorre. proporcional: además escala las cotas absolutas'),
  z.object({ op: z.literal('cambiarAnclajeMuro'), valor: z.boolean() }),
  z
    .object({
      op: z.literal('agregarCajon'),
      grupo: PiezaId.describe('Id del cajón, por ejemplo "cajon-1"; sus piezas se llaman "cajon-1-frente", "cajon-1-costado-izq"…'),
      nombre: z.string().describe('"Cajón 1"'),
      izquierda: CaraRef.describe('Cara x del hueco a la izquierda, por ejemplo "lat-izq.x1"'),
      derecha: CaraRef.describe('Cara x del hueco a la derecha, por ejemplo "lat-der.x0"'),
      abajo: CaraRef.describe('Cara y del hueco abajo, por ejemplo "piso.y1"'),
      arriba: CaraRef.describe('Cara y del hueco arriba, por ejemplo "entrepano-1.y0"'),
      frente: CaraRef.describe('Cara z con la que queda al ras el frente, normalmente "mueble.z1"'),
      fondo: CaraRef.describe('Cara z del fondo del hueco, normalmente "trasera.z1"'),
      material: z.string().describe('Frente y caja, por ejemplo "T15"'),
      materialFondo: z.string().describe('Fondo del cajón, por ejemplo "TR6"'),
    })
    .describe('Arma un cajón completo con frente embutido y correderas telescópicas; la app elige la corredera y calcula las holguras'),
])
export type Operacion = z.infer<typeof Operacion>
