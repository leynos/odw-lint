# Bind recorded review evidence to the reviewed tree state

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: DRAFT

## Purpose / big picture

Today a reviewer records the `make review-evidence` report to
`.review-evidence/report.txt` and `make review-evidence-artefact` confirms only
that a completed report is present and structurally intact. Nothing ties that
recorded report to the tree that was actually reviewed. A stale report left
over from a previous task, or a report copied from another branch, currently
passes the artefact check unchanged. Roadmap task 1.5.12 closes that gap:
"Bind recorded review evidence to the reviewed tree state" (docs/roadmap.md,
§1.5, task 1.5.12; requires 1.5.10).

After this change, a recorded review-evidence artefact carries a provenance
marker naming the reviewed commit and tree object. `make review-evidence-artefact`
recomputes the current reviewed tree state and rejects the artefact when its
embedded tree marker does not match. A reviewer can observe this directly:

- Record evidence on the current worktree, then run
  `make review-evidence-artefact` and see exit 0 with a `present` report that
  now names the reviewed commit and tree.
- Commit a content change that alters `HEAD^{tree}`, re-run
  `make review-evidence-artefact` against the same recorded file, and see it
  rejected with exit 1 and a `mismatched` report naming the expected and actual
  tree hashes.

The success criterion from the roadmap is met: the artefact CLI rejects a
recorded report whose embedded provenance marker does not match the current
reviewed state.

## Constraints

Hard invariants that must hold throughout implementation.

