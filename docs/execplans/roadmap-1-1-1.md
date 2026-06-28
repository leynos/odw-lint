# Scaffold the owned static-analysis boundary

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 1.1.1 establishes a named production module boundary for
`odw-lint`'s owned static-analysis implementation. The task proves that the
repository has an explicit place for the future source reader, envelope
scanner, static metadata parser, body normalizer, SWC parser adapter, span
mapper, rule engine, and reporter without depending on Open Dynamic Workflows
(ODW) runtime helpers.

The observable result is deliberately small. After implementation, maintainers
can import stable source-level static-analysis boundary constants and types
from `src/index.ts`, inspect a passive module boundary that future source,
envelope, metadata, body, abstract syntax tree (AST), and diagnostic work can
occupy, and run the repository gates plus explicit boundary checks. The
runtime contract for this slice includes readonly label arrays for supported
components and stages, with TypeScript unions derived from those arrays. The
task does not add package-level `exports` or `types` fields while
`package.json` remains private and has no package export surface. It also does
not add `@swc/core`, does not implement `parseWithSwc`, does not parse
workflow bodies, and does not add the forbidden-import architecture test. The
parser adapter belongs to roadmap task 2.2.1, after static envelope extraction
in task 2.1.2. The forbidden-import architecture test belongs to roadmap task
2.1.4.

## Constraints

- Work only in `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-1-1`.
  Do not edit the root/control worktree.
- Do not start implementation until this plan is approved or the roadmap
  workflow explicitly schedules implementation.
- Keep this task limited to `docs/roadmap.md` section 1.1, task 1.1.1:
  scaffold a named owned boundary. Do not collapse roadmap task 2.1.4 or
  2.2.1 into this task.
- Do not add `@swc/core`, `@swc/types`, a SWC parser adapter, `parseWithSwc`,
  SWC AST result types, or SWC parse failure types in task 1.1.1. If the
  boundary scaffold appears to require any of those, stop and update the
  roadmap or design before implementation proceeds.
- Do not add `exports`, `types`, or other package-level public API fields to
  `package.json` in task 1.1.1. The package is currently private and has no
  package export surface; this task creates only a source-level internal
  boundary through `src/index.ts`.
- Do not add an exported parser error shape in task 1.1.1. If task 2.2.1 later
  exports a parse failure shape, the public contract must be sanitized: no
  public `cause` field containing opaque SWC exceptions. Internal diagnostics
  may retain an `unknown` cause behind a non-exported detail type.
- Production `src/**/*.ts` code must not import, call, vendor, or copy ODW
  executable loader, primitive, runtime launcher, worker, or resolver paths.
  This implements `docs/adr/0001-static-analysis-boundary.md` "Decision" and
  `docs/technical-design.md` sections 5 and 12.1.
- Do not implement the forbidden-import architecture test in this ExecPlan.
  `docs/roadmap.md` task 2.1.4 owns that test, requires 1.1.1, and sits inside
  the later envelope-parsing step. If implementation of 1.1.1 appears to need
  that test, stop and revise `docs/roadmap.md` before proceeding.
- Task 1.1.1 must not add `@swc/core`, `@swc/types`, or
  `open-dynamic-workflows` anywhere in `package.json` or `bun.lock`. Do not
  add a production, development, peer, optional, or trusted dependency for this
  slice. This is a task-1.1.1 boundary check, not a blanket ban on later
  trusted fixture-parity dependencies, because
  `docs/adr/0001-static-analysis-boundary.md` and
  `docs/technical-design.md` section 11.2 allow future narrowly scoped trusted
  parity tests to import ODW helpers where those helpers are static and do not
  evaluate source.
- After every implementation work item, run branch-local exact checks inside
  this worktree to prove the slice did not add dependency entries, production
  ODW references, package-level export fields, parser-adapter symbols,
  diagnostic contracts, command contracts, or workflow resolver symbols. These
  checks are part of task 1.1.1 acceptance because the architecture test is
  deferred to roadmap task 2.1.4.
- Use `grepai search --workspace Projects --project odw-lint "<English intent
  query>" --toon --compact` first for intent-oriented code search against the
  canonical main-branch index. Verify branch-local facts with `leta`, exact
  text search, or direct file inspection inside this worktree.
- Use `leta` for branch-local symbol navigation and references. Use `sem` for
  semantic diffs and history navigation instead of raw `git log` or blame.
- Prefer Makefile targets for gates. Do not run format, lint, or test gates in
  parallel.
- Format only changed files. For Markdown, run `mdtablefix <changed.md>` and
  `bunx markdownlint-cli2 --fix <changed.md>`. For TypeScript, JSON, or
  project configuration, run Biome on the specific changed paths.
- Use en-GB Oxford spelling in prose and comments, following
  `docs/documentation-style-guide.md` sections "Spelling" and "Markdown
  rules".
- Commit after each work item. Each commit must pass the relevant gate before
  it is committed, following `AGENTS.md` "Change Quality & Committing".

## Tolerances

- Scope: stop and update this plan before proceeding if implementation needs
  more than four work-item commits, more than eight non-plan files, or more
  than 350 net lines of production and test code.
- Dependency: stop immediately if implementation seems to require a new
  runtime dependency. Task 1.1.1 is dependency-free.
- Boundary: stop immediately if production code appears to need
  `loadWorkflowScript`, `createPrimitives`, ODW `validate(source)`, ODW
  runtime launch or worker modules, or ODW workflow name resolution.
- Interface: stop and revise this plan if a public analyser, parser adapter,
  parser failure type, diagnostic schema, CLI command, or ODW resolver contract
  must be introduced to complete the task.
- Testing: stop and record the failure in `Decision Log` if a work item still
  fails after two focused fix attempts.
- Documentation: stop if a change materially alters the ownership decision in
  `docs/technical-design.md` section 5 or ADR 0001. That requires an
  ADR/design update before code proceeds.

## Risks

- Risk: The scaffold becomes a misleading no-op analyser.
  Severity: medium.
  Likelihood: medium.
  Mitigation: export boundary names and passive types only. Do not export an
  `analyseWorkflow`, `parseWithSwc`, or `checkWorkflow` function in this task.

