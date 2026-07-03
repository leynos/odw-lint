/**
 * @file Characterization tests for SWC parser syntax-error objects.
 *
 * Pins the `@swc/core@1.15.43` parser-error surface so dependency upgrades
 * cannot silently change body-syntax span fallback behaviour.
 */

import { describe, expect, it } from "bun:test";
import { parseSync } from "@swc/core";
import { createOriginalSourceFile, normalizeWorkflowBody, scanWorkflowEnvelope } from "odw-lint";
import { expectScannedEnvelope } from "./workflow-envelope-support";

const PARSE_OPTIONS = {
  syntax: "ecmascript",
  jsx: false,
} as const;
const STRUCTURED_OFFSET_FIELDS = ["span", "byteOffset", "pos", "start", "offset"] as const;

type UnknownRecord = {
  readonly [key: string]: unknown;
};

/** Checks whether an unknown value can be inspected as an object record. */
const isUnknownRecord = (value: unknown): value is UnknownRecord => {
  return typeof value === "object" && value !== null;
};

/** Checks whether an unknown value is a finite numeric parser offset. */
const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

/** Checks whether an unknown value is a numeric structured byte range. */
const isStructuredNumericRange = (value: unknown): boolean => {
  if (!isUnknownRecord(value)) {
    return false;
  }

  return isFiniteNumber(value["start"]) && isFiniteNumber(value["end"]);
};

/** Describes allow-listed fields so future parser-surface drift is visible. */
const structuredParserOffsetSurface = (error: unknown): Record<string, string> => {
  return Object.fromEntries(
    STRUCTURED_OFFSET_FIELDS.map((field) => {
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

/** Captures the thrown value from parsing one normalized malformed body. */
const catchSwcParseError = (): unknown => {
  const sourceFile = createOriginalSourceFile({
    filePath: "workflows/broken.js",
    sourceText:
      'export const meta = { name: "broken", description: "broken" };\nawait agent("draft"\n',
  });
  const envelope = expectScannedEnvelope(scanWorkflowEnvelope(sourceFile), sourceFile.filePath);
  const normalized = normalizeWorkflowBody(envelope);

  try {
    parseSync(normalized.normalizedText, PARSE_OPTIONS);
  } catch (error) {
    return error;
  }

  throw new Error("Expected SWC to reject the malformed normalized body.");
};

describe("SWC parse-error surface", () => {
  it("exposes rendered prose but no structured numeric byte offset", () => {
    const error = catchSwcParseError();

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
