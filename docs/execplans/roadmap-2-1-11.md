# Broaden hostile metadata side-effect fixtures

This ExecPlan (execution plan) is a living document. The sections `Constraints`,
`Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

This is implementation round 1. The roadmap workflow approved execution of this
plan and assigned the `roadmap-2-1-11` git-donkey worktree.

## Purpose / big picture

Roadmap task 2.1.11 broadens the hostile-metadata security regression so it
proves the static linter is inert against more than the two side-effect
channels it currently covers. Today the corpus holds two hostile fixtures:
`global-marker.js`, whose metadata would write a `globalThis` marker if
evaluated, and `throw-marker.js`, whose metadata would throw a custom marker
error if evaluated. The regression at
`tests/static-analysis/hostile-metadata-security.test.ts` only observes the
`globalThis` marker.

`docs/technical-design.md` section 11.3 requires the security regression fixture
to include metadata that "writes a file, reads an environment variable, throws
a custom side-effect marker, or otherwise would be observable if evaluated",
with the expected outcome being "a diagnostic and no side effect". Section 11.1
lists "Hostile metadata that would cause a side effect if evaluated" as a
required corpus dimension. This task closes the gap between those two channels
and the four the design intends.

After this change a maintainer can observe the following. Running `make test`
(via `make all`) passes, and the hostile-metadata security regression now
exercises four observable side-effect channels: a global write, a thrown
marker, a filesystem write, and an environment read. Two new hostile fixtures
(`fs-write-marker.js` and `env-read-marker.js`) are added through the existing
refresh tooling (`make refresh-fixtures`), so their SHA-256 hashes, UTF-8 spans,
manifest source, and reviewer-facing `spanText` are all derived deterministically
rather than hand-edited. The fixture-count guards and snapshots that pin the
corpus size are updated in lockstep. Linting every hostile fixture through the
real `scanWorkflowEnvelope`/`classifyWorkflowMetadata` path and through the
public `odw-lint` entry in a fresh module graph produces the expected
`odw/meta-statically-unprovable` diagnostic and leaves no global marker, no
marker file on disk, and no environment-derived marker. A canary sub-test per
new channel proves the observation actually detects a real side effect, so the
absence assertions are meaningful rather than vacuous.

## Constraints

- Work only in the assigned `roadmap-2-1-11` git-donkey worktree for this
  repository, at
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-11`. Do not edit any
  root or control checkout; implementation edits belong only in this worktree.
- Treat `origin/main` as the canonical integration branch. Before
  implementation, run `git fetch origin main` and rebase or merge the task
  branch onto `origin/main`, then re-run the branch-local verification below.
  A stale branch is a plan defect, not an implementation tolerance.
- Use this GrepAI command shape first for intent search against the canonical
  main-branch index:

  ```sh
  grepai search --workspace 'Projects' --project 'odw-lint' \
    "<English intent query>" --toon --compact
  ```

  The GrepAI index reflects `main` only. Verify every branch-local fact inside
  this worktree with `leta`, exact text search, or file inspection before
  editing.
- Use `leta` for branch-local symbol navigation (`leta show`, `leta refs`,
  `leta grep`, `leta files`). If Leta fails, record the exact command and
  failure in `Surprises & Discoveries`, then use bounded branch-local file
  inspection for the named files. Leta unavailability is not a blocker.
- Use `sem` instead of raw Git history commands for entity-level diffs, blame,
  history, or change-impact navigation.
- Never import, evaluate, execute, or format invalid workflow fixtures as
  ordinary JavaScript (`docs/developers-guide.md`, "Static-analysis fixtures").
  Every fixture must be read as UTF-8 source text or bytes only. This is the
  central invariant the task exists to protect.
- New hostile fixtures live under
  `tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/`, which is
  already excluded from Biome (`biome.jsonc` line 13) and Oxlint
  (`.oxlintrc.json` line 6). Do not add these paths to any formatter or linter
  include list, and do not hand-format the fixture `.js` files.
- Fixture metadata (SHA-256, UTF-8 span, display line/column, `spanText`) must
  be produced by the refresh tooling
  (`tests/static-analysis/fixtures/refresh-metadata.ts`, run via
  `make refresh-fixtures`), not hand-edited. Manual manifest edits are limited to
  adding the fixture entry skeleton (family, fileName, expectedStatus, the
  diagnostic rule/severity/message, and the `spanText` anchor); the refresh
  derives everything else.
- Each fixture's diagnostic must remain a single `odw/meta-statically-unprovable`
  warning drawn from the rule catalogue (`src/diagnostics/rule-catalogue.ts` via
  the `odw-lint` public entry). Do not introduce new rules, messages, or message
  templates in this task; the fixture message must be the reviewed catalogue
  message `Workflow metadata must remain statically provable without evaluation.`
- Keep the task scoped to hostile-metadata side-effect fixtures and the security
  regression that observes them. Do not implement CLI reporters, file discovery,
  configuration, parser-backed body rules, ODW loader parity, or the static
  workflow lint entry point (task 2.1.12).
- Fixture `.js` source must be ASCII only. The corpus test asserts every byte is
  `<= 0x7f` (`tests/static-analysis/invalid-workflow-fixtures.test.ts`, the
  "validates manifest fixture hashes and diagnostic spans" case).
- Do not mutate the parent process environment or working directory in tests.
  `AGENTS.md` (Testing) requires dependency injection over process-wide state;
  where env mutation is unavoidable, confine it to a child process spawn
  environment or guard-and-restore it in a shared helper.
