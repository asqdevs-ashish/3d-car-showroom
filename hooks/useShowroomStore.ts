"use client";

import { create } from "zustand";
import {
  cars,
  DEFAULT_CAR_ID,
  getCarById,
  getCarIndex,
  type Car,
  type CarCategory,
  type HotspotId,
} from "@/config/cars";
import { DEFAULT_CAMERA_PRESET } from "@/config/camera";

type ModalKind = "test-drive" | "inquire" | null;

/** "all" plus every real category — the HUD filter badge set. */
export type CategoryFilter = CarCategory | "all";

interface ShowroomState {
  /* --- Selection --- */
  selectedCarId: string;
  selectCar: (id: string) => void;
  /** Step through the fleet by ±1, wrapping at both ends. */
  stepCar: (direction: 1 | -1) => void;

  /* --- Paint --- */
  /** Hex currently applied to the body. Resets per-car on selection. */
  paintColor: string;
  paintName: string;
  setPaint: (hex: string, name: string) => void;

  /* --- Camera --- */
  cameraPresetId: string;
  setCameraPreset: (id: string) => void;
  /** True while GSAP owns the camera — OrbitControls is disabled. */
  isCameraAnimating: boolean;
  setCameraAnimating: (value: boolean) => void;
  /** Set by the canvas once the rig mounts so the HUD can trigger tours. */
  cameraApi: { goTo: (presetId: string) => void } | null;
  registerCameraApi: (api: { goTo: (presetId: string) => void } | null) => void;

  /* --- Hotspots --- */
  activeHotspot: { carId: string; hotspotId: HotspotId } | null;
  setActiveHotspot: (carId: string, hotspotId: HotspotId) => void;
  clearActiveHotspot: () => void;

  /* --- Fleet filtering --- */
  categoryFilter: CategoryFilter;
  setCategoryFilter: (category: CategoryFilter) => void;

  /* --- Model health --- */
  /**
   * Per-car GLB load failure, keyed by car id. The canvas reports into this
   * so the HUD can tell the user a model is missing instead of silently
   * showing an empty stage.
   */
  modelErrors: Record<string, string | null>;
  setModelError: (carId: string, reason: string | null) => void;

  /* --- UI --- */
  modal: ModalKind;
  openModal: (kind: Exclude<ModalKind, null>) => void;
  closeModal: () => void;
  isLoading: boolean;
  setLoading: (value: boolean) => void;
}

export const useShowroom = create<ShowroomState>((set, get) => ({
  selectedCarId: DEFAULT_CAR_ID,

  selectCar: (id) => {
    const car = getCarById(id);
    set({
      selectedCarId: car.id,
      // First colour of the new car becomes the applied paint.
      paintColor: car.colors[0].hex,
      paintName: car.colors[0].name,
      activeHotspot: null,
    });
  },

  stepCar: (direction) => {
    const { selectedCarId, categoryFilter } = get();

    /*
     * Stepping respects the active category filter, so the arrows move
     * through the visible list rather than jumping to a car the user has
     * filtered out.
     */
    const pool =
      categoryFilter === "all"
        ? cars
        : cars.filter((c) => c.category === categoryFilter);

    if (pool.length === 0) return;

    const currentIndex = pool.findIndex((c) => c.id === selectedCarId);
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + direction + pool.length) % pool.length;

    get().selectCar(pool[nextIndex].id);
  },

  paintColor: getCarById(DEFAULT_CAR_ID).colors[0].hex,
  paintName: getCarById(DEFAULT_CAR_ID).colors[0].name,
  setPaint: (hex, name) => set({ paintColor: hex, paintName: name }),

  cameraPresetId: DEFAULT_CAMERA_PRESET,
  setCameraPreset: (id) => set({ cameraPresetId: id }),

  isCameraAnimating: false,
  setCameraAnimating: (value) => set({ isCameraAnimating: value }),

  cameraApi: null,
  registerCameraApi: (api) => set({ cameraApi: api }),

  activeHotspot: null,
  setActiveHotspot: (carId, hotspotId) =>
    set({ activeHotspot: { carId, hotspotId } }),
  clearActiveHotspot: () => set({ activeHotspot: null }),

  categoryFilter: "all",
  setCategoryFilter: (category) => set({ categoryFilter: category }),

  modelErrors: {},
  setModelError: (carId, reason) =>
    set((state) => ({ modelErrors: { ...state.modelErrors, [carId]: reason } })),

  modal: null,
  openModal: (kind) => set({ modal: kind }),
  closeModal: () => set({ modal: null }),

  isLoading: true,
  setLoading: (value) => set({ isLoading: value }),
}));

/* --- Derived selectors (keep components from re-rendering on everything) --- */

export const useSelectedCar = () =>
  useShowroom((state) => getCarById(state.selectedCarId));

/**
 * The cars currently visible under the active category filter.
 *
 * Results are precomputed into a stable map rather than calling `cars.filter`
 * inside the selector.
 *
 * This matters more than it looks: a selector that builds a new array on
 * every call returns a fresh reference each render, and zustand's default
 * `Object.is` comparison therefore reports the value as changed *every* time.
 * That produced an infinite re-render loop which React eventually aborted by
 * unmounting the whole tree — the "Application error" crash that appeared
 * whenever a category badge was clicked.
 *
 * Keeping one array per category means the reference only changes when the
 * filter genuinely changes.
 */
const CARS_BY_CATEGORY: Record<string, Car[]> = {
  all: cars,
  ...cars.reduce<Record<string, Car[]>>((acc, car) => {
    acc[car.category] = [...(acc[car.category] ?? []), car];
    return acc;
  }, {}),
};

/** The cars visible under the active filter. Reference-stable per category. */
export const useFilteredCars = () => {
  const categoryFilter = useShowroom((state) => state.categoryFilter);
  return CARS_BY_CATEGORY[categoryFilter] ?? cars;
};

/** True when the selected car's GLB failed to load. */
export const useSelectedCarError = () =>
  useShowroom((state) => state.modelErrors[state.selectedCarId] ?? null);
