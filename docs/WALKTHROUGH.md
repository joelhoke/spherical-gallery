# Maintaining the packages

Run `npm ci`, `npm run build`, `npm run demo:build`, and `npm run dev`. The local demo is at http://127.0.0.1:4173; its React example demonstrates server rendering, custom slots, context, theme changes, and unmounting.

| Source                                       | Responsibility                                                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `packages/spherical-gallery/src/gallery.ts`  | DOM lifecycle, stable tile reconciliation, views, controls, activity, selection, and persistence               |
| `packages/spherical-gallery/src/geometry.ts` | Regular tiling, seamless world identity, spherical projection, inverse pointer projection, and wheel heuristic |
| `packages/spherical-gallery/src/motion.ts`   | Drag threshold, momentum, keyboard movement, smooth return, and motion suspension                              |
| `packages/spherical-gallery/src/media.ts`    | Themed poster/clip selection, visibility, active-only playback, and failure fallback                           |
| `packages/spherical-gallery/src/preview.ts`  | Dialog shell, focus, expansion, explicit iframe policy, and origin/frame validation                            |
| `packages/spherical-gallery/src/react.tsx`   | Usable server Grid, enhancement after hydration, and context-preserving React slots                            |
| Each package's `src/element.ts`              | Explicit custom-element registration and disconnect/reconnect cleanup                                          |
| `packages/mesh-backgrounds/src/mesh.ts`      | Seeded field generation, rendering, pointer adapter, lifecycle, and retained animation phase                   |
| `packages/mesh-backgrounds/src/palettes.ts`  | Seven supplied named palettes                                                                                  |
| `packages/mesh-backgrounds/src/engine/`      | Extracted glyph physics, ripple pool, impulses, and scheduler                                                  |
| `packages/mesh-backgrounds/src/gallery.ts`   | Optional structural gallery adapter; the gallery never imports the glyph engine                                |
| `examples/`                                  | Neutral HTML/React demos and redistributable sample artwork                                                    |
| `scripts/`, `tests/`                         | Build, packed-install checks, ported engine tests, SSR checks, and browser validation                          |

Edit source, not generated `dist` files. `npm run build` compiles both packages; `npm run demo:build` rebuilds the React example. `npm run pack:local` creates the release-shaped tarballs used by the portfolio. Repacking does not automatically refresh an existing consumer: reinstall the tarballs and restart that consumer's bundler.

## Small edits

| Setting             | Current default / units                   | Effect and constraints                                                                                                                   |
| ------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Gallery height      | `--sg-height: 720px`                      | Larger containers show more tiles. Viewport sizing ignores this height.                                                                  |
| Gallery brand       | CSS custom properties in `src/styles.css` | Change fonts, colors, borders, radius, and control styling on the host. Site-level properties override theme defaults.                   |
| Palette             | `electric`; six-digit hex swatches        | Pass a preset ID or a custom array. Changing swatches preserves seeded point positions for the same palette length.                      |
| Seed                | `104729`; unsigned 32-bit PRNG input      | Changes the field and seeded default density reproducibly. It is not a timestamp.                                                        |
| Density             | Seeded 24–47 columns; option range 4–160  | Higher density draws more cells/glyphs and costs more. The cap is a chosen resource bound, not a Canvas format limit.                    |
| Raster aspect ratio | `0.75`, height/width                      | Default matches 4:3 cards. Use the section's height/width for standalone fields. Supported range is greater than zero through 4.         |
| Glyph size          | `12`, canvas pixels; option range 1–128   | Changes raster resolution and glyph spacing together (line height rounds size × 1.42). CSS scales the raster to its container.           |
| Motion speed        | `1`, multiplier                           | `0.5` halves color-field flow; pointer physics remains unchanged. Use `active:false` to pause the entire simulation without clearing it. |
| Persistence         | Off                                       | Supply a unique `storageKey` to save view/settled position in sessionStorage. Do not reuse keys across unrelated galleries.              |

For example, change `<MeshBackground palette="electric" density={36}/>` to `<MeshBackground palette="sunset" density={48}/>` for a warmer, denser field. Structural option changes regenerate that mesh; activity changes preserve the existing canvas and phase.

Changes to projection, wrapping identity, input classification, focus handling, or the iframe trust protocol deserve implementation help and the relevant geometry/browser/security tests. Keep the independently installable boundary intact: don't import backgrounds into the gallery runtime or host authorization/catalog code into either package.

The portfolio adapter owns its content conversion, moderation fetch, fonts, logo overlay, project URLs, and trusted embed configuration. Its shared homepage/case-study engines are deliberately retained. The final review report records verification and release gates; never infer publication from a successful local `npm pack`.
