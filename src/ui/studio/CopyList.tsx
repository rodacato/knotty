import { Check, Copy } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '../system/components'
import { TextArea } from '../system/Field'
import { beforeLeaving, copyLabel, type CopyState } from './copyListLabels'

/** Puts the cut list on the clipboard as a message; where the browser will not, the text is there to select. */
export function CopyList({ text, variant = 'secondary' }: { text: string; variant?: 'primary' | 'secondary' }) {
  const [state, setState] = useState<CopyState>('idle')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
      setTimeout(() => setState('idle'), 1500)
    } catch {
      setState('failed')
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button variant={variant} className="self-start" onClick={() => void copy()}>
        {state === 'copied' ? <Check weight="bold" /> : <Copy />} {copyLabel(state)}
      </Button>
      <span className="sr-only" aria-live="polite">
        {state === 'copied' ? copyLabel(state) : ''}
      </span>
      {state === 'failed' && (
        <>
          <p className="text-sm text-graphite">Copia el texto y pégalo en WhatsApp.</p>
          <TextArea readOnly rows={8} value={text} aria-label="Lista de corte" onFocus={(e) => e.target.select()} className="w-full" />
        </>
      )}
    </div>
  )
}

export function BeforeLeaving({ hasDrawer }: { hasDrawer: boolean }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="font-medium">Antes de irte de la maderería</p>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-graphite">
        {beforeLeaving(hasDrawer).map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  )
}
