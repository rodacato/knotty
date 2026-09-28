import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from '@phosphor-icons/react'
import { useState } from 'react'
import type { PieceEditResult } from '../../application/useCases'
import { AXES, type Axis, type Piece } from '../../domain/design/schema'
import type { Box } from '../../domain/design/resolve'
import type { Catalog } from '../../domain/materials/catalog'
import { Button } from '../system/components'
import { Field, Input, Select } from '../system/Field'
import { useStore } from '../store'

// Hand edits on the selected piece: its length, width, thickness and position, applied at once and checked like any change.

// The move buttons are narrower than their padding; without shrink-0 the arrow is squeezed.
const ARROW = { size: 18, className: 'shrink-0' }

const MOVE: Record<Axis, [string, string, React.ReactNode, React.ReactNode]> = {
  y: ['Bajar', 'Subir', <ArrowDown key="d" {...ARROW} />, <ArrowUp key="u" {...ARROW} />],
  x: ['A la izquierda', 'A la derecha', <ArrowLeft key="l" {...ARROW} />, <ArrowRight key="r" {...ARROW} />],
  z: ['Hacia atrás', 'Hacia el frente', <ArrowUp key="b" {...ARROW} />, <ArrowDown key="f" {...ARROW} />],
}

function LengthField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(Math.round(value)))
  const commit = () => {
    const n = Number(text)
    if (Number.isFinite(n) && n > 0 && Math.round(n) !== Math.round(value)) onCommit(n)
    else setText(String(Math.round(value)))
  }
  return (
    <Field label={label}>
      <Input
        type="number"
        inputMode="numeric"
        unit="mm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        aria-label={`${label} en milímetros`}
      />
    </Field>
  )
}

export function PieceEditor({ piece, box, catalog }: { piece: Piece; box: Box; catalog: Catalog }) {
  const editPiece = useStore((s) => s.editPiece)
  const resizeFurniture = useStore((s) => s.resizeFurniture)
  const [step, setStep] = useState(10)
  const [result, setResult] = useState<PieceEditResult | null>(null)
  const size = (axis: Axis) => box[`${axis}1`] - box[`${axis}0`]
  // Largo is the longer side of the face, ancho the shorter, as in the cut list.
  const [longAxis, shortAxis] = AXES.filter((e) => e !== piece.normal).sort((a, b) => size(b) - size(a))
  const current = catalog.materials.find((m) => m.id === piece.material)
  const sameKind = catalog.materials.filter((m) => m.use === current?.use)
  const run = (r: PieceEditResult) => setResult(r.ok ? null : r)

  const [less, more, lessIcon, moreIcon] = MOVE[piece.normal]
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <LengthField key={`l-${Math.round(size(longAxis))}`} label="Largo" value={size(longAxis)} onCommit={(value) => run(editPiece(piece.id, { kind: 'length', axis: longAxis, value }))} />
        <LengthField key={`a-${Math.round(size(shortAxis))}`} label="Ancho" value={size(shortAxis)} onCommit={(value) => run(editPiece(piece.id, { kind: 'length', axis: shortAxis, value }))} />
        <Field label="Espesor">
          <Select value={piece.material} onChange={(e) => run(editPiece(piece.id, { kind: 'thickness', material: e.target.value }))} aria-label="Espesor" className="numerals">
            {sameKind.map((m) => (
              <option key={m.id} value={m.id}>
                {m.thickness} mm
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-graphite-2">Mover</span>
        <Button variant="secondary" className="size-11 p-0" aria-label={less} title={less} onClick={() => run(editPiece(piece.id, { kind: 'move', axis: piece.normal, delta: -step }))}>
          {lessIcon}
        </Button>
        <Button variant="secondary" className="size-11 p-0" aria-label={more} title={more} onClick={() => run(editPiece(piece.id, { kind: 'move', axis: piece.normal, delta: step }))}>
          {moreIcon}
        </Button>
        <label className="flex items-center gap-1 text-graphite-2">
          de
          <Input type="number" min={1} value={step} onChange={(e) => setStep(Math.max(1, Number(e.target.value)))} aria-label="Paso en milímetros" className="w-20" />
          mm
        </label>
      </div>
      {result && !result.ok && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-rust/10 p-2 text-xs text-rust">
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
