import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
for (const name of ['spherical-gallery', 'mesh-backgrounds']) {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', `packages/${name}`], {
    stdio: 'inherit',
  })
  copyFileSync(`packages/${name}/src/styles.css`, `packages/${name}/dist/styles.css`)
}
mkdirSync('artifacts', { recursive: true })
