"use client";

import { useMemo } from "react";
import * as THREE from "three";

type SportsCarModelProps = {
  spoilerAngleDeg: number;
};

const BODY_EXTRUDE: THREE.ExtrudeGeometryOptions = {
  depth: 1.62,
  bevelEnabled: true,
  bevelSegments: 5,
  bevelSize: 0.09,
  bevelThickness: 0.09,
  curveSegments: 18,
  steps: 1,
};

const CABIN_EXTRUDE: THREE.ExtrudeGeometryOptions = {
  depth: 1.38,
  bevelEnabled: true,
  bevelSegments: 5,
  bevelSize: 0.055,
  bevelThickness: 0.055,
  curveSegments: 18,
  steps: 1,
};

function createBodyShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-2.13, 0.42);
  shape.bezierCurveTo(-2.18, 0.56, -2.1, 0.69, -1.91, 0.78);
  shape.bezierCurveTo(-1.55, 0.91, -1.06, 0.91, -0.7, 0.98);
  shape.bezierCurveTo(-0.32, 1.05, -0.15, 1.22, 0.1, 1.34);
  shape.bezierCurveTo(0.38, 1.48, 0.78, 1.49, 1.04, 1.37);
  shape.bezierCurveTo(1.27, 1.26, 1.45, 1.08, 1.62, 1.01);
  shape.bezierCurveTo(1.84, 0.92, 2.07, 0.85, 2.14, 0.7);
  shape.bezierCurveTo(2.2, 0.58, 2.15, 0.44, 2.02, 0.38);
  shape.lineTo(1.72, 0.33);
  shape.bezierCurveTo(1.56, 0.62, 1.4, 0.75, 1.18, 0.75);
  shape.bezierCurveTo(0.94, 0.75, 0.78, 0.59, 0.68, 0.32);
  shape.lineTo(-0.83, 0.32);
  shape.bezierCurveTo(-0.93, 0.6, -1.09, 0.75, -1.34, 0.75);
  shape.bezierCurveTo(-1.59, 0.75, -1.76, 0.59, -1.84, 0.34);
  shape.lineTo(-2.13, 0.42);
  return shape;
}

function createCabinShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.62, 0.95);
  shape.bezierCurveTo(-0.35, 1.08, -0.16, 1.36, 0.16, 1.48);
  shape.bezierCurveTo(0.43, 1.58, 0.78, 1.56, 1.02, 1.42);
  shape.bezierCurveTo(1.22, 1.3, 1.38, 1.12, 1.5, 1.01);
  shape.lineTo(-0.62, 0.95);
  return shape;
}

function createWindowShape(points: Array<[number, number]>) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  return shape;
}

const BODY_SHAPE = createBodyShape();
const CABIN_SHAPE = createCabinShape();
const FRONT_WINDOW_SHAPE = createWindowShape([
  [-0.42, 1.02],
  [-0.12, 1.36],
  [0.16, 1.45],
  [0.2, 1.02],
]);
const SIDE_WINDOW_SHAPE = createWindowShape([
  [0.28, 1.45],
  [0.72, 1.43],
  [1.19, 1.08],
  [0.32, 1.03],
]);