- Risk: The future architecture test drifts back into task 1.1.1.
  Severity: medium.
  Likelihood: medium.
  Mitigation: keep this ExecPlan limited to passive boundary exports and
  documentation. Leave the forbidden-import architecture test for roadmap task
  2.1.4 unless `docs/roadmap.md` is explicitly revised first.

- Risk: Future SWC parser work repeats the rejected filename contract.
  Severity: high.
  Likelihood: medium.
  Mitigation: record the verified SWC 1.15.43 API constraint in this plan and
  documentation: top-level `parseSync` does not accept `filename`; only
  `Compiler.parseSync(src, options, filename)` does.

- Risk: The boundary names over-abstract before implementation exists.
  Severity: low.
  Likelihood: medium.
  Mitigation: keep names aligned to `docs/technical-design.md` section 6.1
  components and avoid extra helper classes or speculative adapters.

## Progress

- [x] (2026-06-28T04:45:34Z) Read `AGENTS.md`, the roadmap, terms of
  reference, technical design, ADR 0001, developer guide, scripting standards,
  documentation style guide, complexity guide, and the existing ExecPlan.
- [x] (2026-06-28T04:45:34Z) Ran canonical `grepai` searches for the
  static-analysis boundary and verified branch-local state with `leta`.
- [x] (2026-06-28T04:45:34Z) Verified SWC official docs and
  `@swc/core@1.15.43` package source for the filename contract.
- [x] (2026-06-28T04:45:34Z) Verified sibling ODW loader, primitive, runtime,
  worker, resolver, and dual-compat source paths read-only.
- [x] (2026-06-28T04:45:34Z) Revised this plan for planning round 2 and
  removed the out-of-scope dependency and parser-adapter work.
- [x] (2026-06-28T05:03:08Z) Revised this plan for planning round 3 and
  removed the out-of-sequence architecture-test work from task 1.1.1.
- [x] (2026-06-28T05:23:00Z) Revised this plan for planning round 4 and
  resolved the runtime/type contract, branch-local boundary-check, and
  package-surface review blockers.
- [x] (2026-06-28T05:33:45Z) Work item 1: Replaced the template source
  surface with boundary constants and types, ran `make all`, completed
  branch-local boundary checks, ran CodeRabbit once, and kept the invalid
  boundary-module suggestion out of scope.
- [x] (2026-06-28T05:34:49Z) Work item 2: Documented the source-level
  scaffold and deferred phase-2 checks in `docs/developers-guide.md`, then
  prepared the ExecPlan progress update for the documentation commit.
- [x] (2026-06-28T05:37:09Z) Work item 3: Marked roadmap task 1.1.1
  complete after the code and developer-guide work items were implemented,
  gated, reviewed, and committed.

## Surprises & Discoveries

- Observation: The existing plan on this branch added work items for
  `@swc/core` and `parseWithSwc`, but `docs/roadmap.md` puts both in task
  2.2.1 after task 2.1.2.
  Evidence: `docs/roadmap.md` section 1.1 lists task 1.1.1 as the boundary
  scaffold, while section 2.2 lists task 2.2.1 as "Add `@swc/core` and
  implement the parser adapter".
  Impact: This plan now treats dependency and parser-adapter work as explicit
  non-goals for task 1.1.1.

- Observation: The branch-local package does not declare or install
  `@swc/core`.
  Evidence: `package.json` has only existing dev dependencies, and
  `node_modules/@swc/core` is absent.
  Impact: Task 1.1.1 can remain dependency-free.

- Observation: The current source is still the template `greet` export.
  Evidence: `leta show greet` shows `src/index.ts` exporting `greet`, and
  `leta refs greet` shows only `tests/index.test.ts` using it.
  Impact: Work item 1 can replace the template surface without preserving
  existing analyser behaviour.

- Observation: `package.json` is private and has no package-level `exports`,
  `types`, or `main` fields.
  Evidence: branch-local package inspection reported
  `{ "private": true, "hasExports": false, "hasTypes": false, "hasMain": false
  }`.
  Impact: Task 1.1.1 should create a source-level internal boundary through
  `src/index.ts`, not a published package surface. Package-level exports belong
  to a later packaging or release task.

- Observation: ODW `loadWorkflowScript` and primitive validation are executable
  boundaries, not safe static APIs.
  Evidence: sibling ODW `src/loader.ts` lines 78-90 compile workflow bodies
  with `AsyncFunction`; lines 321-330 evaluate metadata with `new Function`;
  `src/primitives.ts` lines 232-240 implement `validate(source)` by calling
  `loadWorkflowScript`.
  Impact: Production `odw-lint` code must own a separate static-analysis
  boundary and must not import those helper paths.

