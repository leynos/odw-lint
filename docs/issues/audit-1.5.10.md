# Audit after roadmap task 1.5.10

This post-step audit was run after roadmap task 1.5.10 (`Add an executable
artefact check for recorded review evidence`) merged into `origin/main` at
commit `10594a6`. The audit used `grepai` against the canonical `main` index for
intent search, then verified every branch-local fact in a fresh worktree off
`origin/main` with `leta`, targeted file inspection, and exact text search.

Task 1.5.10 added a recording path for review-evidence reports
(`review-evidence-recording.ts`), a reviewer-run artefact gate
(`review-evidence-artefact-cli.ts`, `review-evidence-artefact.ts`,
`review-evidence-artefact-report.ts`), and a shared `report-format-helpers.ts`
module. The audit therefore concentrates on the new build-gate surface, then
extends across `src/static-analysis/` for a whole-codebase pass.

Normative references used:

- `AGENTS.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/scripting-standards.md`
- `docs/technical-design.md`
- `docs/issues/audit-1.5.9.md` (prior post-step audit, for continuity)

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- `grepai`: canonical `main` intent search.
- `leta`: branch-local symbol and source navigation.

## Finding 1: `parseFlagValue` is duplicated across the two evidence CLIs

Category: duplication

Severity: low

Location:

- `tests/build-gate/review-evidence-artefact-cli.ts:141`
- `tests/build-gate/review-evidence-cli.ts:320`

Description:

Task 1.5.10 introduced a second copy of the `--name=value` flag reader:

```ts
const parseFlagValue = (arg: string, prefix: string): string | undefined => {
  return arg.startsWith(prefix) ? arg.slice(prefix.length) : undefined;
};
```

It is byte-for-byte identical to the helper already present in
`review-evidence-cli.ts:320`. Both are private per-module copies, so the new
artefact CLI re-derived a helper the sibling gate already owned rather than
sharing one. This compounds the CLI-orchestration duplication that
`audit-1.5.9.md` Finding 3 already recorded against the same gate family.

Proposed fix:

Promote `parseFlagValue` to `tests/build-gate/cli-support.ts` (the shared
build-gate CLI seam) and import it from both evidence CLIs. This aligns with the
run-and-exit consolidation already scheduled as roadmap task 1.5.11.

## Finding 2: The `errorMessage` unknown-to-text helper is triplicated

Category: duplication

Severity: low

Location:

- `tests/build-gate/review-evidence-artefact-cli.ts:136`
- `tests/build-gate/review-evidence-recording.ts:79`
- `tests/build-gate/whitespace-hygiene.ts:92`

Description:

Three build-gate modules each carry a private helper that converts an unknown
thrown value into deterministic CLI text:

```ts
const errorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};
```

Task 1.5.10 added two of the three copies (`review-evidence-artefact-cli.ts`
and `review-evidence-recording.ts`); the third has existed since the whitespace
gate landed. The identical body has no shared home, so error-text policy for the
gate family is defined in three places.

Proposed fix:

Add a single `errorMessage` (or `errorText`) helper to
`tests/build-gate/report-format-helpers.ts` — which already hosts the shared
`singleLine` and `assertNever` formatting helpers — and delete the three private
copies. `report-format-helpers.ts` is the natural home because the recording
path already passes the result through `singleLine(errorMessage(error))`.

## Finding 3: `review-evidence-cli.ts` keeps a private `assertNever`

Category: inconsistency

Severity: low

Location:

- `tests/build-gate/review-evidence-cli.ts:347`
- `tests/build-gate/report-format-helpers.ts:29`

Description:

Task 1.5.10 introduced `report-format-helpers.ts`, which exports a shared
`assertNever(value, label)` used by `review-evidence-report.ts` and
`review-evidence-artefact-report.ts`. Yet `review-evidence-cli.ts:347` still
defines and calls its own single-argument variant:

```ts
const assertNever = (value: never): never => {
  throw new Error(`unhandled review evidence result: ${JSON.stringify(value)}`);
};
```

The module imports from `cli-support`, `git-support`, and several
`review-evidence-*` modules, but not from the new `report-format-helpers`, so it
diverged from the shared exhaustiveness helper the same change set created. Two
`assertNever` shapes now coexist in one gate family with different signatures.

Proposed fix:

Import `assertNever` from `report-format-helpers.ts` in `review-evidence-cli.ts`
and pass a `"review evidence result"` label, then delete the private variant.
This leaves one exhaustiveness helper for the whole build-gate family.

