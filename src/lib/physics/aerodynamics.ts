import { z } from "zod";

export const objectSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["car", "box", "wing", "sphere", "glb"]),
  dimensionsM: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  frontalAreaM2: z.number().positive(),
  dragCoefficient: z.number().min(0).max(10),
  liftCoefficient: z.number().min(-10).max(10),
});

export const simulationConfigSchema = z.object({
  windSpeedMps: z.number().min(0).max(100),
  yawAngleDeg: z.number().min(-45).max(45),
  airDensityKgM3: z.number().min(0.5).max(2),
  spoilerAngleDeg: z.number().min(0).max(30).default(12),
  object: objectSpecSchema,
});

export type ObjectSpec = z.infer<typeof objectSpecSchema>;
export type SimulationConfig = z.infer<typeof simulationConfigSchema>;

export type SimulationMetrics = {
  dynamicPressurePa: number;
  dragForceN: number;
  liftForceN: number;
  sideForceN: number;
  dragPowerW: number;
  effectiveWindSpeedMps: number;
  reynoldsNumber: number;
  estimatedWakeDeficitPct: number;
  effectiveDragCoefficient: number;
  effectiveLiftCoefficient: number;
  spoilerDownforceN: number;
};

const DEG_TO_RAD = Math.PI / 180;
const AIR_DYNAMIC_VISCOSITY_PA_S = 1.81e-5;

export function calculateMetrics(config: SimulationConfig): SimulationMetrics {
  const { windSpeedMps, yawAngleDeg, airDensityKgM3, spoilerAngleDeg, object } = config;
  const yawRadians = yawAngleDeg * DEG_TO_RAD;
  const spoilerAngleRadians = spoilerAngleDeg * DEG_TO_RAD;
  const spoilerLoad = object.kind === "car" ? Math.max(0, Math.sin(spoilerAngleRadians)) : 0;
  const spoilerDragDelta = spoilerLoad * 0.08;
  const spoilerLiftDelta = -spoilerLoad * 0.38;
  const effectiveDragCoefficient = object.dragCoefficient + spoilerDragDelta;
  const effectiveLiftCoefficient = object.liftCoefficient + spoilerLiftDelta;
  const effectiveWindSpeedMps = windSpeedMps * Math.cos(yawRadians);
  const dynamicPressurePa = 0.5 * airDensityKgM3 * windSpeedMps ** 2;
  const dragForceN =
    dynamicPressurePa * effectiveDragCoefficient * object.frontalAreaM2;
  const liftForceN =
    dynamicPressurePa * effectiveLiftCoefficient * object.frontalAreaM2 || 0;
  const spoilerDownforceN =
    dynamicPressurePa * Math.abs(spoilerLiftDelta) * object.frontalAreaM2;
  const sideCoefficient = Math.sin(yawRadians) * 0.85;
  const sideForceN = dynamicPressurePa * sideCoefficient * object.frontalAreaM2 || 0;
  const dragPowerW = dragForceN * effectiveWindSpeedMps;
  const reynoldsNumber =
    (airDensityKgM3 * effectiveWindSpeedMps * object.dimensionsM.length)
    / AIR_DYNAMIC_VISCOSITY_PA_S;
  const estimatedWakeDeficitPct =
    (1 - 1 / Math.sqrt(1 + effectiveDragCoefficient * 1.4)) * 100;

  return {
    dynamicPressurePa,
    dragForceN,
    liftForceN,
    sideForceN,
    dragPowerW,
    effectiveWindSpeedMps,
    reynoldsNumber,
    estimatedWakeDeficitPct,
    effectiveDragCoefficient,
    effectiveLiftCoefficient,
    spoilerDownforceN,
  };
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
