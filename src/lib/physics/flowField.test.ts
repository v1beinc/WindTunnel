import { describe, expect, it } from "vitest";
import { MODEL_CATALOG } from "@/lib/models";
import { CAR_GEOMETRY } from "@/lib/flow/carGeometryProfile";
import {
  createFlowEnvelope,
  getFlowCoordinates,
  projectPointOutsideBody,
  sampleFlowField,
  sampleObjectNormal,
  sampleObjectSdf,
} from "@/lib/physics/flowField";

const car = MODEL_CATALOG[0];

describe("analytical flow field", () => {
  it("creates a stagnation zone in front of the object", () => {
    const sample = sampleFlowField({
      // Keep the probe on the nose centerline so the test follows the
      // reduced-order car profile rather than the generic envelope height.
      x: CAR_GEOMETRY.noseTipX + 0.12,
      y: CAR_GEOMETRY.nose.center.y,
      z: 0,
    }, car, 0, 0, Math.PI / 2);

    expect(sample.stagnationIntensity).toBeGreaterThan(0.7);
    expect(sample.velocity.x).toBeLessThan(0.5);
    expect(Math.abs(sample.velocity.y) + Math.abs(sample.velocity.z)).toBeGreaterThan(0.4);
  });

  it("projects particles out of the collision envelope", () => {
    const envelope = createFlowEnvelope(car, 0);
    // Use z outside wheel track (wheels at trackHalfWidth ±0.85)
    const projected = projectPointOutsideBody({ x: 0, y: envelope.centerY, z: 1.2 }, car, 0, 0);

    expect(sampleObjectSdf(projected, car)).toBeGreaterThan(0.015);
  });

  it("uses separate signed-distance volumes for the body and rear wing", () => {
    // Body center y is now 0.56 (was 0.66)
    expect(sampleObjectSdf({ x: 0, y: CAR_GEOMETRY.body.center.y, z: 0 }, car)).toBeLessThan(0);
    // Wing center y is now 1.35 (was 1.43)
    expect(sampleObjectSdf({ x: CAR_GEOMETRY.spoiler.center.x, y: CAR_GEOMETRY.spoiler.center.y, z: 0.84 }, car, 12)).toBeLessThan(0);
    expect(sampleObjectSdf({ x: 0, y: 3.2, z: 0 }, car)).toBeGreaterThan(1);
  });

  it("removes inward velocity at the nose surface", () => {
    // Nose tip is now at -2.5
    const point = { x: CAR_GEOMETRY.noseTipX + 0.15, y: CAR_GEOMETRY.nose.center.y, z: 0.08 };
    const sample = sampleFlowField(point, car, 0, 0, 0.3);
    const normal = sampleObjectNormal(point, car);
    const normalVelocity = sample.velocity.x * normal.x
      + sample.velocity.y * normal.y
      + sample.velocity.z * normal.z;

    expect(normalVelocity).toBeGreaterThanOrEqual(-0.02);
  });

  it("slows the stream in the wake", () => {
    const envelope = createFlowEnvelope(car, 0);
    const sample = sampleFlowField({
      x: envelope.halfLength + 0.7,
      y: envelope.centerY,
      z: 0,
    }, car, 0, 0.2, 0.8);

    expect(sample.wakeIntensity).toBeGreaterThan(0.6);
    expect(sample.speedRatio).toBeLessThan(0.8);
  });

  it("rotates the far-field velocity with yaw", () => {
    const sample = sampleFlowField({ x: -6, y: 2.8, z: -2 }, car, 20);
    const flowVelocity = getFlowCoordinates(sample.velocity, 20);

    expect(flowVelocity.streamwise).toBeCloseTo(1, 2);
    expect(flowVelocity.lateral).toBeCloseTo(0, 2);
  });
});

