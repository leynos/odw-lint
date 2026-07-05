/**
 * @file Shared ADR 0002 workflow-body dialect fixtures.
 */

/**
 * Labelled workflow body fixture entry used by ADR 0002 dialect tests.
 */
export type DialectBodyFixture = readonly [label: string, body: string];

/**
 * TypeScript-only workflow body examples that ODW rejects as JavaScript syntax.
 */
export const TYPESCRIPT_ONLY_DIALECT_BODIES = [
  ["variable type annotation", "const value: number = 1;\nreturn value;"],
  [
    "parameter type annotation",
    "function typed(value: number) { return value; }\nreturn typed(1);",
  ],
  ["interface declaration", "interface Shape { size: number }\nreturn 1;"],
  ["enum declaration", "enum Mode { On }\nreturn Mode.On;"],
  ["as type assertion", "const value = 1 as number;\nreturn value;"],
  ["satisfies operator", "const value = 1 satisfies number;\nreturn value;"],
] as const satisfies readonly DialectBodyFixture[];

/**
 * ECMAScript bodies that mark the accepted side of ADR 0002's syntax boundary.
 */
export const ACCEPTED_ECMASCRIPT_BOUNDARY_BODIES = [
  ["plain assignment", "const value = 1;\nreturn value;"],
  // ADR 0002 records this as accepted because `<` and `>` parse as relational
  // operators, not TypeScript generic call syntax.
  ["generic-call comparison", "const value = identity<number>(1);\nreturn value;"],
] as const satisfies readonly DialectBodyFixture[];
