import { describe, expect, it } from "vitest";
import { calculateMetrics, type SimulationConfig } from "@/lib/physics/aerodynamics";

const config: SimulationConfig = {
  windSpeedMps: 20,
  yawAngleDeg: 0,
  airDensityKgM3: 1.225,
  spoilerAngleDeg: 12,
  object: {
    id: "test",
    name: "Test object",
    kind: "box",
    dimensionsM: { length: 2, width: 1, height: 1 },
    frontalAreaM2: 1,
    dragCoefficient: 1,
    liftCoefficient: -0.2,
  },
};

describe("calculateMetrics", () => {
  it("returns zero force at zero wind", () => {
    const metrics = calculateMetrics({ ...config, windSpeedMps: 0 });
    expect(metrics.dynamicPressurePa).toBe(0);
    expect(metrics.dragForceN).toBe(0);
    expect(metrics.liftForceN).toBe(0);
    expect(metrics.dragPowerW).toBe(0);
  });

  it("matches the reduced-order pressure and force equations", () => {
    const metrics = calculateMetrics(config);
    expect(metrics.dynamicPressurePa).toBeCloseTo(245, 6);
    expect(metrics.dragForceN).toBeCloseTo(245, 6);
    expect(metrics.liftForceN).toBeCloseTo(-49, 6);
    expect(metrics.dragPowerW).toBeCloseTo(4900, 6);
  });

  it("increases drag quadratically as speed doubles", () => {
    const fast = calculateMetrics({ ...config, windSpeedMps: 40 });
    const slow = calculateMetrics({ ...config, windSpeedMps: 20 });
    expect(fast.dragForceN / slow.dragForceN).toBeCloseTo(4, 6);
  });

  it("reports signed side force with yaw", () => {
    const left = calculateMetrics({ ...config, yawAngleDeg: -15 });
    const right = calculateMetrics({ ...config, yawAngleDeg: 15 });
    expect(left.sideForceN).toBeLessThan(0);
    expect(right.sideForceN).toBeGreaterThan(0);
    expect(Math.abs(left.sideForceN)).toBeCloseTo(Math.abs(right.sideForceN), 6);
  });

  it("reports Reynolds number and an approximate wake deficit", () => {
    const metrics = calculateMetrics(config);
    expect(metrics.reynoldsNumber).toBeGreaterThan(2_000_000);
    expect(metrics.estimatedWakeDeficitPct).toBeGreaterThan(0);
    expect(metrics.estimatedWakeDeficitPct).toBeLessThan(100);
  });

  it("adds drag and downforce when a car rear wing is increased", () => {
    const carConfig: SimulationConfig = {
      ...config,
      spoilerAngleDeg: 0,
      object: { ...config.object, kind: "car", dragCoefficient: 0.31, liftCoefficient: -0.12 },
    };
    const neutral = calculateMetrics(carConfig);
    const loaded = calculateMetrics({ ...carConfig, spoilerAngleDeg: 24 });

    expect(loaded.dragForceN).toBeGreaterThan(neutral.dragForceN);
    expect(loaded.liftForceN).toBeLessThan(neutral.liftForceN);
    expect(loaded.spoilerDownforceN).toBeGreaterThan(0);
  });
});
