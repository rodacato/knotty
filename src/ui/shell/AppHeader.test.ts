import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { LLMConfiguration } from '../../ports/Preferences'
import { ServicesContext, type Services } from '../services'
import { testServices } from '../store/services.test-util'
import { AppHeader } from './AppHeader'

const empty = { model: '', host: '', apiKey: '' }
const band = (config: LLMConfiguration) => {
  const { services } = testServices()
  const preferences = { ...services.preferences, load: () => config } as Services['preferences']
  return renderToStaticMarkup(h(ServicesContext.Provider, { value: { ...services, preferences } }, h(AppHeader)))
}
/** Each button's inner markup, read as is: the assertions look for words in it rather than stripping tags. */
const buttons = (markup: string) => [...markup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1])

describe('AppHeader', () => {
  it('states the connected expert by name, and settings is the only way into the settings', () => {
    const markup = band({ active: 'anthropic', keyStorage: 'memory', connections: { anthropic: { model: 'claude-opus-5', host: 'https://api.anthropic.com', apiKey: 'sk-ant-test' }, openai: empty, shellm: empty } })
    expect(markup).toMatch(/<p role="status"[^>]*>[\s\S]*Experto: <\/span>Claude/)
    expect(buttons(markup)).toHaveLength(1)
    expect(buttons(markup)[0]).toContain('Ajustes')
  })

  it('offers connecting when there is no expert', () => {
    const markup = band({ active: 'simulated', keyStorage: 'memory', connections: { anthropic: empty, openai: empty, shellm: empty } })
    expect(markup).not.toContain('role="status"')
    const [connect, settings, ...rest] = buttons(markup)
    expect(connect).toMatch(/Conectar[\s\S]*experto/)
    expect(settings).toContain('Ajustes')
    expect(rest).toEqual([])
  })
})
