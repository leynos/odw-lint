# Consume invalid fixture manifests in dialect diagnostic tests

This ExecPlan (execution plan) is a living document. The sections `Constraints`,
`Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint` keeps a single, reviewer-audited record of what every deliberately
invalid ODW workflow fixture should produce. That record is the *invalid
workflow fixture manifest*: an immutable, deep-frozen array of
`InvalidWorkflowFixtureSnapshot` values assembled in
`tests/static-analysis/fixtures/invalid-workflows.ts` from one module per
fixture family (`missing-metadata`, `malformed-metadata`, `hostile-metadata`,
`unsupported-import-export`, `syntax-error`). Each snapshot pins the fixture's
family, file name, repository-relative path, SHA-256 digest, expected status,
and — the part that matters here — its `expectedDiagnostics`: the rule
identifier, severity, reviewer-facing message, documentation path, UTF-8 source
span, and the original-source `spanText` the span must cover. The manifest is
regenerated from raw fixture source by `make refresh-fixtures` so the hashes,
spans, and span text stay derived rather than hand-typed.

The problem this task fixes is that two "later" test suites re-encode the same
expected diagnostics *by hand* instead of reading them from the manifest, so
the manifest is no longer the sole source of truth:

1. The parser suite `tests/static-analysis/workflow-body-parser.test.ts` keeps
   its own hard-coded list of the two `syntax-error` fixture paths and asserts
   the `parseWorkflowBody` diagnostic with a Bun snapshot
   (`tests/static-analysis/__snapshots__/workflow-body-parser.test.ts.snap`)
   that duplicates, verbatim, the rule, severity, message, docs path, and span
   already recorded in
   `tests/static-analysis/fixtures/invalid-workflows/manifests/syntax-error.ts`.
2. The metadata-rule suite `tests/static-analysis/workflow-metadata.test.ts`
   reads two `hostile-metadata` fixtures from the manifest but then asserts
   inline object literals for their `odw/meta-statically-unprovable`
   diagnostics — re-typing the exact `spanText`, message, and severity that
   `tests/static-analysis/fixtures/invalid-workflows/manifests/hostile-metadata.ts`
   already owns.

After this change a reader can observe that the manifest is the one place a
fixture's expected dialect diagnostic lives: editing an expected message or
span in the manifest (and only there) makes both the parser adapter test and
the metadata classifier test fail until the manifest and the live linter agree
again, and no test carries a second, hand-maintained copy of that expectation.
The envelope suite is already manifest-driven and stays that way; this plan
brings the parser and metadata suites to the same standard and removes the
duplicated snapshot.

Success is exactly the roadmap's success criterion for 2.3.3: "invalid fixture
expectations remain the source of truth for emitted dialect diagnostics and
original-source spans." Concretely: the parser and metadata suites derive their
expected `syntax-error` and `hostile-metadata` diagnostics from
`INVALID_WORKFLOW_FIXTURE_SNAPSHOTS` (or its per-family exports), the
duplicated parser snapshot is gone, `make all` passes, and a deliberate
one-line edit to a manifest expectation now breaks the parser and metadata
suites (proving they read the manifest) rather than passing against a stale
local copy.

## Roadmap context

Roadmap task 2.3.3 (`docs/roadmap.md`) reads:

> Consume invalid fixture manifests in dialect diagnostic tests. Requires steps
> 2.1-2.2. Drive parser, envelope, and metadata-rule assertions from the
> invalid fixture manifest instead of duplicating expected diagnostics in later
> test suites. Success: invalid fixture expectations remain the source of truth
> for emitted dialect diagnostics and original-source spans.

Its prerequisites 2.1 and 2.2 are complete (the manifest, the envelope scanner,
the metadata classifier, and the body-syntax parser adapter all exist and are
released). Sibling tasks 2.3.1 and 2.3.2 (loader-parity and dual-compat
harnesses) are *not* prerequisites for 2.3.3 and are out of scope here; this
task only requires 2.1-2.2 and is a test-and-documentation refactor that
changes no production behaviour.

## Constraints

Hard invariants that must hold throughout implementation. Violation requires
escalation, not a workaround.

