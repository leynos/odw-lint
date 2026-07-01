/**
 * @file Diagnostic JSON Schema contract tests.
 */

import { describe, expect, it } from "bun:test";
import { DIAGNOSTIC_REPORT_SCHEMA, DIAGNOSTIC_SEVERITIES, RULE_IDS } from "odw-lint";

const diagnosticItemSchema = DIAGNOSTIC_REPORT_SCHEMA.properties.diagnostics.items;
const sourceSpanSchema = diagnosticItemSchema.properties.span;

describe("diagnostic JSON Schema", () => {
  it("uses the same severity values as the TypeScript model", () => {
    expect(diagnosticItemSchema.properties.severity.enum).toBe(DIAGNOSTIC_SEVERITIES);
  });

  it("uses the same rule identifiers as the catalogue", () => {
    expect(diagnosticItemSchema.properties.rule.enum).toBe(RULE_IDS);
  });

  it("constrains diagnostic docs to repository-relative rule pages", () => {
    expect(diagnosticItemSchema.properties.docs).toEqual({
      type: "string",
      pattern: "^docs/rules/[a-z0-9]+(?:-[a-z0-9]+)*\\.md$",
    });
  });

  it("requires the documented top-level envelope keys", () => {
    expect(DIAGNOSTIC_REPORT_SCHEMA.required).toEqual([
      "schemaVersion",
      "tool",
      "summary",
      "diagnostics",
    ]);
  });

  it("matches the summary shape and constrains counts to non-negative integers", () => {
    const summarySchema = DIAGNOSTIC_REPORT_SCHEMA.properties.summary;

    expect(summarySchema.required).toEqual(["files", "errors", "warnings", "infos", "hints"]);
    expect(Object.keys(summarySchema.properties)).toEqual([
      "files",
      "errors",
      "warnings",
      "infos",
      "hints",
    ]);

    for (const countSchema of Object.values(summarySchema.properties)) {
      expect(countSchema).toEqual({ type: "integer", minimum: 0 });
    }
  });

  it("encodes source-position minimums for start and end positions", () => {
    const startPositionSchema = sourceSpanSchema.properties.start;
    const endPositionSchema = sourceSpanSchema.properties.end;

    expect(startPositionSchema.required).toEqual(endPositionSchema.required);
    expect(Object.keys(startPositionSchema.properties)).toEqual(
      Object.keys(endPositionSchema.properties),
    );

    for (const positionSchema of [startPositionSchema, endPositionSchema]) {
      expect(positionSchema.properties.offset.minimum).toBe(0);
      expect(positionSchema.properties.line.minimum).toBe(1);
      expect(positionSchema.properties.column.minimum).toBe(1);
    }
  });

  it("rejects additional properties on every owned object schema", () => {
    const ownedObjectSchemas = [
      DIAGNOSTIC_REPORT_SCHEMA,
      DIAGNOSTIC_REPORT_SCHEMA.properties.tool,
      DIAGNOSTIC_REPORT_SCHEMA.properties.summary,
      diagnosticItemSchema,
      sourceSpanSchema,
      sourceSpanSchema.properties.start,
      sourceSpanSchema.properties.end,
      diagnosticItemSchema.properties.suggestions.items,
    ];

    for (const objectSchema of ownedObjectSchemas) {
      expect(objectSchema.additionalProperties).toBeFalse();
    }
  });

  it("matches the reviewed schema snapshot", () => {
    expect(DIAGNOSTIC_REPORT_SCHEMA).toMatchSnapshot();
  });
});
