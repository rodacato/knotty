# Comparativo de modelos: formato actual

| Modelo | Diseños válidos | Segundos (prom.) | Tokens de salida (prom.) | Medidas razonables | Viables |
|---|---|---|---|---|---|
| shellm:claude | 2/9 | 143 | 14348 | 2/2 | 2/2 |

| Modelo | Caso | Listo | s | Intentos | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Críticos | Veredicto |
|---|---|---|---|---|---|---|---|---|---|---|---|
| shellm:claude | librero | no: SheLLM cortó la petición a los 126 s: el modelo tardó más que su límite de tiemp | 126 | 1 | — | 0 | 0 | — | — | 0 | — |
| shellm:claude | cama-cajones | no: SheLLM cortó la petición a los 126 s: el modelo tardó más que su límite de tiemp | 126 | 1 | — | 0 | 0 | — | — | 0 | — |
| shellm:claude | buro | sí | 125 | 1 | 12486 | 6 | 11 | 500 × 500 × 400 | sí | 0 | viable |
| shellm:claude | cama | no: SheLLM cortó la petición a los 125 s: el modelo tardó más que su límite de tiemp | 125 | 1 | — | 0 | 0 | — | — | 0 | — |
| shellm:claude | alacena | no: El modelo devolvió un JSON inválido. | 169 | 1 | — | 0 | 0 | — | — | 0 | — |
| shellm:claude | escritorio | no: SheLLM cortó la petición a los 126 s: el modelo tardó más que su límite de tiemp | 126 | 1 | — | 0 | 0 | — | — | 0 | — |
| shellm:claude | zapatera | sí | 161 | 1 | 16210 | 9 | 20 | 900 × 800 × 350 | sí | 0 | viable |
| shellm:claude | mueble-tv | no: SheLLM cortó la petición a los 126 s: el modelo tardó más que su límite de tiemp | 126 | 1 | — | 0 | 0 | — | — | 0 | — |
| shellm:claude | mesa-centro | no: El modelo devolvió un JSON inválido. | 215 | 2 | — | 0 | 0 | — | — | 0 | — |
