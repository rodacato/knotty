# Delivery

How a change gets from an idea to a merged PR, and where each record lives. This is the process; what to build and where it goes in the code, by what you want to achieve, is in [Workflows](workflows.md), and how to verify a change is in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Where each thing lives

| What | Where |
|---|---|
| Planned work and its state | The private GitHub Project #12 (owner `rodacato`) |
| Decisions, invariants and open questions | [docs/PROPUESTA.md](PROPUESTA.md), as `D<n>` entries (in Spanish) |
| Design findings | [design/DECISIONS.md](../design/DECISIONS.md), as `UI-<n>` entries |
| The diary of a delivery | Its PR body |

Markdown never tracks the state of work: no TODO lists, no «pending» sections. That is the board's job.

## The board

| Field | Values |
|---|---|
| Status | `Draft` → `Researching` → `Ready` → `In progress` → `Blocked` → `Done` |
| Kind | `Feature`, `Bug`, `Debt`, `Decision` |
| Priority | `P1`, `P2`, `P3` |
| Area | `design`, `materials`, `checks`, `furniture`, `editing`, `session` (the groups of `src/domain/`), `expert`, `ui`, `docs`, `cross-cutting` |

A card is born as a **draft**: on the board only, with no number and nothing public. A draft is moved to `Done` by hand; nothing closes it.

## Two lanes to a PR

### Planned work

Features, ideas, and debt someone decided to pay.

1. A draft card, `Status: Draft`, with its Kind, Priority and Area.
2. `Researching` if the problem is still open; `Ready` when what to do is known.
3. When work starts, **convert the card to an issue** («Convert to issue» on the card) and move it to `In progress`. Never open a fresh issue for it: that leaves a duplicate.
4. The PR says `Closes #<n>`; merging it closes the issue and the card goes to `Done`.
5. If the work decides something new, the decision lands in the same PR (see below).

### Maintenance

A fix, chore, docs, CI change or dependency bump found while working can go straight to a PR, with no card and no issue. The PR body is the record: what changed, why, and how it was verified. Say there is no issue to close, as #413 did.

A maintenance PR that changes behaviour the person would notice was planned work: it gets a card, and goes through the first lane.

### Security

A security item stays a draft card and is **never converted to an issue**: an issue would publish the weakness. Reports come through private vulnerability reporting ([SECURITY.md](../SECURITY.md)).

## The PR body

In English, like the title (D33). It says what changed and why, in prose or under `## Why` / `## What`, and **how it was verified**, by the levels in [CONTRIBUTING.md](../CONTRIBUTING.md) (`npm run lint`, `npm run typecheck` and `npm test` always). A planned PR carries `Closes #<n>`; one that carries a decision or a design finding names it (`D78`, `UI-91`).

## Decisions: `D<n>` in PROPUESTA.md

The «Decisiones» table in [docs/PROPUESTA.md](PROPUESTA.md) is the decision record; there is no `docs/adr/`. Each row is `| D<n> | <decisión, the gist in bold> | <motivo> |`, in Spanish. A decision lands in the PR that carries it.

- **New decision:** the next free id, as a new row at the end of the table. It closes with `Decidido el <AAAA-MM-DD> (#<PR>)`, as D50 does.
- **Refinement** (the decision holds, a detail changes): the same id. Append a dated note to its Decisión cell: `Ajustada el <AAAA-MM-DD> (#<PR>): <qué cambió>`.
- **Reversal or replacement:** a new id. The old row is struck through and points forward, as D1 does: `~~<texto>~~ **Reemplazada por D<n>**: <por qué>`; its Motivo says what the new one separates or fixes.
- **Replaced in part:** the old row keeps its text and gains `**Reemplazada en parte por D<n>**: <qué parte>`; the new row says `reemplaza en parte D<m>` next to its date.
- **Fulfilled:** a decision that described a future step gets `(cumplida: D<n>)`, as D8 does.

An entry is never deleted or renumbered, and the rest of PROPUESTA.md is not rewritten to fit: only these notes change an old row. A screen-level design choice is a `UI-<n>` in [design/DECISIONS.md](../design/DECISIONS.md), under that file's own rules; it gets a `D<n>` too when it changes the product beyond the screen.
