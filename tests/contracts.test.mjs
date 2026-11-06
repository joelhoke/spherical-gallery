import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import { SphericalGallery } from '@joelhoke/spherical-gallery/react'
import { MeshBackground } from '@joelhoke/mesh-backgrounds/react'
import * as gallery from '@joelhoke/spherical-gallery'
import { createSeededMesh, resolvePalette, PALETTES } from '@joelhoke/mesh-backgrounds'
import { stepGlyphParticle } from '../packages/mesh-backgrounds/dist/engine/glyphPhysics.js'
test('imports require no browser and do not register elements', () => {
  assert.equal(typeof globalThis.window, 'undefined')
  assert.equal(typeof gallery.registerSphericalGallery, 'function')
})
test('server rendering has a unique real-item Grid and safe links', () => {
  const items = [
    {
      id: 'one',
      title: 'One',
      alt: 'A ring',
      poster: '/ring.svg',
      destination: { kind: 'link', href: '/one' },
    },
    { id: 'two', title: 'Two', alt: 'A square', destination: { kind: 'preview', href: '/two' } },
  ]
  const html = renderToString(createElement(SphericalGallery, { items }))
  assert.equal((html.match(/<li>/g) || []).length, 2)
  assert(html.includes('href="/one"'))
  assert(html.includes('href="/two"'))
  assert(html.includes('alt="A ring"'))
  assert(!html.includes('canvas'))
  assert(renderToString(createElement(MeshBackground, { seed: 2 })).includes('<div'))
})
test('seeded artwork matches original generation and keeps seven complete palettes', () => {
  const a = createSeededMesh(104729, PALETTES[0].colors)
  assert.deepEqual(a, createSeededMesh(104729, PALETTES[0].colors))
  assert.notDeepEqual(a, createSeededMesh(104730, PALETTES[0].colors))
  assert.equal(a.size, 43)
  assert.equal(PALETTES.length, 7)
  assert.throws(() => resolvePalette(['red']))
  assert.throws(() => resolvePalette('unknown'))
})
test('glyph bending uses extracted spring/damping and returns toward target', () => {
  const p = { x: 100, y: 100, tx: 100, ty: 100, vx: 0, vy: 0 }
  stepGlyphParticle(p, { x: 90, y: 100, active: true, influence: 1 }, 225, 0.48)
  assert(p.x > 100)
  for (let n = 0; n < 300; n++) stepGlyphParticle(p, null, 225, 0.48)
  assert(Math.abs(p.x - 100) < 1e-6)
})

import { safeURL } from '../packages/spherical-gallery/dist/types.js'
test('destination URLs reject executable schemes including whitespace obfuscation', () => {
  for (const input of [
    'javascript:alert(1)',
    ' javascript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
  ])
    assert.equal(safeURL(input), '#')
  for (const input of ['/work/demo', 'https://example.com/demo', '#work', '../image.svg'])
    assert.equal(safeURL(input), input)
})
