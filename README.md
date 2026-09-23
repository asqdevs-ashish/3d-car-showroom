# A Square Devs Cars

An ultra-luxury 3D hypercar showroom — Next.js 14 (App Router) + React Three
Fiber, with a glassmorphic HUD, live paint configurator, cinematic camera rail
and adaptive quality that self-tunes to the device.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck  # tsc --noEmit
```

---

## Architecture

```
app/
  layout.tsx              Root layout, self-hosted fonts, metadata
  page.tsx                Thin entry point
  globals.css             Design tokens, canvas touch-lock, safe areas
components/
  ShowroomExperience.tsx  Client composition: canvas → HUD → modals → loader
  canvas/
    ShowroomCanvas.tsx      R3F canvas, adaptive quality, floor, framing
    CarModel.tsx            GLB loading, auto-fit, paint targets, GPU disposal
    CameraRig.tsx           OrbitControls + GSAP preset tweens
    StudioLighting.tsx      Studio rig, lightformer environment
    StudioBackdrop.tsx      Cyclorama, cityscape, horizon glow
    StudioPostProcessing.tsx Bloom / DOF / CA / Vignette / Noise
    CarHotspotPin.tsx       3D-anchored annotations
  ui/
    CarHUD.tsx              Desktop overlay + mobile sheet orchestration
    BottomSheet.tsx         Draggable mobile drawer
    CarPillSwitcher.tsx     Touch-swipeable car selector
    CategoryFilter.tsx      Fleet filter badges
    CarSearch.tsx           Keyboard search
    QualityIndicator.tsx    Live quality readout + manual override
    ...                     Spec sheet, paint config, modals, loader
config/
  cars.ts                 The fleet — 13 vehicles, the single source of truth
  camera.ts               Camera presets + responsive framing
hooks/
  useShowroomStore.ts     Zustand store (selection, paint, camera, filter)
  useAdaptiveQuality.ts   Quality tiers + auto-degrade logic
  useMediaQuery.ts        SSR-safe media queries
lib/
  modelInspect.ts         Paint-target resolution + auto-fit maths
public/
  models/                 13 GLB files, Draco-compressed
  draco/                  Draco decoder (wasm + js wrapper)
  fonts/                  Self-hosted woff2 subsets
