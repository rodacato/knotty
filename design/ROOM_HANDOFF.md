# Room design handoff

Implemented directly at Adrian's request on 2026-10-12. No Pencil files were changed. **UI-86** records the furniture-first direction; [the feature contract](../docs/room-discovery.md) defines behavior and limits. The code and current captures are the source for the later Pencil update.

## Screens to draw

Draw both 390 × 844 and 1440 × 900, with equal weight and the current kit.

| Step | Surface / state | Source |
|---|---|---|
| Entry | Ficha adjustment with **Ver en tu espacio** | `src/ui/capture/AdjustBase.tsx` |
| Entry | Current Studio with **Ver en tu espacio** / **Volver a mi espacio** | `src/ui/studio/Studio.tsx`, `RoomLauncher.tsx` |
| Discovery | Example room in 3D; **Combinar** and suggested companions | `src/ui/room/Room.tsx` |
| Discovery | All fichas, search, room filter and no matching results | `Room.tsx`, `sources.ts` |
| Placement | 2D plan with selection, room measures, door sweep and window marks | `RoomPlan.tsx` |
| Furniture | Exact wall distances, elevation, rotate/duplicate/remove, placement issues | `RoomForms.tsx`, `Room.tsx` |
| Alternatives | Replace the selected ficha while keeping its center and turn | `Room.tsx`, `store.ts` |
| Space | Room dimensions, door/window forms and occupied-space block | `RoomForms.tsx` |
| Handoff | Preserve or replace an existing Studio design | `Room.tsx`, `src/ui/spotlight/swap.ts` |
| Recovery | WebGL failure with the 2D plan available | `Room.tsx` |

Pure string variants can stay in the brief. Capture actual 3D furniture; do not draw a substitute scene in Pencil. A dedicated room flow is appropriate because this journey has multiple steps and its own temporary state.

## Contracts to preserve

- Furniture first: the room opens with the chosen furniture already placed, not an empty setup form.
- 3D is the first result; precise arranging happens in the 2D plan.
- Keep the scene visible on phones while browsing and editing. The panel scrolls internally; **Acomodar** folds the tools, and the active tool button unfolds them.
- Keyboard focus has a separate outer dashed outline, including on selected furniture in dark mode.
- Use the kit Field/Input/Select controls; invalid measures point to the announced field error.
- Visible selection survives placement conflicts. Text and numbered item buttons also identify the selection and issues.
- Touch actions remain at least 44 px. Body and provenance text use the kit's 12 px minimum.
- Forms apply explicitly; typing does not move walls or furniture.
- Reset panel scrolling when switching tools or choosing another item.
- Dimension labels reserve at least 24 px around the drawing; minimum touch targets scale with the plan.
- Scene controls sit outside the floor plan's usable area. View controls and history occupy separate rows on small phones; **Arrastra un mueble.** introduces placement.
- Wood and room materials stay physical preview colors when UI theme changes.
- Use the existing typography, color and component system. No palette or kit redesign is approved.

## Copy

All current interface copy is now in the linked source files and should be copied verbatim. Particularly: **Tu espacio con Knotty**, **Combínalo con…**, **Acomodar**, **Mi espacio**, **Aplicar colocación**, **Ajustar este mueble en el Studio**, **Muebles cerrados · Detalles en Mi espacio.** Model names, codes, versions and outside measures come from fichas.

The example dimensions are illustrative. Do not claim an average Mexican room, a measured discovery time, automatic circulation validation or construction approval.

## States not yet approved as features

Saved/shared rooms, irregular walls, generated room arrangements, multiple editable custom designs, in-room furniture resize, aggregated material lists and workshop PDFs are outside this implementation. Window swings and furniture drawer/door clearance are declared limits, not green checks.

## Review record

A fresh independent review accepted the corrected visual direction. The fixes keep the warm physical room and furniture, curated fichas and numbered selection.

| Finding | Resolution |
|---|---|
| Keyboard focus merged with selected amber border | Separate dashed outer outline, including dark mode |
| Measure errors used ad hoc controls | Kit fields, per-field messages and accessible associations |
| Dragging had no visible introduction | **Arrastra un mueble.** beside the measures |
| Disabled custom handoff had no explanation | Reference-only explanation and requirement for a previously downloaded session |
| Mobile tools left too little room to arrange | Collapsible tools, two control rows, responsive title and drawing margins |

A local browser check subsequently measured 320 px dimension bounds and warning/floor separation. Touch comfort, VoiceOver, 200% zoom and measured contrast remain unverified.

## Follow-up validation

Observe a first-time user creating a bedroom with bed/buró/bookcase, then an office and a kitchen. Measure time to a preferred combination and first Studio handoff, discovery of companions, and whether **Mi espacio** feels optional rather than mandatory. Test real touch hardware and scene performance before making a speed claim.
