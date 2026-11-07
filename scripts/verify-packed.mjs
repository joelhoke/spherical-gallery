import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
const reports = []
for (const name of ['spherical-gallery', 'mesh-backgrounds']) {
  const cwd = mkdtempSync(join(tmpdir(), 'spherical-install-')),
    tarball = resolve(`artifacts/joelhoke-${name}-0.1.0.tgz`)
  writeFileSync(join(cwd, 'package.json'), '{"private":true,"type":"module"}')
  execFileSync(
    'npm',
    [
      'install',
      tarball,
      '--offline',
      '--ignore-scripts',
      '--cache',
      process.env.npm_config_cache || join(tmpdir(), 'spherical-package-verification-cache'),
    ],
    { cwd, stdio: 'pipe' },
  )
  assert(!existsSync(join(cwd, 'node_modules/react')))
  assert(
    !existsSync(
      join(
        cwd,
        'node_modules/@joelhoke',
        name === 'spherical-gallery' ? 'mesh-backgrounds' : 'spherical-gallery',
      ),
    ),
  )
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `await import('@joelhoke/${name}');await import('@joelhoke/${name}/browser');if(typeof window!=='undefined')throw Error('Unexpected browser global')`,
    ],
    { cwd, stdio: 'pipe' },
  )
  const listing = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).trim().split('\n')
  assert(
    listing.every((p) =>
      /^package\/(dist\/|package.json$|README.md$|LICENSE$|THIRD_PARTY_NOTICES.md$)/.test(p),
    ),
  )
  const manifest = JSON.parse(readFileSync(join(cwd, 'node_modules/@joelhoke', name, 'package.json')))
  assert.equal(manifest.license, 'MIT')
  assert.equal(manifest.version, '0.1.0')
  assert(!manifest.dependencies)
  reports.push({ name, files: listing.length, independent: true, serverSafe: true })
  console.log(`${name}: clean packed install, independent imports, and package contents passed`)
}
writeFileSync('test-results/packed-results.json', JSON.stringify(reports, null, 2))

// A separate consumer installs the packed artifacts with React. npm ci can cache
// tarballs without caching registry metadata, so a fresh CI host may need npm.
const reactVersion = JSON.parse(readFileSync('node_modules/react/package.json')).version
const consumer = mkdtempSync(join(tmpdir(), 'spherical-react-install-'))
writeFileSync(join(consumer, 'package.json'), '{"private":true,"type":"module"}')
const npmCache =
  process.env.npm_config_cache || execFileSync('npm', ['config', 'get', 'cache'], { encoding: 'utf8' }).trim()
execFileSync(
  'npm',
  [
    'install',
    resolve('artifacts/joelhoke-spherical-gallery-0.1.0.tgz'),
    resolve('artifacts/joelhoke-mesh-backgrounds-0.1.0.tgz'),
    `react@${reactVersion}`,
    `react-dom@${reactVersion}`,
    '--prefer-offline',
    '--ignore-scripts',
    '--cache',
    npmCache,
  ],
  { cwd: consumer, stdio: 'pipe' },
)
execFileSync(
  process.execPath,
  [
    '--input-type=module',
    '-e',
    `
import {createElement} from 'react';import {renderToString} from 'react-dom/server';
import {SphericalGallery} from '@joelhoke/spherical-gallery/react';import {MeshBackground} from '@joelhoke/mesh-backgrounds/react';
const html=renderToString(createElement(SphericalGallery,{items:[{id:'packed',title:'Packed item',alt:'A circle',poster:'/circle.svg',destination:{kind:'link',href:'/circle'}}]}));
if((html.match(/<li>/g)||[]).length!==1||!html.includes('href="/circle"'))throw Error('Packed React SSR failed');
renderToString(createElement(MeshBackground,{seed:42}));
`,
  ],
  { cwd: consumer, stdio: 'pipe' },
)
reports.push({ name: 'packed-react-consumer', serverRendering: true, reactVersion })
writeFileSync('test-results/packed-results.json', JSON.stringify(reports, null, 2))
console.log('Packed React consumer: clean installation and server rendering passed')
