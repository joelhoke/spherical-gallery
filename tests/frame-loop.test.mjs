import { createFrameLoop } from '../packages/mesh-backgrounds/dist/engine/frameLoop.js'
let failures = 0
function assert(condition, message) {
  if (condition) {
  } else {
    console.error(`FAIL: ${message}`)
    failures += 1
  }
}

/** Fake rAF: an explicit callback queue the test steps through. */
function fakeRaf() {
  let nextHandle = 1
  const queue = new Map()
  return {
    request: (cb) => {
      const handle = nextHandle++
      queue.set(handle, cb)
      return handle
    },
    cancel: (handle) => {
      queue.delete(handle)
    },
    /** Run every queued callback once; returns how many fired. */
    step: (now) => {
      const due = [...queue.entries()]
      queue.clear()
      for (const [, cb] of due) cb(now)
      return due.length
    },
    pendingCount: () => queue.size,
  }
}

function makeLoop({ parked = { value: false }, keepRunning = { value: true } } = {}) {
  const raf = fakeRaf()
  let frames = 0
  const loop = createFrameLoop({
    frame: () => {
      frames += 1
    },
    keepRunning: () => keepRunning.value,
    isParked: () => parked.value,
    requestFrame: raf.request,
    cancelFrame: raf.cancel,
  })
  return {
    raf,
    loop,
    parked,
    keepRunning,
    frames: () => frames,
  }
}

// --- Continuous running ------------------------------------------------------
{
  const env = makeLoop()
  env.loop.renderOnce()
  assert(env.raf.pendingCount() === 1, 'initial renderOnce schedules exactly one frame')
  env.loop.renderOnce()
  env.loop.renderOnce()
  assert(env.raf.pendingCount() === 1, 'renderOnce while pending never duplicates the loop')
  env.raf.step(16)
  env.raf.step(32)
  env.raf.step(48)
  assert(env.frames() === 3 && env.raf.pendingCount() === 1, 'continuous loop reschedules each frame')
}

// --- Suspend / resume ---------------------------------------------------------
{
  const env = makeLoop()
  env.loop.renderOnce()
  env.raf.step(16)
  env.parked.value = true
  env.loop.park()
  assert(env.raf.pendingCount() === 0, 'park cancels the pending frame')
  env.raf.step(32)
  assert(env.frames() === 1, 'no frames run while parked')
  env.loop.renderOnce()
  assert(env.raf.pendingCount() === 0, 'renderOnce while parked is a no-op')
  // Stale callback that somehow still fires while parked (e.g. queued before
  // the park landed): bails without rescheduling.
  env.parked.value = false
  env.loop.resume()
  assert(env.raf.pendingCount() === 1, 'resume re-arms exactly one frame')
  env.parked.value = true // suspend lands after the frame was queued
  env.raf.step(48)
  assert(
    env.frames() === 1 && env.raf.pendingCount() === 0,
    'a frame firing while parked bails without rescheduling',
  )
  env.parked.value = false
  env.loop.resume()
  env.loop.resume()
  assert(env.raf.pendingCount() === 1, 'repeated resume never forks a second loop')
  for (let i = 0; i < 5; i += 1) env.raf.step(64 + i * 16)
  assert(env.frames() === 6 && env.raf.pendingCount() === 1, 'resumed loop runs continuously again')
  // Rapid suspend/resume cycling: pending count never exceeds one.
  for (let i = 0; i < 20; i += 1) {
    env.parked.value = true
    env.loop.park()
    env.loop.resume() // parked: no-op
    env.parked.value = false
    env.loop.resume()
    env.raf.step(100 + i)
  }
  assert(env.raf.pendingCount() === 1, '20 suspend/resume cycles leave exactly one pending frame')
}

// --- Reduced motion ------------------------------------------------------------
{
  const env = makeLoop({ keepRunning: { value: false } })
  env.loop.renderOnce()
  env.raf.step(16)
  assert(env.frames() === 1 && env.raf.pendingCount() === 0, 'reduced motion renders one frame then parks')
  env.loop.renderOnce()
  assert(env.raf.pendingCount() === 1, 'rebuild re-arms a single frame under reduced motion')
  env.raf.step(32)
  assert(env.frames() === 2 && env.raf.pendingCount() === 0, 're-armed frame parks again')
}

// --- Dispose -------------------------------------------------------------------
{
  const env = makeLoop()
  env.loop.renderOnce()
  env.loop.dispose()
  assert(env.raf.pendingCount() === 0, 'dispose cancels the pending frame')
  env.loop.renderOnce()
  env.loop.resume()
  assert(env.raf.pendingCount() === 0 && env.frames() === 0, 'a disposed loop never schedules again')
}

// A vehicle transition can invalidate while its current frame is running.
{
  const raf = fakeRaf()
  const loop = createFrameLoop({
    frame: () => loop.renderOnce(),
    keepRunning: () => true,
    isParked: () => false,
    requestFrame: raf.request,
    cancelFrame: raf.cancel,
  })
  loop.renderOnce()
  for (let i = 0; i < 10; i++) raf.step(i * 16)
  assert(raf.pendingCount() === 1, 'in-frame invalidation never forks a second animation loop')
  loop.dispose()
  assert(raf.pendingCount() === 0, 'disposing a reentrant loop cancels all scheduled work')
}

if (failures) throw new Error(`${failures} frame-loop failures`)
