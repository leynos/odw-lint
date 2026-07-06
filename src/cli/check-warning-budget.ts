/**
 * @file Warning-budget option parsing for the `check` command.
 */

/**
 * Parse a required non-negative integer warning-budget option value.
 *
 * @param value Raw option value supplied after `--max-warnings`.
 * @returns Parsed warning budget or a stable usage error.
 */
export const parseMaxWarningsValue = (
  value: string | undefined,
):
  | { readonly ok: true; readonly maxWarnings: number }
  | { readonly ok: false; readonly usageError: string } => {
  if (value === undefined) {
    return { ok: false, usageError: "missing value for --max-warnings" };
  }

  if (!/^\d+$/.test(value)) {
    return { ok: false, usageError: `invalid value for --max-warnings: ${value}` };
  }

  const maxWarnings = Number.parseInt(value, 10);
  return Number.isSafeInteger(maxWarnings)
    ? { ok: true, maxWarnings }
    : { ok: false, usageError: `invalid value for --max-warnings: ${value}` };
};
