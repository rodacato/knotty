import * as Dialog from '@radix-ui/react-dialog'
import { ArrowLeft, BookOpen, CaretDown, CaretRight, Check, Minus, Plus, Wrench, X } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { analyze } from '../../domain/checks/analysis'
import { GUIDE_JOINTS, JOINT_GUIDE, jointFit, levelsText, type GuideJoint, type JointFit } from '../../domain/design/jointGuide'
import { JOINTS } from '../../domain/design/jointSpecs'
import type { Design } from '../../domain/design/schema'
import { named } from '../../application/named'
import { chooseJoint, isChoosable, jointGroups, type JointGroup } from '../../domain/editing/joints/choice'
import { TOOL_LEVEL_LABELS } from '../../domain/materials/tools'
import { TERMS } from '../glossary'
import { useServices } from '../services'
import { useStore } from '../store'
import { Button, IconButton, Title } from '../system/components'
import { RadioCard, RadioGroup } from '../system/RadioCard'

// Joints the person picks per group of pieces, against the tools they said they have (fabricacion-y-armado.md §1.3).

/** «Tu herramienta: intermedio», with the way to change it. */
function ToolLine() {
  const level = useStore((s) => s.catalogSettings.toolLevel)
  const openSettings = useStore((s) => s.openSettings)
  return (
    <div className="flex items-center gap-2 rounded-xl bg-kraft px-3 py-2 text-sm">
      <Wrench className="shrink-0" />
      <span className="min-w-0 flex-1">Tu herramienta: {TOOL_LEVEL_LABELS[level].short}</span>
      <button type="button" onClick={() => openSettings(true)} className="min-h-11 shrink-0 text-xs text-graphite-2 underline-offset-2 hover:text-graphite hover:underline">
        Cambiar en Ajustes
      </button>
    </div>
  )
}

const FIT_TAG: Record<JointFit, string> = { yes: 'Puedes', jig: 'Con plantilla', careful: 'Con cuidado', shop: 'No con tu herramienta', no: 'No con tu herramienta' }

