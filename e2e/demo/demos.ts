import { expect } from '@playwright/test'
import { openCatalog, openInStudio, studioMeasures } from '../helpers'
import { test } from './stage'

// Each test is one GIF, named by its title: `npm run brand:demo` records them and scripts/brand/demo.mjs converts them.

test('main', async ({ page, stage }) => {
  // A first visit loads the 3D code, so the ficha in the clip draws at once instead of after a blank pause.
  await openInStudio(page, 'Librero abierto')
  await openCatalog(page)
  await stage.action()
  await stage.hold(800)
  await stage.click(page.getByRole('button', { name: /^Librero abierto / }).first())
  await expect(page.getByRole('heading', { name: 'Librero abierto', level: 1 })).toBeVisible()
  await stage.hold(1500)
  await stage.click(page.getByRole('button', { name: 'Abrir en el Studio' }))
  await expect(studioMeasures(page)).toContainText('1950 × 900 × 290 mm')
  await stage.hold(1200)
  await stage.type(page.getByRole('textbox', { name: 'Mensaje para Knotty' }), 'Hazlo de 120 cm de ancho')
  await expect(studioMeasures(page)).toContainText('1950 × 1200 × 290 mm')
  await stage.hold(1800)
  await stage.click(page.getByRole('button', { name: 'Preparar materiales' }))
  await stage.hold(1000)
  await stage.click(page.getByRole('button', { name: 'Revisar y ver materiales' }))
  await expect(page.getByRole('heading', { name: 'Se puede hacer' })).toBeVisible()
  await stage.hold(1000)
  await page.mouse.wheel(0, 500)
  await stage.hold(2200)
})

test('spotlight', async ({ page, stage }) => {
  await openInStudio(page, 'Librero abierto')
  await stage.action()
  await stage.hold(800)
  // The magnifier, not ⌘K: a shortcut leaves nothing on screen to follow.
  await stage.click(page.getByRole('button', { name: 'Cambiar de mueble' }))
  const search = page.getByRole('combobox', { name: 'Buscar un mueble' })
  await expect(search).toBeFocused()
  await stage.hold(700)
  await search.pressSequentially('zapatera', { delay: 150 })
  await expect(page.getByRole('option', { name: /^Zapatera GN-OTR-01/ })).toBeVisible()
  await stage.hold(1200)
  await search.press('ArrowDown')
  await stage.hold(700)
  await search.press('Enter')
  await expect(page.getByRole('banner').getByText('Zapatera baja de puertas ranuradas')).toBeVisible()
  await stage.hold(2000)
})

test('structure', async ({ page, stage }) => {
  await openInStudio(page, 'Librero abierto')
  await stage.action()
  await stage.hold(800)
  await stage.type(page.getByRole('textbox', { name: 'Mensaje para Knotty' }), 'Hazlo de 200 cm de ancho')
  await expect(page.getByText('Viendo la propuesta sin aplicar')).toBeVisible()
  await stage.hold(2500)
  await stage.click(page.getByRole('button', { name: 'Aplicar con un apoyo al centro' }))
  await expect(studioMeasures(page)).toContainText('1950 × 2000 × 290 mm')
  await stage.hold(2200)
})

test('room', async ({ page, stage }) => {
  await openInStudio(page, 'Librero abierto')
  await stage.action()
  await stage.hold(800)
  await stage.click(page.getByRole('button', { name: 'Ver en tu espacio' }).first())
  const room = page.getByRole('dialog', { name: 'Tu espacio con Knotty' })
  await expect(room).toBeVisible()
  await stage.hold(1500)
  await stage.click(room.getByRole('button', { name: /^Agregar Mueble de TV ranurado/ }))
  await expect(room.getByRole('button', { name: /Mueble de TV ranurado/ }).first()).toBeVisible()
  await stage.hold(1500)
  await stage.click(room.getByRole('button', { name: 'Acomodar' }))
  await stage.hold(2200)
})
