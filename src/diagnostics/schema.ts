/**
 * @file JSON Schema contract for diagnostic report envelopes.
 *
 * The schema is exported as a literal object so reporter and CLI boundaries can
 * share a stable contract without adding a runtime validator dependency.
 */

import { DIAGNOSTIC_SEVERITIES } from "./severity";
import { DIAGNOSTIC_SCHEMA_VERSION, TOOL_NAME } from "./types";

const stringSchema = { type: "string" } as const;
const nonNegativeIntegerSchema = { type: "integer", minimum: 0 } as const;
const oneBasedIntegerSchema = { type: "integer", minimum: 1 } as const;

const sourcePositionSchema = {
  type: "object",
  required: ["offset", "line", "column"],
  additionalProperties: false,
  properties: {
    offset: nonNegativeIntegerSchema,
    line: oneBasedIntegerSchema,
    column: oneBasedIntegerSchema,
  },
} as const;

const sourceSpanSchema = {
  type: "object",
  required: ["start", "end"],
  additionalProperties: false,
  properties: {
    start: sourcePositionSchema,
    end: sourcePositionSchema,
  },
} as const;

const diagnosticSuggestionSchema = {
  type: "object",
  required: ["message"],
  additionalProperties: false,
  properties: {
    message: stringSchema,
  },
} as const;

/**
 * JSON Schema for the diagnostic report envelope.
 */
export const DIAGNOSTIC_REPORT_SCHEMA = {
  type: "object",
  required: ["schemaVersion", "tool", "summary", "diagnostics"],
  additionalProperties: false,
  properties: {
    schemaVersion: { enum: [DIAGNOSTIC_SCHEMA_VERSION] },
    tool: {
      type: "object",
      required: ["name", "version"],
      additionalProperties: false,
      properties: {
        name: { enum: [TOOL_NAME] },
        version: { type: "string" },
      },
    },
    summary: {
      type: "object",
      required: ["files", "errors", "warnings", "infos", "hints"],
      additionalProperties: false,
      properties: {
        files: nonNegativeIntegerSchema,
        errors: nonNegativeIntegerSchema,
        warnings: nonNegativeIntegerSchema,
        infos: nonNegativeIntegerSchema,
        hints: nonNegativeIntegerSchema,
      },
    },
    diagnostics: {
      type: "array",
      minItems: 0,
      items: {
        type: "object",
        required: ["file", "rule", "severity", "message", "span"],
        additionalProperties: false,
        properties: {
          file: stringSchema,
          rule: stringSchema,
          severity: { enum: DIAGNOSTIC_SEVERITIES },
          message: stringSchema,
          span: sourceSpanSchema,
          docs: stringSchema,
          suggestions: {
            type: "array",
            minItems: 0,
            items: diagnosticSuggestionSchema,
          },
        },
      },
    },
  },
} as const;
