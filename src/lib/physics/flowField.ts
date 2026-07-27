import type { ObjectSpec } from "@/lib/physics/aerodynamics";
import {
  DEG_TO_RAD,
  CPU_NORMAL_EPSILON,
  CAR_BODY_CENTER,
  CAR_BODY_RADII,
  CAR_NOSE_CENTER,
  CAR_NOSE_RADII,
  CAR_CABIN_CENTER,
  CAR_CABIN_RADII,
  CAR_WING_CENTER,
  CAR_WING_HALF_SIZE,
  CAR_LEFT_SUPPORT_CENTER,
  CAR_RIGHT_SUPPORT_CENTER,
  CAR_SUPPORT_HALF_SIZE,
  CAR_WHEEL_RADIUS,
  CAR_WHEEL_WIDTH,
  CAR_WHEEL_FRONT_AXLE_X,
  CAR_WHEEL_REAR_AXLE_X,
  CAR_WHEEL_TRACK_HALF_WIDTH,
  CAR_WHEEL_CENTER_Y,
  DEFAULT_OBJECT_HALF_SIZE_MIN,
  DEFAULT_OBJECT_Y_OFFSET,
  FLOW_INFLUENCE_CLAMP_MIN,
  FLOW_INFLUENCE_CLAMP_MAX,
  FLOW_STAGNATION_FACTOR,
  FLOW_SURFACE_ACCEL_BASE,
  FLOW_SURFACE_ACCEL_VAR,
  CPU_REAR_REACH_LENGTH_FACTOR,
  CPU_REAR_REACH_LENGTH_MAX,
  CPU_REAR_REACH_WIDTH_FACTOR,
  CPU_REAR_REACH_WIDTH_MAX,
  CPU_WAKE_WIDTH_BASE,
  CPU_WAKE_WIDTH_GROWTH,
  CPU_WAKE_DECAY,
  CPU_WAKE_VERTICAL_SCALE,
  CPU_WAKE_VERTICAL_OFFSET_FACTOR,
  CPU_WAKE_VERTICAL_OFFSET_MAX,
  CPU_WAKE_DEFICIT_BASE,
  CPU_WAKE_DEFICIT_CD_FACTOR,
  CPU_WAKE_DEFICIT_MIN,
  CPU_WAKE_DEFICIT_MAX,
  CPU_VORTEX_FREQUENCY_TIME,
  CPU_VORTEX_FREQUENCY_DIST,
  CPU_VORTEX_BASE,
  CPU_VORTEX_CD_FACTOR,
  CPU_VORTEX_CROSS_FACTOR,
  CPU_VORTEX_Y_FACTOR,
  CPU_COLLISION_THRESHOLD,
  CPU_COLLISION_PUSH_BASE,
  CPU_COLLISION_PUSH_FACTOR,
  CPU_GROUND_Y,
  CPU_GROUND_PUSH_FACTOR,
  CPU_PROJECTION_THRESHOLD,
  CPU_PROJECTION_CORRECTION,
  CPU_PROJECTION_GROUND_Y,
  STREAMLINE_START_STREAMWISE,
  STREAMLINE_STEPS,
  STREAMLINE_STEP_LENGTH,
  STREAMLINE_TIME_STEP,
  STREAMLINE_MIN_VELOCITY,
  FLOW_ENVELOPE_HALF_LENGTH_FACTOR,
  FLOW_ENVELOPE_HALF_WIDTH_FACTOR,
  FLOW_ENVELOPE_HALF_HEIGHT_FACTOR,
  FLOW_ENVELOPE_CENTER_Y_OFFSET,
  FLOW_ENVELOPE_HALF_LENGTH_MIN,
  FLOW_ENVELOPE_HALF_LENGTH_MAX,
  FLOW_ENVELOPE_HALF_WIDTH_MIN,
  FLOW_ENVELOPE_HALF_WIDTH_MAX,
  FLOW_ENVELOPE_HALF_HEIGHT_MIN,
  FLOW_ENVELOPE_HALF_HEIGHT_MAX,
} from "@/lib/flow/solverConstants";

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

