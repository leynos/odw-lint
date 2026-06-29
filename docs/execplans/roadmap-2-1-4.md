# Add forbidden ODW import architecture test

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

Implementation is proceeding under the approved roadmap workflow.

## Purpose / big picture

Roadmap task 2.1.4 adds a test-only architecture guard that proves production
`odw-lint` code cannot import executable Open Dynamic Workflows (ODW) runtime
surfaces. This matters because `odw-lint` is a static checker for untrusted
workflow source. It must not accidentally depend on ODW paths that evaluate
metadata, compile workflow bodies, start runs, spawn workers, or dispatch
agents.

After this plan is implemented, maintainers can run the normal repository gate
and see a failing test if any file under `src/**/*.ts` imports bare `odw`,
ODW package-entry bypasses such as `odw/src/index` or `odw/dist/index`, ODW
loader paths, ODW primitive paths, ODW runtime launcher paths, ODW worker
paths, or sibling checkout path-style equivalents ending in those same
segments, whether the edge is expressed through ES module syntax, dynamic
`import(...)`, import-equals `require(...)`, ordinary CommonJS `require(...)`,
type-only import/export declarations, or TypeScript import-type syntax such as
`type T = import("odw/src/loader").WorkflowMeta`. The same guard must also fail
production code on every computed dynamic import or computed CommonJS require,
such as `const specifier = "odw/src/runtime/worker"; await import(specifier)`
or `require(specifier)`, because task 2.1.4 does not execute or resolve
runtime specifier values. The task does not implement the ODW envelope scanner,
source masker, loader parity tests, hostile metadata fixture, rule engine,
command-line interface, or production lint behaviour. It only adds the
architectural regression test that keeps future implementation work inside the
documented static-analysis boundary.

## Constraints