- Observation: The round-2 plan implemented the forbidden-import architecture
  test inside task 1.1.1 even though `docs/roadmap.md` assigns that exact
  success criterion to task 2.1.4.
  Evidence: `docs/roadmap.md` section 2.1 lists task 2.1.4, "Add a
  forbidden-import architecture test for production code", with `Requires
  1.1.1`.
  Impact: This plan now removes that work item and leaves the architecture
  test for 2.1.4 unless the roadmap is explicitly revised first.

- Observation: ODW's `checkMeta` helper is a static source-backed helper, while
  the loader, primitive validation, runtime launcher, and worker paths evaluate
  or compile source.
  Evidence: sibling ODW `src/dual-compat.ts` lines 34-50 define `checkMeta`
  with a local literal parser and no source execution; `src/loader.ts` lines
  321-330 evaluate metadata with `new Function`; `src/primitives.ts` lines
  232-240 calls `loadWorkflowScript`.
  Impact: This plan bans task-1.1.1 production ODW imports and production or
  runtime ODW dependencies, but it does not create a conflicting future ban on
  trusted fixture-parity dev dependencies or static helper imports.

- Observation: TypeScript type unions cannot be asserted at runtime because
  they are erased.
  Evidence: the intended labels were previously only
  `StaticAnalysisComponent` and `StaticAnalysisStage` union types, while tests
  were required to assert exported labels.
  Impact: Work item 1 now makes the runtime contract explicit by exporting
  `STATIC_ANALYSIS_COMPONENTS` and `STATIC_ANALYSIS_STAGES` readonly arrays and
  deriving the union types from those arrays.

- Observation: CodeRabbit reported that `src/static-analysis/index.ts` should
  re-export symbols from a `./boundary` module and expose a specifier
  classifier.
  Evidence: work item 1 created only the approved passive `./types` boundary;
  the ExecPlan forbids parser, diagnostic, CLI, resolver, and adapter
  contracts in task 1.1.1.
  Impact: No code change was applied for that finding. The requested boundary
  module and specifier classifier are outside the approved task 1.1.1 scope.

## Decision Log

- Decision: Reduce roadmap task 1.1.1 to a named boundary scaffold with no SWC
  dependency or parser adapter.
  Rationale: `docs/roadmap.md` sequences dependency and adapter implementation
  in task 2.2.1 after static envelope extraction in task 2.1.2. Keeping 1.1.1
  dependency-free preserves that order while still satisfying the boundary
  success criterion.
  Date/Author: 2026-06-28, planning agent.

- Decision: Define passive boundary vocabulary, not active analyser behaviour.
  Rationale: `docs/technical-design.md` section 6.1 names components, but
  tasks 1.2, 2.1, and 2.2 provide the diagnostic, envelope, and parser
  behaviours. A passive scaffold prevents a false public contract.
  Date/Author: 2026-06-28, planning agent.

- Decision: Export runtime readonly label arrays and derive TypeScript unions
  from them.
  Rationale: Tests can assert runtime exports only when the contract includes
  runtime values. Defining `STATIC_ANALYSIS_COMPONENTS` and
  `STATIC_ANALYSIS_STAGES` as `as const` arrays keeps the runtime and type
  contracts in one place without adding active analyser behaviour.
  Date/Author: 2026-06-28, planning round 4 agent.

- Decision: Keep task 1.1.1 to a source-level internal boundary and do not add
  package-level `exports` or `types`.
  Rationale: The branch-local `package.json` is private and currently has no
  package export surface. Adding package-level exports would turn this
  scaffold into a packaging decision before the CLI and release surface exist.
  This task satisfies the roadmap by replacing the template source barrel at
  `src/index.ts`; a later packaging task can add explicit package exports when
  the public API is ready.
  Date/Author: 2026-06-28, planning round 4 agent.

- Decision: Defer the forbidden-import architecture test to roadmap task
  2.1.4.
  Rationale: `docs/roadmap.md` deliberately places the architecture test in
  the later envelope-parsing step, with `Requires 1.1.1`. Implementing it here
  would make the roadmap state false by shipping a 2.1.4 result while marking
  only 1.1.1 complete.
  Date/Author: 2026-06-28, planning agent.

- Decision: Limit task-1.1.1 dependency restrictions to production/runtime
  dependency boundaries.
  Rationale: ADR 0001 forbids production dependence on executable ODW runtime
  helpers, while `docs/technical-design.md` section 11.2 explicitly permits
  future trusted fixture-parity tests to import ODW helpers where those helpers
  are static and do not evaluate source. A blanket `devDependencies` or
  `trustedDependencies` ban would conflict with that parity path.
  Date/Author: 2026-06-28, planning agent.

- Decision: Defer the parser failure contract to task 2.2.1 and record the
  required shape now.
  Rationale: Task 1.1.1 should not export a parser failure type. When task
  2.2.1 introduces the adapter, public failures must be project-owned and
  sanitized. A public `cause` field would contradict the design rule against
  leaking opaque dependency errors.
  Date/Author: 2026-06-28, planning agent.

- Decision: Skip CodeRabbit's work-item-1 `./boundary` and specifier
  classifier suggestion.
  Rationale: The approved plan requires `src/static-analysis/types.ts` plus
  passive boundary exports and explicitly forbids importing later parser,
  diagnostic, CLI, resolver, or adapter responsibilities into task 1.1.1.
  Date/Author: 2026-06-28T05:33:45Z, implementation agent.

- Decision: Mark only roadmap task 1.1.1 complete.
  Rationale: The implemented and documented work satisfies the boundary
  scaffold acceptance criteria without completing the deferred architecture
  test in 2.1.4 or the SWC parser adapter in 2.2.1.
  Date/Author: 2026-06-28T05:37:09Z, implementation agent.

## Context and orientation

This repository is an ESM TypeScript package run with Bun. The current code is
only a template:

- `src/index.ts` exports `greet`.
- `tests/index.test.ts` tests `greet`.
- `package.json` uses Bun scripts and Makefile targets, is marked private, and
  has no package-level `exports`, `types`, or `main` field.
- `Makefile` defines `make all`, `make markdownlint`, and `make nixie`.

The intended boundary after task 1.1.1 is `src/static-analysis/`. It is the
package-owned home for future static-analysis code described by
`docs/technical-design.md` section 6.1. The scaffold should expose only names
that are true today:

- the boundary identifier,
- a source object shape,
- runtime readonly analysis stage and component label arrays with TypeScript
  unions derived from them,
- and documentation that direct parser calls will belong in one future adapter.

It must not expose a parser, analyser, diagnostic contract, command, ODW
resolver, or SWC AST type.

This task deliberately does not create package-level exports. In this plan,
`src/index.ts` is a source-level internal barrel used by tests and future
source modules. The `AGENTS.md` TypeScript guidance to expose public APIs
through explicit package exports remains binding for the later moment when the
private package grows a real public package surface.

The source-of-truth documents for this task are:

- `docs/roadmap.md` sections 1.1, 2.1, and 2.2.
- `docs/technical-design.md` sections 4, 5, 6.1, 6.2, 6.4, 9.2, 11.3, 12.1,
  12.2, and 13.
- `docs/adr/0001-static-analysis-boundary.md` "Decision", "Consequences",
  and "Rejected alternative".
- `docs/terms-of-reference.md` sections 6, 7, 8, and 9.
- `docs/developers-guide.md` "Static-Analysis Boundary", "Commit Gate",
  "Tests", "Markdown", and "Documentation Upkeep".
- `AGENTS.md` "Code Style and Structure", "Documentation Maintenance",
  "Change Quality & Committing", "TypeScript Guidance", and "Markdown
  Guidance".
- `docs/documentation-style-guide.md` "Spelling", "Markdown rules", and
  "Roadmap task writing guidelines".
- `docs/scripting-standards.md` "Operational guidelines" only if new scripts
  are introduced. This plan does not require scripts.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 4 and
  5, especially balanced abstraction and separation of concerns.

No users guide is present in this worktree, so there is no user-facing guide to
update for task 1.1.1.

Skills to load before implementation:

- `execplans` for maintaining this living plan.
- `grepai` for intent-based exploration of the canonical main-branch index.
- `leta` for branch-local symbol navigation and references.
- `sem` for semantic diffs before and after each commit.
- `en-gb-oxendict-style` for documentation and comment wording.
- `firecrawl-mcp` only when refreshing official external documentation.
- `biome-typescript` only if Biome formatting or lint behaviour itself needs
  diagnosis; ordinary task-1.1.1 TypeScript edits should use the repository's
  existing Makefile and Bun commands.

There is no TypeScript router skill installed in this session. For TypeScript
implementation, follow `AGENTS.md` "TypeScript Guidance"; load
`biome-typescript` only if changing Biome configuration or diagnosing Biome
lint/format behaviour. Python verification skills such as Hypothesis,
CrossHair, and mutmut are not applicable unless a future revision adds Python
scripts. If that happens, load `python-router` first and follow the smaller
routed skill.

## Research baseline

The canonical grepai index for `odw-lint` points to ADR 0001, the technical
design, the developer guide, and the roadmap as the relevant boundary sources.
The index reflects `main` only, so branch-local facts were verified in this
worktree with `leta`.

Branch-local package inspection confirms that `package.json` is private and
has no package-level `exports`, `types`, or `main` field. That means task 1.1.1
can create the owned source boundary without making a package-surface decision.
If a later task publishes a public package API, it must add explicit
`package.json` `exports` and `types` entries then, following `AGENTS.md`
"TypeScript Guidance".

The SWC official documentation was checked with Firecrawl at
<https://swc.rs/docs/usage/core>. It documents top-level `parse`,
`parseSync`, `parseFile`, and `parseFileSync`, with top-level `parseSync`
declared as `(src, options)` and no `filename` parameter.

The published `@swc/core@1.15.43` tarball was inspected in `/tmp` without
modifying this repository. Its source confirms:

- `index.d.ts` lines 21-28: `Compiler.parse` and `Compiler.parseSync` accept
  an optional third `filename`.
- `index.d.ts` lines 59-66: top-level `parse` and `parseSync` accept only
  `src` and `options`.
- `index.js` lines 198-203: `Compiler.parseSync` passes `filename` to the
  native binding.
- `index.js` lines 393-398: top-level `parse` and `parseSync` delegate without
  a third argument.

Therefore, if a later task locks `@swc/core@1.15.43`, task 2.2.1 has one
valid filename-bearing path for that verified version: instantiate
`new Compiler()` and call `compiler.parseSync(src, options, filename)`. If
task 2.2.1 does not need a filename, it may use top-level
`parseSync(src, options)`. Task 1.1.1 must not choose or implement either
path. Because this repository does not currently declare `@swc/core`, the
future parser-adapter task must re-check the then-locked package version before
depending on any API shape.

The published `@swc/types@0.1.27` tarball was also inspected. It declares
`ParseOptions`, `JscTarget`, `TsParserConfig`, `EsParserConfig`, `Span`, and
`Program = Module | Script`. These types are relevant only to task 2.2.1 and
must not be imported by task 1.1.1.

ODW source was checked read-only in
`/data/leynos/Projects/open-dynamic-workflows`:

- `src/loader.ts` lines 78-90 compile workflow bodies with `AsyncFunction`.
- `src/loader.ts` lines 321-330 evaluate metadata with `new Function`.
- `src/primitives.ts` lines 232-240 implement `validate(source)` by calling
  `loadWorkflowScript`.
- `src/runtime/index.ts` lines 7-9 export runtime launcher and worker entry
  points.
- `src/runtime/launcher.ts` lines 67-90 create runs, call `resolveWorkflow`,
  call `loadWorkflowScript`, and spawn workers.
- `src/runtime/worker.ts` lines 68-69 read workflow source and call
  `loadWorkflowScript`.
- `src/workflows/resolve.ts` defines ODW path/name resolution, which
  standalone `odw-lint check` deliberately defers.
- `src/dual-compat.ts` `checkMeta` is a static helper, but it is not exported
  as an ODW public static API for `odw-lint` production code. Future
  fixture-parity tests may import static ODW helpers only where the design
  permits that and only for trusted fixtures; task 1.1.1 does not add such a
  test or dependency.

## Plan of work

### Work item 1: Replace the template source surface with boundary constants and types

Implement this as one commit. Replace the template `greet` API with a passive
static-analysis boundary. Add:

- `src/static-analysis/index.ts` as the owned module entry point.
- `src/static-analysis/types.ts` for passive boundary types.
- `src/index.ts` re-exporting explicit source-level names from
  `src/static-analysis`.

The boundary should define only stable scaffolding that this task can support:

- `STATIC_ANALYSIS_BOUNDARY`, with value `"odw-lint/static-analysis"`.
- `WorkflowSource`, containing `readonly filePath: string` and
  `readonly sourceText: string`.
- `STATIC_ANALYSIS_COMPONENTS`, a readonly `as const` array with values
  matching the design section 6.1 component names: `"source-reader"`,
  `"envelope-scanner"`, `"static-meta-parser"`, `"body-normalizer"`,
  `"swc-parser-adapter"`, `"span-mapper"`, `"rule-engine"`, and `"reporter"`.
- `StaticAnalysisComponent`, derived from
  `typeof STATIC_ANALYSIS_COMPONENTS[number]`.
- `STATIC_ANALYSIS_STAGES`, a readonly `as const` array with values
  `"source"`, `"envelope"`, `"metadata"`, `"body"`, `"ast"`, and
  `"diagnostic"`.
- `StaticAnalysisStage`, derived from
  `typeof STATIC_ANALYSIS_STAGES[number]`.

Do not export an analyser function, parser adapter, parser result type, SWC
type alias, diagnostic schema, or command contract. The string
`"swc-parser-adapter"` is allowed only as a future component label from the
technical design; it must not be backed by `@swc/core` in this task. Do not
edit `package.json` to add `exports`, `types`, `main`, `bin`, or dependency
entries.

Documentation and design citations:

- `docs/roadmap.md` section 1.1, task 1.1.1.
- `docs/technical-design.md` sections 5, 6.1, and 6.2.
- `docs/adr/0001-static-analysis-boundary.md` "Decision".
- `AGENTS.md` "Code Style and Structure", "TypeScript Guidance", and
  "Change Quality & Committing".
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 4
  and 5.

Skills to load:

- `grepai` for a final intent search before edits.
- `leta` to verify current exports and references before changing
  `src/index.ts`.
- `sem` before committing.
- `en-gb-oxendict-style` for comments and JSDoc.

Tests for this work item:

- Unit tests: replace `tests/index.test.ts` with assertions that the
  source-level barrel exports `STATIC_ANALYSIS_BOUNDARY`,
  `STATIC_ANALYSIS_COMPONENTS`, `STATIC_ANALYSIS_STAGES`, and a
  `WorkflowSource` fixture created with `satisfies WorkflowSource`. The tests
  must assert the runtime array values exactly and include compile-time
  `satisfies StaticAnalysisComponent` and `satisfies StaticAnalysisStage`
  checks for representative labels.
- Behavioural tests: none; no CLI or workflow command exists.
- Property tests: none; no transformation or input-space invariant exists.
- Snapshot tests: none; there is no diagnostic output contract yet.
- End-to-end tests: none.

Format only changed TypeScript files, for example:

```sh
bunx @biomejs/biome format --write \
  src/index.ts \
  src/static-analysis/index.ts \
  src/static-analysis/types.ts \
  tests/index.test.ts
