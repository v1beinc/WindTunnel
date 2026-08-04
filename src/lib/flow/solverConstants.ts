import { CAR_GEOMETRY } from "./carGeometryProfile";

export const DEG_TO_RAD = Math.PI / 180;

export const FIXED_STEP_SECONDS = 1 / 120;
export const MAX_SUBSTEPS = 12;
export const MAX_ACCUMULATOR_SECONDS = FIXED_STEP_SECONDS * MAX_SUBSTEPS * 2;

export const COMPUTE_SIZE = 96;
export const PARTICLE_COUNT = COMPUTE_SIZE * COMPUTE_SIZE;

// Visual advection is intentionally scaled for a readable desktop scene;
// the physical speed remains available in SimulationMetrics.
export const FLOW_VISUAL_SPEED_BASE = 0.9;
export const FLOW_VISUAL_SPEED_PER_MPS = 0.12;
export const FLOW_VISUAL_SPEED_MAX = 4.3;

export const CPU_NORMAL_EPSILON = 0.024;
export const GPU_POSITION_NORMAL_EPSILON = 0.018;
export const GPU_VELOCITY_NORMAL_EPSILON = 0.026;

// Car geometry profile - single source of truth for car dimensions
export const CAR_BODY_CENTER = CAR_GEOMETRY.body.center;
export const CAR_BODY_RADII = CAR_GEOMETRY.body.radii;

export const CAR_NOSE_CENTER = CAR_GEOMETRY.nose.center;
export const CAR_NOSE_RADII = CAR_GEOMETRY.nose.radii;

export const CAR_CABIN_CENTER = CAR_GEOMETRY.cabin.center;
export const CAR_CABIN_RADII = CAR_GEOMETRY.cabin.radii;

export const CAR_WING_CENTER = CAR_GEOMETRY.spoiler.center;
export const CAR_WING_HALF_SIZE = CAR_GEOMETRY.spoiler.halfSize;

export const CAR_LEFT_SUPPORT_CENTER = CAR_GEOMETRY.spoiler.supports.left.center;
export const CAR_RIGHT_SUPPORT_CENTER = CAR_GEOMETRY.spoiler.supports.right.center;
export const CAR_SUPPORT_HALF_SIZE = CAR_GEOMETRY.spoiler.supports.left.halfSize;

export const CAR_WHEEL_RADIUS = CAR_GEOMETRY.wheels.radius;
export const CAR_WHEEL_WIDTH = CAR_GEOMETRY.wheels.width;
export const CAR_WHEEL_FRONT_AXLE_X = CAR_GEOMETRY.wheels.frontAxleX;
export const CAR_WHEEL_REAR_AXLE_X = CAR_GEOMETRY.wheels.rearAxleX;
export const CAR_WHEEL_TRACK_HALF_WIDTH = CAR_GEOMETRY.wheels.trackHalfWidth;
export const CAR_WHEEL_HUB_RADIUS = CAR_GEOMETRY.wheels.hubRadius;
export const CAR_WHEEL_CENTER_Y = CAR_GEOMETRY.wheels.centerY;

export const CAR_NOSE_TIP_X = CAR_GEOMETRY.noseTipX;
export const CAR_TAIL_X = CAR_GEOMETRY.tailX;
export const CAR_TOP_Y = CAR_GEOMETRY.topY;
export const CAR_BOTTOM_Y = CAR_GEOMETRY.bottomY;
export const CAR_LEFT_Z = CAR_GEOMETRY.leftZ;
export const CAR_RIGHT_Z = CAR_GEOMETRY.rightZ;

export const DEFAULT_OBJECT_HALF_SIZE_MIN = 0.12;
export const DEFAULT_OBJECT_Y_OFFSET = 0.05;

export const POSITION_RESET_STREAMWISE = -7.2;
export const POSITION_RESET_LATERAL_MIN = -3.35;
export const POSITION_RESET_LATERAL_MAX = 3.35;
export const POSITION_RESET_HEIGHT_MIN = 0.07;
export const POSITION_RESET_HEIGHT_MAX = 3.25;

