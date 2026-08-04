import { Component, Suspense, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls, PerspectiveCamera, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { RebuildParticleFlow, RebuildStreamlines } from "@/components/studio/RebuildFlow";
import { SportsCarModel } from "@/components/studio/SportsCarModel";
import type { ObjectSpec, SimulationMetrics } from "@/lib/physics/aerodynamics";
import {
  createFlowEnvelope,
  createFlowPoint,
} from "@/lib/physics/flowField";
import type { FlowMode, Overlays } from "@/lib/store";
import { CAR_GEOMETRY } from "@/lib/flow/carGeometryProfile";
import { getRebuildFlowCoordinates, sampleRebuildFlowField } from "@/lib/flow/rebuildSolver";

export type CameraPreset = "perspective" | "side";

type SceneCanvasProps = {
  object: ObjectSpec;
  metrics: SimulationMetrics;
  yawAngleDeg: number;
  spoilerAngleDeg: number;
  flowMode: FlowMode;
  overlays: Overlays;
  uploadedUrl: string | null;
  running: boolean;
  cameraPreset: CameraPreset;
  onBoundsDetected: (dimensions: { length: number; width: number; height: number }) => void;
  onModelError: (message: string) => void;
};

type ModelErrorBoundaryProps = {
  children: ReactNode;
  resetKey: string | null;
  onError: (message: string) => void;
};

type ModelErrorBoundaryState = {
  error: string | null;
};

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

class ModelErrorBoundary extends Component<ModelErrorBoundaryProps, ModelErrorBoundaryState> {
  state: ModelErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ModelErrorBoundaryState {
    return { error: error.message || "The GLB model could not be decoded." };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error.message || "The GLB model could not be decoded.");
  }

  componentDidUpdate(previousProps: ModelErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) return <ModelErrorMarker />;
    return this.props.children;
  }
}

function PrimitiveModel({ kind }: { kind: ObjectSpec["kind"] }) {
  if (kind === "sphere") {
    return (
      <mesh castShadow receiveShadow position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.72, 32, 20]} />
        <meshStandardMaterial color="#e9b35e" metalness={0.2} roughness={0.26} />
      </mesh>
    );
  }

  if (kind === "wing") {
    return (
      <group position={[0, 0.82, 0]} rotation={[0, 0, -0.04]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[2.45, 0.16, 0.8]} />
          <meshStandardMaterial color="#5fc2ba" metalness={0.38} roughness={0.22} />
        </mesh>
        <mesh position={[-0.72, 0.05, 0]} rotation={[0, 0, -0.14]}>
          <boxGeometry args={[0.9, 0.12, 0.74]} />
          <meshStandardMaterial color="#8bd7cb" metalness={0.32} roughness={0.24} />
        </mesh>
      </group>
    );
  }

  return (
    <mesh castShadow receiveShadow position={[0, 0.58, 0]}>
      <boxGeometry args={[2.2, 1.1, 1.4]} />
      <meshStandardMaterial color="#e9b35e" metalness={0.28} roughness={0.3} />
    </mesh>
  );
}

function UploadedModel({ url, onBoundsDetected }: { url: string; onBoundsDetected: SceneCanvasProps["onBoundsDetected"] }) {
  const gltf = useGLTF(url);
  const normalized = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 0.001);
    const scale = 2.8 / maxDimension;
    scene.scale.setScalar(scale);
    scene.position.set(-center.x * scale, -bounds.min.y * scale + 0.05, -center.z * scale);
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return {
      scene,
      dimensions: { length: size.x * scale, width: size.z * scale, height: size.y * scale },
    };
  }, [gltf.scene]);

  useEffect(() => {
    onBoundsDetected(normalized.dimensions);
  }, [normalized, onBoundsDetected]);

  return <primitive object={normalized.scene} />;
}

function ModelLoadingMarker() {
  return (
    <mesh position={[0, 0.7, 0]}>
      <boxGeometry args={[1.2, 1.2, 1.2]} />
      <meshBasicMaterial color="#426d70" wireframe transparent opacity={0.7} />
    </mesh>
  );
}

