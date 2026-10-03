import { useState, type ReactNode } from 'react'
import type { Analysis } from '../../domain/checks/analysis'
import { Stamp } from '../system/components'

// What Knotty computes from the open design, without the expert: the errors, the geometry warnings the Studio does not show, and the structural findings.

function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button type="button" onClick={copy} className="relative min-h-6 text-xs text-graphite-2 underline before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-['']">
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function Group({ title, count, children }: { title: string; count: number | null; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-baseline gap-2 text-sm font-semibold">
        {title}
        {count !== null && <span className="numerals font-mono text-xs font-normal text-graphite-2">{count}</span>}
      </h3>
      {children}
    </section>
  )
}

function Entry({ code, stamp, message }: { code: string; stamp?: ReactNode; message: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-kraft/60 p-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] font-bold text-graphite-2">{code}</span>
        {stamp}
      </div>
      <p className="text-sm leading-snug">{message}</p>
      <CopyLine text={`${code}: ${message}`} />
    </div>
  )
}

const none = <p className="text-sm text-graphite-2">Ninguno</p>
const later = <p className="text-sm text-graphite-2">Se calculan cuando el diseño es válido.</p>

export function Findings({ name, analysis }: { name: string; analysis: Analysis }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-sm leading-relaxed text-graphite-2">Lo que Knotty calcula de «{name}», sin el experto.</p>
      <Group title="Errores" count={analysis.valid ? 0 : analysis.errors.length}>
        {analysis.valid ? none : analysis.errors.map((e, i) => <Entry key={`${e.code}-${i}`} code={e.code} message={e.message} />)}
      </Group>
      <Group title="Avisos de geometría" count={analysis.valid ? analysis.warnings.length : null}>
        {!analysis.valid ? later : analysis.warnings.length ? analysis.warnings.map((w, i) => <Entry key={`${w.code}-${i}`} code={w.code} message={w.message} />) : none}
      </Group>
      <Group title="Hallazgos estructurales" count={analysis.valid ? analysis.findings.length : null}>
        {!analysis.valid ? later : analysis.findings.length ? analysis.findings.map((f, i) => <Entry key={`${f.code}-${i}`} code={f.code} stamp={<Stamp severity={f.severity} />} message={f.message} />) : none}
      </Group>
    </div>
  )
}

export const findingsCount = (analysis: Analysis) => (analysis.valid ? analysis.warnings.length + analysis.findings.length : analysis.errors.length)
