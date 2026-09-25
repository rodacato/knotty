# Knotty

- La interfaz, los textos para la persona y los prompts van en español de México; el código (nombres, archivos, lógica y comentarios) va en inglés. Lo nuevo se escribe en inglés y lo existente se migra un módulo a la vez (D33 en `docs/PROPUESTA.md`).
- Medidas en milímetros. Arquitectura hexagonal: `src/arquitectura.test.ts` verifica las fronteras entre capas.
- `docs/PROPUESTA.md` es el documento vivo: decisiones, fases y estado.
- Antes de un PR: `npm run typecheck` y `npm test`. `npm run comparar` llama a proveedores reales y cuesta tokens: solo a mano.
