import { createGalleryWheelInput, type Point } from './geometry.js'
export function createMotion(
  surface: HTMLElement,
  changed: (position: Point, moving: boolean) => void,
  settled: (position: Point) => void,
) {
  const win = surface.ownerDocument.defaultView!,
    doc = surface.ownerDocument
  let current: Point = { x: 0, y: 0 },
    target = { ...current },
    velocity = { ...current }
  let frame = 0,
    lastTime = 0,
    settleAt = 0,
    enabled = true,
    reduced = false,
    disposed = false,
    focusAfter = false
  let journey: { from: Point; to: Point; start: number; duration: number } | null = null
  let drag: {
    id: number
    x: number
    y: number
    lastX: number
    lastY: number
    time: number
    moved: boolean
  } | null = null
  let suppressClick = false
  const wheelInput = createGalleryWheelInput()
  const animate = (time: number) => {
    frame = 0
    if (!enabled || disposed) return
    const dt = Math.min(32, time - (lastTime || time - 16))
    lastTime = time
    if (journey) {
      const p = Math.max(0, Math.min(1, (time - journey.start) / journey.duration)),
        eased = p * p * p * (p * (p * 6 - 15) + 10)
      current =
        p === 1
          ? { ...journey.to }
          : {
              x: journey.from.x + (journey.to.x - journey.from.x) * eased,
              y: journey.from.y + (journey.to.y - journey.from.y) * eased,
            }
      target = { ...current }
      if (p === 1) journey = null
    } else {
      if (!drag) {
        target.x += velocity.x * dt
        target.y += velocity.y * dt
        const f = Math.exp(-dt / 180)
        velocity.x *= f
        velocity.y *= f
      }
      const a = reduced || drag ? 1 : 1 - Math.exp(-dt / 55)
      current = { x: current.x + (target.x - current.x) * a, y: current.y + (target.y - current.y) * a }
    }
    const busy =
      Boolean(journey || drag?.moved) ||
      Math.hypot(target.x - current.x, target.y - current.y) > 0.1 ||
      Math.hypot(velocity.x, velocity.y) > 0.005 ||
      time < settleAt
    changed({ ...current }, busy)
    if (busy) frame = win.requestAnimationFrame(animate)
    else {
      velocity = { x: 0, y: 0 }
      lastTime = 0
      settled({ ...current })
      if (focusAfter) {
        focusAfter = false
        surface.querySelector<HTMLElement>('[data-nearest=true]')?.focus({ preventScroll: true })
      }
    }
  }
  const wake = () => {
    if (enabled && !disposed && !frame) {
      changed({ ...current }, true)
      frame = win.requestAnimationFrame(animate)
    }
  }
  const move = (x: number, y: number) => {
    if (!enabled) return
    if (journey) {
      journey = null
      target = { ...current }
    }
    target = { x: target.x + x, y: target.y + y }
    velocity = { x: 0, y: 0 }
    wake()
  }
  const release = () => {
    if (drag && surface.hasPointerCapture(drag.id)) surface.releasePointerCapture(drag.id)
    drag = null
    delete surface.dataset.dragging
  }
  const stop = () => {
    journey = null
    release()
    velocity = { x: 0, y: 0 }
    target = { ...current }
    win.cancelAnimationFrame(frame)
    frame = 0
    lastTime = 0
    settleAt = 0
    changed({ ...current }, false)
  }
  const restore = (point: Point) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return
    stop()
    current = { ...point }
    target = { ...point }
    changed({ ...current }, false)
    settled({ ...current })
  }
  const animateTo = (point: Point) => {
    const distance = Math.hypot(point.x - current.x, point.y - current.y)
    if (!Number.isFinite(distance)) return
    if (reduced || !enabled || distance < 0.1) {
      restore(point)
      return
    }
    velocity = { x: 0, y: 0 }
    journey = {
      from: { ...current },
      to: { ...point },
      start: win.performance.now(),
      duration: Math.min(1200, Math.max(500, Math.sqrt(distance) * 24)),
    }
    wake()
  }
  const down = (e: PointerEvent) => {
    if (!enabled || !e.isPrimary || e.button !== 0 || e.ctrlKey || e.metaKey) return
    journey = null
    suppressClick = false
    velocity = { x: 0, y: 0 }
    target = { ...current }
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      time: e.timeStamp,
      moved: false,
    }
  }
  const pointerMove = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 7) return
    if (!drag.moved) {
      surface.setPointerCapture(e.pointerId)
      drag.moved = true
      surface.dataset.dragging = 'true'
    }
    const dx = drag.lastX - e.clientX,
      dy = drag.lastY - e.clientY,
      dt = Math.max(8, e.timeStamp - drag.time)
    target = { x: target.x + dx, y: target.y + dy }
    velocity = { x: Math.max(-2.5, Math.min(2.5, dx / dt)), y: Math.max(-2.5, Math.min(2.5, dy / dt)) }
    drag.lastX = e.clientX
    drag.lastY = e.clientY
    drag.time = e.timeStamp
    wake()
  }
  const up = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return
    suppressClick = drag.moved
    if (reduced || e.type === 'pointercancel' || e.timeStamp - drag.time > 80) velocity = { x: 0, y: 0 }
    const moved = drag.moved
    release()
    if (moved) wake()
  }
  const click = (e: MouseEvent) => {
    if (suppressClick) {
      e.preventDefault()
      e.stopPropagation()
      suppressClick = false
    }
  }
  const wheel = (e: WheelEvent) => {
    if (!enabled || e.ctrlKey || e.metaKey || drag) return
    e.preventDefault()
    const mode = e.deltaMode,
      delta = wheelInput(e.deltaX, e.deltaY, mode, surface.clientHeight)
    settleAt = win.performance.now() + 100
    move(delta.x, delta.y)
  }
  const key = (e: KeyboardEvent) => {
    if (
      !enabled ||
      e.altKey ||
      e.ctrlKey ||
      e.metaKey ||
      (e.target as HTMLElement).matches('input,textarea,select,[contenteditable]')
    )
      return
    const d: Record<string, Point> = {
      ArrowRight: { x: 240, y: 0 },
      ArrowLeft: { x: -240, y: 0 },
      ArrowDown: { x: 0, y: 180 },
      ArrowUp: { x: 0, y: -180 },
    }
    if (e.key === 'Home') {
      e.preventDefault()
      animateTo({ x: 0, y: 0 })
      return
    }
    if (!d[e.key]) return
    e.preventDefault()
    surface.focus({ preventScroll: true })
    focusAfter = true
    move(d[e.key].x, d[e.key].y)
  }
  const visibility = () => {
    if (doc.hidden) stop()
  }
  const nativeDrag = (e: DragEvent) => e.preventDefault()
  surface.addEventListener('pointerdown', down)
  surface.addEventListener('pointermove', pointerMove)
  win.addEventListener('pointerup', up)
  win.addEventListener('pointercancel', up)
  surface.addEventListener('click', click, true)
  surface.addEventListener('wheel', wheel, { passive: false })
  surface.addEventListener('keydown', key)
  surface.addEventListener('dragstart', nativeDrag)
  win.addEventListener('blur', stop)
  doc.addEventListener('visibilitychange', visibility)
  return {
    move,
    restore,
    animateTo,
    getPosition: () => ({ ...current }),
    setEnabled(value: boolean) {
      if (enabled === value) return
      enabled = value
      if (!value) stop()
    },
    setReduced(value: boolean) {
      reduced = value
    },
    destroy() {
      disposed = true
      stop()
      surface.removeEventListener('pointerdown', down)
      surface.removeEventListener('pointermove', pointerMove)
      win.removeEventListener('pointerup', up)
      win.removeEventListener('pointercancel', up)
      surface.removeEventListener('click', click, true)
      surface.removeEventListener('wheel', wheel)
      surface.removeEventListener('keydown', key)
      surface.removeEventListener('dragstart', nativeDrag)
      win.removeEventListener('blur', stop)
      doc.removeEventListener('visibilitychange', visibility)
    },
  }
}
