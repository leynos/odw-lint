# Consolidate SWC AST guard and traversal helpers

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint` checks Open Dynamic Workflows (ODW) workflow source before any
workflow runs. Several parser-backed rules walk the SWC (a Rust-based
JavaScript/TypeScript compiler exposed through `@swc/core`) abstract syntax tree
(AST) of a normalized workflow body. Today each of those rule modules privately
re-implements the same three low-level shape helpers:

1. a guard that decides whether an unknown value is a parser node
   (`typeof value === "object" && value !== null && "type" in value`);
2. an object-record guard used to descend into wrapper objects that are not
   themselves nodes; and
3. a child-traversal primitive that yields a node's semantic child fields while
   skipping the bookkeeping fields `span`, `type`, and `ctxt`.

These copies have already begun to drift (for example
`workflow-deterministic-time.ts` names its object guard `isObjectRecord` and
returns `value is object`, while `value-guards.ts` owns an equivalent
`isUnknownRecord` that returns `value is UnknownRecord`). Divergent copies of a
security-boundary traversal are a maintenance and correctness hazard: a fix or
hardening applied to one copy silently misses the others.

After this change a reader can see one documented SWC-shape helper seam
(`src/static-analysis/swc-ast.ts`) that owns `isAstNode` and `astChildValues`
and re-exports the shared object-record guard, and every parser-backed rule
(deterministic-time scanner, deterministic-time alias collector, global-object
resolver) plus the AST-fact binding collector consume that single seam. Success
is observable as: (a) the seam module exists and is unit- and property-tested;
(b) the three duplicate guard/traversal implementations are deleted from the
rule modules and imported from the seam instead; and (c) **no rule output
changes** — the existing behavioural tests and the checked-in snapshots
(`tests/static-analysis/__snapshots__/deterministic-time-spans.test.ts.snap` and
`tests/static-analysis/__snapshots__/workflow-ast-facts.test.ts.snap`) pass
byte-for-byte without regeneration.

This is roadmap task 3.2.5 in [docs/roadmap.md](../roadmap.md) (step 3.2, "Add
first orchestration-risk rules"). It requires roadmap tasks 2.2.4 and 3.1.4,
both already complete on `main`.

## Constraints

Hard invariants that must hold throughout implementation. Violation requires
escalation, not a workaround.

- **No rule output changes.** Diagnostics emitted by
  `scanDeterministicTimeWarnings`, `collectWorkflowAstFacts`,
  `collectLexicalBindings`, and `resolveGlobalObjectIdentity` must be identical
  before and after. The two checked-in snapshots above must pass **without**
  `--update-snapshots`. This is the roadmap success criterion.
- **Owned SWC parser boundary.** Per
  [docs/adr/0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md),
  `odw-lint` owns its SWC-based static analysis. Do not import any ODW runtime
  helper, `loadWorkflowScript`, `createPrimitives`, or `validate(source)` path
  into production code. The new seam must depend only on `@swc/core` types and
  local static-analysis modules.
- **ECMAScript dialect scope.** Per
  [docs/adr/0002-workflow-body-parser-dialect-scope.md](../adr/0002-workflow-body-parser-dialect-scope.md),
  workflow bodies are parsed as ECMAScript (`syntax: "ecmascript"`, `jsx:
  false`). Do not add TypeScript-only node handling (for example
  `TsAsExpression`) to the seam; the existing resolver deliberately handles only
  `ParenthesisExpression` and `OptionalChainingExpression` wrappers.
- **File-size and lint gates.** Every touched TypeScript file must stay ≤ 400
  physical lines (`tests/build-gate/file-size.test.ts`,
  `SOURCE_AND_TEST_LINE_LIMIT = 400`). Oxlint enforces cyclomatic complexity
  ≤ 8, `max-depth` ≤ 3, `df12/complex-conditional` (`maxLogicalOperators: 1`,
  `includeTernary: true`), and mandatory `@file`/public/private JSDoc
  (`.oxlintrc.json`). The extracted `isAstNode` reuses the identical boolean
  expression already accepted by these gates on `main`, so it must not add
  logical operators beyond that expression.
- **Public API surface unchanged.** Do not add the internal seam to the
  `src/static-analysis/index.ts` barrel or to `src/index.ts`. It is an internal
  helper, mirroring how `workflow-global-object-reference.ts` is internal.
- **Architecture module registry must be kept exact.**
  `tests/diagnostics/architecture.test.ts` asserts the exact sorted file set of
  `src/static-analysis/` against
  `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` in
  `tests/diagnostics/architecture-fixtures.ts`. Adding `swc-ast.ts` requires
  adding it to that fixture list in the same commit.

## Tolerances (exception triggers)

- **Scope:** if consolidation requires touching more than 8 production files or
  changing more than roughly 250 net lines, stop and escalate.
- **Snapshot drift:** if either protected snapshot changes at all, stop
  immediately. A snapshot delta means behaviour changed; do not regenerate the
  snapshot to make it pass.
- **Interface:** if any exported symbol in `src/static-analysis/index.ts` or
  `src/index.ts` must change signature, stop and escalate.
- **Dependencies:** if a new runtime dependency is required, stop and escalate
  (none is expected).
- **Type-guard soundness:** if replacing a local `value is Expression` /
  `value is Node` guard forces a TypeScript compile error that cannot be
  resolved with a one-line delegating predicate wrapper, stop and escalate
  rather than casting through `any` or widening a public signature.
- **Iterations:** if `make all` still fails after 3 focused attempts on a single
  work item, stop and escalate.

## Risks

- Risk: The object-record guard `isObjectRecord` in
  `workflow-deterministic-time.ts` returns `value is object` and accepts arrays
  (`typeof === "object" && !== null`), whereas the shared `isUnknownRecord`
  excludes arrays. Swapping could change traversal.
  Severity: medium
  Likelihood: low
  Mitigation: In `visitChildValue`, arrays are handled by an earlier
  `Array.isArray(value)` branch, so `isObjectRecord` only ever receives
  non-arrays; the two predicates are therefore equivalent at that call site. Pin
  this with a focused regression test that nests a hazard inside a record
  wrapper AND inside an array, proving both still resolve after the swap (see
  Work Item 3).
- Risk: `workflow-ast-bindings.ts` uses a looser `asNode`
  (`typeof value !== "object"` rejects only primitives, so it accepts arrays)
  rather than the strict `isAstNode`. Forcing it onto `isAstNode` (which
  requires a `type` field) or onto `isUnknownRecord` (which rejects arrays)
  could change binding collection.
  Severity: medium
  Likelihood: low
  Mitigation: Migrate only the object-record aspect of `asNode` to reuse
  `isUnknownRecord`, and verify by inspection plus test that `asNode` is never
  called with an array (arrays reach the collector through `arrayValue`, and the
  child recursion branches on `Array.isArray` first). Keep the
  `Object.values`-based child recursion (`collectChildBindings`) as-is; it is a
  deliberately broader traversal than the rule seam's `astChildValues` and must
  not be folded in (avoid over-abstraction per the complexity guide). Pin with
  `workflow-ast-bindings.test.ts` and the `workflow-ast-facts` snapshot.
- Risk: Replacing local `isExpression`/`isNode` guards that return
  `value is Expression` with a seam guard returning `value is Node` produces
  TypeScript assignability errors where a helper is declared to return
  `Expression | undefined`.
  Severity: low
  Likelihood: medium
  Mitigation: Keep a one-line local delegating predicate
  (`const isExpression = (value: unknown): value is Expression =>
  isAstNode(value);`). This matches the pattern already present in
  `workflow-deterministic-time-aliases.ts` (its `isExpression` delegates to its
  local `isNode`). Runtime logic then lives once in the seam; the wrapper only
  re-narrows the type for local ergonomics.
- Risk: Adding `swc-ast.ts` without registering it breaks the architecture
  module-set test.
  Severity: low
  Likelihood: medium (easy to forget)
  Mitigation: Update `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` in the same commit
  as the file is created (Work Item 1).

## Progress

- [x] Work Item 1: Add the shared SWC-shape helper seam (`swc-ast.ts`) with
  tests and architecture registration.
- [x] Work Item 2: Migrate `workflow-deterministic-time-aliases.ts` to the seam.
- [x] Work Item 3: Migrate `workflow-deterministic-time.ts` to the seam.
- [x] Work Item 4: Migrate `workflow-global-object-reference.ts` to the seam.
- [x] Work Item 5: Migrate the `workflow-ast-bindings.ts` object-record guard to
  the seam.
- [x] Work Item 6: Document the seam and tick roadmap task 3.2.5.

## Surprises & discoveries

- Observation: `workflow-deterministic-time.ts` and
  `workflow-deterministic-time-aliases.ts` contain byte-for-byte identical
  child-traversal helpers (`childValues` filtering `span`/`type`/`ctxt`).
  Evidence: `src/static-analysis/workflow-deterministic-time.ts:147-156` and
  `src/static-analysis/workflow-deterministic-time-aliases.ts:231-236`.
  Impact: This pair is the clearest, lowest-risk consolidation target and is
  migrated first (Work Items 2-3).
- Observation: Work Item 1's first red run failed before reaching the intended
  missing-module error because dependencies were not installed in the fresh
  worktree. Evidence: `bun test tests/static-analysis/swc-ast.test.ts` first
  reported `Cannot find package 'fast-check'`; after `make build`, the same
  command reported `Cannot find module '../../src/static-analysis/swc-ast'`.
  Impact: The intended red evidence was preserved after dependency
  installation.
- Observation: Adding this ExecPlan requires a matching `docs/contents.md`
  entry because `tests/build-gate/documentation-contents.test.ts` enforces
  top-level ExecPlan freshness. Evidence: scrutineer's Work Item 1 `make all`
  run failed on the documentation contents freshness test until
  `docs/contents.md` listed `docs/execplans/roadmap-3-2-5.md`. Impact: Work
  Item 1 includes that index update so the repository documentation set remains
  complete.
- Observation: Work Item 2's alias traversal migration did not change protected
  snapshots. Evidence: after the migration, `git status --porcelain --
  tests/static-analysis/__snapshots__` was empty, and scrutineer reported the
  same after `make all`. Impact: the seam's `astChildValues` preserves the
  alias collector's traversal contract for this work item.
- Observation: Work Item 3 made `workflow-deterministic-time.ts`
  `isMemberExpression` dead code. Evidence: scoped Biome reported
  `lint/correctness/noUnusedVariables` for that helper after the seam migration.
  Impact: the helper was removed rather than kept as the original plan
  expected, because keeping unused code would violate the quality gates.
- Observation: Work Item 5's first CodeRabbit attempt was rate-limited.
  Evidence: scrutineer reported two setup attempts with recoverable
  `rate_limit` responses and no review findings. After a required 76-minute
  `vsleep` cooldown, the retry completed successfully with no findings. Impact:
  review evidence is complete, and no deferred-review issue remains.

## Decision log

- Decision: Place the seam in a new internal module
  `src/static-analysis/swc-ast.ts` rather than extending `value-guards.ts`.
  Rationale: `value-guards.ts` is documented as parser-boundary-agnostic and
  imports no `@swc/core` types; the seam is explicitly SWC-shape-specific
  (imports `Node`). Keeping it separate preserves the value-guards charter and
  gives the SWC helpers a single documented home. The seam re-exports
  `isUnknownRecord` from `value-guards.ts` so parser-backed rules import all
  three primitives from one surface without duplicating the record guard's
  implementation.
  Date/Author: 2026-07-04, planning agent.
- Decision: Keep `workflow-ast-bindings.ts` `collectChildBindings`
  (`Object.values`, all fields) separate from the seam's `astChildValues`
  (fields minus `span`/`type`/`ctxt`).
  Rationale: The binding collector intentionally traverses every field; the rule
  seam intentionally prunes bookkeeping fields. Folding one into the other would
  either change behaviour or force a shared helper with a mode flag, an
  over-abstraction the complexity guide warns against. Only the object-record
  guard is shared.
  Date/Author: 2026-07-04, planning agent.
- Decision: Preserve local `value is Expression` / type-tag guards as one-line
  delegating predicates over the seam's `isAstNode`.
  Rationale: Eliminates duplicated runtime logic while keeping precise
  call-site typing and matching the codebase's existing idiom.
  Date/Author: 2026-07-04, planning agent.
- Decision: Keep `astChildValues(value)` typed as `object` rather than
  `UnknownRecord`.
  Rationale: CodeRabbit suggested narrowing the parameter, but the primary
  callers pass SWC `Node` values whose upstream type does not carry a string
  index signature. The `object` parameter keeps the helper cast-free for nodes
  while tests document that only semantic fields are returned.
  Date/Author: 2026-07-04, implementation agent.

## Outcomes & retrospective

Work Item 1 created `src/static-analysis/swc-ast.ts`, registered it in the
architecture fixture, added unit and property coverage in
`tests/static-analysis/swc-ast.test.ts`, and listed this ExecPlan in
`docs/contents.md`. The focused seam test passes. Scrutineer verified `make
all`, `make markdownlint`, and `make nixie` after the Work Item 1 changes.
CodeRabbit completed once with one low-severity type-contract suggestion, which
was closed by the decision above without changing the code.

Work Item 2 migrated `workflow-deterministic-time-aliases.ts` to import
`isAstNode` and `astChildValues` from `swc-ast.ts`, deleted its duplicated
strict node guard and child traversal helper, and added a nested-block alias
regression to `workflow-deterministic-time.test.ts`. The focused
deterministic-time and global-object tests pass. Scrutineer verified `make all`
and an empty protected-snapshot status. CodeRabbit completed once with no
findings.

Work Item 3 migrated `workflow-deterministic-time.ts` to import `isAstNode`,
`astChildValues`, and `isUnknownRecord` from `swc-ast.ts`, deleted its duplicate
child traversal and object-record guard helpers, and added an argument-wrapper
regression that reaches a `Date.now()` hazard through both an array and a
record wrapper. The stale `isMemberExpression` helper was removed when the
migration left it unused. The focused deterministic-time tests pass.
Scrutineer verified `make all` and an empty protected-snapshot status.
CodeRabbit completed once with no findings.

Work Item 4 migrated `workflow-global-object-reference.ts` so its local
`Expression` predicate delegates to `isAstNode` from the seam while preserving
the resolver's ECMAScript-only wrapper scope. The focused global-object
resolver tests pass. Scrutineer verified `make all` and an empty
protected-snapshot status. CodeRabbit completed once with no findings.

Work Item 5 migrated `workflow-ast-bindings.ts` so `asNode` reuses
`isUnknownRecord` from `swc-ast.ts`, while keeping `collectChildBindings` and
`arrayValue` separate as planned. A binding regression now covers array-valued
patterns and class-body members. The focused binding and AST-fact tests pass.
Scrutineer verified `make all` and an empty protected-snapshot status.
CodeRabbit completed after one required rate-limit cooldown with no findings.

Work Item 6 documented the internal SWC-shape helper seam in
`docs/technical-design.md` and ticked roadmap task 3.2.5 in `docs/roadmap.md`.
This completes the planned consolidation: parser-backed rules and the binding
collector now import the shared seam, protected snapshots were never changed,
and the public package entry points remained unchanged.

## Addenda

- [x] 3.2.5.1. Fix deterministic-time alias detection inside call and `new`
  arguments.
  - Source: audit:3.2.5; severity medium.
  - Scope: add the missing non-node argument-wrapper record traversal branch to
    deterministic-time alias collection and cover call or `new` argument-scoped
    immediately invoked function expression aliases for `Date.now` and
    `Math.random`.
  - Success: `odw/no-date-now` and `odw/no-math-random` warn for static aliases
    declared inside argument-scoped immediately invoked function expressions,
    and existing deterministic-time spans stay unchanged.
- [x] 3.2.5.2. Guard parser-backed rules against bypassing the SWC seam.
  - Source: review:3.2.5; severity low.
  - Scope: add a focused architecture, lint, or maintainer-documentation guard
    that makes new parser-backed 3.2 rules consume
    `src/static-analysis/swc-ast.ts` for SWC node-shape and child-traversal
    helpers instead of cloning local shape helpers.
  - Success: a future parser-backed rule cannot reintroduce private
    `isAstNode` or semantic child-field helper logic without tripping the
    reviewed guard or updating the documented exception.
- [x] 3.2.5.3. Unify single-type SWC node narrowers.
  - Source: audit:3.2.6; severity low.
  - Scope: move duplicated single-type `isExpression`, `isMemberExpression`,
    and `isIdentifier` narrowers from deterministic-time alias and
    global-object resolver modules behind the `swc-ast.ts` seam where their
    runtime and TypeScript narrowing contracts match.
  - Success: parser-backed collectors consume one documented narrower contract
    for matching SWC node types, and existing deterministic-time and
    global-object resolver tests pass without output changes.
- [x] 3.2.5.4. Harden single-type SWC narrower seam guards.
  - Source: audit:3.2.7; severity medium.
  - Scope: replace the architecture guard's hard-coded single-type narrower
    allowlist with shape-based cloned-narrower detection, then import the
    `swc-ast.ts` `isExpression` seam into
    `workflow-ast-scope-own-facts.ts`.
  - Success: byte-identical or structurally equivalent `isExpression`,
    `isIdentifier`, and `isMemberExpression` narrowers cannot re-enter
    parser-backed collectors without tripping the seam guard, and scope-owned
    facts reuse the documented SWC narrower seam.
- [ ] 3.2.5.5. Hoist call-expression narrowing onto the SWC seam.
  - Source: audit:3.1.7; severity medium.
  - Scope: move duplicated `CallExpression` narrowers behind
    `src/static-analysis/swc-ast.ts` and extend the cloned single-type
    narrower architecture guard so bare `.type === "X"` discriminant predicates
    are detected.
  - Success: parser-backed collectors share one reviewed call-expression
    narrower, and cloned `.type` single-node guards cannot bypass the SWC seam
    guard.

## Context and orientation

`odw-lint` is a Bun + TypeScript project. Relevant commands come from the
`Makefile`: `make all` runs `build check-fmt whitespace-hygiene lint typecheck
test`; `make markdownlint` and `make nixie` validate Markdown and embedded
Mermaid diagrams. Tests run under `bun test`. The 400-line file-size limit and
JSDoc/complexity lint rules are enforced by the gates listed under
`Constraints`.

The parser-backed rule modules under `src/static-analysis/` are:

- `workflow-ast-bindings.ts` — collects lexical binding names from a normalized
  workflow-body AST (`collectLexicalBindings`). Owns loose helpers `asNode`
  (any non-null object → `AstNode`), `arrayValue`, and the `Object.values`-based
  `collectChildBindings`.
- `workflow-ast-facts.ts` — public aggregator (`collectWorkflowAstFacts`) that
  delegates to `collectLexicalBindings` and the suppression-mask builder. It
  imports no shape helpers directly but is the "AST-fact" traversal named in the
  roadmap.
- `workflow-deterministic-time.ts` — walks the AST for `Date.now()`,
  `Math.random()`, and arg-less `new Date` hazards. Owns duplicate helpers
  `isNode` (strict node guard), `isObjectRecord`, `childValues`,
  `childRecordValues`, `isTraversableChildKey`, plus `isMemberExpression` and
  `isNewExpression`.
- `workflow-deterministic-time-aliases.ts` — collects direct deterministic-time
  aliases. Owns duplicate helpers `isNode`, `isExpression` (delegates to
  `isNode`), `childValues`, plus `isCallExpression`, `isVariableDeclarator`,
  `isIdentifier`, `isMemberExpression`.
- `workflow-global-object-reference.ts` — resolves whether an expression denotes
  a supported global (`Date`, `Math`, `globalThis`). Owns `isExpression`
  (strict node guard, duplicate of the others).

`value-guards.ts` already owns `isUnknownRecord(value): value is UnknownRecord`
(`typeof === "object" && !== null && !Array.isArray`) and `isFiniteNumber`.

Terms: an **SWC node** is a plain object with a string `type` discriminant (for
example `{ type: "CallExpression", span, callee, arguments }`). A **span** is
`{ start, end, ctxt }` with numeric fields and no `type`. The strict node guard
distinguishes nodes from spans and scalars by checking `"type" in value`.

The single behaviour-sensitive coupling for a new file is
`tests/diagnostics/architecture.test.ts:32`, which asserts
`sourceModuleFiles("src/static-analysis")` equals
`EXPECTED_STATIC_ANALYSIS_MODULE_FILES`.

## Interfaces and dependencies

Create `src/static-analysis/swc-ast.ts` exporting exactly:

```typescript
import type { Node } from "@swc/core";
import { type UnknownRecord, isUnknownRecord } from "./value-guards";