function Wheel({ x }: { x: number }) {
  return (
    <group position={[x, 0.38, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.4, 0.4, 1.79, 36, 1]} />
        <meshStandardMaterial color="#090c0e" roughness={0.72} metalness={0.05} />
      </mesh>
      {[-0.91, 0.91].map((side) => (
        <group key={side} position={[0, side, 0]}>
          <mesh>
            <cylinderGeometry args={[0.245, 0.245, 0.055, 32]} />
            <meshStandardMaterial color="#a9b7b7" metalness={0.88} roughness={0.2} />
          </mesh>
          <mesh position={[0, side > 0 ? 0.032 : -0.032, 0]}>
            <cylinderGeometry args={[0.105, 0.105, 0.065, 24]} />
            <meshStandardMaterial color="#273239" metalness={0.7} roughness={0.28} />
          </mesh>
          {[0, 1, 2, 3, 4].map((spoke) => (
            <mesh key={spoke} rotation={[0, spoke * (Math.PI * 2 / 5), 0]} position={[0.11, side > 0 ? 0.035 : -0.035, 0]}>
              <boxGeometry args={[0.2, 0.045, 0.045]} />
              <meshStandardMaterial color="#4e5d62" metalness={0.82} roughness={0.2} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function SideWindows({ z, mirrored = false }: { z: number; mirrored?: boolean }) {
  const rotation: [number, number, number] = mirrored ? [0, Math.PI, 0] : [0, 0, 0];
  return (
    <group position={[0, 0, z]} rotation={rotation}>
      <mesh>
        <shapeGeometry args={[FRONT_WINDOW_SHAPE, 18]} />
        <meshPhysicalMaterial color="#0b2029" emissive="#07171d" emissiveIntensity={0.34} metalness={0.42} roughness={0.08} clearcoat={1} clearcoatRoughness={0.08} />
      </mesh>
      <mesh>
        <shapeGeometry args={[SIDE_WINDOW_SHAPE, 18]} />
        <meshPhysicalMaterial color="#081820" emissive="#06151a" emissiveIntensity={0.32} metalness={0.35} roughness={0.1} clearcoat={1} clearcoatRoughness={0.08} />
      </mesh>
      <mesh position={[0.24, 1.24, 0.008]}>
        <boxGeometry args={[0.035, 0.42, 0.025]} />
        <meshStandardMaterial color="#12191d" metalness={0.65} roughness={0.24} />
      </mesh>
    </group>
  );
}

export function SportsCarModel({ spoilerAngleDeg }: SportsCarModelProps) {
  const spoilerRotation = -(spoilerAngleDeg * Math.PI) / 180;
  const bodyGeometry = useMemo(() => {
    const geometry = new THREE.ExtrudeGeometry(BODY_SHAPE, BODY_EXTRUDE);
    geometry.translate(0, 0, -BODY_EXTRUDE.depth! / 2);
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  const cabinGeometry = useMemo(() => {
    const geometry = new THREE.ExtrudeGeometry(CABIN_SHAPE, CABIN_EXTRUDE);
    geometry.translate(0, 0, -CABIN_EXTRUDE.depth! / 2);
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  return (
    <group position={[0, 0.015, 0]}>
      <mesh geometry={bodyGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial color="#df3d4b" emissive="#2a0308" emissiveIntensity={0.2} metalness={0.72} roughness={0.22} clearcoat={1} clearcoatRoughness={0.12} />
      </mesh>
      <mesh geometry={cabinGeometry} castShadow>
        <meshPhysicalMaterial color="#d53644" emissive="#260207" emissiveIntensity={0.18} metalness={0.68} roughness={0.2} clearcoat={1} clearcoatRoughness={0.1} />
      </mesh>
      <SideWindows z={0.92} />
      <SideWindows z={-0.92} mirrored />

      {[-0.925, 0.925].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[0.28, 0.72, 0]} rotation={[0, 0, -0.01]}>
            <boxGeometry args={[0.018, 0.52, 0.018]} />
            <meshStandardMaterial color="#55121a" metalness={0.48} roughness={0.35} />
          </mesh>
          <mesh position={[-0.08, 0.55, 0]}>
            <boxGeometry args={[0.64, 0.035, 0.02]} />
            <meshStandardMaterial color="#6f1821" metalness={0.55} roughness={0.3} />
          </mesh>
          <mesh position={[-0.8, 0.62, 0]} rotation={[0, 0, -0.16]}>
            <boxGeometry args={[0.34, 0.16, 0.025]} />
            <meshStandardMaterial color="#172025" metalness={0.68} roughness={0.22} />
          </mesh>
        </group>
      ))}

      <mesh position={[-1.98, 0.65, 0]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.24, 0.13, 1.38]} />
        <meshPhysicalMaterial color="#e8f5dd" emissive="#d4a964" emissiveIntensity={0.7} roughness={0.16} />
      </mesh>
      <mesh position={[-2.11, 0.46, 0]}>
        <boxGeometry args={[0.12, 0.17, 1.34]} />
        <meshStandardMaterial color="#101518" metalness={0.45} roughness={0.3} />
      </mesh>
      <mesh position={[2.09, 0.68, 0]}>
        <boxGeometry args={[0.09, 0.14, 1.42]} />
        <meshStandardMaterial color="#d43c34" emissive="#931b18" emissiveIntensity={0.75} roughness={0.2} />
      </mesh>
      <mesh position={[-1.93, 0.23, 0]} rotation={[0, 0, -0.025]}>
        <boxGeometry args={[0.54, 0.055, 1.78]} />
        <meshStandardMaterial color="#14191c" metalness={0.68} roughness={0.25} />
      </mesh>
      <mesh position={[1.94, 0.26, 0]} rotation={[0, 0, 0.08]}>
        <boxGeometry args={[0.42, 0.12, 1.7]} />
        <meshStandardMaterial color="#11171a" metalness={0.72} roughness={0.24} />
      </mesh>

      {[-1.32, 1.27].map((x) => <Wheel key={x} x={x} />)}

      {[-0.82, 0.82].map((z) => (
        <group key={z} position={[0.09, 1.08, z]}>
          <mesh rotation={[0, 0, -0.18]}>
            <sphereGeometry args={[0.12, 18, 10]} />
            <meshPhysicalMaterial color="#b92735" metalness={0.7} roughness={0.18} clearcoat={1} />
          </mesh>
          <mesh position={[0.04, -0.05, 0]}>
            <boxGeometry args={[0.07, 0.08, 0.13]} />
            <meshStandardMaterial color="#151b1f" metalness={0.5} roughness={0.25} />
          </mesh>
        </group>
      ))}

      {[-0.58, 0.58].map((z) => (
        <mesh key={z} position={[1.55, 1.23, z]} rotation={[0, 0, -0.05]}>
          <boxGeometry args={[0.07, 0.42, 0.065]} />
          <meshStandardMaterial color="#161c20" metalness={0.78} roughness={0.2} />
        </mesh>
      ))}
      <group position={[1.55, 1.43, 0]} rotation={[0, 0, spoilerRotation]}>
        <mesh castShadow>
          <boxGeometry args={[0.64, 0.055, 1.76]} />
          <meshPhysicalMaterial color="#171e22" metalness={0.82} roughness={0.16} clearcoat={0.8} clearcoatRoughness={0.14} />
        </mesh>
        {[-0.89, 0.89].map((z) => (
          <mesh key={z} position={[0.08, 0.055, z]}>
            <boxGeometry args={[0.44, 0.15, 0.032]} />
            <meshStandardMaterial color="#13191d" metalness={0.74} roughness={0.2} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