```

Validation commands, run sequentially from the worktree:

```sh
make all 2>&1 | tee /tmp/make-all-$(get-project)-$(git branch --show).out
! grep -nE '@swc/(core|types)|open-dynamic-workflows' package.json bun.lock
BANNED_ODW='loadWorkflowScript|createPrimitives|validate[[:space:]]*\('
BANNED_ODW="${BANNED_ODW}|resolveWorkflow|runtime/launcher|runtime/worker"
BANNED_ODW="${BANNED_ODW}|workflows/resolve|primitives|open-dynamic-workflows"
! grep -RInE "${BANNED_ODW}" src
BANNED_SCOPE='parseWithSwc|ParserAdapter|SwcParser|ParserFailure|ParserError'
BANNED_SCOPE="${BANNED_SCOPE}|ParseFailure|ParseError|SwcParseFailure"
BANNED_SCOPE="${BANNED_SCOPE}|DiagnosticContract|DiagnosticEnvelope"
BANNED_SCOPE="${BANNED_SCOPE}|createCheckCommand|checkCommand|runCheck"
BANNED_SCOPE="${BANNED_SCOPE}|odw-lint check|resolveWorkflow|WorkflowResolver"
! grep -RInE "${BANNED_SCOPE}" src tests
bun -e '
const pkg = await Bun.file("package.json").json();
if ("exports" in pkg || "types" in pkg || "main" in pkg || "bin" in pkg) {
  process.exit(1);
}
'
```

If this plan file is updated in the same commit, also run:

```sh
mdtablefix docs/execplans/roadmap-1-1-1.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-1-1.md
make markdownlint 2>&1 | tee /tmp/markdownlint-$(get-project)-$(git branch --show).out
make nixie 2>&1 | tee /tmp/nixie-$(get-project)-$(git branch --show).out
```

Commit after the relevant gates pass.

### Work item 2: Document the source-level scaffold and deferred phase-2 checks

Implement this as one documentation commit after work item 1. Update:

- `docs/developers-guide.md` "Static-Analysis Boundary" to name
  `src/static-analysis/` as the owned production boundary.
- The same developer-guide section to state that task 1.1.1 creates a
  source-level internal boundary through `src/index.ts`, not package-level
  `exports` or `types`.
- The same developer-guide section to state that direct SWC calls will belong
  only in the future parser adapter from roadmap task 2.2.1.
- The same developer-guide section to state that task 1.1.1 deliberately does
  not add `@swc/core`, `parseWithSwc`, a parser failure public contract, or
  the forbidden-import architecture test.
- The same developer-guide section to point implementers to roadmap task
  2.1.4 for the forbidden-import architecture test and task 2.2.1 for the SWC
  parser adapter.
- This ExecPlan's living sections with implementation progress and any
  discoveries.

Do not change ADR 0001 unless implementation had to change the ownership
decision. Do not add host-specific absolute paths to committed docs.

Documentation and design citations:

- `docs/developers-guide.md` "Documentation Upkeep".
- `docs/documentation-style-guide.md` "Spelling", "Markdown rules", and
  "Roadmap task writing guidelines".
- `docs/technical-design.md` sections 5, 6.1, 11.2, 11.3, 12.2, and 13.
- `docs/roadmap.md` section 2.1, task 2.1.4, and section 2.2, task 2.2.1.
- `AGENTS.md` "Documentation Maintenance" and "Markdown Guidance".

Skills to load:

- `execplans` to update this plan's living sections.
- `sem` before committing.
- `en-gb-oxendict-style` for prose.

Tests for this work item:

- Unit tests: none; documentation-only.
- Behavioural tests: none.
- Property tests: none.
- Snapshot tests: none.
- End-to-end tests: none.
- Markdown validation is mandatory.

Format only changed Markdown files:

```sh
mdtablefix docs/developers-guide.md docs/execplans/roadmap-1-1-1.md
bunx markdownlint-cli2 --fix \
  docs/developers-guide.md \
  docs/execplans/roadmap-1-1-1.md
