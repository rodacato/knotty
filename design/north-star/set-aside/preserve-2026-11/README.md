# Knotty visual north star

Adrian selected **Option 3, One Step at a Time**, from the Studio exploration focused on how people edit. [Studio reference](studio.png)

## Visual decisions

- Use one dark workshop surface for the header, controls, and marketing copy. Set the 3D scene on a single sheet of warm paper with a faint decorative grid.
- Keep the full three-quarter view of the sideboard visible in its natural plywood color. Let the drawing take about two thirds of the Studio workspace.
- Draw three fine graphite dimension lines with short end ticks. Place horizontal JetBrains Mono labels by their axes: height at the left, width below the front, and depth below the right side. Show millimeters and centimeters together.
- Set the Knotty wordmark and main titles in Fraunces, control labels and prose in Inter, and dimensions, step numbers, and the catalog code in JetBrains Mono.
- Present the Studio options as a numbered sequence with fine separators. Give each collapsed step one line for its name and current value, and expand just the active step to show its controls.
- Use amber on the active step number and underline, and repeat it as a thin outline on the corresponding part of the 3D model. In the reference, the open «Base» step and the legs share this treatment. The expanded row and its chevron also indicate the active state.
- Give the primary action a solid amber fill with dark text. Keep secondary actions quiet and preserve 44 px minimum control targets.

## Directions set aside

The reasons and reconsideration criteria below are design trade-offs inferred from the chosen direction.

| Direction | What it tested | Why it lost | What would bring it back |
| --- | --- | --- | --- |
| Option 1, Drawing as Editor | Editing overall dimensions in the paper annotations while the panel holds the other options. | It makes sizing immediate but splits the editing path between the drawing and the panel. The selected direction keeps the sequence and current controls together. | Observed sizing sessions show that people first reach for the drawing and can find, focus, and edit the dimension fields reliably with keyboard and pointer. |
| Option 2, Results in View | Keeping the material estimate, cut piece count, and sheet count alongside the drawing while dimensions are edited in the panel. | The material summary takes the strongest position and pushes the active edit below it. The selected direction gives that space to the current decision. | Observed editing sessions show that people repeatedly switch to Materials to decide whether to keep a change, and the adjacent summary helps them make that decision. |

Responsive layouts, step transitions and keyboard behavior, and the placement of Materials during editing remain open.

## Sitio

- The [hero](hero.png) sells the result. Show the full sideboard and three large JetBrains Mono dimension labels on warm paper, with the Studio interface out of view.
- [«Cómo funciona»](how-it-works.png) shows the numbered Studio sequence at a readable size, with «5 Base» open and its controls visible alongside the drawing.
- In product imagery, reserve amber for a visible active step and the part it edits. Pair the «5 Base» marker with the outline around the legs. Use natural plywood edges in the hero and retain the amber marketing button.
