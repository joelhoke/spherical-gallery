import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
const mode = process.argv[2] || 'baseline'
await mkdir('test-results', { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' })
await page.route('**/api/creations**', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: '{"creations":[]}' }),
)
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(process.env.PORTFOLIO_URL || 'http://127.0.0.1:4174/gallery', {
  waitUntil: 'networkidle',
})
await page.waitForSelector('[data-tile-key]')
await page.evaluate(() => document.fonts.ready)
await page.mouse.move(0, 0)
await page.waitForTimeout(500)
await page.screenshot({ path: `test-results/portfolio-${mode}-desktop.png` })
const metrics = await page.evaluate(async () => {
  const surface = document.querySelector('[data-moving]'),
    tiles = [...document.querySelectorAll('[data-tile-key]')].map((e) => ({
      key: e.dataset.tileKey,
      box: e.getBoundingClientRect().toJSON(),
    }))
  const frames = []
  let last = performance.now(),
    start = last
  await new Promise((resolve) => {
    function tick(time) {
      frames.push(time - last)
      last = time
      if (time - start < 1500) {
        surface.dispatchEvent(
          new WheelEvent('wheel', { deltaX: 8, deltaY: 4, bubbles: true, cancelable: true }),
        )
        requestAnimationFrame(tick)
      } else resolve()
    }
    requestAnimationFrame(tick)
  })
  frames.sort((a, b) => a - b)
  return {
    tiles,
    frames: frames.length,
    p50: frames[Math.floor(frames.length * 0.5)],
    p95: frames[Math.floor(frames.length * 0.95)],
    scripts: [...document.scripts].filter((s) => s.src).length,
  }
})
await page.setViewportSize({ width: 390, height: 844 })
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('[data-tile-key]')
await page.mouse.move(0, 0)
await page.screenshot({ path: `test-results/portfolio-${mode}-mobile.png` })
await writeFile(`test-results/portfolio-${mode}.json`, JSON.stringify({ ...metrics, errors }, null, 2))
console.log({ mode, frames: metrics.frames, p50: metrics.p50, p95: metrics.p95, errors })
await browser.close()