```

Validation commands:

```sh
make all 2>&1 | tee /tmp/make-all-$(get-project)-$(git branch --show).out
make markdownlint 2>&1 | tee /tmp/markdownlint-$(get-project)-$(git branch --show).out
make nixie 2>&1 | tee /tmp/nixie-$(get-project)-$(git branch --show).out
```

Commit after the gates pass.

### Work item 3: Close roadmap task 1.1.1 after gated implementation

Implement this as one documentation commit after work items 1-2 are committed
and gated. Update:

- `docs/roadmap.md` task 1.1.1 from unchecked to checked.
- This ExecPlan's `Progress`, `Decision Log`, and `Outcomes & Retrospective`
  sections with the completed work and gate results.

Do not mark any 2.1 or 2.2 task complete. In particular, do not mark
`2.1.4` or `2.2.1` complete.

Documentation and design citations:

- `docs/roadmap.md` section 1.1, task 1.1.1.
- `docs/documentation-style-guide.md` "Roadmap task writing guidelines".
- `docs/developers-guide.md` "Documentation Upkeep".
- `AGENTS.md` "Markdown Guidance" and "Change Quality & Committing".

Skills to load:

- `execplans` to update this living plan.
- `sem` before committing.
- `en-gb-oxendict-style` for prose.

Tests for this work item:

- Unit tests: none; documentation-only close-out.
- Behavioural tests: none.
- Property tests: none.
- Snapshot tests: none.
- End-to-end tests: none.
- Markdown validation is mandatory.

Format only changed Markdown files:

```sh
mdtablefix docs/roadmap.md docs/execplans/roadmap-1-1-1.md
bunx markdownlint-cli2 --fix \
  docs/roadmap.md \
  docs/execplans/roadmap-1-1-1.md
