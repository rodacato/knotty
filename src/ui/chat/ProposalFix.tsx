import { useMemo } from 'react'
import type { Fix } from '../../domain/editing/fixes/fixes'
import type { DesignState } from '../../domain/session/state'
import { useServices } from '../services'
import { useStore } from '../store'
import { ProposalFixAction } from '../system/ProposalFix'

// The design names the center solutions by what they add; the key does not say it, the label does (the same key adds a support under a floor).
const DESIGN_WORDS: [string, string][] = [
  ['Agregar un apoyo al centro', 'Aplicar con un apoyo al centro'],
  ['Agregar un divisor vertical al centro', 'Aplicar con un divisor al centro'],
]
/** The design's words when a solution has them; otherwise its own label, which already says what happens. */
const withFix = (fix: Fix) => DESIGN_WORDS.find(([start]) => fix.label.startsWith(start))?.[1] ?? fix.label

/** The proposal plus the solution Knotty builds for its critical findings, in one step; nothing when Knotty cannot build one. */
export function ProposalFixButton({ state, className = '' }: { state: DesignState; className?: string }) {
  const { useCases } = useServices()
  const applyProposalWithFix = useStore((s) => s.applyProposalWithFix)
  const thinking = useStore((s) => s.thinking)
  const fix = useMemo(() => useCases.proposalFix(state), [useCases, state])
  if (!fix) return null
  return (
    <ProposalFixAction label={withFix(fix)} onApply={applyProposalWithFix} disabled={thinking} className={className} />
  )
}
