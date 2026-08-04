"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ObjectSpec } from "@/lib/physics/aerodynamics";
import {
  createRebuildPoint,
  createRebuildStreamline,
  getRebuildFlowCoordinates,
  REBUILD_EXIT_STREAMWISE,
  REBUILD_GROUND_Y,
  REBUILD_INLET_STREAMWISE,
  sampleRebuildFlowField,
  stepRebuildPoint,
  type RebuildFlowSample,
} from "@/lib/flow/rebuildSolver";

type RebuildFlowProps = {
  object: ObjectSpec;
  yaw: number;
  speed: number;
  spoilerAngleDeg: number;
  turbulenceStrength?: number;
  enabled: boolean;
  running: boolean;
};

type ParticleData = {
  count: number;
  particles: Float32Array;
  pointPositions: Float32Array;
  segmentPositions: Float32Array;
  colors: Float32Array;
  phases: Float32Array;
  laneBiases: Float32Array;
};

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function setFlowColor(color: THREE.Color, sample: RebuildFlowSample) {
  if (sample.wakeIntensity > 0.18) {
    color.setHSL(0.72, 0.72, 0.62);
  } else if (sample.stagnationIntensity > 0.24) {
    color.setHSL(0.06, 0.86, 0.60);
  } else if (sample.speedRatio > 1.08) {
    color.setHSL(0.46, 0.82, 0.61);
  } else if (sample.pressureRatio < -0.18) {
    color.setHSL(0.56, 0.78, 0.60);
  } else {
    color.setHSL(0.52, 0.48, 0.68);
  }
}

