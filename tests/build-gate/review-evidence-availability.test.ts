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
});

describe("deriveHarnessPathAvailability", () => {
  it("never selects a scrutineer primary unless the harness says scrutineer is available", () => {
    fc.assert(
      fc.property(harnessAvailabilityEnv(), (env) => {
        const derived = deriveHarnessPathAvailability(env);

        expect(typeof derived).not.toBe("string");
        if (typeof derived === "string") {
          return;
        }

        const selection = selectReviewPath(derived);

        if (env["ODW_LINT_REVIEW_SCRUTINEER"] !== "available") {
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