- Work exclusively inside the git worktree at
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-12`. Never edit the
  root/control worktree.
- The review-evidence subsystem is test-only build-gate tooling under
  `tests/build-gate/`. It is governed by AGENTS.md ("Roadmap Review & Audit
  Evidence", "Change Quality & Committing", "TypeScript Guidance", "Code Style
  and Structure") and docs/developers-guide.md (build-gate section, lines
  ~209–296). It is NOT part of the linter's static-analysis boundary
  (docs/adr/0001-static-analysis-boundary.md) and is not described in
  docs/technical-design.md; those documents were checked and do not constrain
  this change. Do not import it into or from `src/`.
- Preserve the existing `make review-evidence` exit-code contract exactly:
  0 = `verified`, 1 = `failed`, 2 = `usage-error`, 3 = `degraded`
  (AGENTS.md "Roadmap Review & Audit Evidence"; developers-guide.md). Enabling
  or extending recording MUST NOT change these codes. A recording-time failure
  (including a provenance-read failure) is surfaced on stderr and enforced by
  the artefact check, never by changing the review-evidence exit code.
- Preserve the existing `make review-evidence-artefact` exit-code surface:
  `ReviewEvidenceArtefactExitCode` remains `0 | 1 | 2` (present = 0;
  missing/invalid/mismatched = 1; usage-error = 2). Do not introduce a fourth
  process exit code.
- Plain `make review-evidence` with no recording MUST remain runnable without a
  Git repository. Git access is introduced only on the recording path and in
  the artefact-check path. Do not couple `formatReviewEvidenceResult` (a pure
  formatter) to Git.
- Reuse the shared command seam. Run Git through
  `tests/build-gate/git-support.ts` (`createGitRunner` / `runGit`), never a
  fresh `spawnSync`, per developers-guide.md ("Build-gate command execution …
  live in `tests/build-gate/git-support.ts`") and AGENTS.md abstraction policy.
- No single code file exceeds 400 lines (AGENTS.md "Code Style and Structure";
  enforced by `make all` via the file-size guard, task 1.5.1).
- en-GB Oxford spelling ("-ize"/"-yse"/"-our") in all prose, comments, commit
  messages, and identifiers where natural (AGENTS.md; docs/documentation-style-guide.md).
- Every commit passes the full gate (`make all`) before it is made; Markdown
  changes additionally pass `make markdownlint` and `make nixie` (AGENTS.md
  "Change Quality & Committing", "Markdown Guidance").

## Tolerances (exception triggers)

- Scope: if any single work item requires touching more than 8 files or ~250
  net lines, stop and escalate.
- File size: if any edited file would exceed 400 lines, stop and split the
  module before proceeding (do not commit an over-limit file).
- Interface: the only public build-gate surfaces that may change are the
  recorded-artefact content contract, the `RecordedEvidenceResult` union
  (adding one `mismatched` variant), the provenance helper exports, and the
  injectable provenance-reader seams on the recording and artefact CLIs. If any
  other exported signature under `tests/build-gate/` must change
  incompatibly, stop and escalate.
- Dependencies: if a new external npm dependency appears necessary, stop and
  escalate. This plan uses only Node/Bun built-ins, `git`, and the in-repo
  `fast-check` already used by property tests.
- Iterations: if a work item's tests still fail after 3 focused attempts, stop
  and escalate.
- Ambiguity: if the match rule (tree vs commit) proves insufficient for the
  audit path in practice, stop and escalate rather than silently widening it.

## Risks

- Risk: Existing recording tests assert `recorded content === stdout`; appending
  a provenance trailer to the recorded file breaks that equality.
  Severity: medium. Likelihood: high.
  Mitigation: WI-3 updates those tests in the same commit to assert
  `recorded content === stdout + provenanceTrailer`, injecting a deterministic
  fake provenance reader. Verified affected tests:
  `review-evidence-cli-record.test.ts`,
  `review-evidence-cli-record-smoke.test.ts`.
- Risk: The artefact CLI smoke test asserts exact stdout for a `present`
  artefact with no Git repo; adding a mandatory current-provenance read would
  make it a usage error.
  Severity: medium. Likelihood: high.
  Mitigation: WI-5 rebuilds the smoke fixtures inside a temporary Git
  repository (`createTemporaryRepository` from git-support.ts) so present,
  mismatched, and unbound cases all have a real reviewed tree state.
- Risk: A dirty worktree at record time means `HEAD` does not exactly reflect
  what the gates ran against.
  Severity: low. Likelihood: medium.
  Mitigation: Provenance binds to the committed `HEAD` commit and tree, which is
  the reviewable unit; the clean-worktree precondition is already owned by the
  branch-freshness gate (branch-freshness-git.ts `checkCleanWorktree`). This
  boundary is documented in the Decision Log and developers-guide update.
- Risk: Pre-1.5.12 recorded artefacts have no provenance trailer and will be
  rejected as unbound.
  Severity: low. Likelihood: low.
  Mitigation: Intended behaviour — an unbindable artefact cannot prove it
  matches the reviewed state. Documented in AGENTS.md and developers-guide.md
  updates (WI-5).

## Progress

- [x] WI-1: Add the pure tree-provenance marker module.
- [x] WI-2: Read tree provenance through the shared Git seam.
- [x] WI-3: Bind provenance into recorded artefacts at record time.
- [x] WI-4: Reject stale or mismatched recorded artefacts in the artefact CLI.
- [x] WI-5: Wire the end-to-end smoke path and update the documentation.

## Surprises & discoveries

- Observation: The build-gate review-evidence subsystem is documented only in
  AGENTS.md and docs/developers-guide.md; docs/technical-design.md and the ADRs
  do not mention it.
  Evidence: `grep -rn "review-evidence\|build-gate" docs/technical-design.md
  docs/adr/` returns nothing; the subsystem is described in
  docs/developers-guide.md lines ~209–296 and AGENTS.md "Roadmap Review & Audit
  Evidence".
  Impact: Design authority for this task is AGENTS.md + developers-guide.md; the
  plan cites those rather than technical-design.md or an ADR, and updates them.
- Observation: docs/scripting-standards.md governs Python/`plumbum` scripts, not
  the repository's TypeScript build gates.
  Evidence: scripting-standards.md examples import `from plumbum.cmd import git`.
  Impact: The TypeScript build gates use `createCommandRunner`/`spawnSync` via
  git-support.ts; scripting-standards' subprocess intent (capture output, fail
  loudly) is honoured through that seam, but its concrete API does not apply.
- Observation: WI-1 CodeRabbit follow-up suggested adding the new ExecPlan to
  the documentation contents index after it was already present.
  Evidence: `docs/contents.md` contains `Roadmap 1.5.12 ExecPlan` pointing to
  `execplans/roadmap-1-5-12.md`.
  Impact: No content change was needed for that stale finding; the focused
  validation keeps the index requirement enforced.
- Observation: The artefact CLI already centralised all reviewer-facing output
  in `review-evidence-artefact-report.ts`.
  Evidence: `runReviewEvidenceArtefactCli` classifies once and passes every
  result through `formatRecordedEvidenceResult`.
  Impact: The stale-evidence path could be implemented as one new
  `RecordedEvidenceResult` variant instead of adding bespoke CLI printing.
- Observation: WI-4 had to update the artefact CLI process smoke test before it
  could commit, even though the original plan listed that smoke work under WI-5.
  Evidence: `make all` failed in
  `review-evidence-artefact-cli-smoke.test.ts` because the old fixture ran
  outside a Git repository and now correctly produced a usage error.
  Impact: The smoke fixture was moved into WI-4 with the production CLI change;
  WI-5 remains for documentation and roadmap close-out.

## Decision log

- Decision: Bind to the committed `HEAD` commit and its tree object
  (`HEAD^{tree}`), with the **tree** hash as the authoritative match key and the
  commit hash recorded for human traceability and mismatch diagnostics.
  Rationale: The gates (`make all`, `make markdownlint`, `make nixie`) validate
  tree *content*, so tree identity is the correct equivalence for "the same
  review still applies". A rebase or amended message that preserves the tree
  preserves the validity of the evidence; a content change invalidates it. The
  roadmap wording explicitly allows "commit, tree, or equivalent provenance
  marker". `git rev-parse HEAD^{tree}` is standard, stable gitrevisions(7)
  syntax (`<rev>^{<type>}`).
  Date/Author: 2026-07-04, planning agent.
- Decision: Provenance lives in the *recorded artefact* only (recorded content =
  report text + provenance trailer), not in the stdout report of a plain
  `make review-evidence` run.
  Rationale: Keeps `formatReviewEvidenceResult` pure and keeps plain
  `make review-evidence` Git-free; binding is a recording concern. Matches the
  mental model "the recorded artefact is bound to the tree it was recorded
  against".
  Date/Author: 2026-07-04, planning agent.
- Decision: On a provenance-read failure at record time, surface the failure on
  stderr and write the report WITHOUT a trailer (an unbindable artefact) rather
  than aborting or changing the exit code.
  Rationale: Mirrors the existing write-failure handling in
  review-evidence-recording.ts and preserves the review-evidence exit-code
  contract; rejection is deferred to the artefact gate, exactly as AGENTS.md
  already specifies for recording-write failures.
  Date/Author: 2026-07-04, planning agent.
- Decision: Model provenance as a `TreeProvenance` value object
  (`{ commit, tree }`), not two loose strings threaded through call sites.
  Rationale: Avoids primitive obsession / data clumps
  (docs/complexity-antipatterns-and-refactoring-strategies.md; AGENTS.md
  "Refactoring Heuristics").
  Date/Author: 2026-07-04, planning agent.

## Outcomes & retrospective

Delivered behaviour matches the Purpose: recorded artefacts carry reviewed
commit/tree provenance, plain `make review-evidence` stdout remains unchanged,
and the artefact CLI rejects unbound or tree-mismatched recordings while a
matching recording passes. The process smoke test now runs in a real temporary
Git repository so the executable CLI path proves missing, present, and
mismatched artefacts against an actual `HEAD` tree.

Final validation at implementation:

- `make all`
- `make markdownlint`
- `make nixie`

Skills and documents relied on: `grepai`, `leta`, `sem`, `biome-typescript`,
`commit-message`, `en-gb-oxendict-style`, AGENTS.md,
docs/developers-guide.md, docs/documentation-style-guide.md, docs/roadmap.md,
docs/scripting-standards.md, and
docs/complexity-antipatterns-and-refactoring-strategies.md.

## Context and orientation

All paths below are relative to the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-12`.