- Work happens exclusively in the git worktree at
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-3-3` on branch
  `roadmap-2-3-3`. Never edit the root/control checkout.
- No production code under `src/` changes. This is a test-and-docs task: the
  emitted diagnostics must be identical before and after. If satisfying the
  task appears to require a production change, stop and escalate — a needed
  production change means the manifest and the linter already disagree, which
  is a separate defect.
- The manifest and raw fixtures are not hand-edited to make tests pass. The
  manifest under `tests/static-analysis/fixtures/invalid-workflows/` is
  regenerated only through `make refresh-fixtures`; expected messages are
  changed only by extending the catalogue entry, per `docs/developers-guide.md`
  (the "extend the matching catalogue entry … rather than treating the manifest
  as a separate source of truth" rule). This plan does not change any expected
  diagnostic value.
- Invalid workflow fixtures are never imported, evaluated, executed, or
  formatted as ordinary JavaScript (`docs/developers-guide.md`, "Do not import,
  evaluate, execute, or format invalid workflow fixtures"). Tests read them as
  text via `readFixtureSource`.
- The static-analysis boundary holds: no test wiring introduced here may cause
  production modules to import an executable ODW loader, primitive factory,
  launcher, or worker path (`docs/adr/0001-static-analysis-boundary.md`,
  `docs/technical-design.md` §11.3).
- The `odw/body-syntax` dialect contract from
  `docs/adr/0002-workflow-body-parser-dialect-scope.md` is unchanged; the
  `syntax-error` fixtures continue to prove ECMAScript-only rejection.
- Prose, comments, and commit messages use en-GB Oxford spelling
  ("-ize"/"-yse"/"-our"), per `AGENTS.md` and
  `docs/documentation-style-guide.md`.
- No file under `src/` or `tests/` exceeds 400 lines after the change
  (`AGENTS.md`, "Keep file size manageable"). `workflow-metadata.test.ts` is
  385 lines today; the metadata change must not push it past 400 — if it would,
  extract a helper instead.

## Tolerances (exception triggers)

- Scope: if the change touches more than 8 files or more than ~250 net lines,
  stop and escalate. (Estimate: 5 files — two test suites, one snapshot
  deletion, one shared helper module, the developers guide — plus one new
  helper test.)
- Production code: if any file under `src/` must change, stop and escalate.
- Manifest values: if any expected diagnostic message, span, or `spanText` in
  the manifest must change to make a test pass, stop and escalate — that is a
  real linter/manifest disagreement, not a refactor.
- New dependencies: if a new runtime or dev dependency is required, stop and
  escalate. (None is expected; `fast-check`, Bun test, and Bun snapshots are
  already present.)
- Iterations: if `make all` still fails after 3 focused attempts on a work
  item, stop and escalate with the transcript.
- Ambiguity: if the intended source-of-truth wiring is genuinely ambiguous
  (for example, whether to keep or delete the parser snapshot), present the
  options with trade-offs rather than guessing. This plan resolves the known
  ambiguity in the Decision Log; a *new* one triggers escalation.

## Risks

- Risk: Deleting the parser snapshot removes an SWC-bump re-observation anchor
  that `docs/developers-guide.md` currently lists. Severity: medium.
  Likelihood: high (it is a certainty the doc must change). Mitigation: Work
  item 1 updates the developers-guide SWC-bump surface list in the same commit,
  replacing the snapshot reference with the manifest-driven parser parity test.
  The manifest message remains the re-observation record; the manifest-driven
  test fails loudly on an SWC detail change, giving the same ergonomics as
  `bun test -u` did.
- Risk: Bun leaves the emptied snapshot file behind or an obsolete-snapshot
  warning is mistaken for a failure. Severity: low. Likelihood: medium.
  Mitigation: Work item 1 deletes
  `tests/static-analysis/__snapshots__/workflow-body-parser.test.ts.snap`
  outright (it holds only the two syntax-error entries) and confirms
  `make test` reports zero failures and no obsolete-snapshot references to that
  file.
- Risk: A shared corpus/lookup helper (Work item 3) over-abstracts or collides
  with an existing helper. Severity: low. Likelihood: medium. Mitigation:
  `AGENTS.md` abstraction policy — sweep first. The existing
  `FixtureCorpusLocation` type and `readFixtureSource` in
  `tests/static-analysis/fixtures/corpus-support.ts` are the reuse anchors; the
  new helper is additive, colocated, documented, and unit-tested. If the
  consolidation grows beyond the tolerance, it is split off and deferred rather
  than expanded.
- Risk: `workflow-metadata.test.ts` grows past the 400-line limit when inlining
  manifest-driven assertions. Severity: low. Likelihood: low. Mitigation: the
  change *removes* two inline literals and replaces them with a short manifest
  lookup, so it should shrink, not grow; verify the line count after editing.

## Progress

- [x] (2026-07-05 09:01Z) Work item 0: confirm the red-state baseline
  (manifest edit breaks parser and metadata suites) is reproducible before any
  change. Baseline focused suites passed after `make build` installed
  dependencies; temporary `syntax-error` and `hostile-metadata` manifest
  perturbations made `invalid-workflow-metadata-parity.test.ts` fail for the
  manifest values, then the manifests were restored.
- [x] (2026-07-05 09:01Z) Work item 1: drive the parser suite's `syntax-error`
  diagnostics from the manifest; delete the duplicated snapshot; reconcile the
  developers-guide SWC-bump surface list. The parser suite now imports
  `SYNTAX_ERROR_FIXTURES`, compares the live parser diagnostic with the
  manifest diagnostic projection, and cross-checks the original-source span
  against the manifest. The duplicated Bun snapshot was deleted. Focused parser
  tests passed, `make all`, `make markdownlint`, and `make nixie` passed
  through scrutineer, and `coderabbit review --agent` returned clean with zero
  findings.
- [x] (2026-07-05 09:13Z) Work item 2: drive the metadata suite's
  `hostile-metadata` diagnostics from the manifest. The metadata suite now
  looks up the hostile fixture snapshots, reads fixture source from those
  snapshots, and projects manifest diagnostics into the classifier summary
  shape instead of keeping inline diagnostic literals. The hostile
  manifest-perturbation probe failed both target tests for the manifest
  `spanText`, the restored focused suite passed, `make all` passed through
  scrutineer, and `coderabbit review --agent` returned clean with zero findings.
- [x] (2026-07-05 09:26Z) Work item 3 (separate atomic refactor): extract a
  shared invalid-workflow fixture corpus constant and lookup helper, replacing
  the duplicated corpus literals and local lookups across the consuming suites.
  Added `tests/static-analysis/fixtures/invalid-workflows/corpus.ts` with the
  frozen corpus location and `findInvalidWorkflowFixture`, added
  `invalid-workflow-corpus.test.ts`, and migrated the parser, metadata, parity,
  envelope, hostile-security, and manifest-integrity suites. The helper test
  was red before the module existed and green after implementation; the
  migrated focused suites passed, `make all` passed through scrutineer after
  targeted import-order and JSDoc fixes, and `coderabbit review --agent`
  returned clean with zero findings.
- [x] (2026-07-05 10:47Z) Work item 4: reconcile documentation so the
  developers guide states the parser, envelope, and metadata suites all derive
  invalid-fixture expectations from the manifest. The developers guide now
  names the parser, envelope, metadata, hostile-security, and merged parity
  surfaces as manifest-driven, and `docs/roadmap.md` marks task 2.3.3 complete.
  `make all`, `make markdownlint`, and `make nixie` passed through scrutineer;
  the first CodeRabbit attempt was rate-limited, the required 73-minute
  `vsleep` backoff completed, and the retry returned clean with zero findings.

## Surprises & discoveries

- Observation: The envelope suite is *already* manifest-driven.
  Evidence: `tests/static-analysis/workflow-envelope-fixtures.test.ts:52-67`
  iterates `UNSUPPORTED_IMPORT_EXPORT_FIXTURES` and asserts
  `toEqual([...fixture.expectedDiagnostics])`; and
  `tests/static-analysis/invalid-workflow-metadata-parity.test.ts` already
  drives metadata, envelope, and body-syntax parity through
  `lintWorkflowSource` against `fixture.expectedDiagnostics`. Impact: The
  envelope half of "parser, envelope, and metadata-rule" needs no new wiring;
  the plan only pins and documents that it stays derived, and focuses effort on
  the parser snapshot and the metadata inline literals.
- Observation: The `hostile-metadata-security.test.ts` suite is already
  manifest-driven too. Evidence:
  `tests/static-analysis/hostile-metadata-security.test.ts:214-223` builds its
  expectation from `fixture.expectedDiagnostics`. Impact: The only
  metadata-suite duplication left is the two inline literals in
  `workflow-metadata.test.ts`.
- Observation: `make refresh-fixtures` derives spans and `spanText` from a
  once-only anchor but preserves the reviewer message verbatim from the current
  manifest. Evidence: `tests/static-analysis/fixtures/refresh-derivation.ts`
  derives the span from `spanText`;
  `tests/static-analysis/fixtures/refresh-manifest-source.ts:286-290` re-emits
  the existing `message`. Impact: The manifest message is the human-owned
  record of the SWC detail string, so a manifest-driven parser test is an
  equivalent (and single-source) replacement for the deleted snapshot.
- Observation: `make all` scans deleted tracked files through the whitespace
  hygiene gate until deletions are staged. Evidence: The first scrutineer
  deterministic gate run failed with
  `could not read tracked file tests/static-analysis/__snapshots__/workflow-body-parser.test.ts.snap`;
  staging the snapshot deletion removed the file from the intended index
  state. Impact: Stage work-item deletions before running gates that inspect
  tracked files, so validation checks the commit state rather than an unstaged
  intermediate state.
- Observation: CodeRabbit can recover after the required longer workflow
  backoff even when its own metadata reports a shorter wait time. Evidence: The
  Work item 4 CodeRabbit attempt returned `rate_limit` with
  `waitTime: "6 minutes"`; the workflow required a randomized 45-90 minute
  backoff, so `vsleep 73m` was used before retrying. The retry completed with
  `review_completed` and `findings: 0`. Impact: Record the exact rate-limit
  output and obey the workflow's backoff rule even when the service advertises
  a shorter wait.

## Decision log

- Decision: Delete the duplicated parser snapshot and assert the live
  `parseWorkflowBody` diagnostic against the manifest, rather than keeping the
  snapshot. Rationale: The roadmap success criterion is that the manifest
  "remain[s] the source of truth". A snapshot that re-encodes the same
  rule/severity/message/ docs/span is a second source of truth and contradicts
  that goal. Asserting `live == manifest.expectedDiagnostics[0]` makes the
  manifest the single record while preserving adapter-layer coverage and SWC
  re-observation ergonomics (the test fails loudly on a detail change).
  Alternative considered and rejected: keep the snapshot but also add a
  manifest cross-check — rejected because it leaves two maintained copies, the
  exact anti-pattern 2.3.3 removes. Date/Author: 2026-07-05, planning agent.
- Decision: Perform the shared-helper consolidation (Work item 3) as a
  *separate* commit after the two behaviour-preserving test rewrites. Rationale:
  `AGENTS.md` "Separate Atomic Refactors" — refactoring follows the functional
  change as its own gated commit. Work items 1 and 2 are the source-of-truth
  change; Work item 3 is duplication cleanup of the corpus literals and is
  independently revertible. Date/Author: 2026-07-05, planning agent.
- Decision: Do not touch `src/`, the raw fixtures, or manifest expectation
  values. Rationale: The emitted diagnostics already match the manifest (the
  existing parity suite passes); 2.3.3 is about *where the test reads the
  expectation from*, not about changing any expectation. Date/Author:
  2026-07-05, planning agent.
- Decision: Add this ExecPlan to `docs/contents.md` during Work item 1.
  Rationale: The repository's documentation freshness gate requires every
  top-level ExecPlan to be indexed. The approved plan entered this worktree as
  an untracked file, so the contents link is required for `make all` to
  validate the same commit that records Work item 1 progress. Date/Author:
  2026-07-05, implementation agent.
- Decision: Place the shared invalid-workflow corpus helper in
  `tests/static-analysis/fixtures/invalid-workflows/corpus.ts`. Rationale: The
  helper is test-only, owns only invalid-workflow fixture location and lookup
  policy, and sits next to the invalid workflow family manifests without
  changing production code or the generic corpus reader. Date/Author:
  2026-07-05, implementation agent.

## Outcomes & retrospective

Completed. The parser suite now derives `syntax-error` body-syntax diagnostic
expectations from the invalid workflow manifest and the duplicated parser
snapshot is removed. The metadata suite now derives the two hostile fixture
classifier expectations from the manifest. A shared invalid-workflow fixture
corpus helper owns the corpus location and point lookup policy, reducing
duplicated test literals while keeping invalid fixtures passive source text.
The developers guide documents the parser, envelope, metadata,
hostile-security, and merged parity surfaces as manifest-driven, and the
roadmap marks 2.3.3 complete. Each work item passed deterministic gates and
CodeRabbit review; the final CodeRabbit review required one rate-limit backoff
and retry.

## Addenda

- [x] 2.3.3.1. Guard invalid-fixture diagnostic expectations against inline
  literals.
  - Source: review:2.3.3; severity low.
  - Scope: add a focused meta-test or lint guard that fails if the parser,
    envelope, or metadata invalid-fixture suites reintroduce inline diagnostic
    `rule`, `severity`, `message`, or `spanText` literals instead of reading
    expectations from the manifest.
  - Success: a future hand-typed invalid-fixture diagnostic expectation in
    those suites fails before the manifest stops being the single source of
    truth.
- [x] 2.3.3.2. Reconcile historical SWC-bump ExecPlan surface references.
  - Source: review:2.3.3; severity low.
  - Scope: add a short note or index pointer in
    `docs/execplans/roadmap-2-2-5.md` and
    `docs/execplans/roadmap-2-2-6.md` explaining that the developers guide is
    now the authoritative living SWC-bump surface list.
  - Success: historical ExecPlan references remain understandable as
    point-in-time records without misleading future SWC upgrade work.

## Context and orientation

You are a newcomer with only this worktree. Orient here:

- Manifest aggregate:
  `tests/static-analysis/fixtures/invalid-workflows.ts` exports the frozen
  `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS` array and re-exports the fixture types.
- Per-family manifest modules (each `export`s a named `*_FIXTURES` array):
  `tests/static-analysis/fixtures/invalid-workflows/manifests/syntax-error.ts`
  (`SYNTAX_ERROR_FIXTURES`), `.../manifests/hostile-metadata.ts`
  (`HOSTILE_METADATA_FIXTURES`), `.../manifests/unsupported-import-export.ts`
  (`UNSUPPORTED_IMPORT_EXPORT_FIXTURES`), plus `missing-metadata` and
  `malformed-metadata`.
- Manifest types and builders:
  `tests/static-analysis/fixtures/invalid-workflows/manifest-types.ts` defines
  `InvalidWorkflowFixtureSnapshot`, `InvalidWorkflowFixtureDiagnostic`, and the
  `invalidWorkflowFixture`/`diagnostic` builders that brand rule ids and derive
  docs paths.
- Corpus reader:
  `tests/static-analysis/fixtures/corpus-support.ts` exposes
  `FixtureCorpusLocation`, `readFixtureSource`, `fixtureSourceUrl`,
  `copiedFixtureFileNames`, and `sha256`.
- Parser suite to change:
  `tests/static-analysis/workflow-body-parser.test.ts` (its hard-coded
  `SYNTAX_ERROR_FIXTURES` string list at lines 31-34 and the two snapshot tests
  at lines 186-214), backed by
  `tests/static-analysis/__snapshots__/workflow-body-parser.test.ts.snap`.
- Metadata suite to change:
  `tests/static-analysis/workflow-metadata.test.ts` (the two hostile fixture
  tests at lines 358-384 that inline the expected diagnostic).
- Already-compliant references (do not duplicate their patterns; reuse them):
  `tests/static-analysis/workflow-envelope-fixtures.test.ts`,
  `tests/static-analysis/invalid-workflow-metadata-parity.test.ts`,
  `tests/static-analysis/hostile-metadata-security.test.ts`.
- Shared assertions:
  `tests/static-analysis/workflow-envelope-support.ts` (`spanTextFor`,
  `expectScannedEnvelope`) and `tests/static-analysis/source-span-oracle.ts`.

Terms:

- *Invalid workflow fixture manifest*: the frozen array of
  `InvalidWorkflowFixtureSnapshot` described above; the authoritative record of
  each invalid fixture's expected diagnostics and spans.
- *Body-syntax parser adapter*: `parseWorkflowBody` (public via `odw-lint`,
  implemented in `src/static-analysis/workflow-body-parse.ts`), which parses a
  normalized workflow body with `@swc/core` and returns either `{ ok: true }` or
  `{ ok: false, diagnostic }` for `odw/body-syntax`.
- *Metadata classifier*: `classifyWorkflowMetadata`
  (`src/static-analysis/workflow-metadata.ts`), which emits `odw/meta-*`
  diagnostics — including `odw/meta-statically-unprovable` for hostile metadata
  — from envelope facts without evaluating source.
- *Manifest-driven assertion*: a test whose expected values are read from the
  manifest snapshot at run time, so the manifest is the only place the
  expectation is written.

Design sources of truth to obey: `docs/technical-design.md` §11.1 (differential
corpus: "For each fixture, tests assert expected diagnostics and spans"), §11.3
(security regression); `docs/developers-guide.md` (invalid fixture ownership,
the "manifest is not a separate source of truth" rule, and the SWC-bump
coordinated-surface list); `docs/adr/0001-static-analysis- boundary.md`;
`docs/adr/0002-workflow-body-parser-dialect-scope.md`; `AGENTS.md` (testing,
atomicity, separate atomic refactors, file size).

## Plan of work

Stages run per work item: red (or observable substitute) → green → refactor →
validate. Because production behaviour does not change, the "red" for each
behaviour-preserving rewrite is a *manifest-perturbation probe*: temporarily
change one expected value in the manifest, confirm the rewritten test fails for
that reason, then revert the manifest. This proves the assertion reads the
manifest rather than a local copy. Each work item ends with the full gate and
an independent commit.

### Work item 0: establish the red-state baseline

Purpose: prove, before editing, that the suites currently pass and that the
manifest-perturbation probe is a valid red signal.

- Read the current suites and manifest modules named in Context.
- Run the two target suites green at baseline (see Concrete steps).
- Temporarily edit one character of an expected `spanText` in
  `.../manifests/syntax-error.ts` and one in
  `.../manifests/hostile-metadata.ts`, run the *manifest-consuming* parity suite
  (`invalid-workflow-metadata-parity.test.ts`) and confirm it goes red, then
  revert. This calibrates the probe used in later work items.
- No commit (investigation only).

Docs to read: `docs/developers-guide.md` (invalid fixture section);
`docs/technical-design.md` §11.1. Skills to load: `execplans` (this plan),
`leta` (navigate symbols/references), `sem` (entity-level history of the
suites), `grepai` (locate any other duplication before committing to scope).
Tests: none added; this item only confirms the baseline and probe.

### Work item 1: drive the parser suite from the manifest

File: `tests/static-analysis/workflow-body-parser.test.ts`; delete
`tests/static-analysis/__snapshots__/workflow-body-parser.test.ts.snap`; edit
`docs/developers-guide.md` SWC-bump surface list.

- Replace the local `const SYNTAX_ERROR_FIXTURES = [ "syntax-error/..." ]`
  string array (lines 31-34) with an import of the manifest export:
  `import { SYNTAX_ERROR_FIXTURES } from "./fixtures/invalid-workflows/manifests/syntax-error";`
  and drive the parameterized tests over those snapshots
  (`SYNTAX_ERROR_FIXTURES.map((fixture) => [fixture])`).
- Rewrite the "converts %s syntax errors to body diagnostics" test so it no
  longer calls `toMatchSnapshot()`. Instead, read the fixture source with
  `readFixtureSource`, scan and parse it, take the single expected diagnostic
  `fixture.expectedDiagnostics[0]`, and assert the live `parseWorkflowBody`
  diagnostic equals that manifest diagnostic projected to the same shape
  (`{ rule, severity, message, docs, span }`, with `rule` compared via
  `String(...)`). Keep the existing template-branch assertions
  (`messageMatchesTemplate(BODY_SYNTAX_TEMPLATE, diagnostic.message)` is true;
  `diagnostic.message` is not the exact base message) because they pin the
  reviewed-template behaviour from task 2.2.5.
- Keep the "emits original-source body span text for %s" test; it already
  asserts against `envelope.bodySpan` (behavioural, not a duplicate literal)
  and should now also cross-check `diagnostic.span` equals
  `fixture.expectedDiagnostics[0].span` so the span source of truth is the
  manifest.
- Delete the snapshot file (it holds only the two now-removed entries).
- In `docs/developers-guide.md`, update the SWC-bump coordinated-surface
  paragraph (around line 519-527) to remove the snapshot path and state that
  the manifest-driven parser parity test in `workflow-body-parser.test.ts` now
  enforces the `odw/body-syntax` detail against the `syntax-error` manifest;
  keep the raw fixtures and the manifest module in the surface list.

Red (probe): before editing the assertion, run the rewritten test with one
expected `spanText`/`message` byte perturbed in
`.../manifests/syntax-error.ts`; confirm the parser test fails citing the
manifest value; revert the manifest. Green: with the manifest intact, the
rewritten test passes. Refactor: ensure the diagnostic-projection helper is a
small named local function (command/query, single responsibility) and imports
are sorted.

Docs to read: `docs/developers-guide.md` (SWC-bump surfaces; invalid fixture
rules); `docs/adr/0002-workflow-body-parser-dialect-scope.md`;
`docs/technical-design.md` §11.1; `AGENTS.md` (Testing → Snapshot scope).
Skills to load: `execplans`, `leta`, `biomejs` (formatting/lint expectations),
`en-gb-oxendict` (doc prose), `commit-message`. Tests updated:
`tests/static-analysis/workflow-body-parser.test.ts` — the two `it.each`
syntax-error tests become manifest-driven; the snapshot is removed. No new test
file; coverage is preserved at the adapter layer and now single- sourced.
Property test `never throws for generated bodies` is untouched.

### Work item 2: drive the metadata suite's hostile fixtures from the manifest

File: `tests/static-analysis/workflow-metadata.test.ts`.

- The two tests "keeps hostile global-marker metadata passive" and "returns a
  warning instead of throwing hostile throw-marker metadata" (lines 358-384)
  currently inline the expected `odw/meta-statically-unprovable` diagnostic.
  Replace each inline literal with a lookup of the matching fixture in
  `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS` (`family === "hostile-metadata"` and the
  file name) and build the expectation from `fixture.expectedDiagnostics`,
  projected to the `diagnosticSummary` shape
  `{ rule, severity, message, spanText }` used by this suite. Reuse the existing
  `invalidFixtureSource` helper (lines 65-75) to read the fixture text, and
  keep the passivity assertion (`__odwLintHostileMetadataWasEvaluated` stays
  `undefined`).
- Filter `expectedDiagnostics` to the classifier-owned rules if a fixture ever
  carried more than one diagnostic; today each hostile fixture has exactly one
  `odw/meta-statically-unprovable` entry, so map the array directly and assert
  `diagnosticSummary(sourceText)` `toEqual` the projected manifest diagnostics.
- Confirm the file stays at or below 400 lines (it should shrink).

Red (probe): perturb one expected hostile `spanText` in
`.../manifests/hostile-metadata.ts`; confirm both metadata tests fail citing
the manifest value; revert. Green: with the manifest intact, the tests pass.
Refactor: if the two tests now share the same lookup-and-project shape, extract
one small local helper `expectHostileFixtureDiagnostics(fileName)` rather than
repeating the projection.

Docs to read: `docs/developers-guide.md` (metadata classifier + invalid fixture
sections, lines ~165-176 and ~495-527); `docs/technical-design.md` §11.3
(security regression); `AGENTS.md` (Testing → Fixtures/Parameterized). Skills
to load: `execplans`, `leta`, `biomejs`, `commit-message`. Tests updated:
`tests/static-analysis/workflow-metadata.test.ts` — the two hostile classifier
tests become manifest-driven. The inline classifier cases built from
*synthetic* source strings (lines 202-348) are legitimate unit cases with no
manifest fixture behind them and are left unchanged.

### Work item 3 (separate atomic refactor): consolidate the corpus literals

Files: add a helper to `tests/static-analysis/fixtures/corpus-support.ts` (or a
new colocated module
`tests/static-analysis/fixtures/invalid-workflows/corpus.ts` if
`corpus-support.ts` would exceed 400 lines — it is 73 lines today, so extending
it is fine); update the consuming suites to use it; add a focused unit test.

- Before implementing, sweep for an existing equivalent (AGENTS.md abstraction
  policy). The reuse anchors are `FixtureCorpusLocation` and
  `readFixtureSource` in `corpus-support.ts`; the duplication is the repeated
  `{ fixtureDirectory: new URL("./fixtures/invalid-workflows/", import.meta.url),`

  ```text
  manifestRoot: "tests/static-analysis/fixtures/invalid-workflows/", recursive: true
  }
  ```

  literal in at least `invalid-workflow-fixtures.test.ts`,
  `invalid-workflow-metadata-parity.test.ts`, `workflow-metadata.test.ts`,
  `hostile-metadata-security.test.ts`, `workflow-envelope-fixtures.test.ts`, and
  `workflow-body-parser.test.ts`, plus the local `findInvalidFixture`/
  `invalidFixtureSource` lookups.
- Export a single frozen
  `INVALID_WORKFLOW_FIXTURE_CORPUS: FixtureCorpusLocation` constant and a
  `findInvalidWorkflowFixture({ family, fileName })` lookup that reads from
  `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS` and throws a clear error when absent
  (mirroring the existing local throw messages). Document ownership and
  permitted call sites in the module `@file` block.
- Replace the duplicated literals and local lookups in the consuming suites
  with the shared constant and helper. Keep each replacement behaviour-
  preserving (imports sorted; no assertion changes).
- Because this is a refactor, the behavioural tests in every touched suite must
  pass unchanged before and after; add one focused unit test
  (`tests/static-analysis/invalid-workflow-corpus.test.ts` or a `describe`
  block in an existing corpus test) proving `findInvalidWorkflowFixture`
  returns the expected snapshot and throws for an unknown fixture.

Red/Green: the new helper unit test is written red (asserts a lookup that does
not yet resolve), then green once the helper exists; the suite migrations are
verified by the unchanged existing tests staying green. Refactor: none beyond
this; keep the helper minimal.

Docs to read: `AGENTS.md` (Abstraction/adapter/helper policy; Separate Atomic
Refactors); `docs/complexity-antipatterns-and-refactoring-strategies.md` (data
clump / duplicated code); `docs/developers-guide.md` (fixture corpus layout).
Skills to load: `execplans`, `leta` (find all call sites/references before
moving), `sem` (confirm the literal is genuinely duplicated across suites),
`biomejs`, `commit-message`. Tests added/updated: one focused unit test for the
helper; all migrated suites keep their existing assertions.

Note: if this consolidation would exceed the file/line tolerance or entangle
suites beyond a clean mechanical replace, split it: land Work items 1, 2, and 4
first, and record the remaining consolidation as a follow-up addendum rather
than forcing it into this task.

### Work item 4: reconcile documentation

File: `docs/developers-guide.md` (and only if needed, a one-line note in
`docs/technical-design.md` §11.1).

- Add or amend the developers-guide passage that describes invalid-fixture
  testing to state plainly that the parser (`workflow-body-parser.test.ts`),
  envelope (`workflow-envelope-fixtures.test.ts`), and metadata
  (`workflow-metadata.test.ts`, `hostile-metadata-security.test.ts`) suites
  derive their expected invalid-fixture diagnostics from the manifest, and
  cross-reference `invalid-workflow-metadata-parity.test.ts` as the merged-
  pipeline parity surface. This makes the source-of-truth contract discoverable.
- Keep wording in en-GB Oxford spelling; wrap prose at 80 columns; code blocks
  at 120.
- If Work item 1 already fully updated the SWC-bump list, this item only adds
  the broader source-of-truth statement.

Docs to read: `docs/documentation-style-guide.md`; `docs/developers-guide.md`.
Skills to load: `execplans`, `en-gb-oxendict`, `changelog` only if a changelog
entry is warranted (not expected for a test-refactor), `commit-message`. Tests:
none (documentation). Validated by `make markdownlint` and `make nixie`.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-3-3`.