function sdfCylinder(point: FlowPoint, radius: number, halfHeight: number) {
  const d = { x: Math.hypot(point.x, point.z) - radius, y: Math.abs(point.y) - halfHeight };
  return Math.min(Math.max(d.x, d.y), 0) + Math.hypot(Math.max(d.x, 0), Math.max(d.y, 0));
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
  const bodyHalfLength = clamp(bodyLength * FLOW_ENVELOPE_HALF_LENGTH_FACTOR, FLOW_ENVELOPE_HALF_LENGTH_MIN, FLOW_ENVELOPE_HALF_LENGTH_MAX);
  const bodyHalfWidth = clamp(object.dimensionsM.width * FLOW_ENVELOPE_HALF_WIDTH_FACTOR, FLOW_ENVELOPE_HALF_WIDTH_MIN, FLOW_ENVELOPE_HALF_WIDTH_MAX);
  const halfHeight = clamp(object.dimensionsM.height * FLOW_ENVELOPE_HALF_HEIGHT_FACTOR, FLOW_ENVELOPE_HALF_HEIGHT_MIN, FLOW_ENVELOPE_HALF_HEIGHT_MAX);
  const cosYaw = Math.abs(Math.cos(yawRadians));
  const sinYaw = Math.abs(Math.sin(yawRadians));

  return {
    halfLength: bodyHalfLength * cosYaw + bodyHalfWidth * sinYaw,
    halfWidth: bodyHalfLength * sinYaw + bodyHalfWidth * cosYaw,
    halfHeight,
    centerY: halfHeight + FLOW_ENVELOPE_CENTER_Y_OFFSET,
    yawRadians,
  };
}

