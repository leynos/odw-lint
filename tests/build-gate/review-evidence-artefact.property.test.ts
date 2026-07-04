/**
 * @file Property tests for recorded review-evidence artefacts.
 */

import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import type { GateExecution, ReviewEvidenceResult, ReviewPathSelection } from "./review-evidence";
import {
  classifyBoundEvidence,
  classifyRecordedEvidence,
  type RecordedStatus,
} from "./review-evidence-artefact";
import { formatProvenanceTrailer, type TreeProvenance } from "./review-evidence-provenance";
import { formatReviewEvidenceResult } from "./review-evidence-report";

type TerminalReviewEvidenceResult = Extract<ReviewEvidenceResult, { status: RecordedStatus }>;

const gateExecutions = [
  { gate: "make all", status: "passed" },
  { gate: "make markdownlint", status: "passed" },
  { gate: "make nixie", status: "passed" },
] satisfies readonly GateExecution[];
const primaryReviewPath = {
  selected: "scrutineer",
  reason: "scrutineer available",
  isFallback: false,
  isDegraded: false,
} satisfies ReviewPathSelection;
const detailText = fc.string({ minLength: 1, maxLength: 48 });

describe("recorded evidence artefact properties", () => {
  it("round-trips every terminal review-evidence report status", () => {
    fc.assert(
      fc.property(terminalResult(), (result) => {
        const recorded = classifyRecordedEvidence({
          path: "recorded.txt",
          content: formatReviewEvidenceResult(result),
        });

        expect(recorded).toEqual({
          outcome: "present",
          path: "recorded.txt",
          status: result.status,
        });
      }),
      { seed: 0x1510, numRuns: 60 },
    );
  });

  it("classifies complete reports with matching trailers as present", () => {
    fc.assert(
      fc.property(terminalResult(), treeProvenance(), (result, provenance) => {
        const content = `${formatReviewEvidenceResult(result)}${formatProvenanceTrailer(provenance)}`;

        expect(
          classifyBoundEvidence({
            path: "recorded.txt",
            content,
            current: provenance,
          }),
        ).toEqual({
          outcome: "present",
          path: "recorded.txt",
          status: result.status,
          provenance,
        });
      }),
      { seed: 0x1512, numRuns: 60 },
    );
  });
});

/** Generate terminal review-evidence results supported by the recorder. */
const terminalResult = (): fc.Arbitrary<TerminalReviewEvidenceResult> => {
  return fc.oneof(
    detailText.map<TerminalReviewEvidenceResult>((reason) => ({
      status: "verified",
      executions: gateExecutions,
      reviewPath: {
        ...primaryReviewPath,
        reason,
      },
    })),
    detailText.map<TerminalReviewEvidenceResult>((detail) => ({
      status: "failed",
      executions: [{ gate: "make all", status: "failed", exitCode: 1, detail }],
      reviewPath: primaryReviewPath,
      failedGates: ["make all"],
    })),
    detailText.map<TerminalReviewEvidenceResult>((reason) => ({
      status: "degraded",
      executions: gateExecutions,
      reviewPath: primaryReviewPath,
      reasons: [reason],
    })),
  );
};

/** Generate Git object ids accepted by provenance formatting. */
const gitObjectId = (): fc.Arbitrary<string> => {
  return fc
    .array(fc.constantFrom(...[..."0123456789abcdef"]), { minLength: 40, maxLength: 40 })
    .map((characters) => characters.join(""));
};

/** Generate reviewed tree provenance values accepted by the report trailer. */
const treeProvenance = (): fc.Arbitrary<TreeProvenance> => {
  return fc.record({
    commit: gitObjectId(),
    tree: gitObjectId(),
  });
};