- Work only in
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-4`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as the canonical integration branch.
- Use this GrepAI shape first for intent search against the canonical
  main-branch index:

  ```sh
  grepai search --workspace Projects --project odw-lint "<English intent query>" --toon --compact
  ```

  The GrepAI index reflects `main` only. Verify every branch-local fact with
  `leta`, exact text search, or file inspection inside this worktree before
  acting.
- Use `leta` for branch-local symbol navigation, references, call graphs, and
  refactoring commands. Use exact text search only for literal strings,
  Markdown, JSON, raw fixture text, and other non-symbol content.
- Use `sem` instead of raw Git history commands if implementation needs
  codebase history, entity-level diffs, or blame.
- This task is test-only except for living documentation updates. Do not change
  production `src/**` files to make the new architecture test pass. If an
  existing production offender is found, stop, record the offender in
  `Decision Log`, and escalate.
- Do not add package dependencies. The locked repository already provides the
  TypeScript compiler API, Bun test runner, Biome, Oxlint, Fast-check, and
  df12-lints.
- Use the locked TypeScript compiler API for structural parsing. Do not add
  `madge`, `dependency-cruiser`, ESLint, an Oxlint plugin, or another import
  graph package for this task.
- Scan production source files only under `src/**/*.ts`. Tests may use virtual
  source strings to prove the helper logic, but the production guard must read
  the real `src` tree.
- Treat any import-like edge from production code to the forbidden ODW
  specifier set as a failure, including static imports, re-exports,
  `import x = require("...")`, string-literal dynamic `import("...")` calls,
  ordinary string-literal CommonJS `require("...")` calls, type-only
  import/export declarations, and `ImportTypeNode` import-type queries whose
  argument is a string-literal type, such as
  `type T = import("odw/src/loader").WorkflowMeta`. Treat every non-string
  dynamic import and every non-string ordinary CommonJS `require(...)` in
  production `src/**` as a failure too. Do not normalize the blind spot by
  ignoring `import(specifier)` or `require(specifier)`; task 2.1.4 deliberately
  chooses conservative rejection over constant resolution. If a future
  implementation needs a type-only ODW package import, a computed dynamic
  import, or a computed CommonJS require, stop and escalate rather than
  weakening this guard inside task 2.1.4.
- Cover the roadmap-required path families: bare executable ODW imports,
  package-entry bypasses such as `odw/src/index`, `odw/dist/index`, explicit
  `.ts` or `.js` forms, loader paths, primitive paths, runtime launcher paths,
  worker paths, and sibling path-style equivalents ending in
  `/open-dynamic-workflows/src/...` or `/open-dynamic-workflows/dist/...`.
- Create `tests/diagnostics/import-architecture.ts` as an explicit first work
  item before adding new guard behaviour. The existing
  `tests/diagnostics/architecture.test.ts` is already 364 lines, so helper
  extraction is mandatory rather than optional. All TypeScript work items that
  touch architecture imports must format both
  `tests/diagnostics/architecture.test.ts` and
  `tests/diagnostics/import-architecture.ts`; both paths are guaranteed to
  exist after work item 1.
- Keep function complexity within the configured Oxlint limits. Prefer small,
  named predicates and table-driven cases over nested conditionals.
- Use en-GB Oxford spelling in documentation, comments, and commit messages,
  while preserving code identifiers and external API spellings.
- Format only changed files. For Markdown, run `mdtablefix` and
  `markdownlint-cli2 --fix` on the specific changed Markdown paths. For
  TypeScript, run Biome formatting only over changed existing TypeScript paths.
  Do not run repo-global mutating formatters such as `make fmt`, `bun fmt`, or
  `mdformat-all`.
- Every work item must update this ExecPlan before its commit. At minimum,
  check off that item's `Progress` entry when the item is complete. Also update
  `Surprises & Discoveries`, `Decision Log`, `Risks`,
  `Outcomes & Retrospective`, and the revision note when an item changes
  assumptions or records new evidence.
- Because every work item updates this ExecPlan, every work item has a
  Markdown change. Run file-scoped Markdown formatting on
  `docs/execplans/roadmap-2-1-4.md`, then run `make markdownlint` and
  `make nixie` before committing that item.
- Each work item below is independently committable. Gate and commit each item
  before starting the next one.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances

- Scope: stop and escalate if implementation needs production file changes
  under `src/**`, package export changes, or dependency changes.
- File count: stop and escalate if implementation needs more than
  `tests/diagnostics/architecture.test.ts`,
  `tests/diagnostics/import-architecture.ts`, this ExecPlan, and the final
  roadmap update.
- Public API: stop and escalate if any public import from `odw-lint` must be
  renamed, removed, or moved to a package subpath.
- Dependency: stop and escalate before adding any package dependency,
  including import graph tools, parser helpers, glob helpers, or snapshot
  helpers.
- Runtime boundary: stop immediately if production code would need an ODW
  loader, primitive, launcher, worker, runtime, scheduler, agent, or
  metadata-evaluating import.
- Predicate ambiguity: stop and escalate if a candidate ODW specifier could be
  both a safe static-only dependency and an executable dependency. Current
  sibling ODW evidence does not expose a safe static API from the package
  entry, so task 2.1.4 should keep the predicate strict.
- Syntax coverage: stop and escalate if TypeScript 5.9.3 cannot expose one of
  the planned import-like forms structurally, including `ImportTypeNode`
  import-type queries, ordinary `require(...)` calls, computed dynamic import
  calls, and computed CommonJS require calls. Do not fall back to ad hoc source
  string parsing for TypeScript code.
- Tests: if `make all` still fails after three focused fix attempts in one work
  item, record the failure and options in `Decision Log` before continuing.
- Formatting: if a formatter rewrites unrelated files, park that churn in a
  named discard stash using
  `df12-stash v1 task=2.1.4 kind=discard reason="<short>"`, restore the
  intended file set, and re-run only file-scoped formatting.

## Risks

- Risk: the architecture test misses dynamic `import("odw/...")`, computed
  `import(specifier)`, import-equals `require("odw/...")`, ordinary
  `require("odw/...")`, import-type queries such as
  `type T = import("odw/src/loader").WorkflowMeta`, or computed
  `require(specifier)` forms and gives a false sense of coverage. Severity:
  high. Likelihood: medium. Mitigation: work item 2 extracts import-like edges
  using TypeScript AST node guards for `ImportDeclaration`,
  `ExportDeclaration`, `ImportEqualsDeclaration` with
  `ExternalModuleReference`, `ImportTypeNode` with a `LiteralTypeNode`
  argument whose literal is a `StringLiteral`, dynamic `ImportKeyword` call
  expressions, and ordinary `CallExpression` nodes whose expression is the
  identifier `require`. String-literal dynamic imports, string-literal
  import-type queries, and string-literal CommonJS requires are classified by
  specifier, while every computed dynamic import and computed CommonJS require
  is reported as a production-source failure.

- Risk: the forbidden predicate is either too narrow to catch package-entry
  bypasses or too broad and catches unrelated lookalike packages. Severity:
  high. Likelihood: medium. Mitigation: work item 3 adds table-driven tests for
  every roadmap-required ODW path family and negative cases such as
  `odw-lint`, `@scope/odw-tools`, and strings that merely contain `odw` as a
  path segment outside the sibling checkout pattern.

- Risk: a real production offender exists on this branch. Severity: high.
  Likelihood: low. Mitigation: current exact text search found no ODW imports
  in `src/**`. Work item 4 must still run the real scanner. If it finds an
  offender, computed dynamic import, or computed CommonJS require, stop and
  surface the file, line, and import fact instead of editing production code.

- Risk: the architecture test becomes brittle by asserting incidental source
  ordering or line numbers. Severity: medium. Likelihood: medium. Mitigation:
  collect normalized facts and compare sorted arrays of file/specifier
  descriptions. Do not snapshot whole source files.

- Risk: the architecture-test file exceeds the 400-line project limit if new
  helper and table-driven tests are added inline. Severity: high. Likelihood:
  high. Mitigation: work item 1 explicitly extracts a focused test-only helper
  before adding behaviour, and every TypeScript work item formats the helper
  path because it is guaranteed to exist. Work items 1 through 4 also run
  explicit `wc -l` checks that fail if either architecture-test file exceeds
  400 lines, because roadmap task 1.5.1 has not yet automated that guard.

- Risk: the work drifts into hostile metadata or loader parity implementation.
  Severity: medium. Likelihood: low. Mitigation: keep this plan limited to a
  production import guard. Roadmap tasks 2.1.5 and 2.3 own those behaviours.

## Progress

- [x] (2026-06-28T23:23Z) Confirmed this work is in branch
  `roadmap-2-1-4` at
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-4`.
- [x] (2026-06-28T23:23Z) Read `AGENTS.md`, the ExecPlan skill, the Leta
  skill, the GrepAI skill, the Firecrawl skill, the Biome TypeScript skill,
  the en-GB Oxford spelling skill, the Sem skill, and the commit-message
  skill.
- [x] (2026-06-28T23:23Z) Used GrepAI intent search against the canonical
  `odw-lint` main-branch index for architecture tests and forbidden imports.
  Branch-local facts were then verified directly in this worktree.
- [x] (2026-06-28T23:23Z) Added this worktree to Leta and used `leta files`,
  `leta grep`, and `leta show` to inspect current source and architecture-test
  helpers.
- [x] (2026-06-28T23:23Z) Read the governing terms of reference, technical
  design, ADR 0001, developer guide, scripting standards, complexity guide,
  documentation style guide, roadmap, Makefile, package metadata, and
  neighbouring ExecPlans.
- [x] (2026-06-28T23:23Z) Installed locked dependencies through `make build`
  and verified TypeScript 5.9.3 declarations in `node_modules`.
- [x] (2026-06-28T23:23Z) Used Firecrawl to verify the official TypeScript
  compiler API documentation for `createSourceFile` and `forEachChild` AST-only
  linting.
- [x] (2026-06-28T23:23Z) Inspected sibling ODW sources under
  `/data/leynos/Projects/open-dynamic-workflows` to identify the real loader,
  primitive, package-entry, launcher, and worker surfaces.
- [x] (2026-06-28T23:23Z) Drafted this initial ExecPlan.
- [x] (2026-06-28T23:38Z) Revised this ExecPlan for planning round 2 after
  design review, making helper extraction explicit, computed dynamic imports
  production failures, launcher/worker classifier coverage concrete, and
  formatter commands path-safe.
- [x] (2026-06-29T00:55Z) Revised this ExecPlan for planning round 3 after
  design review, adding ordinary CommonJS `require("...")` extraction,
  computed `require(...)` production failures, and explicit per-item line-count
  validation for the architecture test files.
- [x] (2026-06-29T01:33Z) Revised this ExecPlan for planning round 4 after
  design review, adding TypeScript `ImportTypeNode` extraction, classifier
  plumbing, table-driven positive and negative tests, and final acceptance
  criteria for import-type queries such as
  `type T = import("odw/src/loader").WorkflowMeta`.
- [x] (2026-06-29T00:23Z) Work item 1: Extract import architecture
  helpers.
- [x] (2026-06-29T00:34Z) Work item 2: Add import-like edge, import-type, and
  computed call extraction.
- [x] (2026-06-29T00:41Z) Work item 3: Add the forbidden ODW specifier
  classifier.
- [x] (2026-06-29T00:49Z) Work item 4: Wire the guard over production source
  files.
- [x] (2026-06-29T00:54Z) Work item 5: Close roadmap 2.1.4 documentation.

## Surprises & discoveries

- Observation: the worktree initially had no `node_modules`, so locked library
  source had to be installed through `make build` before TypeScript declarations
  could be inspected.
  Evidence: `make build` installed `typescript@5.9.3` from `bun.lock`.
  Impact: implementation should not rely on globally installed TypeScript.

- Observation: existing architecture tests already use the TypeScript compiler
  API to parse project source and inspect module specifiers.
  Evidence: `tests/diagnostics/architecture.test.ts` defines `parseSource`,
  `moduleSpecifierText`, and `exportDeclarationFacts`.
  Impact: the new guard should extend this local idiom instead of introducing a
  new import graph tool.

- Observation: the sibling ODW package name is `odw`, and its package entry
  exports runtime start/wait/execute functions through `src/index.ts`.
  Evidence: `/data/leynos/Projects/open-dynamic-workflows/package.json` names
  the package `odw`, and `src/index.ts` exports `RunStore`, `startRun`,
  `waitFor`, and `executeRun`.
  Impact: value imports from bare `odw` or its `src/index` and `dist/index`
  bypasses are executable-boundary imports, not safe static helper imports.

- Observation: `tests/diagnostics/architecture.test.ts` is already 364 lines.
  Evidence: `leta files tests/diagnostics` reported the file at 364 lines.
  Impact: adding the new scanner, classifier, and table-driven tests inline
  would predictably collide with the 400-line project limit. The plan now makes
  `tests/diagnostics/import-architecture.ts` an explicit helper extraction in
  work item 1.

- Observation: ordinary CommonJS `require(...)` is reachable in production
  TypeScript today.
  Evidence: `node_modules/bun-types/globals.d.ts` declares a global
  `require: NodeJS.Require`; the official Bun module-resolution docs state
  `require()` can be used in ES modules and TypeScript files; exact config
  inspection found no Biome, Oxlint, or TypeScript setting that rejects
  `require` in `src/**`.
  Impact: the architecture guard must extract ordinary string-literal
  `require("...")` calls and treat computed `require(...)` calls in production
  as violations rather than relying on another gate.

- Observation: TypeScript import-type queries are a separate AST shape from
  import declarations and dynamic import calls.
  Evidence: locked `typescript@5.9.3` declarations in
  `node_modules/typescript/lib/typescript.d.ts` expose `ts.isImportTypeNode`,
  `ImportTypeNode.argument: TypeNode`, `ts.isLiteralTypeNode`, and
  `LiteralTypeNode.literal`, which can be narrowed to `ts.isStringLiteral` for
  `type T = import("odw/src/loader").WorkflowMeta`.
  Impact: work item 2 must extract import-type string specifiers explicitly;
  relying on `ImportDeclaration`, `ExportDeclaration`, dynamic `import(...)`,
  or `require(...)` extraction would leave a type-only ODW dependency bypass.

- Observation: CodeRabbit could not complete for work items 1 through 5
  because the CLI entered browser-authentication flow in the scrutineer runs.
  Evidence: `coderabbit review --agent` emitted
  `{"phase":"auth","status":"awaiting_browser_auth"}` for each attempt. It
  did not report a rate limit or review findings.
  Impact: deterministic gates remain the evidence for those work items. A later
  authenticated run should complete CodeRabbit review before final integration.

- Observation: the workspace-scoped GrepAI registry was unavailable before work
  item 2 exploration.
  Evidence: `grepai workspace status Projects` reported "No workspaces
  configured" from this shell, so the required
  `grepai search --workspace 'Projects' --project 'odw-lint' ...` command
  could not run.
  Impact: work item 2 fell back to branch-local Leta symbol inspection and
  file inspection for the helper implementation.

## Decision Log

- Decision: use the locked TypeScript compiler API, not a new dependency, for
  the forbidden-import architecture test.
  Rationale: `typescript@5.9.3` is already locked in `bun.lock`, existing tests
  use it for source architecture checks, and the official TypeScript compiler
  API documentation demonstrates AST-only linting with `createSourceFile` and
  recursive `forEachChild`.
  Date/Author: 2026-06-28T23:23Z / Codex.

- Decision: treat task 2.1.4 as a strict no-ODW-import production guard for
  the forbidden specifier families, including type-only syntax.
  Rationale: current production code has no ODW imports. The technical design
  and ADR require `odw-lint` to own its static-analysis implementation and not
  depend on ODW executable or package-entry surfaces. If a future static-only
  ODW type dependency is needed, that is a boundary decision requiring
  escalation rather than a local predicate exception.
  Date/Author: 2026-06-28T23:23Z / Codex.

- Decision: make the guard report sorted facts rather than snapshots.
  Rationale: sorted arrays of `{ filePath, moduleSpecifier }` are stable,
  reviewer-useful, and resistant to unrelated line-order churn. Full snapshots
  would add review noise without improving behavioural coverage.
  Date/Author: 2026-06-28T23:23Z / Codex.

- Decision: fail production code on all computed dynamic imports instead of
  attempting static constant resolution in task 2.1.4. Apply the same policy to
  ordinary computed CommonJS requires.
  Rationale: TypeScript 5.9.3 exposes dynamic import calls structurally through
  `CallExpression`, `ImportKeyword`, and `arguments`, but reliable constant
  resolution would require a broader data-flow rule. TypeScript 5.9.3 and
  `bun-types@1.3.14` also expose ordinary `require(...)` calls as parseable
  `CallExpression` nodes, and Bun supports `require()` in TypeScript and ES
  module files. Conservative rejection closes the reviewed false negative where
  `const specifier = "odw/src/runtime/worker"; await import(specifier)` would
  otherwise pass the guard, and it closes the parallel `require(specifier)`
  bypass.
  Date/Author: 2026-06-28T23:38Z / Codex.

- Decision: fail the work item validation if either architecture test file
  exceeds 400 lines.
  Rationale: `tests/diagnostics/architecture.test.ts` is already 364 lines, and
  the repository's automated file-size guard is still a future roadmap task
  under 1.5.1. The plan therefore makes the current project convention
  executable with `wc -l` plus `test ... -le 400` in every TypeScript work
  item for this task.
  Date/Author: 2026-06-29T00:55Z / Codex.

- Decision: extract `tests/diagnostics/import-architecture.ts` before adding
  the import guard.
  Rationale: the existing architecture test is already close to the project
  file-size limit, and making the helper path unconditional keeps the
  formatter commands path-safe for every subsequent TypeScript work item.
  Date/Author: 2026-06-28T23:38Z / Codex.

- Decision: treat `ImportTypeNode` string-literal arguments as import-like
  edges and route them through the same forbidden ODW classifier.
  Rationale: TypeScript import-type queries are type-only and erased at
  runtime, but the static-analysis boundary forbids production dependencies on
  ODW executable and package-entry surfaces even when the syntax is type-only.
  The locked TypeScript 5.9.3 API exposes this form structurally through
  `ts.isImportTypeNode`, `ImportTypeNode.argument`, `ts.isLiteralTypeNode`, and
  `ts.isStringLiteral`, so the guard can implement the strict contract without
  source-text parsing or a type checker.
  Date/Author: 2026-06-29T01:33Z / Codex.

## Outcomes & Retrospective

- Work item 1 extracted the existing TypeScript source-shape helpers from
  `tests/diagnostics/architecture.test.ts` into
  `tests/diagnostics/import-architecture.ts` without adding new guard
  behaviour. This keeps the existing architecture assertions intact while
  making room for the forbidden-import scanner. Scrutineer-run
  `make all`, `make markdownlint`, and `make nixie` all passed after the
  extraction and public-JSDoc/type-import fixes.

- Work item 2 added AST-only extraction for static imports, re-exports,
  type-only import/export declarations, import-equals external references,
  `ImportTypeNode` import-type queries, string-literal dynamic imports,
  string-literal CommonJS requires, computed dynamic imports, and computed
  CommonJS requires. The architecture tests now prove the planned string-edge
  and computed-call extraction behaviour with virtual TypeScript sources.
  Scrutineer-run `make all`, `make markdownlint`, and `make nixie` all passed
  after the private-JSDoc fix.

- Work item 3 added `isForbiddenOdwImport` with static string classification
  for bare `odw`, private package paths, runtime subpaths, explicit `.ts` and
  `.js` forms, and sibling checkout paths. Table-driven tests cover forbidden
  ODW package and sibling specifiers plus lookalike imports that must remain
  allowed. Scrutineer-run `make all`, `make markdownlint`, and `make nixie`
  all passed.

- Work item 4 added the production architecture test that scans every sorted
  `src/**/*.ts` file, filters import-like edges through `isForbiddenOdwImport`,
  and reports computed dynamic imports and computed CommonJS requires as
  violations. The in-memory violation test proves forbidden string imports,
  import-type queries, computed dynamic imports, and computed CommonJS requires
  all produce reviewer-readable violation facts. Scrutineer-run
  `make all`, `make markdownlint`, and `make nixie` all passed after the
  Oxlint conditional fix.

- Work item 5 marked roadmap task 2.1.4 complete in `docs/roadmap.md` after
  the forbidden-import architecture guard was implemented and gated.
  Scrutineer-run `make all`, `make markdownlint`, and `make nixie` all passed
  for the documentation closure.

## Context and orientation

The repository is a TypeScript and Bun project. Production code lives under
`src/`, tests under `tests/`, and the full commit gate is `make all`.
Markdown changes also require `make markdownlint` and `make nixie`.

The current source tree contains these production TypeScript files:

```plaintext
src/diagnostics/report.ts
src/diagnostics/rule-id.ts
src/diagnostics/schema.ts
src/diagnostics/severity.ts
src/diagnostics/text.ts
src/diagnostics/types.ts
src/index.ts
src/static-analysis/index.ts
src/static-analysis/source-file.ts
src/static-analysis/source-indexes.ts
src/static-analysis/source-position.ts
src/static-analysis/source-scan.ts
src/static-analysis/source-snippet.ts
src/static-analysis/types.ts
```

Current exact text searches found no import-like edges from `src/**` to `odw`
or `open-dynamic-workflows`, and no ordinary `require(` calls in `src/**`. The
implementation must still verify that with the new AST-based guard and stop if
the guard finds a real offender.

The current implementation surface is
`tests/diagnostics/architecture.test.ts`, which already contains local helpers
that parse TypeScript source with:

```typescript
ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
```

It also already extracts string-literal module specifiers from export
declarations. Because this file is already 364 lines, first extract the import
architecture helpers to `tests/diagnostics/import-architecture.ts`, then keep
new scanner and classifier logic there so the test file remains below the
400-line project limit.

## Research evidence

The following findings are load-bearing and must not be replaced by guesses
during implementation.

Local locked dependency evidence:

- `bun.lock` pins `typescript@5.9.3`.
- `node_modules/typescript/lib/typescript.d.ts` declares
  `ImportDeclaration`, `ExportDeclaration`, `ImportEqualsDeclaration`,
  `ExternalModuleReference`, `ImportTypeNode`, `LiteralTypeNode`,
  `CallExpression`, `Identifier`, `isImportDeclaration`,
  `isExportDeclaration`, `isImportEqualsDeclaration`,
  `isExternalModuleReference`, `isImportTypeNode`, `isLiteralTypeNode`,
  `isCallExpression`, `isIdentifier`, `isStringLiteral`, `forEachChild`, and
  `createSourceFile`.
- The same locked declaration file shows `ImportTypeNode.argument` is a
  `TypeNode`, `LiteralTypeNode.literal` can hold a `StringLiteral`, and
  `ts.isImportTypeNode`, `ts.isLiteralTypeNode`, and `ts.isStringLiteral` are
  available. That is enough to extract
  `type T = import("odw/src/loader").WorkflowMeta` as a string specifier edge
  without source-text parsing or a type checker.
- The same locked declaration file shows `CallExpression` has an `expression`
  and `arguments`, and `MetaProperty.keywordToken` can be
  `SyntaxKind.ImportKeyword`. That is enough to detect both
  `import("literal")` and `import(computed)` without executing code.
- The same locked declaration file shows `Identifier` has `text`, and
  `ts.isIdentifier` narrows nodes to identifiers. That is enough to detect
  ordinary `require(...)` calls as `CallExpression` nodes whose expression is
  the identifier text `require`.
- `bun.lock` pins `bun-types@1.3.14`, and
  `node_modules/bun-types/globals.d.ts` declares a global
  `require: NodeJS.Require`. Exact inspection of `biome.jsonc`,
  `.oxlintrc.json`, `tsconfig.json`, and `package.json` found no configured
  rule that rejects `require` before the architecture test runs.
- `node_modules/typescript/lib/typescript.d.ts` documents that
  `forEachChild` visits children in source order, which is sufficient for a
  simple AST walk that collects import-like edges without a type checker.

Official documentation evidence:

- Firecrawl scraped the official TypeScript wiki page
  <https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API>.
  The "Traversing the AST with a little linter" section demonstrates parsing a
  file with `ts.createSourceFile`, recursively walking nodes with
  `ts.forEachChild`, and not creating a type checker when a structural AST walk
  is enough.
- Firecrawl scraped the official TypeScript 3.8 release notes at
  <https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html>.
  The "Type-Only Imports and Export" section states that type-only imports are
  erased from runtime output. The architecture test still scans this syntax
  because the static boundary forbids production ODW dependencies even when
  they are type-only.
- Firecrawl scraped the official TypeScript 5.3 release notes at
  <https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-3.html>.
  The "Stable Support `resolution-mode` in Import Types" section demonstrates
  `import("pkg", ...).Type` import-type syntax, confirming that import-type
  expressions are part of the TypeScript type surface. The exact locked AST
  extraction remains pinned to `typescript@5.9.3` declarations above.
- Firecrawl scraped the official Bun module-resolution documentation at
  <https://bun.sh/docs/runtime/module-resolution>. It states that Bun supports
  CommonJS `require()` in TypeScript and ES module files, that `require()` can
  load files and packages, and that using CommonJS is discouraged but still
  supported. The architecture guard therefore cannot rely on Bun or the
  existing project gates to make ordinary `require(...)` unreachable.

Sibling ODW source evidence:

- `/data/leynos/Projects/open-dynamic-workflows/package.json` names the package
  `odw` and exports the package entry from `dist/index.js`.
- `/data/leynos/Projects/open-dynamic-workflows/src/index.ts` exports runtime
  start/wait/execute surfaces, including `startRun`, `waitFor`, and
  `executeRun`.
- `/data/leynos/Projects/open-dynamic-workflows/src/loader.ts` defines
  `loadWorkflowScript`, which uses `AsyncFunction` to compile workflow bodies.
- `/data/leynos/Projects/open-dynamic-workflows/src/primitives.ts` defines
  `createPrimitives` and its injected `validate(source)` primitive. The
  primitive calls `loadWorkflowScript(source, "candidate.js")`.
- `/data/leynos/Projects/open-dynamic-workflows/src/runtime/launcher.ts` calls
  `loadWorkflowScript` while starting runs and spawning workers.
- `/data/leynos/Projects/open-dynamic-workflows/src/runtime/worker.ts` imports
  `loadWorkflowScript` and `createPrimitives`, then executes loaded workflows.

These facts justify a production guard against bare `odw`, ODW package-entry
bypasses, loader paths, primitive paths, runtime launcher paths, runtime worker
paths, ordinary CommonJS require bypasses, computed dynamic imports, and
computed CommonJS requires under production source.

## Interfaces and dependencies

Do not add new dependencies. Implement the test using:

- `readFileSync` from `node:fs`.
- `readdirSync` or equivalent from `node:fs` for recursive `src` discovery.
- `join` or equivalent from `node:path` for path construction.
- `typescript` as `ts`.
- Bun's existing `describe`, `expect`, and `it` test APIs.

Work item 1 must create a focused test-only helper module at
`tests/diagnostics/import-architecture.ts`. The helper module should start with
a `/** @file ... */` block and export only the small types and functions needed
by `tests/diagnostics/architecture.test.ts`.

```typescript
interface ImportLikeEdge {
  readonly filePath: string;
  readonly moduleSpecifier: string;
}

