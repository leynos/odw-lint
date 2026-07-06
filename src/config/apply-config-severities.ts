/**
 * @file Apply configured rule severities to inert diagnostic data.
 *
 * This transform runs after diagnostics are produced and before
 * `promoteStrictClaudeSeverity`. That order lets `off` suppression win over
 * strict-Claude promotion while still allowing configured warnings to be
 * promoted when strict Claude mode is enabled.
 */

import type { RuleId } from "../diagnostics/rule-id";
import type { Diagnostic } from "../diagnostics/types";
import type { ConfiguredRuleSeverity } from "./linter-config";

/**
 * Applies configured rule severity overrides to diagnostics.
 *
 * @param diagnostics Diagnostics emitted by the lint pipeline.
 * @param rules Validated per-rule severity settings from configuration.
 * @returns A frozen diagnostics array with configured overrides applied.
 *
 * @example
 * ```ts
 * const diagnostics = applyConfiguredRuleSeverities(rawDiagnostics, config.rules);
 * ```
 */
export const applyConfiguredRuleSeverities = (
  diagnostics: readonly Diagnostic[],
  rules?: ReadonlyMap<RuleId, ConfiguredRuleSeverity>,
): readonly Diagnostic[] => {
  if (rules === undefined || rules.size === 0) {
    return Object.freeze([...diagnostics]);
  }

  return Object.freeze(
    diagnostics.flatMap((diagnostic) => {
      const configuredSeverity = rules.get(diagnostic.rule);

      if (configuredSeverity === undefined) {
        return [diagnostic];
      }

      if (configuredSeverity === "off") {
        return [];
      }

      return [
        Object.freeze({
          ...diagnostic,
          severity: configuredSeverity,
        }),
      ];
    }),
  );
};
