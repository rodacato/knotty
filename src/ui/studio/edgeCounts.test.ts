import { describe, expect, it } from "vitest";
import type { Edge } from "../../domain/design/schema";
import { countEdges } from "./edgeCounts";

const against = new Map<Edge, string | null>([
  ["front", null],
  ["left", "side-left"],
  ["right", "side-right"],
  ["back", "back-panel"],
]);

describe("countEdges", () => {
  it("counts only the chosen edges that show", () => {
    const { shown, hidden } = countEdges(
      ["front", "left", "right", "back"],
      against,
    );
    expect(shown).toEqual(["front"]);
    expect(hidden).toEqual(["left", "right", "back"]);
  });

  it("has nothing shown when every chosen edge is hidden", () => {
    expect(countEdges(["left", "back"], against).shown).toEqual([]);
  });

  it("ignores edges that are not chosen", () => {
    expect(countEdges([], against)).toEqual({ shown: [], hidden: [] });
  });
});