- Obey `AGENTS.md`: no single code file exceeds 400 lines (enforced by the file
  size gate, roadmap task 1.5.1); en-GB Oxford spelling in all prose, comments,
  and commits; TSDoc on new exported helpers; prefer factories/builders and
  parameterized loops over duplicated cases.

## Tolerances (exception triggers)

- Scope: if delivering the task requires editing more than 12 files or more than
  roughly 300 net lines (excluding refresh-generated manifest and snapshot
  churn), stop and escalate.
- File size: if any touched code or test file would exceed 400 lines after the
  change, stop and extract a colocated support module rather than growing the
  file; if extraction is not obviously safe, escalate. Watch
  `tests/static-analysis/invalid-workflow-fixtures.test.ts` (currently 370
  lines) and `tests/static-analysis/workflow-metadata.test.ts` (currently 385
  lines) especially.
- Interface: if satisfying the task appears to require changing a public
  `odw-lint` export signature, a rule identifier, a catalogue message, or a
  message template, stop and escalate.
- Dependencies: if a new runtime or dev dependency seems necessary, stop and
  escalate.
- Refresh determinism: if `make refresh-fixtures` produces a diff that changes
  files other than the intended new fixtures, their manifest, or reordered
  metadata, stop and escalate rather than committing collateral churn.
- Iterations: if a gate still fails after 3 focused fix attempts, stop and
  escalate.
- Ambiguity: if the meaning of "filesystem or environment side-effect
  observable" turns out to require evaluating fixture source to observe, stop
  and escalate; the design forbids evaluation.

## Risks

