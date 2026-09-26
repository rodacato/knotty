# Comparativo de modelos: prompts por categoría

Commit df81bec · prompts skeleton@15+cabinet@2, skeleton@15+bed@2, skeleton@15+table@2, skeleton@15+shoeRack@auto, skeleton@15+cabinet@2+sideboard@1, system@11+reconstruction@12 · 2026-09-26 14:29 UTC

| Modelo | Diseños válidos | Segundos (prom.) | Tokens de entrada (prom.) | Tokens de salida (prom.) | Medidas razonables | Estructura como se pidió | Viables |
|---|---|---|---|---|---|---|---|
| shellm:claude | 26/26 | 32 | 8586 | 2863 | 24/26 | 13/14 | 24/26 |

Intentos cuenta las llamadas del diseño; cada pedido de después dice si lo hizo Knotty sin experto (0 llamadas) o el experto, y cuántas llamadas hizo. Estructura compara las puertas, cajones y huecos abiertos que pide el caso con los del diseño (los abiertos solo se cuentan en la ficha del gabinete; «?» si no se pueden contar); el resumen cuenta solo los casos que la piden y se pudieron contar.

| Modelo | Caso | Listo | Camino | s | Intentos | Reparaciones | Tokens entrada | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Estructura | Críticos | Veredicto | Pedidos después (quién los hizo) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| shellm:claude | bookcase | sí | ficha | 16 | 1 | 0 | 4563 | 1445 | 10 | 23 | 1800 × 800 × 300 | sí | puertas 0 · cajones 0 | 0 | viable | «¿Cuánto cuesta?» Knotty, respuesta |
| shellm:claude | bed-drawers | sí | ficha | 16 | 1 | 0 | 3679 | 1126 | 40 | 81 | 1100 × 2188 × 1010 | sí | — | 0 | viable | — |
| shellm:claude | nightstand | sí | ficha | 53 | 1 | 0 | 10316 | 1847 | 24 | 46 | 550 × 450 × 400 | sí | cajones 1 · abiertos 1 | 0 | viable | — |
| shellm:claude | bed | sí | ficha | 14 | 1 | 0 | 8015 | 1236 | 48 | 94 | 1000 × 2188 × 1010 | sí | — | 0 | viable | «Súbela a 45 cm y ponle cajones del lado izquierdo» experto (1), propuesta |
| shellm:claude | wall-cabinet | sí | ficha | 14 | 1 | 0 | 4549 | 1181 | 11 | 19 | 700 × 800 × 300 | sí | NO: puertas 4 (pidió 2) | 0 | viable | — |
| shellm:claude | desk | sí | ficha | 14 | 1 | 0 | 3351 | 1050 | 6 | 11 | 750 × 1200 × 600 | sí | — | 0 | viable | — |
| shellm:claude | shoe-cabinet | sí | ficha | 17 | 1 | 0 | 3498 | 1359 | 9 | 20 | 900 × 800 × 350 | sí | puertas 0 | 0 | viable | — |
| shellm:claude | shoe-rack | sí | ficha | 17 | 1 | 0 | 3497 | 1233 | 11 | 22 | 900 × 690 × 330 | NO | — | 0 | viable | «Sin zoclo» Knotty, versión · «¿Cuántas hojas?» Knotty, respuesta |
| shellm:claude | tv-stand | sí | ficha | 18 | 1 | 0 | 10403 | 2109 | 28 | 59 | 450 × 1600 × 400 | sí | puertas 2 · abiertos 1 | 0 | viable | — |
| shellm:claude | sideboard | sí | ficha | 33 | 1 | 0 | 11999 | 3332 | 55 | 114 | 940 × 1600 × 400 | sí | puertas 3 · cajones 3 · abiertos 3 | 0 | viable | «¿Cuánto cuesta?» Knotty, respuesta · «Cambia el cajoncito de arriba por un nicho abierto» experto (1), versión |
| shellm:claude | sideboard-explicit | sí | ficha | 39 | 1 | 0 | 12351 | 3923 | 55 | 114 | 940 × 1600 × 400 | sí | puertas 3 · cajones 3 · abiertos 3 | 0 | viable | — |
| shellm:claude | coffee-table | sí | ficha | 8 | 1 | 0 | 3348 | 693 | 8 | 14 | 420 × 1000 × 550 | sí | — | 0 | viable | — |
| shellm:claude | plant-stand | sí | piezas | 174 | 2 | 0 | 28991 | 15056 | 10 | 16 | 750 × 800 × 750 | sí | — | 1 (R5_RACKING) | needs-changes | — |
| shellm:claude | bookcase | sí | ficha | 22 | 1 | 0 | 4563 | 1883 | 11 | 26 | 1800 × 800 × 300 | sí | puertas 0 · cajones 0 | 0 | viable | «¿Cuánto cuesta?» Knotty, respuesta |
| shellm:claude | bed-drawers | sí | ficha | 12 | 1 | 0 | 3678 | 943 | 40 | 81 | 1100 × 2188 × 1010 | sí | — | 0 | viable | — |
| shellm:claude | nightstand | sí | ficha | 11 | 1 | 0 | 4547 | 834 | 25 | 48 | 600 × 450 × 400 | sí | cajones 1 · abiertos 1 | 0 | viable | — |
| shellm:claude | bed | sí | ficha | 15 | 1 | 0 | 8158 | 1522 | 12 | 29 | 1000 × 1956 × 1010 | sí | — | 0 | viable | «Súbela a 45 cm y ponle cajones del lado izquierdo» experto (1), propuesta |
| shellm:claude | wall-cabinet | sí | ficha | 14 | 1 | 0 | 4549 | 1332 | 9 | 17 | 700 × 800 × 300 | sí | puertas 2 | 0 | viable | — |
| shellm:claude | desk | sí | ficha | 13 | 1 | 0 | 3351 | 999 | 6 | 11 | 750 × 1200 × 600 | sí | — | 0 | viable | — |
| shellm:claude | shoe-cabinet | sí | ficha | 15 | 1 | 0 | 3499 | 1214 | 9 | 20 | 900 × 800 × 350 | sí | puertas 0 | 0 | viable | — |
| shellm:claude | shoe-rack | sí | ficha | 22 | 1 | 0 | 8248 | 1933 | 11 | 22 | 900 × 690 × 330 | NO | — | 0 | viable | «Sin zoclo» Knotty, versión · «¿Cuántas hojas?» Knotty, respuesta |
| shellm:claude | tv-stand | sí | ficha | 14 | 1 | 0 | 4574 | 1124 | 29 | 59 | 450 × 1600 × 400 | sí | puertas 2 · abiertos 1 | 0 | viable | — |
| shellm:claude | sideboard | sí | ficha | 23 | 1 | 0 | 4893 | 2059 | 55 | 117 | 940 × 1600 × 400 | sí | puertas 3 · cajones 3 · abiertos 3 | 0 | viable | «¿Cuánto cuesta?» Knotty, respuesta · «Cambia el cajoncito de arriba por un nicho abierto» experto (1), versión |
| shellm:claude | sideboard-explicit | sí | ficha | 31 | 1 | 0 | 4940 | 2913 | 55 | 114 | 940 × 1600 × 400 | sí | puertas 3 · cajones 3 · abiertos 3 | 0 | viable | — |
| shellm:claude | coffee-table | sí | ficha | 9 | 1 | 0 | 3350 | 655 | 8 | 14 | 420 × 1000 × 550 | sí | — | 0 | viable | — |
| shellm:claude | plant-stand | sí | piezas | 208 | 3 (E_FLOATING) | 0 | 56331 | 21437 | 9 | 6 | 750 × 800 × 750 | sí | — | 1 (R5_RACKING) | needs-changes | — |

