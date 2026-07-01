# Implement metadata classification

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: IMPLEMENTED

This is planning round 3. Do not begin implementation until the roadmap
workflow approves the plan. This revision preserves the round 2 fixes for
branch freshness, the ODW loader's first-brace metadata boundary, and the
invalid-fixture parity contract for task-owned diagnostics, and it adds the
missing documentation-contents closeout required for a new standalone
ExecPlan.

## Purpose / big picture

Roadmap task 2.1.3 turns the envelope facts from task 2.1.2 into metadata
diagnostics. After this plan is implemented, the static-analysis pipeline can
distinguish hard ODW (Open Dynamic Workflows) metadata errors from metadata that
would require unsafe source evaluation to understand. The important observable
behaviour is that computed metadata, including hostile metadata, receives
`odw/meta-statically-unprovable` and is never executed.

This task deliberately does not implement the command-line interface, body
normalisation, SWC body parsing, loader-parity execution, or
`odw/claude-pure-meta` emission. Roadmap task 3.1.1 owns the user-visible
Claude pure-metadata diagnostic after the parser-backed dialect slice exists.
This task still records metadata portability facts so 3.1.1 has a clear place
to build from, but it must not change the current rule semantics that route
computed metadata to `odw/meta-statically-unprovable`.

## Constraints

- Work only in the assigned git-donkey worktree:
  `<assigned-worktree>`.
- Do not edit the root/control worktree at `<control-worktree>`.
- Treat `origin/main` as the canonical integration branch.
- Use this GrepAI command shape first for intent search against the canonical
  main-branch index:

  ```sh
  grepai search --workspace 'Projects' --project 'odw-lint' "<English intent query>" --toon --compact
  ```

  GrepAI reflects `main` only. Verify every branch-local fact inside this
  worktree with `leta`, exact text search, or file inspection before acting.
- Use `leta` for branch-local symbol navigation, references, call graphs, and
  refactoring commands when it is available. In this planning round,
  `leta files src/` and `leta files tests/` succeeded and listed the
  branch-local source and test surfaces. Implementation agents should retry
  Leta; if the workspace is unavailable in their session, record the exact
  failure in this plan and use precise branch-local file inspection for the
  current task.
- Use `sem` instead of raw Git history commands for codebase history, blame,
  or semantic diff work. In this planning round, `sem diff --from HEAD --to
  origin/main` first showed relevant upstream changes in `docs/roadmap.md`,
  `docs/execplans/roadmap-2-1-7.md`,
  `tests/diagnostics/public-consumer.test.ts`, and
  `tests/diagnostics/types.test.ts`; after `git fetch origin main && git
  rebase origin/main`, it reported no changes.
- Follow `AGENTS.md`, especially the TypeScript, Markdown, quality-gate,
  atomicity, and commit-message guidance.
- Use en-GB Oxford spelling in prose, comments, and commit messages while
  preserving external API spellings and code identifiers.
- Load and follow these skills before implementation: `execplans`, `grepai`,
  `leta`, `sem`, `firecrawl-mcp`, `biome-typescript`, and
  `en-gb-oxendict-style`. This environment does not list a TypeScript router
  skill; use `biome-typescript` plus `AGENTS.md` TypeScript Guidance. If a
  future environment provides a TypeScript router skill, load it before
  touching TypeScript.
- Production code must not import executable ODW loader, primitive, launcher,
  worker, runtime, scheduler, metadata-evaluating, or agent-dispatch paths.
  This implements `docs/technical-design.md` §5 and
  `docs/adr/0001-static-analysis-boundary.md` "Decision" and "Consequences".
- Do not call `new Function`, `eval`, dynamic import of workflow files, ODW
  `loadWorkflowScript`, ODW `createPrimitives`, or the ODW runtime
  `validate(source)` primitive.
- Do not copy ODW private helper source into production `odw-lint` code. Use
  ODW source as behavioural evidence, then implement repository-owned static
  code with tests.
- Do not add dependencies. `bun.lock` currently resolves TypeScript 5.9.3,
  Fast-check 4.8.0, Biome 2.5.1, and Oxlint 1.71.0. `@swc/core` is not present
  and belongs to roadmap task 2.2.1.
- Keep production metadata classification under `src/static-analysis/`.
- Keep direct SWC calls out of this task. `docs/developers-guide.md` says
  direct SWC calls belong to roadmap task 2.2.1.
- Metadata classification must consume `OriginalSourceFile` records created by
  `createOriginalSourceFile` and spans derived from the same source record.
- Spans are zero-based UTF-8 byte offsets with one-based display line and
  column positions. Use the existing source-position helpers rather than
  reconstructing positions by hand in production code.
- Use `maskNonCodeSource` and the envelope scanner's `WorkflowMetaValue` state
  as the entry boundary. Do not rediscover the top-level metadata declaration
  independently.
- Top-level metadata values that are statically proven not to contain an object
  literal in the metadata expression, missing metadata values, and
  unterminated object literals are runtime-invalid metadata. They produce
  `odw/meta-object` errors.
- A top-level metadata expression that does not start with `{` but contains a
  real `{` within the metadata expression is statically unprovable in this
  slice, not runtime-invalid. This follows ODW's current loader, which searches
  for the first `{` after `export const meta =` and evaluates that sliced
  object. Examples include `makeMeta({ ... })`, `condition ? { ... } : { ... }`,
  `({ ... })`, and arrays containing object literals. They must produce
  `odw/meta-statically-unprovable` unless a later approved task deliberately
  implements and documents a stricter linter divergence.
- Missing, empty, or non-string `meta.name` is runtime-invalid metadata. It
  produces an `odw/meta-name` error.
- Missing `meta.description` or a non-string `meta.description` is
  runtime-invalid metadata. It produces `odw/meta-description`. An empty string
  description is not rejected in this slice because ODW's current loader only
  checks `typeof m.description === "string"`.
- Any metadata value that would require variables, calls, arithmetic, spread,
  computed property keys, template interpolation, or other source evaluation to
  prove must produce `odw/meta-statically-unprovable`, not
  `odw/meta-object`, `odw/meta-name`, `odw/meta-description`, or
  `odw/claude-pure-meta`.
- Emit at most one `odw/meta-statically-unprovable` diagnostic per metadata
  object in this slice. Use the first unprovable value encountered in source
  order as the diagnostic span. This matches the existing invalid fixture
  manifest shape and keeps the work review-sized.
- Keep `odw/claude-pure-meta` user-visible emission out of scope. Roadmap
  lines 513-517 assign that to task 3.1.1, and existing hostile/computed
  fixture plans assign computed metadata to
  `odw/meta-statically-unprovable`.