export const POSITION_OUTSIDE_TUNNEL_STREAMWISE_MAX = 7.25;
export const POSITION_OUTSIDE_TUNNEL_STREAMWISE_MIN = -7.55;
export const POSITION_OUTSIDE_TUNNEL_Y_MAX = 3.35;
export const POSITION_OUTSIDE_TUNNEL_Z_MAX = 7.8;
export const POSITION_OUTSIDE_TUNNEL_X_MAX = 8.0;

export const POSITION_COLLISION_EPSILON = 0.015;
export const POSITION_COLLISION_CORRECTION = 0.018;
export const POSITION_GROUND_Y = 0.055;
export const POSITION_MAX_AGE = 7.5;
export const POSITION_RESET_AGE_FACTOR = 0.24;

export const VELOCITY_INFLUENCE_SMOOTHSTEP_MIN = 0.04;
export const VELOCITY_INFLUENCE_SMOOTHSTEP_MAX = 1.12;

export const VELOCITY_STAGNATION_FACTOR = 0.72;

export const VELOCITY_SURFACE_ACCEL_BASE = 0.18;
export const VELOCITY_SURFACE_ACCEL_VAR = 0.18;

export const VELOCITY_REAR_REACH_X = 2.22;
export const VELOCITY_REAR_REACH_Z = 0.9;

export const VELOCITY_WAKE_WIDTH_BASE = 0.76;
export const VELOCITY_WAKE_WIDTH_GROWTH = 0.14;
export const VELOCITY_WAKE_VERTICAL_SCALE = 1.22;
export const VELOCITY_WAKE_DECAY = 6.4;

export const VELOCITY_WAKE_DEFICIT_BASE = 0.24;
export const VELOCITY_WAKE_DEFICIT_CD_FACTOR = 0.42;
export const VELOCITY_WAKE_DEFICIT_MIN = 0.24;
export const VELOCITY_WAKE_DEFICIT_MAX = 0.58;

export const VELOCITY_VORTEX_FREQUENCY_TIME = 5.1;
export const VELOCITY_VORTEX_FREQUENCY_DIST = 3.25;
export const VELOCITY_VORTEX_SEED_SCALE = 6.2831;
export const VELOCITY_VORTEX_BASE = 0.17;
export const VELOCITY_VORTEX_CD_FACTOR = 0.18;
export const VELOCITY_VORTEX_CROSS_FACTOR = 0.45;
export const VELOCITY_VORTEX_Y_FACTOR = 0.7;

export const VELOCITY_COLLISION_THRESHOLD = 0.09;
export const VELOCITY_COLLISION_PUSH_BASE = 0.24;
export const VELOCITY_COLLISION_PUSH_FACTOR = 5.0;

export const VELOCITY_GROUND_Y = 0.14;
export const VELOCITY_GROUND_PUSH_FACTOR = 3.2;

export const CPU_INFLUENCE_MIN_DIST = 0.04;
export const CPU_INFLUENCE_MAX_DIST = 1.08;

export const CPU_STAGNATION_FACTOR = 0.72;
export const CPU_SURFACE_ACCEL_BASE = 0.18;
export const CPU_SURFACE_ACCEL_VAR = 0.18;

export const CPU_REAR_REACH_LENGTH_FACTOR = 0.5;
export const CPU_REAR_REACH_LENGTH_MAX = 2.23;
export const CPU_REAR_REACH_WIDTH_FACTOR = 0.5;
export const CPU_REAR_REACH_WIDTH_MAX = 1.55;

export const CPU_WAKE_WIDTH_BASE = 0.76;
export const CPU_WAKE_WIDTH_GROWTH = 0.14;
export const CPU_WAKE_VERTICAL_SCALE = 1.22;
export const CPU_WAKE_DECAY = 6.4;
export const CPU_WAKE_VERTICAL_OFFSET_FACTOR = 0.48;
export const CPU_WAKE_VERTICAL_OFFSET_MAX = 0.72;

