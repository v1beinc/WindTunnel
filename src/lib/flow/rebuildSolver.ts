import { CAR_GEOMETRY } from "@/lib/flow/carGeometryProfile";
import { DEG_TO_RAD } from "@/lib/flow/solverConstants";
import type { ObjectSpec } from "@/lib/physics/aerodynamics";
import {
  sampleObjectNormal,
  sampleObjectSdf,
  type FlowPoint,
} from "@/lib/physics/flowField";

/**
 * The visual solver is intentionally a reduced-order 2.5D field. It is not a
 * CFD solver: it gives the renderer one continuous, bounded velocity field so
 * particles and diagnostic views tell the same story.
 */
export const REBUILD_INLET_STREAMWISE = -7.15;
export const REBUILD_EXIT_STREAMWISE = 7.35;
export const REBUILD_GROUND_Y = 0.055;
export const REBUILD_DEFAULT_STEP = 0.016;

export type RebuildSolverConfig = {
  object: ObjectSpec;
  yawAngleDeg: number;
  speedMps: number;
  spoilerAngleDeg: number;
  turbulenceStrength?: number;
};

export type RebuildFlowSample = {
  velocity: FlowPoint;
  speedRatio: number;
  pressureRatio: number;
  wakeIntensity: number;
  stagnationIntensity: number;
  surfaceDistance: number;
};

export type RebuildStreamlineSeed = {
  lateral: number;
  height: number;
  phase: number;
  laneBias?: number;
};

type BodyProfile = {
  centerStreamwise: number;
  halfLength: number;
  halfWidth: number;
  halfHeight: number;
  centerY: number;
  tailStreamwise: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / Math.max(edge1 - edge0, 0.0001));
  return t * t * (3 - 2 * t);
}

function length(point: FlowPoint) {
  return Math.hypot(point.x, point.y, point.z);
}

