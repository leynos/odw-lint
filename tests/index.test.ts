import { describe, expect, it } from "bun:test";

import { greet } from "../src/index";

describe("greet", () => {
  it("returns a greeting with the provided name", () => {
    expect(greet("World")).toBe("Hello, World!");
  });

  it("handles empty string", () => {
    expect(greet("")).toBe("Hello, !");
  });
});