- Every work item below is independently committable and must pass its focused
  validation plus the repository gates before the next item starts.
- Format only changed files. For Markdown changed by a work item, run
  `mdtablefix` and `markdownlint-cli2 --fix` on the exact changed Markdown
  paths. For TypeScript changed by a work item, run Biome formatting only on
  paths that exist and were edited by that work item.
- Do not run repo-global mutating formatters such as `make fmt`, `bun fmt`, or
  `mdformat-all`.
- Because every work item updates this ExecPlan, every work item includes a
  Markdown change and must run file-scoped Markdown formatting for
  `docs/execplans/roadmap-2-1-3.md`.
- Run `make all`, `make markdownlint`, and `make nixie` before each work-item
  commit. `make all` includes `typecheck` on current `origin/main`.
- Run `make branch-freshness` before requesting review or opening a pull
  request. `make all` does not fetch or validate branch freshness.

## Tolerances (exception triggers)

- Scope: if implementation needs more than six production TypeScript files or
  more than 450 net production lines, stop and update the Decision Log before
  asking for direction.
- Interface: if a public package-export name must be removed or an existing
  exported type must change incompatibly, stop and escalate.
- Dependencies: if a new external dependency is needed, stop and escalate.
- Diagnostics: if any existing rule identifier, severity, or diagnostic
  message must change, stop and escalate unless the exact change is already
  required by this plan.
- Fixture contract: if existing invalid workflow fixture source must change,
  stop and justify the fixture edit in the Decision Log before proceeding.
- Claude compatibility: if implementation appears to require emitting
  `odw/claude-pure-meta` in this task, stop and reconcile that with roadmap
  task 3.1.1 before proceeding.
- Test iterations: if a work item still fails after three focused test-fix
  attempts, stop and record the failing command and current hypothesis.
- Ambiguity: if two valid interpretations would produce different diagnostics
  for the same fixture, stop and present the options with trade-offs.

## Risks

- Risk: the recursive metadata parser could accidentally evaluate source.
  Severity: high.
  Likelihood: low.
  Mitigation: implement a hand-written static parser over source text, forbid
  `eval`, `new Function`, and dynamic imports, and add hostile metadata tests
  that read source without setting the hostile marker.

- Risk: span calculations could mix UTF-16 string indexes and UTF-8 byte
  offsets.
  Severity: high.
  Likelihood: medium.
  Mitigation: derive all production spans through existing source-position
  helpers and add Unicode-before-metadata tests for value spans.

- Risk: `odw/meta-statically-unprovable` and `odw/claude-pure-meta` overlap in
  the design text.
  Severity: medium.
  Likelihood: medium.
  Mitigation: follow roadmap sequencing. This task emits
  `odw/meta-statically-unprovable`; task 3.1.1 owns
  `odw/claude-pure-meta` after parser-backed validation exists.

- Risk: the metadata parser may grow into a general JavaScript evaluator.
  Severity: medium.
  Likelihood: medium.
  Mitigation: support only object and array literals with primitive literal
  values. Treat every operator, call, identifier value, spread, and computed key
  as statically unprovable.

- Risk: fixture refresh may rewrite generated manifests beyond the intended
  task.
  Severity: medium.
  Likelihood: low.
  Mitigation: run `make refresh-fixtures` only in the work item that consumes
  invalid fixture manifests, inspect the report, and park unrelated formatter
  churn with a named stash only if unavoidable.

## Progress

- [x] (2026-07-01) Drafted the first planning-round ExecPlan for roadmap task
  2.1.3.
- [x] (2026-07-01T12:42+01:00) Confirmed the assigned worktree was behind
  `origin/main` by one commit and that `sem diff --from HEAD --to origin/main`
  reported relevant upstream changes in the roadmap, task 2.1.7 ExecPlan, and
  public diagnostic tests.
- [x] (2026-07-01T12:43+01:00) Ran `git fetch origin main && git rebase
  origin/main`; the rebase completed cleanly and `sem diff --from HEAD --to
  origin/main` then reported no changes.
- [x] (2026-07-01T12:44+01:00) Reran GrepAI, Leta, and branch-local document
  checks against the rebased worktree.
- [x] (2026-07-01) Pre-work: refreshed the branch baseline and re-checked task
  scope before implementation. `git fetch origin main` and
  `sem diff --from HEAD --to origin/main` reported no upstream drift;
  `make branch-freshness` correctly refused to run while this untracked
  ExecPlan made the worktree dirty.
- [x] (2026-07-01) Work item 1: added the metadata fact model in
  `src/static-analysis/workflow-metadata.ts` and the static literal parser in
  `src/static-analysis/workflow-metadata-parser.ts`, with focused parser tests
  for pure literals, comments, trailing commas, Unicode spans, frozen results,
  and first unprovable spans.
- [x] (2026-07-01) Work item 2: added runtime-invalid metadata classification
  for missing values, proven non-object expressions, unterminated objects,
  missing or invalid `name`, and missing or invalid `description`.
- [x] (2026-07-01) Work item 3: emitted
  `odw/meta-statically-unprovable` for computed metadata and object-bearing
  non-object expressions without executing hostile fixture source.
- [x] (2026-07-01) Work item 4: exported the metadata classifier and fact
  types through the static-analysis and package facades, then added invalid
  fixture parity coverage for task-owned metadata and envelope rules.
- [x] (2026-07-01) Work item 5: updated `docs/contents.md`,
  `docs/developers-guide.md`, `docs/roadmap.md`, and this ExecPlan to record
  the completed classifier surface and the deferred
  `odw/claude-pure-meta` boundary.
- [x] (2026-07-01) Follow-up review pass: addressed CodeRabbit findings for
  comment-aware metadata balancing, bounded block-comment scans, string line
  continuations, object-literal versus block-body classification, recursive
  parser snapshots, numeric property-key normalisation, fixture status parity,
  and portable ExecPlan paths.

## Surprises & discoveries

- Observation: the first attempt to run `leta files` used an invalid
  multi-path command.
  Evidence: `leta files src tests docs | head -240` returned
  `error: unexpected argument 'tests' found`.
  Impact: the command was rerun as `leta files src/` and `leta files tests/`,
  both of which succeeded. This is not a Leta availability issue.

- Observation: the assigned worktree was stale at the start of planning round
  2.
  Evidence: `git status --short --branch` reported
  `## roadmap-2-1-3...origin/main [behind 1]`, and `sem diff --from HEAD --to
  origin/main` listed `docs/roadmap.md`, `docs/execplans/roadmap-2-1-7.md`,
  `tests/diagnostics/public-consumer.test.ts`, and
  `tests/diagnostics/types.test.ts`.
  Impact: this plan now requires branch refresh/rebase before implementation,
  scope re-check against the changed files, and `make branch-freshness` before
  review.