- Risk: Adding fixtures shifts the corpus size and breaks several count guards
  and snapshots at once, making the diff noisy and easy to get wrong.
  Severity: medium. Likelihood: high.
  Mitigation: enumerate every count guard and snapshot up front (see "Context
  and orientation"); update the manual `expectedCounts` literal and hard-coded
  file-name list deliberately, then regenerate snapshots only after confirming
  the failure is the intended contract change.
- Risk: The environment-read observation tempts direct `process.env` mutation in
  the parent test process, violating `AGENTS.md`.
  Severity: medium. Likelihood: medium.
  Mitigation: the in-process lint tests never evaluate fixtures, so they need no
  env at all; confine any env probe to the spawned fresh-module-graph child via
  the spawn environment, and prove the env channel with a canary that simulates
  the marker directly.
- Risk: A chosen `spanText` anchor is not unique in the fixture source, so the
  refresh raises `missing-anchor`/`duplicate-anchor` and cannot derive a span.
  Severity: low. Likelihood: medium.
  Mitigation: anchor on the whole metadata IIFE
  (`(() => { ... })()`), which is unique per fixture; verify with `grep -c`
  before running the refresh.
- Risk: Growing `invalid-workflow-fixtures.test.ts` or
  `workflow-metadata.test.ts` past 400 lines trips the file-size gate.
  Severity: medium. Likelihood: medium.
  Mitigation: generalize existing parameterized assertions instead of adding new
  literal cases; move any bulky shared data into a colocated support module.
- Risk: The new fixtures accidentally trip Biome/Oxlint because the exclusion
  glob does not match a new sub-path.
  Severity: low. Likelihood: low.
  Mitigation: place fixtures under the already-excluded
  `invalid-workflows/hostile-metadata/` directory and confirm `make check-fmt`
  and `make lint` stay green.

## Progress

- [x] (2026-07-02) Work item 0: refresh branch, orient, and record the current
  baseline (counts, snapshots, hard-coded lists).
- [x] (2026-07-02) Work item 1: add filesystem and environment side-effect
  observation (helpers plus canaries) to the hostile-metadata security
  regression harness.
- [x] (2026-07-02) Work item 2: add the filesystem-write hostile fixture
  (`fs-write-marker.js`) through the refresh tooling and update guards,
  snapshots, and the security assertion.
- [x] (2026-07-02) Work item 3: add the environment-read hostile fixture
  (`env-read-marker.js`) through the refresh tooling and update guards,
  snapshots, and the security assertion.
- [x] (2026-07-02) Work item 4: document the broadened hostile-metadata
  side-effect fixtures and observation channels in the developers guide.

## Surprises & discoveries

- Observation: the planning session had no Bash execution (`bunx`, `awk`,
  `make`, `grep` with quantifiers were all denied), so markdown formatters and
  linters could not be run against this plan during authoring.
  Evidence: repeated "Permission to use Bash has been denied" responses,
  including from read-only helper subagents.
  Impact: long backticked file paths were abbreviated in prose (full paths are
  retained in the fenced code blocks and the fixture root is named once) to keep
  within the 80-character MD013 prose limit; the implementer must still run
  `make markdownlint` and `make nixie` (work item 4) to confirm the plan and the
  developers guide are lint-clean before merge.
- Observation: work item 0 branch freshness matched the plan.
  Evidence: `git fetch origin main && git rebase origin/main` reported
  "Current branch roadmap-2-1-11 is up to date." on 2026-07-02.
  Impact: no rebase conflict or baseline adjustment was needed before
  implementation.
- Observation: the branch-local baseline still matches the plan's orientation
  values.
  Evidence: `expectedCounts` is `odwExamples: 9`, `masking: 9`,
  `invalidWorkflows: 14`, `hostileMetadata: 2`, `invalidDiagnostics: 14`, and
  `totalFixtures: 32`; `EXPECTED_FILE_NAMES` has 14 entries, including
  `hostile-metadata/global-marker.js` and
  `hostile-metadata/throw-marker.js`; the compact invalid-workflow snapshot
  lists the same two hostile fixtures.
  Impact: later fixture work can move only the intended count guards, manifest
  entries, and snapshots.
- Observation: GrepAI was available but returned only low-signal historical
  roadmap and audit results for hostile-metadata intent searches.
  Evidence: searches for "hostile metadata side effect fixtures diagnostics side
  effects tests" and "static analysis hostile metadata fixture global marker
  throw marker manifest" returned older roadmap/audit files rather than the
  current hostile fixture source.
  Impact: GrepAI was used as main-branch orientation only; branch-local facts
  were verified with `leta`, exact text search, and file inspection.
- Observation: the requested `scrutineer` sub-agent could not run work item 0
  gates because its fixed model quota was exhausted.
  Evidence: sub-agent `019f2247-89fa-7ea1-806e-c123bfb26450` returned "You've
  hit your usage limit for GPT-5.3-Codex-Spark. Switch to another model now, or
  try again at Jul 7th, 2026 11:20 AM."
  Impact: deterministic gates and CodeRabbit review were run directly from the
  assigned worktree for this item; tracked-file edits remained local to this
  implementation agent.
- Observation: work item 0 deterministic gates and review passed.
  Evidence: `make all` and `make markdownlint` passed on 2026-07-02. The first
  `make nixie` run validated every Mermaid diagram but raised
  `BlockingIOError: [Errno 11] write could not complete without blocking` while
  printing the success banner; rerunning `make nixie` with output captured to
  `/tmp/odw-lint-roadmap-2-1-11-nixie.log` exited 0 and ended with "All diagrams
  validated successfully!" CodeRabbit initially returned a recoverable rate
  limit, then passed on the first retry after the required randomized `vsleep`
  backoff with 0 findings.
  Impact: work item 0 is ready to commit with no code changes.
- Observation: work item 1 broadened the security harness without adding new
  fixtures.
  Evidence: `hostile-metadata-security.test.ts` now registers deterministic
  temp marker-file paths, asserts marker-file absence around every hostile
  fixture lint, passes filesystem and environment-derived marker canaries, and
  passes marker-file and environment-probe values into the fresh-module child
  process. `fresh-module-graph.ts` accepts a child `env` option, covered by
  `fresh-module-graph.test.ts`.
  Impact: later hostile fixtures automatically inherit the no-global-marker and
  no-marker-file assertions.
- Observation: work item 1 validation passed.
  Evidence: `bun test tests/static-analysis/hostile-metadata-security.test.ts
  tests/static-analysis/fresh-module-graph.test.ts` passed 10 tests; `make all`
  passed 565 tests; CodeRabbit review completed with 0 findings.
  Impact: the observation-channel harness is ready to commit before fixture
  growth.
- Observation: work item 2 added the filesystem-write hostile fixture through
  the refresh tooling.
  Evidence: `fs-write-marker.js` was added under the hostile-metadata fixture
  directory, the anchor check for `require("node:fs").writeFileSync(` returned
  1, and `make refresh-fixtures` wrote only
  `tests/static-analysis/fixtures/invalid-workflows/manifests/hostile-metadata.ts`.
  The refresh report counted `hostileMetadata: 3`, `invalidWorkflows: 15`,
  `invalidDiagnostics: 15`, and `totalFixtures: 33`.
  Impact: the filesystem-write channel is now pinned by a raw fixture, derived
  manifest metadata, count guards, snapshots, and the hostile security
  regression.
- Observation: work item 2 validation passed.
  Evidence: the focused invalid-workflow, fixture-refresh, hostile-security,
  and refresh-boundary tests passed; rerunning `make refresh-fixtures` reported
  `writtenPaths: []`; `make all` passed 567 tests; CodeRabbit review completed
  with 0 findings.
  Impact: the filesystem fixture is ready to commit before adding the
  environment-read fixture.
- Observation: work item 3 added the environment-read hostile fixture through
  the refresh tooling.
  Evidence: `env-read-marker.js` was added under the hostile-metadata fixture
  directory, the anchor check for `process.env.ODW_LINT_HOSTILE_ENV_PROBE`
  returned 1, and `make refresh-fixtures` wrote only
  `tests/static-analysis/fixtures/invalid-workflows/manifests/hostile-metadata.ts`.
  The refresh report counted `hostileMetadata: 4`, `invalidWorkflows: 16`,
  `invalidDiagnostics: 16`, and `totalFixtures: 34`.
  Impact: the hostile corpus now covers global write, thrown marker,
  filesystem write, and environment read side-effect channels.
- Observation: work item 3 validation passed.
  Evidence: the focused invalid-workflow, fixture-refresh, hostile-security,
  and refresh-boundary tests passed; rerunning `make refresh-fixtures` reported
  `writtenPaths: []`; `make all` passed 569 tests; CodeRabbit review completed
  with 0 findings.
  Impact: the four-channel hostile corpus is ready for documentation.
- Observation: work item 4 updated the developer guide.
  Evidence: the "Static-analysis fixtures" section now names the global marker,
  thrown marker, marker-file, and environment-probe hostile channels; it tells
  maintainers to add hostile fixtures through `make refresh-fixtures`; and it
  states that `hostile-metadata-security.test.ts` observes the global marker,
  marker-file absence, and environment-derived marker while linting source text.
  Impact: the maintainer-facing fixture guidance matches the broadened corpus
  and regression harness.
- Observation: work item 4 validation passed.
  Evidence: `mdtablefix docs/developers-guide.md
  docs/execplans/roadmap-2-1-11.md`, `markdownlint-cli2 --fix` on the same two
  files, `make markdownlint`, `make nixie`, and `make all` all passed.
  `make all` passed 569 tests. CodeRabbit review completed with 0 findings.
  Impact: documentation and code gates are green for the completed task.

## Decision log

- Decision: Add two fixtures (`fs-write-marker.js` for the filesystem-write
  channel and `env-read-marker.js` for the environment-read channel) rather than
  the roadmap minimum of one.
  Rationale: `docs/technical-design.md` section 11.3 enumerates file-write,
  environment-read, and thrown-marker channels; the task success criterion names
  "filesystem or environment side-effect observables". Covering both new
  channels fully satisfies the design enumeration and the success wording, and
  each fixture remains an independently committable, gate-passable unit.
  Date/Author: 2026-07-02, planning agent.
- Decision: Observe the filesystem channel with a temp marker-file absence
  assertion plus a direct-write canary; observe the environment channel through
  the existing `globalThis` marker (the env-read fixture writes the read value
  into the marker) plus a child-process env-probe canary.
  Rationale: the security regression never evaluates fixture source, so an
  absence assertion is the correct observable; the canary proves the observation
  channel can detect a real side effect, keeping the absence assertion
  meaningful. Reading an environment variable has no observable effect by itself,
  so the env-read fixture must surface the read value through a write channel.
  Date/Author: 2026-07-02, planning agent.
- Decision: Anchor each new diagnostic on the whole metadata IIFE expression.
  Rationale: the refresh derives spans from a `spanText` anchor that must appear
  exactly once (`docs/developers-guide.md`); the IIFE is unique per fixture and
  matches how `global-marker.js` and `throw-marker.js` are already anchored.
  Date/Author: 2026-07-02, planning agent.

## Outcomes & retrospective

Roadmap task 2.1.11 is complete. The hostile-metadata corpus now contains four
side-effect channels: global marker write, custom marker throw, filesystem
marker write, and environment-probe read surfaced through the global marker.
The security regression observes global marker absence, marker-file absence,
and environment-derived marker absence through both the internal static-analysis
path and the public package entry in a fresh module graph.

The fixture refresh workflow remained deterministic. The final refresh counts
are `hostileMetadata: 4`, `invalidWorkflows: 16`, `invalidDiagnostics: 16`, and
`totalFixtures: 34`; a second `make refresh-fixtures` run reported
`writtenPaths: []`.

The only workflow deviation was the unavailable `scrutineer` sub-agent. The
requested role was quota-blocked, so deterministic gates and CodeRabbit reviews
were run directly from the assigned worktree and recorded in this plan.

Final validation for the documentation milestone passed with `make markdownlint`,
`make nixie`, and `make all`, followed by a CodeRabbit review with 0 findings.

## Context and orientation

This repository is `odw-lint`, a Bun + TypeScript static linter for Open
Dynamic Workflows (ODW). It never executes workflow source; it lints text. The
hostile-metadata corpus proves that promise: each fixture's metadata would leave
an observable side effect if evaluated, and the security regression asserts it
never is.

Key files and directories, all repository-relative:

- `tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/` — the raw
  hostile fixture `.js` files. Currently `global-marker.js` (writes a
  `globalThis` marker) and `throw-marker.js` (throws a marker error). These are
  excluded from Biome and Oxlint.
- The generated hostile-metadata manifest, at
  `.../invalid-workflows/manifests/hostile-metadata.ts` under the fixtures root
  above — the manifest of hostile fixture metadata. It is produced by the
  refresh tooling; its header says so. Each entry pins `family`, `fileName`,
  `sha256`, `expectedStatus`, and `expectedDiagnostics` (rule, severity,
  message, `span`, `spanText`).
- `tests/static-analysis/fixtures/invalid-workflows.ts` — the read-only
  aggregate `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS`, concatenated in family order:
  missing, malformed, hostile, unsupported, syntax-error.
- `tests/static-analysis/fixtures/invalid-workflows/manifest-types.ts` — the
  `invalidWorkflowFixture` and `diagnostic` builders. `diagnostic()` accepts a
  raw `rule` string and derives the branded `RuleId` and the `docs` path from
  the catalogue; it validates the rule against `RULE_CATALOGUE` and throws for
  uncatalogued rules.
- `tests/static-analysis/fixtures/refresh-metadata.ts` — the refresh CLI entry
  and public types (`FixtureRefreshCounts`, `FixtureRefreshReport`). Run via
  `bun run tests/static-analysis/fixtures/refresh-metadata.ts` (or
  `make refresh-fixtures`). It reads fixture files as bytes/UTF-8 only; it is
  documented as import-safe precisely because hostile fixtures exist.
- `tests/static-analysis/fixtures/refresh-manifest-source.ts` — generates
  manifest TypeScript source. `invalidFixtureSource`/`diagnosticSource` emit each
  fixture entry; `refreshedDiagnosticSpan` re-derives the span from the
  `spanText` anchor via `deriveAnchoredDiagnosticSpan`.
- `tests/static-analysis/fixtures/refresh-writers.ts` — computes the report and
  `currentCounts()`. Counts are derived from the live manifests:
  `hostileMetadata` counts fixtures whose `family === "hostile-metadata"`;
  `invalidWorkflows` is the full invalid corpus length; `invalidDiagnostics`
  sums `expectedDiagnostics.length`; `totalFixtures` is odwExamples + masking +
  invalidWorkflows.
- `tests/static-analysis/hostile-metadata-security.test.ts` — the security
  regression. It lints each hostile fixture's source through
  `createOriginalSourceFile` -> `scanWorkflowEnvelope` ->
  `classifyWorkflowMetadata`, asserts the expected diagnostics, and asserts the
  `globalThis` marker stays undefined. A separate case runs the public `odw-lint`
  entry over the fixtures in a fresh module graph child process
  (`fresh-module-graph.ts` helpers) and asserts diagnostics present and marker
  unset. A canary case proves the global-marker observation works by setting the
  marker directly.
- `tests/static-analysis/invalid-workflow-fixtures.test.ts` — the corpus
  contract test. It hard-codes `EXPECTED_FILE_NAMES` (14 entries, includes both
  hostile files), asserts ASCII-only bytes, re-derives and checks spans, and has
  a "reads hostile fixture source without setting the global marker" case that
  hard-codes the two hostile file names and a per-file marker substring. It also
  emits a compact manifest snapshot.
- `tests/static-analysis/workflow-metadata.test.ts` — classification tests
  including "keeps hostile global-marker metadata passive", which asserts the
  `meta-statically-unprovable` diagnostic and marker-undefined for
  `global-marker.js`.
- Count and snapshot pins that must move when the corpus grows:
  - `tests/static-analysis/fixture-metadata-refresh-boundaries.test.ts` —
    `expectedCounts` literal: `odwExamples: 9, masking: 9, invalidWorkflows: 14,
    hostileMetadata: 2, invalidDiagnostics: 14, totalFixtures: 32`.
  - `tests/static-analysis/__snapshots__/fixture-metadata-refresh.test.ts.snap`
    — embeds the counts block and the sorted managed/would-write/unchanged path
    lists.
  - `tests/static-analysis/__snapshots__/fixture-metadata-refresh-cli.test.ts.snap`
    — embeds the counts block twice.
  - `tests/static-analysis/__snapshots__/invalid-workflow-fixtures.test.ts.snap`
    — the compact manifest snapshot (family, fileName, expectedStatus,
    diagnostics with docs and spanText lines).
- `docs/developers-guide.md` — the "Static-analysis fixtures" and hostile-
  metadata paragraphs (around lines 296-333) describe the corpus, the refresh
  workflow, the `ODW_REFERENCE_CHECKOUT` variable, and that
  `hostile-metadata-security.test.ts` owns the no-side-effect regression.

Terms of art:

- Statically unprovable metadata: `meta` whose `name`/`description` is not a
  pure literal, so its value cannot be proven without evaluation. The rule
  `odw/meta-statically-unprovable` (severity `warning`) reports it. All hostile
  fixtures use a computed IIFE `description`, so they earn exactly this
  diagnostic.
- Side-effect observable: a state change that a test can inspect without
  executing the fixture body — a `globalThis` property, a file on disk, or an
  environment-derived value surfaced through one of those.
- Fresh module graph: a child Node/Bun process spawned with a clean module cache
  (`tests/static-analysis/fresh-module-graph.ts`) so import-safety is tested
  against a cold graph, not the warm test process.

The refresh derivation model matters: to add a fixture you (1) write the raw
`.js` file, (2) add a manifest skeleton entry naming the diagnostic and a unique
`spanText` anchor, then (3) run the refresh, which recomputes `sha256` and the
byte/line/column span from the anchor and rewrites the manifest deterministically.
The manifest is the source of truth for which fixtures exist; the refresh only
updates their derived metadata.

## Plan of work

The work follows Red-Green-Refactor. Each work item is independently
committable and must pass `make all` before commit. Where a work item touches
Markdown, it must also pass `make markdownlint` and `make nixie`.

### Work item 0 — refresh branch and record baseline (no code changes)

Stage A (orientation). Confirm the worktree and branch, fetch and rebase onto
`origin/main`, and re-read the files named above to confirm they still match
this plan. Record the exact current values of `expectedCounts`, the
`EXPECTED_FILE_NAMES` list, and the compact snapshot in `Surprises &
Discoveries` if any differ from this plan (they are the baseline the later work
items must move). No code changes; no commit unless the rebase produced one.

Implements: the branch-freshness constraint above and `AGENTS.md` (Branches).
Read: `docs/roadmap.md` task 2.1.11; this plan.
Skills to load: none beyond the routing skill; no code yet.

### Work item 1 — broaden the security regression observation channels

Add filesystem and environment side-effect observation to
`tests/static-analysis/hostile-metadata-security.test.ts` without adding any
fixtures yet, so the harness is ready before the fixtures land.

Stage B (red). Add two canary sub-tests inside the existing
`describe("hostile metadata security regression", ...)` block:

1. A filesystem canary: compute a temp marker path under `node:os` `tmpdir()`
   (unique per run using the process id and test name, not `Date.now()` or
   randomness that would defeat determinism of cleanup), assert the file does
   not exist, write it directly with `node:fs` `writeFileSync`, assert a new
   `hostileFilesystemMarkerExists(path)` helper reports `true`, remove it, and
   assert the helper reports `false`. Register the path for cleanup in
   `afterEach`.
2. An environment canary: prove that setting the environment probe does not, by
   itself, set the global marker, and that the observation helper reads a
   simulated env-derived marker. Confine any `process.env` write to a spawned
   fresh-module-graph child via the spawn environment (extend
   `runFreshModuleGraphScript` usage with an `env` option if needed, or set the
   variable inside the child script string before importing), never in the
   parent process.

Run the focused file; the canaries fail because the
`hostileFilesystemMarkerExists` helper does not yet exist.

Stage C (green). Add the helper(s) and shared observation state:

- `hostileFilesystemMarkerPath()` — returns the deterministic temp path.
- `hostileFilesystemMarkerExists(path)` — `existsSync` wrapper.
- Extend `beforeEach`/`afterEach` to clear the global marker (already present)
  and remove any stray marker file.
- Extend the per-fixture "lints X without a side effect" loop to also assert
  `hostileFilesystemMarkerExists(markerPath)` is `false` after linting. This
  passes trivially for the two existing fixtures (they never write a file) and
  will cover the new fixtures automatically.
- Extend the public-entry fresh-module-graph script
  (`publicEntryImportSafetyScript`) so the child, before importing, sets a temp
  filesystem marker-path environment variable and an environment probe variable,
  and after linting each fixture asserts: diagnostics present, global marker
  unset, and the marker file absent. Keep the structured `failFreshModuleGraphCheck`
  failure codes descriptive (e.g. `hostile-file-written`, `hostile-marker-set`).

Re-run the focused file; the canaries and the extended loop pass.

Stage D (refactor). If the test file approaches 400 lines, extract the new
observation helpers into a colocated
`tests/static-analysis/hostile-metadata-observation.ts` support module and
import them. Keep names and TSDoc consistent with the existing helpers.

Tests to add/update: two new canary cases and the extended per-fixture and
fresh-module-graph assertions in `hostile-metadata-security.test.ts`. No fixture
count changes, so no snapshot or count-guard updates in this work item.

Implements: `docs/technical-design.md` section 11.3 (security regression must
observe file and environment channels); `AGENTS.md` (Testing:
environment-dependent tests, snapshot scope, deterministic runner).
Read: `tests/static-analysis/hostile-metadata-security.test.ts`,
`tests/static-analysis/fresh-module-graph.ts`, `AGENTS.md` (Testing).
Skills to load: `python-router`? No — this is TypeScript; load no Python
skills. Use the repository's TypeScript conventions. If a router skill for
TypeScript/Bun testing is offered, prefer the `execplans` discipline already in
use plus in-repo patterns. Verify helpers with `leta refs` for any name reuse.

Validation: `make all`.

### Work item 2 — add the filesystem-write hostile fixture

Stage B (red). Create the raw fixture and manifest skeleton, and add the
targeted security assertion:

1. Create the raw fixture `fs-write-marker.js` under the hostile-metadata
   fixture directory
   (`tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/`)
   with ASCII-only content whose computed `description` IIFE would perform a
   filesystem write if evaluated, reading its target path from an environment
   variable so the security test can inject a temp path without evaluating the
   source, for example:

   ```javascript
   export const meta = {
     name: "hostile-fs-write-marker",
     description: (() => {
       require("node:fs").writeFileSync(
         process.env.ODW_LINT_HOSTILE_FS_MARKER_PATH,
         "hostile-fs-write-marker",
       );
       return "Hostile metadata fixture.";
     })(),
     phases: [{ title: "Run" }],
   };

   await agent("This body must not run.");
   ```

2. Add a skeleton entry to the hostile-metadata manifest
   (`.../invalid-workflows/manifests/hostile-metadata.ts`)
   in filename order for the family, using `invalidWorkflowFixture`/`diagnostic`
   with `rule: "odw/meta-statically-unprovable"`, `severity: "warning"`, the
   catalogue message, and `spanText` set to the whole IIFE
   (`(() => { ... })()`). Leave `sha256` and `span` as any placeholder; the
   refresh will overwrite them. Confirm the anchor is unique with
   `grep -c` before refreshing.
3. In `hostile-metadata-security.test.ts`, add a named assertion that the corpus
   includes a filesystem-write fixture and that linting it leaves the marker
   file absent (the extended loop from work item 1 already covers the absence;
   add an explicit `some(fileName === "fs-write-marker.js")` guard so the intent
   is visible).

Run the focused corpus and security tests; they fail because
`EXPECTED_FILE_NAMES`, `expectedCounts`, the hostile file-name list, and the
snapshots still describe the old corpus, and the manifest `sha256`/`span` are
placeholders.

Stage C (green).

1. Run `make refresh-fixtures` (or `bun run
   tests/static-analysis/fixtures/refresh-metadata.ts`) to derive `sha256`, the
   UTF-8 `span`, and rewrite the manifest deterministically. Review the JSON
   report and the Git diff; confirm only the intended manifest entry changed.
2. Update the manual `expectedCounts` literal in
   `fixture-metadata-refresh-boundaries.test.ts` to `hostileMetadata: 3,
   invalidWorkflows: 15, invalidDiagnostics: 15, totalFixtures: 33`
   (odwExamples/masking unchanged).
3. Update `EXPECTED_FILE_NAMES` and the hard-coded hostile file-name list in
   `invalid-workflow-fixtures.test.ts` to include
   `hostile-metadata/fs-write-marker.js`. Generalize the per-file marker
   substring check in the "reads hostile fixture source without setting the
   global marker" case so it does not assume exactly two files (drive the
   expected substring from a small map keyed by file name, or assert the source
   contains its own marker token derived from the manifest).