The review-evidence build gate is a set of test-only TypeScript modules under
`tests/build-gate/`, run through Bun and exposed via `make` targets in
`Makefile`:

- `make review-evidence` → `bun run tests/build-gate/review-evidence-cli.ts`.
  Re-runs `make all`, `make markdownlint`, `make nixie` through the shared
  command runner, classifies the result, and (when `--record=<path>` or
  `ODW_LINT_REVIEW_EVIDENCE_PATH` is set) records the report.
- `make review-evidence-artefact` →
  `bun run tests/build-gate/review-evidence-artefact-cli.ts`. Reads the recorded
  report and rejects missing/invalid recordings.

Key existing modules (read these before editing):

- `tests/build-gate/git-support.ts` — the shared command seam.
  `createGitRunner(cwd)` returns a `GitRunner` (`{ run(args) => CommandResult }`)
  with `GIT_TERMINAL_PROMPT=0` and a bounded timeout; `runGit(git, args)` is the
  terse call wrapper; `createTemporaryRepository`, `writeRepositoryFile`,
  `commitAll`, `runFixtureGit` build hermetic Git fixtures for tests.
- `tests/build-gate/review-evidence.ts` — `classifyReviewEvidence` and the
  `ReviewEvidenceResult` union (`verified | failed | degraded | usage-error`).