- Observation: roadmap task 3.1.1 explicitly owns
  `odw/claude-pure-meta` emission.
  Evidence: `docs/roadmap.md` lines 513-517 say pure-literal metadata
  compatibility checks produce `odw/claude-pure-meta` in task 3.1.1.
  Impact: task 2.1.3 must classify computed metadata as
  `odw/meta-statically-unprovable` and leave user-visible
  `odw/claude-pure-meta` diagnostics for the later roadmap task.

- Observation: ODW's current runtime loader requires the metadata assignment to
  contain an object literal brace and evaluates the sliced object with
  `new Function`.
  Evidence: `../open-dynamic-workflows/src/loader.ts` lines
  302-331 find `export const meta`, look for `{`, match braces, slice the
  original source, and call `new Function`.
  Impact: `odw-lint` must not call the loader or replicate the evaluation path.
  A non-object expression with a real object literal inside it is not
  statically proven runtime-invalid; this task reports it as
  `odw/meta-statically-unprovable`.

- Observation: ODW only enforces `meta.name` as a non-empty string and
  `meta.description` as a string.
  Evidence: `../open-dynamic-workflows/src/loader.ts` lines
  456-466 implement those checks.
  Impact: empty `description` remains runtime-valid in this slice unless a
  later product decision tightens the linter beyond runtime parity.

- Observation: the envelope scanner's earlier value-start scan skipped masked
  string metadata and classified `export const meta = "not an object";` as a
  missing value.
  Evidence: the new focused classifier test expected the span text
  `"not an object"` but initially received an empty span.
  Impact: `scanWorkflowEnvelope` now skips comments from original source when
  finding the metadata value start, while still allowing quoted and other
  non-object tokens to be classified by metadata diagnostics.

## Decision log

- Decision: implement a repository-owned metadata parser in
  `src/static-analysis/workflow-metadata.ts`.
  Rationale: `docs/technical-design.md` §5 and ADR 0001 forbid production
  imports of ODW runtime paths, and ODW does not export a safe static API.
  Date/Author: 2026-07-01, planning agent.

- Decision: use a recursive-descent static parser rather than TypeScript's
  compiler API for metadata literal parsing in this task.
  Rationale: the supported grammar is intentionally smaller than JavaScript:
  object, array, string, number, boolean, and null literals only. A small owned
  parser can attach exact source spans and reject every computed construct
  without inventing a safe evaluator. TypeScript's compiler API remains
  verified for future syntax-tree work but is not necessary for this metadata
  slice.
  Date/Author: 2026-07-01, planning agent.

- Decision: emit `odw/meta-statically-unprovable` for computed metadata in
  this task and do not emit `odw/claude-pure-meta`.
  Rationale: roadmap task 2.1.3 success is specifically that computed metadata
  receives `odw/meta-statically-unprovable`, while roadmap task 3.1.1 owns
  `odw/claude-pure-meta`.
  Date/Author: 2026-07-01, planning agent.

- Decision: parse and report the first unprovable metadata expression only.
  Rationale: the existing invalid fixture manifests pin one diagnostic per
  computed or hostile metadata fixture. Reporting every unprovable nested value
  can be added later after the rule engine and suppression policy exist.
  Date/Author: 2026-07-01, planning agent.

- Decision: refresh the task branch before implementation and require
  `make branch-freshness` before review.
  Rationale: `make all` does not fetch or validate roadmap-branch freshness,
  and planning round 2 began with this branch one commit behind `origin/main`.
  Date/Author: 2026-07-01, planning agent.

