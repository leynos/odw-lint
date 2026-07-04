# Complete SWC traversal-driver adoption for parser-backed collectors

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint` checks Open Dynamic Workflows (ODW) workflow source before any
workflow runs. Several parser-backed rules walk the SWC (a Rust-based
JavaScript/TypeScript compiler exposed through `@swc/core`) abstract syntax tree
(AST) of a normalized workflow body. Roadmap task 3.2.5 consolidated the
low-level *shape* helpers (`isAstNode`, `astChildValues`, and the re-exported
`isUnknownRecord`) into one internal seam, `src/static-analysis/swc-ast.ts`.

The shape helpers are shared, but the *recursion drivers* that consume them are
not. Two rule collectors still carry a byte-for-byte-identical generic subtree
walk:

- `src/static-analysis/workflow-deterministic-time.ts` walks the whole subtree
  in `visitNode`/`visitChildValue`, threading a lexical scope view down to each
  node's children.
- `src/static-analysis/workflow-deterministic-time-aliases.ts` walks the whole
  subtree in `collectAliasesFromNode`/`collectAliasesFromChild`, with the same
  three-branch child dispatch (`isAstNode` → recurse node, `Array.isArray` →
  recurse each item, `isUnknownRecord` → recurse each `astChildValues` entry).

Two further collectors traverse the tree with genuinely *distinct* recursion
policies but still re-implement the child-enumeration primitive:

- `src/static-analysis/workflow-ast-scopes.ts` owns a private `childValues`
  helper (lines ~236-241) that is a character-for-character clone of
  `astChildValues`, wrapped in a scope-bounded walk that deliberately stops at
  nested scope boundaries.
- `src/static-analysis/workflow-ast-bindings.ts` walks unknown fields with raw
  `Object.values(node)` in `collectChildBindings`, wrapped in a
  type-dispatched declaration collector.

Two collectors are not generic tree walks at all and already consume the seam:
`workflow-ast-binding-patterns.ts` dispatches on binding-pattern positions, and
`workflow-global-object-reference.ts` is a directed object-identity resolver.

After this change a reader can see **one** documented generic AST traversal
driver in `src/static-analysis/swc-ast.ts` that owns the pre-order full-subtree
child dispatch, consumed by both deterministic-time collectors; the scope and
binding collectors consume the seam's `astChildValues` child-enumeration
primitive rather than a private clone while keeping their documented distinct
recursion policies; and the technical design plus developer guide record which
collectors adopt the driver and which are intentional exceptions and why.

Success is observable as: (a) the driver exists in `swc-ast.ts` and is unit- and
property-tested; (b) `workflow-deterministic-time.ts` and
`workflow-deterministic-time-aliases.ts` no longer own a private child-dispatch
recursion and instead call the driver; (c) `workflow-ast-scopes.ts` no longer
owns a `childValues` clone and `workflow-ast-bindings.ts` no longer walks with
raw `Object.values`, both consuming `astChildValues`; (d) the architecture guard
in `tests/diagnostics/architecture.test.ts` pins the driver as the single
generic traversal seam and records the remaining distinct-policy collectors as
tested, documented exceptions; and (e) **no rule output changes** — the existing
behavioural suites and the checked-in snapshots
(`tests/static-analysis/__snapshots__/deterministic-time-spans.test.ts.snap`
and `tests/static-analysis/__snapshots__/workflow-ast-facts.test.ts.snap`) pass
byte-for-byte without regeneration.

This is roadmap task 3.2.6 in [docs/roadmap.md](../roadmap.md) (step 3.2, "Add
first orchestration-risk rules"). It requires roadmap tasks 3.2.5, 3.1.5, and
3.2.5.1, all already complete on `main`. It implements
[docs/technical-design.md](../technical-design.md) §6.1 (shared SWC node-shape
seam) and §9.3 (orchestration-risk rule context), within the boundaries set by
[docs/adr/0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md)
and
[docs/adr/0002-workflow-body-parser-dialect-scope.md](../adr/0002-workflow-body-parser-dialect-scope.md).

## Constraints

Hard invariants that must hold throughout implementation. Violation requires
escalation, not a workaround.

- **No rule output changes.** Diagnostics emitted by
  `scanDeterministicTimeWarnings`, and the facts produced by
  `collectDeterministicTimeAliases`, `collectLexicalBindings`, `rootScopeView`,
  and `enterScope`, must be identical before and after. The two checked-in
  snapshots above must pass **without** `--update-snapshots`. This is the
  roadmap success criterion.
- **Preserve each collector's recursion policy.** The deterministic-time
  scanner enters a fresh scope view at each node and matches a hazard on that
  node using the *parent* scope view; the alias collector threads a constant
  whole-body binding view and records aliases at declarator nodes; the scope
  collector stops at nested scope boundaries; the binding collector dispatches
  by node type. The driver must express the first two without changing this
  ordering, and the scope and binding collectors must keep their distinct
  policies (they only swap the child-enumeration primitive). If the driver
  cannot express a policy without changing behaviour, that collector stays a
  documented exception rather than being forced onto the driver.
- **Owned SWC parser boundary.** Per
  [docs/adr/0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md),
  `odw-lint` owns its SWC-based static analysis. Do not import any ODW runtime
  helper, `loadWorkflowScript`, `createPrimitives`, or `validate(source)` path
  into production code. The driver must depend only on `@swc/core` types and the
  local `swc-ast.ts` helpers.
- **ECMAScript dialect scope.** Per
  [docs/adr/0002-workflow-body-parser-dialect-scope.md](../adr/0002-workflow-body-parser-dialect-scope.md),
  workflow bodies are parsed as ECMAScript (`syntax: "ecmascript"`, `jsx:
  false`). Do not add TypeScript-only node handling to the driver.
- **Public API surface unchanged.** Do not add the driver to
  `src/static-analysis/index.ts` or `src/index.ts`. It is an internal helper,
  exactly like the existing `isAstNode`/`astChildValues` seam.
- **File-size and lint gates.** Every touched TypeScript file must stay ≤ 400
  physical lines (`tests/build-gate/whitespace-hygiene.test.ts` and the
  documented 400-line limit in AGENTS.md). Oxlint enforces cyclomatic
  complexity ≤ 8, `max-depth` ≤ 3, `df12/complex-conditional`
  (`maxLogicalOperators: 1`, `includeTernary: true`), and mandatory
  `@file`/public/private JSDoc (`.oxlintrc.json`). The driver reuses the exact
  three-branch dispatch already accepted by these gates on `main`; it must not
  add logical operators beyond that shape.
- **Architecture module registry must stay exact.**
  `tests/diagnostics/architecture.test.ts` asserts the sorted file set of
  `src/static-analysis/` against `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` in
  `tests/diagnostics/architecture-fixtures.ts`. This plan adds the driver to the
  existing `swc-ast.ts` module (no new file), so the registry does not change;
  if a new module is introduced instead (see Decision Log escalation), it must
  be registered in the same commit.
- **en-GB Oxford spelling.** All new prose, comments, and commit messages use
  en-GB-oxendict ("-ize"/"-yse"/"-our") spelling.

## Tolerances (exception triggers)

- **Scope:** if adoption requires touching more than 8 production files or
  changing more than roughly 250 net lines, stop and escalate.
- **Snapshot drift:** if either protected snapshot changes at all, stop
  immediately. A snapshot delta means behaviour changed; do not regenerate the
  snapshot to make it pass.
- **Policy expressiveness:** if the driver cannot express the deterministic-time
  scanner's scope threading or the alias collector's declarator recording
  without altering visit order or the parent-versus-child scope distinction,
  stop and escalate rather than reshaping the collector's behaviour.
- **Interface:** if any exported symbol in `src/static-analysis/index.ts` or
  `src/index.ts` must change signature, stop and escalate.
- **Dependencies:** if a new runtime dependency is required, stop and escalate
  (none is expected).
- **Iterations:** if `make all` still fails after 3 focused attempts on a single
  work item, stop and escalate.

## Risks

- Risk: The deterministic-time scanner matches a hazard on a node using the
  *parent* scope view and recurses children with the *child* scope view
  (`enterScope(bindings, node)`). A naïve driver that threads only one context
  could match with the wrong scope and change which hazards are suppressed.
  Severity: high
  Likelihood: medium
  Mitigation: Design the driver so `visit(node, context)` returns the context
  for that node's *children* while receiving the parent context, exactly
  mirroring the current `visitNode` split (match with `bindings`, recurse with
  `enterScope(bindings, node)`). Pin with the existing scope-precise suites
  (`workflow-deterministic-time-scopes.test.ts`) and the `deterministic-time`
  snapshot, which must pass unchanged.
- Risk: The alias collector threads a constant whole-body binding view, not a
  per-scope view. Reusing a scope-threading driver could accidentally introduce
  scope entry into alias collection and change alias resolution.
  Severity: medium
  Likelihood: low
  Mitigation: The driver is scope-agnostic — it only propagates whatever context
  the caller returns. The alias `visit` returns its input context unchanged, so
  no scope entry is introduced. Pin with
  `workflow-deterministic-time-alias-arguments.test.ts` and the alias coverage in
  `workflow-deterministic-time.test.ts`.
- Risk: `workflow-ast-scopes.ts` `childValues` is a clone of `astChildValues`;
  swapping it is behaviour-neutral only if the two filters are identical. They
  are (`key !== "span" && key !== "type" && key !== "ctxt"`), but a hidden
  difference would silently change scope collection.
  Severity: medium
  Likelihood: low
  Mitigation: Diff the two filters by inspection (identical), keep the
  scope-bounded recursion untouched, and rely on `workflow-ast-scopes.test.ts`
  plus the deterministic-time scope suites as the regression harness.
- Risk: `workflow-ast-bindings.ts` `collectChildBindings` walks *all* fields via
  `Object.values`, including `span`, whereas `astChildValues` skips `span`,
  `type`, and `ctxt`. If any binding were reachable only through a bookkeeping
  field, switching would drop it.
  Severity: medium
  Likelihood: low
  Mitigation: `span` is `{start,end,ctxt}` (numbers), `type` is a string, and
  `ctxt` is a number; none can hold a declaration node, so `asNode` already
  no-ops on them. The switch is behaviour-neutral. Add a focused nested-binding
  regression test and rely on `workflow-ast-bindings.test.ts` and the
  `workflow-ast-facts` snapshot.
- Risk: Over-abstraction — a context-threading generic driver could be harder to
  read than two small local walks, breaching the AGENTS.md "clarity over
  cleverness" heuristic.
  Severity: low
  Likelihood: medium
  Mitigation: Keep the driver to the minimal fold-like signature, document it
  with a worked example in its JSDoc, and only adopt it where it removes a real
  duplicate (the two deterministic-time collectors). Do not force the scope or
  binding collectors onto it.

## Progress

- [x] Work Item 1: Add the shared AST traversal driver (`traverseAstSubtree`) to
  `swc-ast.ts` with red unit and property tests.
- [x] Work Item 2: Adopt the driver in the deterministic-time alias collector.
- [x] Work Item 3: Adopt the driver in the deterministic-time hazard scanner.
- [x] Work Item 4: Retire the `workflow-ast-scopes.ts` `childValues` clone in
  favour of the seam primitive and drop the architecture-guard exception.
- [x] Work Item 5: Align the `workflow-ast-bindings.ts` fallback traversal to the
  seam primitive.
- [x] Work Item 6: Document the driver adoption and intentional exceptions and
  tick roadmap task 3.2.6.

## Surprises & discoveries

- Baseline `make all` failed before implementation because the new ExecPlan
  file was present but not listed in `docs/contents.md`. The Work Item 1 commit
  includes that index link so the documentation freshness gate can pass while
  keeping the ExecPlan tracked with the first atomic change.
- CodeRabbit rate-limited the first Work Item 2 review attempt with
  `"Rate limit exceeded"` and a reported wait time of 31 minutes. Per workflow
  instructions, the implementation agent slept for a randomly selected
  49-minute backoff with `vsleep`, retried once, and the second attempt
  completed with zero findings.

## Decision log

- Decision: Introduce a context-threading fold-like driver
  `traverseAstSubtree<Context>(root, context, visit)` rather than a context-free
  `traverse(node, visit)`.
  Rationale: The deterministic-time scanner threads a lexical scope view that
  changes per node (`enterScope`). A context-free driver could not express that
  without a side-channel scope map, which would change the scope model and risk
  behaviour drift. A context-threading driver expresses both the scope-threading
  scanner and the constant-context alias collector with no behaviour change. The
  alias and match accumulators stay closure-captured in each caller, as they are
  today.
  Date/Author: 2026-07-04, planning agent.
- Decision: The scope and binding collectors consume the seam's `astChildValues`
  child-enumeration primitive but keep their distinct recursion policies; they do
  not adopt the driver.
  Rationale: The roadmap task explicitly says "extract one driver only where it
  preserves their distinct recursion policies; and document any intentional
  exceptions." The scope collector stops at nested scope boundaries and the
  binding collector dispatches by node type; neither is a generic full-subtree
  pre-order walk. Forcing them onto the driver would change behaviour. Removing
  their private child-enumeration clones still satisfies "consumes the documented
  SWC traversal seam".
  Date/Author: 2026-07-04, planning agent.
- Decision: Keep the driver inside the existing `swc-ast.ts` module rather than
  adding a new module.
  Rationale: The driver is a thin traversal primitive over `astChildValues` and
  `isAstNode`, both already owned by `swc-ast.ts`. Co-locating avoids a new
  module registration and keeps the seam cohesive. `swc-ast.ts` is 38 lines
  today, far below the 400-line limit. If the file were to approach the limit,
  escalate and split (new module registered in `architecture-fixtures.ts`).
  Date/Author: 2026-07-04, planning agent.
- Decision: Include the `docs/contents.md` ExecPlan index link in Work Item 1.
  Rationale: The repository's baseline gate treats any top-level ExecPlan file
  as documentation that must be indexed. The approved plan file existed in the
  task worktree before code changes, so `make all` could not pass until the
  index linked it. Keeping the index update with the driver-introduction commit
  preserves a green commit gate for the first committed work item.
  Date/Author: 2026-07-04, implementation agent.

## Outcomes & retrospective

- Work Item 1 introduced `traverseAstSubtree` in `swc-ast.ts`, added unit and
  property coverage in `swc-ast.test.ts`, and recorded the ExecPlan in
  `docs/contents.md` so the documentation freshness gate can see it.
- Work Item 2 replaced the deterministic-time alias collector's private
  full-subtree recursion with `traverseAstSubtree`. The existing alias argument
  wrapper tests, deterministic-time tests, deterministic-time span snapshot
  suite, and `make all` passed without snapshot changes. CodeRabbit completed
  after one required rate-limit backoff and returned zero findings.
- Work Item 3 replaced the deterministic-time hazard scanner's private
  node/child recursion with `traverseAstSubtree`, preserving parent-scope hazard
  matching and child-scope propagation through the callback return value. The
  deterministic-time scope suite, deterministic-time tests, deterministic-time
  span snapshot suite, and `make all` passed without snapshot changes.
  CodeRabbit completed with zero findings.
- Work Item 4 replaced the scope collector's private `childValues` clone with
  the seam's `astChildValues` primitive and removed the architecture-guard
  exception for `workflow-ast-scopes.ts`. The scope-view suite,
  deterministic-time scope suite, architecture guard, and `make all` passed
  without snapshot changes. CodeRabbit completed with zero findings.
- Work Item 5 replaced the lexical-binding collector's fallback
  `Object.values` walk with `astChildValues` and added a focused control-flow
  fallback regression test. The binding suite, workflow AST facts snapshot
  suite, and `make all` passed without snapshot changes. CodeRabbit completed
  with zero findings.
- Work Item 6 documented the driver adoption and intentional exceptions in the
  technical design and developer guide, extended the architecture guard to pin
  SWC traversal-driver declarations to `swc-ast.ts`, and ticked roadmap task
  3.2.6. `make all`, Markdown linting, and `make nixie` passed. CodeRabbit
  completed with zero findings.

## Context and orientation

The reader needs no prior plan. The relevant files, all under
`src/static-analysis/`:

- `swc-ast.ts` — the shared SWC node-shape seam. Owns `isAstNode(value)`
  (`typeof value === "object" && value !== null && "type" in value`),
  `astChildValues(value)` (object entries excluding the `span`, `type`, and
  `ctxt` bookkeeping fields), and re-exports `isUnknownRecord`. This is where the
  new driver lands.
- `workflow-deterministic-time.ts` — `scanDeterministicTimeWarnings` parses the
  body, builds a whole-body binding view and alias facts, then walks the module
  from `rootScopeView(module)` via `walkDeterministicTimeHazards` →
  `visitNode`/`visitChildValue`. `visitNode(node, bindings, aliases, matches)`
  computes `childBindings = enterScope(bindings, node)`, matches a hazard on
  `node` with the parent `bindings`, pushes any match, then recurses each
  `astChildValues(node)` entry with `childBindings`. `visitChildValue` is the
  three-branch child dispatch.
- `workflow-deterministic-time-aliases.ts` — `collectDeterministicTimeAliases`
  walks the module from `collectAliasesFromNode(module, bindings, aliases,
  rules)`. `collectAliasesFromNode` records an alias when the node is a
  `VariableDeclarator`, then recurses each `astChildValues(node)` entry via
  `collectAliasesFromChild`, the same three-branch child dispatch. The `bindings`
  context is the constant whole-body view; `aliases` and `rules` are threaded but
  never change per node.
- `workflow-ast-scopes.ts` — `rootScopeView`/`enterScope` build lexical scope
  views. It owns a private `childValues(node)` (lines ~236-241) identical to
  `astChildValues`, used by its scope-bounded own-name recursion
  (`collectChildOwnNames`/`collectOwnNamesFromValue`) which deliberately stops at
  nested scope-opening nodes (the `currentScope` guard and `isScopeOpeningNode`).
- `workflow-ast-bindings.ts` — `collectLexicalBindings` dispatches by node type
  through `STATEMENT_BINDING_COLLECTORS`; unrecognised nodes fall back to
  `collectChildBindings`, which iterates `Object.values(node)` (including
  `span`/`type`/`ctxt`) and recurses via `collectStatementBindings`.
- `workflow-ast-binding-patterns.ts` — binding-pattern-position dispatch
  collectors; already consumes `isUnknownRecord` from the seam. Not a generic
  tree walk (visits binding positions only).
- `workflow-global-object-reference.ts` — a directed object-identity resolver
  that follows the object chain of a single expression; already consumes
  `isAstNode`. Not a tree walk.

Tests that act as the regression harness (must pass unchanged unless the plan
adds a focused case):
`tests/static-analysis/workflow-deterministic-time.test.ts`,
`tests/static-analysis/workflow-deterministic-time-scopes.test.ts`,
`tests/static-analysis/workflow-deterministic-time-alias-arguments.test.ts`,
`tests/static-analysis/deterministic-time-spans.test.ts` (+ snapshot),
`tests/static-analysis/workflow-ast-scopes.test.ts`,
`tests/static-analysis/workflow-ast-bindings.test.ts`,
`tests/static-analysis/workflow-ast-facts.test.ts` (+ snapshot),
`tests/static-analysis/swc-ast.test.ts`, and
`tests/diagnostics/architecture.test.ts`. The ODW example corpus differential
tests under `tests/static-analysis/fixtures/odw-examples/` pin end-to-end
diagnostics.

Verified library facts (pinned `@swc/core@1.15.43`, per `bun.lock` and
technical-design §6.1): SWC nodes are plain objects with a `type` string and
bookkeeping `span`/`ctxt` fields; semantic children live under other named
fields or arrays of nodes. The existing `astChildValues` and `isAstNode` already
encode this and are property-tested in `swc-ast.test.ts`. The driver adds no new
assumption about SWC shape beyond what the seam already owns.

## Plan of work

Six work items: one driver-introduction commit, two behaviour-preserving driver
adoptions (one collector each), two seam-primitive alignments (one collector
each), and one documentation-and-tick commit. Each is independently committable
and must leave `make all` green. Work Items 2-5 are pure refactors whose
Red-Green-Refactor obligation is met by the existing suites acting as the
regression harness (green before, green after), plus one focused regression case
each where the touched traversal branch is not already exercised.

### Work Item 1: Add the shared AST traversal driver

Docs to read first: [docs/technical-design.md](../technical-design.md) §6.1
(shared SWC node-shape seam) and §3 (components table);
[docs/adr/0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md);
[docs/complexity-antipatterns-and-refactoring-strategies.md](../complexity-antipatterns-and-refactoring-strategies.md)
§"Balance Abstraction Levels" and §"Iterative Refactoring and Review";
AGENTS.md testing section and TypeScript guidance. Skills to load: `leta`
(symbol navigation and references), `biomejs` (formatting/lint expectations),
`en-gb-oxendict` (comment/prose spelling), `python-router` is not applicable (no
Python); consult `code-review` heuristics before committing.

Interface to add in `src/static-analysis/swc-ast.ts`:

```ts
/**
 * Drives a pre-order walk over one SWC subtree, threading caller context to
 * each node's children.
 *
 * `visit` receives a node and the context inherited from its parent, and
 * returns the context to pass to that node's own children. Array and non-node
 * record wrappers propagate the parent context unchanged, because only nodes
 * can open a lexical scope or declare a binding.
 *
 * @param root - SWC node to walk, inclusive of `root` itself.
 * @param context - Context passed to `visit(root, …)`.
 * @param visit - Per-node callback returning the child context.
 */