function FitTag({ fit }: { fit: JointFit | null }) {
  if (!fit) return null
  const can = fit === 'yes' || fit === 'jig' || fit === 'careful'
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${can ? 'bg-amber-soft text-graphite' : 'border border-line text-graphite'}`}>{FIT_TAG[fit]}</span>
}

/** A face, its edge showing the plies, and the arris between them. */
function PieceParts() {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-2xl border border-line bg-paper">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-semibold">
        <BookOpen /> <span className="flex-1">Partes de una pieza</span> {open ? <CaretDown /> : <CaretRight />}
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-3 pb-3">
          <svg viewBox="0 0 240 90" className="mx-auto w-full max-w-72" role="img" aria-label="Una pieza: la cara arriba, el canto con sus capas abajo y la arista entre los dos">
            <rect x="20" y="10" width="160" height="56" className="fill-kraft-2" />
            <text x="100" y="42" textAnchor="middle" className="fill-graphite text-[11px]">
              Cara
            </text>
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x="20" y={68 + i * 4} width="160" height="3" className={i % 2 ? 'fill-kraft-2' : 'fill-graphite-2/40'} />
            ))}
            <line x1="20" x2="180" y1="67" y2="67" className="stroke-amber" strokeWidth="2" />
            <text x="186" y="70" className="fill-amber text-[10px]">
              Arista
            </text>
            <text x="186" y="84" className="fill-graphite text-[10px]">
              Canto
            </text>
          </svg>
          <dl className="flex flex-col gap-1 text-xs">
            {[TERMS.face, TERMS.edge, TERMS.arris].map((t) => (
              <div key={t.name}>
                <dt className="inline font-semibold">{t.name}: </dt>
                <dd className="inline">{t.meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  )
}

interface Option {
  joint: GuideJoint
  fit: JointFit | null
  /** Why it cannot be picked here, if it cannot. */
  blocked: string | null
  /** What R2 says about it on these boards. */
  warnings: string[]
}

function JointCard({ option, selected, onSelect }: { option: Option; selected: boolean; onSelect: () => void }) {
  const g = JOINT_GUIDE[option.joint]
  const body = (
    <>
      <span className="flex items-start gap-2">
        <span className="flex-1 font-semibold">{g.name}</span>
        <FitTag fit={option.fit} />
      </span>
      <span className="block">{g.definition}</span>
      <span className="flex items-center gap-1.5 text-xs text-graphite-2">
        <Wrench className="shrink-0" /> {g.tool} · {levelsText(option.joint)}
      </span>
      {option.fit === 'shop' && <span className="block text-xs text-graphite-2">O que la maderería la haga.</span>}
      {g.advantage && (
        <span className="flex items-start gap-1.5 text-xs">
          <Plus className="mt-0.5 shrink-0 text-graphite-2" /> {g.advantage}
        </span>
      )}
      {g.disadvantage && (
        <span className="flex items-start gap-1.5 text-xs">
          <Minus className="mt-0.5 shrink-0 text-rust" /> {g.disadvantage}
        </span>
      )}
      {option.warnings.map((w) => (
        <span key={w} className="block text-xs text-rust">
          {w}
        </span>
      ))}
      {option.blocked && <span className="block text-xs text-graphite-2">{option.blocked}</span>}
    </>
  )
  const frame = `flex w-full flex-col gap-1.5 rounded-2xl p-3 text-left text-sm`
  if (option.blocked) return <div className={`${frame} border border-line`}>{body}</div>
  return (
    <RadioCard checked={selected} onChange={onSelect} className={frame}>
      {body}
    </RadioCard>
  )
}

const HEADERS = ['Unión', 'Nivel', 'Resistencia', 'Dificultad', 'Se ve', '¿Se desarma?']

function JointTable({ options, selected, onSelect }: { options: Option[]; selected: GuideJoint; onSelect: (j: GuideJoint) => void }) {
  return (
    <table className="w-full border-collapse overflow-hidden rounded-2xl text-left text-xs">
      <thead className="bg-kraft text-graphite-2">
        <tr>
          {HEADERS.map((h) => (
            <th key={h} className="px-3 py-2 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {options.map((o) => {
          const g = JOINT_GUIDE[o.joint]
          return (
            <tr
              key={o.joint}
              onClick={() => !o.blocked && onSelect(o.joint)}
              className={`border-t border-line align-top ${o.blocked ? '' : 'cursor-pointer hover:bg-kraft'} ${selected === o.joint ? 'bg-amber-soft' : ''}`}
            >
              <td className={`px-3 py-2 ${selected === o.joint ? 'shadow-[inset_3px_0_0_0_var(--graphite)]' : ''}`}>
                {o.blocked ? (
                  <span className="block text-sm font-semibold">{g.name}</span>
                ) : (
                  <RadioCard variant="bare" checked={selected === o.joint} onChange={() => onSelect(o.joint)} className="block text-left text-sm font-semibold">
                    {g.name}
                  </RadioCard>
                )}
                <span className="mt-1 inline-block">
                  <FitTag fit={o.fit} />
                </span>
                {o.warnings.map((w) => (
                  <span key={w} className="mt-1 block text-rust">
                    {w}
                  </span>
                ))}
                {o.blocked && <span className="mt-1 block text-graphite-2">{o.blocked}</span>}
              </td>
              <td className="px-3 py-2">{levelsText(o.joint)}</td>
              <td className="px-3 py-2">{g.resistance}</td>
              <td className="px-3 py-2">{g.difficulty}</td>
              <td className="px-3 py-2">{g.visible}</td>
              <td className="px-3 py-2">{g.knockDown}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function JointCatalog({ design, group, onClose, onDone }: { design: Design; group: JointGroup; onClose: () => void; onDone: (notes: string[]) => void }) {
  const { catalog } = useServices()
  const level = useStore((s) => s.catalogSettings.toolLevel)
  const choose = useStore((s) => s.chooseJoint)
  const [selected, setSelected] = useState<GuideJoint>(isChoosable(group.current) ? group.current : 'butt-screw')
  const [error, setError] = useState<string | null>(null)
  const options = useMemo((): Option[] => {
    const a = analyze(design, catalog)
    return GUIDE_JOINTS.map((joint) => {
      const fit = jointFit(joint, level)
      if (!isChoosable(joint))
        return { joint, fit, warnings: [], blocked: joint === 'confirmat' ? 'Knotty todavía no la arma: no se elige aquí.' : 'Cambia la forma de las piezas: no se elige aquí.' }
      const findings = a.geo ? chooseJoint(design, a.geo, group.id, joint, catalog).findings : []
      const critical = findings.some((f) => f.severity === 'critical')
      return { joint, fit, warnings: [...new Set(findings.map((f) => named(design, f.message)))].slice(0, 2), blocked: critical ? 'No con estos tableros.' : null }
    })
  }, [design, catalog, group.id, level])
  const chosen = options.find((o) => o.joint === selected)
  const use = () => {
    if (!isChoosable(selected)) return
    const r = choose(group.id, selected)
    if (!r.ok) return setError(r.message)
    onDone(r.notes)
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-graphite/30 backdrop-blur-[2px]" />
        <Dialog.Content className="animate-appear fixed inset-0 z-50 flex flex-col bg-bone lg:inset-auto lg:top-1/2 lg:left-1/2 lg:max-h-[85dvh] lg:w-[min(60rem,calc(100vw-4rem))] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:border lg:border-line lg:shadow-2xl">
          <div className="flex items-center gap-2 border-b border-line px-2 py-2 lg:px-5 lg:py-4">
            <Dialog.Close asChild>
              <IconButton aria-label="Volver" className="lg:hidden">
                <ArrowLeft />
              </IconButton>
            </Dialog.Close>
            <Dialog.Title asChild>
              <Title className="flex-1 text-lg lg:text-xl">{group.title}</Title>
            </Dialog.Title>
            <Dialog.Close asChild>
              <IconButton aria-label="Cerrar">
                <X />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:px-5">
            <PieceParts />
            <Dialog.Description className="text-sm text-graphite">
              <span className="block first-letter:uppercase">{group.label.split(': ')[1] ?? group.label}.</span>
              <span className="block text-graphite-2">Lo que puedes hacer con tu herramienta: {TOOL_LEVEL_LABELS[level].short}.</span>
            </Dialog.Description>
            <RadioGroup label={group.title} className="flex flex-col gap-2 lg:hidden">
              {options.map((o) => (
                <JointCard key={o.joint} option={o} selected={selected === o.joint} onSelect={() => setSelected(o.joint)} />
              ))}
            </RadioGroup>
            <RadioGroup label={group.title} className="hidden overflow-hidden rounded-2xl border border-line lg:block">
              <JointTable options={options} selected={selected} onSelect={setSelected} />
            </RadioGroup>
          </div>
          <div className="flex flex-col gap-2 border-t border-line px-4 py-3 lg:flex-row lg:items-center lg:px-5">
            <p className="flex-1 text-xs text-graphite-2">Las pruebas casi nunca son en triplay de pino: la resistencia se lee como orden, no como número.</p>
            {error && <p className="text-xs text-rust">{error}</p>}
            {selected === group.current ? (
              <p className="flex min-h-11 items-center gap-1.5 text-sm font-medium text-graphite">
                <Check weight="bold" /> Ya la usas
              </p>
            ) : (
              <Button variant="primary" className="min-h-11" disabled={!chosen || !!chosen.blocked} onClick={use}>
                Usar {JOINT_GUIDE[selected].name.toLowerCase()}
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** One row per group of joints the design has, with the joint it has now and the way to change it. */
/** `only`: the groups of one part of the furniture, when the section sits inside that part. */
export function JointsSection({ design, only, title = 'Uniones' }: { design: Design; only?: JointGroup['id'][]; title?: string }) {
  const groups = jointGroups(design).filter((g) => !only || only.includes(g.id))
  const [open, setOpen] = useState<JointGroup['id'] | null>(null)
  const [notes, setNotes] = useState<string[]>([])
  const group = groups.find((g) => g.id === open)
  if (!groups.length) return null
  return (
    <section className="flex flex-col gap-3">
      <Title className="text-lg">{title}</Title>
      <ToolLine />
      <ul className="flex flex-col gap-3">
        {groups.map((g) => (
          <li key={g.id} className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-graphite-2">{g.label}</span>
              <span className="block font-medium">{g.current in JOINT_GUIDE ? JOINT_GUIDE[g.current as GuideJoint].name : JOINTS[g.current].label.singular}</span>
            </span>
            <Button
                className="shrink-0 rounded-full"
                onClick={() => {
                  setNotes([])
                  setOpen(g.id)
                }}
              >
                Cambiar <CaretRight />
              </Button>
          </li>
        ))}
      </ul>
      {notes.length > 0 && <p className="text-xs text-graphite">{notes.join(' ')}</p>}
      {group && (
        <JointCatalog
          design={design}
          group={group}
          onClose={() => setOpen(null)}
          onDone={(n) => {
            setNotes(n)
            setOpen(null)
          }}
        />
      )}
    </section>
  )
}
