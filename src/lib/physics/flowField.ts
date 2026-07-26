import type { ObjectSpec } from "@/lib/physics/aerodynamics";

export type FlowPoint = {
  x: number;
  y: number;
  z: number;
};

export type FlowSample = {
  velocity: FlowPoint;
  speedRatio: number;
  wakeIntensity: number;
  stagnationIntensity: number;
};

export type FlowEnvelope = {
  halfLength: number;
  halfWidth: number;
  halfHeight: number;
  centerY: number;
  yawRadians: number;
};

export type StreamlineSeed = {
  lateral: number;
  height: number;
  phase: number;
};

const DEG_TO_RAD = Math.PI / 180;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function gaussian(value: number) {
  return Math.exp(-(value * value));
}

function toFlowCoordinates(point: FlowPoint, yawRadians: number) {
  const cosYaw = Math.cos(yawRadians);
  const sinYaw = Math.sin(yawRadians);
  return {
    streamwise: point.x * cosYaw + point.z * sinYaw,
    lateral: -point.x * sinYaw + point.z * cosYaw,
  };
}

function fromFlowCoordinates(streamwise: number, lateral: number, yawRadians: number) {
  const cosYaw = Math.cos(yawRadians);
  const sinYaw = Math.sin(yawRadians);
  return {
    x: streamwise * cosYaw - lateral * sinYaw,
    z: streamwise * sinYaw + lateral * cosYaw,
  };
}

export function createFlowEnvelope(object: ObjectSpec, yawAngleDeg: number): FlowEnvelope {
  const yawRadians = yawAngleDeg * DEG_TO_RAD;
  const bodyLength = object.kind === "car" ? object.dimensionsM.length * 0.9 : object.dimensionsM.length;
  const bodyHalfLength = clamp(bodyLength * 0.5, 0.48, 2.35);
  const bodyHalfWidth = clamp(object.dimensionsM.width * 0.5, 0.22, 1.55);
  const halfHeight = clamp(object.dimensionsM.height * 0.5, 0.14, 1.35);
  const cosYaw = Math.abs(Math.cos(yawRadians));
  const sinYaw = Math.abs(Math.sin(yawRadians));

  return {
    halfLength: bodyHalfLength * cosYaw + bodyHalfWidth * sinYaw,
    halfWidth: bodyHalfLength * sinYaw + bodyHalfWidth * cosYaw,
    halfHeight,
    centerY: halfHeight + 0.06,
    yawRadians,
  };
}

export function sampleFlowField(
  point: FlowPoint,
  object: ObjectSpec,
  yawAngleDeg: number,
  time = 0,
  phase = 0,
  turbulenceStrength = 1,
): FlowSample {
  const envelope = createFlowEnvelope(object, yawAngleDeg);
  const flowPoint = toFlowCoordinates(point, envelope.yawRadians);
  const streamwise = flowPoint.streamwise;
  const lateral = flowPoint.lateral;
  const vertical = point.y - envelope.centerY;
  const lateralNormalized = lateral / envelope.halfWidth;
  const verticalNormalized = vertical / envelope.halfHeight;
  const radialDistance = Math.sqrt(lateralNormalized ** 2 + verticalNormalized ** 2);
  const safeRadialDistance = Math.max(radialDistance, 0.055);

  let radialLateral = lateralNormalized / safeRadialDistance;
  let radialVertical = verticalNormalized / safeRadialDistance;
  if (radialDistance < 0.055) {
    radialLateral = Math.cos(phase) * 0.5;
    radialVertical = 0.82 + Math.abs(Math.sin(phase)) * 0.18;
  }

  const noseDistance = streamwise + envelope.halfLength;
  const stagnationIntensity = clamp(
    gaussian(noseDistance / 0.95) * gaussian(radialDistance / 1.18),
    0,
    1,
  );
  const bodyCoordinate = streamwise / envelope.halfLength;
  const localBodyRadius = Math.sqrt(Math.max(0.035, 1 - bodyCoordinate ** 2));
  const surfaceDistance = radialDistance - localBodyRadius;
  const aroundBody = Math.abs(bodyCoordinate) < 1.15
    ? gaussian(surfaceDistance / 0.32) * (1 - stagnationIntensity * 0.42)
    : 0;

  let streamwiseVelocity = 1 - stagnationIntensity * 0.82 + aroundBody * 0.42;
  let lateralVelocity = radialLateral * (stagnationIntensity * 0.94 + aroundBody * 0.19);
  let verticalVelocity = radialVertical * (stagnationIntensity * 0.94 + aroundBody * 0.19);

  const wakeDistance = streamwise - envelope.halfLength;
  const wakeExpansion = 1 + Math.max(0, wakeDistance) * 0.115;
  const wakeCore = (lateralNormalized / wakeExpansion) ** 2 + (verticalNormalized / wakeExpansion) ** 2;
  const wakeIntensity = wakeDistance > 0
    ? clamp(Math.exp(-wakeCore * 1.25) * Math.exp(-wakeDistance / 6.2), 0, 1)
    : 0;
  const wakeDeficit = clamp(0.3 + object.dragCoefficient * 0.3, 0.3, 0.74);
  streamwiseVelocity *= 1 - wakeIntensity * wakeDeficit;

  const vortex = wakeIntensity
    * (0.24 + object.dragCoefficient * 0.16)
    * Math.sin(time * 3.4 + phase + wakeDistance * 2.15)
    * turbulenceStrength;
  lateralVelocity += vortex * radialVertical;
  verticalVelocity -= vortex * radialLateral;

  if (Math.abs(bodyCoordinate) < 1 && radialDistance < localBodyRadius) {
    streamwiseVelocity *= 0.05;
    const penetration = localBodyRadius - radialDistance;
    lateralVelocity += radialLateral * (1.45 + penetration * 1.8);
    verticalVelocity += radialVertical * (1.45 + penetration * 1.8);
  }

  const worldVelocity = fromFlowCoordinates(streamwiseVelocity, lateralVelocity, envelope.yawRadians);
  const velocity = { x: worldVelocity.x, y: verticalVelocity, z: worldVelocity.z };

  return {
    velocity,
    speedRatio: clamp(Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2), 0, 1.8),
    wakeIntensity,
    stagnationIntensity,
  };
}

