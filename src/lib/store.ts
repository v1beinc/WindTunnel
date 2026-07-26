"use client";

import { create } from "zustand";
import { z } from "zod";
import {
  calculateMetrics,
  simulationConfigSchema,
  type ObjectSpec,
  type SimulationConfig,
} from "@/lib/physics/aerodynamics";
import { DEFAULT_OBJECT } from "@/lib/models";

export const overlaysSchema = z.object({
  particles: z.boolean(),
  streamlines: z.boolean(),
  ribbons: z.boolean(),
  wake: z.boolean(),
  vectors: z.boolean(),
  pressure: z.boolean(),
});

export type Overlays = z.infer<typeof overlaysSchema>;

export const flowModeSchema = z.enum(["particles", "streamlines", "pressure", "velocity"]);
export type FlowMode = z.infer<typeof flowModeSchema>;

export type Snapshot = {
  label: string;
  config: SimulationConfig;
  metrics: ReturnType<typeof calculateMetrics>;
};

type WindTunnelState = {
  config: SimulationConfig;
  overlays: Overlays;
  flowMode: FlowMode;
  snapshot: Snapshot | null;
  hydrated: boolean;
  setHydrated: (hydrated: boolean) => void;
  setWindSpeed: (windSpeedMps: number) => void;
  setYawAngle: (yawAngleDeg: number) => void;
  setAirDensity: (airDensityKgM3: number) => void;
  setSpoilerAngle: (spoilerAngleDeg: number) => void;
  setObject: (object: ObjectSpec) => void;
  setObjectDimensions: (dimensions: ObjectSpec["dimensionsM"]) => void;
  setOverlay: (key: keyof Overlays) => void;
  setFlowMode: (flowMode: FlowMode) => void;
  setSnapshot: () => void;
  reset: () => void;
  restore: (config: SimulationConfig, overlays: Overlays, flowMode?: FlowMode) => void;
};

export const DEFAULT_CONFIG: SimulationConfig = {
  windSpeedMps: 27.8,
  yawAngleDeg: 0,
  airDensityKgM3: 1.225,
  spoilerAngleDeg: 12,
  object: DEFAULT_OBJECT,
};

export const DEFAULT_OVERLAYS: Overlays = {
  particles: false,
  streamlines: false,
  ribbons: false,
  wake: true,
  vectors: false,
  pressure: false,
};

export const useWindTunnelStore = create<WindTunnelState>((set, get) => ({
  config: DEFAULT_CONFIG,
  overlays: DEFAULT_OVERLAYS,
  flowMode: "particles",
  snapshot: null,
  hydrated: false,
  setHydrated: (hydrated) => set({ hydrated }),
  setWindSpeed: (windSpeedMps) =>
    set((state) => ({ config: { ...state.config, windSpeedMps } })),
  setYawAngle: (yawAngleDeg) =>
    set((state) => ({ config: { ...state.config, yawAngleDeg } })),
  setAirDensity: (airDensityKgM3) =>
    set((state) => ({ config: { ...state.config, airDensityKgM3 } })),
  setSpoilerAngle: (spoilerAngleDeg) =>
    set((state) => ({ config: { ...state.config, spoilerAngleDeg } })),
  setObject: (object) =>
    set((state) => ({ config: { ...state.config, object } })),
  setObjectDimensions: (dimensions) =>
    set((state) => {
      if (state.config.object.kind !== "glb") return state;
      const previous = state.config.object.dimensionsM;
      const isUnchanged = Math.abs(previous.length - dimensions.length) < 0.001
        && Math.abs(previous.width - dimensions.width) < 0.001
        && Math.abs(previous.height - dimensions.height) < 0.001;
      if (isUnchanged) return state;
      return {
        config: {
          ...state.config,
          object: {
            ...state.config.object,
            dimensionsM: dimensions,
            frontalAreaM2: Math.max(dimensions.width * dimensions.height, 0.01),
          },
        },
      };
    }),
  setOverlay: (key) =>
    set((state) => ({
      overlays: { ...state.overlays, [key]: !state.overlays[key] },
    })),
  setFlowMode: (flowMode) => set({ flowMode }),
  setSnapshot: () => {
    const { config } = get();
    set({
      snapshot: {
        label: `${config.object.name} / ${Math.round(config.windSpeedMps * 3.6)} km/h`,
        config,
        metrics: calculateMetrics(config),
      },
    });
  },
  reset: () => set({ config: DEFAULT_CONFIG, overlays: DEFAULT_OVERLAYS, flowMode: "particles", snapshot: null }),
  restore: (config, overlays, flowMode = "particles") => {
    const safeConfig = simulationConfigSchema.parse(config);
    const safeOverlays = overlaysSchema.parse(overlays);
    const safeFlowMode = flowModeSchema.parse(flowMode);
    set({ config: safeConfig, overlays: safeOverlays, flowMode: safeFlowMode });
  },
}));
