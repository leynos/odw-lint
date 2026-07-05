# Extend deterministic-time alias resolution to lexical scopes

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: IN PROGRESS

## Purpose / big picture

`odw-lint` statically checks Open Dynamic Workflows (ODW) source without
executing it. The deterministic-time Claude-compatibility rules (`odw/no-date-now`,
`odw/no-math-random`, `odw/no-argless-new-date`; see
[technical-design.md](../technical-design.md) §9.2) warn when a workflow reads
wall-clock time or randomness, because such workflows are hard to replay across
ODW and Claude Code. Those rules already understand two things about aliases:
`const now = Date.now; now()` and `const D = Date; D.now()` are hazards, and a
locally shadowed `Date`/`Math`/`globalThis` root is not.

Roadmap task 3.1.6 (`docs/roadmap.md` lines 951-959) closes the last gap between
those two facts. Task 3.1.5 made **bare-root** resolution scope-precise: a
`Date` shadow in one function no longer hides a real `Date.now()` in an unrelated
function, because the walk threads a scope-narrowed binding *view*
(`rootScopeView` + `enterScope` in
`src/static-analysis/workflow-ast-scopes.ts`). But **alias** resolution was left
on the old whole-body model:
`collectDeterministicTimeAliases(module, bindings, rules)` in
`src/static-analysis/workflow-deterministic-time-aliases.ts` walks the entire
module once and returns a flat `ReadonlyMap<string, DeterministicTimeAlias>`
keyed only by the alias name, with no scope information. Both the declaration
side (which resolves `Date`/`Math` against the whole-body binding set) and the
use side (`aliasCallMatch` / `objectIdentityForExpression`, which do
`aliases.get(name)` regardless of the use site) ignore lexical scope.

Verbatim roadmap success line (`docs/roadmap.md` lines 957-959): "same-named
aliases or global roots in unrelated scopes no longer suppress supported Claude
compatibility warnings, while aliases shadowed at the use site remain suppressed
and rule-doc limitations are updated."

The concrete defects this fixes today, all traceable to the flat map:

```js
// (1) sibling-scope leak → false positive on a()
function a() { const now = () => 0; return now(); }  // NOT a hazard
function b() { const now = Date.now; return now(); } // hazard
// Today: the flat map records now -> Date.now once, so BOTH now() calls warn.
// Wanted: exactly one warning, on b's now().

// (2) use-site shadow not suppressed → false positive in f()
const now = Date.now;                                 // root alias, never called
function f() { const now = () => 0; return now(); }   // shadows the alias
// Today: f's now() warns. Wanted: zero warnings.

// (3) alias-shaped name rebound in a sibling scope → false positive in f()
const D = Date;                                       // root alias, never used
function f(D) { return D.now(); }                     // D is a parameter here
// Today: f's D.now() warns. Wanted: zero warnings.
```

After this change, alias declaration and alias use consume the *same*
scope-narrowed binding view already used for bare roots, so aliases become
lexically scoped: they are visible in the declaring scope and its descendants,
isolated from sibling scopes, and suppressed wherever a nearer binding of the
same name shadows them. Legitimate nested visibility keeps warning
(`const now = Date.now;\nfunction f() { return now(); }` warns inside `f`).

Observable proof (see `Validation and acceptance`):

1. `scanDeterministicTimeWarnings` on defect (1) returns exactly one
   `odw/no-date-now` diagnostic whose sliced span is `now` inside `b`; today it
   returns two.
2. `scanDeterministicTimeWarnings` on defects (2) and (3) returns `[]`; today
   each returns one diagnostic.
3. Every existing deterministic-time and alias test (including the nested-block
   alias, the argument-scoped IIFE aliases, and the nine trusted ODW example
   fixtures) still produces exactly the diagnostics it does today.

## Constraints

