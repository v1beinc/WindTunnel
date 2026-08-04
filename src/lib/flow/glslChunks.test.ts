import { describe, expect, it } from "vitest";
import {
  GLSL_SCENE_SDF_CAR,
  GLSL_SD_CYLINDER_Z,
} from "./glslChunks";

describe("GPU SDF GLSL dependencies", () => {
  it("provides the Z-oriented cylinder used by the car wheel SDF", () => {
    expect(GLSL_SD_CYLINDER_Z).toContain("float sdCylinderZ");
    expect(GLSL_SCENE_SDF_CAR).toContain("sdCylinderZ(");
  });
});