/** Signed distance to the visible reduced-order collision model. Negative means inside. */
export function sampleObjectSdf(point: FlowPoint, object: ObjectSpec, spoilerAngleDeg = 12) {
  if (object.kind === "car") {
    const body = sdfEllipsoid(translated(point, CAR_BODY_CENTER.x, CAR_BODY_CENTER.y, CAR_BODY_CENTER.z), CAR_BODY_RADII);
    const nose = sdfEllipsoid(translated(point, CAR_NOSE_CENTER.x, CAR_NOSE_CENTER.y, CAR_NOSE_CENTER.z), CAR_NOSE_RADII);
    const cabin = sdfEllipsoid(translated(point, CAR_CABIN_CENTER.x, CAR_CABIN_CENTER.y, CAR_CABIN_CENTER.z), CAR_CABIN_RADII);
    const spoilerPoint = translated(point, CAR_WING_CENTER.x, CAR_WING_CENTER.y, CAR_WING_CENTER.z);
    const spoilerAngle = spoilerAngleDeg * DEG_TO_RAD;
    const cosAngle = Math.cos(spoilerAngle);
    const sinAngle = Math.sin(spoilerAngle);
    const rotatedSpoilerPoint = {
      x: spoilerPoint.x * cosAngle - spoilerPoint.y * sinAngle,
      y: spoilerPoint.x * sinAngle + spoilerPoint.y * cosAngle,
      z: spoilerPoint.z,
    };
    const wing = sdfBox(rotatedSpoilerPoint, CAR_WING_HALF_SIZE);
    const leftSupport = sdfBox(translated(point, CAR_LEFT_SUPPORT_CENTER.x, CAR_LEFT_SUPPORT_CENTER.y, CAR_LEFT_SUPPORT_CENTER.z), CAR_SUPPORT_HALF_SIZE);
    const rightSupport = sdfBox(translated(point, CAR_RIGHT_SUPPORT_CENTER.x, CAR_RIGHT_SUPPORT_CENTER.y, CAR_RIGHT_SUPPORT_CENTER.z), CAR_SUPPORT_HALF_SIZE);

    // Wheels collision (4 cylinders)
    const wheelR = CAR_WHEEL_RADIUS;
    const wheelH = CAR_WHEEL_WIDTH * 0.5;
    const wheelY = CAR_WHEEL_CENTER_Y;
    const wheels = Math.min(
      sdfCylinder(translated(point, CAR_WHEEL_FRONT_AXLE_X, wheelY, CAR_WHEEL_TRACK_HALF_WIDTH), wheelR, wheelH),
      sdfCylinder(translated(point, CAR_WHEEL_FRONT_AXLE_X, wheelY, -CAR_WHEEL_TRACK_HALF_WIDTH), wheelR, wheelH),
      sdfCylinder(translated(point, CAR_WHEEL_REAR_AXLE_X, wheelY, CAR_WHEEL_TRACK_HALF_WIDTH), wheelR, wheelH),
      sdfCylinder(translated(point, CAR_WHEEL_REAR_AXLE_X, wheelY, -CAR_WHEEL_TRACK_HALF_WIDTH), wheelR, wheelH)
    );

    return Math.min(body, nose, cabin, wing, leftSupport, rightSupport, wheels);
  }

  const halfSize = {
    x: Math.max(object.dimensionsM.length * 0.5, DEFAULT_OBJECT_HALF_SIZE_MIN),
    y: Math.max(object.dimensionsM.height * 0.5, DEFAULT_OBJECT_HALF_SIZE_MIN),
    z: Math.max(object.dimensionsM.width * 0.5, DEFAULT_OBJECT_HALF_SIZE_MIN),
  };
  const localPoint = translated(point, 0, halfSize.y + DEFAULT_OBJECT_Y_OFFSET, 0);
  if (object.kind === "box") return sdfBox(localPoint, halfSize);
  if (object.kind === "sphere") return length(localPoint) - Math.min(halfSize.x, halfSize.y, halfSize.z);
  if (object.kind === "wing") return sdfBox(localPoint, { ...halfSize, y: Math.max(halfSize.y * 0.2, 0.06) });
  return sdfEllipsoid(localPoint, halfSize);
}