- Work exclusively in the `roadmap-3-1-6` worktree at
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-3-1-6`. Never edit the
  root/control worktree.
- Do not change any public package export. The alias module
  (`workflow-deterministic-time-aliases.ts`) and the scope module
  (`workflow-ast-scopes.ts`) are internal: neither is re-exported from
  `src/index.ts` or `src/static-analysis/index.ts` (verified: `grep` for both
  module names in the two index files returns nothing). The observable contract
  is the diagnostics emitted by `scanDeterministicTimeWarnings` and, through it,
  `lintWorkflowSource`.
- Keep `rootScopeView(module)` and `enterScope(view, node)` signatures and
  behaviour stable. Their existing consumers are
  `src/static-analysis/workflow-deterministic-time.ts` and
  `tests/static-analysis/workflow-ast-scopes.test.ts` (verified by `grep`); the
  scope tests assert exact `boundNames` and must stay green unchanged.
- Honour ADR 0002
  ([adr/0002-workflow-body-parser-dialect-scope.md](../adr/0002-workflow-body-parser-dialect-scope.md)):
  workflow bodies parse in the ECMAScript parser dialect. Do not add
  TypeScript-only wrapper handling.
- Reuse the shared SWC shape helpers in `src/static-analysis/swc-ast.ts`
  (`isAstNode`, `astChildValues`, `traverseAstSubtree`) rather than adding a new
  tree-walk. This is the seam mandated by
  [technical-design.md](../technical-design.md) §6.1.
- Do not execute workflow source; analysis stays purely syntactic (no `eval`,
  no dynamic computed-key resolution beyond the existing string-literal path).
- No single source or test file may exceed 400 lines (AGENTS.md "Code Style and
  Structure"). `workflow-ast-scopes.ts` is 278 lines and
  `workflow-deterministic-time-aliases.ts` is 226 lines today; keep both under
  400.
- en-GB Oxford spelling ("-ize"/"-yse"/"-our") in all prose, comments, and
  commit messages (AGENTS.md; `docs/documentation-style-guide.md`).

## Tolerances (exception triggers)

- Scope: if the implementation needs to touch more than 6 source/test files or
  more than roughly 320 net lines of code, stop and escalate.
- Interface: if any public package export
  (`src/index.ts`/`src/static-analysis/index.ts`) must change, stop and
  escalate.
- Dependencies: if a new runtime or dev dependency is required, stop and
  escalate.
- Iterations: if the focused test suite still fails after 3 implementation
  attempts on the same work item, stop and escalate.
- Behaviour: if any *existing* deterministic-time or scope test would have to
  change its expected diagnostics to make the new behaviour pass, stop and
  escalate — that signals a semantics regression, not a refinement.
- Ambiguity: if a fixture reveals a case where "the same lexical scope model as
  bare roots" is genuinely ambiguous (for example TDZ / use-before-declaration
  ordering within one scope), stop, record the case, and present options.

## Risks

- Risk: folding alias collection into the scope-threaded walk changes
  within-scope visibility ordering (the flat pre-pass made every alias visible
  body-wide, order-insensitively).
  Severity: medium. Likelihood: medium.
  Mitigation: compute each scope's *complete* own-alias set at scope entry
  (mirroring how `enterScope`/`collectOwnNamesForScope` collect all own names at
  entry), so within-scope resolution stays order-insensitive exactly as today.
  Pin the existing nested-block and argument-IIFE alias tests as regression
  guards before touching production code.

- Risk: shadow detection by naive set-difference (`child.boundNames \
  parent.boundNames`) misses a name that is *rebound* in a child scope while
  already present in an ancestor (defect (2) above).
  Severity: high. Likelihood: high if the difference shortcut is used.
  Mitigation: derive each scope's own bound names directly from the scope's own
  facts (the WI-1 seam), never by subtracting the inherited view. WI-1 unit
  tests assert own-name sets for a scope whose name also exists in an ancestor.

- Risk: the scope module could acquire knowledge of `Date`/`Math` (a layering
  violation) when exposing own initializers.
  Severity: low. Likelihood: low.
  Mitigation: the WI-1 seam returns generic `{ name, init }` pairs for simple
  `id = init` declarators; only the alias module classifies them as
  `Date`/`Math`/`globalThis` aliases via the existing
  `resolveGlobalObjectIdentity`.

- Risk: file-size limit breach when adding the scoped-view helpers.
  Severity: low. Likelihood: low.
  Mitigation: prefer extending existing collectors over new duplicated
  recursion; if a file approaches 400 lines, split the alias scope-view helpers
  into a focused sibling module and record the decision.

## Progress

- [x] WI-1: Expose a scope-owned binding-facts seam in
  `workflow-ast-scopes.ts` (own names + own simple initializers) and rebuild
  `rootScopeView`/`enterScope` on it, behaviour-preserving.
- [x] WI-2: Thread scope-precise alias views through the deterministic-time
  walk; replace the flat alias map with `rootAliasView`/`enterAliasScope`; add
  red-then-green scope-precision alias tests.
- [x] WI-3: Update the three rule-doc `Limitations` sections and the
  technical-design traversal note to describe scope-precise alias resolution.

## Surprises & discoveries

- Observation: the internal alias API
  (`collectDeterministicTimeAliases`, `aliasCallMatch`,
  `objectIdentityForExpression`, `memberExpressionFromCall`) is consumed only by
  `workflow-deterministic-time.ts`.
  Evidence: `grep -rn` across `src` for each symbol returns only the alias
  module and that one consumer.
  Impact: the refactor is fully contained; no public surface changes.

- Observation: adding this ExecPlan made `make all` fail the documentation
  contents freshness test until `docs/contents.md` linked
  `execplans/roadmap-3-1-6.md`.
  Evidence: scrutineer reported
  `documentation-contents.test.ts:91` missing
  `execplans/roadmap-3-1-6.md`.
  Impact: WI-1 includes the contents index update so the new plan is discoverable
  and the repository gate stays green.

- Observation: CodeRabbit was rate-limited twice before WI-1 review completed.
  Evidence: initial run returned `Rate limit exceeded` with `waitTime` of
  `4 minutes`; retry 1 returned `Rate limit exceeded` with `waitTime` of
  `1 minute`; after the mandated randomized `vsleep` backoffs of 89 and 69
  minutes, retry 2 completed with `findings:0`.
  Impact: no actionable CodeRabbit findings remain for WI-1.

- Observation: the WI-2 red tests reproduced the flat-alias defects exactly:
  sibling-scope member aliases produced two diagnostics, use-site shadowed
  member aliases produced one diagnostic, sibling parameter rebinding of a
  global-object alias produced one diagnostic, and the generated sibling
  property failed on the first generated name.
  Evidence: `bun test
  tests/static-analysis/workflow-deterministic-time-alias-scopes.test.ts`
  failed before the alias-view rewrite and passed afterwards.
  Impact: the new regression file directly proves the roadmap success cases.

- Observation: CodeRabbit's WI-2 review focused only on test assertion
  precision after the implementation was green.
  Evidence: review findings requested diagnostic shape snapshots, use of the
  scanned source text when comparing sibling locations, removal of an unused
  test-case `rule` field, removal of a redundant decoded-span assertion, and a
  comment explaining the intentionally restricted generated identifier domain.
  The final CodeRabbit pass completed with `findings:0`.
  Impact: no actionable CodeRabbit findings remain for WI-2.

- Observation: the three deterministic-time rule pages already documented
  scope-precise bare-root shadowing, so WI-3 only needed to remove the stale
  whole-body alias limitation and add a short alias-specific paragraph.
  Evidence: each `Limitations` section already said unrelated function, method,
  getter, or setter bindings no longer hide bare-root warnings.
  Impact: the documentation update is narrow and keeps the remaining
  conservative limits unchanged.

## Decision log

- Decision: adopt the scope-threaded alias-view design (Option B) rather than a
  scope-tagged flat map (Option C).
  Rationale: the roadmap explicitly requires "the same lexical scope model as
  bare `Date`, `Math`, and `globalThis` roots"; that model *is* the
  `rootScopeView` + `enterScope` threaded view established by task 3.1.5.
  Threading a paired `{ bindings, aliases }` context through the existing
  `traverseAstSubtree` walk reuses that model directly and needs no second scope
  representation. Date/Author: 2026-07-04, planning agent.

- Decision: derive per-scope shadow names from a dedicated own-facts seam, not
  from subtracting the inherited binding view.
  Rationale: set-difference silently misses re-shadowing of a name already bound
  in an ancestor (defect (2)); the own-facts seam is exact. Date/Author:
  2026-07-04, planning agent.

- Decision: keep `scopeOwnFacts` generic and return simple identifier
  initializers without deterministic-time classification.
  Rationale: this preserves the scope module's existing responsibility for
  lexical facts only; the alias module remains responsible for deciding whether
  an initializer is a `Date`, `Math`, or `globalThis` alias. Date/Author:
  2026-07-04, implementation agent.

- Decision: add the new ExecPlan to `docs/contents.md` in WI-1 rather than
  waiting for WI-3.
  Rationale: the repository's documentation freshness test treats every
  Markdown document under `docs/` as indexable source truth, so the contents
  update is required for the first atomic commit to pass `make all`.
  Date/Author: 2026-07-04, implementation agent.

- Decision: replace the flat `collectDeterministicTimeAliases` pre-pass with
  `rootAliasView` and `enterAliasScope`, and thread aliases alongside bindings
  through the existing deterministic-time AST walk.
  Rationale: computing each scope's aliases from `rootScopeOwnFacts` and
  `scopeOwnFacts` gives alias declarations, use-site shadows, and descendant
  visibility the same lexical model as bare global roots without introducing a
  second scope representation. Date/Author: 2026-07-04, implementation agent.

- Decision: keep the alias-scope test fixture focused on `odw/no-date-now`.
  Rationale: the behaviour under test is lexical alias visibility, not rule
  catalogue variation. Existing deterministic-time tests still cover
  `Math.random` and `new Date` alias shapes, while the new property tests pin
  sibling isolation for generated alias names. Date/Author: 2026-07-04,
  implementation agent.

- Decision: describe scoped alias resolution in each rule page as a separate
  paragraph before the remaining conservative limits.
  Rationale: alias handling is no longer a limitation, but users still need to
  know that same-named aliases in unrelated scopes no longer fabricate or hide
  warnings and use-site shadows stay suppressed. Date/Author: 2026-07-04,
  implementation agent.

## Outcomes & retrospective

WI-1 shipped the scope-owned facts seam without changing diagnostic behaviour.
`rootScopeOwnFacts` and `scopeOwnFacts` now expose each scope's own sorted names
and simple identifier initializers, while `rootScopeView` and `enterScope`
continue to return the same binding views verified by the existing scope tests.
Focused red/green evidence: the new tests first failed because
`rootScopeOwnFacts` and `scopeOwnFacts` were missing exports, then passed after
the seam was implemented. Deterministic proof after cleanup: scrutineer ran
`bun test tests/static-analysis/workflow-ast-scopes.test.ts`, `make all`,
`make markdownlint`, and `make nixie`; all passed. CodeRabbit review completed
with `findings:0` after the documented rate-limit backoffs.

WI-2 shipped scoped deterministic-time alias views. The detector now builds a
root alias view from root-owned initializers, enters child alias views with the
same traversal context as lexical bindings, removes shadowed alias names at
scope entry, and adds aliases declared directly in the child scope. The new
alias-scope regression file proves the three roadmap defects, descendant alias
visibility, same-scope alias calls, and generated sibling isolation. Focused
and wider proof after cleanup: scrutineer ran `bun test
tests/static-analysis/workflow-deterministic-time-alias-scopes.test.ts`, `bun
test tests/static-analysis/`, and `make all`; all passed. CodeRabbit initially
returned actionable test-hardening findings and one rate-limit response after a
fix round; after the required randomized backoff and all follow-up fixes, the
final CodeRabbit review completed with `findings:0`.

WI-3 updated the user-facing rule limitations and technical traversal note. The
three deterministic-time rule pages now state that alias declarations and alias
use resolve through the same lexical scope model as bare roots, and the stale
whole-body alias limitation was removed from the remaining-limit lists.
`docs/technical-design.md` now describes deterministic-time scanning as a
single `traverseAstSubtree` walk that threads both scope-narrowed binding and
alias views. Validation proof: scrutineer ran `make markdownlint`, `make
nixie`, and `make all`; all passed. CodeRabbit review completed with
`findings:0`.

## Context and orientation

The reader needs no prior plan. Key files, all under
`/data/leynos/Projects/odw-lint.worktrees/roadmap-3-1-6`:

- `src/static-analysis/workflow-deterministic-time.ts` — the detector.
  `scanDeterministicTimeWarnings` parses the normalized body, builds bindings,
  builds aliases, then `walkDeterministicTimeHazards` runs `traverseAstSubtree`
  starting from `rootScopeView(module)` and calls `enterScope(context, node)` at
  every node to thread the scope-narrowed binding view. Alias matching
  (`aliasCallMatch`, `objectIdentityForExpression`) currently receives one flat,
  scope-blind `aliases` map.
- `src/static-analysis/workflow-deterministic-time-aliases.ts` — alias
  collection and matching. `collectDeterministicTimeAliases` walks the whole
  module and returns `ReadonlyMap<string, DeterministicTimeAlias>` where an
  alias is either a member alias (`Date.now`/`Math.random`, carrying its
  `RuleId`) or a global-object alias (`Date`/`Math`/`globalThis`).
  `aliasForExpression`/`memberAliasForExpression` classify a declarator's
  initializer using `resolveGlobalObjectIdentity`. This is the module rewritten
  in WI-2.
- `src/static-analysis/workflow-ast-scopes.ts` — the lexical scope model.
  `rootScopeView(module)` returns the top-level `LexicalBindingFacts`
  (`{ boundNames }`); `enterScope(view, node)` returns a child view that is the
  parent's names *union* the scope's own names for scope-opening nodes
  (functions, methods, accessors, named class expressions, blocks, `for`,
  `catch`), or the same view otherwise. `collectOwnNamesForScope` /
  `collectOwnNamesFromNode` implement the scope-boundary recursion (stop at
  nested scope-opening nodes). This is the module extended in WI-1.
- `src/static-analysis/workflow-global-object-reference.ts` —
  `resolveGlobalObjectIdentity(node, bindings)` returns `"Date"`, `"Math"`,
  `"globalThis"`, or `undefined`, honouring lexical shadowing via
  `isIdentifierBound`; `resolveStaticMemberName` reads a static member key.
  Unchanged.
- `src/static-analysis/swc-ast.ts` — `traverseAstSubtree<Context>` threads a
  generic context to children; `astChildValues`/`isAstNode` are the shared shape
  helpers. Unchanged.

Terms of art:

- **Binding view** — a `LexicalBindingFacts` value (`{ boundNames }`)
  representing every name visible at a point in the walk.
- **Alias view** — a `DeterministicTimeAliases` map representing every
  deterministic-time alias visible at a point in the walk. New in WI-2; same
  type as today, but recomputed per scope instead of once.
- **Scope-opening node** — a node that introduces its own binding scope, per
  `isScopeOpeningNode` in `workflow-ast-scopes.ts`.
- **Own facts of a scope** — the names and simple `id = init` initializers
  declared *directly* in a scope, excluding anything inside a nested
  scope-opening node.

## Interfaces and dependencies

At the end of WI-1, `src/static-analysis/workflow-ast-scopes.ts` exports (names
indicative; keep them descriptive and en-GB):

```ts
// A simple `const/let/var <Identifier> = <init>` declarator owned by a scope.
export type ScopeOwnInitializer = {
  readonly name: string;
  readonly init: Expression;
};