4. Regenerate the affected snapshots only after confirming the failures are the
   intended contract change:
   `bun test tests/static-analysis/invalid-workflow-fixtures.test.ts
   tests/static-analysis/fixture-metadata-refresh.test.ts
   tests/static-analysis/fixture-metadata-refresh-cli.test.ts
   --update-snapshots`. Review each snapshot diff for count and file-list
   changes only.
5. Optionally add a "keeps hostile fs-write metadata passive" case to
   `workflow-metadata.test.ts` mirroring the existing global-marker case, only if
   it stays within the 400-line limit; otherwise rely on the corpus and security
   coverage.

Run `make all`; expect all green.

Stage D (refactor). None expected beyond keeping file sizes within limit.

Tests to add/update: new fixture, manifest entry, count guard, corpus file-name
list and generalized marker check, three regenerated snapshots, the security
assertion, and (optionally) one classification case.

Implements: `docs/technical-design.md` sections 11.1 and 11.3 (file-write
hostile fixture; diagnostic and no side effect); `docs/roadmap.md` task 2.1.11
(filesystem-write fixture through the refresh tooling, updating hashes, spans,
snapshots, and fixture-count guards).
Read: `docs/developers-guide.md` ("Static-analysis fixtures", hostile paragraph);
`tests/static-analysis/fixtures/refresh-manifest-source.ts`;
`tests/static-analysis/fixtures/refresh-writers.ts`;
`tests/static-analysis/invalid-workflow-fixtures.test.ts`.
Skills to load: `execplans` (this discipline); verify branch-local facts with
`leta`/exact search. No Python verification skills apply.

