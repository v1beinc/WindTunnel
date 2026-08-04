"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  Activity,
  Box,
  CircleHelp,
  Eye,
  Gauge,
  Grid3X3,
  Layers3,
  Move3d,
  Pause,
  Play,
  RotateCcw,
  Save,
  Upload,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { calculateMetrics, simulationConfigSchema, type ObjectSpec } from "@/lib/physics/aerodynamics";
import { MODEL_CATALOG } from "@/lib/models";
import {
  DEFAULT_OVERLAYS,
  flowModeSchema,
  overlaysSchema,
  useWindTunnelStore,
  type FlowMode,
  type Overlays,
} from "@/lib/store";

const SceneCanvas = dynamic(
  () => import("@/components/studio/SceneCanvas").then((module) => module.SceneCanvas),
  { ssr: false },
);
const STORAGE_KEY = "windtunnel.session.v3";
const LEGACY_STORAGE_KEY_V2 = "windtunnel.session.v2";
const LEGACY_STORAGE_KEY_V1 = "windtunnel.session.v1";
const MAX_MODEL_SIZE = 25 * 1024 * 1024;

const persistedSessionSchema = z.object({
  version: z.literal(3),
  config: simulationConfigSchema,
  overlays: overlaysSchema,
  flowMode: flowModeSchema,
});

const legacyV2SessionSchema = z.object({
  version: z.literal(2),
  config: simulationConfigSchema,
  overlays: overlaysSchema,
});

const FLOW_MODE_LABELS: Record<FlowMode, string> = {
  particles: "particle tracers",
  streamlines: "smoke streamlines",
  pressure: "surface pressure",
  velocity: "velocity vectors",
};

function formatMetric(value: number, digits = 0) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
}

function formatSigned(value: number, digits = 1) {
  const formatted = value.toFixed(digits);
  return value > 0 ? `+${formatted}` : formatted;
}

