import * as THREE from "three";
import type { Car, CarPaint } from "@/config/cars";

/**
 * Model inspection utilities for the showroom.
 *
 * The 14 GLBs in /public/models came from different authors and share almost
 * no naming convention — 410 distinct material names across 14 files, with
 * only a handful appearing more than once. They also span a 2000× range in
 * authored units. Everything here exists to normalise that reality at
 * runtime rather than hard-coding per-model magic numbers.
 */

/* ------------------------------------------------------------------ */
/* Paint targeting                                                     */
/* ------------------------------------------------------------------ */

/**
 * Material names that are definitely NOT body paint.
 *
 * Checked first, and wins over every include rule. Order matters: a model
 * may well have a mesh named "body_glass" or "paint_badge", and those must
 * never be recoloured.
 */
const EXCLUDE_PATTERN =
  /glass|window|windscreen|windshield|tire|tyre|wheel|rim|brake|disc|rotor|caliper|light|lamp|headlight|tail_?light|indicator|interior|seat|dash|steering|console|engine|exhaust|grill|grille|badge|logo|emblem|plate|shadow|alpha|decal|sticker|livery|sponsor|mirror|wiper|number|grid|net|mesh_?glass|glass_?mesh|chrome_?trim|shadow_?plane|interior|leather|fabric|carpet|screen|display|dial/i;

/**
 * Explicit paint hints, in priority order. The first pattern that matches
 * any material outranks everything below it.
 *
 * Verified against the real files:
 *   tier 1  BMW `..._Paint_Material`, Bugatti/Pagani `..._Paint_Material`,
 *           Lamborghini `MAT_CarpaintMain`, Aston `EXT_CARPAINT`,
 *           Hellcat `...Paint_Material1`, BMW EVO `...car_paint1`,
 *           Supra `ELBODY`
 *   tier 2  `*_Base_Material` / `*_Coloured_Material` — the main shell on
 *           models that split their bodywork
 *   tier 3  generic `body` / `shell` / `chassis`
 */
const INCLUDE_TIERS: RegExp[] = [
  /paint(?:_?material)?\d*$|car_?paint|carpaint/i,
  /^elbody/i,
  /body_?base|base_?material$|coloured_?material$/i,
  /\b(body|shell|chassis|exterior|monocoque|cabin_?body|hood|bonnet|door|fender|wing_?body)\b/i,
];

/** Node-name hints, used when material names carry no signal. */
const NODE_TIERS: RegExp[] = [
  /body|shell|paint|exterior|chassis|monocoque|hood|bonnet|door|fender|bumper|trunk|deck/i,
];

export interface PaintTargetReport {
  /** Materials that will actually receive the configurator colour. */
  materials: THREE.MeshStandardMaterial[];
  /** Which strategy found them — surfaced in dev for debugging. */
  strategy: "declared" | "material-name" | "node-name" | "geometry" | "none";
  /** Human-readable note about what happened. */
  note: string;
}

/**
 * Convert a material into a `MeshPhysicalMaterial` with automotive
 * clearcoat, preserving its maps.
 *
 * GLTFs commonly arrive as `MeshStandardMaterial`, which has no clearcoat
 * at all. Rather than swapping the material (which would lose its textures
 * and break the mesh), we build a Physical material that inherits every
 * texture slot, then hand it back for the mesh to swap in.
 */