Validation: `make all`.

### Work item 3 — add the environment-read hostile fixture

Stage B (red). Mirror work item 2 for the environment-read channel:

1. Create the raw fixture `env-read-marker.js` under the same hostile-metadata
   fixture directory
   (`tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/`)
   with ASCII-only content whose computed `description` IIFE reads an
   environment variable and surfaces the read value through the global marker so
   it is observable, for example:

   ```javascript
   export const meta = {
     name: "hostile-env-read-marker",
     description: (() => {
       globalThis.__odwLintHostileMetadataWasEvaluated =
         process.env.ODW_LINT_HOSTILE_ENV_PROBE ?? "hostile-env-read-marker";
       return "Hostile metadata fixture.";
     })(),
     phases: [{ title: "Run" }],
   };

   await agent("This body must not run.");
   ```

2. Add the filename-ordered manifest skeleton entry with the same rule,
   severity, message, and an IIFE `spanText` anchor; confirm anchor uniqueness.
3. Add a named security assertion that the corpus includes an environment-read
   fixture and that linting it leaves the global marker undefined. Extend the
   environment canary/child-process probe from work item 1 so it sets
   `ODW_LINT_HOSTILE_ENV_PROBE` in the child environment and asserts the marker
   is still unset after linting (proving reading the fixture text does not read
   or surface the environment).

