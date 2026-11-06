import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
const root = resolve('.'),
  port = Number(process.env.PORT || 4173)
const types = {
  '.md': 'text/plain; charset=utf-8',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.json': 'application/json',
  '.png': 'image/png',
}
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname),
      path = resolve(root, '.' + (pathname === '/' ? '/examples/index.html' : pathname))
    if (!path.startsWith(root + sep) || path.includes('/.git/')) {
      res.writeHead(403).end()
      return
    }
    const info = await stat(path),
      file = info.isDirectory() ? resolve(path, 'index.html') : path
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream')
    res.setHeader('Cache-Control', 'no-store')
    res.end(await readFile(file))
  } catch {
    res.writeHead(404).end('Not found')
  }
})
server.listen(port, '127.0.0.1', () => console.log(`Gallery demo: http://127.0.0.1:${port}`))
