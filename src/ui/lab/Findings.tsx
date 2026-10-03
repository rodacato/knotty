import { useState, type ReactNode } from 'react'
import { named } from '../../application/named'
import type { Analysis } from '../../domain/checks/analysis'
import type { Design } from '../../domain/design/schema'
import { useStore } from '../store'
import { Stamp } from '../system/components'
import { piecesNamedIn } from './pieces'

// What Knotty computes from the open design, without the expert: the errors, the geometry warnings the Studio does not show, and the structural findings.
// Each one speaks of its pieces by name, and a tap marks them in the 3D.

function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button type="button" onClick={copy} className="relative min-h-6 self-start text-xs text-graphite-2 underline before:absolute before:-inset-y-2.5 before:-inset-x-1 before:content-['']">
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function Group({ title, count, help, children }: { title: string; count: number | null; help?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-baseline gap-2 text-sm font-semibold">
        {title}
        {count !== null && <span className="numerals font-mono text-xs font-normal text-graphite-2">{count}</span>}
      </h3>
      {help && <p className="text-xs leading-snug text-graphite-2">{help}</p>}
      {children}
    </section>
  )
}

function Entry({ design, code, stamp, message, pieces }: { design: Design; code: string; stamp?: ReactNode; message: string; pieces: string[] }) {
  const flagged = useStore((s) => s.flagged)
  const flag = useStore((s) => s.flag)
  const marked = pieces.length > 0 && pieces.every((id) => flagged.includes(id))
  const text = named(design, message)
  return (
    <div className={`flex flex-col gap-1.5 rounded-lg border p-3 ${marked ? 'border-amber bg-amber-soft' : 'border-line bg-kraft/60'}`}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-bold text-graphite-2">{code}</span>
        {stamp}
      </div>
      <p className="text-sm leading-snug">{text}</p>
      <div className="flex items-center gap-4">
        {pieces.length > 0 && (
          <button type="button" aria-pressed={marked} onClick={() => flag(pieces)} className="relative min-h-6 text-xs font-medium underline before:absolute before:-inset-y-2.5 before:-inset-x-1 before:content-['']">
            {marked ? 'Quitar la marca' : 'Ver en el 3D'}
          </button>
        )}
        <CopyLine text={`${code}: ${text} (${pieces.join(', ')})`} />
      </div>
    </div>
  )
}

const none = <p className="text-sm text-graphite-2">Ninguno</p>
const later = <p className="text-sm text-graphite-2">Se calculan cuando el diseño es válido.</p>

export function Findings({ design, analysis }: { design: Design; analysis: Analysis }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-sm leading-relaxed text-graphite-2">Lo que Knotty calcula de «{design.name}», sin el experto.</p>
      <Group title="Errores" count={analysis.valid ? 0 : analysis.errors.length}>
        {analysis.valid ? none : analysis.errors.map((e, i) => <Entry key={`${e.code}-${i}`} design={design} code={e.code} message={e.message} pieces={piecesNamedIn(design, e.data)} />)}
      </Group>
      <Group
        title="Avisos de geometría"
        count={analysis.valid ? analysis.warnings.length : null}
        help="Dos piezas se tocan en el 3D, pero el diseño no dice cómo se unen (pegadas, con tornillo, con espiga). Toca «Ver en el 3D» para ver cuáles son. Si la unión sí hace falta, es un hueco de Knotty y no de quien lo diseñó."
      >
        {!analysis.valid ? later : analysis.warnings.length ? analysis.warnings.map((w, i) => <Entry key={`${w.code}-${i}`} design={design} code={w.code} message={w.message} pieces={piecesNamedIn(design, w.data)} />) : none}
      </Group>
      <Group title="Hallazgos estructurales" count={analysis.valid ? analysis.findings.length : null}>
        {!analysis.valid ? later : analysis.findings.length ? analysis.findings.map((f, i) => <Entry key={`${f.code}-${i}`} design={design} code={f.code} stamp={<Stamp severity={f.severity} />} message={f.message} pieces={piecesNamedIn(design, f.data, f.pieces)} />) : none}
      </Group>
    </div>
  )
}

export const findingsCount = (analysis: Analysis) => (analysis.valid ? analysis.warnings.length + analysis.findings.length : analysis.errors.length)
