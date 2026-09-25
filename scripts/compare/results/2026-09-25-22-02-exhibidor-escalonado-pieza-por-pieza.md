# Comparativo de modelos: exhibidor escalonado, pieza por pieza

Commit a30b859 · prompts system@8+reconstruction@11 · 2026-09-25 22:02 UTC

| Modelo | Diseños válidos | Segundos (prom.) | Tokens de salida (prom.) | Medidas razonables | Viables |
|---|---|---|---|---|---|
| shellm:claude | 3/3 | 170 | 19705 | 3/3 | 0/3 |

| Modelo | Caso | Listo | Camino | s | Intentos | Reparaciones | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Críticos | Veredicto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| shellm:claude | plant-stand | sí | piezas | 140 | 3 (E_REQUIREMENT) | 0 | 16297 | 9 | 6 | 750 × 800 × 750 | sí | 1 (R5_RACKING) | needs-changes |
| shellm:claude | plant-stand | sí | piezas | 138 | 3 (E_REQUIREMENT) | 0 | 14067 | 9 | 10 | 750 × 800 × 750 | sí | 1 (R5_RACKING) | needs-changes |
| shellm:claude | plant-stand | sí | piezas | 234 | 4 (E_OVERALL_SIZE E_FLOATING E_REQUIREMENT) | 0 | 28752 | 9 | 10 | 750 × 800 × 750 | sí | 1 (R5_RACKING) | needs-changes |