// Names and simple initializers declared directly in one scope (no descent
// into nested scope-opening nodes).
export type ScopeOwnFacts = {
  readonly ownNames: readonly string[];
  readonly ownInitializers: readonly ScopeOwnInitializer[];
};

export const rootScopeOwnFacts = (module: Module): ScopeOwnFacts;
export const scopeOwnFacts = (node: Node): ScopeOwnFacts; // empty when not scope-opening
```

`rootScopeView` and `enterScope` are reimplemented to derive their `boundNames`
from `ownNames` (so a single scope-boundary recursion produces both facts), with
identical observable output.

At the end of WI-2, `src/static-analysis/workflow-deterministic-time-aliases.ts`
exports (replacing `collectDeterministicTimeAliases`):

```ts
export const rootAliasView = (
  module: Module,
  rootBindings: LexicalBindingFacts,
  rules: DeterministicTimeAliasRules,
): DeterministicTimeAliases;

export const enterAliasScope = (
  parentAliases: DeterministicTimeAliases,
  childBindings: LexicalBindingFacts,
  node: Node,
  rules: DeterministicTimeAliasRules,
): DeterministicTimeAliases;
```

`aliasCallMatch(node, aliases)`, `objectIdentityForExpression(expr, bindings,
aliases)`, and `memberExpressionFromCall(node)` keep their current signatures;
they now receive a scope-narrowed alias view. `enterAliasScope` semantics: for a
non-scope-opening node it returns `parentAliases` unchanged; for a scope-opening
node it (1) copies `parentAliases`, (2) deletes every name in
`scopeOwnFacts(node).ownNames` (shadow removal), then (3) classifies each
`ownInitializer` against `childBindings` with the existing `aliasForExpression`
and sets the surviving aliases. `rootAliasView` is the same construction from an
empty parent using `rootScopeOwnFacts(module)` and `rootBindings`.

`src/static-analysis/workflow-deterministic-time.ts` changes its traversal
context type from `LexicalBindingFacts` to `{ bindings: LexicalBindingFacts;
aliases: DeterministicTimeAliases }`. The initial context is `{ bindings:
rootScopeView(module), aliases: rootAliasView(module, rootScopeView(module),
rules) }`; each node returns `{ bindings: enterScope(ctx.bindings, node),
aliases: enterAliasScope(ctx.aliases, enterScope(ctx.bindings, node), node,
rules) }`. `matchDeterministicTimeHazard` reads `ctx.bindings` and `ctx.aliases`.

## Plan of work

### WI-1 — Scope-owned binding-facts seam (refactor, behaviour-preserving)

Implements the reusable seam that WI-2 needs, without changing any diagnostic.
Follows [technical-design.md](../technical-design.md) §6.1 (shared traversal
seam) and §6.2 (static source model), AGENTS.md "Refactoring Heuristics &
Workflow" (separate atomic refactor) and the abstraction/helper policy (extend
the existing scope-boundary recursion rather than duplicate it).

Docs to read: [technical-design.md](../technical-design.md) §§6.1-6.2, 9.2;
AGENTS.md "TypeScript Guidance" and "Refactoring Heuristics & Workflow";
[complexity-antipatterns-and-refactoring-strategies.md](../complexity-antipatterns-and-refactoring-strategies.md)
(avoid duplicated traversal, keep functions small).
Skills to load: `leta` (navigate `workflow-ast-scopes.ts` and its callers),
`python-router` is **not** relevant; load nothing Python. This is TypeScript —
follow AGENTS.md "TypeScript Guidance"; use `biomejs` skill conventions for
formatting/lint expectations.

Stages:

1. Stage A (understand): confirm the two consumers of `rootScopeView`/
   `enterScope` and that `collectOwnNamesForScope`/`collectOwnNamesFromNode`
   already isolate a scope's own declarations. No code change.
2. Stage B (red): add unit tests to
   `tests/static-analysis/workflow-ast-scopes.test.ts` asserting the new
   `scopeOwnFacts`/`rootScopeOwnFacts` output: own names for a function whose
   name also exists at the root (shadow case), own simple initializers for
   `const D = Date`, and *exclusion* of names/initializers declared in a nested
   inner function/block. Run the focused file and observe the expected
   `undefined`/compile failures (the exports do not exist yet).
3. Stage C (green): add the `ScopeOwnFacts` seam; refactor `rootScopeView`/
   `enterScope` to derive `boundNames` from `ownNames`. Keep the existing
   scope-boundary recursion as the single source of truth.
4. Stage D (refactor/cleanup): ensure `workflow-ast-scopes.ts` stays under 400
   lines and functions stay small; re-run gates.

Tests (per AGENTS.md "Testing"):

- Unit: extend `tests/static-analysis/workflow-ast-scopes.test.ts` with
  `scopeOwnFacts`/`rootScopeOwnFacts` cases (happy path, ancestor-shadowed name,
  nested-scope exclusion, non-scope-opening node returns empty). Use the file's
  existing `nodeOfType`/`userStatementOfType` helpers.
- Regression: the existing `rootScopeView`/`enterScope` assertions must pass
  unchanged (proves behaviour preservation).

Acceptance: `make all` passes; the new unit cases fail before Stage C and pass
after.

### WI-2 — Scope-precise alias views through the walk

Implements the roadmap behaviour. Follows
[technical-design.md](../technical-design.md) §9.2 (deterministic-time rules)
and §6.1 (traversal seam), ADR 0002 (ECMAScript dialect), and AGENTS.md
"TypeScript Guidance" (discriminated unions, small functions, immutability).

Docs to read: [technical-design.md](../technical-design.md) §§6.1, 9.2;
[adr/0002-workflow-body-parser-dialect-scope.md](../adr/0002-workflow-body-parser-dialect-scope.md);
`docs/rules/no-date-now.md`, `docs/rules/no-math-random.md`,
`docs/rules/no-argless-new-date.md` (current alias limitations);
[developers-guide.md](../developers-guide.md) and
[scripting-standards.md](../scripting-standards.md) for scanner conventions.
Skills to load: `leta` (references/callers of the alias API);
`hypothesis`/`crosshair`/`mutmut` are Python-only — **do not** load them here.
For property testing use `fast-check`, already used by
`tests/static-analysis/workflow-deterministic-time-scopes.test.ts`
(`SOURCE_SPAN_PROPERTY_RUNNER`); follow that file as the pattern. Use the
`biomejs` skill's expectations for formatting/lint.

Stages:

1. Stage A (understand): re-read the flat collector and the three defect
   scenarios in `Purpose`. No code change.
2. Stage B (red): add a new test file
   `tests/static-analysis/workflow-deterministic-time-alias-scopes.test.ts`
   (mirroring `workflow-deterministic-time-scopes.test.ts`'s `scanBody`/
   `expectSingleSpan` helpers) encoding:
   - defect (1) sibling-scope member-alias leak → exactly one warning on `b`;
   - defect (2) use-site shadow of a member alias → zero warnings;
   - defect (3) global-object alias name rebound as a sibling parameter → zero
     warnings;
   - positive nested visibility: `const now = Date.now;\nfunction f() { return
     now(); }` → one warning inside `f`;
   - positive same-scope regression: `const now = Date.now;\nconst t = now();`
     → one warning;
   - a `fast-check` property (using `SOURCE_SPAN_PROPERTY_RUNNER` and a
     non-`Date` identifier generator) asserting that a member alias declared in
     one function never produces a diagnostic in an unrelated sibling function
     that binds the same name to a non-alias.
   Run the focused file and observe the red failures described in `Purpose`
   (two-warning / one-warning outputs).
3. Stage C (green): rewrite `workflow-deterministic-time-aliases.ts` to expose
   `rootAliasView`/`enterAliasScope` (built on the WI-1 seam) and drop
   `collectDeterministicTimeAliases`; update `workflow-deterministic-time.ts` to
   thread the `{ bindings, aliases }` context pair. Keep `aliasForExpression`,
   `memberAliasForExpression`, `aliasCallMatch`, `objectIdentityForExpression`,
   and `memberExpressionFromCall` intact.
4. Stage D (refactor/cleanup): confirm both modified source files stay under 400
   lines; extract an alias scope-view helper into a focused sibling module only
   if needed to respect the limit (record in Decision Log). Re-run gates.

Tests (per AGENTS.md "Testing"):

- Unit + parameterized: the new
  `workflow-deterministic-time-alias-scopes.test.ts` (above).
- Property: the `fast-check` sibling-isolation property (above).
- Regression (must stay green unchanged): the existing
  `workflow-deterministic-time.test.ts` (including "collects deterministic-time
  aliases from nested blocks"),
  `workflow-deterministic-time-alias-arguments.test.ts` (argument-scoped IIFE
  aliases), `workflow-deterministic-time-scopes.test.ts`,
  `deterministic-time-spans.test.ts` and its snapshot, and
  `workflow-lint.test.ts`.

Acceptance: `make all` passes; the new alias-scope cases fail before Stage C and
pass after; no existing expected diagnostic changes.

### WI-3 — Documentation: rule limitations and traversal note

Follows AGENTS.md "Documentation Maintenance" and
[documentation-style-guide.md](../documentation-style-guide.md) (en-GB Oxford
spelling, 80-column prose wrap, 120-column code wrap).

Docs to read: [documentation-style-guide.md](../documentation-style-guide.md);
the three rule docs; [technical-design.md](../technical-design.md) §6.1.
Skills to load: `en-gb-oxendict` (spelling), `changelog` is not needed.

Changes:

- `docs/rules/no-date-now.md`, `docs/rules/no-math-random.md`,
  `docs/rules/no-argless-new-date.md`: in each `Limitations` section, replace
  the "whole-body alias suppression beyond one direct declaration" clause with
  wording stating that alias declaration and alias use now resolve through the
  same lexical scope model as bare roots — a same-named alias or rebinding in an
  unrelated scope no longer suppresses (or fabricates) a warning, and an alias
  shadowed at the use site stays suppressed. Keep the remaining conservative
  limits (dynamic computed keys; non-`globalThis` roots such as `window`,
  `self`, `global`).
- `docs/technical-design.md` §6.1 (lines ~128-131): update the sentence
  "The deterministic-time scanner and deterministic-time alias collector use the
  driver for full-subtree walks" to reflect that the alias resolver now threads
  scope-narrowed alias views through the same `traverseAstSubtree` walk as the
  scanner, alongside the binding view.

Tests/validation: `make markdownlint` and `make nixie` (no Mermaid changes
expected, but run `nixie` because Markdown changed), plus `make all` for the
whole gate.

Acceptance: `make markdownlint`, `make nixie`, and `make all` pass.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-3-1-6`.

