/**
 * @file Informational option recognition for the `check` command.
 */

import { STRING_VALUE_OPTIONS } from "./check-option-tables";

export type CheckInformationalAction = "help" | "version";

const HELP_OPTIONS = new Set(["--help", "-h"]);
const VERSION_OPTIONS = new Set(["--version", "-V"]);
const VALUE_TAKING_OPTIONS = new Set([
  "--output-format",
  "--max-warnings",
  ...STRING_VALUE_OPTIONS.keys(),
]);

/**
 * Return the first informational action requested before path operands.
 *
 * @param args Command-line arguments excluding `bun` and the script path.
 * @returns The selected informational action, when one was requested.
 */
export const informationalActionFor = (
  args: readonly string[],
): CheckInformationalAction | undefined => {
  const tokens = args[0] === "check" ? args.slice(1) : args;
  let shouldTreatTokenAsValue = false;

  for (const token of tokens) {
    if (shouldTreatTokenAsValue) {
      shouldTreatTokenAsValue = false;
      continue;
    }

    if (!token.startsWith("-")) {
      return undefined;
    }

    if (HELP_OPTIONS.has(token)) {
      return "help";
    }
    if (VERSION_OPTIONS.has(token)) {
      return "version";
    }
    if (VALUE_TAKING_OPTIONS.has(token)) {
      shouldTreatTokenAsValue = true;
    }
  }

  return undefined;
};
