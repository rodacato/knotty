interface Named {
  pieces: { id: string; name: string }[]
  joints?: { id: string; a: string; b: string }[]
}

/** The design a message is about plus the one it came from: a piece that only the candidate has still gets its name, and the candidate wins. */
export function withCandidate(current: Named, candidate?: Named | null): Named {
  if (!candidate) return current
  const byId = <T extends { id: string }>(a: T[] = [], b: T[] = []) => [...a.filter((x) => !b.some((y) => y.id === x.id)), ...b]
  return { pieces: byId(current.pieces, candidate.pieces), joints: byId(current.joints, candidate.joints) }
}

/** A message from the rules speaks of pieces and joints by id ("shelf-2"); the person reads their names, as the sheet and the 3D show them. */
export function named({ pieces, joints = [] }: Named, text = ''): string {
  const nameOf = (id: string) => pieces.find((p) => p.id === id)?.name ?? id
  const withPieces = pieces.reduce((m, p) => m.replaceAll(`"${p.id}"`, `«${p.name}»`), text)
  return joints.reduce((m, j) => m.replaceAll(`"${j.id}"`, `«${nameOf(j.a)} con ${nameOf(j.b)}»`), withPieces)
}
