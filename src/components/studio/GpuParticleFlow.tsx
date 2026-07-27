"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GPUComputationRenderer, type Variable } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import * as THREE from "three";
import type { ObjectSpec } from "@/lib/physics/aerodynamics";
import {
  FIXED_STEP_SECONDS,
  MAX_SUBSTEPS,
  MAX_ACCUMULATOR_SECONDS,
  COMPUTE_SIZE,
  PARTICLE_COUNT,
  GLSL_HASH21,
  GLSL_SD_ELLIPSOID,
  GLSL_SD_BOX,
  GLSL_SCENE_SDF_CAR,
  GLSL_SCENE_SDF_GENERIC,
  GLSL_SCENE_SDF,
  GLSL_SDF_NORMAL_POSITION,
  GLSL_SDF_NORMAL_VELOCITY,
  GLSL_POSITION_RESET,
  GLSL_POSITION_MAIN,
  GLSL_VELOCITY_MAIN,
  GLSL_RENDER_VERTEX,
  GLSL_RENDER_FRAGMENT,
} from "@/lib/flow";
import { computeFixedSteps } from "@/lib/flow/fixedStep";

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

const POSITION_SHADER = /* glsl */ `
  uniform float uDelta;
  uniform float uCycle;
  uniform float uYaw;
  uniform float uObjectKind;
  uniform float uSpoilerAngle;
  uniform vec3 uDimensions;

  ${GLSL_HASH21}
  ${GLSL_SD_ELLIPSOID}
  ${GLSL_SD_BOX}
  ${GLSL_SCENE_SDF_CAR}
  ${GLSL_SCENE_SDF_GENERIC}
  ${GLSL_SCENE_SDF}
  ${GLSL_SDF_NORMAL_POSITION}
  ${GLSL_POSITION_RESET}

  ${GLSL_POSITION_MAIN}
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

  ${GLSL_HASH21}
  ${GLSL_SD_ELLIPSOID}
  ${GLSL_SD_BOX}
  ${GLSL_SCENE_SDF_CAR}
  ${GLSL_SCENE_SDF_GENERIC}
  ${GLSL_SCENE_SDF}
  ${GLSL_SDF_NORMAL_VELOCITY}

  ${GLSL_VELOCITY_MAIN}
`;

const RENDER_VERTEX_SHADER = /* glsl */ `${GLSL_RENDER_VERTEX}`;

const RENDER_FRAGMENT_SHADER = /* glsl */ `${GLSL_RENDER_FRAGMENT}`;

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

type GpuStatus = "initializing" | "ready" | "error" | "context-lost" | "unsupported";

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
  const initAttempted = useRef(false);
  const contextLost = useRef(false);
  const [gpuStatus, setGpuStatus] = useState<GpuStatus>(supported ? "initializing" : "unsupported");

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
    if (!supported) {
      queueMicrotask(() => setGpuStatus("unsupported"));
      return;
    }

    if (initAttempted.current) {
      return;
    }
    initAttempted.current = true;

    const canvas = gl.domElement;

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      contextLost.current = true;
      setGpuStatus("context-lost");
    };

    const handleContextRestored = () => {
      contextLost.current = false;
      initAttempted.current = false;
      setGpuStatus("initializing");
    };

    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

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
      queueMicrotask(() => setGpuStatus("error"));
      compute.dispose();
      return;
    }

    runtime.current = { compute, positionVariable, velocityVariable };
    queueMicrotask(() => setGpuStatus("ready"));

    function cleanup() {
      if (runtime.current) {
        runtime.current.compute.dispose();
        runtime.current = null;
      }
      accumulator.current = 0;
      cycle.current = 0;
    }

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      cleanup();
    };
  }, [gl, supported]);

  useEffect(() => () => {
    geometry.dispose();
  }, [geometry]);

  useFrame((state, delta) => {
    if (gpuStatus !== "ready") return;
    if (contextLost.current) return;

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
      const cappedDelta = Math.min(delta, FIXED_STEP_SECONDS * MAX_SUBSTEPS * 2);
      accumulator.current = Math.min(accumulator.current + cappedDelta, MAX_ACCUMULATOR_SECONDS);
      const { steps, remainingAccumulator, newCycle } = computeFixedSteps(
        accumulator.current,
        0,
        FIXED_STEP_SECONDS,
        MAX_SUBSTEPS,
        cycle.current
      );
      for (let i = 0; i < steps; i += 1) {
        positionUniforms.uDelta.value = FIXED_STEP_SECONDS;
        positionUniforms.uCycle.value = cycle.current + i + 1;
        current.compute.compute();
      }
      accumulator.current = remainingAccumulator;
      cycle.current = newCycle;
    }

    currentMaterial.uniforms.texturePosition.value = current.compute.getCurrentRenderTarget(current.positionVariable).texture;
    currentMaterial.uniforms.textureVelocity.value = current.compute.getCurrentRenderTarget(current.velocityVariable).texture;
  });

  if (!supported || gpuStatus === "unsupported" || gpuStatus === "error" || gpuStatus === "context-lost") {
    return fallback;
  }

  if (gpuStatus !== "ready") {
    return null;
  }

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