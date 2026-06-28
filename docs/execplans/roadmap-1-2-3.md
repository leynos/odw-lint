# Split the diagnostic contract into focused modules

This ExecPlan (execution plan) is a living document. The sections `Constraints`,
`Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 1.2.3 turns the diagnostic contract from one broad package entry
module into a set of focused internal modules. After this work, callers still
import every public value and type through `odw-lint`, but maintainers can find
diagnostic data shapes, severity values, rule-identifier parsing, report
helpers, text formatting, and JSON Schema construction in one named source
module each.

This is a structural refactor, not a behaviour expansion. The observable
success criteria are that all existing diagnostic behaviours still pass through
the package entry point, the package entry remains explicit, `src/index.ts`
contains no diagnostic helper implementations, and
`tests/diagnostics/architecture.test.ts` pins the expected diagnostic module
names and public-entry assertions before parser, command-line interface (CLI),
and rule-engine work arrives.

## Constraints

- Work only in
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-2-3`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as the canonical integration branch.
- Use GrepAI first for intent search against the canonical main-branch index.
  The index reflects `main` only, so verify every branch-local fact with
  `leta`, exact text search, or file inspection in this worktree before acting.
- Use `leta` for branch-local symbol navigation, references, call graphs, and
  refactoring commands such as `leta mv`.
- Use `sem` rather than raw git history commands for semantic history,
  entity-level diffs, and change review before commit.
- Do not begin parser, CLI, file discovery, configuration, ODW loader parity,
  source-span calculation, or rule-engine implementation in this roadmap task.
- Preserve the public package entry point. Imports from `odw-lint` that work
  before this task must keep working after every work item.
- Do not add new package dependencies. The current locked dependency set is
  enough for this refactor.
- Do not add automation scripts in this roadmap task. If a helper script
  unexpectedly becomes necessary, stop and revise this plan first so the work
  explicitly implements `docs/scripting-standards.md` sections "Language and
  runtime", "Pathlib: robust path manipulation", "Testing expectations", and
  "Operational guidelines".
- Do not import executable ODW runtime paths in production code. This includes
  `loadWorkflowScript`, `createPrimitives`, runtime `validate(source)`, worker
  paths, launcher paths, or any path that evaluates metadata or dispatches
  agents.
- Keep every source module under 400 lines. This task must reduce, not deepen,
  the current concentration of diagnostic responsibilities.
- Keep functions within the configured Oxlint complexity limits:
  `complexity` max 8, `max-depth` max 3, and `df12/complex-conditional` max 1
  logical operator.
- Use en-GB Oxford spelling in prose and comments.
- Format only changed files. For Markdown, run `mdtablefix` and
  `markdownlint-cli2 --fix` on the specific files changed. For TypeScript, run
  Biome formatting on every changed source and test file discovered after the
  edit, including files rewritten by `leta mv`. Do not run repo-global mutating
  format commands such as `make fmt`, `bun fmt`, or `mdformat-all`.
- Every work item must update this ExecPlan before its commit. At minimum,
  check off that item's `Progress` entry when the item is complete. Also update
  `Surprises & discoveries`, `Decision log`, `Risks`,
  `Outcomes & retrospective`, and the revision note when the work item changes
  the plan's assumptions or records new evidence.
- Because every work item updates this ExecPlan, every work item has a
  Markdown change. Run file-scoped Markdown formatting on
  `docs/execplans/roadmap-1-2-3.md`, then run `make markdownlint` and
  `make nixie` before committing that item.
- Each work item below is independently committable. Gate and commit each
  item before starting the next one.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances (exception triggers)

- Scope: stop and escalate if the implementation needs source or test modules
  outside `src/index.ts`, `src/diagnostics/**`, `src/static-analysis/**`,
  `tests/**`, `src/diagnostic-schema.ts`, and `src/diagnostic-severity.ts`,
  except for roadmap or ExecPlan closure documentation. The two legacy
  top-level diagnostic files are in scope only until work items 2 and 6 move or
  remove them.
- Public API: stop and escalate if any public import from `odw-lint` must be
  renamed, removed, or moved to a package subpath.
- Dependency: stop and escalate if a new external package appears necessary.
  This plan intentionally avoids `fast-check`, `lemmascript`, Zod, Ajv, and
  JSON Schema type-generation packages.
- Behaviour: stop and escalate if diagnostic text output, report shape, schema
  snapshot payload, rule-id parsing results, or summary counts need to change.
  Snapshot owner names may change when tests are split; payload changes are not
  expected.
- Runtime boundary: stop immediately if production code would need any ODW
  runtime loader, primitive, scheduler, launcher, worker, or agent import.
- Tests: if a work item cannot pass `make all` after three focused fix
  attempts, record the failure and options in `Decision Log` before continuing.
- Formatting: if a formatter rewrites unrelated files, park that churn in a
  named discard stash using
  `df12-stash v1 task=1.2.3 kind=discard reason="<short>"`, then re-run only
  file-scoped formatting.

## Risks

- Risk: changing module paths could accidentally create public package
  subpaths. Severity: medium. Likelihood: medium. Mitigation: keep
  `package.json` exports unchanged and test only the public `odw-lint` entry
  point for consumers. Internal tests may inspect source files for
  architecture, but public API tests must not import `src/diagnostics/**`.

- Risk: moving `RuleId` away from `Diagnostic` can create circular runtime
  imports. Severity: medium. Likelihood: medium. Mitigation: put the `RuleId`
  brand and parser in `src/diagnostics/rule-id.ts`; import it as a type from
  `src/diagnostics/types.ts`; use `export type` and `import type` where the
  value is not needed at runtime.

- Risk: splitting the test file can cause noisy snapshot churn.
  Severity: low. Likelihood: high. Mitigation: split tests first and review
  snapshots. Only test-owner metadata may change. If a diagnostic schema or
  text payload changes, stop and fix the refactor before committing.

- Risk: schema helpers could become over-abstracted while chasing reuse.
  Severity: medium. Likelihood: medium. Mitigation: keep
  `src/diagnostics/schema.ts` as the only schema module, with at most small
  private builders for repeated source-position object shapes. Do not introduce
  a general schema DSL.

- Risk: current ODW runtime semantics can tempt production imports for parity.
  Severity: high. Likelihood: low. Mitigation: this task does not need ODW
  imports. Cite the sibling ODW loader only as trust-boundary evidence and keep
  production code self-contained.

## Progress

- [x] (2026-06-28T06:48Z) Read `AGENTS.md`, the ExecPlan skill, the Leta
  skill, the GrepAI skill, the Sem skill, the Biome TypeScript skill, and the
  Firecrawl skill.
- [x] (2026-06-28T06:48Z) Ran GrepAI intent searches against the canonical
  `odw-lint` main-branch index for diagnostic module splitting and reporter
  responsibilities.
- [x] (2026-06-28T06:48Z) Verified the branch-local diagnostic symbols with
  `leta` in this worktree.
- [x] (2026-06-28T06:48Z) Read the governing design documents and sibling ODW
  source needed for the trust-boundary research.
- [x] (2026-06-28T06:48Z) Verified locked tool versions and load-bearing
  behaviour from installed package files, CLI help, and official docs.
- [x] (2026-06-28T07:04Z) Revised the plan after round-2 design review to name
  the architecture-test file, helper strategy, public-entry assertions,
  per-item living-plan update rule, file-discovered TypeScript formatting, and
  concrete external-tool evidence.
- [x] (2026-06-28T07:18Z) Added explicit citations for the complexity and
  scripting standards documents required by the task.
- [x] (2026-06-28T07:23Z) Revised the plan after round-3 design review to
  replace every deleted-file-prone TypeScript formatting recipe with the
  verified staged, unstaged, and untracked existing-file discovery recipe.
