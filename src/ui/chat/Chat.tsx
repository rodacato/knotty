import { ArrowClockwise, ArrowCounterClockwise, Camera, Eye, EyeSlash, PaperPlaneRight, PencilSimple, Stop, Warning } from '@phosphor-icons/react'
import { angleLabel } from '../../domain/reading/reading'
import { useEffect, useRef, useState } from 'react'
import type { Stage } from '../../application/useCases'
import { photoAnswerKey, questionAnswerKey, type DesignState, type Message } from '../../domain/session/state'
import { answerItem, answerItemId, suggestionItem } from '../../domain/tray/tray'
import { Button, Chip, Pencil, Stamp } from '../system/components'
import { useServices } from '../services'
import { TakePhoto } from '../system/TakePhoto'
import { useStore } from '../store'
import { ChangeList } from './ChangeList'
import { Tray } from './Tray'

const STAGES: Record<Stage, string> = {
  'reading-photos': 'Mirando la foto…',
  designing: 'Mirando las fotos…',
  'designing-pieces': 'Diseñando pieza por pieza…',
  proposing: 'Pensando el cambio…',
  checking: 'Revisando que todo cierre…',
  structure: 'Revisando la estructura…',
  correcting: 'Corrigiendo un detalle…',
}

const SUGGESTIONS = ['Hazlo de 90 cm de ancho', 'Que aguante libros pesados', 'Baja una repisa 10 cm', 'Refuerza la base']

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
    const inicio = Date.now()
    const clock = setInterval(() => setSeconds(Math.floor((Date.now() - inicio) / 1000)), 1000)
    return () => {
      clearInterval(clock)
      setSeconds(0)
    }
  }, [active])
  return seconds
}

/** Open questions with quick answers across the chat: with more than one, answers wait in the tray. */
const openQuestions = (state: DesignState) => state.chat.filter((m) => m.author === 'expert' && !m.answered).flatMap((m) => m.questions.filter((p, i) => p.options && !m.answers.includes(questionAnswerKey(i))))