export const CPU_WAKE_DEFICIT_BASE = 0.24;
export const CPU_WAKE_DEFICIT_CD_FACTOR = 0.42;
export const CPU_WAKE_DEFICIT_MIN = 0.24;
export const CPU_WAKE_DEFICIT_MAX = 0.58;

export const CPU_VORTEX_FREQUENCY_TIME = 5.1;
export const CPU_VORTEX_FREQUENCY_DIST = 3.25;
export const CPU_VORTEX_BASE = 0.17;
export const CPU_VORTEX_CD_FACTOR = 0.18;
export const CPU_VORTEX_CROSS_FACTOR = 0.45;
export const CPU_VORTEX_Y_FACTOR = 0.7;

export const CPU_COLLISION_THRESHOLD = 0.09;
export const CPU_COLLISION_PUSH_BASE = 0.24;
export const CPU_COLLISION_PUSH_FACTOR = 5.0;

export const CPU_GROUND_Y = 0.14;
export const CPU_GROUND_PUSH_FACTOR = 3.2;

export const CPU_PROJECTION_THRESHOLD = 0.025;
export const CPU_PROJECTION_CORRECTION = 0.032;
export const CPU_PROJECTION_GROUND_Y = 0.055;

// FLOW_* constants (aliases for CPU_* where values are identical, for clarity in flowField.ts)
export const FLOW_INFLUENCE_CLAMP_MIN = 0.04;
export const FLOW_INFLUENCE_CLAMP_MAX = 1.08;
export const FLOW_STAGNATION_FACTOR = 0.72;
export const FLOW_SURFACE_ACCEL_BASE = 0.18;
export const FLOW_SURFACE_ACCEL_VAR = 0.18;

export const FLOW_ENVELOPE_HALF_LENGTH_FACTOR = 0.5;
export const FLOW_ENVELOPE_HALF_WIDTH_FACTOR = 0.5;
export const FLOW_ENVELOPE_HALF_HEIGHT_FACTOR = 0.5;
export const FLOW_ENVELOPE_CENTER_Y_OFFSET = 0.05;
export const FLOW_ENVELOPE_HALF_LENGTH_MIN = 0.48;
export const FLOW_ENVELOPE_HALF_LENGTH_MAX = 2.35;
export const FLOW_ENVELOPE_HALF_WIDTH_MIN = 0.22;
export const FLOW_ENVELOPE_HALF_WIDTH_MAX = 1.55;
export const FLOW_ENVELOPE_HALF_HEIGHT_MIN = 0.14;
export const FLOW_ENVELOPE_HALF_HEIGHT_MAX = 1.35;

export const STREAMLINE_START_STREAMWISE = -7.1;

// Additional constants needed by glslChunks and index.ts
export const HASH21_MUL1 = 123.34;
export const HASH21_MUL2 = 456.21;
export const HASH21_ADD = 45.32;

export const CAR_LEFT_SUPPORT_HALF_SIZE = CAR_GEOMETRY.spoiler.supports.left.halfSize;
export const CAR_RIGHT_SUPPORT_HALF_SIZE = CAR_GEOMETRY.spoiler.supports.right.halfSize;

export const GENERIC_HALF_SIZE_MIN = 0.12;
export const GENERIC_GROUND_OFFSET = 0.05;

export const POSITION_COLLISION_THRESHOLD = 0.015;
export const POSITION_COLLISION_PUSH = 0.018;
export const POSITION_AGE_RESET = 7.5;
export const POSITION_STREAMWISE_MAX = 7.25;
export const POSITION_STREAMWISE_MIN = -7.55;
export const POSITION_Y_MAX = 3.35;
export const POSITION_Z_MAX = 7.8;
export const POSITION_X_MAX = 8.0;
export const POSITION_AGE_RANDOM_SCALE = 0.24;