Baseline (Work item 0):

```bash
bun test tests/static-analysis/workflow-body-parser.test.ts
bun test tests/static-analysis/workflow-metadata.test.ts
bun test tests/static-analysis/invalid-workflow-metadata-parity.test.ts
```

Expected: all pass. Then perturb one expected `spanText` byte in
`tests/static-analysis/fixtures/invalid-workflows/manifests/syntax-error.ts`,
rerun the parity suite, observe a failure that cites the manifest value, and
revert the manifest (`git checkout -- <path>`).

Per work item, after editing:

```bash
# Focused suite(s) for the work item, for fast feedback:
bun test tests/static-analysis/workflow-body-parser.test.ts   # WI1
bun test tests/static-analysis/workflow-metadata.test.ts      # WI2
bun test tests/static-analysis/invalid-workflow-corpus.test.ts # WI3 (new)

# Format only the files this work item changed, then gate:
bunx @biomejs/biome format --write <changed .ts files>
# For changed Markdown only:
bunx mdtablefix docs/developers-guide.md   # if a table is touched
bunx markdownlint-cli2 --fix docs/developers-guide.md

# Full commit gate (authoritative):
make all
# Markdown gates when Markdown changed:
make markdownlint
make nixie
```

Commit each work item separately with an imperative subject (see
`commit-message` skill), for example:

```plaintext
Drive syntax-error parser tests from the fixture manifest
Drive hostile metadata tests from the fixture manifest
Consolidate invalid-workflow fixture corpus helpers
Document manifest as the single invalid-fixture source of truth
```

## Validation and acceptance

Authoritative commit gate for every work item: `make all` (per `AGENTS.md`,
this runs build, `check-fmt`, `lint`, `typecheck`, and `test`). Run the
sequential named gates as well if `make all` is inconclusive: `make check-fmt`,
`make lint`, `make typecheck`, `make test`. For any Markdown change:
`make markdownlint` and `make nixie`.

Do not run gates in parallel (shared build cache; `AGENTS.md`/global tooling
rule). Do not run a repo-global Markdown reformat; format only the files
changed.

Red-Green-Refactor evidence to record in Progress as each item lands:

- Red: the manifest-perturbation probe makes the rewritten parser test (WI1) and
  metadata tests (WI2) fail for the manifest reason; transcript captured; the
  manifest is reverted before proceeding.
- Green: with the manifest intact, `bun test <suite>` passes and `make all`
  passes.
- Refactor: after WI3, all migrated suites still pass unchanged and the new
  helper unit test passes.

Behavioural acceptance (a human can verify):

- Editing a single expected message or `spanText` in a `manifests/*.ts` file and
  running `make test` now fails the parser suite (for `syntax-error`) and the
  metadata suite (for `hostile-metadata`) — proving those suites read the
  manifest. Reverting the edit returns the suites to green.
