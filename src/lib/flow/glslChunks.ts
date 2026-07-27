import {
  HASH21_MUL1,
  HASH21_MUL2,
  HASH21_ADD,
  CAR_BODY_RADII,
  CAR_BODY_CENTER,
  CAR_NOSE_RADII,
  CAR_NOSE_CENTER,
  CAR_CABIN_RADII,
  CAR_CABIN_CENTER,
  CAR_WING_HALF_SIZE,
  CAR_WING_CENTER,
  CAR_LEFT_SUPPORT_HALF_SIZE,
  CAR_LEFT_SUPPORT_CENTER,
  CAR_RIGHT_SUPPORT_HALF_SIZE,
  CAR_RIGHT_SUPPORT_CENTER,
  GENERIC_HALF_SIZE_MIN,
  GENERIC_GROUND_OFFSET,
  GPU_POSITION_NORMAL_EPSILON,
  GPU_VELOCITY_NORMAL_EPSILON,
  POSITION_COLLISION_THRESHOLD,
  POSITION_COLLISION_PUSH,
  POSITION_GROUND_Y,
  POSITION_AGE_RESET,
  POSITION_STREAMWISE_MAX,
  POSITION_STREAMWISE_MIN,
  POSITION_Y_MAX,
  POSITION_Z_MAX,
  POSITION_X_MAX,
  POSITION_AGE_RANDOM_SCALE,
  VELOCITY_INFLUENCE_SMOOTHSTEP_MIN,
  VELOCITY_INFLUENCE_SMOOTHSTEP_MAX,
  VELOCITY_STAGNATION_FACTOR,
  VELOCITY_SURFACE_ACCEL_BASE,
  VELOCITY_SURFACE_ACCEL_VAR,
  VELOCITY_REAR_REACH_X,
  VELOCITY_REAR_REACH_Z,
  VELOCITY_WAKE_WIDTH_BASE,
  VELOCITY_WAKE_WIDTH_GROWTH,
  VELOCITY_WAKE_DECAY,
  VELOCITY_WAKE_VERTICAL_SCALE,
  VELOCITY_WAKE_DEFICIT_BASE,
  VELOCITY_WAKE_DEFICIT_CD_FACTOR,
  VELOCITY_WAKE_DEFICIT_MIN,
  VELOCITY_WAKE_DEFICIT_MAX,
  VELOCITY_VORTEX_FREQUENCY_TIME,
  VELOCITY_VORTEX_FREQUENCY_DIST,
  VELOCITY_VORTEX_BASE,
  VELOCITY_VORTEX_CD_FACTOR,
  VELOCITY_VORTEX_CROSS_FACTOR,
  VELOCITY_VORTEX_Y_FACTOR,
  VELOCITY_VORTEX_SEED_SCALE,
  VELOCITY_COLLISION_THRESHOLD,
  VELOCITY_COLLISION_PUSH_BASE,
  VELOCITY_COLLISION_PUSH_FACTOR,
  VELOCITY_GROUND_Y,
  VELOCITY_GROUND_PUSH_FACTOR,
  RENDER_TRAIL_LENGTH_BASE,
  RENDER_TRAIL_LENGTH_SPEED_CAP,
  RENDER_TRAIL_LENGTH_SPEED_FACTOR,
  CAR_WHEEL_RADIUS,
  CAR_WHEEL_WIDTH,
  CAR_WHEEL_FRONT_AXLE_X,
  CAR_WHEEL_REAR_AXLE_X,
  CAR_WHEEL_TRACK_HALF_WIDTH,
  CAR_WHEEL_CENTER_Y,
} from "./solverConstants";

