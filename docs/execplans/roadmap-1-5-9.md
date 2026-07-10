# Consolidate Build-Gate CLI Support

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / Big Picture

Roadmap task 1.5.9 removes duplicated command-line boilerplate from the
build-gate test suite. Three reviewer-facing gates each redeclare the same
output-writer type, the same default `stdout`/`stderr` writer object, and the
same "format a result, then send it to the correct stream" dispatch shape:

- `tests/build-gate/branch-freshness-git.ts` (`runBranchFreshnessCli`),
- `tests/build-gate/whitespace-hygiene.ts` (`runWhitespaceHygieneCli`), and
- `tests/build-gate/review-evidence-cli.ts` (`runReviewEvidenceCli`).

After this work, a maintainer can change how build-gate CLIs resolve their
output streams or route a report to `stdout` versus `stderr` in one documented
test-support module, `tests/build-gate/cli-support.ts`, instead of keeping
three copies of the same writer contract synchronized. Each gate keeps its own
policy (what it checks) and its own result contract (its exit-code mapping and
report text); only the shared writer plumbing moves.

This continues the consolidation pattern established by roadmap task 1.5.5,
which extracted `tests/build-gate/git-support.ts` for shared Git process,
tracked-file, temporary-repository, and CLI-output-capture support. Task 1.5.9
is the CLI-writer analogue one layer up.

Success is observable when:

- `bun test ./tests/build-gate/cli-support.test.ts` passes and proves the
  shared writer type, default-stream resolution, and report dispatch,
- branch-freshness, whitespace-hygiene, and review-evidence CLIs consume the
  one shared `tests/build-gate/cli-support.ts` helper and no longer declare a
  local `CliWriters` type or an inline `{ writeOut: stdout.write, writeErr:
  stderr.write }` default,
- every existing gate test still passes with unchanged exit codes and unchanged
  reviewer-facing report text, and
- `make all`, `make markdownlint`, and `make nixie` pass.

Implementation must not begin until this draft is reviewed and approved.

## Constraints

- Work only in the git-donkey worktree:
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-9`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as canonical and the integration branch as `main`.
- Refresh from `origin/main` before code implementation. If the branch is
  behind, rebase onto `origin/main` unless a merge commit is explicitly chosen
  and recorded in `Decision Log`.
- Use this GrepAI command shape as the primary intent-search tool:

  ```sh
  grepai search --workspace Projects --project odw-lint "<English intent query>" --toon --compact
  ```

  The GrepAI index reflects canonical `main` only. Verify every branch-local
  fact inside this worktree with `leta`, exact text search, or direct file
  inspection before acting. If GrepAI is unavailable, record the exact command
  and failure in `Surprises & Discoveries` and continue with bounded
  branch-local evidence.
- Use `leta` for branch-local TypeScript symbol navigation, references, call
  graphs, and refactoring. Exact text search is acceptable for Markdown,
  Makefile rules, lockfile entries, and string literals that are not code
  symbols. If `leta` fails transiently, record the exact command and failure in
  `Surprises & Discoveries`, then continue with bounded file inspection. Leta
  unavailability is not a valid reason to mark this plan BLOCKED.
- Use `sem` instead of raw Git history or blame if codebase history navigation
  is needed. Ordinary `git status`, scoped diffs, and Git commands used by the
  build-gate tests remain acceptable.
- Read and obey `AGENTS.md`, `docs/terms-of-reference.md`,
  `docs/technical-design.md`, `docs/adr/0001-static-analysis-boundary.md`,
  `docs/developers-guide.md`, `docs/users-guide.md`,
  `docs/repository-layout.md`, `docs/scripting-standards.md`,
  `docs/complexity-antipatterns-and-refactoring-strategies.md`,
  `docs/documentation-style-guide.md`, and `docs/roadmap.md` before
  implementation.
- Use en-GB Oxford spelling ("-ize"/"-yse"/"-our") in prose and comments.
  Preserve external API, command, and package names exactly.
- Keep every work item independently committable and gate-passable. Commit
  after each completed work item only after its gates pass.
- Do not add or update package dependencies. The selected mechanism uses only
  the existing Node-compatible `node:process` streams, Bun's built-in
  `bun:test` runner, TypeScript, Biome, Oxlint, markdownlint, nixie, and Make
  targets already locked in `bun.lock`.
- Do not add production `src/` code. The helper seam is test/build-gate
  infrastructure only and must not be exported from the package entry point.
- Do not import executable ODW runtime paths. Do not execute workflow source,
  import workflow fixtures as modules, call ODW loader helpers, start ODW runs,
  or dispatch agents.
- Preserve each gate's feature-specific policy and result contract. The
  externally observable exit codes and the exact `stdout`/`stderr` report text
  of `make branch-freshness`, `make whitespace-hygiene`, and
  `make review-evidence` must not change. In particular:
  - branch-freshness keeps exit codes 0 (fresh/skipped), 1 (stale), 2
    (usage-error) and its `formatBranchFreshnessResult` text, routing exit 2 to
    `stderr` and everything else to `stdout`;
  - whitespace-hygiene keeps exit codes 0 (passed), 1 (violations), 2 (failed)
    and its exact `stdout`/`stderr` messages, routing "passed" to `stdout` and
    both violation and failure output to `stderr`;
  - review-evidence keeps exit codes 0 (verified), 1 (failed), 2 (usage-error),
    3 (degraded) and its `formatReviewEvidenceResult` text, routing usage-error
    to `stderr` and everything else to `stdout`.
- Respect the strict TypeScript compiler options in `tsconfig.json`, including
  `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and
  `noPropertyAccessFromIndexSignature`. Any shared "overrides" parameter must
  tolerate explicitly `undefined` writer fields forwarded from optional caller
  options.
- Keep source and test files under 400 physical lines. Split support code and
  tests before either file approaches that limit.
- Format only changed files. Do not run repository-global mutating formatters
  such as `make fmt`, `bun fmt`, or `mdformat-all`.
- For Markdown files changed by each work item, run `mdtablefix` then
  `markdownlint-cli2 --fix` only on those exact paths before gates.
