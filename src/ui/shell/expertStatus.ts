import { useMemo } from 'react'
import { missing, PRESETS, type LLMConfiguration } from '../../ports/Preferences'
import { useServices } from '../services'
import { useStore } from '../store'

/** Connected means a real provider that has everything it needs to answer. */
export const expertConnected = (config: LLMConfiguration): boolean => config.active !== 'simulated' && missing(config) === null

/** `available` adds the simulated expert when it was chosen in this session: there is someone to ask. `provider` names the connected one. */
export function useExpertStatus(): { connected: boolean; available: boolean; provider: string | null } {
  const { preferences } = useServices()
  const settingsOpen = useStore((s) => s.settingsOpen)
  const connectOpen = useStore((s) => s.connectOpen)
  const simulatedChosen = useStore((s) => s.simulatedChosen)
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- settingsOpen and connectOpen are the recompute triggers: preferences live in storage, outside React
  const config = useMemo(() => preferences.load(), [preferences, settingsOpen, connectOpen])
  const connected = expertConnected(config)
  const provider = connected ? PRESETS[config.active].label : null
  return useMemo(() => ({ connected, available: connected || simulatedChosen, provider }), [connected, simulatedChosen, provider])
}
