# Comparativo de modelos: current format

Commit 74a3535 · prompts skeleton@11, system@10+reconstruction@12 · 2026-09-26 00:11 UTC

| Modelo | Diseños válidos | Segundos (prom.) | Tokens de salida (prom.) | Medidas razonables | Viables |
|---|---|---|---|---|---|
| shellm:claude | 10/10 | 31 | 3021 | 9/10 | 9/10 |

| Modelo | Caso | Listo | Camino | s | Intentos | Reparaciones | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Críticos | Veredicto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| shellm:claude | bookcase | sí | ficha | 14 | 1 | 0 | 1353 | 10 | 23 | 1800 × 800 × 300 | sí | 0 | viable |
| shellm:claude | bed-drawers | sí | ficha | 22 | 1 | 0 | 1897 | 40 | 81 | 1100 × 2238 × 1010 | NO | 0 | viable |
| shellm:claude | nightstand | sí | ficha | 9 | 1 | 0 | 779 | 13 | 25 | 550 × 450 × 400 | sí | 0 | viable |
| shellm:claude | bed | sí | ficha | 10 | 1 | 0 | 794 | 48 | 94 | 1000 × 2188 × 1010 | sí | 0 | viable |
| shellm:claude | wall-cabinet | sí | ficha | 24 | 1 | 0 | 2364 | 11 | 19 | 700 × 800 × 300 | sí | 0 | viable |
| shellm:claude | desk | sí | ficha | 24 | 1 | 0 | 2239 | 6 | 11 | 750 × 1200 × 600 | sí | 0 | viable |
| shellm:claude | shoe-cabinet | sí | ficha | 19 | 1 | 0 | 2097 | 11 | 26 | 900 × 800 × 350 | sí | 0 | viable |
| shellm:claude | tv-stand | sí | ficha | 19 | 1 | 0 | 2219 | 15 | 31 | 450 × 1600 × 400 | sí | 0 | viable |
| shellm:claude | coffee-table | sí | ficha | 11 | 1 | 0 | 760 | 8 | 14 | 420 × 1000 × 550 | sí | 0 | viable |
| shellm:claude | plant-stand | sí | piezas | 159 | 2 | 0 | 15707 | 11 | 12 | 750 × 800 × 750 | sí | 7 (R3_SCREWS R5_RACKING) | needs-changes |
