import { X } from '@phosphor-icons/react'
import type { Design, JointType } from '../../domain/design/schema'
import { faceSize, type Geometry } from '../../domain/design/resolve'
import type { Catalog } from '../../domain/materials/catalog'
import { cutList } from '../../domain/materials/cutList'
import { cm } from '../system/components'
import { useStore } from '../store'
import { PieceEditor } from './PieceEditor'

const JOINTS: Record<JointType, string> = {
  'butt-screw': 'tornillo al canto',
  'pocket-screw': 'tornillo de bolsillo',
  dowel: 'tarugos',
  'cam-lock': 'minifix',
  dado: 'canal',
  rabbet: 'rebaje',
  bracket: 'escuadra',
  'glue-nail': 'clavo y pegamento',
  'shelf-pin': 'soportes de repisa',
  'cup-hinge': 'bisagras de cazoleta',
  'drawer-slide': 'corredera',
}

const GRAIN = { length: 'a lo largo', width: 'a lo ancho', any: 'libre' }

export function PieceList({ design, geo }: { design: Design; geo: Geometry }) {
  const select = useStore((s) => s.select)
  const selection = useStore((s) => s.selection)
  const list = cutList(design, geo)
  const total = list.reduce((n, r) => n + r.count, 0)
  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-sm text-graphite-2">
        {total} piezas en {new Set(list.map((r) => r.thickness)).size} espesores. Toca una para verla.
      </p>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-bone">
        {list.map((r) => (
          <li key={r.ids.join()}>
            <button
              type="button"
              onClick={() => select(r.ids[0])}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-kraft ${r.ids.includes(selection ?? '') ? 'bg-amber-soft' : ''}`}
            >
              <span className="numerals grid size-8 shrink-0 place-items-center rounded-lg bg-kraft text-sm font-medium">{r.count}×</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.name}</span>
                <span className="numerals block text-xs text-graphite-2">
                  {r.length} × {r.width} mm · {cm(r.length)} × {cm(r.width)}
                </span>
              </span>
              <span className="numerals shrink-0 rounded-full border border-line px-2 py-0.5 text-xs">{r.thickness} mm</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PieceCard({ design, geo, catalog, editable = false }: { design: Design; geo: Geometry; catalog: Catalog; editable?: boolean }) {
  const confirmPiece = useStore((s) => s.confirmPiece)
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const p = design.pieces.find((x) => x.id === selection)
  const box = p && geo.boxes.get(p.id)
  if (!p || !box) return null
  const [length, width] = faceSize(box, p.normal)
  const material = catalog.materials.find((m) => m.id === p.material)
  const name = (id: string) => design.pieces.find((x) => x.id === id)?.name ?? id
  const joints = design.joints.filter((u) => u.a === p.id || u.b === p.id)
  return (
    <div className="animate-appear pointer-events-auto w-full max-w-sm rounded-2xl md:w-80 border border-line bg-bone/95 p-4 shadow-[0_18px_40px_-20px_rgba(43,40,37,.5)] backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-semibold">{p.name}</p>
          <p className="text-xs text-graphite-2">{material?.name ?? p.material}</p>
        </div>
        <button type="button" onClick={() => select(null)} aria-label="Cerrar" className="grid size-8 place-items-center rounded-full hover:bg-kraft">
          <X />
        </button>
      </div>
      <dl className="numerals mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ['Largo', length],
          ['Ancho', width],
          ['Espesor', geo.thicknesses.get(p.id)!],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-kraft px-2 py-2">
            <dt className="font-sans text-[10px] tracking-wide text-graphite-2 uppercase">{k}</dt>
            <dd className="text-base font-medium">{Math.round(v as number)}</dd>
            <dd className="text-[10px] text-graphite-2">{cm(v as number)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-graphite-2">Veta {GRAIN[p.grain]}</p>
      <PieceEditor key={p.id} piece={p} box={box} catalog={catalog} enabled={editable} />
      {p.confidence === 'low' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-paper px-3 py-2 text-xs text-graphite">
          <span className="flex-1">El experto no pudo confirmar esta pieza con las fotos.</span>
          <button type="button" onClick={() => confirmPiece(p.id)} className="rounded-full bg-graphite px-3 py-1 font-medium text-bone">
            Está bien así
          </button>
        </div>
      )}
      {joints.length > 0 && (
        <ul className="mt-3 flex max-h-36 flex-col gap-1 overflow-y-auto border-t border-line pt-3 text-sm">
          {joints.map((u) => {
            const other = u.a === p.id ? u.b : u.a
            const count = u.hardware.reduce((n, h) => n + (h.count ?? 0), 0)
            return (
              <li key={u.id} className="flex gap-2">
                <span className="text-amber">→</span>
                <span>
                  <button type="button" className="font-medium underline decoration-line underline-offset-2 hover:decoration-amber" onClick={() => select(other)}>
                    {name(other)}
                  </button>
                  : {count && u.type !== 'drawer-slide' ? `${count} ` : ''}
                  {JOINTS[u.type]}
                  {u.glue && u.type !== 'glue-nail' ? ' con pegamento' : ''}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
