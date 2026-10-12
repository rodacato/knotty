# Materials and the printable guide

Materials keeps the estimated cost prominent, followed by a compact review notice. The existing dark shell, light drawing studio, fonts, tokens and guide remain the same.

A current review opens a three-stage accordion, with one stage open at a time:

1. **Review decisions:** one expanded item, a remaining-decision count, source/priority explanations, and the existing expert request or consultation action. Arithmetic checks and workshop advice remain supporting details.
2. **Confirm materials:** plywood and layouts, hardware, finish, wall choice, and numbered cuts. The layouts show existing offcuts; they do not guarantee that a leftover can replace a recommended part.
3. **Get the guide:** the existing printable guide is the primary action; copying the lumberyard message is secondary. Pending designs explicitly open a guide with pending warnings.

Advancing does not certify the design or require opening every disclosure. Unknown wall, missing prices and uncorrected problems remain visible in the exports.

## Decisions and validity

A purchase review optionally stores `choices`, scoped to that review. Old format-9 sessions load without this field. Optional improvements can be left unchanged; required changes require explicit risk confirmation. Both remain collapsed, reopenable and reversible. Neither changes the technical verdict or checks.

An expert request is recorded before opening Conversation. It means a request was sent, not that a change was applied. Undoing that record does not cancel a sent request. A new review starts with no choices; stale reviews and unknown item ids reject choices. When expert problems exist, aggregated structural recommendations stay in the arithmetic details rather than becoming another decision card; failed checks remain decisions.

The guide and copied message include the original warnings and recorded choices. Risk acknowledgement never turns an unsafe or impossible design into a viable one. Non-viable lists retain the existing explicit opt-in.

## Review lifecycle

Each run captures the current version and `reviewSignature`. Only its controller can update progress or save a result. Cancellation clears the UI immediately, aborts the transport and ignores late responses. Relevant edits cancel the run with an explanation; no automatic retry spends another expert request.

The signature excludes finishes, wall choice, edge profiles, prices and purchase-review choices. Geometry, requirements, accepted structural findings, sheet dimensions and cutting settings invalidate it. Editing a draft does not replace the actual design until applied.

Progress stages are factual: local checks, waiting for the expert, then receiving its response. There is no estimated percentage or completion time.

## Guide and verification

The guide opens at `#takeaway`. Printing calls `window.print()`, allowing the browser to print or save as PDF. The suggested filename and document header include the saved ficha code/version, current design version, mode and date. An unknown origin stays unknown; a matching furniture name does not establish provenance.

Three modes use the same resolved design: the complete guide, the lumberyard packet (cuts, purchase, sheet layout and machining), and assembly (piece identification, tools, machining, exploded views, connections, installation and phases). Cabinet, table and bed modules provide phases only while the design still matches its plan; modules without assembly phases say so. The numbered drawings show one visible example per cut-list group; individual piece IDs remain in the tables.

Machining uses actual cuts, profiles and holes with local coordinates, thickness and depth. Hardware quantities and diagrams are not drilling templates: actual hardware specifications and test cuts are still required. Letter pages carry source/version/date and page numbers; internal links keep their PDF destinations without changing the application's hash route.

Construction checks also run against saved geometry. Sliding leaves require extra mounting lift and wood between adjacent tracks; removable shelves keep side clearance while their pins remain connected for structure, purchasing and visualization. These nominal allowances live in `src/domain/assumptions.ts` and are explicitly marked as Knotty assumptions. A failing old design offers an explicit recalculation into a new version, preserving its origin. Diverged piece edits require manual correction.

Installation distinguishes a wall cabinet hanging from the wall from furniture standing on legs or a kick with anti-tip restraint. The PDF does not infer wall material or validate a mounting system from an individual anchor's load rating.

Run `npm test -- src/ui/store/review.test.ts src/ui/studio/Materials.test.ts` for lifecycle races, saved/reversible decisions, stale-review rejection, action order and preserved export warnings. Run `npm run build`, `npm run lint` and the full `npm test` suite before review.

In the browser, use catalog bases or the existing furniture fixtures with an absent/synthetic provider and invented review opinions. Block non-GET requests and external connections for screenshot capture. Check one open stage/item, confirmation, undo, reload, requested-versus-applied status, material changes, final guide/copy actions, and document/panel bounds on desktop and at 320px. Advancing and undoing move focus to a visible summary.

For workshop changes, run `npm test`, `npm run lint`, `npm run build` and `npm run probe -- --all`. Export all three cabinet modes and complete bed, bookcase and table guides; render every PDF page and inspect diagrams, tables, page breaks and margins in both application themes. Check mobile navigation, restoration of the document title, and recalculation of a saved zero-clearance sliding leaf. These checks validate the model and document; real material, joints and installation still need a dry assembly and physical validation.

The clipboard live region needs a positioned containing block so it cannot enlarge the Studio document. Finish precautions and unknown-wall notices must survive collapsed options and exports.
