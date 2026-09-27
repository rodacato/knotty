# Code changes — design decisions pending in `src/ui/`

> The **work order** for landing design decisions in code. The `UI-<n>` entry in `DECISIONS.md` holds the finding and the decision; this tracks execution. The kit mirrors the **current** code until each change lands, then bumps.

**Rule:** a consolidation cites **measured** usage (grep counts with a date), not impressions.

| Layer / pattern | Real consumers (measured 2026-09-27) | Verdict |
|---|---|---|
| Text inputs, selects and textareas styled by hand | 27 `input`/`select`/`textarea` in 12 files, of which 20 are text fields — the rest are 2 hidden file inputs, a radio, 2 checkboxes and the tape in `MeasureField` | ✅ `src/ui/system/Field.tsx` (K7); kit with 0.3.0 |
| Status pills over the 3D | 3 in `src/ui/studio/Studio.tsx` | One `StatusChip` with priority, then kit |
| Proposal actions | 2 renderings of one proposal (`Chat.tsx`, `NoticePanel.tsx`) | One component, then kit |
| `Segmented` | 3 files, all in `src/ui/studio/` | Feature-local: stays in the flow, not the kit |
| Uppercase labels | 6 left on 2026-09-27 (K1 removed the rest; the `Stamp` stays) | ✅ Sentence case with K5 |

## 1. `Field` — one input for the whole app

**Status:** landed (K7, with K5) · kit pending: `Field` enters `ui-kit.lib.pen` with the 0.3.0 bump (§6), so the flows re-vendor once

- Landed: `Field` (label on top, then help or error), `Input` (`unit` and `end` inside the box), `Select` (own caret) and `TextArea`, in `src/ui/system/Field.tsx`. The 20 text fields use them; `NumberField` is gone.
- Every control is 16 px: below that, iOS Safari zooms the page on focus. Labeled fields are 44 px tall (`min-h-11`); the inline ones inside a row (cabinet percentages, price) are 32 px.
- Out on purpose: `MeasureField` in Capture is the tape, not a form field.

## 2. `StatusChip` — one status over the 3D

**Status:** landed (K2, K3) — `UI-5`, and `UI-18` with K1

- Landed: `src/ui/studio/StatusChip.tsx`; the piece opens in the panel (`src/ui/studio/PieceSheet.tsx`, `PieceCard` removed); the view bar is one row. The as-is captures of `studio.pen` are retaken in one batch when more target screens land.

- Replace the three pills in `Studio.tsx` with one chip: one state at a time by priority (problems > proposal/preview > old version > to confirm), plus the resolved state ("Resuelto: …") and the expert working in the background (`UI-15`).

## 3. Notice ways and proposal actions

**Status:** landed (K1) — `UI-3`, `UI-6`, `UI-15` step 1, `UI-17`, `UI-18` · pending: "Aplicar con un apoyo al centro" inside a proposal, which needs fixes computed on the proposal's design, not the current one

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

**Status:** decided · pending in code — `UI-1`

- Measured 2026-09-27: amber in 23 files, 100 uses (without the debug panel).
- Keep amber for selection and focus: the active tab underline, the selected piece, the tape-measure handle, focus rings.
- `Stamp` recommendation → `graphite` (`src/ui/system/components.tsx`, `STAMP.recommendation`).
- Verdict "Arréglalo antes de comprar" → neutral (`src/ui/studio/Verdict.tsx`, `VERDICTS['needs-changes']`), and every other amber use that is neither selection nor focus goes neutral.
- Then bump the kit to 0.3.0: `Stamp/Recommendation` and the verdict colors change value, so every flow re-vendors.