export const GLSL_HASH21 = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(${HASH21_MUL1.toFixed(2)}, ${HASH21_MUL2.toFixed(2)}));
  p += dot(p, p + ${HASH21_ADD.toFixed(2)});
  return fract(p.x * p.y);
}
`;

export const GLSL_SD_ELLIPSOID = /* glsl */ `
float sdEllipsoid(vec3 p, vec3 radii) {
  float k0 = length(p / radii);
  if (k0 < 0.0001) return -min(radii.x, min(radii.y, radii.z));
  float k1 = length(p / (radii * radii));
  return k0 * (k0 - 1.0) / max(k1, 0.0001);
}
`;

export const GLSL_SD_BOX = /* glsl */ `
float sdBox(vec3 p, vec3 halfSize) {
  vec3 q = abs(p) - halfSize;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
`;

export const GLSL_SD_CYLINDER = /* glsl */ `
float sdCylinder(vec3 p, float radius, float height) {
  vec2 d = vec2(length(p.xz) - radius, abs(p.y) - height * 0.5);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
`;

export const GLSL_SD_CYLINDER_Z = /* glsl */ `
float sdCylinderZ(vec3 p, float radius, float height) {
  vec2 d = vec2(length(p.xy) - radius, abs(p.z) - height * 0.5);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}
`;

export const GLSL_SCENE_SDF_CAR = /* glsl */ `
float sceneSdfCar(vec3 p, float spoilerAngle) {
  float body = sdEllipsoid(p - vec3(${CAR_BODY_CENTER.x.toFixed(2)}, ${CAR_BODY_CENTER.y.toFixed(2)}, ${CAR_BODY_CENTER.z.toFixed(2)}), vec3(${CAR_BODY_RADII.x.toFixed(2)}, ${CAR_BODY_RADII.y.toFixed(2)}, ${CAR_BODY_RADII.z.toFixed(2)}));
  float nose = sdEllipsoid(p - vec3(${CAR_NOSE_CENTER.x.toFixed(2)}, ${CAR_NOSE_CENTER.y.toFixed(2)}, ${CAR_NOSE_CENTER.z.toFixed(2)}), vec3(${CAR_NOSE_RADII.x.toFixed(2)}, ${CAR_NOSE_RADII.y.toFixed(2)}, ${CAR_NOSE_RADII.z.toFixed(2)}));
  float cabin = sdEllipsoid(p - vec3(${CAR_CABIN_CENTER.x.toFixed(2)}, ${CAR_CABIN_CENTER.y.toFixed(2)}, ${CAR_CABIN_CENTER.z.toFixed(2)}), vec3(${CAR_CABIN_RADII.x.toFixed(2)}, ${CAR_CABIN_RADII.y.toFixed(2)}, ${CAR_CABIN_RADII.z.toFixed(2)}));
  float angle = -spoilerAngle;
  float c = cos(angle);
  float s = sin(angle);
  vec3 wingPoint = p - vec3(${CAR_WING_CENTER.x.toFixed(2)}, ${CAR_WING_CENTER.y.toFixed(2)}, ${CAR_WING_CENTER.z.toFixed(2)});
  wingPoint.xy = mat2(c, -s, s, c) * wingPoint.xy;
  float wing = sdBox(wingPoint, vec3(${CAR_WING_HALF_SIZE.x.toFixed(2)}, ${CAR_WING_HALF_SIZE.y.toFixed(2)}, ${CAR_WING_HALF_SIZE.z.toFixed(2)}));
  float supports = min(
    sdBox(p - vec3(${CAR_LEFT_SUPPORT_CENTER.x.toFixed(2)}, ${CAR_LEFT_SUPPORT_CENTER.y.toFixed(2)}, ${CAR_LEFT_SUPPORT_CENTER.z.toFixed(2)}), vec3(${CAR_LEFT_SUPPORT_HALF_SIZE.x.toFixed(2)}, ${CAR_LEFT_SUPPORT_HALF_SIZE.y.toFixed(2)}, ${CAR_LEFT_SUPPORT_HALF_SIZE.z.toFixed(2)})),
    sdBox(p - vec3(${CAR_RIGHT_SUPPORT_CENTER.x.toFixed(2)}, ${CAR_RIGHT_SUPPORT_CENTER.y.toFixed(2)}, ${CAR_RIGHT_SUPPORT_CENTER.z.toFixed(2)}), vec3(${CAR_RIGHT_SUPPORT_HALF_SIZE.x.toFixed(2)}, ${CAR_RIGHT_SUPPORT_HALF_SIZE.y.toFixed(2)}, ${CAR_RIGHT_SUPPORT_HALF_SIZE.z.toFixed(2)}))
  );

  // Wheels collision (4 cylinders) - using sdCylinderZ since wheels are rotated PI/2 on X axis
  float wheelR = ${CAR_WHEEL_RADIUS.toFixed(2)};
  float wheelH = ${CAR_WHEEL_WIDTH.toFixed(2)};
  float wheelY = ${CAR_WHEEL_CENTER_Y.toFixed(2)};
  float frontAxleX = ${CAR_WHEEL_FRONT_AXLE_X.toFixed(2)};
  float rearAxleX = ${CAR_WHEEL_REAR_AXLE_X.toFixed(2)};
  float trackHalf = ${CAR_WHEEL_TRACK_HALF_WIDTH.toFixed(2)};
  float wheels = 1e9;
  wheels = min(wheels, sdCylinderZ(p - vec3(frontAxleX, wheelY, trackHalf), wheelR, wheelH));
  wheels = min(wheels, sdCylinderZ(p - vec3(frontAxleX, wheelY, -trackHalf), wheelR, wheelH));
  wheels = min(wheels, sdCylinderZ(p - vec3(rearAxleX, wheelY, trackHalf), wheelR, wheelH));
  wheels = min(wheels, sdCylinderZ(p - vec3(rearAxleX, wheelY, -trackHalf), wheelR, wheelH));

  return min(min(min(min(body, nose), cabin), min(wing, supports)), wheels);
}
`;

export const GLSL_SCENE_SDF_GENERIC = /* glsl */ `
float sceneSdfGeneric(vec3 p, float objectKind, vec3 dimensions) {
  vec3 halfSize = max(dimensions * 0.5, vec3(${GENERIC_HALF_SIZE_MIN.toFixed(2)}));
  vec3 localPoint = p - vec3(0.0, halfSize.y + ${GENERIC_GROUND_OFFSET.toFixed(2)}, 0.0);
  float result = sdEllipsoid(localPoint, halfSize);
  if (objectKind < 1.5) result = sdBox(localPoint, halfSize);
  else if (objectKind < 2.5) result = length(localPoint) - min(halfSize.x, min(halfSize.y, halfSize.z));
  else if (objectKind < 3.5) result = sdBox(localPoint, vec3(halfSize.x, max(halfSize.y * 0.2, 0.06), halfSize.z));
  return result;
}
`;

export const GLSL_SCENE_SDF = /* glsl */ `
float sceneSdf(vec3 p, float objectKind, float spoilerAngle, vec3 dimensions) {
  if (objectKind < 0.5) {
    return sceneSdfCar(p, spoilerAngle);
  } else {
    return sceneSdfGeneric(p, objectKind, dimensions);
  }
}
`;

export const GLSL_SDF_NORMAL_POSITION = /* glsl */ `
vec3 sdfNormal(vec3 p, float objectKind, float spoilerAngle, vec3 dimensions) {
  const float e = ${GPU_POSITION_NORMAL_EPSILON.toFixed(3)};
  return normalize(vec3(
    sceneSdf(p + vec3(e, 0.0, 0.0), objectKind, spoilerAngle, dimensions) - sceneSdf(p - vec3(e, 0.0, 0.0), objectKind, spoilerAngle, dimensions),
    sceneSdf(p + vec3(0.0, e, 0.0), objectKind, spoilerAngle, dimensions) - sceneSdf(p - vec3(0.0, e, 0.0), objectKind, spoilerAngle, dimensions),
    sceneSdf(p + vec3(0.0, 0.0, e), objectKind, spoilerAngle, dimensions) - sceneSdf(p - vec3(0.0, 0.0, e), objectKind, spoilerAngle, dimensions)
  ));
}
`;

export const GLSL_SDF_NORMAL_VELOCITY = /* glsl */ `
vec3 sdfNormal(vec3 p, float objectKind, float spoilerAngle, vec3 dimensions) {
  const float e = ${GPU_VELOCITY_NORMAL_EPSILON.toFixed(3)};
  return normalize(vec3(
    sceneSdf(p + vec3(e, 0.0, 0.0), objectKind, spoilerAngle, dimensions) - sceneSdf(p - vec3(e, 0.0, 0.0), objectKind, spoilerAngle, dimensions),
    sceneSdf(p + vec3(0.0, e, 0.0), objectKind, spoilerAngle, dimensions) - sceneSdf(p - vec3(0.0, e, 0.0), objectKind, spoilerAngle, dimensions),
    sceneSdf(p + vec3(0.0, 0.0, e), objectKind, spoilerAngle, dimensions) - sceneSdf(p - vec3(0.0, 0.0, e), objectKind, spoilerAngle, dimensions)
  ));
}
`;

export const GLSL_POSITION_RESET = /* glsl */ `
vec3 resetPosition(vec2 uv, float cycle) {
  float lateral = mix(-3.35, 3.35, hash21(uv + vec2(7.1, cycle * 0.013)));
  float height = mix(0.07, 3.25, hash21(uv.yx + vec2(19.7, cycle * 0.021)));
  vec3 windDirection = normalize(vec3(cos(uYaw), 0.0, sin(uYaw)));
  vec3 crossDirection = vec3(-windDirection.z, 0.0, windDirection.x);
  return windDirection * -7.2 + crossDirection * lateral + vec3(0.0, height, 0.0);
}
`;

export const GLSL_POSITION_MAIN = /* glsl */ `
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 state = texture2D(texturePosition, uv);
  vec3 velocity = texture2D(textureVelocity, uv).xyz;
  vec3 position = state.xyz + velocity * uDelta;
  float age = state.w + uDelta;

  float streamwise = dot(position, normalize(vec3(cos(uYaw), 0.0, sin(uYaw))));
  float distanceToBody = sceneSdf(position, uObjectKind, uSpoilerAngle, uDimensions);
  if (distanceToBody < ${POSITION_COLLISION_THRESHOLD.toFixed(3)}) {
    position += sdfNormal(position, uObjectKind, uSpoilerAngle, uDimensions) * (${POSITION_COLLISION_PUSH.toFixed(3)} - distanceToBody);
  }
  position.y = max(position.y, ${POSITION_GROUND_Y.toFixed(3)});

  bool outsideTunnel = streamwise > ${POSITION_STREAMWISE_MAX.toFixed(2)} || streamwise < ${POSITION_STREAMWISE_MIN.toFixed(2)} || position.y > ${POSITION_Y_MAX.toFixed(2)} || abs(position.z) > ${POSITION_Z_MAX.toFixed(1)} || abs(position.x) > ${POSITION_X_MAX.toFixed(1)};
  if (outsideTunnel || age > ${POSITION_AGE_RESET.toFixed(1)}) {
    position = resetPosition(uv, uCycle + floor(age));
    age = hash21(uv + uCycle) * ${POSITION_AGE_RANDOM_SCALE.toFixed(2)};
  }

  gl_FragColor = vec4(position, age);
}
`;

export const GLSL_VELOCITY_MAIN = /* glsl */ `
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 positionState = texture2D(texturePosition, uv);
  vec3 position = positionState.xyz;
  float seed = hash21(uv * 31.7);
  vec3 windDirection = normalize(vec3(cos(uYaw), 0.0, sin(uYaw)));
  vec3 crossDirection = vec3(-windDirection.z, 0.0, windDirection.x);
  float distanceToBody = sceneSdf(position, uObjectKind, uSpoilerAngle, uDimensions);
  vec3 normal = sdfNormal(position, uObjectKind, uSpoilerAngle, uDimensions);
  float influence = 1.0 - smoothstep(${VELOCITY_INFLUENCE_SMOOTHSTEP_MIN.toFixed(2)}, ${VELOCITY_INFLUENCE_SMOOTHSTEP_MAX.toFixed(2)}, max(distanceToBody, 0.0));
  float incoming = dot(windDirection, normal);

  vec3 flow = windDirection;
  flow -= normal * min(incoming, 0.0) * influence;

  float splitSide = dot(position, crossDirection);
  vec3 splitDirection = normalize(crossDirection * (splitSide + (seed - 0.5) * 0.12) + vec3(0.0, max(position.y - 0.56, 0.16), 0.0));
  float stagnation = influence * max(-incoming, 0.0);
  flow += splitDirection * stagnation * ${VELOCITY_STAGNATION_FACTOR.toFixed(2)};
  flow *= 1.0 + influence * (${VELOCITY_SURFACE_ACCEL_BASE.toFixed(2)} + ${VELOCITY_SURFACE_ACCEL_VAR.toFixed(2)} * (1.0 - abs(incoming)));

  float streamwise = dot(position, windDirection);
  float rearReach = ${VELOCITY_REAR_REACH_X.toFixed(1)} * abs(windDirection.x) + ${VELOCITY_REAR_REACH_Z.toFixed(1)} * abs(windDirection.z);
  float wakeDistance = streamwise - rearReach;
  float lateral = dot(position, crossDirection);
  float vertical = position.y - 0.69;
  float wakeWidth = ${VELOCITY_WAKE_WIDTH_BASE.toFixed(2)} + max(wakeDistance, 0.0) * ${VELOCITY_WAKE_WIDTH_GROWTH.toFixed(2)};
  float wake = step(0.0, wakeDistance)
    * exp(-(lateral * lateral + vertical * vertical * ${VELOCITY_WAKE_VERTICAL_SCALE.toFixed(2)}) / max(wakeWidth * wakeWidth, 0.05))
    * exp(-wakeDistance / ${VELOCITY_WAKE_DECAY.toFixed(1)});
  float deficit = clamp(${VELOCITY_WAKE_DEFICIT_BASE.toFixed(2)} + uCd * ${VELOCITY_WAKE_DEFICIT_CD_FACTOR.toFixed(2)}, ${VELOCITY_WAKE_DEFICIT_MIN.toFixed(2)}, ${VELOCITY_WAKE_DEFICIT_MAX.toFixed(2)});
  flow *= 1.0 - wake * deficit;

  float shedding = sin(uTime * ${VELOCITY_VORTEX_FREQUENCY_TIME.toFixed(1)} + wakeDistance * ${VELOCITY_VORTEX_FREQUENCY_DIST.toFixed(2)} + seed * ${VELOCITY_VORTEX_SEED_SCALE.toFixed(4)});
  float vortex = wake * uTurbulence * (${VELOCITY_VORTEX_BASE.toFixed(2)} + uCd * ${VELOCITY_VORTEX_CD_FACTOR.toFixed(2)}) * shedding;
  flow += crossDirection * vortex * (${VELOCITY_VORTEX_CROSS_FACTOR.toFixed(2)} + abs(vertical));
  flow.y += vortex * sign(lateral + 0.001) * ${VELOCITY_VORTEX_Y_FACTOR.toFixed(1)};

  if (distanceToBody < ${VELOCITY_COLLISION_THRESHOLD.toFixed(2)}) {
    flow += normal * (${VELOCITY_COLLISION_PUSH_BASE.toFixed(2)} + max(-distanceToBody, 0.0) * ${VELOCITY_COLLISION_PUSH_FACTOR.toFixed(1)});
  }
  if (position.y < ${VELOCITY_GROUND_Y.toFixed(2)}) flow.y += (${VELOCITY_GROUND_Y.toFixed(2)} - position.y) * ${VELOCITY_GROUND_PUSH_FACTOR.toFixed(1)};

  gl_FragColor = vec4(flow * uFlowSpeed, wake);
}
`;

export const GLSL_RENDER_VERTEX = /* glsl */ `
attribute vec2 particleUv;
attribute float lineEnd;
uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;
uniform float uFlowSpeed;
varying float vLineEnd;
varying float vSpeedRatio;
varying float vWake;

