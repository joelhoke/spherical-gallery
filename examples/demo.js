import { registerSphericalGallery, createGallery } from '../packages/spherical-gallery/dist/browser.js'
import {
  registerMeshBackground,
  createMeshBackground,
  PALETTES,
} from '../packages/mesh-backgrounds/dist/browser.js'
import { meshPlaceholder } from '../packages/mesh-backgrounds/dist/gallery.js'
export const items = Array.from({ length: 8 }, (_, i) => ({
  id: `study-${i}`,
  title: [
    'Orbital forms',
    'Quiet architecture',
    'Tidal light',
    'Chromatic fields',
    'Night geometry',
    'Soft structures',
    'Warm horizon',
    'Signal studies',
  ][i],
  category: i % 2 ? 'Image study' : 'Motion study',
  alt: `Abstract geometric composition ${i + 1}`,
  poster: { light: `/examples/assets/study-${i}.svg`, dark: `/examples/assets/study-${i}-dark.svg` },
  preview: i % 2 ? undefined : '/examples/assets/motion.mp4',
  destination:
    i === 0
      ? { kind: 'link', href: '#examples' }
      : i === 1
        ? {
            kind: 'preview',
            href: '/examples/embed.html',
            embed: { origin: location.origin, sandbox: 'allow-scripts allow-same-origin' },
          }
        : { kind: 'preview', href: `/examples/assets/study-${i}.svg`, media: 'image' },
}))
registerSphericalGallery()
registerMeshBackground()
const el = document.querySelector('spherical-gallery')
const placeholder = meshPlaceholder()
el.options = { title: 'Studies', theme: 'system', renderPlaceholder: placeholder }
el.items = items
window.gallery = el.controller
const secondary = document.querySelector('#secondary')
window.secondary = createGallery(secondary, {
  items: items.slice(0, 3),
  title: 'A second collection',
  view: 'grid',
  previews: false,
  theme: 'dark',
})
const field = createMeshBackground(document.querySelector('#hero-field'), {
  seed: 7919,
  palette: 'neon-tide',
  interactive: true,
})
window.field = field
for (const palette of PALETTES) {
  const row = document.createElement('article')
  row.innerHTML = `<mesh-background palette="${palette.id}" renderer="pixels" motion="false" style="height:180px"></mesh-background><h3>${palette.name}</h3>`
  document.querySelector('#palettes').append(row)
}
document.querySelector('#theme').addEventListener('change', (e) => el.controller.setTheme(e.target.value))
document
  .querySelector('#renderer')
  .addEventListener('change', (e) =>
    el.controller.update({ renderPlaceholder: meshPlaceholder({ renderer: e.target.value }) }),
  )
window.demo = { items, createGallery, createMeshBackground, meshPlaceholder }
