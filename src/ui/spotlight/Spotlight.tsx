import { Cube, WarningCircle, XCircle } from '@phosphor-icons/react'
import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Catalog } from '../../domain/materials/catalog'
import type { ReferenceStore } from '../../ports/ReferenceStore'
import { cardsOf, type Card } from '../capture/cards'
import { Thumbnail } from '../capture/Thumbnail'
import { useServices } from '../services'
import { useStore } from '../store'
import { Button } from '../system/components'
import { Field, Input } from '../system/Field'
import { verdictsOf, type Verdict } from '../lab/verdicts'
import { linkedFicha } from './link'
import { found, notFoundNote, roomsLine } from './search'
import { LOSS_NOTE, swapLoss } from './swap'

/** The thumbnails are built once: they only change with the app. */
let built: { references: ReferenceStore; catalog: Catalog; cards: Card[] } | null = null
function cardsOnce(references: ReferenceStore, catalog: Catalog): Card[] {
  if (built?.references !== references || built.catalog !== catalog) built = { references, catalog, cards: cardsOf(references.home(), catalog) }
  return built.cards
}

const LIST = 'spotlight-list'
const optionId = (id: string) => `spotlight-${id}`

function Mark({ verdict }: { verdict: Verdict }) {
  if (!verdict.valid) return <XCircle weight="fill" size={18} aria-label="Inválida" className="shrink-0 text-rust" />
  if (!verdict.notes.length) return null
  return (
    <span title={verdict.notes.join('\n')} className="flex shrink-0 items-center gap-1 text-xs text-graphite-2">
      <WarningCircle size={16} /> {verdict.notes.length}
    </span>
  )
}

function Question({ name, again, note, onKeep, onSwap }: { name: string; again: boolean; note: string; onKeep: () => void; onSwap: () => void }) {
  return (
    <>
      <Dialog.Title className="font-display text-xl font-semibold">{again ? `¿Empezar ${name} de nuevo?` : `¿Cambiar a ${name}?`}</Dialog.Title>
      <Dialog.Description className="text-sm text-graphite">{note}</Dialog.Description>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={onKeep}>
          Conservar
        </Button>
        {/* A held Enter must not answer the question it just opened. */}
        <Button variant="danger" autoFocus onKeyDown={(e) => e.repeat && e.preventDefault()} onClick={onSwap}>
          {again ? 'Empezar de nuevo' : 'Cambiar'}
        </Button>
      </div>
    </>
  )
}

