/**
 * @file Syntax-error invalid workflow fixture manifest entries.
 */

import {
  diagnostic,
  type InvalidWorkflowFixtureSnapshot,
  invalidWorkflowFixture,
} from "../manifest-types";

export const SYNTAX_ERROR_FIXTURES = [
  invalidWorkflowFixture({
    family: "syntax-error",
    fileName: "body-unclosed-block.js",
    sha256: "ce51953f1fd6dad5034ca5fe1c81b2b1b062366f10e1d18454a67610c706064b",
    expectedStatus: "error",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/body-syntax",
        severity: "error",
        message: "Workflow body must be syntactically complete after ODW normalization.",
        span: {
          start: { offset: 145, line: 7, column: 17 },
          end: { offset: 179, line: 9, column: 1 },
        },
        spanText: '{\n  await agent("Draft status.");\n',
      }),
    ],
  }),
  invalidWorkflowFixture({
    family: "syntax-error",
    fileName: "body-unclosed-call.js",
    sha256: "4890d45d55504f7af77bd1ab4a6b9ec6f67e8e53458a8643185d3e4f7073595c",
    expectedStatus: "error",
    expectedDiagnostics: [
      diagnostic({
        rule: "odw/body-syntax",
        severity: "error",
        message: "Workflow body must be syntactically complete after ODW normalization.",
        span: {
          start: { offset: 133, line: 7, column: 7 },
          end: { offset: 147, line: 8, column: 1 },
        },
        spanText: 'agent("draft"\n',
      }),
    ],
  }),
] satisfies readonly InvalidWorkflowFixtureSnapshot[];