export const traverseAstSubtree = <Context>(
  root: Node,
  context: Context,
  visit: (node: Node, context: Context) => Context,
): void;
```

Internally it mirrors the current three-branch child dispatch: for the root,
compute `const childContext = visit(root, context)` then dispatch each
`astChildValues(root)` entry through a private helper that, per value, recurses
into a node (`isAstNode`) with the current context, maps over array items, or
descends `astChildValues` of a non-node record (`isUnknownRecord`) — arrays and
records forwarding the same context.

Steps:

1. Red: extend `tests/static-analysis/swc-ast.test.ts` with a `describe` block
   importing `traverseAstSubtree` from `../../src/static-analysis/swc-ast`. Run
   `bun test tests/static-analysis/swc-ast.test.ts` and expect failure because
   the export does not yet exist.
2. Green: add `traverseAstSubtree` to `swc-ast.ts` per the interface, with
   per-declaration JSDoc. Run the focused suite; expect pass.
3. Refactor: keep the private child-dispatch helper small (single
   responsibility, ≤ 8 complexity, ≤ 3 depth). Re-run the focused suite and
   `make all`.

Tests this work item adds (in `tests/static-analysis/swc-ast.test.ts`):

- Unit (table-driven): a small hand-built node tree with nested nodes, an array
  of nodes, and a non-node record wrapper containing a node. Assert
  `traverseAstSubtree` visits every node exactly once in pre-order and never
  visits `span`/`type`/`ctxt` scalar values as nodes.
- Unit: context threading — `visit` returns a depth counter; assert each node's
  received context equals its parent's returned context (root receives the seed;
  a child of a node whose `visit` returned `n` receives `n`). Include an array
  wrapper and a record wrapper to prove they forward the parent context
  unchanged.
- Property (`fast-check`, per AGENTS.md invariant-testing rule): for arbitrary
  node trees built from a bounded generator, the multiset of visited nodes equals
  the multiset produced by the existing `astChildValues`-based manual recursion
  (a reference walker defined inline in the test), proving the driver is
  behaviourally equal to the code it will replace.

Validation: `make all` (expect the new suite green and the architecture module
registry unchanged, since no file was added). Confirm no snapshot files changed
with `git status`.

Idempotence: re-running `make all` is safe; if the export already exists from a
prior attempt, the red step is skipped.

### Work Item 2: Adopt the driver in the deterministic-time alias collector

Docs to read first: [docs/technical-design.md](../technical-design.md) §9.3
(deterministic-time / orchestration-risk context) and §6.1;
[docs/adr/0002-workflow-body-parser-dialect-scope.md](../adr/0002-workflow-body-parser-dialect-scope.md).
Skills to load: `leta`, `biomejs`, `en-gb-oxendict`.

Steps:

1. Import `traverseAstSubtree` from `./swc-ast` (retain `astChildValues`,
   `isAstNode`, `isUnknownRecord` imports only if still used elsewhere in the
   file; remove any that become unused).
2. Replace `collectDeterministicTimeAliases`'s call to `collectAliasesFromNode`
   with `traverseAstSubtree(module, bindings, (node, ctx) => { if
   (isVariableDeclarator(node)) collectAliasFromDeclarator(node, ctx, aliases,
   rules); return ctx; })`. `aliases` and `rules` stay closure-captured.
3. Delete the now-dead `collectAliasesFromNode` and `collectAliasesFromChild`.

This is a pure refactor; the existing suites are the regression harness.

Tests this work item relies on (must remain green, unchanged):
`workflow-deterministic-time-alias-arguments.test.ts`, the alias coverage in
`workflow-deterministic-time.test.ts`, and the `deterministic-time-spans`
snapshot. Add one focused unit case to
`workflow-deterministic-time.test.ts` only if an alias declared inside a non-node
record wrapper (for example a call/`new` argument wrapper) is not already
exercised: it must still be recorded, proving the driver descends the same
fields the deleted `collectAliasesFromChild` did. (Roadmap task 3.2.5.1 already
added argument-wrapper alias coverage; confirm it exercises the record-wrapper
branch before deciding whether a new case is needed.)

Validation: `make all`; then `git status` must show **no** snapshot changes.

### Work Item 3: Adopt the driver in the deterministic-time hazard scanner

Docs to read first: same as Work Item 2, plus the AGENTS.md snapshot-scope rule.
Skills to load: `leta`, `biomejs`, `en-gb-oxendict`.

Steps:

1. Replace the existing `./swc-ast` import (line 16, currently
   `import { astChildValues, isAstNode, isUnknownRecord } from "./swc-ast";`) so
   it names **only** `traverseAstSubtree`:
   `import { traverseAstSubtree } from "./swc-ast";`. The three shape helpers
   (`astChildValues`, `isAstNode`, `isUnknownRecord`) are consumed **only** by
   `visitNode` (line 115) and `visitChildValue` (lines 127, 139, 140), both
   deleted in step 3; no other declaration in this file references them (verified
   by inspection — the only occurrences are the import on line 16 and those two
   functions). Leaving them imported would trip the Oxlint no-unused-imports gate
   inside `make all`, exactly as WI2 guards against, so they must be dropped here.
2. Replace `walkDeterministicTimeHazards`'s `visitNode(root, bindings, aliases,
   matches)` with `traverseAstSubtree(root, bindings, (node, ctx) => { const
   match = matchDeterministicTimeHazard(node, ctx, aliases); if (match !==
   undefined) matches.push(match); return enterScope(ctx, node); })`. This
   matches the hazard with the parent scope `ctx` and returns the child scope
   `enterScope(ctx, node)`, exactly reproducing the current `visitNode` split.
3. Delete the now-dead `visitNode` and `visitChildValue`.

After these steps, re-check the import list: `traverseAstSubtree` is the only
symbol imported from `./swc-ast`, and every other import in the file (line 9
`@swc/core` types, `enterScope`/`rootScopeView`, the alias helpers, etc.) is
still consumed by the retained hazard-matching helpers, so no further import
pruning is required.

Tests this work item adds/updates:

- Regression pin: confirm `workflow-deterministic-time-scopes.test.ts` covers a
  hazard whose suppression depends on entering a nested function/block scope
  (proving the parent-versus-child context split is preserved). If not already
  present, add a focused case: a `Date.now()` at module scope must warn while a
  shadowed `Date` inside a nested block must suppress, in the same body.
- Regression pin: confirm a hazard nested inside an array and inside a non-node
  record wrapper is still reported (proving the driver's array and record
  branches match the deleted `visitChildValue`). Add a focused case if absent.
- The `deterministic-time-spans` snapshot must pass unchanged.

Validation: `make all`; `git status` must show no snapshot changes.

### Work Item 4: Retire the scope collector's `childValues` clone

Docs to read first: [docs/technical-design.md](../technical-design.md) §6.1;
[docs/adr/0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md);
the `PRIVATE_SWC_HELPER_EXCEPTIONS` block in
`tests/diagnostics/architecture.test.ts`. Skills to load: `leta`, `biomejs`,
`en-gb-oxendict`.

Steps:

1. In `workflow-ast-scopes.ts`, import `astChildValues` from `./swc-ast` and
   replace the body of the scope-bounded recursion's child enumeration
   (`collectChildOwnNames` iterating `childValues(node)`) with
   `astChildValues(node)`.
2. Delete the private `childValues` helper (lines ~236-241). Keep the
   scope-bounded recursion (`collectOwnNamesFromValue`, the `currentScope` guard,
   `isScopeOpeningNode`) unchanged — this is the documented distinct policy.
3. In `tests/diagnostics/architecture.test.ts`, remove the
   `workflow-ast-scopes.ts` → `childValues` entry from
   `PRIVATE_SWC_HELPER_EXCEPTIONS` (the exception is now dead, and the guard must
   assert the clone is gone). Update the adjacent comment to state that scope
   views consume the seam's `astChildValues` while owning a distinct
   scope-bounded recursion policy.

This is a pure refactor; `workflow-ast-scopes.test.ts` and the deterministic-time
scope suites are the regression harness.

Tests this work item relies on (must remain green): `workflow-ast-scopes.test.ts`
(nested parameters, setter params, named class-expression member scope, and
block-to-function attribution, per roadmap task 3.1.5.2),
`workflow-deterministic-time-scopes.test.ts`, and the architecture guard, which
must now show the scope collector consuming the seam with no `childValues`
declaration and no exception entry.

Validation: `make all`; `git status` must show no snapshot changes.

### Work Item 5: Align the lexical-binding fallback traversal to the seam

Docs to read first: [docs/technical-design.md](../technical-design.md) §6.1;
AGENTS.md TypeScript guidance. Skills to load: `leta`, `biomejs`,
`en-gb-oxendict`.

Steps:

1. In `workflow-ast-bindings.ts`, import `astChildValues` from `./swc-ast`.
2. Rewrite `collectChildBindings` to iterate `astChildValues(node)` instead of
   `Object.values(node)`, keeping the array/`asNode` dispatch into
   `collectStatementBindings`. This drops the harmless descent into
   `span`/`type`/`ctxt` bookkeeping fields, which cannot hold declarations.
3. Leave the type-dispatched `STATEMENT_BINDING_COLLECTORS` policy untouched —
   this is the documented distinct policy.

This is a pure refactor; `workflow-ast-bindings.test.ts` and the
`workflow-ast-facts` snapshot are the regression harness.

Tests this work item adds/updates:

- Regression pin: confirm `workflow-ast-bindings.test.ts` covers a binding
  declared inside a node type that falls through to `collectChildBindings` (the
  generic fallback), for example a binding nested inside an expression statement
  or a control-flow node not in the dispatch table. If absent, add a focused case
  proving the binding is still collected after the switch to `astChildValues`.
- The `workflow-ast-facts` snapshot must pass unchanged.

Validation: `make all`; `git status` must show no snapshot changes.

### Work Item 6: Document the driver adoption and intentional exceptions

Docs to read first:
[docs/documentation-style-guide.md](../documentation-style-guide.md);
[docs/technical-design.md](../technical-design.md) §6.1;
[docs/developers-guide.md](../developers-guide.md) (parser-adapter and internal
seam notes near the SWC parser section). Skills to load: `en-gb-oxendict`,
`changelog` is not applicable, `code-review` heuristics before committing.

Steps:

1. Extend [docs/technical-design.md](../technical-design.md) §6.1 so the seam
   paragraph records that `swc-ast.ts` also owns the single generic AST
   traversal driver (`traverseAstSubtree`), consumed by the deterministic-time
   scanner and alias collector; and that the scope collector and lexical-binding
   collector consume the seam's child-enumeration primitive while owning
   documented distinct recursion policies (scope-bounded and type-dispatched
   respectively), with the binding-pattern collector and global-object resolver
   noted as non-tree-walk exceptions.
2. Add a short internal-seam note to
   [docs/developers-guide.md](../developers-guide.md) near the SWC parser-adapter
   section, describing when a new parser-backed collector should adopt
   `traverseAstSubtree` versus keeping a distinct policy behind the seam
   primitives.
3. In `tests/diagnostics/architecture.test.ts`, add or extend an assertion that
   pins `traverseAstSubtree` as living only in `swc-ast.ts` (no rule-local
   generic subtree walker re-declares the three-branch child dispatch), matching
   the existing "keeps SWC node-shape helpers behind the shared seam" guard style.
   Keep the assertion narrow (name-based, like the existing
   `PRIVATE_SWC_HELPER_DECLARATION_NAMES` set) so it does not become brittle.
4. Tick roadmap task 3.2.6 in [docs/roadmap.md](../roadmap.md) (`- [ ]` → `- [x]`)
   and set this ExecPlan's Status to COMPLETE with a revision note.

Tests: `tests/diagnostics/architecture.test.ts` (the new/extended guard passes);
Markdown gates for the changed docs.

Validation: `make all`; `make markdownlint`; `make nixie` (the changed Markdown
files contain no new Mermaid diagrams, but run `nixie` to satisfy the doc gate).

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-3-2-6`.