interface ComputedDynamicImport {
  readonly filePath: string;
  readonly expressionText: string;
}

interface ComputedCommonJsRequire {
  readonly filePath: string;
  readonly expressionText: string;
}
```

The helper responsibilities should be:

- `productionTypeScriptFiles(root: string): readonly string[]` returns sorted
  `src/**/*.ts` files, excluding `dist`, `node_modules`, and tests.
- `importLikeEdgesFromSource(filePath: string, sourceText: string)` parses a
  file and returns sorted import-like edges from static imports, re-exports,
  import-equals external references, string-literal dynamic imports, TypeScript
  import-type queries whose argument is a string-literal type, and ordinary
  string-literal CommonJS requires.
- `computedDynamicImportsFromSource(filePath: string, sourceText: string)` or
  an equivalent result field reports every dynamic import whose first argument
  is not a string literal. Production scanning fails on these facts even when
  the expression might resolve to a non-ODW package.
- `computedCommonJsRequiresFromSource(filePath: string, sourceText: string)` or
  an equivalent result field reports every ordinary `require(...)` call whose
  first argument is not a string literal. Production scanning fails on these
  facts even when the expression might resolve to a non-ODW package.
- `isForbiddenOdwImport(moduleSpecifier: string): boolean` normalizes slashes,
  strips explicit `.ts` and `.js` forms, and matches the forbidden package and
  sibling path families named in this plan.
- `productionImportArchitectureViolations()` or an equivalently named helper
  scans the real production files and returns sorted offenders for forbidden
  string specifiers, computed dynamic imports, and computed CommonJS requires.

Keep each helper small. If a helper needs multiple condition groups, split the
predicate into named predicates such as `isPackageEntrySpecifier`,
`isPrivateExecutableOdwSpecifier`, `isSiblingOdwExecutablePath`,
`isComputedDynamicImportCall`, and `isCommonJsRequireCall`.

## Plan of work

### Work item 1: Extract import architecture helpers

Create `tests/diagnostics/import-architecture.ts` and move only the reusable
architecture-test source helpers needed by this task out of
`tests/diagnostics/architecture.test.ts`. Start the helper with a module-level
`/** @file ... */` block. Keep exports narrow and test-only: the initial helper
may expose `parseSource`, `moduleSpecifierText`, and small type aliases already
needed by the existing architecture tests, but it must not add the forbidden
ODW predicate or production scan yet.

This is a refactoring work item. Existing architecture tests must still pass,
and observable behaviour must not change. The extraction is mandatory because
`tests/diagnostics/architecture.test.ts` is already 364 lines and the project
limit is 400 lines per code file.

Documentation implemented:

- `AGENTS.md` "Code Style and Structure", "TypeScript Guidance", and
  "Refactoring Heuristics & Workflow".
- `docs/developers-guide.md` "Tests", "Linting", and "Commit Gate".
- `docs/complexity-antipatterns-and-refactoring-strategies.md` section 5.C,
  "Clean refactoring approaches to reduce cognitive complexity".
- `docs/scripting-standards.md` "Operational guidelines", for path-safe
  command execution and temporary log hygiene.
- `docs/documentation-style-guide.md` "Markdown rules" and "Formatting", for
  the living-plan update.

Skills to load:

- `execplans` to keep this plan current.
- `grepai` for any new intent search against canonical `main`.
- `leta` for branch-local symbol navigation and refactoring verification.
- `biome-typescript` for TypeScript formatting and lint details.
- `en-gb-oxendict-style` for comments and plan updates.
- `sem` before commit if an entity-level review clarifies the refactor.
- `commit-message` before committing.
- No Python, Rust, Hypothesis, CrossHair, mutmut, Kani, or other verification
  skill applies.

Tests to add or update:

- Do not add new assertions in this item.
- Update imports in `tests/diagnostics/architecture.test.ts` as needed so the
  existing Bun architecture tests continue to cover the extracted helpers.
- No behavioural, property, snapshot, or end-to-end tests are required because
  this item is a no-behaviour-change test-helper extraction.

Path-safe validation commands:

```sh
bunx biome format --write tests/diagnostics/architecture.test.ts tests/diagnostics/import-architecture.ts
wc -l tests/diagnostics/architecture.test.ts tests/diagnostics/import-architecture.ts
test "$(wc -l < tests/diagnostics/architecture.test.ts)" -le 400
test "$(wc -l < tests/diagnostics/import-architecture.ts)" -le 400
mdtablefix docs/execplans/roadmap-2-1-4.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-4.md
bun test tests/diagnostics/architecture.test.ts 2>&1 | tee /tmp/test-odw-lint-roadmap-2-1-4.out
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-2-1-4.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-2-1-4.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-2-1-4.out
```

Commit this item after the gates pass.

The `test ... -le 400` commands are hard failure criteria. If either file has
401 lines or more, stop and split the helper or tests before committing.

### Work item 2: Add import-like edge, import-type, and computed call extraction

Extend `tests/diagnostics/import-architecture.ts` with AST-only extraction for
import-like edges, computed dynamic imports, and computed CommonJS requires.
Parse source text with
`ts.createSourceFile` and recursively walk nodes with `ts.forEachChild`, using
the locked TypeScript 5.9.3 node guards verified in
`node_modules/typescript/lib/typescript.d.ts`.

The extractor must collect string specifier edges from:

- `ImportDeclaration.moduleSpecifier` when it is a string literal.
- `ExportDeclaration.moduleSpecifier` when it is a string literal.
- `ImportEqualsDeclaration` whose `moduleReference` is an
  `ExternalModuleReference` with a string-literal expression.
- `ImportTypeNode` whose `argument` is a `LiteralTypeNode` and whose
  `argument.literal` is a `StringLiteral`, including
  `type T = import("odw/src/loader").WorkflowMeta`.
- `CallExpression` nodes whose expression is `SyntaxKind.ImportKeyword` and
  whose first argument is a string literal.
- `CallExpression` nodes whose expression is an identifier with text
  `require` and whose first argument is a string literal.

The extractor must also collect a separate computed dynamic import fact for
every `CallExpression` whose expression is `SyntaxKind.ImportKeyword` and whose
first argument is absent or not a string literal. It must not ignore
`await import(specifier)` and must not attempt constant resolution in this
work item.

The extractor must also collect a separate computed CommonJS require fact for
every ordinary `CallExpression` whose expression is the identifier `require`
and whose first argument is absent or not a string literal. It must not ignore
`require(specifier)`, `require()`, or `require(foo())`, and it must not attempt
constant resolution in this work item. The exact evidence for this policy is
that `bun-types@1.3.14` declares global `require`, Bun's official module
documentation supports `require()` in TypeScript and ES modules, and no current
project gate rejects `require` before the architecture test runs.

Documentation implemented:

- `docs/technical-design.md` section 5, "Static-analysis boundary".
- `docs/technical-design.md` section 11.3, "Forbidden import and security
  regression checks".
- `docs/adr/0001-static-analysis-boundary.md` "Decision", for the type-only
  dependency boundary.
- `docs/developers-guide.md` "Static-Analysis Boundary", "Tests", and
  "Linting".
- `docs/complexity-antipatterns-and-refactoring-strategies.md` section 5.C,
  "Clean refactoring approaches to reduce cognitive complexity".
- `docs/scripting-standards.md` "Operational guidelines", for path-safe
  command execution and temporary log hygiene.
- `AGENTS.md` "TypeScript Guidance" and "Testing".

Skills to load:

- `grepai` for any new intent search against canonical `main`.
- `leta` for branch-local symbol navigation.
- `biome-typescript` for TypeScript formatting and lint details.
- `en-gb-oxendict-style` for comments and plan updates.
- No Python, Rust, Hypothesis, CrossHair, mutmut, or Kani skill applies.

Tests to add or update:

- Add table-driven Bun tests in `tests/diagnostics/architecture.test.ts`
  proving string edge extraction for static imports, re-exports,
  type-only import/export declarations, import-equals `require(...)`,
  `ImportTypeNode` queries, string-literal dynamic imports, and ordinary
  string-literal CommonJS requires.
- Include positive `ImportTypeNode` cases such as
  `type T = import("odw/src/loader").WorkflowMeta` and
  `type T = typeof import("odw/src/index")`, and negative cases proving
  ordinary type references, local type aliases, and non-import type nodes do
  not create edges.
- Add table-driven Bun tests proving computed dynamic imports and computed
  CommonJS requires are reported as computed facts, including the exact
  blind-spot examples
  `const specifier = "odw/src/runtime/worker"; await import(specifier)` and
  `const specifier = "odw/src/runtime/worker"; require(specifier)`.
- Assert that computed dynamic imports and computed CommonJS requires are not
  returned as ordinary string specifier edges.
- No behavioural, property, snapshot, or end-to-end tests are required because
  this work item is a local deterministic helper.

Path-safe validation commands:

```sh
bunx biome format --write tests/diagnostics/architecture.test.ts tests/diagnostics/import-architecture.ts
wc -l tests/diagnostics/architecture.test.ts tests/diagnostics/import-architecture.ts
test "$(wc -l < tests/diagnostics/architecture.test.ts)" -le 400
test "$(wc -l < tests/diagnostics/import-architecture.ts)" -le 400
mdtablefix docs/execplans/roadmap-2-1-4.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-4.md
bun test tests/diagnostics/architecture.test.ts 2>&1 | tee /tmp/test-odw-lint-roadmap-2-1-4.out
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-2-1-4.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-2-1-4.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-2-1-4.out
```

Commit this item after the gates pass.

The `test ... -le 400` commands are hard failure criteria. If either file has
401 lines or more, stop and split the helper or tests before committing.

### Work item 3: Add the forbidden ODW specifier classifier

Add `isForbiddenOdwImport(moduleSpecifier: string): boolean` and focused
predicate helpers in `tests/diagnostics/import-architecture.ts`. The classifier
must normalize backslashes to slashes, strip trailing `.ts` and `.js` forms,
and then match the forbidden families. Do not add a dependency or resolve
modules through Node; this is a static specifier classifier.

The forbidden families are:

- Bare package entry: `odw`.
- Package-entry bypasses: `odw/src/index`, `odw/dist/index`, and their
  explicit `.ts` or `.js` forms.
- Loader paths: `odw/src/loader`, `odw/dist/loader`, and their explicit
  `.ts` or `.js` forms.
- Primitive paths: `odw/src/primitives`, `odw/dist/primitives`, and their
  explicit `.ts` or `.js` forms.
- Runtime directory paths: `odw/src/runtime`, `odw/dist/runtime`, any subpath
  below those runtime directories, and their explicit `.ts` or `.js` forms.
- Runtime launcher paths, explicitly including `odw/src/runtime/launcher`,
  `odw/dist/runtime/launcher`, `odw/src/runtime/launcher.ts`, and
  `odw/dist/runtime/launcher.js`.
- Runtime worker paths, explicitly including `odw/src/runtime/worker`,
  `odw/dist/runtime/worker`, `odw/src/runtime/worker.ts`, and
  `odw/dist/runtime/worker.js`.
- Sibling checkout equivalents whose normalized path ends with the same
  forbidden suffixes under `/open-dynamic-workflows/src/...` or
  `/open-dynamic-workflows/dist/...`, including explicit launcher and worker
  `.ts` and `.js` forms.

Do not include a catch-all substring match for `odw`; that would create false
positives. Negative cases must remain allowed for `odw-lint`, `@scope/odw`,
`@scope/odw-tools`, `./odw-local`, and unrelated paths containing a directory
named `open-dynamic-workflows` without a forbidden suffix.

Documentation implemented:

- `docs/roadmap.md` task 2.1.4 planning constraint and success condition.
- `docs/technical-design.md` section 5, "Static-analysis boundary".
- `docs/technical-design.md` section 11.3, "Forbidden import and security
  regression checks".
- `docs/adr/0001-static-analysis-boundary.md` "Decision" and "Consequences".
- `docs/terms-of-reference.md` sections 7, 8, and 9.
- `docs/scripting-standards.md` "Operational guidelines", for path-safe
  command execution and temporary log hygiene.

Skills to load:

- `leta` for branch-local symbol inspection.
- `biome-typescript` for TypeScript formatting and lint details.
- `en-gb-oxendict-style` for comments and plan updates.
- `sem` only if an entity-level review of preceding changes is needed.
- No Python, Rust, Hypothesis, CrossHair, mutmut, or Kani skill applies.

Tests to add or update:

- Add table-driven positive classifier tests for every forbidden family above.
- Include explicit positive tests for `odw/src/runtime/launcher`,
  `odw/src/runtime/worker`, their `dist` equivalents, their explicit `.ts` and
  `.js` forms, and sibling checkout suffix equivalents.
- Include at least one Windows-style backslash path.
- Add table-driven negative classifier tests for lookalikes that must not be
  blocked.
- No behavioural, property, snapshot, or end-to-end tests are required because
  this predicate is deterministic over a finite set of documented import
  families. Table-driven unit coverage is the right level of rigour.

Path-safe validation commands:

```sh
bunx biome format --write tests/diagnostics/architecture.test.ts tests/diagnostics/import-architecture.ts
wc -l tests/diagnostics/architecture.test.ts tests/diagnostics/import-architecture.ts
test "$(wc -l < tests/diagnostics/architecture.test.ts)" -le 400
test "$(wc -l < tests/diagnostics/import-architecture.ts)" -le 400
mdtablefix docs/execplans/roadmap-2-1-4.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-4.md
bun test tests/diagnostics/architecture.test.ts 2>&1 | tee /tmp/test-odw-lint-roadmap-2-1-4.out
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-2-1-4.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-2-1-4.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-2-1-4.out
```

Commit this item after the gates pass.

The `test ... -le 400` commands are hard failure criteria. If either file has
401 lines or more, stop and split the helper or tests before committing.

### Work item 4: Wire the guard over production source files

Add the real architecture test that scans every sorted `src/**/*.ts` file,
collects string import-like edges, computed dynamic import facts, and computed
CommonJS require facts with the helper, filters string edges through
`isForbiddenOdwImport`, and expects an empty violation list. The failure facts
must be sorted and reviewer-useful: for forbidden string specifiers include at
least `kind`, `filePath`, and `moduleSpecifier`; for computed dynamic imports
and computed CommonJS requires include at least `kind`, `filePath`, and
`expressionText`.

Do not edit production offenders if this test fails. A real forbidden import or
computed dynamic import or computed CommonJS require means the branch violates
the static-analysis boundary and needs a separate production fix or design
decision. Stop, record the offender in `Decision Log`, and escalate.

Documentation implemented:

- `docs/technical-design.md` section 5, "Static-analysis boundary".
- `docs/technical-design.md` section 11.3, "Forbidden import and security
  regression checks".
- `docs/adr/0001-static-analysis-boundary.md` "Consequences".
- `docs/developers-guide.md` "Static-Analysis Boundary", "Tests", and
  "Commit Gate".
- `docs/scripting-standards.md` "Operational guidelines", for path-safe
  command execution and temporary log hygiene.
- `AGENTS.md` "Change Quality & Committing".

Skills to load:

- `grepai` only for any new intent search.
- `leta` for branch-local verification.
- `biome-typescript` for TypeScript formatting and lint details.
- `sem` before commit if the entity-level diff would clarify review impact.
- No Python, Rust, Hypothesis, CrossHair, mutmut, or Kani skill applies.

Tests to add or update:

- Add a Bun architecture test named along these lines:
  `it("keeps production code free of executable ODW imports", ...)`.
- Add helper-level tests proving an in-memory production scan reports both a
  forbidden string specifier, a forbidden `ImportTypeNode` type-only specifier
  such as `type T = import("odw/src/loader").WorkflowMeta`, the computed
  dynamic import blind-spot example, and the computed CommonJS require
  blind-spot example as violations.
- Keep the earlier helper and classifier tests.
- No behavioural, property, snapshot, or end-to-end tests are required because
  this is an architecture regression test over repository structure, not a
  user-facing command.

Path-safe validation commands:

```sh
bunx biome format --write tests/diagnostics/architecture.test.ts tests/diagnostics/import-architecture.ts
wc -l tests/diagnostics/architecture.test.ts tests/diagnostics/import-architecture.ts
test "$(wc -l < tests/diagnostics/architecture.test.ts)" -le 400
test "$(wc -l < tests/diagnostics/import-architecture.ts)" -le 400
mdtablefix docs/execplans/roadmap-2-1-4.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-4.md
bun test tests/diagnostics/architecture.test.ts 2>&1 | tee /tmp/test-odw-lint-roadmap-2-1-4.out
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-2-1-4.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-2-1-4.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-2-1-4.out
```

Commit this item after the gates pass.

The `test ... -le 400` commands are hard failure criteria. If either file has
401 lines or more, stop and split the helper or tests before committing.

### Work item 5: Close roadmap 2.1.4 documentation

After the test-only implementation is committed and gated, update
`docs/roadmap.md` to mark roadmap task 2.1.4 complete. Update this ExecPlan's
`Progress`, `Decision Log`, and `Outcomes & Retrospective` with the final
validation evidence. Do not update ADR 0001 or the technical design unless the
implemented boundary differs from the currently documented boundary; if it
does differ, stop and escalate before changing the boundary documents.

Documentation implemented:

- `docs/roadmap.md` task 2.1.4.
- `docs/developers-guide.md` "Documentation Upkeep".
- `docs/documentation-style-guide.md` "Markdown rules", "Formatting", and
  "Roadmap task writing guidelines".
- `docs/scripting-standards.md` "Operational guidelines", for path-safe
  command execution and temporary log hygiene.
- `AGENTS.md` "Documentation Maintenance" and "Markdown Guidance".

Skills to load:

- `execplans` to keep the living plan current.
- `en-gb-oxendict-style` for prose.
- `commit-message` for the final commit message.
- No language router or verification skill applies because this work item is
  documentation-only.

Tests to add or update:

- No new unit, behavioural, property, snapshot, or end-to-end tests are
  required. This work item updates status documentation only after the
  architecture test has already been added and gated.

Path-safe validation commands:

```sh
mdtablefix docs/execplans/roadmap-2-1-4.md docs/roadmap.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-4.md docs/roadmap.md
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-2-1-4.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-2-1-4.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-2-1-4.out
```

Commit this item after the gates pass.

## Concrete steps

Run all commands from
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-4`. Do not run tests,
format checks, lint checks, or type checks in parallel.

