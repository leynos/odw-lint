# Add a public API removal guard for package exports

This ExecPlan (execution plan) is a living document. The sections `Constraints`,
`Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 1.5.3 hardens the review gate for the private `odw-lint` package
entry. The current package is private, but `package.json` declares `main`,
`types`, and the root `exports["."]` condition target as `./src/index.ts`, and
tests already import public names through `odw-lint`. Later roadmap slices will
add parser, mapper, reporter, and command code that depend on this entry point.

After this plan is implemented, the repository test suite fails when a roadmap
slice accidentally removes or renames a named export from the declared package
entry without an intentional update to the reviewed public export list. Success
is observable by running `make all`: the new architecture test passes against
the current `src/index.ts` export surface, and a local red-check mutation that
removes one expected export from the reviewed list fails the focused Bun test.

Implementation must not begin until this draft is reviewed and approved.

## Constraints

- Work only in the git-donkey worktree for branch `roadmap-1-5-3`:
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-3`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as canonical. Fetch with a remote-tracking update before
  package-entry guard work and before roadmap close-out:
  `git fetch origin main:refs/remotes/origin/main`.
- After every fetch that precedes editing package-entry tests,
  `package.json`, or `docs/roadmap.md`, prove branch freshness with
  `git merge-base --is-ancestor origin/main HEAD`. If that command exits
  non-zero, stop before editing and rebase, refresh, or escalate. A triple-dot
  diff is not a freshness proof because it can be empty while `origin/main`
  has advanced beyond the branch.
- Use this GrepAI command shape as the primary intent-search tool:

  ```sh
  grepai search --workspace Projects --project odw-lint "<English intent query>" --toon --compact
  ```

  The GrepAI index reflects canonical `main` only, so every branch-local fact
  must be verified inside this worktree with `leta`, exact text search, or
  direct file inspection before acting.
- Use `leta` for branch-local symbol navigation, references, call graphs, and
  refactoring. Exact text search is acceptable for Markdown, JSON, Makefile
  rules, lockfile entries, and literal strings that are not code symbols.
- Use `sem` instead of raw Git history commands if codebase history or blame is
  needed. Ordinary `git fetch`, `git status`, and scoped diff checks remain
  acceptable for branch freshness and commit hygiene.
- Read and obey `AGENTS.md`, `docs/terms-of-reference.md`,
  `docs/technical-design.md`, `docs/adr/0001-static-analysis-boundary.md`,
  `docs/developers-guide.md`, `docs/scripting-standards.md`,
  `docs/complexity-antipatterns-and-refactoring-strategies.md`,
  `docs/documentation-style-guide.md`, and `docs/roadmap.md` before
  implementation. No `docs/users-guide.md` exists in this worktree.
- Use en-GB Oxford spelling in prose and comments. Preserve external API names
  exactly.
- Keep every work item independently committable and gate-passable. Commit
  after each completed work item, and run that work item's gates before the
  commit.
- Do not add or update package dependencies. The expected implementation uses
  existing Bun 1.3.11, locked TypeScript 5.9.3, Node built-ins, Biome, Oxlint,
  markdownlint, nixie, and repository Make targets.
- Do not add production `src/` code for this task. The expected code change is
  a test-only architecture guard plus documentation close-out.
- Do not import executable ODW runtime paths in production code or tests for
  this guard. This task does not need ODW loader parity.
- Do not execute workflow source, import workflow fixtures as modules, or call
  ODW loader, primitive, launcher, worker, or agent-dispatch paths.
- Do not use a snapshot mechanism for this guard. Use an explicit reviewed
  `EXPECTED_PUBLIC_PACKAGE_EXPORTS` list in a Bun architecture test so
  reviewers see every intentional public API addition or removal in ordinary
  diffs.
- Keep new test helpers focused and declarative. Avoid ad hoc string parsing of
  TypeScript source; use the locked TypeScript compiler API.
- Keep source and test files under 400 physical lines.
- Format only changed files. Do not run repository-global mutating formatters
  such as `make fmt`, `bun fmt`, or `mdformat-all`.
- For Markdown files changed by each work item, run `mdtablefix` and
  `markdownlint-cli2 --fix` only on those exact paths before gates.
- Run long validation commands through `tee` into `/tmp`, for example
  `/tmp/all-odw-lint-roadmap-1-5-3.out`.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances

- Scope: stop and escalate if implementation needs production code changes or
  more than one new TypeScript test file.
- Public API: stop and escalate if any existing public import from `odw-lint`
  must be removed, renamed, moved to a subpath, or hidden behind a different
  package condition.
- Package shape: stop and escalate if `package.json` root export conditions no
  longer point to one package entry file, or if the task requires changing
  `main`, `types`, or `exports`.
- Dependency: stop and escalate before adding or updating any package
  dependency, including API Extractor, a declaration bundler, or a package
  export analyser.
- Mechanism: stop and revise this plan if TypeScript 5.9.3 cannot structurally
  enumerate named exports from `src/index.ts`; do not replace the selected
  architecture test with an unresearched workaround.
- Roadmap close-out: stop and escalate if updating `docs/roadmap.md` would
  delete or modify roadmap, docs, or test work from newer `origin/main` beyond
  the intentional task 1.5.3 checkbox.
- Test proof: stop and escalate if a focused red check cannot demonstrate that
  removing a reviewed public export name fails before the final green state.
- Gate attempts: stop and record options if `make all` still fails after three
  focused fix attempts in one work item.
- Formatting: if a formatter rewrites unrelated files, park that churn in a
  named discard stash using
  `df12-stash v1 task=1.5.3 kind=discard reason="<short>"`, restore the
  intended file set, and re-run only file-scoped formatting.

## Risks

- Risk: the guard duplicates existing architecture tests and becomes another
  broad file near the line limit. Severity: medium. Likelihood: medium.
  Mitigation: add a new focused `tests/diagnostics/public-api-surface.test.ts`
  file instead of expanding `tests/diagnostics/architecture.test.ts`, which is
  already 364 lines.

- Risk: the guard only proves that a few consumer examples compile, not that
  every named export stays present. Severity: high. Likelihood: medium.
  Mitigation: enumerate every named export from the package entry with the
  TypeScript compiler API and compare that set with a reviewed expected list.

