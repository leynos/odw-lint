/**
 * @file Strict-Claude diagnostic severity promotion.
 *
 * The transform is intentionally inert: it inspects only catalogued diagnostic
 * metadata and already-produced diagnostics. It never imports or evaluates
 * workflow source.
 */

import { RULE_CATALOGUE } from "./rule-catalogue";
import type { Diagnostic } from "./types";

/**
 * Promotes Claude-compatibility warnings to errors.
 *
 * @param diagnostics Diagnostics produced by the static lint pipeline.
 * @returns Frozen diagnostics with warning-level Claude compatibility findings
 * promoted to errors, mirroring `--strict-claude`.
 *
 * @example
 * ```ts
 * const [diagnostic] = promoteStrictClaudeSeverity([dateNowWarning]);
 * diagnostic.severity; // "error"
 * ```
 */
export const promoteStrictClaudeSeverity = (
  diagnostics: readonly Diagnostic[],
): readonly Diagnostic[] => {
  return Object.freeze(
    diagnostics.map((diagnostic) => {
      const rule = RULE_CATALOGUE.find((candidate) => candidate.id === diagnostic.rule);

      if (rule?.category !== "claude-compatibility" || diagnostic.severity !== "warning") {
        return diagnostic;
      }

      return Object.freeze({
        ...diagnostic,
        severity: "error" as const,
      });
    }),
  );
};