- Validation commands must be path-safe. Do not list optional files in direct
  formatter or linter commands unless the same work item definitely creates or
  edits them. Rely on `make all`, `make markdownlint`, and `make nixie` as the
  authoritative gates.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances

- Scope: stop and escalate if implementation needs production `src/` changes,
  package export changes, dependency changes, or Makefile target changes.
- Size: stop and escalate if implementation exceeds 5 changed non-test
  TypeScript files, 6 changed test files, or 250 net TypeScript lines.
- Interface: stop and escalate if a public package API signature must change.
  Test-helper APIs may change when all in-repository call sites are updated in
  the same work item.
- Dependencies: stop and escalate if a new external dependency is required.
- Behaviour: stop and escalate if any gate's externally observable exit codes,
  `stdout`/`stderr` messages, stream routing, or path scope must change to
  complete the refactor.
- Iterations: stop and escalate if the same focused test or repository gate
  fails after 3 implementation attempts for reasons not explained by the
  expected Red stage.
- Ambiguity: stop and escalate if two valid helper boundaries remain after
  reading the cited docs and code and the choice would materially affect future
  ownership (for example, whether `CliWriters` should live in `cli-support.ts`
  or be re-homed into `git-support.ts`).

## Risks

- Risk: The whitespace-hygiene runner writes each branch inline
  (`writeOut("...passed...")`, `writeErr(violations)`, `writeErr(failure)`)
  rather than formatting one result object, so folding it onto a single
  report-dispatch helper could accidentally reorder work (scanning) relative to
  writing, or change which stream a branch uses.
  Severity: high.
  Likelihood: medium.
  Mitigation: keep the existing inline `stdout`/`stderr` snapshot tests in
  `whitespace-hygiene.test.ts` as the regression guard; refactor the runner to
  compute a `{ report, toErr, exitCode }` outcome first and dispatch once,
  preserving every message byte-for-byte and every stream choice.
- Risk: `exactOptionalPropertyTypes` rejects forwarding
  `options.writeOut`/`options.writeErr` (each `(...) => void` or `undefined`)
  into a `Partial<CliWriters>` override object.
  Severity: medium.
  Likelihood: high.
  Mitigation: type the override parameter to explicitly permit `undefined`
  field values (`writeOut?: CliWriters["writeOut"] | undefined`) and pin this
  with a focused type-level and runtime test.
- Risk: The shared helper becomes an over-broad "CLI utility drawer".
  Severity: medium.
  Likelihood: medium.
  Mitigation: limit `cli-support.ts` to the writer type, default-stream
  resolution, and single-report dispatch. Result formatting stays in each
  gate's `*-report.ts`/runner, and exit-code mapping stays in each gate module.
- Risk: `git-support.ts` already exports `CapturedCliOutput` with the same
  `writeOut`/`writeErr` fields; deduplicating it against the new `CliWriters`
  could disturb its many test consumers.
  Severity: low.
  Likelihood: low.
  Mitigation: reuse `CliWriters` in `CapturedCliOutput` as a purely structural
  type alias intersection so no `createCapturedCliOutput` call site or
  `git-support.test.ts` assertion changes; verify with the focused git-support
  test before committing.
- Risk: A behaviour-preserving refactor has no natural failing Red test.
  Severity: low.
  Likelihood: medium.
  Mitigation: for the new helper use genuine Red-Green-Refactor (helper does
  not exist yet). For each migration, first update the test to import and
  assert the shared seam so it fails to type-check or run before the runner is
  migrated, keeping the existing stream/exit-code assertions as the
  behavioural guard.

## Progress

- [x] (2026-07-03 00:00Z) Drafted the first planning round for roadmap task
  1.5.9.
- [x] (2026-07-03 00:00Z) Work item 0: refreshed from origin/main and
  re-baselined evidence. `sem diff --from HEAD --to origin/main` reported no
  changes, so no rebase was required. Resolved tool versions were Bun 1.3.11
  and TypeScript 6.0.3.
- [x] (2026-07-03 00:00Z) Work item 1: introduced
  `tests/build-gate/cli-support.ts`, covered default writer resolution,
  explicit `undefined` override fallback, and report dispatch in
  `tests/build-gate/cli-support.test.ts`, and reused `CliWriters` in
  `tests/build-gate/git-support.ts`.
- [x] (2026-07-03 00:00Z) Work item 2: moved branch-freshness and
  review-evidence CLIs onto `CliWriters`, `resolveCliWriters`, and
  `emitCliReport`, and added source-guard tests that reject reintroducing local
  writer seams.
- [x] (2026-07-03 00:00Z) Work item 3: moved the whitespace-hygiene CLI onto
  the shared writer seam, kept exact stdout/stderr snapshots passing, and
  guarded against reintroducing a local writer type.
- [x] (2026-07-03 00:00Z) Work item 4: documented helper ownership in the
  developer guide and repository layout, ticked roadmap task 1.5.9 complete,
  and recorded final outcomes.

## Surprises & Discoveries

- Observation: There is no `docs/issues/audit-1.5.9.md`; task 1.5.9 is a
  planned roadmap consolidation, not an addendum from an audit finding.
  Evidence: `docs/issues/` contains audit files up to `audit-2.1.12.md` but no
  `audit-1.5.9.md`; `docs/roadmap.md` lists 1.5.9 as a plain task requiring
  1.5.5 and 1.5.6.
  Impact: the intent source is the roadmap task text plus the precedent of the
  completed 1.5.5 seam, verified directly against the three CLI modules in this
  worktree.
- Observation: `leta files` succeeded after adding the worktree, but the
  branch-local symbol grep command failed with a transient connection drop.
  Evidence: this command returned `Error: Connection closed unexpectedly`.

  ```sh
  leta grep \
    "CliWriters|writeOut|writeErr|runReviewEvidenceCli|runBranchFreshnessCli|runWhitespaceHygieneCli" \
    tests/build-gate \
    -k function,method,type,interface,variable,const \
    --docs \
    --head 160
  ```

  Impact: per the plan tolerance, this is not a blocker. Branch-local evidence
  for work item 0 came from `leta files` plus direct inspection of the relevant
  `tests/build-gate/*` modules and tests.
