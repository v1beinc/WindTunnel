"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { CAR_GEOMETRY } from "@/lib/flow/carGeometryProfile";

type SportsCarModelProps = {
  spoilerAngleDeg: number;
};

function Tire({ radius, width }: { radius: number; width: number }) {
  return (
    <mesh castShadow receiveShadow>
      <cylinderGeometry args={[radius, radius, width, 32, 1]} />
      <meshStandardMaterial color="#0a0d0f" roughness={0.85} metalness={0.02} />
    </mesh>
  );
}

function Rim({ radius, width }: { radius: number; width: number }) {
  const innerRadius = radius * 0.55;
  return (
    <group>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[innerRadius, innerRadius, width + 0.01, 24, 1]} />
        <meshStandardMaterial color="#2a3439" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, width * 0.52]}>
        <cylinderGeometry args={[innerRadius * 0.65, innerRadius * 0.65, 0.03, 24]} />
        <meshStandardMaterial color="#3a454a" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, -width * 0.52]}>
        <cylinderGeometry args={[innerRadius * 0.65, innerRadius * 0.65, 0.03, 24]} />
        <meshStandardMaterial color="#3a454a" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[innerRadius * 0.22, innerRadius * 0.22, width + 0.02, 12]} />
        <meshStandardMaterial color="#1a2023" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function WheelAssembly({ radius, width }: { radius: number; width: number }) {
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <Tire radius={radius} width={width} />
      <Rim radius={radius} width={width} />
    </group>
  );
}

