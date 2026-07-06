# Consolidate build-gate CLI run-and-exit orchestration

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

The build gates in `tests/build-gate/` each ship a command-line entry point.
Every one ends with the same hand-written "run-and-exit" tail: a direct-exec
guard that compares `process.argv[1]` with `import.meta.url`, runs the gate's
CLI function, and terminates the process with its exit code. That tail is cloned
four times today. Three copies call `exit(...)` (a hard exit), while the
review-evidence CLI assigns `process.exitCode` (a soft exit that lets buffered
output flush). Nothing stops a fifth gate from cloning the boilerplate again, or
from picking the wrong exit mechanism.

A second, related clone lives in the reviewer-availability parsing. The set of
reviewer paths (`scrutineer`, `coderabbit`, `local-self-run`) is enumerated
twice: once as a CLI-flag table in `review-evidence-cli.ts` and once as an
environment-variable map in `review-evidence-availability.ts`. The flag table
is a plain array that is **not** checked for exhaustiveness against the
`ReviewPath` union, so a future path could be added to one table and silently
omitted from the other.

After this change a reader can observe:

1. Every build-gate CLI entrypoint imports one shared `runCliEntrypoint` helper
   from `tests/build-gate/cli-support.ts` and no longer inlines the
   argv/`import.meta` guard. A structural test discovers the current entrypoint
   modules and rejects any gate that re-clones the seam, exactly as the
   shared-writer seam is guarded today.
2. Reviewer availability flows from a single `reviewPathDescriptors` table that
   is exhaustiveness-checked against `ReviewPath`; both the CLI-flag list and the
   environment map are derived from it, and a test fails if the two derived
   views ever enumerate different paths or a different path order.
3. Every gate keeps its existing report text and exit-code contract:
   `make review-evidence` still exits 0/1/2/3, `make whitespace-hygiene` and
   `make branch-freshness` still exit 0/1/2, and `make review-evidence-artefact`
   still exits 0/1/2. `make all` remains green throughout.

Success is observable by running `make all` (green after every work item) and
the existing process smoke suites, which spawn the real Bun CLIs and assert
exact exit codes and stdout/stderr.

## Constraints