WI-1:

```bash
bun test tests/static-analysis/workflow-ast-scopes.test.ts   # Stage B: expect red on new cases
# implement WI-1
bun test tests/static-analysis/workflow-ast-scopes.test.ts   # Stage C: expect green
make all
git add -A && git commit   # message per AGENTS.md commit format
```

WI-2:

```bash
bun test tests/static-analysis/workflow-deterministic-time-alias-scopes.test.ts   # Stage B: expect red
# implement WI-2
bun test tests/static-analysis/workflow-deterministic-time-alias-scopes.test.ts   # Stage C: expect green
bun test tests/static-analysis/                                                    # regression sweep
make all
git add -A && git commit
```

WI-3 (format only the files touched, then gate):

```bash
bunx mdtablefix docs/rules/no-date-now.md docs/rules/no-math-random.md \
  docs/rules/no-argless-new-date.md docs/technical-design.md \
  docs/execplans/roadmap-3-1-6.md
bunx markdownlint-cli2 --fix docs/rules/no-date-now.md docs/rules/no-math-random.md \
  docs/rules/no-argless-new-date.md docs/technical-design.md \
  docs/execplans/roadmap-3-1-6.md
make markdownlint
make nixie
make all
git add -A && git commit
```

Expected transcript shape for the WI-2 red run (illustrative):

