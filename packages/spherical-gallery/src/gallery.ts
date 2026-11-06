import {
  galleryPattern,
  visibleTiles,
  tileTransform,
  projectTile,
  unprojectTilePoint,
  type Point,
  type Artwork,
} from './geometry.js'
import { createMotion } from './motion.js'
import { createMedia } from './media.js'
import { createPreview } from './preview.js'
import {
  handle,
  safeURL,
  type GalleryOptions,
  type RenderHandle,
  type RenderState,
  type Selection,
  type View,
  type Theme,
  type GalleryItem,
} from './types.js'
type Tile = {
  placement: HTMLElement
  trigger: HTMLAnchorElement | HTMLButtonElement
  content: RenderHandle
  key: string
  visible: boolean
  active: boolean
  theme: string
  moving: boolean
  transform: string
}
export class GalleryController {
  readonly element: HTMLElement
  private doc: Document
  private win: Window & typeof globalThis
  private options: GalleryOptions
  private surface: HTMLDivElement
  private dock: HTMLDivElement
  private grid: HTMLUListElement
  private tiles = new Map<string, Tile>()
  private pattern: ReturnType<typeof galleryPattern>
  private motion: ReturnType<typeof createMotion>
  private resize: ResizeObserver
  private intersection: IntersectionObserver
  private reduced: MediaQueryList
  private coarse: MediaQueryList
  private dark: MediaQueryList
  private toolbar?: RenderHandle
  private preview?: RenderHandle
  private selection: Selection | null = null
  private theme: 'light' | 'dark' = 'light'
  private view: View = 'grid'
  private position: Point = { x: 0, y: 0 }
  private moving = false
  private activeKey: string | null = null
  private nearest: string | null = null
  private near = true
  private destroyed = false
  private initialized = false
  private width = 1200
  private height = 720
  private original: Node[]
  private hadClass: boolean
  private originalData: { view?: string; sizing?: string; theme?: string }
  constructor(host: HTMLElement, options: GalleryOptions) {
    this.validate(options.items)
    this.element = host
    this.doc = host.ownerDocument
    this.win = this.doc.defaultView!
    this.options = { ...options }
    this.pattern = galleryPattern(options.items.length)
    this.original = Array.from(host.childNodes)
    this.hadClass = host.classList.contains('sg-gallery')
    this.originalData = { view: host.dataset.view, sizing: host.dataset.sizing, theme: host.dataset.theme }
    host.replaceChildren()
    host.classList.add('sg-gallery')
    host.dataset.sizing = options.sizing ?? 'container'
    this.surface = this.doc.createElement('div')
    this.surface.className = 'sg-surface'
    this.surface.tabIndex = 0
    this.surface.setAttribute('role', 'region')
    this.surface.setAttribute(
      'aria-label',
      'Explore gallery. Drag, swipe, or use arrow keys. Home returns to start.',
    )
    this.grid = this.doc.createElement('ul')
    this.grid.className = 'sg-grid'
    this.grid.setAttribute('aria-label', 'All gallery works')
    this.dock = this.doc.createElement('div')
    this.dock.className = 'sg-dock'
    host.append(this.surface, this.grid, this.dock)
    this.reduced = this.win.matchMedia('(prefers-reduced-motion: reduce)')
    this.coarse = this.win.matchMedia('(pointer: coarse)')
    this.dark = this.win.matchMedia('(prefers-color-scheme: dark)')
    this.motion = createMotion(
      this.surface,
      (position, moving) => {
        this.position = position
        this.moving = moving
        if (this.initialized) this.render()
      },
      (position) => {
        if (this.initialized) {
          this.persist()
          this.options.onPositionChange?.(position)
          this.emit('positionchange', position)
        }
      },
    )
    this.resize = new this.win.ResizeObserver(() => {
      this.width = this.surface.clientWidth || host.clientWidth || 1
      this.height = this.surface.clientHeight || host.clientHeight || 1
      this.render()
    })
    this.resize.observe(host)
    this.intersection = new this.win.IntersectionObserver(([entry]) => {
      this.near = entry.isIntersecting
      this.syncMotion()
      this.refresh()
    })
    this.intersection.observe(host)
    this.reduced.addEventListener('change', this.preferences)
    this.coarse.addEventListener('change', this.preferences)
    this.dark.addEventListener('change', this.preferences)
    this.doc.addEventListener('visibilitychange', this.visibility)
    this.surface.addEventListener('pointerleave', this.leave)
    let view = options.view ?? 'sphere'
    if (options.storageKey)
      try {
        const saved = JSON.parse(this.win.sessionStorage.getItem(options.storageKey) || 'null')
        if (saved) {
          if (saved.view === 'grid' || saved.view === 'sphere') view = saved.view
          if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) this.motion.restore(saved)
        }
      } catch {}
    this.initialized = true
    this.updateTheme()
    this.setView(this.reduced.matches ? 'grid' : view, true)
  }
  private validate(items: readonly GalleryItem[]) {
    const ids = new Set()
    for (const i of items) {
      if (!i.id || ids.has(i.id)) throw new Error('Gallery items require unique stable IDs')
      if (typeof i.alt !== 'string') throw new Error('Gallery items require accessible alt text')
      ids.add(i.id)
    }
  }
  private emit(name: string, detail: unknown) {
    this.element.dispatchEvent(new this.win.CustomEvent(name, { detail, bubbles: true }))
  }
  private preferences = () => {
    this.updateTheme()
    this.motion.setReduced(this.reduced.matches)
    if (this.reduced.matches) this.setView('grid')
    this.refresh()
  }
  private visibility = () => {
    this.syncMotion()
    this.refresh()
  }
  private leave = () => {
    this.activeKey = null
    this.refresh()
  }
  private updateTheme() {
    this.theme =
      this.options.theme === 'dark' || (this.options.theme !== 'light' && this.dark.matches)
        ? 'dark'
        : 'light'
    this.element.dataset.theme = this.theme
  }
  private syncMotion() {
    this.motion.setEnabled(this.view === 'sphere' && !this.selection && this.near && !this.doc.hidden)
    this.motion.setReduced(this.reduced.matches)
  }
  private persist() {
    if (!this.options.storageKey) return
    try {
      this.win.sessionStorage.setItem(
        this.options.storageKey,
        JSON.stringify({ view: this.view, ...this.position }),
      )
    } catch {}
  }
  getPosition() {
    return { ...this.position }
  }
  getView() {
    return this.view
  }
  reset() {
    this.motion.animateTo({ x: 0, y: 0 })
  }
  restorePosition(position: Point) {
    this.motion.restore(position)
  }
  setTheme(theme: Theme) {
    this.options.theme = theme
    this.updateTheme()
    this.refresh()
  }
  setView(view: View, force = false) {
    if (this.destroyed) return
    if (view !== 'sphere' && view !== 'grid') throw new Error('Unknown gallery view')
    if (this.reduced.matches) view = 'grid'
    if (!force && view === this.view) return
    this.view = view
    this.activeKey = null
    this.disposeTiles()
    this.surface.hidden = view !== 'sphere'
    this.grid.hidden = view !== 'grid'
    this.element.dataset.view = view
    this.syncMotion()
    this.renderToolbar()
    this.render()
    this.persist()
    this.options.onViewChange?.(view)
    this.emit('viewchange', view)
  }
  update(options: Partial<GalleryOptions>) {
    if (options.items) this.validate(options.items)
    const rebuild =
      (options.items !== undefined && options.items !== this.options.items) ||
      (options.renderCard !== undefined && options.renderCard !== this.options.renderCard) ||
      (options.renderPlaceholder !== undefined &&
        options.renderPlaceholder !== this.options.renderPlaceholder)
    this.options = { ...this.options, ...options }
    this.element.dataset.sizing = this.options.sizing ?? 'container'
    this.updateTheme()
    if (rebuild) {
      this.closePreview()
      this.pattern = galleryPattern(this.options.items.length)
      this.disposeTiles()
    }
    if (options.view) this.setView(options.view)
    this.renderToolbar()
    this.render()
    this.refresh()
  }
  private renderToolbar() {
    this.toolbar?.destroy?.()
    this.dock.replaceChildren()
    const context = {
      view: this.view,
      reducedMotion: this.reduced.matches,
      setView: (v: View) => this.setView(v),
      reset: () => this.reset(),
    }
    if (this.options.renderToolbar) {
      this.toolbar = handle(this.options.renderToolbar(context))
      this.dock.append(this.toolbar.element)
      return
    }
    const bar = this.doc.createElement('div')
    bar.className = 'sg-toolbar'
    const heading = this.doc.createElement('div')
    heading.className = 'sg-heading'
    const h = this.doc.createElement('h1')
    h.textContent = this.options.title ?? 'Gallery'
    const dot = this.doc.createElement('span')
    dot.textContent = '.'
    dot.setAttribute('aria-hidden', 'true')
    h.append(dot)
    const p = this.doc.createElement('p')
    p.textContent =
      this.view === 'grid'
        ? 'Scroll to browse · Select a project to open'
        : this.coarse.matches
          ? 'Drag to explore · Tap to open'
          : 'Drag, swipe or scroll · Arrow keys to explore'
    heading.append(h, p)
    bar.append(heading)
    const controls = this.doc.createElement('div')
    controls.className = 'sg-controls'
    const button = (text: string, label: string, action: () => void) => {
      const b = this.doc.createElement('button')
      b.type = 'button'
      b.textContent = text
      b.setAttribute('aria-label', label)
      b.addEventListener('click', action)
      b.className = 'sg-viewSwitch'
      controls.append(b)
    }
    if (this.view === 'sphere')
      button('Back to start ↺', 'Back to start', () => {
        this.reset()
        this.surface.focus({ preventScroll: true })
      })
    if (!this.reduced.matches)
      button(
        this.view === 'sphere' ? '▦ Grid view' : '◉ Explore',
        this.view === 'sphere' ? 'Grid view' : 'Explore',
        () => this.setView(this.view === 'sphere' ? 'grid' : 'sphere'),
      )
    bar.append(controls)
    this.dock.append(bar)
    this.toolbar = { element: bar }
  }
  private state(active = false): RenderState {
    return { active, theme: this.theme, moving: this.moving }
  }
  private newTile(key: string, item?: GalleryItem, artwork?: Artwork): Tile {
    const placement = this.doc.createElement(this.view === 'grid' ? 'li' : 'div')
    placement.className = this.view === 'sphere' ? 'sg-placement' : ''
    const trigger = item ? this.doc.createElement('a') : this.doc.createElement('button')
    trigger.className = 'sg-tile'
    trigger.dataset.tileKey = key
    if (trigger instanceof this.win.HTMLAnchorElement && item) {
      trigger.href = safeURL(item.destination.href)
      if (item.destination.kind === 'link' && item.destination.target) {
        trigger.target = item.destination.target
        if (trigger.target === '_blank') trigger.rel = 'noopener'
      }
    } else (trigger as HTMLButtonElement).type = 'button'
    trigger.setAttribute(
      'aria-label',
      item ? [item.title, item.category, item.accessLabel].filter(Boolean).join(' — ') : 'Generative study',
    )
    const tile: Tile = {
      placement,
      trigger,
      content: null!,
      key,
      visible: true,
      active: false,
      theme: '',
      moving: false,
      transform: '',
    }
    const pointer = (event: PointerEvent) => {
      const bounds = this.surface.getBoundingClientRect()
      const point = unprojectTilePoint(
        tile.transform.slice(9, -1).split(',').map(Number),
        event.clientX - bounds.left - bounds.width / 2,
        event.clientY - bounds.top - bounds.height / 2,
      )
      return { x: point.x / placement.offsetWidth, y: point.y / placement.offsetHeight }
    }
    if (item) {
      tile.content = this.options.renderCard
        ? handle(this.options.renderCard({ ...this.state(), item }))
        : createMedia(this.doc, item)
    } else if (this.options.renderPlaceholder) {
      tile.content = handle(
        this.options.renderPlaceholder({ ...this.state(), artwork: artwork!, pointer, preview: false }),
      )
    } else {
      const empty = this.doc.createElement('span')
      empty.className = 'sg-fallback'
      empty.textContent = 'Study'
      tile.content = { element: empty }
    }
    trigger.append(tile.content.element)
    const caption = this.doc.createElement('span')
    caption.className = 'sg-caption'
    const label = artwork ? this.options.placeholderLabel?.(artwork) : undefined
    const category = this.doc.createElement('span')
    category.textContent = item
      ? [item.category, item.accessLabel].filter(Boolean).join(' · ')
      : (label?.category ?? 'Generative study')
    const title = this.doc.createElement('strong')
    title.textContent = item?.title ?? label?.title ?? 'Study'
    caption.append(category, title)
    const arrow = this.doc.createElement('span')
    arrow.className = 'sg-openArrow'
    arrow.setAttribute('aria-hidden', 'true')
    arrow.textContent = item && (item.destination.kind === 'link' || item.destination.embed) ? '↗' : '+'
    caption.append(arrow)
    if (!this.options.renderCard || !item) trigger.append(caption)
    const activate = () => {
      if (!this.coarse.matches) {
        this.activeKey = key
        this.refresh()
      }
    }
    trigger.addEventListener('pointerenter', activate)
    trigger.addEventListener('pointermove', () => {
      if (!this.moving) activate()
    })
    trigger.addEventListener('pointerleave', () => {
      if (this.activeKey === key) {
        this.activeKey = null
        this.refresh()
      }
    })
    trigger.addEventListener('focus', () => {
      this.activeKey = key
      this.refresh()
    })
    trigger.addEventListener('blur', () => {
      if (this.activeKey === key) {
        this.activeKey = null
        this.refresh()
      }
    })
    trigger.addEventListener('click', (raw) => {
      const event = raw as MouseEvent
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const selection: Selection = item ? { item } : { artwork: artwork! }
      this.options.onSelect?.(selection)
      this.emit('select', selection)
      if (this.options.previews !== false && (!item || item.destination.kind === 'preview')) {
        event.preventDefault()
        this.openPreview(selection, trigger)
      }
    })
    placement.append(trigger)
    return tile
  }
  private render() {
    if (!this.initialized || this.destroyed) return
    if (this.view === 'grid') {
      if (!this.tiles.size)
        for (const item of this.options.items) {
          const tile = this.newTile(item.id, item)
          this.tiles.set(item.id, tile)
          this.grid.append(tile.placement)
        }
      this.refresh()
      return
    }
    this.surface.dataset.moving = String(this.moving)
    this.surface.dataset.x = this.position.x.toFixed(2)
    this.surface.dataset.y = this.position.y.toFixed(2)
    const visible = visibleTiles(this.pattern, this.position, this.width, this.height),
      canonical = new Map<string, (typeof visible)[number]>()
    let nearest: (typeof visible)[number] | undefined
    for (const t of visible) {
      if (t.distance < (canonical.get(t.id)?.distance ?? Infinity)) canonical.set(t.id, t)
      if (!nearest || t.distance < nearest.distance) nearest = t
    }
    this.nearest = nearest?.key ?? null
    const retained = new Set<string>()
    for (const t of visible) {
      retained.add(t.key)
      let tile = this.tiles.get(t.key)
      if (!tile) {
        tile = this.newTile(
          t.key,
          t.itemIndex === undefined ? undefined : this.options.items[t.itemIndex],
          t.artwork,
        )
        this.tiles.set(t.key, tile)
        this.surface.append(tile.placement)
      }
      const projection = projectTile(t.left, t.top, this.width, this.height),
        inView =
          Math.abs(projection.x) < this.width / 2 - 30 && Math.abs(projection.y) < this.height / 2 - 25,
        duplicate = canonical.get(t.id)?.key !== t.key
      tile.visible = inView
      if (tile.placement.style.width !== t.width + 'px') tile.placement.style.width = t.width + 'px'
      if (tile.placement.style.height !== t.height + 'px') tile.placement.style.height = t.height + 'px'
      const transform = tileTransform(t.left, t.top, t.width, t.height, this.width, this.height)
      tile.placement.style.transform = transform
      tile.transform = transform
      const hidden = String(duplicate || !inView),
        tabIndex = duplicate || !inView ? -1 : 0,
        nearest = String(t.key === this.nearest)
      if (tile.placement.getAttribute('aria-hidden') !== hidden)
        tile.placement.setAttribute('aria-hidden', hidden)
      if (tile.trigger.tabIndex !== tabIndex) tile.trigger.tabIndex = tabIndex
      if (tile.trigger.dataset.nearest !== nearest) tile.trigger.dataset.nearest = nearest
    }
    for (const [key, tile] of this.tiles)
      if (!retained.has(key)) {
        tile.content.destroy?.()
        tile.placement.remove()
        this.tiles.delete(key)
      }
    this.refresh()
  }
  private refresh() {
    if (this.destroyed) return
    const playing = this.near && !this.doc.hidden && !this.moving && !this.selection && !this.reduced.matches
    const activated = this.coarse.matches && this.view === 'sphere' ? this.nearest : this.activeKey
    for (const tile of this.tiles.values()) {
      const active = playing && tile.visible && activated === tile.key
      if (tile.active !== active || tile.theme !== this.theme || tile.moving !== this.moving) {
        tile.active = active
        tile.theme = this.theme
        tile.moving = this.moving
        tile.content.update?.(this.state(active))
      }
    }
    this.preview?.update?.(this.state(!this.doc.hidden && !this.reduced.matches && this.near))
  }
  openPreview(value: Selection | string, trigger?: HTMLElement) {
    const selection =
      typeof value === 'string'
        ? (() => {
            const item = this.options.items.find((i) => i.id === value)
            if (!item) throw new Error('Unknown gallery item')
            return { item }
          })()
        : value
    this.closePreview()
    this.selection = selection
    this.syncMotion()
    this.refresh()
    this.preview = createPreview(
      this.element,
      selection,
      this.options,
      this.state(!this.reduced.matches && !this.doc.hidden),
      () => this.closePreview(),
      trigger,
    )
    this.options.onPreviewChange?.(selection)
    this.emit('previewchange', selection)
  }
  closePreview() {
    if (!this.selection) return
    this.preview?.destroy?.()
    this.preview = undefined
    this.selection = null
    this.syncMotion()
    this.refresh()
    this.options.onPreviewChange?.(null)
    this.emit('previewchange', null)
  }
  private disposeTiles() {
    for (const tile of this.tiles.values()) {
      tile.content.destroy?.()
      tile.placement.remove()
    }
    this.tiles.clear()
  }
  destroy() {
    if (this.destroyed) return
    this.closePreview()
    this.destroyed = true
    this.motion.destroy()
    this.resize.disconnect()
    this.intersection.disconnect()
    this.reduced.removeEventListener('change', this.preferences)
    this.coarse.removeEventListener('change', this.preferences)
    this.dark.removeEventListener('change', this.preferences)
    this.doc.removeEventListener('visibilitychange', this.visibility)
    this.surface.removeEventListener('pointerleave', this.leave)
    this.toolbar?.destroy?.()
    this.disposeTiles()
    this.element.replaceChildren(...this.original)
    if (!this.hadClass) this.element.classList.remove('sg-gallery')
    for (const name of ['view', 'sizing', 'theme'] as const) {
      const previous = this.originalData[name]
      if (previous === undefined) delete this.element.dataset[name]
      else this.element.dataset[name] = previous
    }
  }
}
export function createGallery(host: HTMLElement, options: GalleryOptions) {
  return new GalleryController(host, options)
}
