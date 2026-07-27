export interface CarGeometryProfile {
  // Overall dimensions
  length: number;
  width: number;
  height: number;
  groundClearance: number;

  // Body (main hull) - ellipsoid approximation
  body: {
    center: { x: number; y: number; z: number };
    radii: { x: number; y: number; z: number };
  };

  // Nose - front ellipsoid
  nose: {
    center: { x: number; y: number; z: number };
    radii: { x: number; y: number; z: number };
  };

  // Cabin - upper ellipsoid
  cabin: {
    center: { x: number; y: number; z: number };
    radii: { x: number; y: number; z: number };
  };

  // Rear spoiler (wing)
  spoiler: {
    center: { x: number; y: number; z: number };
    halfSize: { x: number; y: number; z: number };
    supports: {
      left: { center: { x: number; y: number; z: number }; halfSize: { x: number; y: number; z: number } };
      right: { center: { x: number; y: number; z: number }; halfSize: { x: number; y: number; z: number } };
    };
  };

  // Wheels
  wheels: {
    radius: number;
    width: number;
    frontAxleX: number;
    rearAxleX: number;
    trackHalfWidth: number;
    hubRadius: number;
    centerY: number;
  };

  // Derived bounds
  noseTipX: number;
  tailX: number;
  topY: number;
  bottomY: number;
  leftZ: number;
  rightZ: number;
}

export const CAR_GEOMETRY: CarGeometryProfile = {
  length: 4.4,
  width: 1.86,
  height: 1.12,
  groundClearance: 0.12,

  body: {
    center: { x: 0.0, y: 0.56, z: 0.0 },
    radii: { x: 2.0, y: 0.38, z: 0.82 },
  },

  nose: {
    center: { x: -1.8, y: 0.56, z: 0.0 },
    radii: { x: 0.7, y: 0.32, z: 0.78 },
  },

  cabin: {
    center: { x: 0.2, y: 1.05, z: 0.0 },
    radii: { x: 1.0, y: 0.35, z: 0.68 },
  },

  spoiler: {
    center: { x: 1.55, y: 1.35, z: 0.0 },
    halfSize: { x: 0.32, y: 0.05, z: 0.88 },
    supports: {
      left: { center: { x: 1.55, y: 1.15, z: 0.6 }, halfSize: { x: 0.045, y: 0.2, z: 0.05 } },
      right: { center: { x: 1.55, y: 1.15, z: -0.6 }, halfSize: { x: 0.045, y: 0.2, z: 0.05 } },
    },
  },

  wheels: {
    radius: 0.38,
    width: 0.18,
    frontAxleX: -1.3,
    rearAxleX: 1.25,
    trackHalfWidth: 0.85,
    hubRadius: 0.22,
    centerY: 0.26, // radius - groundClearance
  },

  noseTipX: -2.3,
  tailX: 1.85,
  topY: 1.35,
  bottomY: 0.0,
  leftZ: -0.95,
  rightZ: 0.95,
};

// Helper to get all primitive definitions for SDF
export function getCarSdfPrimitives(profile: CarGeometryProfile = CAR_GEOMETRY) {
  return {
    body: { center: profile.body.center, radii: profile.body.radii },
    nose: { center: profile.nose.center, radii: profile.nose.radii },
    cabin: { center: profile.cabin.center, radii: profile.cabin.radii },
    spoiler: {
      center: profile.spoiler.center,
      halfSize: profile.spoiler.halfSize,
      supports: profile.spoiler.supports,
    },
    wheels: profile.wheels,
    bounds: {
      noseTipX: profile.noseTipX,
      tailX: profile.tailX,
      topY: profile.topY,
      bottomY: profile.bottomY,
      leftZ: profile.leftZ,
      rightZ: profile.rightZ,
    },
  };
}