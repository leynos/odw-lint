# Audit after roadmap task 3.2.6

This post-step audit was run after roadmap task 3.2.6, "Complete SWC traversal
adoption", squash-merged into `origin/main` at commit `92861ca`. That change
added a generic pre-order `traverseAstSubtree` driver to
`src/static-analysis/swc-ast.ts` and adopted it in the deterministic-time
scanner and the deterministic-time alias collector, pointed the scope and
lexical-binding collectors at `astChildValues`, and reconciled
`docs/technical-design.md` and `docs/developers-guide.md` to describe the seam.

The audit verified every branch-local fact in a fresh worktree off
`origin/main` (branch `worktree-audit-3.2.6`, base commit `92861ca`) with
targeted file inspection, `grep`, and `git show` entity history. It confirms
that 3.2.6 closed the 3.2.5 audit's Finding 1 (the alias collector now descends
argument-wrapper records through the shared driver) and Finding 3 (the two
hand-rolled hazard/alias drivers collapsed to one `traverseAstSubtree`). The
findings below concentrate on what 3.2.6 left unfinished: the argument-scoped
alias behaviour it just fixed is still unpinned by any test, a fresh block of
verbatim duplication now spans the two closely related binding collectors, and
the divergent single-type narrowers the 3.2.5 audit flagged remain in place.

Normative references used:

- `AGENTS.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/technical-design.md`
- `docs/issues/audit-3.2.5.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- Branch-local file inspection and `git show`: source and entity-history
  verification.

Tooling note: `grepai` intent search and the `git-donkey`/`git`/`leta` network-
and write-backed commands were unavailable in this agent session (each was
auto-denied by the sandbox permission layer). The fresh inspection worktree was
therefore created with the harness `EnterWorktree` mechanism off `origin/main`,
and every finding below is grounded in direct branch-local file inspection
rather than the canonical `main` `grepai` index.

## Finding 1: body-extraction and identifier helpers are duplicated verbatim across the two binding collectors

Category: duplication

Severity: medium

Location:

- `src/static-analysis/workflow-ast-bindings.ts:70`
- `src/static-analysis/workflow-ast-bindings.ts:82`
- `src/static-analysis/workflow-ast-bindings.ts:200`
- `src/static-analysis/workflow-ast-bindings.ts:207`
- `src/static-analysis/workflow-ast-scopes.ts:207`
- `src/static-analysis/workflow-ast-scopes.ts:219`
- `src/static-analysis/workflow-ast-scopes.ts:237`
- `src/static-analysis/workflow-ast-scopes.ts:252`

Description:

`workflow-ast-bindings.ts` (the flat lexical-binding collector) and
`workflow-ast-scopes.ts` (the scope-bounded binding view) are sibling modules
that already share their leaf helpers through `workflow-ast-binding-patterns.ts`
(`asNode`, `arrayValue`, `identifierName`, `collectPatternBindings`,
`collectFunctionParamBindings`, and the `AstNode` type). Yet four supporting
constructs remain copied byte-for-byte into both files rather than living in
that shared module:

- `userBodyStatements` (`workflow-ast-bindings.ts:70`,
  `workflow-ast-scopes.ts:207`) — identical.
- `syntheticWrapperBody` (`workflow-ast-bindings.ts:82`,
  `workflow-ast-scopes.ts:219`) — identical, including the three-branch guard on
  `module.body.length`, `FunctionDeclaration`, and the
  `WORKFLOW_BODY_WRAP_FUNCTION_NAME` identifier.
- `addIdentifierBinding` (`workflow-ast-bindings.ts:200`,
  `workflow-ast-scopes.ts:237`) — identical.
- `compareIdentifierNames` (`workflow-ast-bindings.ts:207`,
  `workflow-ast-scopes.ts:252`) — identical, and the guarding constant
  `EXCLUDED_BINDING_NAMES` (`workflow-ast-bindings.ts:22`,
  `workflow-ast-scopes.ts:18`) is likewise duplicated.

This is roughly forty lines of exact-copy logic split across two files. It is
precisely the "rule-local traversal drift" that `technical-design.md` says the
shared `swc-ast.ts` seam exists to prevent, reproduced one layer up in the
binding collectors: a future change to the synthetic-wrapper detection or the
excluded-name policy must be applied to both copies, and a change applied to
only one will diverge silently because no test compares the two.
`compareIdentifierNames` also reimplements a total string comparator that a
single shared helper (or `Array.prototype.sort`'s default lexical order over
strings) could supply.

Proposed fix:

Hoist the four helpers and `EXCLUDED_BINDING_NAMES` into the existing shared
`workflow-ast-binding-patterns.ts` module (or a small new
`workflow-ast-body.ts`) and import them from both collectors. Export
`userBodyStatements`/`syntheticWrapperBody` as the single source of synthetic
wrapper-body extraction, and expose one `addIdentifierBinding` and one
identifier comparator. This removes the verbatim copies without disturbing the
two collectors' deliberately distinct recursion policies.

## Finding 2: the argument-scoped alias behaviour fixed by 3.2.6 is still unpinned by any test

Category: test-gap

Severity: medium

Location:

- `tests/static-analysis/workflow-deterministic-time.test.ts:295`
- `src/static-analysis/workflow-deterministic-time-aliases.ts:64`

Description:

The 3.2.5 audit's Finding 1 showed that the alias prepass silently skipped
alias declarations nested inside call or `new` argument wrappers, and its
Finding 2 asked for a regression test covering that path. Task 3.2.6 fixed the
code by routing `collectDeterministicTimeAliases`
(`workflow-deterministic-time-aliases.ts:64`) through the shared
`traverseAstSubtree` driver, which carries the non-node record branch that
descends argument wrappers. The behaviour is therefore now correct — but the
requested regression test was never added. The suite still pins only the
*direct* argument-wrapper hazard `consume(Date.now())`
(`workflow-deterministic-time.test.ts:295`); a search for an alias *declared*
inside an argument-scoped IIFE and then called returns nothing. The exact
behaviour 3.2.6 just repaired is thus unguarded, so a future traversal change
could silently reintroduce the false negative with CI staying green.

Proposed fix:

Add positive cases to `workflow-deterministic-time.test.ts` that declare an
alias inside an argument-scoped IIFE and then call it, asserting both rule
identity and reported span, for each deterministic-time rule:

```js
// expects one odw/no-date-now diagnostic on `now`
const timestamp = consume((() => { const now = Date.now; return now(); })());
// expects one odw/no-math-random diagnostic on `rand`
const value = consume((() => { const rand = Math.random; return rand(); })());
```

Pin these the same way the existing alias-call cases are pinned, so the
argument-scoped path is regression-protected.

## Finding 3: divergent single-type narrowers remain duplicated across two modules

Category: duplication

Severity: low

Location:

- `src/static-analysis/workflow-deterministic-time-aliases.ts:214`
- `src/static-analysis/workflow-deterministic-time-aliases.ts:219`
- `src/static-analysis/workflow-deterministic-time-aliases.ts:224`
- `src/static-analysis/workflow-global-object-reference.ts:131`
- `src/static-analysis/workflow-global-object-reference.ts:136`
- `src/static-analysis/workflow-global-object-reference.ts:141`

Description:

The 3.2.5 audit's Finding 5 flagged a family of near-identical single-type
narrowers left scattered across the modules that consume the `swc-ast.ts` seam;
3.2.6 did not touch these files, so the finding persists unchanged.
`isExpression` is byte-identical — `(value) => isAstNode(value)` — in both
`workflow-deterministic-time-aliases.ts:224` and
`workflow-global-object-reference.ts:141`. `isMemberExpression` is defined in
both (`aliases.ts:219`, `global-object-reference.ts:136`), differing only in
the guard's declared parameter type (`unknown` plus an `isAstNode` check versus
`Expression | Node` plus a bare `type` check). `isIdentifier` is defined in
both too, but with genuinely divergent contracts: `aliases.ts:214` accepts
`unknown` (`isAstNode(value) && value.type === "Identifier"`) while
`global-object-reference.ts:131` accepts `Expression | Node` and only checks
`node.type === "Identifier"`. Same names, two shapes, is a readability hazard
for anyone tracing narrowing logic across the two modules and a maintenance
trap if the two `isIdentifier` contracts are ever assumed interchangeable.

Proposed fix:

Add one typed narrower to `swc-ast.ts`, for example
`isNodeOfType<T extends Node["type"]>(value: unknown, type: T)`, and derive the
per-type guards (`Identifier`, `MemberExpression`, `CallExpression`) from it,
or export the concrete narrowers directly. Replace the module-local copies,
drop the trivial `isExpression` aliases in favour of `isAstNode`, and settle
`isIdentifier` on a single `unknown`-accepting contract so the two modules
share one definition.

## Summary of prior-audit status

For continuity with `docs/issues/audit-3.2.5.md`:

- 3.2.5 Finding 1 (alias collector skips argument-wrapper records):
  **closed** by 3.2.6 — the alias collector now walks through
  `traverseAstSubtree`, which descends non-node record wrappers.
- 3.2.5 Finding 2 (no test for argument-scoped aliases): **open** — carried
  forward as Finding 2 above.
- 3.2.5 Finding 3 (duplicated recursive driver): **closed** by 3.2.6 — both
  drivers collapsed onto `traverseAstSubtree`.
- 3.2.5 Finding 4 (binding collector never adopted the seam): **substantially
  addressed** — `workflow-ast-bindings.ts` now uses `astChildValues` in
  `collectChildBindings`, and `technical-design.md` was reconciled to describe
  the collector's distinct type-dispatched policy accurately.
- 3.2.5 Finding 5 (duplicate single-type narrowers): **open** — carried forward
  as Finding 3 above.