function profileFor(object: ObjectSpec): BodyProfile {
  if (object.kind === "car") {
    return {
      centerStreamwise: (CAR_GEOMETRY.noseTipX + CAR_GEOMETRY.tailX) * 0.5,
      halfLength: (CAR_GEOMETRY.tailX - CAR_GEOMETRY.noseTipX) * 0.5,
      halfWidth: CAR_GEOMETRY.width * 0.5,
      halfHeight: (CAR_GEOMETRY.topY - CAR_GEOMETRY.bottomY) * 0.5,
      centerY: (CAR_GEOMETRY.topY + CAR_GEOMETRY.bottomY) * 0.5,
      tailStreamwise: CAR_GEOMETRY.tailX,
    };
  }

  const halfLength = Math.max(object.dimensionsM.length * 0.5, 0.25);
  const halfHeight = Math.max(object.dimensionsM.height * 0.5, 0.18);
  return {
    centerStreamwise: 0,
    halfLength,
    halfWidth: Math.max(object.dimensionsM.width * 0.5, 0.18),
    halfHeight,
    centerY: halfHeight + 0.08,
    tailStreamwise: halfLength,
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

function toFlowCoordinates(point: FlowPoint, yawRadians: number) {
  const cosYaw = Math.cos(yawRadians);
  const sinYaw = Math.sin(yawRadians);
  return {
    streamwise: point.x * cosYaw + point.z * sinYaw,
    lateral: -point.x * sinYaw + point.z * cosYaw,
  };
}

function visualFlowSpeed(speedMps: number) {
  // Screen-space speed is deliberately bounded. Physical speed still changes
  // the metrics; this scale only keeps the animation readable at 0–300 km/h.
  if (speedMps <= 0.01) return 0;
  return clamp(0.88 + Math.max(speedMps, 0) * 0.075, 0.88, 3.25);
}

function normalizeVelocity(velocity: FlowPoint, fallback: FlowPoint): FlowPoint {
  const magnitude = length(velocity);
  if (magnitude < 0.0001) return fallback;
  return {
    x: velocity.x / magnitude,
    y: velocity.y / magnitude,
    z: velocity.z / magnitude,
  };
}

/** Convert tunnel-local coordinates to world coordinates. */
export function createRebuildPoint(streamwise: number, lateral: number, height: number, yawAngleDeg: number): FlowPoint {
  const world = fromFlowCoordinates(streamwise, lateral, yawAngleDeg * DEG_TO_RAD);
  return { x: world.x, y: height, z: world.z };
}

export function getRebuildFlowCoordinates(point: FlowPoint, yawAngleDeg: number) {
  return toFlowCoordinates(point, yawAngleDeg * DEG_TO_RAD);
}

/**
 * Sample the canonical visual field. The potential-flow term bends the field
 * around a soft elliptical body; the finite wake and spoiler downwash are
 * bounded additions, not independent particle hacks.
 */
export function sampleRebuildFlowField(
  point: FlowPoint,
  config: RebuildSolverConfig,
  time = 0,
  phase = 0,
  laneBias = 0,
): RebuildFlowSample {
  const profile = profileFor(config.object);
  const yawRadians = config.yawAngleDeg * DEG_TO_RAD;
  const local = toFlowCoordinates(point, yawRadians);
  const visualSpeed = visualFlowSpeed(config.speedMps);
  const localX = (local.streamwise - profile.centerStreamwise) / profile.halfLength;
  const localY = (point.y - profile.centerY) / profile.halfHeight;
  const radial = Math.hypot(localX, localY);
  const radius = Math.max(radial, 1.015);
  const inverseRadiusSquared = 1 / (radius * radius);
  const cosTwoTheta = (localX * localX - localY * localY) / (radius * radius);
  const sinTwoTheta = (2 * localX * localY) / (radius * radius);
  const lateralRatio = local.lateral / Math.max(profile.halfWidth, 0.1);
  const lateralWeight = 1 - smoothstep(0.72, 1.55, Math.abs(lateralRatio));
  const shellWeight = (1 - smoothstep(0.82, 1.9, radial)) * lateralWeight;

  // Elliptical potential-flow approximation in the streamwise/vertical plane.
  // The forward floor keeps visual tracers from freezing at the idealized
  // stagnation point while the vertical component still routes them over/under.
  let localStreamwiseVelocity = visualSpeed * (1 - inverseRadiusSquared * cosTwoTheta);
  let localVerticalVelocity = visualSpeed * (-inverseRadiusSquared * sinTwoTheta) * 0.92;
  localStreamwiseVelocity = Math.max(localStreamwiseVelocity, visualSpeed * 0.58);

  const frontMask = (1 - smoothstep(-0.7, 1.2, localX))
    * (1 - smoothstep(0.05, 0.92, Math.abs(localY)));
  const laneSign = Math.sign(localY || laneBias || Math.sin(phase) || 1);
  localVerticalVelocity += laneSign * visualSpeed * 0.78 * frontMask * shellWeight;

  // A finite-width body weakly pushes air sideways near its shoulder. This is
  // enough 3D character for a side-view tunnel without pretending to solve a
  // full volumetric pressure field.
  const shoulderMask = shellWeight * smoothstep(0.15, 0.95, Math.abs(localY));
  const sideSign = Math.sign(local.lateral || Math.sin(phase + 1.7) || 1);
  const localLateralVelocity = sideSign * visualSpeed * 0.18 * shoulderMask;

  const spoilerAngle = clamp(config.spoilerAngleDeg, -5, 35) * DEG_TO_RAD;
  const spoilerLift = Math.sin(Math.abs(spoilerAngle));
  const wingX = local.streamwise - CAR_GEOMETRY.spoiler.center.x;
  const wingY = point.y - CAR_GEOMETRY.spoiler.center.y;
  const wingMask = config.object.kind === "car"
    ? Math.exp(
      -((wingX / 0.72) ** 2)
      -((wingY / 0.42) ** 2)
      -((local.lateral / 1.25) ** 2),
    )
    : 0;
  localVerticalVelocity -= visualSpeed * (0.04 + spoilerLift * 0.78) * wingMask;
  localStreamwiseVelocity += visualSpeed * spoilerLift * 0.045 * wingMask;

  const wakeDistance = local.streamwise - (profile.tailStreamwise + 0.08);
  const wakeStart = smoothstep(0, 0.72, wakeDistance);
  const wakeWidth = profile.halfWidth * (0.72 + Math.max(wakeDistance, 0) * 0.11);
  const wakeVerticalWidth = profile.halfHeight * (0.7 + Math.max(wakeDistance, 0) * 0.06);
  const wakeLateral = Math.exp(-(local.lateral * local.lateral) / Math.max(wakeWidth * wakeWidth, 0.05));
  const wakeVertical = Math.exp(-((point.y - profile.centerY) ** 2) / Math.max(wakeVerticalWidth * wakeVerticalWidth, 0.05));
  const wakeIntensity = clamp01(wakeStart * wakeLateral * wakeVertical * Math.exp(-Math.max(wakeDistance, 0) / 8));
  const wakeDeficit = clamp(0.12 + config.object.dragCoefficient * 0.16, 0.08, 0.31);
  localStreamwiseVelocity *= 1 - wakeIntensity * wakeDeficit;

  const turbulence = config.turbulenceStrength ?? 1;
  const vortexPhase = local.streamwise * 2.1 + time * 2.6 + phase;
  localVerticalVelocity += Math.cos(vortexPhase) * wakeIntensity * turbulence * visualSpeed * 0.07;
  const wakeVortex = Math.sin(vortexPhase) * wakeIntensity * turbulence * visualSpeed * 0.11;

  const groundDistance = point.y - REBUILD_GROUND_Y;
  if (groundDistance < 0.1) {
    localVerticalVelocity += (0.1 - groundDistance) * visualSpeed * 1.5;
  }

  const worldHorizontal = fromFlowCoordinates(localStreamwiseVelocity, localLateralVelocity + wakeVortex, yawRadians);
  const velocity = { x: worldHorizontal.x, y: localVerticalVelocity, z: worldHorizontal.z };
  const speedRatio = visualSpeed < 0.001 ? 0 : clamp(length(velocity) / visualSpeed, 0, 1.8);
  const frontStagnation = visualSpeed < 0.001
    ? 0
    : clamp01(frontMask * (1 - localStreamwiseVelocity / visualSpeed));
  const pressureRatio = visualSpeed < 0.001 ? 0 : clamp(1 - speedRatio * speedRatio, -1, 1);

  return {
    velocity,
    speedRatio,
    pressureRatio,
    wakeIntensity,
    stagnationIntensity: frontStagnation,
    surfaceDistance: sampleObjectSdf(point, config.object, config.spoilerAngleDeg),
  };
}

/** Recover only from an actual penetration; there is no pre-emptive clearance wall. */
export function resolveRebuildPoint(point: FlowPoint, config: RebuildSolverConfig): FlowPoint {
  const surfaceDistance = sampleObjectSdf(point, config.object, config.spoilerAngleDeg);
  if (surfaceDistance < 0) {
    const normal = sampleObjectNormal(point, config.object, config.spoilerAngleDeg);
    const correction = Math.min(-surfaceDistance + 0.025, 0.16);
    return {
      x: point.x + normal.x * correction,
      y: Math.max(point.y + normal.y * correction, REBUILD_GROUND_Y),
      z: point.z + normal.z * correction,
    };
  }
  return { ...point, y: Math.max(point.y, REBUILD_GROUND_Y) };
}

export function stepRebuildPoint(
  point: FlowPoint,
  config: RebuildSolverConfig,
  deltaSeconds = REBUILD_DEFAULT_STEP,
  time = 0,
  phase = 0,
  laneBias = 0,
): FlowPoint {
  const delta = clamp(deltaSeconds, 0, 0.05);
  const first = sampleRebuildFlowField(point, config, time, phase, laneBias).velocity;
  const midpoint = resolveRebuildPoint({
    x: point.x + first.x * delta * 0.5,
    y: point.y + first.y * delta * 0.5,
    z: point.z + first.z * delta * 0.5,
  }, config);
  const second = sampleRebuildFlowField(midpoint, config, time + delta * 0.5, phase, laneBias).velocity;
  return resolveRebuildPoint({
    x: point.x + second.x * delta,
    y: point.y + second.y * delta,
    z: point.z + second.z * delta,
  }, config);
}

export function createRebuildStreamline(
  config: RebuildSolverConfig,
  seed: RebuildStreamlineSeed,
  steps = 112,
  stepLength = 0.15,
): FlowPoint[] {
  const laneBias = seed.laneBias ?? Math.sign(seed.height - profileFor(config.object).centerY || 1);
  let point = createRebuildPoint(REBUILD_INLET_STREAMWISE, seed.lateral, seed.height, config.yawAngleDeg);
  const points: FlowPoint[] = [point];

  for (let index = 0; index < steps; index += 1) {
    const sample = sampleRebuildFlowField(point, config, index * 0.04, seed.phase, laneBias);
    const direction = normalizeVelocity(sample.velocity, { x: 1, y: 0, z: 0 });
    point = resolveRebuildPoint({
      x: point.x + direction.x * stepLength,
      y: point.y + direction.y * stepLength,
      z: point.z + direction.z * stepLength,
    }, config);
    points.push(point);
  }

  return points;
}