- `tests/build-gate/review-evidence-report.ts` — `formatReviewEvidenceResult`
  (pure) and the exported `REVIEW_EVIDENCE_REPORT_PREFIX = "Review evidence: "`.
  Report body lines are one fact per line: `- gate …`, `- dual-review path: …`,
  `- failed gate: …`, `- degraded reason: …`.
- `tests/build-gate/review-evidence-recording.ts` —
  `maybeRecordReviewEvidence({ options, result, report, writers })`. Resolves
  the artefact path, writes `report` to it via an injectable
  `writeArtefact(path, content)` (default `writeEvidenceArtefact`), and reports
  write failures on stderr.
- `tests/build-gate/review-evidence-artefact.ts` — pure helpers:
  `RecordedEvidenceResult` union (`present | missing | invalid | usage-error`),
  `parseRecordedStatus`, `classifyRecordedEvidence({ path, content })`,
  `resolveEvidenceArtefactPath`, `DEFAULT_EVIDENCE_ARTEFACT_PATH =
  ".review-evidence/report.txt"`.
- `tests/build-gate/review-evidence-artefact-report.ts` —
  `formatRecordedEvidenceResult` (pure; renders `Review evidence artefact: …`).
- `tests/build-gate/review-evidence-artefact-cli.ts` —
  `runReviewEvidenceArtefactCli(args, options)` with injectable `readFile`,
  writers, `env`, `cwd`; `exitCodeFor` maps present→0, missing/invalid→1,
  usage-error→2.
- `tests/build-gate/review-evidence-cli.ts` —
  `runReviewEvidenceCli(args, options)` with injectable `createRunner`,
  `gateCommands`, writers, `env`, `cwd`, `writeArtefact`. Calls
  `maybeRecordReviewEvidence` after emitting the report.
- `tests/build-gate/cli-support.ts` — `runCliEntrypoint`, `resolveCliWriters`,
  `emitCliReport`.
- `tests/build-gate/report-format-helpers.ts` — `singleLine`, `assertNever`.

Term definitions:

- "Reviewed tree state" — the Git tree object of the current `HEAD` commit
  (`git rev-parse HEAD^{tree}`), i.e. the content snapshot the review gates ran
  against.
- "Provenance marker / trailer" — two report lines appended to a recorded
  artefact naming the reviewed commit and tree.
- "Unbound artefact" — a recorded report with no provenance trailer (either
  pre-1.5.12, or written after a provenance-read failure). It cannot be verified
  against the tree and is rejected.

Existing tests to mirror for style: `review-evidence-artefact.test.ts`,
`review-evidence-artefact-cli.test.ts`,
`review-evidence-artefact.property.test.ts` (uses `fast-check`),
`review-evidence-cli-record.test.ts`,
`review-evidence-artefact-cli-smoke.test.ts`.

## Plan of work

Test-first throughout (Red → Green → Refactor). Bun's test runner has no strict
xfail marker, so the red stage is proven by running the focused new/updated test
and observing it fail for the intended reason before writing production code
(execplans skill: "nearest observable substitute"). Each work item is one
commit that leaves `make all` green.

### WI-1: Add the pure tree-provenance marker module

