/**
 * @file Characterization tests for SWC parser syntax-error objects.
 *
 * Pins the `@swc/core@1.15.43` parser-error surface so dependency upgrades
 * cannot silently change body-syntax span fallback behaviour.
 */

import { describe, expect, it } from "bun:test";
import { createOriginalSourceFile, normalizeWorkflowBody, scanWorkflowEnvelope } from "odw-lint";
import { isFiniteNumber, isUnknownRecord } from "../../src/static-analysis/value-guards";
import { PARSER_ERROR_STRUCTURED_RANGE_FIELDS } from "../../src/static-analysis/workflow-body-parser-spans";
import { catchSwcParseError } from "./swc-parse-error-support";
import { expectScannedEnvelope } from "./workflow-envelope-support";

/** Checks whether an unknown value is a numeric structured byte range. */
const isStructuredNumericRange = (value: unknown): boolean => {
  if (!isUnknownRecord(value)) {
    return false;
  }

  const { start, end } = value;
  return isFiniteNumber(start) && isFiniteNumber(end);
};

/** Describes allow-listed fields so future parser-surface drift is visible. */
const structuredParserOffsetSurface = (error: unknown): Record<string, string> => {
  return Object.fromEntries(
    PARSER_ERROR_STRUCTURED_RANGE_FIELDS.map((field) => {
      const value = isUnknownRecord(error) ? error[field] : undefined;

      if (isFiniteNumber(value)) {
        return [field, "finite-number"];
      }
      if (isStructuredNumericRange(value)) {
        return [field, "numeric-range"];
      }
      if (value === undefined) {
        return [field, "absent"];
      }

      return [field, typeof value];
    }),
  );
};

/** Returns whether an error-like object exposes any allow-listed offset field. */
const hasStructuredParserOffset = (error: unknown): boolean => {
  return Object.values(structuredParserOffsetSurface(error)).some((status) =>
    ["finite-number", "numeric-range"].includes(status),
  );
};

/** Builds one normalized malformed workflow body for SWC surface checks. */
const malformedNormalizedBody = (): string => {
  const sourceFile = createOriginalSourceFile({
    filePath: "workflows/broken.js",
    sourceText:
      'export const meta = { name: "broken", description: "broken" };\nawait agent("draft"\n',
  });
  const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile), sourceFile.filePath);
  const normalized = normalizeWorkflowBody(envelope);

  return normalized.normalizedText;
};

describe("SWC parse-error surface", () => {
  it("exposes rendered prose but no structured numeric byte offset", () => {
    const error = catchSwcParseError(malformedNormalizedBody());

    expect(error).toBeInstanceOf(Error);
    expect(error).toHaveProperty("message", expect.any(String));
    expect((error as Error).message.length).toBeGreaterThan(0);
    expect(structuredParserOffsetSurface(error)).toMatchInlineSnapshot(`
      {
        "byteOffset": "absent",
        "offset": "absent",
        "pos": "absent",
        "span": "absent",
        "start": "absent",
      }
    `);
    expect(hasStructuredParserOffset(error)).toBe(false);
  });
});
