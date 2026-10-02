import { ArrowSquareOut, Check, Copy } from '@phosphor-icons/react'
import { useState } from 'react'
import { Field, Input } from './Field'

/** SheLLM runs on the person's machine: explains what it is and how to let this page talk to it. */
export function SheLLM({ host, onHost, origin, learnUrl }: { host: string; onHost: (h: string) => void; origin: string; learnUrl: string }) {
  const [copied, setCopied] = useState(false)
  const line = `SHELLM_CORS_ORIGINS=${origin}`
  const copy = async () => {
    await navigator.clipboard.writeText(line)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>
        <span className="font-medium">SheLLM</span> convierte tu suscripción de Claude Code o Codex en una API local, así el experto no gasta créditos de API.{' '}
        <a href={learnUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
          Conoce SheLLM <ArrowSquareOut />
        </a>
      </p>
      <Field label="Dirección">
        <Input value={host} onChange={(e) => onHost(e.target.value)} placeholder="http://127.0.0.1:6100" className="numerals" />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span>Para que esta página pueda hablarle, agrega su origen a la configuración de SheLLM:</span>
        <span className="flex items-center gap-2 rounded-xl bg-kraft px-3 py-2">
          <code className="numerals flex-1 truncate text-xs">{line}</code>
          <button type="button" onClick={() => void copy()} aria-label="Copiar" className="text-graphite-2 hover:text-graphite">
            {copied ? <Check /> : <Copy />}
          </button>
        </span>
      </div>
    </div>
  )
}
