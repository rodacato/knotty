# Reference fichas

A reference ficha is a piece of furniture that Knotty knows how to build, written as a file and checked by the engine. It serves as a starting point on the home screen, as a case for the bench and as a regression: if the engine changes and a ficha no longer comes out the same, you see it.

## What a ficha file is

It lives in `src/adapters/references/<code>.v<N>.json` (for example `kc-apa-01.v1.json`). The number goes in the name, as with the prompts: only the current version exists and the rest is in git.

| Field | What it is for |
|---|---|
| `code` | Given by the `--adopt`/`--diff` argument, not by the candidate file. `KC-…`: a reference product checked against its photos. `GN-…`: a generic starting point, with no product behind it |
| `id`, `name`, `notes` | For the person: the id in English, the name and the notes in Spanish. Required in a new reference |
| `rooms` | The rooms where it goes, one or several of `bedroom`, `living`, `dining`, `office`, `kitchen`, `entry` and `workshop` (`ROOMS` in `src/domain/furniture/references.ts`). Required: this way the lab finds it by room without anyone touching code, and a ficha with no room is not adopted. The home screen does not use them; it has `home` |
| `kind`, `finish` | Optional: which piece of furniture it is (`DesignKind`, `src/domain/design/kind.ts`) and its finish (`src/domain/materials/finishes.ts`). A cabinet does not say by itself whether it is a sideboard or a bookcase |
| `plan` | The ficha the engine understands (`FurniturePlan`): dimensions, base, construction, columns and cells |
| `design` | Instead of `plan`, for a piece of furniture that no module builds: the complete design, piece by piece (`Design`). It carries one of the two, never both. It opens from «Fichas» in the lab and `probe` checks it the same way; it does not appear on the home screen and has no fields to edit, because there is no plan: it is changed piece by piece or with the expert |
| `home` | Optional. With it, it is a card on the home screen: `order`, `category` and, if it is `featured`, also in «Destacados» (up to 11, so that the last cell is «Diseña tu propio mueble»). Without it, it is still a reference for the tests. A home base has the same name in the ficha and in its `plan`, and no two share a name; the featured ones go first in `order` |
| `expect` | What the engine makes of the plan: valid, pieces, findings, sheets and hardware. `probe` writes it; a candidate does not carry it |
| `support`, `difficulty`, `features`, `adaptations`, `gaps` | A `KC-…` states all of them: how it is supported (`exact`, `adapted`, `unsupported`), the difficulty from 1 to 4, which features it has and which ones Knotty cannot draw (labels from the closed list `FEATURES`) and what was adapted (text) |

`format` (always 1) is added by `probe`. **`features`** says what the piece of furniture has, from the closed list `FEATURES` (`src/domain/furniture/references.ts`), whether Knotty draws it or not; **`gaps`** says, with the same labels, what Knotty cannot draw of it: it is always a subset of `features` (a label in `gaps` that is not in `features` is rejected). Counting gaps across furniture is counting labels. If what you see fits none of them, you do not invent one: you note it in the answer as a proposed label and add it to `FEATURES` on purpose. `no-back` applies to any part without a back panel, not only to the whole piece of furniture. The `adaptations` are free text. `support` is `exact` only if there are no adaptations or gaps; as soon as there is one, `adapted`.

Five labels that are worth not confusing:
- `splayed-legs`: legs that spread out or narrow, loose or in an A shape. `angled-cut` is kept for sides, panels and ends cut at an angle: legs never go there. Those that only narrow are already drawn in the cabinet, the table and the bed (`legStyle: "tapered"`), and those that spread out, in the cabinet and the table (`legStyle: "splayed"`: toward the front and toward the back, and they thin out at the foot; on a table only where the top overhangs the legs by 20 mm or more, so a desk opens its front legs alone); then the label goes in `features` and not in `gaps`. It stays in `gaps` when the piece has V- or A-shaped legs, stretchers between legs or one leg per body, in a table whose legs the plan cannot open, and in beds with spread legs.
- `curved-cut`: any curve sawn in a board. The rounded corners of a table or desk top are already drawn (`corners: "rounded"`, always to 40 mm and only where the top overhangs what stands under it); when that is the only curve and every corner gets it, the label goes in `features` and not in `gaps`. It stays in `gaps` for a round or oval top, a rounded corner the plan leaves square (the back of a desk, a flush top), a curved side or apron, and any other piece of furniture.
- `raised-sides`: the sides rise above the top. They are boxes; it is not an angled cut.
- `slatted-fronts`: fronts made of glued strips. `routed-fronts` is a router groove on a smooth face.
- `slatted-base`: the base of a bed made of slats instead of a continuous board. It is already drawn in the bed (`platform: "slats"`), so it goes in `features` and not in `gaps`.

