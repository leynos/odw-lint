/**
 * @file JSON Schema contract for diagnostic report envelopes.
 *
 * The schema is exported as a literal object so reporter and CLI boundaries can
 * share a stable contract without adding a runtime validator dependency.
 */

import { DIAGNOSTIC_SEVERITIES } from "./severity";
import { DIAGNOSTIC_SCHEMA_VERSION, TOOL_NAME } from "./types";

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
        files: { type: "integer", minimum: 0 },
        errors: { type: "integer", minimum: 0 },
        warnings: { type: "integer", minimum: 0 },
        infos: { type: "integer", minimum: 0 },
        hints: { type: "integer", minimum: 0 },
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
          file: { type: "string" },
          rule: { type: "string" },
          severity: { enum: DIAGNOSTIC_SEVERITIES },
          message: { type: "string" },
          span: {
            type: "object",
            required: ["start", "end"],
            additionalProperties: false,
            properties: {
              start: {
                type: "object",
                required: ["offset", "line", "column"],
                additionalProperties: false,
                properties: {
                  offset: { type: "integer", minimum: 0 },
                  line: { type: "integer", minimum: 1 },
                  column: { type: "integer", minimum: 1 },
                },
              },
              end: {
                type: "object",
                required: ["offset", "line", "column"],
                additionalProperties: false,
                properties: {
                  offset: { type: "integer", minimum: 0 },
                  line: { type: "integer", minimum: 1 },
                  column: { type: "integer", minimum: 1 },
                },
              },
            },
          },
          docs: { type: "string" },
          suggestions: {
            type: "array",
            minItems: 0,
            items: {
              type: "object",
              required: ["message"],
              additionalProperties: false,
              properties: {
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;
