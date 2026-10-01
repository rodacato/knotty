/** The chip names the resolved problem only; the piece list stays in the notices panel. */
export function resolvedChipLabel(entry: string): string {
  const at = entry.indexOf(": ");
  return `Resuelto: ${at === -1 ? entry : entry.slice(0, at)}`;
}

/** Dismissed per version: a new version that resolves something shows its chip again. */
export function resolvedVisible(
  resolved: string[],
  dismissedFor: number | null,
  current: number,
): boolean {
  return resolved.length > 0 && dismissedFor !== current;
}