```plaintext
(fail) argument-scoped deterministic-time alias scopes > suppresses a member
alias shadowed at the use site
  expected: [] , received: [ { rule: "odw/no-date-now", ... } ]
```

## Validation and acceptance

Quality criteria ("done"):

- Tests: `make test` (`bun test`) passes with the new alias-scope unit and
  property tests green; the three defect fixtures behave as in `Purpose`
  (defect (1) → one warning on `b`; defects (2) and (3) → `[]`); every existing
  deterministic-time, alias, scope, span-snapshot, and workflow-lint test passes
  unchanged.
- Lint: `make lint` (Biome + Oxlint) passes.
- Types: `make typecheck` (`tsc --noEmit`) passes.
- Format: `make check-fmt` passes.
- Full gate: `make all` passes (build, check-fmt, whitespace-hygiene, lint,
  typecheck, test).
- Markdown (WI-3): `make markdownlint` and `make nixie` pass.

Red-Green-Refactor evidence to record in `Progress`/`Outcomes`:

- WI-1 Red: `bun test tests/static-analysis/workflow-ast-scopes.test.ts` fails
  on the new `scopeOwnFacts` cases (symbol missing). Green: passes after the
  seam lands. Refactor: `make all` green.
- WI-2 Red: `bun test
  tests/static-analysis/workflow-deterministic-time-alias-scopes.test.ts` fails
  with the two-warning / one-warning outputs from `Purpose`. Green: passes after
  the scoped views land. Refactor: full `bun test
  tests/static-analysis/` and `make all` green.