- Work exclusively inside the worktree
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-11`. Never edit the
  root/control worktree.
- Do not change any gate's externally observable contract: report text, the
  stdout-versus-stderr routing, or the exit-code mapping. The exit-code
  contracts are documented in `docs/developers-guide.md` lines 249-262 and
  278-287 and must remain byte-for-byte identical.
- Preserve the per-gate exit **mechanism**. `review-evidence-cli.ts` currently
  sets `process.exitCode` (soft exit) rather than calling `exit()` (hard exit);
  the shared helper must reproduce that distinction, not erase it. See the
  Decision Log and Risks for why this is load-bearing.
- Do not widen scope to other gates' policy modules (`file-size`,
  `documentation-contents`, git parsing). Only the CLI orchestration seam and
  the reviewer-availability tables are in scope.
- en-GB Oxford spelling ("-ize"/"-yse"/"-our") in all prose, comments, JSDoc,
  and commit messages (AGENTS.md lines 25-26 and 45-46).
- TypeScript strict flags are on: `exactOptionalPropertyTypes`,
  `noPropertyAccessFromIndexSignature`, `noUncheckedIndexedAccess`
  (AGENTS.md lines 249-252). New code must type-check without suppression.
- Tests are colocated with their targets and run with `bun test`
  (AGENTS.md lines 33, 301).

## Tolerances (exception triggers)

- Scope: if any single work item requires editing more than 6 files or more than
  ~200 net lines, stop and escalate.
- Interface: the public exports of `cli-support.ts` may **grow** (add
  `runCliEntrypoint`); if an existing exported signature must **change**, stop
  and escalate.
- Behaviour: if any existing test in `tests/build-gate/` must be weakened or
  deleted to make a change pass, stop and escalate — that signals a contract
  regression.
- Dependencies: no new runtime or dev dependency. The structural guard reuses
  the already-present `typescript` package (see `cli-support-test-support.ts`).
  If a new dependency seems required, stop and escalate.
- Iterations: if `make all` still fails after 3 focused fix attempts on one work
  item, stop and escalate.
- Ambiguity: if the "review-evidence" module named in the roadmap success
  criterion is read as excluding `review-evidence-artefact-cli.ts`, proceed by
  migrating all four CLIs (the artefact CLI shares the identical seam) and record
  the interpretation; do not stop.

## Risks

- Risk: switching the review-evidence CLI's soft `process.exitCode` exit to a
  hard `exit()` would truncate its multi-line stdout when stdout is a pipe.
  Severity: high. Likelihood: medium if the helper defaulted everyone to
  `exit()`.
  Mitigation: the helper exposes an explicit `mode: "exit" | "exitCode"` and the
  review-evidence caller passes `"exitCode"`. The behaviour is pinned by
  `review-evidence-cli-smoke.test.ts`, which spawns the real Bun process with
  `stdout: "pipe"` and asserts the full multi-line report is received (see that
  file lines 25-35 and 57-99).
- Risk: the structural entrypoint guard is over-strict and rejects a legitimate
  construct. Severity: medium. Likelihood: low.
  Mitigation: mirror the proven `expectSharedCliWriterSeam` AST approach in
  `cli-support-test-support.ts`; ship accept-and-reject unit tests before
  applying the guard to real sources.
- Risk: consolidating the availability tables changes a flag prefix or env-var
  name by accident. Severity: high. Likelihood: low.
  Mitigation: a table-driven test pins every `flagPrefix` and `envVar` to the
  exact strings documented in `docs/developers-guide.md` lines 270-276, and the
  existing exhaustiveness type-tests in
  `review-evidence-availability.test.ts` stay green.

## Progress

- [x] (2026-07-04 09:59Z) WI1 — Extract `runCliEntrypoint` into
  `cli-support.ts` with injection-based unit tests. Red confirmed with
  `bun test tests/build-gate/cli-support.test.ts` failing on the missing export;
  green confirmed with the focused test passing; full gates confirmed with
  `make all`, `make markdownlint`, and `make nixie`.
- [x] (2026-07-04 10:16Z) WI2 — Adopt `runCliEntrypoint` in all four
  build-gate CLIs, preserving each exit mechanism. Focused process smoke tests
  passed for whitespace hygiene, review evidence, review-evidence recording,
  and review-evidence artefacts; `make all` passed after CodeRabbit follow-up
  fixes.
- [x] (2026-07-04 12:18Z) WI3 — Add the structural run-and-exit seam guard and
  apply it to the four CLI modules. Focused seam-helper and file-size tests
  passed; `make all` passed; CodeRabbit re-review completed with zero findings
  after tightening process-access detection.
- [x] (2026-07-04 14:01Z) WI4 — Consolidate reviewer-availability parsing
  behind one exhaustiveness-checked `reviewPathDescriptors` table. Red was
  confirmed by the missing descriptor exports; focused availability and CLI
  smoke tests passed; `make all` passed; CodeRabbit completed with zero
  findings after a required rate-limit backoff and retry.

## Surprises & discoveries

- Observation: the CLI-flag availability table and the environment availability
  map are two separate structures, and only the environment map is
  exhaustiveness-checked against `ReviewPath`.
  Evidence: `review-evidence-cli.ts` lines 71-75 declare
  `availabilityFlags ... satisfies readonly AvailabilityFlag[]` (a plain array,
  no per-path exhaustiveness), whereas `review-evidence-availability.ts` lines
  32-36 declare `harnessAvailabilityEnvByPath ... satisfies Readonly<Record<
  ReviewPath, string>>` (exhaustive). A path omitted from the flag array would
  compile.
  Impact: this is the concrete drift the roadmap success criterion targets;
  WI4 closes it with a single `Record<ReviewPath, ...>` descriptor.
- Observation: three CLIs hard-exit and one soft-exits.
  Evidence: `exit(...)` in `branch-freshness-git.ts` lines 367-369,
  `whitespace-hygiene.ts` lines 96-98, `review-evidence-artefact-cli.ts` lines
  145-147; `process.exitCode = ...` in `review-evidence-cli.ts` lines 351-353.
  Impact: the shared helper must be mechanism-parameterized (WI1) rather than
  hard-coding one exit style.
- Observation: the new ExecPlan file must be listed in `docs/contents.md` as
  soon as it exists.
  Evidence: the first `make all` run failed
  `tests/build-gate/documentation-contents.test.ts` with missing
  `execplans/roadmap-1-5-11.md`; adding the contents link made the
  deterministic gates pass.
  Impact: WI1 includes the documentation index update even though the helper
  code itself is TypeScript-only.
- Observation: CodeRabbit review for WI1 consumed the allowed retry budget.
  Evidence: the first review completed with one minor plan portability finding;
  the next attempt was rate-limited after a 58-minute `vsleep`; the following
  attempt found two major plan-coverage findings; the final allowed retry found
  two minor wording findings. The minor wording findings were addressed, and
  `make all`, `make markdownlint`, and `make nixie` passed afterwards, but no
  retry remained for another CodeRabbit pass.
  Impact: proceed with the local fixes recorded and the open issue noted in
  close-out unless a later work item review rechecks the whole branch.
- Observation: the whitespace hygiene process smoke is valuable on both pass
  and fail paths.
  Evidence: CodeRabbit flagged that the initial WI2 smoke test only exercised
  the clean-repository success path. Adding a tracked trailing-whitespace case
  confirmed the migrated hard-exit entrypoint returns exit 1 and writes the
  violation report to stderr.
  Impact: WI2 includes both process smoke paths plus a child-process timeout.
- Observation: housing the entrypoint AST guard in the existing support file
  would push that file over the repository's 400-line limit.
  Evidence: the first WI3 implementation made
  `tests/build-gate/cli-support-test-support.ts` 415 lines, and
  `tests/build-gate/file-size.test.ts` failed during `make all`.
  Impact: the entrypoint-specific guard lives in
  `tests/build-gate/cli-entrypoint-test-support.ts`, while
  `cli-support-test-support.test.ts` remains the shared support-helper test
  surface.
- Observation: the descriptor-table red test failed before the WI4 export
  existed, then focused availability and CLI smoke coverage stayed green after
  the consolidation.
  Evidence:
  `bun test tests/build-gate/review-evidence-availability.test.ts` first failed
  with `Export named 'reviewPathDescriptors' not found`; after the
  implementation, the focused availability, CLI availability, and
  review-evidence process smoke tests passed.
  Impact: WI4 proves both the intended red step and the unchanged
  env-versus-flag behaviour.

## Decision log

- Decision: give `runCliEntrypoint` an explicit `mode: "exit" | "exitCode"`
  parameter (default `"exit"`) rather than always hard-exiting.
  Rationale: `review-evidence-cli.ts` deliberately uses `process.exitCode` so
  its larger, recorded report flushes before the process ends; `git blame`
  shows the choice was introduced with the gate (commit 3fad472) without a
  comment, and no test asserts truncation, so the mechanism is preserved
  exactly and pinned by the existing spawn smoke test rather than "cleaned up".
  Date/Author: 2026-07-04, planning agent.
- Decision: migrate all four CLIs, including
  `review-evidence-artefact-cli.ts`, even though the roadmap names only three.
  Rationale: the artefact CLI is the fourth clone of the identical seam;
  leaving it out would let the guard pass while the duplication persists, and
  the antipattern guide favours removing the whole duplication class
  (docs/complexity-antipatterns-and-refactoring-strategies.md §1 comprehens-
  ibility, §2 Separation of Concerns).
  Date/Author: 2026-07-04, planning agent.
- Decision: house the consolidated `reviewPathDescriptors` table in
  `review-evidence-availability.ts` and have `review-evidence-cli.ts` consume a
  derived flag list from it.
  Rationale: that module already owns the availability facts, the env map, and
  the `parseAvailabilityValue` narrower, so it is the natural single source of
  truth; the CLI keeps only flag-parsing glue.
  Date/Author: 2026-07-04, planning agent.
- Decision: update WI3 to use directory-driven entrypoint discovery instead of
  four separately placed seam assertions.
  Rationale: CodeRabbit correctly identified that four static assertions would
  protect the current files but would not force review of a future build-gate
  CLI entrypoint. Discovering entrypoint modules and pinning the expected list
  turns any new entrypoint into an explicit test update.
  Date/Author: 2026-07-04, implementation agent.
- Decision: update WI4 to compare ordered reviewer-path sequences, not only set
  membership.
  Rationale: CLI flag iteration order is part of the stable usage-error and
  precedence surface; a set comparison would miss accidental reordering.
  Date/Author: 2026-07-04, implementation agent.
- Decision: stop CodeRabbit retries for WI1 after addressing the final minor
  wording findings locally.
  Rationale: the workflow allows at most three retries after the initial
  CodeRabbit attempt. WI1 used those retries, one of which was consumed by a
  rate limit. Deterministic gates passed after the local wording fixes.
  Date/Author: 2026-07-04, implementation agent.
- Decision: keep the WI2 process smoke exact on stable output while leaving the
  lower-level formatter contract in `whitespace-hygiene.test.ts`.
  Rationale: the process smoke proves the executable entrypoint, stream routing,
  exit status, and representative output. The existing unit tests still own the
  detailed whitespace report formatting contract.
  Date/Author: 2026-07-04, implementation agent.
- Decision: do not run another CodeRabbit retry after the final WI2 trivial
  findings were fixed.
  Rationale: the high and low WI2 findings were cleared, the final pass
  reported only trivial refinements, those refinements were implemented, and
  `make all` passed. Continuing CodeRabbit loops for trivial style churn would
  not materially improve confidence before WI3.
  Date/Author: 2026-07-04, implementation agent.
- Decision: place `expectSharedCliEntrypointSeam` in a dedicated
  `cli-entrypoint-test-support.ts` module instead of adding it to
  `cli-support-test-support.ts`.
  Rationale: the repository enforces a 400-line TypeScript file-size cap. A
  dedicated file keeps the entrypoint guard cohesive without weakening that
  gate or mixing two AST helper implementations into one oversized module.
  Date/Author: 2026-07-04, implementation agent.
- Decision: let the entrypoint guard skip the shared `runCliEntrypoint(...)`
  call subtree before checking for direct `process.argv` and `process.exit`
  usage.
  Rationale: migrated CLIs legitimately forward `process.argv.slice(2)` inside
  the shared helper's `run` callback, but direct argument parsing or exiting
  outside that call reintroduces local orchestration.
  Date/Author: 2026-07-04, implementation agent.
- Decision: derive `reviewerAvailabilityFlags` from
  `reviewPathDescriptors` using the descriptor object's insertion order, and
  pin that order in tests.
  Rationale: object insertion order is stable for these string keys, and the
  test asserts the expected `scrutineer`, `coderabbit`, `local-self-run`
  sequence so future edits must acknowledge any CLI iteration change.
  Date/Author: 2026-07-04, implementation agent.
- Decision: follow the CodeRabbit rate-limit rule for WI4 with a 78-minute
  `vsleep` backoff before retrying.
  Rationale: the first WI4 CodeRabbit invocation was rate-limited after
  `make all` passed. The retry after the mandated backoff completed with zero
  findings.
  Date/Author: 2026-07-04, implementation agent.

## Outcomes & retrospective

WI1 shipped the shared `runCliEntrypoint` helper and focused unit tests. WI2
migrated all four build-gate CLI modules to that helper, preserving hard exit
for branch freshness, whitespace hygiene, and review-evidence artefact checks,
and preserving soft `process.exitCode` termination for review evidence. WI3
added a directory-driven structural guard over every discovered build-gate CLI
entrypoint and rejects local `process.argv`, `process.exitCode`, and
`process.exit(...)` orchestration outside the shared helper call. WI4 replaced
the duplicate reviewer-availability flag and environment tables with one
exhaustiveness-checked `reviewPathDescriptors` table and derived CLI flags from
it. Deterministic gates are green.

## Context and orientation

The linter is a TypeScript project run under Bun. Build gates live in
`tests/build-gate/`. Each gate is a pair: a policy module (pure
classification) and a CLI module that parses arguments, formats a report,
writes it to a stream, and returns a process exit code. Definitions of terms
used below:

- "Build gate": an executable check wired into the `Makefile` (for example
  `make whitespace-hygiene`, `make branch-freshness`, `make review-evidence`,
  `make review-evidence-artefact`). See `Makefile` targets at lines 39-48.
- "Run-and-exit orchestration": the module-tail block that detects whether the
  file was executed directly (rather than imported), runs the CLI function, and
  terminates the process with the returned exit code.
- "Shared CLI seam": `tests/build-gate/cli-support.ts`, which already owns
  writer resolution (`resolveCliWriters`) and single-report dispatch
  (`emitCliReport`). `docs/developers-guide.md` lines 216-219 record that this
  module owns "command-line writer resolution, default `stdout` and `stderr`
  streams, and single-report dispatch", while "Gate modules keep their own
  report formatting and exit-code mapping."

The four CLI modules and their current tails:

1. `tests/build-gate/branch-freshness-git.ts` — `runBranchFreshnessCli`,
   exit type `0 | 1 | 2`, tail at lines 367-369 using `exit(...)`.
2. `tests/build-gate/whitespace-hygiene.ts` — `runWhitespaceHygieneCli`,
   exit type `0 | 1 | 2`, tail at lines 96-98 using `exit(...)`.
3. `tests/build-gate/review-evidence-cli.ts` — `runReviewEvidenceCli`,
   exit type `0 | 1 | 2 | 3`, tail at lines 351-353 using
   `process.exitCode = ...`.
4. `tests/build-gate/review-evidence-artefact-cli.ts` —
   `runReviewEvidenceArtefactCli`, exit type `0 | 1 | 2`, tail at lines
   145-147 using `exit(...)`.

The reviewer-availability surfaces:

- `tests/build-gate/review-evidence-cli.ts` lines 46-49, 71-75, 257-293 declare
  `AvailabilityFlag`, the `availabilityFlags` array, and `parseAvailabilityFlag`.
- `tests/build-gate/review-evidence-availability.ts` lines 26-36, 63-82 declare
  `pessimisticPathAvailability`, `harnessAvailabilityEnvByPath`, and
  `deriveHarnessPathAvailability`.
- `ReviewPath` and `ReviewPathAvailability` are defined in
  `tests/build-gate/review-evidence.ts`; the three paths are `scrutineer`,
  `coderabbit`, `local-self-run`.

The structural-guard precedent to mirror is
`tests/build-gate/cli-support-test-support.ts` (`expectSharedCliWriterSeam`,
which uses the `typescript` compiler API to inspect a module's AST) and its
unit tests in `tests/build-gate/cli-support-test-support.test.ts`. That seam is
applied to the real CLI sources in `whitespace-hygiene.test.ts` (lines 20-26)
and `branch-freshness-git.test.ts` (lines 30, 286).

Relevant design documents:

- `AGENTS.md` — quality gates (lines 65-108), typing flags (lines 249-252),
  testing rules (lines 299-328), en-GB spelling (lines 25-26, 45-46).
- `docs/developers-guide.md` — build-gate seam ownership (lines 209-219),
  reviewer availability precedence (lines 270-276), exit-code contracts
  (lines 249-262, 278-287).
- `docs/complexity-antipatterns-and-refactoring-strategies.md` — §1
  (comprehensibility and modifiability), §2 (Separation of Concerns): the
  basis for removing duplicated orchestration and guarding against re-cloning.
- `docs/scripting-standards.md` — "Rationale for adopting Cyclopts" (lines
  12-27): the environment-first, CLI-overrides-environment precedence model
  that the availability descriptor upholds (the implementation is TypeScript,
  but the precedence principle is the same).
- `docs/roadmap.md` task 1.5.11 (lines 367-374) — the work item and its success
  criterion.

## Plan of work

Four ordered, independently committable work items. Each ends with `make all`
green. Follow Red-Green-Refactor: write or extend the failing test first, then
the minimal production change, then clean up.

### WI1 — Extract `runCliEntrypoint` into `cli-support.ts`

Docs to read: `docs/developers-guide.md` lines 209-219; AGENTS.md lines
299-328; `docs/complexity-antipatterns-and-refactoring-strategies.md` §2.
Skills to load: `execplans` (this plan), `biomejs` (lint/format of the touched
TypeScript).

Add a mechanism-parameterized entrypoint helper to
`tests/build-gate/cli-support.ts`. It must be unit-testable without spawning a
process, so terminal side effects are injectable:

```typescript
// tests/build-gate/cli-support.ts
import { argv, exit as processExit } from "node:process";
import { fileURLToPath } from "node:url";