function toPhysicalMaterial(
  source: THREE.Material,
): THREE.MeshPhysicalMaterial {
  const src = source as THREE.MeshStandardMaterial;
  const physical = new THREE.MeshPhysicalMaterial({
    // Carry over everything visual so the repaint never destroys detail.
    name: src.name,
    color: src.color?.clone() ?? new THREE.Color("#ffffff"),
    map: src.map ?? null,
    normalMap: src.normalMap ?? null,
    normalScale: src.normalScale?.clone(),
    roughnessMap: src.roughnessMap ?? null,
    metalnessMap: src.metalnessMap ?? null,
    aoMap: src.aoMap ?? null,
    aoMapIntensity: src.aoMapIntensity ?? 1,
    emissive: src.emissive?.clone() ?? new THREE.Color(0x000000),
    emissiveMap: src.emissiveMap ?? null,
    emissiveIntensity: src.emissiveIntensity ?? 1,
    alphaMap: src.alphaMap ?? null,
    transparent: src.transparent,
    opacity: src.opacity,
    side: src.side,
    vertexColors: src.vertexColors,
    // Clearcoat defaults, overwritten per-paint by applyPaint().
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  return physical;
}

/**
 * Resolve which materials on a loaded model are the body paint.
 *
 * Strategy ladder, first hit wins:
 *   1. declared  — exact names from `car.paintMaterials` (most reliable)
 *   2. material  — name matches one of the INCLUDE_TIERS
 *   3. node      — the mesh or its parent is named like bodywork
 *   4. geometry  — the biggest non-excluded mesh by surface area
 *
 * `upgrade` controls whether matched materials are converted to
 * MeshPhysicalMaterial for clearcoat gloss.
 */
export function resolvePaintTargets(
  root: THREE.Object3D,
  car: Car,
  upgrade = true,
): PaintTargetReport {
  type Hit = { material: THREE.MeshStandardMaterial; mesh: THREE.Mesh };

  const collect = (
    predicate: (mesh: THREE.Mesh, name: string) => boolean,
  ): Hit[] => {
    const hits: Hit[] = [];
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;

      const nodeName = `${mesh.name} ${mesh.parent?.name ?? ""}`;
      if (!predicate(mesh, nodeName)) return;

      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      materials.forEach((mat) => {
        if (mat instanceof THREE.MeshStandardMaterial) {
          if (!hits.some((h) => h.material === mat))
            hits.push({ material: mat, mesh });
        }
      });
    });
    return hits;
  };

  /* --- Tier 1: declared material names --------------------------------- */
  let hits: Hit[] = [];
  let strategy: PaintTargetReport["strategy"] = "none";
  let note = "";

  const declared = car.paintMaterials?.filter(Boolean) ?? [];
  if (declared.length > 0) {
    const wanted = new Set(declared.map((n) => n.toLowerCase()));
    hits = collect((_, name) =>
      Array.from(wanted).some((w) => name.toLowerCase().includes(w)),
    );

    // `traverse` above only inspected mesh/parent names; materials may be
    // named differently, so do a second pass across the material names.
    if (hits.length === 0) {
      root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        materials.forEach((mat) => {
          if (
            mat instanceof THREE.MeshStandardMaterial &&
            wanted.has(mat.name.toLowerCase())
          ) {
            if (!hits.some((h) => h.material === mat))
              hits.push({ material: mat, mesh });
          }
        });
      });
    }

    if (hits.length > 0) {
      strategy = "declared";
      note = `Matched ${hits.length} declared paint material(s): ${declared.join(", ")}`;
    }
  }

  /* --- Tier 2: material name patterns ---------------------------------- */
  if (hits.length === 0) {
    for (const tier of INCLUDE_TIERS) {
      hits = collect(
        (_, name) => tier.test(name) && !EXCLUDE_PATTERN.test(name),
      );
      if (hits.length > 0) {
        strategy = "material-name";
        note = `Matched ${hits.length} material(s) via ${tier}`;
        break;
      }
    }
  }

  /* --- Tier 3: node name patterns -------------------------------------- */
  if (hits.length === 0) {
    for (const tier of NODE_TIERS) {
      hits = collect(
        (_, name) => tier.test(name) && !EXCLUDE_PATTERN.test(name),
      );
      if (hits.length > 0) {
        strategy = "node-name";
        note = `Matched ${hits.length} node(s) via ${tier}`;
        break;
      }
    }
  }

  /* --- Tier 4: largest non-excluded mesh ------------------------------- */
  if (hits.length === 0) {
    let best: { mesh: THREE.Mesh; area: number } | null = null;

    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const nodeName = `${mesh.name} ${mesh.parent?.name ?? ""}`;
      if (EXCLUDE_PATTERN.test(nodeName)) return;

      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox;
      if (!box) return;
      const size = new THREE.Vector3();
      box.getSize(size);
      // Skip degenerate/sliver meshes (many models contain helper planes).
      if (size.x < 1e-6 || size.y < 1e-6 || size.z < 1e-6) return;

      const area = size.x * size.y + size.y * size.z + size.x * size.z;
      if (!best || area > best.area) best = { mesh, area };
    });

    if (best) {
      const mesh = (best as { mesh: THREE.Mesh }).mesh;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      hits = materials
        .filter(
          (m): m is THREE.MeshStandardMaterial =>
            m instanceof THREE.MeshStandardMaterial,
        )
        .map((material) => ({ material, mesh }));
      if (hits.length > 0) {
        strategy = "geometry";
        note = `No name signal. Fell back to largest mesh "${mesh.name || "(unnamed)"}"`;
      }
    }
  }

  if (hits.length === 0) {
    return {
      materials: [],
      strategy: "none",
      note: "No paintable material found.",
    };
  }

  /* --- Optionally upgrade to clearcoat Physical materials -------------- */
  const materials: THREE.MeshStandardMaterial[] = [];

  hits.forEach(({ material, mesh }) => {
    if (material instanceof THREE.MeshPhysicalMaterial) {
      materials.push(material);
      return;
    }

    if (!upgrade) {
      materials.push(material);
      return;
    }

    /*
     * Swap in a Physical material carrying the original's textures.
     *
     * CRITICAL: we must NOT dispose the original material.
     *
     * `scene.clone(true)` in CarModel shares material instances with the
     * cached GLB rather than deep-copying them. Disposing here would free
     * GPU resources that the cache — and therefore every future visit to
     * this car — still references, and the WebGL context then throws on the
     * next draw. This is what crashed the app when switching between cars.
     *
     * The original is left intact; three.js will release it when the cached
     * scene itself is unloaded.
     */
    const physical = toPhysicalMaterial(material);
    if (Array.isArray(mesh.material)) {
      const idx = mesh.material.indexOf(material);
      const next = [...mesh.material];
      if (idx >= 0) next[idx] = physical;
      mesh.material = next;
    } else {
      mesh.material = physical;
    }

    materials.push(physical);
  });

  return { materials, strategy, note };
}