function ModelErrorMarker() {
  return (
    <mesh position={[0, 0.7, 0]}>
      <octahedronGeometry args={[0.65, 0]} />
      <meshBasicMaterial color="#d76f65" wireframe />
    </mesh>
  );
}

function PressureField({ object, yaw, speed, spoilerAngleDeg, intensity, enabled }: {
  object: ObjectSpec;
  yaw: number;
  speed: number;
  spoilerAngleDeg: number;
  intensity: number;
  enabled: boolean;
}) {
  const envelope = useMemo(() => createFlowEnvelope(object, yaw), [object, yaw]);
  const field = useMemo(() => {
    const flowEnvelope = createFlowEnvelope(object, yaw);
    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();
    const solverConfig = {
      object,
      yawAngleDeg: yaw,
      speedMps: speed,
      spoilerAngleDeg,
      turbulenceStrength: 1,
    };

    for (let xIndex = 0; xIndex <= 30; xIndex += 1) {
      const normalizedX = -1 + (xIndex / 30) * 2;
      const radius = Math.sqrt(Math.max(0.025, 1 - normalizedX ** 2));
      for (let ringIndex = 0; ringIndex < 24; ringIndex += 1) {
        const theta = (ringIndex / 24) * Math.PI * 2;
        const streamwise = normalizedX * flowEnvelope.halfLength;
        const lateral = Math.cos(theta) * radius * flowEnvelope.halfWidth * 1.035;
        const y = flowEnvelope.centerY + Math.sin(theta) * radius * flowEnvelope.halfHeight * 1.04;
        if (y < 0.08) continue;
        const point = createFlowPoint(streamwise, lateral, y, yaw);
        positions.push(point.x, point.y, point.z);
        const sample = sampleRebuildFlowField(point, solverConfig, 0, ringIndex * 0.3, Math.sign(y - flowEnvelope.centerY) || 1);

        if (sample.stagnationIntensity > 0.22) color.setHSL(0.035, 0.88, 0.58);
        else if (sample.wakeIntensity > 0.16) color.setHSL(0.7, 0.68, 0.64);
        else if (sample.speedRatio > 1.08) color.setHSL(0.47, 0.78, 0.57);
        else color.setHSL(0.52, 0.72, 0.62);
        colors.push(color.r, color.g, color.b);
      }
    }

    for (let index = 0; index < 260; index += 1) {
      const streamwise = flowEnvelope.halfLength + 0.12 + pseudoRandom(index + 1701) * 3.8;
      const expansion = 0.55 + (streamwise - flowEnvelope.halfLength) * 0.22;
      const lateral = (pseudoRandom(index + 1801) - 0.5) * flowEnvelope.halfWidth * 2 * expansion;
      const y = Math.max(0.08, flowEnvelope.centerY + (pseudoRandom(index + 1901) - 0.5) * flowEnvelope.halfHeight * 2 * expansion);
      const point = createFlowPoint(streamwise, lateral, y, yaw);
      positions.push(point.x, point.y, point.z);
      color.setHSL(0.71, 0.68, 0.6 - pseudoRandom(index + 2001) * 0.12);
      colors.push(color.r, color.g, color.b);
    }

    return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
  }, [object, yaw, speed, spoilerAngleDeg]);

  return (
    <group visible={enabled}>
      <group rotation={[0, -envelope.yawRadians, 0]}>
        <mesh position={[-envelope.halfLength - 0.28, envelope.centerY, 0]} scale={[0.78, 1.18, 1.05]}>
          <sphereGeometry args={[0.72, 28, 18]} />
          <meshBasicMaterial color="#ef694f" transparent opacity={0.07 + intensity * 0.09} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh position={[0, envelope.centerY + envelope.halfHeight * 0.78, 0]} scale={[2.1, 0.38, 1.05]}>
          <sphereGeometry args={[0.72, 28, 18]} />
          <meshBasicMaterial color="#55d7c4" transparent opacity={0.045 + intensity * 0.06} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh position={[envelope.halfLength + 1.35, envelope.centerY, 0]} scale={[2.5, 0.9, 1.15]}>
          <sphereGeometry args={[0.72, 28, 18]} />
          <meshBasicMaterial color="#6f62bd" transparent opacity={0.05 + intensity * 0.055} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[field.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[field.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          vertexColors
          size={0.065 + intensity * 0.065}
          transparent
          opacity={0.66 + intensity * 0.22}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

function VelocityGlyphs({ object, yaw, speed, spoilerAngleDeg, enabled }: {
  object: ObjectSpec;
  yaw: number;
  speed: number;
  spoilerAngleDeg: number;
  enabled: boolean;
}) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const envelope = createFlowEnvelope(object, yaw);
    const solverConfig = {
      object,
      yawAngleDeg: yaw,
      speedMps: speed,
      spoilerAngleDeg,
      turbulenceStrength: 1,
    };
    const color = new THREE.Color();

    for (let x = -5.8; x <= 5.8; x += 0.72) {
      for (let y = 0.28; y <= 2.9; y += 0.52) {
        for (let lateral = -2.7; lateral <= 2.7; lateral += 0.78) {
          const start = createFlowPoint(x, lateral, y, yaw);
          const local = getRebuildFlowCoordinates(start, yaw);
          const bodyX = local.streamwise / envelope.halfLength;
          const bodyRadius = Math.sqrt(Math.max(0, 1 - bodyX ** 2));
          const radial = Math.sqrt(
            (local.lateral / envelope.halfWidth) ** 2
            + ((start.y - envelope.centerY) / envelope.halfHeight) ** 2,
          );
          if (Math.abs(bodyX) < 1.02 && radial < bodyRadius + 0.13) continue;

          const sample = sampleRebuildFlowField(start, solverConfig, 0, x + y + lateral, Math.sign(y - envelope.centerY) || 1);
          const magnitude = Math.max(Math.hypot(sample.velocity.x, sample.velocity.y, sample.velocity.z), 0.04);
          const length = 0.14 + sample.speedRatio * 0.16;
          positions.push(
            start.x,
            start.y,
            start.z,
            start.x + (sample.velocity.x / magnitude) * length,
            start.y + (sample.velocity.y / magnitude) * length,
            start.z + (sample.velocity.z / magnitude) * length,
          );

          if (sample.stagnationIntensity > 0.3) color.set("#f0ad52");
          else if (sample.wakeIntensity > 0.2) color.set("#8873d8");
          else if (sample.speedRatio > 1.08) color.set("#61e8c9");
          else color.set("#75a5ae");
          colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
        }
      }
    }

    return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
  }, [object, yaw, speed, spoilerAngleDeg]);

  return (
    <lineSegments visible={enabled}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[geometry.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[geometry.colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.72} depthWrite={false} />
    </lineSegments>
  );
}

function WindVector({ enabled, yaw }: { enabled: boolean; yaw: number }) {
  const arrow = useMemo(() => {
    const angle = (yaw * Math.PI) / 180;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    return new THREE.ArrowHelper(direction, new THREE.Vector3(-4.8, 2.8, 2.7), 1.2, "#e6b45f", 0.16, 0.11);
  }, [yaw]);

  useEffect(() => () => {
    arrow.line.geometry.dispose();
    (arrow.line.material as THREE.Material).dispose();
    arrow.cone.geometry.dispose();
    (arrow.cone.material as THREE.Material).dispose();
  }, [arrow]);

  return <primitive visible={enabled} object={arrow} />;
}

function TunnelShell() {
  return (
    <group>
      <gridHelper args={[18, 18, "#29383e", "#17242b"]} position={[0, 0, 0]} />
      <gridHelper
        args={[18, 18, "#243339", "#152027"]}
        position={[0, 4.5, -3.4]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[1, 0.38, 1]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]} receiveShadow>
        <planeGeometry args={[18, 12]} />
        <meshStandardMaterial color="#10181d" roughness={0.94} metalness={0.08} />
      </mesh>
    </group>
  );
}

function DebugCollisionEnvelope({ spoilerAngleDeg, enabled }: { spoilerAngleDeg: number; enabled: boolean }) {
  if (!enabled) return null;
  const g = CAR_GEOMETRY;

  return (
    <group>
      {/* Shared lower chassis envelope. This should contain the visible shell. */}
      <mesh position={[g.chassis.center.x, g.chassis.center.y, g.chassis.center.z]} scale={[g.chassis.halfSize.x * 2, g.chassis.halfSize.y * 2, g.chassis.halfSize.z * 2]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ff8f68" transparent opacity={0.18} wireframe />
      </mesh>

      {/* Nose ellipsoid */}
      <mesh position={[g.nose.center.x, g.nose.center.y, g.nose.center.z]} scale={[g.nose.radii.x * 2, g.nose.radii.y * 2, g.nose.radii.z * 2]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color="#74d4bd" transparent opacity={0.15} wireframe />
      </mesh>

      {/* Cabin ellipsoid */}
      <mesh position={[g.cabin.center.x, g.cabin.center.y, g.cabin.center.z]} scale={[g.cabin.radii.x * 2, g.cabin.radii.y * 2, g.cabin.radii.z * 2]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color="#dcae61" transparent opacity={0.15} wireframe />
      </mesh>

      {/* Spoiler */}
      <group position={[g.spoiler.center.x, g.spoiler.center.y, g.spoiler.center.z]} rotation={[0, 0, -spoilerAngleDeg * Math.PI / 180]}>
        <mesh scale={[g.spoiler.halfSize.x * 2, g.spoiler.halfSize.y * 2, g.spoiler.halfSize.z * 2]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#e6b45f" transparent opacity={0.2} wireframe />
        </mesh>
        <mesh position={[
          g.spoiler.supports.left.center.x - g.spoiler.center.x,
          g.spoiler.supports.left.center.y - g.spoiler.center.y,
          g.spoiler.supports.left.center.z - g.spoiler.center.z
        ]} scale={[g.spoiler.supports.left.halfSize.x * 2, g.spoiler.supports.left.halfSize.y * 2, g.spoiler.supports.left.halfSize.z * 2]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#e6b45f" transparent opacity={0.2} wireframe />
        </mesh>
        <mesh position={[
          g.spoiler.supports.right.center.x - g.spoiler.center.x,
          g.spoiler.supports.right.center.y - g.spoiler.center.y,
          g.spoiler.supports.right.center.z - g.spoiler.center.z
        ]} scale={[g.spoiler.supports.right.halfSize.x * 2, g.spoiler.supports.right.halfSize.y * 2, g.spoiler.supports.right.halfSize.z * 2]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#e6b45f" transparent opacity={0.2} wireframe />
        </mesh>
      </group>

      {/* Wheels as wireframe cylinders */}
      <group position={[g.wheels.frontAxleX, g.wheels.centerY, g.wheels.trackHalfWidth]}>
        <mesh scale={[g.wheels.radius * 2, g.wheels.width, g.wheels.radius * 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1, 1, 1, 16, 1]} />
          <meshBasicMaterial color="#74d4bd" transparent opacity={0.12} wireframe />
        </mesh>
      </group>
      <group position={[g.wheels.frontAxleX, g.wheels.centerY, -g.wheels.trackHalfWidth]}>
        <mesh scale={[g.wheels.radius * 2, g.wheels.width, g.wheels.radius * 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1, 1, 1, 16, 1]} />
          <meshBasicMaterial color="#74d4bd" transparent opacity={0.12} wireframe />
        </mesh>
      </group>
      <group position={[g.wheels.rearAxleX, g.wheels.centerY, g.wheels.trackHalfWidth]}>
        <mesh scale={[g.wheels.radius * 2, g.wheels.width, g.wheels.radius * 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1, 1, 1, 16, 1]} />
          <meshBasicMaterial color="#74d4bd" transparent opacity={0.12} wireframe />
        </mesh>
      </group>
      <group position={[g.wheels.rearAxleX, g.wheels.centerY, -g.wheels.trackHalfWidth]}>
        <mesh scale={[g.wheels.radius * 2, g.wheels.width, g.wheels.radius * 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1, 1, 1, 16, 1]} />
          <meshBasicMaterial color="#74d4bd" transparent opacity={0.12} wireframe />
        </mesh>
      </group>
    </group>
  );
}

function SceneContent({
  object,
  metrics,
  yawAngleDeg,
  spoilerAngleDeg,
  flowMode,
  overlays,
  uploadedUrl,
  running,
  onBoundsDetected,
  onModelError,
}: SceneCanvasProps) {
  const intensity = Math.min(metrics.dynamicPressurePa / 3200, 1);
  const flowObject = useMemo(() => ({
    ...object,
    dragCoefficient: metrics.effectiveDragCoefficient,
    liftCoefficient: metrics.effectiveLiftCoefficient,
  }), [metrics.effectiveDragCoefficient, metrics.effectiveLiftCoefficient, object]);
  return (
    <>
      <color attach="background" args={["#0d1115"]} />
      <fog attach="fog" args={["#0d1115", 10, 21]} />
      <ambientLight intensity={1.42} color="#c1e0d9" />
      <directionalLight position={[3, 6, 4]} intensity={2.4} color="#ffe3bd" castShadow />
      <directionalLight position={[-4, 3, -3]} intensity={1.4} color="#75aeb9" />
      <TunnelShell />
      {flowMode === "streamlines" && (
        <RebuildStreamlines
          object={flowObject}
          yaw={yawAngleDeg}
          speed={metrics.effectiveWindSpeedMps}
          spoilerAngleDeg={spoilerAngleDeg}
          enabled
          running={running}
          turbulenceStrength={overlays.wake ? 1 : 0.35}
        />
      )}
      {flowMode === "particles" && (
        <RebuildParticleFlow
          object={flowObject}
          yaw={yawAngleDeg}
          speed={metrics.effectiveWindSpeedMps}
          spoilerAngleDeg={spoilerAngleDeg}
          enabled
          running={running}
          turbulenceStrength={overlays.wake ? 1 : 0.35}
        />
      )}
      {flowMode === "pressure" && (
        <PressureField
          object={flowObject}
          yaw={yawAngleDeg}
          speed={metrics.effectiveWindSpeedMps}
          spoilerAngleDeg={spoilerAngleDeg}
          intensity={intensity}
          enabled
        />
      )}
      {flowMode === "velocity" && (
        <VelocityGlyphs
          object={flowObject}
          yaw={yawAngleDeg}
          speed={metrics.effectiveWindSpeedMps}
          spoilerAngleDeg={spoilerAngleDeg}
          enabled
        />
      )}
      <WindVector enabled yaw={yawAngleDeg} />
      <ModelErrorBoundary resetKey={uploadedUrl} onError={onModelError}>
        <Suspense fallback={<ModelLoadingMarker />}>
          {uploadedUrl && object.kind === "glb" ? (
            <UploadedModel url={uploadedUrl} onBoundsDetected={onBoundsDetected} />
          ) : object.kind === "car" ? (
            <SportsCarModel spoilerAngleDeg={spoilerAngleDeg} />
          ) : (
            <PrimitiveModel kind={object.kind} />
          )}
        </Suspense>
      </ModelErrorBoundary>
      <DebugCollisionEnvelope spoilerAngleDeg={spoilerAngleDeg} enabled={flowMode === "pressure"} />
      <ContactShadows position={[0, 0.02, 0]} opacity={0.42} scale={8} blur={2.8} far={5} frames={1} />
      <OrbitControls makeDefault enablePan={false} minDistance={4.8} maxDistance={12} target={[0, 0.8, 0]} />
    </>
  );
}

export function SceneCanvas(props: SceneCanvasProps) {
  const cameraPosition: [number, number, number] = props.cameraPreset === "side"
    ? [0, 2.15, 8.6]
    : [7.2, 4.2, 6.7];

  return (
    <Canvas className="scene-canvas" shadows="basic" dpr={[1, 1.45]} gl={{ antialias: true, powerPreference: "high-performance" }}>
      <PerspectiveCamera key={props.cameraPreset} makeDefault position={cameraPosition} fov={props.cameraPreset === "side" ? 35 : 38} />
      <SceneContent {...props} />
    </Canvas>
  );
}
