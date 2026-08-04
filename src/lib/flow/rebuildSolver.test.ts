import { describe, expect, it } from "vitest";
import { CAR_GEOMETRY } from "@/lib/flow/carGeometryProfile";
import {
  createRebuildPoint,
  createRebuildStreamline,
  getRebuildFlowCoordinates,
  sampleRebuildFlowField,
  type RebuildSolverConfig,
} from "@/lib/flow/rebuildSolver";
import { MODEL_CATALOG } from "@/lib/models";
import { sampleObjectSdf } from "@/lib/physics/flowField";

const config: RebuildSolverConfig = {
  object: MODEL_CATALOG[0],
  yawAngleDeg: 0,
  speedMps: 27.8,
  spoilerAngleDeg: 12,
  turbulenceStrength: 1,
};

describe("rebuild visual flow solver", () => {
  it("keeps a forward free-stream velocity away from the object", () => {
    const point = createRebuildPoint(-6.5, 2.5, 2.1, 0);
    const sample = sampleRebuildFlowField(point, config);

    expect(sample.velocity.x).toBeGreaterThan(1.4);
    expect(sample.speedRatio).toBeGreaterThan(0.9);
    expect(sample.wakeIntensity).toBe(0);
  });

  it("routes the upper and lower stream around the body symmetrically", () => {
    const upper = sampleRebuildFlowField(createRebuildPoint(-1.8, 0, 1.085, 0), config, 0, 0, 1);
    const lower = sampleRebuildFlowField(createRebuildPoint(-1.8, 0, 0.285, 0), config, 0, 0, -1);

    expect(Math.sign(upper.velocity.y)).toBe(1);
    expect(Math.sign(lower.velocity.y)).toBe(-1);
    expect(Math.abs(upper.velocity.y)).toBeCloseTo(Math.abs(lower.velocity.y), 1);
  });

  it("does not create a stagnation wall in front of the nose", () => {
    const point = createRebuildPoint(CAR_GEOMETRY.noseTipX - 0.55, 0, CAR_GEOMETRY.nose.center.y, 0);
    const sample = sampleRebuildFlowField(point, config, 0, 0, 1);

    expect(sample.surfaceDistance).toBeGreaterThan(0);
    expect(sample.velocity.x).toBeGreaterThan(1.2);
  });

  it("starts streamlines at the inlet and keeps them outside the collision model", () => {
    const points = createRebuildStreamline(config, { lateral: 0, height: 1.62, phase: 0, laneBias: 1 }, 112);
    const first = getRebuildFlowCoordinates(points[0], 0);

    expect(first.streamwise).toBe(-7.15);
    expect(Math.min(...points.map((point) => sampleObjectSdf(point, config.object, config.spoilerAngleDeg)))).toBeGreaterThanOrEqual(-0.001);
  });

  it("makes spoiler angle change the local downwash", () => {
    const point = createRebuildPoint(CAR_GEOMETRY.spoiler.center.x, 0, CAR_GEOMETRY.spoiler.center.y + 0.22, 0);
    const neutral = sampleRebuildFlowField(point, { ...config, spoilerAngleDeg: 0 });
    const loaded = sampleRebuildFlowField(point, { ...config, spoilerAngleDeg: 26 });

    expect(loaded.velocity.y).toBeLessThan(neutral.velocity.y);
  });
});
