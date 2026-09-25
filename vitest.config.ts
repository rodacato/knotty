import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: { __APP_COMMIT__: JSON.stringify('pruebas') },
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Lo que decide; la interfaz y el 3D se revisan en el navegador.
      include: ['src/domain/**', 'src/application/**'],
      reporter: ['text-summary', 'text'],
    },
  },
})
