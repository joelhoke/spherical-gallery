import { PALETTES, type Palette } from './palettes.js'
import { createFrameLoop } from './engine/frameLoop.js'
import { stepGlyphParticle } from './engine/glyphPhysics.js'
import { applyRadialImpulse } from './engine/impulse.js'
import { RIPPLE_DEFAULTS, createRippleStore, spawnRipple, applyRippleForces } from './engine/ripple.js'
export type MeshOptions = {
  seed?: number
  palette?: string | readonly string[] | Palette
  renderer?: 'pixels' | 'ascii'
  glyphs?: string
  font?: string
  fontSize?: number
  density?: number
  aspectRatio?: number
  motion?: boolean
  speed?: number
  active?: boolean
  interactive?: boolean
  overlay?: HTMLElement
  pointer?: (event: PointerEvent) => { x: number; y: number }
}
export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
}
export function resolvePalette(value: MeshOptions['palette']): readonly string[] {
  const colors =
    typeof value === 'string'
      ? PALETTES.find((p) => p.id === value)?.colors
      : Array.isArray(value)
        ? value
        : (value as Palette | undefined)?.colors
  if (value && !colors) throw new Error('Unknown palette')
  const result = colors ?? PALETTES[0].colors
  if (!result.length || result.some((c) => !/^#[0-9a-f]{6}$/i.test(c)))
    throw new Error('Palette colors must be six-digit hex colors')
  return result
}
export function createSeededMesh(seed: number, colors: readonly string[]) {
  const random = seededRandom(seed)
  return {
    size: 24 + Math.floor(random() * 24),
    points: colors.map((hex) => ({
      x: random(),
      y: random(),
      phase: random() * Math.PI * 2,
      speed: 0.2 + random() * 0.25,
      color: [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)),
    })),
  }
}
/** Coordinates supplied by pointer() are normalized local positions, before projection. */
export function createMeshBackground(container: HTMLElement, options: MeshOptions = {}) {
  if (
    options.density !== undefined &&
    (!Number.isFinite(options.density) ||
      options.density < 4 ||
      options.density > 160 ||
      !Number.isInteger(options.density))
  )
    throw new Error('density must be an integer from 4 to 160')
  if (
    options.fontSize !== undefined &&
    (!Number.isFinite(options.fontSize) || options.fontSize < 1 || options.fontSize > 128)
  )
    throw new Error('fontSize must be from 1 to 128')
  if (
    options.aspectRatio !== undefined &&
    (!Number.isFinite(options.aspectRatio) || options.aspectRatio <= 0 || options.aspectRatio > 4)
  )
    throw new Error('aspectRatio must be greater than zero and at most 4')
  if (options.glyphs === '') throw new Error('Provide at least one glyph')
  const colors = resolvePalette(options.palette),
    mesh = createSeededMesh(options.seed ?? 104729, colors)
  if (options.speed !== undefined && (!Number.isFinite(options.speed) || options.speed < 0))
    throw new Error('speed must be a finite nonnegative number')
  const doc = container.ownerDocument,
    win = doc.defaultView!,
    element = doc.createElement('span'),
    canvas = doc.createElement('canvas')
  element.className = 'mb-background'
  element.dataset.renderer = options.renderer ?? 'ascii'
  element.dataset.interactive = String(!!options.interactive)
  element.style.cssText = 'display:block;position:relative;width:100%;height:100%;overflow:hidden'
  canvas.style.cssText =
    'display:block;width:100%;height:100%;' +
    (options.renderer === 'pixels' ? 'image-rendering:pixelated' : '')
  canvas.setAttribute('aria-hidden', 'true')
  element.append(canvas)
  if (options.overlay) element.append(options.overlay)
  container.append(element)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    element.remove()
    throw new Error('Canvas 2D is unavailable')
  }
  element.style.background = colors[0]
  const interactive = !!options.interactive,
    ascii = options.renderer !== 'pixels'
  if (interactive) {
    element.tabIndex = 0
    element.setAttribute('role', 'group')
    element.setAttribute(
      'aria-label',
      'Interactive glyph mesh. Move to bend glyphs; click or press Space to ripple.',
    )
    element.style.touchAction = 'none'
  }
  let active = options.active ?? true,
    near = false,
    warmed = false,
    reduced = win.matchMedia('(prefers-reduced-motion: reduce)').matches
  const canAnimate = () => warmed && active && near && !doc.hidden && !reduced && options.motion !== false
  const cols = options.density ?? mesh.size,
    rows = Math.max(1, Math.round(cols * (options.aspectRatio ?? 0.75)))
  const cell = Math.round((options.fontSize ?? 12) * 1.42)
  canvas.width = ascii ? cols * cell : cols
  canvas.height = ascii ? rows * cell : rows
  const field = doc.createElement('canvas')
  field.width = cols
  field.height = rows
  const fieldContext = field.getContext('2d')!
  const frame = fieldContext.createImageData(cols, rows)
  const glyphs = Array.from(options.glyphs ?? '.:+*=#@')
  const luminance = (color: number[]) => color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722
  const sorted = [...mesh.points].sort((a, b) => luminance(a.color) - luminance(b.color))
  const particles = Array.from({ length: cols * rows }, (_, i) => {
    const x = ((i % cols) + 0.5) * cell,
      y = (Math.floor(i / cols) + 0.5) * cell
    return { x, y, tx: x, ty: y, vx: 0, vy: 0 }
  })
  const ripples = createRippleStore(RIPPLE_DEFAULTS.maxConcurrent)
  const pointer = { x: -9999, y: -9999, active: false, influence: 0 }
  const velocity = { x: 0, y: 0, lastX: 0, lastY: 0 }
  let last = 0,
    lastFrame = 0,
    elapsed = 0,
    fadeUntil = 0,
    held = false,
    dragEase = 0
  const host = element
  const locate = (event: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect()
    const point = options.pointer?.(event) ?? {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    }
    return { x: point.x * canvas.width, y: point.y * canvas.height }
  }
  const move = (event: PointerEvent) => {
    if (!canAnimate() || (event.pointerType === 'touch' && !interactive)) return
    const point = locate(event)
    if (!pointer.active) {
      velocity.lastX = point.x
      velocity.lastY = point.y
      velocity.x = 0
      velocity.y = 0
    }
    Object.assign(pointer, point, { active: true, influence: 1 })
    fadeUntil = 0
  }
  const impact = (x: number, y: number) => {
    if (!canAnimate() || !ascii) return
    spawnRipple(ripples, x, y, elapsed, 1, velocity.x, velocity.y, RIPPLE_DEFAULTS)
    applyRadialImpulse(particles, x, y, 200, 10 * 0.35)
  }
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || !canAnimate()) return
    move(event)
    held = true
    if (interactive) {
      host.setPointerCapture(event.pointerId)
      impact(pointer.x, pointer.y)
    }
    // Thumbnail press belongs to gallery navigation; its open study owns click/drag ripples.
  }
  const up = (event: PointerEvent) => {
    held = false
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId)
  }
  const leave = () => {
    pointer.active = false
    held = false
    fadeUntil = performance.now() + 350
  }
  const key = (event: KeyboardEvent) => {
    if (interactive && (event.key === ' ' || event.key === 'Enter')) {
      event.preventDefault()
      impact(canvas.width / 2, canvas.height / 2)
    }
  }
  host.addEventListener('pointerenter', move)
  host.addEventListener('pointermove', move)
  host.addEventListener('pointerdown', down)
  host.addEventListener('pointerup', up)
  host.addEventListener('pointercancel', leave)
  host.addEventListener('pointerleave', leave)
  host.addEventListener('keydown', key)
  const draw = (time: number) => {
    // Color sampling stays at 25fps; shared glyph physics runs at the hero's frame cadence.
    const sample = time === 0 || time - last >= 40
    if (sample) last = time
    if (time && lastFrame) elapsed += Math.min(40, time - lastFrame)
    const t = (elapsed / 1000) * (options.speed ?? 1)
    const points = mesh.points.map((p) => ({
      ...p,
      x: p.x + Math.sin(t * p.speed + p.phase) * 0.24,
      y: p.y + Math.cos(t * p.speed + p.phase) * 0.24,
    }))
    if (sample)
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          let sum = 0
          const color = [0, 0, 0]
          for (const p of points) {
            const d = (x / cols - p.x) ** 2 + (y / rows - p.y) ** 2
            const weight = 1 / (0.008 + d * d)
            sum += weight
            for (let c = 0; c < 3; c++) color[c] += p.color[c] * weight
          }
          const i = (y * cols + x) * 4
          for (let c = 0; c < 3; c++) frame.data[i + c] = color[c] / sum
          frame.data[i + 3] = 255
        }
    if (!ascii) ctx.putImageData(frame, 0, 0)
    else {
      if (sample) fieldContext.putImageData(frame, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(field, 0, 0, canvas.width, canvas.height)
      ctx.font = `400 ${options.fontSize ?? 12}px ${options.font ?? 'ui-monospace, monospace'}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (canAnimate() && time) {
        const dt = Math.max(1, time - (lastFrame || time))
        velocity.x += (((pointer.x - velocity.lastX) / dt) * 1000 - velocity.x) * 0.35
        velocity.y += (((pointer.y - velocity.lastY) / dt) * 1000 - velocity.y) * 0.35
        velocity.lastX = pointer.x
        velocity.lastY = pointer.y
        dragEase += ((held ? 1 : 0) - dragEase) * (1 - Math.exp(-dt / (held ? 200 : 250)))
        applyRippleForces(ripples, particles, elapsed, RIPPLE_DEFAULTS)
        const influence = pointer.active ? 1 : Math.max(0, (fadeUntil - time) / 350)
        const currentPointer = { ...pointer, active: influence > 0, influence }
        const radius = 225 * (1 + 0.6 * dragEase)
        for (const particle of particles) stepGlyphParticle(particle, currentPointer, radius, 0.48)
      }
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4
          const luma = luminance([frame.data[i], frame.data[i + 1], frame.data[i + 2]])
          const low = sorted[0].color,
            high = sorted[sorted.length - 1].color
          const ink = Math.abs(luma - luminance(low)) > Math.abs(luma - luminance(high)) ? low : high
          // Palette-only ink; density follows the moving field rather than flickering randomly.
          ctx.fillStyle = `rgba(${ink.join(',')}, .72)`
          const density = Math.min(glyphs.length - 1, Math.floor((luma / 256) * glyphs.length))
          const particle = particles[y * cols + x]
          ctx.fillText(glyphs[density], particle.x, particle.y)
        }
    }
    lastFrame = time
  }
  const loop = createFrameLoop({
    frame: draw,
    isParked: () => !canAnimate(),
    keepRunning: canAnimate,
    requestFrame: (cb) => win.requestAnimationFrame(cb),
    cancelFrame: (id) => win.cancelAnimationFrame(id),
  })
  const sync = () => {
    // Exclude paused time from mesh flow and pointer velocity calculations.
    lastFrame = 0
    if (canAnimate()) loop.resume()
    else {
      loop.park()
      pointer.active = false
      held = false
      fadeUntil = 0
      velocity.x = 0
      velocity.y = 0
    }
  }

  sync()
  doc.addEventListener('visibilitychange', sync)
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)')
  const preference = () => {
    reduced = motion.matches
    sync()
  }
  motion.addEventListener('change', preference)
  preference()
  const warmer = new win.IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !warmed) {
        warmed = true
        draw(0)
        sync()
        warmer.disconnect()
      }
    },
    { rootMargin: '180px' },
  )
  warmer.observe(element)
  const observer = new win.IntersectionObserver(([entry]) => {
    near = entry.isIntersecting
    sync()
  })
  observer.observe(element)
  return {
    element,
    setActive(value: boolean) {
      if (active === value) return
      active = value
      sync()
    },
    getPhase: () => elapsed,
    destroy() {
      observer.disconnect()
      warmer.disconnect()
      motion.removeEventListener('change', preference)
      loop.dispose()
      doc.removeEventListener('visibilitychange', sync)
      host.removeEventListener('pointerenter', move)
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerdown', down)
      host.removeEventListener('pointerup', up)
      host.removeEventListener('pointercancel', leave)
      host.removeEventListener('pointerleave', leave)
      host.removeEventListener('keydown', key)
      element.remove()
    },
  }
}
