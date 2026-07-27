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

function length(point: FlowPoint) {
  return Math.hypot(point.x, point.y, point.z);
}

function normalize(point: FlowPoint): FlowPoint {
  const rawMagnitude = length(point);
  if (rawMagnitude < 0.0001) return { x: 0, y: 1, z: 0 };
  const magnitude = Math.max(rawMagnitude, 0.0001);
  return { x: point.x / magnitude, y: point.y / magnitude, z: point.z / magnitude };
}

function dot(first: FlowPoint, second: FlowPoint) {
  return first.x * second.x + first.y * second.y + first.z * second.z;
}

function sdfEllipsoid(point: FlowPoint, radii: FlowPoint) {
  const k0 = Math.hypot(point.x / radii.x, point.y / radii.y, point.z / radii.z);
  if (k0 < 0.0001) return -Math.min(radii.x, radii.y, radii.z);
  const k1 = Math.hypot(
    point.x / (radii.x * radii.x),
    point.y / (radii.y * radii.y),
    point.z / (radii.z * radii.z),
  );
  return (k0 * (k0 - 1)) / Math.max(k1, 0.0001);
}

function sdfBox(point: FlowPoint, halfSize: FlowPoint) {
  const q = {
    x: Math.abs(point.x) - halfSize.x,
    y: Math.abs(point.y) - halfSize.y,
    z: Math.abs(point.z) - halfSize.z,
  };
  return Math.hypot(Math.max(q.x, 0), Math.max(q.y, 0), Math.max(q.z, 0))
    + Math.min(Math.max(q.x, Math.max(q.y, q.z)), 0);
}

function translated(point: FlowPoint, x: number, y: number, z: number): FlowPoint {
  return { x: point.x - x, y: point.y - y, z: point.z - z };
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
  const bodyLength = object.dimensionsM.length;
  const bodyHalfLength = clamp(bodyLength * 0.5, 0.48, 2.35);
  const bodyHalfWidth = clamp(object.dimensionsM.width * 0.5, 0.22, 1.55);
  const halfHeight = clamp(object.dimensionsM.height * 0.5, 0.14, 1.35);
  const cosYaw = Math.abs(Math.cos(yawRadians));
  const sinYaw = Math.abs(Math.sin(yawRadians));

  return {
    halfLength: bodyHalfLength * cosYaw + bodyHalfWidth * sinYaw,
    halfWidth: bodyHalfLength * sinYaw + bodyHalfWidth * cosYaw,
    halfHeight,
    centerY: halfHeight + 0.05,
    yawRadians,
  };
}

/** Signed distance to the visible reduced-order collision model. Negative means inside. */
export function sampleObjectSdf(point: FlowPoint, object: ObjectSpec, spoilerAngleDeg = 12) {
  if (object.kind === "car") {
    const body = sdfEllipsoid(translated(point, 0, 0.66, 0), { x: 2.23, y: 0.48, z: 0.89 });
    const nose = sdfEllipsoid(translated(point, -1.68, 0.66, 0), { x: 0.67, y: 0.39, z: 0.84 });
    const cabin = sdfEllipsoid(translated(point, 0.38, 1.12, 0), { x: 1.16, y: 0.45, z: 0.73 });
    const spoilerPoint = translated(point, 1.55, 1.43, 0);
    const spoilerAngle = spoilerAngleDeg * DEG_TO_RAD;
    const cosAngle = Math.cos(spoilerAngle);
    const sinAngle = Math.sin(spoilerAngle);
    const rotatedSpoilerPoint = {
      x: spoilerPoint.x * cosAngle - spoilerPoint.y * sinAngle,
      y: spoilerPoint.x * sinAngle + spoilerPoint.y * cosAngle,
      z: spoilerPoint.z,
    };
    const wing = sdfBox(rotatedSpoilerPoint, { x: 0.34, y: 0.055, z: 0.92 });
    const leftSupport = sdfBox(translated(point, 1.55, 1.23, 0.62), { x: 0.05, y: 0.22, z: 0.055 });
    const rightSupport = sdfBox(translated(point, 1.55, 1.23, -0.62), { x: 0.05, y: 0.22, z: 0.055 });
    return Math.min(body, nose, cabin, wing, leftSupport, rightSupport);
  }

  const halfSize = {
    x: Math.max(object.dimensionsM.length * 0.5, 0.12),
    y: Math.max(object.dimensionsM.height * 0.5, 0.12),
    z: Math.max(object.dimensionsM.width * 0.5, 0.12),
  };
  const localPoint = translated(point, 0, halfSize.y + 0.05, 0);
  if (object.kind === "box") return sdfBox(localPoint, halfSize);
  if (object.kind === "sphere") return length(localPoint) - Math.min(halfSize.x, halfSize.y, halfSize.z);
  if (object.kind === "wing") return sdfBox(localPoint, { ...halfSize, y: Math.max(halfSize.y * 0.2, 0.06) });
  return sdfEllipsoid(localPoint, halfSize);
}