/**
 * Apply the live configurator colour to a set of paint materials.
 *
 * Kept deliberately cheap: no texture lookups, no shader recompiles beyond
 * a `needsUpdate` on colour/clearcoat changes, so a swatch click repaints
 * instantly even on a 100k-triangle car.
 */
export function applyPaint(
  materials: THREE.MeshStandardMaterial[],
  paint: CarPaint,
): void {
  const matte = paint.matte ?? 0;
  const target = new THREE.Color(paint.hex);

  materials.forEach((mat) => {
    mat.color.copy(target);

    // Dielectric base + strong clearcoat is what reads as car paint. High
    // metalness would mirror the studio softbox and wash the colour out.
    mat.metalness = matte > 0.4 ? 0.12 : 0.28;
    mat.roughness = 0.26 + matte * 0.42;

    const physical = mat as THREE.MeshPhysicalMaterial;
    if ("clearcoat" in physical) {
      physical.clearcoat = matte > 0.5 ? 0.2 : 1;
      physical.clearcoatRoughness = 0.07 + matte * 0.3;
    }

    // Two-tone paints keep a faint accent tint in shadow.
    if (paint.accent) {
      mat.emissive = new THREE.Color(paint.accent).multiplyScalar(0.04);
    } else {
      mat.emissive.setRGB(0, 0, 0);
    }

    mat.needsUpdate = true;
  });
}

/* ------------------------------------------------------------------ */
/* Auto-fit                                                            */
/* ------------------------------------------------------------------ */

export interface ModelFit {
  /** Uniform scale that brings the model to the target length. */
  scale: number;
  /** Measured size in the model's OWN units, before scaling. */
  rawSize: THREE.Vector3;
  /** Centred offset to apply after scaling, in world units. */
  offset: THREE.Vector3;
  /**
   * False when the bounding box was not finite and the fallback (1,1,1) was
   * substituted. Callers MUST check this before drawing any conclusion from
   * `rawSize` — an unmeasured model reports a size of 1, which is
   * indistinguishable from a genuinely tiny one.
   */
  isMeasured: boolean;
}

/** Target on-screen length of the car, in world units. */
export const TARGET_CAR_LENGTH = 4.6;

/**
 * Measure a model and derive the uniform scale needed to bring it to
 * TARGET_CAR_LENGTH on its longest horizontal axis.
 *
 * The longest horizontal axis is used rather than always Z because several
 * of these GLBs are authored with the car's length on X, so a naive
 * "scale by Z" would badly mis-size them.
 */
