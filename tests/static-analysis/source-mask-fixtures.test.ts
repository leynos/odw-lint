/**
 * @file Test-only source-mask probe over synthetic masking fixtures.
 */

import { describe, expect, it } from "bun:test";
import { createOriginalSourceFile, maskNonCodeSource } from "odw-lint";
import ts from "typescript";
import { readFixtureSource } from "./fixtures/corpus-support";
import { MASKING_FIXTURE_SNAPSHOTS } from "./fixtures/masking";

const FIXTURE_CORPUS = { fixtureDirectory: new URL("./fixtures/masking/", import.meta.url) };
const META_EXPORT_PATTERN = /\bexport\s+const\s+meta\s*=/u;
const IMPORT_EXPORT_PATTERN = /\b(?:import|export)\b/u;

type TestEnvelopeDiagnostic = "odw/meta-required" | "odw/meta-object" | "odw/no-import-export";

type MetaProbeResult = {
  readonly metaName: string | undefined;
  readonly diagnostics: readonly TestEnvelopeDiagnostic[];
};

/** Runs the narrow test-only envelope probe over one fixture source. */
const probeMaskedEnvelope = (filePath: string, sourceText: string): MetaProbeResult => {
  const sourceFile = createOriginalSourceFile({ filePath, sourceText });
  const maskedSource = maskNonCodeSource(sourceFile);
  const metaMatch = META_EXPORT_PATTERN.exec(maskedSource.maskedText);

  if (metaMatch === null) {
    return { metaName: undefined, diagnostics: ["odw/meta-required"] };
  }

  const metaStartIndex = metaMatch.index;
  const objectStartIndex = maskedSource.maskedText.indexOf(
    "{",
    metaStartIndex + metaMatch[0].length,
  );
  const objectEndIndex = matchingBraceEndIndex(maskedSource.maskedText, objectStartIndex);
  if (objectStartIndex === -1 || objectEndIndex === undefined) {
    return { metaName: undefined, diagnostics: ["odw/meta-object"] };
  }

  const metaName = staticMetaName(sourceText.slice(objectStartIndex, objectEndIndex));
  const diagnostics: readonly TestEnvelopeDiagnostic[] =
    metaName === undefined ? ["odw/meta-object"] : [];
  const envelopeDiagnostics = unsupportedImportExportDiagnostics(
    maskedSource.maskedText,
    metaStartIndex,
    metaStartIndex + "export".length,
  );

  return { metaName, diagnostics: [...diagnostics, ...envelopeDiagnostics] };
};

/** Finds the exclusive end index for a balanced object literal. */
const matchingBraceEndIndex = (maskedText: string, startIndex: number): number | undefined => {
  if (startIndex < 0) {
    return undefined;
  }

  let depth = 0;
  for (let index = startIndex; index < maskedText.length; index += 1) {
    const character = maskedText[index];
    if (character === "{") {
      depth += 1;
    }
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }

  return undefined;
};

/** Extracts a static string `name` property without evaluating source. */
const staticMetaName = (objectLiteralSource: string): string | undefined => {
  const parsed = ts.createSourceFile(
    "meta-probe.ts",
    `const meta = (${objectLiteralSource});`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const statement = parsed.statements[0];
  if (statement === undefined) {
    return undefined;
  }
  if (!ts.isVariableStatement(statement)) {
    return undefined;
  }

  const initializer = statement.declarationList.declarations[0]?.initializer;
  if (initializer === undefined || !ts.isParenthesizedExpression(initializer)) {
    return undefined;
  }

  return objectLiteralName(initializer.expression);
};

/** Extracts the `name` property from a test-only object literal AST. */
const objectLiteralName = (expression: ts.Expression): string | undefined => {
  if (!ts.isObjectLiteralExpression(expression)) {
    return undefined;
  }

  for (const property of expression.properties) {
    if (!ts.isPropertyAssignment(property) || !isNameProperty(property.name)) {
      continue;
    }
    if (ts.isStringLiteral(property.initializer)) {
      return property.initializer.text;
    }
  }

  return undefined;
};

/** Checks whether an object-literal property name is the static key `name`. */
const isNameProperty = (name: ts.PropertyName): boolean => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text === "name";
  }

  return false;
};

/** Reports leftover import/export tokens after blanking the real meta export. */
const unsupportedImportExportDiagnostics = (
  maskedText: string,
  exportStartIndex: number,
  exportEndIndex: number,
): readonly TestEnvelopeDiagnostic[] => {
  const characters = maskedText.split("");
  for (let index = exportStartIndex; index < exportEndIndex; index += 1) {
    characters[index] = " ";
  }

  return IMPORT_EXPORT_PATTERN.test(characters.join("")) ? ["odw/no-import-export"] : [];
};

describe("source mask fixture envelope probe", () => {
  it("extracts real metadata names and hides inert envelope decoys", () => {
    for (const fixture of MASKING_FIXTURE_SNAPSHOTS) {
      const sourceText = readFixtureSource(FIXTURE_CORPUS, fixture.fileName);
      const result = probeMaskedEnvelope(fixture.fixturePath, sourceText);

      expect(result.metaName).toBe(fixture.metaName);
      expect(result.diagnostics).toEqual(fixture.expectedDiagnostics);
    }
  });
});