export function sampleObjectNormal(point: FlowPoint, object: ObjectSpec, spoilerAngleDeg = 12): FlowPoint {
  const epsilon = CPU_NORMAL_EPSILON;
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
  const influence = 1 - clamp((Math.max(distanceToBody, 0) - FLOW_INFLUENCE_CLAMP_MIN) / FLOW_INFLUENCE_CLAMP_MAX, 0, 1);
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
  velocity.x += splitDirection.x * stagnationIntensity * FLOW_STAGNATION_FACTOR;
  velocity.y += splitDirection.y * stagnationIntensity * FLOW_STAGNATION_FACTOR;
  velocity.z += splitDirection.z * stagnationIntensity * FLOW_STAGNATION_FACTOR;
  const surfaceAcceleration = 1 + influence * (FLOW_SURFACE_ACCEL_BASE + FLOW_SURFACE_ACCEL_VAR * (1 - Math.abs(incoming)));
  velocity = {
    x: velocity.x * surfaceAcceleration,
    y: velocity.y * surfaceAcceleration,
    z: velocity.z * surfaceAcceleration,
  };

  const streamwise = dot(point, windDirection);
  const rearReach = Math.min(object.dimensionsM.length * CPU_REAR_REACH_LENGTH_FACTOR, CPU_REAR_REACH_LENGTH_MAX) * Math.abs(windDirection.x)
    + Math.min(object.dimensionsM.width * CPU_REAR_REACH_WIDTH_FACTOR, CPU_REAR_REACH_WIDTH_MAX) * Math.abs(windDirection.z);
  const wakeDistance = streamwise - rearReach;
  const vertical = point.y - Math.min(object.dimensionsM.height * CPU_WAKE_VERTICAL_OFFSET_FACTOR, CPU_WAKE_VERTICAL_OFFSET_MAX);
  const wakeWidth = CPU_WAKE_WIDTH_BASE + Math.max(wakeDistance, 0) * CPU_WAKE_WIDTH_GROWTH;
  const wakeIntensity = wakeDistance > 0
    ? clamp(
      Math.exp(-(lateral * lateral + vertical * vertical * CPU_WAKE_VERTICAL_SCALE) / Math.max(wakeWidth * wakeWidth, 0.05))
        * Math.exp(-wakeDistance / CPU_WAKE_DECAY),
      0,
      1,
    )
    : 0;
  const wakeDeficit = clamp(CPU_WAKE_DEFICIT_BASE + object.dragCoefficient * CPU_WAKE_DEFICIT_CD_FACTOR, CPU_WAKE_DEFICIT_MIN, CPU_WAKE_DEFICIT_MAX);
  velocity.x *= 1 - wakeIntensity * wakeDeficit;
  velocity.y *= 1 - wakeIntensity * wakeDeficit;
  velocity.z *= 1 - wakeIntensity * wakeDeficit;

  const vortex = wakeIntensity
    * turbulenceStrength
    * (CPU_VORTEX_BASE + object.dragCoefficient * CPU_VORTEX_CD_FACTOR)
    * Math.sin(time * CPU_VORTEX_FREQUENCY_TIME + wakeDistance * CPU_VORTEX_FREQUENCY_DIST + phase);
  velocity.x += crossDirection.x * vortex * (CPU_VORTEX_CROSS_FACTOR + Math.abs(vertical));
  velocity.z += crossDirection.z * vortex * (CPU_VORTEX_CROSS_FACTOR + Math.abs(vertical));
  velocity.y += vortex * Math.sign(lateral + 0.001) * CPU_VORTEX_Y_FACTOR;

  if (distanceToBody < CPU_COLLISION_THRESHOLD) {
    const outwardStrength = CPU_COLLISION_PUSH_BASE + Math.max(-distanceToBody, 0) * CPU_COLLISION_PUSH_FACTOR;
    velocity.x += normal.x * outwardStrength;
    velocity.y += normal.y * outwardStrength;
    velocity.z += normal.z * outwardStrength;
  }
  if (point.y < CPU_GROUND_Y) velocity.y += (CPU_GROUND_Y - point.y) * CPU_GROUND_PUSH_FACTOR;

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
  if (distance >= CPU_PROJECTION_THRESHOLD) return { ...point, y: Math.max(point.y, CPU_PROJECTION_GROUND_Y) };
  const normal = sampleObjectNormal(point, object, spoilerAngleDeg);
  const correction = CPU_PROJECTION_CORRECTION - distance;
  return {
    x: point.x + normal.x * correction,
    y: Math.max(point.y + normal.y * correction, CPU_PROJECTION_GROUND_Y),
    z: point.z + normal.z * correction,
  };
}

export function createStreamline(
  object: ObjectSpec,
  yawAngleDeg: number,
  seed: StreamlineSeed,
  steps = STREAMLINE_STEPS,
  stepLength = STREAMLINE_STEP_LENGTH,
  spoilerAngleDeg = 12,
): FlowPoint[] {
  const yawRadians = yawAngleDeg * DEG_TO_RAD;
  const start = fromFlowCoordinates(STREAMLINE_START_STREAMWISE, seed.lateral, yawRadians);
  let point: FlowPoint = { x: start.x, y: seed.height, z: start.z };
  const points: FlowPoint[] = [point];

  for (let index = 0; index < steps; index += 1) {
    const sample = sampleFlowField(point, object, yawAngleDeg, index * STREAMLINE_TIME_STEP, seed.phase, 1, spoilerAngleDeg);
    const magnitude = Math.max(length(sample.velocity), STREAMLINE_MIN_VELOCITY);
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
