import { build } from 'esbuild'
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
await mkdir('test-results', { recursive: true })
await build({
  entryPoints: ['examples/ReactDemo.tsx'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  outfile: 'test-results/react-server.mjs',
  jsx: 'automatic',
})
const { ReactDemo } = await import('../test-results/react-server.mjs?' + Date.now())
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>React gallery · SSR</title><link rel="stylesheet" href="/packages/spherical-gallery/dist/styles.css"><link rel="stylesheet" href="/examples/site.css"><div id="root">${renderToString(createElement(ReactDemo))}</div><script type="module" src="/examples/react-bundle.js"></script></html>`
await writeFile('examples/react.html', html)
await build({
  entryPoints: ['examples/react-client.tsx'],
  bundle: true,
  format: 'esm',
  outfile: 'examples/react-bundle.js',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' },
})
