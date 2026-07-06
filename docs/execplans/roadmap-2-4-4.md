# Add Ruff-compatible invocation semantics to the check command (roadmap 2.4.4)

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

After this change, `odw-lint check` behaves like a well-mannered `ruff check`
for the invocation surface that maps cleanly onto ODW workflow linting. A
workflow author, reviewer, or Continuous Integration (CI) maintainer can:

- redirect the report to a file with `--output-file <path>` instead of stdout;
- lint standard input under a stable logical path with
  `--stdin-filename <path>`;
- force Claude portability findings to errors from the command line with
  `--strict-claude`, without editing configuration;
- control CI failure policy with `--exit-zero` (never fail on findings) and
  `--exit-non-zero-on-fix` (fail when fixes were applied, once fix support
  lands);
- steer file selection with `--force-exclude` and
  `--respect-gitignore`/`--no-respect-gitignore`;
- discover the surface with `--help` and read the version with `--version`;
- and, crucially, trust that an **unreadable input file is represented the same
  way in human and machine output** — a JSON consumer can now tell a run that
  skipped a file apart from a clean run, instead of the file vanishing into a
  stderr line only.

Success is observable at the command line. For example, after the change:

```bash
bun run src/cli/main.ts check --version
# prints the package version, exits 0

bun run src/cli/main.ts check --help
# prints usage listing the implemented flags, exits 0

bun run src/cli/main.ts check --output-format json missing.js
# stdout JSON now carries an ioErrors array and summary.filesSkipped,
# stderr still carries the human "error: cannot read ..." line, exit 1
```

