import { cutBox } from '../../domain/design/cuts'
import { faceAxes, roundTo, type Geometry } from '../../domain/design/resolve'
import { outline } from '../../domain/design/slants'
import type { Design, JointType } from '../../domain/design/schema'
import { JOINTS } from '../../domain/design/jointSpecs'
import { hardwarePerJoint } from '../../domain/design/hardwareCount'
import { JOINT_GUIDE, type GuideJoint } from '../../domain/design/jointGuide'
import { hangsFromWall, installationLabel } from '../../domain/design/installation'
import { slidingFits } from '../../domain/design/manufacturing'
import { anchoringAdvice, WALL_LABELS } from '../../domain/estimate/anchoring'
import { wallOf } from '../../domain/design/schema'
import type { Purchase } from '../../domain/estimate/purchase'
import type { Catalog } from '../../domain/materials/catalog'
import { JointDiagram } from '../studio/JointDiagram'

const mm = (n: number) => roundTo(n, 2)
const AXIS = { x: 'ancho', y: 'alto', z: 'fondo' }
const CONNECTIONS_PER_ROW = 4
interface ConnectionGroup {
  name: string
  count: number
  hardware: Map<string, number>
  pairs: { a: string; b: string }[]
  glue: boolean
}

export function ShoppingDetails({ purchase }: { purchase: Purchase }) {
  return <section id="purchase" className="workshop-section">
    <h2>Compra de herrajes y consumibles</h2>
    <p>Las cantidades son calculadas. Confirma la presentación, el espesor real y la ficha de cada herraje antes de comprar.</p>
    <table>
      <thead><tr><th>Artículo / especificación</th><th>Cantidad necesaria</th><th>Compra</th></tr></thead>
      <tbody>
        {purchase.hardware.map((h) => <tr key={h.hardware.id}>
          <td>{h.hardware.name}</td>
          <td>{h.count}{h.hardware.role === 'edge-banding' ? ' m' : ''}</td>
          <td>{h.packs ? `${h.packs} paquetes de ${h.hardware.perPack}` : 'Por unidad'}</td>
        </tr>)}
        {purchase.finish?.lines.flatMap((line) => line.containers.map((c) => <tr key={c.sku.id}>
          <td>{c.sku.name}</td><td>{c.count}</td><td>Envases</td>
        </tr>))}
      </tbody>
    </table>
    {purchase.hardware.length === 0 && <p>Sin herrajes de catálogo registrados.</p>}
  </section>
}

export function SheetDetails({ purchase, numbers, trim }: { purchase: Purchase; numbers: Map<string, number>; trim: number }) {
  return <section id="layout" className="workshop-section">
    <h2>Acomodo estimado de las hojas</h2>
    <p>Respeta la veta y el disco de corte. Este acomodo estima la compra; la maderería debe confirmar su secuencia de cortes. Los rectángulos incluyen el material que después se mecaniza.</p>
    {purchase.layout.map((layout) => <div key={layout.material}>
      {layout.sheets.map((sheet, index) => <figure key={index} className="sheet-layout">
        <figcaption>{layout.material} · hoja {index + 1} / {layout.sheets.length} · {layout.sheet.length} × {layout.sheet.width} mm · desperdicio {Math.round(sheet.waste * 100)} %</figcaption>
        <svg viewBox={`0 0 ${layout.sheet.length} ${layout.sheet.width}`} role="img" aria-label={`Acomodo de ${layout.material}, hoja ${index + 1}`}>
          <rect width={layout.sheet.length} height={layout.sheet.width} fill="#eee" stroke="#1d1b19" />
          <rect x={trim} y={trim} width={layout.usable.length} height={layout.usable.width} fill="white" />
          {sheet.placed.map((p) => <g key={p.id}>
            <title>{p.name}: {mm(p.w)} × {mm(p.h)} mm</title>
            <rect x={trim + p.x} y={trim + p.y} width={p.w} height={p.h} fill="#efebe4" stroke="#1d1b19" strokeWidth="2" />
            <text x={trim + p.x + p.w / 2} y={trim + p.y + p.h / 2} fontSize={Math.min(80, p.h * 1.2, p.w * 0.8)} textAnchor="middle" dominantBaseline="central">
              {numbers.get(p.id)}
            </text>
          </g>)}
        </svg>
        <p>Piezas en esta hoja: {[...new Set(sheet.placed.map((p) => numbers.get(p.id)))].map((number) => {
          const pieces = sheet.placed.filter((p) => numbers.get(p.id) === number)
          return `#${number} × ${pieces.length}`
        }).join(' · ')}. Identifica los rectángulos angostos con la lista de corte.</p>
        {sheet.leftover && <p>Sobrante estimado aprovechable: {sheet.leftover.length} × {sheet.leftover.width} mm.</p>}
      </figure>)}
      {layout.unplaced.length > 0 && <p>No caben: {layout.unplaced.map((p) => p.name).join(', ')}. Resuelve estas piezas antes de pedir el corte.</p>}
    </div>)}
  </section>
}

