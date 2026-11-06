import type { Artwork, Point } from './geometry.js'
export type Theme = 'light' | 'dark' | 'system'
export type View = 'sphere' | 'grid'
export type ThemedSource = string | { light: string; dark?: string }
export type Destination =
  | { kind: 'link'; href: string; target?: '_self' | '_blank' }
  | {
      kind: 'preview'
      href: string
      media?: 'image' | 'video'
      alt?: string
      poster?: string
      captions?: string
      caption?: string
      captionLink?: { href: string; label: string }
      embed?: { origin: string; src?: string; sandbox?: string; allow?: string }
    }
export type GalleryItem = {
  id: string
  title: string
  category?: string
  accessLabel?: string
  alt: string
  poster?: ThemedSource
  preview?: ThemedSource
  destination: Destination
}
export type RenderState = { active: boolean; theme: 'light' | 'dark'; moving: boolean }
export type PointerAdapter = (event: PointerEvent) => Point
export type RenderHandle = {
  element: HTMLElement
  update?: (state: RenderState) => void
  destroy?: () => void
}
export type RenderResult = HTMLElement | RenderHandle
export type CardContext = RenderState & { item: GalleryItem }
export type PlaceholderContext = RenderState & { artwork: Artwork; pointer: PointerAdapter; preview: boolean }
export type Selection = { item: GalleryItem } | { artwork: Artwork }
export type PreviewContext = RenderState & { selection: Selection; close: () => void }
export type ToolbarContext = {
  view: View
  reducedMotion: boolean
  setView: (view: View) => void
  reset: () => void
}
export type GalleryOptions = {
  items: readonly GalleryItem[]
  title?: string
  view?: View
  theme?: Theme
  sizing?: 'container' | 'viewport'
  storageKey?: string
  previews?: boolean
  placeholderLabel?: (artwork: Artwork) => { title: string; category?: string }
  renderCard?: (context: CardContext) => RenderResult
  renderPlaceholder?: (context: PlaceholderContext) => RenderResult
  renderToolbar?: (context: ToolbarContext) => RenderResult
  renderPreview?: (context: PreviewContext) => RenderResult
  onViewChange?: (view: View) => void
  onSelect?: (selection: Selection) => void
  onPositionChange?: (position: Point) => void
  onPreviewChange?: (selection: Selection | null) => void
}
export function sourceFor(source: ThemedSource | undefined, theme: 'light' | 'dark') {
  return typeof source === 'string'
    ? source
    : theme === 'dark'
      ? (source?.dark ?? source?.light)
      : source?.light
}
/** Allow ordinary navigation/media URLs, rejecting executable URL schemes. */
export function safeURL(value: string): string {
  try {
    const url = new URL(value, 'https://gallery.invalid/')
    return ['http:', 'https:', 'blob:'].includes(url.protocol) ? value : '#'
  } catch {
    return '#'
  }
}
export function handle(result: RenderResult): RenderHandle {
  return 'element' in result ? result : { element: result }
}