export function sampleObjectNormal(point: FlowPoint, object: ObjectSpec, spoilerAngleDeg = 12): FlowPoint {
  const epsilon = 0.024;
  return normalize({
    x: sampleObjectSdf({ ...point, x: point.x + epsilon }, object, spoilerAngleDeg)
      - sampleObjectSdf({ ...point, x: point.x - epsilon }, object, spoilerAngleDeg),
    y: sampleObjectSdf({ ...point, y: point.y + epsilon }, object, spoilerAngleDeg)
      - sampleObjectSdf({ ...point, y: point.y - epsilon }, object, spoilerAngleDeg),
    z: sampleObjectSdf({ ...point, z: point.z + epsilon }, object, spoilerAngleDeg)
      - sampleObjectSdf({ ...point, z: point.z - epsilon }, object, spoilerAngleDeg),
  });
}

export function sampleFlowField(
  point: FlowPoint,
  object: ObjectSpec,
  yawAngleDeg: number,
  time = 0,
  phase = 0,
  turbulenceStrength = 1,
  spoilerAngleDeg = 12,
): FlowSample {
  const yawRadians = yawAngleDeg * DEG_TO_RAD;
  const windDirection = { x: Math.cos(yawRadians), y: 0, z: Math.sin(yawRadians) };
  const crossDirection = { x: -windDirection.z, y: 0, z: windDirection.x };
  const distanceToBody = sampleObjectSdf(point, object, spoilerAngleDeg);
  const normal = sampleObjectNormal(point, object, spoilerAngleDeg);
  const influence = 1 - clamp((Math.max(distanceToBody, 0) - 0.04) / 1.08, 0, 1);
  const incoming = dot(windDirection, normal);

  let velocity: FlowPoint = {
    x: windDirection.x - normal.x * Math.min(incoming, 0) * influence,
    y: -normal.y * Math.min(incoming, 0) * influence,
    z: windDirection.z - normal.z * Math.min(incoming, 0) * influence,
  };

  const lateral = dot(point, crossDirection);
  const splitDirection = normalize({
    x: crossDirection.x * (lateral + Math.cos(phase) * 0.055),
    y: Math.max(point.y - 0.56, 0.16),
    z: crossDirection.z * (lateral + Math.cos(phase) * 0.055),
  });
  const stagnationIntensity = clamp(influence * Math.max(-incoming, 0), 0, 1);
  velocity.x += splitDirection.x * stagnationIntensity * 0.72;
  velocity.y += splitDirection.y * stagnationIntensity * 0.72;
  velocity.z += splitDirection.z * stagnationIntensity * 0.72;
  const surfaceAcceleration = 1 + influence * (0.18 + 0.18 * (1 - Math.abs(incoming)));
  velocity = {
    x: velocity.x * surfaceAcceleration,
    y: velocity.y * surfaceAcceleration,
    z: velocity.z * surfaceAcceleration,
  };

  const streamwise = dot(point, windDirection);
  const rearReach = Math.min(object.dimensionsM.length * 0.5, 2.23) * Math.abs(windDirection.x)
    + Math.min(object.dimensionsM.width * 0.5, 1.55) * Math.abs(windDirection.z);
  const wakeDistance = streamwise - rearReach;
  const vertical = point.y - Math.min(object.dimensionsM.height * 0.48, 0.72);
  const wakeWidth = 0.76 + Math.max(wakeDistance, 0) * 0.14;
  const wakeIntensity = wakeDistance > 0
    ? clamp(
      Math.exp(-(lateral * lateral + vertical * vertical * 1.22) / Math.max(wakeWidth * wakeWidth, 0.05))
        * Math.exp(-wakeDistance / 6.4),
      0,
      1,
    )
    : 0;
  const wakeDeficit = clamp(0.24 + object.dragCoefficient * 0.42, 0.24, 0.58);
  velocity.x *= 1 - wakeIntensity * wakeDeficit;
  velocity.y *= 1 - wakeIntensity * wakeDeficit;
  velocity.z *= 1 - wakeIntensity * wakeDeficit;

  const vortex = wakeIntensity
    * turbulenceStrength
    * (0.17 + object.dragCoefficient * 0.18)
    * Math.sin(time * 5.1 + wakeDistance * 3.25 + phase);
  velocity.x += crossDirection.x * vortex * (0.45 + Math.abs(vertical));
  velocity.z += crossDirection.z * vortex * (0.45 + Math.abs(vertical));
  velocity.y += vortex * Math.sign(lateral + 0.001) * 0.7;

  if (distanceToBody < 0.09) {
    const outwardStrength = 0.24 + Math.max(-distanceToBody, 0) * 5;
    velocity.x += normal.x * outwardStrength;
    velocity.y += normal.y * outwardStrength;
    velocity.z += normal.z * outwardStrength;
  }
  if (point.y < 0.14) velocity.y += (0.14 - point.y) * 3.2;

  return {
    velocity,
    speedRatio: clamp(length(velocity), 0, 1.8),
    wakeIntensity,
    stagnationIntensity,
  };
}

