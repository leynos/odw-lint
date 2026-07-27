# Implement the `--max-warnings` warning-budget CLI flag

This ExecPlan (execution plan) is a living document. The sections `Constraints`,
`Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint check` currently fails (exit code 1) whenever any diagnostic remains,
regardless of severity. That is the Ruff-parity default described in
[technical-design.md](../technical-design.md) §§7.0 and 7.4. Roadmap task 3.3.2
adds the `--max-warnings <n>` flag from
[technical-design.md](../technical-design.md) §7.3 so a caller can tolerate a
bounded number of warning-severity diagnostics before the command fails.

After this change a user can run:

```bash
bun run src/cli/main.ts check --max-warnings 1 workflows/one-warning.js
```

and observe exit code `0` when the run produces exactly one warning and no
other findings, while:

```bash
bun run src/cli/main.ts check --max-warnings 0 workflows/one-warning.js
```

exits `1` because the single warning exceeds the budget of `0`. Errors,
informational diagnostics, hints, and unreadable inputs continue to fail the
command irrespective of the warning budget, and an invalid `--max-warnings`
value (missing, non-integer, or negative) is a usage error that exits `2`.

The observable success criterion from the roadmap is: "the command exits code 1
when warning count exceeds the threshold."

## Definitions

- **Diagnostic**: a single finding emitted by a lint rule, carrying a
  `severity` of `error`, `warning`, `info`, or `hint`
  (`src/diagnostics/types.ts`).
- **Report summary**: the per-severity counts (`errors`, `warnings`, `infos`,
  `hints`) computed once per run by `countDiagnostics` in
  `src/diagnostics/report.ts` and frozen onto `DiagnosticReport.summary`.
- **Read failure**: a path that could not be read; recorded on
  `CheckOutcome.readFailures` and always failing the check
  (`src/cli/run-check.ts`).
- **Warning budget**: the non-negative integer `n` supplied to
  `--max-warnings n`. Warnings up to and including `n` no longer fail the check
  on their own; a warning count strictly greater than `n` fails it.
- **Ruff-parity default**: the current behaviour when `--max-warnings` is
  absent, where any remaining diagnostic (any severity) or read failure yields
  exit code 1.

## Constraints

Hard invariants that must hold throughout implementation.

