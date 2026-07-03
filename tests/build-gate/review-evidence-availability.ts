/**
 * @file Reviewer availability facts for review-evidence gate selection.
 */

import type { ReviewPath, ReviewPathAvailability } from "./review-evidence";

export type PathAvailabilityFacts = Readonly<Record<ReviewPath, ReviewPathAvailability>>;

export type ParsedAvailabilityValue =
  | { readonly ok: true; readonly value: ReviewPathAvailability }
  | { readonly ok: false; readonly usageError: string };

const reviewerAvailabilityValueCoverage = {
  available: "available",
  "quota-blocked": "quota-blocked",
  unavailable: "unavailable",
  "no-output": "no-output",
} as const satisfies Record<ReviewPathAvailability, ReviewPathAvailability>;

export const reviewerAvailabilityValues = Object.values(reviewerAvailabilityValueCoverage);

export const pessimisticPathAvailability = {
  scrutineer: "unavailable",
  coderabbit: "unavailable",
  "local-self-run": "available",
} as const satisfies PathAvailabilityFacts;

const harnessAvailabilityEnvByPath = {
  scrutineer: "ODW_LINT_REVIEW_SCRUTINEER",
  coderabbit: "ODW_LINT_REVIEW_CODERABBIT",
  "local-self-run": "ODW_LINT_REVIEW_LOCAL_SELF_RUN",
} as const satisfies Readonly<Record<ReviewPath, string>>;

/** Narrow a raw string after checking it against the exhaustive value list. */
const isReviewPathAvailability = (value: string): value is ReviewPathAvailability =>
  (reviewerAvailabilityValues as readonly string[]).includes(value);

/**
 * Parse one reviewer availability value for CLI flags or harness state.
 *
 * @param name Reviewer path name used in stable usage-error messages.
 * @param value Raw availability value to validate.
 * @returns Parsed availability or a usage-error string.
 */
export function parseAvailabilityValue(name: ReviewPath, value: string): ParsedAvailabilityValue {
  if (isReviewPathAvailability(value)) {
    return { ok: true, value };
  }

  return { ok: false, usageError: `invalid ${name} availability: ${value}` };
}

/**
 * Derive reviewer availability from harness-provided environment state.
 *
 * @param env Process environment supplied by the harness or test.
 * @returns Complete availability facts or a usage-error string.
 */
export function deriveHarnessPathAvailability(
  env: NodeJS.ProcessEnv,
): PathAvailabilityFacts | string {
  let pathAvailability: PathAvailabilityFacts = pessimisticPathAvailability;

  for (const path of Object.keys(harnessAvailabilityEnvByPath) as readonly ReviewPath[]) {
    const rawAvailability = env[harnessAvailabilityEnvByPath[path]];

    if (rawAvailability === undefined) {
      continue;
    }

    const parsed = parseAvailabilityValue(path, rawAvailability);
    if (!parsed.ok) {
      return parsed.usageError;
    }

    pathAvailability = setPathAvailability(pathAvailability, path, parsed.value);
  }

  return pathAvailability;
}

/**
 * Update one review path without changing the other availability facts.
 *
 * @param facts Existing complete availability facts.
 * @param path Review path whose availability is being changed.
 * @param value New availability for the selected path.
 * @returns A complete availability fact set.
 */
export function setPathAvailability(
  facts: PathAvailabilityFacts,
  path: ReviewPath,
  value: ReviewPathAvailability,
): PathAvailabilityFacts {
  return {
    ...facts,
    [path]: value,
  };
}