- [x] (2026-06-28T08:38Z) Revised the plan after round-4 design review to
  align scope tolerance with the planned legacy top-level diagnostic file moves
  and require declaration-level barrel export consolidation before the first
  architecture-test assertion.
- [x] (2026-06-28T07:52Z) Draft accepted for implementation by the
  df12-build workflow instruction.
- [x] (2026-06-28T07:52Z) Work item 1 implemented and ready to commit after
  deterministic gates and CodeRabbit review.
- [x] (2026-06-28T08:05Z) Work item 2 implemented and ready to commit after
  deterministic gates and CodeRabbit review.
- [x] (2026-06-28T08:09Z) Work item 3 implemented and ready to commit after
  deterministic gates and CodeRabbit review.
- [x] (2026-06-28T08:13Z) Work item 4 implemented and ready to commit after
  deterministic gates and CodeRabbit review.
- [x] (2026-06-28T08:18Z) Work item 5 implemented and ready to commit after
  deterministic gates and CodeRabbit review.
- [x] (2026-06-28T08:22Z) Work item 6 implemented and ready to commit after
  deterministic gates and CodeRabbit review.
- [x] (2026-06-28T08:27Z) Work item 7 implemented and ready to commit after
  deterministic gates and CodeRabbit review.

## Surprises & discoveries

- Observation: GrepAI returned little code signal for the current task because
  the canonical `main` index is behind this branch's diagnostic-contract work.
  Evidence: the useful GrepAI result was the design documentation, while `leta`
  found the branch-local `src/index.ts` diagnostic symbols directly. Impact:
  implementation must use GrepAI for first-pass intent search, but must treat
  `leta` and direct worktree inspection as the source of branch-local truth.

- Observation: the current `tests/index.test.ts` file is over 400 lines.
  Evidence: `leta files` reports 483 lines. Impact: the first implementation
  item splits tests by diagnostic responsibility before moving production
  modules, so later commits do not keep adding churn to an oversized test file.

- Observation: the current `src/index.ts` barrel has duplicate
  declaration-level export specifiers for `./diagnostic-severity` and
  `./static-analysis`. Evidence: direct worktree inspection shows separate type
  and value export declarations at `src/index.ts` lines 8-20. Impact: work item
  1 must consolidate those declarations before `expectPackageEntryShape`
  compares declaration-level module specifiers exactly;
  `exportedModuleSpecifiers` must not hide duplicate declarations.

## Decision log

- Decision: use `src/diagnostics/` as the internal diagnostic module root, with
  exact modules `severity.ts`, `rule-id.ts`, `types.ts`, `report.ts`,
  `text.ts`, and `schema.ts`. Rationale: this maps one file to each
  responsibility named in roadmap task 1.2.3 and avoids speculative package
  subpaths. Date/Author: 2026-06-28T06:48Z, planning agent.

- Decision: preserve `src/index.ts` as the only public package entry point and
  make it an explicit barrel over focused modules. Rationale: roadmap task
  1.2.3 requires the public API to remain importable through `odw-lint`, and
  `AGENTS.md` requires explicit public entry points. Date/Author:
  2026-06-28T06:48Z, planning agent.

- Decision: do not introduce property-test or proof dependencies for this
  refactor. Rationale: the work preserves finite, already-defined contracts.
  Existing table-driven rule-id tests, summary-count tests, type tests, and
  snapshots cover the changed boundaries without a new external tool.
  Date/Author: 2026-06-28T06:48Z, planning agent.

- Decision: use architecture tests to pin the module split rather than expose
  public package subpaths. Rationale: tests need to prove each responsibility
  has one named module, but consumers should still import from `odw-lint` only.
  Date/Author: 2026-06-28T06:48Z, planning agent.

- Decision: implement source-shape architecture checks in
  `tests/diagnostics/architecture.test.ts` with the locked TypeScript compiler
  API rather than ad hoc source regular expressions. Rationale: TypeScript
  5.9.3 is already locked in `bun.lock`; its declarations and official compiler
  API documentation support `createSourceFile`, `forEachChild`, and syntax-node
  guards, so tests can inspect export declarations and top-level declarations
  structurally without adding a dependency. Date/Author: 2026-06-28T07:04Z,
  planning agent.

- Decision: discover changed TypeScript formatting targets from both unstaged
  and staged tracked Git diffs, plus existing untracked files, then filter the
  candidates with `[[ -f "$path" ]]` before passing them to Biome. Rationale:
  work item 1 deletes `tests/index.test.ts`, while work items 2 and 6 move
  files; the previous `git ls-files`-based TypeScript target list included
  unstaged deletions and could hand removed paths to Biome. The replacement is
  supported by Git's `--diff-filter` and `--others --exclude-standard` docs and
  was verified in a scratch repository containing a modified file, a deleted
  file, a `git mv` move, a staged modification, and an untracked file.
  Date/Author: 2026-06-28T07:23Z, planning agent.

- Decision: keep `exportedModuleSpecifiers(sourceFile)` declaration-level and
  non-deduplicating, and make work item 1 consolidate `src/index.ts` to one
  export declaration per module specifier before the architecture assertion.
  Rationale: the test should catch duplicate package-entry declarations rather
  than normalize them away. TypeScript 5.9.3 parses and emits mixed value/type
  re-export syntax such as `export { value, type TypeName } from "./module";`;
  its local `ExportSpecifier` declaration exposes `isTypeOnly` for that shape.
  Date/Author: 2026-06-28T08:38Z, planning agent.

## Outcomes & retrospective

Work item 1 split the broad package-entry test suite into focused diagnostic
and static-analysis tests. The package entry now uses one export declaration
per current module specifier, and `tests/diagnostics/architecture.test.ts` pins
the initial public package-entry shape before production modules move.
CodeRabbit requested stronger public type coverage and a report-envelope
snapshot, so this item also added a package-entry-only consumer fixture and a
narrow structured report snapshot.

Work item 2 moved severity values and rule-id parsing into
`src/diagnostics/severity.ts` and `src/diagnostics/rule-id.ts`. The public
package entry still re-exports every diagnostic primitive through `odw-lint`,
and the architecture test now checks that `src/index.ts` no longer owns rule-id
helper declarations. CodeRabbit requested runtime immutability for the severity
tuple, so `DIAGNOSTIC_SEVERITIES` is now frozen as well as type-narrowed.

Work item 3 moved diagnostic data shapes and report constants into
`src/diagnostics/types.ts`. The package entry still re-exports the public
model, and `src/index.ts` now imports only the types and constants needed by
the remaining report and text helper implementations.

Work item 4 moved summary counting and report envelope creation into
`src/diagnostics/report.ts`. The package entry re-exports the same public
helpers, while `src/index.ts` now retains only text-formatting implementation
code from the diagnostic contract. CodeRabbit identified that report creation
only copied the diagnostics array shell, so report diagnostics are now cloned
deeply before summary counting and envelope return.

Work item 5 moved one-line text diagnostic rendering into
`src/diagnostics/text.ts`. `src/index.ts` now re-exports the formatter without
owning text-normalization helpers. CodeRabbit identified additional Unicode
line-breaking separators, so text normalization now also folds U+0085, U+2028,
and U+2029 into spaces.

Work item 6 moved diagnostic JSON Schema ownership into
`src/diagnostics/schema.ts` and collapsed `src/index.ts` to a pure explicit
package barrel with no top-level implementation declarations. CodeRabbit
identified hard-coded schema constants, so the schema now imports
`DIAGNOSTIC_SCHEMA_VERSION` and `TOOL_NAME` from the diagnostics type module.

Work item 7 closed the living plan and marked roadmap task 1.2.3 complete after
the final module layout and gates were verified.

Final outcome: the diagnostic contract now lives in focused modules under
`src/diagnostics/`: `severity.ts`, `rule-id.ts`, `types.ts`, `report.ts`,
`text.ts`, and `schema.ts`. Public consumers still import through `odw-lint`
only. At closure, `make all`, `make markdownlint`, and `make nixie` passed.

