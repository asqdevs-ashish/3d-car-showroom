/**
 * A SQUARE DEVS CARS — Vehicle Data Architecture
 * ------------------------------------------------------------------
 * Every vehicle in the atelier is described by this shape. The 3D
 * showroom, the HUD, the configurator and the audio engine all read
 * from this single source of truth, so adding a car = adding an entry.
 *
 * NOTE ON MODEL SCALE
 * The 14 GLBs in /public/models were authored by different people and are
 * NOT in a common unit. Verified bounding boxes range from a 1.0-unit
 * placeholder (Koenigsegg Jesko) to 2266 units long (Lamborghini Revuelto,
 * authored in millimetres). We therefore never trust authored scale — see
 * `useAutoFit` in components/canvas/CarModel.tsx, which measures each model
 * at runtime and normalises it to a fixed on-screen length.
 */

export type HotspotId = "engine" | "brakes" | "aero" | "interior" | "exhaust";

/** Fleet groupings used by the HUD's filter badges. */
export type CarCategory = "hypercar" | "track" | "supercar" | "muscle" | "jdm";

export interface CarHotspot {
  id: HotspotId;
  /** Human label rendered on the 3D pin. */
  label: string;
  /**
   * Position as a FRACTION of the model's normalised bounding box:
   * [0,0,0] = centre of the car, +x = right, +y = up, +z = nose.
   *
   * Expressing these as ratios rather than absolute metres means the same
   * coordinates land correctly on every car regardless of its real size —
   * which matters because these models range from a 1-unit placeholder to
   * a 2266-unit millimetre-authored mesh.
   */
  anchor: [number, number, number];
  /** Short line shown under the label in the expanded card. */
  headline: string;
  /** Long-form copy revealed when the hotspot card expands. */
  detail: string;
  /** Key/value micro-specs shown as a grid inside the card. */
  stats: { label: string; value: string }[];
}

export interface CarSpecs {
  horsepower: string;
  topSpeed: string;
  zeroToSixty: string;
  engine: string;
  price: string;
}

export interface CarPaint {
  /** Display name shown in the configurator tooltip. */
  name: string;
  hex: string;
  /** 0 = gloss clearcoat, 1 = fully matte. Drives clearcoat roughness. */
  matte?: number;
  /** Optional second colour for satin/pearl metallics. */
  accent?: string;
}

export interface Car {
  id: string;
  name: string;
  tagline: string;
  brand: string;
  /** Year of the specific build shown. */
  year: number;
  /** Public path to the GLB. */
  modelPath: string;
  category: CarCategory;
  /**
   * Longest horizontal dimension of the source mesh, in the file's own units.
   *
   * THIS IS NOT OPTIONAL, and it is not a tuning knob.
   *
   * Every model here uses `KHR_draco_mesh_compression` as a REQUIRED
   * extension, so 100% of the geometry is compressed and its position buffers
   * are populated by the WASM decoder AFTER `useGLTF` resolves. A runtime
   * `Box3.setFromObject` therefore returns an empty box, auto-fit has nothing
   * to normalise against, and the car renders at the wrong scale — usually
   * outside the camera frustum, i.e. an empty stage.
   *
   * These values were measured directly from each GLB's accessor min/max, so
   * they are exact and fixed. `CarModel` scales by
   * `TARGET_CAR_LENGTH / modelLongest`, which needs no runtime measurement.
   */
  modelLongest: number;
  specs: CarSpecs;
  colors: CarPaint[];
  hotspots: CarHotspot[];
  /** Accent used for the car's HUD chrome + selector highlight. */
  signature: string;
  /**
   * Explicit material names to treat as body paint, if the model exposes
   * them. Verified against the real GLB material tables: BMW/Bugatti/Pagani
   * name their shell `..._Paint_Material`, Lamborghini uses
   * `MAT_CarpaintMain`, Aston uses `EXT_CARPAINT`, the Supra uses `ELBODY`.
   *
   * Models with no usable name (Porsche's `991_2phong*`, Koenigsegg's
   * `Material.00x`) are left undefined and fall back to the geometric
   * heuristic in `lib/modelInspect.ts`.
   */
  paintMaterials?: string[];
}