Docs to read: AGENTS.md "TypeScript Guidance", "Code Style and Structure";
docs/complexity-antipatterns-and-refactoring-strategies.md (value objects vs
primitive obsession); docs/documentation-style-guide.md (comment tone).
Skills to load: `biomejs` (lint/format conventions — the repo has no
TypeScript router skill; follow AGENTS.md TypeScript Guidance directly).
Investigation tools: `leta show`/`leta refs` for symbol navigation, `grepai`
for concept search (index reflects `main` only — verify branch-local facts in
the worktree).

Create `tests/build-gate/review-evidence-provenance.ts` (pure, no Git, no fs):

- `TreeProvenance` type: `{ readonly commit: string; readonly tree: string }`.
- `export const REVIEWED_COMMIT_LINE_PREFIX = "- reviewed commit: "` and
  `export const REVIEWED_TREE_LINE_PREFIX = "- reviewed tree: "`. Verified these
  do not collide with any existing report line prefix — the existing prefixes
  are `- gate`, `- dual-review path:`, `- failed gate:`, `- degraded reason:`,
  and `- usage error:` (each followed by its value).
- `export function formatProvenanceTrailer(p: TreeProvenance): string` returns
  the commit line, then the tree line, each prefixed as above and terminated by
  a newline.
- `export function parseTreeProvenance(content: string): TreeProvenance |
  undefined` — split on `/\r?\n/`, find the first line for each prefix, return
  `undefined` if either is absent.
- `export function compareTreeProvenance(embedded: TreeProvenance, current:
  TreeProvenance): "match" | "mismatch"` — `match` iff
  `embedded.tree === current.tree` (tree is authoritative; see Decision Log).

Tests (Red first): `tests/build-gate/review-evidence-provenance.test.ts` —
round-trip `formatProvenanceTrailer` → `parseTreeProvenance`; missing-either-line
→ `undefined`; `compareTreeProvenance` match/mismatch (equal tree with differing
commit still matches; differing tree mismatches).
Property test: extend `review-evidence-artefact.property.test.ts` or add
`review-evidence-provenance.property.test.ts` using `fast-check` — for arbitrary
40-char lowercase-hex commit/tree pairs,
`parseTreeProvenance(formatProvenanceTrailer(p)) === p`.

Validation: `make all`.

### WI-2: Read tree provenance through the shared Git seam

Docs to read: docs/developers-guide.md (build-gate command execution via
git-support.ts); AGENTS.md abstraction/adapter/helper policy (sweep for an
existing helper first — none exists; the new reader is the single owner of
`rev-parse` for provenance). Skills: `biomejs`. Investigation: `leta refs
runGit`, `sem` for how git-support callers are shaped.

Add to `tests/build-gate/review-evidence-provenance.ts` (still importing only
types from git-support, keeping the module ≤400 lines; if it approaches the
limit, split the Git reader into
`tests/build-gate/review-evidence-provenance-git.ts`):

- `ReadTreeProvenanceResult` type: a discriminated union of
  `{ ok: true; provenance: TreeProvenance }` and
  `{ ok: false; message: string }` (all fields `readonly`).
- `export function readTreeProvenance(git: GitRunner):
  ReadTreeProvenanceResult` — run `runGit(git, ["rev-parse", "HEAD"])` and
  `runGit(git, ["rev-parse", "HEAD^{tree}"])`; on any non-zero status, missing
  Git, or empty output, return `{ ok: false, message }` with a deterministic,
  single-line message (use `singleLine` from report-format-helpers.ts); on
  success return trimmed hashes.

Tests (Red first): `tests/build-gate/review-evidence-provenance-git.test.ts`
using an in-test fake `GitRunner` (mirror `createFakeRunnerFactory` shape) that
returns canned `CommandResult`s: both succeed → provenance; `rev-parse HEAD`
fails / not a repo (status 128) → `{ ok: false }`; empty stdout → `{ ok: false }`.

Validation: `make all`.

### WI-3: Bind provenance into recorded artefacts at record time

Docs to read: AGENTS.md "Roadmap Review & Audit Evidence" (recording contract,
exit-code invariant); docs/developers-guide.md build-gate recording paragraph.
Skills: `biomejs`. Investigation: `leta refs maybeRecordReviewEvidence`,
`leta refs runReviewEvidenceCli`.

Production changes:

- `tests/build-gate/review-evidence-recording.ts`: add an injectable
  `readProvenance?: (cwd: string) => ReadTreeProvenanceResult` to
  `ReviewEvidenceRecordingOptions` (default:
  `(dir) => readTreeProvenance(createGitRunner(dir))`). In
  `maybeRecordReviewEvidence`, after deciding to record, resolve the cwd, call
  `readProvenance`; if `ok`, write `report + formatProvenanceTrailer(provenance)`;
  if not `ok`, write the bare `report` and emit
  `input.writers.writeErr(\`review evidence provenance unavailable: ${message}\n\`)`
  (report still recorded, unbindable). Existing write-failure handling is
  unchanged.
- `tests/build-gate/review-evidence-cli.ts`: thread the optional
  `readProvenance` through `RunReviewEvidenceCliOptions` into the
  `maybeRecordReviewEvidence` options object. No change to stdout emission or
  exit codes.

Tests (Red first — update in the same commit):

- `review-evidence-cli-record.test.ts`: inject a deterministic fake
  `readProvenance` returning a fixed `{ commit, tree }`; assert recorded content
  `=== output.stdout + formatProvenanceTrailer(fixed)`; assert stdout has NO
  trailer; update the inline snapshots to include the two trailer lines. Add a
  case: `readProvenance` returns `{ ok: false }` → recorded content `===`
  stdout (no trailer), stderr contains `review evidence provenance unavailable`,
  exit code unchanged (0/3 as before). Keep the existing "does not record
  usage-error" and "write failure" cases green.
- `review-evidence-cli-record-smoke.test.ts`: verify whether it asserts exact
  recorded content; if so, update expectations to include the trailer (inject a
  fake reader if the test controls options, otherwise assert the presence of the
  trailer prefixes).

Validation: `make all`. (After WI-3 the *old* artefact CLI still classifies a
trailered artefact as `present` because the trailer does not disturb
`parseRecordedStatus` or the required-line check — confirm by running
`bun test tests/build-gate/review-evidence-artefact-cli.test.ts`.)

### WI-4: Reject stale or mismatched recorded artefacts in the artefact CLI

Docs to read: AGENTS.md "Roadmap Review & Audit Evidence" (artefact exit-code
surface); docs/developers-guide.md artefact paragraph. Skills: `biomejs`.
Investigation: `leta refs classifyRecordedEvidence`, `leta refs
runReviewEvidenceArtefactCli`.

Production changes:

- `tests/build-gate/review-evidence-artefact.ts`: add a `mismatched` variant to
  `RecordedEvidenceResult`:
  `{ readonly outcome: "mismatched"; readonly path: string; readonly expected:
  TreeProvenance; readonly actual: TreeProvenance }`. Keep the existing pure
  `classifyRecordedEvidence` unchanged (presence only). Add a new pure
  `classifyBoundEvidence({ path, content, current }: { path: string; content:
  string | undefined; current: TreeProvenance }): RecordedEvidenceResult` that:
  1. calls `classifyRecordedEvidence`; if not `present`, returns it verbatim;
  2. else `parseTreeProvenance(content)`; if `undefined`, returns
     `{ outcome: "invalid", path, reason: "recorded evidence is not bound to a
     reviewed tree state" }`;
  3. else compares via `compareTreeProvenance`; `mismatch` →
     `{ outcome: "mismatched", path, expected, actual: current }`; `match` →
     the `present` result.
- `tests/build-gate/review-evidence-artefact-report.ts`: render the `mismatched`
  outcome, e.g.
  `Review evidence artefact: mismatched` / `- artefact path: …` /
  `- expected tree: <expected.tree>` / `- recorded commit: <expected.commit>` /
  `- current tree: <actual.tree>` / `- current commit: <actual.commit>` (one
  fact per line; use `singleLine`).
- `tests/build-gate/review-evidence-artefact-cli.ts`: add an injectable
  `readProvenance?: (cwd: string) => ReadTreeProvenanceResult` (default
  `(dir) => readTreeProvenance(createGitRunner(dir))`). Compute current
  provenance from `options.cwd ?? cwd()`; if `{ ok: false }`, produce a
  `usage-error` result (exit 2) with message
  `could not determine current reviewed tree state: <message>`; otherwise call
  `classifyBoundEvidence` with the read content and current provenance. Extend
  `exitCodeFor`: `mismatched` → 1 (alongside `missing`/`invalid`).