- `tests/static-analysis/__snapshots__/workflow-body-parser.test.ts.snap` no
  longer exists, and `make test` reports no obsolete-snapshot reference to it.
- `docs/developers-guide.md` describes the manifest as the single source of
  truth for the parser, envelope, and metadata invalid-fixture assertions and
  no longer lists the deleted snapshot as an SWC-bump surface.

Quality criteria for "done": `make all` green at HEAD for each commit;
`make markdownlint` and `make nixie` green for the documentation commits; no
`src/` change; no manifest expectation-value change; no new dependency; every
touched file at or below 400 lines.

## Idempotence and recovery

- All steps are re-runnable. The manifest-perturbation probe is always followed
  by `git checkout -- <manifest path>` to restore the pinned values; if a probe
  edit is left in place by mistake, `git status` will show the manifest dirty
  and `git checkout --` restores it.
- Deleting the snapshot is safe: it holds only the two syntax-error entries and
  is regenerated by nothing once the `toMatchSnapshot()` calls are removed. If
  the deletion is premature, `git checkout -- <snap path>` restores it.
- If `make all` fails after an edit, the failing gate output identifies the
  file; fix and rerun. If it still fails after 3 attempts on one item, stop and
  escalate per Tolerances.
- Keep the tree clean between commits: each work item is its own gated commit,
  so a partial failure can be reset to the last green commit without losing
  earlier items.

