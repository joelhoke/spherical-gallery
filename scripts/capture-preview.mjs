import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

// Start npm run dev first. Only generated placeholder meshes are captured.
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.goto('http://127.0.0.1:4173/examples/preview.html')
  await page.waitForFunction(() => document.querySelectorAll('#gallery canvas').length > 10)
  await page.waitForFunction(() =>
    [...document.querySelectorAll('#gallery canvas')].some(
      (canvas) =>
        canvas.width &&
        canvas.height &&
        canvas
          .getContext('2d')
          .getImageData(0, 0, canvas.width, canvas.height)
          .data.some((value) => value !== 0),
    ),
  )
  await page.mouse.move(0, 0)
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
  await mkdir('docs/images', { recursive: true })
  await page.screenshot({ path: 'docs/images/preview.png' })
  console.log('Saved docs/images/preview.png (1200×630, generated placeholders only)')
} finally {
  await browser.close()
}
