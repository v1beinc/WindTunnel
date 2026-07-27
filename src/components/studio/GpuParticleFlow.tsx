"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GPUComputationRenderer, type Variable } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import * as THREE from "three";
import type { ObjectSpec } from "@/lib/physics/aerodynamics";

const COMPUTE_SIZE = 128;
const PARTICLE_COUNT = COMPUTE_SIZE * COMPUTE_SIZE;
const FIXED_STEP_SECONDS = 1 / 120;
const MAX_SUBSTEPS = 12;

const POSITION_SHADER = /* glsl */ `
  uniform float uDelta;
  uniform float uCycle;
  uniform float uYaw;
  uniform float uObjectKind;
  uniform float uSpoilerAngle;
  uniform vec3 uDimensions;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float sdEllipsoid(vec3 p, vec3 radii) {
    float k0 = length(p / radii);
    if (k0 < 0.0001) return -min(radii.x, min(radii.y, radii.z));
    float k1 = length(p / (radii * radii));
    return k0 * (k0 - 1.0) / max(k1, 0.0001);
  }

  float sdBox(vec3 p, vec3 halfSize) {
    vec3 q = abs(p) - halfSize;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
  }

  float sceneSdf(vec3 p) {
    float result = 0.0;
    if (uObjectKind < 0.5) {
      float body = sdEllipsoid(p - vec3(0.0, 0.66, 0.0), vec3(2.23, 0.48, 0.89));
      float nose = sdEllipsoid(p - vec3(-1.68, 0.66, 0.0), vec3(0.67, 0.39, 0.84));
      float cabin = sdEllipsoid(p - vec3(0.38, 1.12, 0.0), vec3(1.16, 0.45, 0.73));
      float angle = -uSpoilerAngle;
      float c = cos(angle);
      float s = sin(angle);
      vec3 wingPoint = p - vec3(1.55, 1.43, 0.0);
      wingPoint.xy = mat2(c, -s, s, c) * wingPoint.xy;
      float wing = sdBox(wingPoint, vec3(0.34, 0.055, 0.92));
      float supports = min(
        sdBox(p - vec3(1.55, 1.23, 0.62), vec3(0.05, 0.22, 0.055)),
        sdBox(p - vec3(1.55, 1.23, -0.62), vec3(0.05, 0.22, 0.055))
      );
      result = min(min(min(body, nose), cabin), min(wing, supports));
    } else {
      vec3 halfSize = max(uDimensions * 0.5, vec3(0.12));
      vec3 localPoint = p - vec3(0.0, halfSize.y + 0.05, 0.0);
      result = sdEllipsoid(localPoint, halfSize);
      if (uObjectKind < 1.5) result = sdBox(localPoint, halfSize);
      else if (uObjectKind < 2.5) result = length(localPoint) - min(halfSize.x, min(halfSize.y, halfSize.z));
      else if (uObjectKind < 3.5) result = sdBox(localPoint, vec3(halfSize.x, max(halfSize.y * 0.2, 0.06), halfSize.z));
    }
    return result;
  }

  vec3 sdfNormal(vec3 p) {
    const float e = 0.018;
    return normalize(vec3(
      sceneSdf(p + vec3(e, 0.0, 0.0)) - sceneSdf(p - vec3(e, 0.0, 0.0)),
      sceneSdf(p + vec3(0.0, e, 0.0)) - sceneSdf(p - vec3(0.0, e, 0.0)),
      sceneSdf(p + vec3(0.0, 0.0, e)) - sceneSdf(p - vec3(0.0, 0.0, e))
    ));
  }

  vec3 resetPosition(vec2 uv, float cycle) {
    float lateral = mix(-3.35, 3.35, hash21(uv + vec2(7.1, cycle * 0.013)));
    float height = mix(0.07, 3.25, hash21(uv.yx + vec2(19.7, cycle * 0.021)));
    vec3 windDirection = normalize(vec3(cos(uYaw), 0.0, sin(uYaw)));
    vec3 crossDirection = vec3(-windDirection.z, 0.0, windDirection.x);
    return windDirection * -7.2 + crossDirection * lateral + vec3(0.0, height, 0.0);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 state = texture2D(texturePosition, uv);
    vec3 velocity = texture2D(textureVelocity, uv).xyz;
    vec3 position = state.xyz + velocity * uDelta;
    float age = state.w + uDelta;

    float streamwise = dot(position, normalize(vec3(cos(uYaw), 0.0, sin(uYaw))));
    float distanceToBody = sceneSdf(position);
    if (distanceToBody < 0.015) {
      position += sdfNormal(position) * (0.018 - distanceToBody);
    }
    position.y = max(position.y, 0.055);

    bool outsideTunnel = streamwise > 7.25 || streamwise < -7.55 || position.y > 3.35 || abs(position.z) > 7.8 || abs(position.x) > 8.0;
    if (outsideTunnel || age > 7.5) {
      position = resetPosition(uv, uCycle + floor(age));
      age = hash21(uv + uCycle) * 0.24;
    }

    gl_FragColor = vec4(position, age);
  }
`;

