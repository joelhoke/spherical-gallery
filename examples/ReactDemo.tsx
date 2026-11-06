import React, { StrictMode, createContext, useContext, useState } from 'react'
import { SphericalGallery } from '@joelhoke/spherical-gallery/react'
import { MeshBackground } from '@joelhoke/mesh-backgrounds/react'
const Brand = createContext('Field notes')
export const items = Array.from({ length: 5 }, (_, i) => ({
  id: `react-${i}`,
  title: `Composition ${i + 1}`,
  alt: `Circular abstract composition ${i + 1}`,
  poster: `/examples/assets/study-${i}.svg`,
  destination: { kind: 'preview' as const, href: `/examples/assets/study-${i}.svg`, media: 'image' as const },
}))
function CustomCard({ item }: { item: (typeof items)[number] }) {
  return (
    <>
      <span className="sg-media">
        <img alt={item.alt} src={item.poster} />
      </span>
      <span className="sg-caption">
        <span>{useContext(Brand)}</span>
        <strong>{item.title}</strong>
      </span>
    </>
  )
}
const slots = {
  card: ({ item }: any) => <CustomCard item={item} />,
  placeholder: ({ artwork, active, pointer }: any) => (
    <MeshBackground seed={artwork.seed} active={active} pointer={pointer} palette="twilight" />
  ),
  preview: ({ selection }: any) => (
    <div style={{ padding: 40 }}>
      <h2>{useContextName(selection)}</h2>
      <p>Custom preview content, composed by the host.</p>
      <input aria-label="Notes" placeholder="Your notes" />
    </div>
  ),
}
function useContextName(selection: any) {
  return 'item' in selection ? selection.item.title : 'Generative study'
}
export function ReactDemo() {
  const [mounted, setMounted] = useState(true),
    [theme, setTheme] = useState<'light' | 'dark'>('light')
  return (
    <StrictMode>
      <Brand.Provider value="Studio / React context">
        <header className="site-header">
          <a href="/">← Plain HTML</a>
          <button onClick={() => setMounted((v) => !v)}>Mount / unmount</button>
          <button onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>Change theme</button>
        </header>
        <section className="intro">
          <p className="eyebrow">React + server rendering</p>
          <h1>Start with the content.</h1>
          <p>
            The server sends a usable Grid. Enhancement begins after hydration.
            <br />
            Custom slots retain your React context.
          </p>
        </section>
        {mounted && (
          <SphericalGallery
            items={items}
            slots={slots}
            theme={theme}
            title="Field notes"
            style={{ '--sg-height': '620px' } as React.CSSProperties}
          />
        )}
      </Brand.Provider>
    </StrictMode>
  )
}
