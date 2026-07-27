# Implement `odw-lint check` for explicit file paths (roadmap 2.4.1)

This ExecPlan (execution plan) is a living document. The sections `Constraints`,
`Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

## Purpose / big picture

After this change a developer can run the standalone linter over one or more
named workflow files and use its process exit code as a CI gate:

```text
bun run src/cli/main.ts check tests/static-analysis/fixtures/odw-examples/fan-out-reduce.js
```

The command reads each explicitly named file, statically lints it through the
existing `lintWorkflowSource` pipeline without executing any workflow source,
prints the diagnostics it found, and terminates with the designed exit code
following Ruff's `check` semantics (`docs/technical-design.md` §§7.0, 7.4): `0`
when no diagnostics remain, `1` when **any** diagnostic remains (regardless of
severity) or an input file cannot be read, and `2` when the invocation itself
is invalid. Success is observable: running the command over the valid
ODW-example corpus (each fixture carries `expectedDiagnostics: []`) exits `0`,
running it over the deliberately invalid workflow corpus — every family of
which emits at least one diagnostic, including the warning-only
hostile-metadata family — exits `1`, and running it with no paths exits `2`.

This is the first task of roadmap step 2.4 ("Ship the minimal `check`
command"). It deliberately implements only the explicit-file-path spine and the
exit-code contract. Rich human text formatting (roadmap 2.4.2), JSON output
(2.4.3), and the full Ruff-compatible flag surface, glob/config discovery, and
severity-gating flags (2.4.4, 3.1.3) are out of scope and are called out
explicitly below so this slice does not pre-empt them.

## Constraints

Hard invariants that must hold throughout implementation.

- Work happens only in the worktree at
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-4-1` on branch
  `roadmap-2-4-1`. Never edit the root/control checkout.
- Production code must not execute workflow source or import ODW runtime
  helpers. The static-analysis boundary is a security boundary
  (`docs/developers-guide.md` §"Static-Analysis Boundary";
  `docs/technical-design.md` §§5, 6.4;
  `docs/adr/0001-static-analysis-boundary.md`). The CLI only reads bytes and
  calls the already-vetted `lintWorkflowSource` entry point.
