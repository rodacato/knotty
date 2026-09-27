import { Lightning } from '@phosphor-icons/react'
import { useMemo } from 'react'
import type { Fix } from '../../domain/editing/fixes/fixes'
import type { DesignState } from '../../domain/session/state'
import { useServices } from '../services'
import { Button } from '../system/components'
import { useStore } from '../store'

const NAMED: Partial<Record<Fix['key'], string>> = { 'center-support': 'Aplicar con un apoyo al centro', 'center-divider': 'Aplicar con un divisor al centro' }
const withFix = (fix: Fix) => NAMED[fix.key] ?? `Aplicar y ${fix.label.charAt(0).toLowerCase()}${fix.label.slice(1)}`

/** The proposal plus the solution Knotty builds for its critical findings, in one step; nothing when Knotty cannot build one. */
export function ProposalFixButton({ state, className = '' }: { state: DesignState; className?: string }) {
  const { useCases } = useServices()
  const applyProposalWithFix = useStore((s) => s.applyProposalWithFix)
  const thinking = useStore((s) => s.thinking)
  const fix = useMemo(() => useCases.proposalFix(state), [useCases, state])
  if (!fix) return null
  return (
    <Button variant="primary" className={`min-h-10 ${className}`} onClick={applyProposalWithFix} disabled={thinking}>
      <Lightning /> {withFix(fix)}
    </Button>
  )
}