- Observation: GrepAI was available, but the broad intent searches favoured
  prior ExecPlans over the current build-gate source.
  Evidence: searches for build-gate CLI writer/default-stream/report-dispatch
  terms returned `docs/execplans/roadmap-1-5-5.md`,
  `docs/execplans/roadmap-1-5-7.md`, and related plan files.
  Impact: the prior plans remain useful precedent for the helper-seam pattern;
  every branch-local source fact was verified directly in this worktree.
- Observation: after the work item 0 plan update, `origin/main` advanced by one
  commit adding documentation contents freshness coverage.
  Evidence: after rebasing, `make all` failed in
  `tests/build-gate/documentation-contents.test.ts` because
  `docs/execplans/roadmap-1-5-9.md` was not linked from `docs/contents.md`.
  Impact: work item 0 now includes a narrow `docs/contents.md` index entry for
  this ExecPlan so the documentation freshness gate passes on current main.
- Observation: the work item 1 Red stage failed for the intended missing-helper
  reason.
  Evidence: `bun test ./tests/build-gate/cli-support.test.ts` reported
  `Cannot find module './cli-support'` before
  `tests/build-gate/cli-support.ts` existed.
  Impact: the new helper tests proved the missing seam before implementation;
  after adding the helper,
  `bun test ./tests/build-gate/cli-support.test.ts ./tests/build-gate/git-support.test.ts`
  passed with 19 tests.
- Observation: work item 2's source-guard tests and migration were applied in
  one patch before the focused test run, so there is no separate captured Red
  transcript for those migration guards.
  Evidence: this focused test command passed with 42 tests after migration.

  ```sh
  bun test \
    ./tests/build-gate/branch-freshness-git.test.ts \
    ./tests/build-gate/review-evidence-cli.test.ts \
    ./tests/build-gate/review-evidence.property.test.ts
  ```

  Impact: the final tests still pin the intended seam and behaviour, but the
  Red-Green evidence for this refactor item is weaker than planned.
- Observation: work item 3 followed the same source-guard pattern as work item
  2 and was validated by unchanged inline output snapshots.
  Evidence:
  `bun test ./tests/build-gate/whitespace-hygiene.test.ts ./tests/build-gate/whitespace-hygiene-support.test.ts`
  passed with 15 tests and 12 snapshots after migration.
  Impact: the whitespace runner now dispatches one computed report through the
  shared helper while preserving the user-facing messages byte-for-byte.

## Decision Log

- Decision: Extract one test-only helper module named
  `tests/build-gate/cli-support.ts` owning `CliWriters`, default-stream
  resolution (`resolveCliWriters`), and single-report dispatch
  (`emitCliReport`).
  Rationale: the roadmap success criterion names "one documented CLI-support
  helper" consumed by all three CLIs. This mirrors the cohesive
  `git-support.ts` seam from 1.5.5 while keeping formatting and exit-code
  policy colocated with each gate.
  Date/Author: 2026-07-03 / Codex.
