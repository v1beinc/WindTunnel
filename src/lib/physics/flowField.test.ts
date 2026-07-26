import { describe, expect, it } from "vitest";
import { MODEL_CATALOG } from "@/lib/models";
import {
  createFlowEnvelope,
  getFlowCoordinates,
  projectPointOutsideBody,
  sampleFlowField,
} from "@/lib/physics/flowField";

const car = MODEL_CATALOG[0];

describe("analytical flow field", () => {
  it("creates a stagnation zone in front of the object", () => {
    const envelope = createFlowEnvelope(car, 0);
    const sample = sampleFlowField({
      x: -envelope.halfLength - 0.12,
      y: envelope.centerY,
      z: 0,
    }, car, 0, 0, Math.PI / 2);

    expect(sample.stagnationIntensity).toBeGreaterThan(0.8);
    expect(sample.velocity.x).toBeLessThan(0.5);
    expect(Math.abs(sample.velocity.y) + Math.abs(sample.velocity.z)).toBeGreaterThan(0.4);
  });

  it("projects particles out of the collision envelope", () => {
    const envelope = createFlowEnvelope(car, 0);
    const projected = projectPointOutsideBody({ x: 0, y: envelope.centerY, z: 0 }, car, 0, 0);
    const radialDistance = Math.sqrt(
      (projected.z / envelope.halfWidth) ** 2
      + ((projected.y - envelope.centerY) / envelope.halfHeight) ** 2,
    );

    expect(radialDistance).toBeGreaterThan(1);
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