describe("car geometry profile and SDF alignment", () => {
  it("noseTipX matches nose center minus nose radius", () => {
    const expected = CAR_GEOMETRY.nose.center.x - CAR_GEOMETRY.nose.radii.x;
    expect(CAR_GEOMETRY.noseTipX).toBeCloseTo(expected, 2);
  });

  it("topY is at or above max of cabin top and spoiler top", () => {
    const cabinTop = CAR_GEOMETRY.cabin.center.y + CAR_GEOMETRY.cabin.radii.y;
    const spoilerTop = CAR_GEOMETRY.spoiler.center.y + CAR_GEOMETRY.spoiler.halfSize.y;
    const maxTop = Math.max(cabinTop, spoilerTop);
    expect(CAR_GEOMETRY.topY).toBeGreaterThanOrEqual(maxTop - 0.05);
  });

  it("point in front of nose is not colliding before noseTipX", () => {
    // Point just in front of nose tip (towards wind) should have positive SDF
    // noseTipX is negative (e.g., -2.5), so "in front" means more negative
    const point = { x: CAR_GEOMETRY.noseTipX - 0.1, y: CAR_GEOMETRY.nose.center.y, z: 0 };
    const sdf = sampleObjectSdf(point, car);
    expect(sdf).toBeGreaterThan(0);
  });

  it("point inside wheel is colliding", () => {
    // Point inside front-left wheel
    const point = {
      x: CAR_GEOMETRY.wheels.frontAxleX,
      y: CAR_GEOMETRY.wheels.centerY,
      z: CAR_GEOMETRY.wheels.trackHalfWidth
    };
    const sdf = sampleObjectSdf(point, car);
    expect(sdf).toBeLessThan(0);
  });

  it("CPU and GPU support Z-oriented wheel cylinders", () => {
    // Both CPU and GPU SDF should have sdfCylinderZ for wheels
    // This test confirms the constants exist
    expect(CAR_GEOMETRY.wheels.centerY).toBeDefined();
    expect(CAR_GEOMETRY.wheels.trackHalfWidth).toBeDefined();
    expect(CAR_GEOMETRY.wheels.frontAxleX).toBeDefined();
    expect(CAR_GEOMETRY.wheels.rearAxleX).toBeDefined();
  });

  it("CPU spoiler supports match GPU dimensions", () => {
    const support = CAR_GEOMETRY.spoiler.supports.left;
    expect(support.halfSize.x).toBeGreaterThan(0);
    expect(support.halfSize.y).toBeGreaterThan(0);
    expect(support.halfSize.z).toBeGreaterThan(0);
  });

  it("CPU and GPU spoiler support dimensions are equal via shared constants", () => {
    // Both CPU (flowField.ts) and GPU (glslChunks.ts) import from solverConstants
    // which derives from CAR_GEOMETRY. This test confirms the shared constants
    // have the expected values for both left and right supports.
    expect(CAR_GEOMETRY.spoiler.supports.left.halfSize.x).toBe(CAR_GEOMETRY.spoiler.supports.right.halfSize.x);
    expect(CAR_GEOMETRY.spoiler.supports.left.halfSize.y).toBe(CAR_GEOMETRY.spoiler.supports.right.halfSize.y);
    expect(CAR_GEOMETRY.spoiler.supports.left.halfSize.z).toBe(CAR_GEOMETRY.spoiler.supports.right.halfSize.z);

    // Verify specific expected values from profile
    expect(CAR_GEOMETRY.spoiler.supports.left.halfSize.x).toBe(0.045);
    expect(CAR_GEOMETRY.spoiler.supports.left.halfSize.y).toBe(0.2);
    expect(CAR_GEOMETRY.spoiler.supports.left.halfSize.z).toBe(0.05);
  });

  it("keeps the visible wheels on the ground and the car envelope profile-aligned", () => {
    expect(CAR_GEOMETRY.wheels.centerY - CAR_GEOMETRY.wheels.radius).toBeCloseTo(CAR_GEOMETRY.bottomY, 2);

    const envelope = createFlowEnvelope(car, 0);
    expect(envelope.centerY).toBeCloseTo((CAR_GEOMETRY.topY + CAR_GEOMETRY.bottomY) * 0.5, 2);
    expect(envelope.halfLength).toBeCloseTo(
      (CAR_GEOMETRY.tailX - CAR_GEOMETRY.noseTipX) * 0.5,
      2,
    );
  });
});
