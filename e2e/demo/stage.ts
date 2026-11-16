import { test as base, type Locator, type Page } from '@playwright/test'

// What a recording needs on top of the flows: a cursor the video can see, moves a person could follow, and where the clip starts.

const CURSOR = `
  addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div')
    dot.id = 'demo-cursor'
    dot.setAttribute('aria-hidden', 'true')
    Object.assign(dot.style, {
      display: 'none', position: 'fixed', left: '0', top: '0', width: '22px', height: '22px', margin: '-11px 0 0 -11px',
      borderRadius: '50%', background: 'rgba(28, 25, 23, 0.35)', border: '2px solid rgba(250, 247, 240, 0.9)',
      pointerEvents: 'none', zIndex: '2147483647', transition: 'transform 120ms ease-out',
    })
    document.body.append(dot)
    addEventListener('mousemove', (e) => { dot.style.translate = e.clientX + 'px ' + e.clientY + 'px' }, true)
    addEventListener('mousedown', () => { dot.style.transform = 'scale(0.7)' }, true)
    addEventListener('mouseup', () => { dot.style.transform = '' }, true)
  })
`

/** Where the cursor waits when the clip begins: over the 3D, out of the way of any text. */
const CURSOR_HOME = { x: 420, y: 420 }

export const test = base.extend<{ stage: Stage }>({
  stage: async ({ page }, use, info) => {
    await page.addInitScript(CURSOR)
    const born = Date.now()
    await use(new Stage(page, () => info.annotations.push({ type: 'clip-start', description: String((Date.now() - born) / 1000) })))
  },
})

export class Stage {
  constructor(
    readonly page: Page,
    private readonly markStart: () => void,
  ) {}

  /** Everything before this is loading: the clip begins here, and so does the cursor, so no dot is left where the setup clicked. */
  async action() {
    await this.page.mouse.move(CURSOR_HOME.x, CURSOR_HOME.y)
    await this.page.evaluate(() => {
      const dot = document.getElementById('demo-cursor')
      if (dot) dot.style.display = 'block'
    })
    this.markStart()
  }

  /** A beat for the viewer to read what just appeared. */
  async hold(ms = 1200) {
    await this.page.waitForTimeout(ms)
  }

  /** Glides the cursor to the element, then clicks it. */
  async click(target: Locator) {
    await target.scrollIntoViewIfNeeded()
    const box = await target.boundingBox()
    if (box) await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 })
    await this.hold(250)
    await target.click()
  }

  /** Types at a pace a person could read, then sends with Enter. */
  async type(target: Locator, text: string) {
    await this.click(target)
    await target.pressSequentially(text, { delay: 55 })
    await this.hold(300)
    await target.press('Enter')
  }
}