const VELOCITY_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uFlowSpeed;
  uniform float uYaw;
  uniform float uObjectKind;
  uniform float uCd;
  uniform float uTurbulence;
  uniform float uSpoilerAngle;
  uniform vec3 uDimensions;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float sdEllipsoid(vec3 p, vec3 radii) {
    float k0 = length(p / radii);
    if (k0 < 0.0001) return -min(radii.x, min(radii.y, radii.z));
    float k1 = length(p / (radii * radii));
    return k0 * (k0 - 1.0) / max(k1, 0.0001);
  }

  float sdBox(vec3 p, vec3 halfSize) {
    vec3 q = abs(p) - halfSize;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
  }

  float sceneSdf(vec3 p) {
    float result = 0.0;
    if (uObjectKind < 0.5) {
      float body = sdEllipsoid(p - vec3(0.0, 0.66, 0.0), vec3(2.23, 0.48, 0.89));
      float nose = sdEllipsoid(p - vec3(-1.68, 0.66, 0.0), vec3(0.67, 0.39, 0.84));
      float cabin = sdEllipsoid(p - vec3(0.38, 1.12, 0.0), vec3(1.16, 0.45, 0.73));
      float angle = -uSpoilerAngle;
      float c = cos(angle);
      float s = sin(angle);
      vec3 wingPoint = p - vec3(1.55, 1.43, 0.0);
      wingPoint.xy = mat2(c, -s, s, c) * wingPoint.xy;
      float wing = sdBox(wingPoint, vec3(0.34, 0.055, 0.92));
      float supports = min(
        sdBox(p - vec3(1.55, 1.23, 0.62), vec3(0.05, 0.22, 0.055)),
        sdBox(p - vec3(1.55, 1.23, -0.62), vec3(0.05, 0.22, 0.055))
      );
      result = min(min(min(body, nose), cabin), min(wing, supports));
    } else {
      vec3 halfSize = max(uDimensions * 0.5, vec3(0.12));
      vec3 localPoint = p - vec3(0.0, halfSize.y + 0.05, 0.0);
      result = sdEllipsoid(localPoint, halfSize);
      if (uObjectKind < 1.5) result = sdBox(localPoint, halfSize);
      else if (uObjectKind < 2.5) result = length(localPoint) - min(halfSize.x, min(halfSize.y, halfSize.z));
      else if (uObjectKind < 3.5) result = sdBox(localPoint, vec3(halfSize.x, max(halfSize.y * 0.2, 0.06), halfSize.z));
    }
    return result;
  }

  vec3 sdfNormal(vec3 p) {
    const float e = 0.026;
    return normalize(vec3(
      sceneSdf(p + vec3(e, 0.0, 0.0)) - sceneSdf(p - vec3(e, 0.0, 0.0)),
      sceneSdf(p + vec3(0.0, e, 0.0)) - sceneSdf(p - vec3(0.0, e, 0.0)),
      sceneSdf(p + vec3(0.0, 0.0, e)) - sceneSdf(p - vec3(0.0, 0.0, e))
    ));
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 positionState = texture2D(texturePosition, uv);
    vec3 position = positionState.xyz;
    float seed = hash21(uv * 31.7);
    vec3 windDirection = normalize(vec3(cos(uYaw), 0.0, sin(uYaw)));
    vec3 crossDirection = vec3(-windDirection.z, 0.0, windDirection.x);
    float distanceToBody = sceneSdf(position);
    vec3 normal = sdfNormal(position);
    float influence = 1.0 - smoothstep(0.04, 1.12, max(distanceToBody, 0.0));
    float incoming = dot(windDirection, normal);

    vec3 flow = windDirection;
    flow -= normal * min(incoming, 0.0) * influence;

    float splitSide = dot(position, crossDirection);
    vec3 splitDirection = normalize(crossDirection * (splitSide + (seed - 0.5) * 0.12) + vec3(0.0, max(position.y - 0.56, 0.16), 0.0));
    float stagnation = influence * max(-incoming, 0.0);
    flow += splitDirection * stagnation * 0.72;
    flow *= 1.0 + influence * (0.18 + 0.18 * (1.0 - abs(incoming)));

    float streamwise = dot(position, windDirection);
    float rearReach = 2.22 * abs(windDirection.x) + 0.9 * abs(windDirection.z);
    float wakeDistance = streamwise - rearReach;
    float lateral = dot(position, crossDirection);
    float vertical = position.y - 0.69;
    float wakeWidth = 0.76 + max(wakeDistance, 0.0) * 0.14;
    float wake = step(0.0, wakeDistance)
      * exp(-(lateral * lateral + vertical * vertical * 1.22) / max(wakeWidth * wakeWidth, 0.05))
      * exp(-wakeDistance / 6.4);
    float deficit = clamp(0.24 + uCd * 0.42, 0.24, 0.58);
    flow *= 1.0 - wake * deficit;

    float shedding = sin(uTime * 5.1 + wakeDistance * 3.25 + seed * 6.2831);
    float vortex = wake * uTurbulence * (0.17 + uCd * 0.18) * shedding;
    flow += crossDirection * vortex * (0.45 + abs(vertical));
    flow.y += vortex * sign(lateral + 0.001) * 0.7;

    if (distanceToBody < 0.09) {
      flow += normal * (0.24 + max(-distanceToBody, 0.0) * 5.0);
    }
    if (position.y < 0.14) flow.y += (0.14 - position.y) * 3.2;

    gl_FragColor = vec4(flow * uFlowSpeed, wake);
  }
