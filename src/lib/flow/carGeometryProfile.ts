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
    center: { x: 0.08, y: 0.48, z: 0.0 },
    radii: { x: 1.75, y: 0.28, z: 0.75 },
  },

  nose: {
    center: { x: -1.75, y: 0.46, z: 0.0 },
    radii: { x: 0.75, y: 0.26, z: 0.72 },
  },

  cabin: {
    center: { x: 0.22, y: 0.86, z: 0.0 },
    radii: { x: 1.0, y: 0.34, z: 0.62 },
  },

  spoiler: {
    center: { x: 1.52, y: 1.28, z: 0.0 },
    halfSize: { x: 0.34, y: 0.045, z: 0.86 },
    supports: {
      left: { center: { x: 1.52, y: 1.08, z: 0.6 }, halfSize: { x: 0.045, y: 0.2, z: 0.05 } },
      right: { center: { x: 1.52, y: 1.08, z: -0.6 }, halfSize: { x: 0.045, y: 0.2, z: 0.05 } },
    },
  },

  wheels: {
    radius: 0.36,
    width: 0.22,
    frontAxleX: -1.28,
    rearAxleX: 1.22,
    trackHalfWidth: 0.84,
    hubRadius: 0.20,
    centerY: 0.40,
  },

  noseTipX: -2.5,
  tailX: 1.87,
  topY: 1.33,
  bottomY: 0.04,
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
