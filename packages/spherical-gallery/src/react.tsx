'use client'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { createGallery, type GalleryController } from './gallery.js'
import {
  sourceFor,
  safeURL,
  type CardContext,
  type PlaceholderContext,
  type PreviewContext,
  type ToolbarContext,
  type GalleryOptions,
  type RenderState,
} from './types.js'
export type GallerySlots = {
  card?: (context: CardContext) => ReactNode
  placeholder?: (context: PlaceholderContext) => ReactNode
  toolbar?: (context: ToolbarContext) => ReactNode
  preview?: (context: PreviewContext) => ReactNode
}
export type SphericalGalleryProps = GalleryOptions & {
  slots?: GallerySlots
  className?: string
  style?: CSSProperties
  id?: string
}
export const SphericalGallery = forwardRef<GalleryController, SphericalGalleryProps>(
  function SphericalGallery(props, ref) {
    const { items, slots, className, style, id } = props
    const mount = useRef<HTMLDivElement>(null),
      controller = useRef<GalleryController | null>(null)
    const [ready, setReady] = useState(false),
      [portals, setPortals] = useState<{ id: number; node: ReactNode; host: HTMLElement }[]>([])
    const registry = useRef(new Map<number, { id: number; node: ReactNode; host: HTMLElement }>()),
      counter = useRef(0),
      live = useRef(false),
      queued = useRef(false)
    const schedule = () => {
      if (!live.current || queued.current) return
      queued.current = true
      queueMicrotask(() => {
        queued.current = false
        if (live.current) setPortals([...registry.current.values()])
      })
    }
    const renderers = useMemo(() => {
      function bind<T extends object>(slot: ((context: T) => ReactNode) | undefined) {
        if (!slot) return undefined
        return (context: T) => {
          const host = document.createElement('span'),
            key = counter.current++
          host.style.display = 'contents'
          const entry = { id: key, host, node: slot(context) }
          registry.current.set(key, entry)
          schedule()
          return {
            element: host,
            update: (state: RenderState) => {
              entry.node = slot({ ...context, ...state })
              schedule()
            },
            destroy: () => {
              registry.current.delete(key)
              schedule()
            },
          }
        }
      }
      return {
        renderCard: bind(slots?.card),
        renderPlaceholder: bind(slots?.placeholder),
        renderToolbar: bind(slots?.toolbar),
        renderPreview: bind(slots?.preview),
      }
    }, [slots?.card, slots?.placeholder, slots?.toolbar, slots?.preview])
    const options = useMemo<GalleryOptions>(() => {
      const result: GalleryOptions = {
        items,
        title: props.title,
        theme: props.theme,
        sizing: props.sizing,
        view: props.view,
        storageKey: props.storageKey,
        placeholderLabel: props.placeholderLabel,
        previews: props.previews,
        onViewChange: props.onViewChange,
        onSelect: props.onSelect,
        onPositionChange: props.onPositionChange,
        onPreviewChange: props.onPreviewChange,
        renderCard: props.renderCard,
        renderPlaceholder: props.renderPlaceholder,
        renderToolbar: props.renderToolbar,
        renderPreview: props.renderPreview,
      }
      for (const key of ['renderCard', 'renderPlaceholder', 'renderToolbar', 'renderPreview'] as const)
        if (renderers[key]) (result as any)[key] = renderers[key]
      return result
    }, [
      items,
      props.title,
      props.theme,
      props.sizing,
      props.view,
      props.storageKey,
      props.placeholderLabel,
      props.previews,
      props.onViewChange,
      props.onSelect,
      props.onPositionChange,
      props.onPreviewChange,
      props.renderCard,
      props.renderPlaceholder,
      props.renderToolbar,
      props.renderPreview,
      renderers,
    ])
    const initial = useRef(options)
    useEffect(() => {
      live.current = true
      controller.current = createGallery(mount.current!, initial.current)
      setReady(true)
      schedule()
      return () => {
        live.current = false
        controller.current?.destroy()
        controller.current = null
        registry.current.clear()
      }
    }, [])
    const previous = useRef(options)
    useEffect(() => {
      if (previous.current === options) return
      previous.current = options
      controller.current?.update(options)
    }, [options])
    useImperativeHandle(ref, () => controller.current!, [ready])
    return (
      <div id={id} className={className} style={style}>
        {!ready && (
          <div className="sg-gallery" data-view="grid" data-theme={props.theme === 'dark' ? 'dark' : 'light'}>
            <ul className="sg-grid" aria-label="All gallery works">
              {items.map((item) => (
                <li key={item.id}>
                  <a className="sg-tile" href={safeURL(item.destination.href)}>
                    {slots?.card ? (
                      slots.card({
                        item,
                        active: false,
                        theme: props.theme === 'dark' ? 'dark' : 'light',
                        moving: false,
                      })
                    ) : (
                      <>
                        <span className="sg-media">
                          {item.poster && (
                            <img
                              src={safeURL(
                                sourceFor(item.poster, props.theme === 'dark' ? 'dark' : 'light')!,
                              )}
                              alt={item.alt}
                            />
                          )}
                        </span>
                        <span className="sg-caption">
                          <span>{[item.category, item.accessLabel].filter(Boolean).join(' · ')}</span>
                          <strong>{item.title}</strong>
                        </span>
                      </>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div ref={mount} />
        {portals.map((p) => createPortal(p.node, p.host, String(p.id)))}
      </div>
    )
  },
)