## Idempotence and recovery

Every step is re-runnable. The test additions and the alias-module rewrite are
pure code; re-running `bun test` or `make all` has no side effects. If a work
item's gate fails, revert the working tree for that file set (`git checkout --
<paths>`) and retry within the iteration tolerance. No destructive or external
operations are involved. If churn from `bun fmt`/formatters touches unrelated
files, discard it with a named stash
(`git stash push -m 'df12-stash v1 task=3.1.6 kind=discard reason="formatter
churn"'`) rather than committing it.

## Artifacts and notes

Baseline before implementation (illustrative — capture the real output in
`Outcomes`): running `scanDeterministicTimeWarnings` on defect (1) currently
returns two `odw/no-date-now` diagnostics; on defects (2) and (3) it returns one
each. These are the regressions the change removes.

## Revision note

Round 1 (2026-07-04): initial DRAFT authored from direct inspection of the
worktree source (`workflow-deterministic-time.ts`,
`workflow-deterministic-time-aliases.ts`, `workflow-ast-scopes.ts`,
`workflow-global-object-reference.ts`, `swc-ast.ts`), the existing
deterministic-time/scope/alias tests, the three rule docs, roadmap lines
951-959, and [technical-design.md](../technical-design.md) §§6.1-6.2 and 9.2.
No prior design-review points to address.

