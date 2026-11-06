import { createMeshBackground, type MeshOptions } from './mesh.js'
import { PALETTES } from './palettes.js'
/** Structural interface keeps this adapter independent of the gallery package. */
export function meshPlaceholder(options: MeshOptions = {}) {
  return (context: {
    artwork: { seed: number; palette: number }
    active: boolean
    pointer: (event: PointerEvent) => { x: number; y: number }
  }) => {
    const host = document.createElement('span')
    host.className = 'mb-placeholder'
    host.style.cssText = 'position:absolute;inset:0;display:block'
    const mesh = createMeshBackground(host, {
      ...options,
      seed: context.artwork.seed,
      palette: options.palette ?? PALETTES[context.artwork.palette % PALETTES.length],
      active: context.active,
      pointer: context.pointer,
    })
    return {
      element: host,
      update: (state: { active: boolean }) => mesh.setActive(state.active),
      destroy: () => {
        mesh.destroy()
        host.remove()
      },
    }
  }
}
