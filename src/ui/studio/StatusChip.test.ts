import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusChip } from "./StatusChip";

const chip = (label: string) =>
  renderToStaticMarkup(
    createElement(StatusChip, {
      statuses: [{ key: "k", icon: createElement("svg"), label }],
    }),
  );

describe("StatusChip", () => {
  it("keeps the icon from shrinking and truncates the text on one line", () => {
    const html = chip("Resuelto: Entrepaños que se pandean");
    expect(html).toMatch(/<span class="[^"]*shrink-0[^"]*"><svg/);
    expect(html).toMatch(/<span class="[^"]*truncate[^"]*">Resuelto/);
    expect(html).toContain('role="status"');
  });
});