`;

const RENDER_VERTEX_SHADER = /* glsl */ `
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
    float trailLength = 0.075 + min(uFlowSpeed, 4.2) * 0.055;
    vec3 renderedPosition = particlePosition - normalize(velocity) * trailLength * (1.0 - lineEnd);
    vLineEnd = lineEnd;
    vSpeedRatio = magnitude / max(uFlowSpeed, 0.001);
    vWake = velocityState.w;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(renderedPosition, 1.0);
  }
`;

const RENDER_FRAGMENT_SHADER = /* glsl */ `
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

type GpuParticleFlowProps = {
  object: ObjectSpec;
  yaw: number;
  speed: number;
  spoilerAngleDeg: number;
  enabled: boolean;
  running: boolean;
  turbulenceStrength: number;
  fallback?: ReactNode;
};

type GpuRuntime = {
  compute: GPUComputationRenderer;
  positionVariable: Variable;
  velocityVariable: Variable;
};

function getObjectKind(kind: ObjectSpec["kind"]) {
  if (kind === "car") return 0;
  if (kind === "box") return 1;
  if (kind === "sphere") return 2;
  if (kind === "wing") return 3;
  return 4;
}

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function GpuParticleFlow({
  object,
  yaw,
  speed,
  spoilerAngleDeg,
  enabled,
  running,
  turbulenceStrength,
  fallback = null,
}: GpuParticleFlowProps) {
  const gl = useThree((state) => state.gl);
  const supported = gl.capabilities.isWebGL2 && gl.capabilities.maxVertexTextures > 0;
  const runtime = useRef<GpuRuntime | null>(null);
  const renderMaterial = useRef<THREE.ShaderMaterial>(null);
  const accumulator = useRef(0);
  const cycle = useRef(0);

  const geometry = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 2 * 3);
    const particleUvs = new Float32Array(PARTICLE_COUNT * 2 * 2);
    const lineEnds = new Float32Array(PARTICLE_COUNT * 2);

    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      const x = (index % COMPUTE_SIZE + 0.5) / COMPUTE_SIZE;
      const y = (Math.floor(index / COMPUTE_SIZE) + 0.5) / COMPUTE_SIZE;
      const vertex = index * 2;
      particleUvs.set([x, y, x, y], vertex * 2);
      lineEnds[vertex] = 0;
      lineEnds[vertex + 1] = 1;
    }

    const bufferGeometry = new THREE.BufferGeometry();
    bufferGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    bufferGeometry.setAttribute("particleUv", new THREE.BufferAttribute(particleUvs, 2));
    bufferGeometry.setAttribute("lineEnd", new THREE.BufferAttribute(lineEnds, 1));
    bufferGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.5, 0), 12);
    return bufferGeometry;
  }, []);

  const renderUniforms = useMemo(() => ({
    texturePosition: { value: null },
    textureVelocity: { value: null },
    uFlowSpeed: { value: 1 },
  }), []);

  useEffect(() => {
    if (!supported) return;

    const compute = new GPUComputationRenderer(COMPUTE_SIZE, COMPUTE_SIZE, gl);
    const initialPosition = compute.createTexture();
    const initialVelocity = compute.createTexture();
    const positionData = initialPosition.image.data as Float32Array;
    const velocityData = initialVelocity.image.data as Float32Array;

    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      const cursor = index * 4;
      positionData[cursor] = -7.15 + seededRandom(index + 1) * 14.2;
      positionData[cursor + 1] = 0.07 + seededRandom(index + 101) * 3.18;
      positionData[cursor + 2] = -3.35 + seededRandom(index + 201) * 6.7;
      positionData[cursor + 3] = seededRandom(index + 301) * 7.2;
      velocityData[cursor] = 1;
      velocityData[cursor + 1] = 0;
      velocityData[cursor + 2] = 0;
      velocityData[cursor + 3] = 0;
    }

    const positionVariable = compute.addVariable("texturePosition", POSITION_SHADER, initialPosition);
    const velocityVariable = compute.addVariable("textureVelocity", VELOCITY_SHADER, initialVelocity);
    compute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);
    compute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);

    positionVariable.material.uniforms.uDelta = { value: FIXED_STEP_SECONDS };
    positionVariable.material.uniforms.uCycle = { value: 0 };
    positionVariable.material.uniforms.uYaw = { value: 0 };
    positionVariable.material.uniforms.uObjectKind = { value: 0 };
    positionVariable.material.uniforms.uSpoilerAngle = { value: 0 };
    positionVariable.material.uniforms.uDimensions = { value: new THREE.Vector3(4.4, 1.4, 1.9) };

    velocityVariable.material.uniforms.uTime = { value: 0 };
    velocityVariable.material.uniforms.uFlowSpeed = { value: 1 };
    velocityVariable.material.uniforms.uYaw = { value: 0 };
    velocityVariable.material.uniforms.uObjectKind = { value: 0 };
    velocityVariable.material.uniforms.uCd = { value: 0.31 };
    velocityVariable.material.uniforms.uTurbulence = { value: 1 };
    velocityVariable.material.uniforms.uSpoilerAngle = { value: 0 };
    velocityVariable.material.uniforms.uDimensions = { value: new THREE.Vector3(4.4, 1.4, 1.9) };

    const error = compute.init();
    if (error) {
      console.warn(`GPU flow fallback: ${error}`);
      compute.dispose();
      return;
    }

    runtime.current = { compute, positionVariable, velocityVariable };

    return () => {
      runtime.current = null;
      compute.dispose();
    };
  }, [gl, supported]);

  useEffect(() => () => {
    geometry.dispose();
  }, [geometry]);

  useFrame((state, delta) => {
    const current = runtime.current;
    const currentMaterial = renderMaterial.current;
    if (!current || !currentMaterial) return;

    const yawRadians = THREE.MathUtils.degToRad(yaw);
    const spoilerRadians = THREE.MathUtils.degToRad(spoilerAngleDeg);
    const flowSpeed = speed <= 0.01 ? 0 : 0.82 + Math.min(speed / 20, 3.35);
    const objectKind = getObjectKind(object.kind);
    const dimensions = object.dimensionsM;
    const positionUniforms = current.positionVariable.material.uniforms;
    const velocityUniforms = current.velocityVariable.material.uniforms;

    positionUniforms.uYaw.value = yawRadians;
    positionUniforms.uObjectKind.value = objectKind;
    positionUniforms.uSpoilerAngle.value = spoilerRadians;
    positionUniforms.uDimensions.value.set(dimensions.length, dimensions.height, dimensions.width);
    velocityUniforms.uTime.value = state.clock.elapsedTime;
    velocityUniforms.uFlowSpeed.value = flowSpeed;
    velocityUniforms.uYaw.value = yawRadians;
    velocityUniforms.uObjectKind.value = objectKind;
    velocityUniforms.uCd.value = object.dragCoefficient;
    velocityUniforms.uTurbulence.value = turbulenceStrength;
    velocityUniforms.uSpoilerAngle.value = spoilerRadians;
    velocityUniforms.uDimensions.value.set(dimensions.length, dimensions.height, dimensions.width);
    currentMaterial.uniforms.uFlowSpeed.value = flowSpeed;

    if (enabled && running) {
      accumulator.current = Math.min(accumulator.current + Math.min(delta, 0.12), 0.12);
      let substeps = 0;
      while (accumulator.current >= FIXED_STEP_SECONDS && substeps < MAX_SUBSTEPS) {
        cycle.current += 1;
        positionUniforms.uDelta.value = FIXED_STEP_SECONDS;
        positionUniforms.uCycle.value = cycle.current;
        current.compute.compute();
        accumulator.current -= FIXED_STEP_SECONDS;
        substeps += 1;
      }
    }

    currentMaterial.uniforms.texturePosition.value = current.compute.getCurrentRenderTarget(current.positionVariable).texture;
    currentMaterial.uniforms.textureVelocity.value = current.compute.getCurrentRenderTarget(current.velocityVariable).texture;
  });

  if (!supported) return fallback;

  return (
    <lineSegments geometry={geometry} visible={enabled} frustumCulled={false}>
      <shaderMaterial
        ref={renderMaterial}
        uniforms={renderUniforms}
        vertexShader={RENDER_VERTEX_SHADER}
        fragmentShader={RENDER_FRAGMENT_SHADER}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

export const GPU_PARTICLE_COUNT = PARTICLE_COUNT;
