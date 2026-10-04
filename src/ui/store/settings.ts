import type { VaultState } from '../../ports/Preferences'
import { NO_SETTINGS, type CatalogSettings } from '../../domain/materials/catalog'
import type { Slice } from './types'

// The settings panel, the key vault and the person's catalog settings.

export interface SettingsSlice {
  settingsOpen: boolean
  /** The "Conecta tu experto" step. */
  connectOpen: boolean
  vault: VaultState
  /** The keys notice on arrival was already handled or postponed. */
  gateClosed: boolean
  /** The person's prices and cutting settings over the catalog. */
  catalogSettings: CatalogSettings
  /** The debug tools are shown: the Konami code, Ctrl+Shift+D, the settings switch or `?debug`. */
  debugVisible: boolean

  setDebugVisible(visible: boolean): void
  openSettings(open: boolean): void
  openConnect(open: boolean): void
  unlock(passphrase: string): Promise<void>
  forgetKeys(): void
  switchToSimulated(): void
  closeGate(): void
  /** After saving settings, the vault may have changed. */
  refreshVault(): void
  saveCatalogSettings(a: CatalogSettings): void
}

export const createSettings: Slice<SettingsSlice> = (set, get) => ({
  settingsOpen: false,
  connectOpen: false,
  vault: 'none',
  gateClosed: false,
  catalogSettings: NO_SETTINGS,
  debugVisible: false,

  setDebugVisible: (debugVisible) => {
    get().services?.debug.setVisible(debugVisible)
    set({ debugVisible })
  },
  openSettings: (settingsOpen) => set({ settingsOpen }),
  openConnect: (connectOpen) => set({ connectOpen }),

  async unlock(passphrase) {
    const { services } = get()
    if (!services) return
    await services.preferences.unlock(passphrase)
    set({ vault: services.preferences.vaultState() })
  },

  forgetKeys() {
    const { services } = get()
    if (!services) return
    services.preferences.forgetKeys()
    set({ vault: services.preferences.vaultState() })
  },

  switchToSimulated() {
    const { services } = get()
    if (!services) return
    void services.preferences.save({ ...services.preferences.load(), active: 'simulated' }).catch(() => {})
    set({ gateClosed: true })
  },

  closeGate: () => set({ gateClosed: true }),

  refreshVault() {
    const { services } = get()
    if (services) set({ vault: services.preferences.vaultState() })
  },

  saveCatalogSettings(catalogSettings) {
    get().services?.materials.saveSettings(catalogSettings)
    set({ catalogSettings })
  },
})
