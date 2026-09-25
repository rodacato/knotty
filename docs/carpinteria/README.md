# Investigación: muebles de triplay para Knotty

Investigación del 2026-09-25 sobre muebles de triplay para personas en México: material, uniones, acabados, tipos de mueble, reglas estructurales, vocabulario, armado y cómo meter todo eso en Knotty. Todo va en milímetros; las pulgadas aparecen solo como designación comercial, p. ej. «32 mm (1¼")».

Siete documentos se escribieron en paralelo y después pasaron por una auditoría con ojo de carpintero, que los corrigió en su lugar (las correcciones van marcadas con «Nota de auditoría:»). Cuando dos documentos no coinciden, manda **10-auditoria.md**.

## Por dónde empezar

- Para decidir qué cambiar en el código: [10 — Auditoría](10-auditoria.md), §8 (cambios al código por prioridad) y §9 (decisiones pendientes).
- Para los números que Knotty debería usar: [10 — Auditoría](10-auditoria.md) §2 (valores canónicos) y §3 (vocabulario canónico).
- Para diseñar cómo entra el conocimiento al sistema: [07 — Arquitectura del conocimiento](07-arquitectura-del-conocimiento.md).

## Documentos

| # | Documento | De qué trata |
|---|---|---|
| 01 | [Triplay: el material](01-triplay-material.md) | Tipos y grados que se consiguen en México, espesores reales contra nominales, hoja, peso, rigidez, humedad, cortes, cantos y cubrecanto |
| 02 | [Uniones y herrajes](02-uniones-y-herrajes.md) | Uniones para triplay con espesores mínimos y distancias, sistema 32 mm, pegamentos, bisagras, correderas y tornillería |
| 03 | [Acabados](03-acabados.md) | Lijado, selladores, lacas, barnices, aceites, tintas y pintura con marcas mexicanas; tabla de acabado → apariencia en 3D |
| 04 | [Tipologías y medidas](04-tipologias-y-medidas.md) | Tipos de mueble por habitación, medidas ergonómicas, colchones de México y 31 plantillas de muebles prehechos |
| 05 | [Reglas estructurales](05-reglas-estructurales.md) | Pandeo de repisas, rigidez, ahorro de material oculto, cajones, puertas, vuelco, anclaje y reglas R11–R22 |
| 06 | [Glosario](06-glosario.md) | Nombre correcto de cada pieza, unión y herramienta; sinónimos regionales; términos que la app usa mal hoy |
| 07 | [Arquitectura del conocimiento](07-arquitectura-del-conocimiento.md) | Base de conocimiento tipada en `src/domain/knowledge/`, plantillas, reglas como datos, prompts generados y plan de PRs |
| 08 | [Estilo visual de las piezas](08-estilo-visual-de-piezas.md) | Bordes redondeados, perfiles de canto y acabados en el 3D; material de shader único y plan por entregas |
| 09 | [Fabricación y armado](09-fabricacion-y-armado.md) | Herramientas por nivel, corte en tienda, orden de armado, seguridad, transporte, instalación e instrucciones generadas |
| 10 | [Auditoría](10-auditoria.md) | Valores y vocabulario canónicos, numeración de reglas, fuentes rotas, lo no considerado, cambios al código y decisiones |
| 11 | [Guías y preguntas frecuentes](11-guias-y-faq.md) | Índice de guías por público y nivel, y FAQ consolidada para principiantes |

## Nivel de confianza

- ✅ Verificado en dos o más fuentes.
- ⚠️ Una sola fuente o práctica de taller.
- ❓ Por validar.
- † El dato viene de un resumen del buscador, no de la página leída. El presupuesto de búsquedas de la sesión se agotó a la mitad, así que conviene revisar estos datos antes de convertirlos en regla.

Los precios son estimados de septiembre de 2026 y no se consultaron en tienda.