export function projectPointOutsideBody(
  point: FlowPoint,
  object: ObjectSpec,
  yawAngleDeg: number,
  phase = 0,
  spoilerAngleDeg = 12,
): FlowPoint {
  void yawAngleDeg;
  void phase;
  const distance = sampleObjectSdf(point, object, spoilerAngleDeg);
  if (distance >= 0.025) return { ...point, y: Math.max(point.y, 0.055) };
  const normal = sampleObjectNormal(point, object, spoilerAngleDeg);
  const correction = 0.032 - distance;
  return {
    x: point.x + normal.x * correction,
    y: Math.max(point.y + normal.y * correction, 0.055),
    z: point.z + normal.z * correction,
  };
}

export function createStreamline(
  object: ObjectSpec,
  yawAngleDeg: number,
  seed: StreamlineSeed,
  steps = 88,
  stepLength = 0.17,
  spoilerAngleDeg = 12,
): FlowPoint[] {
  const yawRadians = yawAngleDeg * DEG_TO_RAD;
  const start = fromFlowCoordinates(-7.1, seed.lateral, yawRadians);
  let point: FlowPoint = { x: start.x, y: seed.height, z: start.z };
  const points: FlowPoint[] = [point];

  for (let index = 0; index < steps; index += 1) {
    const sample = sampleFlowField(point, object, yawAngleDeg, index * 0.035, seed.phase, 1, spoilerAngleDeg);
    const magnitude = Math.max(length(sample.velocity), 0.08);
    point = projectPointOutsideBody({
      x: point.x + (sample.velocity.x / magnitude) * stepLength,
      y: point.y + (sample.velocity.y / magnitude) * stepLength,
      z: point.z + (sample.velocity.z / magnitude) * stepLength,
    }, object, yawAngleDeg, seed.phase, spoilerAngleDeg);
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
