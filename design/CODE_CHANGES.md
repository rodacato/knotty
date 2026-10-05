# Code changes — design decisions pending in `src/ui/`

> The **work order** for landing design decisions in code. The `UI-<n>` entry in `DECISIONS.md` holds the finding and the decision; this tracks execution. The kit mirrors the **current** code until each change lands, then bumps.

**Rule:** a consolidation cites **measured** usage (grep counts with a date), not impressions.

| Layer / pattern | Real consumers (measured 2026-09-27) | Verdict |
|---|---|---|
| Text inputs, selects and textareas styled by hand | 27 `input`/`select`/`textarea` in 12 files, of which 20 are text fields — the rest are 2 hidden file inputs, a radio, 2 checkboxes and the tape in `MeasureField` | ✅ `src/ui/system/Field.tsx` (K7), in kit 0.3.0 |
| Status pills over the 3D | 3 in `src/ui/studio/Studio.tsx` | ✅ `src/ui/studio/StatusChip.tsx` (K2) |
| Proposal actions | 2 renderings of one proposal (`Chat.tsx`, `NoticePanel.tsx`) | ✅ Same actions and weights in both (K1); still two renderings |
| Round icon-only buttons with no fill (close, back, copy) | 11 in 9 files on 2026-10-05, in four sizes (32, 36, 40 and 44 px), some without the 44 px hit area | ✅ `IconButton` in `src/ui/system/components.tsx`: 36 px with a 44 px hit area, or 44 px. In kit 0.5.0. The close of a status pill (28 px inside a 36 px pill) stays local |
| `Segmented` | 3 files, all in `src/ui/studio/` | Feature-local: stays in the flow, not the kit |
| Uppercase labels | 6 left on 2026-09-27 (K1 removed the rest; the `Stamp` stays) | ✅ Sentence case with K5 |

## 1. `Field` — one input for the whole app

**Status:** landed (K7, with K5), in kit 0.3.0

- Landed: `Field` (label on top, then help or error), `Input` (`unit` and `end` inside the box), `Select` (own caret) and `TextArea`, in `src/ui/system/Field.tsx`. The 20 text fields use them; `NumberField` is gone.
- Every control is 16 px: below that, iOS Safari zooms the page on focus. Labeled fields are 44 px tall (`min-h-11`); the inline ones inside a row (cabinet percentages, price) are 32 px.
- Out on purpose: `MeasureField` in Capture is the tape, not a form field.

## 2. `StatusChip` — one status over the 3D

**Status:** landed (K2, K3) — `UI-5`, and `UI-18` with K1

- Landed: `src/ui/studio/StatusChip.tsx`; the piece opens in the panel (`src/ui/studio/PieceSheet.tsx`, `PieceCard` removed); the view bar is one row. The as-is captures of `studio.pen` are retaken in one batch when more target screens land.

- Replace the three pills in `Studio.tsx` with one chip: one state at a time by priority (problems > proposal/preview > old version > to confirm), plus the resolved state ("Resuelto: …") and the expert working in the background (`UI-15`).

## 3. Notice ways and proposal actions

**Status:** landed (K1) — `UI-3`, `UI-6`, `UI-15` step 1, `UI-17`, `UI-18` · "Aplicar con un apoyo al centro" inside a proposal landed (`proposal-fixes`): the fix is computed on the proposal's design, and applying it makes one version

- Landed: `applyFixes` (several solutions as one version, all or none), the ways in `NoticePanel.tsx` with "Resolver N", the chat proposal's visible actions, and the status chip's "Resuelto: …" and expert-at-work states.

- One component renders the ways out of a notice or a proposal: "Al instante" (⚡, primary), "A la bandeja, para el experto", "Aceptar así, bajo mi riesgo" / "Aplicar así, bajo mi riesgo" as visible secondaries. Used by `Chat.tsx` and `NoticePanel.tsx`. Several notices resolve with one "Resolver N".

## 4. Capture in one screen (D40) with photos without slots (D39)

**Status:** landed (`photos-d39`) — `UI-7`, `UI-8`, `UI-19`, D39, D40

- Landed: Capture is one screen (`src/ui/capture/Capture.tsx`); typical measures per kind and the measure ranges live in `src/domain/furniture/typical.ts`; `PhotoReading` has `view` (`reading@4`), a photo is read when added and the read is shared with designing, `mergeReadings` ranks by view and the person's label wins; `requestedPhotos` is gone from the schemas, the prompts (`reconstruction@13`, `skeleton@16`, `adjust@11`), the chat and the session (format 9).
- The bench has no photo cases, so it cannot measure the view labels; the new prompts go through `npm run compare` by hand.

## 5. Sentence-case section labels

**Status:** landed with K5 — `UI-2` (labels only; grouping and nested cards stay open)

- The 5 remaining eyebrows and Home's tagline are sentence case (6; K1 had already removed the rest).

## 6. Amber for selection only (K6)

**Status:** landed (`amber-k6`), with kit 0.3.0 — `UI-1`

- Measured 2026-09-27 after step 5: amber on 50 lines in 20 files (without the debug panel); the earlier "100 uses" counted occurrences.
- Amber stays for selection and focus: the active tab, the selected piece and provider, the version being viewed, an active chip, focus rings and fields.
- Now neutral: `STAMP.recommendation` (graphite), the "Arréglalo antes de comprar" verdict (a graphite outline), check warnings, the tray, info notes (SheLLM, plan sheet, price note, kind redo, "Para el taller"), decorative icons, the tray count. The bell with pending notices is rust.
- Kept amber on purpose: the expert's pencil (authorship), Home's and Analyzing's drawings (they stay as the app draws them), and the 3D highlights (on the keep list).
- Kit 0.3.0 (`ui-kit.CHANGELOG.md`): `Stamp/Recommendation` graphite, stamps 12 px, `Field` in, `TakePhoto` out; the three `.pen` files re-vendored.

## 7. Studio target fidelity

**Status:** landed (#123–#128, #131, #132) — `UI-2`, `UI-11`, `UI-12`, `UI-14`, `UI-16`

- Landed: "Nuevo diseño" as a ghost (#123); History as a flat list with "Volver a esta" visible (#124); Notices without a bordered button inside a way (#125); the tray on one line and a pending proposal inside the expert's message (#126); the cost first in Materials, lists with dividers instead of cards, the piece's edit form under its title (#127); proposal notices grouped (#128).
- Icons stay as the code has them: the exports draw outline icons and a wrench because Pencil's Phosphor set has no fill weight and no hammer (`design/README.md`).
- Decided 2026-09-28 (Adrian), and where each landed:
  - K4: on a phone the header stays icons with accessible names; the rule holds for content.
  - Notices: one grammar, radio ways and "Resolver N"; `flows/studio.pen` redraws Notices / Critical that way.
  - UI-14: the suggestions hide while the tray has something; the memory bar stays (#132).
  - History: the "Bitácora" stays; "Qué cambió" is a flat line in chat and History (#132).
  - Materials: the review gate's check list and the sheet diagrams stay as the app draws them; the desktop edit fields carry mm only.
  - Hidden pieces take the status chip ahead of a proposal (#131).
- UI-2 closes in #132 (8 `rounded-2xl` left, none nested); UI-10's icon is fixed, its debug section is still open.
