# Public API

Both packages ship native ESM, TypeScript declarations, `/browser`, `/react`, and `/styles.css`. The background package additionally exports `/gallery`. There are no runtime package dependencies. Optional React peer versions are 18.2 through 19.x.

## Gallery items and options

`GalleryItem` requires unique stable `id`, `title`, `alt`, and `destination`. Optional fields: `category`, `accessLabel`, `poster`, `preview`. Posters and muted looping preview clips accept a URL or `{light, dark?}`. Missing dark assets fall back to light assets. Failed clips reveal the poster; failed posters reveal the title fallback.

`destination` is either `{kind:'link', href, target?}` or `{kind:'preview', href, media?, alt?, poster?, captions?, caption?, captionLink?, embed?}`. `media` is `image` or `video`; `embed` is explicit and requires an exact origin. Normal links keep browser navigation, middle-click, modifier keys, and optional `_blank` behavior. Preview destinations also preserve modified-click navigation.

`createGallery(element, options)` accepts:

| Option                       | Default / meaning                                           |
| ---------------------------- | ----------------------------------------------------------- |
| `items`                      | Required caller-owned catalog; never fetched by the package |
| `title`                      | Gallery                                                     |
| `view`                       | Sphere after enhancement; Grid under reduced motion         |
| `theme`                      | `system`, also `light` or `dark`                            |
| `sizing`                     | `container`; `viewport` fills the viewport                  |
| `storageKey`                 | Absent; opt in to sessionStorage with a caller-specific key |
| `previews`                   | `true`; false leaves destination links in control           |
| `placeholderLabel(artwork)`  | Optional `{title, category?}` for generated studies         |
| `renderCard(context)`        | Override content inside the item trigger                    |
| `renderPlaceholder(context)` | Override generated study content                            |
| `renderToolbar(context)`     | Override controls; receives reset/setView                   |
| `renderPreview(context)`     | Override preview stage; receives selection/close            |

Renderers return an `HTMLElement` or `{element, update(state), destroy()}`. `update` reports `{active, theme, moving}`. An element remains mounted while its world tile remains visible across wrapping boundaries. `destroy` releases owned listeners, canvas loops, and media. A placeholder receives `{artwork:{seed,palette}, pointer, preview}`. The normalized `pointer(event)` explicitly inverts the gallery projection; backgrounds never inspect gallery DOM ancestry. `preview` distinguishes the interactive study window from a thumbnail.

React's `slots.card`, `slots.placeholder`, `slots.toolbar`, and `slots.preview` receive corresponding contexts and return React nodes. Use stable callbacks and item arrays for efficient updates. The React wrapper also accepts the imperative renderers, className, style, and id.

Callbacks: `onViewChange(view)`, `onSelect(selection)`, `onPositionChange(point)` (settled only), `onPreviewChange(selection|null)`. Equivalent bubbling CustomEvents are `viewchange`, `select`, `positionchange`, `previewchange`, with the value in `event.detail`. A selection is `{item}` or `{artwork}`.

Controller: `getView`, `getPosition`, `setView`, `setTheme`, `update`, `reset`, `restorePosition`, `openPreview(selection|id)`, `closePreview`, `destroy`. Custom elements expose `controller`, `items`, and `options`. Assign options through properties for complex values. Disconnect destroys resources; reconnect creates a fresh controller from current properties/fallback markup.

Regular is the only supported layout. Geometry exports (`galleryPattern`, `galleryMetrics`, `visibleTiles`, `projectTile`, `projectedCorners`, `tileTransform`, `unprojectTilePoint`, `wrap`) and `createGalleryWheelInput` support adapters and deterministic testing. No Mixed experiment is included.

## Background options

| Option             | Default / meaning                                                   |
| ------------------ | ------------------------------------------------------------------- |
| `seed`             | 104729, deterministic unsigned 32-bit PRNG                          |
| `palette`          | `electric`; preset ID, Palette object, or array of `#RRGGBB` colors |
| `renderer`         | `ascii`, or `pixels`                                                |
| `glyphs`           | `.:+*=#@`; Unicode characters supported                             |
| `font`, `fontSize` | `ui-monospace, monospace`, 12 canvas pixels                         |
| `density`          | Seed-derived 24–47 columns; configurable integer 4–160              |
| `aspectRatio`      | Raster height/width, .75; configurable >0 to 4                      |
| `motion`, `speed`  | true, 1; controls mesh flow                                         |
| `active`           | true; pause without clearing or resetting phase                     |
| `interactive`      | false; enable keyboard/click ripples and touch capture              |
| `pointer`          | Optional explicit adapter yielding normalized local `{x,y}`         |
| `overlay`          | Optional caller-owned HTMLElement; React uses children              |

The returned controller exposes `element`, `setActive`, `getPhase` (elapsed active milliseconds), and `destroy`. Remount to change structural renderer options. The React wrapper updates activity without remounting; structural option changes regenerate the field. Seven named presets: electric, twilight, botanical, soft-contrast, dusk, sunset, neon-tide.

## Input heuristic

WheelEvent does not identify the device. Line/page units and discrete vertical-only pixel steps start as diagonal navigation. Two-axis pixel input, fractional deltas, or vertical pixel input below 40 marks that controller as directional. Later vertical swipes and momentum tails keep their angle until a non-pixel wheel event resets the heuristic. Magnitudes cap at 600px while preserving direction. Ctrl/meta wheel gestures pass through for browser zoom. Device classification is necessarily approximate.
