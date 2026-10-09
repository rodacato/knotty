import { ArrowClockwise, ArrowCounterClockwise, ArrowRight, Eye, EyeSlash, PaperPlaneRight, PencilSimple, Stop, Warning } from '@phosphor-icons/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Stage } from '../../application/useCases'
import { named, withCandidate } from '../../application/named'
import { quickActions } from '../../application/quickActions'
import { kindOf } from '../../domain/furniture/kind'
import { currentDesign, questionAnswerKey, type DesignState, type Message } from '../../domain/session/state'
import { answerItem, answerItemId } from '../../domain/session/tray/tray'
import { Button, Chip, Pencil, Stamp } from '../system/components'
import { TextArea } from '../system/Field'
import { useServices } from '../services'
import { useExpertStatus } from '../shell/expertStatus'
import { useStore } from '../store'
import { ChangeList } from './ChangeList'
import { useReducedMotion } from '../scene/preferences'
import { answerGiven, applyLabel, openQuestions, recovery, suggestionsFor } from './chatLogic'
import { Memory } from './Memory'
import { ProposalFixButton } from './ProposalFix'
import { Tray } from './Tray'

export const STAGES: Record<Stage, string> = {
  'reading-photos': 'Mirando la foto…',
  designing: 'Mirando las fotos…',
  'designing-pieces': 'Diseñando pieza por pieza…',
  proposing: 'Pensando el cambio…',
  checking: 'Revisando que todo cierre…',
  structure: 'Revisando la estructura…',
  correcting: 'Corrigiendo un detalle…',
  'reviewing-criticals': 'Revisando los puntos críticos…',
}

/** Several pieces with the same problem are counted in a single line. */
function groupByCode<T extends { code: string }>(critical: T[]) {
  const groups = new Map<string, T[]>()
  for (const c of critical) groups.set(c.code, [...(groups.get(c.code) ?? []), c])
  return [...groups.values()].map((g) => ({ first: g[0], more: g.length - 1 }))
}

/** Seconds since it started thinking, so a long wait does not look frozen. */
function useSeconds(active: boolean) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!active) return
    const start = Date.now()
    const clock = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => {
      clearInterval(clock)
      setSeconds(0)
    }
  }, [active])
  return seconds
}