void main() {
  vec3 particlePosition = texture2D(texturePosition, particleUv).xyz;
  vec4 velocityState = texture2D(textureVelocity, particleUv);
  vec3 velocity = velocityState.xyz;
  float magnitude = max(length(velocity), 0.0001);
  float trailLength = ${RENDER_TRAIL_LENGTH_BASE.toFixed(3)} + min(uFlowSpeed, ${RENDER_TRAIL_LENGTH_SPEED_CAP.toFixed(2)}) * ${RENDER_TRAIL_LENGTH_SPEED_FACTOR.toFixed(3)};
  vec3 renderedPosition = particlePosition - normalize(velocity) * trailLength * (1.0 - lineEnd);
  vLineEnd = lineEnd;
  vSpeedRatio = magnitude / max(uFlowSpeed, 0.001);
  vWake = velocityState.w;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(renderedPosition, 1.0);
}
`;

export const GLSL_RENDER_FRAGMENT = /* glsl */ `
varying float vLineEnd;
varying float vSpeedRatio;
varying float vWake;

void main() {
  vec3 slowColor = vec3(1.0, 0.55, 0.18);
  vec3 baseColor = vec3(0.34, 0.86, 0.84);
  vec3 fastColor = vec3(0.76, 1.0, 0.43);
  vec3 wakeColor = vec3(0.55, 0.38, 0.92);
  vec3 color = mix(slowColor, baseColor, smoothstep(0.38, 0.92, vSpeedRatio));
  color = mix(color, fastColor, smoothstep(1.03, 1.34, vSpeedRatio));
  color = mix(color, wakeColor, smoothstep(0.18, 0.72, vWake));
  float alpha = mix(0.08, 0.78, vLineEnd) * (0.58 + min(vSpeedRatio, 1.3) * 0.28);
  gl_FragColor = vec4(color, alpha);
}
`;