Before any implementation work item:

```sh
pwd
git branch --show
git status --short
```

Expected output includes:

```plaintext
/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-4
roadmap-2-1-4
```

For every work item:

1. Read this ExecPlan and the work item's cited docs.
2. Use GrepAI for any new intent search against canonical `main`.
3. Use `leta` for branch-local symbol navigation and verification.
4. Make the smallest scoped edit for the current work item.
5. Update this ExecPlan's living sections.
6. Run the work item's file-scoped formatter commands.
7. Run the work item's `wc -l` line-count validation when TypeScript tests
   changed.
8. Run the focused test command when TypeScript tests changed.
9. Run `make all`, `make markdownlint`, and `make nixie` through `tee`.
10. Inspect any failing `/tmp/*-odw-lint-roadmap-2-1-4.out` log before
   attempting a fix.
11. Commit the item with a file-based commit message using `git commit -F`.

Use `sem diff` before commit when reviewing the semantic shape of TypeScript
changes would help. Use ordinary `git status --short` for worktree hygiene and
ordinary `git diff` only when exact line-level patch review is needed for
staging or final checks.

## Validation and acceptance

The final accepted state is:

- `tests/diagnostics/import-architecture.ts` exists as a focused test-only
  helper module, and `tests/diagnostics/architecture.test.ts` stays under the
  400-line code-file limit.
