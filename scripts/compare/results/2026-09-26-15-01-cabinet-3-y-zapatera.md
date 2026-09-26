# Comparativo de modelos: cabinet@3 y zapatera

Commit bc2d776 · prompts skeleton@15+cabinet@3, system@11+reconstruction@12, skeleton@15+cabinet@3+sideboard@2, skeleton@15+shoeRack@auto · 2026-09-26 15:01 UTC

| Modelo | Diseños válidos | Segundos (prom.) | Tokens de entrada (prom.) | Tokens de salida (prom.) | Medidas razonables | Estructura como se pidió | Viables |
|---|---|---|---|---|---|---|---|
| shellm:claude | 9/9 | 57 | 6608 | 2066 | 8/9 | 5/6 | 6/9 |

Intentos cuenta las llamadas del diseño; cada pedido de después dice si lo hizo Knotty sin experto (0 llamadas) o el experto, y cuántas llamadas hizo. Estructura compara las puertas, cajones y huecos abiertos que pide el caso con los del diseño (los abiertos solo se cuentan en la ficha del gabinete; «?» si no se pueden contar); el resumen cuenta solo los casos que la piden y se pudieron contar.

| Modelo | Caso | Listo | Camino | s | Intentos | Reparaciones | Tokens entrada | Tokens salida | Piezas | Uniones | Alto × ancho × fondo | Razonables | Estructura | Críticos | Veredicto | Pedidos después (quién los hizo) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| shellm:claude | wall-cabinet | sí | ficha | 12 | 1 | 0 | 4676 | 1017 | 9 | 17 | 700 × 800 × 300 | sí | puertas 2 | 0 | viable | — |
| shellm:claude | shoe-rack | sí | piezas | 307 | 4 (E_OVERALL_SIZE E_OVERLAP) | 10 | — | — | 12 | 21 | 900 × 800 × 300 | NO | — | 8 (R1_SAG R5_RACKING R6_DOORS) | needs-changes | «Sin zoclo» experto (2), versión · «¿Cuántas hojas?» Knotty, respuesta |
| shellm:claude | sideboard | sí | ficha | 52 | 1 | 0 | 13764 | 4958 | 54 | 111 | 940 × 1600 × 400 | sí | puertas 3 · cajones 3 · abiertos 3 | 1 (R4_TIPPING) | needs-changes | «¿Cuánto cuesta?» Knotty, respuesta · «Cambia el cajoncito de arriba por un nicho abierto» experto (1), versión |
| shellm:claude | wall-cabinet | sí | ficha | 13 | 1 | 0 | 4677 | 934 | 12 | 21 | 700 × 800 × 300 | sí | NO: puertas 4 (pidió 2) | 0 | viable | — |
| shellm:claude | shoe-rack | sí | ficha | 15 | 1 | 0 | 3577 | 1155 | 11 | 22 | 900 × 726 × 330 | sí | — | 0 | viable | «Sin zoclo» Knotty, versión · «¿Cuántas hojas?» Knotty, respuesta |
| shellm:claude | sideboard | sí | ficha | 59 | 1 | 0 | 12933 | 3821 | 41 | 89 | 940 × 1600 × 400 | sí | puertas 3 · cajones 3 · abiertos 3 | 1 (R4_TIPPING) | needs-changes | «¿Cuánto cuesta?» Knotty, respuesta · «Cambia el cajoncito de arriba por un nicho abierto» experto (1), versión |
| shellm:claude | wall-cabinet | sí | ficha | 13 | 1 | 0 | 4676 | 1000 | 9 | 17 | 700 × 800 × 300 | sí | puertas 2 | 0 | viable | — |
| shellm:claude | shoe-rack | sí | ficha | 13 | 1 | 0 | 3578 | 1058 | 11 | 22 | 900 × 726 × 330 | sí | — | 0 | viable | «Sin zoclo» Knotty, versión · «¿Cuántas hojas?» Knotty, respuesta |
| shellm:claude | sideboard | sí | ficha | 29 | 1 | 0 | 4982 | 2587 | 55 | 114 | 940 × 1600 × 400 | sí | puertas 3 · cajones 3 · abiertos 3 | 0 | viable | «¿Cuánto cuesta?» Knotty, respuesta · «Cambia el cajoncito de arriba por un nicho abierto» experto (1), versión |

## Por tipo de llamada

Todas las llamadas de los casos, las del diseño y las de los pedidos de después, por tipo y por prompt; promedios de las que el proveedor reportó. La entrada incluye prompt, esquema y contexto.

| Modelo | Llamada | Prompt | Llamadas | Entrada (prom.) | Salida (prom.) | s (prom.) |
|---|---|---|---|---|---|---|
| shellm:claude | esqueleto | skeleton@15+cabinet@3 | 3 | 4676 | 984 | 13 |
| shellm:claude | esqueleto | — (falló) | 1 | — | — | 49 |
| shellm:claude | pieza por pieza | system@11+reconstruction@12 | 3 | 26954 | 9060 | 86 |
| shellm:claude | ajuste pieza por pieza | system@11+adjust@10 | 2 | 48198 | 1783 | 20 |
| shellm:claude | esqueleto | skeleton@15+cabinet@3+sideboard@2 | 3 | 10560 | 3789 | 47 |
| shellm:claude | ajuste por ficha | plan-adjust@12+cabinet@3+sideboard@2 | 3 | 9876 | 1407 | 14 |
| shellm:claude | esqueleto | skeleton@15+shoeRack@auto | 2 | 3578 | 1107 | 14 |