## Interfaces and dependencies

No production interfaces change. The test-facing shapes relied upon (all
already exported):

- `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS: readonly InvalidWorkflowFixtureSnapshot[]`
  from `tests/static-analysis/fixtures/invalid-workflows.ts`.
- `SYNTAX_ERROR_FIXTURES`, `HOSTILE_METADATA_FIXTURES`,
  `UNSUPPORTED_IMPORT_EXPORT_FIXTURES` from the per-family manifest modules.
- `InvalidWorkflowFixtureSnapshot.expectedDiagnostics: readonly InvalidWorkflowFixtureDiagnostic[]`
  with fields `rule` (`RuleId`), `severity` (`DiagnosticSeverity`), `message`
  (`string`), `docs` (`RuleDocumentationPath`), `span` (`SourceSpan`),
  `spanText` (`string`).
- `readFixtureSource(corpus, fixturePath)` and `FixtureCorpusLocation` from
  `tests/static-analysis/fixtures/corpus-support.ts`.
- `parseWorkflowBody`, `scanWorkflowEnvelope`, `createOriginalSourceFile`,
  `sliceSourceSpan`, `classifyWorkflowMetadata`, `messageMatchesTemplate`,
  `ruleDefinitionFor`, `makeRuleId` from `odw-lint`.

