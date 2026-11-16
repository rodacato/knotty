import { expect, test, type Page } from '@playwright/test'
import { openInStudio } from './helpers'

// «Ver en tu espacio» (D74): the room opens on «Combinar», and its pieces are a ticket under the band.

async function openRoom(page: Page) {
  await openInStudio(page, 'Librero abierto')
  await page.getByRole('button', { name: 'Ver en tu espacio' }).first().click()
  const room = page.getByRole('dialog', { name: 'Tu espacio con Knotty' })
  await expect(room).toBeVisible()
  return room
}

test('the room combines fichas through its ticket', async ({ page }) => {
  const room = await openRoom(page)
  await expect(room.getByRole('button', { name: 'Combinar' })).toHaveAttribute('aria-pressed', 'true')

  const ticket = room.getByRole('region', { name: 'Tu combinación' })
  const first = ticket.getByRole('button', { name: /^1 Librero abierto/ })
  await expect(first).toBeVisible()

  await room.getByRole('button', { name: /^Agregar Mueble de TV ranurado/ }).click()
  const second = ticket.getByRole('button', { name: /^2 Mueble de TV ranurado/ })
  await expect(second).toHaveAttribute('aria-pressed', 'true')
  await expect(first).toHaveAttribute('aria-pressed', 'false')

  await first.click()
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await expect(room.getByRole('button', { name: 'Girar' })).toBeVisible()

  await room.getByRole('button', { name: 'Acomodar' }).click()
  await expect(room.getByRole('group', { name: /^Plano del espacio/ })).toBeVisible()

  await room.getByRole('button', { name: 'Quitar' }).click()
  await expect(ticket.getByRole('button')).toHaveCount(1)
  await expect(ticket.getByRole('button', { name: /^1 Mueble de TV ranurado/ })).toBeVisible()
})
