import { hydrateRoot } from 'react-dom/client'
import { ReactDemo } from './ReactDemo'
window.__hydrationErrors = []
hydrateRoot(document.getElementById('root')!, <ReactDemo />, {
  onRecoverableError: (error) => window.__hydrationErrors.push(String(error)),
})