- Risk: a snapshot-based guard could be updated mechanically and hide a
  removal. Severity: medium. Likelihood: medium. Mitigation: do not use
  snapshots. Keep the expected public surface in the test source as an explicit
  sorted string list.

- Risk: parsing only top-level `ExportDeclaration` nodes misses direct and
  default exports that still change the package API. Severity: high.
  Likelihood: medium. Mitigation: scan every top-level statement in the package
  entry. Accept only explicit named re-export declarations. Fail on wildcard
  re-exports, namespace re-exports, `ExportAssignment`, any top-level statement
  with `export` or `default` modifiers outside an explicit named re-export, and
  any other non-empty top-level statement in the entry facade.

- Risk: a future root export condition points at a different file, or uses a
  nested/non-string target, while the test silently ignores it. Severity: high.
  Likelihood: medium. Mitigation: parse `package.json` as `unknown` and perform
  runtime assertions that `main` and `types` are strings, `exports["."]` is a
  flat object, every root condition value is a string, no root condition target
  is ignored, and all declared root targets resolve to the same
  repository-relative package entry before reading that file.

- Risk: close-out on a stale task branch accidentally removes newer roadmap or
  docs work from `origin/main`. Severity: high. Likelihood: medium. Mitigation:
  fetch with a remote-tracking update before the close-out work item, require
  `git merge-base --is-ancestor origin/main HEAD`, and then inspect a scoped
  `docs/roadmap.md` diff against refreshed `origin/main`. The only intentional
  roadmap delta is changing task `1.5.3` from `[ ]` to `[x]`; any other roadmap
  delta requires rebase, refresh, or escalation before the completion tick.

## Progress

