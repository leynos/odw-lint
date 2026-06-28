/**
 * @file Shared fixture manifest deep-freeze tests.
 */

import { describe, expect, it } from "bun:test";
import { deepFreezeFixtureManifest } from "./fixtures/manifest-freeze";

const TYPE_LEVEL_SYMBOL_KEY = Symbol("fixture type expectation");

type TypeLevelFixtureManifest = {
  handler: ((offset: number) => string) & {
    metadata: {
      replacement: string;
    };
  };
  diagnostic: {
    span: {
      start: {
        offset: number;
      };
    };
  };
  [TYPE_LEVEL_SYMBOL_KEY]: {
    suggestion: {
      replacement: string;
    };
  };
};

if (import.meta.url === "") {
  // This branch is never executed; it only makes `tsc` enforce the
  // `deepFreezeFixtureManifest` compile-time readonly contract.
  const readonlyManifest = deepFreezeFixtureManifest<TypeLevelFixtureManifest>({
    handler: Object.assign((offset: number): string => `offset:${offset}`, {
      metadata: { replacement: "updated" },
    }),
    diagnostic: {
      span: {
        start: { offset: 1 },
      },
    },
    [TYPE_LEVEL_SYMBOL_KEY]: {
      suggestion: {
        replacement: "updated",
      },
    },
  });
  const handlerResult: string = readonlyManifest.handler(1);
  handlerResult satisfies string;

  // @ts-expect-error The helper must return nested readonly string-keyed values.
  readonlyManifest.diagnostic.span.start.offset = 2;

  // @ts-expect-error The helper must preserve nested readonly symbol-keyed values.
  readonlyManifest[TYPE_LEVEL_SYMBOL_KEY].suggestion.replacement = "mutated";

  // @ts-expect-error The helper must make callable fixture properties readonly.
  readonlyManifest.handler.metadata.replacement = "mutated";
}

describe("fixture manifest deep freeze", () => {
  it("preserves function-valued fixture entries as callable references", () => {
    const handler = (): string => "handled";

    const manifest = deepFreezeFixtureManifest({ handler });

    expect(Object.isFrozen(manifest)).toBeTrue();
    expect(Object.isFrozen(manifest.handler)).toBeTrue();
    expect(manifest.handler).toBe(handler);
    expect(manifest.handler()).toBe("handled");
  });

  it("freezes function-valued fixture entry metadata", () => {
    const handler = Object.assign((): string => "handled", {
      metadata: { replacement: "updated" },
    });

    const manifest = deepFreezeFixtureManifest({ handler });

    expect(Object.isFrozen(manifest.handler)).toBeTrue();
    expect(Object.isFrozen(manifest.handler.metadata)).toBeTrue();
    expect(() => {
      (manifest.handler.metadata as { replacement: string }).replacement = "mutated";
    }).toThrow(TypeError);
  });

  it("rejects accessor-backed fixture manifests", () => {
    const manifest = {
      get diagnostic() {
        return { span: { start: { offset: 1 } } };
      },
    };

    expect(() => {
      deepFreezeFixtureManifest(manifest);
    }).toThrow(TypeError);
  });

  it("rejects mutable built-in containers with hidden state", () => {
    expect(() => {
      deepFreezeFixtureManifest({
        createdAt: new Date("2026-06-28T00:00:00.000Z"),
      });
    }).toThrow(TypeError);
  });

  it("freezes cyclic fixture values without recursing forever", () => {
    type CyclicFixtureManifest = {
      readonly nested: {
        cycle?: CyclicFixtureManifest;
      };
    };
    const manifest: CyclicFixtureManifest = {
      nested: {},
    };
    manifest.nested.cycle = manifest;

    const frozenManifest = deepFreezeFixtureManifest(manifest);

    expect(Object.isFrozen(frozenManifest)).toBeTrue();
    expect(Object.isFrozen(frozenManifest.nested)).toBeTrue();
    expect(frozenManifest.nested.cycle).toBe(frozenManifest);
  });

  it("freezes array-valued fixture entries and their elements", () => {
    const manifest = deepFreezeFixtureManifest({
      spans: [{ start: { offset: 0 } }, { start: { offset: 4 } }],
    });

    expect(Object.isFrozen(manifest.spans)).toBeTrue();
    expect(Object.isFrozen(manifest.spans[0])).toBeTrue();
    expect(Object.isFrozen(manifest.spans[0]?.start)).toBeTrue();
    expect(() => {
      (manifest.spans as { start: { offset: number } }[]).push({ start: { offset: 8 } });
    }).toThrow(TypeError);
  });

  it("freezes string-keyed and symbol-keyed nested fixture values", () => {
    const symbolKey = Symbol("fixture expectation");
    const manifest = deepFreezeFixtureManifest({
      diagnostic: {
        span: {
          start: { offset: 1 },
        },
      },
      [symbolKey]: {
        suggestion: {
          replacement: "updated",
        },
      },
    });

    expect(Object.isFrozen(manifest)).toBeTrue();
    expect(Object.isFrozen(manifest.diagnostic)).toBeTrue();
    expect(Object.isFrozen(manifest.diagnostic.span)).toBeTrue();
    expect(Object.isFrozen(manifest.diagnostic.span.start)).toBeTrue();
    expect(Object.isFrozen(manifest[symbolKey])).toBeTrue();
    expect(Object.isFrozen(manifest[symbolKey].suggestion)).toBeTrue();

    expect(() => {
      (manifest[symbolKey].suggestion as { replacement: string }).replacement = "mutated";
    }).toThrow(TypeError);
  });
});
