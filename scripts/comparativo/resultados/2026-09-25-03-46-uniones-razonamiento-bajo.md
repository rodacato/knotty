# Comparativo de modelos: uniones + razonamiento bajo

Commit 26a1cb6 · prompts sistema@4+reconstruccion@5 · 2026-09-25 03:46 UTC

| Modelo | Diseños válidos | Segundos (prom.) | Tokens de salida (prom.) | Medidas razonables | Viables |
|---|---|---|---|---|---|
| shellm:claude | 3/9 | 86 | 9679 | 3/3 | 1/3 |

| Modelo | Caso | Listo | s | Intentos | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Críticos | Veredicto |
|---|---|---|---|---|---|---|---|---|---|---|---|
| shellm:claude | librero | no: El modelo devolvió un JSON inválido (15,354 caracteres, termina en «a repisa y d | 99 | 1 | — | 0 | 0 | — | — | 0 | — |
| shellm:claude | cama-cajones | sí | 172 | 2 | 20224 | 14 | 0 | 900 × 1000 × 2200 | sí | 4 | con-cambios |
| shellm:claude | buro | sí | 52 | 1 | 5482 | 6 | 11 | 550 × 500 × 400 | sí | 0 | viable |
| shellm:claude | cama | no: El modelo devolvió un JSON inválido (9,158 caracteres, termina en «u00e1mbiala a | 107 | 1 | — | 0 | 0 | — | — | 0 | — |
| shellm:claude | alacena | no: El modelo devolvió un JSON inválido (12,900 caracteres, termina en «iradores tip | 76 | 1 | — | 0 | 0 | — | — | 0 | — |
| shellm:claude | escritorio | no: El modelo devolvió un JSON inválido (10,025 caracteres, termina en «ría","Ciérra | 107 | 2 | — | 0 | 0 | — | — | 0 | — |
| shellm:claude | zapatera | no: El modelo devolvió un JSON inválido (12,454 caracteres, termina en «", "Ponle pu | 64 | 1 | — | 0 | 0 | — | — | 0 | — |
| shellm:claude | mueble-tv | no: El modelo devolvió un JSON inválido (25,466 caracteres, termina en «l hueco cent | 138 | 1 | — | 0 | 0 | — | — | 0 | — |
| shellm:claude | mesa-centro | sí | 32 | 1 | 3331 | 4 | 4 | 450 × 1100 × 550 | sí | 1 | con-cambios |