- Work items 1 through 4 visibly run `wc -l` and fail if either
  `tests/diagnostics/architecture.test.ts` or
  `tests/diagnostics/import-architecture.ts` exceeds 400 lines.
- The helper structurally scans TypeScript import-like edges with the locked
  TypeScript compiler API.
- Table-driven tests prove the scanner sees static imports, re-exports,
  type-only import/export declarations, import-equals external references,
  `ImportTypeNode` import-type queries, string-literal dynamic imports, and
  ordinary string-literal CommonJS requires.
- Table-driven tests prove computed dynamic imports and computed CommonJS
  requires are reported as production violations, including
  `const specifier = "odw/src/runtime/worker"; await import(specifier)` and
  `const specifier = "odw/src/runtime/worker"; require(specifier)`.
- Table-driven tests prove the forbidden ODW classifier catches all documented
  package-entry, private path, extension, runtime, launcher, worker, and
  sibling suffix families while avoiding lookalike false positives.
- A real architecture test scans every `src/**/*.ts` production file and fails
  if any forbidden ODW import-like edge, forbidden `ImportTypeNode` type-only
  edge, computed dynamic import, or computed CommonJS require exists.
- No production code is edited merely to satisfy this task.
- `docs/roadmap.md` marks task 2.1.4 complete only after the implementation
  work has passed gates.
