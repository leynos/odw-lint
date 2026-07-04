/**
 * @file Tests for review-evidence reviewer availability facts.
 */

import { describe, expect, expectTypeOf, it } from "bun:test";
import * as fc from "fast-check";
import { type ReviewPath, type ReviewPathAvailability, selectReviewPath } from "./review-evidence";
import {
  deriveHarnessPathAvailability,
  type PathAvailabilityFacts,
  parseAvailabilityValue,
  pessimisticPathAvailability,
  reviewerAvailabilityValues,
  setPathAvailability,
} from "./review-evidence-availability";

const reviewPaths = Object.keys(pessimisticPathAvailability) as readonly ReviewPath[];

describe("availability contract types", () => {
  it("keeps availability values and path facts exhaustive", () => {
    expectTypeOf<
      (typeof reviewerAvailabilityValues)[number]
    >().toEqualTypeOf<ReviewPathAvailability>();
    expectTypeOf<
      Exclude<ReviewPath, keyof typeof pessimisticPathAvailability>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      Exclude<keyof typeof pessimisticPathAvailability, ReviewPath>
    >().toEqualTypeOf<never>();
    expectTypeOf<typeof pessimisticPathAvailability>().toMatchTypeOf<PathAvailabilityFacts>();
  });
});

describe("parseAvailabilityValue", () => {
  it("round-trips every review path availability value for every review path", () => {
    for (const reviewPath of reviewPaths) {
      for (const availability of reviewerAvailabilityValues) {
        expect(parseAvailabilityValue(reviewPath, availability)).toEqual({
          ok: true,
          value: availability,
        });
      }
    }
  });

  for (const reviewPath of reviewPaths) {
    it(`returns a ${reviewPath} usage error for an invalid value`, () => {
      const parsed = parseAvailabilityValue(reviewPath, "later");

      expect(parsed).toMatchObject({ ok: false });
      expect(parsed).toMatchSnapshot();
    });
  }
});

describe("setPathAvailability", () => {
  const updateCases = [
    ["scrutineer", "quota-blocked"],
    ["coderabbit", "no-output"],
    ["local-self-run", "unavailable"],
  ] as const satisfies readonly (readonly [ReviewPath, ReviewPathAvailability])[];

  it.each(updateCases)("updates only the %s availability fact", (path, availability) => {
    const updated = setPathAvailability(pessimisticPathAvailability, path, availability);

    expect(updated[path]).toBe(availability);

    for (const reviewPath of reviewPaths) {
      if (reviewPath !== path) {
        expect(updated[reviewPath]).toBe(pessimisticPathAvailability[reviewPath]);
      }
    }
  });

  it("returns a new fact set without mutating the original facts", () => {
    const original = {
      ...pessimisticPathAvailability,
      coderabbit: "available",
    } satisfies PathAvailabilityFacts;

    const updated = setPathAvailability(original, "coderabbit", "no-output");

    expect(updated).not.toBe(original);
    expect(original).toEqual({
      ...pessimisticPathAvailability,
      coderabbit: "available",
    });
    expect(updated).toEqual({
      ...pessimisticPathAvailability,
      coderabbit: "no-output",
    });
  });
});

describe("deriveHarnessPathAvailability", () => {
  const mappingCases = [
    [
      "scrutineer",
      { ODW_LINT_REVIEW_SCRUTINEER: "available" },
      { ...pessimisticPathAvailability, scrutineer: "available" },
    ],
    [
      "coderabbit",
      { ODW_LINT_REVIEW_CODERABBIT: "no-output" },
      { ...pessimisticPathAvailability, coderabbit: "no-output" },
    ],
    [
      "local-self-run",
      { ODW_LINT_REVIEW_LOCAL_SELF_RUN: "unavailable" },
      { ...pessimisticPathAvailability, "local-self-run": "unavailable" },
    ],
  ] as const satisfies readonly (readonly [ReviewPath, NodeJS.ProcessEnv, PathAvailabilityFacts])[];

  it.each(
    mappingCases,
  )("maps %s harness environment state to path availability", (_path, env, expected) => {
    expect(deriveHarnessPathAvailability(env)).toEqual({ ok: true, value: expected });
  });

  it("lets harness environment values override every pessimistic default", () => {
    expect(
      deriveHarnessPathAvailability({
        ODW_LINT_REVIEW_SCRUTINEER: "available",
        ODW_LINT_REVIEW_CODERABBIT: "quota-blocked",
        ODW_LINT_REVIEW_LOCAL_SELF_RUN: "unavailable",
      }),
    ).toEqual({
      ok: true,
      value: {
        scrutineer: "available",
        coderabbit: "quota-blocked",
        "local-self-run": "unavailable",
      },
    });
  });

  const invalidEnvironmentCases = [
    ["scrutineer", { ODW_LINT_REVIEW_SCRUTINEER: "busy" }, "invalid scrutineer availability: busy"],
    [
      "coderabbit",
      { ODW_LINT_REVIEW_CODERABBIT: "later" },
      "invalid coderabbit availability: later",
    ],
    [
      "local-self-run",
      { ODW_LINT_REVIEW_LOCAL_SELF_RUN: "missing" },
      "invalid local-self-run availability: missing",
    ],
  ] as const satisfies readonly (readonly [ReviewPath, NodeJS.ProcessEnv, string])[];

  it.each(
    invalidEnvironmentCases,
  )("rejects invalid %s harness availability", (_path, env, usageError) => {
    expect(deriveHarnessPathAvailability(env)).toEqual({ ok: false, usageError });
  });

  it("never selects a scrutineer primary unless the harness says scrutineer is available", () => {
    fc.assert(
      fc.property(harnessAvailabilityEnv(), (env) => {
        const derived = deriveHarnessPathAvailability(env);

        expect(derived.ok).toBe(true);
        if (!derived.ok) {
          return;
        }

        const selection = selectReviewPath(derived.value);
        const harnessEnv = env as NodeJS.ProcessEnv & {
          readonly ODW_LINT_REVIEW_SCRUTINEER?: string;
        };

        if (harnessEnv.ODW_LINT_REVIEW_SCRUTINEER !== "available") {
          expect(selection).not.toMatchObject({
            selected: "scrutineer",
            isFallback: false,
          });
        }
      }),
      { seed: 0x1508, numRuns: 100 },
    );
  });
});

/** Generate harness environment fragments for reviewer availability state. */
const harnessAvailabilityEnv = (): fc.Arbitrary<NodeJS.ProcessEnv> => {
  return fc.record(
    {
      ODW_LINT_REVIEW_SCRUTINEER: fc.option(availabilityValue(), { nil: undefined }),
      ODW_LINT_REVIEW_CODERABBIT: fc.option(availabilityValue(), { nil: undefined }),
      ODW_LINT_REVIEW_LOCAL_SELF_RUN: fc.option(availabilityValue(), {
        nil: undefined,
      }),
    },
    { requiredKeys: [] },
  );
};

/** Generate one valid reviewer availability value. */
const availabilityValue = (): fc.Arbitrary<ReviewPathAvailability> =>
  fc.constantFrom(...reviewerAvailabilityValues);
