# Comparativo de modelos: fichas de cama y mesa

Commit 8b9ce5b · prompts esqueleto@4, sistema@4+reconstruccion@6 · 2026-09-25 18:29 UTC

| Modelo | Diseños válidos | Segundos (prom.) | Tokens de salida (prom.) | Medidas razonables | Viables |
|---|---|---|---|---|---|
| shellm:claude | 4/4 | 29 | 1223 | 3/4 | 3/4 |

| Modelo | Caso | Listo | s | Intentos | Reparaciones | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Críticos | Veredicto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| shellm:claude | cama-cajones | sí | 9 | 1 | 0 | 706 | 59 | 112 | 1100 × 2188 × 1010 | NO | 0 | viable |
| shellm:claude | cama | sí | 78 | 2 | 0 | — | 6 | 9 | 900 × 1000 × 2000 | sí | 1 (R10_USO) | con-cambios |
| shellm:claude | escritorio | sí | 23 | 1 | 0 | 2248 | 6 | 11 | 750 × 1200 × 600 | sí | 0 | viable |
| shellm:claude | mesa-centro | sí | 8 | 1 | 0 | 714 | 8 | 14 | 420 × 1000 × 550 | sí | 0 | viable |
