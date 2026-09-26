# Comparativo de modelos: cuenta de puertas

Commit bc2d776 · prompts skeleton@15+cabinet@3, skeleton@15+cabinet@3+sideboard@2 · 2026-09-26 16:26 UTC

| Modelo | Diseños válidos | Segundos (prom.) | Tokens de entrada (prom.) | Tokens de salida (prom.) | Medidas razonables | Estructura como se pidió | Viables |
|---|---|---|---|---|---|---|---|
| shellm:claude | 9/9 | 23 | 7032 | 2033 | 9/9 | 8/9 | 7/9 |

Intentos cuenta las llamadas del diseño; cada pedido de después dice si lo hizo Knotty sin experto (0 llamadas) o el experto, y cuántas llamadas hizo. Estructura compara las puertas, cajones y huecos abiertos que pide el caso con los del diseño (los abiertos solo se cuentan en la ficha del gabinete; «?» si no se pueden contar); el resumen cuenta solo los casos que la piden y se pudieron contar.

| Modelo | Caso | Listo | Camino | s | Intentos | Reparaciones | Tokens entrada | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Estructura | Críticos | Veredicto | Pedidos después (quién los hizo) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| shellm:claude | wall-cabinet | sí | ficha | 12 | 1 | 0 | 4676 | 926 | 11 | 19 | 700 × 800 × 300 | sí | NO: puertas 4 (pidió 2) | 0 | viable | — |
| shellm:claude | tv-stand | sí | ficha | 15 | 1 | 0 | 4697 | 1197 | 28 | 57 | 450 × 1600 × 400 | sí | puertas 2 · abiertos 1 | 0 | viable | — |
| shellm:claude | sideboard | sí | ficha | 28 | 1 | 0 | 4982 | 2523 | 41 | 86 | 940 × 1600 × 400 | sí | puertas 3 · cajones 3 · abiertos 3 | 1 (R4_TIPPING) | needs-changes | «¿Cuánto cuesta?» Knotty, respuesta · «Cambia el cajoncito de arriba por un nicho abierto» experto (1), versión |
| shellm:claude | wall-cabinet | sí | ficha | 18 | 1 | 0 | 10412 | 1798 | 9 | 17 | 700 × 800 × 300 | sí | puertas 2 | 0 | viable | — |
| shellm:claude | tv-stand | sí | ficha | 21 | 1 | 0 | 10673 | 2095 | 28 | 57 | 450 × 1600 × 400 | sí | puertas 2 · abiertos 1 | 0 | viable | — |
| shellm:claude | sideboard | sí | ficha | 27 | 1 | 0 | 4982 | 2586 | 55 | 117 | 940 × 1600 × 400 | sí | puertas 3 · cajones 3 · abiertos 3 | 1 (R4_TIPPING) | needs-changes | «¿Cuánto cuesta?» Knotty, respuesta · «Cambia el cajoncito de arriba por un nicho abierto» experto (1), propuesta |
| shellm:claude | wall-cabinet | sí | ficha | 14 | 1 | 0 | 4677 | 1155 | 9 | 17 | 700 × 800 × 300 | sí | puertas 2 | 0 | viable | — |
| shellm:claude | tv-stand | sí | ficha | 17 | 1 | 0 | 4699 | 1362 | 28 | 57 | 450 × 1600 × 400 | sí | puertas 2 · abiertos 1 | 0 | viable | — |
| shellm:claude | sideboard | sí | ficha | 49 | 1 | 0 | 13493 | 4655 | 55 | 114 | 940 × 1600 × 400 | sí | puertas 3 · cajones 3 · abiertos 3 | 0 | viable | «¿Cuánto cuesta?» Knotty, respuesta · «Cambia el cajoncito de arriba por un nicho abierto» experto (1), versión |

## Por tipo de llamada

Todas las llamadas de los casos, las del diseño y las de los pedidos de después, por tipo y por prompt; promedios de las que el proveedor reportó. La entrada incluye prompt, esquema y contexto.

| Modelo | Llamada | Prompt | Llamadas | Entrada (prom.) | Salida (prom.) | s (prom.) |
|---|---|---|---|---|---|---|
| shellm:claude | esqueleto | skeleton@15+cabinet@3 | 6 | 6639 | 1422 | 16 |
| shellm:claude | esqueleto | skeleton@15+cabinet@3+sideboard@2 | 3 | 7819 | 3255 | 35 |
| shellm:claude | ajuste por ficha | plan-adjust@12+cabinet@3+sideboard@2 | 3 | 9977 | 1541 | 14 |