- The command is path/glob-first and must not resolve bare ODW workflow names.
  For this task it accepts explicit path operands only; default-root and
  configured-include-glob discovery (`docs/technical-design.md` §7.2) is
  deferred and must not be faked (`docs/developers-guide.md` §"Static-Analysis
  Boundary").
- No new `bin` field is added to `package.json`; the developers' guide records
  that there is "still no published `bin` field while the command surface is
  being built" (`docs/developers-guide.md` line 35). The entrypoint is invoked
  through `bun run <path>`.
- The package entry (`src/index.ts`) shape is pinned by
  `tests/diagnostics/package-entry.test.ts` and
  `tests/diagnostics/architecture-fixtures.ts`. Do not widen the package export
  surface in this task; the CLI is an application entrypoint, not a re-exported
  library symbol. (`WorkflowLintResult`/`lintWorkflowSource` are already
  re-exported "for future CLI and public-consumer work",
  `docs/developers-guide.md` line 152, so no new export is required.)
- The reviewed fixture corpus is single-sourced (roadmap 2.3.5). Corpus-driven
  tests must consume the owner modules
  `tests/static-analysis/fixtures/odw-examples.ts` and
  `tests/static-analysis/fixtures/invalid-workflows.ts` (and
  `fixtures/corpus-support.ts`), never inline corpus-location literals. Note
  (verified round 1): the `fixture-corpus-ownership` guard
  (`tests/static-analysis/fixture-corpus-ownership.test.ts`) only scans
  `STATIC_ANALYSIS_ROOT = "tests/static-analysis"`, so it does **not** run over
  the new `tests/cli/` suites — single-sourcing here is a drift-resistance
  requirement of this plan, not something that guard enforces. Do not justify
  it by a guard that never scans these files.
- No production source file exceeds 400 lines (`AGENTS.md` §"Code Style and
  Structure"). Keep each CLI module small and single-responsibility.
- Do not add a new catalogued rule ID or change the diagnostic schema in this
  task. Adding a rule expands the schema enum and requires catalogue, schema,
  docs, and parity updates (`docs/technical-design.md` §§8, 9); that is out of
  scope here.
- en-GB Oxford spelling ("-ize"/"-yse"/"-our") in all prose, comments, and
  commit messages (`AGENTS.md`; `en-gb-oxendict` skill).

## Tolerances (exception triggers)

- Scope: if delivering exit-code correctness requires touching more than ~10
  files or adding more than ~400 net lines of production code, stop and
  escalate.
- Interface: if the task appears to require a new package-level export, a new
  `bin` field, a new catalogued rule ID, or a diagnostic-schema change, stop
  and escalate — these belong to later 2.4.x/3.x tasks.
- Dependencies: if any work item seems to need a new runtime or dev dependency
  (for example a BDD/cucumber runner, an argument-parsing library, or a glob
  library), stop and escalate. The repo currently has no BDD infrastructure and
  no `.feature` files; behaviour is proven with spawn-based e2e tests instead.
- Discovery creep: if a work item starts implementing glob expansion,
  configured include roots, `.gitignore` handling, or `--stdin-filename`, stop
  — those are 2.4.4.
- Iterations: if `make all` still fails after 3 focused attempts on one work
  item, stop and escalate with the failing gate output.
- Ambiguity: if the observed exit-code behaviour of the corpus contradicts the
  policy pinned in the Decision Log, stop and present the divergence.

## Risks

- Risk: mis-reading the exit-code policy for warning-only results. One reading
  gates exit `1` on error-severity only; the design does not. Severity: medium.
  Likelihood: low (resolved below). Mitigation: follow the design's Ruff-parity
  mandate literally. §7.0 names `ruff check` the "UX gold standard" and the
  evidence table (`docs/technical-design.md:55`) records that `odw-lint check`
  "should copy Ruff's check-command semantics"; `ruff check` exits `1` for
  **any** remaining violation regardless of severity, with `--exit-zero`/
  `--fix-only` as the documented opt-outs (§7.0 lists those same opt-outs).
  §7.4's exit-`1` row ("Diagnostics remain, …") is not severity-qualified. So
  the pinned policy is: exit `1` when **any** diagnostic remains or any input
  is unreadable; exit `0` only when zero diagnostics remain. `--max-warnings`
  and `--strict-claude` (roadmap 3.1.3) are later *refinements* of this
  default, not evidence that plain warnings pass today. Lock it with a table
  test whose only exit-`0` row is the truly clean case (error, warning-only,
  info/hint, and read-failure rows all exit `1`).
- Risk: representing unreadable files. `docs/technical-design.md` §7.2 says
  "Unreadable files produce diagnostics and exit code 1", but there is no
  catalogued IO-error rule and JSON output is not built yet. Severity: low.
  Likelihood: high. Mitigation: report read failures as CLI-level error lines
  on stderr that drive exit `1`; representing them as structured/catalogued
  diagnostics inside the JSON envelope is deferred to 2.4.3/2.4.4. Recorded in
  the Decision Log.
- Risk: adding a new top-level `src/cli/` directory could trip an architecture
  inventory guard. Severity: low. Likelihood: low. Mitigation: verified that
  `tests/diagnostics/architecture.test.ts` pins only `src/diagnostics` and
  `src/static-analysis` module inventories (lines 314–315) and that
  `EXPECTED_PARSEABLE_SOURCE_FILES` is a representative, not exhaustive, list;
  `src/cli/` is unconstrained by those assertions. The recursive import-policy
  scan still covers the new files, which is desired.
- Risk: `src/` importing from `tests/` (the existing `cli-support.ts`
  entrypoint helper lives under `tests/build-gate/`). Severity: low.
  Likelihood: medium. Mitigation: the product CLI must not import test-only
  modules. Use the Bun `import.meta.main` idiom already used at
  `tests/static-analysis/fixtures/refresh-metadata.ts:136` for the entrypoint
  guard; keep production stream/exit wiring inside `src/cli/`.

## Progress

- [x] (2026-07-06T02:07Z) WI-1: Add the explicit-path workflow
  source reader. Red: `bun test tests/cli/read-workflow-source.test.ts` failed
  because `../../src/cli/read-workflow-source` did not exist. Green: added
  `src/cli/read-workflow-source.ts` and
  `tests/cli/read-workflow-source.test.ts`; the focused test passed with 6
  tests. Refactor/gate: added concise private-helper JSDoc required by
  `df12(require-private-jsdoc)`, added the missing `docs/contents.md` ExecPlan
  index entry required by the repository documentation freshness gate,
  formatted only touched files, and ran `make all`, `make markdownlint`, and
  `make nixie` successfully after the ExecPlan update.
- [x] (2026-07-06T03:22Z) WI-2: Add the multi-file check aggregator and
  exit-code policy. Red: `bun test tests/cli/run-check.test.ts` failed because
  `../../src/cli/run-check` did not exist. Green: added `src/cli/run-check.ts`
  and `tests/cli/run-check.test.ts`; the focused test passed with 7 tests.
  Refactor/gate: extracted the remaining-findings predicate required by
  `df12(complex-conditional)`, added the private-helper JSDoc required by
  `df12(require-private-jsdoc)`, converted branded rule IDs to strings only at
  the test assertion boundary, formatted only touched TypeScript files, and ran
  `make all` successfully. The aggregator counts only successfully read files in
  `report.summary.files`, preserves diagnostic path order, reports read
  failures separately from catalogued diagnostics, and returns exit `1` for any
  diagnostic severity or read failure under the recorded Ruff-parity policy.
- [x] (2026-07-06T02:23Z) WI-3: Add the `check` argument parser,
  CLI runner, and entrypoint. Red:
  `bun test tests/cli/check-cli.test.ts tests/cli/main-entrypoint.test.ts`
  failed because `../../src/cli/check-cli` and `src/cli/main.ts` did not exist.
  Green: added `src/cli/check-cli.ts`, `src/cli/main.ts`,
  `tests/cli/check-cli.test.ts`, and `tests/cli/main-entrypoint.test.ts`; the
  focused suite passed with 10 tests. Refactor/gate: organized imports with
  targeted Biome checks, kept process output behind injected writers, kept the
  Bun entrypoint thin, and covered clean, error-bearing, warning-only,
  unreadable, usage-error, and non-`Errno` reader paths. Scrutineer then ran
  `make all`, `make check-fmt`, `make typecheck`, `make lint`, `make test`,
  `make markdownlint`, and `make nixie` successfully; local reruns of the named
  deterministic gates also passed.
- [x] (2026-07-06T03:38Z) WI-4: Add corpus-driven end-to-end
  exit-code coverage. Red: `bun test tests/cli/check-cli-corpus.e2e.test.ts`
  failed because the file did not exist. Green: added
  `tests/cli/check-cli-corpus.e2e.test.ts`; the focused process-level corpus
  suite passed with 17 tests after targeted Biome formatting. The suite spawns
  `bun run src/cli/main.ts check` from the repository root, drives every valid
  ODW example fixture from `ODW_EXAMPLE_FIXTURE_SNAPSHOTS`, samples one invalid
  fixture from each reviewed invalid family (`missing-metadata`,
  `malformed-metadata`, `hostile-metadata`, `unsupported-import-export`, and
  `syntax-error`), proves the mixed valid/error-bearing invocation exits `1`,
  and proves the no-operand invocation exits `2`. Refactor/gate: no production
  refactor was needed; the post-commit local `make all` rerun exposed Bun
  `it.each` overload friction with readonly fixture manifests, so the test now
  copies manifest arrays only at the `it.each` boundary before the commit was
  amended and the gates rerun.
- [x] (2026-07-06T04:27Z) WI-5: Document the minimal `check` command
  and its exit codes. Green: updated `docs/developers-guide.md` to document
  `bun run src/cli/main.ts check <paths>`, explicit-path scope, stderr read
  failures, Ruff-parity `0`/`1`/`2` exit meanings, and deferred text/JSON,
  discovery, glob, and wider flag work. Refactor/gate: no source refactor or
  new tests were needed for this documentation-only item; formatted only the
  touched Markdown files and ran the required deterministic gates.

## Surprises & discoveries

- Observation: the human text formatter already exists and already emits
  `file:line:column severity rule message`. Evidence: `src/diagnostics/text.ts`
  `formatTextDiagnostics`, re-exported from `src/index.ts`. Impact: this task
  reuses it for observability; the *designed* text-output contract (grouping,
  summary, colour, `--output-format`) remains roadmap 2.4.2. This slice must
  not redesign text output.
- Observation: in this planning session `git`, `make`, and `bunx` invocations
  are refused by the harness permission policy ("requires approval"), even
  read-only and with the sandbox disabled. Evidence: `git -C … log`,
  `make markdownlint`, and `bunx markdownlint-cli2 --fix` all returned "This
  command requires approval". Impact: the ExecPlan Markdown was validated
  manually against `.markdownlint-cli2.jsonc` (MD013 80/120 line lengths, MD004
  dash bullets, MD029 ordered lists, MD040 fenced-code languages);
  `make markdownlint` / `make nixie` and the commit must be performed by the
  workflow host. The same blanket `git`/`make`/`bunx` refusal persisted in
  planning rounds 2 and 3 (`git -C … add`, `git … commit`, and the
  `cd … && git` form were all refused again in round 3), so the plan commit
  remains the host's salvage responsibility. Round 3 removed the now-superseded
  round-1 review scratch file `docs/execplans/roadmap-2-4-1.review-r1.md`; its
  B1/B2/A1–A3 points are already folded into Revision 2 and the Decision Log,
  so the ExecPlan is the sole dirty path and host salvage can commit it without
  declining.
- Observation: a full CLI entrypoint/writer pattern already exists but only for
  build-gate CLIs under `tests/build-gate/` (`cli-support.ts`,
  `review-evidence-cli.ts`, `*-cli-smoke.test.ts`). Evidence:
  `tests/build-gate/cli-support.ts`,
  `tests/build-gate/review-evidence-cli-smoke.test.ts`. Impact: the product CLI
  mirrors those proven shapes (injectable writers, discriminated usage-error
  results, spawn-based smoke tests) without importing the test-only module.
- Observation: adding the task ExecPlan requires a matching
  `docs/contents.md` entry for `make all` to pass. Evidence: before the
  contents update, `bun test tests/build-gate/documentation-contents.test.ts`
  reported missing `execplans/roadmap-2-4-1.md`; adding the link made
  `make all` pass. Impact: WI-1 includes the minimal documentation-index update
  alongside the source reader so the committed work item is gate-clean.
- Observation: the internal analyser-failure branch in `runCheckCli` is
  present but not directly injectable without widening the WI-3 public seam.
  Evidence: `runCheck` owns the `lintWorkflowSource` call and WI-3's planned
  `CheckCliIo` seam only exposes writers, version, and `readFileText`. Impact:
  WI-3 covers non-`Errno` reader throws as read failures and leaves a direct
  analyser-throw test as a residual gap rather than adding an out-of-plan
  linter injection hook.
- Observation: Leta symbol lookups worked for manifest-owner symbols, then a
  later scoped symbol search returned "Connection closed unexpectedly".
  Evidence: `leta show ODW_EXAMPLE_FIXTURE_SNAPSHOTS` and
  `leta show INVALID_WORKFLOW_FIXTURE_SNAPSHOTS` succeeded;
  `leta grep
  "spawnSync|review-evidence" "tests/build-gate" -k function,variable,const`
  returned the connection-closed error. Impact: WI-4 continued with bounded
  branch-local file inspection for the smoke-test pattern and recorded the
  transient tooling failure, as permitted by the workflow instructions.

## Decision log

- Decision: adopt Ruff parity for the default exit policy — exit `1` when
  **any** diagnostic remains (regardless of severity) OR at least one input
  file is unreadable; exit `0` only when zero diagnostics remain. Rationale:
  `docs/technical-design.md` §7.0 makes `ruff check` the "UX gold standard" and
  the evidence table (`docs/technical-design.md:55`) mandates that
  `odw-lint check` "should copy Ruff's check-command semantics". `ruff check`
  exits `1` for any remaining violation irrespective of severity, with
  `--exit-zero`/`--fix-only` as the documented opt-outs — §7.0 lists exactly
  those opt-outs, which only make sense if the default is "remaining
  diagnostics fail". §7.4's exit-`1` row ("Diagnostics remain, warning
  threshold was exceeded, …") is not severity-qualified, and §7.2 states
  "Unreadable files produce diagnostics and exit code 1". The earlier round-1
  draft gated exit `1` on error severity only; the design reviewer (round 1,
  B1/B2) rejected that as contradicting the primary stated precedent, and it
  made WI-4's hostile-metadata assertion impossible. `--max-warnings`/
  `--strict-claude` (roadmap 3.1.3) are future refinements layered over this
  default, not a licence for plain warnings to pass now. The valid ODW-example
  corpus carries `expectedDiagnostics: []`, so it exits `0`; every invalid
  family emits at least one diagnostic, so it exits `1`. Date/Author:
  2026-07-06, planning agent (revised round 2 per design review).
- Decision: unreadable input files are reported as CLI error lines on stderr
  and set exit `1`; they are not modelled as catalogued `Diagnostic` objects.
  Rationale: no IO-error rule exists in `src/diagnostics/rule-catalogue.ts`;
  adding one is a §8/§9 taxonomy change out of scope for a CLI slice, and the
  structured/JSON representation is 2.4.3/2.4.4. Satisfies §7.2 ("produce
  diagnostics and exit code 1") at the CLI observability level. Date/Author:
  2026-07-06, planning agent.
- Decision: with no path operands the command exits `2` (usage error) rather
  than performing default-root discovery. Rationale: this task is "explicit
  file paths"; default-root/include-glob discovery is deferred
  (`docs/technical-design.md` §7.2; `docs/developers-guide.md`
  §"Static-Analysis Boundary"). Exiting `2` is a well-defined behaviour that
  does not fake discovery. Date/Author: 2026-07-06, planning agent.
- Decision: use the Bun `import.meta.main` guard for the entrypoint instead of
  the test-only `runCliEntrypoint` helper. Rationale: production code must not
  import `tests/`; `import.meta.main` is already an established idiom in this
  repo. Date/Author: 2026-07-06, planning agent.
- Decision: keep the explicit-path reader as an internal `src/cli/` module and
  avoid package-entry re-exports. Rationale: the CLI source reader is
  application plumbing for later 2.4.1 work items. Exporting it through
  `src/index.ts` would widen the package surface, contradicting this plan's
  constraints. Date/Author: 2026-07-06, Codex builder.
- Decision: keep the WI-3 process smoke test to the no-operand entrypoint path.
  Rationale: WI-4 owns corpus-driven end-to-end process coverage. A small
  process test in WI-3 proves `src/cli/main.ts` is runnable and uses the exit
  code returned by `runCheckCli` without pre-empting WI-4's corpus slice.
  Date/Author: 2026-07-06, Codex builder.

## Outcomes & retrospective

Delivered the roadmap 2.4.1 explicit-file-path spine for `odw-lint check`. The
command reads named workflow files without executing them, reports existing
text diagnostics, reports read failures on stderr, and exits `0` only for clean
inputs, `1` for any remaining diagnostic or unreadable input, and `2` for
invalid usage or internal analyser failure. WI-4 proves the observable
valid/invalid/mixed/usage process contract against the reviewed fixture corpus;
WI-5 documents the minimal operator surface while keeping text/JSON formatting,
discovery, glob expansion, and the wider Ruff-compatible flag surface deferred.

## Context and orientation

The reader needs only this worktree. Relevant existing code:

- `src/static-analysis/workflow-lint.ts` exports
  `lintWorkflowSource(source: WorkflowSource): WorkflowLintResult`. The result's
  `diagnostics` field is the canonical, frozen diagnostic stream for one
  source string. This is the production entry point (`docs/developers-guide.md`
  lines 144–152) and does not execute workflow source.
- `src/static-analysis/types.ts` defines
  `WorkflowSource = { readonly filePath: string; readonly sourceText: string }`.
- `src/diagnostics/types.ts` defines `Diagnostic`, `DiagnosticReport`,
  `DiagnosticSummary`, `SourceSpan`, and `TOOL_NAME`.
- `src/diagnostics/report.ts` exports
  `createDiagnosticReport({ version, files, diagnostics })` (builds the
  versioned envelope and severity summary) and `countDiagnostics`.
- `src/diagnostics/text.ts` exports
  `formatTextDiagnostics(diagnostics): string` (one line per diagnostic,
  `file:line:column severity rule message`).
- `src/index.ts` is the pinned package entry; it re-exports all of the above,
  plus `lintWorkflowSource`/`WorkflowLintResult`. It must contain no top-level
  declarations (`tests/diagnostics/architecture.test.ts:320`). Do not modify it
  in this task.
- Reference CLI shapes (build-gate only, do **not** import from production):
  `tests/build-gate/cli-support.ts` (injectable writers, entrypoint guard),
  `tests/build-gate/review-evidence-cli.ts` (discriminated usage-error parse
  results, `exitCodeFor`), `tests/build-gate/review-evidence-cli-smoke.test.ts`
  (`Bun.spawnSync` process smoke test).
- Fixture corpora (single-sourced, roadmap 2.3.5):
  valid — `tests/static-analysis/fixtures/odw-examples/` with owner module
  `tests/static-analysis/fixtures/odw-examples.ts`
  (`ODW_EXAMPLE_FIXTURE_SNAPSHOTS`, each `expectedDiagnostics: []`); invalid —
  `tests/static-analysis/fixtures/invalid-workflows/` with owner module
  `tests/static-analysis/fixtures/invalid-workflows.ts`
  (`INVALID_WORKFLOW_FIXTURE_SNAPSHOTS`). Reuse
  `tests/static-analysis/fixtures/corpus-support.ts` for fixture-path lookup.

New code lives under a new `src/cli/` directory. Terms: an *operand* is a
non-flag command-line argument (here, a file path); a *usage error* is an
invalid invocation (unknown subcommand, unknown flag, or no operands); the
*exit code* is the integer the process returns.

## Plan of work

The work is staged so each work item is independently committable and passes
`make all`. Every production change follows Red-Green-Refactor.

### WI-1: Add the explicit-path workflow source reader

Create `src/cli/read-workflow-source.ts`. It exposes a single function that
turns a path into either a `WorkflowSource` or a structured read failure, with
the filesystem read injected for testability:

```ts
// src/cli/read-workflow-source.ts
export type WorkflowSourceReadFailure = {
  readonly filePath: string;
  readonly reason: "not-found" | "not-a-file" | "unreadable";
  readonly message: string;
};

export type WorkflowSourceReadResult =
  | { readonly ok: true; readonly source: WorkflowSource }
  | { readonly ok: false; readonly failure: WorkflowSourceReadFailure };

export type ReadFileText = (filePath: string) => string;

export const readWorkflowSource = (
  filePath: string,
  options?: { readonly readFileText?: ReadFileText },
): WorkflowSourceReadResult;
```

Default `readFileText` uses `node:fs` `readFileSync(filePath, "utf8")` and
classifies thrown `NodeJS.ErrnoException` codes (`ENOENT` → `not-found`,
`EISDIR` → `not-a-file`, otherwise `unreadable`). Convert the caught unknown
into a project-owned failure shape at this boundary (`AGENTS.md` §"Error
Handling"). This is the "Source reader" component of `docs/technical-design.md`
§6.1 and introduces the first `node:fs` use in `src/`.

Documentation to read: `docs/technical-design.md` §§6.1, 7.2; `AGENTS.md`
§§"Error Handling", "Runtime Validation & Types". Skills: load `python-router`
is **not** applicable — this is TypeScript; follow `AGENTS.md` §"TypeScript
Guidance" (there is no TS router skill in this session, so obey the guide
directly).

Tests (`tests/cli/read-workflow-source.test.ts`), red first:

- reading an existing UTF-8 fixture returns `ok: true` with the exact
  `filePath` and `sourceText`.
- an injected reader throwing `ENOENT` yields `reason: "not-found"`; `EISDIR`
  yields `not-a-file`; any other code yields `unreadable` — a small table test.
- the default reader path is exercised once against a real temp file created
  and removed with `node:fs` (`mkdtempSync`/`rmSync`), mirroring the build-gate
  smoke-test hygiene, to prove the real `readFileSync` wiring.

### WI-2: Add the multi-file check aggregator and exit-code policy

Create `src/cli/run-check.ts`. It iterates an ordered list of paths, reads each
via WI-1, lints readable sources with `lintWorkflowSource`, aggregates all
diagnostics into one `DiagnosticReport` via `createDiagnosticReport`, collects
read failures, and derives the diagnostics/read exit status. Usage and internal
errors are handled one layer up in WI-3, so this module returns only `0` or `1`.

```ts
// src/cli/run-check.ts
export type CheckOutcome = {
  readonly report: DiagnosticReport;              // built with createDiagnosticReport
  readonly readFailures: readonly WorkflowSourceReadFailure[];
};

export const runCheck = (request: {
  readonly paths: readonly string[];
  readonly version: string;                        // package version, threaded from the caller
  readonly readFileText?: ReadFileText;
}): CheckOutcome;

// Ruff parity: exit 1 when ANY diagnostic remains OR any file was unreadable.
export const checkDiagnosticsExitCode = (outcome: CheckOutcome): 0 | 1;
```

`report.summary.files` counts the paths that were successfully read and linted.
Exit policy is exactly the Decision Log rule (Ruff parity):
`checkDiagnosticsExitCode` returns `1` iff
`outcome.report.diagnostics.length > 0` or `outcome.readFailures.length > 0`,
else `0`. Use the diagnostics stream length (not `summary.errors`) so
warning/info/hint-only results also exit `1`, matching `ruff check`. Cite
`docs/technical-design.md` §§7.0, 7.2, 7.4 and §9.2.

Documentation to read: `docs/technical-design.md` §§6.1, 7.0, 7.2, 7.4, 8, 9.2;
roadmap 2.4.1, 3.1.3. Skills: `AGENTS.md` §"TypeScript Guidance"; consider the
`fast-check` guidance under §"Testing" for the exit-policy property.

Tests (`tests/cli/run-check.test.ts`), red first, using an injected in-memory
`readFileText` and synthetic sources:

- a table test over
  `{ clean → 0, warning-only → 1, error → 1, read-failure → 1,`
  `mixed error+clean → 1 }` pinning `checkDiagnosticsExitCode` under Ruff
  parity. The only exit-`0` row is the truly clean case. Build the warning-only
  and error cases from real fixture sources so the policy is anchored to real
  diagnostics: use a hostile-metadata fixture for the warning-only case (all
  four entries in the invalid-workflows manifest
  `manifests/hostile-metadata.ts` are a single `odw/meta-statically-unprovable`
  warning, verified round 1), and a `missing-metadata` invalid fixture for the
  error case. The warning-only row is the load-bearing assertion that separates
  Ruff parity from the rejected error-only reading.
- aggregation: two readable files produce a report whose `summary.files === 2`
  and whose `diagnostics` concatenates both files' diagnostics in path order.
- a `fast-check` property: for any ordering of `{error, warning, clean}` source
  labels, `checkDiagnosticsExitCode` is `1` exactly when at least one non-clean
  source (`error` **or** `warning`) or an unreadable input is present, and `0`
  only when every source is clean and readable — guards the policy against
  list-order drift and against regressing to error-only gating.

### WI-3: Add the `check` argument parser, CLI runner, and entrypoint

Create `src/cli/check-cli.ts` (parser + runner + writer wiring) and
`src/cli/main.ts` (thin entrypoint). Model the discriminated usage-error parse
and injectable writers on `tests/build-gate/review-evidence-cli.ts` and
`tests/build-gate/cli-support.ts`, but keep the code in `src/cli/`.

```ts
// src/cli/check-cli.ts
export type CheckCliIo = {
  readonly writeOut?: (message: string) => void;
  readonly writeErr?: (message: string) => void;
  readonly readFileText?: ReadFileText;
  readonly version?: string;
};

export const runCheckCli = (
  args: readonly string[],
  io?: CheckCliIo,
): 0 | 1 | 2;
```

Argument model for this task: the first operand must be the literal subcommand
`check`; the remaining operands are file paths. Anything beginning with `-` is
an unknown flag for now (there are no flags in 2.4.1). Rules:

- missing/incorrect subcommand, any `-`-prefixed argument, or zero path
  operands → usage error: write a one-line message to stderr and return `2`
  (`docs/technical-design.md` §7.4; Decision Log).
- otherwise call `runCheck`, write `formatTextDiagnostics(report.diagnostics)`
  (plus a trailing newline when non-empty) to stdout, write each read failure
  as an `error: cannot read <path>: <message>` line to stderr, and return
  `checkDiagnosticsExitCode(outcome)`.
- wrap the whole run in a try/catch; an unexpected thrown value (internal
  analyser failure) writes a diagnostic line to stderr and returns `2`
  (`docs/technical-design.md` §7.4). Default `version` is read from the package
  version available to the process; thread it in rather than hard-coding.

`src/cli/main.ts` carries a `#!/usr/bin/env bun` shebang, a `/** @file … */`
block, and:

```ts
if (import.meta.main) {
  process.exitCode = runCheckCli(process.argv.slice(2));
}
```

No `bin` field is added (Constraints). Keep both files well under 400 lines.

Documentation to read: `docs/technical-design.md` §§7.1, 7.4; `AGENTS.md`
§§"TypeScript Guidance", "Observability" (structured stderr lines, no ad hoc
`console.log` in reusable code — `runCheckCli` writes through injected
writers). Skills: `AGENTS.md` §"TypeScript Guidance".

Tests (`tests/cli/check-cli.test.ts`), red first, calling `runCheckCli`
directly with captured writers and an injected reader:

- `check <valid-fixture>` → returns `0`, stdout empty (no diagnostics), stderr
  empty.
- `check <error-bearing invalid-fixture>` (name a `missing-metadata` fixture
  explicitly, not "an invalid fixture") → returns `1`, stdout contains the
  expected `file:line:column severity rule message` line(s) for that fixture,
  stderr empty.
- `check <warning-only invalid-fixture>` (a hostile-metadata fixture) → returns
  `1` under Ruff parity even though its only diagnostic is a warning, stdout
  contains the `warning` line — this pins the warning-only exit-`1` behaviour
  at the CLI layer too.
- `check <missing-path>` (reader throws `ENOENT`) → returns `1`, stderr
  contains the `error: cannot read …` line.
- no operands, `check` with only a `--flag`, and a wrong subcommand → return
  `2` with a stderr usage line and empty stdout — a small table test.
- an injected reader that throws a non-`Errno` value is classified as
  `unreadable` (exit `1`), confirming the boundary conversion; and an injected
  linter seam that throws (if exposed) returns `2` — if the internal-failure
  path cannot be reached without over-engineering, cover it by asserting the
  try/catch via a reader that throws a synthetic non-error object routes to the
  read-failure path, and record any residual gap in Surprises.

### WI-4: Add corpus-driven end-to-end exit-code coverage

Add `tests/cli/check-cli-corpus.e2e.test.ts` proving the observable
process-level contract, modelled on
`tests/build-gate/review-evidence-cli-smoke.test.ts` (`Bun.spawnSync` with
`cwd` at the repository root). Drive paths from the corpus owner modules so the
`fixture-corpus-ownership` guard is satisfied:

- for each entry in `ODW_EXAMPLE_FIXTURE_SNAPSHOTS`, spawn
  `bun run src/cli/main.ts check <fixturePath>` and assert exit `0`.
- for a representative slice of `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS` (at least
  one per family: missing-metadata, malformed-metadata, hostile-metadata,
  unsupported-import-export, syntax-error), spawn the command and assert exit
  `1`. Under Ruff parity every family exits `1` because each emits at least one
  diagnostic; the hostile-metadata sample (warning-only,
  `odw/meta-statically-unprovable`) is included precisely to prove warning-only
  inputs still exit `1`.
- a multi-file mixed invocation (`check <valid> <error-bearing invalid>`, e.g. a
  `missing-metadata` fixture) asserts exit `1`. (Any invalid operand would
  suffice under Ruff parity, but naming an error-bearing one keeps the intent
  explicit and severity-independent.)
- a no-operand invocation (`bun run src/cli/main.ts check`) asserts exit `2`.

Keep the invalid slice bounded and `log`/comment which families are sampled so
the coverage is honest (no silent truncation). Prefer resolving fixture paths
through `tests/static-analysis/fixtures/corpus-support.ts`.

Documentation to read: `docs/technical-design.md` §15 (acceptance boundary:
"analyse the ODW example corpus and deliberately invalid fixtures … run in CI
without executing workflow source"); roadmap 2.3.5 (corpus ownership);
`AGENTS.md` §"Testing" (end-to-end tests for command-line behaviour). Skills:
`AGENTS.md` §"Testing".

### WI-5: Document the minimal `check` command and its exit codes

Update `docs/developers-guide.md` (the CLI boundary section around lines 22–35)
to document the shipped minimal `odw-lint check` command: explicit-path
invocation via `bun run src/cli/main.ts check <paths>`, the `0`/`1`/`2` exit
codes and what each means under Ruff parity (`0` when no diagnostics remain;
`1` when any diagnostic remains regardless of severity, or an input file cannot
be read; `2` for invalid CLI usage or internal analyser failure), that read
failures are reported on stderr and set exit `1`, and that text/JSON
formatting, discovery, and the wider flag surface (including `--exit-zero`,
`--max-warnings`, and `--strict-claude`) remain deferred to 2.4.2–2.4.4/3.1.3.
Cite `docs/technical-design.md` §§7.0, 7.4. Keep en-GB Oxford spelling, wrap
prose at 80 columns, and do not introduce a `bin` claim.

If, and only if, the developers' guide references need a home for the exit-code
table, add it inline there rather than creating a new rules doc (the command is
not a catalogued rule). Do not add `docs/rules/` entries in this task.

Documentation to read: `docs/documentation-style-guide.md`; `AGENTS.md`
§§"Markdown Guidance", "Documentation Maintenance". Skills: `en-gb-oxendict`,
and consult the `changelog` skill only if a changelog exists (none is present,
so skip it).

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-4-1`.

For each work item:

1. Write the failing test(s) first and run the focused suite to observe Red:

   ```bash
   bun test tests/cli/<file>.test.ts
   ```

   Expect a failure that names the missing module or unmet expectation.

2. Add the minimal production code to reach Green, rerun the focused suite.

3. Refactor for clarity within the 400-line limit, rerun the focused suite.

4. Run the full commit gate before committing:

   ```bash
   make all
   ```

5. For WI-5 (and any Markdown touched), additionally run:

   ```bash
   bunx mdtablefix docs/execplans/roadmap-2-4-1.md docs/developers-guide.md
   bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-4-1.md docs/developers-guide.md
   make markdownlint
   make nixie
   ```

   Only pass paths that this work item actually edits to the formatter; rely on
   `make markdownlint`/`make nixie` for repository-wide validation.

6. Commit with an en-GB imperative subject, one commit per work item.

Commit the ExecPlan itself immediately (before WI-1) and after every revision.

## Validation and acceptance

Quality criteria ("done"):

- Tests: `make test` passes; the new `tests/cli/*` suites pass. Each new
  production behaviour has a test that failed before its implementation
  (Red-Green evidence recorded in `Progress`).
- Lint/format/type: `make all` passes (it runs `build`, `check-fmt`,
  `whitespace-hygiene`, `lint`, `typecheck`, `test`).
- Markdown (WI-5): `make markdownlint` and `make nixie` pass.
- Acceptance behaviour, observed via the e2e suite and reproducible by hand:

  ```bash
  bun run src/cli/main.ts check tests/static-analysis/fixtures/odw-examples/fan-out-reduce.js; echo "exit=$?"
  # exit=0

  invalid=tests/static-analysis/fixtures/invalid-workflows/missing-metadata/missing-meta.js
  bun run src/cli/main.ts check "$invalid"; echo "exit=$?"
  # prints a diagnostic line; exit=1

  bun run src/cli/main.ts check; echo "exit=$?"
  # prints a usage error to stderr; exit=2
  ```

The deterministic commit gate for this run is `make all`. `AGENTS.md` is
authoritative for the gate set: run `make all`, and for Markdown-touching work
items also run `make markdownlint` and `make nixie`. The workflow host re-runs
the configured gates against the committed HEAD; do not report gates green
unless every required gate passed at HEAD.

Red-Green-Refactor evidence is recorded per work item in `Progress` as it is
implemented (Red command + observed failure, Green command + pass, Refactor +
pass).

## Idempotence and recovery

All steps are re-runnable. Tests use injected readers/writers or temp files
created and deleted within the test (`mkdtempSync`/`rmSync`), so they leave no
residue. The CLI reads files read-only and never writes workflow source. If a
work item's gate fails, fix forward and rerun `make all`; nothing here is
destructive or requires rollback.

## Artefacts and notes

Reference shapes to mirror (build-gate, not to be imported by production):

- `tests/build-gate/cli-support.ts` — `resolveCliWriters`, `emitCliReport`.
- `tests/build-gate/review-evidence-cli.ts` — discriminated
  `ParsedCliOption<T>` usage-error results and `exitCodeFor`.
- `tests/build-gate/review-evidence-cli-smoke.test.ts` — `Bun.spawnSync` smoke
  pattern with `cwd` at the repository root.

## Interfaces and dependencies

No new runtime or dev dependencies. Production surfaces to exist at the end:

- `src/cli/read-workflow-source.ts`: `readWorkflowSource`,
  `WorkflowSourceReadResult`, `WorkflowSourceReadFailure`, `ReadFileText`.
- `src/cli/run-check.ts`: `runCheck`, `CheckOutcome`,
  `checkDiagnosticsExitCode`.
- `src/cli/check-cli.ts`: `runCheckCli`, `CheckCliIo`.
- `src/cli/main.ts`: `#!/usr/bin/env bun` entrypoint guarded by
  `import.meta.main`, calling `runCheckCli(process.argv.slice(2))` and setting
  `process.exitCode`.

These consume existing exports only: `lintWorkflowSource`/`WorkflowSource` from
`src/static-analysis`, and `createDiagnosticReport`/`formatTextDiagnostics`/
`DiagnosticReport`/`TOOL_NAME` from `src/diagnostics`. `src/index.ts`,
`package.json` exports, the rule catalogue, and the diagnostic schema are
unchanged.

## Revision note

Initial draft (2026-07-06): decomposed roadmap 2.4.1 into five atomic work
items covering the source reader, the aggregator plus exit-code policy, the
argument parser/runner/entrypoint, corpus-driven e2e coverage, and
documentation. Scoped out text/JSON formatting, discovery, the wider flag
surface, `bin`, new exports, and catalogue/schema changes as later 2.4.x/3.x
tasks.

Revision 2 (2026-07-06, design review round 1 → round 2): the reviewer rejected
the round-1 error-only exit policy. Adopted Ruff parity throughout — exit `1`
when **any** diagnostic remains (regardless of severity) or an input is
unreadable, exit `0` only when zero diagnostics remain — resolving B1 (policy
now matches `docs/technical-design.md` §§7.0, 7.2, 7.4 and evidence table line
55 rather than contradicting the primary Ruff precedent) and B2 (WI-4's
hostile-metadata assertion and the Purpose's "invalid corpus exits `1`" are now
consistent, because every invalid family — including the warning-only
hostile-metadata family — emits a diagnostic and exits `1`). Rewrote the Risk,
Decision Log, `checkDiagnosticsExitCode` semantics
(`report.diagnostics.length > 0` instead of `summary.errors > 0`), and the
WI-2/WI-3/WI-4 tests accordingly: the WI-2 table's only exit-`0` row is the
clean case, WI-3 adds an explicit warning-only exit-`1` assertion, and the
fast-check property now gates on any non-clean or unreadable source. Also fixed
advisory A1 (the `fixture-corpus-ownership` guard does not scan `tests/cli/`,
so single-sourcing here is a plan requirement, not a guard-enforced one), A2
(WI-3 names an error-bearing `missing-metadata` fixture explicitly), and A3
(WI-4's mixed invocation names an error-bearing invalid operand).

Revision 3 (2026-07-06, design review round 2 → round 3): the only round-3
blocking point was ExecPlan durability — the plan had uncommitted modifications
and an extra untracked path (`docs/execplans/roadmap-2-4-1.review-r1.md`)
caused the host salvage-commit to decline. The plan content was unchanged and
design review had not flagged any new content defect. `git` remained
blanket-refused by the harness permission policy this round too (recorded in
Surprises), so the agent could not self-commit; the resolution was to remove
the superseded round-1 review scratch file — whose B1/B2/A1–A3 findings are
already resolved in Revision 2, the Decision Log, and the Risks — leaving the
ExecPlan as the sole dirty path so host salvage commits it cleanly.

Revision 4 (2026-07-06, WI-1 delivery): implemented the explicit-path workflow
source reader and its focused tests, changed status to `IN PROGRESS`, recorded
Red-Green-Refactor evidence for WI-1, and added the required `docs/contents.md`
entry for this ExecPlan so the documentation freshness gate passes. Remaining
work begins at WI-2.

Revision 5 (2026-07-06, WI-3 delivery): implemented the `check` argument
parser, CLI runner, and Bun entrypoint with direct runner tests and a bounded
entrypoint smoke test. Recorded the residual analyser-failure injection gap,
kept corpus-driven process coverage deferred to WI-4, and ticked WI-3 after
scrutineer and local deterministic gates passed. Remaining work begins at WI-4.

Revision 6 (2026-07-06, WI-4 delivery): added corpus-driven process-level
exit-code coverage for the explicit-path `check` command. The new e2e suite
drives valid and invalid fixture paths from the reviewed corpus owner modules,
includes the warning-only hostile-metadata family, and proves clean, invalid,
mixed, and usage-error process exit codes. Remaining work begins at WI-5.

Revision 7 (2026-07-06, WI-5 delivery): documented the minimal `check` command
and exit-code contract in the developers' guide, ticked the final work item,
and marked this ExecPlan complete. The documentation intentionally describes
only the shipped explicit-path entrypoint and defers text/JSON formatting,
configured discovery, glob expansion, and the wider flag surface to the later
roadmap items named in the plan.