/* ------------------------------------------------------------------ */
/* Shared hotspot builders                                             */
/* ------------------------------------------------------------------ */

/** Brake spec pin, sitting at the front-left wheel arch. */
const brakes = (front: string, rear: string): CarHotspot => ({
  id: "brakes",
  label: "Brakes",
  anchor: [-0.38, -0.12, 0.28],
  headline: "Carbon-Ceramic Stopping Power",
  detail:
    "Drilled carbon-ceramic discs clamped by monobloc calipers. Fade-resistant to 800°C with a pedal that stays linear lap after lap.",
  stats: [
    { label: "Front", value: front },
    { label: "Rear", value: rear },
    { label: "Compound", value: "C-C / Monobloc" },
  ],
});

/** Drops the price pin, used by every car at the same relative spot. */
const pricePin = (price: string): CarHotspot => ({
  id: "interior",
  label: "Cockpit",
  anchor: [-0.22, 0.02, 0.1],
  headline: "Bespoke Cabin Specification",
  detail: `Hand-trimmed to commission. This build lists at ${price} before options, which typically add 15–25% on a car of this calibre.`,
  stats: [
    { label: "Base", value: price },
    { label: "Trim", value: "Hand-finished" },
    { label: "Lead time", value: "9–18 months" },
  ],
});

/* ------------------------------------------------------------------ */
/* The fleet — 14 vehicles                                             */
/* ------------------------------------------------------------------ */

