"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { createStreamline, sampleFlowField, type StreamlineSeed, type FlowPoint } from "@/lib/physics/flowField";
import type { ObjectSpec } from "@/lib/physics/aerodynamics";

const COHERENT_SEEDS: StreamlineSeed[] = Array.from({ length: 48 }, (_, index) => {
  const lane = Math.floor(index / 8);
  const layer = index % 8;
  return {
    lateral: -2.8 + lane * 0.8,
    height: 0.15 + layer * 0.32,
    phase: 0.15 + index * 0.38,
  };
});

const COHERENT_RIBBON_SEEDS: StreamlineSeed[] = [
  { lateral: -1.8, height: 0.2, phase: 0.2 },
  { lateral: -1.2, height: 0.35, phase: 0.8 },
  { lateral: -0.6, height: 0.5, phase: 1.4 },
  { lateral: 0.0, height: 0.65, phase: 2.0 },
  { lateral: 0.6, height: 0.8, phase: 2.6 },
  { lateral: 1.2, height: 1.0, phase: 3.2 },
  { lateral: 1.8, height: 1.2, phase: 3.8 },
  { lateral: -2.2, height: 0.25, phase: 0.5 },
  { lateral: -1.6, height: 0.4, phase: 1.1 },
  { lateral: -1.0, height: 0.55, phase: 1.7 },
  { lateral: -0.4, height: 0.7, phase: 2.3 },
  { lateral: 0.2, height: 0.85, phase: 2.9 },
  { lateral: 0.8, height: 1.0, phase: 3.5 },
  { lateral: 1.4, height: 1.15, phase: 4.1 },
  { lateral: 2.0, height: 1.3, phase: 4.7 },
  { lateral: -2.6, height: 0.18, phase: 0.3 },
];

interface CoherentStreamlinesProps {
  object: ObjectSpec;
  yaw: number;
  spoilerAngleDeg: number;
  enabled: boolean;
  running: boolean;
  turbulenceStrength: number;
  metrics?: Record<string, unknown>;
}

function getFlowColor(speedRatio: number, wakeIntensity: number, stagnationIntensity: number): THREE.Color {
  const color = new THREE.Color();
  
  if (stagnationIntensity > 0.4) {
    color.setHSL(0.05, 0.9, 0.6);
  } else if (wakeIntensity > 0.3) {
    color.setHSL(0.7, 0.7, 0.6);
  } else if (speedRatio > 1.15) {
    color.setHSL(0.45, 0.8, 0.6);
  } else if (speedRatio > 1.0) {
    color.setHSL(0.5, 0.7, 0.65);
  } else {
    color.setHSL(0.55, 0.5, 0.55);
  }
  return color;
}

export function CoherentStreamlines({
  object,
  yaw,
  spoilerAngleDeg,
  enabled,
  running,
  turbulenceStrength,
  metrics,
}: CoherentStreamlinesProps) {
  const geometry = useMemo(() => {
    const allSegments: Array<{ p1: FlowPoint; p2: FlowPoint; mid: FlowPoint }> = [];
    
    for (const seed of COHERENT_SEEDS) {
      const points = createStreamline(object, yaw, seed, 120, 0.15, spoilerAngleDeg);
      
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const mid: FlowPoint = {
          x: (p1.x + p2.x) * 0.5,
          y: (p1.y + p2.y) * 0.5,
          z: (p1.z + p2.z) * 0.5,
        };
        allSegments.push({ p1, p2, mid });
      }
    }
    
    const colors: number[] = [];
    for (const seg of allSegments) {
      const sample = sampleFlowField(seg.mid, object, yaw, 0, 0, turbulenceStrength, spoilerAngleDeg);
      
      const speedRatio = Math.min(Math.hypot(sample.velocity.x, sample.velocity.y, sample.velocity.z) / Math.max(0.001, Math.sqrt(2) * 27.8 / 20), 2.0);
      const wakeIntensity = sample.wakeIntensity;
      const stagnationIntensity = sample.stagnationIntensity;
      
      const color = getFlowColor(speedRatio, wakeIntensity, stagnationIntensity);
      
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }
    
    const positions: number[] = [];
    for (const seed of COHERENT_SEEDS) {
      const points = createStreamline(object, yaw, seed, 120, 0.15, spoilerAngleDeg);
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      }
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    
    return geometry;
  }, [object, yaw, spoilerAngleDeg, turbulenceStrength]);

  if (!enabled || !running) return null;

  return (
    <lineSegments geometry={geometry} visible={enabled}>
      <lineBasicMaterial 
        vertexColors 
        transparent 
        opacity={0.65} 
        depthWrite={false} 
        blending={THREE.AdditiveBlending} 
      />
    </lineSegments>
  );
}

export function CoherentRibbons({
  object,
  yaw,
  spoilerAngleDeg,
  enabled,
  running,
  turbulenceStrength,
}: CoherentStreamlinesProps) {
  const ribbons = useMemo(() => {
    return COHERENT_RIBBON_SEEDS.map((seed) => ({
      id: `${seed.lateral}-${seed.height}-${seed.phase}`,
      points: createStreamline(object, yaw, seed, 120, 0.15, spoilerAngleDeg).map((point) => [point.x, point.y, point.z] as [number, number, number]),
    }));
  }, [object, yaw, spoilerAngleDeg, turbulenceStrength]);

  if (!enabled || !running) return null;

  return (
    <group visible={enabled}>
      {ribbons.map((ribbon) => (
        <group key={ribbon.id}>
          <Line points={ribbon.points} color="#d9ebe7" lineWidth={5} transparent opacity={0.02} depthWrite={false} />
          <Line points={ribbon.points} color="#d8ece8" lineWidth={2.5} transparent opacity={0.05} depthWrite={false} />
          <Line points={ribbon.points} color="#f0f7f4" lineWidth={1} transparent opacity={0.35} depthWrite={false} />
        </group>
      ))}
    </group>
  );
}