Run the focused tests; they fail on the stale counts, file-name list,
snapshots, and placeholder metadata.

Stage C (green).

1. Run `make refresh-fixtures`; review the report and diff.
2. Update `expectedCounts` to `hostileMetadata: 4, invalidWorkflows: 16,
   invalidDiagnostics: 16, totalFixtures: 34`.
3. Add `hostile-metadata/env-read-marker.js` to `EXPECTED_FILE_NAMES` and the
   hostile file-name list; extend the generalized marker-substring map.
4. Regenerate the same three snapshots and review the diffs.
5. Optionally add a "keeps hostile env-read metadata passive" classification
   case if within the file-size limit.

Run `make all`; expect all green.

Stage D (refactor). If `invalid-workflow-fixtures.test.ts` or
`workflow-metadata.test.ts` nears 400 lines, extract shared hostile-fixture test
data/helpers into a colocated support module.

Tests to add/update: as work item 2, for the environment-read fixture.

Implements: `docs/technical-design.md` sections 11.1 and 11.3 (environment-read
hostile fixture); `docs/roadmap.md` task 2.1.11 (environment-read fixture through
the refresh tooling; regression exercises global-write, thrown-marker, and
filesystem or environment observables; refresh output deterministic).
Read: same as work item 2.
Skills to load: `execplans`; branch-local verification with `leta`/exact search.

