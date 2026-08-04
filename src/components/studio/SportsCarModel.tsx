"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { CAR_GEOMETRY } from "@/lib/flow/carGeometryProfile";

type SportsCarModelProps = {
  spoilerAngleDeg: number;
};

function Wheel({ radius, width }: { radius: number; width: number }) {
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, width, 32, 1]} />
        <meshStandardMaterial color="#0a0d0f" roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh position={[0, width * 0.52, 0]}>
        <cylinderGeometry args={[radius * 0.6, radius * 0.6, 0.04, 32]} />
        <meshStandardMaterial color="#2a3439" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, -width * 0.52, 0]}>
        <cylinderGeometry args={[radius * 0.6, radius * 0.6, 0.04, 32]} />
        <meshStandardMaterial color="#2a3439" metalness={0.85} roughness={0.2} />
      </mesh>
    </group>
  );
}

function Hubcap({ radius, offsetZ }: { radius: number; offsetZ: number }) {
  return (
    <group position={[0, 0, offsetZ]} rotation={[Math.PI / 2, 0, 0]}>
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

function WheelFace({ radius, hubRadius, offsetZ }: { radius: number; hubRadius: number; offsetZ: number }) {
  return (
    <group position={[0, 0, offsetZ]}>
      <mesh renderOrder={4}>
        <circleGeometry args={[radius, 32]} />
        <meshBasicMaterial color="#050708" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.006]} renderOrder={5}>
        <circleGeometry args={[hubRadius, 24]} />
        <meshBasicMaterial color="#607176" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.012]} renderOrder={6}>
        <circleGeometry args={[hubRadius * 0.22, 20]} />
        <meshBasicMaterial color="#11181d" side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function SportsCarModel({ spoilerAngleDeg }: SportsCarModelProps) {
  const spoilerRotation = -(spoilerAngleDeg * Math.PI) / 180;
  const g = CAR_GEOMETRY;
  const w = g.wheels;
  const shellHalfWidth = g.width * 0.48;

  // One beveled side-profile extrusion keeps the body visually continuous.
  // The same lower envelope is represented by CAR_GEOMETRY.chassis in the SDF.
  const shellGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-2.48, 0.16);
    shape.lineTo(-2.38, 0.31);
    shape.lineTo(-1.82, 0.55);
    shape.lineTo(-0.96, 0.63);
    shape.lineTo(-0.44, 0.76);
    shape.lineTo(-0.05, 1.10);
    shape.lineTo(0.40, 1.17);
    shape.lineTo(0.82, 1.08);
    shape.lineTo(1.12, 0.90);
    shape.lineTo(1.42, 0.71);
    shape.lineTo(1.86, 0.56);
    shape.lineTo(1.88, 0.20);
    shape.lineTo(-2.48, 0.16);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: shellHalfWidth * 2,
      bevelEnabled: true,
      bevelThickness: 0.055,
      bevelSize: 0.045,
      bevelSegments: 2,
      curveSegments: 3,
      steps: 1,
    });
    geo.translate(0, 0, -shellHalfWidth);
    geo.computeVertexNormals();
    return geo;
  }, [shellHalfWidth]);

  const windowGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.72, 0.80);
    shape.lineTo(-0.25, 1.08);
    shape.lineTo(0.36, 1.13);
    shape.lineTo(0.88, 1.03);
    shape.lineTo(1.02, 0.88);
    shape.lineTo(0.96, 0.80);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);

  // A thin airfoil section makes the rear wing read as an actual adjustable
  // surface. Its complete envelope stays inside CAR_GEOMETRY.spoiler, so the
  // visual pivot and the solver's collision profile remain the same object.
  const spoilerGeometry = useMemo(() => {
    const section = new THREE.Shape();
    section.moveTo(-g.spoiler.halfSize.x, -g.spoiler.halfSize.y * 0.35);
    section.lineTo(g.spoiler.halfSize.x * 0.72, -g.spoiler.halfSize.y);
    section.lineTo(g.spoiler.halfSize.x, 0);
    section.lineTo(g.spoiler.halfSize.x * 0.72, g.spoiler.halfSize.y);
    section.lineTo(-g.spoiler.halfSize.x, g.spoiler.halfSize.y * 0.35);
    section.closePath();
    const geo = new THREE.ExtrudeGeometry(section, {
      depth: g.spoiler.halfSize.z * 2,
      bevelEnabled: false,
      curveSegments: 2,
      steps: 1,
    });
    geo.translate(0, 0, -g.spoiler.halfSize.z);
    geo.computeVertexNormals();
    return geo;
  }, [g.spoiler.halfSize.x, g.spoiler.halfSize.y, g.spoiler.halfSize.z]);

  // Spoiler supports - positioned relative to spoiler center
  const supportGeometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(
      g.spoiler.supports.left.halfSize.x * 2,
      g.spoiler.supports.left.halfSize.y * 2,
      g.spoiler.supports.left.halfSize.z * 2
    );
    return geo;
  }, [g.spoiler.supports.left.halfSize.x, g.spoiler.supports.left.halfSize.y, g.spoiler.supports.left.halfSize.z]);

  return (
    <group position={[0, 0.015, 0]}>
      {/* Unified low-poly body shell */}
      <mesh geometry={shellGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#c91f3b"
          emissive="#180207"
          emissiveIntensity={0.12}
          metalness={0.46}
          roughness={0.30}
          clearcoat={0.72}
          clearcoatRoughness={0.18}
        />
      </mesh>

      {/* Side glass is placed on the actual shell side, not on the old cabin ellipsoid. */}
      {[-1, 1].map((side) => (
        <mesh key={`window-${side}`} geometry={windowGeometry} position={[0, 0, side * (shellHalfWidth + 0.008)]}>
          <meshPhysicalMaterial color="#07151b" metalness={0.36} roughness={0.18} clearcoat={0.8} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Thin B-pillar keeps the cabin readable at the side camera preset. */}
      {[-1, 1].map((side) => (
        <mesh key={`pillar-${side}`} position={[0.17, 0.97, side * (shellHalfWidth + 0.014)]} rotation={[0, 0, -0.04]}>
          <boxGeometry args={[0.045, 0.31, 0.025]} />
          <meshStandardMaterial color="#11181d" metalness={0.4} roughness={0.22} />
        </mesh>
      ))}

      {/* Flush headlamps sit on the nose profile instead of floating in front of it. */}
      {[-0.58, 0.58].map((z) => (
        <mesh key={`headlamp-${z}`} position={[-2.30, 0.39, z]} rotation={[0, 0, -0.12]}>
          <boxGeometry args={[0.14, 0.055, 0.20]} />
          <meshStandardMaterial color="#fff0c7" emissive="#ffb766" emissiveIntensity={0.7} roughness={0.18} />
        </mesh>
      ))}

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
        {/* Supports positioned relative to spoiler center */}
        <mesh geometry={supportGeometry} position={[
          g.spoiler.supports.left.center.x - g.spoiler.center.x,
          g.spoiler.supports.left.center.y - g.spoiler.center.y,
          g.spoiler.supports.left.center.z - g.spoiler.center.z
        ]}>
          <meshStandardMaterial color="#13191d" metalness={0.74} roughness={0.2} />
        </mesh>
        <mesh geometry={supportGeometry} position={[
          g.spoiler.supports.right.center.x - g.spoiler.center.x,
          g.spoiler.supports.right.center.y - g.spoiler.center.y,
          g.spoiler.supports.right.center.z - g.spoiler.center.z
        ]}>
          <meshStandardMaterial color="#13191d" metalness={0.74} roughness={0.2} />
        </mesh>
      </group>

      {/* Wheels - parent group handles vertical position, Wheel/Hubcap use local coords */}
      {[-w.trackHalfWidth, w.trackHalfWidth].map((z) => (
        <group key={`wheel-front-${z}`} position={[w.frontAxleX, w.centerY, z]}>
          <Wheel radius={w.radius} width={w.width} />
          <Hubcap radius={w.radius} offsetZ={w.width * 0.58} />
          <Hubcap radius={w.radius} offsetZ={-w.width * 0.58} />
          {z > 0 && <WheelFace radius={w.radius} hubRadius={w.hubRadius} offsetZ={w.width * 0.7} />}
        </group>
      ))}
      {[-w.trackHalfWidth, w.trackHalfWidth].map((z) => (
        <group key={`wheel-rear-${z}`} position={[w.rearAxleX, w.centerY, z]}>
          <Wheel radius={w.radius} width={w.width} />
          <Hubcap radius={w.radius} offsetZ={w.width * 0.58} />
          <Hubcap radius={w.radius} offsetZ={-w.width * 0.58} />
          {z > 0 && <WheelFace radius={w.radius} hubRadius={w.hubRadius} offsetZ={w.width * 0.7} />}
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
