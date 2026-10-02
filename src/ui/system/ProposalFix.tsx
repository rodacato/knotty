import { Lightning } from '@phosphor-icons/react'
import { Button } from './components'

/** The one-step action that applies a proposal together with the solution built for its critical findings. */
export function ProposalFixAction({ label, onApply, disabled, className = '' }: { label: string; onApply: () => void; disabled: boolean; className?: string }) {
  return (
    <Button variant="primary" className={className} onClick={onApply} disabled={disabled}>
      <Lightning /> {label}
    </Button>
  )
}
