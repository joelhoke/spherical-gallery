'use client'
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { createMeshBackground, type MeshOptions } from './mesh.js'
export type MeshBackgroundProps = Omit<MeshOptions, 'overlay'> & {
  children?: ReactNode
  className?: string
  style?: CSSProperties
}
export function MeshBackground({ children, className, style, ...options }: MeshBackgroundProps) {
  const host = useRef<HTMLDivElement>(null),
    mesh = useRef<ReturnType<typeof createMeshBackground> | null>(null)
  useEffect(() => {
    mesh.current = createMeshBackground(host.current!, options)
    return () => {
      mesh.current?.destroy()
      mesh.current = null
    }
  }, [
    options.seed,
    options.palette,
    options.renderer,
    options.glyphs,
    options.font,
    options.fontSize,
    options.density,
    options.aspectRatio,
    options.motion,
    options.speed,
    options.interactive,
    options.pointer,
  ])
  useEffect(() => {
    mesh.current?.setActive(options.active ?? true)
  }, [options.active])
  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
      {children && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{children}</div>}
    </div>
  )
}
