# Comparativo de modelos: banco completo con exhibidor

Commit a30b859 · prompts skeleton@9, system@9+reconstruction@11 · 2026-09-25 22:16 UTC

| Modelo | Diseños válidos | Segundos (prom.) | Tokens de salida (prom.) | Medidas razonables | Viables |
|---|---|---|---|---|---|
| shellm:claude | 9/10 | 45 | 4381 | 9/9 | 8/9 |

| Modelo | Caso | Listo | Camino | s | Intentos | Reparaciones | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Críticos | Veredicto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| shellm:claude | bookcase | no: Error 502 del proveedor: <!DOCTYPE html>
<!--[if lt IE 7]> <html class="no-js ie | — | 1 | 2 | 0 | — | 0 | 0 | — | — | 0 | — |
| shellm:claude | bed-drawers | sí | ficha | 38 | 1 | 0 | 1990 | 40 | 81 | 1150 × 2188 × 1010 | sí | 0 | viable |
| shellm:claude | nightstand | sí | ficha | 22 | 1 | 0 | 773 | 13 | 24 | 550 × 450 × 400 | sí | 0 | viable |
| shellm:claude | bed | sí | ficha | 12 | 1 | 0 | 857 | 12 | 29 | 1000 × 1956 × 1010 | sí | 0 | viable |
| shellm:claude | wall-cabinet | sí | ficha | 24 | 1 | 0 | 2219 | 11 | 19 | 700 × 800 × 300 | sí | 0 | viable |
| shellm:claude | desk | sí | ficha | 20 | 1 | 0 | 2060 | 6 | 11 | 750 × 1200 × 600 | sí | 0 | viable |
| shellm:claude | shoe-cabinet | sí | ficha | 28 | 1 | 0 | 3568 | 18 | 47 | 900 × 800 × 350 | sí | 0 | viable |
| shellm:claude | tv-stand | sí | ficha | 15 | 1 | 0 | 1086 | 15 | 31 | 450 × 1600 × 400 | sí | 0 | viable |
| shellm:claude | coffee-table | sí | ficha | 8 | 1 | 0 | 692 | 8 | 14 | 420 × 1000 × 550 | sí | 0 | viable |
| shellm:claude | plant-stand | sí | piezas | 237 | 3 (E_FLOATING) | 0 | 26181 | 11 | 14 | 750 × 800 × 750 | sí | 1 (R5_RACKING) | needs-changes |
