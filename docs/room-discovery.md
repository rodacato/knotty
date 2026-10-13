# Furniture in your space

Adrian chose **furniture first** on 2026-10-12: the room is a temporary discovery exercise that shows what someone could build with Knotty. The target is an appealing combination in 5–10 minutes, followed by choosing one piece to customize in the Studio. That duration requires observation with people; it is not a measured product claim.

## Journey

1. Open a ficha's adjustment screen or the current Studio design and choose **Ver en tu espacio**.
2. See that piece already placed in a 300 × 350 × 250 cm example room with one door and one window. These are editable illustrative dimensions, not an average Mexican home or a building standard.
3. **Combinar** offers curated companions from the catalog; search and room filters expose all fichas. Replace a ficha in place or duplicate it to explore alternatives.
4. **Acomodar** shows a top-down plan for dragging, keyboard movement and exact wall distances. **Mi espacio** edits the room, openings and simple occupied-space blocks.
5. Choose one piece and open it in the Studio. When returning, only that instance receives the updated current design; duplicates keep their previous view.

The room lives only in memory. Closing it keeps the experiment in the current tab; reloading clears it and returns to the existing saved Studio or catalog. The `#space` fragment identifies a view and contains no layout data. Back and Forward can reopen a room while its memory remains available.

## Boundaries

- A room contains immutable furniture previews and blocks, not multiple editable construction sessions.
- The Studio remains the owner of dimensions, construction, history, chat, materials and workshop PDFs.
- Opening the room does not change the active design. Choosing another Studio design reuses the existing loss guard; cancellation leaves the room and the active design intact.
- A Studio preview comes from the current version, not a draft, proposal or historical version.
- Construction validation, purchasing and PDFs belong to the chosen furniture; the room does not sum them.
- An old custom preview with no plan, custom operations, edge profiles or a stated wall remains visual context once another design becomes active. It can be resumed only from a previously downloaded Studio session; rebuilding an incomplete ficha is not offered.

## Spatial meaning

Outside dimensions come from the built design. Quarter turns swap the footprint axes. Collision uses enclosing volumes, including internal empty space, and requires overlap in both the footprint and the vertical interval; hanging cabinets can therefore be placed above floor furniture. Elevation plus furniture height is checked against the room ceiling.

An inward door checks the quarter-disk swept by its leaf, with the selected hinge end. Outward and sliding doors do not reserve an inward swing. An object touching the opening's wall plane is still checked against the opening's horizontal and vertical interval.

Windows are checked at their wall plane and actual height interval. There is no arbitrary 60 cm exclusion strip. Window opening motion, furniture doors and drawers, passage widths, appliance access and installation are not validated. The interface states that the preview shows closed furniture and points to **Mi espacio** for these limits.

Openings on the same wall are also checked for overlap at the same height; newly added openings try a free position.

Values are entered in centimeters and kept in millimeters. Room and opening forms commit on Apply, so partially typed values cannot resize the scene. Reducing the room leaves placements intact and reports affected furniture and openings.

## Implementation

- `src/ui/room/layout.ts`: deterministic spatial checks, example openings and free placement.
- `src/ui/room/store.ts`: memory-only layout, instance identity and bounded undo/redo.
- `src/ui/room/sources.ts`: real ficha provenance, curated companions and current Studio snapshots.
- `Room.tsx`, `RoomForms.tsx`, `RoomPlan.tsx`, `RoomScene.tsx`: discovery, exact placement and actual furniture geometry.
- The shared navigation slice owns only whether the room view is open; no persisted session format changes.

Wall openings are cut out of the 3D walls. The walls nearest an outside camera hide to reveal the interior. Existing PieceMesh geometry, wood finishes and edge profiles render the placed fichas; only placed furniture is resolved for the 3D view.

## Verification and remaining design work

Geometry tests cover false-positive door corners, opposite hinge ends, all four walls, outward doors, windows below/above furniture, ceiling bounds and vertical stacking. Store tests cover combinations for bedroom/office/kitchen, whole-drag undo, duplicates, blocks, opening placement, updating only the Studio-bound instance and preventing incomplete reconstruction of custom previews.

A local browser check exercised desktop and phone discovery, exact placement, invalid and partial input, undo/redo, a real Studio dimension edit, canceled handoff, Back/Forward, reload, keyboard focus, dark mode and 320 px width. The check used invented data with non-GET and external requests blocked; it also measured dimension bounds and warning/floor separation at 320 px.

The Pencil flow remains pending by Adrian's explicit instruction to implement directly. [Room design handoff](../design/ROOM_HANDOFF.md) records the screens and limits to draw later. Real-device performance, gesture comfort and the 5–10 minute discovery target remain unmeasured.