export function RebuildParticleFlow(props: RebuildFlowProps) {
  const { object, yaw, speed, spoilerAngleDeg, turbulenceStrength, enabled, running } = props;
  const lines = useRef<THREE.LineSegments>(null);
  const points = useRef<THREE.Points>(null);
  const solverConfig = useMemo(() => ({
    object,
    yawAngleDeg: yaw,
    speedMps: speed,
    spoilerAngleDeg,
    turbulenceStrength: turbulenceStrength ?? 1,
  }), [object, yaw, speed, spoilerAngleDeg, turbulenceStrength]);
  const particleData = useMemo(() => {
    const count = 1200;
    const particles = new Float32Array(count * 3);
    const pointPositions = new Float32Array(count * 3);
    const segmentPositions = new Float32Array(count * 6);
    const colors = new Float32Array(count * 6);
    const phases = new Float32Array(count);
    const laneBiases = new Float32Array(count);

    for (let index = 0; index < count; index += 1) {
      const lateral = -3.05 + pseudoRandom(index + 101) * 6.1;
      const height = 0.10 + pseudoRandom(index + 201) * 2.78;
      const point = createRebuildPoint(REBUILD_INLET_STREAMWISE, lateral, height, yaw);
      particles.set([point.x, point.y, point.z], index * 3);
      pointPositions.set([point.x, point.y, point.z], index * 3);
      segmentPositions.set([point.x - 0.08, point.y, point.z, point.x, point.y, point.z], index * 6);
      phases[index] = pseudoRandom(index + 301) * Math.PI * 2;
      laneBiases[index] = Math.sign(height - 0.72) || (phases[index] > Math.PI ? 1 : -1);
    }

    return { count, particles, pointPositions, segmentPositions, colors, phases, laneBiases };
  }, [yaw]);

  const runtime = useRef<ParticleData | null>(null);
  useEffect(() => {
    runtime.current = particleData;
  }, [particleData]);

  useFrame((state, delta) => {
    const data = runtime.current;
    if (!data || !lines.current || !points.current || !enabled || !running) return;
    const frameDelta = Math.min(delta, 0.05);
    const substeps = Math.min(3, Math.max(1, Math.ceil(frameDelta / 0.018)));
    const step = frameDelta / substeps;

    for (let index = 0; index < data.count; index += 1) {
      const particleCursor = index * 3;
      const segmentCursor = index * 6;
      let current = {
        x: data.particles[particleCursor],
        y: data.particles[particleCursor + 1],
        z: data.particles[particleCursor + 2],
      };
      for (let substep = 0; substep < substeps; substep += 1) {
        current = stepRebuildPoint(
          current,
          solverConfig,
          step,
          state.clock.elapsedTime - frameDelta + substep * step,
          data.phases[index],
          data.laneBiases[index],
        );
      }

      const flowCoordinates = getRebuildFlowCoordinates(current, yaw);
      if (
        flowCoordinates.streamwise > REBUILD_EXIT_STREAMWISE
        || Math.abs(flowCoordinates.lateral) > 3.65
        || current.y < REBUILD_GROUND_Y - 0.01
        || current.y > 3.35
      ) {
        const lateral = -3.05 + pseudoRandom(index + Math.floor(state.clock.elapsedTime * 6) + 401) * 6.1;
        const height = 0.10 + pseudoRandom(index + Math.floor(state.clock.elapsedTime * 6) + 501) * 2.78;
        current = createRebuildPoint(REBUILD_INLET_STREAMWISE, lateral, height, yaw);
        data.laneBiases[index] = Math.sign(height - 0.72) || 1;
      }

      const sample = sampleRebuildFlowField(
        current,
        solverConfig,
        state.clock.elapsedTime,
        data.phases[index],
        data.laneBiases[index],
      );
      const velocityMagnitude = Math.max(Math.hypot(sample.velocity.x, sample.velocity.y, sample.velocity.z), 0.01);
      const trailLength = 0.075 + sample.speedRatio * 0.065;
      data.particles.set([current.x, current.y, current.z], particleCursor);
      data.pointPositions.set([current.x, current.y, current.z], particleCursor);
      data.segmentPositions.set([
        current.x - (sample.velocity.x / velocityMagnitude) * trailLength,
        current.y - (sample.velocity.y / velocityMagnitude) * trailLength,
        current.z - (sample.velocity.z / velocityMagnitude) * trailLength,
        current.x,
        current.y,
        current.z,
      ], segmentCursor);
      const color = new THREE.Color();
      setFlowColor(color, sample);
      data.colors.set([color.r, color.g, color.b, color.r, color.g, color.b], segmentCursor);
    }

    (lines.current.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (lines.current.geometry.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
    (points.current.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <group visible={props.enabled}>
      <lineSegments ref={lines}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particleData.segmentPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[particleData.colors, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.68} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particleData.pointPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#d4f4ec" size={0.022} transparent opacity={0.34} depthWrite={false} />
      </points>
    </group>
  );
}

export function RebuildStreamlines(props: RebuildFlowProps) {
  const { object, yaw, speed, spoilerAngleDeg, turbulenceStrength, enabled } = props;
  const solverConfig = useMemo(() => ({
    object,
    yawAngleDeg: yaw,
    speedMps: speed,
    spoilerAngleDeg,
    turbulenceStrength: turbulenceStrength ?? 1,
  }), [object, yaw, speed, spoilerAngleDeg, turbulenceStrength]);
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();
    const lateralCount = 7;
    const heightCount = 6;

    for (let lateralIndex = 0; lateralIndex < lateralCount; lateralIndex += 1) {
      for (let heightIndex = 0; heightIndex < heightCount; heightIndex += 1) {
        const lateral = -2.8 + (lateralIndex / (lateralCount - 1)) * 5.6;
        const height = 0.15 + (heightIndex / (heightCount - 1)) * 2.42;
        const phase = (lateralIndex * heightCount + heightIndex) * 0.71;
        const laneBias = Math.sign(height - 0.72) || (lateralIndex % 2 === 0 ? -1 : 1);
        const points = createRebuildStreamline(solverConfig, { lateral, height, phase, laneBias });

        for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
          const previous = points[pointIndex - 1];
          const current = points[pointIndex];
          positions.push(previous.x, previous.y, previous.z, current.x, current.y, current.z);
          const midpoint = {
            x: (previous.x + current.x) * 0.5,
            y: (previous.y + current.y) * 0.5,
            z: (previous.z + current.z) * 0.5,
          };
          setFlowColor(color, sampleRebuildFlowField(midpoint, solverConfig, pointIndex * 0.04, phase, laneBias));
          colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
        }
      }
    }

    return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
  }, [solverConfig]);

  return (
    <lineSegments visible={enabled}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[geometry.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[geometry.colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.76} depthWrite={false} />
    </lineSegments>
  );
}