## Addenda

- [ ] 3.1.6.1. Document deliberate initializer dropping in scope recursion.
  - Source: review:3.1.6; severity low.
  - Scope: add a brief code comment near the parameter and declarator-pattern
    recursion in `workflow-ast-scopes.ts` explaining why nested recursion uses a
    throwaway own-facts accumulator and intentionally discards simple
    initializers outside the current scope boundary.
  - Success: a maintainer can distinguish the deliberate initializer drop from
    a lost-alias defect, and existing scope and alias tests pass unchanged.
- [ ] 3.1.6.2. Split near-limit alias and scope-view helpers.
  - Source: review:3.1.6; severity low.
  - Scope: move alias or scope-view helper code out of
    `workflow-ast-scopes.ts` into a focused sibling module before the file-size
    guard forces the split during unrelated deterministic-time or
    orchestration-rule work.
  - Success: `workflow-ast-scopes.ts` has clear headroom under the 400-line
    limit, the ownership of the extracted helper module is documented by its
    module JSDoc, and existing deterministic-time diagnostics remain unchanged.
- [ ] 3.1.6.3. Document whole-scope alias and temporal dead-zone limits.
  - Source: review:3.1.6; severity low.
  - Scope: update the deterministic-time rule limitation lists to say alias
    visibility is computed per whole scope and remains conservative for
    use-before-declaration or temporal dead-zone ordering inside that scope.
  - Success: the three deterministic-time rule pages explain the remaining
    order-insensitive alias limitation without reintroducing the stale
    whole-body alias limitation.
- [ ] 3.1.6.4. Add block/for/catch alias-scope regression tests.
  - Source: audit:3.1.6; severity low.
  - Scope: add alias-scope regression cases for block, `for`, and `catch`
    scopes using the existing deterministic-time alias test harness.
  - Success: tests prove alias declarations and use-site shadows follow the
    shared lexical scope model across block, `for`, and `catch` scopes before
    later collector work touches the same scope machinery.
