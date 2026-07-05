/**
 * @file Production envelope scanner coverage over masking fixtures.
 */

import { describe, expect, it } from "bun:test";
import { createOriginalSourceFile, scanWorkflowEnvelope, sliceSourceSpan } from "odw-lint";
import { readFixtureSource } from "./fixtures/corpus-support";
import { MASKING_FIXTURE_SNAPSHOTS } from "./fixtures/masking";
import { MASKING_FIXTURE_CORPUS } from "./fixtures/masking/corpus";
import { expectScannedEnvelope } from "./workflow-envelope-support";

describe("source mask fixture envelope scanner", () => {
  it("finds real metadata declarations and hides inert envelope decoys", () => {
    for (const fixture of MASKING_FIXTURE_SNAPSHOTS) {
      const sourceText = readFixtureSource(MASKING_FIXTURE_CORPUS, fixture.fileName);
      const sourceFile = createOriginalSourceFile({
        filePath: fixture.fixturePath,
        sourceText,
      });
      const result = scanWorkflowEnvelope(sourceFile);
      const envelope = expectScannedEnvelope(result, fixture.fileName);

      expect(result.diagnostics).toEqual(fixture.expectedDiagnostics);

      expect(sliceSourceSpan(sourceFile, envelope.metaDeclarationSpan)).toBe("export const meta =");
    }
  });
});