```

Validation commands:

```sh
make all 2>&1 | tee /tmp/make-all-$(get-project)-$(git branch --show).out
make markdownlint 2>&1 | tee /tmp/markdownlint-$(get-project)-$(git branch --show).out
make nixie 2>&1 | tee /tmp/nixie-$(get-project)-$(git branch --show).out
```

Commit after the gates pass.

## Concrete steps

At the start of each implementation turn, run:

```sh
cd /data/leynos/Projects/odw-lint.worktrees/roadmap-1-1-1
git branch --show
git status --short
grepai search --workspace Projects --project odw-lint \
  "static analysis module boundary passive exports roadmap 1.1.1" --toon --compact
leta files src/ tests/
```

Before each commit, run:

```sh
sem diff
git status --short
```

After every implementation work item and before committing it, also run these
branch-local boundary checks from the worktree. They are intentionally exact
text checks over the files this task may affect, because roadmap task 2.1.4
owns the later architecture test:

```sh
! grep -nE '@swc/(core|types)|open-dynamic-workflows' \
  package.json bun.lock
BANNED_ODW='loadWorkflowScript|createPrimitives|validate[[:space:]]*\('
BANNED_ODW="${BANNED_ODW}|resolveWorkflow|runtime/launcher|runtime/worker"
BANNED_ODW="${BANNED_ODW}|workflows/resolve|primitives|open-dynamic-workflows"
! grep -RInE "${BANNED_ODW}" src
BANNED_SCOPE='parseWithSwc|ParserAdapter|SwcParser|ParserFailure|ParserError'
BANNED_SCOPE="${BANNED_SCOPE}|ParseFailure|ParseError|SwcParseFailure"
BANNED_SCOPE="${BANNED_SCOPE}|DiagnosticContract|DiagnosticEnvelope"
BANNED_SCOPE="${BANNED_SCOPE}|createCheckCommand|checkCommand|runCheck"
BANNED_SCOPE="${BANNED_SCOPE}|odw-lint check|resolveWorkflow|WorkflowResolver"
! grep -RInE "${BANNED_SCOPE}" src tests
bun -e '
const pkg = await Bun.file("package.json").json();
if ("exports" in pkg || "types" in pkg || "main" in pkg || "bin" in pkg) {
  process.exit(1);
}
'
```

Commit messages should be imperative and scoped to the work item, for example:

```plaintext
Add static-analysis boundary exports

