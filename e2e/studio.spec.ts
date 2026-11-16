import { expect, test } from '@playwright/test'
import { ask, openInStudio, studioMeasures, studioTitle } from './helpers'

// The main flows with the Simulado expert: free and deterministic. Assertions read the DOM, never the 3D canvas.

test('a ficha opens in the Studio with the conversation ready', async ({ page }) => {
  await openInStudio(page, 'Librero abierto')
  await expect(studioMeasures(page)).toContainText('1950 × 900 × 290 mm')
  await expect(page.getByRole('img', { name: /^Librero abierto en 3D/ })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Mensaje para Knotty' })).toBeVisible()
})

test('a change with critical findings stays a proposal until the person chooses', async ({ page }) => {
  await openInStudio(page, 'Librero abierto')
  await ask(page, 'Hazlo de 200 cm de ancho')
  const log = page.getByRole('log', { name: 'Conversación' })
  await expect(log.getByText(/Queda como propuesta/)).toBeVisible()
  await expect(log.getByText('Crítico').first()).toBeVisible()
  await expect(page.getByText('Viendo la propuesta sin aplicar')).toBeVisible()

  await page.getByRole('button', { name: 'Aplicar con un apoyo al centro' }).click()
  await expect(studioMeasures(page)).toContainText('1950 × 2000 × 290 mm')
  await expect(page.getByText('Viendo la propuesta sin aplicar')).toBeHidden()
  await expect(page.getByRole('button', { name: /^Versión 2/ })).toBeVisible()
})

test('the review before buying gives a verdict and the shopping list', async ({ page }) => {
  await openInStudio(page, 'Librero abierto')
  await page.getByRole('button', { name: 'Preparar materiales' }).click()
  await expect(page.getByRole('heading', { name: 'Preparar materiales', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Revisar y ver materiales' }).click()
  await expect(page.getByRole('heading', { name: 'Se puede hacer' })).toBeVisible()
  const list = page.getByRole('region', { name: 'Lo que vas a comprar' })
  await expect(list.getByText('Triplay de pino 18 mm').first()).toBeVisible()
  await expect(list.getByText('Triplay de pino 6 mm (trasera)').first()).toBeVisible()
})

test('the design survives a reload', async ({ page }) => {
  await openInStudio(page, 'Librero abierto')
  await ask(page, 'Hazlo de 120 cm de ancho')
  await expect(studioMeasures(page)).toContainText('1950 × 1200 × 290 mm')
  await page.reload()
  await expect(studioTitle(page)).toHaveText('Librero abierto')
  await expect(studioMeasures(page)).toContainText('1950 × 1200 × 290 mm')
  await expect(studioMeasures(page)).toContainText('con cambios')
})

test.describe('the spotlight', () => {
  const pickShoeRack = async (page: import('@playwright/test').Page) => {
    await page.keyboard.press('ControlOrMeta+k')
    const search = page.getByRole('combobox', { name: 'Buscar un mueble' })
    await search.fill('zapatera')
    await expect(page.getByRole('option', { name: /^Zapatera GN-OTR-01/ })).toBeVisible()
    await search.press('Enter')
  }

  test('swaps at once when the open ficha is as it was opened', async ({ page }) => {
    await openInStudio(page, 'Librero abierto')
    await pickShoeRack(page)
    await expect(studioTitle(page)).toHaveText('Zapatera')
  })

  test('asks first when the person would lose a change, and keeps it on «Conservar»', async ({ page }) => {
    await openInStudio(page, 'Librero abierto')
    await ask(page, 'Hazlo de 120 cm de ancho')
    await expect(studioMeasures(page)).toContainText('1950 × 1200 × 290 mm')
    await pickShoeRack(page)

    const dialog = page.getByRole('dialog', { name: '¿Cambiar a Zapatera?' })
    await expect(dialog.getByRole('button', { name: 'Descargar y cambiar' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Conservar' }).click()
    // «Conservar» goes back to the search, still open, to pick something else.
    await expect(page.getByRole('combobox', { name: 'Buscar un mueble' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(studioTitle(page)).toHaveText('Librero abierto')
    await expect(studioMeasures(page)).toContainText('1950 × 1200 × 290 mm')

    await pickShoeRack(page)
    await dialog.getByRole('button', { name: 'Cambiar', exact: true }).click()
    await expect(studioTitle(page)).toHaveText('Zapatera')
  })
})
