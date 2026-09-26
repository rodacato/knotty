---
id: table@2
---
# pick
- A **table or desk**: a top on two plywood sides, with aprons. It goes in `table`.

# skeleton
## The table or desk (`table`)

- `kind`: always "table".
- `use`: "dining", "coffee", "side" (side table or nightstand) or "desk".
- `name`: the name for the person ("Escritorio con cajonera", "Mesa de centro").
- `material`: {{materials}}. Usually the 18 mm one.
- `dimensions`: length (`width`), height and depth in mm. Use the given measures; if there are none, the typical ones: {{typicalTableSizes}}.
- `overhang`: how far the top sticks out past the sides; 0 if the sides reach the edge (the usual for desks and coffee tables), 30–80 for dining tables.
- `shelf`: a low shelf between the sides, on coffee and side tables. A desk does not have one.
- `pedestal`: desks only, a drawer unit on one side: `side` "none", "left" or "right" (seen from the front) and `drawers` {{pedestalDrawerCount}}; without one, "none" and 0.

The app adds the aprons and the rails under the top, and keeps the leg space clear.

# plan
- **Table or desk** (`kind` "table"): use (`use`: dining, coffee, side or desk), measures (`dimensions`: length, height and depth), how far the top overhangs (`overhang`), low shelf (`shelf`, not on a desk) and pedestal (`pedestal`: `side` none/left/right seen from the front, `drawers` {{pedestalDrawerCount}}; desks only). It goes in `table`.

# changes
use, measures, top, shelf, pedestal