1. Confirm the branch: `git branch --show-current` (expect the
   `roadmap-3-2-6` leaf).
2. Baseline: `make all` must be green before any change. Record that `git
   status` is clean.
3. For each work item: make the change, run the focused suite named in that item,
   then `make all`, then `git status` to confirm no snapshot drift, then commit
   with a gated, imperative-mood message.
4. After Work Item 6: `make all`, `make markdownlint`, and `make nixie`.

Expected focused-suite transcript shape (Work Item 1 red step):

```plaintext
$ bun test tests/static-analysis/swc-ast.test.ts
… error: Export named 'traverseAstSubtree' not found in module '.../swc-ast.ts'
```

After the green step the same command reports all tests passing.

## Validation and acceptance

Quality criteria (what "done" means):

- Tests: `make test` passes; the two protected snapshots pass **without**
  regeneration; the new driver suite in `swc-ast.test.ts` passes; the
  architecture guard passes with the driver pinned to `swc-ast.ts` and the scope
  `childValues` exception removed.
- Lint/typecheck: `make lint` and `make typecheck` (both inside `make all`)
  pass; no new suppressions.
- Formatting: `make check-fmt` passes.
- Docs: `make markdownlint` and `make nixie` pass after Work Item 6.

Quality method (how we check): `make all` after every work item;
`make markdownlint` and `make nixie` after documentation changes; `git status`
after every work item to prove no snapshot files changed.