export function MachiningDetails({ design, geo, numbers }: { design: Design; geo: Geometry; numbers: Map<string, number> }) {
  const cards = new Map<string, { piece: Design['pieces'][number]; ids: string[]; box: NonNullable<ReturnType<Geometry['boxes']['get']>> }>()
  for (const piece of design.pieces) {
    const box = geo.boxes.get(piece.id)
    if (!box || !(piece.cuts?.length || piece.slants?.length || piece.rounds?.length || piece.holes?.length)) continue
    const key = JSON.stringify([numbers.get(piece.id), piece.normal, piece.cuts, piece.slants, piece.rounds, piece.holes])
    const found = cards.get(key)
    if (found) found.ids.push(piece.id)
    else cards.set(key, { piece, ids: [piece.id], box })
  }
  return <section id="machining" className="workshop-section">
    <div className="section-intro">
      <h2>Mecanizado y perfiles</h2>
      <p>Medidas en mm; dibujos sin escala. El origen O es la esquina inferior izquierda del dibujo. Los ejes indican la orientación de la pieza en el mueble: x = ancho, y = alto, z = fondo. Marca también frente y cara interior con el despiece.</p>
      <p>Las cotas son nominales. Mide el tablero y prueba ranuras y ajustes en un sobrante. El cubrecanto y el acabado deben conservar las holguras indicadas.</p>
    </div>
    {[...cards.values()].map(({ piece, ids, box }) => {
      const [a, b] = faceAxes(piece.normal)
      const [a0, b0] = [box[`${a}0`], box[`${b}0`]]
      const [width, height] = [box[`${a}1`] - a0, box[`${b}1`] - b0]
      const thickness = box[`${piece.normal}1`] - box[`${piece.normal}0`]
      const profile = outline(box, piece.normal, piece.slants ?? [], piece.rounds).map(([u, v]) => [mm(u - a0), mm(v - b0)] as const)
      const cuts = (piece.cuts ?? []).map((cut) => {
        const c = cutBox(box, cut)
        const n0 = box[`${piece.normal}0`], n1 = box[`${piece.normal}1`]
        const depth = Math.min(n1, c[`${piece.normal}1`]) - Math.max(n0, c[`${piece.normal}0`])
        const face = depth >= thickness ? 'pasante' : c[`${piece.normal}0`] <= n0 ? `cara ${piece.normal}−` : c[`${piece.normal}1`] >= n1 ? `cara ${piece.normal}+` : 'interior'
        return {
          u: Math.max(c[`${a}0`], a0) - a0,
          v: Math.max(c[`${b}0`], b0) - b0,
          width: Math.max(0, Math.min(c[`${a}1`], box[`${a}1`]) - Math.max(c[`${a}0`], a0)),
          height: Math.max(0, Math.min(c[`${b}1`], box[`${b}1`]) - Math.max(c[`${b}0`], b0)),
          depth,
          face,
        }
      })
      const pad = Math.max(width, height) * 0.08
      return <article key={ids.join()} className="machining-card">
        <h3>#{numbers.get(piece.id)} · {piece.name} · {ids.length} {ids.length === 1 ? 'pieza' : 'piezas'}</h3>
        <p className="piece-ids">Identificación: {ids.join(', ')}</p>
        <div className="machining-grid">
          <svg viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`} role="img" aria-label={`Plano de mecanizado de ${piece.name}`}>
            <g transform={`translate(0 ${height}) scale(1 -1)`}>
              <polygon points={profile.map(([u, v]) => `${u},${v}`).join(' ')} fill="#efebe4" stroke="#1d1b19" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
              {cuts.map((c, i) => <rect key={i} x={c.u} y={c.v} width={c.width} height={c.height} fill="#ccc" stroke="#1d1b19" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
              {piece.holes?.map((h, i) => <circle key={i} cx={h[a] ?? 0} cy={h[b] ?? 0} r={h.diameter / 2} fill="white" stroke="#1d1b19" vectorEffect="non-scaling-stroke" />)}
            </g>
            <text x="0" y={height + pad * 0.7} fontSize={pad * 0.55}>O · {a} → {mm(width)} ({AXIS[a]}) · {b} ↑ {mm(height)} ({AXIS[b]})</text>
          </svg>
          <div>
            <p>Rectángulo: {mm(width)} × {mm(height)} · espesor {mm(thickness)}.</p>
            {cuts.map((c, i) => <p key={i}>
              Corte {i + 1}: {c.face}; desde O: {a}={mm(c.u)}, {b}={mm(c.v)}.
              Tamaño {mm(c.width)} × {mm(c.height)}; profundidad {mm(c.depth)}.
            </p>)}
            {!!piece.slants?.length && <p>Perfil: une estos puntos ({a}, {b}) desde O: {profile.map(([u, v]) => `(${u}, ${v})`).join(' → ')}. Conserva las parejas espejo.</p>}
            {piece.rounds?.map((r, i) => <p key={i}>Redondeo: radio {r.radius}; esquina {a} {r[a]}, {b} {r[b]}.</p>)}
            {piece.holes?.map((h, i) => <p key={i}>Agujero pasante {i + 1}: Ø {h.diameter}; centro {a}={h[a]}, {b}={h[b]} desde O.</p>)}
          </div>
        </div>
      </article>
    })}
    {!cards.size && <p>Este diseño sólo tiene rectángulos; no hay mecanizados geométricos registrados.</p>}
    <p><strong>Antes de perforar herrajes:</strong> el modelo no registra sus centros ni sus profundidades de perforación. Marca las conexiones con la tabla de uniones de la guía completa, presenta el herraje real y usa su plantilla y ficha. No deduzcas agujeros de estos dibujos.</p>
  </section>
}

export function JointDetails({ design, geo, catalog, numbers }: { design: Design; geo: Geometry; catalog: Catalog; numbers: Map<string, number> }) {
  const byId = new Map(design.pieces.map((p) => [p.id, p]))
  const groups = new Map<string, ConnectionGroup[]>()
  for (const joint of design.joints) {
    const resting = !joint.glue && joint.hardware.length > 0 && joint.hardware.every((h) => h.count === 0)
    const name = resting ? 'apoyo sin fijación' : `${JOINTS[joint.type].label.singular}${joint.depth ? ` · profundidad ${joint.depth} mm` : ''}`
    const key = JSON.stringify([numbers.get(joint.a), numbers.get(joint.b), joint.type, joint.depth, joint.glue, resting])
    const batches = groups.get(key) ?? []
    const last = batches.at(-1)
    let group = last && last.count < CONNECTIONS_PER_ROW ? last : undefined
    if (!group) {
      group = { name, count: 0, hardware: new Map(), pairs: [], glue: joint.glue }
      batches.push(group)
      groups.set(key, batches)
    }
    group.count++
    group.pairs.push({ a: joint.a, b: joint.b })
    for (const h of joint.hardware) {
      const count = h.count ?? hardwarePerJoint(joint, geo)
      if (count > 0) group.hardware.set(h.hardwareId, (group.hardware.get(h.hardwareId) ?? 0) + count)
    }
  }
  const types = [...new Set(design.joints.map((j) => j.type))].filter((type): type is Extract<GuideJoint, JointType> => type in JOINT_GUIDE)
  return <section id="joints" className="workshop-section">
    <h2>Uniones de este modelo</h2>
    <p>Conecta las piezas identificadas, con el herraje indicado. Las cantidades no son un plano de perforación. Si cambias una unión o un tornillo, recalcula y revisa el diseño antes de construir.</p>
    <table>
      <thead><tr><th>Conexiones</th><th>Unión</th><th>Herrajes / pegamento</th></tr></thead>
      <tbody>{[...groups.entries()].flatMap(([key, batches]) => batches.map((group, index) => <tr key={`${key}-${index}`}>
        <td>{group.pairs.map(({ a, b }) => <div key={`${a}-${b}`} className="connection-pair">
          <span>#{numbers.get(a)} · {byId.get(a)?.name} ↔ #{numbers.get(b)} · {byId.get(b)?.name}</span>
          <span className="piece-ids block">{a} ↔ {b}</span>
        </div>)}</td>
        <td>{group.count} × {group.name}</td>
        <td>
          {[...group.hardware].map(([id, count]) => <div key={id}>
            {count} × {catalog.hardware.find((h) => h.id === id)?.name ?? id}
          </div>)}
          {group.glue ? 'Con pegamento' : 'Sin pegamento'}
        </td>
      </tr>))}</tbody>
    </table>
    <div className="joint-recipes">{types.map((type) => <article key={type}>
      <h3>{JOINT_GUIDE[type].name}</h3>
      <JointDiagram joint={type} />
      <p>{JOINT_GUIDE[type].definition}</p>
      <p>Herramienta: {JOINT_GUIDE[type].tool}. {JOINT_GUIDE[type].note}</p>
    </article>)}</div>
  </section>
}

export function FitDetails({ design, geo, purchase }: { design: Design; geo: Geometry; purchase: Purchase }) {
  const fits = slidingFits(design, geo)
  const legs = design.pieces.filter((p) => p.id.startsWith('leg-'))
  const physicalLegs = new Set(legs.map((p) => p.id.replace(/-\d$/, ''))).size
  return <section id="fit" className="workshop-section [break-inside:avoid]">
    <h2>Ajustes e instalación</h2>
    <p><strong>{installationLabel(design)}</strong> · muro: {WALL_LABELS[wallOf(design)]}.</p>
    {!!legs.length && <p>{physicalLegs} patas físicas hechas con {legs.length} piezas. Identifica y prensa las capas de cada pareja; corta el perfil después de pegarlas y conserva las orientaciones espejo.</p>}
    {!!fits.length && <><h3>Corredizas: sección y comprobación del montaje</h3>
      <svg viewBox="0 0 430 150" className="sliding-section" role="img" aria-label="Sección de corrediza: subir al carril superior, meter el borde inferior y bajar">
        <path d="M20 15H150V45H105V25H65V45H20Z M20 120H65V135H105V120H150V150H20Z" fill="#efebe4" stroke="#1d1b19" strokeWidth="2" />
        <rect x="72" y="35" width="26" height="97" fill="#ccc" stroke="#1d1b19" />
        <path d="M125 85V48m-6 8 6-8 6 8 M180 90H145m8-6-8 6 8 6 M125 96V120m-6-8 6 8 6-8" fill="none" stroke="#1d1b19" strokeWidth="2" />
        <text x="200" y="45" fontSize="13">1. Subir a la ranura superior</text><text x="200" y="83" fontSize="13">2. Meter el borde inferior</text><text x="200" y="121" fontSize="13">3. Bajar al carril inferior</text>
      </svg>
      <p>Sección esquemática sin escala. Coloca primero la hoja del carril trasero. Las ranuras permanecen sin pegamento ni cubrecanto; prueba el movimiento después del acabado.</p>
      <table>
        <thead><tr><th>Hoja</th><th>Hueco / alto</th><th>Ranura inferior / superior</th><th>Margen extra de montaje</th><th>Madera entre carriles</th></tr></thead>
        <tbody>{fits.map((f) => <tr key={f.id}>
          <td className="piece-ids">{f.id}</td><td>{mm(f.opening)} / {mm(f.leaf)}</td>
          <td>{mm(f.lower)} / {mm(f.upper)}</td><td>{mm(f.margin)}</td>
          <td>{f.web === null ? 'Un carril' : mm(f.web)}</td>
        </tr>)}</tbody>
      </table>
    </>}
    {design.pieces.some((p) => p.support === 'movable' && p.role === 'shelf') && <p>Repisas móviles: verifica la holgura en ambos lados y que todos los soportes alcancen la repisa. Perfora con la plantilla del soporte real, con tope de profundidad y a la misma altura en ambos lados.</p>}
    {design.wallAnchored && <>
      <p>{anchoringAdvice(purchase.anchoring)}</p>
      <p>
        {hangsFromWall(design) ? 'El sistema de suspensión toma el peso del mueble y su contenido. Fija el listón estructural; la trasera delgada no es un punto de suspensión.' : 'El piso y la base toman el peso. El kit antivuelco limita la inclinación; no se usa como sistema de suspensión.'}
        {' '}Registra el modelo de fijación, las instrucciones y el muro comprobado: ____________________.
      </p>
    </>}
    <p>Material real: ____ mm · diagonales del cuerpo: ____ / ____ mm · ancho de hueco comprobado: ____ mm. Revisa de nuevo si estas medidas cambian las holguras o el herraje.</p>
  </section>
}
