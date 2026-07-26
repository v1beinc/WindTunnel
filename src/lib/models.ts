import type { ObjectSpec } from "@/lib/physics/aerodynamics";

export const MODEL_CATALOG: ObjectSpec[] = [
  {
    id: "apex-rs",
    name: "Apex RS / sports coupe",
    kind: "car",
    dimensionsM: { length: 4.4, width: 1.86, height: 1.12 },
    frontalAreaM2: 2.05,
    dragCoefficient: 0.31,
    liftCoefficient: -0.12,
  },
  {
    id: "aero-wing",
    name: "NACA-style wing",
    kind: "wing",
    dimensionsM: { length: 2.4, width: 0.8, height: 0.24 },
    frontalAreaM2: 0.48,
    dragCoefficient: 0.08,
    liftCoefficient: 0.62,
  },
  {
    id: "block",
    name: "Simple block",
    kind: "box",
    dimensionsM: { length: 2.2, width: 1.4, height: 1.1 },
    frontalAreaM2: 1.54,
    dragCoefficient: 1.05,
    liftCoefficient: 0.02,
  },
  {
    id: "sphere",
    name: "Sphere",
    kind: "sphere",
    dimensionsM: { length: 1.4, width: 1.4, height: 1.4 },
    frontalAreaM2: 1.54,
    dragCoefficient: 0.47,
    liftCoefficient: 0,
  },
];

export const DEFAULT_OBJECT = MODEL_CATALOG[0];
