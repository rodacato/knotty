import { useState, useSyncExternalStore } from 'react'
import { currentInstallOffer, promptInstall, subscribeInstall } from './install'

const HINTS = {
  ios: 'Toca Compartir y luego «Agregar a pantalla de inicio».',
  mac: 'En el menú Archivo, elige «Agregar al Dock».',
}

/** Whether to offer «Instalar Knotty», and what the button does: the browser's own prompt, or how to find it in Safari's menu. */
export function useInstall() {
  const offer = useSyncExternalStore(subscribeInstall, currentInstallOffer, () => null)
  const [open, setOpen] = useState(false)
  if (!offer) return null
  if (offer === 'prompt') return { label: 'Instalar Knotty', onClick: () => void promptInstall(), expanded: undefined, hint: null }
  return { label: 'Instalar Knotty', onClick: () => setOpen((v) => !v), expanded: open, hint: open ? HINTS[offer] : null }
}
