# Comparativo de modelos: exhibidor con requisitos de espacio y marco rígido

Commit a30b859 · prompts system@9+reconstruction@11 · 2026-09-25 22:09 UTC

| Modelo | Diseños válidos | Segundos (prom.) | Tokens de salida (prom.) | Medidas razonables | Viables |
|---|---|---|---|---|---|
| shellm:claude | 2/3 | 141 | 15187 | 2/2 | 0/2 |

| Modelo | Caso | Listo | Camino | s | Intentos | Reparaciones | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Críticos | Veredicto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| shellm:claude | plant-stand | sí | piezas | 146 | 3 (E_FLOATING) | 0 | 16007 | 9 | 6 | 750 × 800 × 750 | sí | 1 (R5_RACKING) | needs-changes |
| shellm:claude | plant-stand | sí | piezas | 137 | 2 | 0 | 14367 | 9 | 6 | 750 × 800 × 750 | sí | 1 (R5_RACKING) | needs-changes |
| shellm:claude | plant-stand | no: SheLLM cortó la petición a los 36 s: el modelo tardó más que su límite de tiempo | — | 48 | 2 | 0 | — | 0 | 0 | — | — | 0 | — |
