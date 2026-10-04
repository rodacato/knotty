import type { Design } from '../../domain/design/schema'

/** The pieces a check names in its data (a pair in contact, a finding's pieces), in the order the data gives them and only the ones the design has. */
export function piecesNamedIn(design: Design, data: Record<string, unknown> | undefined, extra: string[] = []): string[] {
  const values = Object.values(data ?? {}).flatMap((v) => (Array.isArray(v) ? v : [v]))
  const ids = [...extra, ...values].filter((v): v is string => typeof v === 'string' && design.pieces.some((p) => p.id === v))
  return [...new Set(ids)]
}
