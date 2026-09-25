# Knotty

- La interfaz y los textos para la persona van en español de México; el código (nombres, archivos, lógica y comentarios), los datos guardados y los prompts van en inglés. Los prompts le piden al experto que todo lo que lee la persona lo escriba en español (D33 en `docs/PROPUESTA.md`).
- Medidas en milímetros. Arquitectura hexagonal: `src/architecture.test.ts` verifica las fronteras entre capas.
- `docs/PROPUESTA.md` es el documento vivo: decisiones, fases y estado. `CONTRIBUTING.md` dice cómo verificar un cambio según lo que toca (niveles y tabla).
- `docs/carpinteria/` es la referencia del dominio (triplay, uniones, acabados, medidas, estructura, glosario); si dos documentos no coinciden, manda `valores-de-referencia.md`. Si te piden «contesta como <experto>» o una «mesa redonda», lee `docs/carpinteria/expertos.md` y responde con ese criterio y esa voz.
- Antes de un PR: `npm run lint`, `npm run typecheck` y `npm test`. `npm run compare` llama a proveedores reales y cuesta tokens: solo a mano.
- Bitácora de depuración («Entrañas de la madera»): el código Konami (↑↑↓↓←→←→BA), `Ctrl+Shift+D`, el interruptor en ajustes o `?debug` en la dirección muestran el botón; «Exportar» baja un JSON con el commit, el experto (sin llaves), el diseño y todos los eventos. Captura siempre, aunque esté oculta.
- Banco de pruebas: junto a la bitácora (mismo acceso). Corre los casos fijos de `src/application/bench/cases.ts` contra el experto conectado (usa la llave de la persona y cuesta tokens) y revisa sin experto todas las variantes de cama, mesa y gabinete; una variante con avisos es un error de Knotty. `npm run compare` usa los mismos casos y la misma calificación.
