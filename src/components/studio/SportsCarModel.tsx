"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { CAR_GEOMETRY } from "@/lib/flow/carGeometryProfile";

type SportsCarModelProps = {
  spoilerAngleDeg: number;
};

function Wheel({ x, z, radius, width }: { x: number; z: number; radius: number; width: number }) {
  return (
    <group position={[x, radius - CAR_GEOMETRY.groundClearance, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, width, 32, 1]} />
        <meshStandardMaterial color="#0a0d0f" roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0, width * 0.52]}>
        <cylinderGeometry args={[radius * 0.6, radius * 0.6, 0.04, 32]} />
        <meshStandardMaterial color="#2a3439" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, -width * 0.52]}>
        <cylinderGeometry args={[radius * 0.6, radius * 0.6, 0.04, 32]} />
        <meshStandardMaterial color="#2a3439" metalness={0.85} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Hubcap({ x, z, radius }: { x: number; z: number; radius: number }) {
  return (
    <group position={[x, radius - CAR_GEOMETRY.groundClearance, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[radius * 0.55, radius * 0.55, 0.035, 32]} />
        <meshStandardMaterial color="#3a454a" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <cylinderGeometry args={[radius * 0.2, radius * 0.2, 0.025, 24]} />
        <meshStandardMaterial color="#4e5a5f" metalness={0.75} roughness={0.22} />
      </mesh>
    </group>
  );
}

export function SportsCarModel({ spoilerAngleDeg }: SportsCarModelProps) {
  const spoilerRotation = -(spoilerAngleDeg * Math.PI) / 180;
  const g = CAR_GEOMETRY;
  const w = g.wheels;

  // Simple body - elongated ellipsoid
  const bodyGeometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 32, 20);
    geo.scale(g.body.radii.x * 2, g.body.radii.y * 2, g.body.radii.z * 2);
    geo.translate(g.body.center.x, g.body.center.y, g.body.center.z);
    return geo;
  }, []);

  // Nose - front ellipsoid
  const noseGeometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 24, 16);
    geo.scale(g.nose.radii.x * 2, g.nose.radii.y * 2, g.nose.radii.z * 2);
    geo.translate(g.nose.center.x, g.nose.center.y, g.nose.center.z);
    return geo;
  }, []);

  // Cabin - upper ellipsoid
  const cabinGeometry = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 24, 16);
    geo.scale(g.cabin.radii.x * 2, g.cabin.radii.y * 2, g.cabin.radii.z * 2);
    geo.translate(g.cabin.center.x, g.cabin.center.y, g.cabin.center.z);
    return geo;
  }, []);

  // Spoiler
  const spoilerGeometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(
      g.spoiler.halfSize.x * 2,
      g.spoiler.halfSize.y * 2,
      g.spoiler.halfSize.z * 2
    );
    return geo;
  }, []);

  // Spoiler supports
  const supportGeometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(
      g.spoiler.supports.left.halfSize.x * 2,
      g.spoiler.supports.left.halfSize.y * 2,
      g.spoiler.supports.left.halfSize.z * 2
    );
    return geo;
  }, []);

  // Wheel geometry
  const wheelGeometry = useMemo(() => new THREE.CylinderGeometry(w.radius, w.radius, w.width, 32, 1), [w.radius, w.width]);
  const hubGeometry = useMemo(() => new THREE.CylinderGeometry(w.hubRadius, w.hubRadius, 0.035, 24), [w.hubRadius]);

  return (
    <group position={[0, 0.015, 0]}>
      {/* Body - main hull */}
      <mesh geometry={bodyGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#df3d4b"
          emissive="#2a0308"
          emissiveIntensity={0.2}
          metalness={0.72}
          roughness={0.22}
          clearcoat={1}
          clearcoatRoughness={0.12}
        />
      </mesh>

      {/* Nose */}
      <mesh geometry={noseGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#df3d4b"
          emissive="#2a0308"
          emissiveIntensity={0.2}
          metalness={0.72}
          roughness={0.22}
          clearcoat={1}
          clearcoatRoughness={0.12}
        />
      </mesh>

      {/* Cabin */}
      <mesh geometry={cabinGeometry} castShadow>
        <meshPhysicalMaterial
          color="#d53644"
          emissive="#260207"
          emissiveIntensity={0.18}
          metalness={0.68}
          roughness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>

      {/* Windows - simple transparent boxes */}
      <mesh
        position={[g.cabin.center.x - 0.15, g.cabin.center.y + 0.15, 0]}
        scale={[g.cabin.radii.x * 0.5, g.cabin.radii.y * 0.6, g.cabin.radii.z * 0.85]}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial
          color="#0b2029"
          emissive="#07171d"
          emissiveIntensity={0.34}
          metalness={0.42}
          roughness={0.08}
          clearcoat={1}
          clearcoatRoughness={0.08}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Spoiler */}
      <group position={[g.spoiler.center.x, g.spoiler.center.y, g.spoiler.center.z]} rotation={[0, 0, spoilerRotation]}>
        <mesh geometry={spoilerGeometry} castShadow>
          <meshPhysicalMaterial
            color="#171e22"
            metalness={0.82}
            roughness={0.16}
            clearcoat={0.8}
            clearcoatRoughness={0.14}
          />
        </mesh>
        <mesh geometry={supportGeometry} position={[g.spoiler.supports.left.halfSize.x, g.spoiler.supports.left.halfSize.y, g.spoiler.supports.left.center.z]}>
          <meshStandardMaterial color="#13191d" metalness={0.74} roughness={0.2} />
        </mesh>
        <mesh geometry={supportGeometry} position={[g.spoiler.supports.right.halfSize.x, g.spoiler.supports.right.halfSize.y, g.spoiler.supports.right.center.z]}>
          <meshStandardMaterial color="#13191d" metalness={0.74} roughness={0.2} />
        </mesh>
      </group>

      {/* Wheels */}
      {[-w.trackHalfWidth, w.trackHalfWidth].map((z) => (
        <group key={`wheel-front-${z}`} position={[w.frontAxleX, w.radius - g.groundClearance, z]}>
          <Wheel x={0} z={0} radius={w.radius} width={w.width} />
          <Hubcap x={0} z={0} radius={w.radius} />
        </group>
      ))}
      {[-w.trackHalfWidth, w.trackHalfWidth].map((z) => (
        <group key={`wheel-rear-${z}`} position={[w.rearAxleX, w.radius - g.groundClearance, z]}>
          <Wheel x={0} z={0} radius={w.radius} width={w.width} />
          <Hubcap x={0} z={0} radius={w.radius} />
        </group>
      ))}

      {/* Front splitter */}
      <mesh position={[g.noseTipX + 0.15, 0.12, 0]} rotation={[0, 0, -0.02]}>
        <boxGeometry args={[0.5, 0.05, g.width * 0.9]} />
        <meshStandardMaterial color="#14191c" metalness={0.68} roughness={0.25} />
      </mesh>

      {/* Rear diffuser */}
      <mesh position={[g.tailX - 0.15, 0.15, 0]} rotation={[0, 0, 0.08]}>
        <boxGeometry args={[0.42, 0.12, g.width * 0.8]} />
        <meshStandardMaterial color="#11171a" metalness={0.72} roughness={0.24} />
      </mesh>

      {/* Side skirts */}
      {[-g.width * 0.48, g.width * 0.48].map((z) => (
        <mesh key={`skirt-${z}`} position={[-0.2, 0.23, z]} rotation={[0, 0, 0.05]}>
          <boxGeometry args={[g.length * 0.6, 0.05, 0.06]} />
          <meshStandardMaterial color="#14191c" metalness={0.68} roughness={0.25} />
        </mesh>
      ))}

      {/* Exhaust tips */}
      <mesh position={[g.tailX, 0.26, 0.42]} rotation={[0, 0, -0.025]}>
        <cylinderGeometry args={[0.07, 0.07, 0.13, 18]} />
        <meshPhysicalMaterial color="#b92735" metalness={0.7} roughness={0.18} clearcoat={1} />
      </mesh>
      <mesh position={[g.tailX, 0.26, -0.42]} rotation={[0, 0, 0.025]}>
        <cylinderGeometry args={[0.07, 0.07, 0.13, 18]} />
        <meshPhysicalMaterial color="#b92735" metalness={0.7} roughness={0.18} clearcoat={1} />
      </mesh>

      {/* Taillights */}
      <mesh position={[g.tailX, 0.68, 0]} rotation={[0, 0, 0.08]}>
        <boxGeometry args={[0.09, 0.14, g.width * 0.7]} />
        <meshStandardMaterial color="#d43c34" emissive="#931b18" emissiveIntensity={0.75} roughness={0.2} />
      </mesh>
    </group>
  );
}