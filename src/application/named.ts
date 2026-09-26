/** A message from the rules speaks of pieces by id ("shelf-2"); the person reads their names. */
export const named = (pieces: { id: string; name: string }[], text = '') => pieces.reduce((m, p) => m.replaceAll(`"${p.id}"`, p.name), text)
