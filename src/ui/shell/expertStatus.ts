import { useMemo } from 'react'
import { missing, type LLMConfiguration } from '../../ports/Preferences'
import { useServices } from '../services'
import { useStore } from '../store'

/** Connected means a real provider that has everything it needs to answer. */
export const expertConnected = (config: LLMConfiguration): boolean => config.active !== 'simulated' && missing(config) === null

export function useExpertStatus(): { connected: boolean } {
  const { preferences } = useServices()
  const settingsOpen = useStore((s) => s.settingsOpen)
  const connectOpen = useStore((s) => s.connectOpen)
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- settingsOpen and connectOpen are the recompute triggers: preferences live in storage, outside React
  return useMemo(() => ({ connected: expertConnected(preferences.load()) }), [preferences, settingsOpen, connectOpen])
}
