# WindTunnel

WindTunnel is a desktop-first, browser-based 3D aerodynamics sandbox. It lets users choose an object, adjust wind and aerodynamic parameters, inspect the resulting flow field, and compare reduced-order force estimates in real time.

> WindTunnel is an educational reduced-order simulation. It is not an engineering CFD solver and must not be used for certification or safety-critical design decisions.

## Current features

- Interactive 3D wind-tunnel scene powered by React Three Fiber and Three.js.
- Procedural sports coupe with detailed bodywork, windows, wheels, splitter, diffuser, and an adjustable rear wing.
- Four focused flow diagnostics:
  - particle tracers;
  - smoke streamlines;
  - surface-pressure visualization;
  - sampled velocity vectors.
- 16,384 GPU-advected particle tracers with a fixed 120 Hz simulation step, independent of display frame rate.
- Geometry-aware signed-distance collision volumes for the procedural car body, cabin, wing supports, and adjustable rear wing.
- Coupled stagnation, surface acceleration, wake deficit, and vortex-shedding field; the wake is part of the velocity model instead of a decorative overlay.
- WebGL2 GPGPU path with a CPU tracer fallback for devices without vertex-texture support.
- Live drag, lift/downforce, side force, dynamic pressure, drag power, Reynolds number, and wake-deficit estimates.
- Rear-wing angle affects the visible geometry, effective drag and lift coefficients, force metrics, and wake field.
- Side and perspective camera presets, pause/resume, unit switching, snapshots, and configuration comparison.
- Built-in car, wing, block, and sphere templates.
- Local `.glb` import with size validation and automatic scale normalization.
- Versioned local-session persistence with Zod validation and migration from older save formats.
- No required environment variables, account, database, or server-side worker.

## Physics model

The independent TypeScript physics core uses standard reduced-order equations:

```text
Dynamic pressure: q  = 0.5 × rho × v²
Drag force:      Fd = q × Cd × A
Lift force:      Fl = q × Cl × A
Drag power:      P  = Fd × v
```

The visible flow combines a reduced-order analytical velocity field with GPU particle advection. The built-in car uses a union of signed-distance volumes so tracers bend around the nose, body, cabin, and rear wing before entering a drag-dependent turbulent wake. Imported GLB files currently use a normalized bounding-volume approximation rather than a mesh-derived SDF.

This is still not a Navier–Stokes or mesh-based CFD solver. Model coefficients are deliberately exposed as approximations so experiments remain transparent.

## Tech stack

- Next.js 16 App Router
- React 19 and TypeScript
- Tailwind CSS 4
- React Three Fiber, Three.js, and Drei
- Zustand
- Zod
- Vitest
- pnpm

## Getting started

Requirements:

- a current Node.js LTS release;
- pnpm.

Install dependencies and start the development server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000/studio](http://localhost:3000/studio).

## Available commands

```bash
pnpm dev        # Start the development server
pnpm test       # Run unit tests
pnpm typecheck  # Run the TypeScript compiler without emitting files
pnpm lint       # Run ESLint
pnpm build      # Create a production build
pnpm start      # Start the production server
```

## Project structure

```text
src/
  app/                         Next.js routes and global styles
  components/studio/
    GpuParticleFlow.tsx       Fixed-step GPGPU advection and SDF collision shaders
    SceneCanvas.tsx            R3F scene and flow diagnostics
    SportsCarModel.tsx         Procedural sports-coupe model
    StudioShell.tsx            Laboratory UI and persistence
  lib/
    physics/aerodynamics.ts    Reduced-order force calculations
    physics/flowField.ts       CPU SDF and matching reduced-order flow field
    models.ts                  Built-in object catalogue
    store.ts                   Zustand simulation state
```

## Local model imports

Imported `.glb` files never leave the browser. WindTunnel creates a temporary `ObjectURL`, calculates the model bounds, normalizes its scale, and releases the URL when it is no longer needed. The current maximum import size is 25 MB.

The repository ignores `.glb` and `.gltf` files by default to prevent accidental publication of unlicensed or private assets. A reviewed, licensed asset can still be added intentionally with `git add -f`.

## Deployment

The application can be deployed on Vercel without environment variables:

1. import the repository into Vercel;
2. keep the detected Next.js settings;
3. use `pnpm build` as the build command;
4. deploy.

## Roadmap

- AI-assisted aerodynamic experiment analysis and design suggestions.
- Aircraft and airfoil design exercises.
- Direct geometry-editing controls.
- Saved cloud projects, authentication, and model storage.
- More advanced reduced-order models and optional server-side CFD workers.
- Experiment sharing and classroom challenges.

## Asset policy

Only original, procedural, or properly licensed 3D assets should be committed. Assets from Gran Turismo or other commercial games are not included.