export function SportsCarModel({ spoilerAngleDeg }: SportsCarModelProps) {
  const spoilerRotation = -(spoilerAngleDeg * Math.PI) / 180;
  const g = CAR_GEOMETRY;
  const w = g.wheels;

  const bodyMaterial = useMemo(
    () => new THREE.MeshPhysicalMaterial({
      color: "#b81d35",
      metalness: 0.35,
      roughness: 0.45,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
    }),
    []
  );

  const glassMaterial = useMemo(
    () => new THREE.MeshPhysicalMaterial({
      color: "#08181f",
      metalness: 0.2,
      roughness: 0.1,
      transmission: 0.85,
      thickness: 0.01,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    }),
    []
  );

  const spoilerMaterial = useMemo(
    () => new THREE.MeshPhysicalMaterial({
      color: "#141a1e",
      metalness: 0.75,
      roughness: 0.2,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    }),
    []
  );

  const supportMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: "#101518",
      metalness: 0.7,
      roughness: 0.25,
    }),
    []
  );

  const lightMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: "#fff0c7",
      emissive: "#ffb766",
      emissiveIntensity: 0.6,
      roughness: 0.2,
    }),
    []
  );

  const taillightMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: "#d43c34",
      emissive: "#931b18",
      emissiveIntensity: 0.7,
      roughness: 0.25,
    }),
    []
  );

  const darkTrimMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: "#101518",
      metalness: 0.65,
      roughness: 0.3,
    }),
    []
  );

  const exhaustMaterial = useMemo(
    () => new THREE.MeshPhysicalMaterial({
      color: "#b81d35",
      metalness: 0.8,
      roughness: 0.15,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    }),
    []
  );

  const bodyGroup = useMemo(() => {
    const group = new THREE.Group();

    const mainBody = new THREE.BoxGeometry(g.chassis.halfSize.x * 2, g.chassis.halfSize.y * 2, g.chassis.halfSize.z * 2);
    const mainMesh = new THREE.Mesh(mainBody, bodyMaterial);
    mainMesh.position.set(g.chassis.center.x, g.chassis.center.y, g.chassis.center.z);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    group.add(mainMesh);

    const noseShape = new THREE.Shape();
    noseShape.moveTo(0, -g.nose.radii.y);
    noseShape.quadraticCurveTo(g.nose.radii.x * 0.5, -g.nose.radii.y, g.nose.radii.x, 0);
    noseShape.quadraticCurveTo(g.nose.radii.x * 0.5, g.nose.radii.y, 0, g.nose.radii.y);
    noseShape.quadraticCurveTo(-g.nose.radii.x * 0.5, g.nose.radii.y, -g.nose.radii.x, 0);
    noseShape.quadraticCurveTo(-g.nose.radii.x * 0.5, -g.nose.radii.y, 0, -g.nose.radii.y);
    const noseGeo = new THREE.ExtrudeGeometry(noseShape, {
      depth: g.nose.radii.z * 2,
      bevelEnabled: false,
    });
    noseGeo.translate(0, 0, -g.nose.radii.z);
    const noseMesh = new THREE.Mesh(noseGeo, bodyMaterial);
    noseMesh.position.set(g.nose.center.x, g.nose.center.y, g.nose.center.z);
    noseMesh.castShadow = true;
    noseMesh.receiveShadow = true;
    group.add(noseMesh);

    const cabinShape = new THREE.Shape();
    const cabinW = g.cabin.radii.z * 2;
    const cabinH = g.cabin.radii.y * 2;
    cabinShape.moveTo(-g.cabin.radii.x * 0.8, -cabinH * 0.5);
    cabinShape.lineTo(g.cabin.radii.x * 0.6, -cabinH * 0.5);
    cabinShape.lineTo(g.cabin.radii.x * 0.9, cabinH * 0.5);
    cabinShape.lineTo(-g.cabin.radii.x * 0.5, cabinH * 0.5);
    const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, {
      depth: cabinW,
      bevelEnabled: false,
    });
    cabinGeo.translate(0, 0, -cabinW * 0.5);
    const cabinMesh = new THREE.Mesh(cabinGeo, glassMaterial);
    cabinMesh.position.set(g.cabin.center.x, g.cabin.center.y, g.cabin.center.z);
    group.add(cabinMesh);

    const rearDeckGeo = new THREE.BoxGeometry(
      g.tailX - g.cabin.center.x - g.cabin.radii.x,
      g.chassis.halfSize.y * 0.6,
      g.chassis.halfSize.z * 1.8
    );
    const rearDeckMesh = new THREE.Mesh(rearDeckGeo, bodyMaterial);
    rearDeckMesh.position.set(
      g.cabin.center.x + g.cabin.radii.x + (g.tailX - g.cabin.center.x - g.cabin.radii.x) * 0.5,
      g.chassis.center.y + g.chassis.halfSize.y + g.chassis.halfSize.y * 0.3,
      0
    );
    rearDeckMesh.castShadow = true;
    rearDeckMesh.receiveShadow = true;
    group.add(rearDeckMesh);

    return group;
  }, [bodyMaterial, glassMaterial]); // eslint-disable-line react-hooks/exhaustive-deps

  const spoilerGroup = useMemo(() => {
    const group = new THREE.Group();

    const wingGeo = new THREE.BoxGeometry(
      g.spoiler.halfSize.x * 2,
      g.spoiler.halfSize.y * 2,
      g.spoiler.halfSize.z * 2
    );
    const wingMesh = new THREE.Mesh(wingGeo, spoilerMaterial);
    wingMesh.castShadow = true;
    group.add(wingMesh);

    const supportGeo = new THREE.BoxGeometry(
      g.spoiler.supports.left.halfSize.x * 2,
      g.spoiler.supports.left.halfSize.y * 2,
      g.spoiler.supports.left.halfSize.z * 2
    );
    const leftSupport = new THREE.Mesh(supportGeo, supportMaterial);
    leftSupport.position.set(
      g.spoiler.supports.left.center.x - g.spoiler.center.x,
      g.spoiler.supports.left.center.y - g.spoiler.center.y,
      g.spoiler.supports.left.center.z - g.spoiler.center.z
    );
    leftSupport.castShadow = true;
    group.add(leftSupport);

    const rightSupport = new THREE.Mesh(supportGeo, supportMaterial);
    rightSupport.position.set(
      g.spoiler.supports.right.center.x - g.spoiler.center.x,
      g.spoiler.supports.right.center.y - g.spoiler.center.y,
      g.spoiler.supports.right.center.z - g.spoiler.center.z
    );
    rightSupport.castShadow = true;
    group.add(rightSupport);

    return group;
  }, [spoilerMaterial, supportMaterial]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group position={[0, 0.02, 0]}>
      <primitive object={bodyGroup} />

      <group position={[g.spoiler.center.x, g.spoiler.center.y, g.spoiler.center.z]} rotation={[0, 0, spoilerRotation]}>
        <primitive object={spoilerGroup} />
      </group>

      <mesh geometry={new THREE.BoxGeometry(0.12, 0.05, 0.18)} material={lightMaterial} position={[-2.35, 0.42, 0.65]} rotation={[0, 0, -0.1]} />
      <mesh geometry={new THREE.BoxGeometry(0.12, 0.05, 0.18)} material={lightMaterial} position={[-2.35, 0.42, -0.65]} rotation={[0, 0, 0.1]} />

      <mesh geometry={new THREE.BoxGeometry(0.08, 0.12, g.width * 0.7)} material={taillightMaterial} position={[g.tailX, 0.65, 0]} rotation={[0, 0, 0.08]} />

      <mesh geometry={new THREE.BoxGeometry(0.45, 0.04, g.width * 0.9)} material={darkTrimMaterial} position={[g.noseTipX + 0.15, 0.1, 0]} rotation={[0, 0, -0.02]} />
      <mesh geometry={new THREE.BoxGeometry(0.4, 0.1, g.width * 0.75)} material={darkTrimMaterial} position={[g.tailX - 0.15, 0.14, 0]} rotation={[0, 0, 0.08]} />
      <mesh geometry={new THREE.BoxGeometry(g.length * 0.55, 0.04, 0.05)} material={darkTrimMaterial} position={[-0.3, 0.22, g.width * 0.48]} rotation={[0, 0, 0.05]} />
      <mesh geometry={new THREE.BoxGeometry(g.length * 0.55, 0.04, 0.05)} material={darkTrimMaterial} position={[-0.3, 0.22, -g.width * 0.48]} rotation={[0, 0, -0.05]} />

      <mesh geometry={new THREE.CylinderGeometry(0.06, 0.06, 0.12, 16)} material={exhaustMaterial} position={[g.tailX, 0.24, 0.4]} rotation={[0, 0, -0.02]} />
      <mesh geometry={new THREE.CylinderGeometry(0.06, 0.06, 0.12, 16)} material={exhaustMaterial} position={[g.tailX, 0.24, -0.4]} rotation={[0, 0, 0.02]} />

      {[-w.trackHalfWidth, w.trackHalfWidth].map((z) => (
        <group key={`wheel-front-${z}`} position={[w.frontAxleX, w.centerY, z]}>
          <WheelAssembly radius={w.radius} width={w.width} />
        </group>
      ))}
      {[-w.trackHalfWidth, w.trackHalfWidth].map((z) => (
        <group key={`wheel-rear-${z}`} position={[w.rearAxleX, w.centerY, z]}>
          <WheelAssembly radius={w.radius} width={w.width} />
        </group>
      ))}
    </group>
  );
}