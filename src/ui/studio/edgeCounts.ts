import type { Edge } from "../../domain/design/schema";

export type EdgeCounts = { shown: Edge[]; hidden: Edge[] };

/** Splits the chosen edges into the ones that show (drawn and bought) and the ones that rest against another piece. */
export function countEdges(
  chosen: Edge[],
  against: ReadonlyMap<Edge, string | null>,
): EdgeCounts {
  return {
    shown: chosen.filter((e) => !against.get(e)),
    hidden: chosen.filter((e) => against.get(e)),
  };
}