## Addenda

- [x] 1.2.3.1. Add diagnostic schema and architecture-test cleanup.
  - Source: audit:1.2.3.
  - Severity: low.
  - Scope: extract private diagnostic schema shape helpers and separate
    architecture-test query helpers from assertions.
  - Success: schema and architecture tests retain the same public contracts
    while their private helpers make drift points explicit.
- [ ] 1.2.3.2. Synchronize package-entry documentation.
  - Source: audit:1.3.3 and audit:1.3.4.
  - Severity: medium.
  - Scope: align the developer guide and `src/index.ts` file documentation
    with the current private package entry, `package.json` entry shape, and
    exported static-analysis surface.
  - Success: maintainer documentation, source file documentation, and the
    architecture test describe the same package-entry contract.

## Addenda progress

- [x] (2026-06-28T16:10Z) Implemented addendum 1.2.3.1 by extracting private
  diagnostic schema shape helpers, adding source-position drift assertions, and
  splitting architecture-test export-declaration queries from assertions.

## Context and orientation

The current branch is `roadmap-1-2-3`. The roadmap entry is `docs/roadmap.md`
section 1.2.3, "Split the diagnostic contract into focused modules." It
requires moving diagnostic types, rule-id parsing, report helpers, text
formatting, and schema construction behind focused internal modules while
preserving the explicit package entry point.

The current branch-local diagnostic contract is concentrated in these files:

- `src/index.ts` exports the public API and currently also owns
  `SourcePosition`, `SourceSpan`, `DiagnosticSuggestion`, `RuleId`,
  `InvalidRuleId`, `Diagnostic`, `DiagnosticSummary`, `DiagnosticReport`,
  `InvalidRuleIdError`, `parseRuleId`, `isRuleId`, `makeRuleId`,
  `countDiagnostics`, `createDiagnosticReport`, and `formatTextDiagnostics`.
- `src/diagnostic-severity.ts` owns `DIAGNOSTIC_SEVERITIES` and
  `DiagnosticSeverity`.
- `src/diagnostic-schema.ts` owns `DIAGNOSTIC_REPORT_SCHEMA`.
- `src/static-analysis/types.ts` is already a focused static-analysis module
  and should not be mixed into the diagnostic refactor.
- `tests/index.test.ts` imports through `odw-lint` and covers rule IDs,
  diagnostic types, report summaries, JSON Schema, text formatting, and
  static-analysis boundary exports in one file.

Terms used in this plan:

- "Package entry point" means `src/index.ts`, the module exposed by
  `package.json` under the package name `odw-lint`.
- "Internal module" means a source file under `src/diagnostics/` that is not
  exposed as a package subpath. It may still be imported by `src/index.ts` and
  by repository tests.
- "Diagnostic contract" means the TypeScript types, runtime constants, helper
  functions, text formatter, and JSON Schema that define diagnostic reports.
- "Behaviour-preserving" means the runtime values produced by public helpers
  and the public import surface stay the same.

## Research evidence

The following evidence is load-bearing for the implementation. Do not replace
it with unverified workarounds.

