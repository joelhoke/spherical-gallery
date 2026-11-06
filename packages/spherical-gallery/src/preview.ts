import {
  handle,
  safeURL,
  type RenderHandle,
  type RenderState,
  type Selection,
  type GalleryOptions,
} from './types.js'
export function createPreview(
  host: HTMLElement,
  selection: Selection,
  options: GalleryOptions,
  state: RenderState,
  onClose: () => void,
  opener?: HTMLElement,
): RenderHandle {
  const doc = host.ownerDocument,
    win = doc.defaultView!,
    trigger = opener ?? (doc.activeElement as HTMLElement | null)
  const dialog = doc.createElement('dialog')
  dialog.className = 'sg-dialog'
  dialog.setAttribute('aria-label', 'item' in selection ? selection.item.title : 'Generative study')
  const body = doc.createElement('section')
  body.className = 'sg-dialogBody'
  dialog.append(body)
  const header = doc.createElement('header'),
    heading = doc.createElement('h2')
  heading.textContent =
    'item' in selection
      ? selection.item.title
      : `${options.placeholderLabel?.(selection.artwork)?.title ?? 'Generative study'} / ${String(selection.artwork.seed).slice(-4)}`
  header.append(heading)
  const close = doc.createElement('button')
  close.type = 'button'
  close.textContent = 'Close ×'
  close.setAttribute('aria-label', 'Close preview')
  close.addEventListener('click', onClose)
  header.append(close)
  body.append(header)
  const stage = doc.createElement('div')
  stage.className = 'sg-dialogStage'
  body.append(stage)
  const footer = doc.createElement('footer')
  body.append(footer)
  const expand = doc.createElement('button')
  expand.type = 'button'
  expand.className = 'sg-fullscreenButton'
  expand.textContent = '⛶'
  expand.setAttribute('aria-label', 'Expand preview')
  body.append(expand)
  let expanded = false,
    custom: RenderHandle | undefined,
    frame: HTMLIFrameElement | undefined,
    video: HTMLVideoElement | undefined,
    origin: string | undefined,
    disposed = false
  const setExpanded = (value: boolean) => {
    expanded = value
    dialog.dataset.expanded = String(value)
    expand.setAttribute('aria-label', value ? 'Collapse preview' : 'Expand preview')
  }
  expand.addEventListener('click', () => setExpanded(!expanded))
  const escape = () => {
    if (expanded) setExpanded(false)
    else onClose()
  }
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault()
    escape()
  })
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button,a[href],input,select,textarea,iframe,[tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0)
    const first = focusable[0],
      last = focusable[focusable.length - 1]
    if (e.shiftKey && doc.activeElement === first) {
      e.preventDefault()
      last?.focus()
    } else if (!e.shiftKey && doc.activeElement === last) {
      e.preventDefault()
      first?.focus()
    }
  })
  let backdropDown = false
  const outside = (e: MouseEvent) => {
    const r = dialog.getBoundingClientRect()
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
  }
  dialog.addEventListener('pointerdown', (e) => {
    backdropDown = e.target === dialog && outside(e)
  })
  dialog.addEventListener('click', (e) => {
    if (backdropDown && e.target === dialog && outside(e)) onClose()
    backdropDown = false
  })
  if (options.renderPreview) {
    custom = handle(options.renderPreview({ ...state, selection, close: onClose }))
    stage.append(custom.element)
  } else if ('item' in selection) {
    const item = selection.item,
      d = item.destination
    if (d.kind === 'preview' && d.media === 'image') {
      const img = doc.createElement('img')
      img.src = safeURL(d.href)
      img.alt = d.alt ?? item.alt
      stage.append(img)
    }
    if (d.kind === 'preview' && d.media === 'video') {
      video = doc.createElement('video')
      video.src = safeURL(d.href)
      video.controls = true
      video.playsInline = true
      if (d.poster) video.poster = safeURL(d.poster)
      if (d.captions) {
        const track = doc.createElement('track')
        track.kind = 'captions'
        track.src = safeURL(d.captions)
        track.label = 'Captions'
        track.srclang = 'en'
        video.append(track)
      }
      stage.append(video)
    }
    if (d.kind === 'preview' && d.embed) {
      try {
        const url = new URL(d.embed.src ?? d.href, doc.baseURI)
        const allowed = new URL(d.embed.origin)
        if (
          /^https?:$/.test(url.protocol) &&
          url.origin === allowed.origin &&
          d.embed.origin === allowed.origin
        ) {
          origin = allowed.origin
          frame = doc.createElement('iframe')
          frame.title = item.title
          frame.src = url.href
          frame.className = 'sg-experienceFrame'
          frame.setAttribute('sandbox', d.embed.sandbox ?? 'allow-scripts allow-forms')
          if (d.embed.allow) frame.allow = d.embed.allow
          stage.append(frame)
          dialog.dataset.experience = 'true'
        }
      } catch {
        /* A normal destination link remains available. */
      }
    }
    const link = doc.createElement('a')
    link.href = safeURL(d.href)
    link.textContent = 'Open directly ↗'
    link.target = '_blank'
    link.rel = 'noopener'
    footer.append(link)
    if (d.kind === 'preview' && d.caption) {
      const p = doc.createElement('p')
      p.textContent = d.caption
      footer.prepend(p)
    }
    if (d.kind === 'preview' && d.captionLink) {
      const a = doc.createElement('a')
      a.href = safeURL(d.captionLink.href)
      a.textContent = d.captionLink.label
      footer.append(a)
    }
    if (!stage.childNodes.length) {
      const p = doc.createElement('p')
      p.textContent = 'Open this destination using the link below.'
      stage.append(p)
    }
  } else if (options.renderPlaceholder) {
    custom = handle(
      options.renderPlaceholder({
        ...state,
        artwork: selection.artwork,
        preview: true,
        pointer: (e) => {
          const r = stage.getBoundingClientRect()
          return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
        },
      }),
    )
    stage.append(custom.element)
  }
  const message = (e: MessageEvent) => {
    if (!frame || !origin || e.source !== frame.contentWindow || e.origin !== origin) return
    if (e.data?.type === 'gallery:close') onClose()
    if (e.data?.type === 'gallery:escape') escape()
  }
  win.addEventListener('message', message)
  host.append(dialog)
  dialog.showModal()
  close.focus()
  const visibility = () => {
    if (doc.hidden) video?.pause()
  }
  doc.addEventListener('visibilitychange', visibility)
  if (video && state.active) void video.play().catch(() => {})
  return {
    element: dialog,
    update(next) {
      custom?.update?.(next)
      if (!next.active) video?.pause()
    },
    destroy() {
      if (disposed) return
      disposed = true
      custom?.destroy?.()
      video?.pause()
      if (frame) frame.src = 'about:blank'
      win.removeEventListener('message', message)
      doc.removeEventListener('visibilitychange', visibility)
      dialog.close()
      dialog.remove()
      if (trigger?.isConnected) trigger.focus({ preventScroll: true })
      else host.querySelector<HTMLElement>('.sg-surface,button,a')?.focus({ preventScroll: true })
    },
  }
}
/** Install in an opted-in frame. Both sides must configure exact origins. */
export function installPreviewBridge(options: { parentOrigin: string; window?: Window }) {
  const win = options.window ?? window,
    origin = new URL(options.parentOrigin).origin
  if (origin !== options.parentOrigin || origin === 'null')
    throw new Error('An exact parent origin is required')
  const send = (type: 'gallery:close' | 'gallery:escape') => {
    if (win.parent !== win) win.parent.postMessage({ type }, origin)
  }
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault()
      send('gallery:escape')
    }
  }
  win.addEventListener('keydown', key)
  return { close: () => send('gallery:close'), destroy: () => win.removeEventListener('keydown', key) }
}
