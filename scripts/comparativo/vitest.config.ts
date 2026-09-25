import { defineConfig } from 'vitest/config'

// Aparte de las pruebas: llama a proveedores reales, tarda minutos y cuesta tokens.
export default defineConfig({
  test: { include: ['scripts/comparativo/*.comparativo.ts'], testTimeout: 60 * 60_000 },
})
