import { describe, expect, it } from "vitest";
import { resolvedChipLabel, resolvedVisible } from "./chipLabels";

describe("resolvedChipLabel", () => {
  it("drops the piece list", () => {
    expect(
      resolvedChipLabel(
        "Entrepaños que se pandean: Piso, Entrepaño 1, Entrepaño 2",
      ),
    ).toBe("Resuelto: Entrepaños que se pandean");
  });
  it("keeps an entry that has no pieces", () => {
    expect(resolvedChipLabel("Falta un apoyo")).toBe(
      "Resuelto: Falta un apoyo",
    );
  });
});

describe("resolvedVisible", () => {
  it("hides once dismissed for this version only", () => {
    expect(resolvedVisible(["a"], 3, 3)).toBe(false);
    expect(resolvedVisible(["a"], 3, 4)).toBe(true);
  });
  it("hides when nothing was resolved", () => {
    expect(resolvedVisible([], null, 1)).toBe(false);
  });
});