Red-Green-Refactor evidence:

- Red (Work Item 1): `bun test tests/static-analysis/swc-ast.test.ts` fails with
  a missing-export error before `traverseAstSubtree` exists.
- Green (Work Item 1): the same command passes after the export is added.
- Refactor (Work Items 2-5): the existing behavioural suites pass before
  (proving the starting state) and must still pass after each adoption, with the
  protected snapshots unchanged; each item adds a focused regression case only
  where the touched branch was not already exercised.

Behaviour acceptance: running the linter over the ODW example corpus produces
byte-identical diagnostics before and after (pinned by the corpus differential
tests and the `deterministic-time-spans` and `workflow-ast-facts` snapshots).

## Idempotence and recovery

Every step is re-runnable. `make all` is safe to repeat. If a work item is
partially applied (for example the driver adopted in one collector but not the
other), the file still compiles and the suites still pass, because each adoption
is independent. To roll back a single work item, revert its commit; the driver
introduced in Work Item 1 is inert until a collector calls it, so reverting a
later adoption never breaks Work Item 1. Keep the working tree clean between
work items.

## Artifacts and notes

- The driver is a thin generic fold over the existing `astChildValues`
  primitive; it introduces no new SWC-shape assumption.
- The scope and binding collectors are intentional exceptions to the driver
  (distinct recursion policies), recorded in technical-design §6.1 and pinned by
  the architecture guard; they still consume the seam's child-enumeration
  primitive, so no rule-local child-enumeration clone remains after Work Items 4
  and 5.