```

---

## Vehicle models

Each entry in `config/cars.ts` points at a GLB in `public/models/`:

```ts
{
  id: "bmw-m4-gt3",
  name: "M4 GT3",
  brand: "BMW",
  year: 2022,
  modelPath: "/models/2022_bmw_m4_gt3.glb",
  category: "track",
  modelLongest: 5.77,
  paintMaterials: ["BMW_M4GT3_2022Paint_Material"],
  // ...
}
```

### Two things every model must get right

**1. Draco.** All 13 GLBs use `KHR_draco_mesh_compression` as a **required**
extension, so the decoder must be reachable. It is configured once at module
scope in `CarModel.tsx`:

```ts
useGLTF.setDecoderPath("/draco/");
```

This is not optional and not cosmetic. drei's default points at a CDN; when that
path is wrong the decode fails, `useGLTF` suspends forever, and **the stage
renders empty with no error at all** — the network tab looks perfectly healthy.
The files in `public/draco/` are three.js's own decoder, so the version always
matches the runtime.

**2. `modelLongest`.** The longest horizontal edge of the source mesh, in the
file's own units. Auto-fit scales by `TARGET_CAR_LENGTH / modelLongest`.

> The value must come from the **decoded** mesh, not from the glTF accessor's
> `min`/`max`. Draco keeps its own quantised bounds inside the extension, and
> the accessor values live in a different space — the BMW's accessor says 5.77
> while the mesh that actually decodes occupies ~0.05 world units. Scaling by
> the raw accessor value produced a 4-centimetre car. `computeFit()` in
> `lib/modelInspect.ts` measures the decoded geometry, which is correct.

### Paint targets

The configurator repaints the body by matching materials in four tiers, first
hit wins (`lib/modelInspect.ts`):

1. **Declared** — exact names from `paintMaterials` on the car. Most reliable.
2. **Material name** — `paint`, `car_paint`, `body_base`, `elbody`…
3. **Node name** — `body`, `shell`, `chassis`, `hood`, `fender`…
4. **Geometry** — largest non-excluded mesh. Last resort.

Glass, rubber, lights, brakes and interior are always excluded. Matched
materials are upgraded to `MeshPhysicalMaterial` (preserving every texture) so
paint gets a real clearcoat.

If a model exposes no usable name the configurator simply won't affect it —
which is a lesser failure than the model not appearing, and is why readiness is
deliberately **not** gated on paint resolution.

---

## Performance

### Model loading

Only the **next and previous** car in the current filter are preloaded, deferred
2.5s so they never compete with the hero car. The deck additionally warms a
model on hover/focus, so exploratory browsing is instant for free.

The whole fleet used to preload in the background; at 243 MB that meant minutes
of speculative download competing for bandwidth with the car on screen.

### Adaptive quality

`<PerformanceMonitor>` samples real frame time and steps between three tiers
defined in `hooks/useAdaptiveQuality.ts`:

|                | Ultra             | Balanced    | Performance |
| -------------- | ----------------- | ----------- | ----------- |
| DPR            | `[1, 1.5]`        | `[1, 1.25]` | `[0.75, 1]` |
| Shadows        | 2048px            | 1024px      | off         |
| Reflector      | 1024 + distortion | 512         | 256         |
| Post-FX        | full              | off         | off         |
| ContactShadows | every frame       | every frame | baked once  |

DPR is **capped at 1.5, never 2** — a 4K phone at DPR 2 renders 4× the pixels
and is the fastest route to thermal throttling.

`factor` and `step` are pinned to 1 so the monitor can only report, never
silently re-resolve the canvas. Left at defaults it would drop DPR during the
first seconds (when frame times are worst) and only climb back once the scene
settled — which read as the car staying blurry for several seconds after load.

The user can pin a tier from the HUD; doing so sets `manual` and stops the
automation from overriding the choice.

### GPU memory

Every cloned model owns its own geometry and materials, and `CarModel` disposes
all of them (plus every texture slot, deduplicated) on unmount. Without this,
browsing the fleet accumulates buffers until the driver kills the context.

`three`'s `scene.clone()` **shares materials with the cached original**, so each
clone deep-copies them first — otherwise disposing car A corrupts car B.

### Anisotropic filtering

Set to `min(8, maxSupported)` on every car texture. Without it, any surface seen
at an angle — most of a car — smears into a low-resolution blur.

---

## Mobile

- **`touch-action: none`** on `.canvas-container` stops the page scrolling while
  you rotate the car. Written as a **single CSS rule** — two blocks both setting
  `touch-action` get collapsed by the build's minifier, which silently dropped
  the declaration.
- **Safe areas** exposed as `--safe-top/right/bottom/left` custom properties.
- **Bottom sheet** replaces the desktop floating cards: a compact stats row plus
  a drawer opened by tap or drag.
- **Camera** pulls back and widens the lens on narrow viewports so a 4.6m car
  fits a portrait phone end to end.
- **OrbitControls** halve `rotateSpeed` on touch.

---

## Fonts

Self-hosted in `public/fonts/` via `next/font/local`: **Syne** (display),
**Inter** (body), **JetBrains Mono** (HUD labels).

This was `next/font/google`, which fetches at **build time** and fails the build
when the network is unavailable or behind a TLS-intercepting proxy. Only the 10
subsets referenced in `app/layout.tsx` are kept; browsers download just the one
they need.

---

## Gotchas worth remembering

These each cost real debugging time and are easy to reintroduce:

- **A GLB's accessor `min`/`max` is not its decoded size** when Draco is
  involved. Always measure the decoded mesh.
- **`scene.clone()` shares materials.** Deep-copy before mutating anything.
- **`Box3.setFromObject` over a `visible={false}` branch returns an empty box.**
  three.js skips matrix updates for invisible subtrees, so gating visibility on
  a measurement that depends on visibility is a deadlock.
- **`next build` inlines `NODE_ENV`.** A diagnostic behind
  `if (NODE_ENV !== "production")` is dead-code-eliminated in production.
- **Never gate readiness on an optional concern.** Requiring paint resolution
  before revealing a model meant models the resolver could not match never
  appeared at all.
- **A `position` inside a scaled group is multiplied by that scale.** If an
  offset is measured in world space, divide it by the scale before passing it in
  — otherwise it is short by exactly that factor.
