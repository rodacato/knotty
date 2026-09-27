# Studio audit — summary across personas (2026-09-27)

Six fictional personas ([AUDIENCE.md](../AUDIENCE.md)) walked the mobile Studio, as-is captures against the first nine proposal screens. Per-persona files sit next to this one. Weighing follows the protocol: three or more personas, or the persona the screen is for, makes a finding; fewer is a hypothesis. **All of it is still unconfirmed by a real person.**

## Findings (3+ personas)

| # | Finding | Who | Where it comes from | Goes to |
|---|---|---|---|---|
| A | The compact tray hides what is in it ("Bandeja · 1"); the as-is chip said "Entrepaños que se pandean: que decida el experto" | Mariana, Sofía, Ricardo | **Regression of the proposal** | Fix in `_playground.pen` |
| B | The cost and the cut list sit behind "Revisar y ver materiales"; nobody finds the price where they look for it | Mariana, Sofía, Don Chava | As-is and proposal, by design (D30) | `UI-16` — a call against D30, Adrian decides |
| C | More icon-only actions: ⋯, Armado without its label, a bare stop, a dot on "Conversación" | Ricardo, Doña Carmen, Mariana, Luis | **Regression of the proposal** | Fix in `_playground.pen` |
| D | Overriding is hard: "Aplicar así, bajo mi riesgo" / "Aceptar así, bajo mi riesgo" are small grey text, and name the same action two ways | Mariana, Sofía, Doña Carmen, Don Chava | Wording as-is (Chat vs NoticePanel); size is a **regression** | `UI-17` + fix |
| E | Nothing says "it's fine now": after an answer or a fix, only a dot or "Los puntos críticos siguen" | Mariana, Ricardo, Doña Carmen | As-is and proposal | `UI-18` |

## Measured, not opinion

- **H** — The proposal set the notice text at 12–13 px `graphite-2`; the app uses 15 px `graphite` (`src/ui/studio/NoticePanel.tsx`). Raised by Doña Carmen, checked in code. **Regression**, fix.
- **The tray screen copies a cut sentence** ("Los puntos críticos siguen") from the as-is capture. Raised by Sofía. **Regression**, fix with the full message.
- **Header and 3D disagree during a proposal** (57 cm vs 90 cm) — Doña Carmen, Don Chava. As-is; joins `UI-13`.

## Hypotheses (1–2 personas) — logged, not acted on

- The sag notice has no scale: "claro de 864 mm (lo aceptable es hasta 2.4 mm)" does not say whether it breaks (Mariana).
- "Un carpintero revisa tu diseño" reads as a real person (Luis) and as lecturing a carpenter (Don Chava).
- Only one fix for sag is offered; no apron, no thicker board (Don Chava) — check the fix catalog before assuming a gap.
- "Que el experto decida" comes pre-checked on a recommendation the person chose on purpose (Don Chava) — a proposal default, easy to drop.
- Nothing speaks to someone with no tools who will move (Sofía); no way to share the design (Luis, Doña Carmen). Not targets for a feature.

## Keep — what several personas named

- The 3D never covered, with the selected piece solid and the rest see-through (all six).
- "Aplicar con un apoyo al centro" as the main action (Mariana, Ricardo, Sofía).
- "Resolver 2 · 1 al instante · 1 al experto" (Mariana, Sofía, Don Chava, Doña Carmen).
- "Y 4 piezas más igual" instead of the same sentence five times (Sofía).
- From the app: "Volver a esta" in the history, the piece measures and "Veta a lo largo" (Don Chava, Ricardo, Sofía).

> **After this audit** (same day) the proposal was corrected for the regressions above and re-exported; `exports/playground/` now shows the fixed version, and `7-notices-several-resolve.jpg` became `7-notices-several-after-choosing.jpg`. The per-persona files describe the version they saw.

## Desktop pass (Don Chava, Doña Carmen)

Files: `2026-09-27-studio-desktop-don-chava.md`, `2026-09-27-studio-desktop-dona-carmen.md`.

| Finding | Who | Outcome |
|---|---|---|
| "Several notices" lost the third way out, "Aceptar así, bajo mi riesgo", and named the two others only with icons | Both | **Regression, fixed** on mobile and desktop: each notice offers three labeled ways, and the chosen one is marked |
| The piece sheet never says when an edit applies | Don Chava | Fixed: "⚡ Al instante" under the piece name |
| "Precios de referencia, no una cotización." too small and grey | Doña Carmen | Fixed: 13 px, graphite |
| "56 %" breaks onto its own line — in the app too | Both | Code note: a non-breaking space before "%" in `Materials.tsx` (`percent`) |
| No per-sheet cut layout in the proposal | Don Chava | Known gap, now a priority for the next materials screen |
| Header says 57 cm while the 3D shows 90 cm during a proposal | Both, again | Joins `UI-13`; four personas across both passes |
| No way to send the design to someone | Doña Carmen (twice), Luis | Still a hypothesis (two personas) |
| "Lost joints" in the piece sheet | Don Chava | **Rejected:** he compared the door (one joint) with the back panel (four) |
| The suggestions row is cut at the right edge | Doña Carmen | **Keep:** it is the peek cue for a scrollable row |
