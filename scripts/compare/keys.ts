import { existsSync } from 'node:fs'

/** Keys live in .env (ignored by git); an offline run that names only the simulated expert never loads them. */
export function loadKeys() {
  const models = (process.env.KNOTTY_MODELS ?? process.env.KNOTTY_MODELOS ?? '').split(',').filter(Boolean)
  if (models.length && models.every((m) => m.startsWith('simulated'))) return
  if (existsSync('.env')) process.loadEnvFile('.env')
}