export const FLOW_REAR_REACH_LENGTH_FACTOR = 0.5;
export const FLOW_REAR_REACH_LENGTH_MAX = 2.23;
export const FLOW_REAR_REACH_WIDTH_FACTOR = 0.5;
export const FLOW_REAR_REACH_WIDTH_MAX = 1.55;
export const FLOW_WAKE_WIDTH_BASE = 0.76;
export const FLOW_WAKE_WIDTH_GROWTH = 0.14;
export const FLOW_WAKE_DECAY = 6.4;
export const FLOW_WAKE_VERTICAL_SCALE = 1.22;
export const FLOW_WAKE_DEFICIT_BASE = 0.24;
export const FLOW_WAKE_DEFICIT_CD_FACTOR = 0.42;
export const FLOW_WAKE_DEFICIT_MIN = 0.24;
export const FLOW_WAKE_DEFICIT_MAX = 0.58;
export const FLOW_VORTEX_FREQUENCY_TIME = 5.1;
export const FLOW_VORTEX_FREQUENCY_DIST = 3.25;
export const FLOW_VORTEX_BASE = 0.17;
export const FLOW_VORTEX_CD_FACTOR = 0.18;
export const FLOW_VORTEX_CROSS_FACTOR = 0.45;
export const FLOW_VORTEX_Y_FACTOR = 0.7;
export const FLOW_COLLISION_THRESHOLD = 0.09;
export const FLOW_COLLISION_PUSH_BASE = 0.24;
export const FLOW_COLLISION_PUSH_FACTOR = 5.0;
export const FLOW_GROUND_Y = 0.14;
export const FLOW_GROUND_PUSH_FACTOR = 3.2;
export const FLOW_PROJECT_THRESHOLD = 0.025;
export const FLOW_PROJECT_CORRECTION = 0.032;
export const FLOW_PROJECT_MIN_Y = 0.055;

export const RESET_LATERAL_RANGE = 6.7;
export const RESET_LATERAL_CENTER = 0.0;
export const RESET_HEIGHT_MIN = 0.07;
export const RESET_HEIGHT_MAX = 3.25;

export const CPU_RESET_STREAMWISE = -7.15;
export const CPU_RESET_LATERAL_MIN = -3.2;
export const CPU_RESET_LATERAL_MAX = 3.2;
export const CPU_RESET_HEIGHT_MIN = 0.08;
export const CPU_RESET_HEIGHT_MAX = 3.05;
export const CPU_MOVEMENT_SPEED_BASE = 0.72;
export const CPU_MOVEMENT_SPEED_FACTOR = 1 / 22;
export const CPU_MOVEMENT_SPEED_CAP = 3.15;
export const CPU_FRAME_DELTA_CAP = 0.08;
export const CPU_TRAIL_LENGTH_BASE = 0.1;
export const CPU_TRAIL_LENGTH_SPEED_FACTOR = 0.045;
export const CPU_OUTLET_STREAMWISE = 7.25;
export const CPU_OUTLET_LATERAL = 3.65;
export const CPU_OUTLET_Y_MIN = 0.055;
export const CPU_OUTLET_Y_MAX = 3.25;

export const SEEDED_RANDOM_MUL = 12.9898;
export const SEEDED_RANDOM_FACTOR = 43758.5453;

export const GPU_FLOW_SPEED_BASE = 0.82;
export const GPU_FLOW_SPEED_FACTOR = 1 / 20;
export const GPU_FLOW_SPEED_CAP = 3.35;
export const STREAMLINE_STEP_LENGTH = 0.17;
export const STREAMLINE_STEPS = 88;
export const STREAMLINE_TIME_STEP = 0.035;
export const STREAMLINE_MIN_VELOCITY = 0.08;

export const RIBBON_STEPS = 96;
export const RIBBON_STEP_LENGTH = 0.16;

export const RENDER_TRAIL_LENGTH_BASE = 0.05;
export const RENDER_TRAIL_LENGTH_SPEED_CAP = 4.3;
export const RENDER_TRAIL_LENGTH_SPEED_FACTOR = 0.032;