New test-only interface added by Work item 3 (illustrative signature):

```typescript
// tests/static-analysis/fixtures/invalid-workflows/corpus.ts (or corpus-support.ts)
export const INVALID_WORKFLOW_FIXTURE_CORPUS: FixtureCorpusLocation;

export const findInvalidWorkflowFixture: (query: {
  readonly family: InvalidWorkflowFixtureFamily;
  readonly fileName: string;
}) => InvalidWorkflowFixtureSnapshot;
```

## Revision note

Initial draft (2026-07-05). Establishes the four-work-item plan: manifest-drive
the parser `syntax-error` tests and delete the duplicated snapshot (WI1),
manifest-drive the metadata `hostile-metadata` tests (WI2), consolidate the
duplicated corpus literals as a separate atomic refactor (WI3), and reconcile
the developers guide (WI4). Records the decision to delete rather than keep the
parser snapshot, the discovery that the envelope and security suites are
already manifest-driven, and the constraint that no production code or manifest
expectation value changes.

Revision (2026-07-05 09:01Z). Marked the plan in progress, recorded the
baseline focused-suite and manifest-perturbation evidence for Work item 0,
recorded the Work item 1 parser rewrite progress and gate findings, and added
the required `docs/contents.md` index entry for this ExecPlan so repository
documentation freshness gates can validate the work item.

Revision (2026-07-05 09:01Z). Marked Work item 1 complete after the
manifest-driven parser rewrite, snapshot deletion, developers-guide update,
green deterministic gates, and clean CodeRabbit review.

Revision (2026-07-05 09:13Z). Marked Work item 2 complete after the metadata
hostile-fixture tests started deriving their expected diagnostics from the
invalid fixture manifest, with a successful manifest-perturbation probe, green
`make all`, and clean CodeRabbit review.

Revision (2026-07-05 09:26Z). Marked Work item 3 complete after extracting the
shared invalid-workflow corpus location and lookup helper, adding its focused
unit test, migrating duplicated corpus consumers, passing `make all`, and
receiving a clean CodeRabbit review.

Revision (2026-07-05 10:47Z). Marked Work item 4 and the ExecPlan complete
after documenting the manifest-driven diagnostic contract in the developers
guide, marking roadmap task 2.3.3 complete, passing deterministic gates, and
receiving a clean CodeRabbit retry after the required rate-limit backoff.