Replace the template source surface with the owned static-analysis boundary
names required by roadmap task 1.1.1. The scaffold deliberately avoids the SWC
dependency and parser adapter reserved for task 2.2.1.
```

If a stash is ever required, name it with the required deterministic format:

```plaintext
df12-stash v1 task=1.1.1 kind=keep reason="<short reason>"
```

Use `kind=discard` only for parked formatter or build churn that should not be
re-applied.

## Validation and acceptance

The implementation is accepted when all of the following are true:

- `src/static-analysis/` exists and is the named production boundary for owned
  static-analysis code.
- `src/index.ts` exports explicit static-analysis boundary names rather than
  the template `greet` helper.
- `STATIC_ANALYSIS_COMPONENTS` and `STATIC_ANALYSIS_STAGES` are runtime
  readonly exports, and `StaticAnalysisComponent` and `StaticAnalysisStage` are
  derived type unions from those arrays.
- `package.json` keeps the current private, source-only posture for this task:
  no `exports`, `types`, `main`, or `bin` fields are added.
- `package.json` and `bun.lock` contain no `@swc/core`, `@swc/types`, or
  `open-dynamic-workflows` entries at all. Task 1.1.1 also does not add an ODW
  development or trusted dependency, but this plan deliberately does not create
  a future blanket ban on trusted parity-test dependencies.
- No production source imports or references ODW executable loader, primitive,
  runtime launcher, worker, or resolver paths.
- No `parseWithSwc`, parser adapter implementation, public parser failure
  type, diagnostic contract, CLI, or workflow resolver is introduced.
- `docs/developers-guide.md` records the scaffolded boundary and the deferred
  phase-2 checks: the forbidden-import architecture test in task 2.1.4 and the
  SWC parser adapter in task 2.2.1.
- `docs/roadmap.md` marks only task 1.1.1 complete after the preceding code,
  tests, and docs are committed and gated.
- Each work item was committed after passing its gate.

Final validation, run sequentially from the worktree:

```sh
make all 2>&1 | tee /tmp/make-all-$(get-project)-$(git branch --show).out
! grep -nE '@swc/(core|types)|open-dynamic-workflows' package.json bun.lock
BANNED_ODW='loadWorkflowScript|createPrimitives|validate[[:space:]]*\('
BANNED_ODW="${BANNED_ODW}|resolveWorkflow|runtime/launcher|runtime/worker"
BANNED_ODW="${BANNED_ODW}|workflows/resolve|primitives|open-dynamic-workflows"
! grep -RInE "${BANNED_ODW}" src
BANNED_SCOPE='parseWithSwc|ParserAdapter|SwcParser|ParserFailure|ParserError'
BANNED_SCOPE="${BANNED_SCOPE}|ParseFailure|ParseError|SwcParseFailure"
BANNED_SCOPE="${BANNED_SCOPE}|DiagnosticContract|DiagnosticEnvelope"
BANNED_SCOPE="${BANNED_SCOPE}|createCheckCommand|checkCommand|runCheck"
BANNED_SCOPE="${BANNED_SCOPE}|odw-lint check|resolveWorkflow|WorkflowResolver"
! grep -RInE "${BANNED_SCOPE}" src tests
bun -e '
const pkg = await Bun.file("package.json").json();
if ("exports" in pkg || "types" in pkg || "main" in pkg || "bin" in pkg) {
  process.exit(1);
}
'
make markdownlint 2>&1 | tee /tmp/markdownlint-$(get-project)-$(git branch --show).out
make nixie 2>&1 | tee /tmp/nixie-$(get-project)-$(git branch --show).out
```

Expected result: each command exits 0. `make nixie` may report no Mermaid
diagrams to validate; that is acceptable only if it exits 0.

## Idempotence and recovery

All work items are additive or replacement edits that can be repeated after
checking `git status --short`. If a formatter changes unrelated files, do not
commit that churn. Park it only with a named `df12-stash` using
`kind=discard`, or discard it only if it is clearly generated by this task.

If implementation accidentally adds `@swc/core`, `@swc/types`,
`open-dynamic-workflows`, or package-level `exports`, `types`, `main`, or
`bin` fields, revert that work before committing and update `Decision Log` with
the cause. Do not preserve an accidental dependency or package-surface change
in a task 1.1.1 commit. If a future trusted fixture parity path appears
necessary while working on 1.1.1, stop instead of adding a development or
trusted dependency; that belongs to a later roadmap task or an explicit roadmap
revision.

If a gate fails, open the corresponding `/tmp/*-odw-lint-roadmap-1-1-1.out`
log, fix the smallest relevant cause, rerun the failed gate, and then rerun
the full gate for the work item. After two focused attempts, stop and update
this plan.

## Interfaces and dependencies

At the end of this roadmap task, the intended production interface is:

```typescript
export const STATIC_ANALYSIS_BOUNDARY: "odw-lint/static-analysis";

export interface WorkflowSource {
  readonly filePath: string;
  readonly sourceText: string;
}

export const STATIC_ANALYSIS_COMPONENTS: readonly [
  "source-reader",
  "envelope-scanner",
  "static-meta-parser",
  "body-normalizer",
  "swc-parser-adapter",
  "span-mapper",
  "rule-engine",
  "reporter",
];

export type StaticAnalysisComponent =
  (typeof STATIC_ANALYSIS_COMPONENTS)[number];

export const STATIC_ANALYSIS_STAGES: readonly [
  "source",
  "envelope",
  "metadata",
  "body",
  "ast",
  "diagnostic",
];

export type StaticAnalysisStage = (typeof STATIC_ANALYSIS_STAGES)[number];
```

These are passive boundary names. They do not parse source, run workflows, emit
diagnostics, or call SWC.

`src/index.ts` re-exports these names for source-level consumers inside the
repository. Task 1.1.1 intentionally leaves `package.json` without `exports`,
`types`, `main`, or `bin` fields because the package is private and this slice
does not define a published package surface.

There are no new dependencies in task 1.1.1. The future parser dependency is
`@swc/core`, but it must be added only by roadmap task 2.2.1. If task 2.2.1
locks version 1.15.43 and needs filename-aware parsing with that verified API,
it must use `new Compiler().parseSync(src, options, filename)` and test that
path; top-level `parseSync(src, options)` cannot carry a filename. If task
2.2.1 locks a different version, re-verify the official docs and package
source before relying on the API.

The future forbidden-import architecture test remains task 2.1.4. That task
should start with production import/export declaration checks. If it also
checks calls, it must use a deterministic syntactic scan that ignores comments
and string literals, or wait for a parser-backed scan once the relevant parser
adapter exists. It must not fail harmless documentation, comments, diagnostic
strings, or tests that mention executable helper names.

The future public parser failure contract for task 2.2.1 must be project-owned
and sanitized. It may expose fields such as `kind`, `message`, `syntax`, and
`sourceFile`, but it must not expose a public `cause` that leaks opaque SWC
exceptions. Any raw exception should stay in an internal, non-exported
diagnostics detail as `unknown`.

## Artifacts and notes

Planning commands already run:

```plaintext
git branch --show
# roadmap-1-1-1

grepai search --workspace Projects --project odw-lint \
  "SWC static analysis module boundary parser adapter lint rules executable runtime helpers" \
  --toon --compact
# Returned ADR 0001, technical design, developer guide, and roadmap hits.

leta show greet
# src/index.ts exports only the template greet function.

node -p "require('./package.json').dependencies?.['@swc/core'] ?? 'not-declared'"
# not-declared

test -d node_modules/@swc/core \
  && node -p "require('./node_modules/@swc/core/package.json').version" \
  || printf 'not-installed\n'
# not-installed

bun -e '
const pkg = await Bun.file("package.json").json();
console.log(JSON.stringify({
  private: pkg.private,
  hasExports: Object.hasOwn(pkg, "exports"),
  hasTypes: Object.hasOwn(pkg, "types"),
  hasMain: Object.hasOwn(pkg, "main"),
}, null, 2));
'
# {
#   "private": true,
#   "hasExports": false,
#   "hasTypes": false,
#   "hasMain": false
# }
```

The SWC source research used package tarballs in `/tmp`; those files are
scratch evidence and are not project artefacts. The Firecrawl scrape of
<https://swc.rs/docs/usage/core> returned the current official `@swc/core`
parse API documentation and was used only to constrain future task 2.2.1.

## Outcomes & Retrospective

Work item 1 replaced the template `greet` API with the source-level
static-analysis boundary. `src/static-analysis/types.ts` now owns passive
boundary constants, readonly component and stage arrays, and derived union
types. `src/static-analysis/index.ts` and `src/index.ts` re-export only those
approved source-level names.

The work item passed `make all` after formatting and import organization, and
the branch-local boundary checks found no forbidden SWC or ODW dependencies,
no production ODW runtime references, no out-of-scope parser, diagnostic, CLI,
or resolver symbols, and no package-level `exports`, `types`, `main`, or
`bin` fields. CodeRabbit ran once; its only finding requested a module and
classifier outside the approved scope, so no code change was made for it.

Work item 2 documented the current source-level scaffold in
`docs/developers-guide.md`. The guide now names `src/static-analysis/`, states
that task 1.1.1 exposes only a source-level internal boundary through
`src/index.ts`, and directs future parser-adapter and forbidden-import work to
roadmap tasks 2.2.1 and 2.1.4 respectively.

Work item 3 marked only roadmap task 1.1.1 complete. The phase-2 tasks remain
open, including the forbidden-import architecture test in 2.1.4 and the SWC
parser adapter in 2.2.1.

## Review feedback addressed

The round-4 revision resolves the three blocking review points:

- Runtime/type contract: chose a single contract. Work item 1 now requires
  runtime readonly exports `STATIC_ANALYSIS_COMPONENTS` and
  `STATIC_ANALYSIS_STAGES`, with `StaticAnalysisComponent` and
  `StaticAnalysisStage` derived from those arrays. The tests now assert the
  arrays at runtime and use `satisfies` for representative compile-time type
  checks.
- Boundary validation: added explicit branch-local checks after every
  implementation work item and in final acceptance. The checks prove that
  `package.json` and `bun.lock` contain no `@swc/core`, `@swc/types`, or
  `open-dynamic-workflows` entries; that production `src` does not reference
  executable ODW loader, primitive, runtime launcher, worker, or resolver
  paths; and that task 1.1.1 does not introduce `parseWithSwc`, a parser
  adapter implementation, a parser failure public type, a diagnostic contract,
  a CLI, or a workflow resolver symbol.
- Package surface: chose a source-level internal boundary. The plan now states
  that `package.json` is private and has no package export surface, so task
  1.1.1 must not add package-level `exports` or `types`; `src/index.ts` is the
  source-level barrel for this slice.

The round-3 revision resolves the three blocking review points:

- Roadmap sequencing: removed the forbidden-import architecture test work item
  from task 1.1.1. The plan now leaves that test in roadmap task 2.1.4 and
  says not to mark any 2.1 task complete.
- Dependency contract: replaced the blanket ODW dependency ban with a
  production/runtime dependency restriction for task 1.1.1, while preserving
  the future trusted fixture-parity path allowed by ADR 0001 and
  `docs/technical-design.md` section 11.2.
- Architecture-test scan shape: removed the scan from this ExecPlan. The plan
  now records that future 2.1.4 work should start with import/export
  declaration checks and use deterministic syntax that ignores comments and
  strings if it later checks calls.

The round-2 revision resolved the previous four blocking review points:

- Roadmap scope: removed `@swc/core` installation and parser-adapter
  implementation from task 1.1.1. The plan now explicitly defers them to
  roadmap task 2.2.1.
- SWC filename contract: recorded verified SWC official and package-source
  evidence that top-level `parseSync` lacks a filename parameter and that only
  `Compiler.parseSync` accepts one. Task 1.1.1 does not implement either path.
- Forbidden-runtime boundary: originally narrowed the architecture test to
  package dependencies, production import/export declarations, and direct
  executable helper call tokens. Round 3 supersedes that by deferring the test
  entirely to task 2.1.4.
- Parser error shape: removed the task-1.1.1 parser failure type and recorded a
  future task-2.2.1 requirement that public parse failures must be sanitized and
  must not expose opaque SWC exceptions through a public `cause`.

## Round 2 revision note

This revision replaced the round-1 plan with a dependency-free boundary
scaffold and removed parser-adapter implementation from task 1.1.1. It
preserved the SWC and ODW research as constraints for later work. Round 3
supersedes the round-2 architecture-test work item and leaves that work in
roadmap task 2.1.4.

## Round 3 revision note

This revision removes the out-of-sequence architecture-test work item from
task 1.1.1 and leaves it for roadmap task 2.1.4. It narrows dependency
language to task-1.1.1 production/runtime boundaries so later trusted
fixture-parity tests can still use static ODW helpers where the design permits
that. It also records the syntactic-scan constraint that future 2.1.4 work must
meet if it checks executable helper calls.

## Round 4 revision note

This revision makes the passive label contract testable at runtime by adding
required `STATIC_ANALYSIS_COMPONENTS` and `STATIC_ANALYSIS_STAGES` exports,
with type unions derived from those arrays. It adds explicit branch-local
boundary checks for dependencies, ODW runtime references, package-surface
fields, and out-of-scope parser, diagnostic, CLI, and resolver symbols. It
also clarifies that task 1.1.1 creates only a source-level internal boundary
through `src/index.ts`, not package-level `exports` or `types`.