- Decision: Keep report formatting (`formatBranchFreshnessResult`,
  `formatReviewEvidenceResult`, and whitespace's inline messages) and exit-code
  mapping in the gate modules; the shared helper only receives an already
  formatted `report` string plus a `toErr` boolean and writers.
  Rationale: the task explicitly requires "preserving each gate's policy and
  result contract". A pure writer/dispatch seam avoids leaking result unions
  into the shared module.
  Date/Author: 2026-07-03 / Codex.
- Decision: Type the `resolveCliWriters` override parameter to allow explicitly
  `undefined` field values.
  Rationale: `review-evidence-cli.ts` forwards optional
  `options.writeOut`/`options.writeErr`; under `exactOptionalPropertyTypes` a
  bare `Partial<CliWriters>` would reject `{ writeOut: undefined }`.
  Date/Author: 2026-07-03 / Codex.
- Decision: Use the existing `node:process` `stdout`/`stderr` streams and
  `bun:test`; add no new library.
  Rationale: the task is consolidation, not a dependency change; the current
  CLIs already write with `stdout.write`/`stderr.write`.
  Date/Author: 2026-07-03 / Codex.
- Decision: No sibling ODW checkout is needed for the implementation mechanism.
  Rationale: the task touches only build-gate CLI plumbing under `tests/`. It
  does not lean on ODW loader, workflow, or example behaviour. Static ODW
  runtime boundaries still apply as constraints.
  Date/Author: 2026-07-03 / Codex.
- Decision: Treat the user's explicit instruction to execute the approved
  ExecPlan as approval for implementation, and update the status from DRAFT to
  IN PROGRESS during work item 0.
  Rationale: the workflow prompt states that the plan is approved and must be
  executed work item by work item; pausing on the stale status line would
  conflict with the no-clarifying-questions instruction.
  Date/Author: 2026-07-03 / Codex.

## Outcomes & Retrospective

To be completed as work items land. Compare the delivered seam against the
purpose: one documented CLI-support helper consumed by the branch-freshness,
whitespace-hygiene, and review-evidence CLIs, with unchanged exit codes and
report text.

Completed outcome: `tests/build-gate/cli-support.ts` now owns the shared
`CliWriters` type, default process-stream resolution, and one-report dispatch
helper for build-gate CLIs. `runBranchFreshnessCli`,
`runReviewEvidenceCli`, and `runWhitespaceHygieneCli` consume that helper while
keeping their result formatting, exit-code mapping, and stream-routing policy
local. The developer guide and repository layout now document the helper
ownership boundary, and roadmap task 1.5.9 is ticked complete.

Validation evidence at close-out:

- focused close-out build-gate tests passed with 50 tests and 15 snapshots:

  ```sh
  bun test \
    ./tests/build-gate/cli-support.test.ts \
    ./tests/build-gate/branch-freshness-git.test.ts \
    ./tests/build-gate/review-evidence-cli.test.ts \
    ./tests/build-gate/whitespace-hygiene.test.ts
  ```

- work-item deterministic gates passed before each commit;
- CodeRabbit returned zero findings for work items 0, 1, 2, and 3 after one
  work item 2 rate-limit backoff.

## Context and Orientation

Roadmap task 1.5.9 appears in `docs/roadmap.md` under section 1.5 "Preserve
public API and review surfaces". It requires tasks 1.5.5 and 1.5.6 and reads:

```plaintext
Consolidate build-gate CLI support.
  - Extract shared CLI writer, default stream, and report-dispatch support for
    build-gate command modules while preserving each gate's policy and result
    contract.
  - Requires 1.5.5 and 1.5.6.
  - Success: branch-freshness, whitespace-hygiene, and review-evidence CLIs
    consume one documented CLI-support helper before another build gate clones
    the same reviewer-facing command boilerplate.
```

The build-gate test suite lives entirely under `tests/build-gate/`. There is no
production `src/` CLI; each `make` gate runs a `tests/build-gate/*.ts` entry
point with `bun run`. The relevant Makefile targets are:

- `whitespace-hygiene: bun run tests/build-gate/whitespace-hygiene.ts`,
- `branch-freshness: bun run tests/build-gate/branch-freshness-git.ts`,
- `review-evidence: bun run tests/build-gate/review-evidence-cli.ts`.

The current, duplicated CLI plumbing is:

- `tests/build-gate/branch-freshness-git.ts` lines 22-25 declare a local
  `CliWriters` type; `runBranchFreshnessCli` (lines 74-98) defaults `writers`
  to an inline `{ writeOut: (m) => stdout.write(m), writeErr: (m) =>
  stderr.write(m) }`, formats the result via `formatBranchFreshnessResult`,
  computes `exitCodeForBranchFreshness`, and dispatches: exit 2 to `writeErr`,
  otherwise `writeOut`.
- `tests/build-gate/whitespace-hygiene.ts` lines 17-20 declare the same
  `CliWriters` type; `runWhitespaceHygieneCli` (lines 29-55) defaults `writers`
  to the same inline object and writes each branch inline: "passed" to
  `writeOut`, violations to `writeErr`, and caught failures to `writeErr`.
- `tests/build-gate/review-evidence-cli.ts` lines 26-29 declare the same
  `CliWriters` type; `runReviewEvidenceCli` (lines 77-100) formats via
  `formatReviewEvidenceResult` and dispatches usage-error to `writeErr` and
  everything else to `writeOut`; a local `cliWriters` helper (lines 320-323)
  resolves default streams from the optional `writeOut`/`writeErr` options.

Additionally, `tests/build-gate/git-support.ts` (lines 46-51) already exports
`CapturedCliOutput`, whose `writeOut`/`writeErr` fields are structurally the
same writer shape. That is a fourth copy of the writer contract that this task
can dedupe with a structural alias.

The new seam must be test-only. It exists to remove duplication in build-gate
tests and scripts, not to define a production CLI abstraction.

Definitions for a first-time reader:

- "Build gate": a repository-maintenance check under `tests/build-gate/` that
  `make` runs before review; it is not an ODW lint rule.
- "Report dispatch": deciding whether an already-formatted report string goes
  to standard output or standard error, then writing it there.
- "Default stream": the real process `stdout`/`stderr` writers used when a
  caller (test) does not inject its own capture writers.

## Source and Behaviour Research

This plan pins its load-bearing assumptions to current repository source and
locked versions:

- The three CLI modules and their exact duplication were read directly in this
  worktree (`branch-freshness-git.ts`, `whitespace-hygiene.ts`,
  `review-evidence-cli.ts`) and are quoted above.
- `tsconfig.json` sets `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, and `noPropertyAccessFromIndexSignature` to
  `true`. This drives the `undefined`-tolerant override-parameter decision.
- `bun.lock` pins `typescript ^5.6.3`, `@biomejs/biome ^2.3.1`, and
  `fast-check ^4.8.0`. The completed 1.5.5 plan recorded the resolved local
  toolchain as Bun 1.3.11, Git 2.53.0, TypeScript 5.9.3, Biome 2.5.1, and
  fast-check 4.8.0; work item 0 re-verifies the resolved versions with
  `bun --version` and `bunx tsc --version` before implementation.
- `node:process` `stdout` and `stderr` are Node-compatible writable streams
  with a synchronous-enough `write(string)` method already used by all three
  CLIs; the default writers only need `write`. The return value of `write` is
  discarded exactly as the current code discards it.
- `tests/build-gate/review-evidence-cli.test.ts` (lines 75-101) and
  `tests/build-gate/branch-freshness-git.test.ts` (lines 219-251) inject
  `createCapturedCliOutput().writeOut`/`writeErr` and assert `stdout`/`stderr`
  routing; `tests/build-gate/whitespace-hygiene.test.ts` (lines 19-129) asserts
  exact `stdout`/`stderr` inline snapshots per branch. These are the
  behaviour-preserving regression guards for the migration.
- `docs/developers-guide.md` "Commit Gate" (lines 170-233) already documents
  that build-gate command execution, tracked-file listing, and captured CLI
  output live in `tests/build-gate/git-support.ts`, and that feature-specific
  policy stays in each gate module. This is the section to extend with the new
  CLI-support helper.
- `docs/repository-layout.md` (lines 131-146) documents `tests/build-gate/`
  ownership and names `git-support.ts` as the shared command/CLI-capture home;
  this is the section to extend.

If GrepAI, Leta, or Sem is unavailable during implementation, record the exact
failing command in `Surprises & Discoveries` and rely on the direct file
inspection above and `leta`/exact-search fallbacks. Advisory-tool
unavailability is not a blocker.

## Documentation and Skill Trail

Read these before implementing each work item:

- `AGENTS.md` sections "Code Style and Structure", "Change Quality &
  Committing", "Refactoring Heuristics & Workflow", "Tooling Defaults",
  "TypeScript Guidance", and "Testing".
- `docs/terms-of-reference.md` sections 1 "Purpose", 6 "Goals", 7 "Non-goals",
  and 9 "Constraints".
- `docs/technical-design.md` sections 2 "Goals and non-goals" and 5
  "Static-analysis boundary".
- `docs/adr/0001-static-analysis-boundary.md` sections "Decision" and
  "Consequences".
- `docs/developers-guide.md` sections "Commit Gate", "Tests", "Markdown", and
  "Documentation Upkeep".
- `docs/users-guide.md` for user-visible command and exit-code context.
- `docs/repository-layout.md` sections "Test and fixture boundaries" and
  "Tooling boundaries".
- `docs/scripting-standards.md` for command-line output conventions.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections on
  separation of concerns / command-query responsibility segregation and on
  avoiding over-granular "ravioli" helpers.
- `docs/documentation-style-guide.md` sections "Spelling", "Markdown rules",
  "Formatting", and "Roadmap task writing guidelines".
- `docs/roadmap.md` task 1.5.9 and its prerequisites 1.5.5 and 1.5.6.
- `docs/execplans/roadmap-1-5-5.md` as the precedent seam and plan shape.

Use these skills:

- `execplans` for maintaining this living plan.
- `grepai` for canonical-main intent search.
- `leta` for branch-local TypeScript navigation and reference checks.
- `sem` for entity-level history or diff navigation if needed.
- `firecrawl` only if an external Bun/TypeScript/Node behaviour citation needs
  refreshing (not expected for this task).

No TypeScript router skill is installed in this session. Use `leta` for
TypeScript navigation and the repository's "TypeScript Guidance" in `AGENTS.md`.

## Plan of Work

### Work Item 0: Refresh from Origin/Main and Re-Baseline Evidence

Implements:

- `AGENTS.md` "Tooling Defaults" and "Change Quality & Committing" by
  validating against current repository gates.
- `docs/developers-guide.md` "Commit Gate" by aligning the branch with the
  current integration target before code work.
- `docs/roadmap.md` task 1.5.9 dependency on completed prerequisites 1.5.5 and
  1.5.6.

Load skills: `execplans`, `grepai`, `leta`, and `sem`.

Steps:

1. Run:

   ```sh
   pwd
   git status --short --branch
   git fetch origin
   sem diff --from HEAD --to origin/main
   bun --version
   bunx tsc --version
   ```

2. If the branch is behind `origin/main`, run:

   ```sh
   git rebase origin/main
   ```

   If rebase conflicts touch protected docs/tests from `origin/main`, preserve
   canonical `origin/main` content unless this task's own ExecPlan file has a
   direct, intentional edit. If rebase cannot complete without changing product
   scope, stop and record the conflict in `Decision Log`.

3. Recompute branch-local evidence after the refresh:

   ```sh
   grepai search --workspace Projects --project odw-lint \
     "build gate CLI writer default stream report dispatch" --toon --compact --limit 8
   leta files
   leta grep "CliWriters|writeOut|writeErr|runReviewEvidenceCli|runBranchFreshnessCli|runWhitespaceHygieneCli" \
     tests/build-gate \
     -k function,method,type,interface,variable,const \
     --docs \
     --head 160
   ```

4. Update this ExecPlan's living sections with refreshed branch status,
   surprising conflicts, resolved tool versions, and any changed source
   evidence.

Validation:

```sh
mdtablefix docs/execplans/roadmap-1-5-9.md
markdownlint-cli2 --fix docs/execplans/roadmap-1-5-9.md
make all
make markdownlint
make nixie
```

Commit this documentation-only refresh independently if it produces a plan
change.

### Work Item 1: Introduce the Shared CLI-Support Seam

Implements:

- `docs/roadmap.md` task 1.5.9's requirement for "shared CLI writer, default
  stream, and report-dispatch support".
- `AGENTS.md` "Refactoring Heuristics & Workflow" (sweep existing helpers
  first, keep helpers cohesive) and "TypeScript Guidance".
- `docs/complexity-antipatterns-and-refactoring-strategies.md` guidance on
  separation of concerns and avoiding over-granular helpers.

Load skills: `execplans`, `grepai`, `leta`.

Red:

1. Add `tests/build-gate/cli-support.test.ts` with deterministic unit tests
   (table-driven where useful) for:
   - `resolveCliWriters()` with no argument returns writers whose `writeOut`
     and `writeErr` call the real process streams (assert by monkeypatching a
     fake `write`, or by asserting the resolved writers are functions and that
     explicit overrides win — see next case);
   - `resolveCliWriters({ writeOut })` uses the provided `writeOut` and falls
     back to the default for `writeErr`, and vice versa;
   - `resolveCliWriters({ writeOut: undefined, writeErr: undefined })`
     type-checks (regression guard for `exactOptionalPropertyTypes`) and falls
     back to defaults for both;
   - `emitCliReport({ report, toErr: false, writers })` writes the report to
     `writeOut` only, and `toErr: true` writes to `writeErr` only, using a
     captured-writer double.
2. Run:

   ```sh
   bun test ./tests/build-gate/cli-support.test.ts
   ```

   Expect failure because `tests/build-gate/cli-support.ts` does not exist.

Green:

1. Add `tests/build-gate/cli-support.ts` with:

   ```typescript
   /**
    * @file Shared test-only command-line writer and report dispatch for build gates.
    */

   import { stderr, stdout } from "node:process";

   /** Output writers shared by build-gate command-line entry points. */
   export type CliWriters = {
     readonly writeOut: (message: string) => void;
     readonly writeErr: (message: string) => void;
   };

   /** Optional writer overrides that tolerate forwarded `undefined` fields. */
   export type CliWriterOverrides = {
     readonly writeOut?: CliWriters["writeOut"] | undefined;
     readonly writeErr?: CliWriters["writeErr"] | undefined;
   };

   /** Resolve writers, defaulting to the real process streams. */
   export function resolveCliWriters(overrides: CliWriterOverrides = {}): CliWriters {
     return {
       writeOut: overrides.writeOut ?? ((message) => void stdout.write(message)),
       writeErr: overrides.writeErr ?? ((message) => void stderr.write(message)),
     };
   }

   /** Send one formatted report to the chosen stream. */
   export function emitCliReport(params: {
     readonly report: string;
     readonly toErr: boolean;
     readonly writers: CliWriters;
   }): void {
     const write = params.toErr ? params.writers.writeErr : params.writers.writeOut;
     write(params.report);
   }
   ```

2. Dedupe the fourth writer copy: in `tests/build-gate/git-support.ts`, import
   the shared type and redefine `CapturedCliOutput` structurally so no call
   site changes:

   ```typescript
   import type { CliWriters } from "./cli-support";

   export type CapturedCliOutput = {
     readonly stdout: string;
     readonly stderr: string;
   } & CliWriters;
   ```

3. Run:

   ```sh
   bun test ./tests/build-gate/cli-support.test.ts ./tests/build-gate/git-support.test.ts
   ```

   Expect all tests to pass, including the unchanged git-support suite.

Refactor and validation:

```sh
bunx @biomejs/biome format --write \
  tests/build-gate/cli-support.ts \
  tests/build-gate/cli-support.test.ts \
  tests/build-gate/git-support.ts
mdtablefix docs/execplans/roadmap-1-5-9.md
markdownlint-cli2 --fix docs/execplans/roadmap-1-5-9.md
bun test ./tests/build-gate/cli-support.test.ts ./tests/build-gate/git-support.test.ts
make all
make markdownlint
make nixie
```

Commit this work item independently after the focused tests and gates pass.

### Work Item 2: Move Branch-Freshness and Review-Evidence CLIs onto the Seam

Implements:

- `docs/roadmap.md` task 1.5.9's success criterion that branch-freshness and
  review-evidence CLIs consume one documented CLI-support helper.
- `AGENTS.md` "Testing" (behavioural tests pass before and after a refactor).
- `docs/complexity-antipatterns-and-refactoring-strategies.md` separation of
  concerns.

Load skills: `execplans`, `grepai`, `leta`.

Red:

1. In `tests/build-gate/branch-freshness-git.test.ts`, add or adjust an
   assertion so the test imports `CliWriters` from `./cli-support` (not the
   local type) and continues to assert that usage-error routes to `stderr`
   while fresh/skipped/stale route to `stdout`. Before the runner is migrated,
   the local type still exists and the shared import is unused, so a
   `noUnusedLocals`/lint or type mismatch, or a direct assertion on the
   migrated default-writer behaviour, fails.
2. In `tests/build-gate/review-evidence-cli.test.ts`, add an assertion that
   `runReviewEvidenceCli` with only `writeOut` provided still sends usage-error
   output to the default `stderr` (capture via a fake) and provided-`writeOut`
   output to the injected writer, exercising `resolveCliWriters` forwarding.
3. Run:

   ```sh
   bun test \
     ./tests/build-gate/branch-freshness-git.test.ts \
     ./tests/build-gate/review-evidence-cli.test.ts
   ```

   Expect failure for the newly specified shared-seam behaviour.

Green:

1. In `tests/build-gate/branch-freshness-git.ts`:
   - remove the local `CliWriters` type (lines 22-25);
   - import `type CliWriters`, `resolveCliWriters`, and `emitCliReport` from
     `./cli-support`;
   - change `runBranchFreshnessCli`'s `writers` default from the inline object
     to `resolveCliWriters()`;
   - replace the manual dispatch (lines 90-97) with
     `emitCliReport({ report, toErr: exitCode === 2, writers })` and
     `return exitCode`.
2. In `tests/build-gate/review-evidence-cli.ts`:
   - remove the local `CliWriters` type (lines 26-29) and the local `cliWriters`
     helper (lines 320-323);
   - import `type CliWriters`, `resolveCliWriters`, and `emitCliReport` from
     `./cli-support`;
   - resolve writers with `resolveCliWriters(...)`, forwarding
     `options.writeOut` and `options.writeErr`;
   - replace the manual dispatch (lines 93-97) with
     `emitCliReport({ report, toErr: result.status === "usage-error", writers })`.
3. Keep every report string, exit-code mapping (`exitCodeForBranchFreshness`,
   `exitCodeFor`), and stream choice unchanged.
4. Run the focused tests and expect all to pass, including the preserved
   `stdout`/`stderr` routing snapshots and assertions.

Refactor and validation:

```sh
bunx @biomejs/biome format --write \
  tests/build-gate/branch-freshness-git.ts \
  tests/build-gate/branch-freshness-git.test.ts \
  tests/build-gate/review-evidence-cli.ts \
  tests/build-gate/review-evidence-cli.test.ts
mdtablefix docs/execplans/roadmap-1-5-9.md
markdownlint-cli2 --fix docs/execplans/roadmap-1-5-9.md
bun test \
  ./tests/build-gate/branch-freshness-git.test.ts \
  ./tests/build-gate/review-evidence-cli.test.ts \
  ./tests/build-gate/review-evidence.property.test.ts
make all
make markdownlint
make nixie
```

Commit this work item independently after the focused tests and gates pass.

### Work Item 3: Move the Whitespace-Hygiene CLI onto the Seam

Implements:

- `docs/roadmap.md` task 1.5.9's success criterion that the whitespace-hygiene
  CLI consumes the shared CLI-support helper.
- `AGENTS.md` "Testing" and "Refactoring Heuristics & Workflow".

Load skills: `execplans`, `grepai`, `leta`.

Red:

1. In `tests/build-gate/whitespace-hygiene.test.ts`, keep the existing inline
   `stdout`/`stderr` snapshots (passed to `stdout`; violations and failures to
   `stderr`) and add an assertion that the module imports `CliWriters` from
   `./cli-support`. Before migration this fails (local type still used /
   shared import unused).
2. Run:

   ```sh
   bun test ./tests/build-gate/whitespace-hygiene.test.ts
   ```

   Expect failure for the shared-seam expectation while all existing message
   snapshots stay as the behavioural guard.

Green:

1. In `tests/build-gate/whitespace-hygiene.ts`:
   - remove the local `CliWriters` type (lines 17-20);
   - import `type CliWriters`, `resolveCliWriters`, and `emitCliReport` from
     `./cli-support`;
   - change the `writers` default to `resolveCliWriters()`;
   - refactor `runWhitespaceHygieneCli` so it computes a single outcome
     `{ report: string; toErr: boolean; exitCode: WhitespaceHygieneExitCode }`
     for each branch (passed → `report="Whitespace hygiene check passed.\n"`,
     `toErr=false`, `exitCode=0`; violations → the existing
     `Trailing whitespace found...` string, `toErr=true`, `exitCode=1`; caught
     failure → the existing `whitespace hygiene check failed: ...` string,
     `toErr=true`, `exitCode=2`), then call
     `emitCliReport({ report, toErr, writers })` once and `return exitCode`.
   - Preserve message bytes exactly, including the interpolated
     `formatWhitespaceViolations` output and the trailing newline.
2. Run the focused test and expect the existing snapshots and exit-code
   behaviour to pass unchanged.

Refactor and validation:

```sh
bunx @biomejs/biome format --write \
  tests/build-gate/whitespace-hygiene.ts \
  tests/build-gate/whitespace-hygiene.test.ts
mdtablefix docs/execplans/roadmap-1-5-9.md
markdownlint-cli2 --fix docs/execplans/roadmap-1-5-9.md
bun test \
  ./tests/build-gate/whitespace-hygiene.test.ts \
  ./tests/build-gate/whitespace-hygiene-support.test.ts
make all
make markdownlint
make nixie
```

Commit this work item independently after the focused tests and gates pass.

### Work Item 4: Document Helper Ownership and Close Out Task 1.5.9

Implements:

- `docs/developers-guide.md` "Documentation Upkeep".
- `docs/repository-layout.md` "Test and fixture boundaries" and "Tooling
  boundaries".
- `docs/documentation-style-guide.md` "Spelling", "Markdown rules",
  "Formatting", and "Roadmap task writing guidelines".
- `docs/roadmap.md` task 1.5.9 completion tracking.

Load skills: `execplans`, `grepai`, `leta` (only if code references need
checking), and `sem` if reviewing the final entity-level diff helps.

Red:

No additional failing code test is expected for documentation close-out; the
observable contract comes from work items 1-3. Before editing docs, run:

```sh
bun test \
  ./tests/build-gate/cli-support.test.ts \
  ./tests/build-gate/branch-freshness-git.test.ts \
  ./tests/build-gate/review-evidence-cli.test.ts \
  ./tests/build-gate/whitespace-hygiene.test.ts
```

Expect all focused build-gate tests to pass.

Green:

1. Extend `docs/developers-guide.md` "Commit Gate" (near the existing
   `git-support.ts` note, lines 196-202) with a short maintainer note:
   build-gate command-line writer resolution, default `stdout`/`stderr`
   streams, and single-report dispatch live in
   `tests/build-gate/cli-support.ts`; each gate keeps its own report formatting
   and exit-code mapping.
2. Extend `docs/repository-layout.md` (lines 131-134) so `tests/build-gate/`
   ownership also names the shared CLI-support helper alongside `git-support.ts`.
3. Update `docs/roadmap.md` to tick task 1.5.9 complete only after work items
   1-3 have passed gates.
4. Update this ExecPlan's `Progress`, `Surprises & Discoveries`,
   `Decision Log`, and `Outcomes & Retrospective` with final evidence.

Validation:

```sh
mdtablefix docs/developers-guide.md docs/repository-layout.md docs/roadmap.md docs/execplans/roadmap-1-5-9.md
markdownlint-cli2 --fix docs/developers-guide.md docs/repository-layout.md docs/roadmap.md docs/execplans/roadmap-1-5-9.md
make all
make markdownlint
make nixie
```

Commit this work item independently after all gates pass.

## Concrete Steps

Run all commands from
`/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-9`.

1. Confirm the worktree and branch:

   ```sh
   pwd
   git status --short --branch
   ```

   Expected path:

   ```plaintext
   /data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-9
   ```

2. Complete work item 0 before touching TypeScript. Recompute source evidence
   after the refresh and update this plan.
3. Implement work item 1 using Red-Green-Refactor; commit after its gates pass.
4. Implement work item 2 using Red-Green-Refactor; commit after its gates pass.
5. Implement work item 3 using Red-Green-Refactor; commit after its gates pass.
6. Implement work item 4 only after all code gates pass.
7. Before each commit, inspect the intended change:

   ```sh
   git status --short
   sem diff
   git diff -- tests/build-gate docs
   ```

8. Commit each work item separately after its gates pass. Use imperative,
   descriptive commit subjects and wrapped bodies.

## Validation and Acceptance

Acceptance requires all of the following observable behaviours:

- `bun test ./tests/build-gate/cli-support.test.ts` passes and proves the
  shared helper owns the writer type, default-stream resolution (including
  forwarded `undefined` overrides), and single-report dispatch to the correct
  stream.
- `bun test ./tests/build-gate/branch-freshness-git.test.ts` passes with
  unchanged report text and unchanged exit codes 0/1/2, routing usage-error to
  `stderr` and fresh/skipped/stale to `stdout` through the shared seam.
- `bun test ./tests/build-gate/review-evidence-cli.test.ts` and
  `./tests/build-gate/review-evidence.property.test.ts` pass with unchanged
  report text and unchanged exit codes 0/1/2/3, routing usage-error to `stderr`
  and everything else to `stdout` through the shared seam.
- `bun test ./tests/build-gate/whitespace-hygiene.test.ts` passes with its
  existing inline `stdout`/`stderr` snapshots and exit codes 0/1/2 unchanged.
- `bun test ./tests/build-gate/git-support.test.ts` still passes with the
  structurally deduped `CapturedCliOutput`.
- `make all` exits 0 and includes build, formatting check, whitespace hygiene,
  lint, typecheck, and tests. On current `origin/main`, `make all` includes the
  `typecheck` target.
- `make markdownlint` exits 0 after Markdown changes.
- `make nixie` exits 0 after Markdown changes.
- No build-gate module other than `tests/build-gate/cli-support.ts` declares a
  `CliWriters` output-writer type or an inline
  `{ writeOut: stdout.write, writeErr: stderr.write }` default.

Expected final command sequence:

```sh
make all
make markdownlint
make nixie
```

Expected successful result:

```plaintext
all requested gates exit with status 0
```

## Idempotence and Recovery

The implementation steps are safe to repeat in the assigned worktree. If a Red
test fails for a reason other than the expected missing helper or unmigrated
runner, stop and update `Surprises & Discoveries` before editing code.

If Markdown formatting creates unrelated churn, do not keep it. Revert only the
unrelated formatter edits after confirming they are outside the files changed
by the current work item. If a stash is unavoidable, name it:

```sh
git stash push -m 'df12-stash v1 task=1.5.9 kind=discard reason="park unrelated formatter churn"'
```

## Artefacts and Notes

Locked dependency ranges from `bun.lock` relevant to this task:

```plaintext
typescript ^5.6.3
@biomejs/biome ^2.3.1
fast-check ^4.8.0
```

The completed 1.5.5 plan recorded the resolved local toolchain as Bun 1.3.11,
Git 2.53.0, TypeScript 5.9.3, Biome 2.5.1, and fast-check 4.8.0; work item 0
re-verifies the resolved versions before implementation.

## Interfaces and Dependencies

At the end of work item 1, `tests/build-gate/cli-support.ts` must be the only
build-gate CLI writer/dispatch seam. Its intended interface is:

```typescript
export type CliWriters = {
  readonly writeOut: (message: string) => void;
  readonly writeErr: (message: string) => void;
};

export type CliWriterOverrides = {
  readonly writeOut?: CliWriters["writeOut"] | undefined;
  readonly writeErr?: CliWriters["writeErr"] | undefined;
};

export function resolveCliWriters(overrides?: CliWriterOverrides): CliWriters;

export function emitCliReport(params: {
  readonly report: string;
  readonly toErr: boolean;
  readonly writers: CliWriters;
}): void;
```

After work items 2 and 3, `runBranchFreshnessCli`, `runReviewEvidenceCli`, and
`runWhitespaceHygieneCli` import `CliWriters`, `resolveCliWriters`, and
`emitCliReport` from `./cli-support`; each keeps its own result formatting and
exit-code mapping. `tests/build-gate/git-support.ts` reuses `CliWriters` inside
`CapturedCliOutput`.

Use no new external libraries. The implementation depends on:

- `node:process` `stdout`/`stderr` for default stream writers,
- Bun's built-in `bun:test` runner for unit and snapshot tests,
- the existing `formatBranchFreshnessResult`, `formatReviewEvidenceResult`, and
  `formatWhitespaceViolations` formatters, which remain in their gate modules.

## Addenda

- [x] 1.5.9.1. Replace literal CLI seam-ownership guards.
  - Source: review:1.5.9; severity low.
  - Scope: replace the string-substring "uses the shared CLI writer seam"
    assertions with a structural, AST-backed, or lint-backed guard that fails
    when a build-gate CLI reintroduces a local writer seam.
  - Success: branch-freshness, review-evidence, and whitespace-hygiene CLI
    tests still prove shared ownership of `CliWriters`, but renamed or
    reformatted local writer declarations cannot bypass the guard.
- [x] 1.5.9.2. Extract default-stream test harness support.
  - Source: review:1.5.9; severity low.
  - Scope: centralize the stdout and stderr override-and-restore pattern used
    by CLI support tests before more default-stream helpers clone it.
  - Success: CLI default-stream tests share one helper that restores process
    streams reliably and keeps stream-capture assertions local to each test.

## Revision Note

Round 1 draft for roadmap task 1.5.9. It defines a five-item plan (refresh,
introduce the `cli-support.ts` seam, migrate branch-freshness and
review-evidence, migrate whitespace-hygiene, document and close out) that
consolidates the shared CLI writer type, default-stream resolution, and
report-dispatch while preserving each gate's exit codes and report text. No
implementation has started.

Work item 0 update: refreshed evidence against `origin/main`, confirmed there
was no semantic diff to rebase, recorded Bun 1.3.11 and TypeScript 6.0.3 as the
resolved local toolchain, and documented the GrepAI and Leta evidence limits.
After `origin/main` advanced, this update also indexed the new ExecPlan from
`docs/contents.md` to satisfy the documentation freshness gate. This does not
change the implementation sequence for work items 1-4.

Work item 1 update: added the shared CLI writer seam and tests, then deduped
`CapturedCliOutput` by intersecting it with `CliWriters`. Focused helper and
git-support tests pass; the next work item can migrate branch-freshness and
review-evidence onto the seam without changing their report contracts.

Work item 2 update: migrated `runBranchFreshnessCli` and
`runReviewEvidenceCli` to resolve writers through `cli-support.ts` and emit one
formatted report through `emitCliReport`. Focused branch-freshness,
review-evidence CLI, and review-evidence property tests pass with unchanged
stream-routing expectations.

Work item 3 update: migrated `runWhitespaceHygieneCli` to compute one
`WhitespaceHygieneCliOutcome` and dispatch it through `emitCliReport`.
Focused whitespace hygiene tests and support tests pass with existing
stdout/stderr snapshots unchanged.

Work item 4 update: documented `cli-support.ts` in maintainer-facing docs,
ticked roadmap task 1.5.9 complete, and closed this ExecPlan as COMPLETE. The
final gate run at HEAD remains the acceptance proof.

Addendum recovery update: after workflow recovery, the branch was rebased onto
`origin/main` as commits `29bb8da` and `2493ce9`. `make all`, `make
markdownlint`, and `make nixie` passed after the rebase, and `coderabbit review
--agent` completed with zero findings. The roadmap addenda 1.5.9.1 and
1.5.9.2 are now ticked to match the completed ExecPlan addenda.