/** Narrows an unknown value to a plain SWC node-shaped object. */
export const isAstNode = (value: unknown): value is Node => {
  return typeof value === "object" && value !== null && "type" in value;
};

/** Returns node fields that may contain semantic child nodes. */
export const astChildValues = (value: object): readonly unknown[] => {
  return Object.entries(value)
    .filter(([key]) => isTraversableChildKey(key))
    .map(([, child]) => child);
};

/** Excludes scalar SWC bookkeeping fields from recursive traversal. */
const isTraversableChildKey = (key: string): boolean => {
  return key !== "span" && key !== "type" && key !== "ctxt";
};

export { isUnknownRecord, type UnknownRecord };
```

The re-export gives parser-backed rules a single import surface. Consumers that
need an `Expression`-typed guard keep a one-line delegating predicate locally.

## Plan of work

The work proceeds as one seam-introduction commit followed by four
behaviour-preserving migrations (one file each) and a documentation commit. Each
work item is independently committable and must leave `make all` green.

### Work Item 1: Add the shared SWC-shape helper seam

Docs to read first: [docs/technical-design.md](../technical-design.md) §3
(components table: "SWC parser adapter", "WorkflowAstFacts" fact collectors) and
§13 (owned SWC-based parser);
[docs/adr/0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md);
[docs/complexity-antipatterns-and-refactoring-strategies.md](../complexity-antipatterns-and-refactoring-strategies.md)
§"Balance Abstraction Levels" and §"Iterative Refactoring and Review" (extract a
shared abstraction when painful duplication emerges); AGENTS.md testing section.
Skills to load: `leta` (symbol navigation and references), `biomejs`
(formatting/lint expectations), `en-gb-oxendict` (comment/prose spelling).

Steps:

1. Red: add `tests/static-analysis/swc-ast.test.ts` importing from
   `../../src/static-analysis/swc-ast`. Run `bun test
   tests/static-analysis/swc-ast.test.ts` and expect it to fail because the
   module does not yet exist.
2. Green: create `src/static-analysis/swc-ast.ts` per the interface above with
   `@file` and per-declaration JSDoc.
3. Register the module: add `"swc-ast.ts"` to
   `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` in
   `tests/diagnostics/architecture-fixtures.ts` (keep alphabetical order, before
   `types.ts` and after `source-*`/`value-guards.ts` as appropriate — the list
   is sorted, so place it where a sorted `readdir` would).

Tests this work item adds (`tests/static-analysis/swc-ast.test.ts`):

- Unit (table-driven per AGENTS.md): `isAstNode` returns `true` for
  `{ type: "X" }`, `{ type: "CallExpression", span }`; returns `false` for
  `null`, `undefined`, `42`, `"s"`, `[]`, `[{ type: "X" }]` (array),
  `{ span: {} }` (no `type`), and `() => {}`.
- Type assertion: inside an `if (isAstNode(v))` block, `expectTypeOf(v)`
  narrows to `Node` (mirrors the `value-guards.test.ts` style using
  `expectTypeOf`).
- Unit: `astChildValues` on
  `{ type: "Call", span: {...}, ctxt: 0, callee: {...}, arguments: [...] }`
  yields exactly the `callee` and `arguments` values and never `type`, `span`,
  or `ctxt`; on `{}` yields `[]`.
- Property (`fast-check`, per AGENTS.md invariant-testing rule): for arbitrary
  records built from a key pool that includes `span`, `type`, `ctxt`, and
  semantic keys, `astChildValues` never returns a value stored under `span`,
  `type`, or `ctxt`, and returns every value stored under any other key.
- Re-export smoke: `isUnknownRecord` imported from `swc-ast` is the same
  function reference as the one from `value-guards` (guards the "reuse, do not
  re-implement" contract).

Validation: `make all` (expect `architecture.test.ts` to pass with the new file
registered, and the new suite to pass). Confirm no snapshot files changed with
`git status`.

Idempotence: re-running `make all` is safe. If the module already exists from a
prior attempt, the red step is skipped; proceed to verify tests.

### Work Item 2: Migrate `workflow-deterministic-time-aliases.ts`

Docs to read first: [docs/technical-design.md](../technical-design.md) §9.3
(orchestration risk / deterministic-time context) and §3;
[docs/adr/0002-workflow-body-parser-dialect-scope.md](../adr/0002-workflow-body-parser-dialect-scope.md)
(ECMAScript wrapper scope). Skills to load: `leta`, `biomejs`.

Steps:

1. Import `isAstNode` and `astChildValues` from `./swc-ast`.
2. Delete the local `isNode` (lines ~264-266), replace its uses inside
   `isCallExpression`, `isVariableDeclarator`, `isIdentifier`,
   `isMemberExpression`, and `isExpression` with `isAstNode`.
3. Keep `isExpression` as a one-line delegating predicate
   (`const isExpression = (value: unknown): value is Expression =>
   isAstNode(value);`) if its `Expression` return type is required by callers;
   otherwise replace direct `isExpression` uses with `isAstNode`. Prefer the
   minimal change that keeps `tsc --noEmit` green.
4. Delete the local `childValues` (lines ~231-236) and call `astChildValues`
   in `collectAliasesFromNode`.

This is a pure refactor (no behaviour change), so Red-Green-Refactor is
satisfied by the existing suites acting as the regression harness: they pass
before (proving the starting state) and must still pass after.

Tests this work item relies on (must remain green, unchanged):
`tests/static-analysis/workflow-deterministic-time.test.ts` (alias coverage),
`tests/static-analysis/workflow-global-object-reference.test.ts`, and the
`deterministic-time-spans` snapshot. Add one focused unit case to
`workflow-deterministic-time.test.ts` if alias-through-object traversal is not
already exercised: a body with a deterministic alias declared inside a nested
block/object initializer must still warn (proves `astChildValues` descends the
same fields the deleted `childValues` did).

Validation: `make all`; then `git status` must show **no** snapshot changes.

### Work Item 3: Migrate `workflow-deterministic-time.ts`

Docs to read first: same as Work Item 2, plus AGENTS.md snapshot-scope rule.
Skills to load: `leta`, `biomejs`.

Steps:

1. Import `isAstNode`, `astChildValues`, and `isUnknownRecord` from `./swc-ast`.
2. Replace `isNode` uses with `isAstNode` (including inside
   `isMemberExpression`); delete local `isNode`.
3. Replace `isObjectRecord(value)` in `visitChildValue` with
   `isUnknownRecord(value)`; delete local `isObjectRecord`.
4. Replace `childValues` and `childRecordValues` with `astChildValues`; delete
   `childValues`, `childRecordValues`, and `isTraversableChildKey`.
5. Keep `isNewExpression` and `isMemberExpression` (now delegating to
   `isAstNode`).

Tests this work item adds/updates:

- Regression pin: add a focused unit test to
  `tests/static-analysis/workflow-deterministic-time.test.ts` proving a
  `Date.now()` hazard nested inside a record wrapper (an AST field that is an
  object but not itself a node, reached via the `isUnknownRecord` branch) AND a
  hazard nested inside an array are both still reported. This locks the
  array-first ordering that makes `isUnknownRecord` (array-excluding) equivalent
  to the deleted `isObjectRecord` (array-including) at that call site.
- The `deterministic-time-spans` snapshot must pass unchanged.

Validation: `make all`; `git status` must show no snapshot changes.

### Work Item 4: Migrate `workflow-global-object-reference.ts`

Docs to read first:
[docs/adr/0002-workflow-body-parser-dialect-scope.md](../adr/0002-workflow-body-parser-dialect-scope.md)
(the module's `ParenthesisExpression`-only wrapper scope must be preserved).
Skills to load: `leta`, `biomejs`.

Steps:

1. Import `isAstNode` from `./swc-ast`.
2. Replace the local `isExpression` (lines ~140-142). Either keep a one-line
   delegating predicate `const isExpression = (value: unknown): value is
   Expression => isAstNode(value);` or, if cleaner for `tsc`, widen the two
   private helpers `innerTransparentExpression` and
   `innerOptionalBaseExpression` that consume it. Choose the option that keeps
   `tsc --noEmit` green with the smallest diff; the delegating predicate is the
   default because it is provably behaviour- and type-preserving.
3. Leave `isIdentifier` and `isMemberExpression` (they check `.type` on an
   `Expression | Node` parameter directly and do not use the node guard).

Tests this work item relies on:
`tests/static-analysis/workflow-global-object-reference.test.ts` (4 cases) must
remain green unchanged. No new test is required unless the delegating-predicate
choice leaves a branch uncovered; if so, add a case covering an optional-chain
base resolving through the seam guard.

Validation: `make all`; `git status` must show no snapshot changes.

### Work Item 5: Migrate the `workflow-ast-bindings.ts` object-record guard

Docs to read first:
[docs/complexity-antipatterns-and-refactoring-strategies.md](../complexity-antipatterns-and-refactoring-strategies.md)
§"Balance Abstraction Levels" (justify keeping `collectChildBindings`
separate); AGENTS.md testing section. Skills to load: `leta`, `biomejs`.

Steps:

1. Import `isUnknownRecord` from `./swc-ast` (or from `./value-guards`; prefer
   the seam for a single import surface).
2. Reimplement `asNode` to reuse the record guard:
   `const asNode = (value: unknown): AstNode | undefined =>
   isUnknownRecord(value) ? (value as AstNode) : undefined;`. This changes the
   array case from "returns the array cast as `AstNode`" to "returns
   `undefined`"; verify by inspection that `asNode` is never called with an
   array (arrays are consumed by `arrayValue`, and `collectChildBindings`
   branches on `Array.isArray` before calling `asNode`).
3. Do **not** change `collectChildBindings` (`Object.values`) or `arrayValue`.
   They are intentionally not part of the rule seam.

Tests this work item adds/updates:

- Add a unit case to `tests/static-analysis/workflow-ast-bindings.test.ts`
  asserting `collectLexicalBindings` is unchanged for a body whose declarations
  include array-valued AST fields (for example an array/object destructuring
  pattern and a class body with multiple members), documenting that the
  array-excluding record guard does not drop bindings.
- The `workflow-ast-facts` snapshot
  (`tests/static-analysis/__snapshots__/workflow-ast-facts.test.ts.snap`) must
  pass unchanged.

Validation: `make all`; `git status` must show no snapshot changes.

### Work Item 6: Document the seam and tick roadmap task 3.2.5

Docs to read first:
[docs/documentation-style-guide.md](../documentation-style-guide.md);
[docs/technical-design.md](../technical-design.md) §3.

Steps:

1. Add a short paragraph to [docs/technical-design.md](../technical-design.md)
   (near the components table / §3) documenting the single SWC-shape helper seam
   `src/static-analysis/swc-ast.ts` and which modules consume it. Keep prose in
   en-GB Oxford spelling.
2. Flip the roadmap checkbox for 3.2.5 in [docs/roadmap.md](../roadmap.md) from
   `[ ]` to `[x]`.
3. Format only the touched Markdown files: run `mdtablefix <files>` then
   `markdownlint-cli2 --fix <files>` on the specific paths edited (this ExecPlan,
   `docs/technical-design.md`, `docs/roadmap.md`).

Validation: `make all`, then `make markdownlint` and `make nixie` (Markdown
changed).

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-3-2-5`.

