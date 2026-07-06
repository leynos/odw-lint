/**
 * @file Informational option recognition for the `check` command.
 */

export type CheckInformationalAction = "help" | "version";

const HELP_OPTIONS = new Set(["--help", "-h"]);
const VERSION_OPTIONS = new Set(["--version", "-V"]);

/**
 * Return the first informational action requested by an invocation.
 *
 * @param args Command-line arguments excluding `bun` and the script path.
 * @returns The selected informational action, when one was requested.
 */
export const informationalActionFor = (
  args: readonly string[],
): CheckInformationalAction | undefined => {
  for (const token of args) {
    if (HELP_OPTIONS.has(token)) {
      return "help";
    }
    if (VERSION_OPTIONS.has(token)) {
      return "version";
    }
  }

  return undefined;
};