/** How a build-gate CLI terminates the process after producing an exit code. */
export type CliEntrypointMode = "exit" | "exitCode";

/** Injectable process-termination seam for entrypoint tests. */
export type CliEntrypointHost = {
  readonly invokedPath: string | undefined;
  readonly exit: (code: number) => void;
  readonly setExitCode: (code: number) => void;
};

/**
 * Run a build-gate CLI when its module was executed directly.
 *
 * @param params Module URL, CLI runner, termination mode, and optional host.
 */
export function runCliEntrypoint(params: {
  readonly moduleUrl: string;
  readonly run: () => number;
  readonly mode?: CliEntrypointMode;
  readonly host?: CliEntrypointHost;
}): void {
  const host = params.host ?? defaultCliEntrypointHost;
  if (host.invokedPath === undefined) {
    return;
  }
  if (host.invokedPath !== fileURLToPath(params.moduleUrl)) {
    return;
  }
  const code = params.run();
  if ((params.mode ?? "exit") === "exitCode") {
    host.setExitCode(code);
  } else {
    host.exit(code);
  }
}
```

`defaultCliEntrypointHost` reads `argv[1]`, calls the real `exit`, and sets
`process.exitCode`. Keep `fileURLToPath` resolution inside the helper so callers
pass only `import.meta.url` (mirroring how the writer seam keeps stream
resolution inside `cli-support.ts`).

Red-Green-Refactor for WI1:

- Red: append a `describe("runCliEntrypoint")` block to
  `tests/build-gate/cli-support.test.ts`. Use a table-driven test over the two
  modes plus the two guard outcomes (path matches / path differs / path
  undefined). Inject a fake `CliEntrypointHost` that records `exit` and
  `setExitCode` calls and supplies `invokedPath`. Assert: `run` executes and
  `exit` is called with the returned code when `invokedPath` equals
  `fileURLToPath(moduleUrl)` and mode is `"exit"`; `setExitCode` is called
  instead when mode is `"exitCode"`; `run` is **not** called when `invokedPath`
  differs or is `undefined`. Run `bun test tests/build-gate/cli-support.test.ts`
  and confirm the new tests fail (symbol does not yet exist).
- Green: add `runCliEntrypoint` and `defaultCliEntrypointHost`. Re-run the
  focused test to green.
- Refactor: run `make all`.

Tests added: table-driven unit tests (AGENTS.md line 320 — table-driven for
small finite case sets). No property or snapshot test is warranted; the helper
is a finite branch.

Validation: `make all`.

### WI2 — Adopt `runCliEntrypoint` in the four build-gate CLIs

Docs to read: `docs/developers-guide.md` lines 216-219 and 278-287; the
per-module tails cited in Context. Skills to load: `biomejs`.

Replace each hand-written tail with a `runCliEntrypoint` call, preserving the
exit mechanism. The four replacements are:

```typescript
// branch-freshness-git.ts (replaces lines 367-369; drop exit + fileURLToPath, keep cwd)
runCliEntrypoint({
  moduleUrl: import.meta.url,
  run: () => runBranchFreshnessCli(process.argv.slice(2)),
});