export const cars: Car[] = [
  {
    id: "bmw-m4-gt3",
    name: "M4 GT3",
    tagline: "Homologation weapon, road-legal theatre.",
    brand: "BMW",
    year: 2022,
    modelPath: "/models/2022_bmw_m4_gt3.glb",
    modelLongest: 5.77,
    category: "track",
    signature: "#00F0FF",
    paintMaterials: ["BMW_M4GT3_2022Paint_Material"],
    specs: {
      horsepower: "590 hp",
      topSpeed: "180 mph",
      zeroToSixty: "3.4s",
      engine: "3.0L Twin-Turbo I6",
      price: "$620,000",
    },
    colors: [
      { name: "Alpine White", hex: "#ECEFF3" },
      { name: "Frozen Portimao", hex: "#1B4FD8" },
      { name: "Sao Paulo Yellow", hex: "#D8E000" },
      { name: "Frozen Black", hex: "#101216", matte: 0.65 },
      { name: "M Motorsport Red", hex: "#C1121F" },
    ],
    hotspots: [
      {
        id: "engine",
        label: "Engine",
        anchor: [0, 0.12, -0.08],
        headline: "S58 Twin-Turbo Straight-Six",
        detail:
          "3.0 litres, forged crank, twin mono-scroll turbos pushing 590 hp. Dry-sump lubrication keeps it fed through sustained 1.5g corners.",
        stats: [
          { label: "Output", value: "590 hp" },
          { label: "Torque", value: "553 lb-ft" },
          { label: "Redline", value: "7,200 rpm" },
        ],
      },
      brakes("380 mm", "360 mm"),
      {
        id: "aero",
        label: "Aero",
        anchor: [0, 0.3, -0.46],
        headline: "Swan-Neck Rear Wing",
        detail:
          "The swan-neck mount keeps the underside of the wing clean, generating downforce without drag. Adjustable across 12 angle positions.",
        stats: [
          { label: "Downforce", value: "1,040 kg" },
          { label: "Drag Cd", value: "0.42" },
          { label: "Positions", value: "12-step" },
        ],
      },
    ],
  },

  {
    id: "bmw-m4-gt3-evo",
    name: "M4 GT3 EVO",
    tagline: "The same weapon, sharpened for a new season.",
    brand: "BMW",
    year: 2025,
    modelPath: "/models/2025_bmw_m4_gt3_evo_g82.glb",
    modelLongest: 5.017,
    category: "track",
    signature: "#4DA6FF",
    paintMaterials: ["BMWMAT_GT3_EVO_car_paint1"],
    specs: {
      horsepower: "590 hp",
      topSpeed: "183 mph",
      zeroToSixty: "3.3s",
      engine: "3.0L Twin-Turbo I6",
      price: "$650,000",
    },
    colors: [
      { name: "EVO White", hex: "#E8EBEF" },
      { name: "Racing Blue", hex: "#1B4FD8" },
      { name: "Signal Green", hex: "#3FA34D" },
      { name: "Matte Carbon", hex: "#0E0F12", matte: 0.7 },
      { name: "M Red", hex: "#C1121F" },
    ],
    hotspots: [
      {
        id: "engine",
        label: "Engine",
        anchor: [0, 0.12, -0.08],
        headline: "S58 — EVO Calibration",
        detail:
          "Revised intercooling and a lighter exhaust manifold for 2025. Same 590 hp ceiling, but a wider usable torque plateau out of slow corners.",
        stats: [
          { label: "Output", value: "590 hp" },
          { label: "Gearbox", value: "Xtrac 6sp" },
          { label: "Weight", value: "1,320 kg" },
        ],
      },
      brakes("390 mm", "370 mm"),
      {
        id: "aero",
        label: "Aero",
        anchor: [0, 0.3, -0.46],
        headline: "EVO Body & Dive Planes",
        detail:
          "New front dive planes and a revised splitter lip add front-axle load without a drag penalty, balancing the swan-neck rear wing.",
        stats: [
          { label: "Downforce", value: "+8%" },
          { label: "Balance", value: "Neutral" },
          { label: "Homolog.", value: "FIA GT3" },
        ],
      },
    ],
  },

  {
    id: "porsche-911-gt3rs",
    name: "911 GT3 RS",
    tagline: "Aerodynamics borrowed from Le Mans.",
    brand: "Porsche",
    year: 2019,
    modelPath: "/models/2019_porsche_911_991.2_gt3_rs.glb",
    modelLongest: 4.546,
    category: "track",
    signature: "#E8CD74",
    /**
     * Porsche's GLB names its shell `991_2phong1SG1` / `2SG1` / `3SG1` —
     * generic shader names with no semantic meaning. We target them directly
     * because they are verifiably the body shell materials, but the suffix
     * pattern is fragile, so the runtime heuristic also runs.
     */
    paintMaterials: ["991_2phong1SG1", "991_2phong2SG1", "991_2phong3SG1"],
    specs: {
      horsepower: "520 hp",
      topSpeed: "193 mph",
      zeroToSixty: "3.2s",
      engine: "4.0L Naturally Aspirated Flat-Six",
      price: "$241,300",
    },
    colors: [
      { name: "GT Silver", hex: "#C6CBD1" },
      { name: "Guards Red", hex: "#D5001C" },
      { name: "Shark Blue", hex: "#1B4B7E" },
      { name: "Racing Yellow", hex: "#FFC900" },
      { name: "Lizard Green", hex: "#3C6B3F" },
      { name: "Satin Ice Grey", hex: "#9AA0A6", matte: 0.5 },
    ],
    hotspots: [
      {
        id: "engine",
        label: "Engine",
        anchor: [0, 0.1, -0.1],
        headline: "4.0L Naturally Aspirated Flat-Six",
        detail:
          "9,000 rpm redline, individual throttle bodies and rigid rocker-arm valve actuation. The last great atmospheric Porsche engine.",
        stats: [
          { label: "Output", value: "520 hp" },
          { label: "Redline", value: "9,000 rpm" },
          { label: "Layout", value: "Flat-six NA" },
        ],
      },
      brakes("410 mm", "390 mm"),
      {
        id: "aero",
        label: "Aero",
        anchor: [0, 0.28, -0.45],
        headline: "Fixed Rear Wing",
        detail:
          "A towering fixed wing on swan-neck mounts, with a Centre Radiator conversion freeing the nose for a deeper splitter.",
        stats: [
          { label: "Downforce", value: "860 kg" },
          { label: "At Speed", value: "177 mph" },
          { label: "Wing", value: "Fixed element" },
        ],
      },
    ],
  },

  {
    id: "mclaren-720s-gt3x",
    name: "720S GT3X",
    tagline: "A GT3 car unchained from the rulebook.",
    brand: "McLaren",
    year: 2021,
    modelPath: "/models/2021_mclaren_720s_gt3x.glb",
    modelLongest: 5.381,
    category: "track",
    signature: "#FF8000",
    specs: {
      horsepower: "720 hp",
      topSpeed: "205 mph",
      zeroToSixty: "2.7s",
      engine: "4.0L Twin-Turbo V8",
      price: "$620,000",
    },
    colors: [
      { name: "McLaren Orange", hex: "#FF8000" },
      { name: "Volcano Yellow", hex: "#FFC300" },
      { name: "Silica White", hex: "#F1F3F5" },
      { name: "Onyx Black", hex: "#0C0C0E" },
      { name: "Ludus Blue", hex: "#1763C4" },
    ],
    hotspots: [
      {
        id: "engine",
        label: "Engine",
        anchor: [0, 0.12, -0.08],
        headline: "4.0L Twin-Turbo V8 — M840T",
        detail:
          "The GT3X runs the GT3 engine without a balance-of-performance restrictor. 720 hp through a race clutch and a six-speed sequential.",
        stats: [
          { label: "Output", value: "720 hp" },
          { label: "Weight", value: "1,250 kg" },
          { label: "Boost", value: "Unrestricted" },
        ],
      },
      brakes("390 mm", "380 mm"),
      {
        id: "aero",
        label: "Aero",
        anchor: [0, 0.3, -0.46],
        headline: "Unrestricted Aero Package",
        detail:
          "Free of GT3 homologation limits, the wing, splitter and diffuser run their full race specification.",
        stats: [
          { label: "Downforce", value: "1,200 kg" },
          { label: "Body", value: "Full carbon" },
          { label: "Class", value: "GT3X" },
        ],
      },
    ],
  },

  {
    id: "ferrari-sf90-xx",
    name: "SF90 XX Stradale",
    tagline: "Track-only violence given number plates.",
    brand: "Ferrari",
    year: 2023,
    modelPath: "/models/2023_ferrari_sf90_xx_stradale.glb",
    modelLongest: 5.416,
    category: "hypercar",
    signature: "#D5001C",
    specs: {
      horsepower: "1,030 hp",
      topSpeed: "199 mph",
      zeroToSixty: "2.3s",
      engine: "4.0L Twin-Turbo V8 + 3 E-Motors",
      price: "$850,000",
    },
    colors: [
      { name: "Rosso Corsa", hex: "#D5001C" },
      { name: "Giallo Modena", hex: "#F5D000" },
      { name: "Nero Daytona", hex: "#121214" },
      { name: "Blu Tour de France", hex: "#1B3A6B" },
      { name: "Argento Nürburgring", hex: "#AEB4BB", matte: 0.45 },
    ],
    hotspots: [
      {
        id: "engine",
        label: "Engine",
        anchor: [0, 0.12, -0.08],
        headline: "4.0L Twin-Turbo V8 + Hybrid",
        detail:
          "The XX programme's first road-legal car. 1,030 hp with a fixed rear wing, running hybrid torque fill through three e-motors.",
        stats: [
          { label: "Combined", value: "1,030 hp" },
          { label: "V8", value: "797 hp" },
          { label: "EV Range", value: "15 mi" },
        ],
      },
      brakes("398 mm", "360 mm"),
      {
        id: "aero",
        label: "Aero",
        anchor: [0, 0.3, -0.46],
        headline: "Fixed XX Rear Wing",
        detail:
          "Unlike the Stradale's active flap, the XX runs a fixed wing generating 530 kg of downforce at 155 mph — the highest of any road Ferrari.",
        stats: [
          { label: "Downforce", value: "530 kg" },
          { label: "At Speed", value: "155 mph" },
          { label: "Wing", value: "Fixed CFRP" },
        ],
      },
    ],
  },

  {
    id: "lamborghini-revuelto",
    name: "Revuelto",
    tagline: "The V12 enters its hybrid era.",
    brand: "Lamborghini",
    year: 2024,
    modelPath: "/models/lamborghini_revuelto.glb",
    modelLongest: 4948.301,
    category: "hypercar",
    signature: "#A6FF4D",
    // This model is authored in millimetres (2266 units long) — auto-fit
    // rescales it to the same on-screen size as everything else.
    paintMaterials: ["MAT_CarpaintMain", "CarPaintBlack"],
    specs: {
      horsepower: "1,001 hp",
      topSpeed: "217 mph",
      zeroToSixty: "2.5s",
      engine: "6.5L V12 + Triple E-Motor Hybrid",
      price: "$608,358",
    },
    colors: [
      { name: "Giallo Orion", hex: "#F4C20D" },
      { name: "Verde Mantis", hex: "#5BBE4B" },
      { name: "Arancio Borealis", hex: "#F2620F" },
      { name: "Nero Nemesis", hex: "#0E0E11", matte: 0.55 },
      { name: "Blu Uranus", hex: "#2A6FD6" },
    ],
    hotspots: [
      {
        id: "engine",
        label: "Engine",
        anchor: [0, 0.12, -0.08],
        headline: "6.5L V12 + Three E-Motors",
        detail:
          "The V12 is rotated 180° to make room for a gearbox tunnel battery. Two front axial-flux motors plus one at the rear total 1,001 hp.",
        stats: [
          { label: "Combined", value: "1,001 hp" },
          { label: "Redline", value: "9,500 rpm" },
          { label: "E-Motors", value: "3 units" },
        ],
      },
      brakes("410 mm CCM-R", "390 mm CCM-R"),
      {
        id: "aero",
        label: "Aero",
        anchor: [0, 0.3, -0.46],
        headline: "Active Rear Wing",
        detail:
          "Electrically actuated wing moves through four positions, from a low-drag retracted state to maximum downforce under braking.",
        stats: [
          { label: "Downforce", value: "+66%" },
          { label: "Positions", value: "4-stage" },
          { label: "Torsion", value: "+25%" },
        ],
      },
    ],
  },

  {
    id: "bugatti-chiron-pur-sport",
    name: "Chiron Pur Sport",
    tagline: "The cornering Chiron, not the top-speed one.",
    brand: "Bugatti",
    year: 2021,
    modelPath: "/models/2021_bugatti_chiron_pur_sport.glb",
    modelLongest: 5.276,
    category: "hypercar",
    signature: "#2A6FD6",
    paintMaterials: ["Bugatti_ChironRMS_2020Paint_Material"],
    specs: {
      horsepower: "1,479 hp",
      topSpeed: "217 mph",
      zeroToSixty: "2.3s",
      engine: "8.0L Quad-Turbo W16",
      price: "$3,900,000",
    },
    colors: [
      { name: "Atlantic Blue", hex: "#12314F", accent: "#0B0B0D" },
      { name: "French Racing Blue", hex: "#1E4FD8" },
      { name: "Nocturne Black", hex: "#0A0A0C" },
      { name: "Silk Silver", hex: "#B9BEC6", matte: 0.4 },
      { name: "Gold Titanium", hex: "#8C6F1F" },
    ],
    hotspots: [
      {
        id: "engine",
        label: "Engine",
        anchor: [0, 0.12, -0.08],
        headline: "8.0L Quad-Turbo W16",
        detail:
          "Two V8s joined at 90°, four turbochargers and 16 radiators. In Pur Sport form the redline rises to 6,900 rpm with a shorter final drive.",
        stats: [
          { label: "Output", value: "1,479 hp" },
          { label: "Redline", value: "6,900 rpm" },
          { label: "Turbos", value: "4 staged" },
        ],
      },
      brakes("420 mm", "400 mm"),
      {
        id: "aero",
        label: "Aero",
        anchor: [0, 0.32, -0.46],
        headline: "1.9 m Fixed Rear Wing",
        detail:
          "The Pur Sport trades the Chiron's active wing for a fixed 1.9-metre element, adding 350 kg of downforce at the cost of top speed.",
        stats: [
          { label: "Downforce", value: "+350 kg" },
          { label: "Wing", value: "1.9 m fixed" },
          { label: "Vmax", value: "217 mph" },
        ],
      },
    ],
  },

  {
    id: "pagani-huayra-bc",
    name: "Huayra BC Roadster",
    tagline: "Art at 9,000 revolutions per minute.",
    brand: "Pagani",
    year: 2020,
    modelPath: "/models/2020_pagani_huayra_roadster_bc.glb",
    modelLongest: 5.646,
    category: "hypercar",
    signature: "#C6A15B",
    paintMaterials: ["Pagani_HuayraBCRoadsterLS_2019Paint_Material"],
    specs: {
      horsepower: "791 hp",
      topSpeed: "218 mph",
      zeroToSixty: "2.8s",
      engine: "6.0L Twin-Turbo V12 (AMG)",
      price: "$3,100,000",
    },
    colors: [
      { name: "Bianco Benny", hex: "#EDEFF1" },
      { name: "Nero Rinascimento", hex: "#101013", matte: 0.6 },
      { name: "Blu Francia", hex: "#1D4FA1" },
      { name: "Rosso Dubai", hex: "#B8202C" },
      { name: "Titanium Satin", hex: "#8E939A", matte: 0.7 },
    ],
    hotspots: [
      {
        id: "engine",
        label: "Engine",
        anchor: [0, 0.12, -0.08],
        headline: "6.0L Twin-Turbo V12 — AMG",
        detail:
          "Hand-built by AMG in Affalterbach to Pagani's specification, with a titanium exhaust that saves 7 kg over the standard system.",
        stats: [
          { label: "Output", value: "791 hp" },
          { label: "Torque", value: "774 lb-ft" },
          { label: "Builder", value: "AMG" },
        ],
      },
      brakes("398 mm", "380 mm Brembo"),
      {
        id: "aero",
        label: "Aero",
        anchor: [0, 0.3, -0.46],
        headline: "Active Flaps & Fixed Wing",
        detail:
          "Four independently actuated flaps on the body corners work with the rear wing to hold aero balance through direction changes.",
        stats: [
          { label: "Downforce", value: "+45%" },
          { label: "Flaps", value: "4 active" },
          { label: "Body", value: "Carbo-titanium" },
        ],
      },
    ],
  },

  {
    id: "aston-martin-valkyrie",
    name: "Valkyrie",
    tagline: "A Formula One car with number plates.",
    brand: "Aston Martin",
    year: 2021,
    modelPath: "/models/aston_martin_valkyrie.glb",
    modelLongest: 4.993,
    category: "hypercar",
    signature: "#0A6E5B",
    paintMaterials: ["EXT_CARPAINT"],
    specs: {
      horsepower: "1,160 hp",
      topSpeed: "217 mph",
      zeroToSixty: "2.5s",
      engine: "6.5L Cosworth N/A V12",
      price: "$3,200,000",
    },
    colors: [
      { name: "Aston Racing Green", hex: "#0A6E5B" },
      { name: "Podium Blue", hex: "#1B5FBF" },
      { name: "Stirling Red", hex: "#A6192E" },
      { name: "Liquid Silver", hex: "#C3C7CC" },
      { name: "Carbon Black", hex: "#0D0D10" },
    ],
    hotspots: [
      {
        id: "engine",
        label: "Engine",
        anchor: [0, 0.1, -0.08],
        headline: "6.5L Cosworth N/A V12",
        detail:
          "An 11,100 rpm V12 co-developed with Cosworth, weighing 206 kg and bolted directly between the tub and gearbox as a structural member.",
        stats: [
          { label: "Output", value: "1,160 hp" },
          { label: "Redline", value: "11,100 rpm" },
          { label: "Weight", value: "206 kg" },
        ],
      },
      brakes("398 mm", "380 mm F1-spec"),
      {
        id: "aero",
        label: "Aero",
        anchor: [0, 0.24, -0.46],
        headline: "F1-Style Venturi Floor",
        detail:
          "Venturi tunnels under the chassis generate 1,800 kg of downforce at 240 mph — doing a wing's job without the drag penalty.",
        stats: [
          { label: "Downforce", value: "1,800 kg" },
          { label: "Method", value: "Venturi floor" },
          { label: "Vmax", value: "217+ mph" },
        ],
      },
    ],
  },

  {
    id: "audi-r8-v10",
    name: "R8 V10 Performance",
    tagline: "The last naturally aspirated Audi supercar.",
    brand: "Audi",
    year: 2019,
    modelPath: "/models/2019_audi_r8_v10_performance_quattro.glb",
    modelLongest: 5.241,
    category: "supercar",
    signature: "#C6C6C6",
    specs: {
      horsepower: "602 hp",
      topSpeed: "205 mph",
      zeroToSixty: "3.1s",
      engine: "5.2L Naturally Aspirated V10",
      price: "$208,000",
    },
    colors: [
      { name: "Ibis White", hex: "#EFF1F3" },
      { name: "Daytona Grey", hex: "#6E7278" },
      { name: "Misano Red", hex: "#C8102E" },
      { name: "Sepang Blue", hex: "#1A4E8F" },
      { name: "Mythos Black", hex: "#0D0D10", matte: 0.55 },
    ],
    hotspots: [
      {
        id: "engine",
        label: "Engine",
        anchor: [0, 0.12, -0.08],
        headline: "5.2L Naturally Aspirated V10",
        detail:
          "Shares its block with the R8 LMS GT3. 8,700 rpm redline, dual injection and a dry-sump system lifted from the race car.",
        stats: [
          { label: "Output", value: "602 hp" },
          { label: "Redline", value: "8,700 rpm" },
          { label: "Drive", value: "Quattro AWD" },
        ],
      },
      brakes("380 mm", "356 mm"),
      {
        id: "aero",
        label: "Aero",
        anchor: [0, 0.26, -0.45],
        headline: "Fixed Rear Spoiler",
        detail:
          "A modest fixed spoiler and a flat underbody generate meaningful high-speed stability without the drag of a full wing.",
        stats: [
          { label: "Drag Cd", value: "0.33" },
          { label: "Downforce", value: "Balanced" },
          { label: "Body", value: "ASF aluminium" },
        ],
      },
    ],
  },

  {
    id: "nissan-gtr-nismo-gt3",
    name: "GT-R Nismo GT3",
    tagline: "Godzilla, homologated.",
    brand: "Nissan",
    year: 2018,
    modelPath: "/models/2018_nissan_gt-r_nismo_gt3.glb",
    modelLongest: 4.896,
    category: "track",
    signature: "#C8102E",
    specs: {
      horsepower: "600 hp",
      topSpeed: "190 mph",
      zeroToSixty: "3.2s",
      engine: "3.8L Twin-Turbo V6",
      price: "$580,000",
    },
    colors: [
      { name: "Brilliant White", hex: "#EDEFF1" },
      { name: "Vibrant Red", hex: "#C8102E" },
      { name: "Ultimate Silver", hex: "#B4B9BF" },
      { name: "Jet Black", hex: "#0C0C0F" },
      { name: "Nismo Blue", hex: "#1A4E8F" },
    ],
    hotspots: [
      {
        id: "engine",
        label: "Engine",
        anchor: [0, 0.12, -0.08],
        headline: "3.8L Twin-Turbo VR38DETT",
        detail:
          "The GT3 spec runs a pair of FIA-restricted turbochargers on the same VR38 block as the road car, assembled in a race-only clean room.",
        stats: [
          { label: "Output", value: "600 hp" },
          { label: "Torque", value: "481 lb-ft" },
          { label: "Layout", value: "Front-mid V6" },
        ],
      },
      brakes("390 mm", "380 mm"),
      {
        id: "aero",
        label: "Aero",
        anchor: [0, 0.3, -0.47],
        headline: "GT3 Rear Wing & Splitter",
        detail:
          "Developed alongside the road car in the same wind tunnel. Downforce can be trimmed track-to-track without a full geometry change.",
        stats: [
          { label: "Downforce", value: "1,050 kg" },
          { label: "Setup", value: "Track-tunable" },
          { label: "Class", value: "FIA GT3" },
        ],
      },
    ],
  },

  {
    id: "dodge-hellcat",
    name: "Challenger SRT Hellcat",
    tagline: "Supercharged American brutality.",
    brand: "Dodge",
    year: 2015,
    modelPath: "/models/dodge_challegner_srt_hellcat.glb",
    modelLongest: 8.003,
    category: "muscle",
    signature: "#E24B4B",
    paintMaterials: ["dDodge_ChallengerSRTHellcat_2015Paint_Material1"],
    specs: {
      horsepower: "707 hp",
      topSpeed: "199 mph",
      zeroToSixty: "3.6s",
      engine: "6.2L Supercharged HEMI V8",
      price: "$72,000",
    },
    colors: [
      { name: "Pitch Black", hex: "#0B0B0D" },
      { name: "TorRed", hex: "#C8102E" },
      { name: "Go Mango", hex: "#F26B21" },
      { name: "Frostbite", hex: "#2C6FB5" },
      { name: "Hellraisin", hex: "#3A2350" },
    ],
    hotspots: [
      {
        id: "engine",
        label: "Engine",
        anchor: [0, 0.12, -0.06],
        headline: "6.2L Supercharged HEMI V8",
        detail:
          "A 2.4-litre IHI supercharger bolted to a forged HEMI short-block. 707 hp makes it the most powerful muscle car ever homologated.",
        stats: [
          { label: "Output", value: "707 hp" },
          { label: "Torque", value: "650 lb-ft" },
          { label: "Boost", value: "11.6 psi" },
        ],
      },
      brakes("390 mm", "350 mm"),
      {
        id: "aero",
        label: "Aero",
        anchor: [0, 0.2, -0.46],
        headline: "Functional Bonnet Scoop",
        detail:
          "Twin NACA ducts feed the supercharger and act as heat extractors, while the rear spoiler is tuned for straight-line stability.",
        stats: [
          { label: "Top Speed", value: "199 mph" },
          { label: "Drag Cd", value: "0.38" },
          { label: "Downforce", value: "Balanced" },
        ],
      },
    ],
  },

  {
    id: "toyota-supra-mk5",
    name: "GR Supra MK5",
    tagline: "A legend rebooted, already a tuning icon.",
    brand: "Toyota",
    year: 2020,
    modelPath: "/models/custom_toyota_supra_mk5.glb",
    modelLongest: 56.078,
    category: "jdm",
    signature: "#E4002B",
    // This model's shell carries the `ELBODY` material names.
    paintMaterials: ["ELBODY", "ELBODY.002"],
    specs: {
      horsepower: "382 hp",
      topSpeed: "155 mph",
      zeroToSixty: "3.9s",
      engine: "3.0L Single-Turbo I6 (B58)",
      price: "$56,000",
    },
    colors: [
      { name: "Absolute Zero White", hex: "#EDEFF1" },
      { name: "Renaissance Red", hex: "#E4002B" },
      { name: "Nitro Yellow", hex: "#F5D000" },
      { name: "Nocturnal Black", hex: "#0B0B0D" },
      { name: "Turbulence Grey", hex: "#6E7278" },
    ],
    hotspots: [
      {
        id: "engine",
        label: "Engine",
        anchor: [0, 0.12, -0.08],
        headline: "3.0L Single-Turbo B58",
        detail:
          "BMW-derived B58 straight-six with a twin-scroll turbo integrated into the exhaust manifold. Over-engineered from the factory for tuning.",
        stats: [
          { label: "Output", value: "382 hp" },
          { label: "Torque", value: "368 lb-ft" },
          { label: "Layout", value: "Longitudinal I6" },
        ],
      },
      brakes("348 mm", "345 mm"),
      {
        id: "aero",
        label: "Aero",
        anchor: [0, 0.22, -0.44],
        headline: "Ducktail Boot Lip",
        detail:
          "A modest ducktail spoiler and underbody trays manage lift, rather than chasing headline downforce numbers.",
        stats: [
          { label: "Top Speed", value: "155 mph" },
          { label: "Balance", value: "50:50" },
          { label: "Body", value: "Steel / Aluminium" },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Category metadata (drives the HUD filter badges)                    */
/* ------------------------------------------------------------------ */

export const CAR_CATEGORIES: { id: CarCategory; label: string }[] = [
  { id: "hypercar", label: "Hypercars" },
  { id: "track", label: "Track / GT3" },
  { id: "supercar", label: "Supercars" },
  { id: "muscle", label: "Muscle" },
  { id: "jdm", label: "JDM" },
];

/* ------------------------------------------------------------------ */
/* Lookup helpers                                                      */
/* ------------------------------------------------------------------ */

export const DEFAULT_CAR_ID = cars[0].id;

export function getCarById(id: string): Car {
  return cars.find((car) => car.id === id) ?? cars[0];
}

export function getCarIndex(id: string): number {
  const index = cars.findIndex((car) => car.id === id);
  return index === -1 ? 0 : index;
}

export function getCarsByCategory(category: CarCategory | "all"): Car[] {
  if (category === "all") return cars;
  return cars.filter((car) => car.category === category);
}

export const carCount = cars.length;
