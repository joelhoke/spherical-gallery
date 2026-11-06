import { createMeshBackground, type MeshOptions } from './mesh.js'
export type MeshElement = HTMLElement & {
  options: MeshOptions
  controller?: ReturnType<typeof createMeshBackground>
}
export function registerMeshBackground(registry: CustomElementRegistry = customElements) {
  if (registry.get('mesh-background')) return
  class MeshBackgroundElement extends HTMLElement {
    static observedAttributes = ['seed', 'palette', 'renderer', 'density', 'motion', 'glyphs']
    private value: MeshOptions = {}
    controller?: ReturnType<typeof createMeshBackground>
    get options() {
      return this.value
    }
    set options(value: MeshOptions) {
      this.value = value
      this.mount()
    }
    connectedCallback() {
      if (Object.prototype.hasOwnProperty.call(this, 'options')) {
        const value = this.options
        delete (this as Partial<MeshElement>).options
        this.options = value
      } else this.mount()
    }
    disconnectedCallback() {
      this.controller?.destroy()
      this.controller = undefined
    }
    attributeChangedCallback() {
      if (this.isConnected) this.mount()
    }
    private mount() {
      if (!this.isConnected) return
      this.controller?.destroy()
      this.style.display ||= 'block'
      this.style.minHeight ||= '200px'
      this.controller = createMeshBackground(this, {
        ...(this.hasAttribute('seed') ? { seed: Number(this.getAttribute('seed')) } : {}),
        ...(this.hasAttribute('palette') ? { palette: this.getAttribute('palette')! } : {}),
        ...(this.hasAttribute('renderer')
          ? { renderer: this.getAttribute('renderer') as 'ascii' | 'pixels' }
          : {}),
        ...(this.hasAttribute('density') ? { density: Number(this.getAttribute('density')) } : {}),
        ...(this.hasAttribute('glyphs') ? { glyphs: this.getAttribute('glyphs')! } : {}),
        motion: this.getAttribute('motion') !== 'false',
        ...this.value,
      })
    }
  }
  registry.define('mesh-background', MeshBackgroundElement)
}
