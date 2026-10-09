import { Cube, WarningCircle, XCircle } from '@phosphor-icons/react'
import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useMemo, useState } from 'react'
import { cardsOf, type Card } from '../capture/cards'
import { Thumbnail } from '../capture/Thumbnail'
import { useServices } from '../services'
import { useStore } from '../store'
import { Button } from '../system/components'
import { Field, Input } from '../system/Field'
import { verdictsOf, type Verdict } from '../lab/verdicts'
import { found, notFoundNote, roomsLine } from './search'
import { LOSS_NOTE, swapLoss } from './swap'

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

function Question({ name, note, onKeep, onSwap }: { name: string; note: string; onKeep: () => void; onSwap: () => void }) {
  return (
    <>
      <Dialog.Title className="font-display text-xl font-semibold">¿Cambiar a {name}?</Dialog.Title>
      <Dialog.Description className="text-sm text-graphite">{note}</Dialog.Description>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={onKeep}>
          Conservar
        </Button>
        {/* A held Enter must not answer the question it just opened. */}
        <Button variant="danger" autoFocus onKeyDown={(e) => e.repeat && e.preventDefault()} onClick={onSwap}>
          Cambiar
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
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const [asking, setAsking] = useState<Card | null>(null)
  const cards = useMemo(() => cardsOf(references.home(), catalog), [references, catalog])
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
  const choose = (card: Card) => (loss ? setAsking(card) : swap(card))

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
                className={`flex cursor-pointer items-center gap-3 rounded-xl p-2 md:gap-4 ${i === active ? 'bg-kraft' : ''}`}
              >
                <span className="flex aspect-[4/3] w-24 shrink-0 items-center justify-center rounded-xl border border-line bg-kraft p-2 md:w-32">{boxes ? <Thumbnail boxes={boxes} /> : <Cube className="text-graphite-2" />}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base font-medium text-graphite">{base.name}</span>
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
        <p className="p-5 text-base text-graphite-2" role="status">
          {notFoundNote(text)}
        </p>
      )}
      <p className="hidden border-t border-line px-4 py-2 text-xs text-graphite-2 md:block">↑ ↓ para moverte · Enter para abrir · Esc para cerrar</p>
    </>
  )

  const question = asking && loss
  return (
    <Dialog.Content
      className={`animate-appear fixed inset-x-3 top-3 z-50 mx-auto flex max-h-[min(calc(100dvh-1.5rem),36rem)] max-w-2xl flex-col overflow-hidden rounded-3xl border border-line bg-bone shadow-2xl sm:top-[12vh] ${question ? 'gap-3 p-5' : ''}`}
      {...(question ? {} : { 'aria-describedby': undefined })}
      onEscapeKeyDown={(e) => {
        if (!asking) return
        e.preventDefault()
        setAsking(null)
      }}
    >
      {question ? <Question name={asking.base.name} note={LOSS_NOTE[loss]} onKeep={() => setAsking(null)} onSwap={() => swap(asking)} /> : list()}
    </Dialog.Content>
  )
}

/** The furniture finder over any screen: Ctrl+K or ⌘K opens it, and what is chosen takes the Studio. */
export function Spotlight() {
  const open = useStore((s) => s.spotlightOpen)
  const setOpen = useStore((s) => s.openSpotlight)

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
