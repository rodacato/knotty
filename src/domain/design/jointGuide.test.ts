import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GUIDE_JOINTS, JOINT_GUIDE, jointFit, levelsText, type GuideJoint, type JointFit } from './jointGuide'

// The level fit is read from the table of fabricacion-y-armado.md §1.3 itself, so the code cannot drift from the reference.

const DOC = readFileSync(join(import.meta.dirname, '../../../docs/carpinteria/fabricacion-y-armado.md'), 'utf8')
const NAMES: Record<string, GuideJoint> = {
  'A tope con tornillo': 'butt-screw',
  'Clavo y pegamento': 'glue-nail',
  'Escuadra metálica': 'bracket',
  'Tornillo de bolsillo': 'pocket-screw',
  Tarugos: 'dowel',
  Minifix: 'cam-lock',
  Ranura: 'dado',
  Rebaje: 'rabbet',
}

/** A bare ⚠️ is read by the tool the row asks for: a jig, or care with the level's own tools. */
function cellFit(cell: string, tool: string): JointFit {
  if (cell.startsWith('✅')) return 'yes'
  if (cell.includes('maderería')) return 'shop'
  if (cell.startsWith('❌')) return 'no'
  if (cell.includes('plantilla') || (cell === '⚠️' && tool.includes('plantilla'))) return 'jig'
  return 'careful'
}

function referenceTable(): Map<GuideJoint, JointFit[]> {
  const section = DOC.slice(DOC.indexOf('### 1.3'), DOC.indexOf('## 2.'))
  const rows = section.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Unión'))
  return new Map(
    rows.flatMap((row) => {
      const [name, l1, l2, l3, tool] = row.split('|').slice(1).map((c) => c.trim())
      const joint = NAMES[name]
      return joint ? [[joint, [l1, l2, l3].map((c) => cellFit(c, tool))] as const] : []
    }),
  )
}

describe('joint guide', () => {
  it('fits each level as the table of §1.3 says', () => {
    const table = referenceTable()
    expect([...table.keys()].sort()).toEqual(GUIDE_JOINTS.filter((j) => JOINT_GUIDE[j].fit).sort())
    const ours = new Map([...table.keys()].map((joint) => [joint, [jointFit(joint, 1), jointFit(joint, 2), jointFit(joint, 3)]]))
    expect(ours).toEqual(table)
  })

  it('has no level for confirmat, which §1.3 does not list', () => {
    expect(jointFit('confirmat', 3)).toBeNull()
    expect(levelsText('confirmat')).toBe('Nivel sin dato')
  })

  it('says which levels make it, up to the first that makes it plainly', () => {
    expect(levelsText('butt-screw')).toBe('Desde nivel 1')
    expect(levelsText('pocket-screw')).toBe('Desde nivel 2')
    expect(levelsText('dowel')).toBe('Nivel 2 con plantilla · 3')
    expect(levelsText('cam-lock')).toBe('Nivel 1 si la maderería la hace · 2 con plantilla · 3')
  })
})