// whitespace-hygiene.ts (replaces lines 96-98; drop exit + fileURLToPath, keep cwd)
runCliEntrypoint({
  moduleUrl: import.meta.url,
  run: () => runWhitespaceHygieneCli(),
});

// review-evidence-artefact-cli.ts (replaces lines 145-147; drop exit + fileURLToPath, keep cwd)
runCliEntrypoint({
  moduleUrl: import.meta.url,
  run: () => runReviewEvidenceArtefactCli(process.argv.slice(2)),
});

// review-evidence-cli.ts (replaces lines 351-353; drop fileURLToPath) — soft exit
runCliEntrypoint({
  moduleUrl: import.meta.url,
  mode: "exitCode",
  run: () => runReviewEvidenceCli(process.argv.slice(2)),
});
```

Each module adds `runCliEntrypoint` to its existing `./cli-support` import.

Red-Green-Refactor for WI2:

- The entrypoint guard runs only under direct execution, so the behavioural net
  is the process smoke suites, which already spawn the real CLIs:
  `review-evidence-cli-smoke.test.ts` (exitCode mode, exits 0/2/3 with exact
  multi-line stdout/stderr), `review-evidence-cli-record-smoke.test.ts`, and
  `review-evidence-artefact-cli-smoke.test.ts` (exit mode). These are the
  regression guard and must stay green unchanged.
- Add one focused deterministic smoke test
  `tests/build-gate/whitespace-hygiene-cli-smoke.test.ts` that spawns
  `bun run tests/build-gate/whitespace-hygiene.ts` against a temporary clean
  Git repository and asserts exit 0 with `Whitespace hygiene check passed.\n` on
  stdout. This gives exit-mode entry direct end-to-end coverage for a gate that
  needs no reviewer environment. (Model the spawn/tempdir shape on
  `review-evidence-cli-smoke.test.ts` lines 13-39; use `git init` in the tempdir
  and commit one clean file so `lsTrackedFiles` returns a path.) Write it first
  and confirm it passes against the migrated module; if it fails, the migration
  changed behaviour and WI2 stops per the Tolerances.
- branch-freshness entrypoint behaviour stays covered by its existing
  `runBranchFreshnessCli` unit tests plus the WI3 structural guard; a full spawn
  test needs a fabricated `origin/main` and is out of proportion here — record
  this bound explicitly rather than adding a heavy fixture.

Refactor: run `make all`.

Validation: `make all`. Because no Markdown changes land in WI2, `make
markdownlint`/`make nixie` are not required for this item.

### WI3 — Add and apply the structural run-and-exit seam guard

Docs to read:
`docs/complexity-antipatterns-and-refactoring-strategies.md` §1-§2; the
existing `expectSharedCliWriterSeam` in
`tests/build-gate/cli-support-test-support.ts`; its tests in
`tests/build-gate/cli-support-test-support.test.ts`. Skills to load:
`biomejs`.

Add `expectSharedCliEntrypointSeam` to
`tests/build-gate/cli-entrypoint-test-support.ts`, mirroring the writer-seam AST
approach without growing the existing writer-support helper past the file-size
gate. Given module source text and the shared import path (`./cli-support`), it
must throw unless:

1. the module imports `runCliEntrypoint` from `./cli-support` (reuse the
   same TypeScript compiler API approach as the writer helper), and
2. the module calls the imported shared helper binding, including aliased
   imports, and
3. the module contains no inlined orchestration clone outside that helper call:
   no direct `process.argv` access, no direct assignment to
   `process.exitCode`, and no direct `process.exit(...)` call. After WI2 the
   soft-exit gate assigns its code through
   `runCliEntrypoint({ mode: "exitCode" })`, so no legitimate module assigns
   `process.exitCode` directly.

Red-Green-Refactor for WI3:

- Red: add a `describe("expectSharedCliEntrypointSeam")` block to
  `cli-support-test-support.test.ts` with accept cases (a module that imports
  `runCliEntrypoint` and calls it for both modes, including an aliased import)
  and reject cases (missing import → throws "must import runCliEntrypoint";
  missing helper call → throws "must call runCliEntrypoint"; inlined
  `process.argv[1]`, direct `process.argv.slice(...)`, direct
  `process.exitCode =`, or direct `process.exit(...)` → throws "must not inline
  the run-and-exit guard"). Run the focused test; the accept cases fail because
  the function does not yet exist.
- Green: implement `expectSharedCliEntrypointSeam`. Re-run to green.
- Apply the guard to the real sources with one directory-driven structural test,
  preferably in `cli-support-test-support.test.ts` or another support-focused
  test file. The test scans `tests/build-gate/*.ts`, identifies direct
  entrypoint modules by the presence of `import.meta.url` and either the shared
  `runCliEntrypoint` call or legacy direct-execution markers (`process.argv[1]`
  or `process.exitCode =`), and then calls
  `expectSharedCliEntrypointSeam({ importPath: "./cli-support", source })` for
  each discovered entrypoint source. Assert that the discovered source list is
  exactly `branch-freshness-git.ts`, `review-evidence-artefact-cli.ts`,
  `review-evidence-cli.ts`, and `whitespace-hygiene.ts` so an unexpected new
  entrypoint becomes a reviewed test update rather than an unguarded clone.
  These pass because WI2 already migrated the modules — this is the durable
  anti-regression lock.
- Refactor: run `make all`.

Tests added: accept/reject unit tests for the guard helper plus a
directory-driven applied seam assertion over every discovered build-gate CLI
entrypoint (unit-level structural tests, AGENTS.md line 320 finite cases).

Validation: `make all`.

### WI4 — Consolidate reviewer-availability parsing behind one descriptor table

Docs to read: `docs/developers-guide.md` lines 270-276 (availability
precedence and exact flag/env names); `docs/scripting-standards.md` lines
12-27 (env-first, flag-overrides-env precedence); AGENTS.md lines 318-320
(property versus table-driven tests). Skills to load: `biomejs`.

In `tests/build-gate/review-evidence-availability.ts`, introduce one
exhaustiveness-checked descriptor table as the single source of truth:

```typescript
// tests/build-gate/review-evidence-availability.ts
type ReviewPathDescriptor = {
  readonly flagPrefix: string;
  readonly envVar: string;
};

const reviewPathDescriptors = {
  scrutineer: { flagPrefix: "--scrutineer=", envVar: "ODW_LINT_REVIEW_SCRUTINEER" },
  coderabbit: { flagPrefix: "--coderabbit=", envVar: "ODW_LINT_REVIEW_CODERABBIT" },
  "local-self-run": {
    flagPrefix: "--local-self-run=",
    envVar: "ODW_LINT_REVIEW_LOCAL_SELF_RUN",
  },
} as const satisfies Readonly<Record<ReviewPath, ReviewPathDescriptor>>;
```

Derive both existing views from it:

- Replace the standalone `harnessAvailabilityEnvByPath` map (lines 32-36) so
  `deriveHarnessPathAvailability` reads `reviewPathDescriptors[path].envVar`.
- Export an ordered flag list derived from `reviewPathDescriptors` (for example
  `reviewerAvailabilityFlags: readonly { prefix: string; path: ReviewPath }[]`)
  and have `review-evidence-cli.ts` import and consume it, deleting the local
  `AvailabilityFlag` type and `availabilityFlags` array (lines 46-49, 71-75).
  `parseAvailabilityFlag` (lines 271-293) iterates the imported list unchanged
  in behaviour.

Preserve iteration order (scrutineer, coderabbit, local-self-run) so no
usage-error text or precedence changes.

Red-Green-Refactor for WI4:

- Red: add tests to `tests/build-gate/review-evidence-availability.test.ts`:
  a table-driven test pinning, for every `ReviewPath`, the exact `flagPrefix`
  and `envVar` strings (guards against a rename); and a drift-guard test
  asserting the derived flag list and the descriptor keys enumerate the
  identical ordered `ReviewPath` sequence (`scrutineer`, `coderabbit`,
  `local-self-run`) rather than only comparing sets, plus a compile-time
  `expectTypeOf` check that `reviewPathDescriptors` is exhaustive over
  `ReviewPath` (mirroring the existing exhaustiveness checks at lines 19-31).
  These fail before the table exists / is exported.
- Green: add the descriptor table and derivations; wire `review-evidence-cli.ts`
  to the exported flag list. Re-run
  `bun test tests/build-gate/review-evidence-availability.test.ts` and
  `bun test tests/build-gate/review-evidence-cli-availability.test.ts` to green.
- Refactor: run `make all`.

Existing behavioural coverage that must stay green unchanged:
`review-evidence-cli-availability.test.ts`,
`review-evidence-availability.test.ts` (including the fast-check property test
at its top), and `review-evidence-cli-smoke.test.ts` (which asserts the exact
env-driven and flag-driven usage-error text).

Validation: `make all`.

## Concrete steps

Run everything from the assigned worktree root named in `Constraints`.

Per work item:

1. Write or extend the failing test(s) named in that work item; run the focused
   command and confirm the expected failure:

   ```bash
   bun test tests/build-gate/<focused-file>.test.ts
   ```

2. Make the minimal production change.

3. Re-run the focused test to green, then run the full gate:

   ```bash
   make all
   ```

4. Commit with an en-GB Oxford-spelled message gated by `make all`.

Formatting for this ExecPlan document only (it is the sole Markdown file this
planning round touches):

```bash
mdtablefix docs/execplans/roadmap-1-5-11.md
markdownlint-cli2 --fix docs/execplans/roadmap-1-5-11.md
```

## Validation and acceptance

Quality criteria (what "done" means):

- Tests: `make test` (via `make all`) passes. The new unit tests for
  `runCliEntrypoint` and `expectSharedCliEntrypointSeam` fail before their
  production change and pass after. The four applied entrypoint-seam assertions
  pass. The availability descriptor tests pass, including the drift guard.
- Lint/typecheck: `make all` runs build, `check-fmt`, `whitespace-hygiene`,
  `lint` (Biome + Oxlint), `typecheck`, and `test` (Makefile line 5) and is
  green.
- Behaviour: all existing process smoke suites pass unchanged — the gates'
  exit codes and report text are byte-for-byte identical.

Markdown validation (this ExecPlan is Markdown):

```bash
make markdownlint
make nixie
```

Validation method:

- Full repository gate: `make all` after every work item.
- Markdown gates: `make markdownlint` and `make nixie` for the ExecPlan and any
  documentation edits.

Acceptance, phrased as observable behaviour:

- Running `bun run tests/build-gate/review-evidence-cli.ts` on a clean tree with
  no reviewer env still prints the `Review evidence: degraded` report and exits
  3 (matches `review-evidence-cli-smoke.test.ts` lines 57-72).
- Running `bun run tests/build-gate/whitespace-hygiene.ts` in a clean repository
  still prints `Whitespace hygiene check passed.` and exits 0.
- Deleting the `runCliEntrypoint` import from any migrated CLI and re-running
  `make test` now fails that module's entrypoint-seam assertion.

## Idempotence and recovery

Every work item is a pure code/test refactor with no data migration; steps are
re-runnable. If `make all` fails mid-item, revert the working tree with
`git checkout -- <files>` and retry from the failing step. No destructive or
outward-facing action is involved. Do not `git stash` without a named message
per the workshop stash convention.

## Interfaces and dependencies

At completion the following must exist:

- In `tests/build-gate/cli-support.ts`:

  ```typescript
  export type CliEntrypointMode = "exit" | "exitCode";
  export type CliEntrypointHost = {
    readonly invokedPath: string | undefined;
    readonly exit: (code: number) => void;
    readonly setExitCode: (code: number) => void;
  };
  export function runCliEntrypoint(params: {
    readonly moduleUrl: string;
    readonly run: () => number;
    readonly mode?: CliEntrypointMode;
    readonly host?: CliEntrypointHost;
  }): void;
  ```

- In `tests/build-gate/cli-entrypoint-test-support.ts`:

  ```typescript
  export function expectSharedCliEntrypointSeam(expectation: {
    readonly source: string;
    readonly importPath: string;
  }): void;
  ```

- In `tests/build-gate/review-evidence-availability.ts`: a
  `reviewPathDescriptors` table `satisfies Readonly<Record<ReviewPath,
  { flagPrefix: string; envVar: string }>>`, and an exported ordered flag list
  derived from it, consumed by `review-evidence-cli.ts`.

No new package dependency is added; the guard reuses the existing `typescript`
dependency used by the support-helper tests.

## Addenda

- [x] 1.5.11.1. Document the shared build-gate run-and-exit seam.
  - Source: review:1.5.11 and audit:1.5.11; severity low.
  - Scope: refresh the developers-guide `cli-support.ts` and
    review-evidence artefact guidance for `runCliEntrypoint`, exit modes,
    entrypoint ownership, and the `--evidence-path=` flag.
  - Success: maintainer-facing documentation names `cli-support.ts` as the
    owner of run-and-exit orchestration and documents the artefact-check flag
    without describing a competing gate-local exit-code contract.
- [x] 1.5.11.2. Harden entrypoint-seam process detection.
  - Source: review:1.5.11; severity low.
  - Scope: extend the AST seam guard and directory discovery filter to catch
    named `node:process` imports, aliased named imports, and aliased default
    `process` imports that clone direct-execution orchestration.
  - Success: support tests reject entrypoint clones written with
    `import { argv, exit } from "node:process"` or an aliased `process`
    default import, while legitimate `runCliEntrypoint` users still pass.
- [x] 1.5.11.3. Share entrypoint-seam AST test primitives.
  - Source: audit:1.5.11; severity medium.
  - Scope: extract shared import-inspection helpers for CLI seam tests and fix
    call-expression recursion so nested calls are discovered instead of being
    pruned by the first non-matching call expression.
  - Success: `cli-entrypoint-test-support.ts` and
    `cli-support-test-support.ts` use one import-inspection helper, and tests
    cover nested `runCliEntrypoint` calls that previously escaped detection.

## Revision notes

- 2026-07-04 09:59Z: Marked WI1 complete, recorded the documentation index
  discovery, CodeRabbit retry-budget decision, and plan changes from review
  feedback. Remaining work starts at WI2.
- 2026-07-04 10:16Z: Marked WI2 complete, recorded CodeRabbit smoke-test
  findings and the decision to proceed after fixing final trivial review items.
  Remaining work starts at WI3.
- 2026-07-04 12:18Z: Marked WI3 complete, recorded the file-size split into
  `cli-entrypoint-test-support.ts`, and documented the widened process-access
  detection requested by CodeRabbit. Remaining work starts at WI4.
- 2026-07-04 14:01Z: Marked WI4 and the ExecPlan complete, checked off
  roadmap item 1.5.11, and recorded the CodeRabbit rate-limit retry.
- 2026-07-04 12:31Z: Added post-completion addenda for the settled 1.5.11
  review and audit remediation proposals. These entries record follow-up work
  only; implementation remains for the lightweight addendum passes.
