/**
 * @file Meta-tests for invalid workflow diagnostic expectation sources.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const MANIFEST_DERIVED_INVALID_FIXTURE_SUITES = [
  "tests/static-analysis/workflow-body-parser.test.ts",
  "tests/static-analysis/workflow-envelope-fixtures.test.ts",
  "tests/static-analysis/invalid-workflow-metadata-parity.test.ts",
] as const;
const DIAGNOSTIC_EXPECTATION_KEYS = new Set(["rule", "severity", "message", "spanText"]);

type InlineDiagnosticLiteral = {
  readonly filePath: string;
  readonly line: number;
  readonly column: number;
  readonly key: string;
};

/** Returns a stable display location for one source node. */
const nodeLocation = (sourceFile: ts.SourceFile, node: ts.Node) => {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

  return {
    line: position.line + 1,
    column: position.character + 1,
  };
};

/** Reports whether a property key is one of the diagnostic expectation fields. */
const diagnosticExpectationKey = (name: ts.PropertyName): string | undefined => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return DIAGNOSTIC_EXPECTATION_KEYS.has(name.text) ? name.text : undefined;
  }

  return undefined;
};

/** Finds hand-written diagnostic expectation literals in manifest-derived suites. */
const inlineDiagnosticLiteralsIn = (filePath: string): readonly InlineDiagnosticLiteral[] => {
  const sourceText = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const literals: InlineDiagnosticLiteral[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && ts.isStringLiteralLike(node.initializer)) {
      const key = diagnosticExpectationKey(node.name);

      if (key !== undefined) {
        literals.push({
          filePath,
          ...nodeLocation(sourceFile, node.name),
          key,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return literals;
};

describe("invalid workflow fixture diagnostic expectation sources", () => {
  it("keeps manifest-derived suites free of inline diagnostic literals", () => {
    const inlineLiterals = MANIFEST_DERIVED_INVALID_FIXTURE_SUITES.flatMap((filePath) =>
      inlineDiagnosticLiteralsIn(filePath),
    );

    expect(inlineLiterals).toEqual([]);
  });
});