Tests (Red first — update in the same commit):

- `review-evidence-artefact-cli.test.ts`: inject a fake `readProvenance`
  returning a fixed current `{ commit, tree }`; feed content built from a
  complete report plus `formatProvenanceTrailer` — matching tree → `present`,
  exit 0; differing tree → `mismatched`, exit 1, stderr names expected/current
  tree; content with no trailer → `invalid` (unbound reason), exit 1;
  `readProvenance` `{ ok: false }` → usage-error, exit 2. Keep missing/unknown-flag
  cases green.
- `review-evidence-artefact.test.ts`: add `classifyBoundEvidence` unit cases
  (present-match, mismatch, unbound, and pass-through of missing/invalid).
- `review-evidence-artefact.property.test.ts`: the existing round-trip asserts
  `classifyRecordedEvidence` still returns `present` for a trailer-free report —
  keep it (that function is unchanged). Optionally add a property that a report
  plus a matching trailer classifies as `present` under `classifyBoundEvidence`.

Validation: `make all`.

### WI-5: Wire the end-to-end smoke path and update the documentation

Docs to read/update: AGENTS.md "Roadmap Review & Audit Evidence";
docs/developers-guide.md build-gate section (~209–296); docs/roadmap.md task
1.5.12. Style: docs/documentation-style-guide.md, en-gb-oxendict (80-col prose
wrap, 120-col code blocks). Skills: `biomejs`, `en-gb-oxendict`,
`commit-message`, `changelog` only if a CHANGELOG exists (verify first).

Code:

- `tests/build-gate/review-evidence-artefact-cli-smoke.test.ts`: rebuild
  fixtures inside a temporary Git repository via `createTemporaryRepository`
  from git-support.ts. Seed a file, `commitAll`, read
  `git rev-parse HEAD`/`HEAD^{tree}` (through `createGitRunner`), write a
  recorded report with a matching trailer → expect exit 0 `present`; write one
  with a deliberately wrong tree → expect exit 1 `mismatched`; keep a
  missing-artefact case (now, with a repo present, still `missing` exit 1).
  Update the "accepts a verified default artefact" expectation to run inside the
  repo and include the recorded status line.

Documentation:

- AGENTS.md "Roadmap Review & Audit Evidence": state that a recorded artefact
  now carries a reviewed commit and tree provenance trailer; that
  `make review-evidence-artefact` recomputes the current reviewed tree and
  rejects a mismatched or unbound recording (exit 1), rejecting an
  unbound/pre-existing report as well; a non-repository or unreadable current
  tree is a usage error (exit 2); recording a provenance-read failure never
  changes the review-evidence exit code.
- docs/developers-guide.md build-gate section: mirror the above; note that plain
  `make review-evidence` stdout is unchanged and Git-free, and that the trailer
  appears only in the recorded artefact.
- docs/roadmap.md: tick `- [x] 1.5.12` and add a completion note summarizing the
  bound-artefact contract and the tree-authoritative match rule.

