import { sourceFor, safeURL, type GalleryItem, type RenderHandle, type RenderState } from './types.js'
export function createMedia(doc: Document, item: GalleryItem): RenderHandle {
  const root = doc.createElement('span')
  root.className = 'sg-media'
  const fallback = doc.createElement('span')
  fallback.className = 'sg-fallback'
  fallback.textContent = item.title
  fallback.setAttribute('aria-hidden', 'true')
  root.append(fallback)
  const image = doc.createElement('img')
  image.alt = item.alt
  image.loading = 'lazy'
  image.decoding = 'async'
  image.draggable = false
  root.append(image)
  let video: HTMLVideoElement | null = null,
    poster = '',
    clip = '',
    active = false,
    disposed = false,
    epoch = 0,
    near = false
  let latest: RenderState | undefined
  const observer = new doc.defaultView!.IntersectionObserver(([entry]) => {
    near = entry.isIntersecting
    if (latest) result.update?.(latest)
  })
  observer.observe(root)
  const failed = new Set<string>()
  image.addEventListener('error', () => {
    image.hidden = true
  })
  const result: RenderHandle = {
    element: root,
    update(state: RenderState) {
      if (disposed) return
      latest = state
      const shouldPlay = state.active && near
      if (!near && video) video.style.opacity = '0'
      const nextPoster = sourceFor(item.poster, state.theme) || '',
        nextClip = sourceFor(item.preview, state.theme) || ''
      if (nextPoster !== poster) {
        poster = nextPoster
        image.hidden = !poster
        if (poster) image.src = safeURL(poster)
        else image.removeAttribute('src')
      }
      if (clip !== nextClip) {
        clip = nextClip
        epoch++
        video?.pause()
        video?.remove()
        video = null
        active = false
      }
      if (shouldPlay && clip && !failed.has(clip) && !video) {
        const v = doc.createElement('video')
        video = v
        v.muted = true
        v.loop = true
        v.playsInline = true
        v.preload = 'none'
        v.setAttribute('aria-hidden', 'true')
        v.style.opacity = '0'
        v.src = safeURL(clip)
        root.append(v)
        v.addEventListener('playing', () => {
          if (v === video) v.style.opacity = '1'
        })
        v.addEventListener('error', () => {
          failed.add(clip)
          v.style.opacity = '0'
          v.pause()
        })
      }
      if (shouldPlay === active) return
      active = shouldPlay
      const version = ++epoch
      if (active && video && !failed.has(clip)) {
        const v = video
        void v
          .play()
          .then(() => {
            if (disposed || !active || version !== epoch) v.pause()
          })
          .catch(() => {
            if (version === epoch) {
              failed.add(clip)
              v.style.opacity = '0'
            }
          })
      } else video?.pause()
    },
    destroy() {
      disposed = true
      observer.disconnect()
      epoch++
      video?.pause()
      video?.removeAttribute('src')
      video?.load()
      root.remove()
    },
  }
  return result
}