function MetricCard({ label, value, unit, note, primary = false }: { label: string; value: string; unit: string; note: string; primary?: boolean }) {
  return (
    <div className={`metric-card${primary ? " primary" : ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">
        {value}<span className="metric-unit">{unit}</span>
      </div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

function Toggle({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`toggle-button${active ? " is-active" : ""}`} onClick={onClick} type="button" aria-pressed={active}>
      <Icon size={13} strokeWidth={1.8} />
      <span className="toggle-indicator" />
      {label}
    </button>
  );
}

function readPersistedSession() {
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current) {
      const parsed = persistedSessionSchema.parse(JSON.parse(current));
      if (parsed.config.object.kind === "glb") return null;
      return { config: parsed.config, overlays: parsed.overlays, flowMode: parsed.flowMode };
    }

    const legacyV2 = window.localStorage.getItem(LEGACY_STORAGE_KEY_V2);
    if (legacyV2) {
      const parsed = legacyV2SessionSchema.parse(JSON.parse(legacyV2));
      if (parsed.config.object.kind === "glb") return null;
      return { config: parsed.config, overlays: parsed.overlays, flowMode: "particles" as const };
    }

    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY_V1);
    if (!legacy) return null;
    const parsed = JSON.parse(legacy) as { config: unknown; overlays?: Partial<Overlays> };
    const config = simulationConfigSchema.parse(parsed.config);
    if (config.object.kind === "glb") return null;
    const overlays = overlaysSchema.parse({ ...DEFAULT_OVERLAYS, ...parsed.overlays });
    return { config, overlays, flowMode: "particles" as const };
  } catch {
    return null;
  }
}

export function StudioShell() {
  const {
    config,
    overlays,
    flowMode,
    snapshot,
    hydrated,
    setHydrated,
    setWindSpeed,
    setYawAngle,
    setAirDensity,
    setSpoilerAngle,
    setObject,
    setObjectDimensions,
    setOverlay,
    setFlowMode,
    setSnapshot,
    reset,
    restore,
  } = useWindTunnelStore();
  const metrics = useMemo(() => calculateMetrics(config), [config]);
  const [unit, setUnit] = useState<"metric" | "imperial">("metric");
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [running, setRunning] = useState(true);
  const [cameraPreset, setCameraPreset] = useState<"perspective" | "side">("side");
  const [showHelp, setShowHelp] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const persisted = readPersistedSession();
    if (persisted) restore(persisted.config, persisted.overlays, persisted.flowMode);
    setHydrated(true);
  }, [restore, setHydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, config, overlays, flowMode }));
  }, [config, flowMode, hydrated, overlays]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const updateObject = useCallback((next: ObjectSpec) => {
    setObject(next);
    if (next.kind !== "glb") {
      setUploadedName(null);
      setUploadError(null);
      setUploadedUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        objectUrlRef.current = null;
        return null;
      });
    }
  }, [setObject]);

  const handleUpload = (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    if (!file.name.toLowerCase().endsWith(".glb")) {
      setUploadError("Поддерживается только бинарный формат .glb.");
      return;
    }
    if (file.size > MAX_MODEL_SIZE) {
      setUploadError("Файл должен быть меньше 25 MB.");
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setUploadedUrl(url);
    setUploadedName(file.name);
    setObject({
      ...config.object,
      id: "local-glb",
      name: file.name.replace(/\.glb$/i, ""),
      kind: "glb",
    });
  };

  const handleBoundsDetected = useCallback((dimensions: { length: number; width: number; height: number }) => {
    setObjectDimensions(dimensions);
  }, [setObjectDimensions]);

  const handleModelError = useCallback((message: string) => {
    setUploadError(`Не удалось прочитать GLB: ${message}`);
  }, []);

  const displaySpeed = unit === "metric" ? config.windSpeedMps * 3.6 : config.windSpeedMps * 2.23694;
  const speedUnit = unit === "metric" ? "km/h" : "mph";
  const windSpeedLabel = `${formatMetric(displaySpeed, 1)} ${speedUnit}`;
  const flowRegime = metrics.reynoldsNumber >= 4_000 ? "turbulent" : metrics.reynoldsNumber >= 2_000 ? "transition" : "laminar";

  return (
    <main className="studio-shell">
      <div className="studio-window">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true"><Wind size={17} /></div>
            <div>
              <div className="brand-name">WINDTUNNEL</div>
              <div className="brand-subtitle">aerodynamic lab / v1.3</div>
            </div>
          </div>
          <div className="topbar-center"><span className={`live-dot${running ? "" : " is-paused"}`} /> {running ? "live 2.5D reduced-order flow" : "simulation paused"}</div>
          <div className="topbar-actions">
            <span className="status-chip"><span className="live-dot" /> guest session</span>
            <button className="subtle-button" type="button" onClick={() => setUnit(unit === "metric" ? "imperial" : "metric")}>
              {unit === "metric" ? "SI" : "IMPERIAL"}
            </button>
            <button className="icon-button" type="button" aria-label="Help" title="About WindTunnel" aria-expanded={showHelp} onClick={() => setShowHelp((visible) => !visible)}><CircleHelp size={15} /></button>
            {showHelp && (
              <div className="help-popover" role="dialog" aria-label="About the flow model">
                <strong>Interactive reduced-order wind tunnel</strong>
                <span>Particles and streamlines use one inlet-seeded 2.5D reduced-order field with bounded RK2 advection. It is an educational visualization, not engineering CFD.</span>
              </div>
            )}
          </div>
        </header>

        <div className="studio-grid">
          <aside className="panel left-panel">
            <div className="panel-scroll">
              <div className="section-heading"><div className="section-title">Object setup</div><Box size={15} color="#6f9f9b" /></div>
              <p className="section-copy">Choose a reference object or load your own model for a quick aerodynamic read.</p>

              <div className="control-group">
                <div className="control-label-row"><span className="control-label">Object template</span><span className="control-value">{config.object.kind.toUpperCase()}</span></div>
                <select className="select-input" value={config.object.id === "local-glb" ? "local-glb" : config.object.id} onChange={(event) => {
                  const next = MODEL_CATALOG.find((item) => item.id === event.target.value);
                  if (next) updateObject(next);
                }}>
                  {MODEL_CATALOG.map((model) => <option value={model.id} key={model.id}>{model.name}</option>)}
                  {config.object.id === "local-glb" && <option value="local-glb">{config.object.name}</option>}
                </select>
              </div>

              <label className="dropzone">
                <input type="file" accept=".glb,model/gltf-binary" onChange={(event) => handleUpload(event.target.files?.[0])} />
                <span className="dropzone-copy"><strong><Upload className="dropzone-icon" size={14} />{uploadedName ?? "Load a .glb model"}</strong>local browser preview / max 25 MB</span>
              </label>
              {uploadError && <div className="error-message" role="alert">{uploadError}</div>}

              <div className="control-group control-group-spaced">
                <div className="control-label-row"><span className="control-label">Wind speed</span><span className="control-value">{windSpeedLabel}</span></div>
                <input className="range-input" type="range" min="0" max="75" step="0.1" value={config.windSpeedMps} onChange={(event) => setWindSpeed(Number(event.target.value))} aria-label="Wind speed" />
              </div>

              <div className="control-group">
                <div className="control-label-row"><span className="control-label">Yaw angle</span><span className="control-value">{formatSigned(config.yawAngleDeg, 1)}°</span></div>
                <input className="range-input" type="range" min="-30" max="30" step="0.5" value={config.yawAngleDeg} onChange={(event) => setYawAngle(Number(event.target.value))} aria-label="Yaw angle" />
              </div>

              <div className="control-group">
                <div className="control-label-row"><span className="control-label">Air density</span><span className="control-value">{config.airDensityKgM3.toFixed(3)} kg/m³</span></div>
                <input className="range-input" type="range" min="0.9" max="1.4" step="0.005" value={config.airDensityKgM3} onChange={(event) => setAirDensity(Number(event.target.value))} aria-label="Air density" />
              </div>

              {config.object.kind === "car" && (
                <div className="control-group aero-control">
                  <div className="control-label-row"><span className="control-label">Rear wing angle</span><span className="control-value">{config.spoilerAngleDeg.toFixed(0)}°</span></div>
                  <input className="range-input" type="range" min="0" max="30" step="1" value={config.spoilerAngleDeg} onChange={(event) => setSpoilerAngle(Number(event.target.value))} aria-label="Rear wing angle" />
                  <div className="control-hint">More angle adds estimated downforce and drag.</div>
                </div>
              )}

              <div className="section-heading section-heading-spaced"><div className="section-title">Flow diagnostic</div><Layers3 size={15} color="#6f9f9b" /></div>
              <p className="section-copy">Select one primary field view to keep the experiment readable.</p>
              <div className="mode-grid" role="group" aria-label="Flow diagnostic mode">
                <Toggle icon={Activity} label="Tracers" active={flowMode === "particles"} onClick={() => setFlowMode("particles")} />
                <Toggle icon={Grid3X3} label="Streamlines" active={flowMode === "streamlines"} onClick={() => setFlowMode("streamlines")} />
                <Toggle icon={Zap} label="Pressure" active={flowMode === "pressure"} onClick={() => setFlowMode("pressure")} />
                <Toggle icon={Move3d} label="Velocity" active={flowMode === "velocity"} onClick={() => setFlowMode("velocity")} />
              </div>
              <div className="secondary-toggle">
                <Toggle icon={Waves} label="Turbulent wake" active={overlays.wake} onClick={() => setOverlay("wake")} />
              </div>
              <div className="solver-note"><span className="live-dot" /> {flowMode === "particles" ? "RK2 field · 1.2K inlet tracers" : `${FLOW_MODE_LABELS[flowMode]} active`}</div>
            </div>
          </aside>

          <section className="center-column" aria-label="Wind tunnel scene">
            <div className="scene-toolbar">
              <div><div className="scene-title">Virtual test chamber</div><div className="scene-subtitle">drag to orbit / scroll to zoom / live parameter response</div></div>
              <div className="inline-actions">
                <button className="subtle-button view-button" type="button" onClick={() => setCameraPreset((preset) => preset === "side" ? "perspective" : "side")} aria-label="Change camera preset"><Eye size={13} /> {cameraPreset}</button>
                <button className="icon-button" type="button" onClick={() => setRunning((active) => !active)} aria-label={running ? "Pause simulation" : "Resume simulation"} title={running ? "Pause simulation" : "Resume simulation"}>{running ? <Pause size={14} /> : <Play size={14} />}</button>
                <button className="icon-button" type="button" onClick={() => { reset(); setRunning(true); }} aria-label="Reset experiment" title="Reset experiment"><RotateCcw size={14} /></button>
                <button className="primary-button" type="button" onClick={setSnapshot}><Save size={13} /> snapshot</button>
              </div>
            </div>
            <div className="scene-stage">
              <span className="stage-badge">{FLOW_MODE_LABELS[flowMode]} / {Math.round(displaySpeed)} {speedUnit}</span>
              <div className="flow-legend" aria-label="Flow color legend">
                <span><i className="legend-swatch accelerated" /> accelerated</span>
                <span><i className="legend-swatch stagnation" /> stagnation</span>
                <span><i className="legend-swatch wake" /> wake</span>
              </div>
              <SceneCanvas
                object={config.object}
                metrics={metrics}
                yawAngleDeg={config.yawAngleDeg}
                spoilerAngleDeg={config.spoilerAngleDeg}
                flowMode={flowMode}
                overlays={overlays}
                uploadedUrl={uploadedUrl}
                running={running}
                cameraPreset={cameraPreset}
                onBoundsDetected={handleBoundsDetected}
                onModelError={handleModelError}
              />
              <span className="stage-scale">reference plane / 1 m grid</span>
              <span className="stage-caption">educational reduced-order model · not engineering CFD</span>
            </div>
            <div className="compare-bar">
              <div className="compare-heading"><div><div className="eyebrow">Experiment snapshot</div><div className="scene-subtitle">Capture the current state and compare your next iteration.</div></div>{snapshot && <span className="status-chip"><Save size={11} /> reference captured</span>}</div>
              <div className="compare-grid">
                <div className="compare-card"><div className="muted-label">drag delta</div><div className="compare-value">{snapshot ? formatSigned(metrics.dragForceN - snapshot.metrics.dragForceN) : "—"} N</div></div>
                <div className="compare-card"><div className="muted-label">lift delta</div><div className="compare-value">{snapshot ? formatSigned(metrics.liftForceN - snapshot.metrics.liftForceN) : "—"} N</div></div>
                <div className="compare-card"><div className="muted-label">current object</div><div className="compare-value compare-value-compact">{config.object.name}</div></div>
                <div className="compare-card"><div className="muted-label">reference speed</div><div className="compare-value compare-value-compact">{snapshot ? `${Math.round(unit === "metric" ? snapshot.config.windSpeedMps * 3.6 : snapshot.config.windSpeedMps * 2.23694)} ${speedUnit}` : "not set"}</div></div>
              </div>
            </div>
          </section>

          <aside className="panel right-panel">
            <div className="panel-scroll">
              <div className="section-heading"><div className="section-title">Live metrics</div><Gauge size={15} color="#e4b15f" /></div>
              <p className="section-copy">Forces are calculated from air density, reference area, speed and approximate coefficients.</p>
              <MetricCard primary label="Drag force" value={formatMetric(metrics.dragForceN)} unit="N" note={`effective Cd ${metrics.effectiveDragCoefficient.toFixed(3)} · ${config.object.frontalAreaM2.toFixed(2)} m²`} />
              <MetricCard label="Lift / downforce" value={formatMetric(Math.abs(metrics.liftForceN))} unit="N" note={metrics.liftForceN < 0 ? "negative = downforce" : "positive = lift"} />
              <MetricCard label="Drag power" value={formatMetric(metrics.dragPowerW / 1000, 1)} unit="kW" note="power lost to the air" />
              <div className="readout-list">
                <div className="readout-row"><span className="readout-label">Dynamic pressure</span><span className="readout-value">{formatMetric(metrics.dynamicPressurePa)} Pa</span></div>
                <div className="readout-row"><span className="readout-label">Side force</span><span className="readout-value">{formatSigned(metrics.sideForceN)} N</span></div>
                <div className="readout-row"><span className="readout-label">Effective speed</span><span className="readout-value">{formatMetric(unit === "metric" ? metrics.effectiveWindSpeedMps * 3.6 : metrics.effectiveWindSpeedMps * 2.23694, 1)} {speedUnit}</span></div>
                <div className="readout-row"><span className="readout-label">Reference area</span><span className="readout-value">{config.object.frontalAreaM2.toFixed(2)} m²</span></div>
                <div className="readout-row"><span className="readout-label">Reynolds number</span><span className="readout-value">{formatMetric(metrics.reynoldsNumber / 1_000_000, 2)}M</span></div>
                <div className="readout-row"><span className="readout-label">Flow regime</span><span className="readout-value status-text">{flowRegime}</span></div>
                <div className="readout-row"><span className="readout-label">Wake deficit</span><span className="readout-value">≈ {formatMetric(metrics.estimatedWakeDeficitPct, 1)}%</span></div>
                {config.object.kind === "car" && <div className="readout-row"><span className="readout-label">Wing contribution</span><span className="readout-value">-{formatMetric(metrics.spoilerDownforceN)} N</span></div>}
              </div>
              <div className="section-heading section-heading-spaced"><div className="section-title">Object coefficients</div><Activity size={15} color="#6f9f9b" /></div>
              <div className="readout-list readout-list-flush">
                <div className="readout-row"><span className="readout-label">Base Cd → effective</span><span className="readout-value">{config.object.dragCoefficient.toFixed(2)} → {metrics.effectiveDragCoefficient.toFixed(3)}</span></div>
                <div className="readout-row"><span className="readout-label">Base Cl → effective</span><span className="readout-value">{formatSigned(config.object.liftCoefficient, 2)} → {formatSigned(metrics.effectiveLiftCoefficient, 3)}</span></div>
                <div className="readout-row"><span className="readout-label">Dimensions</span><span className="readout-value">{config.object.dimensionsM.length.toFixed(1)} × {config.object.dimensionsM.width.toFixed(1)} m</span></div>
              </div>
              <div className="disclaimer">Approximate coefficients are intentionally exposed so experiments stay transparent. This scene is for learning and design intuition, not certification or engineering sign-off.</div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