- `make all`, `make markdownlint`, and `make nixie` pass.

Expected successful command shape:

```plaintext
$ make all
...
$
$ make markdownlint
...
$
$ make nixie
...
$
```

The exact number of Bun tests may change as tests are added, so success is an
exit code of zero and no failing test summary rather than a fixed count.

## Idempotence and recovery

The implementation steps are safe to rerun. The architecture test reads source
files and virtual test strings; it must not write files, execute ODW code, or
spawn agents.

If `make build` refreshes `node_modules`, keep that generated directory
unstaged. If a formatter rewrites unrelated files, park the unrelated churn in
a named discard stash:

```sh
git stash push -m 'df12-stash v1 task=2.1.4 kind=discard reason="formatter churn"' -- <paths>
```

Then restore the intended file set and rerun only file-scoped formatting. Do
not use a bare `git stash`.

If a real production offender, computed dynamic import, or computed CommonJS
require is discovered, do not fix it in this task. Record the offender and
stop. A production import boundary breach is a separate implementation or
design-review decision.

## Artifacts and notes

Initial research commands used for this plan:

```sh
grepai search --workspace 'Projects' --project 'odw-lint' \
  "architecture test forbidden imports production code" --toon --compact --limit 10
leta workspace add /data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-4
leta files src
leta files tests
make build 2>&1 | tee /tmp/build-odw-lint-roadmap-2-1-4.out
grep -n "interface CallExpression\|function forEachChild" node_modules/typescript/lib/typescript.d.ts
grep -n "declare var require" node_modules/bun-types/globals.d.ts
```

