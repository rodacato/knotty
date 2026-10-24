import type { StoreApi } from 'zustand'
import { currentDesign } from '../../domain/session/state'
import { currentPlan } from '../../application/useCases'
import { moduleOf } from '../../domain/furniture/modules/plan'
import { browsingFrom, searchWith } from '../capture/address'
import { draftOf, type Store } from '../store'
import { fragmentOf, hasLinkedFicha, routeFrom, type Route } from './routes'
import { useRoom } from '../room/store'
import { studioSource } from '../room/sources'

export function showRoute(store: StoreApi<Store>, route: Route) {
  const s = store.getState()
  if (route.screen === 'room') {
    const room = useRoom.getState()
    if (room.layout && s.state && s.services) room.sync(studioSource(s.state, s.services.references.home()))
    s.setRoomOpen(!!room.layout)
    return
  }
  s.setRoomOpen(false)
  if (route.screen === 'catalog') {
    s.goHome()
    const base = route.code && s.services?.references.home().find((b) => b.code === route.code)
    if (base) s.adjustBase(base)
    return
  }
  if (route.screen === 'capture') { if (s.phase !== 'capture' && s.phase !== 'analyzing') s.startCapture(); return }
  if (!s.state) { s.goHome(); return }
  s.resumeDesign()
  if (route.screen === 'takeaway') { s.openTakeAway(true); return }
  const source = currentPlan(s.state)
  const plan = draftOf(s)?.plan ?? source.plan
  const parts = plan && !source.diverged && s.viewedVersion === null ? moduleOf(plan).parts : null
  const side = route.side && parts?.list.some((p) => p.side === route.side) ? route.side : null
  s.edit(side)
  s.setStudioOverlay(route.panel === 'notices' || route.panel === 'history' ? route.panel : null)
  s.openCheckout(route.panel === 'materials')
  const part = side && route.part && parts?.list.find((p) => p.id === route.part && p.side === side)
  s.selectPart(part ? part.id : null)
  const piece = route.piece && currentDesign(s.state).pieces.find((p) => p.id === route.piece)
  const selected = piece ? piece.id : null
  // Selection commands toggle; restoring an address must be idempotent, including StrictMode setup.
  if (store.getState().selection !== selected) s.select(selected)
}

type Browser = Pick<Window, 'location' | 'history' | 'addEventListener' | 'removeEventListener' | 'confirm'>
const indexOf = (browser: Browser): number | undefined => browser.history.state?.knottyView

export function connectNavigation(store: StoreApi<Store>, browser: Browser): () => void {
  let applying = false
  let connected = true
  let scheduled = false
  let restoring = false
  let activeIndex = indexOf(browser) ?? 0
  let pendingIndex: number | null = null
  let lastRead = ''
  const tag = (index: number, address: string) => browser.history.replaceState({ ...browser.history.state, knottyView: index }, '', address)
  tag(activeIndex, browser.location.href)

  const write = (replace: boolean) => {
    if (hasLinkedFicha(browser.location)) return
    const s = store.getState()
    const hash = fragmentOf(s)
    const search = s.phase === 'home' ? searchWith(browser.location.search, s.browsing) : browser.location.search
    if (hash === browser.location.hash && search === browser.location.search) return
    const address = `${browser.location.pathname}${search}${hash}`
    if (replace || hash === browser.location.hash) tag(activeIndex, address)
    else browser.history.pushState({ knottyView: ++activeIndex }, '', address)
    lastRead = `${activeIndex}:${browser.location.href}`
  }
  const read = (initial = false) => {
    if (hasLinkedFicha(browser.location)) return
    const incoming = indexOf(browser) ?? activeIndex + 1
    const addressKey = `${incoming}:${browser.location.href}`
    if (restoring && incoming === activeIndex) { restoring = false; lastRead = addressKey; changed(); return }
    if (!initial && addressKey === lastRead) return
    lastRead = addressKey
    if (pendingIndex !== null && incoming === activeIndex) return
    if (indexOf(browser) === undefined) tag(incoming, browser.location.href)
    const route = routeFrom(browser.location.hash) ?? { screen: 'catalog' }
    const s = store.getState()
    const leavingEdit = s.editing && !(route.screen === 'studio' && route.side === s.editing)
    if (!initial && (s.phase === 'analyzing' || (leavingEdit && draftOf(s)))) {
      if (leavingEdit && draftOf(s)) {
        pendingIndex = incoming
        applying = true
        s.leave()
        applying = false
      }
      if (incoming !== activeIndex) { restoring = true; browser.history.go(activeIndex - incoming) }
      return
    }
    if (!initial && s.phase === 'capture' && route.screen !== 'capture' && !browser.confirm('¿Salir del diseño nuevo? Se pierde el texto y las fotos que agregaste.')) {
      if (incoming !== activeIndex) { restoring = true; browser.history.go(activeIndex - incoming) }
      return
    }
    activeIndex = incoming
    applying = true
    if (route.screen === 'catalog') s.browse(browsingFrom(browser.location.search))
    showRoute(store, route)
    applying = false
    write(true)
  }
  const changed = () => {
    if (applying || scheduled) return
    scheduled = true
    // One user action may issue several store commands; history records the completed transition.
    queueMicrotask(() => {
      scheduled = false
      if (!connected || restoring) return
      if (pendingIndex !== null) {
        const s = store.getState()
        if (s.leaving) return
        const target = pendingIndex
        pendingIndex = null
        if (!s.editing) browser.history.go(target - activeIndex)
        return
      }
      write(false)
    })
  }
  const onAddress = () => read()
  const onUnload = (event: BeforeUnloadEvent) => {
    const s = store.getState()
    if (!draftOf(s) && s.phase !== 'capture' && s.phase !== 'analyzing') return
    event.preventDefault()
    event.returnValue = ''
  }
  read(true)
  const unsubscribe = store.subscribe(changed)
  browser.addEventListener('hashchange', onAddress)
  browser.addEventListener('popstate', onAddress)
  browser.addEventListener('beforeunload', onUnload)
  return () => {
    connected = false
    unsubscribe()
    browser.removeEventListener('hashchange', onAddress)
    browser.removeEventListener('popstate', onAddress)
    browser.removeEventListener('beforeunload', onUnload)
  }
}
