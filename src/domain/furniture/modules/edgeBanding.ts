import { z } from 'zod'
import type { Design } from '../../design/schema'
import { choice, fromLabels, type FieldSpec } from './fields'
import type { Labels } from './module'

// Whether the edges that show are covered with edge banding or left with the plywood's layers in sight (triplay.md, «Cantos y cubrecanto»). Every module's plan takes it the same way.

export const EdgeBanding = z.enum(['banded', 'exposed'])
export type EdgeBanding = z.infer<typeof EdgeBanding>

/** What the expert reads on the field, the same in every module. */
export const EDGE_BANDING = 'banded (default); exposed: no edge banding, the plywood layers show'

export const EDGE_BANDING_LABELS = {
  banded: { option: 'Con cubrecanto', phrase: 'con cubrecanto', hint: 'Una tira de chapa tapa las capas del triplay en los cantos que se ven, y se barniza igual que la cara.' },
  exposed: {
    option: 'A la vista',
    phrase: 'cantos a la vista',
    hint: 'Sin cubrecanto: se ven las capas del triplay. Cada canto se lija (grano 120 y luego 180), se le mata la arista y se sella con el mismo acabado. En triplay de pino las capas salen disparejas y con huecos: conviene verlo antes de decidir.',
  },
} satisfies Labels<EdgeBanding>

type WithEdges = { edges?: EdgeBanding }

/** With the edges in sight no piece of the plan is born banded; a piece banded afterwards, on top of the plan, keeps its own. */
export const withEdges = (design: Design, edges: EdgeBanding | undefined): Design =>
  edges === 'exposed' ? { ...design, pieces: design.pieces.map((p) => (p.edges.length ? { ...p, edges: [] } : p)) } : design

export const edgeBandingField = <P extends WithEdges>(): FieldSpec<P> =>
  choice<P, EdgeBanding>({ key: 'edges', label: 'Cantos', ...fromLabels(EDGE_BANDING_LABELS), get: (p) => p.edges ?? 'banded', set: (p, edges) => ({ ...p, edges }) })

export const describeEdgeBanding = (before: WithEdges, after: WithEdges): string[] => ((before.edges ?? 'banded') === (after.edges ?? 'banded') ? [] : [EDGE_BANDING_LABELS[after.edges ?? 'banded'].phrase])
