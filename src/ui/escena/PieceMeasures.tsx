import type { Diseno } from '../../domain/diseno/esquema'
import { medidasCara, redondear, type Geometria } from '../../domain/diseno/resolver'
import { Label } from './Label'

// In the exploded view, each piece carries its size, so the drawing reads like a cut list.

const MM = 0.001

export function PieceMeasures({ design, geo, offsets, dark, selected }: { design: Diseno; geo: Geometria; offsets: Map<string, [number, number, number]>; dark: boolean; selected: string | null }) {
  // Inside a drawer only its front is labeled: the box pieces are in Materiales, and their labels would pile up.
  const labeled = design.piezas.filter((p) => geo.cajas.has(p.id) && (!p.grupo || !p.rol.endsWith('-cajon') || p.rol === 'frente-cajon') && (!selected || selected === p.id))
  return (
    <group>
      {labeled.map((p) => {
        const box = geo.cajas.get(p.id)!
        const [length, width] = medidasCara(box, p.normal).map((m) => redondear(m, 0))
        const [dx, dy, dz] = offsets.get(p.id) ?? [0, 0, 0]
        const center: [number, number, number] = [((box.x0 + box.x1) / 2) * MM + dx, ((box.y0 + box.y1) / 2) * MM + dy, ((box.z0 + box.z1) / 2) * MM + dz]
        return <Label key={p.id} text={`${length} × ${width}`} position={center} dark={dark} height={selected ? 0.021 : 0.017} strong={selected === p.id} />
      })}
    </group>
  )
}