- Work exclusively inside the git worktree at
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-3-3-2`. Never edit files in
  the root/control worktree.
- Do not weaken the existing default policy. When `--max-warnings` is
  **absent**, `checkDiagnosticsExitCode` must behave exactly as it does today
  (Ruff parity: any diagnostic or read failure exits 1). Existing tests in
  `tests/cli/run-check.test.ts` and `tests/cli/check-cli.test.ts` must keep
  passing unchanged.
- The exit-code contract stays `0 | 1 | 2` (`CheckCliExitCode` in
  `src/cli/check-cli.ts`). Do not introduce new exit codes.
- Warning counting must operate on the final `report.summary` produced **after**
  configured rule severities and strict-Claude promotion are applied (both are
  applied in `applyCheckConfiguration` in `src/cli/run-check.ts` before the
  report is built). Do not recompute severities in the exit-code layer.
- Production code must remain free of executable ODW runtime imports and must
  not read files or evaluate workflow source in the exit-code or argument
  layers (import-policy architecture test in
  `tests/diagnostics/import-policy.test.ts`).
- Prose, comments, and commit subjects use en-GB Oxford spelling
  ("-ize"/"-yse"/"-our") per [AGENTS.md](../../AGENTS.md) and `en-gb-oxendict`.
- Every new ExecPlan file under `docs/execplans/` must be linked from
  `docs/contents.md`, or `tests/build-gate/documentation-contents.test.ts`
  fails. This plan file is persisted first as the sole uncommitted path (the
  workflow host commits the lone plan file for durability); WI-1 is then the
  first build work item and adds the `docs/contents.md` index entry, so the
  documentation-contents gate is green before any later work item runs
  `make all`.

## Tolerances (exception triggers)

- Scope: if the implementation requires changing more than 4 production/source
  files or more than roughly 150 net lines of production code, stop and
  escalate.
- Interface: `checkDiagnosticsExitCode` gains an **optional** second parameter
  only. If any existing exported signature must change in a
  backward-incompatible way, stop and escalate.
- Dependencies: no new runtime or dev dependencies. If one seems required, stop
  and escalate.
- Iterations: if a work item's gate (`make all`) still fails after 3 focused
  fix attempts, stop and escalate.
- Ambiguity: if a reviewer disputes the budget semantics fixed in the Decision
  Log (warnings within budget stop failing the run), stop and escalate rather
  than silently changing the contract.

## Risks

- Risk: the "warnings within budget no longer fail" loosening could be read as
  contradicting the §7.4 phrase "Diagnostics remain … exit 1". Severity:
  medium. Likelihood: medium. Mitigation: the Decision Log pins the
  ESLint-style budget interpretation and cites the users-guide line
  ("`--max-warnings <n>` fails the run when warning counts exceed the
  threshold") and §7.3 ("Exit non-zero when warning count exceeds `n`"). Both
  are directional and only meaningful if the budget loosens the default, since
  warnings already fail by default. WI-4 makes the loosening explicit in the
  docs and reconciles the exit-code TABLE rows (not just adjacent prose) in all
  three guides so no source-of-truth table asserts a rule the shipped code no
  longer follows.
- Risk: info/hint diagnostics interacting unexpectedly with the budget.
  Severity: low. Likelihood: low. Mitigation: the budget governs **warnings
  only**; every non-warning diagnostic keeps failing the run. Covered by
  explicit table-driven cases in WI-2.
- Risk: argument-parser regressions (option ordering, `=` form, operand
  detection) breaking existing flags. Severity: low. Likelihood: low.
  Mitigation: mirror the existing `--output-format` / `--config` handling in
  `parseCheckOption`, and keep the full existing CLI test suite green.

## Progress

- [x] (2026-07-06T07:50Z) WI-1: Link the ExecPlan from `docs/contents.md`.
  Red: `bun test tests/build-gate/documentation-contents.test.ts` failed with
  missing `execplans/roadmap-3-3-2.md`. Green: the same focused test passed
  after adding the ordered contents entry. Refactor/gates: `make all`,
  `make markdownlint`, and `make nixie` passed under scrutineer.
- [x] (2026-07-06T07:57Z) WI-2: Add an optional warning-budget policy to
  `checkDiagnosticsExitCode`. Red: `bun test tests/cli/run-check.test.ts`
  failed on the new warning-budget table cases and the fast-check property
  (`[1,1]` shrank to the within-budget counterexample). Green: the same focused
  test passed after adding `CheckExitPolicy` and applying the optional
  `maxWarnings` branch in `src/cli/run-check.ts`. Refactor/gates: focused
  formatting on `src/cli/run-check.ts` and `tests/cli/run-check.test.ts`
  completed; scrutineer reported `make check-fmt`, `make typecheck`,
  `make lint`, `make test`, and `make all` passed.
- [x] (2026-07-06T08:14Z) WI-3: Parse and wire the `--max-warnings` flag
  through the check CLI. Red: `bun test tests/cli/check-cli.test.ts` failed on
  the new `--max-warnings` integration and usage-error cases because the flag
  was still an unknown option. Green: the focused test passed after adding
  strict non-negative integer parsing, accepting both split and equals
  spellings, and passing the parsed budget into `checkDiagnosticsExitCode`.
  Refactor/gates: parser helpers were extracted out of `src/cli/check-cli.ts`
  so the command runner stayed below the file-size limit and `parseCheckOption`
  stayed below the complexity limit; scrutineer reported `make check-fmt`,
  `make typecheck`, `make lint`, `make test`, and `make all` passed. Addendum
  3.3.2.3 later removed the orphaned duplicate parser so
  `src/cli/check-args.ts` remains the only live parser home.
- [x] (2026-07-06T08:20Z) WI-4: Document the `--max-warnings` warning-budget
  behaviour. Updated the developers guide, users guide, and technical design
  exit-code tables so the warning-budget exception is explicit, removed
  `--max-warnings` from the developers-guide deferred-flag list, and documented
  the invalid-value exit-2 behaviour. Validation: focused Markdown formatting
  ran on the touched Markdown files; scrutineer reported `make markdownlint`,
  `make nixie`, and `make all` passed at HEAD.

## Surprises & discoveries

- Observation: The repository declares Gherkin/`@aboviq/bun-test-cucumber`
  behavioural tests in [AGENTS.md](../../AGENTS.md) §Testing, but no `.feature`
  files exist and no cucumber runner is wired. Evidence:
  `find . -name '*.feature'` returns nothing; no test imports
  `bun-test-cucumber`. Impact: the externally observable "behavioural" layer
  for this change is the CLI-level integration tests in
  `tests/cli/check-cli.test.ts`, matching the established pattern for
  `--output-format`, `--config`, and Ruff-parity exit behaviour. This plan uses
  CLI integration tests plus a fast-check property test rather than introducing
  new BDD infrastructure.
- Observation: `--strict-claude` is **not** yet a parsed CLI flag; strict-Claude
  promotion is reached only through the `strictClaude` configuration key.
  Evidence: `src/cli/check-cli.ts` `parseCheckOption` handles only `--isolated`,
  `--config`, and `--output-format`. Impact: `--max-warnings` is the second
  user-facing policy flag after `--output-format`/`--config`; its parsing must
  follow the same seam. No dependency on a `--strict-claude` flag exists.
- Observation: The installed `mdtablefix` CLI uses `--in-place` rather than the
  `--write` spelling shown in the original WI-1 validation snippet. Evidence:
  `bunx mdtablefix --write docs/contents.md` exited 2 with "unexpected argument
  '--write'", while the `--in-place` invocation exited 0. Impact: WI-1
  formatting still completed against only the touched Markdown path. Future
  work items should use the installed CLI's `--in-place` spelling unless the
  project wrapper changes.
- Observation: Adding the user-facing parser cases in `src/cli/check-cli.ts`
  pushed that file over the repository's 400-line limit and raised
  `parseCheckOption` above the Oxlint complexity threshold. Evidence:
  scrutineer reported `src/cli/check-cli.ts` at 437 physical lines and
  `parseCheckOption` complexity 12 where the limit is 8. Impact: WI-3 needed a
  narrow parser-module extraction rather than keeping the new option handling
  in the existing CLI orchestration file.

## Decision log

- Decision: `--max-warnings n` implements an ESLint-style warning budget that
  **loosens** the default for warnings only. Semantics, evaluated on the final
  `report.summary` and `readFailures`:
  1. If any read failure is present, exit 1.
  2. Else if any non-warning diagnostic is present (`errors + infos + hints >
     0`), exit 1.
  3. Else if `warnings > n`, exit 1.
  4. Else exit 0.
  When `--max-warnings` is absent, the existing Ruff-parity default is
  unchanged: any diagnostic or read failure exits 1. Rationale: warnings
  already fail by default, so a flag that only *added* a failure condition
  would be a no-op and could never be observed. The recognized meaning of
  `--max-warnings` (ESLint) is a tolerance budget, and it is the only
  interpretation under which [technical-design.md](../technical-design.md) §7.3
  ("Exit non-zero when warning count exceeds `n`") and
  [users-guide.md](../users-guide.md) ("fails the run when warning counts
  exceed the threshold") describe observable behaviour. This is a product
  design decision for odw-lint, not a locked third-party API: ESLint is not a
  dependency, so the contract is pinned by the tests in WI-2 and WI-3 rather
  than by an external symbol. Date/Author: 2026-07-06, planning agent.
- Decision: `--max-warnings` value validation. The value must be a base-10
  non-negative integer. Missing value, a non-integer (`abc`, `1.5`, ``), or a
  negative value (`-1`) is a usage error that exits 2 with a stable message,
  consistent with how `--config` reports a missing value and `--output-format`
  reports an unsupported value. Rationale: keeps the flag unambiguous and
  matches the existing usage-error posture (exit 2 for invalid CLI options,
  §7.4). ESLint's `-1 = unlimited` sentinel is deliberately *not* adopted
  because absence of the flag already expresses "no budget", and admitting
  negatives would create two ways to mean the same thing. Date/Author:
  2026-07-06, planning agent.
- Decision: both `--max-warnings <n>` and `--max-warnings=<n>` spellings are
  accepted, mirroring `--output-format` which already supports both. Rationale:
  consistency across the flag surface; the split form is what CI invocations
  most often use. Date/Author: 2026-07-06, planning agent.
- Decision: the budget threshold is threaded from the CLI into
  `checkDiagnosticsExitCode` as an optional policy argument rather than through
  `CheckRequest`/`CheckOutcome`. Rationale: `--max-warnings` is a
  presentation/exit-policy concern, not a static-analysis input. `run-check.ts`
  already owns the exit-code decision, so the smallest correct change is an
  optional policy parameter on the existing decision function. `runCheck`
  itself stays unaware of the budget. Date/Author: 2026-07-06, planning agent.
- Decision: WI-1 added only the `docs/contents.md` ExecPlan entry and left all
  CLI, exit-policy, and user-guide behaviour untouched. Rationale: the work
  item exists solely to satisfy the documentation-contents durability gate
  before implementation begins. Keeping it isolated preserves the next work
  item's Red-Green-Refactor surface. Date/Author: 2026-07-06T07:50Z,
  implementation agent.
- Decision: WI-2 kept the warning-budget implementation at the pure
  `checkDiagnosticsExitCode` decision layer and did not parse or wire the CLI
  flag. Rationale: this preserves the work-item boundary. The optional
  `CheckExitPolicy` makes the next work item a straightforward parser/wiring
  change while preserving default Ruff-parity behaviour for all existing
  callers that omit the policy argument. Date/Author: 2026-07-06T07:57Z,
  implementation agent.
- Decision: WI-3 moved argument parsing out of `src/cli/check-cli.ts` while
  leaving report writing, configuration loading, and process-exit orchestration
  in `src/cli/check-cli.ts`. The maintained parser home is now
  `src/cli/check-args.ts`; addendum 3.3.2.3 deletes the unwired
  `src/cli/check-cli-args.ts` duplicate. Rationale: the extraction was the
  smallest way to satisfy the existing file-size and complexity gates after
  adding `--max-warnings`, without moving analysis, configuration, or reporting
  responsibilities. Date/Author: 2026-07-06T08:14Z, implementation agent.
- Decision: WI-4 corrected the source-of-truth documentation tables rather than
  adding only adjacent explanatory prose. Rationale: the shipped warning-budget
  behaviour changes which warning-only runs exit 0, so stale exit-code rows
  would contradict the implemented CLI contract even if nearby prose were
  accurate. Date/Author: 2026-07-06T08:20Z, implementation agent.

## Outcomes & retrospective

Roadmap task 3.3.2 is complete. The CLI now parses `--max-warnings`, applies
the warning budget at the exit-policy layer, keeps default Ruff-parity
behaviour when the flag is absent, and documents the warning-budget exception
in the developers guide, users guide, and technical design. The implementation
matches the four-case semantics in the Decision Log: read failures fail,
non-warning diagnostics fail, warnings fail only when they exceed the supplied
budget, and the no-policy call preserves the original "any diagnostic fails"
rule.

## Addenda

- [x] 3.3.2.1. Normalize valued `check` option parsing.
  - Source: review:3.3.1, review:3.3.2, and audit:3.3.2; severity medium.
  - Scope: align missing-value, equals-form, and option-like token handling
    for valued `check` options, including `--config`, `--output-format`, and
    `--max-warnings`, then route the common scaffolding through the shared
    parser table where contracts match.
  - Success: split and equals spellings produce consistent usage errors,
    option tokens are not silently consumed as values, and adding a new valued
    option does not require cloning the parser dispatch pattern.
- [x] 3.3.2.2. Add process-level warning-budget coverage.
  - Source: review:3.3.2; severity low.
  - Scope: add real-process corpus coverage for `--max-warnings` so the path
    from `main.ts` through `runCheckCli` to the warning-budget exit policy is
    pinned.
  - Success: the e2e corpus suite proves warning budgets propagate to process
    exit codes without relying only on injected-reader CLI tests.
- [x] 3.3.2.3. Remove the orphaned duplicate check parser.
  - Source: audit:2.4.4; severity high.
  - Scope: delete the unwired `src/cli/check-cli-args.ts` parser duplicate and
    update any stale references that still identify it as the live parser home.
  - Success: the live `src/cli/check-args.ts` parser remains the only
    recognized `check` argument parser, and import or inventory coverage keeps
    future parser work from landing on an unwired duplicate.
- [x] 3.3.2.4. List `--max-warnings` in check help.
  - Source: audit:2.4.4; severity medium.
  - Scope: add the shipped warning-budget flag to `check --help` and derive or
    cross-check help coverage from the recognized option set where that can be
    done without making help text unreadable.
  - Success: the help text exposes `--max-warnings`, and tests fail when a
    recognized user-facing flag has no help row.

## Context and orientation

`odw-lint` is a Bun + TypeScript project. The explicit-path `check` command is
implemented across:

- `src/cli/main.ts` — thin Bun entrypoint calling `runCheckCli`.
- `src/cli/check-cli.ts` — argument parsing (`parseCheckArgs`,
  `parseCheckToken`, `parseCheckOption`), writer wiring, config loading, and the
  `runCheckCli` orchestration that returns the process exit code.
- `src/cli/run-check.ts` — `runCheck` aggregates diagnostics across paths and
  builds the `DiagnosticReport`; `checkDiagnosticsExitCode(outcome)` derives the
  `0 | 1` status. `hasRemainingCheckFindings` is the current predicate.
- `src/diagnostics/report.ts` — `countDiagnostics` computes the per-severity
  `summary`; `createDiagnosticReport` freezes the report envelope.
- `src/diagnostics/types.ts` — `DiagnosticSummary` (`errors`, `warnings`,
  `infos`, `hints`) and `DiagnosticReport`.

Relevant tests:

- `tests/cli/run-check.test.ts` — aggregation and exit-policy unit + property
  tests (includes a fast-check property over label combinations).
- `tests/cli/check-cli.test.ts` — CLI-level integration tests using injected
  readers/writers and reviewed fixtures. Provides `cleanFixture`,
  `errorFixture`, and `warningFixture` (the warning fixture is
  `hostile-metadata/global-marker.js`, which emits a single
  `odw/meta-statically-unprovable` warning).
- `tests/build-gate/documentation-contents.test.ts` — asserts every
  `docs/execplans/*.md` is linked from `docs/contents.md`.

Design sources of truth:

- [technical-design.md](../technical-design.md) §7.3 (flag table row for
  `--max-warnings`), §7.4 (exit codes), §11.4 (combinatorial surface lists
  "Default warning policy versus `--max-warnings`").
- [users-guide.md](../users-guide.md) flag list line ("`--max-warnings <n>`
  fails the run when warning counts exceed the threshold") and exit-code table.
- [developers-guide.md](../developers-guide.md) currently lists `--max-warnings`
  among deferred flags; WI-4 corrects this.
- [roadmap.md](../roadmap.md) task 3.3.2.

## Plan of work

Four ordered, independently committable work items. WI-1 registers the plan in
the documentation index; WI-2 to WI-4 follow Red-Green-Refactor and each ends
with the `make all` gate green.

### WI-1: Link the ExecPlan from `docs/contents.md`

Implements [AGENTS.md](../../AGENTS.md) §Documentation Maintenance and the
documentation-contents build gate
(`tests/build-gate/documentation-contents.test.ts`). The plan file itself is
persisted first by the workflow host as the sole uncommitted path; this work
item is the first build step and adds the index entry so every subsequent work
item's `make all` sees a linked ExecPlan.

Docs to read:
[documentation-style-guide.md](../documentation-style-guide.md); [AGENTS.md](../../AGENTS.md)
§Documentation Maintenance; the existing `docs/contents.md` ExecPlan list for
the exact entry style and ordering. Skills to load: `en-gb-oxendict` for
spelling.

Red: run the documentation-contents gate before the edit and confirm it fails
because the committed plan file is not yet linked:

```bash
cd /data/leynos/Projects/odw-lint.worktrees/roadmap-3-3-2
bun test tests/build-gate/documentation-contents.test.ts
```

Green: add a single ExecPlan bullet to `docs/contents.md` in roadmap order,
between the `roadmap-3-3-1` and `roadmap-4-4-1` entries:

```markdown
- [Roadmap 3.3.2 ExecPlan](execplans/roadmap-3-3-2.md) plans the
  `--max-warnings` warning-budget CLI flag and exit-code policy.
```

Re-run the gate and expect it to pass.

Refactor: none beyond matching the surrounding bullet wording and wrap.

Tests added/updated (WI-1): none authored; this work item makes the existing
`tests/build-gate/documentation-contents.test.ts` gate pass. No snapshot or e2e
change.

Validation (WI-1): format only the touched Markdown file, then gate:

```bash
cd /data/leynos/Projects/odw-lint.worktrees/roadmap-3-3-2
bunx mdtablefix --write docs/contents.md
bunx markdownlint-cli2 --fix docs/contents.md
make markdownlint
make nixie
make all
```

### WI-2: Add an optional warning-budget policy to `checkDiagnosticsExitCode`

Implements [technical-design.md](../technical-design.md) §7.3 and §7.4 at the
pure decision layer, with no CLI parsing yet. This keeps the exit-policy change
isolated and fully unit-testable.

Docs to read: [technical-design.md](../technical-design.md) §§7.3–7.4;
[AGENTS.md](../../AGENTS.md) §Testing (table-driven + fast-check guidance).
Skills to load: `python-router`? No — TypeScript work: load no Python skills.
Use the repository's TypeScript guidance in [AGENTS.md](../../AGENTS.md)
§TypeScript Guidance. For the property test, follow the existing fast-check
pattern already used in `tests/cli/run-check.test.ts` (no new skill required;
`hypothesis`/`crosshair`/`mutmut` are Python-only and do not apply).

Red: in `tests/cli/run-check.test.ts`, add table-driven cases for
`checkDiagnosticsExitCode(outcome, { maxWarnings })` covering:

1. Warning-only outcome, `maxWarnings: 1` → 0 (within budget).
2. Warning-only outcome, `maxWarnings: 0` → 1 (exceeds budget).
3. Two-warning outcome, `maxWarnings: 1` → 1 (exceeds budget by one).
4. Two-warning outcome, `maxWarnings: 2` → 0 (exactly at budget).
5. Error outcome, `maxWarnings: 9` → 1 (non-warning diagnostic ignores budget).
6. Read-failure outcome, `maxWarnings: 9` → 1 (read failure ignores budget).
7. No policy argument, warning-only outcome → 1 (default unchanged).

Because `runCheck` builds real reports from fixtures, drive the multi-warning
cases by repeating the warning fixture with distinct synthetic paths using the
existing `sourceFor("warning", index)` helper (each warning fixture emits
exactly one warning, so `k` copies produce `k` warnings). Assert failure for
the intended reason before implementation by running:

```bash
cd /data/leynos/Projects/odw-lint.worktrees/roadmap-3-3-2
bun test tests/cli/run-check.test.ts
```

Expect the new cases to fail (the second parameter is ignored today).

Also extend the existing fast-check property "exits 1 exactly when diagnostics
or read failures remain" or add a sibling property: for a generated warning
count `w` (built from `w` warning-fixture copies) and a generated budget `n`,
with no errors/read failures,
`checkDiagnosticsExitCode(outcome, { maxWarnings: n })` is `1` iff `w > n`.

Green: in `src/cli/run-check.ts`, add an exported policy type and extend the
decision function:

```ts
export type CheckExitPolicy = {
  readonly maxWarnings?: number;
};

export const checkDiagnosticsExitCode = (
  outcome: CheckOutcome,
  policy: CheckExitPolicy = {},
): 0 | 1 => {
  if (outcome.readFailures.length > 0) {
    return 1;
  }

  const { errors, warnings, infos, hints } = outcome.report.summary;
  if (errors + infos + hints > 0) {
    return 1;
  }

  if (policy.maxWarnings === undefined) {
    return warnings > 0 ? 1 : 0;
  }

  return warnings > policy.maxWarnings ? 1 : 0;
};
```

Keep or fold `hasRemainingCheckFindings` as appropriate; the default branch
(`policy.maxWarnings === undefined`) must remain behaviourally identical to the
current `hasRemainingCheckFindings`-based logic. Update the function doc
comment to describe the budget branch. Re-run
`bun test tests/cli/run-check.test.ts` and expect all cases to pass.

Refactor: ensure naming and comment density match the surrounding module. Run
the full gate.

Tests added/updated (WI-2): table-driven unit cases and one fast-check property
in `tests/cli/run-check.test.ts`. No snapshot or e2e change.

Validation (WI-2): `make all`.

### WI-3: Parse and wire the `--max-warnings` flag through the check CLI

Implements the user-facing flag from
[technical-design.md](../technical-design.md) §7.3, wiring the parsed budget
into `runCheckCli`.

Docs to read: [technical-design.md](../technical-design.md) §7.3 and §7.4;
existing `parseCheckOption` handling of `--config` (required value) and
`--output-format` (space and `=` forms) in `src/cli/check-cli.ts`. Skills to
load: [AGENTS.md](../../AGENTS.md) §TypeScript Guidance (exact optional
property types, discriminated results). No Python verification skills apply.

Red: in `tests/cli/check-cli.test.ts`, add CLI-level cases using the injected
reader/writer harness (`runCapturedCheckCli`) and the existing `warningFixture`,
`errorFixture`, and `cleanFixture` helpers:

1. `["check", "--max-warnings", "1", warning.filePath]` → exit 0, warning text
   still printed on stdout (diagnostics are reported even when tolerated),
   empty stderr.
2. `["check", "--max-warnings", "0", warning.filePath]` → exit 1.
3. `["check", "--max-warnings=1", warning.filePath]` → exit 0 (split form).
4. `["check", "--max-warnings", "5", error.filePath]` → exit 1 (error ignores
   budget).
5. `["check", "--max-warnings", "1", clean.filePath]` → exit 0 (unchanged clean
   path).
6. Usage-error table additions (exit 2, exact stderr): `--max-warnings` with no
   value → `missing value for --max-warnings`; `--max-warnings abc` →
   `invalid value for --max-warnings: abc`; `--max-warnings -1` →
   `invalid value for --max-warnings: -1`; `--max-warnings 1.5` →
   `invalid value for --max-warnings: 1.5`.

Decide the two stable usage-error strings (`missing value for --max-warnings`
and `invalid value for --max-warnings: <value>`) and assert them exactly, in
the style of the existing `missing value for --config` and
`unsupported output format: <value>` messages. Run:

```bash
cd /data/leynos/Projects/odw-lint.worktrees/roadmap-3-3-2
bun test tests/cli/check-cli.test.ts
```

Expect the new cases to fail (the flag is currently an "unknown option").

Green: in `src/cli/check-cli.ts`:

1. Add `maxWarnings?: number` to `ParsedCheckArgState` and to the successful
   `ParsedCheckArgs` shape, preserving exact-optional-property discipline in
   `parsedCheckArgsFromState` (only attach the key when defined, matching the
   `configPath` pattern).
2. In `parseCheckOption`, handle `--max-warnings <value>` and
   `--max-warnings=<value>`. Parse the value with a small helper
   `parseMaxWarningsValue(value: string | undefined)` that returns a
   discriminated result: success carries a non-negative integer; failure
   carries the `missing value`/`invalid value` usage error. Accept only
   `/^\d+$/` (base-10, non-negative) via `Number.parseInt` cross-checked with a
   strict integer test, so `1.5`, `abc`, `-1`, and `` are rejected.
3. In `runCheckCli`, build the policy and pass it as the second argument to
   `checkDiagnosticsExitCode`. Attach `maxWarnings` only when
   `parsedArgs.maxWarnings` is defined (an empty policy `{}` otherwise), so the
   default branch stays exact. Import `CheckExitPolicy` if a typed local is
   preferred.

Re-run `bun test tests/cli/check-cli.test.ts` and expect all cases to pass.
Confirm the pre-existing "returns 1 for warning-only diagnostics under Ruff
parity" test (no `--max-warnings`) still passes unchanged.

Refactor: keep `parseMaxWarningsValue` alongside `parseOutputFormatValue` for
symmetry; match comment density. Run the full gate.

Tests added/updated (WI-3): CLI integration cases and usage-error table rows in
`tests/cli/check-cli.test.ts`. No snapshot or e2e change; the existing
`tests/cli/check-cli-corpus.e2e.test.ts` is not modified.

Validation (WI-3): `make all`.

### WI-4: Document the `--max-warnings` warning-budget behaviour

Aligns the guides with the shipped behaviour per [AGENTS.md](../../AGENTS.md)
§Documentation Maintenance.

Because `docs/` is the source of truth and WI-2/WI-3 deliberately **loosen** a
contract that these guides' exit-code TABLES encode, this work item must
reconcile the table rows themselves, not merely the surrounding prose. Leaving
a table row that asserts a rule the shipped code no longer follows is a
design-conformance defect. The three tables to correct are:
[developers-guide.md](../developers-guide.md) exit-code table (rows for code 0
and code 1), [users-guide.md](../users-guide.md) `## Exit codes` table (code-0
row), and [technical-design.md](../technical-design.md) §7.4 exit-code table
(code-0 row). All three edits are **mandatory**; none is optional.

Docs to read: [developers-guide.md](../developers-guide.md) lines around the
deferred-flag paragraph (line 54) and the exit-code table (lines 46–50);
[users-guide.md](../users-guide.md) flag list and `## Exit codes` table (lines
68–74); [technical-design.md](../technical-design.md) §7.3 flag table (the
`--max-warnings <n>` row) and §7.4 exit-code table (lines 312–322);
[documentation-style-guide.md](../documentation-style-guide.md);
`en-gb-oxendict` skill for spelling.

Changes (all mandatory):

1. `docs/developers-guide.md`:
   1a. Remove `--max-warnings` from the deferred-flag sentence at line 54 (keep
       `--exit-zero` and, if still accurate, `--strict-claude`) and add a short
       paragraph stating that `--max-warnings <n>` tolerates up to `n`
       warning-severity diagnostics — warnings within budget no longer fail the
       run, while errors, infos, hints, and read failures still do, and a count
       above `n` exits 1. Note that an invalid value exits 2.
   1b. Correct the exit-code TABLE (lines 46–50). The current code-0 row —
       "The command completed and no diagnostics remain." — is now incomplete,
       and the current code-1 row — "Any diagnostic remains, regardless of
       severity, or at least one input file could not be read." — is now
       factually FALSE (a warning within budget yields exit 0). Replace them so
       the table reflects the budget exception:
       - Code 0 cell → "The command completed and no diagnostics remain, or only
         warning-severity diagnostics within the `--max-warnings` budget remain."
       - Code 1 cell → "Any error, informational, or hint diagnostic remains;
         warnings exceed the `--max-warnings` budget (any warning by default); or
         at least one input file could not be read."
       Keep the code-2 row unchanged. After editing, the two prose descriptions
       and the table must agree.
2. `docs/users-guide.md`:
   2a. The flag-list line (line 57) is already accurate; add a clause making the
       loosening explicit ("warnings within the budget no longer fail the run").
   2b. Correct the `## Exit codes` code-0 row (line 72). The current text — "No
       diagnostics remain, or all diagnostics were fixed automatically." — is now
       incomplete because warnings within budget also produce exit 0. Replace the
       code-0 cell with: "No diagnostics remain, only warnings within the
       `--max-warnings` budget remain, or all diagnostics were fixed
       automatically." The code-1 row already reads "warning thresholds were
       exceeded" and needs no change; the code-2 row is unchanged.
3. `docs/technical-design.md` (**non-optional**):
   3a. Correct the §7.4 exit-code table code-0 row (line 316). The current text
       — "No diagnostics remain, or all diagnostics were fixed automatically." —
       is now incomplete. Replace the code-0 cell with: "No diagnostics remain,
       only warnings within the `--max-warnings` budget remain, or all
       diagnostics were fixed automatically." The §7.4 code-1 row already reads
       "warning threshold was exceeded" and needs no change; the code-2 row
       is unchanged.
   3b. Add one clarifying sentence near the §7.4 note (after the `--exit-zero` /
       `--fix-only` paragraph) stating that `--max-warnings n` tolerates up to
       `n` warnings and only fails when the count strictly exceeds `n`. The §7.3
       `--max-warnings <n>` row already states the rule and needs no change.

There is no Mermaid change, but Markdown files are edited, so run the Markdown
gates. This work item does not add or remove any `docs/execplans/*.md` file, so
`docs/contents.md` needs no change here (the plan's index entry was added in
WI-1).

Tests added/updated (WI-4): none required;
`tests/build-gate/documentation- contents.test.ts` continues to pass because no
ExecPlan/issue file is added or removed in this work item. If any doc-contents
assertion regresses, treat it as a red signal and reconcile `docs/contents.md`.

Validation (WI-4): all three Markdown files are edited by this work item (the
technical-design §7.4 edit is now mandatory), so every path below definitely
exists. Format only the touched Markdown files, then gate:

```bash
cd /data/leynos/Projects/odw-lint.worktrees/roadmap-3-3-2
bunx mdtablefix --write docs/developers-guide.md docs/users-guide.md docs/technical-design.md
bunx markdownlint-cli2 --fix docs/developers-guide.md docs/users-guide.md docs/technical-design.md
make markdownlint
make nixie
make all
```

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-3-3-2`.

Per work item:

1. Write the red test(s); run the focused `bun test <file>` and confirm the
   expected failure.
2. Make the minimal production change; re-run the focused test to green.
3. Refactor; run `make all`.
4. Commit with an en-GB imperative subject (for example,
   `Add warning-budget exit policy to check command`).

Focused commands:

```bash
bun test tests/build-gate/documentation-contents.test.ts  # WI-1
bun test tests/cli/run-check.test.ts     # WI-2
bun test tests/cli/check-cli.test.ts     # WI-3
make markdownlint                        # WI-1 and WI-4 (plus make nixie)
make all                                 # every work item
```

## Validation and acceptance

Commit gate for every work item: `make all`
(`build check-fmt whitespace-hygiene lint typecheck test`).
[AGENTS.md](../../AGENTS.md) is authoritative; `make all` aggregates
`check-fmt`, `lint`, `typecheck`, and `test`. For Markdown-touching WI-1 and
WI-4 also run `make markdownlint` and `make nixie`. The workflow host re-runs
the configured gates against committed HEAD, so do not report gates green unless
`make all` (and the Markdown gates for WI-1 and WI-4) passed at HEAD.

Acceptance, phrased as observable behaviour:

- With a single-warning workflow: `check --max-warnings 1 <file>` exits 0 and
  still prints the warning; `check --max-warnings 0 <file>` exits 1;
  `check <file>` (no flag) exits 1 (unchanged Ruff parity).
- With an error-bearing workflow: `check --max-warnings 9 <file>` exits 1.
- Invalid usage: `check --max-warnings` (no value), `check --max-warnings abc`,
  `check --max-warnings -1`, and `check --max-warnings 1.5` each exit 2 with
  the stable usage message on stderr.
- `checkDiagnosticsExitCode(outcome, { maxWarnings: n })` returns 1 iff a read
  failure is present, a non-warning diagnostic is present, or `warnings > n`;
  otherwise 0. The no-policy call is behaviourally identical to today.

Red-Green-Refactor evidence to record in Progress as work proceeds:

- Red: `bun test tests/build-gate/documentation-contents.test.ts` (WI-1) fails
  while the committed plan file is unlinked;
  `bun test tests/cli/run-check.test.ts` (WI-2) /
  `bun test tests/cli/check-cli.test.ts` (WI-3) fail on the new cases before
  the production edit, for the intended reason (ignored policy / unknown
  option).
- Green: the same focused command passes after the minimal edit.
- Refactor: `make all` passes after cleanup.

Quality criteria ("done"):

- Tests: new unit, property, and CLI integration cases pass; no existing test
  regresses.
- Lint/typecheck: `make lint` and `make typecheck` clean (via `make all`).
- Formatting: `make check-fmt` clean; touched Markdown passes
  `make markdownlint` and `make nixie`.

## Idempotence and recovery

Every step is re-runnable. Tests and gates are read-only aside from the source
and doc edits they validate. If a gate fails mid-work-item, fix forward and
re-run `make all`; no destructive or irreversible operation is involved. Do not
`git stash` without a named message per the run's stash-naming rule.

## Interfaces and dependencies

No new dependencies. Final signatures at completion:

In `src/cli/run-check.ts`:

```ts
export type CheckExitPolicy = {
  readonly maxWarnings?: number;
};

export const checkDiagnosticsExitCode: (
  outcome: CheckOutcome,
  policy?: CheckExitPolicy,
) => 0 | 1;
```

In `src/cli/check-cli.ts`, the parsed-argument state and successful result gain
an optional `maxWarnings?: number`, and `runCheckCli` passes a
`CheckExitPolicy` into `checkDiagnosticsExitCode`. The public
`runCheckCli(args, io)` signature and the `CheckCliExitCode` (`0 | 1 | 2`)
contract are unchanged.

## Revision note

Initial draft (2026-07-06). Establishes the ESLint-style warning-budget
semantics, three ordered work items (decision layer, CLI wiring, docs), and the
test matrix. No implementation performed. Status: DRAFT pending design review.

Round-2 revision (2026-07-06). Resolves the design reviewer's durability
blocking point. The reviewer reported that the workflow host's plan-file
salvage declined because the worktree held a second uncommitted path
(`M docs/contents.md`) alongside the untracked plan. To let the host persist
the plan as the sole uncommitted path, the `docs/contents.md` index entry was
reverted here and promoted to a dedicated first build work item (WI-1); the
former WI-1 to WI-3 shifted to WI-2 to WI-4. This keeps the documentation
index-link a gate-backed, independently committable step
(`tests/build-gate/documentation-contents.test.ts`) that runs before any later
work item's `make all`, while leaving the plan file as the only uncommitted
path for durable persistence. No implementation performed. Status: DRAFT
pending design review.

Round-3 revision (2026-07-06). Resolves the design reviewer's remaining
blocking point: WI-4 previously reconciled only prose and left the
authoritative exit-code TABLES stale, so after implementation the
source-of-truth guides would state exit rules the loosened code no longer
follows. WI-4 now mandates correcting the table rows themselves — the
developers-guide code-0 and code-1 rows (the code-1 row "Any diagnostic
remains, regardless of severity …" becomes factually false once a warning
within budget yields exit 0), the users-guide code-0 row, and the
technical-design §7.4 code-0 row — with the exact replacement cell text pinned
inline. The technical-design §7.4 edit is promoted from optional to mandatory,
so its formatter path is unconditional and every listed path definitely exists.
No implementation performed. Status: DRAFT pending design review.

WI-1 implementation revision (2026-07-06). Sets Status to IN PROGRESS, records
the completed `docs/contents.md` index-link work item, and captures red/green
and scrutineer gate evidence. This changes no remaining work scope: WI-2 still
begins the warning-budget decision-layer implementation.

WI-4 implementation revision (2026-07-06). Records completion of the
documentation work item, reconciles the guide and technical-design exit-code
tables with the shipped warning-budget contract, completes the retrospective,
and sets Status to COMPLETE. No remaining work items are open.