Validation: `make all`.

### Work item 4 — document the broadened fixtures

Update `docs/developers-guide.md` so the hostile-metadata paragraph describes all
four side-effect channels (global write, thrown marker, filesystem write,
environment read), notes that new fixtures are added through
`make refresh-fixtures`, and states that
`tests/static-analysis/hostile-metadata-security.test.ts` now observes the
global marker, marker-file absence, and environment-derived marker. Keep en-GB
Oxford spelling. Do not restate span/hash internals already documented.

Format only the changed Markdown file, then gate:

```sh
mdtablefix docs/developers-guide.md docs/execplans/roadmap-2-1-11.md
markdownlint-cli2 --fix docs/developers-guide.md docs/execplans/roadmap-2-1-11.md
make markdownlint
make nixie
make all
```

Implements: `AGENTS.md` (keep `docs/` current); `docs/documentation-style-guide.md`
(en-GB Oxford spelling, prose style).
Read: `docs/developers-guide.md` (Static-analysis fixtures);
`docs/documentation-style-guide.md`.
Skills to load: `en-gb-oxendict` for the prose pass.

Validation: `make markdownlint`, `make nixie`, `make all`.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-11`.

Baseline and branch freshness (work item 0):

```sh
git branch --show-current            # expect roadmap-2-1-11
git fetch origin main
git rebase origin/main               # or merge, per repository convention
grep -n "expectedCounts" -A8 tests/static-analysis/fixture-metadata-refresh-boundaries.test.ts
```

Per fixture (work items 2 and 3), after writing the fixture and manifest
skeleton, verify anchor uniqueness, then refresh and gate:

```sh
grep -c '(() => {' tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/fs-write-marker.js
make refresh-fixtures
git --no-pager diff -- tests/static-analysis/fixtures/invalid-workflows/manifests/hostile-metadata.ts
bun test tests/static-analysis/invalid-workflow-fixtures.test.ts \
  tests/static-analysis/fixture-metadata-refresh.test.ts \
  tests/static-analysis/fixture-metadata-refresh-cli.test.ts \
  --update-snapshots