- Decision: distinguish proven primitive/no-object metadata expressions from
  computed expressions that contain an object literal.
  Rationale: ODW's loader searches for the first `{` after `export const meta
  =` and evaluates that sliced object. A value such as `makeMeta({ ... })` is
  not statically proven runtime-invalid, but `odw-lint` cannot evaluate it
  safely. The task-owned diagnostic is therefore
  `odw/meta-statically-unprovable`, not `odw/meta-object`.
  Date/Author: 2026-07-01, planning agent.

- Decision: fixture parity in this task compares only task-owned metadata and
  envelope rules.
  Rationale: syntax-error fixture manifests already expect `odw/body-syntax`,
  but body parsing and body-syntax emission belong to the deferred body parser
  slice. Filtering the parity comparison to
  `odw/meta-required`, `odw/meta-object`,
  `odw/meta-statically-unprovable`, `odw/meta-name`,
  `odw/meta-description`, and `odw/no-import-export` keeps the red/green test
  implementable without pulling task 2.2 work forward.
  Date/Author: 2026-07-01, planning agent.

- Decision: keep the metadata classifier passive and expose it through the
  current private package facade.
  Rationale: invalid fixture parity and public-consumer tests need one reviewed
  API surface for downstream parser and rule-engine tasks, but the
  implementation still belongs under `src/static-analysis/` and must not
  evaluate workflow source.
  Date/Author: 2026-07-01, implementation agent.

- Decision: treat non-object metadata expressions as statically unprovable
  only when the expression contains an object literal candidate, not merely any
  brace.
  Rationale: function and arrow block bodies are not metadata object literals,
  and classifying them as unprovable would hide a hard `odw/meta-object`
  error. The scanner now skips block bodies after non-expression braces while
  preserving `makeMeta({ ... })`, conditional object expressions, and
  parenthesized object expressions as unprovable.
  Date/Author: 2026-07-01, implementation agent.

## Outcomes & retrospective

Implemented `parseWorkflowMetadataLiteral` in
`src/static-analysis/workflow-metadata-parser.ts` and
`classifyWorkflowMetadata` in `src/static-analysis/workflow-metadata.ts`. The
classifier now distinguishes runtime-invalid metadata from statically
unprovable metadata without importing or executing ODW runtime code. Focused
tests cover pure literal parsing, runtime-invalid diagnostics, computed
metadata warnings, Unicode byte spans, frozen parser results, hostile fixture
passivity, and the explicit absence of `odw/claude-pure-meta` emission in this
task.

The invalid workflow fixture suite now compares task-owned metadata and
envelope diagnostics against committed manifest expectations while preserving
deferred `odw/body-syntax` expectations for the future body parser slice. The
package facade exports the classifier and fact types for later static-analysis
stages. Documentation now records the implemented classifier boundary and keeps
Claude pure-metadata diagnostics assigned to roadmap task 3.1.1.

## Context and orientation

The current source model begins with
`src/static-analysis/workflow-envelope.ts`. `scanWorkflowEnvelope` accepts an
`OriginalSourceFile`, masks inert source regions, finds the real top-level
`export const meta =` declaration, records `WorkflowMetaValue`, and emits
existing envelope diagnostics for missing metadata and unsupported top-level
imports or exports.

`src/static-analysis/types.ts` defines `WorkflowMetaValue` as a discriminated
union:

- `"object"` for a complete object-literal metadata span;
- `"non-object-expression"` for a value that does not start with `{`;
- `"unterminated-object"` for an object whose closing brace is missing; and
- `"missing-value"` when the assignment has no value.

Task 2.1.3 should add metadata classification after those envelope facts. It
should not rewrite the envelope scanner into a large rule engine. Keep the
metadata parser focused, testable, and owned by `src/static-analysis/`.

The invalid workflow fixture corpus already contains expected diagnostics for
this task under `tests/static-analysis/fixtures/invalid-workflows/`:

- `missing-metadata/missing-meta-name.js` expects `odw/meta-name`.
- `missing-metadata/missing-meta-description.js` expects
  `odw/meta-description`.
- `malformed-metadata/meta-not-object.js` expects `odw/meta-object`.
- `malformed-metadata/unterminated-meta-object.js` expects
  `odw/meta-object`.
- `malformed-metadata/computed-meta-expression.js` expects
  `odw/meta-statically-unprovable`.
- `hostile-metadata/global-marker.js` and `hostile-metadata/throw-marker.js`
  expect `odw/meta-statically-unprovable`.

The rule catalogue already contains the relevant rule identifiers, default
severities, messages, documentation slugs, and release statuses in
`src/diagnostics/rule-catalogue.ts`.

## Research notes

GrepAI was used first, as required:

```sh
grepai search --workspace 'Projects' --project 'odw-lint' \
  "runtime invalid metadata classification workflow meta diagnostics" --toon --compact --limit 8
grepai search --workspace 'Projects' --project 'odw-lint' \
  "runtime invalid workflow metadata classification diagnostics" --toon --compact --limit 10
grepai search --workspace 'Projects' --project 'odw-lint' \
  "pure literal metadata parser fixture diagnostics" --toon --compact --limit 10
```

The current useful hits were `docs/rules/meta-required.md`,
`docs/rules/meta-statically-unprovable.md`, `docs/rules/meta-object.md`, and
`docs/execplans/roadmap-2-1-7.md`. Earlier planning-round searches also found
`docs/technical-design.md`, `docs/roadmap.md`, invalid fixture manifests, and
prior ExecPlans for tasks 1.3.2, 1.3.4, 2.1.2, and 2.1.6. Because GrepAI
indexes `main`, every source and fixture claim above was verified directly
inside this rebased worktree with Leta, exact text search, or file inspection.

The ODW reference checkout at
`../open-dynamic-workflows` was inspected as the source-backed
runtime reference:

- `src/loader.ts` lines 302-347 show the runtime extraction path. It finds
  `export const meta`, looks for an object brace, matches braces, evaluates the
  original slice with `new Function`, validates metadata, rejects extra imports
  or exports, and returns the stripped body.
- `src/loader.ts` lines 456-466 show runtime metadata validation: metadata must
  be an object, `meta.name` must be a non-empty string, and
  `meta.description` must be a string.
- `src/dual-compat.ts` lines 1-17 explain the pure-literal portability
  boundary: Claude reads metadata statically, while ODW's loader is lenient.
- `src/dual-compat.ts` lines 64-229 show the current pure-literal grammar:
  object and array literals with strings, numbers, booleans, and null; variables,
  calls, spreads, operators, computed property keys, and template interpolation
  are impure.

Firecrawl tool discovery in this session exposed `firecrawl_scrape`,
`firecrawl_map`, `firecrawl_agent`, `firecrawl_interact`, and
`firecrawl_parse`, but not `firecrawl_search` or
`firecrawl_search_feedback`. The available Firecrawl scrape tool was therefore
used against the known official TypeScript documentation URL
<https://www.typescriptlang.org/docs/handbook/compiler-options.html>. It
confirmed the official CLI contract that local `tsc` compiles the closest
`tsconfig.json`, and that `--noEmit`, `--strict`,
`--noUncheckedIndexedAccess`, `--exactOptionalPropertyTypes`, and
`--noPropertyAccessFromIndexSignature` are documented compiler options. The
locked repository gate uses `bun run check:types`, which delegates to
`bunx tsc --noEmit` in `package.json` and `Makefile`.

This plan does not lean on the TypeScript compiler API or any external parser
library for metadata classification. The locked dependency evidence is:

- `bun.lock` resolves `typescript@5.9.3`,
  `@biomejs/biome@2.5.1`, `oxlint@1.71.0`,
  `fast-check@4.8.0`, and `bun-types@1.3.14`.
- `package.json` scripts define `bun test`, `bunx tsc --noEmit`, Biome, and
  Oxlint command shapes.
- `Makefile` defines `make all`, `make markdownlint`, `make nixie`, and
  `make branch-freshness`; `make all` does not include branch freshness.

## Plan of work

### Pre-work: Refresh branch baseline and re-check task scope

Purpose: ensure implementation starts from current `origin/main`, because
roadmap task branches can become stale even when `make all` passes.

Documentation to read before acting:

- `docs/developers-guide.md` "Commit Gate" for the `make branch-freshness`
  contract.
- `docs/roadmap.md` task 2.1.3 and the surrounding 2.1 task list.
- `docs/execplans/roadmap-2-1-7.md` if branch freshness reports relevant
  diagnostic-test changes from main.

Skills to load:

- `execplans`
- `grepai`
- `leta`
- `sem`

Implementation steps:

1. From `<assigned-worktree>`, run:

   ```sh
   git status --short --branch
   git fetch origin main
   sem diff --from HEAD --to origin/main
   ```

2. If the branch is behind `origin/main`, run:

   ```sh
   git rebase origin/main
   ```

3. Re-run:

   ```sh
   git status --short --branch
   sem diff --from HEAD --to origin/main
   ```

   Expected result before implementation work begins: the status line is
   `## roadmap-2-1-3...origin/main` with only intended local changes, and
   `sem diff --from HEAD --to origin/main` reports no changes.
4. Re-check task scope against any changed roadmap, ExecPlan, diagnostic, or
   fixture files listed by `sem diff`. If the upstream changes affect
   metadata-classification scope, update this ExecPlan before adding code.
5. Run:

   ```sh
   make branch-freshness
   ```

   It should pass before review. If it fails because the worktree is dirty,
   finish or park the current work-item changes first; if it fails because the
   branch is stale, return to step 1.

Tests to add:

- None. This pre-work validates repository state, not product behaviour.

Validation:

- `make branch-freshness` passes before review.

### Work item 1: Add the metadata fact model and static literal parser

Purpose: create the internal parser and immutable fact shape without emitting
new diagnostics yet. This keeps parser correctness reviewable before the
diagnostic layer is added.

Documentation to read before editing:

- `docs/roadmap.md` lines 293-326 for task 2.1.3 scope and success.
- `docs/technical-design.md` §§5, 6.2, 6.3, 6.4, and 9.1.
- `docs/developers-guide.md` "Static-Analysis Boundary", "Workflow envelope
  scanner", and "Source-span helpers".
- `docs/adr/0001-static-analysis-boundary.md` "Decision" and "Consequences".
- `../open-dynamic-workflows/src/dual-compat.ts` lines
  64-229 for the pure-literal grammar behaviour to mirror by tests.

Skills to load:

- `execplans`
- `grepai`
- `leta`
- `biome-typescript`
- `en-gb-oxendict-style`

Implementation steps:

1. Add `src/static-analysis/workflow-metadata.ts`.
2. Define an internal parsed-value model that preserves both value and source
   span. Use small named types such as `ParsedMetadataObject`,
   `ParsedMetadataProperty`, and `ParsedMetadataValue`.
3. Define `WorkflowMetadataFacts` with at least `name`, `description`,
   `portability`, and `properties`. `portability` should include
   `"pure-literal"` and `"not-statically-provable"`; do not expose
   `odw/claude-pure-meta` diagnostics yet.
4. Implement `parseWorkflowMetadataLiteral(sourceFile, envelope)` for
   `WorkflowMetaValue.kind === "object"`. It should parse only the metadata span
   already found by the envelope scanner.
5. Support object literals, array literals, string literals with single,
   double, and no-interpolation template quotes, number literals, booleans,
   null, unquoted identifier keys, string keys, numeric keys, nested objects,
   nested arrays, comments, whitespace, and trailing commas.
6. Return a structured unprovable result with the exact offending expression
   span for variables, calls, arithmetic, spread, computed property keys,
   shorthand properties, methods, accessors, template interpolation, and
   unterminated strings.
7. Keep all parser helpers small. If one helper grows beyond about 50 lines or
   combines scanning and classification, split it before committing.

Tests to add:

- Add `tests/static-analysis/workflow-metadata.test.ts`.
- Unit tests must cover pure object parsing, single-quoted strings, arrays of
  phase objects, comments, trailing commas, nested object values, and escaped
  strings.
- Unit tests must cover the first unprovable span for
  `"Computed " + "description."`, an IIFE value, a spread property, a computed
  key, a shorthand property, and a template interpolation.
- Add a Unicode-before-value test proving reported value spans use UTF-8 byte
  offsets through source-span helpers.
- Add a runtime-freeze test for parser result objects and arrays.

Validation:

1. Red: create the tests first, then run:

   ```sh
   bun test tests/static-analysis/workflow-metadata.test.ts
   ```

   Expect failure because `src/static-analysis/workflow-metadata.ts` does not
   exist yet or the parser is not implemented.
2. Green: implement the parser and rerun the same command. Expect all tests in
   `workflow-metadata.test.ts` to pass.
3. Format only changed files:

   ```sh
   bunx @biomejs/biome format --write src/static-analysis/workflow-metadata.ts tests/static-analysis/workflow-metadata.test.ts
   mdtablefix docs/execplans/roadmap-2-1-3.md
   markdownlint-cli2 --fix docs/execplans/roadmap-2-1-3.md
   ```

4. Gate:

   ```sh
   make all
   make markdownlint
   make nixie
   ```

### Work item 2: Emit runtime-invalid metadata diagnostics

Purpose: map parser and envelope states to the hard ODW runtime-invalid
metadata rules: `odw/meta-object`, `odw/meta-name`, and
`odw/meta-description`.

Documentation to read before editing:

- `docs/technical-design.md` §6.3 and §9.1.
- `docs/rules/meta-object.md`, `docs/rules/meta-name.md`, and
  `docs/rules/meta-description.md`.
- `docs/terms-of-reference.md` §§6-9.
- ODW loader source at
  `../open-dynamic-workflows/src/loader.ts` lines 302-347
  and 456-466.

Skills to load:

- `execplans`
- `grepai`
- `leta`
- `biome-typescript`
- `en-gb-oxendict-style`

Implementation steps:

1. In `src/static-analysis/workflow-metadata.ts`, add
   `classifyWorkflowMetadata(scanResult)` or the smallest equivalent exported
   function. The function should accept `WorkflowEnvelopeScanResult` so it can
   respect missing-meta envelope results without duplicating the existing
   `odw/meta-required` diagnostic.
2. For `WorkflowMetaValue.kind === "missing-value"`, emit `odw/meta-object`
   with message `Workflow metadata must be an object literal.`. Use the
   missing-value span.
3. For `WorkflowMetaValue.kind === "non-object-expression"`, classify the
   expression by inspecting only the already-recorded metadata expression span:
   if that expression contains no real `{` character in code, emit
   `odw/meta-object` with message
   `Workflow metadata must be an object literal.` and use the full expression
   span. This covers statically proven primitives such as strings, numbers,
   booleans, `null`, arrays with no object literal, and identifiers or calls
   with no object-literal argument.
4. For `WorkflowMetaValue.kind === "non-object-expression"` where the metadata
   expression span contains a real `{` character in code, do not emit
   `odw/meta-object`. Return a structured classification result that work item
   3 will turn into `odw/meta-statically-unprovable`. This covers expressions
   such as `makeMeta({ ... })`, `condition ? { ... } : { ... }`, `({ ... })`,
   and arrays containing object literals. The point of the rule is not that
   ODW definitely accepts every example; it is that `odw-lint` cannot prove the
   runtime result without executing source, and ADR 0001 forbids doing so.
5. For `WorkflowMetaValue.kind === "unterminated-object"`, emit
   `odw/meta-object` with message
   `Workflow metadata object literal must be complete.` and the unterminated
   object span.
6. For parsed object metadata, emit `odw/meta-name` with message
   `Workflow metadata must include a non-empty name string.` when `name` is
   missing, empty, or not a string. Use the value span when a property exists;
   use the whole metadata object span when the property is missing.
7. Emit `odw/meta-description` with message
   `Workflow metadata must include a description string.` when the property is
   missing. Use the whole object span.
8. Emit `odw/meta-description` with message
   `Workflow metadata description must be a string.` when the property exists
   but is not a string. Use the property value span.
9. Return frozen diagnostics and frozen classification facts. Use the catalogue
   severities and messages exactly.
10. Do not emit `odw/meta-statically-unprovable` in this work item except
    where tests from work item 1 require a structured parser result. Work item
    3 owns the diagnostic.

Tests to add or update:

- Extend `tests/static-analysis/workflow-metadata.test.ts` with table-driven
  unit tests for non-object expression, missing value, unterminated object,
  missing `name`, empty `name`, numeric `name`, missing `description`, numeric
  `description`, and empty string `description` accepted.
- Include explicit split tests for `export const meta = "not an object";`
  producing `odw/meta-object`, and `export const meta = makeMeta({ name:
  "n", description: "d" });` producing a structured unprovable
  classification with no `odw/meta-object` diagnostic in work item 2.
- Add semantic assertions for rule, severity, message, and span text.
- Add a combined-diagnostics helper in tests that concatenates envelope
  diagnostics with metadata diagnostics, but keep production pipeline wiring
  minimal.

Validation:

1. Red: add tests first and run:

   ```sh
   bun test tests/static-analysis/workflow-metadata.test.ts
   ```

   Expect the new runtime-invalid cases to fail because no diagnostics are
   emitted yet.
2. Green: implement classification and rerun the focused test command. Expect
   it to pass.
3. Format only changed files:

   ```sh
   bunx @biomejs/biome format --write src/static-analysis/workflow-metadata.ts tests/static-analysis/workflow-metadata.test.ts
   mdtablefix docs/execplans/roadmap-2-1-3.md
   markdownlint-cli2 --fix docs/execplans/roadmap-2-1-3.md
   ```

4. Gate:

   ```sh
   make all
   make markdownlint
   make nixie
   ```

### Work item 3: Emit statically unprovable metadata diagnostics without execution

Purpose: convert parser unprovable results into
`odw/meta-statically-unprovable` warnings and prove hostile metadata remains
passive.

Documentation to read before editing:

- `docs/technical-design.md` §6.3, §6.4, §9.1, and §11.3.
- `docs/rules/meta-statically-unprovable.md`.
- `docs/issues/audit-1.3.4.md` lines 166-170 for the later hostile regression
  dependency.
- `docs/execplans/roadmap-1-3-4.md` Decision Log around hostile metadata
  fixture expectations.

Skills to load:

- `execplans`
- `grepai`
- `leta`
- `biome-typescript`
- `en-gb-oxendict-style`

Implementation steps:

1. Extend `classifyWorkflowMetadata` so a parser result with portability
   `"not-statically-provable"` emits one `odw/meta-statically-unprovable`
   warning.
2. Also emit `odw/meta-statically-unprovable` for
   `WorkflowMetaValue.kind === "non-object-expression"` when the expression
   contains a real object literal in code. Use the first `{`-bearing computed
   expression span that made the value unprovable, not a later body span.
3. Use the parser's first offending expression span as the diagnostic span.
4. Use the exact catalogue message
   `Workflow metadata must remain statically provable without evaluation.`
5. Ensure the runtime-invalid diagnostics from work item 2 still win for
   missing or malformed object structure. For example, an unterminated object is
   `odw/meta-object`, not `odw/meta-statically-unprovable`.
6. Add a test that clears
   `globalThis.__odwLintHostileMetadataWasEvaluated`, classifies
   `hostile-metadata/global-marker.js` by reading it as text, and asserts the
   marker stays unset. This remains a classifier-level passive-source test;
   task 2.1.5 owns the future real lint-path side-effect regression.
7. Add a test for `hostile-metadata/throw-marker.js` that classification
   returns a warning instead of throwing the fixture's embedded error.
8. Add a negative test that a pure literal metadata object with valid required
   fields returns no metadata diagnostics.

Tests to add or update:

- Extend `tests/static-analysis/workflow-metadata.test.ts` with unprovable
  diagnostic tests for computed string concatenation and both hostile metadata
  fixtures.
- Add unprovable diagnostic tests for `makeMeta({ name: "n", description:
  "d" })`, `condition ? { name: "n", description: "d" } : fallback`, and
  `({ name: "n", description: "d" })`. These pin the ODW loader evidence that
  such expressions are not blanket `odw/meta-object` cases.
- Add one test that classification does not emit `odw/claude-pure-meta`.
- Keep `tests/static-analysis/invalid-workflow-fixtures.test.ts` unchanged in
  this work item; manifest-level wiring belongs to work item 4.

Validation:

1. Red: add tests first and run:

   ```sh
   bun test tests/static-analysis/workflow-metadata.test.ts
   ```

   Expect the computed and hostile cases to fail because the warning is not
   emitted yet.
2. Green: implement the warning classification and rerun the focused command.
   Expect it to pass and the hostile marker to remain unset.
3. Format only changed files:

   ```sh
   bunx @biomejs/biome format --write src/static-analysis/workflow-metadata.ts tests/static-analysis/workflow-metadata.test.ts
   mdtablefix docs/execplans/roadmap-2-1-3.md
   markdownlint-cli2 --fix docs/execplans/roadmap-2-1-3.md
   ```

4. Gate:

   ```sh
   make all
   make markdownlint
   make nixie
   ```

### Work item 4: Wire classifier coverage through invalid fixture manifests and public exports

Purpose: prove the production classifier matches the committed invalid fixture
manifest contracts and expose the completed metadata classification API through
the repository's current private package facade.

Documentation to read before editing:

- `docs/developers-guide.md` "Static-Analysis Boundary", "Fixture corpus", and
  "Commit Gate".
- `docs/technical-design.md` §11.1 and §11.2.
- `docs/rules/index.md` and the individual metadata rule pages.
- `tests/static-analysis/fixtures/invalid-workflows/manifests/*.ts`.

Skills to load:

- `execplans`
- `grepai`
- `leta`
- `biome-typescript`
- `en-gb-oxendict-style`

Implementation steps:

1. Export the completed metadata classifier and public fact types from
   `src/static-analysis/index.ts`.
2. Re-export those names from `src/index.ts` only after the classifier contract
   is complete and covered by tests.
3. Update public API fixture tests if the repository pins named package
   exports. Do not remove any existing public export.
4. In `tests/static-analysis/invalid-workflow-fixtures.test.ts`, add a
   task-owned parity test that reads every invalid workflow fixture as text,
   runs `createOriginalSourceFile`, `scanWorkflowEnvelope`, and
   `classifyWorkflowMetadata`, then concatenates envelope diagnostics with
   metadata diagnostics.
5. Filter both the produced diagnostics and each fixture's
   `expectedDiagnostics` to this exact task-owned rule set before comparing:
   `odw/meta-required`, `odw/meta-object`,
   `odw/meta-statically-unprovable`, `odw/meta-name`,
   `odw/meta-description`, and `odw/no-import-export`.
6. Compare the filtered diagnostics for rule, severity, message, span, and
   span text. This means syntax-error fixtures compare `[]` to `[]` in this
   task because their existing `odw/body-syntax` expectations are owned by the
   body parser slice. Do not invent body-syntax handling here.
7. Assert separately that the unfiltered fixture manifests still contain the
   deferred `odw/body-syntax` expectations for the `syntax-error` family, so
   this task cannot silently delete them to make filtered parity pass.
8. Run `make refresh-fixtures` only if a manifest span or generated manifest is
   intentionally changed. The expected path is that no fixture source or
   generated manifest changes are needed because manifests already pin task
   2.1.3 diagnostics.

Tests to add or update:

- Update `tests/static-analysis/invalid-workflow-fixtures.test.ts` with the
  filtered manifest parity test described above.
- Update public API tests under `tests/diagnostics/` if new package exports are
  part of the final classifier surface.
- Add or update snapshots only when the reviewed output contract intentionally
  changes.

Validation:

1. Red: add manifest parity and public export tests first, then run:

   ```sh
   bun test tests/static-analysis/invalid-workflow-fixtures.test.ts tests/diagnostics/public-api-surface.test.ts tests/diagnostics/public-consumer.test.ts
   ```

   Expect failure because the classifier is not exported or because the
   task-owned filtered fixture parity path is not wired yet.
2. Green: update exports and fixture parity wiring, then rerun the same focused
   command. Expect all listed tests to pass.
3. If fixture manifests are intentionally refreshed, run:

   ```sh
   make refresh-fixtures
   ```

   Inspect the JSON report and keep only task-owned changes.
4. Format only changed TypeScript files. Use only paths actually edited in this
   work item. A typical command is:

   ```sh
   bunx @biomejs/biome format --write \
     src/static-analysis/index.ts \
     src/index.ts \
     tests/static-analysis/invalid-workflow-fixtures.test.ts \
     tests/diagnostics/public-api-surface.test.ts \
     tests/diagnostics/public-consumer.test.ts
   ```

   If one of those optional public API test files is not edited, omit it from
   the command.
5. Format the ExecPlan:

   ```sh
   mdtablefix docs/execplans/roadmap-2-1-3.md
   markdownlint-cli2 --fix docs/execplans/roadmap-2-1-3.md
   ```

6. Gate:

   ```sh
   make all
   make markdownlint
   make nixie
   ```

### Work item 5: Update documentation contents, roadmap, and completion notes

Purpose: keep the source-of-truth documentation aligned with the implemented
metadata classifier and close the roadmap task without pulling later Claude
compatibility work forward.

Documentation to read before editing:

- `docs/documentation-style-guide.md`.
- `docs/developers-guide.md` "Documentation Upkeep".
- `docs/contents.md`, especially the opening contract that it is the canonical
  index and must be updated whenever a standalone documentation file is added,
  renamed, or removed.
- `docs/roadmap.md` task 2.1.3 and task 3.1.1.
- `docs/technical-design.md` §§6.3, 6.4, 9.1, 9.2, and 11.
- The metadata rule pages under `docs/rules/`.

Skills to load:

- `execplans`
- `grepai`
- `leta`
- `biome-typescript`
- `en-gb-oxendict-style`

Implementation steps:

1. Update `docs/developers-guide.md` to replace the statement that metadata
   field diagnostics are deferred to task 2.1.3 with the new implemented
   classifier surface, file ownership, and test entry points.
2. Update `docs/technical-design.md` only if implementation introduces a
   materially different contract from the current design. Do not churn the
   design merely to restate code.
3. Update rule pages only if implementation reveals stale public wording. Keep
   `odw/claude-pure-meta` wording aligned with roadmap task 3.1.1.
4. Add `docs/execplans/roadmap-2-1-3.md` to the "Execution plans" section in
   `docs/contents.md`, in the same style and stable roadmap ordering as the
   surrounding entries. This is required because this task adds a new
   standalone ExecPlan.
5. Mark roadmap task 2.1.3 complete in `docs/roadmap.md` with a concise
   completion note. Do not mark task 2.1.5 or 3.1.1 complete.
6. Update this ExecPlan's `Progress`, `Decision Log`, `Outcomes &
   Retrospective`, and revision note.

Tests to add or update:

- If documentation tables or rule pages change, rely on existing
  `tests/diagnostics/rule-catalogue-docs.test.ts` and Markdown gates.
- No new code tests are required in this work item unless docs changes expose a
  stale docs-code parity assertion.

Validation:

1. Format only changed Markdown files. Include only the files actually edited.
   A typical command is:

   ```sh
   mdtablefix docs/execplans/roadmap-2-1-3.md docs/contents.md docs/developers-guide.md docs/roadmap.md
   markdownlint-cli2 --fix docs/execplans/roadmap-2-1-3.md docs/contents.md docs/developers-guide.md docs/roadmap.md
   ```

   If `docs/developers-guide.md` is not edited, omit it. If
   `docs/technical-design.md` or rule pages are edited, add them to both
   commands. If they are not edited, omit them. Keep `docs/contents.md` in the
   command list whenever it is edited for the new standalone ExecPlan entry.
2. Run the documentation and full gates:

   ```sh
   make all
   make markdownlint
   make nixie
   ```

## Concrete steps

Start every implementation session from the assigned worktree:

```sh
cd <assigned-worktree>
git status --short --branch
git fetch origin main
sem diff --from HEAD --to origin/main
```

Expected status before implementation starts:

```plaintext
## roadmap-2-1-3...origin/main
?? docs/execplans/roadmap-2-1-3.md
```

If `git status --short --branch` shows `[behind N]`, rebase before adding code:

```sh
git rebase origin/main
git status --short --branch
sem diff --from HEAD --to origin/main
```

After the rebase, re-read `docs/roadmap.md`,
`docs/execplans/roadmap-2-1-7.md`, and any diagnostic or fixture tests listed
by `sem diff --from HEAD --to origin/main` before proceeding. In planning round
2, the branch was behind one commit; rebasing made `sem diff --from HEAD --to
origin/main` report no changes.

For each work item:

1. Re-read the work item's documentation list and load the listed skills.
2. Re-run the relevant GrepAI search if the implementation surface has drifted.
3. Try Leta for symbol navigation. If it fails in the implementation session,
   record the exact command and fallback in `Surprises & Discoveries`.
4. Add the red tests first and run the focused red command.
5. Implement the smallest production change that makes the focused tests pass.
6. Format only changed files.
7. Run the focused tests, `make all`, `make markdownlint`, and `make nixie`.
8. Before review, run `make branch-freshness`. If it fails because the branch
   is stale, rebase and re-run the affected focused tests and gates.
9. Update this ExecPlan's living sections.
10. Commit the single work item with a clear imperative commit message.

Do not begin implementation until the plan is approved by the supervising
workflow.

## Validation and acceptance

The final accepted implementation must satisfy all of the following:

- `bun test tests/static-analysis/workflow-metadata.test.ts` passes and covers
  pure literal parsing, runtime-invalid metadata, unprovable metadata, hostile
  metadata, Unicode spans, frozen results, and no `odw/claude-pure-meta`
  emission.
- `bun test tests/static-analysis/invalid-workflow-fixtures.test.ts` passes and
  proves the classifier matches committed invalid fixture expectations for the
  task-owned metadata and envelope rule set while preserving deferred
  `odw/body-syntax` expectations.
- Any public export tests touched in `tests/diagnostics/` pass.
- `make all` passes.
- `make markdownlint` passes.
- `make nixie` passes.
- `make branch-freshness` passes before review.

The main behaviour to observe is:

- a workflow with `export const meta = "not an object";` reports
  `odw/meta-object`;
- a workflow with `export const meta = { description: "d" };` reports
  `odw/meta-name`;
- a workflow with `export const meta = { name: "n" };` reports
  `odw/meta-description`;
- a workflow with
  `export const meta = { name: "n", description: "a" + "b" };` reports
  `odw/meta-statically-unprovable`;
- a workflow with
  `export const meta = makeMeta({ name: "n", description: "d" });` reports
  `odw/meta-statically-unprovable`, not `odw/meta-object`;
- hostile metadata fixture classification returns a warning and leaves
  `globalThis.__odwLintHostileMetadataWasEvaluated` unset; and
- no task 2.1.3 test expects or emits `odw/claude-pure-meta`.

## Idempotence and recovery

All implementation commands are safe to rerun from the assigned worktree. If a
focused Bun test fails, fix the scoped work item before running broader gates.
If `make refresh-fixtures` changes generated manifests unexpectedly, inspect
the JSON report and `git diff`; keep only task-owned fixture metadata changes.

If mutating formatters or fixture refreshes create unrelated churn, do not
commit it. If it must be parked temporarily, use a named stash:

```sh
git stash push -m 'df12-stash v1 task=2.1.3 kind=discard reason="park unrelated formatter churn"'
```

Do not use a bare `git stash`.

## Artifacts and notes

Important source paths:

- `src/static-analysis/workflow-envelope.ts`
- `src/static-analysis/workflow-metadata.ts`
- `src/static-analysis/types.ts`
- `src/static-analysis/index.ts`
- `src/index.ts`
- `tests/static-analysis/workflow-metadata.test.ts`
- `tests/static-analysis/invalid-workflow-fixtures.test.ts`
- `tests/static-analysis/fixtures/invalid-workflows/`
- `src/diagnostics/rule-catalogue.ts`
- `docs/contents.md`
- `docs/rules/meta-object.md`
- `docs/rules/meta-name.md`
- `docs/rules/meta-description.md`
- `docs/rules/meta-statically-unprovable.md`

Planning command evidence:

```plaintext
grepai version 0.35.0
Workspace: Projects ... odw-lint: <control-worktree> ✓
## roadmap-2-1-3...origin/main [behind 1]
sem diff --from HEAD --to origin/main
Summary: 9 added, 3 modified across 4 files
git fetch origin main && git rebase origin/main
Successfully rebased and updated refs/heads/roadmap-2-1-3.
sem diff --from HEAD --to origin/main
No changes detected.
leta files src/
src/static-analysis/workflow-envelope.ts (10.1KB, 308 lines)
leta files tests/
tests/static-analysis/invalid-workflow-fixtures.test.ts (12.0KB, 323 lines)
```

## Interfaces and dependencies

The intended production interface is:

```ts
export type WorkflowMetadataPortability =
  | "pure-literal"
  | "not-statically-provable";

export type WorkflowMetadataClassification =
  | {
      readonly status: "not-applicable";
      readonly diagnostics: readonly Diagnostic[];
    }
  | {
      readonly status: "valid";
      readonly facts: WorkflowMetadataFacts;
      readonly diagnostics: readonly Diagnostic[];
    }
  | {
      readonly status: "runtime-invalid";
      readonly diagnostics: readonly Diagnostic[];
    }
  | {
      readonly status: "statically-unprovable";
      readonly diagnostics: readonly Diagnostic[];
    };

export const classifyWorkflowMetadata = (
  scanResult: WorkflowEnvelopeScanResult,
) => WorkflowMetadataClassification;
```

`WorkflowMetadataFacts` should include parsed `name`, parsed `description`,
the metadata object span, and portability. It may include additional internal
property facts if that keeps diagnostics clear and tests small.

Use existing project modules:

- `makeRuleId` from `src/diagnostics/rule-id.ts`.
- `Diagnostic` and `SourceSpan` from `src/diagnostics/types.ts`.
- `sliceSourceSpan`, `spanFromOffsets`, or internal source-position helpers
  only where needed to derive spans from the same `OriginalSourceFile`.
- `WorkflowEnvelopeScanResult`, `WorkflowEnvelope`, and `WorkflowMetaValue`
  from `src/static-analysis/types.ts`.

Do not use external runtime libraries for metadata parsing. Do not import from
`open-dynamic-workflows` in production code. Tests may read trusted fixture
source as text; they must not import hostile workflow files.

## Revision note

Initial planning-round draft. It decomposes roadmap task 2.1.3 into five
atomic, gateable work items; records ODW loader and dual-compat research; and
fixes the `odw/claude-pure-meta` boundary by deferring user-visible emission to
roadmap task 3.1.1 while routing computed metadata to
`odw/meta-statically-unprovable` in this task.

Planning round 2 revision. It rebases the assigned worktree onto current
`origin/main`, adds mandatory branch-refresh and `make branch-freshness`
pre-work, distinguishes proven non-object metadata from computed expressions
that contain object literals under ODW's first-brace loader boundary, and
replaces the previous all-fixtures parity requirement with an exact filtered
metadata/envelope rule contract that leaves `odw/body-syntax` to the deferred
body parser slice.

Planning round 3 revision. It adds `docs/contents.md` to work item 5's
documentation closeout scope because `docs/contents.md` requires every new
standalone documentation file to be listed. The file-scoped Markdown formatter
and fixer command examples now include `docs/contents.md` whenever that file is
edited.
