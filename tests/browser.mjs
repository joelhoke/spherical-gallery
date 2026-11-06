import { chromium, firefox, webkit } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
await mkdir('test-results', { recursive: true })
const results = []
for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await type.launch({ headless: true }),
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } }),
    page = await context.newPage(),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  try {
    await page.goto('http://127.0.0.1:4173')
    await page.waitForFunction(() => window.gallery?.getView() === 'sphere')
    await page.locator('spherical-gallery').scrollIntoViewIfNeeded()
    const first = page.locator('spherical-gallery .sg-surface')
    await first.focus()
    await page.keyboard.press('ArrowRight')
    await page.waitForFunction(
      () =>
        Number(document.querySelector('spherical-gallery .sg-surface').dataset.x) > 200 &&
        document.querySelector('spherical-gallery .sg-surface').dataset.moving === 'false',
    )
    assert.equal(await page.evaluate(() => window.secondary.getView()), 'grid')
    assert.equal(await page.evaluate(() => window.secondary.getPosition().x), 0)
    await page.getByRole('button', { name: 'Back to start', exact: true }).click()
    await page.waitForFunction(() => window.gallery.getPosition().x === 0)
    const seam = await page.evaluate(() => {
      window.gallery.restorePosition({ x: -0.25, y: 0 })
      const before = [...document.querySelectorAll('spherical-gallery .sg-placement')]
        .filter((e) => e.getAttribute('aria-hidden') === 'false')
        .map((e) => ({ key: e.firstElementChild.dataset.tileKey, canvas: e.querySelector('canvas') }))
        .filter((e) => e.canvas)
      window.gallery.restorePosition({ x: 0.25, y: 0 })
      return before.every(
        (t) => document.querySelector(`spherical-gallery [data-tile-key="${t.key}"] canvas`) === t.canvas,
      )
    })
    assert(seam, 'canvas identity survives the wrapping seam')
    await page.setViewportSize({ width: 900, height: 780 })
    await page.waitForTimeout(100)
    assert(await first.evaluate((e) => e.clientWidth < 900))
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.evaluate(() => window.gallery.setView('grid'))
    assert.equal(await page.locator('spherical-gallery .sg-grid > li').count(), 8)
    const trigger = page.locator('spherical-gallery .sg-grid a').nth(2)
    await trigger.click()
    await page.getByRole('dialog').waitFor()
    assert.equal(
      await page.evaluate(() => document.activeElement.getAttribute('aria-label')),
      'Close preview',
    )
    await page.getByRole('button', { name: 'Expand preview', exact: true }).click()
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').getAttribute('data-expanded'), 'false')
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(), 0)
    assert(await trigger.evaluate((e) => e === document.activeElement))
    await trigger.click()
    await page.keyboard.press('Shift+Tab')
    assert(await page.evaluate(() => !!document.activeElement.closest('dialog')))
    await page.keyboard.press('Escape')
    await trigger.click()
    await page.mouse.click(2, 2)
    await page.waitForFunction(() => !document.querySelector('dialog'))
    const modified = await trigger.evaluate((el) => {
      let prevented = true
      el.parentElement.addEventListener(
        'click',
        (e) => {
          prevented = e.defaultPrevented
          e.preventDefault()
        },
        { once: true },
      )
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }))
      return prevented
    })
    assert.equal(modified, false, 'modified navigation is left to the browser')
    await page.locator('spherical-gallery .sg-grid a').nth(1).click()
    await page.locator('iframe').waitFor()
    await page.evaluate(() => {
      const frame = document.querySelector('iframe')
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'gallery:close' },
          origin: location.origin,
          source: window,
        }),
      )
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'gallery:close' },
          origin: 'https://wrong.example',
          source: frame.contentWindow,
        }),
      )
    })
    assert.equal(await page.getByRole('dialog').count(), 1)
    await page.frameLocator('iframe').getByRole('button', { name: 'Close preview' }).click()
    await page.waitForFunction(() => !document.querySelector('dialog'))
    await page.evaluate(() => window.gallery.setTheme('dark'))
    assert(
      (await page.locator('spherical-gallery .sg-grid img').first().getAttribute('src')).includes(
        '-dark.svg',
      ),
    )
    await page.evaluate(() => window.gallery.setTheme('system'))
    await page.emulateMedia({ colorScheme: 'light' })
    await page.waitForFunction(() => document.querySelector('spherical-gallery').dataset.theme === 'light')
    // Only the focused/hovered media may play; failed sources keep a poster.
    await page.locator('spherical-gallery .sg-grid a').nth(2).hover()
    await page.waitForFunction(() =>
      [...document.querySelectorAll('spherical-gallery video')].some((v) => !v.paused && v.readyState >= 2),
    )
    assert(
      await page.evaluate(
        () => [...document.querySelectorAll('spherical-gallery video')].filter((v) => !v.paused).length <= 1,
      ),
    )
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    assert(
      await page.evaluate(() =>
        [...document.querySelectorAll('spherical-gallery video')].every((v) => v.paused),
      ),
    )
    await page.evaluate(() => {
      delete document.hidden
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.route('**/broken-media*', (r) => r.abort())
    await page.evaluate(() => {
      window.gallery.update({
        items: [
          {
            id: 'broken',
            title: 'Poster fallback',
            alt: 'Missing image',
            poster: '/broken-media.svg',
            preview: '/broken-media.mp4',
            destination: { kind: 'link', href: '#fallback' },
          },
        ],
      })
    })
    await page.locator('spherical-gallery .sg-grid a').hover()
    await page.waitForTimeout(150)
    assert.equal(await page.locator('spherical-gallery .sg-fallback').textContent(), 'Poster fallback')
    await page.evaluate(() => window.gallery.update({ items: window.demo.items }))
    await page.evaluate(() => window.gallery.setView('sphere'))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.waitForFunction(
      () => matchMedia('(prefers-reduced-motion: reduce)').matches && window.gallery.getView() === 'grid',
    )
    assert.equal(await page.locator('spherical-gallery .sg-grid > li').count(), 8)
    await page.evaluate(() => window.gallery.setView('sphere'))
    assert.equal(await page.evaluate(() => window.gallery.getView()), 'grid')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const frozen = await page.evaluate(async () => {
      const el = document.createElement('div')
      el.style.cssText = 'position:fixed;top:0;left:0;width:200px;height:150px;z-index:999'
      document.body.append(el)
      const mesh = window.demo.createMeshBackground(el, { seed: 42 })
      await new Promise((r) => setTimeout(r, 80))
      mesh.setActive(false)
      const phase = mesh.getPhase(),
        image = el.querySelector('canvas').toDataURL()
      await new Promise((r) => setTimeout(r, 80))
      const same = phase === mesh.getPhase() && image === el.querySelector('canvas').toDataURL()
      mesh.setActive(true)
      await new Promise((r) => setTimeout(r, 80))
      const continued = mesh.getPhase() > phase
      mesh.destroy()
      el.remove()
      return same && continued
    })
    assert(frozen, 'paused meshes retain pixels and phase')
    const clean = await page.evaluate(() => {
      const host = document.createElement('div')
      host.textContent = 'fallback'
      document.body.append(host)
      for (let n = 0; n < 5; n++) {
        const g = window.demo.createGallery(host, { items: window.demo.items, view: 'grid' })
        g.destroy()
      }
      const good = host.textContent === 'fallback' && !host.querySelector('canvas')
      host.remove()
      return good
    })
    assert(clean)
    const persisted = await page.evaluate(() => {
      const host = document.createElement('div')
      document.body.append(host)
      const options = { items: window.demo.items, storageKey: 'test-position', view: 'grid' }
      let instance = window.demo.createGallery(host, options)
      instance.restorePosition({ x: 123, y: -456 })
      instance.destroy()
      instance = window.demo.createGallery(host, options)
      const point = instance.getPosition()
      instance.destroy()
      host.remove()
      sessionStorage.removeItem('test-position')
      return point.x === 123 && point.y === -456
    })
    assert(persisted, 'opt-in session persistence restores position')

    await page.evaluate(() => window.gallery.setView('sphere'))
    await page.locator('spherical-gallery').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `test-results/${name}-gallery.png` })
    await page.goto('http://127.0.0.1:4173/examples/react.html')
    await page.waitForFunction(() => !!document.querySelector('[data-view=sphere] .sg-placement'))
    await page.waitForTimeout(100)
    assert.deepEqual(await page.evaluate(() => window.__hydrationErrors), [])
    assert.equal(await page.locator('[data-view=grid] .sg-grid li').count(), 0)
    assert((await page.getByText('Studio / React context').count()) > 0)
    await page.getByRole('button', { name: 'Change theme' }).click()
    await page.waitForFunction(() => !!document.querySelector('[data-theme=dark] .sg-placement'))
    await page.getByRole('button', { name: 'Mount / unmount' }).click()
    assert.equal(await page.locator('.sg-placement').count(), 0)
    await page.getByRole('button', { name: 'Mount / unmount' }).click()
    await page.waitForFunction(() => !!document.querySelector('.sg-placement'))
    assert.deepEqual(await page.evaluate(() => window.__hydrationErrors), [])
    await page.screenshot({ path: `test-results/${name}-react.png` })
    const noJS = await browser.newContext({ javaScriptEnabled: false }),
      fallback = await noJS.newPage()
    await fallback.goto('http://127.0.0.1:4173/examples/react.html')
    assert.equal(await fallback.locator('.sg-grid li').count(), 5)
    assert(await fallback.locator('.sg-grid a').first().isVisible())
    await noJS.close()
    const mobile = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        ...(name !== 'firefox' ? { isMobile: true } : {}),
      }),
      touch = await mobile.newPage()
    await touch.goto('http://127.0.0.1:4173')
    await touch.waitForFunction(() => !!window.gallery)
    await touch.locator('spherical-gallery').scrollIntoViewIfNeeded()
    await touch.screenshot({ path: `test-results/${name}-mobile.png` })
    if (name === 'chromium') {
      const cdp = await mobile.newCDPSession(touch),
        box = await touch.locator('spherical-gallery .sg-surface').boundingBox(),
        x = box.x + 195,
        y = box.y + 220
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x - 90, y: y - 60 }],
      })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await touch.waitForFunction(() => window.gallery.getPosition().x > 50)
    }
    await mobile.close()
    assert.deepEqual(errors, [])
    results.push({ browser: name, status: 'passed' })
    console.log(`${name}: passed`)
  } catch (e) {
    results.push({ browser: name, status: 'failed', error: String(e), pageErrors: errors })
    console.error(name, e)
    await page.screenshot({ path: `test-results/${name}-failure.png` })
  } finally {
    await context.close()
    await browser.close()
  }
}
await writeFile('test-results/browser-results.json', JSON.stringify(results, null, 2))
if (results.some((r) => r.status !== 'passed')) process.exitCode = 1