Validation: `make all`, then `make markdownlint` and `make nixie`. Format only
the touched docs before gating:
`bunx mdtablefix docs/developers-guide.md docs/roadmap.md AGENTS.md` then
`bunx markdownlint-cli2 --fix docs/developers-guide.md docs/roadmap.md AGENTS.md`
(all three paths are edited in this work item, so the list is path-safe).

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-12`.

For each work item:

1. Write or update the focused test(s). Run the focused file and observe the
   red failure for the intended reason:

   ```bash
   bun test tests/build-gate/review-evidence-provenance.test.ts
   ```

   Expected before implementation: the new assertions fail (e.g. "Cannot find
   module './review-evidence-provenance'" or an assertion mismatch).

2. Implement the minimal production change. Re-run the focused file and expect
   it to pass.

3. Run the full gate before committing:

   ```bash
   make all
   ```

   Expected tail: Biome check, Oxlint, `tsc --noEmit`, and `bun test` all pass;
   the file-size guard reports no over-limit files.

4. For WI-5 only, additionally run:

   ```bash
   make markdownlint
   make nixie
   ```

   Expected: markdownlint reports no errors on the changed Markdown; `nixie
   --no-sandbox` validates any Mermaid without error.

5. Commit with an imperative en-GB subject (use the `commit-message` skill),
   e.g. `Bind recorded review evidence to the reviewed tree`.

## Validation and acceptance

Quality criteria (what "done" means):

- Tests: `make all` passes at every commit. New unit tests for
  `formatProvenanceTrailer`/`parseTreeProvenance`/`compareTreeProvenance`,
  `readTreeProvenance`, `classifyBoundEvidence`; updated recording and artefact
  CLI tests; a `fast-check` provenance round-trip property; a real-process smoke
  test proving present vs mismatched.
- Lint/typecheck: `make all` (Biome, Oxlint, `tsc --noEmit`) clean.
- Markdown: `make markdownlint` and `make nixie` clean for the docs commit.
- Behaviour acceptance (manual, in a scratch Git repo or the worktree):

  ```bash
  ODW_LINT_REVIEW_EVIDENCE_PATH=.review-evidence/report.txt \
    bun run tests/build-gate/review-evidence-cli.ts --no-exec
  bun run tests/build-gate/review-evidence-artefact-cli.ts; echo "exit=$?"
  ```

  Expected: the artefact CLI prints `Review evidence artefact: present` with a
  recorded status and `exit=0` while `HEAD` is unchanged. After any new commit,
  re-running the artefact CLI against the same file prints
  `Review evidence artefact: mismatched` naming the expected and current tree and
  `exit=1`.

Red-Green-Refactor evidence to record at implementation: for each work item, the
focused `bun test <file>` command, its red failure message, and its green pass
after the minimal change; then the `make all` pass after refactor/cleanup.

## Idempotence and recovery

- All steps are re-runnable. Tests use hermetic temporary Git repositories
  (`createTemporaryRepository`, `mkdtempSync`) removed in `finally` blocks; no
  step mutates the real `.review-evidence/` of the worktree except the optional
  manual acceptance run, whose artefact is git-ignored scratch output.
- If a commit fails a gate, fix forward on the same work item; do not proceed to
  the next work item until `make all` is green.
- No destructive operations. The roadmap tick in WI-5 is the only tracked-file
  content change outside `tests/build-gate/` besides the doc updates.

## Interfaces and dependencies

Use only Node/Bun built-ins, the `git` executable via
`tests/build-gate/git-support.ts`, and in-repo `fast-check`.

New/changed surfaces (final shapes):

```typescript
// tests/build-gate/review-evidence-provenance.ts
export type TreeProvenance = { readonly commit: string; readonly tree: string };
export function formatProvenanceTrailer(p: TreeProvenance): string;
export function parseTreeProvenance(content: string): TreeProvenance | undefined;
export function compareTreeProvenance(
  embedded: TreeProvenance,
  current: TreeProvenance,
): "match" | "mismatch";
export type ReadTreeProvenanceResult =
  | { readonly ok: true; readonly provenance: TreeProvenance }
  | { readonly ok: false; readonly message: string };
export function readTreeProvenance(git: GitRunner): ReadTreeProvenanceResult;

// tests/build-gate/review-evidence-artefact.ts (added variant + function)
export type RecordedEvidenceResult =
  | { readonly outcome: "present"; readonly path: string; readonly status: RecordedStatus }
  | { readonly outcome: "missing"; readonly path: string }
  | { readonly outcome: "invalid"; readonly path: string; readonly reason: string }
  | {
      readonly outcome: "mismatched";
      readonly path: string;
      readonly expected: TreeProvenance;
      readonly actual: TreeProvenance;
    }
  | { readonly outcome: "usage-error"; readonly message: string };
export function classifyBoundEvidence(input: {
  readonly path: string;
  readonly content: string | undefined;
  readonly current: TreeProvenance;
}): RecordedEvidenceResult;
```

Injectable seams added: `ReviewEvidenceRecordingOptions.readProvenance` and
`RunReviewEvidenceArtefactCliOptions.readProvenance`, both
`(cwd: string) => ReadTreeProvenanceResult`, defaulting to
`readTreeProvenance(createGitRunner(cwd))`.