1. Baseline: `make all` — expect all suites green (establishes the starting
   state and that node modules are installed).
2. Per work item, follow the steps above and finish with `make all`. Example
   expected tail:

   ```plaintext
    N pass
    0 fail
   ```

3. After each migration work item, confirm behaviour did not change:

   ```plaintext
   git status --porcelain -- 'tests/static-analysis/__snapshots__'
   ```

   Expect empty output. Any listed snapshot means STOP (tolerance breach).
4. Commit each work item separately with a gated commit (use the
   `commit-message` skill; en-GB Oxford spelling in the subject and body).

## Validation and acceptance

Quality criteria (what "done" means):

- Tests: `make test` (via `make all`) passes; the new
  `tests/static-analysis/swc-ast.test.ts` fails before Work Item 1's module
  exists and passes after; the `deterministic-time-spans` and
  `workflow-ast-facts` snapshots pass **without** regeneration.
- Lint/typecheck: `make lint` and `make typecheck` (via `make all`) pass; no new
  Oxlint complexity, depth, `df12/complex-conditional`, or JSDoc violations; all
  touched files ≤ 400 lines.
- Architecture: `tests/diagnostics/architecture.test.ts` passes with `swc-ast.ts`
  registered; `src/static-analysis/index.ts` and `src/index.ts` barrels
  unchanged.
