import { expect, type Page } from '@playwright/test'

// Shared by the flows and the demo recordings: each step waits on what the person would see, never on a timer.

/** The catalog with nothing saved: every test starts in a fresh browser context. */
export async function openCatalog(page: Page) {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Encuentra tu próximo mueble.' })).toBeVisible()
}

/** A ficha from the catalog, through its adjustment screen, into the Studio. */
export async function openInStudio(page: Page, ficha: string) {
  await openCatalog(page)
  await page.getByRole('button', { name: new RegExp(`^${ficha} `) }).first().click()
  await expect(page.getByRole('heading', { name: ficha, level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Abrir en el Studio' }).click()
  await expect(studioTitle(page)).toHaveText(ficha)
}

/** The name of the open design, in the Studio's header. */
export const studioTitle = (page: Page) => page.getByRole('banner').getByRole('paragraph').first()

/** The measures line under it: «1950 × 900 × 290 mm · …». */
export const studioMeasures = (page: Page) => page.getByRole('banner').getByRole('paragraph').nth(1)

/** Sends a request through the Conversación, without an expert. */
export async function ask(page: Page, request: string) {
  const box = page.getByRole('textbox', { name: 'Mensaje para Knotty' })
  await box.fill(request)
  await box.press('Enter')
  await expect(page.getByRole('log', { name: 'Conversación' }).getByText(request)).toBeVisible()
}
