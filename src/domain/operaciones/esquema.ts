import { z } from 'zod'
import { CaraRef, Canto, Carga, Cota, Eje, Pieza, PiezaId, Rol, Union, Veta } from '../diseno/esquema'

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
  }),
  z.object({ op: z.literal('agregarUnion'), union: Union }),
  z.object({ op: z.literal('cambiarUnion'), union: Union }).describe('Reemplaza la unión con el mismo id'),
  z.object({ op: z.literal('eliminarUnion'), id: z.string() }),
  z
    .object({ op: z.literal('cambiarDimensionGlobal'), eje: Eje, valor: z.number().positive(), regla: z.enum(['estirar', 'proporcional']) })
    .describe('estirar: lo referido a las caras del mueble se estira o se recorre. proporcional: además escala las cotas absolutas'),
  z.object({ op: z.literal('cambiarAnclajeMuro'), valor: z.boolean() }),
])
export type Operacion = z.infer<typeof Operacion>
