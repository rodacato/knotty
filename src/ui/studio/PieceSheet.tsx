import { ArrowRight, EyeSlash, Lightning, PencilSimple, X } from '@phosphor-icons/react'
import { useState } from 'react'
import type { Design } from '../../domain/design/schema'
import { JOINTS } from '../../domain/design/jointSpecs'
import { faceSize, type Geometry } from '../../domain/design/resolve'
import type { Catalog } from '../../domain/materials/catalog'
import { Button, cm } from '../system/components'
import { useStore } from '../store'
import { EdgesSection } from './Edges'
import { PieceEditor } from './PieceEditor'

// The selected piece takes the panel, like notices and history, so the 3D is never covered (D14, D38).

const GRAIN = { length: 'a lo largo', width: 'a lo ancho', any: 'libre' }

export function PieceSheet({ design, geo, catalog, editable }: { design: Design; geo: Geometry; catalog: Catalog; editable: boolean }) {
  const confirmPiece = useStore((s) => s.confirmPiece)
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const hide = useStore((s) => s.hide)
  const thinking = useStore((s) => s.thinking)
  const [editing, setEditing] = useState(false)
  const p = design.pieces.find((x) => x.id === selection)
  const box = p && geo.boxes.get(p.id)
  if (!p || !box) return null
  const [length, width] = faceSize(box, p.normal)
  const material = catalog.materials.find((m) => m.id === p.material)
  const name = (id: string) => design.pieces.find((x) => x.id === id)?.name ?? id
  const joints = design.joints.filter((u) => u.a === p.id || u.b === p.id)
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={p.name}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg leading-tight font-semibold">{p.name}</h2>
            <p className="text-sm text-graphite-2">
              {material?.name ?? p.material} · Veta {GRAIN[p.grain]}
            </p>
          </div>
          <Button variant="ghost" className="min-h-11 shrink-0 px-3" onClick={() => hide(p.id)}>
            <EyeSlash /> Ocultar
          </Button>
          <button type="button" onClick={() => select(null)} aria-label="Cerrar" className="grid size-9 shrink-0 place-items-center rounded-full text-graphite-2 hover:bg-kraft">
            <X />
          </button>
        </div>
        {editable && (
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Lightning weight="fill" /> Al instante
          </p>
        )}
        {editing && editable && <PieceEditor key={p.id} piece={p} box={box} catalog={catalog} />}
        {!editing && (
          <dl className="grid grid-cols-3 gap-3">
            {[
              ['Largo', length],
              ['Ancho', width],
              ['Espesor', geo.thicknesses.get(p.id)!],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-graphite-2">{k}</dt>
                <dd className="numerals flex items-baseline gap-1">
                  <span className="text-2xl font-medium">{Math.round(v as number)}</span>
                  <span className="text-xs text-graphite-2">mm</span>
                </dd>
                <dd className="numerals text-xs text-graphite-2">{cm(v as number)}</dd>
              </div>
            ))}
          </dl>
        )}
        {!editing && <EdgesSection design={design} geo={geo} piece={p} editable={editable} />}
        {p.confidence === 'low' && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-paper px-3 py-2 text-sm">
            <span className="flex-1">El experto no pudo confirmar esta pieza con las fotos.</span>
            <button type="button" onClick={() => confirmPiece(p.id)} className="min-h-9 rounded-full bg-graphite px-3 font-medium text-bone">
              Está bien así
            </button>
          </div>
        )}
        {joints.length > 0 && (
          <ul className="flex flex-col gap-1.5 border-t border-line pt-3 text-sm">
            {joints.map((u) => {
              const other = u.a === p.id ? u.b : u.a
              const count = u.hardware.reduce((n, h) => n + (h.count ?? 0), 0)
              return (
                <li key={u.id} className="flex items-start gap-2">
                  <ArrowRight className="mt-1 shrink-0 text-graphite-2" />
                  <span>
                    <button type="button" className="font-medium underline decoration-line underline-offset-2 hover:decoration-graphite" onClick={() => select(other)}>
                      {name(other)}
                    </button>
                    : {count && u.type !== 'drawer-slide' ? `${count} ` : ''}
                    {JOINTS[u.type].label.plural}
                    {u.glue && u.type !== 'glue-nail' ? ' con pegamento' : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {editable && !editing && (
        <div className="px-4 pt-2 pb-4">
          <Button variant="secondary" className="min-h-11 w-full" onClick={() => setEditing(true)} disabled={thinking}>
            <PencilSimple /> Editar a mano
          </Button>
        </div>
      )}
    </section>
  )
}