make all
```

Markdown (work item 4):

```sh
mdtablefix docs/developers-guide.md docs/execplans/roadmap-2-1-11.md
markdownlint-cli2 --fix docs/developers-guide.md docs/execplans/roadmap-2-1-11.md
make markdownlint
make nixie
make all
```

Expected refresh report shape (counts after both fixtures land):

```plaintext
"counts": {
  "hostileMetadata": 4,
  "invalidDiagnostics": 16,
  "invalidWorkflows": 16,
  "masking": 9,
  "odwExamples": 9,
  "totalFixtures": 34
}
```

## Validation and acceptance

Quality criteria (what "done" means):

- Tests: `make test` (via `make all`) passes. The hostile-metadata security
  regression asserts, for every hostile fixture, the expected single
  `odw/meta-statically-unprovable` warning and no global marker, no marker file,
  and no environment-derived marker. The filesystem and environment canaries
  each prove their observation channel detects a real side effect and then a
  clean state. The public-entry fresh-module-graph case passes with the marker
  file and global marker both absent across all four fixtures.
- Lint/typecheck: `make check-fmt`, `make lint`, and `make typecheck` (all part
  of `make all`) pass. The new fixture `.js` files remain excluded from Biome
  and Oxlint.
- Counts and snapshots: `expectedCounts` and the three regenerated snapshots
  reflect `hostileMetadata: 4`, `invalidWorkflows: 16`, `invalidDiagnostics: 16`,
  `totalFixtures: 34`; the corpus file-name list includes both new fixtures.
- Determinism: running `make refresh-fixtures` twice produces no diff on the
  second run.
- Markdown: `make markdownlint` and `make nixie` pass for the developers guide
  and this ExecPlan.

Red-Green-Refactor evidence to record in `Progress`/`Artifacts`:

- Work item 1: red command and failure (canary asserts undefined helper), green
  command and pass after adding the helper.
- Work items 2 and 3: red (corpus/security/snapshot failures with placeholder
  metadata and stale counts), green (`make all` pass after refresh and guard
  updates).

Quality method (how we check): run `make all` for every work item; add
`make markdownlint` and `make nixie` for the Markdown work item. Review the
refresh JSON report and Git diff before committing generated changes.

## Idempotence and recovery

- `make refresh-fixtures` is idempotent: it only rewrites files whose derived
  content changed and reports `writtenPaths: []` when clean. Re-running after a
  successful refresh is safe and must produce no diff.
- Snapshot regeneration is safe to repeat; only regenerate after confirming the
  failure is the intended contract change, per `AGENTS.md`.
- If a `spanText` anchor is missing or duplicated, the refresh reports
  `missing-anchor`/`duplicate-anchor` and writes nothing; fix the anchor in the
  manifest and re-run rather than hand-editing spans.
- The filesystem canary and the extended per-fixture loop must remove any temp
  marker file in `afterEach`, so a failed run leaves no stray files. If a run is
  interrupted, remove any `odw-lint-hostile-*` file under the system temp
  directory.
- Each work item commits independently and gates with `make all`, so a failed
  work item can be reset without disturbing earlier committed work.

## Artefacts and notes

- The `meta-statically-unprovable` diagnostic message is the reviewed catalogue
  string `Workflow metadata must remain statically provable without evaluation.`
  and severity `warning`; the `diagnostic()` builder derives the branded rule id
  and `docs` path from `RULE_CATALOGUE`, so the manifest entry only supplies the
  raw rule string, severity, message, and `spanText`.
- Existing anchors for reference: `global-marker.js` and `throw-marker.js` both
  anchor on the whole `(() => { ... })()` IIFE; the new fixtures follow the same
  pattern.

## Interfaces and dependencies

No public `odw-lint` interface changes. The task adds:

- Two raw fixtures under
  `tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/`:
  `fs-write-marker.js` and `env-read-marker.js`.
- Two refresh-generated entries in the hostile-metadata manifest
  (`.../invalid-workflows/manifests/hostile-metadata.ts`).
- New test helpers in `hostile-metadata-security.test.ts` (or a colocated
  `hostile-metadata-observation.ts` support module) with signatures such as:

  ```typescript
  /** Returns the deterministic temp path for the filesystem side-effect marker. */
  export const hostileFilesystemMarkerPath: () => string;

  /** Reports whether the filesystem side-effect marker exists on disk. */
  export const hostileFilesystemMarkerExists: (path: string) => boolean;
  ```

All other consumers (`refresh-writers.ts` counts, the aggregate manifest, the
corpus and refresh tests) already derive their behaviour from the manifest
contents and only need their pinned literals and snapshots updated.

## Revision note

Round 1 draft. Establishes the four-channel goal, the two-fixture decision, the
refresh-driven metadata derivation, and the full list of count guards and
snapshots that move when the corpus grows. No implementation performed.