This is the fourth task of roadmap step 2.4 ("Ship the minimal `check`
command"). It requires roadmap 2.4.1 (the explicit-path `check` command),
2.4.2 (text output), and 2.4.3 (JSON output and the JSON contract fixture), all
complete on `main`. It deliberately implements only the invocation semantics
named in the roadmap 2.4.4 success criteria plus the machine-readable
unreadable-input requirement. Fix-mode flags (`--fix`, `--unsafe-fixes`,
`--diff`, `--fix-only`, `--show-fixes`), `--max-warnings`, glob and directory
discovery, the extra output formats (`json-lines`, `github`, `gitlab`, `junit`,
`sarif`), `--exclude`/`--extend-exclude`, colour and log-level flags, and any
cache flags are explicitly out of scope and are deferred to roadmap 3.3.2,
3.3.4, and later tasks. They are called out below so this slice does not
pre-empt them.

## Constraints

Hard invariants that must hold throughout implementation.

- Work happens only in the git-donkey worktree at
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-4-4` on branch
  `roadmap-2-4-4`. Never read-modify-write any file in the root/control
  checkout. All edit-tool paths are absolute under that worktree.
- Production code must not execute workflow source, evaluate metadata, import
  ODW runtime helpers, or start runs. Every new flag re-shapes the already-inert
  `DiagnosticReport` produced by the vetted `lintWorkflowSource` pipeline or
  gates file selection and process wiring around it
  (`docs/technical-design.md` §§5, 6.4; `docs/developers-guide.md`
  §"Static-Analysis Boundary"; `docs/adr/0001-static-analysis-boundary.md`).
- Exit-code policy stays faithful to `docs/technical-design.md` §7.4: `0` for a
  clean run, `1` for remaining diagnostics or unreadable input files (when other
  work can proceed), `2` for invalid configuration, invalid CLI usage, or
  internal analyser failure. `--exit-zero` downgrades only the diagnostics/
  read-failure `1` to `0`; it never masks a `2`.
- Filesystem, standard-input, and clock/randomness access go through injected
  seams on `CheckCliIo`, defaulting to the real Node/Bun APIs, so every test is
  deterministic without mutating process-wide state (`AGENTS.md`
  §"Runtime Validation & Types" — "Time & randomness"; §"Testing" —
  "Environment-dependent tests").
- No new runtime or dev dependency. Glob matching for `--force-exclude` uses the
  built-in `Bun.Glob`; stdin reading uses `node:fs` `readFileSync(0, "utf8")`;
  no argument-parsing, glob, or gitignore library is added.
- No production or test source file exceeds 400 lines (`AGENTS.md`
  §"Code Style and Structure"). The `check` argument parser is extracted to its
  own module before the flag surface grows (WI-1).
- The reviewed fixture corpus is single-sourced (roadmap 2.3.5). Corpus-driven
  tests consume the owner modules under `tests/static-analysis/fixtures/`; never
  inline corpus-location literals.
- The JSON envelope remains schema-valid against
  `src/diagnostics/schema.ts` (`DIAGNOSTIC_REPORT_SCHEMA`). Any envelope-shape
  change (WI-2) updates the schema literal, the golden JSON contract fixture,
  the affected snapshots, `docs/technical-design.md` §8, and a new ADR in the
  same commit, and keeps `schemaVersion` at `1` (see Decision Log).
- en-GB Oxford spelling ("-ize"/"-yse"/"-our") in all prose, comments, and
  commit messages (`AGENTS.md` §"Documentation Maintenance"; `en-gb-oxendict`
  skill).

## Tolerances (exception triggers)

- Scope: if any single work item requires touching more than ~14 files or adding
  more than ~400 net lines of production code, stop and escalate.
- Interface: if the unreadable-input requirement appears to need a `schemaVersion`
  bump, a new catalogued rule ID, or a diagnostic-object shape change (rather
  than the additive top-level `ioErrors`/`summary.filesSkipped` fields decided
  below), stop and escalate — those trigger the §8 schema-version review path.
- Dependencies: if a work item seems to need a new runtime or dev dependency
  (an argument parser such as commander/yargs, a glob library such as
  minimatch/fast-glob, or a gitignore parser), stop and escalate.
- Discovery creep: if a work item starts implementing directory traversal, glob
  operand expansion, configured include-root discovery, `--exclude`/
  `--extend-exclude`, `--max-warnings`, or any fix-mode flag, stop — those are
  roadmap 3.3.2/3.3.4 and later.
- Ambiguity: if `--respect-gitignore` or `--exit-non-zero-on-fix` cannot be
  given honest, observable v1 semantics on explicit paths without inventing
  discovery or fix behaviour, stop and present options (see the Decision Log
  rulings first).
- Iterations: if `make all` still fails after 3 focused attempts on one work
  item, stop and escalate with the failing gate output.

## Risks

- Risk: adding `ioErrors` and `summary.filesSkipped` to the JSON envelope
  ripples through every report snapshot, the golden JSON contract fixture, the
  schema literal, and the public-API surface.
  Severity: medium. Likelihood: high.
  Mitigation: WI-2 enumerates every affected artefact
  (`src/diagnostics/{types,report,report-json,schema,text}.ts`,
  `src/cli/run-check.ts`, `src/index.ts`, the diagnostics snapshots,
  `tests/diagnostics/json-contract.fixture.json`, the public-API fixtures) and
  updates them in one commit; a schema-conformance test proves the emitted
  envelope still validates.
- Risk: `--respect-gitignore`/`--no-respect-gitignore` read as inert on
  explicit paths and could be judged a §7.0 "near-miss".
  Severity: medium. Likelihood: medium.
  Mitigation: this is design-mandated behaviour, not a near-miss —
  `docs/technical-design.md` §7.2 states standard ignore files apply during
  *discovery* and §7.2 also says explicit paths are "used as provided". Ruff
  likewise never gitignore-filters explicitly passed files. The flags record a
  discovery posture with correct, documented v1 semantics and are pinned by a
  test asserting acceptance and non-interference (see the Decision Log ruling).
- Risk: `--exit-non-zero-on-fix` has no fixes to react to in v1, so it looks
  like dead code.
  Severity: low. Likelihood: medium.
  Mitigation: the flag is recognised with correct semantics; because no rule has
  fix support yet, no fixes are ever applied, so it correctly never changes the
  exit code. It is pinned by an acceptance test and documented as activating
  with the first safe fix (roadmap 3.3.4). Recorded in the Decision Log.
- Risk: standard-input reading breaks the synchronous `runCheckCli` contract.
  Severity: medium. Likelihood: low.
  Mitigation: the default stdin seam is the synchronous
  `readFileSync(0, "utf8")`, keeping `runCheckCli` synchronous; tests inject a
  `readStdin` seam and the e2e test pipes stdin through `Bun.spawnSync`.
- Risk: `Bun.Glob` matching semantics for `--force-exclude` differ from the
  configured `exclude` patterns' intent.
  Severity: low. Likelihood: medium.
  Mitigation: exclusion matching is a small pure helper pinned by table tests
  and a `fast-check` property test over generated path/pattern pairs; the helper
  is the single call site so behaviour cannot drift.
- Risk: `check-cli.ts` (already 379 lines) exceeds the 400-line ceiling as flags
  are added.
  Severity: medium. Likelihood: high.
  Mitigation: WI-1 extracts the parser to `src/cli/check-args.ts` first;
  rendering and file-selection helpers move to small sibling modules as needed;
  each work item re-checks the file-size gate.

## Progress

- [x] WI-1: Extract the check argument parser into a dedicated module
- [x] WI-2: Add a machine-readable IO-error channel and skipped-file summary
- [x] WI-3: Add the `--strict-claude` CLI flag overriding configuration
- [x] WI-4: Add `--output-file` output redirection
- [x] WI-5: Add `--stdin-filename` standard-input analysis
- [x] WI-6: Add `--exit-zero` and `--exit-non-zero-on-fix` exit-code policy
- [x] WI-7: Add `--force-exclude` and `--respect-gitignore` ignore handling
- [x] WI-8: Add `--help`, `--version`, and comprehensive usage text
- [x] WI-9: Add process-level flag coverage and finalize the guides
- [x] Fix round 1: reject empty equals-form values for string-value flags

## Surprises & discoveries

- Observation: `--output-file=` and `--stdin-filename=` still bypassed the
  WI-8 missing-value audit after the original implementation.
  Evidence: after adding focused tests, `bun test tests/cli/check-args.test.ts`
  failed because `--output-file=` returned the generic usage error and
  `--stdin-filename=` parsed as `stdinFilename: ""`; `bun test
  tests/cli/check-cli.test.ts` then showed the same user-facing failure at the
  CLI boundary.
  Impact: fix round 1 wired `EQUALS_STRING_VALUE_OPTIONS` through each
  option's existing `missingValueError` and added parser plus CLI regression
  coverage for the equals form.
- Observation: roadmap 2.4.3 explicitly deferred the machine-readable IO-error
  representation to this task.
  Evidence: `docs/execplans/roadmap-2-4-3.md` Decision Log — "read failures stay
  stderr-only CLI lines in JSON mode ... there is no catalogued IO-error rule
  yet, and inventing one is out of scope (roadmap 2.4.4)".
  Impact: WI-2 owns the machine-readable channel; the plan chooses an additive
  envelope field over a catalogued IO rule (see Decision Log).
- Observation: `docs/contents.md` indexes every top-level ExecPlan and issue
  file, enforced by a build gate.
  Evidence: `tests/build-gate/documentation-contents.test.ts` compares
  `docs/contents.md` links against `docs/execplans/*.md` and `docs/issues/*.md`.
  Impact: the first commit that adds this ExecPlan must also link it from
  `docs/contents.md`, or `make all` fails.
- Observation: adding a diagnostics module or a public export requires updating
  the architecture fixtures and the public-API/public-consumer snapshots in the
  same commit.
  Evidence: `docs/execplans/roadmap-2-4-3.md` Surprises — the report-json module
  and export failed `tests/diagnostics/architecture.test.ts`,
  `package-entry.test.ts`, and `public-consumer.test.ts` until the fixtures were
  updated.
  Impact: WI-2 keeps `tests/diagnostics/architecture-fixtures.ts` and the
  public-API fixtures synchronised when it adds the IO-error type and exports.
- Observation: exporting `parseCheckArgs` from the new parser module made its
  JSDoc subject to the repository's public-symbol lint rule.
  Evidence: the first scrutineer gate run failed `make all`/`make lint` with
  `df12(require-public-jsdoc)` at `src/cli/check-args.ts:55:1`, requiring
  parameter and return documentation.
  Impact: WI-1 added public JSDoc for `parseCheckArgs`; the rerun passed
  `make all`, `make check-fmt`, `make typecheck`, `make lint`, `make test`,
  `make markdownlint`, and `make nixie`.
- Observation: adding `filesSkipped` and `ioErrors` to the diagnostic envelope
  exposed two older whole-report shape assertions outside the WI-2 focused
  diagnostics suites.
  Evidence: the first scrutineer run after implementation failed
  `make typecheck` at `tests/diagnostics/types.test.ts:122` and `make test` at
  `tests/static-analysis/source-diagnostic.test.ts`, both because their
  expected diagnostic report shapes still omitted the additive fields.
  Impact: WI-2 updated those existing contract assertions alongside the focused
  report, JSON, schema, text, CLI and public-consumer tests so the repository
  agrees on the new envelope.
- Observation: exported test helpers are covered by the same public JSDoc lint
  rule as production helpers.
  Evidence: the second scrutineer run failed `make all`/`make lint` with
  `df12(require-public-jsdoc)` for the new `ioErrorFor` fixture helper in
  `tests/diagnostics/fixtures.ts`.
  Impact: WI-2 documented the helper parameters and return value, then the
  final scrutineer run passed `make all`, `make check-fmt`, `make typecheck`,
  `make lint`, `make test`, `make markdownlint`, and `make nixie`.
- Observation: adding `--strict-claude` directly to `parseCheckOption` pushed
  that parser helper over the Oxlint complexity threshold.
  Evidence: the first WI-3 scrutineer run failed `make all` and `make lint` at
  `src/cli/check-args.ts:130:26` with `eslint(complexity): function has a
  complexity of 9. Maximum allowed is 8.`
  Impact: WI-3 extracted value-less option parsing into
  `parseValueLessCheckOption`, keeping the parser readable and under the
  project threshold. The rerun passed `make all`, `make check-fmt`,
  `make typecheck`, `make lint`, `make test`, `make markdownlint`, and
  `make nixie`.
- Observation: adding the second value-taking output option pushed the parser
  helper back over the Oxlint complexity threshold.
  Evidence: the local WI-4 lint pass failed `make lint` with
  `eslint(complexity)` for `src/cli/check-args.ts`, first at
  `parseCheckOption` and then at `parseValueCheckOption`.
  Impact: WI-4 split value-taking parsing into separate two-token and
  `--option=value` helpers. The final delegated scrutineer run passed
  `make all`, `make check-fmt`, `make typecheck`, `make lint`, and `make test`.
- Observation: adding `--stdin-filename` made the parser's accumulated state
  validation and value-option parsing exceed the local complexity gates again.
  Evidence: the first WI-5 delegated scrutineer run passed `make check-fmt`,
  `make typecheck`, and `make test`, but failed `make all`/`make lint` with
  `eslint(complexity)` at `src/cli/check-args.ts`; after that fix, a focused
  local `make lint` reported `df12(complex-conditional)` for the final-state
  usage check.
  Impact: WI-5 split command-tail parsing, final-state validation, shared
  string-value option parsing, and final-state predicates into named helpers.
  The rerun passed `make all`, `make check-fmt`, `make typecheck`, `make lint`,
  and `make test`.
- Observation: `tests/cli/check-cli.test.ts` was already close to the
  repository's 400-line code-file ceiling before WI-6.
  Evidence: local `wc -l` reported 375 lines for `tests/cli/check-cli.test.ts`
  before adding the exit-policy tests.
  Impact: WI-6 placed the new CLI policy coverage in
  `tests/cli/check-cli-exit-policy.test.ts` instead of expanding
  `check-cli.test.ts`. This keeps the test suite focused while preserving the
  file-size invariant.
- Observation: adding `--exit-zero` and `--exit-non-zero-on-fix` exposed two
  lint constraints in the first delegated gate run.
  Evidence: the first WI-6 scrutineer run failed `make all`/`make lint` with
  `df12(require-private-jsdoc)` in `src/cli/check-args.ts` after local comment
  trimming, and `df12(complex-conditional)` in `src/cli/check-cli.ts` for the
  new exit-policy expressions.
  Impact: WI-6 restored the required private JSDoc, kept
  `src/cli/check-args.ts` at 399 lines, and split the exit-policy logic into
  guard clauses. The delegated rerun passed `make all`, `make check-fmt`,
  `make typecheck`, `make lint`, and `make test`.
- Observation: `Bun.Glob` matches `**/generated/**` against both root and nested
  generated paths, and `*.js` does not cross directory separators.
  Evidence: a scratch Bun check in the task worktree printed `true` for
  `**/generated/** generated/workflow.js`, `**/generated/**
  src/generated/workflow.js`, and `generated/** generated/workflow.js`, but
  `false` for `*.js nested/workflow.js`.
  Impact: WI-7 can use `new Bun.Glob(pattern).match(path)` directly for the
  configured `exclude` patterns used by `--force-exclude`; focused table and
  `fast-check` property tests pin the generated-path behaviour.
- Observation: adding the WI-7 parser fields pushed `src/cli/check-args.ts`
  beyond the 400-line code-file ceiling.
  Evidence: local `wc -l` reported 424 lines after the first parser pass. After
  extracting output-format parsing to `src/cli/check-output-format.ts`, local
  `wc -l` reported 393 lines for `src/cli/check-args.ts`.
  Impact: WI-7 kept the parser under the project file-size gate while leaving
  the change local to check-argument parsing. A local lint pass required public
  JSDoc for the new exported `parseOutputFormatValue` helper before the final
  scrutineer run passed.
- Observation: adding help/version outcomes to the parser pushed
  `src/cli/check-args.ts` over the 400-line code-file ceiling again.
  Evidence: local `wc -l` reported 428 lines after the first WI-8 parser pass,
  and 409 lines after moving help/version recognition into a sibling module.
  After extracting static option tables to `src/cli/check-option-tables.ts`,
  local `wc -l` reported 384 lines for `src/cli/check-args.ts`.
  Impact: WI-8 keeps parsing under the file-size invariant with two small
  colocated helper modules: `src/cli/check-informational-action.ts` for
  `--help`/`--version` token recognition and `src/cli/check-option-tables.ts`
  for static option metadata.
- Observation: `--output-format` previously used the unsupported-format path
  for a missing separate value.
  Evidence: the existing parser test expected `unsupported output format:` for
  `["check", "--output-format"]`.
  Impact: WI-8 changed the missing separate value and empty equals value to the
  common `missing value for --output-format` usage error required by this work
  item, while preserving unsupported-value diagnostics such as
  `unsupported output format: json-lines`.
- Observation: process-level stdin coverage needs Bun's typed `stdin` option to
  receive a `Blob`, not a raw string.
  Evidence: a scratch `Bun.spawnSync` check rejected `stdin: "abc"` with
  `ERR_INVALID_ARG_TYPE`, and the first delegated WI-9 scrutineer run caught a
  TypeScript overload mismatch when the test built a conditional `stdio` tuple.
  Impact: WI-9 feeds stdin through `stdin: new Blob([sourceText])`, which
  matches Bun's runtime and type definitions while preserving a real child
  process contract test.

## Decision log

- Decision: represent unreadable inputs with an additive machine-readable error
  channel in the existing envelope — a top-level `ioErrors` array (always
  emitted, empty on clean runs) plus a `summary.filesSkipped` count — while
  keeping `schemaVersion` at `1`.
  Rationale: the roadmap 2.4.4 text offers two options ("catalogued IO
  diagnostics or an explicit machine-readable error channel"). A catalogued rule
  is semantically wrong (an IO failure is not a workflow-content violation) and
  would expand `RULE_IDS`, the schema enum, rule docs, and parity tests
  (`docs/technical-design.md` §8, §9). An additive top-level field is the
  minimal honest change. `schemaVersion` stays `1` because the envelope is
  pre-release (package version `0.0.0`, private, no external consumers needing
  compatibility logic), which is exactly the condition §8 gives for not bumping
  ("schemaVersion changes only when JSON consumers need compatibility logic").
  Existing consumers reading known fields remain compatible. Because this
  changes public JSON behaviour, it is recorded in a new ADR
  (`docs/adr/0004-machine-readable-io-error-channel.md`) and in
  `docs/technical-design.md` §8, per `AGENTS.md` §"Documentation Maintenance".
  Date/Author: 2026-07-06, planning agent.
- Decision: `summary.files` continues to count only readable (checked) files;
  `summary.filesSkipped` counts unreadable input files. The human text report
  gains a skipped-file note in its footer so text and JSON agree.
  Rationale: satisfies "JSON consumers and summaries can distinguish skipped
  files from clean runs" for both output modes without redefining the existing
  `files` count.
  Date/Author: 2026-07-06, planning agent.
- Decision: keep the per-file `error: cannot read <path>: <message>` lines on
  stderr in addition to the new machine-readable channel.
  Rationale: preserves the roadmap 2.4.1/2.4.3 human contract and CI logs while
  adding the machine channel; the two are complementary, not a replacement.
  Date/Author: 2026-07-06, planning agent.
- Decision: `--strict-claude` on the command line overrides configuration by
  forcing `strictClaude` true for the invocation.
  Rationale: `docs/technical-design.md` §10 — "CLI flags override
  configuration"; §7.3 lists `--strict-claude`; §9.2 defines the promotion.
  There is no `--no-strict-claude` in the 2.4.4 success list, so only the
  promote direction is added.
  Date/Author: 2026-07-06, planning agent.
- Decision: `--respect-gitignore`/`--no-respect-gitignore` are recognised
  value-less flags that record a discovery posture with no path-filtering effect
  on explicit paths in v1.
  Rationale: `docs/technical-design.md` §7.2 scopes ignore-file handling to
  discovery/traversal, which is deferred; explicit paths are "used as provided".
  This matches Ruff (gitignore never filters explicitly passed files) and is
  design-mandated (§7.0 lists the flag), so it is not a §7.0 near-miss. Pinned
  by an acceptance/non-interference test.
  Date/Author: 2026-07-06, planning agent.
- Decision: `--force-exclude` filters *explicit* paths against the configured
  `exclude` globs (via `Bun.Glob`); without it, explicit paths are always
  checked.
  Rationale: `docs/technical-design.md` §7.2 — "`--force-exclude` applies
  exclusions even to paths passed explicitly on the command line". This is the
  one exclusion behaviour with observable v1 meaning on explicit paths;
  `--exclude`/`--extend-exclude` (which *define* the pattern set) are deferred to
  a discovery task and are out of scope here. Excluded paths are skipped
  silently — neither read, counted in `files`, nor reported as `ioErrors`.
  Date/Author: 2026-07-06, planning agent.
- Decision: `--exit-non-zero-on-fix` is recognised with correct semantics but
  never changes the exit code in v1 because no rule has fix support.
  Rationale: `docs/technical-design.md` §7.3/§7.4 define it relative to applied
  fixes; fix support is roadmap 3.3.4. Recognising it now with an acceptance
  test is forward-compatible and honest (it activates automatically when fixes
  exist), and avoids a later parser breaking change.
  Date/Author: 2026-07-06, planning agent.
- Decision: `--help`/`-h` and `--version`/`-V` are informational parser outcomes
  that bypass configuration loading, file reads, diagnostics, and the no-paths
  usage error.
  Rationale: help and version are command-discovery actions, not check runs.
  Returning them as a distinct successful parser outcome lets `runCheckCli`
  print stable stdout-only text and exit `0` without invoking any analysis or
  filesystem seams.
  Date/Author: 2026-07-06, build agent for WI-8.
- Decision: missing values for implemented value-taking options use
  `missing value for <flag>`, including `--output-format`.
  Rationale: WI-8 explicitly requires consistent missing-option-value
  diagnostics for implemented flags. Unsupported values still use the
  output-format validator's existing `unsupported output format: <value>`
  diagnostic, so users can distinguish omission from a recognised-but-invalid
  value.
  Date/Author: 2026-07-06, build agent for WI-8.
- Decision: the equals-form string-value parser treats an empty suffix as a
  missing value for each implemented string flag.
  Rationale: shell expansion such as `--stdin-filename=$VAR` can produce
  `--stdin-filename=`. Treating that as a present empty value causes stdin mode
  to run under an empty logical path, and treating `--output-file=` as a present
  empty value defers the error to file writing. The option table already carried
  per-flag `missingValueError` strings, so the parser now rejects empty
  equals-form values at the CLI usage boundary with exit `2`.
  Date/Author: 2026-07-06, fix-round agent.
- Decision: `--stdin-filename <path>` switches the command to standard-input
  mode; supplying positional path operands alongside it is a usage error
  (exit 2).
  Rationale: `docs/technical-design.md` §7.2 — "`--stdin-filename` is required
  when reading stdin so diagnostics have a stable path". Making the flag the
  explicit stdin trigger avoids inventing a `-` operand convention that the
  design does not specify, and keeps operand handling unambiguous.
  Date/Author: 2026-07-06, planning agent.
- Decision: WI-9 process-level coverage lives in a new focused e2e test file
  rather than extending `tests/cli/check-cli-corpus.e2e.test.ts`.
  Rationale: the existing corpus process suite already owns explicit-path
  corpus sampling. A focused `tests/cli/check-cli-flags.e2e.test.ts` keeps the
  new flag assertions readable, under the 400-line code-file ceiling, and
  scoped to invocation semantics rather than corpus representativeness.
  Date/Author: 2026-07-06, build agent for WI-9.
- Decision: Ruff-parity behavioural claims derive from
  `docs/technical-design.md` §§7.0–7.4 and §8 (the repository source of truth)
  and are pinned by tests, rather than from live Ruff documentation.
  Rationale: the standing rules make `docs/` the source of truth, and the design
  already specifies each flag's meaning. A live Ruff-docs fetch via `firecrawl`
  was attempted during planning but the `firecrawl_scrape` tool required an
  ungranted permission; the design doc plus test pins satisfy the
  "verified-and-cited or pinned by a test" bar without it.
  Date/Author: 2026-07-06, planning agent.

## Outcomes & retrospective

WI-1 delivered the behaviour-preserving parser extraction. `src/cli/check-cli.ts`
now keeps runner, configuration, rendering and IO orchestration concerns, while
`src/cli/check-args.ts` owns the current `check` argument grammar and exported
parser contract. The focused parser tests in `tests/cli/check-args.test.ts`
cover the existing command, output-format, configuration, isolated-mode and
usage-error semantics before later Ruff-compatible flags are added.

The WI-1 file-size budget remains within tolerance: `src/cli/check-cli.ts` is
180 lines, `src/cli/check-args.ts` is 202 lines, and
`tests/cli/check-args.test.ts` is 83 lines. No invocation behaviour changed; the
existing CLI and configuration-aware suites stayed green.

WI-2 added the machine-readable IO-error channel selected in the Decision Log.
`DiagnosticReport` now always carries `ioErrors`; `DiagnosticSummary` now
contains `filesSkipped`; JSON output emits both additive fields with
`schemaVersion` still at `1`; and text output prints skipped-file footers for
skip-only and mixed diagnostic/read-failure runs. `runCheck` maps
`WorkflowSourceReadFailure` values into the report while preserving the existing
CLI stderr lines and exit-code policy. The public package entry exports the new
`IoError` type, and the schema literal, golden JSON contract fixture, snapshots,
public API fixtures and source-span report-shape tests now pin the new envelope.

WI-2 also recorded the design in
`docs/adr/0004-machine-readable-io-error-channel.md`, updated
`docs/technical-design.md` §8, and linked the ADR from `docs/contents.md`.
Focused Red-Green-Refactor evidence was captured by first adding failing tests
for missing `filesSkipped`, `ioErrors`, schema entries, text skipped-file
footers, and CLI JSON/read-failure output, then making the report, renderer,
schema and CLI aggregation changes. The final delegated scrutineer run passed
`make all`, `make check-fmt`, `make typecheck`, `make lint`, `make test`,
`make markdownlint`, and `make nixie` after this ExecPlan tick was recorded.

WI-4 added `--output-file <path>` and `--output-file=<path>` to the check
argument parser, with the planned `missing value for --output-file` usage error.
`runCheckCli` now exposes a `writeFileText` seam that defaults to
`writeFileSync(path, contents, "utf8")`, and writes the exact rendered report
bytes that would have gone to stdout, including the trailing newline for
non-empty reports, to the selected file. Stderr read-failure and configuration
warning output remains unchanged.

Focused tests cover parser acceptance, missing-value rejection, JSON report file
redirection, and full text report file redirection. The implementation kept the
parser under the complexity gate by splitting recognised value-taking options
into two-token and equals-form helpers. The delegated scrutineer gate run passed
`make all`, `make check-fmt`, `make typecheck`, `make lint`, and `make test`
before this progress update was recorded.

WI-5 added `--stdin-filename <path>` and `--stdin-filename=<path>` to the check
argument parser. When the flag is present, zero positional operands is now a
valid stdin-mode invocation, and combining the flag with path operands returns
the planned usage error
`--stdin-filename cannot be combined with path operands`.

`runCheckCli` now exposes a `readStdin` seam that defaults to
`readFileSync(0, "utf8")`. In stdin mode the command reads standard input once
and lints it through the existing `runCheck` path under the logical
`stdinFilename`, so diagnostics preserve the supplied file name while keeping
the synchronous CLI contract. Focused parser and CLI tests cover separate and
equals-form parsing, missing values, operand-combination rejection, invalid
stdin diagnostics, and clean stdin output.

The first delegated WI-5 gate run found parser complexity regressions after the
new value option was added. The parser was then split into command-tail,
final-state validation, string-value option, and predicate helpers. The final
delegated scrutineer run passed `make all`, `make check-fmt`, `make typecheck`,
`make lint`, and `make test` before this progress update was recorded.

WI-6 added value-less `--exit-zero` and `--exit-non-zero-on-fix` parsing to the
check argument parser. The CLI now applies invocation-level exit policy after
rendering reports and read-failure stderr: `--exit-zero` downgrades the normal
diagnostics/read-failure exit code `1` to `0`, while usage, configuration, and
internal failures still return `2`.

`--exit-non-zero-on-fix` is accepted and wired into the policy step, but remains
inert in v1 because no rules apply fixes yet. Focused parser tests pin both new
flags, and `tests/cli/check-cli-exit-policy.test.ts` covers diagnostic,
unreadable-input, usage-error, clean, and invalid-workflow cases. The tests live
in a new focused file rather than `tests/cli/check-cli.test.ts` to preserve the
400-line code-file invariant. The final delegated scrutineer run passed
`make all`, `make check-fmt`, `make typecheck`, `make lint`, and `make test`.

WI-7 added value-less `--force-exclude`, `--respect-gitignore`, and
`--no-respect-gitignore` parsing. `--respect-gitignore` defaults to `true`, and
the positive and negative forms use last-wins semantics while remaining a
recorded discovery posture with no explicit-path filtering in v1.

`src/cli/path-exclusion.ts` now owns the pure `Bun.Glob` exclusion helper, and
`runCheckCli` filters explicit and stdin-logical paths through configured
`exclude` globs only when `--force-exclude` is set. Excluded paths are not read,
not counted in `summary.files`, and not represented as `ioErrors`, matching the
Decision Log ruling. Focused parser tests, table/property helper tests, and
configuration-aware CLI tests cover forced exclusion and gitignore posture
non-interference. The final delegated scrutineer run passed `make all`,
`make check-fmt`, `make typecheck`, `make lint`, and `make test`; after this
ExecPlan update, local `make markdownlint` and `make nixie` also passed.

WI-8 added informational `--help`/`-h` and `--version`/`-V` parsing. These
actions now return `0`, write only to stdout, and bypass configuration loading,
file reads, diagnostics, and the no-paths usage error. The help text lists the
implemented flag surface for roadmap 2.4.4, including output selection,
redirection, configuration, stdin, exclusion, gitignore posture, exit policy,
help, and version flags.

WI-8 also aligned value-taking option diagnostics so `--output-format`,
`--output-file`, `--config`, and `--stdin-filename` all report
`missing value for <flag>` when the option value is omitted. The parser stayed
under the 400-line file-size ceiling by extracting help/version token
recognition to `src/cli/check-informational-action.ts` and static option tables
to `src/cli/check-option-tables.ts`. Focused coverage lives in
`tests/cli/check-cli-help.test.ts`, with the existing parser test updated for
the `--output-format` missing-value message. The delegated scrutineer run passed
`make all`, `make check-fmt`, `make typecheck`, `make lint`, and `make test`
before this ExecPlan update; after this ExecPlan update, local
`make markdownlint` and `make nixie` also passed.

WI-9 completed the process-level coverage and guide finalization. The new
`tests/cli/check-cli-flags.e2e.test.ts` spawns the real Bun entrypoint for
`--version`, `--help`, `--output-file`, `--stdin-filename`, `--strict-claude`,
`--exit-zero`, and JSON missing-path IO-error output. The assertions check
structural fields, exit codes, and stable rule/severity signals without
snapshotting absolute paths.

`docs/users-guide.md` now presents the implemented flags as available,
separates the remaining planned flags, documents `summary.filesSkipped` and
`ioErrors`, and removes the stale "configuration is planned" note. The
developer guide now names the parser/helper modules, the `writeFileText` and
`readStdin` seams, the `path-exclusion` helper, the machine-readable IO channel,
and the flags still deferred to discovery, fixing, colour, log-level, and extra
output-format work.

The first WI-9 delegated scrutineer run caught a stale local stdin test shape
that failed `make all` type checking. After switching the process test to
`stdin: new Blob([sourceText])`, local validation passed `make all`,
`make markdownlint`, and `make nixie`; the final delegated scrutineer run passed
`make all`, `make check-fmt`, `make typecheck`, `make lint`, `make test`,
`make markdownlint`, and `make nixie`.

Fix round 1 resolved the blocking review finding for the WI-8 missing-value
audit. `parseEqualsStringValueOption` now rejects empty equals-form values
using the `missingValueError` already defined in
`src/cli/check-option-tables.ts`, so `--output-file=` and
`--stdin-filename=` both fail before runtime IO or stdin analysis begins.
`tests/cli/check-args.test.ts` covers parser-level `missing value for
<flag>` results for separate and equals forms, and
`tests/cli/check-cli.test.ts` covers the user-facing exit `2` behaviour for
`--output-file=` and `--stdin-filename=`.

Focused Red-Green-Refactor evidence: the new parser tests first failed because
`--output-file=` returned the generic usage string and `--stdin-filename=`
returned a successful parsed stdin mode with an empty logical filename. The new
CLI tests first failed with the same parser errors reflected at the command
boundary. After the parser fix, `bun test tests/cli/check-args.test.ts` passed
27 tests, and `bun test tests/cli/check-cli.test.ts` passed 21 tests.

## Context and orientation

`odw-lint` is a private Bun/TypeScript package that statically lints Open
Dynamic Workflow (ODW) `*.js` files without executing them. The `check` command
is the user-facing surface this task extends.

Relevant source modules (full repository-relative paths):

- `src/cli/main.ts` — the thin Bun entrypoint; calls `runCheckCli`.
- `src/cli/check-cli.ts` — `runCheckCli(args, io)`: parses arguments, loads
  configuration, wires writers/readers, renders the report, prints read
  failures, and returns the exit code (`0 | 1 | 2`). Currently 379 lines with
  the argument parser inlined; extracted in WI-1.
- `src/cli/run-check.ts` — `runCheck(request)` reads explicit paths, lints
  readable sources, applies configured severities then strict-Claude promotion,
  and returns `{ report, readFailures }`; `checkDiagnosticsExitCode(outcome)`
  derives the default `0 | 1`.
- `src/cli/read-workflow-source.ts` — `readWorkflowSource(path, options)` with
  the `ReadFileText` seam and the structured `WorkflowSourceReadFailure`
  (`reason: "not-found" | "not-a-file" | "unreadable"`, `message`).
- `src/config/load-config.ts`, `src/config/linter-config.ts` — optional
  configuration loading and validation (roadmap 3.3.1). `LinterConfig` carries
  `include`, `exclude`, `strictClaude`, and `rules`.
- `src/diagnostics/types.ts` — `Diagnostic`, `DiagnosticReport`,
  `DiagnosticSummary`, `SourceSpan`, `SourcePosition`, and the constants
  `DIAGNOSTIC_SCHEMA_VERSION` (`1`) and `TOOL_NAME` (`"odw-lint"`).
- `src/diagnostics/report.ts` — `createDiagnosticReport({ version, files,
  diagnostics })` and `countDiagnostics`.
- `src/diagnostics/report-json.ts` — `formatJsonReport(report)`, the canonical
  §8 JSON projection.
- `src/diagnostics/text.ts` — `formatTextReport(report)` and
  `formatTextDiagnostics(diagnostics)`.
- `src/diagnostics/schema.ts` — `DIAGNOSTIC_REPORT_SCHEMA` literal.
- `src/index.ts` — the private package entry; its named re-exports are pinned by
  `tests/diagnostics/public-api-fixtures.ts`,
  `tests/diagnostics/package-entry.test.ts`, and
  `tests/diagnostics/public-consumer.test.ts` (snapshot).

Relevant tests:

- `tests/cli/check-cli.test.ts` — direct `runCheckCli` tests with captured
  writers and injected readers.
- `tests/cli/check-cli-config.test.ts` — configuration-aware CLI tests.
- `tests/cli/check-cli-corpus.e2e.test.ts` — spawned-process contract tests via
  `Bun.spawnSync(["bun", "run", "src/cli/main.ts", "check", ...])`.
- `tests/cli/run-check.test.ts`, `tests/cli/read-workflow-source.test.ts`.
- `tests/diagnostics/` — report, report-json, schema, json-contract, text,
  architecture, and public-API suites plus their `__snapshots__`.

Terms of art. A **diagnostic report envelope** is the versioned JSON object of
`docs/technical-design.md` §8. An **IO error** here is a structured
unreadable-input record (`file`, `reason`, `message`) surfaced to machine
consumers, distinct from a workflow-content **diagnostic**. A **seam** is an
injectable function on `CheckCliIo` (reader, writer, stdin) that defaults to a
real Node/Bun API so tests stay deterministic.

Design sources of truth: `docs/technical-design.md` §§7.0 (UX precedent), 7.1
(commands), 7.2 (file discovery), 7.3 (flags), 7.4 (exit codes), 8 (diagnostic
contract), 10 (configuration); `docs/developers-guide.md` §"CLI";
`docs/users-guide.md` §§"Command shape", "Exit codes", "Diagnostic reports";
`docs/repository-layout.md` §"Source boundaries";
`docs/adr/0001-static-analysis-boundary.md`; `docs/documentation-style-guide.md`;
`AGENTS.md` §§"TypeScript Guidance", "Testing", "Error Handling",
"Documentation Maintenance".

Skills to load for every work item: `execplans` (this plan) and
`en-gb-oxendict` (spelling). This repository has no TypeScript router skill;
follow `AGENTS.md` §"TypeScript Guidance" instead. Python verification skills
(`hypothesis`, `crosshair`, `mutmut`) do not apply to TypeScript; use `fast-check`
property tests, Bun snapshot tests, and table-driven tests per `AGENTS.md`
§"Testing". Use `leta` for symbol navigation and reference checks before
changing any signature, and `grepai` for intent searches against `main`.

## Plan of work

Each work item is atomic, independently committable, and `make all`-green,
delivered Red-Green-Refactor: add the smallest failing test first, make the
minimal production change, then refactor. Do not proceed to the next work item
until the current one's validation passes. WI-1 lands first because it removes
the file-size obstacle for every later flag. WI-2 is independent of the flags
and can follow immediately. WI-3 through WI-7 add one flag group each. WI-8 adds
`--help`/`--version` and the consolidated usage text once the full flag set
exists. WI-9 adds process-level coverage and finalises the guides.

### WI-1: Extract the check argument parser into a dedicated module

Implements the `AGENTS.md` §"Code Style and Structure" 400-line ceiling and the
§"TypeScript Guidance" small-module guidance ahead of the flag surface. Behaviour
preserving.

Read first: `src/cli/check-cli.ts`; `tests/cli/check-cli.test.ts`,
`tests/cli/check-cli-config.test.ts`; `AGENTS.md` §§"Code Style and Structure",
"TypeScript Guidance". Skills: `execplans`, `en-gb-oxendict`. Use
`leta refs runCheckCli` and `leta show parseCheckArgs` to confirm call sites
before moving code.

Work:

1. Create `src/cli/check-args.ts` exporting the parsed-argument types
   (`ParsedCheckArgs`, the output-format union) and `parseCheckArgs(args)`,
   moved verbatim from `check-cli.ts` with a `/** @file */` block. Keep helper
   functions private to the module.
2. In `src/cli/check-cli.ts`, import from `./check-args` and delete the moved
   definitions, leaving `runCheckCli`, writer/reader wiring, rendering, and
   config loading. Confirm `check-cli.ts` is comfortably under 400 lines.
3. No behaviour change: the same tokens parse to the same results and the same
   usage errors.

Tests (Red first): add `tests/cli/check-args.test.ts` with focused unit tests
for the parser in isolation — `check` with paths, unknown option, unknown
command, `--output-format`/`--output-format=` (valid and unsupported values),
`--config` with and without a value, `--isolated`, and the no-operands/no-paths
usage errors. The existing `tests/cli/check-cli*.test.ts` suites are the
behavioural guard and must stay green unchanged.

Red evidence: the new `check-args.test.ts` fails to import
`parseCheckArgs`/`ParsedCheckArgs` from `./check-args` (module missing). Green:
create the module and re-point imports. Refactor: none beyond the extraction.
Validation: `make all`.

Note: the first commit on this work item also adds the ExecPlan link to
`docs/contents.md` (required by `tests/build-gate/documentation-contents.test.ts`
now that `docs/execplans/roadmap-2-4-4.md` exists). Format only the touched
markdown: `bunx mdtablefix --in-place docs/contents.md` then
`bunx markdownlint-cli2 --fix docs/contents.md`, then run the markdown gates.

### WI-2: Add a machine-readable IO-error channel and skipped-file summary

Implements the roadmap 2.4.4 requirement to "represent unreadable inputs
consistently across human and machine-readable output" and the Decision Log
additive-envelope ruling. Touches `docs/technical-design.md` §8 and adds
`docs/adr/0004-machine-readable-io-error-channel.md`.

Read first: `docs/technical-design.md` §8; `src/diagnostics/types.ts`,
`src/diagnostics/report.ts`, `src/diagnostics/report-json.ts`,
`src/diagnostics/schema.ts`, `src/diagnostics/text.ts`; `src/cli/run-check.ts`,
`src/cli/check-cli.ts`, `src/cli/read-workflow-source.ts`;
`tests/diagnostics/json-contract.fixture.json` and the diagnostics
`__snapshots__`; `docs/adr/0001-static-analysis-boundary.md` for ADR format;
`AGENTS.md` §§"Error Handling", "Testing", "Documentation Maintenance". Skills:
`execplans`, `en-gb-oxendict`.

Work:

1. In `src/diagnostics/types.ts`, add an `IoError` type
   (`{ file: string; reason: "not-found" | "not-a-file" | "unreadable";
   message: string }`), add `readonly ioErrors: readonly IoError[]` to
   `DiagnosticReport`, and add `readonly filesSkipped: number` to
   `DiagnosticSummary`.
2. In `src/diagnostics/report.ts`, extend `createDiagnosticReport` to accept
   `ioErrors` and thread `filesSkipped = ioErrors.length` into the summary;
   `countDiagnostics` gains the `filesSkipped` field. Freeze the new arrays.
3. In `src/diagnostics/report-json.ts`, project `summary.filesSkipped` and a
   top-level `ioErrors` array (always emitted, `[]` when empty) into the §8 key
   order (place `ioErrors` after `diagnostics`; place `filesSkipped` after
   `files` in `summary`).
4. In `src/diagnostics/schema.ts`, add `filesSkipped` to the summary
   `required`/`properties` and add `ioErrors` (array of objects with `file`,
   `reason` enum, `message`) to the envelope `required`/`properties`, keeping
   `additionalProperties: false`.
5. In `src/diagnostics/text.ts`, extend `formatTextReport` so the footer notes
   skipped files even when there are zero diagnostics — for example
   `Found 1 error; skipped 1 file.` and, for a diagnostic-free skip-only run,
   `Skipped 1 file.` Define exact singular/plural wording and pin it.
6. In `src/cli/run-check.ts`, map each `WorkflowSourceReadFailure` to an
   `IoError` and pass them into `createDiagnosticReport`; keep the returned
   `readFailures` so `check-cli.ts` can still write the stderr lines.
7. In `src/cli/check-cli.ts`, keep writing the per-file stderr lines and let the
   report (text or JSON) carry the machine channel; no exit-code change.
8. Export `IoError` from `src/index.ts` and update
   `tests/diagnostics/public-api-fixtures.ts`,
   `tests/diagnostics/architecture-fixtures.ts` (if the type triggers an
   inventory check), and the `public-consumer` snapshot.
9. Update `tests/diagnostics/json-contract.fixture.json` to include the empty
   `ioErrors` array and `summary.filesSkipped: 0`; refresh the affected
   diagnostics snapshots after confirming each diff is exactly this addition.
10. Add `docs/adr/0004-machine-readable-io-error-channel.md` and a paragraph in
    `docs/technical-design.md` §8 documenting `ioErrors` and
    `summary.filesSkipped`, `schemaVersion` staying `1`, and `summary.files`
    remaining the readable-file count.

Tests (Red first):

- Unit (`tests/diagnostics/report.test.ts`,
  `tests/diagnostics/report-json.test.ts`,
  `tests/diagnostics/schema.test.ts`): a report built with two read failures has
  `summary.filesSkipped === 2` and two `ioErrors`; the JSON projection emits
  `ioErrors` (with the right `reason`) and `summary.filesSkipped`, validates
  against `DIAGNOSTIC_REPORT_SCHEMA`, and a clean report emits `ioErrors: []`
  and `filesSkipped: 0`.
- Unit (`tests/diagnostics/text.test.ts`): footer wording for
  diagnostics-only, skip-only, and mixed reports (snapshot plus semantic
  assertions).
- CLI (`tests/cli/check-cli.test.ts`): a JSON run over a missing path now emits
  `ioErrors[0].file` / `.reason` and `summary.filesSkipped >= 1` on stdout while
  the stderr `error: cannot read ...` line and exit `1` are unchanged; a text
  run over a skip-only invocation prints the skipped-file footer on stdout.

Red evidence: report/report-json/schema tests fail on the missing fields; the
json-contract parity test fails until the golden gains `ioErrors`/`filesSkipped`.
Green: add the fields, projection, schema, and text footer; update the golden and
snapshots. Refactor: extract an `ioErrorFromReadFailure` helper if `run-check.ts`
grows. Validation: `make all`, then `make markdownlint` and `make nixie` for the
§8 and ADR markdown.

### WI-3: Add the `--strict-claude` CLI flag overriding configuration

Implements `docs/technical-design.md` §7.3 (`--strict-claude`), §9.2 (Claude
promotion), and §10 ("CLI flags override configuration").

Read first: `docs/technical-design.md` §§7.3, 9.2, 10;
`src/diagnostics/strict-claude.ts`, `src/cli/run-check.ts`,
`src/cli/check-cli.ts`, `src/cli/check-args.ts`, `src/config/linter-config.ts`;
`tests/cli/check-cli-config.test.ts`. Skills: `execplans`, `en-gb-oxendict`. Use
`leta refs promoteStrictClaudeSeverity` to confirm the promotion call site.

Work:

1. In `src/cli/check-args.ts`, parse the value-less `--strict-claude` flag into
   `ParsedCheckArgs` (`strictClaude: boolean`).
2. In `src/cli/check-cli.ts`, when the flag is set, override the loaded config's
   `strictClaude` to `true` for the invocation (build a new `LinterConfig`
   object; do not mutate the loaded one). `runCheck` already promotes when
   `config.strictClaude === true`.

Tests (Red first): in `tests/cli/check-cli-config.test.ts` (or a focused new
file), a Claude-compatibility warning fixture:

- with `--strict-claude` and no config: `odw/no-date-now` is promoted to `error`
  and the run exits `1`;
- with `--strict-claude` and a config setting `strictClaude: false`: still
  promoted (CLI overrides config);
- without the flag and no config: remains a `warning` (regression guard).

Red evidence: the promotion test fails because the flag is unparsed/ignored.
Green: parse and apply the override. Validation: `make all`.

### WI-4: Add `--output-file` output redirection

Implements `docs/technical-design.md` §7.3 (`--output-file <path>`). Works for
both `full` and `json` formats.

Read first: `docs/technical-design.md` §7.3; `src/cli/check-cli.ts`,
`src/cli/check-args.ts`; `tests/cli/check-cli.test.ts`,
`tests/cli/check-cli-corpus.e2e.test.ts`; `AGENTS.md` §"Error Handling". Skills:
`execplans`, `en-gb-oxendict`.

Work:

1. Parse `--output-file <path>` and `--output-file=<path>` in
   `src/cli/check-args.ts`, with a missing-value usage error
   (`missing value for --output-file`) and exit `2`.
2. Add a `writeFileText?: (path: string, contents: string) => void` seam to
   `CheckCliIo`, defaulting to `writeFileSync(path, contents, "utf8")` from
   `node:fs`.
3. When `--output-file` is set, write the rendered report (the exact bytes that
   would go to stdout, including the trailing newline) to the file instead of
   stdout. Read-failure stderr lines and config warnings still go to stderr; the
   exit code is unchanged.

Tests (Red first): in `tests/cli/check-cli.test.ts`, with an injected
`writeFileText` capturing calls:

- `--output-file out.json --output-format json <invalid>` writes the JSON
  envelope to `out.json`, leaves stdout empty, and exits `1`;
- `--output-file out.txt <invalid>` writes the text report to `out.txt`;
- `--output-file` with no value returns `2` with the stable usage error and
  empty stdout.

Red evidence: the flag is rejected as unknown. Green: parse, add the seam, route
output. Validation: `make all`.

### WI-5: Add `--stdin-filename` standard-input analysis

Implements `docs/technical-design.md` §7.2 (stdin requires `--stdin-filename`)
and the Decision Log stdin-trigger ruling.

Read first: `docs/technical-design.md` §7.2; `src/cli/check-cli.ts`,
`src/cli/check-args.ts`, `src/cli/run-check.ts`, `src/cli/read-workflow-source.ts`;
`tests/cli/check-cli.test.ts`. Skills: `execplans`, `en-gb-oxendict`.

Work:

1. Parse `--stdin-filename <path>` / `--stdin-filename=<path>` in
   `src/cli/check-args.ts`, with a missing-value usage error and exit `2`.
   Supplying positional operands together with `--stdin-filename` is a usage
   error (`--stdin-filename cannot be combined with path operands`), exit `2`.
   When `--stdin-filename` is present, zero positional operands is valid (stdin
   mode) rather than the usual "no paths" usage error.
2. Add a `readStdin?: () => string` seam to `CheckCliIo`, defaulting to
   `readFileSync(0, "utf8")`.
3. In stdin mode, lint the stdin text as a single `WorkflowSource` whose
   `filePath` is the `--stdin-filename` value, reusing `lintWorkflowSource` and
   the existing report path. Configured include/exclude and `--force-exclude`
   apply to the logical stdin path exactly as the design intends (WI-7 wires the
   exclusion check; here the stdin path is simply the logical file).

Tests (Red first): in `tests/cli/check-cli.test.ts`, with an injected
`readStdin`:

- `--stdin-filename workflows/x.js` over invalid stdin text prints diagnostics
  whose `file` is `workflows/x.js` and exits `1`;
- clean stdin exits `0` with empty stdout;
- `--stdin-filename` with no value returns `2`;
- `--stdin-filename workflows/x.js extra.js` (operand present) returns `2` with
  the combination usage error.

Red evidence: the flag is rejected as unknown / stdin is never read. Green: parse
and wire the stdin seam. Validation: `make all`.

### WI-6: Add `--exit-zero` and `--exit-non-zero-on-fix` exit-code policy

Implements `docs/technical-design.md` §7.4 (exit-code policy) and the Decision
Log rulings for both flags.

Read first: `docs/technical-design.md` §§7.3, 7.4; `src/cli/check-cli.ts`,
`src/cli/check-args.ts`, `src/cli/run-check.ts`; `tests/cli/check-cli.test.ts`,
`tests/cli/check-cli-config.test.ts`. Skills: `execplans`, `en-gb-oxendict`.

Work:

1. Parse the value-less `--exit-zero` and `--exit-non-zero-on-fix` flags in
   `src/cli/check-args.ts`.
2. In `src/cli/check-cli.ts`, apply `--exit-zero` as the last step before
   returning: if the computed exit code is `1`, return `0`; leave `2` untouched.
   Wire `--exit-non-zero-on-fix` through to the exit-code computation; since no
   fixes are applied in v1 (no fix-capable rule), it never raises the code —
   pin that it is accepted and inert.

Tests (Red first): in `tests/cli/check-cli.test.ts`:

- an invalid fixture with `--exit-zero` prints diagnostics but exits `0`;
- a skip-only (unreadable) invocation with `--exit-zero` exits `0`;
- a config/usage error with `--exit-zero` still exits `2`;
- `--exit-non-zero-on-fix` over clean and invalid fixtures does not change the
  exit code versus the same run without it.

Red evidence: `--exit-zero`/`--exit-non-zero-on-fix` are rejected as unknown.
Green: parse and apply. Validation: `make all`.

### WI-7: Add `--force-exclude` and `--respect-gitignore` ignore handling

Implements `docs/technical-design.md` §7.2 (exclusion and ignore posture) and
the Decision Log rulings for both flag groups.

Read first: `docs/technical-design.md` §§7.0, 7.2; `src/cli/check-cli.ts`,
`src/cli/check-args.ts`, `src/cli/run-check.ts`, `src/config/linter-config.ts`;
`tests/cli/check-cli-config.test.ts`; `AGENTS.md` §"Testing" (property tests).
Skills: `execplans`, `en-gb-oxendict`. Verify `Bun.Glob` matching with a small
scratch check before relying on it, and cite the observed behaviour in Surprises
& Discoveries.

Work:

1. Parse value-less `--force-exclude`, `--respect-gitignore`, and
   `--no-respect-gitignore` in `src/cli/check-args.ts` (default
   `respectGitignore: true`, `forceExclude: false`). `--respect-gitignore` and
   `--no-respect-gitignore` are last-wins if both appear.
2. Add a pure helper `src/cli/path-exclusion.ts` exporting
   `isPathExcluded(path, excludeGlobs)` that returns `true` when `path` matches
   any glob via `new Bun.Glob(pattern).match(path)`.
3. In the check flow, when `--force-exclude` is set and the loaded config has
   `exclude` patterns, skip explicit (and stdin-logical) paths that match:
   excluded paths are not read, not counted in `summary.files`, and not recorded
   as `ioErrors`.
4. Thread `respectGitignore` as a recorded discovery posture with no
   path-filtering effect on explicit paths in v1 (documented, per the Decision
   Log). It exists to keep the invocation contract Ruff-compatible and to seed
   future discovery.

Tests (Red first):

- `tests/cli/path-exclusion.test.ts`: table tests plus a `fast-check` property
  test that a path matching a pattern is excluded and a non-matching path is
  not, over generated segments.
- `tests/cli/check-cli-config.test.ts`: with a config `exclude` of
  `**/generated/**`, an explicit path `generated/workflow.js` (mapped to invalid
  source via the injected reader) is checked and fails `1` *without*
  `--force-exclude`, and is skipped (clean, exit `0`) *with* `--force-exclude`;
  `--respect-gitignore` and `--no-respect-gitignore` are accepted and do not
  change explicit-path results.

Red evidence: the flags are rejected as unknown / the helper is missing. Green:
add the helper, parsing, and the skip step. Validation: `make all`.

### WI-8: Add `--help`, `--version`, and comprehensive usage text

Implements the roadmap 2.4.4 "usage text, `--help`/`--version`, and missing
option-value diagnostics for implemented flags" requirement and
`docs/technical-design.md` §7.1.

Read first: `docs/technical-design.md` §§7.1, 7.3; `src/cli/check-args.ts`,
`src/cli/check-cli.ts`, `src/cli/main.ts`, `package.json`;
`tests/cli/check-cli.test.ts`, `tests/cli/check-args.test.ts`. Skills:
`execplans`, `en-gb-oxendict`.

Work:

1. Recognise `--help`/`-h` and `--version`/`-V` early in parsing (before the
   "no paths" usage error), returning a distinct parsed outcome.
2. In `src/cli/check-cli.ts`, on `--version` write the package version and return
   `0`; on `--help` write a usage block listing the flags implemented by this
   task (`--output-format`, `--output-file`, `--strict-claude`, `--config`,
   `--isolated`, `--force-exclude`, `--respect-gitignore`/
   `--no-respect-gitignore`, `--stdin-filename`, `--exit-zero`,
   `--exit-non-zero-on-fix`, `--help`, `--version`) and return `0`.
3. Audit every value-taking flag for a consistent missing-value usage error
   (`missing value for <flag>`), exit `2`, and confirm each is covered.

Tests (Red first): in `tests/cli/check-cli.test.ts` /
`tests/cli/check-args.test.ts`:

- `--version` prints the injected version and exits `0` with empty stderr;
- `--help` prints usage containing each implemented flag and exits `0`;
- a table test asserting each value-taking flag with no value returns `2` with
  its `missing value for <flag>` message.

Red evidence: `--help`/`--version` currently fall through to the unknown-option
or no-paths usage error. Green: add early recognition and the help/version
output. Validation: `make all`.

### WI-9: Add process-level flag coverage and finalize the guides

Implements the roadmap 2.4.4 success criterion (fixtures cover the flag surface)
end-to-end and `AGENTS.md` §"Documentation Maintenance".

Read first: `tests/cli/check-cli-corpus.e2e.test.ts`; `docs/users-guide.md`
§§"Command shape", "Exit codes", "Diagnostic reports"; `docs/developers-guide.md`
§"CLI"; `docs/documentation-style-guide.md`. Skills: `execplans`,
`en-gb-oxendict`.

Work:

1. Extend `tests/cli/check-cli-corpus.e2e.test.ts` (or add a focused
   `check-cli-flags.e2e.test.ts`) with spawned-process cases: `--version`,
   `--help`, `--output-file` writing to a temporary path, `--stdin-filename`
   with stdin piped through `Bun.spawnSync`'s `stdin` option, `--strict-claude`
   promotion, `--exit-zero`, and a JSON run asserting `ioErrors`/
   `summary.filesSkipped` over a missing path. Assert structural fields and exit
   codes only (absolute `file` paths are not snapshotted).
2. Update `docs/users-guide.md`: move the now-implemented flags out of the
   "planned" lists into "available now" (`--output-file`, `--strict-claude`,
   `--stdin-filename`, `--force-exclude`, `--respect-gitignore`/
   `--no-respect-gitignore`, `--exit-zero`, `--exit-non-zero-on-fix`,
   `--config`, `--isolated`, `--help`, `--version`); refresh the "Exit codes"
   table if wording changed; document `ioErrors`/`summary.filesSkipped` in
   "Diagnostic reports"; and correct the stale "Configuration is planned but not
   implemented yet" note now that configuration is available.
3. Update `docs/developers-guide.md` §"CLI": remove `--exit-zero` and
   `--strict-claude` from the deferred list, describe the implemented flag
   surface, the new seams (`writeFileText`, `readStdin`), the
   `src/cli/check-args.ts` and `src/cli/path-exclusion.ts` modules, and the
   machine-readable IO channel; keep fix-mode, `--max-warnings`, discovery, and
   the extra output formats deferred.
4. Do not tick the roadmap 2.4.4 checkbox in `docs/roadmap.md`; the workflow
   host flips it on merge. Only update this ExecPlan's `Progress`.

Tests: the new e2e cases are the coverage; documentation changes have no code
tests. Format only the touched markdown, then gate.

Red evidence: the new e2e cases fail before their flags are wired (they are
written after WI-3..WI-8 so they pass on green). Validation: `make all`, then
`make markdownlint` and `make nixie`.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-4-4`. Commit after each work
item once its gate is green.

1. WI-1: create `src/cli/check-args.ts`, re-point `src/cli/check-cli.ts`, add
   `tests/cli/check-args.test.ts`, and add the ExecPlan link to
   `docs/contents.md`. Then:

   ```bash
   bunx mdtablefix --in-place docs/contents.md
   bunx markdownlint-cli2 --fix docs/contents.md
   make all
   make markdownlint
   make nixie
   ```

   Expected: all gates pass; the parser is a separate module. Commit:
   `Extract check argument parser into check-args module`.

2. WI-2: add the IO-error type, envelope fields, projection, schema, text
   footer, run-check mapping, exports, golden-fixture and snapshot updates, the
   §8 paragraph, and `docs/adr/0004-machine-readable-io-error-channel.md`. Then:

   ```bash
   bunx mdtablefix --in-place docs/technical-design.md \
     docs/adr/0004-machine-readable-io-error-channel.md
   bunx markdownlint-cli2 --fix docs/technical-design.md \
     docs/adr/0004-machine-readable-io-error-channel.md
   make all
   make markdownlint
   make nixie
   ```

   Expected: report/JSON/schema/text suites and the json-contract parity test
   pass with the additive fields. Commit:
   `Add machine-readable IO-error channel to check output`.

3. WI-3: add `--strict-claude`. Then `make all`. Commit:
   `Add --strict-claude CLI flag overriding configuration`.

4. WI-4: add `--output-file` and the `writeFileText` seam. Then `make all`.
   Commit: `Add --output-file redirection to check command`.

5. WI-5: add `--stdin-filename` and the `readStdin` seam. Then `make all`.
   Commit: `Add --stdin-filename standard-input analysis`.

6. WI-6: add `--exit-zero` and `--exit-non-zero-on-fix`. Then `make all`.
   Commit: `Add exit-zero and exit-non-zero-on-fix policy flags`.

7. WI-7: add `--force-exclude`, `--respect-gitignore`/`--no-respect-gitignore`,
   and `src/cli/path-exclusion.ts`. Then `make all`. Commit:
   `Add force-exclude and gitignore posture to check command`.

8. WI-8: add `--help`/`--version` and the consolidated usage text. Then
   `make all`. Commit: `Add help, version, and usage text to check command`.

9. WI-9: add the process-level flag e2e coverage and update the guides. Then:

   ```bash
   bunx mdtablefix --in-place docs/users-guide.md docs/developers-guide.md
   bunx markdownlint-cli2 --fix docs/users-guide.md docs/developers-guide.md
   make all
   make markdownlint
   make nixie
   ```

   Expected: e2e coverage passes; guides document the implemented surface.
   Commit: `Cover check invocation flags end-to-end and document them`.

## Validation and acceptance

Deterministic commit gate for every work item: `make all` (build, `check-fmt`,
`whitespace-hygiene`, `lint`, `typecheck`, `test`). For any work item that
changes Markdown (WI-1, WI-2, WI-9) additionally run `make markdownlint` and
`make nixie`. AGENTS.md is authoritative for the gate set; `make all` aggregates
build, formatting, whitespace hygiene, lint, type checking, and tests, and the
sequential targets `make check-fmt`, `make lint`, `make typecheck`, and
`make test` remain available for isolation. The workflow host re-runs the
configured gates against committed HEAD; do not report gates green unless every
gate passed at HEAD.

Behavioural acceptance (each pinned by the work item's tests, failing before and
passing after):

- `bun run src/cli/main.ts check --version` prints the version and exits `0`;
  `--help` prints usage listing the implemented flags and exits `0` (WI-8).
- A JSON run over a missing path emits `ioErrors` and `summary.filesSkipped` on
  stdout, keeps the `error: cannot read ...` stderr line, and exits `1`; a
  text run notes the skipped file in its footer (WI-2).
- `--strict-claude` promotes Claude-compatibility warnings to errors and
  overrides `strictClaude: false` in configuration (WI-3).
- `--output-file <path>` writes the report to the file and leaves stdout empty
  for both formats (WI-4).
- `--stdin-filename <path>` lints stdin under the logical path; combining it
  with operands exits `2` (WI-5).
- `--exit-zero` downgrades a diagnostics/read-failure `1` to `0` but never a
  `2`; `--exit-non-zero-on-fix` is accepted and inert in v1 (WI-6).
- `--force-exclude` skips explicit paths matching configured `exclude` globs;
  `--respect-gitignore`/`--no-respect-gitignore` are accepted without changing
  explicit-path results (WI-7).
- Every value-taking flag with a missing value exits `2` with
  `missing value for <flag>` (WI-8).

Quality criteria ("done"):

- Tests: new `check-args`, `path-exclusion`, IO-channel, and per-flag suites
  pass; existing CLI, config, report, schema, json-contract, and e2e suites stay
  green.
- Lint/typecheck: `make lint` and `make typecheck` clean; no new suppressions.
- Format: `make check-fmt` clean, including the updated `.json` golden fixture.
- Schema: emitted JSON conforms to the updated `DIAGNOSTIC_REPORT_SCHEMA`
  (asserted structurally; no validator dependency added).
- Docs: guides, `docs/technical-design.md` §8, and the new ADR are current and
  pass `make markdownlint` and `make nixie`.

## Idempotence and recovery

Every work item is additive and re-runnable: creating modules, seams, tests, and
the ADR is safe to repeat, and `make all` is idempotent. If a snapshot fails,
inspect the diff, confirm it is the intended change (a new flag's output or the
`ioErrors`/`filesSkipped` fields), then update it deliberately; never
blind-update. If `make check-fmt` reformats the golden `.json`, re-commit the
formatted file — the structural parity assertion is unaffected. If a work item
exceeds a tolerance, stop and record the situation in the Decision Log before
proceeding. Do not `git stash` without a named message per the standing stash
rule.

## Interfaces and dependencies

Prescriptive end-state additions:

- In `src/cli/check-args.ts`:

  ```ts
  export type CheckOutputFormat = "full" | "json";

  export type ParsedCheckArgs =
    | {
        readonly ok: true;
        readonly outputFormat: CheckOutputFormat;
        readonly paths: readonly string[];
        readonly configPath?: string;
        readonly outputFile?: string;
        readonly stdinFilename?: string;
        readonly isolated: boolean;
        readonly strictClaude: boolean;
        readonly forceExclude: boolean;
        readonly respectGitignore: boolean;
        readonly exitZero: boolean;
        readonly exitNonZeroOnFix: boolean;
      }
    | { readonly ok: true; readonly mode: "help" | "version" }
    | { readonly ok: false; readonly usageError: string };

  export const parseCheckArgs: (args: readonly string[]) => ParsedCheckArgs;
  ```

- In `src/cli/path-exclusion.ts`:

  ```ts
  export const isPathExcluded: (
    path: string,
    excludeGlobs: readonly string[],
  ) => boolean;
  ```

- In `src/cli/check-cli.ts`, extend `CheckCliIo` with
  `readonly writeFileText?: (path: string, contents: string) => void` and
  `readonly readStdin?: () => string`, defaulting to
  `writeFileSync(path, contents, "utf8")` and `readFileSync(0, "utf8")`.

- In `src/diagnostics/types.ts`:

  ```ts
  export type IoError = {
    readonly file: string;
    readonly reason: "not-found" | "not-a-file" | "unreadable";
    readonly message: string;
  };
  ```

  `DiagnosticReport` gains `readonly ioErrors: readonly IoError[]`;
  `DiagnosticSummary` gains `readonly filesSkipped: number`.

No new runtime or dev dependencies. Reuse `JSON.stringify`, the existing
`DiagnosticReport`/`DIAGNOSTIC_REPORT_SCHEMA` contracts, `Bun.Glob`, `node:fs`
`readFileSync`/`writeFileSync`, and the single-sourced corpus helpers under
`tests/static-analysis/fixtures/`.

## Revision note

- 2026-07-06: Initial DRAFT. Decomposed roadmap 2.4.4 into nine atomic work
  items: parser extraction; the machine-readable IO-error channel (with ADR
  0004 and a §8 update); and one work item each for `--strict-claude`,
  `--output-file`, `--stdin-filename`, the `--exit-zero`/`--exit-non-zero-on-fix`
  pair, the `--force-exclude`/`--respect-gitignore` group, `--help`/`--version`
  plus usage text, and end-to-end coverage with guide updates. Pinned the
  additive-envelope (schemaVersion 1) decision, the explicit-path v1 semantics
  for the ignore/fix flags, and the stdin-trigger rule in the Decision Log. All
  validation runs through `make all` (plus `make markdownlint`/`make nixie` for
  Markdown); formatter commands name only files each work item edits. No prior
  design-review points to address (round 1).
- 2026-07-06 (round 2): Resolved the sole design-review blocking point — ExecPlan
  durability. Round 1 left `docs/contents.md` modified but uncommitted alongside
  the untracked plan file, so the host declined to salvage-commit the plan
  ("worktree holds 1 uncommitted path beyond the plan file"). This revision
  reverts that stray `docs/contents.md` edit so the worktree holds only the
  untracked plan file, letting the durable ExecPlan be committed cleanly; adding
  the `docs/contents.md` ExecPlan link is restored to WI-1 during build (as in
  the original decomposition), which the documentation-contents build gate then
  enforces. `git add`/`git commit` are gated behind an ungranted approval in this
  planning-agent session (`git add docs/execplans/roadmap-2-4-4.md
  docs/contents.md` returned "This command requires approval"), so the plan is
  committed via the host salvage path rather than an agent commit. Work-item
  decomposition, decisions, and scope are otherwise unchanged.
- 2026-07-06 (WI-8): Implemented help, version, and comprehensive usage text.
  The parser now returns distinct informational outcomes for `--help`/`-h` and
  `--version`/`-V`, the CLI prints usage or the package version to stdout and
  exits `0`, and missing values for implemented value-taking flags now use the
  common `missing value for <flag>` diagnostic. Added focused help/version tests
  and recorded the parser file-size split into `src/cli/check-informational-action.ts`
  and `src/cli/check-option-tables.ts`. WI-9 remains as the only unticked work
  item.
- 2026-07-06 (WI-9): Added process-level flag coverage for the implemented
  roadmap 2.4.4 invocation surface and finalized the user and developer guides.
  The plan is now complete: all nine work items are ticked, guide text matches
  the available flags and remaining deferred work, and the final gate set passed
  locally and through delegated scrutineer validation.
- 2026-07-06 (fix round 1): Resolved the blocking missing-value audit gap for
  equals-form string flags. `--output-file=` and `--stdin-filename=` now reject
  empty values with `missing value for <flag>` at the parser boundary, and
  parser plus CLI tests pin the exit `2` behaviour.

## Addenda

- [ ] 2.4.4.1. Harden informational-flag value handling.
  - Source: review:2.4.4; severity low.
  - Scope: make `--help`, `-h`, `--version`, and `-V` detection aware of
    recognised value-taking options and operands so a filename or option value
    equal to an informational flag is not misread as the requested action.
  - Success: parser or CLI coverage proves informational flags still work when
    supplied as options, while value and operand collisions are parsed as
    normal invocation data.
