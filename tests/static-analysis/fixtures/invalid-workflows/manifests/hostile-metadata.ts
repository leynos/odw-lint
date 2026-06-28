/**
 * @file Hostile metadata invalid workflow fixture manifest entries.
 */

import {
  diagnostic,
  type InvalidWorkflowFixtureSnapshot,
  invalidWorkflowFixture,
} from "../manifest-types";

export const HOSTILE_METADATA_FIXTURES = [
  invalidWorkflowFixture({
    family: "hostile-metadata",
    fileName: "global-marker.js",
    sha256: "af52ec3eea9c361ed0b5bd98263ea76e40a2bf202d5c35074962b1dddb0dcfa3",
    expectedStatus: "warning",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/meta-statically-unprovable",
        severity: "warning",
        message: "Workflow metadata must remain statically provable without evaluation.",
        span: {
          start: { offset: 70, line: 3, column: 16 },
          end: { offset: 204, line: 6, column: 7 },
        },
        spanText:
          '(() => {\n    globalThis.__odwLintHostileMetadataWasEvaluated = "hostile-global-marker";\n    return "Hostile metadata fixture.";\n  })()',
      }),
    ],
  }),
  invalidWorkflowFixture({
    family: "hostile-metadata",
    fileName: "throw-marker.js",
    sha256: "859aa4e942c7db65de27f225232b9c244ad607da20fc07c913201e2d6074600d",
    expectedStatus: "warning",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/meta-statically-unprovable",
        severity: "warning",
        message: "Workflow metadata must remain statically provable without evaluation.",
        span: {
          start: { offset: 69, line: 3, column: 16 },
          end: { offset: 144, line: 5, column: 7 },
        },
        spanText: '(() => {\n    throw new Error("ODW_LINT_HOSTILE_METADATA_EVALUATED");\n  })()',
      }),
    ],
  }),
] satisfies readonly InvalidWorkflowFixtureSnapshot[];