- Project roadmap and design:
  - `docs/roadmap.md` section 1.2.3 names the required module split and the
    public API preservation success criterion.
  - `docs/technical-design.md` section 8 defines the diagnostic JSON envelope,
    stable rule IDs, severities, original-source spans, optional suggestions,
    and the rule that text output is derived from the same diagnostic objects
    as JSON output.
  - `docs/technical-design.md` sections 5, 12.1, and 12.2 and
    `docs/adr/0001-static-analysis-boundary.md` forbid production imports that
    evaluate workflow source.
  - `docs/technical-design.md` section 15 and `docs/developers-guide.md`
    "Commit Gate" require `make all`; Markdown changes also require
    `make markdownlint`, and Mermaid validation uses `make nixie`.
  - `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 4.A,
    5.A, and 5.B require refactors to extract cohesive responsibilities, apply
    separation of concerns, and avoid replacing one concentrated module with
    arbitrary over-granular "ravioli code".
  - `docs/scripting-standards.md` sections "Language and runtime", "Pathlib:
    robust path manipulation", "Testing expectations", and "Operational
    guidelines" govern automation scripts. This diagnostic module split does
    not need scripts; if implementation discovers otherwise, the plan must be
    revised before any script is introduced.

- Branch-local code shape:
  - `leta grep ".*" "src/.*"` found diagnostic symbols in `src/index.ts`,
    `src/diagnostic-schema.ts`, and `src/diagnostic-severity.ts`.
  - `leta calls --from createDiagnosticReport` showed the report helper only
    calls `countDiagnostics`, which calls `validateReportFileCount`.
  - `leta calls --from formatTextDiagnostics` showed the text formatter only
    calls `normalizeTextField`, which calls `isControlWhitespace`.
  - `leta calls --from parseRuleId` showed the rule-id parser calls
    `brandRuleId`, `invalidRuleId`, and `invalidRuleIdReason`.
  - `leta refs` showed public consumers in tests import via `odw-lint`, not
    internal source paths.
  - `tests/diagnostics/architecture.test.ts` does not exist yet. This plan
    creates it in work item 1 and keeps it current in every later work item.
  - `src/index.ts` currently exports `./diagnostic-severity` and
    `./static-analysis` through separate type and value export declarations.
    Work item 1 consolidates those duplicate declaration-level specifiers
    before the architecture test compares the package-entry shape exactly.

- Sibling ODW behaviour:
  - `/data/leynos/Projects/open-dynamic-workflows/src/loader.ts` exports
    `loadWorkflowScript`; it constructs an async function for workflow bodies
    and evaluates the metadata literal with `new Function`.
  - `/data/leynos/Projects/open-dynamic-workflows/src/primitives.ts` defines
    the injected `validate(source)` primitive by calling `loadWorkflowScript`
    and `scanDualCompat`.
  - `/data/leynos/Projects/open-dynamic-workflows/src/dual-compat.ts` provides
    a pure-literal `checkMeta` parser for Claude compatibility, but it is a
    source reference for future parser work, not a dependency for this
    diagnostic module split.
  - `/data/leynos/Projects/open-dynamic-workflows/src/index.ts` exports ODW
    loader metadata types from the public entry point but does not export
    loader implementation values. This reinforces ADR 0001's decision that
    `odw-lint` owns its static-analysis implementation.

- Locked local tooling and external docs:
  - `bun.lock` resolves TypeScript to 5.9.3. `node_modules/typescript`
    `package.json` confirms version 5.9.3. Local declarations at
    `node_modules/typescript/lib/typescript.d.ts` expose
    `createSourceFile`, `forEachChild`, `isExportDeclaration`,
    `isVariableStatement`, `isFunctionDeclaration`, `isClassDeclaration`,
    `isInterfaceDeclaration`, `isTypeAliasDeclaration`, `NamedExports`, and
    `ExportSpecifier`. The official TypeScript modules handbook confirms ES
    module `import` and `export` syntax, `import type`, and inline type
    imports. The official TypeScript compiler API wiki documents parsing a
    source file with `createSourceFile` and traversing its abstract syntax tree
    (AST) with `forEachChild`. Use type-only imports and exports to avoid
    runtime cycles while moving type declarations, and use the compiler API in
    the architecture test. Local `transpileModule` verification against the
    locked TypeScript package confirmed mixed value/type re-exports compile
    without diagnostics, and `ExportSpecifier` exposes `isTypeOnly`.
  - The local Bun runtime is `1.3.11+af24e281e`, and `bun.lock` resolves
    `bun-types` to 1.3.14. `node_modules/bun-types/test.d.ts` exposes
    `describe`, `test`, `expect`, `expectTypeOf`, and `toMatchSnapshot`, and
    `bun test --help` confirms `--update-snapshots`.
    The official Bun test docs confirm `bun test` runs JavaScript and
    TypeScript tests, exits non-zero on failure, supports snapshots, and
    updates snapshots with `--update-snapshots`.
  - `bun.lock` resolves `@biomejs/biome` to 2.5.1. The package wrapper in
    `node_modules/@biomejs/biome/bin/biome` selects the installed platform
    binary, and `node_modules/@biomejs/cli-linux-x64/biome --version` reports
    2.5.1. The official Biome CLI docs confirm `biome check` can run formatter,
    linter, and import sorting for requested paths, with `--formatter-enabled`
    and `--linter-enabled` switches. Local `bunx biome format --help` confirms
    `biome format [--write] [PATH]...`. Use file-scoped Biome commands for
    mutating code format and `make check-fmt` for the gate.
  - `bun.lock` resolves Oxlint to 1.71.0. `node_modules/oxlint/bin/oxlint`
    imports the installed CLI wrapper, and `bunx oxlint --version` reports
    1.71.0. The official Oxlint docs confirm JavaScript and TypeScript linting
    support. Use it through the existing `make lint` gate only.
  - Local Git is 2.53.0. The official `git diff` documentation confirms
    `--diff-filter` can select changed-status classes and gives
    `--diff-filter=MRC` as an example that excludes additions and deletions.
    The official `git ls-files` documentation confirms `--modified` includes
    unstaged deletions, `--deleted` shows unstaged deletions, `--others` shows
    untracked files, and `--exclude-standard` applies standard ignore rules.
    A scratch repository test verified that the replacement recipe lists
    modified, moved, staged, and untracked `.ts` files while excluding a
    deleted tracked `.ts` file.
  - `mdtablefix --help` confirms `mdtablefix [FILES]...`, `--in-place`, and
    `--wrap`. `bunx markdownlint-cli2 --help` reports
    `markdownlint-cli2 v0.20.0` and confirms `--fix` plus file or glob
    arguments. Use those commands only on the changed Markdown file set.
  - No locked dependency provides `fast-check`, `lemmascript`, Zod, Ajv, or
    `@aboviq/bun-test-cucumber`. This task must stay with Bun unit,
    type-level, snapshot, and architecture tests.

## Plan of work

Each work item is one commit. For every item, first run the smallest relevant
test to see the intended failing or unchanged boundary, make the code change,
format every changed TypeScript file discovered by Git, update this ExecPlan's
living sections, format the changed Markdown file set, run the item validation
commands, review `sem diff`, then commit.

### Work item 1: Split the diagnostic test suite by public behaviour

Purpose: create a focused test harness before moving diagnostic helper
implementations, so later module moves do not keep growing
`tests/index.test.ts`. This item may only touch production code to consolidate
duplicate package-entry export declarations; it must not move diagnostic helper
implementations yet.

Documentation implemented:

- `AGENTS.md` "Keep file size manageable".
- `AGENTS.md` "Testing".
- `AGENTS.md` "Public APIs".
- `docs/developers-guide.md` "Commit Gate" and "Bun Scripts".
- `docs/documentation-style-guide.md` "Markdown rules" for any snapshot review
  notes added to this plan.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 4.A
  and 5.B, because the test split follows responsibility boundaries without
  creating arbitrary tiny test fragments.

Skills to load:

- `grepai` for first-pass search.
- `leta` for branch-local symbols and references.
- `biome-typescript` for TypeScript formatting and lint expectations.
- `sem` before commit for entity-level diff review.

Edits:

- First update `src/index.ts` so each existing package-entry module specifier
  has exactly one top-level export declaration and no public symbol changes.
  Use the locked TypeScript 5.9.3-supported mixed value/type re-export shape:
  `export { DIAGNOSTIC_SEVERITIES, type DiagnosticSeverity } from "./diagnostic-severity";`
  and one combined `./static-analysis` export that includes
  `STATIC_ANALYSIS_BOUNDARY`, `STATIC_ANALYSIS_COMPONENTS`,
  `STATIC_ANALYSIS_STAGES`, and the `type`-qualified `StaticAnalysisComponent`,
  `StaticAnalysisStage`, and `WorkflowSource` specifiers.
- Create `tests/diagnostics/fixtures.ts` with the shared
  `documentedRuleIds`, `invalidRuleIds`, `severitySummaryKeys`, and
  `diagnosticForSeverity` fixtures currently embedded in `tests/index.test.ts`.
- Move rule-id tests into `tests/diagnostics/rule-id.test.ts`.
- Move diagnostic type and constant tests into
  `tests/diagnostics/types.test.ts`.
- Move report tests into `tests/diagnostics/report.test.ts`.
- Move JSON Schema tests into `tests/diagnostics/schema.test.ts`.
- Move text formatter tests into `tests/diagnostics/text.test.ts`.
- Move static-analysis boundary tests into
  `tests/static-analysis/boundary.test.ts`.
- Create `tests/diagnostics/architecture.test.ts`. This file is the single
  source-shape architecture test for this plan. It must define these local
  helpers:
  - `parseSource(relativePath)`: reads a repository-relative TypeScript file
    with `readFileSync`, then calls
    `ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true,
    ts.ScriptKind.TS)`.
  - `topLevelDeclarationNames(sourceFile)`: walks only top-level nodes with
    `ts.forEachChild` and records names from `VariableStatement`,
    `FunctionDeclaration`, `ClassDeclaration`, `InterfaceDeclaration`, and
    `TypeAliasDeclaration` nodes.
  - `exportedModuleSpecifiers(sourceFile)`: walks top-level
    `ExportDeclaration` nodes, requires named exports rather than
    `export *`, and returns the declaration-level module specifier strings
    without de-duplicating them. Duplicate declarations are a package-entry
    shape failure, not a helper-normalization detail.
  - `diagnosticModuleFiles()`: reads `src/diagnostics/` when it exists and
    returns the sorted `.ts` filenames.
  - `expectPackageEntryShape(expectedModuleSpecifiers)`: reads `package.json`
    and asserts that `exports` has exactly `.` and `./package.json`, that `.`
    maps `types`, `bun`, `import`, and `default` to `./src/index.ts`, and that
    the sorted module specifiers exported by `src/index.ts` exactly equal
    `expectedModuleSpecifiers`.
- The initial `tests/diagnostics/architecture.test.ts` assertions for this
  work item must pass before production modules move. Assert that public
  runtime diagnostic values are importable from `odw-lint`, that the public
  diagnostic types are importable with `expectTypeOf`, that `package.json`
  still exposes only the package entry and `./package.json`, that
  `expectPackageEntryShape` expects exactly `./diagnostic-schema`,
  `./diagnostic-severity`, and `./static-analysis`, and that the architecture
  helpers can parse `src/index.ts`, `src/diagnostic-schema.ts`, and
  `src/diagnostic-severity.ts`. Because `exportedModuleSpecifiers` is
  declaration-level and non-deduplicating, this assertion must fail if the
  duplicate `./diagnostic-severity` or `./static-analysis` export declarations
  remain in `src/index.ts`.
- Delete `tests/index.test.ts` once no assertions remain there.
- Update this ExecPlan's `Progress` and revision note before the commit.

Tests required:

- Unit tests: all moved Bun tests must still assert the same public behaviours
  through imports from `odw-lint`.
- Type-level tests: keep `expectTypeOf` assertions in the focused type test.
- Snapshot tests: preserve the schema and text snapshots. If splitting test
  files changes snapshot owner names, update snapshots only after confirming
  the snapshot payload is semantically unchanged.
- Architecture tests: `tests/diagnostics/architecture.test.ts` must pass and
  must pin the package-entry assertions above, including failure on duplicate
  declaration-level module specifiers in `src/index.ts`.
- Behavioural, property, and end-to-end tests: none for this item, because no
  CLI or workflow execution path changes.

Validation:

- `bun test --update-snapshots` only if snapshot owner paths change.
- `bun test tests/diagnostics/architecture.test.ts`
- Discover every changed TypeScript file, including untracked files and import
  rewrites from file moves:

```sh
mapfile -t candidate_ts < <({
  git diff --name-only --diff-filter=ACMRTUXB -- '*.ts' '*.tsx'
  git diff --cached --name-only --diff-filter=ACMRTUXB -- '*.ts' '*.tsx'
  git ls-files --others --exclude-standard -- '*.ts' '*.tsx'
} | sort -u)
changed_ts=()
for path in "${candidate_ts[@]}"; do
  if [[ -f "$path" ]]; then
    changed_ts+=("$path")
  fi