- `finger-joints`: the piece of furniture has visible finger corners (*box joint*). In a cabinet it is drawn with `construction.drawerCorners: "fingers"` and, if they are not the usual 5, `drawerFingers` (from 3 to 21 per corner): it applies to all the drawers of the piece and is seen from behind or with the drawer out, because the front covers it. The corners of the top with the sides, as in KC-BUR-05, are drawn with `construction.top: "fingers"` (the same `drawerFingers`): the sides rise to the upper face and are visible from the front.

`sliding-doors` is already drawn in the cabinet (`construction.doors: "sliding"`, for all its doors): the leaves run in grooves, without hinges. A piece that mixes sliding and hinged doors is drawn too: the cell that goes the other way says it in `own.doors` (`"sliding"` where the furniture's doors swing, `"inset"` where they slide). It is still a gap if the hinged doors beside sliding ones are overlay, or if they run on a purchased rail. A one-leaf door that hangs on a side of its own says it in `own.hinges` (`"left"` or `"right"`).

`routed-fronts` is also drawn in the cabinet (`construction.fronts: "grooved"`), with vertical grooves; if the front is made of glued strips and not routed, it is still a gap. `notch-pulls` is already drawn in the cabinet (`construction.pulls: "notch"`), so a ficha that uses it puts it in `features` and not in `gaps`; with hardware it is `"handle"`, which adds one handle per door leaf and drawer front to the shopping list.

The file is always written the same way (`probe` does it), so that a change moves few lines. **The reference photos are not stored in the repo.**

## Commands

```bash
npm run probe -- kc-apa-01                          # one ficha, in detail
npm run probe -- --all                              # all of them, one line each
npm run probe -- --diff kc-apa-01 candidate.json    # what a candidate would change; writes nothing
npm run probe -- --adopt kc-apa-01 candidate.json   # makes it the next version (or version 1 of a new one)
npm run probe -- --update kc-apa-01                 # rewrites only its `expect`
npm run probe -- --explain kc-apa-01                # the ficha in words, generated from its plan and its metadata
npm run probe -- --explain kc-apa-01 candidate.json # the same for a candidate, as it would be once adopted
```

`npm test` runs the same comparison as `--all`: an engine change that moves a purchase or adds a finding fails with the exact line.

## Improve a ficha in the lab

The spotlight (`Ctrl+K`) lists all the fichas: open one, ask the expert for changes or move its fields, and with the debug access (Konami, `Ctrl+Shift+D`, settings or `?debug`) «Exportar ficha» downloads a candidate file. The lab does not write to the repository: the file is reviewed with `--diff` and adopted with `--adopt`, like any candidate. It only exports what fits in a plan; if loose pieces were changed after the plan, it says so and does not export (those changes are asked for again in the ficha's fields).

## 1. From an idea or some photos to a ficha

1. **Look at the whole piece of furniture.** For each photo, not only the general one: hinges, shelves behind the doors, how the drawers open, the base, the handles. Write down, from bottom to top:
   - rows and columns, and what is in each opening (door, drawer, open, closed);
   - inset or overlay doors and drawers, how many leaves, shelves behind;
   - top between the sides or on top; back panel yes or no;
   - base: kick, direct, legs or wheels;
   - what Knotty does not model yet (angled cuts, curves, glass, an opening without a back panel…).

   Three things the plan does in a certain way and that are worth knowing before writing it:
   - Each column of the grid has a single width from top to bottom, and distributes the height of its cells on its own, as fractions of that column. If the levels put their dividers in different places, it is expressed with split cells (below), not with `gaps`.
   - A column can **not reach the floor or the ceiling**: its first or last cell is `content: "void"` and nothing is built there (boxes that hang at different heights under a top, staggered tops). It goes only at one end of the column, and at least one column reaches the floor and another the ceiling. The expert does not write it: only a ficha or the editor.
   - A cell can be **split into columns**: instead of content it carries `columns`, each with its `width` and its `cells`. This is how different dividers per level are expressed (a single column whose cells are split levels) and the drawer that crosses columns (an unsplit cell below a split one). It carries at least two columns and no void inside. The expert does not write it either.
   - With sliding doors, a `door` cell can be **split into columns**: its leaves (`doors`, 1 or 2) close the whole opening and the columns stay behind, set back, with only open openings and their shelves. It is the half-depth divider behind two sliding doors, or the niche with a shelf next to a single one. The expert does not write it either.
   - A cell can be a **chest** (`content: "chest"`): closed at the front and open at the top, with the hinged lid as the floor of the opening above, which has to be an unsplit open opening; or, if it is the last opening of **all** the columns, with the top of the piece of furniture as the lid (GN-BAU-01). `shelves: 1` puts the bottom at half height; `0` leaves it all the way down. It adds one piano hinge per lid and one or two lid stays, depending on how much it weighs. The expert does not write it either.
   - A cell can carry **its own back panel or none**: `"back": true` or `false`, against what `construction.back` says (checkerboard back panels, a niche open to the wall). It goes only on a cell with something in it, not on a void or a split one, and each consecutive run of cells with a back panel is one board. The expert does not write it either.
   - An open cell or one behind doors can carry a **closet rod** (`"rod": true`) in place of its shelves: a tube from wall to wall under the top of the cell, bought and cut to length, with a flange at each end (GN-CLO-01). Two cells with a rod, one over the other, are a double hang. The expert does not write it either.
   - In a base with legs, `dimensions.height` includes the legs.
   - A tall piece of furniture with drawers is anchored to the wall (`wallMounted: true`), and one with doors too when it is wide and shallow; otherwise `--diff` flags it with a critical finding of tipping (`R4_TIPPING`).
2. **Choose the module** (`src/domain/furniture/modules/`: cabinet, bed, table, shoe rack). If none fits, you already know there is support to add (section 2); and if it is a one-off piece of furniture that does not justify a module (the tabletop bench `GN-TAL-02`), the candidate carries `design` instead of `plan`.
3. **Write the candidate.** A JSON file with the `plan` and, for a new reference, the rest of what a ficha states. The app's expert can also propose the plan from photos and a description: with debug access, «Exportar ficha» downloads it as a candidate from the Studio. The result is a draft that a person reviews, not a ficha.

   ```json
   {
     "id": "night-table",
     "rooms": ["bedroom"],
     "name": "Buró",
     "notes": "Buró con un cajón arriba y un hueco abierto abajo.",
     "plan": {
       "kind": "cabinet", "name": "Buró", "material": "T18", "base": "floor", "wallMounted": false,
       "dimensions": { "width": 450, "height": 500, "depth": 350 },
       "construction": { "doors": "overlay", "drawerFronts": "inset", "top": "between", "back": "nailed", "shelves": "movable" },
       "columns": [{ "width": 1, "cells": [
         { "height": 0.6, "content": "open", "shelves": 0, "doors": null },
         { "height": 0.4, "content": "drawer", "shelves": null, "doors": null }
       ] }]
     }
   }
   ```
4. **See what it would do** with `--diff <code> candidate.json`. It says what changes and, always, the engine's verdict (valid or not, pieces and findings), also for a new reference; a critical finding comes out marked. If the engine cannot build it, it says why and it is not adopted. To read it before adopting, `--explain <code> candidate.json` says it in words, and `--diff` marks the lines that change with respect to the current version. There is not yet a 3D preview of a candidate: it is seen in the app after adopting it, with `home`.
5. **Adopt it** with `--adopt`. A new `KC-…` must also carry its support, difficulty, features, adaptations and gaps. The difficulty starts from that of the type of furniture in `docs/carpinteria/muebles-y-medidas.md` (§1); when that range spans two levels (for example 2–3), the higher one is taken if the design has inset fronts, legs or many drawers. It is a provisional criterion.
6. **Check it** with `probe -- <code>` and open it in the app (`home` puts it on the home screen).

On an existing reference, the candidate can be just the `plan`: the rest is inherited, and if something changed the version goes up.

## 2. When Knotty cannot build it: add support

A ficha that comes out invalid, or that has to be adapted, points to a gap. Before touching code, **count** in how many reference pieces of furniture it appears: a feature of a single piece of furniture is noted in `gaps` and not built. What gets built is what changes the **shopping list** or **safety**, or what repeats across several; what is only appearance is gathered later.

How the legs were added to the cabinet is the typical walkthrough:

1. **The plan** (`modules/<module>.ts`): the new option in the schema, with its `.describe` (it is what the expert reads), and its labels for the ficha sheet.
2. **The builder** (same file, and `modules/common.ts` for what they share): the pieces and joints that the option adds. Knotty builds every piece, so they cannot overlap.
3. **The numeric assumptions** (`domain/assumptions.ts`): each figure with its source.
4. **The checks** (`domain/checks/structure/`): if an existing rule reads what changed, its version goes up; if a new one is needed, it goes in the registry.
5. **The expert's guide** (`adapters/llm/prompts/modules/<module>.vN.md`, written by hand for cabinet, bed and table): its version and its budget in `prompts.test.ts` go up. Since it changes what the expert sees, you have to run `npm run compare` by hand (it costs tokens) and compare with the last report.
6. **Tests** for the module (`<module>.test.ts`): the option, its pieces and what must not happen.
7. **The fichas.** `probe -- --all` says which ones moved. The expected differences are accepted with `--update`; an unexpected one is a bug. Then, adopt the candidate that was adapted before, now without the adaptation, and remove it from `gaps`.
8. **A decision or an invariant in `docs/PROPUESTA.md`**, only if there is a why that the code does not say; the delivery diary goes in the PR body.

The detail of what to run depending on what you touched is in [CONTRIBUTING.md](../CONTRIBUTING.md).
