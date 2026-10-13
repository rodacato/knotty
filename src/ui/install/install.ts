/** How this browser can install Knotty: its own prompt, a hint for Safari's menu, or nothing worth offering. */
export type InstallOffer = 'prompt' | 'ios' | 'mac' | null

export function installOffer({ standalone, prompt, userAgent, touchPoints }: { standalone: boolean; prompt: boolean; userAgent: string; touchPoints: number }): InstallOffer {
  if (standalone) return null
  if (prompt) return 'prompt'
  const safari = /Version\/[\d.]+.*Safari\//.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Edg\/|Firefox/.test(userAgent)
  if (!safari) return null
  // iPadOS Safari asks for the desktop site and says Macintosh; only the touch screen gives it away.
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1)) return 'ios'
  const version = Number(/Version\/(\d+)/.exec(userAgent)?.[1])
  return /Macintosh/.test(userAgent) && version >= 17 ? 'mac' : null
}

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

/** Keeps Chromium's install event for our own button; it fires once, early, before React mounts. */
export function captureInstallPrompt() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    notify()
  })
  addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    notify()
  })
}

export function subscribeInstall(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function currentInstallOffer(): InstallOffer {
  const standalone = installed || matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  return installOffer({ standalone, prompt: deferred !== null, userAgent: navigator.userAgent, touchPoints: navigator.maxTouchPoints })
}

/** Chromium lets each event prompt once, so it is dropped whatever the answer; a later one brings the button back. */
export async function promptInstall() {
  const event = deferred
  if (!event) return
  deferred = null
  await event.prompt()
  if ((await event.userChoice).outcome === 'accepted') installed = true
  notify()
}