done
if ((${#changed_ts[@]})); then
  bunx biome format --write "${changed_ts[@]}"
fi
```

- Format this ExecPlan after updating `Progress`:

```sh
mdtablefix --in-place --wrap docs/execplans/roadmap-1-2-3.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-2-3.md
```

- `make all`
- `make markdownlint`
- `make nixie`

### Work item 2: Move severity and rule-id primitives into diagnostics modules

Purpose: give the primitive diagnostic domain values their own modules before
data shapes depend on them.

Documentation implemented:

- `docs/roadmap.md` section 1.2.3.
- `docs/technical-design.md` section 8, especially stable `rule` and
  `severity` invariants.
- `docs/technical-design.md` section 10, which later needs unknown rule
  identifiers to be recoverable configuration errors.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 4.A,
  5.A, and 5.B.
- `AGENTS.md` "Error Handling" and "Public APIs".

Skills to load:

- `grepai`, `leta`, `biome-typescript`, and `sem`.
- Use `hypothesis-debugging` only if a failure's root cause is unclear after
  `leta` references and focused test output.

Edits:

- Use `leta mv` to move `src/diagnostic-severity.ts` to
  `src/diagnostics/severity.ts`.
- Create `src/diagnostics/rule-id.ts` and move `ruleIdBrand`, `RuleId`,
  `InvalidRuleIdReason`, `InvalidRuleId`, `RuleIdParseResult`,
  `InvalidRuleIdError`, `RULE_ID_NAMESPACE`, `RULE_ID_PATTERN`, `brandRuleId`,
  `invalidRuleId`, `describeInvalidRuleId`, `invalidRuleIdReason`,
  `parseRuleId`, `isRuleId`, and `makeRuleId` from `src/index.ts`.
- Update `src/index.ts` to re-export the same public types and values.
- Keep module JSDoc and public/private declaration JSDoc in both new modules.
- Update `tests/diagnostics/architecture.test.ts` so
  `expectPackageEntryShape` expects `./diagnostics/severity`,
  `./diagnostics/rule-id`, the still-existing `./diagnostic-schema`, and
  `./static-analysis`. Assert `diagnosticModuleFiles()` includes exactly
  `rule-id.ts` and `severity.ts` at this point. Assert `src/index.ts` no longer
  declares `RULE_ID_PATTERN`, `parseRuleId`, `isRuleId`, or `makeRuleId`.
- Update this ExecPlan's `Progress` and revision note before the commit.

Tests required:

- Unit tests: `tests/diagnostics/rule-id.test.ts` must keep valid and invalid
  rule-id assertions, non-throwing parse assertions, and structured
  `InvalidRuleIdError` assertions.
- Type-level tests: `tests/diagnostics/types.test.ts` must still prove
  `DiagnosticSeverity` mirrors `DIAGNOSTIC_SEVERITIES`.
- Architecture test: `tests/diagnostics/architecture.test.ts` asserts the
  exact module and declaration ownership described above.
- Property and proof tests: not required; the accepted rule-id domain is a
  finite documented table for this task.

Validation:

- `bun test tests/diagnostics/rule-id.test.ts tests/diagnostics/types.test.ts`
- Discover and format every changed TypeScript file:

```sh
mapfile -t candidate_ts < <({
  git diff --name-only --diff-filter=ACMRTUXB -- '*.ts' '*.tsx'
  git diff --cached --name-only --diff-filter=ACMRTUXB -- '*.ts' '*.tsx'
  git ls-files --others --exclude-standard -- '*.ts' '*.tsx'
} | sort -u)
changed_ts=()
for path in "${candidate_ts[@]}"; do
  if [[ -f "$path" ]]; then
    changed_ts+=("$path")
  fi
done
if ((${#changed_ts[@]})); then
  bunx biome format --write "${changed_ts[@]}"
fi
```

- Format this ExecPlan after updating `Progress`:

```sh
mdtablefix --in-place --wrap docs/execplans/roadmap-1-2-3.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-2-3.md
```

- `make all`
- `make markdownlint`
- `make nixie`

### Work item 3: Move diagnostic data shapes into a types module

Purpose: isolate the public diagnostic model from constructors and formatters.

Documentation implemented:

- `docs/roadmap.md` section 1.2.3.
- `docs/technical-design.md` section 8, especially the fields `file`, `rule`,
  `severity`, `message`, `span`, `docs`, `suggestions`, `schemaVersion`, `tool`,
  `summary`, and `diagnostics`.
- `docs/terms-of-reference.md` sections 8 and 9, especially stable JSON fields
  and the Node/Bun TypeScript constraint.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 4.A,
  5.A, and 5.B.
- `AGENTS.md` "Runtime Validation & Types".

Skills to load:

- `grepai`, `leta`, `biome-typescript`, and `sem`.

Edits:

- Create `src/diagnostics/types.ts`.
- Move `DIAGNOSTIC_SCHEMA_VERSION`, `TOOL_NAME`, `SourcePosition`,
  `SourceSpan`, `DiagnosticSuggestion`, `Diagnostic`, `DiagnosticSummary`,
  `ToolInfo`, and `DiagnosticReport` from `src/index.ts`.
- Import `DiagnosticSeverity` and `RuleId` with `import type`.
- Update `src/index.ts` to re-export the same public types and constants.
- Update `tests/diagnostics/architecture.test.ts` so
  `expectPackageEntryShape` expects `./diagnostics/types` instead of public
  type declarations living in `src/index.ts`. Assert `diagnosticModuleFiles()`
  includes exactly `rule-id.ts`, `severity.ts`, and `types.ts` at this point.
  Assert `src/index.ts` no longer declares `DIAGNOSTIC_SCHEMA_VERSION`,
  `TOOL_NAME`, `SourcePosition`, `SourceSpan`, `DiagnosticSuggestion`,
  `Diagnostic`, `DiagnosticSummary`, `ToolInfo`, or `DiagnosticReport`.
- Update this ExecPlan's `Progress` and revision note before the commit.

Tests required:

- Unit tests: `tests/diagnostics/types.test.ts` keeps representative
  diagnostic construction and stable constants checks through `odw-lint`.
- Type-level tests: the same file must prove `Diagnostic`, `DiagnosticSummary`,
  and `DiagnosticReport` still match the documented readonly shapes.
- Architecture test: `tests/diagnostics/architecture.test.ts` asserts the
  exact module and declaration ownership described above.
- Behavioural and end-to-end tests: not required; no runtime workflow changes.

Validation:

- `bun test tests/diagnostics/types.test.ts`
- Discover and format every changed TypeScript file:

```sh
mapfile -t candidate_ts < <({
  git diff --name-only --diff-filter=ACMRTUXB -- '*.ts' '*.tsx'
  git diff --cached --name-only --diff-filter=ACMRTUXB -- '*.ts' '*.tsx'
  git ls-files --others --exclude-standard -- '*.ts' '*.tsx'
} | sort -u)
changed_ts=()
for path in "${candidate_ts[@]}"; do
  if [[ -f "$path" ]]; then
    changed_ts+=("$path")
  fi
done
if ((${#changed_ts[@]})); then
  bunx biome format --write "${changed_ts[@]}"
fi
```

- Format this ExecPlan after updating `Progress`:

```sh
mdtablefix --in-place --wrap docs/execplans/roadmap-1-2-3.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-2-3.md
```

- `make all`
- `make markdownlint`
- `make nixie`

### Work item 4: Move diagnostic report helpers into a report module

Purpose: keep report summary counting and envelope creation in one pure helper
module.

Documentation implemented:

- `docs/roadmap.md` section 1.2.3.
- `docs/technical-design.md` section 8, especially summary counts after
  severity overrides and the versioned envelope.
- `docs/technical-design.md` section 15, which requires stable diagnostics for
  the first useful release.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 4.A,
  5.A, and 5.B.
- `AGENTS.md` "Functions" and "Runtime Validation & Types".

Skills to load:

- `grepai`, `leta`, `biome-typescript`, and `sem`.

Edits:

- Create `src/diagnostics/report.ts`.
- Move `validateReportFileCount`, `countDiagnostics`, and
  `createDiagnosticReport` from `src/index.ts`.
- Import `DIAGNOSTIC_SCHEMA_VERSION`, `TOOL_NAME`, `Diagnostic`, and
  `DiagnosticReport` from `src/diagnostics/types.ts`, using `import type` for
  types.
- Update `src/index.ts` to re-export `countDiagnostics` and
  `createDiagnosticReport`.
- Update `tests/diagnostics/architecture.test.ts` so
  `expectPackageEntryShape` expects `./diagnostics/report`. Assert
  `diagnosticModuleFiles()` includes exactly `report.ts`, `rule-id.ts`,
  `severity.ts`, and `types.ts` at this point. Assert `src/index.ts` no longer
  declares `validateReportFileCount`, `countDiagnostics`, or
  `createDiagnosticReport`.
- Update this ExecPlan's `Progress` and revision note before the commit.

Tests required:

- Unit tests: `tests/diagnostics/report.test.ts` keeps empty-list counts,
  invalid file-count rejection, per-severity counts, order-stability counts,
  hint/info separation, report envelope creation, and caller-owned array
  snapshotting.
- Architecture test: `tests/diagnostics/architecture.test.ts` asserts the
  exact module and declaration ownership described above.
- Property tests: not required; table-driven coverage over every severity is
  enough because `DIAGNOSTIC_SEVERITIES` is a finite tuple.

Validation:

- `bun test tests/diagnostics/report.test.ts`
- Discover and format every changed TypeScript file:

```sh
mapfile -t candidate_ts < <({
  git diff --name-only --diff-filter=ACMRTUXB -- '*.ts' '*.tsx'
  git diff --cached --name-only --diff-filter=ACMRTUXB -- '*.ts' '*.tsx'
  git ls-files --others --exclude-standard -- '*.ts' '*.tsx'
} | sort -u)
changed_ts=()
for path in "${candidate_ts[@]}"; do
  if [[ -f "$path" ]]; then
    changed_ts+=("$path")
  fi
done
if ((${#changed_ts[@]})); then
  bunx biome format --write "${changed_ts[@]}"
fi
```

- Format this ExecPlan after updating `Progress`:

```sh
mdtablefix --in-place --wrap docs/execplans/roadmap-1-2-3.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-2-3.md
```

- `make all`
- `make markdownlint`
- `make nixie`

### Work item 5: Move text diagnostic formatting into a text module

Purpose: keep human-readable diagnostic rendering separate from the JSON report
contract while preserving their shared input objects.

Documentation implemented:

- `docs/roadmap.md` section 1.2.3.
- `docs/technical-design.md` section 8, especially "Text output is derived
  from the same diagnostic objects as JSON output."
- `docs/technical-design.md` sections 7.0 and 7.3 for future text output
  integration context.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 4.A,
  5.A, and 5.B.
- `AGENTS.md` "Observability".

Skills to load:

- `grepai`, `leta`, `biome-typescript`, and `sem`.

Edits:

- Create `src/diagnostics/text.ts`.
- Move `isControlWhitespace`, `normalizeTextField`, and
  `formatTextDiagnostics` from `src/index.ts`.
- Import `Diagnostic` from `src/diagnostics/types.ts` with `import type`.
- Update `src/index.ts` to re-export `formatTextDiagnostics`.
- Update `tests/diagnostics/architecture.test.ts` so
  `expectPackageEntryShape` expects `./diagnostics/text`. Assert
  `diagnosticModuleFiles()` includes exactly `report.ts`, `rule-id.ts`,
  `severity.ts`, `text.ts`, and `types.ts` at this point. Assert `src/index.ts`
  no longer declares `isControlWhitespace`, `normalizeTextField`, or
  `formatTextDiagnostics`.
- Update this ExecPlan's `Progress` and revision note before the commit.

Tests required:

- Unit tests: `tests/diagnostics/text.test.ts` keeps empty output, one-line
  formatting, text-only control-whitespace normalization, order preservation,
  and JSON/text shared diagnostic assertions.
- Snapshot tests: keep the text snapshot and update only if the owner path
  changed during test splitting; payload changes are out of scope.
- Architecture test: `tests/diagnostics/architecture.test.ts` asserts the
  exact module and declaration ownership described above.

Validation:

- `bun test tests/diagnostics/text.test.ts`
- Discover and format every changed TypeScript file:

```sh
mapfile -t candidate_ts < <({
  git diff --name-only --diff-filter=ACMRTUXB -- '*.ts' '*.tsx'
  git diff --cached --name-only --diff-filter=ACMRTUXB -- '*.ts' '*.tsx'
  git ls-files --others --exclude-standard -- '*.ts' '*.tsx'
} | sort -u)
changed_ts=()
for path in "${candidate_ts[@]}"; do
  if [[ -f "$path" ]]; then
    changed_ts+=("$path")
  fi
done
if ((${#changed_ts[@]})); then
  bunx biome format --write "${changed_ts[@]}"
fi
```

- Format this ExecPlan after updating `Progress`:

```sh
mdtablefix --in-place --wrap docs/execplans/roadmap-1-2-3.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-2-3.md
```

- `make all`
- `make markdownlint`
- `make nixie`

### Work item 6: Move JSON Schema construction and collapse the package barrel

Purpose: finish the focused diagnostic modules and make `src/index.ts` an
explicit public barrel rather than a mixed implementation module.

Documentation implemented:

- `docs/roadmap.md` section 1.2.3.
- `docs/technical-design.md` section 8 for the schema envelope and source
  position minimums.
- `docs/documentation-style-guide.md` "Design document" guidance that schemas
  and protocols should name their source of truth.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 4.A,
  5.A, and 5.B.
- `AGENTS.md` "Public APIs" and "Runtime Validation & Types".

Skills to load:

- `grepai`, `leta`, `biome-typescript`, and `sem`.

Edits:

- Use `leta mv` to move `src/diagnostic-schema.ts` to
  `src/diagnostics/schema.ts`.
- Update its imports to use `src/diagnostics/severity.ts`.
- If useful, extract private helpers only for repeated source-position schema
  objects. Do not create a general schema builder or add a runtime validator.
- Update `src/index.ts` so it explicitly re-exports public values and types
  from:
  - `src/diagnostics/schema.ts`;
  - `src/diagnostics/severity.ts`;
  - `src/diagnostics/rule-id.ts`;
  - `src/diagnostics/types.ts`;
  - `src/diagnostics/report.ts`;
  - `src/diagnostics/text.ts`;
  - `src/static-analysis/index.ts`.
- Remove obsolete top-level diagnostic modules after imports are updated.
- Update `tests/diagnostics/architecture.test.ts` so the final
  `expectPackageEntryShape` module list is exactly `./diagnostics/schema`,
  `./diagnostics/severity`, `./diagnostics/rule-id`, `./diagnostics/types`,
  `./diagnostics/report`, `./diagnostics/text`, and `./static-analysis`. Assert
  `diagnosticModuleFiles()` is exactly `report.ts`, `rule-id.ts`, `schema.ts`,
  `severity.ts`, `text.ts`, and `types.ts`. Assert `src/index.ts` has no
  top-level variable, function, class, interface, or type-alias declarations.
  Assert no package export subpath is added beyond `.` and `./package.json`.
- Update this ExecPlan's `Progress` and revision note before the commit.

Tests required:

- Unit tests: `tests/diagnostics/schema.test.ts` keeps severity enum reuse,
  required envelope keys, summary shape, source-position minimums, and
  `additionalProperties: false` assertions.
- Snapshot tests: keep the reviewed JSON Schema snapshot. Any schema payload
  change is out of scope unless it is caused solely by deterministic property
  ordering from equivalent construction.
- Architecture test: assert the final module list is exactly
  `severity.ts`, `rule-id.ts`, `types.ts`, `report.ts`, `text.ts`, and
  `schema.ts`; assert `src/index.ts` has no helper implementation declarations;
  and assert `package.json` still exposes only `.` and `./package.json`.
- Public API test: keep at least one test file importing every public
  diagnostic value through `odw-lint`.

Validation:

- `bun test tests/diagnostics/schema.test.ts tests/diagnostics/architecture.test.ts`
- Discover and format every changed TypeScript file:

```sh
mapfile -t candidate_ts < <({
  git diff --name-only --diff-filter=ACMRTUXB -- '*.ts' '*.tsx'
  git diff --cached --name-only --diff-filter=ACMRTUXB -- '*.ts' '*.tsx'
  git ls-files --others --exclude-standard -- '*.ts' '*.tsx'
} | sort -u)
changed_ts=()
for path in "${candidate_ts[@]}"; do
  if [[ -f "$path" ]]; then
    changed_ts+=("$path")
  fi
done
if ((${#changed_ts[@]})); then
  bunx biome format --write "${changed_ts[@]}"
fi
```

- Format this ExecPlan after updating `Progress`:

```sh
mdtablefix --in-place --wrap docs/execplans/roadmap-1-2-3.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-2-3.md
```

- `make all`
- `make markdownlint`
- `make nixie`

### Work item 7: Close roadmap and living plan documentation

Purpose: record completion after the code split has landed and all gates pass.

Documentation implemented:

- `docs/roadmap.md` section 1.2.3.
- `docs/developers-guide.md` "Documentation Upkeep".
- `docs/documentation-style-guide.md` "Markdown rules".
- ExecPlan skill "Mandatory living sections" and "Revision note".

Skills to load:

- `execplans`.
- `grepai` only if looking up related roadmap wording.
- `sem` before commit.

Edits:

- Update this ExecPlan's `Progress`, `Decision log`,
  `Outcomes & retrospective`, and `Status`.
- Mark `docs/roadmap.md` task 1.2.3 complete only after code validation is
  green.
- Append a revision note at the bottom of this ExecPlan describing the closure
  update.

Tests required:

- Markdown validation only, plus the full repository gate to confirm the final
  tree still passes.

Validation:

- `mdtablefix --in-place --wrap docs/execplans/roadmap-1-2-3.md docs/roadmap.md`
- `bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-2-3.md docs/roadmap.md`
- `make all`
- `make markdownlint`
- `make nixie`

## Concrete steps

Run all commands from `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-2-3`.

Before each work item:

```sh
git branch --show
git status --short
grepai search --workspace Projects --project odw-lint "<English intent query>" --toon --compact --limit 10
leta files src/
leta files tests/
```

During code movement, prefer `leta mv` for file moves and `leta refs` for
symbol usage checks. Use exact text search only for comments, Markdown,
configuration, or literal strings that are not symbols.

After each code work item, run the item-specific focused test, then discover
and format every changed TypeScript file. This is deliberately based on Git
state rather than a hand-written file list, because `leta mv` may update
imports in files the implementer did not name before the move:

```sh
mapfile -t candidate_ts < <({
  git diff --name-only --diff-filter=ACMRTUXB -- '*.ts' '*.tsx'
  git diff --cached --name-only --diff-filter=ACMRTUXB -- '*.ts' '*.tsx'
  git ls-files --others --exclude-standard -- '*.ts' '*.tsx'
} | sort -u)
changed_ts=()
for path in "${candidate_ts[@]}"; do
  if [[ -f "$path" ]]; then
    changed_ts+=("$path")
  fi
done
if ((${#changed_ts[@]})); then
  bunx biome format --write "${changed_ts[@]}"
fi
```

Then run:

```sh
make all 2>&1 | tee "/tmp/make-all-$(get-project)-$(git branch --show).out"
sem diff --format json
git status --short
```

Every work item changes this ExecPlan. After updating the living sections, run
file-scoped Markdown formatting over the changed Markdown files:

```sh
mapfile -t changed_md < <(git ls-files --modified --others --exclude-standard -- '*.md')
if ((${#changed_md[@]})); then
  mdtablefix --in-place --wrap "${changed_md[@]}"
  bunx markdownlint-cli2 --fix "${changed_md[@]}"
fi
make all 2>&1 | tee "/tmp/make-all-$(get-project)-$(git branch --show).out"
make markdownlint 2>&1 | tee "/tmp/markdownlint-$(get-project)-$(git branch --show).out"
make nixie 2>&1 | tee "/tmp/nixie-$(get-project)-$(git branch --show).out"
```

Expected successful gate shape:

```plaintext
make all: build, check-fmt, lint, typecheck, and test complete with exit code 0.
make markdownlint: markdownlint-cli2 reports no remaining Markdown errors.
make nixie: Mermaid validation exits 0.
```

Commit after each passing work item with an imperative message that names the
single logical change.

## Validation and acceptance

The task is accepted when all of the following are true:

- Public consumers can still import the diagnostic API from `odw-lint`.
- `src/diagnostics/severity.ts` owns diagnostic severity values.
- `src/diagnostics/rule-id.ts` owns rule-id branding, parsing, predicates, and
  trusted construction errors.
- `src/diagnostics/types.ts` owns diagnostic data shapes and report constants.
- `src/diagnostics/report.ts` owns summary counting and report envelope
  creation.
- `src/diagnostics/text.ts` owns one-line text diagnostic formatting.
- `src/diagnostics/schema.ts` owns `DIAGNOSTIC_REPORT_SCHEMA`.
- `src/index.ts` is an explicit package barrel and does not contain diagnostic
  helper implementations.
- `tests/**` is split by diagnostic responsibility and no changed test file is
  over 400 lines.
- No production code imports ODW executable runtime paths.
- `make all` passes.
- `make markdownlint` and `make nixie` pass after Markdown closure updates.

Quality criteria:

- Unit tests: focused Bun tests cover every moved diagnostic responsibility.
- Type tests: `expectTypeOf` assertions continue to pin the public TypeScript
  model.
- Snapshot tests: JSON Schema and text output snapshots remain reviewer-useful
  and semantically unchanged.
- Architecture tests: source files prove the module split exists without
  public subpath exports.
- Behavioural tests: not required for this refactor because no CLI or workflow
  execution path changes.
- Property tests: not required because the preserved contracts are finite and
  table-driven in this task.
- End-to-end tests: not required until CLI and parser tasks introduce
  externally observable workflow checking.

## Idempotence and recovery

The work is mostly file movement and re-export rewiring. If a move goes wrong,
use `leta refs <symbol>` to find missed imports and `sem diff` to review the
semantic shape before committing. Do not use destructive git commands.

If a formatter rewrites unrelated files, park the unrelated churn in a named
discard stash that includes `task=1.2.3`, then re-run file-scoped formatting.
If tests fail because snapshots moved, inspect the old and new snapshot payload
before updating. Do not accept payload changes that alter diagnostic contracts.

The plan is safe to resume after interruption because every work item ends in a
gate-passing commit. If resuming mid-item, inspect `git status --short`,
`sem diff`, and the `Progress` section before editing.

## Artifacts and notes

Research commands run during planning:

```plaintext
grepai search --workspace Projects --project odw-lint "diagnostic contract schema module split" \
  --toon --compact --limit 10
grepai search --workspace Projects --project odw-lint "text diagnostics formatting report helpers" \
  --toon --compact --limit 10
leta grep ".*" "src/.*" -k function,interface,type,constant,variable,class --head 200
leta calls --from createDiagnosticReport --max-depth 2
leta calls --from formatTextDiagnostics --max-depth 2
leta calls --from parseRuleId --max-depth 2
```

Locked-version evidence gathered during planning:

```plaintext
bun install installed @biomejs/biome@2.5.1, bun-types@1.3.14,
oxlint@1.71.0, and typescript@5.9.3.
bun --revision reported 1.3.11+af24e281e.
node_modules/@biomejs/cli-linux-x64/biome --version reported 2.5.1.
bunx oxlint --version reported 1.71.0.
```

Official documentation checked with Firecrawl:

```plaintext
https://www.typescriptlang.org/docs/handbook/2/modules.html
https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
https://bun.sh/docs/cli/test
https://biomejs.dev/reference/cli/#biome-check
https://oxc.rs/docs/guide/usage/linter.html
https://git-scm.com/docs/git-diff
https://git-scm.com/docs/git-ls-files
```

## Interfaces and dependencies

Final intended source layout:

```plaintext
src/
  index.ts
  diagnostics/
    rule-id.ts
    schema.ts
    severity.ts
    report.ts
    text.ts
    types.ts
  static-analysis/
    index.ts
    types.ts
```

Final public imports must remain package-entry imports:

```ts
import {
  countDiagnostics,
  createDiagnosticReport,
  DIAGNOSTIC_REPORT_SCHEMA,
  DIAGNOSTIC_SCHEMA_VERSION,
  DIAGNOSTIC_SEVERITIES,
  formatTextDiagnostics,
  InvalidRuleIdError,
  isRuleId,
  makeRuleId,
  parseRuleId,
  TOOL_NAME,
} from "odw-lint";
import type {
  Diagnostic,
  DiagnosticReport,
  DiagnosticSeverity,
  DiagnosticSummary,
  DiagnosticSuggestion,
  InvalidRuleId,
  InvalidRuleIdReason,
  RuleId,
  RuleIdParseResult,
  SourcePosition,
  SourceSpan,
  ToolInfo,
} from "odw-lint";
```

No package subpath such as `odw-lint/diagnostics/rule-id` should be added in
this task. No new dependencies should be added.

## Revision notes

Round-2 planning revision, 2026-06-28T07:04Z: made the architecture-test
boundary concrete by naming `tests/diagnostics/architecture.test.ts`, its
TypeScript compiler API helper strategy, and its package-entry assertions.
Every work item now requires a living-plan update, file-scoped Markdown
formatting, `make markdownlint`, and `make nixie`. TypeScript formatting now
uses Git-discovered changed `.ts` and `.tsx` files instead of hand-written
subsets, so import rewrites from `leta mv` are covered. External-tool evidence
now records concrete local version/source facts and Firecrawl-derived official
documentation facts for TypeScript, Bun, Biome, and Oxlint.

Standards-citation follow-up, 2026-06-28T07:18Z: added explicit citations for
`docs/complexity-antipatterns-and-refactoring-strategies.md` sections 4.A, 5.A,
and 5.B to the work items that perform the module split. Also added the
`docs/scripting-standards.md` script-governance sections as a stop-and-revise
constraint because this task should not introduce automation scripts.

Round-3 planning revision, 2026-06-28T07:23Z: replaced every stale TypeScript
formatting target-discovery recipe with a verified recipe that combines
unstaged tracked changes, staged tracked changes, and untracked files, then
filters to paths that still exist before calling Biome. This resolves the
deleted-file failure mode for work item 1 and the moved-file cases in work
items 2 and 6 without weakening the per-item formatting and gate requirements.

Round-4 planning revision, 2026-06-28T08:38Z: widened the autonomous scope
tolerance to include the two legacy top-level diagnostic files that the plan
already moves, only until those files are moved or removed. Work item 1 now
consolidates duplicate declaration-level package-entry exports before adding
`expectPackageEntryShape`, and the architecture helper remains
non-deduplicating so the test catches future duplicate barrel declarations. The
concrete steps now call `leta files` once per path, matching the verified CLI
behaviour.

Work item 1 implementation note, 2026-06-28T07:52Z: split `tests/index.test.ts`
into responsibility-focused diagnostic and static-analysis suites, added
source-shape architecture assertions with the TypeScript compiler API, updated
snapshots for owner-path churn only, and kept all public imports through
`odw-lint`.

Work item 1 review note, 2026-06-28T07:52Z: CodeRabbit reported two valid
test-coverage findings. The implementation tightened exact public type
assertions, added a package-entry-only consumer fixture, and added a focused
report-envelope snapshot while preserving explicit behavioural assertions.

Work item 2 implementation note, 2026-06-28T08:05Z: moved
`src/diagnostic-severity.ts` to `src/diagnostics/severity.ts`, extracted the
rule-id brand, parser, predicate, trusted constructor, and structured error
types into `src/diagnostics/rule-id.ts`, and updated architecture assertions
for the interim module layout.

Work item 2 review note, 2026-06-28T08:05Z: CodeRabbit correctly identified
that the severity tuple could still be mutated at runtime. The implementation
now wraps `DIAGNOSTIC_SEVERITIES` in `Object.freeze` and tests the frozen
runtime contract.

Work item 3 implementation note, 2026-06-28T08:09Z: extracted
`DIAGNOSTIC_SCHEMA_VERSION`, `TOOL_NAME`, source positions, spans, suggestions,
diagnostics, summaries, tool metadata, and report envelope types into
`src/diagnostics/types.ts`, then updated architecture assertions for the
interim ownership boundary.

Work item 4 implementation note, 2026-06-28T08:13Z: extracted
`validateReportFileCount`, `countDiagnostics`, and `createDiagnosticReport` into
`src/diagnostics/report.ts`, then updated package-entry and architecture
assertions for report-helper ownership.

Work item 4 review note, 2026-06-28T08:13Z: CodeRabbit correctly found that
caller-owned nested diagnostic objects could mutate `report.diagnostics` after
summary calculation. `createDiagnosticReport` now clones spans and suggestions
before counting and returning diagnostics, with a regression test for nested
mutation.

Work item 5 implementation note, 2026-06-28T08:18Z: extracted
`isControlWhitespace`, `normalizeTextField`, and `formatTextDiagnostics` into
`src/diagnostics/text.ts`, then updated package-entry and architecture
assertions for text-formatting ownership.

Work item 5 review note, 2026-06-28T08:18Z: CodeRabbit correctly found that
Unicode line-breaking separators could still make text diagnostics span
multiple lines. `isControlWhitespace` now includes U+0085, U+2028, and U+2029,
with a focused formatter regression test.

Work item 6 implementation note, 2026-06-28T08:22Z: moved
`src/diagnostic-schema.ts` to `src/diagnostics/schema.ts`, updated its severity
import to the sibling diagnostics module, and updated architecture assertions
so the final package barrel has no top-level declarations.

Work item 6 review note, 2026-06-28T08:22Z: CodeRabbit correctly found that the
schema could drift from report-builder constants. `DIAGNOSTIC_REPORT_SCHEMA`
now reuses `DIAGNOSTIC_SCHEMA_VERSION` and `TOOL_NAME` from
`src/diagnostics/types.ts`.

Work item 7 closure note, 2026-06-28T08:27Z: marked roadmap task 1.2.3 complete
and set this ExecPlan to COMPLETE after the final diagnostic module layout
passed `make all`, `make markdownlint`, and `make nixie`.
