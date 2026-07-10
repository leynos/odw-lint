# Audit after roadmap task 3.1.5

This post-step audit was run after roadmap task 3.1.5, which added scope-precise
deterministic-time shadowing, merged into `origin/main` at commit `1d2f09a`. The
audit used `grepai` against the canonical `main` index for intent search, then
verified every branch-local fact in a fresh worktree off `origin/main` with
`leta`, targeted file inspection, and `sem` entity history.

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
- `docs/execplans/roadmap-3-1-5.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- `grepai`: canonical `main` intent search.
- `leta`: branch-local symbol and source navigation.
- `sem`: entity-level diff and blame inspection.

The 3.1.5 change split the reusable binding-pattern collectors into a new
`workflow-ast-binding-patterns.ts` module, added a new
`workflow-ast-scopes.ts` module that layers a function-scope binding view over
the whole-body model (`rootScopeView`/`enterScope`), and rewired
`scanDeterministicTimeWarnings` so bare `Date`, `Math`, and `globalThis`
warnings are suppressed only when the name is shadowed at the use site. The
findings below concentrate on that newly merged surface and the shared traversal
helpers it depends on.

## Finding 1: `workflow-ast-scopes.ts` reimplements the shared child-value walker

Category: duplication

Severity: medium

Location:

- `src/static-analysis/workflow-ast-scopes.ts:221`
- `src/static-analysis/swc-ast.ts:24`

Description:

`workflow-ast-scopes.ts` defines a private `childValues` helper that enumerates
`Object.entries(node)` and filters the `span`, `type`, and `ctxt` bookkeeping
keys. This is byte-for-byte the behaviour of `astChildValues` in `swc-ast.ts`,
the shared traversal seam that roadmap task 3.2.5 consolidated and that the
sibling modules `workflow-deterministic-time.ts` and
`workflow-deterministic-time-aliases.ts` already import. The scope collector,
added in 3.1.5 after 3.2.5 had merged, is the only static-analysis walker that
does not consume that seam, so a future change to the bookkeeping-key exclusion
policy has to be made in two places and can silently drift.

Proposed fix:

Delete the local `childValues` in `workflow-ast-scopes.ts` and import
`astChildValues` from `./swc-ast`. The signatures are compatible
(`astChildValues(value: object)` accepts the `AstNode` argument), so the change
is behaviour-preserving. Re-run
`tests/static-analysis/workflow-deterministic-time-scopes.test.ts` to confirm no
output change.

## Finding 2: Synthetic-wrapper unwrapping is duplicated across two binding modules

Category: duplication

Severity: medium

Location:

- `src/static-analysis/workflow-ast-bindings.ts:69`
- `src/static-analysis/workflow-ast-scopes.ts:191`

Description:

`userBodyStatements` and `syntheticWrapperBody` are duplicated verbatim between
`workflow-ast-bindings.ts` (lines 69-97) and `workflow-ast-scopes.ts` (lines
191-219). Both unwrap the synthetic `WORKFLOW_BODY_WRAP_FUNCTION_NAME` wrapper
to recover the user-written statements, and both re-derive the same
`EXCLUDED_BINDING_NAMES` set, the same `addIdentifierBinding` guard, and the
same `compareIdentifierNames` comparator. The two modules were split in the same
change, so the duplication is fresh and the drift risk is immediate: a change to
how the wrapper is detected (for example, a normalizer rename) must be applied
in both files or the flat and scope-precise binding views will disagree about
which statements are user code.

Proposed fix:

Extract the wrapper-unwrapping pair (`userBodyStatements`,
`syntheticWrapperBody`) and the shared `EXCLUDED_BINDING_NAMES` constant into a
single internal module — either `workflow-ast-binding-patterns.ts` (which
already holds the shared pattern collectors and `identifierName`) or a new
`workflow-ast-body.ts` — and import it from both `workflow-ast-bindings.ts` and
`workflow-ast-scopes.ts`. Keep `LexicalBindingFacts` where it is to avoid a
public-surface change.

## Finding 3: Two near-identical whole-AST binding collectors differ only in scope policy

Category: similarity

Severity: medium

Location:

- `src/static-analysis/workflow-ast-bindings.ts:99`
- `src/static-analysis/workflow-ast-scopes.ts:99`

Description:

`collectLexicalBindings` (flat, whole-body) and the scope-precise
`collectOwnNamesFromNode` family in `workflow-ast-scopes.ts` implement two
structurally parallel recursive walks over the same node shapes — variable
declarations, declarator initializers, class declarations, catch clauses, and
function parameters — differing only in whether they stop at a function-scope
boundary. `scanDeterministicTimeWarnings` runs both: `collectLexicalBindings`
feeds the alias pass while `rootScopeView`/`enterScope` drives the hazard walk,
so the same body is walked for bindings twice with two collectors that must be
kept in lock-step. This is a separation-of-concerns and maintenance-cost smell:
the "which nodes introduce bindings" policy is now encoded twice.

Proposed fix:

Unify the two collectors behind one parametrized walk whose only variation is a
`stopAtFunctionScope` (or equivalent) flag, so the node-shape knowledge lives in
one place and the flat view is expressed as the scope view without the boundary
stop. This is a larger, higher-risk refactor than Findings 1 and 2; gate it on
the existing `workflow-ast-bindings.test.ts` and
`workflow-deterministic-time-scopes.test.ts` suites passing unedited, and treat
it as a roadmap follow-up rather than an inline change.

## Finding 4: `compareIdentifierNames` reimplements the default string sort

Category: ergonomics

Severity: low

Location:

- `src/static-analysis/workflow-ast-bindings.ts:206`
- `src/static-analysis/workflow-ast-scopes.ts:243`

Description:

Both binding modules define a `compareIdentifierNames` comparator that returns
`-1`/`1`/`0` from `<`/`>` on the two strings. That is exactly the ordering that
`Array.prototype.sort()` applies to a string array by default (UTF-16 code-unit
order), so the comparator is redundant in both call sites and adds ten lines of
duplicated boilerplate to each module.

Proposed fix:

Replace `[...names].sort(compareIdentifierNames)` with `[...names].sort()` in
both modules and delete the comparator, or — if an explicit comparator is
preferred for readability — move a single shared comparator into the module
extracted for Finding 2. Snapshot tests already pin the sorted output, so the
change is guarded.

## Finding 5: Scope precision does not extend to deterministic-time alias resolution

Category: inconsistency

Severity: medium

Location:

- `src/static-analysis/workflow-deterministic-time.ts:67`
- `src/static-analysis/workflow-deterministic-time-aliases.ts:205`
- `src/static-analysis/workflow-global-object-reference.ts:78`

Description:

The 3.1.5 change made the direct hazard walk scope-precise, but the alias pass
still resolves global identity against the whole-body binding set.
`collectDeterministicTimeAliases` receives the flat `collectLexicalBindings`
result, and `resolveGlobalObjectIdentity` treats a name as shadowed when it is
bound anywhere in the body (`isIdentifierBound` is a whole-body membership
test). Consequently a `Date` or `Math` binding in an unrelated nested scope
suppresses recognition of a top-level alias declaration such as
`const D = Date; ... new D();`, producing exactly the unrelated-scope
false-negative that 3.1.5 removed for direct references. The `roadmap-3-1-5.md`
ExecPlan explicitly scoped alias precision out as future work, and the rule docs
note the whole-body alias limit, so this is a known and documented gap rather
than a defect — but the behaviour is currently unpinned by any fixture, so a
future refactor could change it silently in either direction.

Proposed fix:

Add a fixture to `workflow-deterministic-time-scopes.test.ts` that pins the
current behaviour (an unrelated-scope `Date` shadow suppresses an alias-declared
`new D()`), so the documented limitation is enforced. Track the precision
improvement — threading scope-precise binding views into
`collectDeterministicTimeAliases` and the alias branch of
`objectIdentityForExpression` — as a separate roadmap item, matching the
ExecPlan's stated follow-up.

## Finding 6: `workflow-ast-scopes.ts` has no dedicated unit test

Category: test-gap

Severity: low

Location:

- `src/static-analysis/workflow-ast-scopes.ts:37`
- `src/static-analysis/workflow-ast-scopes.ts:54`
- `tests/static-analysis/workflow-deterministic-time-scopes.test.ts`

Description:

`rootScopeView` and `enterScope` are the contract-bearing exports of the new
scope module, but no test targets them directly; coverage is entirely indirect
through `scanDeterministicTimeWarnings`. The integration suite does exercise
class methods, getters, setters, named class expressions, and catch clauses, so
behaviour is reasonably covered — but the module's own output (the exact sorted
`boundNames` set produced for a given scope, and the block/`for`/`catch`
attribution to the enclosing function scope documented as a limitation) is never
asserted. That makes the structural refactors proposed in Findings 1-3 harder to
land safely, because the only guard is end-to-end diagnostic output.

Proposed fix:

Add `tests/static-analysis/workflow-ast-scopes.test.ts` that parses small
workflow bodies and asserts the `boundNames` returned by `rootScopeView` and by
`enterScope` at a chosen scope node. Cover a nested-function parameter shadow, a
`SetterProperty` parameter, a `ClassExpression` name binding, and a block-level
`let` that is (per the documented limitation) attributed to the enclosing
function scope. Retain the end-to-end cases.

## Finding 7: The scanner performs several overlapping whole-body binding passes

Category: complexity

Severity: low

Location:

- `src/static-analysis/workflow-deterministic-time.ts:67`

Description:

`scanDeterministicTimeWarnings` walks the parsed body several times before it
emits a single diagnostic: `collectLexicalBindings` builds the whole-body set,
`collectDeterministicTimeAliases` re-walks the whole body, `rootScopeView`
re-walks it again to seed the root scope, and the main hazard walk then calls
`enterScope` at every node — each scope-opening node re-collecting its own
subtree's names. For the small workflow bodies this linter targets the cost is
negligible, but the repeated whole-body traversals are a latent scaling concern
and reflect the collector duplication described in Finding 3.

Proposed fix:

Treat this as motivation for the Finding 3 unification rather than a standalone
change: once one parametrized collector produces both the flat and scope views,
the root-scope seed and the alias binding set can share a single pass. No
behavioural change is required; record the decision if the passes are kept
separate for clarity.
