import { createGallery, type GalleryController } from './gallery.js'
import type { GalleryItem, GalleryOptions } from './types.js'
export type SphericalGalleryElement = HTMLElement & {
  items: readonly GalleryItem[]
  options: Partial<GalleryOptions>
  controller?: GalleryController
}
export function registerSphericalGallery(registry: CustomElementRegistry = customElements) {
  if (registry.get('spherical-gallery')) return
  class SphericalGalleryElementClass extends HTMLElement {
    private data: readonly GalleryItem[] = []
    private value: Partial<GalleryOptions> = {}
    controller?: GalleryController
    get items() {
      return this.data
    }
    set items(value: readonly GalleryItem[]) {
      this.data = value
      if (this.controller) this.controller.update({ items: value })
    }
    get options() {
      return this.value
    }
    set options(value: Partial<GalleryOptions>) {
      this.value = value
      this.controller?.update(value)
    }
    connectedCallback() {
      for (const name of ['items', 'options'] as const)
        if (Object.prototype.hasOwnProperty.call(this, name)) {
          const value = this[name]
          delete (this as Partial<SphericalGalleryElement>)[name]
          ;(this as any)[name] = value
        }
      this.controller = createGallery(this, {
        items: this.data,
        title: this.getAttribute('title') ?? undefined,
        theme: (this.getAttribute('theme') ?? 'system') as GalleryOptions['theme'],
        sizing: (this.getAttribute('sizing') ?? 'container') as GalleryOptions['sizing'],
        ...this.value,
      })
    }
    disconnectedCallback() {
      this.controller?.destroy()
      this.controller = undefined
    }
  }
  registry.define('spherical-gallery', SphericalGalleryElementClass)
}
