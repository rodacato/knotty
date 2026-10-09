export type CopyState = 'idle' | 'copied' | 'failed'

export const copyLabel = (state: CopyState) => (state === 'copied' ? 'Lista copiada' : 'Copiar lista para la maderería')

/** What to check at the counter before paying; the drawer is named only when the furniture has one. */
export const beforeLeaving = (hasDrawer: boolean): string[] => [
  'Empalma las piezas gemelas: deben quedar parejas.',
  `Mide la más larga${hasDrawer ? ' y las del cajón' : ''}; si alguna se va más de 1 mm, dilo antes de pagar.`,
  'Revisa que cada pieza traiga su número.',
]

/** The line number of every piece, as the cut list and the message count them. */
export const lineNumbers = (blocks: { lines: { number: number; ids: string[] }[] }[]): Map<string, number> =>
  new Map(blocks.flatMap((block) => block.lines.flatMap((line) => line.ids.map((id) => [id, line.number] as const))))