## Finding 4: Build-gate CLIs disagree on process-exit style

Category: inconsistency

Severity: low

Location:

- `tests/build-gate/review-evidence-artefact-cli.ts:146`
- `tests/build-gate/whitespace-hygiene.ts:97`
- `tests/build-gate/branch-freshness-git.ts:368`
- `tests/build-gate/review-evidence-cli.ts:352`

Description:

The four build-gate CLI module-main guards end two different ways.
`review-evidence-cli.ts` assigns `process.exitCode = runReviewEvidenceCli(...)`,
which lets Node drain buffered output before exiting. The other three, including
the artefact CLI that task 1.5.10 added, call `exit(run...())`, which requests
an immediate exit. On a pipe, `process.exit()` can truncate not-yet-flushed
`stdout` writes, so the two styles carry different output-delivery guarantees for
gates that all emit a report immediately before returning. The new artefact CLI
adopted the `exit()` form rather than the safer sibling pattern.

Proposed fix:

Standardise the module-main guards on `process.exitCode = run...()` (the form
that preserves buffered output), or fold the guard into a shared run-and-exit
helper in `cli-support.ts` so the exit contract is defined once. This is a
natural sub-goal of roadmap task 1.5.11.

## Finding 5: The artefact CLI `--evidence-path=` flag is undocumented

Category: docs-gap

Severity: low

Location:

- `docs/developers-guide.md:253`
- `tests/build-gate/review-evidence-artefact-cli.ts:61`

Description:

`runReviewEvidenceArtefactCli` accepts `--evidence-path=<path>` as a first-class
flag (`parseCliArgs`, `review-evidence-artefact-cli.ts:57`), and it is exercised
by tests (`review-evidence-artefact-cli.test.ts`). The developers guide
documents the artefact check's environment variable
(`ODW_LINT_REVIEW_EVIDENCE_PATH`) and its default
(`.review-evidence/report.txt`), but never the explicit flag. A reviewer
following the guide has no documented way to point the artefact check at an
ad-hoc path, even though the flag exists and is tested. This mirrors the
undocumented-flag pattern recorded in `audit-1.5.9.md` Finding 5.

Proposed fix:

Add `--evidence-path=<path>` to the `make review-evidence-artefact` paragraph of
`docs/developers-guide.md`, noting its precedence over the environment variable
and default, so the documented surface matches the tested one.

## Finding 6: Trailing-trivia trimming is duplicated between two scanners

Category: duplication

Severity: medium

Location:

- `src/static-analysis/workflow-metadata-parser-scan.ts:233`
- `src/static-analysis/workflow-envelope-meta-value.ts:234`

Description:

Two static-analysis modules define a trailing-whitespace trimmer whose body is
byte-for-byte identical, differing only in name:

```ts
// workflow-metadata-parser-scan.ts:233  (trimTrailingTriviaIndex)
// workflow-envelope-meta-value.ts:234   (trimTrailingWhitespaceIndex)
let trimmedEndIndex = endIndex;
while (trimmedEndIndex > startIndex && isWhitespaceCharacter(text[trimmedEndIndex - 1] ?? "")) {
  trimmedEndIndex -= 1;
}
return trimmedEndIndex;
```

Both take `(text, startIndex, endIndex)` and both rely on `isWhitespaceCharacter`.
Maintaining one trimming rule in two places risks the two spans-trimmers drifting
apart, which is exactly the drift class `audit-1.5.9.md` Finding 2 raised for the
low-level scanners.

Proposed fix:

Extract one `trimTrailingWhitespaceIndex(text, startIndex, endIndex)` helper into
a shared source-scanning module (for example alongside the existing
`workflow-metadata-comment-scan.ts` primitives) and have both call sites consume
it, deleting the duplicate.

## Finding 7: `workflow-envelope-meta-value.ts` re-implements exported comment scanners

Category: duplication

Severity: medium

Location:

- `src/static-analysis/workflow-envelope-meta-value.ts:122`
- `src/static-analysis/workflow-envelope-meta-value.ts:133`
- `src/static-analysis/workflow-metadata-comment-scan.ts:49`
- `src/static-analysis/workflow-metadata-comment-scan.ts:67`

Description:

`workflow-metadata-comment-scan.ts` already exports `scanLineCommentEnd` and
`scanBlockCommentEnd`. `workflow-envelope-meta-value.ts` imports `scanDelimitedEnd`
from that same module (line 12), yet defines its own private `scanLineCommentEnd`
(line 122) and `scanBlockCommentEnd` (line 133) that shadow the exported names.
The private copies also diverge in semantics: the local block-comment scanner
uses `text.indexOf("*/", startIndex)` and returns `text.length` on failure,
whereas the exported version loops to an explicit `endIndex` bound. Two comment
scanners with the same names and subtly different termination rules now live one
import apart.

Proposed fix:

Delete the two private scanners in `workflow-envelope-meta-value.ts` and call the
exported `scanLineCommentEnd` / `scanBlockCommentEnd` from
`workflow-metadata-comment-scan.ts`, threading the module's `endIndex` bound so
the shared, explicitly-bounded semantics apply uniformly.

## Finding 8: `validateSourceSpan` error branches lack direct behavioural tests

Category: test-gap

Severity: low

Location:

- `src/static-analysis/source-position.ts:151`

Description:

`validateSourceSpan` guards the diagnostics boundary with four distinct throw
branches: a non-span-like input, a reversed span (`end.offset < start.offset`),
a start-position mismatch, and an end-position mismatch (lines 152-168). The only
test-tree references to `validateSourceSpan` are in
`source-file-architecture.test.ts`, which asserts on the export/import structure
as string literals rather than exercising behaviour. The function is reached only
indirectly through `source-snippet.ts`, and there is no `source-snippet` test
file, so none of the four defensive branches has a direct behavioural test.
Sibling validators `positionAtOffset` and `spanFromOffsets` are, by contrast,
covered directly by both example and property tests.

Proposed fix:

Add a focused unit test for `validateSourceSpan` that drives each rejection
branch (missing positions, reversed offsets, mismatched start, mismatched end)
and the happy path, so the boundary guard has explicit coverage rather than
relying on indirect exercise.

## Finding 9: The metadata `ParserCursor` mixes mutation with query results

Category: cqs

Severity: low

Location:

- `src/static-analysis/workflow-metadata-parser.ts:28`

Description:

`ParserCursor` exposes a mutable `index` (line 31), and the recursive-descent
parse functions advance it in place (`cursor.index += 1` and `cursor.index =`
at lines 113, 119, 135, 178, 220, 229, 263, 285, ...) while simultaneously
returning `ValueParseResult` query values. Each parse helper therefore both
mutates shared cursor state and yields a result, so the "how far did we get"
side effect is implicit in the shared reference rather than in the return value.
This is idiomatic for hand-written parsers and is well tested, but the aliasing
of a single mutable cursor across many functions is a known footgun and blurs
command-query separation. Recorded here as a design-level observation, not a
defect.

Proposed fix:

If this area is revisited, consider a cursor-step shape that returns
`{ result, nextIndex }` (or a small class that owns advancement) so each parse
function is a query over an explicit position rather than a mutator of shared
state. Low priority: the current shape is contained within one module and
covered by the metadata-parser edge tests.

## Proposed roadmap items

Adding roadmap items is reserved to the root agent; the following are proposals
only.

### Consolidate build-gate CLI helper duplication

Rationale: task 1.5.10's new artefact CLI and recording module re-derived
`parseFlagValue`, `errorMessage`, and an `assertNever` variant, and the four gate
CLIs disagree on process-exit style. Lift these into `cli-support.ts` and
`report-format-helpers.ts` and standardise the module-main guard (this audit,
Findings 1-4). This extends and overlaps roadmap task 1.5.11 and `audit-1.5.9.md`
Finding 3.

Severity: low

### Unify the static-analysis trivia and comment scanners

Rationale: `workflow-metadata-parser-scan.ts` and `workflow-envelope-meta-value.ts`
duplicate the trailing-trivia trimmer, and `workflow-envelope-meta-value.ts`
re-implements the already-exported line and block comment scanners with divergent
termination rules. Share one trimmer and the exported comment scanners (this
audit, Findings 6-7). This continues the scanner-consolidation direction of
`audit-1.5.9.md` Finding 2.

Severity: medium

### Add direct coverage for source-position validators

Rationale: `validateSourceSpan` guards the diagnostics boundary with four
rejection branches that are exercised only indirectly, and `spanFromTextIndexes`
has no direct behavioural test despite heavy production use. Add focused unit
tests for these validators (this audit, Finding 8).

Severity: low