## Por tipo de llamada

Todas las llamadas de los casos, las del diseño y las de los pedidos de después, por tipo y por prompt; promedios de las que el proveedor reportó. La entrada incluye prompt, esquema y contexto.

| Modelo | Llamada | Prompt | Llamadas | Entrada (prom.) | Salida (prom.) | s (prom.) |
|---|---|---|---|---|---|---|
| shellm:claude | esqueleto | skeleton@15+cabinet@2 | 8 | 6008 | 1469 | 20 |
| shellm:claude | esqueleto | skeleton@15+bed@2 | 4 | 5883 | 1207 | 14 |
| shellm:claude | ajuste por ficha | plan-adjust@12+bed@2 | 2 | 8789 | 1106 | 11 |
| shellm:claude | esqueleto | skeleton@15+table@2 | 4 | 3350 | 849 | 11 |
| shellm:claude | esqueleto | skeleton@15+shoeRack@auto | 4 | 4686 | 1435 | 18 |
| shellm:claude | esqueleto | skeleton@15+cabinet@2+sideboard@1 | 4 | 8546 | 3057 | 32 |
| shellm:claude | ajuste por ficha | plan-adjust@12+cabinet@2+sideboard@1 | 2 | 11938 | 1599 | 14 |
| shellm:claude | esqueleto | skeleton@15+all | 2 | 13226 | 1677 | 20 |
| shellm:claude | pieza por pieza | system@11+reconstruction@12 | 3 | 19624 | 11047 | 114 |
