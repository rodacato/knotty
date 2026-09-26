# Comparativo de modelos: current format

Commit bc2d776 · prompts skeleton@15+cabinet@3 · 2026-09-26 15:07 UTC

| Modelo | Diseños válidos | Segundos (prom.) | Tokens de entrada (prom.) | Tokens de salida (prom.) | Medidas razonables | Estructura como se pidió | Viables |
|---|---|---|---|---|---|---|---|
| shellm:claude | 2/2 | 18 | 10423 | 1777 | 2/2 | 2/2 | 2/2 |

Intentos cuenta las llamadas del diseño; cada pedido de después dice si lo hizo Knotty sin experto (0 llamadas) o el experto, y cuántas llamadas hizo. Estructura compara las puertas, cajones y huecos abiertos que pide el caso con los del diseño (los abiertos solo se cuentan en la ficha del gabinete; «?» si no se pueden contar); el resumen cuenta solo los casos que la piden y se pudieron contar.

| Modelo | Caso | Listo | Camino | s | Intentos | Reparaciones | Tokens entrada | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Estructura | Críticos | Veredicto | Pedidos después (quién los hizo) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| shellm:claude | nightstand | sí | ficha | 20 | 1 | 0 | 10510 | 1862 | 24 | 46 | 550 × 450 × 400 | sí | cajones 1 · abiertos 1 | 0 | viable | — |
| shellm:claude | nightstand | sí | ficha | 16 | 1 | 0 | 10335 | 1692 | 24 | 46 | 550 × 400 × 350 | sí | cajones 1 · abiertos 1 | 0 | viable | — |

## Por tipo de llamada

Todas las llamadas de los casos, las del diseño y las de los pedidos de después, por tipo y por prompt; promedios de las que el proveedor reportó. La entrada incluye prompt, esquema y contexto.

| Modelo | Llamada | Prompt | Llamadas | Entrada (prom.) | Salida (prom.) | s (prom.) |
|---|---|---|---|---|---|---|
| shellm:claude | esqueleto | skeleton@15+cabinet@3 | 2 | 10423 | 1777 | 18 |
