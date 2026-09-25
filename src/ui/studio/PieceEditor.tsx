import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, PencilSimple } from '@phosphor-icons/react'
import { useState } from 'react'
import type { PieceEditResult } from '../../application/useCases'
import { AXES, type Axis, type Piece } from '../../domain/design/schema'
import type { Box } from '../../domain/design/resolve'
import type { Catalog } from '../../domain/materials/catalog'
import { Button } from '../system/components'
import { useStore } from '../store'

// Hand edits on the selected piece: its length, width, thickness and position, applied at once and checked like any change.

const MOVE: Record<Axis, [string, string, React.ReactNode, React.ReactNode]> = {
  y: ['Bajar', 'Subir', <ArrowDown key="d" />, <ArrowUp key="u" />],
  x: ['A la izquierda', 'A la derecha', <ArrowLeft key="l" />, <ArrowRight key="r" />],
  z: ['Hacia atrás', 'Hacia el frente', <ArrowUp key="b" />, <ArrowDown key="f" />],
}

function LengthField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(Math.round(value)))
  const commit = () => {
    const n = Number(text)
    if (Number.isFinite(n) && n > 0 && Math.round(n) !== Math.round(value)) onCommit(n)
    else setText(String(Math.round(value)))
  }
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] tracking-wide text-grafito-2 uppercase">{label}</span>
      <span className="flex items-baseline gap-1 rounded-xl border border-linea bg-papel px-2 focus-within:border-ambar">
        <input
          type="number"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          aria-label={`${label} en milímetros`}
          className="cifras min-h-8 w-full bg-transparent text-sm outline-none"
        />
        <span className="cifras text-[10px] text-grafito-2">mm</span>
      </span>
    </label>
  )
}

export function PieceEditor({ piece, box, catalog, enabled }: { piece: Piece; box: Box; catalog: Catalog; enabled: boolean }) {
  const editPiece = useStore((s) => s.editPiece)
  const resizeFurniture = useStore((s) => s.resizeFurniture)
  const thinking = useStore((s) => s.thinking)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(10)
  const [result, setResult] = useState<PieceEditResult | null>(null)
  const size = (axis: Axis) => box[`${axis}1`] - box[`${axis}0`]
  // Largo is the longer side of the face, ancho the shorter, as in the cut list.
  const [longAxis, shortAxis] = AXES.filter((e) => e !== piece.normal).sort((a, b) => size(b) - size(a))
  const current = catalog.materials.find((m) => m.id === piece.material)
  const sameKind = catalog.materials.filter((m) => m.type === current?.type)
  const run = (r: PieceEditResult) => setResult(r.ok ? null : r)

  if (!enabled) return null
  if (!open)
    return (
      <Button variant="ghost" className="mt-2 min-h-8 px-2 text-xs" onClick={() => setOpen(true)} disabled={thinking}>
        <PencilSimple /> Editar a mano
      </Button>
    )

  const [less, more, lessIcon, moreIcon] = MOVE[piece.normal]
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-linea pt-3">
      <div className="grid grid-cols-3 gap-2">
        <LengthField key={`l-${Math.round(size(longAxis))}`} label="Largo" value={size(longAxis)} onCommit={(value) => run(editPiece(piece.id, { kind: 'length', axis: longAxis, value }))} />
        <LengthField key={`a-${Math.round(size(shortAxis))}`} label="Ancho" value={size(shortAxis)} onCommit={(value) => run(editPiece(piece.id, { kind: 'length', axis: shortAxis, value }))} />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] tracking-wide text-grafito-2 uppercase">Espesor</span>
          <select
            value={piece.material}
            onChange={(e) => run(editPiece(piece.id, { kind: 'thickness', material: e.target.value }))}
            aria-label="Espesor"
            className="cifras min-h-8 rounded-xl border border-linea bg-papel px-1 text-sm"
          >
            {sameKind.map((m) => (
              <option key={m.id} value={m.id}>
                {m.thickness} mm
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-grafito-2">Mover</span>
        <Button variant="secondary" className="min-h-8 px-2 text-xs" aria-label={less} title={less} onClick={() => run(editPiece(piece.id, { kind: 'move', axis: piece.normal, delta: -step }))}>
          {lessIcon}
        </Button>
        <Button variant="secondary" className="min-h-8 px-2 text-xs" aria-label={more} title={more} onClick={() => run(editPiece(piece.id, { kind: 'move', axis: piece.normal, delta: step }))}>
          {moreIcon}
        </Button>
        <label className="flex items-center gap-1 text-grafito-2">
          de
          <input type="number" min={1} value={step} onChange={(e) => setStep(Math.max(1, Number(e.target.value)))} aria-label="Paso en milímetros" className="cifras w-14 rounded-lg border border-linea bg-papel px-1 py-0.5 text-right" />
          mm
        </label>
      </div>
      {result && !result.ok && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-oxido/10 p-2 text-xs text-oxido">
          <span>{result.message}</span>
          {result.alternatives.map((a) => (
            <Button key={a.label} variant="secondary" className="min-h-8 self-start text-xs" onClick={() => run(resizeFurniture(a.axis, a.value))}>
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