export function projectPointOutsideBody(
  point: FlowPoint,
  object: ObjectSpec,
  yawAngleDeg: number,
  phase = 0,
): FlowPoint {
  const envelope = createFlowEnvelope(object, yawAngleDeg);
  const flowPoint = toFlowCoordinates(point, envelope.yawRadians);
  const bodyCoordinate = flowPoint.streamwise / envelope.halfLength;
  if (Math.abs(bodyCoordinate) >= 1) return { ...point, y: Math.max(point.y, 0.055) };

  const localBodyRadius = Math.sqrt(Math.max(0, 1 - bodyCoordinate ** 2));
  const lateralNormalized = flowPoint.lateral / envelope.halfWidth;
  const verticalNormalized = (point.y - envelope.centerY) / envelope.halfHeight;
  const radialDistance = Math.sqrt(lateralNormalized ** 2 + verticalNormalized ** 2);
  if (radialDistance >= localBodyRadius + 0.025) return { ...point, y: Math.max(point.y, 0.055) };

  const safeDistance = Math.max(radialDistance, 0.04);
  const directionLateral = radialDistance < 0.04 ? Math.cos(phase) * 0.42 : lateralNormalized / safeDistance;
  const directionVertical = radialDistance < 0.04 ? 0.9 : verticalNormalized / safeDistance;
  const targetRadius = localBodyRadius + 0.035;
  const projectedLateral = directionLateral * targetRadius * envelope.halfWidth;
  const projectedY = envelope.centerY + directionVertical * targetRadius * envelope.halfHeight;
  const worldPoint = fromFlowCoordinates(flowPoint.streamwise, projectedLateral, envelope.yawRadians);

  return { x: worldPoint.x, y: Math.max(projectedY, 0.055), z: worldPoint.z };
}

export function createStreamline(
  object: ObjectSpec,
  yawAngleDeg: number,
  seed: StreamlineSeed,
  steps = 88,
  stepLength = 0.17,
): FlowPoint[] {
  const envelope = createFlowEnvelope(object, yawAngleDeg);
  const start = fromFlowCoordinates(-7.1, seed.lateral, envelope.yawRadians);
  let point: FlowPoint = { x: start.x, y: seed.height, z: start.z };
  const points: FlowPoint[] = [point];

  for (let index = 0; index < steps; index += 1) {
    const sample = sampleFlowField(point, object, yawAngleDeg, index * 0.035, seed.phase);
    const magnitude = Math.max(
      Math.sqrt(sample.velocity.x ** 2 + sample.velocity.y ** 2 + sample.velocity.z ** 2),
      0.08,
    );
    point = projectPointOutsideBody({
      x: point.x + (sample.velocity.x / magnitude) * stepLength,
      y: point.y + (sample.velocity.y / magnitude) * stepLength,
      z: point.z + (sample.velocity.z / magnitude) * stepLength,
    }, object, yawAngleDeg, seed.phase);
    points.push(point);
  }

  return points;
}

export function createFlowPoint(streamwise: number, lateral: number, height: number, yawAngleDeg: number): FlowPoint {
  const worldPoint = fromFlowCoordinates(streamwise, lateral, yawAngleDeg * DEG_TO_RAD);
  return { x: worldPoint.x, y: height, z: worldPoint.z };
}

export function getFlowCoordinates(point: FlowPoint, yawAngleDeg: number) {
  return toFlowCoordinates(point, yawAngleDeg * DEG_TO_RAD);
}