function Finder({ onDone }: { onDone: () => void }) {
  const { references, catalog } = useServices()
  const debugVisible = useStore((s) => s.debugVisible)
  const phase = useStore((s) => s.phase)
  const state = useStore((s) => s.state)
  const swapTo = useStore((s) => s.swapTo)
  const startCapture = useStore((s) => s.startCapture)
  const ask = useStore((s) => s.spotlightAsk)
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const cards = cardsOnce(references, catalog)
  const [asking, setAsking] = useState<Card | null>(() => cards.find((c) => c.base.code === ask) ?? null)
  const verdicts = useMemo(() => (debugVisible ? verdictsOf(references.home(), catalog) : null), [debugVisible, references, catalog])
  const shown = cards.filter((c) => found(c.base, text))
  const current = shown[active]
  const loss = swapLoss(phase, state)
  const openCode = phase === 'studio' ? state?.ficha?.code : undefined

  useEffect(() => {
    if (current) document.getElementById(optionId(current.base.id))?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const swap = (card: Card) => {
    swapTo(card.base)
    onDone()
  }
  const choose = (card: Card) => {
    if (loss) setAsking(card)
    else if (card.base.code === openCode) onDone()
    else swap(card)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (shown.length) setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length)
    }
    if (e.key === 'Enter' && current && !e.repeat) {
      e.preventDefault()
      choose(current)
    }
  }

  const list = () => (
    <>
      <Dialog.Title className="sr-only">Buscar un mueble</Dialog.Title>
      <Field label="Buscar un mueble" hiddenLabel className="border-b border-line p-3">
        <Input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded
          aria-controls={LIST}
          aria-activedescendant={current ? optionId(current.base.id) : undefined}
          autoComplete="off"
          autoFocus
          className="md:min-h-12 md:text-lg"
          placeholder="Nombre, cuarto o modelo"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
      </Field>
      {shown.length ? (
        <ul id={LIST} role="listbox" aria-label="Muebles" className="min-h-0 flex-1 overflow-y-auto p-2">
          {shown.map((card, i) => {
            const { base, size, boxes } = card
            const verdict = verdicts?.get(base.id)
            return (
              <li
                key={base.id}
                id={optionId(base.id)}
                role="option"
                aria-selected={i === active}
                onPointerMove={() => setActive(i)}
                onClick={() => choose(card)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2 md:gap-4 ${i === active ? 'border-amber bg-amber-soft' : 'border-transparent'}`}
              >
                <span className="flex aspect-[4/3] w-24 shrink-0 items-center justify-center rounded-xl border border-line bg-kraft p-2 md:w-32">{boxes ? <Thumbnail boxes={boxes} /> : <Cube className="text-graphite-2" />}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-base leading-snug font-medium text-graphite">{base.name}</span>
                  <span className="truncate text-xs text-graphite-2">
                    <span className="font-mono text-[11px]">
                      {base.code}
                      {debugVisible && ` v${base.version}`}
                    </span>{' '}
                    · {roomsLine(base)}
                  </span>
                  <span className="numerals truncate text-xs text-graphite-2" aria-label={size.spoken}>
                    {size.text}
                  </span>
                </span>
                {verdict && <Mark verdict={verdict} />}
                {base.code === openCode && <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-graphite-2">Abierto</span>}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-3 p-5">
          <p className="text-base text-graphite-2" role="status">
            {notFoundNote(text)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setText('')
                input.current?.focus()
              }}
            >
              Borrar la búsqueda
            </Button>
            {phase === 'home' && (
              <Button
                variant="ghost"
                onClick={() => {
                  startCapture()
                  onDone()
                }}
              >
                Diseña el tuyo
              </Button>
            )}
          </div>
        </div>
      )}
      <p className="flex justify-between gap-3 border-t border-line px-4 py-2 text-xs text-graphite-2">
        <span>Ancho × fondo × alto</span>
        <span className="hidden md:inline">↑ ↓ para moverte · Enter para abrir · Esc para cerrar</span>
      </p>
    </>
  )

  const question = asking && loss
  return (
    <Dialog.Content
      className={`animate-appear fixed inset-x-3 top-3 z-50 mx-auto flex max-h-[calc(100dvh-1.5rem)] max-w-2xl flex-col overflow-hidden rounded-3xl border border-line bg-bone shadow-2xl sm:top-[12vh] sm:max-h-[76dvh] ${question ? 'gap-3 p-5' : ''}`}
      {...(question ? {} : { 'aria-describedby': undefined })}
      onEscapeKeyDown={(e) => {
        if (!asking) return
        e.preventDefault()
        setAsking(null)
      }}
    >
      {question ? <Question name={asking.base.name} again={asking.base.code === openCode} note={LOSS_NOTE[loss]} onKeep={() => setAsking(null)} onSwap={() => swap(asking)} /> : list()}
    </Dialog.Content>
  )
}

/** The furniture finder over any screen: Ctrl+K or ⌘K opens it, and what is chosen takes the Studio. */
export function Spotlight() {
  const { references } = useServices()
  const open = useStore((s) => s.spotlightOpen)
  const setOpen = useStore((s) => s.openSpotlight)

  useEffect(() => {
    const linked = linkedFicha(location.search)
    if (!linked) return
    history.replaceState(null, '', `${location.pathname}${linked.rest}${location.hash}`)
    const base = references.home().find((b) => b.code === linked.code)
    if (!base) return
    const { phase, state, swapTo } = useStore.getState()
    if (swapLoss(phase, state)) setOpen(true, linked.code)
    else swapTo(base)
  }, [references, setOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!useStore.getState().spotlightOpen)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [setOpen])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-graphite/30 backdrop-blur-[2px]" />
        <Finder onDone={() => setOpen(false)} />
      </Dialog.Portal>
    </Dialog.Root>
  )
}
