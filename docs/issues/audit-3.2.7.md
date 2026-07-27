# Audit after roadmap task 3.2.7

This post-step audit was run after roadmap task 3.2.7, "Reconcile scope-owned
facts with public binding facts", squash-merged into `origin/main` at commit
`0379eae`. That change extracted scope-owned declaration collection into
`src/static-analysis/workflow-ast-scope-own-facts.ts`, added
`enterScopeWithOwnFacts` and `enterAliasScopeWithOwnFacts` so the
deterministic-time scanner computes each scanner node's scope-owned facts once
and shares them between the binding and alias scope entries, aligned
object-literal accessor handling between the public flat binding facts and the
internal scope model, and reconciled `docs/developers-guide.md` and
`docs/technical-design.md` to describe the shared scope-owned model.

The audit verified every branch-local fact in a fresh worktree off
`origin/main` (branch `worktree-df12-audit-3.2.7`, base commit `0379eae`) with
targeted file inspection, `grep`, and `git show` entity history.

It confirms that 3.2.7 (together with 3.2.5.3 and 3.2.6.2) closed all three
findings carried by `docs/issues/audit-3.2.6.md`: the verbatim binding-helper
duplication is gone (the helpers now live once in
`workflow-ast-binding-patterns.ts`), the argument-scoped alias path is now
regression-pinned by `workflow-deterministic-time-alias-arguments.test.ts`, and
the divergent single-type narrowers in `workflow-deterministic-time-aliases.ts`
and `workflow-global-object-reference.ts` now import the unified guards from the
`swc-ast.ts` seam. The findings below concentrate on what the reconciliation
left behind: a fresh single-type narrower copy that re-entered the codebase in
the new scope-owned-facts module, the architecture guard that failed to catch
it, two now-orphaned scope-entry wrappers kept alive only by their tests, and
the unlinked node-type enumerations the two binding collectors still maintain
in parallel.

Normative references used:

- `AGENTS.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/technical-design.md`
- `docs/issues/audit-3.2.6.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- Branch-local file inspection, `grep`, and `git show`: source and
  entity-history verification.

Tooling note: `grepai` intent search and the `git-donkey`/`git`/`leta` network-
and write-backed commands were unavailable in this agent session (each was
auto-denied by the sandbox permission layer). The fresh inspection worktree was
therefore created with the harness `EnterWorktree` mechanism off `origin/main`,
and every finding below is grounded in direct branch-local file inspection
rather than the canonical `main` `grepai` index.

## Finding 1: a private `isExpression` narrower re-entered the codebase outside the SWC seam

Category: duplication

Severity: low

Location:

- `src/static-analysis/workflow-ast-scope-own-facts.ts:182`
- `src/static-analysis/swc-ast.ts:36`

Description:

Task 3.2.5.3 unified the single-type SWC narrowers behind the `swc-ast.ts`
seam, and `docs/issues/audit-3.2.6.md` Finding 3 tracked the last module-local
copies until they too were pointed at the seam. The new
`workflow-ast-scope-own-facts.ts` module, added during the 3.2.x
reconciliation, reintroduces one of those copies:

```ts
/** Narrows unknown values to SWC expression-shaped objects. */
const isExpression = (value: unknown): value is Expression => {
  return isAstNode(value);
};
```

This is byte-identical to the seam's exported narrower (`swc-ast.ts:36`), and
the module already imports `isAstNode` from `swc-ast` on line 10, so the local
definition adds nothing but a second place to keep the `Expression` narrowing
contract correct. It is exactly the "rule-local shape helper" duplication that
the seam and its architecture guard exist to prevent, reproduced in the module
that the reconciliation introduced.

Proposed fix:

Delete the local `isExpression` and import `isExpression` from `./swc-ast`
alongside the existing `astChildValues`/`isAstNode` import. No behaviour
changes, and the module then narrows expressions through the single seam
contract like its siblings.

## Finding 2: the SWC-seam architecture guard cannot see cloned single-type narrowers

Category: test-gap

Severity: medium

Location:

- `tests/diagnostics/architecture.test.ts:20`
- `tests/diagnostics/architecture.test.ts:52`

Description:

The guard that keeps SWC shape helpers behind the seam
(`privateSwcHelperDeclarations`) matches declarations against a hard-coded name
allowlist:

```ts
const PRIVATE_SWC_HELPER_DECLARATION_NAMES = new Set([
  "childRecordValues",
  "childValues",
  "isAstNode",
  "isNode",
  "isTraversableChildKey",
]);
```

That set omits `isExpression`, `isIdentifier`, and `isMemberExpression` — the
three single-type narrowers 3.2.5.3 unified onto the seam. Because the guard
keys on names it already knows about rather than on the *shape* of a narrower,
Finding 1's cloned `isExpression` sails past it: the suite stays green while a
duplicate seam helper lives outside the seam. The traversal-driver half of the
same suite already keys on shape (`genericSwcTraversalDeclarations` /
`hasGenericSwcTraversalShape`), so the narrower half is the weaker guard, and
it is the one that regressed. This is a guard that gives false confidence about
the very invariant 3.2.5.3 established.

Proposed fix:

Add a shape-based detector for single-type narrowers, mirroring
`hasGenericSwcTraversalShape`: flag any non-seam top-level declaration whose
body is `isAstNode(value)` or
`isAstNode(value) && <node>.type === "<Literal>"`, since those are precisely
the guards that belong on the seam. Keep the name allowlist as a fast path if
desired, but drive the assertion from the structural check so a renamed or
freshly cloned narrower is caught. Re-run the suite to confirm it now flags
Finding 1 before that finding is fixed.

## Finding 3: `enterScope` and `enterAliasScope` are orphaned production helpers kept alive only by tests

Category: separation-of-concerns

Severity: low

Location:

- `src/static-analysis/workflow-ast-scopes.ts:34`
- `src/static-analysis/workflow-deterministic-time-aliases.ts:69`
- `tests/diagnostics/architecture.test.ts:218`

Description:

3.2.7 split scope entry into a "compute own facts" step (`scopeOwnFacts`) and a
"apply own facts" step (`enterScopeWithOwnFacts` /
`enterAliasScopeWithOwnFacts`) so the deterministic-time scanner computes each
node's scope-owned facts exactly once. The scanner's
`enterDeterministicTimeScope` now calls only the `*WithOwnFacts` variants, and
the architecture suite pins that intent by asserting zero `enterScope` and
`enterAliasScope` calls (`architecture.test.ts:218`-`219`).

The consequence is that the original one-shot wrappers `enterScope`
(`workflow-ast-scopes.ts:34`) and `enterAliasScope`
(`workflow-deterministic-time-aliases.ts:69`) now have no production caller —
neither is re-exported from `src/static-analysis/index.ts`, and a repository
search finds them only in their own definition sites and in test files. They
survive purely as test conveniences that recompute `scopeOwnFacts` internally,
yet their doc comments still describe a "candidate SWC node being entered by
the scanner walk", implying a production role the scanner no longer plays.
Dead-ish internal helpers whose documentation overstates their use are a
maintenance and comprehension hazard: a reader tracing the scanner walk is led
to the wrong functions.

Proposed fix:

Prefer removing `enterScope` and `enterAliasScope` and updating their tests to
compose `scopeOwnFacts(node)` with `enterScopeWithOwnFacts` /
`enterAliasScopeWithOwnFacts` directly — that is exactly what the scanner does,
so the tests would then exercise the production path rather than a parallel
shim. If the one-shot wrappers are retained deliberately as a public
convenience seam, re-word their doc comments to state that they are standalone
helpers (not the scanner walk path) and add a short note explaining why the
scanner uses the `*WithOwnFacts` variants instead, so the split is legible.

## Finding 4: the two binding collectors enumerate scope and accessor node types in unlinked lists

Category: similarity

Severity: low

Location:

- `src/static-analysis/workflow-ast-bindings.ts:24`
- `src/static-analysis/workflow-ast-scope-own-facts.ts:24`

Description:

The flat lexical-binding collector and the scope-owned-facts collector are
sibling modules with deliberately distinct recursion policies (whole-body
versus scope-bounded), and 3.2.7 was careful to align their object-literal
accessor handling. Their shared leaf helpers already live in
`workflow-ast-binding-patterns.ts`. What remains split is the *enumeration* of
which node types are function-like scopes and object accessors:

- `workflow-ast-bindings.ts:24` lists them as keys of the
  `STATEMENT_BINDING_COLLECTORS` lookup table (`Constructor`, `ClassMethod`,
  `PrivateMethod`, `SetterProperty`, `MethodProperty`, …).
- `workflow-ast-scope-own-facts.ts:24` lists an overlapping-but-not-identical
  set in `FUNCTION_LIKE_SCOPE_TYPES` (which additionally includes
  `GetterProperty`, absent from the flat map because a getter binds no
  parameters).

The two sets are consistent today, but nothing links them: a future SWC node
type for a new accessor or scope form (or a rename in `@swc/core`) must be
reflected in two unrelated literals in two files, and a change to only one
would diverge silently because no test compares them. This is the same
"parallel-structure drift" class the seam work has been eliminating one layer
down, still present at the node-type-classification layer.

Proposed fix:

Introduce a single shared classification of function-like and accessor scope
node types in `workflow-ast-binding-patterns.ts` (for example an exported
`FUNCTION_LIKE_SCOPE_TYPES` set plus a documented note on why the flat
collector omits parameter-less accessors), and derive both collectors'
behaviour from it. If the two collectors genuinely need different sets, add a
small parity test that asserts the intended relationship between them (for
example, that the flat map's function-like keys are exactly the scope set minus
the parameter-less accessors), so the divergence is intentional and guarded
rather than incidental.

## Summary of prior-audit status

For continuity with `docs/issues/audit-3.2.6.md`:

- 3.2.6 Finding 1 (verbatim duplication of `userBodyStatements`,
  `syntheticWrapperBody`, `addIdentifierBinding`, `compareIdentifierNames`, and
  `EXCLUDED_BINDING_NAMES`): **closed** — all now live once in
  `workflow-ast-binding-patterns.ts` and are imported by both collectors.
- 3.2.6 Finding 2 (no test for argument-scoped aliases): **closed** —
  `tests/static-analysis/workflow-deterministic-time-alias-arguments.test.ts`
  pins both the `Date.now` and `Math.random` argument-scoped IIFE paths.
- 3.2.6 Finding 3 (divergent single-type narrowers): **closed** for
  `workflow-deterministic-time-aliases.ts` and
  `workflow-global-object-reference.ts`, which now import `isExpression`,
  `isIdentifier`, and `isMemberExpression` from `swc-ast.ts`. A fresh copy of
  `isExpression` re-entered the new `workflow-ast-scope-own-facts.ts` module
  and is carried forward as Finding 1 above, with the guard gap that allowed it
  as Finding 2.
