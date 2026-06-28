/**
 * @file Behaviour tests for the `greet` export in `src/index.ts`.
 *
 * The suite uses the shared Bun test setup from `tests/setup.ts`.
 */
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
