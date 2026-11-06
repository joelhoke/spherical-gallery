# Explicit iframe previews

Embedding is off unless the destination supplies `embed: {origin}`. The configured origin must be exact (`https://example.com`, with no path or trailing slash), match the resolved URL, and use HTTP(S). Invalid configuration renders an ordinary link. Every default preview also keeps an Open directly link: CSP `frame-ancestors`, X-Frame-Options, network failures, authentication, and browser restrictions can block a frame, and browsers do not reliably expose those failures to the parent.

```js
const destination = {
  kind: 'preview',
  href: 'https://example.com/project',
  embed: { origin: 'https://example.com', sandbox: 'allow-scripts allow-forms' },
}
```

The default sandbox permits scripts/forms. A sandbox without `allow-same-origin` intentionally gives the child an opaque origin, so its bridge messages cannot pass an exact-origin check. If the host trusts that destination and needs the bridge, it must explicitly allow `allow-same-origin`. Allowing scripts and same-origin on trusted same-origin content is not a security boundary; the host owns that trust decision. Additional permissions, fullscreen policy, credentials, and password forms belong in the host application.

Inside the trusted frame:

```js
import { installPreviewBridge } from '@joelhoke/spherical-gallery'
const bridge = installPreviewBridge({ parentOrigin: 'https://portfolio.example' })
closeButton.addEventListener('click', bridge.close)
// On cleanup: remove your listener and call bridge.destroy().
```

Escape sends `gallery:escape`; `bridge.close()` sends `gallery:close`. The parent accepts only messages whose `source` is the currently configured frame's `contentWindow` and whose `origin` equals its configured origin. No wildcard postMessage target is used. Cross-origin child pages must install their own bridge or use the visible parent close control. This is a UI dismissal protocol, never an authentication mechanism.

Ordinary links preserve normal and modified navigation. Hosts should pass the original project URL as `href`; host-specific embed flags are constructed in the host adapter. Content fetching, authorization, moderation, and project viewer implementations are excluded from both packages.
