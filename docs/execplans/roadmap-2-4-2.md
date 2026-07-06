# Add human text output for the `check` command (roadmap 2.4.2)

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

After this change, a developer who runs `odw-lint check` over a workflow file
that has problems can read the terminal output and fix the workflow **without
opening JSON**. Every diagnostic is printed on its own line with the file path,
line, column, severity, rule identifier, and message, and the report ends with
a one-line summary of how many findings there were, broken down by severity.

Observable behaviour after this change:

```bash
invalid=tests/static-analysis/fixtures/invalid-workflows/missing-metadata/missing-meta.js
bun run src/cli/main.ts check "$invalid"; echo "exit=$?"
```

expected transcript (the exact rule, position, and message come from the
reviewed fixture manifest; the trailing summary line is new in this task):

```plaintext
.../missing-metadata/missing-meta.js:1:1 error odw/meta-required Workflow source must export literal metadata.

Found 1 error.
exit=1
```

A clean workflow stays silent and exits `0`, exactly as it does today:

```bash
bun run src/cli/main.ts check tests/static-analysis/fixtures/odw-examples/fan-out-reduce.js; echo "exit=$?"
# (no output)
# exit=0
```

This is the second task of roadmap step 2.4 ("Ship the minimal `check`
command"). Task 2.4.1 shipped the explicit-path command spine and reused the
pre-existing one-line-per-diagnostic formatter (`src/diagnostics/text.ts`
`formatTextDiagnostics`) as a stopgap for observability, explicitly deferring
the *designed* default text-output contract — the summary and grouped
presentation — to this task (see
[`docs/execplans/roadmap-2-4-1.md`](roadmap-2-4-1.md) "Surprises & discoveries"
and its scope-out note). This task therefore delivers the default human report:
the six required per-diagnostic fields (already present) plus a severity-count
summary footer, and wires the `check` command to emit it. It deliberately does
**not** add colour, source-snippet/caret rendering, `--output-format`
selection, or JSON output; those remain roadmap 2.4.3 and 2.4.4 and are called
out explicitly below so this slice does not pre-empt them.

## Constraints

Hard invariants that must hold throughout implementation.

- Work happens only in the worktree at
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-4-2` on branch
  `roadmap-2-4-2`. Never edit the root/control checkout.
- Production code must not execute workflow source or import ODW runtime
  helpers. The static-analysis boundary is a security boundary
  (`docs/technical-design.md` §§5, 6.4; `docs/adr/0001-static-analysis-boundary.md`;
  `docs/developers-guide.md` §"static-analysis boundary"). Text formatting
  operates only on already-produced `Diagnostic`/`DiagnosticReport` values; it
  reads no files and evaluates no source.
- Text output must be derived from the same diagnostic objects as JSON output
  (`docs/technical-design.md` §8 final invariant; §8 diagnostic contract). The
  summary counts must come from the report's `summary`
  (`src/diagnostics/report.ts` `countDiagnostics`), not from a second,
  independently computed tally, so text and JSON can never disagree.
- Do not change the emitted per-diagnostic line contract established by 2.4.1
  and pinned by `tests/diagnostics/text.test.ts`: one diagnostic per line,
  `file:line:column severity rule message`, with control-whitespace
  normalization applied to `file` and `message` only. `formatTextDiagnostics`
  keeps its current signature and output; new behaviour is additive.
- Do not add a new catalogued rule ID, change the diagnostic schema, or change
  the `Diagnostic`/`DiagnosticReport` shape. Adding a rule or field expands the
  schema enum and requires catalogue, schema, docs, and parity updates
  (`docs/technical-design.md` §§8, 9); that is out of scope here.
- Do not widen the package entry (`src/index.ts`) export surface. The public
  API is pinned by `tests/diagnostics/public-api-surface.test.ts`,
  `tests/diagnostics/public-api-fixtures.ts`, and the removal guard from
  roadmap 1.5.3. The `check` CLI already imports `src/diagnostics/text`
  directly (`src/cli/check-cli.ts` line 7), so the new formatter does **not**
  need re-exporting through `odw-lint` (see Decision Log).
- Do not change the exit-code policy shipped by 2.4.1 (Ruff parity: exit `1`
  when any diagnostic remains regardless of severity, or an input is
  unreadable; exit `0` only when zero diagnostics remain; `2` for usage or
  internal failure). This task changes *what is printed*, not *what code is
  returned*.
- A clean run must stay silent on both stdout and stderr, preserving the 2.4.1
  CLI and e2e assertions (`tests/cli/check-cli.test.ts` "returns 0 without
  output for a clean workflow"; `tests/cli/check-cli-corpus.e2e.test.ts`). No
  "All checks passed" affirmation is added in this task (see Decision Log).
- No single code file exceeds 400 lines (`AGENTS.md` §"Code Style and
  Structure"). `src/diagnostics/text.ts` is currently 57 lines and stays well
  under the limit.
- en-GB Oxford spelling ("-ize"/"-yse"/"-our") in all prose, comments, and
  commit messages (`AGENTS.md`; `en-gb-oxendict` skill).

## Tolerances (exception triggers)

- Scope: if delivering the summary footer and CLI wiring requires touching more
  than ~8 files or adding more than ~250 net lines of production code, stop and
  escalate.
- Interface: if the task appears to require a new package-level export, a new
  `Diagnostic`/`DiagnosticReport` field, a new catalogued rule ID, a
  diagnostic-schema change, or a `bin` field, stop and escalate — those belong
  to later 2.4.x/3.x tasks or were explicitly excluded by 2.4.1.
- Dependencies: if a work item seems to need a new runtime or dev dependency
  (for example a colour library, a table-formatting library, or a BDD runner),
  stop and escalate. The repo has no BDD infrastructure and no `.feature`
  files; behaviour is proven with `bun test` and spawn-based e2e tests.
- Scope creep: if a work item starts rendering source snippets or carets,
  colourizing output, adding `--output-format`/`--color`/`--output-file`
  handling, or building JSON output, stop — those are 2.4.3/2.4.4.
- Iterations: if `make all` still fails after 3 focused attempts on one work
  item, stop and escalate with the failing gate output.
- Ambiguity: if the reviewed summary-line wording (see Decision Log) is
  rejected such that its *structure* (not just wording) must change, stop and
  present options rather than guessing.

## Risks

- Risk: over-building the text format into Ruff's full source-context format
  (a `-->` locator block with a rendered source line and caret). The
  `Diagnostic` object carries no source snippet
  (`src/diagnostics/types.ts` lines 52-67, only `span` offsets/positions), so
  snippet rendering would require threading source text into the formatter and
  reusing span→snippet mapping — a materially larger, separable concern.
  Severity: medium. Likelihood: medium.
  Mitigation: pin scope to the per-diagnostic line (already meeting the six
  required fields) plus a severity-count summary footer. Record the
  snippet/caret deferral in the Decision Log and cite it against the minimal
  success criterion ("enough location information to fix a fixture without
  opening JSON"), which the file:line:column line already satisfies.
- Risk: breaking the clean-run silence contract by emitting a summary or
  affirmation on a zero-diagnostic run, which would fail the 2.4.1 CLI/e2e
  tests.
  Severity: medium. Likelihood: low.
  Mitigation: `formatTextReport` returns the empty string for an empty
  diagnostics list; the CLI's existing `writeTextDiagnostics` already suppresses
  empty output. A dedicated red test pins "empty report → empty string" before
  the CLI is rewired.
- Risk: the summary footer and per-diagnostic tally diverge from the JSON
  `summary` counts.
  Severity: medium. Likelihood: low.
  Mitigation: derive the footer solely from `report.summary`
  (`errors`/`warnings`/`infos`/`hints`), never from a re-count. A test asserts
  the footer numbers equal `countDiagnostics` for the same diagnostics.
- Risk: widening the public API surface by exporting the new formatter and
  tripping the removal/parity guard, or churning the pinned fixtures.
  Severity: low. Likelihood: medium.
  Mitigation: do not re-export `formatTextReport` from `src/index.ts`; the CLI
  and tests import it from `src/diagnostics/text` directly, exactly as
  `src/cli/check-cli.ts` already imports `formatTextDiagnostics` from that
  module. This leaves `public-api-fixtures.ts` and the module inventory
  unchanged.
- Risk: the diagnostics module inventory guard
  (`tests/diagnostics/architecture.test.ts`) fails because a file changed.
  Severity: low. Likelihood: low.
  Mitigation: the change adds a function to the existing `src/diagnostics/text.ts`
  module; it adds no new module and removes none, so the inventory is unchanged.

## Progress

- [x] (2026-07-06T04:47:55Z) WI-1: Registered this ExecPlan in the
  documentation contents index. Added the `docs/contents.md` entry in roadmap
  order between 2.4.1 and 3.1.1. Validation evidence: `bun test
  tests/build-gate/documentation-contents.test.ts`, `bunx mdtablefix
  docs/contents.md docs/execplans/roadmap-2-4-2.md`, `bunx
  markdownlint-cli2 --fix docs/contents.md
  docs/execplans/roadmap-2-4-2.md`, `make all`, `make markdownlint`, and
  `make nixie` passed before commit.
- [x] (2026-07-06T04:57:00Z) WI-2: Add the default text report formatter
  with a severity summary. Added `formatTextReport(report)` in
  `src/diagnostics/text.ts`, preserving the existing `formatTextDiagnostics`
  line contract while appending a `Found …` footer from `report.summary` for
  non-empty reports and returning `""` for empty reports. Added focused tests
  in `tests/diagnostics/text.test.ts` for empty reports, single-error output,
  mixed severity wording, summary/count consistency, a `fast-check` severity
  multiset property, and a reviewer-useful snapshot in
  `tests/diagnostics/__snapshots__/text.test.ts.snap`. Red evidence: `bun test
  tests/diagnostics/text.test.ts` failed with `SyntaxError: Export named
  'formatTextReport' not found`. Green/refactor evidence: `bun test
  tests/diagnostics/text.test.ts`, `bunx biome ci src/diagnostics/text.ts
  tests/diagnostics/text.test.ts`, `bunx oxlint src/diagnostics/text.ts
  tests/diagnostics/text.test.ts`, and `bunx tsc --noEmit` passed after the
  implementation. Deterministic gate evidence: `scrutineer` ran `make all` in
  this worktree and reported exit 0 with `1276 pass, 0 fail`; CodeRabbit was not
  run.
- [x] (2026-07-06T05:03:13Z) WI-3: Emit the text report from the
  `check` CLI. Rewired `src/cli/check-cli.ts` to call
  `formatTextReport(outcome.report)` through the existing text writer, leaving
  read-failure stderr handling and exit-code policy unchanged. Added CLI tests
  that assert the error fixture now prints `Found 1 error.` and the
  warning-only hostile-metadata fixture prints `Found 1 warning.` while clean
  runs remain exactly silent. Red evidence: `bun test
  tests/cli/check-cli.test.ts` failed because stdout contained only the
  per-diagnostic line and not the `Found …` footer. Green/refactor evidence:
  `bun test tests/cli/check-cli.test.ts`, `bun test
  tests/cli/check-cli-corpus.e2e.test.ts`, `bunx biome check
  --formatter-enabled=true --linter-enabled=false src/cli/check-cli.ts
  tests/cli/check-cli.test.ts`, `bunx oxlint src/cli/check-cli.ts
  tests/cli/check-cli.test.ts`, and `bunx tsc --noEmit` passed after the CLI
  wiring change. Deterministic gate evidence: `scrutineer` ran `make all`,
  `make check-fmt`, `make typecheck`, `make lint`, and `make test` in this
  worktree and reported exit 0 for every command; CodeRabbit was not run.
- [x] (2026-07-06T05:08:01Z) WI-4: Document the shipped text-output
  contract. Updated `docs/developers-guide.md` to describe the default
  `file:line:column severity rule message` text lines, blank-line-separated
  `Found …` severity summary, clean-run silence, stderr read failures, and the
  deferred colour/source-snippet/output-format/JSON work. Updated
  `docs/users-guide.md` to replace the stale "CLI is not implemented yet"
  wording with the shipped Bun explicit-path entrypoint and to document that
  the default text report is derived from the same diagnostics and summary
  counts as JSON. Validation evidence: `bunx mdtablefix
  docs/developers-guide.md docs/users-guide.md
  docs/execplans/roadmap-2-4-2.md`, `bunx markdownlint-cli2 --fix
  docs/developers-guide.md docs/users-guide.md
  docs/execplans/roadmap-2-4-2.md`, `make all`, `make check-fmt`, `make
  typecheck`, `make lint`, `make test`, `make markdownlint`, and `make nixie`
  passed before commit; CodeRabbit was not run.

## Surprises & discoveries

- Observation: the six per-diagnostic fields required by the roadmap title
  (file, line, column, severity, rule, message) are already emitted by
  `formatTextDiagnostics` and were wired into the CLI by task 2.4.1.
  Evidence: `src/diagnostics/text.ts` line 53 formats
  `${file}:${line}:${column} ${severity} ${rule} ${message}`;
  `src/cli/check-cli.ts` line 123 calls it. 2.4.1's ExecPlan records this and
  scopes the *designed* contract (summary/grouping) to 2.4.2.
  Impact: the load-bearing new work in this task is the summary footer plus its
  CLI wiring and documentation, not re-deriving the location line.
- Observation: `mcp__firecrawl__firecrawl_search` is not granted in this agent
  session, so Ruff's exact default-format summary wording could not be scraped
  first-hand.
  Evidence: the `firecrawl_search` call returned "Claude requested permissions
  to use mcp__firecrawl__firecrawl_search, but you haven't granted it yet."
  Impact: Ruff is a UX *reference*, not a locked library dependency of this
  repo; the summary line is pure local string formatting over this project's
  own `DiagnosticReport`. The wording is pinned as a reviewed Decision Log
  choice and frozen by a snapshot test, so the missing scrape does not block the
  plan. If a reviewer wants byte-exact Ruff wording later, the snapshot makes
  the change a one-line, test-guarded edit.
- Observation: in this planning session every `git` invocation (`add`,
  `commit`, `status`, and even `git --version`) is refused by the harness
  permission policy, even read-only and with the sandbox disabled, matching the
  2.4.1 planning agent's recorded experience.
  Evidence: `git -C … add`, `git … commit`, `git … status --porcelain`, and
  `git --version` all returned "This command requires approval".
  Impact: the planning agent cannot self-commit; the workflow host must
  salvage-commit this ExecPlan. Host salvage commits **only** the plan file and
  declines when any other path is dirty.
- Observation (round 2): the `make all` test gate enforces that every
  `docs/execplans/*.md` file is listed in `docs/contents.md`.
  Evidence: `tests/build-gate/documentation-contents.test.ts` "lists every
  current top-level ExecPlan and issue audit" reads `docs/contents.md` links and
  fails if any `execplans/*.md` file is unlisted (lines 55-92). This test runs
  under `make test`, hence under `make all` (`Makefile` line 5).
  Impact: registering this plan in `docs/contents.md` is real, gate-affecting
  build work, not a free-with-the-commit index tweak. Round 1 left the
  `docs/contents.md` index entry dirty alongside the plan file, so host salvage
  declined (it commits the plan alone and refuses on extra dirty paths). Round 2
  reverts the working-tree `docs/contents.md` change so the plan file is the
  ONLY dirty path — letting host salvage commit the plan — and promotes the
  index registration to WI-1, an atomic doc-only commit that turns the
  documentation-contents gate green before any later work item runs `make all`.
  The plan file is committed first (make all is transiently red only between the
  salvage commit and WI-1); WI-1 is the first gated build commit and it is
  green.
- Observation (WI-1): GrepAI search located `docs/contents.md` and
  `docs/documentation-style-guide.md` as the relevant indexed surfaces for
  documentation registration. Leta initially reported that no workspace existed
  for this git-donkey worktree, then `leta workspace add
  /data/leynos/Projects/odw-lint.worktrees/roadmap-2-4-2` succeeded and
  `leta files docs/` confirmed the branch-local `roadmap-2-4-2.md` plan was
  present.
  Evidence: `grepai search --workspace 'Projects' --project 'odw-lint'
  "documentation contents index ExecPlan registration" --toon --compact
  --limit 8` returned `Projects/odw-lint/docs/contents.md` as the top result.
  The first `leta files docs/` run failed with `Error: No workspace found for
  /data/leynos/Projects/odw-lint.worktrees/roadmap-2-4-2/docs`; after adding
  the worktree, `leta files docs/` listed `docs/contents.md` and
  `docs/execplans/roadmap-2-4-2.md`.
  Impact: the documentation-index edit proceeded with canonical-main intent
  search plus branch-local file verification, matching the workflow's search
  contract.
- Observation (WI-2): GrepAI search located the existing diagnostic text,
  severity, and report modules on canonical `main`; branch-local Leta then
  confirmed the implementation surfaces in this worktree.
  Evidence: `grepai search --workspace 'Projects' --project 'odw-lint' "text
  diagnostic report formatter severity summary" --toon --compact --limit 8`
  returned `src/diagnostics/text.ts`, `src/diagnostics/severity.ts`, and
  `src/diagnostics/report.ts`; `leta show src/diagnostics/text.ts:
  formatTextDiagnostics` and `leta show src/diagnostics/report.ts:
  countDiagnostics` confirmed the local formatter and summary source.
  Impact: the change stayed inside the existing diagnostics module and did not
  widen the package entry export surface.
- Observation (WI-2): the focused red test failed at module load before any
  assertions ran, which is the expected first failure for a missing direct
  module export.
  Evidence: `bun test tests/diagnostics/text.test.ts` reported `SyntaxError:
  Export named 'formatTextReport' not found in module
  'src/diagnostics/text.ts'`.
  Impact: the red state proved the new report formatter API was absent without
  disturbing existing per-diagnostic formatter behaviour.
- Observation (WI-3): the existing CLI writer seam already handled the report
  formatter's empty-string and trailing-newline contracts.
  Evidence: after changing only the formatter call, the clean-run test in
  `tests/cli/check-cli.test.ts` still asserted `{ exitCode: 0, stdout: "",
  stderr: "" }`, and the focused suite passed.
  Impact: WI-3 did not need changes to `run-check.ts`, `main.ts`, or
  read-failure reporting.
- Observation (WI-4): branch-local Leta resolved the diagnostics formatter
  symbols but failed on `src/cli/check-cli.ts:runCheckCli` and
  `src/diagnostics/report.ts:countDiagnostics` with `EOF while parsing a value
  at line 1 column 0`.
  Evidence: `leta show src/diagnostics/text.ts:formatTextReport` and
  `leta show src/diagnostics/text.ts:formatTextDiagnostics` succeeded, while
  the two later `leta show` commands returned that parse error. Narrow
  branch-local `sed` inspection of the exact files confirmed the shipped CLI
  and report-summary contracts.
  Impact: the WI-4 documentation still used GrepAI for canonical-main intent
  search and Leta where available, with a bounded file-inspection fallback for
  the transient Leta failures allowed by the workflow instructions.

## Decision log

- Decision: 2.4.2 delivers the per-diagnostic location line (already shipped)
  plus a severity-count summary footer, and defers source-snippet/caret
  rendering, colour, `--output-format`, `--output-file`, and JSON to
  2.4.3/2.4.4.
  Rationale: the roadmap success criterion is "human output contains enough
  location information to fix a fixture without opening JSON"
  (`docs/roadmap.md` task 2.4.2), which the `file:line:column severity rule
  message` line already satisfies. The `Diagnostic` shape carries no source
  snippet (`src/diagnostics/types.ts`), so a Ruff-style source-context block is
  a separable, larger concern that also overlaps the `--output-format full`
  vs `concise` selection work in 2.4.4 (`docs/technical-design.md` §7.3). 2.4.1
  explicitly named the summary as the deferred-to-2.4.2 piece.
  Date/Author: 2026-07-06, planning agent.
- Decision: the summary footer is rendered only when at least one diagnostic is
  present; a clean run prints nothing and exits `0`. No "All checks passed"
  affirmation is added.
  Rationale: preserves the 2.4.1 clean-run silence contract asserted by
  `tests/cli/check-cli.test.ts` and `tests/cli/check-cli-corpus.e2e.test.ts`
  without churning those tests. A success affirmation is a `--verbose`/output-
  format concern for 2.4.4, where Ruff prints it. Recorded as a deliberate,
  scoped divergence from Ruff's default success line.
  Date/Author: 2026-07-06, planning agent.
- Decision: the summary line format is `Found <n> <sev>[, <n> <sev>]….`,
  listing only the non-zero severity categories in the fixed order error,
  warning, info, hint, each count pluralized as `error`/`errors`,
  `warning`/`warnings`, `info`/`infos`, `hint`/`hints`. Examples:
  `Found 1 error.`, `Found 2 errors, 1 warning.`, `Found 3 warnings.`.
  Rationale: mirrors Ruff's "Found N errors." shape (`docs/technical-design.md`
  §7.0 names `ruff check` the UX gold standard) while using this project's own
  severity vocabulary and `DiagnosticSummary` field names
  (`infos`/`hints`, `src/diagnostics/types.ts` lines 72-83). The exact wording
  is frozen by a snapshot test so any future change is reviewed and
  test-guarded.
  Date/Author: 2026-07-06, planning agent.
- Decision: add `formatTextReport(report: DiagnosticReport): string` to
  `src/diagnostics/text.ts` and consume it from the CLI by direct module
  import; do **not** re-export it from `src/index.ts`.
  Rationale: the CLI already imports `formatTextDiagnostics` from
  `../diagnostics/text` directly (`src/cli/check-cli.ts` line 7), so no
  package-entry export is required. Not exporting it keeps the pinned public API
  surface (`tests/diagnostics/public-api-fixtures.ts`, removal guard from
  roadmap 1.5.3) unchanged and keeps the task atomic. If a public consumer or
  editor integration later needs it, exporting is a separate, intentional
  fixture-guarded change.
  Date/Author: 2026-07-06, planning agent.
- Decision: the summary footer counts only catalogued diagnostics; CLI read
  failures continue to be reported as `error: cannot read …` lines on stderr
  and are not included in the summary tally.
  Rationale: read failures are not modelled as `Diagnostic` objects (2.4.1
  Decision Log; no IO-error rule exists), so they are outside the diagnostic
  summary that text and JSON share. Their stderr representation and exit-`1`
  effect are unchanged.
  Date/Author: 2026-07-06, planning agent.
- Decision: registering this ExecPlan in `docs/contents.md` is its own first
  work item (WI-1), not a change folded into the plan's own commit.
  Rationale: `git` is refused throughout this planning session, so the workflow
  host must salvage-commit the plan; host salvage commits only the plan file and
  declines when any other path is dirty. The `make all` test gate
  (`tests/build-gate/documentation-contents.test.ts`) fails if a
  `docs/execplans/*.md` file is unlisted in `docs/contents.md`. Keeping the index
  entry in the working tree blocked salvage (round-1 failure); reverting it lets
  salvage commit the plan, and re-adding it as WI-1 turns the
  documentation-contents gate green before WI-2/3/4 run `make all`. The plan is
  committed first (`make all` transiently red), then WI-1 makes it green as the
  first gated build commit.
  Date/Author: 2026-07-06, planning agent (round 2).

## Outcomes & retrospective

Delivered outcome: `odw-lint check` prints, for any diagnostic-bearing run, one
location line per finding followed by a `Found …` summary footer, and a novice
can fix a fixture from the terminal without reading JSON. Clean runs remain
silent, read failures remain stderr-level CLI errors, and the user and
developer guides now describe that shipped text-output contract. Colour, source
snippets, `--output-format`, `--output-file`, and JSON remain deferred to
2.4.3/2.4.4. The deterministic commit gates passed at HEAD for the final
documentation commit.

## Context and orientation

The reader needs only this worktree. Relevant existing code, by full path:

- `src/diagnostics/types.ts` defines `Diagnostic` (fields `file`, `rule`,
  `severity`, `message`, `span`, optional `docs`/`suggestions`),
  `DiagnosticSummary` (`files`, `errors`, `warnings`, `infos`, `hints`), and
  `DiagnosticReport` (`schemaVersion`, `tool`, `summary`, `diagnostics`). No
  field carries a source snippet.
- `src/diagnostics/severity.ts` defines `DiagnosticSeverity`
  (`"error" | "warning" | "info" | "hint"`).
- `src/diagnostics/report.ts` exports `createDiagnosticReport({version, files,
  diagnostics})` and `countDiagnostics({files, diagnostics})`. The report's
  `summary` is produced by `countDiagnostics`; text output must reuse it.
- `src/diagnostics/text.ts` exports `formatTextDiagnostics(diagnostics):
  string`: one line per diagnostic, `file:line:column severity rule message`,
  joined by `"\n"`, no trailing newline, with `normalizeTextField` applied to
  `file` and `message` so control whitespace cannot break the one-line shape.
  This module is imported directly by the CLI (not through `odw-lint`).
- `src/cli/run-check.ts` exports `runCheck(request): CheckOutcome`
  (`{report: DiagnosticReport; readFailures}`) and `checkDiagnosticsExitCode`.
- `src/cli/check-cli.ts` exports `runCheckCli(args, io): 0|1|2`. It currently
  calls `writeTextDiagnostics(writers, formatTextDiagnostics(outcome.report.
  diagnostics))` (line 123). `writeTextDiagnostics` (lines 72-79) writes
  nothing when the text is empty and otherwise writes `${text}\n`.
- `src/cli/main.ts` is the `#!/usr/bin/env bun` entrypoint calling
  `runCheckCli(process.argv.slice(2))`.

Tests:

- `tests/diagnostics/text.test.ts` pins `formatTextDiagnostics` and has a
  snapshot under `tests/diagnostics/__snapshots__/`. `tests/diagnostics/
  fixtures.ts` provides `diagnosticForSeverity(sev)` builders.
- `tests/cli/check-cli.test.ts` drives `runCheckCli` with captured writers and
  an injected fixture reader; it asserts clean → empty stdout/stderr, and uses
  `.toContain(...)` for diagnostic lines.
- `tests/cli/check-cli-corpus.e2e.test.ts` spawns `bun run src/cli/main.ts
  check` over the reviewed corpus and asserts exit codes only.

Terms: a *diagnostic* is one lint finding; the *summary footer* is the trailing
`Found …` line; a *clean run* is one whose report has zero diagnostics; the
*severity vocabulary* is error/warning/info/hint.

## Plan of work

Four atomic, independently committable work items, each following
Red-Green-Refactor (where code is involved) and each gate-passable with
`make all`.

### WI-1: Register this ExecPlan in the documentation contents index

Add the index entry for this ExecPlan to `docs/contents.md`, in the
"Execution plans" list, in roadmap order between the roadmap 2.4.1 and roadmap
3.1.1 entries:

```markdown
- [Roadmap 2.4.2 ExecPlan](execplans/roadmap-2-4-2.md) plans human text output
  with a severity summary for the `check` command.
```

Why this is a work item and not a free index tweak: the host salvage-commits
only the plan file (declining when any other path is dirty), and the
`make all` test gate
(`tests/build-gate/documentation-contents.test.ts`) fails if a
`docs/execplans/*.md` file is unlisted in `docs/contents.md`. So this
registration is a real, gate-affecting, doc-only commit that must land first,
turning the documentation-contents gate green before WI-2/3/4 run `make all`
(see Surprises round-2 note and the Decision Log).

No production code or test code changes. This is the first gated commit; the
plan file itself is committed just before it by host salvage.

Documentation to read: `docs/documentation-style-guide.md` §"Documentation
contents index"; `AGENTS.md` §§"Markdown Guidance", "Documentation
Maintenance". Skills: `en-gb-oxendict`.

Tests: no new test. The existing gate
`tests/build-gate/documentation-contents.test.ts` ("lists every current
top-level ExecPlan and issue audit") transitions from red (plan file present,
entry absent) to green (entry added) — that transition is the Red-Green
evidence for this work item. Do not add a bespoke test; the build-gate test
already pins the invariant.

Validation: `make all` (covers the documentation-contents test), then, because
only `docs/contents.md` is touched, `bunx mdtablefix docs/contents.md`,
`bunx markdownlint-cli2 --fix docs/contents.md`, `make markdownlint`, and
`make nixie`. Every path listed exists and is edited by this work item.

### WI-2: Add the default text report formatter with a severity summary

Add `formatTextReport(report: DiagnosticReport): string` to
`src/diagnostics/text.ts`. Behaviour:

- If `report.diagnostics.length === 0`, return `""`.
- Otherwise, return `formatTextDiagnostics(report.diagnostics)`, then a blank
  line, then the summary footer, with no trailing newline. Concretely the
  returned string is `"<lines>\n\n<summary>"`.
- The summary footer is built from `report.summary` using a small internal
  helper (for example `formatDiagnosticSummary(summary: DiagnosticSummary):
  string`). It lists the non-zero categories in the fixed order error, warning,
  info, hint, formatted with the `Found` prefix, parts joined by comma-space,
  and a final full stop, with each part
  `${count} ${pluralize(count, singular, plural)}` using the reviewed
  vocabulary (`error`/`errors`, `warning`/`warnings`, `info`/`infos`,
  `hint`/`hints`). Because a non-empty report has at least one diagnostic, at
  least one category is non-zero, so the footer is never `Found .`.

Keep `formatTextDiagnostics` unchanged (signature and output). Add concise
private-helper JSDoc as required by the `df12(require-private-jsdoc)` lint. The
file stays far under 400 lines.

Documentation to read: `docs/technical-design.md` §§7.0, 8 (diagnostic contract
and "text output is derived from the same diagnostic objects"); `docs/roadmap.md`
task 2.4.2; `AGENTS.md` §§"Code Style and Structure", "Runtime Validation &
Types", "Testing". Skills: `en-gb-oxendict` (prose/comments); there is no TS
router skill in this session, so follow `AGENTS.md` §"TypeScript Guidance"
directly.

Tests (`tests/diagnostics/text.test.ts`), red first, importing `formatTextReport`
directly from `../../src/diagnostics/text` and `createDiagnosticReport` from
`odw-lint`, reusing `diagnosticForSeverity` from `./fixtures`:

1. empty report (`createDiagnosticReport({version, files: 1, diagnostics: []})`)
   → `formatTextReport(report)` returns `""`. (Red proves the function is
   missing.)
2. single error → the location line, a blank line, then `Found 1 error.`.
3. mixed severities table: build reports whose diagnostics realize the counts
   `{errors, warnings, infos, hints}` and assert the summary line, covering
   singular/plural (`1 error` vs `2 errors`), category omission (zero
   categories absent), and fixed ordering (e.g. one of each →
   `Found 1 error, 1 warning, 1 info, 1 hint.`).
4. footer-vs-summary consistency: for a representative diagnostics list, the
   numbers named in the footer equal `countDiagnostics({files, diagnostics})`
   fields — proving text and JSON summaries cannot diverge.
5. a `fast-check` property (`AGENTS.md` §"Testing", `fast-check` is already a
   dev dependency): for any generated multiset of severities, the summary line
   lists exactly the non-zero categories, in the fixed order, with counts equal
   to the per-severity totals and correct pluralization. Table-drive the small
   finite wording cases (test 3) and use the property for ordering/counting.
6. a snapshot of `formatTextReport` for a reviewed multi-diagnostic report,
   paired with the semantic assertions above (`AGENTS.md` §"Snapshot scope":
   snapshots pair with semantic assertions and stay reviewer-useful).

### WI-3: Emit the text report from the `check` CLI

Change `src/cli/check-cli.ts` to format the whole report instead of the bare
diagnostics array. Replace the current `formatTextDiagnostics(outcome.report.
diagnostics)` call (`src/cli/check-cli.ts` line 123) so the CLI computes
`formatTextReport(outcome.report)` and passes it to the existing
`writeTextDiagnostics` writer (which already suppresses empty output and appends
a single trailing newline). Import `formatTextReport` from `../diagnostics/text`
alongside the existing `formatTextDiagnostics` import, or replace the import if
`formatTextDiagnostics` is no longer referenced in this module. Read failures
(`writeReadFailures`) and the exit-code path are unchanged.

No change to `run-check.ts`, `main.ts`, exit codes, or the read-failure stderr
lines.

Documentation to read: `docs/technical-design.md` §§7.1, 7.4; `docs/roadmap.md`
task 2.4.2; `AGENTS.md` §§"TypeScript Guidance", "Observability" (write through
injected writers, no ad hoc `console.log`). Skills: `AGENTS.md` §"TypeScript
Guidance".

Tests (`tests/cli/check-cli.test.ts`), red first, using the existing captured-
writer + injected-reader harness:

1. update the error-fixture case to also assert the stdout `.toContain("Found 1
   error")` (or the exact count for that fixture) in addition to the existing
   location-line assertion — this is the red assertion that fails before WI-3
   rewires the CLI.
2. update the warning-only (hostile-metadata) case to assert the footer names a
   warning (for example `.toContain("Found 1 warning")`) while the exit code
   stays `1` under Ruff parity.
3. keep and re-run the clean-run case asserting exactly `{exitCode: 0, stdout:
   "", stderr: ""}` — the footer must not appear on a clean run.
4. keep the read-failure, usage-error, and non-`Errno` reader cases unchanged;
   they must still pass (summary footer is absent when there are no
   diagnostics, and read failures remain on stderr).

Re-run `tests/cli/check-cli-corpus.e2e.test.ts` unchanged to confirm the
process-level exit codes are unaffected.

### WI-4: Document the shipped text-output contract

Update the user- and developer-facing docs to describe the now-shipped default
text output, replacing the 2.4.1 "existing one-diagnostic-per-line formatter"
/ "richer text formatting deferred" wording:

- `docs/developers-guide.md` (the CLI boundary section, lines ~27-49): state
  that `odw-lint check` prints one `file:line:column severity rule message`
  line per diagnostic followed by a `Found …` severity summary, that a clean run
  prints nothing, that read failures remain on stderr, and that colour, source
  snippets, `--output-format`, `--output-file`, and JSON output remain deferred
  to 2.4.3/2.4.4. Keep the exit-code table unchanged.
- `docs/users-guide.md` (the text-output paragraph, lines ~96-98): describe the
  default human output shape (per-diagnostic location line plus the summary
  footer) and that it is derived from the same diagnostics as JSON, while
  keeping the deferred machine formats described as planned.

Cite `docs/technical-design.md` §§7.0, 7.3, 8. Keep en-GB Oxford spelling, wrap
prose to the repository Markdown line-length convention, and add no `bin`
claim. Do not add a `docs/rules/` page (text formatting is not a catalogued
rule).

Documentation to read: `docs/documentation-style-guide.md`; `AGENTS.md`
§§"Markdown Guidance", "Documentation Maintenance". Skills: `en-gb-oxendict`.

The `docs/contents.md` ExecPlan index entry is added by WI-1 (not this work
item), because host salvage commits only the plan file and the
documentation-contents gate must go green before WI-2/3/4 run `make all` (see
WI-1 and the Surprises round-2 note). The roadmap 2.4.2 checkbox is flipped by
the workflow integration step at merge, not inside a build work item.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-4-2`.

WI-1 is a doc-only registration (no Red-Green code cycle beyond the build-gate
test flipping green); WI-2 and WI-3 follow Red-Green-Refactor; WI-4 is a
documentation edit. Per work item:

1. For the code work items, write the failing test(s) first and run the focused
   suite to observe Red:

   ```bash
   bun test tests/diagnostics/text.test.ts          # WI-2
   bun test tests/cli/check-cli.test.ts             # WI-3
   ```

   Expect a failure naming the missing `formatTextReport` export (WI-2) or the
   missing `Found …` footer in CLI stdout (WI-3). For WI-1, observe Red by
   running the build-gate test with the plan file present but its index entry
   absent (`bun test tests/build-gate/documentation-contents.test.ts` fails);
   adding the entry turns it Green.

2. Add the minimal production code (WI-2/3) or the index entry (WI-1) to reach
   Green, rerun the focused suite.

3. Refactor for clarity within the 400-line limit, rerun the focused suite
   (code work items only).

4. Run the full commit gate before committing:

   ```bash
   make all
   ```

5. For any Markdown touched, additionally format only the files that work item
   actually edits, then run the Markdown gates. The exact file list differs per
   work item, so pass only that item's paths:

   ```bash
   # WI-1 (edits docs/contents.md only):
   bunx mdtablefix docs/contents.md
   bunx markdownlint-cli2 --fix docs/contents.md
   # WI-4 (edits the two guides only):
   bunx mdtablefix docs/developers-guide.md docs/users-guide.md
   bunx markdownlint-cli2 --fix docs/developers-guide.md docs/users-guide.md
   # whenever this ExecPlan itself is revised:
   bunx mdtablefix docs/execplans/roadmap-2-4-2.md
   bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-4-2.md
   # then, for any Markdown-touching work item:
   make markdownlint
   make nixie
   ```

   Never pass a path the work item does not edit; rely on
   `make markdownlint`/`make nixie` for repository-wide validation. WI-2 and
   WI-3 touch only TypeScript, so they run no `mdtablefix`/`markdownlint-cli2`
   path list — `make all` covers them.

6. Commit with an en-GB imperative subject, one commit per work item. Host
   salvage commits this ExecPlan file first (the planning session cannot run
   `git`); WI-1 is the first work-item commit and registers the plan in
   `docs/contents.md`.

## Validation and acceptance

Quality criteria ("done"):

- Tests: `make test` passes; the new/updated `tests/diagnostics/text.test.ts`
  and `tests/cli/check-cli.test.ts` cases pass, each with recorded Red-Green
  evidence in `Progress`.
- Lint/format/type: `make all` passes (`build`, `check-fmt`,
  `whitespace-hygiene`, `lint`, `typecheck`, `test`).
- Markdown (WI-1, WI-4, and the ExecPlan): `make markdownlint` and `make nixie`
  pass.
- Acceptance behaviour, observed via the CLI and reproducible by hand:

  ```bash
  bun run src/cli/main.ts check tests/static-analysis/fixtures/odw-examples/fan-out-reduce.js; echo "exit=$?"
  # (no output) — exit=0

  invalid=tests/static-analysis/fixtures/invalid-workflows/missing-metadata/missing-meta.js
  bun run src/cli/main.ts check "$invalid"; echo "exit=$?"
  # a file:line:column error line, a blank line, then "Found 1 error." — exit=1
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

All steps are re-runnable. Tests use injected readers/writers and in-memory
report builders, so they leave no residue. The formatter reads no files and
writes no workflow source. If a work item's gate fails, fix forward and rerun
`make all`; nothing here is destructive or requires rollback.

## Artifacts and notes

Reference the existing minimal formatter and its snapshot when shaping the new
output:

- `src/diagnostics/text.ts` `formatTextDiagnostics` — the per-diagnostic line
  contract to preserve.
- `tests/diagnostics/__snapshots__/` — the existing text snapshot; add the new
  `formatTextReport` snapshot beside it.
- `src/diagnostics/report.ts` `countDiagnostics` — the single source of the
  severity counts the footer must reuse.

## Interfaces and dependencies

No new runtime or dev dependencies. Production surface at the end of this task:

- `src/diagnostics/text.ts` gains
  `export const formatTextReport = (report: DiagnosticReport): string`, plus a
  private summary-formatting helper. `formatTextDiagnostics` is unchanged.
- `src/cli/check-cli.ts` calls `formatTextReport(outcome.report)` in place of
  `formatTextDiagnostics(outcome.report.diagnostics)`.

These consume existing types only (`DiagnosticReport`, `DiagnosticSummary`,
`DiagnosticSeverity`). `src/index.ts`, `package.json` exports, the rule
catalogue, and the diagnostic schema are unchanged.

## Revision note

Initial draft (2026-07-06): decomposed roadmap 2.4.2 into three atomic work
items — the default text report formatter with a severity summary footer, the
`check` CLI wiring, and the user/developer documentation. Scoped out source
snippets/carets, colour, `--output-format`/`--output-file`, and JSON as later
2.4.3/2.4.4 work; recorded the clean-run silence and text/JSON summary-parity
decisions; and chose a direct-import (non-package-export) home for
`formatTextReport` to keep the pinned public API surface unchanged. Noted that
`firecrawl_search` was not granted this session, so Ruff's summary wording is
pinned as a reviewed, snapshot-frozen decision rather than a first-hand scrape,
which does not block the plan because the summary is pure local formatting over
this project's own report types.

Round 2 (2026-07-06): resolved the design reviewer's durability blocking point.
Round 1 left `docs/contents.md` dirty alongside the plan file, so host salvage
(which commits only the plan and declines on extra dirty paths) could not commit
the ExecPlan. Established via
`tests/build-gate/documentation-contents.test.ts` that the `make all` gate
requires every `docs/execplans/*.md` file to be listed in `docs/contents.md`, so
the index entry is real, gate-affecting build work rather than a
commit-along index tweak. Reverted the working-tree `docs/contents.md` change so
the plan file is the only dirty path (unblocking host salvage) and promoted the
index registration to a new WI-1 — an atomic doc-only, gate-passing commit that
turns the documentation-contents gate green before the code/documentation work
items run `make all`. Renumbered the former WI-1/2/3 to WI-2/3/4, made the
per-work-item Markdown formatting commands path-safe (each lists only the files
that work item edits), and recorded that `git` — including `git --version` — is
refused in this planning session so the host must salvage-commit.

WI-1 implementation (2026-07-06): set the plan status to `IN PROGRESS`, added
the `docs/contents.md` index entry for roadmap 2.4.2 in roadmap order, and
ticked WI-1 with validation evidence. This completes the documentation-index
registration and leaves WI-2, WI-3, and WI-4 for later work-item commits.

WI-4 implementation (2026-07-06): documented the shipped text-output contract
in `docs/developers-guide.md` and `docs/users-guide.md`, corrected the stale
users' guide statement that the CLI was not implemented while avoiding any
published-`bin` claim, recorded the transient Leta fallback, and marked the
ExecPlan complete. Skills and documents used: `grepai`, `leta`, `execplans`,
`biome-typescript`, `commit-message`, `docs/technical-design.md` §§7.0, 7.3,
7.4, and 8, `docs/roadmap.md` task 2.4.2,
`docs/documentation-style-guide.md`, `docs/developers-guide.md`,
`docs/users-guide.md`, and `AGENTS.md`.

## Addenda

- [x] 2.4.2.1. Add process-level text-footer coverage.
  - Source: review:2.4.2; severity: low.
  - Scope: add spawned `bun run src/cli/main.ts check` coverage that asserts
    the `Found ...` footer and blank-line separation through the real process
    output path.
- [x] 2.4.2.2. Consolidate check text-output residues.
  - Source: audit:2.4.2; severity: low.
  - Scope: deduplicate the thrown-value message helper, freeze
    `createDiagnosticReport` output consistently with sibling result shapes,
    simplify check request construction, and derive text summary severity
    labels from one ordering source.
- [x] 2.4.2.3. Close mixed-output coverage and documentation gaps.
  - Source: audit:2.4.2; severity: low.
  - Scope: cover mixed diagnostic-and-read-failure `runCheckCli` invocations
    across stdout and stderr, and clarify in user-facing documentation that
    text output is a human report, not a machine-parseable stream.