The GrepAI search returned existing docs and ExecPlans on canonical `main`; it
was used only for orientation. All branch-local facts in this plan were
verified directly in the worktree or in the explicitly requested sibling ODW
checkout.

## Revision note

Initial draft for roadmap task 2.1.4 recorded the verified TypeScript compiler
API mechanism, sibling ODW runtime surfaces, atomic work items, their required
tests, and path-safe validation commands. No implementation has started.

Round 2 revision: make helper extraction an explicit first work item, make
computed dynamic imports a production-source failure rather than an ignored
case, require concrete launcher and worker classifier tests, and remove every
optional helper path from formatter commands by making
`tests/diagnostics/import-architecture.ts` guaranteed after work item 1. The
remaining work is now five atomic, gateable items.

Round 3 revision: add ordinary CommonJS `require("...")` extraction and tests
for forbidden ODW specifiers, make computed `require(...)` a production-source
failure because Bun and `bun-types` make it reachable today, and add explicit
`wc -l` plus `test ... -le 400` validation to every TypeScript work item so the
current architecture-test files cannot silently cross the project file-size
limit before roadmap task 1.5.1 automates that guard.

Round 4 revision: add TypeScript `ImportTypeNode` import-type extraction to the
strict no-ODW production import guard. Work item 2 now requires
`ts.isImportTypeNode` plus `LiteralTypeNode` and `StringLiteral` narrowing,
positive and negative table-driven tests for
`type T = import("odw/src/loader").WorkflowMeta`, and classifier/production
guard plumbing so type-only ODW package imports cannot bypass the architecture
test.
