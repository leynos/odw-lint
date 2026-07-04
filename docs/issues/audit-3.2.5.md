# Audit after roadmap task 3.2.5

This post-step audit was run after roadmap task 3.2.5, which consolidated the
shared SWC AST guard and child-traversal helpers into
`src/static-analysis/swc-ast.ts` and migrated the deterministic-time callers,
squash-merged into `origin/main` at commit `6f05294`. The audit used `grepai`
against the canonical `main` index for intent search, then verified every
branch-local fact in a fresh worktree off `origin/main` with `leta`, targeted
file inspection, and `sem` entity history.

Normative references used:

- `AGENTS.md`
- `docs/adr/0001-static-analysis-boundary.md`
- `docs/adr/0002-workflow-body-parser-dialect-scope.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/technical-design.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- `grepai`: canonical `main` intent search.
- `leta`: branch-local symbol and source navigation.
- `sem`: entity-level diff and blame inspection.

The 3.2.5 change extracted `isAstNode`, `astChildValues`, and an
`isUnknownRecord` re-export into `swc-ast.ts`, then pointed the
deterministic-time scanner, the deterministic-time alias collector, and the
global-object resolver at those helpers. It answered the 3.1.4 audit's Finding 3
(re-implemented guards) and part of its Finding 4 (hand-rolled traversal). The
findings below concentrate on what the consolidation left unfinished: the
recursive traversal *driver* is still duplicated, the lexical binding collector
never adopted the seam, and one of the two surviving copies of the walker
diverges in a way that silently drops a class of deterministic-time hazards.

## Finding 1: alias collector skips argument-wrapper records

Category: inconsistency

Severity: medium

Location:

- `src/static-analysis/workflow-deterministic-time-aliases.ts:148`
- `src/static-analysis/workflow-deterministic-time.ts:116`

Description:

The deterministic-time scanner walks the AST twice with two independent
recursive drivers. The hazard walker's `visitChildValue`
(`workflow-deterministic-time.ts:116`) has three recursion branches — AST node,
array, and non-node record — where the third branch exists specifically to
descend through SWC argument wrappers (its own comment reads "Visits nested SWC
nodes, including wrappers such as call arguments"). SWC models `CallExpression`
and `NewExpression` arguments as `{ spread?, expression }` wrapper records that
carry no `type` field, so `astChildValues` yields those wrapper records and only
the record branch reaches the argument expressions inside them.

The alias prepass driver `collectAliasesFromChild`
(`workflow-deterministic-time-aliases.ts:148`) has only the AST-node and array
branches; it lacks the non-node record branch. Consequently the alias collector
never descends into any call or `new` argument. Because
`collectDeterministicTimeAliases` runs as a whole-module prepass whose result
feeds `aliasCallMatch`, any deterministic-time alias declared inside an argument
expression is never recorded, and the later hazard walk — which *does* reach
that subtree — cannot classify the aliased call. The result is a false negative
for the very rules this module ships. For example:

```js
const timestamp = consume((() => {
  const now = Date.now;
  return now();
})());
```

Here `now()` is a live `Date.now` alias call, but `odw/no-date-now` emits
nothing: the alias `now` is declared inside the IIFE argument the alias
collector skips. The direct form `consume(Date.now())` is still caught, because
that path runs through the hazard walker's record branch (pinned by the test at
`tests/static-analysis/workflow-deterministic-time.test.ts:295`). The escape is
specific to the alias-through-argument path. The behaviour also contradicts the
collector's own contract: its documentation bounds alias handling to "direct
declarations" (no chained aliases), and the existing `nested-alias` test
confirms aliases are intentionally collected from nested scopes such as `if`
blocks, so argument scopes are an unintended gap rather than a deliberate bound.

Proposed fix:

Give `collectAliasesFromChild` the same non-node record branch as
`visitChildValue` (recurse through `astChildValues(value)` when
`isUnknownRecord(value)` holds), or, preferably, remove the divergence at its
root by adopting a single shared traversal driver (see Finding 3). Add the
regression coverage in Finding 2 alongside the fix.

## Finding 2: no test covers aliases nested inside argument wrappers

Category: test-gap

Severity: medium

Location:

- `tests/static-analysis/workflow-deterministic-time.test.ts:282`
- `tests/static-analysis/workflow-deterministic-time.test.ts:295`

Description:

The suite pins the hazard walker's argument-wrapper descent
(`consume(Date.now())` at line 295) and alias collection from nested `if` blocks
(line 282), but nothing exercises an alias *declaration* nested inside a call or
`new` argument. That is precisely the untested combination that lets Finding 1
regress silently: a change could break — or, as today, already have broken —
argument-scoped alias detection and CI would stay green.

Proposed fix:

Add positive cases to `workflow-deterministic-time.test.ts` that declare an
alias inside an argument-scoped IIFE and then call it, for each rule:

- `consume((() => { const now = Date.now; return now(); })())` expects one
  `odw/no-date-now` diagnostic.
- `consume((() => { const rand = Math.random; return rand(); })())` expects one
  `odw/no-math-random` diagnostic.

Assert both the rule identity and the reported span so the regression is pinned
the same way as the existing alias-call cases.

## Finding 3: the recursive AST-walk driver is still duplicated

Category: duplication

Severity: medium

Location:

- `src/static-analysis/workflow-deterministic-time.ts:99`
- `src/static-analysis/workflow-deterministic-time-aliases.ts:133`

Description:

The 3.1.4 audit's Finding 4 asked for a shared `forEachChildNode(node, visit)`
traversal primitive so the hazard walk and other collectors could be expressed
as visitors over one driver. Task 3.2.5 extracted the leaf helpers `isAstNode`
and `astChildValues` but stopped short of the driver: the recursive walk itself
is still hand-written twice. `visitNode`/`visitChildValue`
(`workflow-deterministic-time.ts:99`) and
`collectAliasesFromNode`/`collectAliasesFromChild`
(`workflow-deterministic-time-aliases.ts:133`) are the same pre-order,
node/array/record recursion differing only in the per-node action and — as
Finding 1 shows — in one accidentally-omitted branch. Keeping two copies is what
allowed the branches to drift apart, and any future SWC node-shape assumption
must be taught to both.

Proposed fix:

Add a single traversal primitive to `swc-ast.ts`, for example
`walkAstNodes(root: Node, visit: (node: Node) => void): void` (or a generator
`iterateAstNodes(root)`), that owns the node/array/record recursion over
`astChildValues`. Re-express the hazard walk as a visitor that pushes matches
and the alias prepass as a visitor that records declarators, deleting both
bespoke `*FromChild` recursions. This collapses the two drivers to one, closing
Finding 1 structurally and finishing the intent of 3.1.4 Finding 4.

## Finding 4: the binding collector never adopted the seam

Category: separation-of-concerns

Severity: medium

Location:

- `src/static-analysis/workflow-ast-bindings.ts:275`
- `src/static-analysis/workflow-ast-bindings.ts:13`
- `docs/technical-design.md:125`

Description:

`technical-design.md:125` states that the `swc-ast.ts` seam "owns the strict AST
node guard, semantic child-field traversal, and the record guard re-export
consumed by the deterministic-time scanner, deterministic-time alias collector,
global-object resolver, **and lexical binding collector**," and that keeping the
helpers in one module "prevents rule-local traversal drift." The lexical binding
collector only partly matches that claim. `workflow-ast-bindings.ts` imports
just `isUnknownRecord` from the seam; it neither uses `isAstNode` nor
`astChildValues`. Its child recursion, `collectChildBindings`
(`workflow-ast-bindings.ts:275`), is a bespoke `Object.values(node)` walk that
visits every field — including the `span`, `type`, and `ctxt` bookkeeping fields
that `astChildValues` deliberately excludes — and it carries its own local
`AstNode` shape type (`workflow-ast-bindings.ts:13`) parallel to the `@swc/core`
`Node` used elsewhere. The module therefore still has exactly the rule-local
traversal the design note says the seam prevents, and the note overstates the
consolidation's reach.

Proposed fix:

Either finish the migration — replace `collectChildBindings`'s `Object.values`
recursion with the shared traversal primitive from Finding 3 (or at least
`astChildValues`) and reconcile the local `AstNode` type against the seam's node
guard — or, if the binding collector's field-visiting semantics are
intentionally broader, narrow the `technical-design.md` claim to say the binding
collector consumes only the record guard and keeps its own traversal for a
stated reason. Prefer the migration so the design note stays literally true.

## Finding 5: single-type node narrowers are re-implemented

Category: duplication

Severity: low

Location:

- `src/static-analysis/workflow-deterministic-time-aliases.ts:243`
- `src/static-analysis/workflow-deterministic-time-aliases.ts:248`
- `src/static-analysis/workflow-deterministic-time-aliases.ts:253`
- `src/static-analysis/workflow-global-object-reference.ts:131`
- `src/static-analysis/workflow-global-object-reference.ts:141`

Description:

3.2.5 shared the two structural guards (`isAstNode`, `isUnknownRecord`) but left
a family of near-identical single-type narrowers scattered across the modules
that now import the seam. `isMemberExpression` is defined in both
`workflow-deterministic-time-aliases.ts:248` and
`workflow-global-object-reference.ts:136`; `isExpression` is defined in both
(`aliases.ts:253`, `global-object-reference.ts:141`) and is byte-identical —
`(value) => isAstNode(value)` — in each. `isIdentifier` is defined in both files
too, but with divergent contracts: in `aliases.ts:243` it accepts `unknown`
(`isAstNode(value) && value.type === "Identifier"`), while in
`global-object-reference.ts:131` it accepts a `Node` and only checks
`node.type === "Identifier"`. Same name, two shapes, is a readability hazard for
an auditor tracing shadow logic across the two modules.

Proposed fix:

Add a small typed narrower to `swc-ast.ts`, for example
`isNodeOfType<T extends Node["type"]>(value: unknown, type: T)`, and derive the
per-type guards (`Identifier`, `MemberExpression`, `CallExpression`) from it, or
export the concrete narrowers directly. Replace the module-local copies and drop
the trivial `isExpression` aliases in favour of `isAstNode`. This removes the
duplicate definitions and eliminates the two-contract `isIdentifier` ambiguity.
