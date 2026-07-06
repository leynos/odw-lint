/**
 * @file Output-format parsing for the `check` command.
 */

export type CheckOutputFormat = "full" | "json";

/** Parse the implemented output formats from the wider planned flag surface. */
const parseOutputFormat = (
  value: string,
):
  | { readonly ok: true; readonly outputFormat: CheckOutputFormat }
  | { readonly ok: false; readonly usageError: string } => {
  if (value === "full" || value === "json") {
    return { ok: true, outputFormat: value };
  }

  return { ok: false, usageError: `unsupported output format: ${value}` };
};

/**
 * Parse a required output-format option value.
 *
 * @param value Raw option value supplied after `--output-format`.
 * @returns Parsed format or a stable usage error.
 */
export const parseOutputFormatValue = (
  value: string | undefined,
):
  | { readonly ok: true; readonly outputFormat: CheckOutputFormat }
  | { readonly ok: false; readonly usageError: string } => {
  if (value === undefined) {
    return { ok: false, usageError: "unsupported output format: " };
  }

  return parseOutputFormat(value);
};