## Interfaces and dependencies

In `src/static-analysis/swc-ast.ts`, add:

```ts
export const traverseAstSubtree = <Context>(
  root: Node,
  context: Context,
  visit: (node: Node, context: Context) => Context,
): void => { /* pre-order walk over astChildValues(root) */ };
```

No new runtime dependency. No change to `src/static-analysis/index.ts` or
`src/index.ts`. Consumers after adoption: `workflow-deterministic-time.ts`
(scope-threaded visit) and `workflow-deterministic-time-aliases.ts` (constant
context visit). `workflow-ast-scopes.ts` and `workflow-ast-bindings.ts` consume
`astChildValues` only.

## Revision note

Initial draft (2026-07-04): decomposed roadmap task 3.2.6 into six atomic work
items — introduce a context-threading `traverseAstSubtree` driver in the
`swc-ast.ts` seam, adopt it in the two deterministic-time collectors, align the
scope and binding collectors onto the seam's child-enumeration primitive while
keeping their distinct policies as documented exceptions, and record the
adoption and exceptions in the technical design, developer guide, and
architecture guard. Awaiting approval before implementation.

Revision 2 (2026-07-04): resolved the design reviewer's blocking point on Work
Item 3. WI3 deletes `visitNode` and `visitChildValue`, the only consumers of the
`astChildValues`, `isAstNode`, and `isUnknownRecord` imports (all on line 16 of
`workflow-deterministic-time.ts`, verified by inspection to have no other
references in the file). The previous WI3 step 1 said only "Import
`traverseAstSubtree`", which would have left three unused imports and failed the
Oxlint no-unused-imports gate inside `make all`. Step 1 now mirrors WI2's
wording: it **replaces** the `./swc-ast` import so it names only
`traverseAstSubtree` and explicitly drops the three now-unused shape helpers,
with a follow-up note confirming every remaining import is still consumed. No
other work item changed.

Revision 3 (2026-07-04): completed all six work items. The final implementation
keeps `traverseAstSubtree` private to `swc-ast.ts`, adopts it in the two
full-subtree deterministic-time collectors, aligns the scope and binding
collectors on `astChildValues`, and records the distinct-policy exceptions in
the technical design, developer guide, roadmap, and architecture guard.
