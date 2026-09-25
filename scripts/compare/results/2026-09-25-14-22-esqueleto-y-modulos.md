# Comparativo de modelos: esqueleto y modulos

Commit ad61271 · prompts esqueleto@1, sistema@4+reconstruccion@6 · 2026-09-25 14:22 UTC

| Modelo | Diseños válidos | Segundos (prom.) | Tokens de salida (prom.) | Medidas razonables | Viables |
|---|---|---|---|---|---|
| shellm:claude | 7/9 | 30 | 1911 | 7/7 | 4/7 |

| Modelo | Caso | Listo | s | Intentos | Reparaciones | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Críticos | Veredicto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| shellm:claude | librero | sí | 10 | 0 | 0 | 0 | 11 | 26 | 1800 × 800 × 300 | sí | 1 (R4_VUELCO) | con-cambios |
| shellm:claude | cama-cajones | no: SheLLM cortó la petición a los 17 s: el modelo tardó más que su límite de tiempo | 17 | 1 | 0 | — | 0 | 0 | — | — | 0 | — |
| shellm:claude | buro | sí | 18 | 0 | 0 | 0 | 13 | 25 | 550 × 450 × 400 | sí | 0 | viable |
| shellm:claude | cama | no: SheLLM cortó la petición a los 91 s: el modelo tardó más que su límite de tiempo | 91 | 1 | 0 | — | 0 | 0 | — | — | 0 | — |
| shellm:claude | alacena | sí | 12 | 0 | 0 | 0 | 10 | 15 | 700 × 800 × 300 | sí | 0 | viable |
| shellm:claude | escritorio | sí | 88 | 1 | 0 | 9853 | 7 | 12 | 750 × 1200 × 600 | sí | 2 (R1_FLECHA R5_ESCUADRADO) | no-viable |
| shellm:claude | zapatera | sí | 26 | 0 | 0 | 0 | 15 | 38 | 900 × 800 × 350 | sí | 0 | viable |
| shellm:claude | mueble-tv | sí | 16 | 0 | 0 | 0 | 13 | 25 | 450 × 1600 × 400 | sí | 1 (R1_FLECHA) | con-cambios |
| shellm:claude | mesa-centro | sí | 36 | 1 | 4 | 3526 | 4 | 0 | 400 × 1100 × 550 | sí | 0 | viable |