- [x] (2026-06-29T00:00Z) Confirmed this worktree is
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-3` on branch
  `roadmap-1-5-3`.
- [x] (2026-06-29T00:00Z) Read `AGENTS.md`.
- [x] (2026-06-29T00:00Z) Loaded the `execplans`, `leta`, `grepai`,
  `firecrawl-mcp`, `commit-message`, `en-gb-oxendict-style`, and
  `biome-typescript` skills. No TypeScript-specific router skill is available;
  `biome-typescript` is the relevant TypeScript tooling skill for this plan.
- [x] (2026-06-29T00:00Z) Used GrepAI intent searches against canonical `main`
  for package export, build-gate, and architecture-test surfaces. Branch-local
  facts were then verified inside this worktree with `leta`, exact text search,
  file inspection, and `sem`.
- [x] (2026-06-29T00:00Z) Added this worktree to Leta and verified the existing
  package-entry and architecture-test surfaces.
- [x] (2026-06-29T00:00Z) Read the governing terms of reference, technical
  design, ADR, developer guide, scripting standards, complexity guide,
  documentation style guide, roadmap, and neighbouring ExecPlan style.
- [x] (2026-06-29T00:00Z) Fetched `origin main` and verified `HEAD` and
  `origin/main` are both at `2617b1c`, with no current branch diff.
- [x] (2026-06-29T00:00Z) Ran `make build` to install locked dependencies for
  source verification. The installed TypeScript package is 5.9.3, matching
  `bun.lock`.
- [x] (2026-06-29T00:00Z) Verified TypeScript compiler API behaviour from the
  installed `node_modules/typescript` source and official TypeScript Compiler
  API docs via Firecrawl.
- [x] (2026-06-29T00:00Z) Verified package `exports`, conditional exports,
  `types` condition, and self-reference behaviour from official Node package
  docs via Firecrawl.
- [x] (2026-06-29T00:00Z) Verified Bun test runner behaviour from official Bun
  docs via Firecrawl and installed Bun 1.3.11.
- [x] (2026-06-29T00:00Z) Read the sibling ODW public entry and loader surface
  for boundary context. It confirms this task does not need ODW runtime helper
  imports.
- [x] (2026-06-29T00:00Z) Wrote the initial ExecPlan draft, formatted only
  `docs/execplans/roadmap-1-5-3.md`, and validated the planning change with
  `make all`, `make markdownlint`, and `make nixie`.
- [x] (2026-06-28T23:42Z) Rechecked this worktree and fetched
  `origin/main`; `git merge-base --is-ancestor origin/main HEAD` passed, so
  `origin/main` is an ancestor of the current plan branch.
- [x] (2026-06-28T23:42Z) Verified the installed TypeScript 5.9.3 parser shape
  for named re-exports, wildcard re-exports, namespace re-exports, default
  class/function/expression exports, and direct `export const` declarations.
- [x] (2026-06-28T23:42Z) Revised this ExecPlan for design-review round 2 so
  the export scanner, freshness gate, external citations, and package manifest
  assertions are prescriptive rather than optional.
- [x] (2026-06-28T23:55Z) Work item 1: Added
  `tests/diagnostics/public-api-surface.test.ts` with table-driven extractor
  coverage for explicit named value, type, and alias re-exports, plus
  wildcard, namespace, default, export-assignment, and direct-export rejection
  cases.
- [x] (2026-06-28T23:55Z) Work item 1 deterministic gates passed:
  `bun test ./tests/diagnostics/public-api-surface.test.ts`, `make all`,
  `make markdownlint`, and `make nixie`.
- [x] (2026-06-28T23:55Z) Work item 1 CodeRabbit invocation was attempted
  after deterministic gates. The CLI stayed in browser-authentication wait
  state and timed out without review output; no rate-limit wait time was
  quoted.
- [x] (2026-06-29T00:02Z) Work item 2: Extended
  `tests/diagnostics/public-api-surface.test.ts` to derive the root package
  entry from runtime-validated `package.json` `main`, `types`, and
  `exports["."]` condition targets.
- [x] (2026-06-29T00:02Z) Work item 2: Added the reviewed
  `EXPECTED_PUBLIC_PACKAGE_EXPORTS` list with 38 named exports and compared it
  against the parsed `src/index.ts` facade.
- [x] (2026-06-29T00:02Z) Work item 2 red-check passed: temporarily removing
  `TOOL_NAME` from the reviewed export list made the focused Bun test fail
  with `TOOL_NAME` as an unexpected actual export, then the mutation was
  restored.
- [x] (2026-06-29T00:02Z) Work item 2 deterministic gates passed:
  `bun test ./tests/diagnostics/public-api-surface.test.ts`, `make all`,
  `make markdownlint`, and `make nixie`. `make nixie` emitted pre-existing
  line-location output for the example Mermaid diagram in
  `docs/documentation-style-guide.md`, then reported all diagrams validated
  successfully.
- [x] (2026-06-29T00:02Z) Work item 2 CodeRabbit invocation was attempted
  after deterministic gates. The CLI again stayed in browser-authentication
  wait state and timed out without review output; no rate-limit wait time was
  quoted.
- [x] (2026-06-29T00:07Z) Work item 3: Documented the package export-surface
  guard in `docs/developers-guide.md` and marked roadmap task 1.5.3 complete
  in `docs/roadmap.md`.
- [x] (2026-06-29T00:07Z) Work item 3: Verified the scoped roadmap close-out
  diff against refreshed `origin/main`; the only `docs/roadmap.md` change is
  the 1.5.3 checkbox.
- [x] (2026-06-29T00:10Z) Work item 3 deterministic gates passed:
  `make all`, `make markdownlint`, and `make nixie`.
- [x] (2026-06-29T00:10Z) Work item 3 CodeRabbit invocation was attempted
  after deterministic gates. The CLI could not complete review because
  authentication was invalid or missing: unauthenticated attempts waited for
  browser login, and an explicit-key attempt returned `UNAUTHORIZED` for an
  invalid or expired API key. No rate-limit wait time was quoted and no review
  findings were produced.
- [x] (2026-06-29T00:00Z) Addendum 1.5.3.1: extracted shared package-entry
  test support for package manifest validation, package entry resolution, and
  package facade export extraction.
- [x] (2026-06-29T00:00Z) Addendum 1.5.3.1 deterministic gates passed:
  `make all`, `make markdownlint`, and `make nixie`.
- [x] (2026-06-29T00:00Z) Addendum 1.5.3.1 CodeRabbit review completed
  after follow-up fixes for absolute and parent-directory package-entry
  targets; the final review returned zero findings.

## Surprises & discoveries

- Observation: GrepAI found existing architecture-test and public-consumer
  surfaces, but no existing all-export removal guard. Evidence: canonical
  searches for package export surface and public package tests returned
  `tests/diagnostics/architecture.test.ts`,
  `tests/diagnostics/public-consumer.test.ts`, and prior ExecPlans, while the
  branch-local tree has no `public-api-surface.test.ts`. Impact: add a focused
  guard rather than refactoring production code.

- Observation: `tests/diagnostics/architecture.test.ts` already pins package
  entry shape and module specifiers, but it does not compare every named export
  against a reviewed public surface list. Evidence: the current test asserts
  root export condition targets and expected re-export module specifiers, then
  separately checks selected importable values and types. Impact: the new guard
  should complement, not replace, existing architecture tests.

- Observation: `tests/diagnostics/architecture.test.ts` is too close to the
  project line limit for the new helper logic. Evidence: `leta files` reports
  the file at 364 lines, while `AGENTS.md` limits code files to 400 lines.
  Impact: use a new focused test file.

- Observation: TypeScript 5.9.3 supports the exact AST predicates needed for a
  structural export guard. Evidence:
  `node_modules/typescript/lib/typescript.d.ts` declares `isExportDeclaration`,
  `isNamedExports`, `isExportSpecifier`, `isStringLiteral`, `forEachChild`, and
  `createSourceFile`; the installed `typescript.js` implements those predicates
  and parsing functions. Impact: no dependency such as API Extractor is needed.

- Observation: the installed TypeScript 5.9.3 AST shape proves that scanning
  only `ExportDeclaration` nodes is insufficient. Evidence: a local Bun probe
  using `ts.createSourceFile` showed `export default class {}` parses as a
  `ClassDeclaration` with `ExportKeyword` and `DefaultKeyword`,
  `export default function f() {}` parses as a `FunctionDeclaration` with the
  same modifiers, `export default 1` parses as `ExportAssignment`, and
  `export const x = 1` satisfies `ts.isVariableStatement` with an
  `ExportKeyword` modifier. Impact: the helper must inspect every top-level
  statement and reject unsupported export-capable statements, not just compare
  named `ExportDeclaration` clauses.

- Observation: package self-reference and `exports` are the right package
  boundary to guard. Evidence: the official Node package docs state that
  `exports` defines package entry points, encapsulates unexported internals,
  and enables self-referencing through the package name when `exports` is
  present. Impact: derive the checked file from `package.json`, then verify
  named exports from that file.

- Observation: the sibling ODW checkout confirms ODW's public entry is not a
  source of safe static helper imports for this task. Evidence:
  `/data/leynos/Projects/open-dynamic-workflows` at revision
  `ecc4867fd354437c12cb4ecb21ef8ad7e94610d7` has an untracked `bun.lock` but
  its tracked `src/index.ts` exports metadata types from `loader.js` at line
  37, while `src/loader.ts` exports `loadWorkflowScript` at line 78 and
  evaluates metadata with `new Function` at line 325. Impact: this guard must
  stay local to `odw-lint` package-entry tests and must not import ODW runtime
  helpers.

- Observation: after manifest validation and public export comparison were
  added, `tests/diagnostics/public-api-surface.test.ts` is 390 physical lines.
  Evidence: `wc -l tests/diagnostics/public-api-surface.test.ts` reported
  `390`. Impact: the file remains inside the 400-line project limit, but
  future package-entry guard expansion should extract a helper or split tests
  rather than keep growing this file.

## Decision Log

- Decision: implement roadmap task 1.5.3 as a dedicated Bun architecture test,
  not as a production script, dependency, or snapshot. Rationale: the
  repository already uses Bun tests for architecture guards, the task asks for
  `make all` or an equivalent review gate to fail, and an explicit expected
  list makes intentional public API changes reviewable. Date/Author:
  2026-06-29T00:00Z / planning agent.

- Decision: use TypeScript 5.9.3 compiler API traversal rather than regular
  expressions or API Extractor. Rationale: the locked compiler API already
  exposes source parsing and export AST predicates. Adding API Extractor would
  exceed the task's dependency tolerance, while regular expressions would be
  brittle for type-only exports and aliases. Date/Author: 2026-06-29T00:00Z /
  planning agent.

- Decision: derive the package entry file from `package.json` and then compare
  its named exports. Rationale: the roadmap asks to compare the declared
  package entry against intentional public API changes. Hard-coding only
  `src/index.ts` would miss a later entry-target change. Date/Author:
  2026-06-29T00:00Z / planning agent.

- Decision: implement the export scanner as a whole-top-level-statement guard,
  not as an `ExportDeclaration` enumerator. Rationale: installed TypeScript
  5.9.3 parses default class/function exports, expression default exports, and
  direct exported variables as different top-level node kinds. A named-export
  comparison that ignores those nodes can miss API additions or replacements.
  Date/Author: 2026-06-28T23:42Z / planning agent.

- Decision: treat unsupported `package.json` root export target shapes as test
  failures, not ignored future compatibility. Rationale: Node documents nested
  conditions and multiple export target forms, but this package currently has a
  flat `exports["."]` condition object whose every target should resolve to the
  same TypeScript entry. Failing loudly is safer than silently checking only
  the string branches the helper already understands. Date/Author:
  2026-06-28T23:42Z / planning agent.

- Decision: require an ancestry freshness gate before package-entry and roadmap
  close-out edits. Rationale: `git diff origin/main...HEAD` compares from the
  merge base and does not prove that refreshed `origin/main` is already in the
  task branch. `git merge-base --is-ancestor origin/main HEAD` directly proves
  the branch contains canonical main before a close-out tick can be made.
  Date/Author: 2026-06-28T23:42Z / planning agent.

- Decision: do not use the sibling ODW checkout in the implementation.
  Rationale: ODW source is relevant background for the static-analysis boundary
  but the public API removal guard concerns `odw-lint`'s own package entry and
  can be tested without importing or evaluating ODW runtime code. Date/Author:
  2026-06-29T00:00Z / planning agent.

- Decision: keep the initial extractor helper local to
  `tests/diagnostics/public-api-surface.test.ts`.
  Rationale: the helper is a test-only architecture guard, and keeping it
  local avoids adding production API or a shared test abstraction before the
  real package-entry comparison proves the final shape. Date/Author:
  2026-06-28T23:55Z / implementation agent.

- Decision: keep manifest guard fixtures in the same test file as the export
  scanner.
  Rationale: the package entry target and named export list form one review
  guard. Keeping them together lets reviewers see how the manifest boundary and
  facade export list protect the same package API surface without adding a
  reusable abstraction for one test-only concern. Date/Author:
  2026-06-29T00:02Z / implementation agent.

## Outcomes & retrospective

Implementation is complete pending the final work item 3 commit. The focused
package export-surface guard now covers unsupported facade shapes, validates
manifest entry targets, compares the parsed package facade against the reviewed
38-name public export list, and has a red-check proof that removing a reviewed
export name fails the focused test. Maintainer documentation now tells
contributors where the reviewed export list lives, and roadmap task 1.5.3 is
marked complete. CodeRabbit review remains deferred because this environment
does not currently have valid CodeRabbit authentication.

Addendum 1.5.3.1 is complete. The public API surface test and architecture
package-entry assertions now consume shared package-entry test support without
changing the reviewed public export list or package architecture policy. The
shared support also rejects package entry targets that escape the repository
root before reading the declared entry.

## Context and orientation

The package entry is currently `src/index.ts`. It contains explicit named
re-exports from `src/diagnostics/*` and `src/static-analysis/index.ts`.
`package.json` declares:

```json
{
  "name": "odw-lint",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "bun": "./src/index.ts",
      "import": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./package.json": "./package.json"
  }
}
```

Existing tests already prove selected public names are importable through the
package self-reference:

- `tests/diagnostics/public-consumer.test.ts` compiles one consumer-style
  diagnostic report example.
- `tests/diagnostics/architecture.test.ts` checks selected diagnostic and
  static-analysis values and types, plus package entry shape.
- `tests/static-analysis/source-file-architecture.test.ts` uses TypeScript AST
  traversal for source-shape assertions and is the closest local pattern for
  this guard.

The missing behaviour is an all-export removal guard. A future branch could
delete `TOOL_NAME`, `SourceSpan`, or `spanFromOffsets` from `src/index.ts`
while leaving the current selected consumer examples green. The new test must
fail on that accidental removal and require a reviewer-visible expected-list
update for intentional changes.

## Interfaces and dependencies

Use only existing dependencies and built-ins:

- Bun 1.3.11 runs `bun test`. Official Bun docs verify that test files may be
  TypeScript, use a Jest-like `bun:test` API, run with `bun test`, and may be
  filtered by file path. Evidence: Firecrawl scraped
  `https://bun.com/docs/test.md`, sections "Run tests" and "Test Filtering",
  on 2026-06-28; `bun --version` in this worktree reports `1.3.11`.
- TypeScript 5.9.3 is locked in `bun.lock` and installed in `node_modules`.
  Its installed declarations and implementation support: `ts.createSourceFile`,
  `ts.forEachChild`, `ts.isExportDeclaration`, `ts.isNamedExports`,
  `ts.isExportSpecifier`, `ts.isExportAssignment`, and `ts.isStringLiteral`.
  Evidence: `bun.lock` pins `typescript@5.9.3`; `node_modules/typescript/package.json`
  reports version `5.9.3`; `node_modules/typescript/lib/typescript.d.ts` lines
  5572-5667 define `ExportDeclaration`, `NamedExports`, `ExportSpecifier`, and
  `ExportAssignment`; lines 9097-9100 declare the export predicates; lines
  9188-9192 declare `forEachChild` and `createSourceFile`. The installed
  `node_modules/typescript/lib/typescript.js` implements the predicates around
  lines 31093-31102 and implements `forEachChild` and `createSourceFile`
  around lines 32965-33032. Official TypeScript Compiler API docs at
  `https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API`,
  section "Traversing the AST with a little linter", show parsing source with
  `ts.createSourceFile` and traversing with `ts.forEachChild`.
- Node package docs verify that `exports` defines package entry points,
  supports conditional exports, limits unexported subpaths, and enables package
  self-reference by name when present. The `types` condition is a documented
  community condition for typing systems and should remain first in the root
  condition object. Evidence: Firecrawl scraped
  `https://nodejs.org/api/packages.html`, sections "Package entry points",
  "Conditional exports", "Community Conditions Definitions", and
  "Self-referencing a package using its name", on 2026-06-28.

The new test file should expose no public production API. Inside
`tests/diagnostics/public-api-surface.test.ts`, parse `package.json` as
`unknown`, then narrow it with local assertion helpers. Do not rely on a plain
`as PackageJson` cast. Define local helpers with clear names such as:

```ts
const EXPECTED_PUBLIC_PACKAGE_EXPORTS = [
  "DIAGNOSTIC_REPORT_SCHEMA",
  "DIAGNOSTIC_SCHEMA_VERSION",
  "DIAGNOSTIC_SEVERITIES",
  "Diagnostic",
  "DiagnosticReport",
  "DiagnosticSeverity",
  "DiagnosticSuggestion",
  "DiagnosticSummary",
  "InvalidRuleId",
  "InvalidRuleIdError",
  "InvalidRuleIdReason",
  "OriginalSourceFile",
  "RuleId",
  "RuleIdParseResult",
  "STATIC_ANALYSIS_BOUNDARY",
  "STATIC_ANALYSIS_COMPONENTS",
  "STATIC_ANALYSIS_STAGES",
  "SourceLine",
  "SourceOffsetError",
  "SourcePosition",
  "SourceSnippet",
  "SourceSpan",
  "StaticAnalysisComponent",
  "StaticAnalysisStage",
  "TOOL_NAME",
  "ToolInfo",
  "WorkflowSource",
  "countDiagnostics",
  "createDiagnosticReport",
  "createOriginalSourceFile",
  "formatTextDiagnostics",
  "isRuleId",
  "makeRuleId",
  "parseRuleId",
  "positionAtOffset",
  "sliceSourceSpan",
  "snippetForSpan",
  "spanFromOffsets",
] as const;
```

The final helper set should:

- parse a repository-relative TypeScript file with `ts.createSourceFile`;
- derive root package entry targets from a runtime-validated manifest where
  `main` and `types` are strings, `exports` is a non-null object,
  `exports["."]` is a non-null flat object, and every root condition value is a
  string;
- fail with a clear message naming the invalid manifest field or condition if a
  future target is non-string, nested, missing, or otherwise unsupported;
- assert no root condition target is ignored and all declared entry targets
  resolve to the same repository-relative path, currently `./src/index.ts`,
  before reading the file;
- enumerate exported names from `export { ... } from "..."` declarations using
  `ts.isExportDeclaration`, `ts.isNamedExports`, and each
  `ExportSpecifier.name`;
- inspect every top-level statement in the package entry, not only
  `ExportDeclaration` nodes;
- accept only explicit named re-export declarations with string module
  specifiers;
- reject wildcard exports (`export * from`), namespace re-exports
  (`export * as ns from`), `ExportAssignment` nodes, default exports, direct
  exported declarations such as `export const`, any top-level statement with an
  `ExportKeyword` or `DefaultKeyword` modifier outside an explicit named
  re-export declaration, non-string module specifiers, and non-named root
  export clauses with clear expectation failures; and
- compare the sorted actual named export list with
  `EXPECTED_PUBLIC_PACKAGE_EXPORTS`.

The current package entry intentionally uses explicit named re-exports only.
Changing that style is out of scope for roadmap task 1.5.3, so the guard should
fail if direct declarations are introduced rather than trying to infer names
from them.

## Plan of work

### Work item 1: Add a focused export-surface extractor test harness

Docs to reread before editing:

- `AGENTS.md` "TypeScript Guidance", especially "Public APIs", "Testing", and
  "Linting & Formatting".
- `docs/developers-guide.md` "Static-Analysis Boundary", "Commit Gate",
  "Tests", and "Markdown".
- `docs/technical-design.md` sections 5, 11.3, 13, and 15.
- `docs/adr/0001-static-analysis-boundary.md` "Decision" and "Consequences".
- `docs/complexity-antipatterns-and-refactoring-strategies.md` section 4.A
  and section 5.C.

Skills to load or keep active:

- `leta` for branch-local symbol and file navigation.
- `grepai` for canonical intent search if a new code surface is unclear.
- `biome-typescript` for file-scoped TypeScript formatting.
- `en-gb-oxendict-style` for comments and plan updates.
- `commit-message` before committing.

Implementation:

1. Create `tests/diagnostics/public-api-surface.test.ts` with a module JSDoc
   block explaining that the file protects the reviewed package export surface.
2. Add local helper tests around inline source strings before checking the real
   package entry. The table must cover all of these cases and expected
   outcomes:
   - `export { x } from "./x"` records `x`;
   - `export { type X } from "./x"` records `X`;
   - `export { x as y } from "./x"` records `y`;
   - `export * from "./x"` fails as an unsupported wildcard export;
   - `export * as ns from "./x"` fails as an unsupported namespace export;
   - `export default class {}` fails because it is a `ClassDeclaration` with
     export/default modifiers, not a named re-export;
   - `export default function f() {}` fails because it is a
     `FunctionDeclaration` with export/default modifiers, not a named
     re-export;
   - `export default 1` fails as an `ExportAssignment`;
   - `export const x = 1` fails because direct exported declarations are not
     allowed in the package entry facade.
3. Reuse the existing local style from `tests/diagnostics/architecture.test.ts`
   and `tests/static-analysis/source-file-architecture.test.ts`: `bun:test`,
   `node:fs`, `typescript`, sorted arrays, and small pure helpers.
4. Implement the helper as a scanner over `sourceFile.statements`. For each
   top-level statement, accept only an `ExportDeclaration` whose `exportClause`
   is `NamedExports` and whose `moduleSpecifier` is a string literal. Reject
   `ExportAssignment`, missing export clauses, `NamespaceExport` clauses,
   non-string module specifiers, direct declarations with `ExportKeyword` or
   `DefaultKeyword` modifiers, and any other top-level statement in the entry
   facade.
5. Do not yet compare the real `src/index.ts` public surface in this work item.
   This first commit proves the extractor behaviour in isolation and remains
   gate-passable.
6. Update this ExecPlan `Progress`, `Surprises & Discoveries`, and
   `Decision Log` with any implementation findings before committing.

Tests to add or update:

- Unit-style Bun tests in `tests/diagnostics/public-api-surface.test.ts` for
  the local export extractor.
- No behavioural, property, snapshot, or end-to-end tests are needed for this
  work item. The input domain is a small finite set of TypeScript export
  declaration shapes, so table-driven unit coverage is clearer than
  `fast-check`.

Validation commands from the worktree root:

```sh
bunx @biomejs/biome format --write tests/diagnostics/public-api-surface.test.ts
mdtablefix docs/execplans/roadmap-1-5-3.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-5-3.md
bun test ./tests/diagnostics/public-api-surface.test.ts 2>&1 | tee /tmp/test-public-api-surface-odw-lint-roadmap-1-5-3.out
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-5-3.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-5-3.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-5-3.out
```

Commit after the gates pass. Use `git commit -F` with a message file in
`mktemp -d`, per the `commit-message` skill.

### Work item 2: Pin the declared package entry's named public exports

Docs to reread before editing:

- `docs/roadmap.md` section 1.5, especially task 1.5.3.
- `docs/developers-guide.md` "Static-Analysis Boundary" and "Source-span
  helpers".
- `docs/technical-design.md` sections 5, 6.1, 11.3, 13, and 15.
- `docs/adr/0001-static-analysis-boundary.md` "Decision".
- Official Node package docs for package entry points, `exports`,
  conditional exports, `types`, and self-reference.
- Official TypeScript Compiler API docs for `createSourceFile` and
  `forEachChild`, plus the installed TypeScript 5.9.3 declarations for export
  predicates.

Skills to load or keep active:

- `leta` for branch-local verification.
- `grepai` for canonical intent search if a new package-entry test seam is
  unclear.
- `firecrawl-mcp` only if new official external documentation is needed.
- `biome-typescript` for file-scoped TypeScript formatting.
- `en-gb-oxendict-style` for comments and plan updates.
- `commit-message` before committing.

Implementation:

1. Refresh and verify the integration branch before comparing canonical files:

   ```sh
   git fetch origin main:refs/remotes/origin/main 2>&1 | tee /tmp/fetch-odw-lint-roadmap-1-5-3.out
   git merge-base --is-ancestor origin/main HEAD
   git status --short --branch
   git diff --name-status origin/main -- package.json src/index.ts tests/diagnostics
   ```

   If the ancestry check exits non-zero, stop before editing and rebase,
   refresh, or escalate. Do not use a triple-dot diff as a freshness gate.
2. Extend `tests/diagnostics/public-api-surface.test.ts` so it reads
   `package.json` as `unknown`, derives the declared root package entry from
   runtime-validated `main`, `types`, and every root condition target in
   `exports["."]`, and asserts they all refer to `./src/index.ts`.
3. Add manifest-shape tests or table cases proving the helper fails clearly
   when:
   - `main` is missing or non-string;
   - `types` is missing or non-string;
   - `exports["."]` is missing or not a flat object;
   - a root condition target is non-string or nested;
   - different conditions resolve to different entry files.
4. Add `EXPECTED_PUBLIC_PACKAGE_EXPORTS` with the current complete list from
   `src/index.ts`. Keep it sorted alphabetically by exported name so additions
   and removals are reviewer-visible.
5. Add the actual guard test: parse the declared package entry, enumerate named
   exports, and assert that sorted actual names equal
   `EXPECTED_PUBLIC_PACKAGE_EXPORTS`.
6. Add a focused red-check step before final validation: temporarily remove
   `TOOL_NAME` from `EXPECTED_PUBLIC_PACKAGE_EXPORTS`, run the focused Bun test
   and confirm it fails because actual exports include an unexpected name.
   Restore `TOOL_NAME` before formatting, gates, and commit. Do not commit the
   red-check mutation.
7. Update this ExecPlan `Progress`, `Surprises & Discoveries`, and
   `Decision Log` with the final export count and red-check result.

Tests to add or update:

- Extend the unit-style Bun test file with an architecture test for the real
  declared package entry.
- This is not a snapshot test. Do not add or update files under
  `tests/diagnostics/__snapshots__/` for this task.
- No behavioural, property, or end-to-end tests are needed. The externally
  observable behaviour is the repository gate failing on accidental package
  export removal, which this architecture test exercises directly.

Validation commands from the worktree root:

```sh
bun test ./tests/diagnostics/public-api-surface.test.ts 2>&1 | tee /tmp/test-public-api-surface-odw-lint-roadmap-1-5-3.out
bunx @biomejs/biome format --write tests/diagnostics/public-api-surface.test.ts
mdtablefix docs/execplans/roadmap-1-5-3.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-5-3.md
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-5-3.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-5-3.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-5-3.out
```

Commit after the gates pass. Use `git commit -F` with a message file in
`mktemp -d`, per the `commit-message` skill.

### Work item 3: Document the guard and close roadmap task 1.5.3

Docs to reread before editing:

- `AGENTS.md` "Documentation Maintenance" and "Markdown Guidance".
- `docs/documentation-style-guide.md` "Spelling", "Markdown rules",
  "Formatting", and "Roadmap task writing guidelines".
- `docs/developers-guide.md` "Commit Gate", "Tests", "Markdown", and
  "Documentation Upkeep".
- `docs/roadmap.md` section 1.5.

Skills to load or keep active:

- `en-gb-oxendict-style` for all prose.
- `execplans` because this work item updates the living plan and retrospective.
- `commit-message` before committing.
- `biome-typescript` is not needed unless TypeScript test code changes again.

Implementation:

1. Fetch and verify `origin/main` again before the close-out edit:

   ```sh
   git fetch origin main:refs/remotes/origin/main 2>&1 | tee /tmp/fetch-odw-lint-roadmap-1-5-3.out
   git merge-base --is-ancestor origin/main HEAD
   git status --short --branch
   git diff --name-status origin/main -- docs/roadmap.md
   ```

   If the ancestry check exits non-zero, stop before editing and rebase,
   refresh, or escalate.
2. Update `docs/developers-guide.md` in the test or commit-gate section to
   mention that the Bun suite contains a package export-surface guard. The
   prose should say intentional public API changes require updating the
   reviewed expected export list in
   `tests/diagnostics/public-api-surface.test.ts`.
3. Update `docs/roadmap.md` only by changing task `1.5.3` from `[ ]` to `[x]`.
   Do not change neighbouring roadmap wording in this work item.
4. Verify the roadmap close-out diff against refreshed `origin/main`. The only
   `docs/roadmap.md` semantic change in this work item should be the `1.5.3`
   checkbox. If the diff shows unrelated roadmap deletions or edits, stop and
   escalate. Use:

   ```sh
   git diff --unified=0 origin/main -- docs/roadmap.md
   ```

5. Update this ExecPlan `Progress`, `Outcomes & Retrospective`, and the
   revision note at the bottom with the final commits and validation evidence.

Tests to add or update:

- No new tests are needed in this documentation close-out work item.
- Re-run `make all` so the package export guard remains proven after docs are
  updated.

Validation commands from the worktree root:

```sh
mdtablefix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-1-5-3.md
bunx markdownlint-cli2 --fix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-1-5-3.md
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-5-3.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-5-3.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-5-3.out
```

Commit after the gates pass. Use `git commit -F` with a message file in
`mktemp -d`, per the `commit-message` skill.

## Concrete steps

All commands below run from
`/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-3`.

Before implementation:

```sh
git branch --show
git status --short --branch
git fetch origin main:refs/remotes/origin/main 2>&1 | tee /tmp/fetch-odw-lint-roadmap-1-5-3.out
git merge-base --is-ancestor origin/main HEAD
```

Expected transcript shape:

```plaintext
roadmap-1-5-3
## roadmap-1-5-3
From github.com:leynos/odw-lint
 * branch            main       -> FETCH_HEAD
git merge-base exits 0
```

If `git merge-base --is-ancestor origin/main HEAD` exits non-zero, stop before
editing package-entry tests, `package.json`, or `docs/roadmap.md`. Rebase or
refresh the task branch, then rerun the fetch and ancestry check.

During each work item:

```sh
grepai search --workspace Projects --project odw-lint "<English intent query>" --toon --compact
leta files tests/diagnostics
leta grep ".*" "tests/diagnostics/public-api-surface\\.test\\.ts" -k function,variable --head 120
```

Use exact text search or direct file inspection only when the target is a
literal string, JSON field, Markdown section, lockfile entry, or generated
validation output.

Before each commit:

```sh
git status --short
git diff --stat
git diff --check
```

Write the commit message to a temporary file and commit with `git commit -F`.
Do not use `git commit -m`.

## Validation and acceptance

The implementation is accepted when all of the following are true:

- `tests/diagnostics/public-api-surface.test.ts` exists and is under 400 lines.
- The new test derives the package entry from `package.json` rather than
  hard-coding only `src/index.ts`.
- The new test compares every current named export from the declared entry
  against a reviewed `EXPECTED_PUBLIC_PACKAGE_EXPORTS` list.
- The new test inspects every top-level statement in the package entry and
  rejects default exports, export assignments, wildcard re-exports, namespace
  re-exports, direct `export const`/`export function`/`export class` style
  declarations, non-string module specifiers, and unsupported top-level
  statements.
- The new test validates `package.json` at runtime and fails on missing,
  non-string, nested, divergent, or otherwise ignored root package entry
  targets.
- A temporary red check proves removing one reviewed export name from the
  expected list fails the focused Bun test, and the mutation is restored before
  commit.
- No package dependencies are added or updated.
- No production `src/` files change.
- `docs/developers-guide.md` documents the guard after the test lands.
- `docs/roadmap.md` marks task `1.5.3` complete, and the roadmap close-out
  diff does not delete or alter unrelated refreshed `origin/main` work.
- `make all` passes after each work item.
- `make markdownlint` and `make nixie` pass for every work item that changes
  Markdown. Because this plan is a living document, that is every work item.

Final validation commands:

```sh
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-5-3.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-5-3.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-5-3.out
```

Expected result:

```plaintext
make all exits 0
make markdownlint exits 0
make nixie exits 0
```

## Idempotence and recovery

The test and documentation edits are ordinary tracked-file changes. Re-running
the formatter and gates should converge without changing unrelated files.

If a red-check mutation is used to prove the guard, restore the file before
running final formatting and gates:

```sh
git diff -- tests/diagnostics/public-api-surface.test.ts
```

The diff must show the expected final public export list, including the export
name removed during the temporary red check.

If `bunx @biomejs/biome format --write` changes files other than
`tests/diagnostics/public-api-surface.test.ts`, stop and restore the unrelated
files before continuing. If `mdtablefix` or `markdownlint-cli2 --fix` changes
Markdown outside the explicit command path list, park that churn in a named
discard stash as described in `Constraints`.

If `make all` fails because of dependency installation, rerun `make build` once
and then rerun `make all`. If the same gate still fails after three focused fix
attempts in one work item, stop and update `Decision Log` with the failure and
options.

If a fetch shows refreshed `origin/main` is not an ancestor of `HEAD`, do not
use `git diff origin/main...HEAD` to justify continuing. That diff is useful
only as supplementary branch context. The recovery path is to rebase or refresh
the branch onto `origin/main`, rerun the ancestry check, and only then continue
with package-entry or roadmap close-out edits.

## Artifacts and notes

Research evidence gathered during the planning pass:

- This GrepAI query returned prior ExecPlan context but no dedicated
  branch-local guard:

  ```sh
  grepai search --workspace Projects --project odw-lint \
    "public package export surface and API removal checks" --toon --compact --limit 10
  ```

- This GrepAI query pointed at `src/diagnostics/rule-id.ts`, so branch-local
  code was inspected directly:

  ```sh
  grepai search --workspace Projects --project odw-lint \
    "tests for CLI commands and package exports" --toon --compact --limit 10
  ```

- This GrepAI query pointed at architecture-test patterns:

  ```sh
  grepai search --workspace Projects --project odw-lint \
    "architecture test parses TypeScript source exports" --toon --compact --limit 8
  ```

- `leta files` showed `tests/diagnostics/architecture.test.ts` at 364 lines and
  no existing `tests/diagnostics/public-api-surface.test.ts`.
- `sem diff --from origin/main --to HEAD` reported no branch-local semantic
  changes during planning.
- `sem blame tests/diagnostics/public-consumer.test.ts` showed the public
  consumer fixture was last changed by the diagnostic contract split.
- `bun.lock` pins TypeScript to 5.9.3, and
  `node_modules/typescript/package.json` confirms version 5.9.3 after
  `make build`.
- Locked TypeScript source evidence:
  `node_modules/typescript/lib/typescript.d.ts` lines 5572-5667 declare
  `ExportDeclaration`, `NamedExports`, `ExportSpecifier`, and
  `ExportAssignment`; lines 9097-9100 declare `isExportAssignment`,
  `isExportDeclaration`, `isNamedExports`, and `isExportSpecifier`; lines
  9188-9192 declare `forEachChild` and `createSourceFile`.
  `node_modules/typescript/lib/typescript.js` lines 31093-31102 implement the
  export predicates, and lines 32965-33032 implement `forEachChild` and start
  `createSourceFile`.
- A local AST-shape probe using installed TypeScript 5.9.3 wrote
  `/tmp/typescript-ast-shapes-odw-lint-roadmap-1-5-3.out` and showed:

  | Source                           | Top-level shape                                                 |
  | -------------------------------- | --------------------------------------------------------------- |
  | `export { x } from "./x"`        | `ExportDeclaration` with `NamedExports`                         |
  | `export * from "./x"`            | `ExportDeclaration` with no export clause                       |
  | `export * as ns from "./x"`      | `ExportDeclaration` with `NamespaceExport`                      |
  | `export default class {}`        | `ClassDeclaration` with `ExportKeyword` and `DefaultKeyword`    |
  | `export default function f() {}` | `FunctionDeclaration` with `ExportKeyword` and `DefaultKeyword` |
  | `export default 1`               | `ExportAssignment`                                              |
  | `export const x = 1`             | `ts.isVariableStatement(...)` true with `ExportKeyword`         |

- Official TypeScript Compiler API docs were retrieved with Firecrawl from
  `https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API`
  (`scrapeId` `019f109b-8578-72ed-9a8e-7c047f1e5d4a`). The section
  "Traversing the AST with a little linter" shows parsing source with
  `ts.createSourceFile`, traversing with `ts.forEachChild`, and doing so
  without a type checker when syntax traversal is sufficient.
- Official Node package docs were retrieved with Firecrawl from
  `https://nodejs.org/api/packages.html` (`scrapeId`
  `019f109b-57c1-743d-a990-5b38952470a9`). The sections "Package entry
  points", "Conditional exports", "Community Conditions Definitions", and
  "Self-referencing a package using its name" verify that `exports` defines
  package entry points, conditional exports are part of that mechanism,
  `types` is a documented community condition for typing systems, and package
  self-reference works through the package name only for exported paths.
- Official Bun test docs were retrieved with Firecrawl from
  `https://bun.com/docs/test.md` (`scrapeId`
  `019f109b-7122-7689-bf56-538a5a28aee0`). The sections "Run tests" and "Test
  Filtering" verify TypeScript test files, `bun:test`, file-path filtering, and
  non-zero exit on test failure.
- The sibling ODW checkout at
  `/data/leynos/Projects/open-dynamic-workflows` was inspected at revision
  `ecc4867fd354437c12cb4ecb21ef8ad7e94610d7`. It has an untracked `bun.lock`
  in that checkout, but the tracked source evidence is still clear:
  `src/index.ts` line 37 exports loader metadata types only, while
  `src/loader.ts` line 78 exports `loadWorkflowScript` and line 325 evaluates
  metadata with `new Function`. This task must not import or rely on those ODW
  runtime helpers.

## Addenda

- [x] 1.5.3.1. Extract shared package-entry support.
  - Source: audit:2.1.6; severity medium.
  - Scope: centralize package manifest validation, package entry resolution,
    package facade export extraction, and shared failure messages for public
    API and architecture tests.
  - Success: the public API surface test and architecture package-entry
    assertions consume one test-support parser without changing the reviewed
    public export list or architecture policy.

## Revision note

- 2026-06-29T00:00Z: Initial draft for roadmap task 1.5.3. This draft selects
  a TypeScript compiler API architecture test with an explicit reviewed export
  list, records the dependency and documentation research, and decomposes the
  task into three independently committable work items.
- 2026-06-28T23:42Z: Revised after design-review round 2. This revision
  requires whole-top-level-statement export scanning, adds explicit default,
  direct, wildcard, and namespace export table cases, replaces triple-dot
  freshness checks with an ancestry gate, adds scoped roadmap close-out
  comparison, records concrete Firecrawl and locked TypeScript source evidence,
  and requires runtime manifest assertions so future package export target
  forms cannot be silently ignored.
- 2026-06-28T23:55Z: Updated during implementation work item 1. This revision
  records the focused export-surface extractor test harness, notes that the
  first deterministic gates passed, and keeps the remaining package-entry
  manifest guard and documentation close-out work explicit.
- 2026-06-28T23:55Z: Marked the plan in progress during implementation and
  recorded that CodeRabbit could not complete work item 1 review because the
  CLI required browser authentication.
- 2026-06-29T00:02Z: Updated during implementation work item 2. This revision
  records the package manifest guard, the 38-name reviewed export list, the
  `TOOL_NAME` red-check result, the deterministic gate evidence, and the
  repeated CodeRabbit authentication block.
- 2026-06-29T00:07Z: Updated during implementation work item 3. This revision
  records the developer-guide documentation update, the roadmap completion
  tick, and the scoped roadmap close-out verification.
- 2026-06-29T00:10Z: Marked the ExecPlan complete after work item 3 gates and
  recorded the deferred CodeRabbit review caused by missing or expired
  CodeRabbit authentication.
- 2026-06-29T00:00Z: Completed addendum 1.5.3.1 by extracting shared
  package-entry support for the public API surface and architecture tests, then
  fixed CodeRabbit findings around escaped package-entry targets and
  current-working-directory-dependent file reads.