/** One question answers at once; with several, or with something already in the tray, answers join the tray. */
function Questions({ m, state }: { m: Message; state: DesignState }) {
  const adjust = useStore((s) => s.adjust)
  const toggleTray = useStore((s) => s.toggleTray)
  const thinking = useStore((s) => s.thinking)
  const batch = state.tray.length > 0 || openQuestions(state).length > 1
  const chosen = (i: number) => state.tray.find((t) => t.id === answerItemId(m.id, i))?.label

  return (
    <>
      {m.questions.map((p, i) => {
        const taken = m.answered || m.answers.includes(questionAnswerKey(i))
        return (
          <div key={i} className="flex flex-col gap-2">
            {m.questions.length > 1 || p.text !== m.text ? <p className="text-sm font-medium">{p.text}</p> : null}
            {p.options && (
              <div className="flex flex-wrap gap-2">
                {p.options.map((o) => (
                  <Chip
                    key={o}
                    active={chosen(i) === o}
                    aria-pressed={batch ? chosen(i) === o : undefined}
                    disabled={taken || thinking}
                    onClick={() => (batch ? toggleTray(answerItem(m.id, i, p.text, o)) : void adjust(o, `${m.id}#${questionAnswerKey(i)}`))}
                  >
                    {o}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {batch && !m.answered && m.questions.some((p) => p.options) && <p className="text-xs text-grafito-2">Tus respuestas esperan en la bandeja y van juntas; lo que no contestes lo decide el experto.</p>}
    </>
  )
}

function Bubble({ m, state, retry }: { m: Message; state: DesignState; retry: (() => void) | null }) {
  const thinking = useStore((s) => s.thinking)
  const applyProposal = useStore((s) => s.applyProposal)
  const discardProposal = useStore((s) => s.discardProposal)
  const showProposal = useStore((s) => s.showProposal)
  const toggleProposal = useStore((s) => s.toggleProposal)
  const viewVersion = useStore((s) => s.viewVersion)
  const viewedVersion = useStore((s) => s.viewedVersion)

  if (m.author === 'user')
    return (
      <div className="animate-aparecer ml-10 flex flex-col items-end gap-1.5 self-end">
        {m.thumbnail && <img src={m.thumbnail} alt="Foto enviada" className="h-24 rounded-xl border border-linea object-cover shadow-sm" />}
        <div className="rounded-2xl rounded-br-md bg-grafito px-4 py-2.5 text-[15px] leading-snug whitespace-pre-line text-hueso shadow-sm">{m.text}</div>
        {m.version && (
          <div className="w-full max-w-sm">
            <ChangeList state={state} version={m.version} />
          </div>
        )}
      </div>
    )

  const pending = m.proposal === 'pending' && state.proposal
  return (
    <div className="animate-aparecer mr-6 flex flex-col gap-2.5 self-start">
      <div className={`rounded-2xl rounded-bl-md border px-4 py-3 text-[15px] leading-relaxed shadow-sm ${m.error ? 'border-oxido/30 bg-oxido/5' : 'border-linea bg-hueso'}`}>
        <div className="mb-1 flex items-center gap-2 text-xs text-grafito-2">
          <PencilSimple weight="duotone" className="text-ambar" /> Experto
          {m.version &&
            (m.version === state.current || !state.versions.some((v) => v.n === m.version) ? (
              <span className="cifras rounded-full bg-kraft px-1.5 py-px text-[10px] text-grafito">v{m.version}</span>
            ) : (
              <button
                type="button"
                onClick={() => viewVersion(viewedVersion === m.version ? null : m.version)}
                title="Ver esta versión"
                aria-label={`Ver la versión ${m.version}`}
                className={`cifras rounded-full px-1.5 py-px text-[10px] underline decoration-dotted underline-offset-2 transition ${viewedVersion === m.version ? 'bg-ambar text-grafito' : 'bg-kraft text-grafito hover:bg-ambar-suave'}`}
              >
                v{m.version}
              </button>
            ))}
          {m.proposal === 'applied' && <span className="text-[10px]">· aplicada</span>}
          {m.proposal === 'discarded' && <span className="text-[10px]">· sin aplicar</span>}
        </div>
        {m.error && <Warning className="float-left mt-1 mr-2 text-oxido" weight="bold" />}
        {m.text.split('\n\n').map((p, i) => (
          <p key={i} className={i ? 'mt-2' : ''}>
            {p}
          </p>
        ))}
        {retry && (
          <Button variant="secondary" className="mt-3 min-h-9 text-xs" onClick={retry} disabled={thinking}>
            <ArrowClockwise weight="bold" /> Reintentar
          </Button>
        )}
      </div>

      {pending && (
        <div className="rounded-2xl border border-oxido/25 bg-kraft/60 p-3">
          <p className="mb-2 text-xs font-medium tracking-wide text-grafito-2 uppercase">Propuesta sin aplicar</p>
          {state.proposal!.holds.length > 0 && (
            <ul className="mb-2 flex flex-col gap-1.5">
              {state.proposal!.holds.map((h) => (
                <li key={h} className="flex items-start gap-2 text-sm">
                  <Warning className="mt-0.5 shrink-0 text-ambar" weight="bold" /> {h}
                </li>
              ))}
            </ul>
          )}
          <ul className="flex flex-col gap-2">
            {groupByCode(state.proposal!.critical).map(({ first, more }, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Stamp severity="critical" />
                <span>
                  {first.message}
                  {more > 0 && <span className="text-grafito-2"> Y {more === 1 ? 'otra pieza' : `${more} piezas más`} con el mismo problema.</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-9 text-xs" onClick={toggleProposal}>
              {showProposal ? <EyeSlash /> : <Eye />} {showProposal ? 'Ver el actual' : 'Ver propuesta'}
            </Button>
            <Button variant="ghost" className="min-h-9 text-xs" onClick={applyProposal} disabled={thinking}>
              {state.proposal!.critical.length ? 'Aplicar así, bajo mi riesgo' : 'Sí, aplícalo'}
            </Button>
            <Button variant="ghost" className="min-h-9 text-xs" onClick={discardProposal} disabled={thinking}>
              <ArrowCounterClockwise /> {state.proposal!.critical.length ? 'Descartar' : 'No, déjalo como estaba'}
            </Button>
          </div>
        </div>
      )}

      {m.version && !pending && <ChangeList state={state} version={m.version} />}

      {m.requestedPhotos.map((f) => (
        <RequestedPhoto key={f.angle} angle={f.angle} reason={f.reason} message={m} />
      ))}

      <Questions m={m} state={state} />
    </div>
  )
}

/** The expert asked for a photo: it is taken here and travels with the next message. */
function RequestedPhoto({ angle, reason, message }: { angle: string; reason: string; message: Message }) {
  const { images } = useServices()
  const adjust = useStore((s) => s.adjust)
  const thinking = useStore((s) => s.thinking)
  const [processing, setProcessing] = useState(false)
  const send = async (file: File) => {
    setProcessing(true)
    try {
      const r = await images.reduce(file)
      await adjust(`Te mando la foto: ${angleLabel(angle)}`, `${message.id}#${photoAnswerKey(angle)}`, { angle, base64: r.base64, thumbnail: r.thumbnail })
    } finally {
      setProcessing(false)
    }
  }
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-grafito/30 bg-hueso/70 p-3">
      <p className="flex items-start gap-2 text-sm">
        <Camera className="mt-0.5 shrink-0 text-ambar" weight="duotone" />
        <span>
          <span className="font-medium">Foto: {angleLabel(angle)}.</span> <span className="text-grafito-2">{reason}</span>
        </span>
      </p>
      <div className="flex gap-2">
        <TakePhoto onChoose={(f) => void send(f)} disabled={message.answered || message.answers.includes(photoAnswerKey(angle)) || thinking || processing} />
      </div>
    </div>
  )
}

export function Chat({ state }: { state: DesignState }) {
  const adjust = useStore((s) => s.adjust)
  const sendTray = useStore((s) => s.sendTray)
  const toggleTray = useStore((s) => s.toggleTray)
  const thinking = useStore((s) => s.thinking)
  const stage = useStore((s) => s.stage)
  const cancel = useStore((s) => s.cancel)
  const [text, setText] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const seconds = useSeconds(thinking)
  const last = state.chat.at(-1)
  const previous = state.chat.at(-2)
  // If the last attempt failed, the same request is sent again with one click.
  const retry = last?.error && previous?.author === 'user' ? () => void adjust(previous.text) : null
  const suggestions = thinking || last?.author !== 'expert' || last.error ? [] : last.suggestions.length ? last.suggestions : state.versions.length <= 1 ? SUGGESTIONS : []

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }, [state.chat.length, thinking])

  const send = () => {
    if ((!text.trim() && !state.tray.length) || thinking) return
    void (state.tray.length ? sendTray(text) : adjust(text))
    setText('')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={list} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 pb-3" role="log" aria-live="polite" aria-label="Conversación con el experto">
        {state.chat.map((m) => (
          <Bubble key={m.id} m={m} state={state} retry={m === last ? retry : null} />
        ))}
        {thinking && (
          <div className="flex items-center gap-2 self-start rounded-2xl border border-linea bg-hueso px-4 py-2.5 text-sm text-grafito-2" aria-live="polite">
            <Pencil className="h-5 w-12 text-ambar" /> {stage ? STAGES[stage.name] : 'Pensando…'}
            {seconds >= 10 && <span className="cifras text-xs">· {seconds} s</span>}
          </div>
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]" aria-label="Sugerencias">
          {suggestions.map((s) => (
            <Chip key={s} className="shrink-0" active={state.tray.some((t) => t.id === suggestionItem(s).id)} onClick={() => (state.tray.length ? toggleTray(suggestionItem(s)) : void adjust(s))}>
              {s}
            </Chip>
          ))}
        </div>
      )}
      <Tray items={state.tray} typed={!!text.trim()} onSend={send} />
      <form
        className="flex items-end gap-2 border-t border-linea bg-hueso/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <textarea
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
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-linea bg-hueso px-4 py-2.5 text-[15px] outline-none [field-sizing:content] focus:border-ambar"
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
    </div>
  )
}