- Duplication removed: `workflow-deterministic-time.ts`,
  `workflow-deterministic-time-aliases.ts`, and
  `workflow-global-object-reference.ts` no longer define a local strict node
  guard or child-traversal helper; they import from `./swc-ast`.
- Docs: `make markdownlint` and `make nixie` pass after Work Item 6.

Quality method (how we check): `make all` for every code work item; `make
markdownlint` and `make nixie` for the documentation work item; `git status` on
the snapshot directory after each migration.

Red-Green-Refactor evidence to record during implementation:

- Red (Work Item 1): `bun test tests/static-analysis/swc-ast.test.ts` fails with
  a module-not-found error before `src/static-analysis/swc-ast.ts` exists.
- Green (Work Item 1): the same command passes after the module is created.
- Refactor (Work Items 2-5): the pre-existing behavioural suites and snapshots
  are the regression harness; they pass before (starting state) and after each
  migration with no snapshot regeneration.

## Idempotence and recovery

Each work item is a self-contained, committable refactor. Re-running `make all`
is always safe. If a migration breaks a test, revert that single file to its
imported-from-seam-free state (the seam module from Work Item 1 is independent
and can remain) and retry. No destructive or irreversible steps are involved;
recovery is `git restore <file>` for the single file under edit.

## Artifacts and notes

Duplicate implementations targeted for consolidation (verified by inspection):

- Strict node guard, four copies:
  `workflow-deterministic-time.ts:243-245` (`isNode`),
  `workflow-deterministic-time-aliases.ts:264-266` (`isNode`),
  `workflow-deterministic-time-aliases.ts:259-261` (`isExpression`, delegates),
  `workflow-global-object-reference.ts:140-142` (`isExpression`).
- Child-traversal primitive, two identical copies:
  `workflow-deterministic-time.ts:147-156`,
  `workflow-deterministic-time-aliases.ts:231-236`.
- Object-record guard, one drifted copy plus the canonical owner:
  `workflow-deterministic-time.ts:248-250` (`isObjectRecord`) versus
  `value-guards.ts:18-20` (`isUnknownRecord`).

## Revision note

Initial draft (2026-07-04). Decomposes roadmap 3.2.5 into one seam-introduction
work item, four single-file behaviour-preserving migrations, and a
documentation/roadmap work item. No behaviour change is intended; the two
protected snapshots are the primary acceptance signal.
