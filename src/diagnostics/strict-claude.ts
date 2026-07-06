/**
 * @file Strict-Claude diagnostic severity promotion.
 *
 * The transform is intentionally inert: it inspects only catalogued diagnostic
 * metadata and already-produced diagnostics. It never imports or evaluates
 * workflow source.
 */

import { findRuleDefinition } from "./rule-catalogue";
import type { Diagnostic } from "./types";

/**
 * Catalogue-backed policy used by strict Claude portability mode.
 */
export const STRICT_CLAUDE_PROMOTION_POLICY = Object.freeze({
  category: "claude-compatibility",
  fromSeverity: "warning",
  toSeverity: "error",
} as const);

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
      const rule = findRuleDefinition(diagnostic.rule);

      if (
        rule?.category !== STRICT_CLAUDE_PROMOTION_POLICY.category ||
        diagnostic.severity !== STRICT_CLAUDE_PROMOTION_POLICY.fromSeverity
      ) {
        return diagnostic;
      }

      return Object.freeze({
        ...diagnostic,
        severity: STRICT_CLAUDE_PROMOTION_POLICY.toSeverity,
      });
    }),
  );
};