export function computeFit(root: THREE.Object3D): ModelFit {
  root.updateMatrixWorld(true);

  const box = new THREE.Box3()
  const meshBox = new THREE.Box3()

  /*
   * Union each mesh's geometry bounds transformed into world space.
   *
   * NOTE ON DRACO: every model in this fleet uses
   * `KHR_draco_mesh_compression` as a REQUIRED extension, so ALL geometry is
   * compressed and its position attribute is only populated once the WASM
   * decoder has run. `geometry.boundingBox` is therefore null on the first
   * attempts and this loop legitimately collects nothing — `isMeasured` stays
   * false and the caller retries.
   *
   * That is the designed behaviour, not a bug: the retry loop in CarModel
   * keeps calling until the decoder has finished.
   */
  root.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return

    /*
     * `computeBoundingBox()` derives the box from the position attribute.
     * For a Draco mesh whose buffer is not yet decoded this produces a NaN or
     * empty box, which the isEmpty/volume check below rejects.
     */
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    const gb = mesh.geometry.boundingBox
    if (!gb || gb.isEmpty()) return

    meshBox.copy(gb).applyMatrix4(mesh.matrixWorld)

    // Reject NaN extents (a sign of an undecoded Draco buffer).
    const s = meshBox.getSize(new THREE.Vector3())
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.z)) return
    if (s.x + s.y + s.z < 1e-4) return

    box.union(meshBox)
  })

  const rawSize = new THREE.Vector3()
  if (box.isEmpty()) {
    return {
      scale: 1,
      rawSize: new THREE.Vector3(1, 1, 1),
      offset: new THREE.Vector3(),
      isMeasured: false,
    }
  }
  box.getSize(rawSize)

  // Guard against degenerate/empty models so a bad GLB can't NaN the scene.
  if (
    !Number.isFinite(rawSize.x) ||
    !Number.isFinite(rawSize.y) ||
    !Number.isFinite(rawSize.z) ||
    rawSize.x <= 0 ||
    rawSize.y <= 0 ||
    rawSize.z <= 0
  ) {
    return {
      scale: 1,
      rawSize: new THREE.Vector3(1, 1, 1),
      offset: new THREE.Vector3(),
      isMeasured: false,
    };
  }

  const horizontal = Math.max(rawSize.x, rawSize.z);
  const scale = TARGET_CAR_LENGTH / horizontal;

  /*
   * OFFSET — expressed in the MODEL'S OWN LOCAL SPACE, before scaling.
   *
   * This is the value the render group subtracts from its position, and that
   * group also carries `scale`. Keeping the offset un-scaled means the group's
   * transform applies the scale exactly once, which is what stopped the car
   * being flung ~90x off-origin and rendering as flat slabs from inside.
   *
   * The earlier version stored `centre * scale` here AND applied it to a
   * scaled group, so the scale landed twice. Deriving it locally removes the
   * ambiguity entirely.
   *
   * X and Z use the box CENTRE so the car straddles the origin. Y uses the box
   * MINIMUM so the wheels rest exactly on the floor plane at y = 0.
   */
  const centre = new THREE.Vector3();
  box.getCenter(centre);

  return {
    scale,
    rawSize,
    offset: new THREE.Vector3(centre.x, box.min.y, centre.z),
    isMeasured: true,
  };
}

/**
 * Estimate the model's height and half-length AFTER auto-fit, so hotspot
 * anchors expressed as ratios of the normalised box can be turned into
 * world positions.
 */
export function fitDimensions(rawSize: THREE.Vector3, scale: number) {
  return {
    width: rawSize.x * scale,
    height: rawSize.y * scale,
    length: rawSize.z * scale,
  };
}

/* ------------------------------------------------------------------ */
/* Unit normalisation                                                  */
/* ------------------------------------------------------------------ */

/**
 * How many WORLD units one authored unit maps to.
 *
 * The GLBs in this fleet are authored at wildly different unit scales, and
 * `GLTFLoader` applies its own normalisation on top. The practical effect is
 * that a value like `5.77` read from the file's accessor min/max does NOT
 * correspond to 5.77 world units — after decoding, the BMW's 5.77 authored
 * units occupy roughly 0.04 world units.
 *
 * So a baked dimension alone is not enough to scale by. What we need is the
 * conversion ratio, which is the measured world extent divided by the authored
 * extent.
 *
 * The measurement walks the decoded meshes directly. Draco buffers are
 * populated before `useGLTF` resolves, so by the time this runs the geometry
 * is present and `computeBoundingBox()` gives a real answer.
 *
 * Returns 1 when the mesh cannot be measured (undecoded, empty, or a
 * non-finite box) so the caller degrades to an unscaled model rather than
 * producing NaN in the scene graph.
 */
export function measureUnitsPerAuthored(
  root: THREE.Object3D,
  authoredLongest: number,
): number {
  if (!(authoredLongest > 0)) return 1

  root.updateMatrixWorld(true)

  const box = new THREE.Box3()
  const meshBox = new THREE.Box3()

  root.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return

    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    const gb = mesh.geometry.boundingBox
    if (!gb || gb.isEmpty()) return

    meshBox.copy(gb).applyMatrix4(mesh.matrixWorld)

    const s = meshBox.getSize(new THREE.Vector3())
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.z)) return
    if (s.x + s.y + s.z < 1e-9) return

    box.union(meshBox)
  })

  if (box.isEmpty()) return 1

  const size = box.getSize(new THREE.Vector3())
  const measuredLongest = Math.max(size.x, size.z)

  if (!Number.isFinite(measuredLongest) || measuredLongest <= 1e-9) return 1

  return measuredLongest / authoredLongest
}
