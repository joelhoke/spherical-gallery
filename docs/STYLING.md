# Styling, sizing, accessibility, and cleanup

Load each package's exported stylesheet. Selectors are prefixed `.sg-` and `.mb-`; neither package changes `body`, root page styles, fonts, navigation, or routing. Dialogs use native top-layer modality instead of changing the page's overflow style. Instances keep separate position, input history, selections, and observers; use different storage keys when opting into persistence.

Set `--sg-height` on a container (default 720px). `sizing:'viewport'` uses a fixed sphere and normal document-flow Grid with a viewport-fixed toolbar. Container mode uses an in-container toolbar and a growing Grid. The grid adapts down to narrow containers. ResizeObserver measures each container, not the window.

CSS properties: `--sg-background`, `--sg-color`, `--sg-muted`, `--sg-border`, `--sg-accent`, `--sg-panel`, `--sg-font`, `--sg-display-font`, `--sg-spacing`, `--sg-radius`, `--sg-control-radius`, `--sg-height`. Theme defaults yield to caller properties inherited from a parent. Backgrounds expose `--mb-focus-color`; overlays and font loading belong to the host. Explicit `light` and `dark` themes override the system preference and select matching media; `system` follows changes live.

Every real item appears once in Grid. Server rendering and no-JavaScript markup are usable links. Reduced motion forces Grid, disables automatic media/mesh animation, and retains static artwork. Arrow keys navigate the sphere; Home and Back to start restore its origin. Keyboard focus follows the nearest tile after movement. Only canonical, projected-in-view copies are keyboard/assistive-technology targets. Hidden copies are removed from the tab order and accessibility tree.

The active hovered/focused tile animates; coarse pointers activate the center tile. Movement, offscreen intersection, document visibility, dialogs, and reduced motion gate thumbnail playback. Pausing a mesh leaves its canvas and simulation phase intact. Preview videos expose native controls/captions. Alt descriptions are required caller data; access labels describe availability but never implement authorization.

Preview dialogs have a darkened backdrop, close control, outside dismissal, Tab containment, Escape handling, expansion, and focus restoration. Escape collapses an expanded preview before closing it. Preview slots are responsible for accessibility of their own content; the package retains the dialog shell.

Call `destroy()` before dropping imperative instances. Web Components clean up on disconnect; React cleans up on unmount, including Strict Mode remounts. Custom renderer handles must release their own resources in `destroy`. Overlay DOM is inserted into the mesh and removed with it. Do not reuse one overlay node across simultaneous instances; create a node per renderer invocation.
