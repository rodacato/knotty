# Code changes — design decisions pending in `src/ui/`

> The **work order** for landing design decisions in code. The `UI-<n>` entry in `DECISIONS.md` holds the finding and the decision; this tracks execution. The kit mirrors the **current** code until each change lands, then bumps.

**Rule:** a consolidation cites **measured** usage (grep counts with a date), not impressions.

| Layer / pattern | Real consumers (measured 2026-09-27) | Verdict |
|---|---|---|
| Text inputs, selects and textareas styled by hand | 27 elements in 12 files (`Settings`, `Keys`, `PieceEditor`, `FurniturePanel`, `PlanControls`, `Materials`, `Chat`, `TakePhoto`, `CabinetColumns`, `Capture`, `KindSelect`, `BenchPanel`) | One `Field` in `src/ui/system/`, then kit |
| Status pills over the 3D | 3 in `src/ui/studio/Studio.tsx` | One `StatusChip` with priority, then kit |
| Proposal actions | 2 renderings of one proposal (`Chat.tsx`, `NoticePanel.tsx`) | One component, then kit |
| `Segmented` | 3 files, all in `src/ui/studio/` | Feature-local: stays in the flow, not the kit |
| Uppercase tracked labels | 11 | Sentence case; nothing enters the kit |

## 1. `Field` — one input for the whole app

**Status:** proposed · pending in code

- Replace the hand-styled inputs above with one component (label, value, unit, help, error). Closes nothing by itself; it is the prerequisite for a consistent 15 px readable text (Doña Carmen, audits) and for the kit to stop approximating inputs.

## 2. `StatusChip` — one status over the 3D

**Status:** proposed · pending in code — `UI-5`, `UI-18`

- Replace the three pills in `Studio.tsx` with one chip: one state at a time by priority (problems > proposal/preview > old version > to confirm), plus the resolved state ("Resuelto: …") and the expert working in the background (`UI-15`).

## 3. Notice ways and proposal actions

**Status:** proposed · pending in code — `UI-3`, `UI-6`, `UI-15`, `UI-17`

- One component renders the ways out of a notice or a proposal: "Al instante" (⚡, primary), "A la bandeja, para el experto", "Aceptar así, bajo mi riesgo" / "Aplicar así, bajo mi riesgo" as visible secondaries. Used by `Chat.tsx` and `NoticePanel.tsx`. Several notices resolve with one "Resolver N".

## 4. Labeled photo buttons

**Status:** proposed · pending in code — `UI-19`

- `TakePhoto` compact keeps "Tomar foto" / "Galería" (`src/ui/system/TakePhoto.tsx`).

## 5. Sentence-case section labels

**Status:** proposed · pending in code — `UI-2`

- The 11 `tracking-wide text-graphite-2 uppercase` labels become sentence case.
