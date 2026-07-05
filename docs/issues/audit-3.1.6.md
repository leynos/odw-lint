# Audit after roadmap task 3.1.6

This post-step audit was run after roadmap task 3.1.6, which extended
deterministic-time alias declaration and alias-use resolution onto the lexical
scope model, merged into `origin/main` at commit `05822f1`. The audit used
`grepai` against the canonical `main` index for intent search, then verified
every branch-local fact in a fresh worktree off `origin/main` with `leta`,
targeted file inspection, and `sem` entity history.

Normative references used:

- `AGENTS.md`
- `docs/adr/0001-static-analysis-boundary.md`
- `docs/adr/0002-workflow-body-parser-dialect-scope.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/scripting-standards.md`
- `docs/technical-design.md`
- `docs/execplans/roadmap-3-1-6.md`
- `docs/issues/audit-3.1.5.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- `grepai`: canonical `main` intent search.
- `leta`: branch-local symbol and source navigation.
- `sem`: entity-level diff and blame inspection.

The 3.1.6 change reworked `workflow-ast-scopes.ts` so both binding and alias
views draw on the same `scopeOwnFacts` model, rewired
`workflow-deterministic-time-aliases.ts` to build per-scope alias views
(`rootAliasView`/`enterAliasScope`), and threaded scope-precise alias
resolution through `scanDeterministicTimeWarnings`. This resolves Finding 5 of
`audit-3.1.5.md`: aliases such as `const D = Date; D.now()` now obey sibling,
descendant, and use-site shadowing boundaries, and the alias pass no longer
consumes the flat whole-body binding set. The findings below concentrate on the
newly merged surface and on regressions or gaps that 3.1.6 introduced or left
open.

## Finding 1: Rule docs still list block/`for`/`catch` shadowing as a limitation

Category: docs-gap

Severity: medium

Location:

- `docs/rules/no-date-now.md:58`
- `docs/rules/no-math-random.md:60`
- `docs/rules/no-argless-new-date.md:59`

Description:

All three deterministic-time rule docs, including the copy the 3.1.6 commit
touched, still list "block, `for`, and `catch` shadows attributed to the
enclosing function scope" among the remaining conservative limits. That
attribution stopped being true at roadmap task 3.1.5.1, which added
block/`for`/`catch`-precise shadowing. `workflow-ast-scopes.ts:33` now treats
`BlockStatement`, `CatchClause`, `ForInStatement`, `ForOfStatement`, and
`ForStatement` as scope-opening nodes (`BLOCK_LIKE_SCOPE_TYPES`), and
`tests/static-analysis/workflow-deterministic-time-scopes.test.ts:181` asserts
that a sibling use outside a block/`for`/`catch` shadow is reported while the
in-scope use is suppressed. The docs therefore understate the tool: a user
reading the limitation would expect a `for (let Date = ...) {}` shadow to
silence a later top-level `Date.now()`, which the scanner correctly does not do.
The 3.1.6 edit refreshed the adjacent alias-limitation paragraph but left the
stale block clause in place.

Proposed fix:

Remove the "block, `for`, and `catch` shadows attributed to the enclosing
function scope" clause from the "Limitations" section of all three rule docs,
leaving the still-accurate limits (dynamic computed keys, non-`globalThis`
roots, and — for `no-argless-new-date` — optional chaining around constructor
forms). Optionally add a sentence noting that block, `for`, and `catch` shadows
are now honoured at the use site, mirroring the alias paragraph. Re-run
`make markdownlint` on the edited files.

## Finding 2: `scopeOwnFacts` is recomputed twice for every scope-opening node

Category: complexity

Severity: medium

Location:

- `src/static-analysis/workflow-deterministic-time.ts:138`
- `src/static-analysis/workflow-ast-scopes.ts:84`
- `src/static-analysis/workflow-deterministic-time-aliases.ts:83`

Description:

`enterDeterministicTimeScope` enters the binding scope and the alias scope for
each visited node in two independent calls. `enterScope`
(`workflow-ast-scopes.ts:77`) calls `scopeOwnFacts(scopeNode)` to read
`ownNames`, and `enterAliasScope` (`workflow-deterministic-time-aliases.ts:82`)
then calls `scopeOwnFacts(node)` again for the same node to read both `ownNames`
and `ownInitializers`. `scopeOwnFacts` performs a full own-facts collection walk
of the node's immediate subtree with no memoisation
(`workflow-ast-scopes.ts:97`), so every scope-opening node in the body is
collected twice on the single hazard traversal. This is a fresh redundancy
introduced by 3.1.6: before the alias pass moved onto the scope model, only the
binding view collected own facts. It compounds the overlapping-pass concern
already recorded as Finding 7 of `audit-3.1.5.md`.

Proposed fix:

Compute `scopeOwnFacts(node)` once in `enterDeterministicTimeScope` and thread
the result into both scope-entry helpers. Add an overload or sibling helper such
as `enterScopeWithFacts(view, facts)` and
`enterAliasScopeWithFacts(parentAliases, bindings, facts, rules)` that accept a
precomputed `ScopeOwnFacts`, keeping the existing single-argument entry points
for other callers. Guard with
`tests/static-analysis/workflow-deterministic-time-scopes.test.ts` and
`workflow-deterministic-time-alias-scopes.test.ts` unedited. Fold this into the
collector unification tracked by roadmap task 3.2.6 if that lands first.

## Finding 3: SWC node-type narrowers are duplicated across four modules

Category: duplication

Severity: low

Location:

- `src/static-analysis/workflow-deterministic-time-aliases.ts:223`
- `src/static-analysis/workflow-global-object-reference.ts:131`
- `src/static-analysis/workflow-ast-scopes.ts:203`
- `src/static-analysis/workflow-deterministic-time.ts:199`
- `src/static-analysis/swc-ast.ts:14`

Description:

The same handful of node-type predicates is redefined per module rather than
shared from the `swc-ast.ts` seam that already owns `isAstNode`. `isExpression`
(`return isAstNode(value)`) is defined byte-for-byte in three files
(`workflow-deterministic-time-aliases.ts:238`,
`workflow-global-object-reference.ts:141`, `workflow-ast-scopes.ts:203`).
`isIdentifier` and `isMemberExpression` are each defined twice with divergent
signatures: the alias module guards the argument with
`isAstNode(value) && value.type === "Identifier"` while
`workflow-global-object-reference.ts` assumes a node and tests
`node.type === "Identifier"`. `isCallExpression`
(`workflow-deterministic-time-aliases.ts:223`) and `isNewExpression`
(`workflow-deterministic-time.ts:199`) are one-off narrowers of the same shape.
The inconsistent guarding is a latent correctness trap — a caller that reaches
for the wrong variant may skip or assume the `isAstNode` guard — and the
duplication multiplies the edit surface for any future SWC shape change.

Proposed fix:

Add a small set of shared narrowers (`isIdentifier`, `isMemberExpression`,
`isCallExpression`, `isNewExpression`, and an `isExpression` alias of
`isAstNode`) to `swc-ast.ts`, each accepting `unknown` and guarding with
`isAstNode` for a single consistent contract, and import them across the
static-analysis modules. Delete the per-module copies. The narrowers are pure
type guards, so the change is behaviour-preserving; re-run the
`static-analysis` test suite to confirm no output change.

## Finding 4: Flat and scope-precise binding collectors remain parallel and divergent

Category: separation-of-concerns

Severity: medium

Location:

- `src/static-analysis/workflow-ast-bindings.ts:43`
- `src/static-analysis/workflow-ast-scopes.ts:97`
- `src/static-analysis/workflow-ast-facts.ts:45`

Description:

Two whole-AST binding collectors still coexist. `collectLexicalBindings`
(`workflow-ast-bindings.ts:43`) produces a flat, whole-body bound-name set and
is the only binding fact reachable through the public `collectWorkflowAstFacts`
surface (`workflow-ast-facts.ts:45`, re-exported from
`src/static-analysis/index.ts`). The scope-precise
`scopeOwnFacts`/`rootScopeView`/`enterScope` family
(`workflow-ast-scopes.ts`) is what every deterministic-time rule now actually
consumes. After 3.1.6 no internal rule reads the flat facts, yet the two
collectors encode the same "which nodes introduce bindings" policy twice and
have already drifted: `workflow-ast-scopes.ts:21` lists `MethodProperty`,
`GetterProperty`, and `SetterProperty` as function-like scopes, but
`STATEMENT_BINDING_COLLECTORS` in `workflow-ast-bindings.ts:24` has no entries
for object-literal getters, setters, or methods. A public consumer using
`isIdentifierBound` on the flat facts therefore gets a whole-body,
getter/setter-blind answer that no longer matches the scope model the linter
trusts internally. This restates Findings 3 and 7 of `audit-3.1.5.md` with the
post-3.1.6 divergence made concrete.

Proposed fix:

Unify the two collectors behind one parametrised walk whose only variation is a
scope-boundary stop flag, exactly as roadmap task 3.2.6 already proposes, so the
node-shape knowledge and the function-like set live in one place and the flat
view is the scope view without the boundary stop. Until that lands, either add
the missing object-literal accessor collectors to
`STATEMENT_BINDING_COLLECTORS` so the flat public facts match the scope model,
or document on `collectLexicalBindings` that it is a whole-body approximation
that intentionally omits object-literal accessor scopes. Gate any change on
`workflow-ast-bindings.test.ts` and the deterministic-time suites passing
unedited.

## Finding 5: Block/`for`/`catch` alias-scope precision is untested

Category: test-gap

Severity: low

Location:

- `tests/static-analysis/workflow-deterministic-time-alias-scopes.test.ts:114`
- `tests/static-analysis/workflow-deterministic-time-alias-arguments.test.ts:1`

Description:

3.1.6 routes alias declaration and alias use through the same scope model that
opens block, `for`, and `catch` scopes, so an alias declared inside a block now
shadows a parent alias only within that block, and a sibling-block alias no
longer leaks. The alias test suites do not exercise any of these paths:
`workflow-deterministic-time-alias-scopes.test.ts` and
`workflow-deterministic-time-alias-arguments.test.ts` build only function-scope
and parameter cases, with no `for (...)` or `catch (...)` bodies. The
block-precise alias behaviour is consequently pinned only indirectly, if at all,
which makes the collector-unification refactor of Finding 4 and roadmap task
3.2.6 harder to land safely for the alias branch.

Proposed fix:

Add block/`for`/`catch` alias cases to
`workflow-deterministic-time-alias-scopes.test.ts` mirroring the bare-global
cases in `workflow-deterministic-time-scopes.test.ts:128`: an alias declared and
used inside a block or `for` header that is suppressed within the block, and a
sibling use after the block that is still reported. Cover both member aliases
(`const now = Date.now`) and global-object aliases (`const D = Date; D.now()`).

## Resolved since audit-3.1.5

Finding 5 of `audit-3.1.5.md` ("Scope precision does not extend to
deterministic-time alias resolution") is resolved by 3.1.6. The alias pass now
builds per-scope views through `rootAliasView`/`enterAliasScope` and resolves
global identity with the scope-precise binding view rather than the flat
whole-body set, and `workflow-deterministic-time-alias-scopes.test.ts` pins the
sibling, descendant, and use-site shadowing behaviour.