/** One question answers at once (Knotty builds the option if it can); with several, or a tray, answers wait there as text for the expert. */
function Questions({ m, state, hidden = [] }: { m: Message; state: DesignState; hidden?: number[] }) {
  const chooseOption = useStore((s) => s.chooseOption)
  const toggleTray = useStore((s) => s.toggleTray)
  const thinking = useStore((s) => s.thinking)
  const batch = state.tray.length > 0 || openQuestions(state).length > 1
  const chosen = (i: number) => state.tray.find((t) => t.id === answerItemId(m.id, i))?.label

  return (
    <>
      {m.questions.map((p, i) => {
        if (hidden.includes(i)) return null
        const taken = m.answered || m.answers.includes(questionAnswerKey(i))
        const given = taken ? answerGiven(state, m, i) : null
        return (
          <div key={i} className="flex flex-col gap-2">
            {m.questions.length > 1 || p.text !== m.text ? <p className="text-sm font-medium">{p.text}</p> : null}
            {p.options && taken && <p className="text-sm text-graphite">{given ? `Respondiste: ${given}` : 'Pregunta respondida.'}</p>}
            {p.options && !taken && (
              <div className="flex flex-wrap gap-2">
                {p.options.map((o) => (
                  <Chip
                    key={o}
                    active={chosen(i) === o}
                    aria-pressed={batch ? chosen(i) === o : undefined}
                    disabled={thinking}
                    onClick={() => (batch ? toggleTray(answerItem(m.id, i, p.text, o)) : void chooseOption(m.id, i, o))}
                  >
                    {o}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {batch && !m.answered && m.questions.some((p) => p.options) && <p className="text-xs text-graphite">Tus respuestas esperan en la bandeja y van juntas; lo que no contestes lo decide el experto.</p>}
    </>
  )
}

function Bubble({ m, state, recover }: { m: Message; state: DesignState; recover: { kind: 'retry' | 'edit'; run: () => void } | null }) {
  const thinking = useStore((s) => s.thinking)
  const applyProposal = useStore((s) => s.applyProposal)
  const discardProposal = useStore((s) => s.discardProposal)
  const showProposal = useStore((s) => s.showProposal)
  const toggleProposal = useStore((s) => s.toggleProposal)
  const viewVersion = useStore((s) => s.viewVersion)
  const viewedVersion = useStore((s) => s.viewedVersion)
  const { useCases } = useServices()
  // With the one-step fix on screen, the rules' options for the same finding would be a second path to it.
  const proposalFixed = useMemo(() => m.proposal === 'pending' && !!state.proposal?.critical.length && !!useCases.proposalFix(state), [m.proposal, state, useCases])

  if (m.author === 'user')
    return (
      <div className="animate-appear ml-10 flex flex-col items-end gap-1.5 self-end">
        {m.thumbnail && <img src={m.thumbnail} alt="Foto enviada" className="h-24 rounded-xl border border-line object-cover shadow-sm" />}
        <div className="rounded-2xl rounded-br-md bg-graphite px-4 py-2.5 text-[15px] leading-snug whitespace-pre-line text-bone shadow-sm">{m.text}</div>
        {m.version && (
          <div className="w-full max-w-sm">
            <ChangeList state={state} version={m.version} />
          </div>
        )}
      </div>
    )

  const pending = m.proposal === 'pending' && state.proposal
  return (
    <div className="animate-appear mr-6 flex flex-col gap-2.5 self-start">
      <div className={`rounded-2xl rounded-bl-md border px-4 py-3 text-[15px] leading-relaxed shadow-sm ${m.error ? 'border-rust/30 bg-rust/5' : 'border-line bg-bone'}`}>
        <div className="mb-1 flex items-center gap-2 text-xs text-graphite-2">
          <PencilSimple weight="duotone" className="text-graphite" /> {m.alone ? 'Knotty' : 'Experto'}
          {m.version &&
            (m.version === state.current || !state.versions.some((v) => v.n === m.version) ? (
              <span className="numerals rounded-full bg-kraft px-1.5 py-px text-xs text-graphite">v{m.version}</span>
            ) : (
              <button
                type="button"
                onClick={() => viewVersion(viewedVersion === m.version ? null : m.version)}
                title="Ver esta versión"
                aria-label={`Ver la versión ${m.version}`}
                className={`numerals relative rounded-full px-1.5 py-px text-xs underline before:absolute before:-inset-x-3 before:-inset-y-3.5 before:content-[''] decoration-dotted underline-offset-2 transition ${viewedVersion === m.version ? 'bg-amber text-graphite' : 'bg-kraft text-graphite hover:bg-amber-soft'}`}
              >
                v{m.version}
              </button>
            ))}
          {m.proposal === 'applied' && <span className="text-xs">· aplicada</span>}
          {m.proposal === 'discarded' && <span className="text-xs">· sin aplicar</span>}
        </div>
        {m.error && <Warning className="float-left mt-1 mr-2 text-rust" weight="bold" />}
        {m.text.split('\n\n').map((p, i) => (
          <p key={i} className={i ? 'mt-2' : ''}>
            {p}
          </p>
        ))}
        {recover && (
          <Button variant="secondary" className="mt-3 text-xs" onClick={recover.run} disabled={thinking}>
            {recover.kind === 'retry' ? (
              <>
                <ArrowClockwise weight="bold" /> Reintentar
              </>
            ) : (
              <>
                <PencilSimple weight="bold" /> Cambiar mi pedido
              </>
            )}
          </Button>
        )}
        {pending && (
          <div className="mt-3">
            {state.proposal!.holds.length > 0 && (
              <ul className="mb-2 flex flex-col gap-1.5">
                {state.proposal!.holds.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm">
                    <Warning className="mt-0.5 shrink-0" weight="bold" /> {h}
                  </li>
                ))}
              </ul>
            )}
            <ul className="flex flex-col gap-2">
              {groupByCode(state.proposal!.critical).map(({ first, more }, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Stamp severity="critical" />
                  <span>
                    {named(withCandidate(currentDesign(state), state.proposal!.design), first.message)}
                    {more > 0 && <span className="text-graphite"> Y {more === 1 ? 'otra pieza' : `${more} piezas más`} con el mismo problema.</span>}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-col gap-2">
              {state.proposal!.critical.length > 0 && <ProposalFixButton state={state} className="w-full" />}
              <Button variant={state.proposal!.critical.length ? 'secondary' : 'primary'} className="w-full" onClick={applyProposal} disabled={thinking}>
                {applyLabel(state.proposal!.critical.length)}
              </Button>
              <div className="flex flex-wrap justify-between gap-2">
                <Button variant="ghost" onClick={toggleProposal}>
                  {showProposal ? <EyeSlash /> : <Eye />} {showProposal ? 'Ver el actual' : 'Ver propuesta'}
                </Button>
                <Button variant="ghost" onClick={discardProposal} disabled={thinking}>
                  <ArrowCounterClockwise /> Descartar
                </Button>
              </div>
            </div>
          </div>
        )}
        {m.version && !pending && <ChangeList state={state} version={m.version} inBubble />}
      </div>

      <Questions m={m} state={state} hidden={proposalFixed ? m.solutions.map((s) => s.question) : []} />
    </div>
  )
}

export function Chat({ state }: { state: DesignState }) {
  const adjust = useStore((s) => s.adjust)
  const sendTray = useStore((s) => s.sendTray)
  const thinking = useStore((s) => s.thinking)
  const stage = useStore((s) => s.stage)
  const cancel = useStore((s) => s.cancel)
  const openConnect = useStore((s) => s.openConnect)
  const simulatedChosen = useStore((s) => s.simulatedChosen)
  const { connected } = useExpertStatus()
  const canAsk = connected || simulatedChosen
  const [text, setText] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const seconds = useSeconds(thinking)
  const reduced = useReducedMotion()
  const last = state.chat.at(-1)
  const previous = state.chat.at(-2)
  const kind = recovery(last, previous)
  const recover = kind && previous ? { kind, run: kind === 'retry' ? () => void adjust(previous.text) : () => setText(previous.text) } : null
  const suggestions = suggestionsFor(state, thinking, kindOf(currentDesign(state)).kind)
  const { catalog } = useServices()
  const alone = useMemo(() => (canAsk || thinking ? [] : quickActions(state, catalog)), [canAsk, thinking, state, catalog])

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
  }, [state.chat.length, state.tray.length, thinking]) // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    if ((!text.trim() && !state.tray.length) || thinking) return
    void (state.tray.length ? sendTray(text) : adjust(text))
    setText('')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Memory state={state} />
      <div ref={list} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-3" role="log" aria-live="polite" aria-label="Conversación con el experto">
        {state.chat.map((m) => (
          <Bubble key={m.id} m={m} state={state} recover={m === last ? recover : null} />
        ))}
        {thinking && (
          <div className="flex items-center gap-2 self-start rounded-2xl border border-line bg-bone px-4 py-2.5 text-sm text-graphite-2" aria-live="polite">
            <Pencil className="h-5 w-12 text-amber" /> {stage ? STAGES[stage.name] : 'Pensando…'}
            {seconds >= 10 && <span className="numerals text-xs">· {seconds} s</span>}
          </div>
        )}
      </div>
      {canAsk && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2" aria-label="Sugerencias">
          {suggestions.map((s) => (
            <Chip key={s} className="max-w-full py-1.5 text-left" onClick={() => void adjust(s)}>
              {s}
            </Chip>
          ))}
        </div>
      )}
      <Tray items={state.tray} typed={!!text.trim()} onSend={send} />
      {canAsk ? (
        <form
          className="flex items-end gap-2 border-t border-line bg-bone/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            placeholder="Pide un cambio: «refuerza la base»…"
            aria-label="Mensaje para el experto"
            className="max-h-32 min-h-11 flex-1 resize-none [field-sizing:content]"
          />
          {thinking ? (
            <Button variant="secondary" className="size-11 shrink-0 rounded-full p-0" onClick={cancel} aria-label="Cancelar">
              <Stop weight="fill" />
            </Button>
          ) : (
            <Button type="submit" variant="primary" className="size-11 shrink-0 rounded-full p-0" disabled={!text.trim() && !state.tray.length} aria-label={state.tray.length ? 'Consultar al experto' : 'Enviar'}>
              <PaperPlaneRight weight="fill" />
            </Button>
          )}
        </form>
      ) : (
        <div className="flex flex-col gap-3 border-t border-line bg-kraft p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" role="note">
          {alone.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-base font-medium">Knotty puede hacer esto solo</p>
              <div className="flex flex-wrap gap-2" aria-label="Cambios sin experto">
                {alone.map((request) => (
                  <Chip key={request} className="max-w-full py-1.5 text-left" onClick={() => void adjust(request)}>
                    {request}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <p className={alone.length ? 'text-sm font-medium' : 'text-base font-medium'}>{alone.length ? 'Para pedir otra cosa, conecta tu experto' : 'Conecta tu experto para pedirle cambios'}</p>
            <p className="text-sm text-graphite-2">Sin él, cambia las medidas y las opciones con «Editar», arriba del mueble.</p>
          </div>
          <Button variant={alone.length ? 'secondary' : 'primary'} className="min-h-11 self-start px-5" onClick={() => openConnect(true)}>
            Conectar experto <ArrowRight weight="bold" />
          </Button>
        </div>
      )}
    </div>
  )
}
