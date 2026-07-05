# Reconcile scope-owned facts with public binding facts

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint` checks Open Dynamic Workflows (ODW) workflow source before any
workflow runs. Several parser-backed rules walk the SWC (a Rust-based
JavaScript/TypeScript compiler exposed through `@swc/core`) abstract syntax tree
(AST) of a normalized workflow body. Roadmap task 3.2.7 reconciles two related
but currently divergent views of the same lexical declarations.

Two problems exist today.

1. **Duplicated scope-owned-fact collection during the scanner walk.** The
   deterministic-time scanner walks the whole SWC subtree. At every node it
   enters both a *binding* scope view and an *alias* scope view. The single seam
   that does this,
   `enterDeterministicTimeScope` in
   `src/static-analysis/workflow-deterministic-time.ts`, calls
   `enterScope(context.bindings, node)` and then
   `enterAliasScope(context.aliases, bindings, node, ALIAS_RULES)`. Each of
   those two helpers independently calls `scopeOwnFacts(node)` on the *same*
   node, so the scope-boundary traversal that computes a scope's own declared
   names and simple initializers runs **twice per scope-opening node**. The two
   results are, by construction, identical; only one computation is needed.

2. **Object-literal accessor handling diverges between the public flat binding
   facts and the internal scope model.** There are two collectors:

   - The **public, whole-body flat** collector,
     `collectLexicalBindings` in
     `src/static-analysis/workflow-ast-bindings.ts`, produces
     `LexicalBindingFacts` (a sorted, unique `boundNames` list of every name the
     body declares anywhere). Its dispatch table
     `STATEMENT_BINDING_COLLECTORS` recognizes class members
     (`ClassMethod`, `PrivateMethod`, `Constructor`) and collects their
     parameters, but it has **no entry** for the object-literal member node
     types `SetterProperty` and `MethodProperty`. Those nodes fall through to
     the generic child recursion (`collectChildBindings`), which walks their
     bodies (so *inner locals* are still collected) but never treats their
     `param`/`params` fields as binding-pattern positions, so **the setter and
     object-method parameters are silently dropped**.
   - The **internal, per-scope** model,
     `scopeOwnFacts`/`rootScopeOwnFacts`/`enterScope` in
     `src/static-analysis/workflow-ast-scope-own-facts.ts` and
     `src/static-analysis/workflow-ast-scopes.ts`, *does* treat
     `GetterProperty`, `SetterProperty`, and `MethodProperty` as function-like
     scopes (they are members of `FUNCTION_LIKE_SCOPE_TYPES`) and correctly
     collects their parameters. The existing test "adds setter parameter
     bindings only in the setter scope" in
     `tests/static-analysis/workflow-ast-scopes.test.ts` pins this behaviour.

   The consequence is an accessor-handling contract mismatch: given
   `const o = { set x(p) {}, m(q) {} };`, the internal scope model records
   `p` and `q` as declared names, but the public flat facts do not. Class
   methods already agree between the two models; only object-literal accessors
   and methods diverge.

After this change a reader can observe:

- The deterministic-time scanner computes each scope-opening node's own facts
  **once** and threads that single value into both the binding and alias scope
  entries.
- The public whole-body `LexicalBindingFacts` collects object-literal setter
  and object-method **parameters**, matching how it already collects class
  method parameters and matching the internal scope model, so object-literal
  accessor handling no longer diverges between the public and internal binding
  facts.
- Existing deterministic-time diagnostics (`odw/no-date-now`,
  `odw/no-math-random`, `odw/no-argless-new-date`) are **byte-for-byte
  unchanged**, because the scanner's shadowing decisions come from the internal
  scope model, which is unchanged in content.

These three observable outcomes map one-to-one onto the roadmap 3.2.7 success
criteria.

## Constraints

Hard invariants that must hold throughout implementation.

- Work happens exclusively in the assigned git worktree root on branch
  `roadmap-3-2-7`. Never edit the root/control worktree.
- The public package surface must not change shape. `collectLexicalBindings`,
  `isIdentifierBound`, `LexicalBindingFacts`, `collectWorkflowAstFacts`, and
  `WorkflowAstFacts` keep their existing signatures and export names. The
  exported-symbol inventory pinned in `tests/diagnostics/public-api-fixtures.ts`
  must remain satisfied. The internal helpers `scopeOwnFacts`, `enterScope`,
  `enterAliasScope`, `rootScopeView`, and `rootAliasView` are **not** public
  exports (confirmed absent from `src/index.ts` and
  `src/static-analysis/index.ts`), so their signatures may be extended
  additively.
- `LexicalBindingFacts` stays a **whole-body, name-based** model, not a
  scope-span model. The developer guide states this explicitly
  (`docs/developers-guide.md`, "Workflow AST facts"). Alignment means adding the
  dropped accessor/method **parameter** names to the whole-body set, not making
  the flat collector scope-aware.
- Existing deterministic-time diagnostics and their spans must remain
  unchanged. The comprehensive suites
  `tests/static-analysis/workflow-deterministic-time.test.ts`,
  `tests/static-analysis/workflow-deterministic-time-scopes.test.ts`,
  `tests/static-analysis/workflow-deterministic-time-alias-scopes.test.ts`, and
  `tests/static-analysis/workflow-deterministic-time-alias-arguments.test.ts`
  must pass without edits (other than additions).
- Parser-backed collectors must keep consuming the shared SWC seam
  `src/static-analysis/swc-ast.ts` (`astChildValues`, `isAstNode`) rather than
  cloning shape helpers. The architecture guard in
  `tests/diagnostics/architecture.test.ts` enforces this and must keep passing.
- No single source or test file may exceed 400 lines (`AGENTS.md`, Code Style).
  `workflow-ast-scope-own-facts.ts` is currently 294 lines and
  `workflow-deterministic-time-aliases.ts` 240 lines; keep additions small.
- Prose, comments, and commit messages use en-GB Oxford spelling
  (`-ize`/`-yse`/`-our`).

## Tolerances (exception triggers)

- Scope (this plan's expected footprint). The planned work deliberately touches
  **nine source/test files** across the two code work items, plus up to two
  documentation files in Work Item 3. This is the sanctioned budget, not an
  overrun:
  - Work Item 1 edits **three** source/test files:
    `src/static-analysis/workflow-ast-bindings.ts`,
    `tests/static-analysis/workflow-ast-bindings.test.ts`,
    `tests/static-analysis/workflow-ast-facts.test.ts`.
  - Work Item 2 edits **six** source/test files:
    `src/static-analysis/workflow-ast-scopes.ts`,
    `src/static-analysis/workflow-deterministic-time-aliases.ts`,
    `src/static-analysis/workflow-deterministic-time.ts`,
    `tests/diagnostics/architecture.test.ts`,
    `tests/static-analysis/workflow-ast-scopes.test.ts`,
    `tests/static-analysis/workflow-deterministic-time-alias-scopes.test.ts`.
  - Work Item 3 edits **two** documentation files
    (`docs/developers-guide.md` and `docs/technical-design.md`).
- Scope (escalation trigger). The 6-file bound is **per code work item**, and no
  single work item in this plan reaches it except Work Item 2, which sits at
  exactly six (its sanctioned footprint, not an overrun). Stop and escalate if,
  during implementation:
  - any single code work item must edit **more than 6** source/test files, or
  - the whole plan must edit **more than 9** source/test files in total (i.e.
    any source/test file beyond the nine enumerated above; documentation files
    do not count towards this bound), or
  - the change exceeds **~180 net lines** across all source/test files.
  These thresholds are binding; honouring them must not force a stop before the
  planned nine-file work is complete, because the planned footprint is inside
  every bound above.
- Interface: if any **public** export signature must change, stop and escalate.
- Dependencies: if a new runtime or dev dependency is required, stop and
  escalate.
- Behaviour: if aligning the accessor handling changes **any**
  deterministic-time diagnostic output, stop and escalate — that would mean the
  scanner consumes the public flat facts somewhere unexpected, contradicting the
  research in this plan.
- Iterations: if a milestone's tests still fail after 3 focused attempts, stop
  and escalate.
- Ambiguity: if the object-literal accessor alignment appears to require
  dropping the whole-body model (rather than adding parameter names), stop and
  escalate.

## Risks

- Risk: the "computed once" property is a structural/performance property that
  ordinary behavioural tests cannot observe directly.
  Severity: medium. Likelihood: medium.
  Mitigation: add a source-inspecting guard test (Work Item 2) in the style of
  the existing `tests/diagnostics/architecture.test.ts`
  `genericSwcTraversalDeclarations` check, asserting `enterDeterministicTimeScope`
  makes exactly one direct `scopeOwnFacts` call and no longer calls the
  node-taking `enterScope`/`enterAliasScope` forms. This gives a genuine
  red-before/green-after guard for a refactor.
- Risk: some consumer relies on the public flat facts *omitting* accessor
  parameters.
  Severity: low. Likelihood: low.
  Mitigation: research confirms `collectLexicalBindings` output flows only into
  `WorkflowAstFacts.lexicalBindings` (produced by
  `src/static-analysis/workflow-ast-facts.ts`) and into its own tests; the
  deterministic-time scanner uses the *scope* model, not the flat collector. No
  rule branches on accessor-parameter presence today. Verified by grep over
  `src` and `tests`.
- Risk: `MethodProperty` and `SetterProperty` SWC node shapes are assumed
  wrongly.
  Severity: low. Likelihood: low.
  Mitigation: shapes verified against the dependency versions pinned in
  `bun.lock`: `@swc/core@1.15.43` depends on `@swc/types@0.1.27`.
  `SetterProperty` has a single `param: Pattern` and `body?: BlockStatement`;
  `MethodProperty extends … Fn`, so it carries `params`/`body` directly;
  `GetterProperty` has `body?: BlockStatement` and no parameters. See
  "Interfaces and dependencies" for the full signatures.

## Progress

- [x] Work Item 1 — Align public flat lexical-binding facts for object-literal
  accessors and methods.
- [x] Work Item 2 — Compute scope-owned facts once per scope-opening node across
  binding and alias scope entry.
- [x] Work Item 3 — Update developer and design documentation.

## Surprises & discoveries

- Observation: GitHub-indexed `grepai` and `bun test` probes were unavailable in
  the planning session (`bun test` needed interactive approval that a planning
  agent cannot grant; `grepai` needed shell approval).
  Evidence: repeated "command requires approval" responses.
  Impact: all branch-local facts in this plan were verified by direct file
  inspection and by the existing pinned tests
  (`tests/static-analysis/workflow-ast-scopes.test.ts` line ~164 pins that the
  scope model collects setter parameters; `workflow-ast-bindings.ts` has no
  `SetterProperty`/`MethodProperty` collector). The implementer will confirm the
  divergence empirically via the Red test in Work Item 1.
- Observation: During implementation, GrepAI was available and returned
  canonical main-branch evidence for `workflow-ast-scope-own-facts.ts`; Leta was
  available for branch-local symbol checks.
  Evidence: `grepai version 0.35.0`, `grepai workspace status Projects`, and
  `leta show collectLexicalBindings`/`leta show enterDeterministicTimeScope`
  succeeded from the assigned worktree.
  Impact: no fallback tooling exception is needed for this implementation pass.
- Observation: Work Item 1 Red/Green behaved as expected after dependencies
  were installed with `make build`.
  Evidence: `bun test tests/static-analysis/workflow-ast-bindings.test.ts`
  first failed because `setterParam` was absent from `boundNames`; after adding
  the object-literal member collectors, the binding and AST-facts focused suites
  passed.
  Impact: the public flat binding facts now match the internal scope model for
  object-literal setter and method parameters.
- Observation: Work Item 2 Red/Green behaved as expected.
  Evidence: `bun test tests/diagnostics/architecture.test.ts` first failed
  because `enterDeterministicTimeScope` made zero direct `scopeOwnFacts` calls
  and still called the node-taking scope-entry helpers. After adding the
  `*WithOwnFacts` variants and threading one `ScopeOwnFacts` value through the
  deterministic-time scanner, the architecture, scope-view, and alias-scope
  focused suites passed.
  Impact: the scanner now computes scope-owned facts once per visited node while
  preserving the node-taking helpers and identity fast paths for tests and other
  internal callers.
- Observation: Work Item 2 review and gates completed cleanly after formatting
  the alias-scope test imports.
  Evidence: scrutineer reported `make all`, `make markdownlint`, and
  `make nixie` green, then `coderabbit review --agent` completed with
  `findings=0`.
  Impact: no Work Item 2 open review issue remains.
- Observation: No changelog file exists for this surface.
  Evidence: `find . -maxdepth 2 -iname '*changelog*' -o -name 'CHANGELOG.md'`
  returned no paths from the assigned worktree.
  Impact: Work Item 3 did not add or update a changelog.
- Observation: Work Item 3 updated both planned documentation files.
  Evidence: `docs/developers-guide.md` now states that whole-body lexical
  binding facts include object-literal setter and object-method parameters and
  that the deterministic-time scanner shares one computed scope-owned fact set
  between binding and alias scope entry. `docs/technical-design.md` records the
  same single-computation seam while preserving the distinct recursion-policy
  contract.
  Impact: developer-facing and design documentation now match the delivered
  behaviour.
- Observation: The roadmap completion checkbox also needed updating.
  Evidence: `docs/roadmap.md` still listed task 3.2.7 as incomplete after the
  ExecPlan work items were delivered.
  Impact: Work Item 3 includes the narrow roadmap status update so the living
  roadmap matches the implementation state.

## Decision log

- Decision: keep the whole-body public model and *add* accessor/method
  parameters rather than re-basing the flat collector on the scope model.
  Rationale: `docs/developers-guide.md` states the public model is deliberately
  whole-body and name-based; re-basing it on per-scope facts would be a larger,
  contract-breaking change outside this task's scope.
  Date/Author: 2026-07-05, planning agent.
- Decision: dedupe the scope-own-fact computation by adding additive
  `*WithOwnFacts` variants and calling `scopeOwnFacts(node)` once in
  `enterDeterministicTimeScope`, keeping the node-taking `enterScope`/
  `enterAliasScope` as thin delegators for existing unit tests.
  Rationale: preserves the identity fast-path behaviour that
  `tests/static-analysis/workflow-ast-scopes.test.ts` depends on
  (`expect(expressionView).toBe(rootView)`), keeps unit-test entry points, and
  keeps the change additive.
  Date/Author: 2026-07-05, planning agent.
- Decision: order Work Item 1 (functional change) before Work Item 2 (refactor),
  per the `AGENTS.md` heuristic that refactors follow functional changes.
  Date/Author: 2026-07-05, planning agent.
- Decision: keep the ExecPlan portable by referring to the assigned git
  worktree root instead of hard-coding the machine-specific absolute path inside
  the plan body.
  Rationale: CodeRabbit flagged the literal path as making the plan less
  portable; the workflow prompt remains the authoritative source for the
  concrete path, and the plan still forbids edits to the root/control worktree.
  Date/Author: 2026-07-05, implementation agent.
- Decision: make the Work Item 3 `docs/technical-design.md` edit mandatory.
  Rationale: CodeRabbit flagged the optional wording as leaving the design
  reconciliation ambiguous. The technical design is the source of truth for the
  parser-backed collector seam and should record the final reconciliation.
  Date/Author: 2026-07-05, implementation agent.
- Decision: keep the documentation update to `docs/developers-guide.md` and
  `docs/technical-design.md`.
  Rationale: those files are the documented source of truth for workflow AST
  facts and parser-backed collector architecture, and no changelog exists for
  this internal reconciliation.
  Date/Author: 2026-07-05, implementation agent.
- Decision: include the `docs/roadmap.md` completion checkbox in the Work Item 3
  commit.
  Rationale: repository guidance says the roadmap should be updated when a
  planned task is completed, and this is a status-only documentation change
  required to keep the source-of-truth roadmap current.
  Date/Author: 2026-07-05, implementation agent.

## Outcomes & retrospective

Delivered the three planned success criteria without public API changes. Public
flat lexical-binding facts now collect object-literal setter and method
parameters, the deterministic-time scanner shares one computed `ScopeOwnFacts`
value across binding and alias scope entry, and deterministic-time gates passed
without expectation updates. The only implementation wrinkle was repeated
CodeRabbit feedback on the ExecPlan wording during Work Item 1; those findings
were resolved before later work continued.

## Addenda

- [x] 3.2.7.1. Retire or document scope-entry wrappers.
  - Source: review:3.2.7 and audit:3.2.7; severity low.
  - Scope: remove the node-taking `enterScope` and `enterAliasScope` wrappers
    and point their coverage at the production `*WithOwnFacts` paths, or
    update their documentation to say they are retained as standalone tested
    helper entry points rather than scanner-walk code.
  - Success: future maintainers cannot read the node-taking wrappers as live
    scanner code unless that role is explicitly documented and tested.
- [x] 3.2.7.2. Link binding collector node-type enumerations.
  - Source: audit:3.2.7; severity low.
  - Scope: add a shared classification or focused parity test tying
    `STATEMENT_BINDING_COLLECTORS` and `FUNCTION_LIKE_SCOPE_TYPES` together for
    function-like and accessor nodes where the flat and scope-owned collectors
    should agree.
  - Success: adding, renaming, or removing an SWC function-like or accessor
    node type cannot make the two binding collectors diverge silently.
- [x] 3.2.7.3. Add cross-model binding-fact invariant coverage.
  - Source: review:3.2.7; severity low.
  - Scope: add invariant coverage, using generated object-literal and class
    member bodies where useful, that compares public flat binding facts with
    the union of scope-owned names across the AST for collected parameter names.
  - Success: future drift between `collectLexicalBindings` and the scope-owned
    model fails through one structural invariant instead of relying only on
    hand-picked accessor examples.

## Context and orientation

The reader needs no prior plans. The relevant files, all under the worktree
root, are:

- `src/static-analysis/workflow-ast-bindings.ts` — the public whole-body flat
  binding collector `collectLexicalBindings`, its `STATEMENT_BINDING_COLLECTORS`
  dispatch table, and `isIdentifierBound`. This is the "public flat
  lexical-binding facts" of the task.
- `src/static-analysis/workflow-ast-binding-patterns.ts` — shared, reusable
  binding-pattern collectors (`collectPatternBindings`,
  `collectFunctionParamBindings`, `addIdentifierBinding`, `arrayValue`,
  `asNode`, `EXCLUDED_BINDING_NAMES`). Both collectors already depend on these.
- `src/static-analysis/workflow-ast-scope-own-facts.ts` — the internal per-scope
  own-fact collector `scopeOwnFacts`/`rootScopeOwnFacts`, with
  `FUNCTION_LIKE_SCOPE_TYPES` (includes `GetterProperty`, `SetterProperty`,
  `MethodProperty`).
- `src/static-analysis/workflow-ast-scopes.ts` — re-exports the own-fact API and
  defines `rootScopeView` and `enterScope` (binding scope entry). `enterScope`
  calls `scopeOwnFacts(node)`.
- `src/static-analysis/workflow-deterministic-time-aliases.ts` — the alias scope
  model, including `enterAliasScope`, which also calls `scopeOwnFacts(node)`.
- `src/static-analysis/workflow-deterministic-time.ts` — the scanner.
  `enterDeterministicTimeScope` (lines ~137-148) enters both scope views per
  node; this is where the duplicate `scopeOwnFacts(node)` call currently occurs.
- `src/static-analysis/workflow-ast-facts.ts` — the public facade
  `collectWorkflowAstFacts`, the sole in-tree consumer of
  `collectLexicalBindings`.

Terms:

- **Scope-opening node**: a SWC node that introduces its own lexical scope
  (functions, arrow functions, class methods/accessors, class expressions,
  blocks, `for`/`for-in`/`for-of`, `catch`). Enumerated in
  `isScopeOpeningNode` in `workflow-ast-scope-own-facts.ts`.
- **Scope-owned facts** (`ScopeOwnFacts`): the names a single scope declares
  directly (`ownNames`) plus its simple `name = <expression>` initializers
  (`ownInitializers`), not counting names owned by nested scopes.
- **Whole-body flat binding facts** (`LexicalBindingFacts`): every name declared
  anywhere in the body, flattened into one sorted, unique `boundNames` list.
- **Object-literal accessor/method**: `get x() {}`, `set x(p) {}`, and shorthand
  method `m(q) {}` written inside an object literal — SWC node types
  `GetterProperty`, `SetterProperty`, `MethodProperty`. Distinct from class
  members (`GetterProperty` etc. also appear on classes, but the divergence this
  task fixes is specifically the object-literal path in the flat collector).

## Plan of work

Three ordered, independently committable work items. Each ends with the full
commit gate (`make all`), and Work Item 3 additionally runs the Markdown gates.

### Work Item 1 — Align object-literal accessor handling in the public flat binding facts

Design docs to read first: `docs/developers-guide.md` "Workflow AST facts"
(the whole-body, name-based contract); `docs/technical-design.md` §6.1
(parser-backed collectors and their distinct recursion policies) and §6.2 (the
`WorkflowAstFacts` layer). This is TypeScript, so the Python router skills do
not apply. Load `leta` for symbol navigation and follow the `AGENTS.md`
"TypeScript Guidance" and "Testing" sections. For invariant coverage use
`fast-check`, as the repository's binding tests already do; `hypothesis` and
`crosshair` are Python-only and are not used here.

Stage B (Red). In `tests/static-analysis/workflow-ast-bindings.test.ts`, add
cases proving the current divergence:

- `set value(setterParam) {}` inside an object literal ⇒
  `isIdentifierBound(facts, "setterParam")` is expected `true` (currently
  `false`).
- object shorthand method `method(methodParam) {}` inside an object literal ⇒
  `isIdentifierBound(facts, "methodParam")` is expected `true` (currently
  `false`).
- Regression-pin that already-correct behaviour is preserved: getter body local
  `get gv() { const getterLocal = 1; }` ⇒ `getterLocal` is `true`; setter body
  local is `true`; the object-literal member *keys* (`value`, `method`, `gv`)
  are **not** reported as bindings.
- Add one negative case that a *reference* inside an accessor body still is not
  treated as a binding, mirroring the existing reference-only table.

Also add one case to `tests/static-analysis/workflow-ast-facts.test.ts`
asserting the public `collectWorkflowAstFacts(...).lexicalBindings` includes
both the setter and object-method parameters, so the public facade is covered
end-to-end.

Run the focused Red command (see Concrete steps) and confirm the new
`setterParam`/`methodParam` assertions fail for the expected reason (parameter
dropped), while the getter-body and key-exclusion assertions already pass.

Stage C (Green). In `src/static-analysis/workflow-ast-bindings.ts`:

- Add collectors for `SetterProperty` and `MethodProperty` to
  `STATEMENT_BINDING_COLLECTORS`, mirroring the existing class-member handling:
  - `SetterProperty`: collect `node.param` via the existing
    `collectPatternBindingNames` helper, then recurse `node.body`.
  - `MethodProperty`: reuse `collectFunctionLikeBindings(node, boundNames)`
    (it reads `node.params` through `collectFunctionParamBindings`) and recurse
    `node.body`. `MethodProperty` extends `Fn`, so `params`/`body` are on the
    node itself, exactly like `ArrowFunctionExpression`.
- `GetterProperty` has no parameters, and its body locals are already collected
  by the generic child recursion; do **not** add a bespoke collector for it
  unless the Red test shows a gap. (If a collector is added for symmetry, it
  must only recurse `body`.)

Keep each new collector a small named function beside its siblings, with a
one-line JSDoc explaining *why* (object-literal accessor/method parameters must
be collected to match class members and the scope model).

Stage D (Refactor). If the three object-member collectors plus the class
members now share an obvious shape, extract at most one small helper — but only
if it does not push the file structure past readability or the 400-line limit.
Do not over-abstract; the existing table style is acceptable as-is.

Validation: the new Red tests pass; the whole
`tests/static-analysis/workflow-ast-bindings.test.ts` and
`tests/static-analysis/workflow-ast-facts.test.ts` suites pass; the
deterministic-time suites are untouched and still pass under `make all`.

Commit (functional change): "Collect object-literal accessor and method
parameters in flat binding facts".

### Work Item 2 — Compute scope-owned facts once per scope-opening node

Design docs to read first: `docs/technical-design.md` §6.1 (the seam and the
"scope views, alias declaration views, and the lexical-binding collector … keep
their distinct scope-bounded and type-dispatched recursion policies"
statement); `docs/developers-guide.md` "Workflow AST facts" (the scanner "layers
an internal function-scope view over the whole-body model"). Skills: `leta` for
navigation; follow `AGENTS.md` "Refactoring Heuristics & Workflow" (refactor as
a separate atomic commit) and "TypeScript Guidance".

Stage B (Red). Add a source-inspecting guard, in the style of the existing
`genericSwcTraversalDeclarations` check in
`tests/diagnostics/architecture.test.ts`. Prefer extending that suite (it
already imports `typescript` and `parseSource`) with a focused `it(...)` that:

- parses `src/static-analysis/workflow-deterministic-time.ts`,
- locates the `enterDeterministicTimeScope` declaration, and
- asserts its body makes exactly **one** direct call to `scopeOwnFacts` and
  **zero** calls to the node-taking `enterScope` / `enterAliasScope`
  (it must use the new `*WithOwnFacts` variants instead).

This assertion is red on the current code (zero direct `scopeOwnFacts` calls;
two node-taking-entry calls) and green after Stage C. Additionally add unit
tests in `tests/static-analysis/workflow-ast-scopes.test.ts` and
`tests/static-analysis/workflow-deterministic-time-alias-scopes.test.ts` (or a
neighbouring alias-scope test) asserting the new `enterScopeWithOwnFacts` and
`enterAliasScopeWithOwnFacts` variants return results identical (including the
`toBe` identity fast-path for empty own-facts) to the node-taking forms for a
representative scope-opening node and a non-scope-opening node.

Stage C (Green).

- In `src/static-analysis/workflow-ast-scopes.ts`, add
  `enterScopeWithOwnFacts(view: LexicalBindingFacts, facts: ScopeOwnFacts):
  LexicalBindingFacts` containing the current `enterScope` body (from
  `if (facts.ownNames.length === 0) return view;` onward). Re-implement
  `enterScope(view, node)` as
  `enterScopeWithOwnFacts(view, scopeOwnFacts(node))`. Export the new variant
  (module-internal export; it need not reach the package surface).
- In `src/static-analysis/workflow-deterministic-time-aliases.ts`, add
  `enterAliasScopeWithOwnFacts(parentAliases, childBindings, facts, rules)`
  containing the current `enterAliasScope` body (from the
  `ownNames.length === 0 && ownInitializers.length === 0` guard onward).
  Re-implement `enterAliasScope(...)` to compute `scopeOwnFacts(node)` and
  delegate.
- In `src/static-analysis/workflow-deterministic-time.ts`, rewrite
  `enterDeterministicTimeScope` to compute the facts once:

  ```typescript
  const enterDeterministicTimeScope = (
    context: DeterministicTimeContext,
    node: Node,
  ): DeterministicTimeContext => {
    const ownFacts = scopeOwnFacts(node);
    const bindings = enterScopeWithOwnFacts(context.bindings, ownFacts);

    return {
      bindings,
      aliases: enterAliasScopeWithOwnFacts(context.aliases, bindings, ownFacts, ALIAS_RULES),
    };
  };
  ```

  Update the imports: bring `scopeOwnFacts` and `enterScopeWithOwnFacts` from
  `./workflow-ast-scopes`, and `enterAliasScopeWithOwnFacts` from
  `./workflow-deterministic-time-aliases`. `ScopeOwnFacts` is already re-exported
  from `workflow-ast-scopes.ts`.

Stage D (Refactor/cleanup). Confirm no now-dead imports remain and that the
node-taking `enterScope`/`enterAliasScope` are still referenced by their unit
tests (keep them; they are the tested public-to-tests entry points and preserve
the identity fast-path contract). Update the "distinct recursion policies"
comment near the top of `workflow-deterministic-time-aliases.ts` only if it
becomes inaccurate.

Validation: the new guard test is green; the equivalence unit tests pass; the
full deterministic-time and alias suites pass **unchanged in expectations**,
proving diagnostics are identical (this is the "existing deterministic-time
diagnostics remain unchanged" criterion). Run `make all`.

Commit (refactor): "Compute scope-owned facts once per scope-opening node".

### Work Item 3 — Update documentation

Design docs to read first: `docs/documentation-style-guide.md`; the sections
being edited. Skills: `en-gb-oxendict` for spelling; `changelog` only if the
repository keeps a changelog for this surface (it does not appear to — verify;
if absent, skip). Follow `AGENTS.md` "Documentation Maintenance" and "Markdown
Guidance".

Edits:

- `docs/developers-guide.md`, "Workflow AST facts": add a sentence clarifying
  that the whole-body `LexicalBindingFacts` now includes object-literal setter
  and object-method **parameters**, consistent with class-member parameters and
  the internal scope model, while remaining whole-body and name-based (not
  scope-span-based).
- `docs/developers-guide.md`, deterministic-time scanner paragraph: add a
  sentence noting the scanner computes each scope-opening node's own facts once
  and threads that single value into both the binding and alias scope entries.
- `docs/technical-design.md` §6.1: update the "distinct scope-bounded and
  type-dispatched recursion policies" paragraph so it records the final
  reconciliation: the scanner shares one computed `ScopeOwnFacts` value between
  the binding and alias scope entries, while the collectors keep their distinct
  recursion policies.

Keep paragraphs wrapped at 80 columns. Do not run a repository-global Markdown
formatter; format only the files touched.

Validation: `make markdownlint` and `make nixie` pass; `make all` still passes.

Commit (docs): "Document accessor-parameter and single scope-fact reconciliation".

## Concrete steps

Run everything from the assigned git worktree root.

Work Item 1 — Red (focused):

```bash
bun test tests/static-analysis/workflow-ast-bindings.test.ts
```

Expect the new `setterParam` and `methodParam` assertions to fail (name absent
from `boundNames`) and every other assertion to pass. Then implement Stage C and
re-run; expect all pass.

Work Item 2 — Red (focused):

```bash
bun test tests/diagnostics/architecture.test.ts
```

Expect the new "computes scope-owned facts once" assertion to fail on current
code. Implement Stage C and re-run; expect pass. Also run the scope/alias unit
suites:

```bash
bun test tests/static-analysis/workflow-ast-scopes.test.ts
bun test tests/static-analysis/workflow-deterministic-time-alias-scopes.test.ts
```

Full commit gate for each code work item:

```bash
make all
```

Markdown gates for Work Item 3:

```bash
make markdownlint
make nixie
```

Expected `make all` transcript tail (illustrative):

```plaintext
... bun test ... 0 fail
```

## Validation and acceptance

Acceptance is behavioural and observable:

- Given a workflow body
  `const o = { set x(setterParam) {}, m(methodParam) {} };`, the public facts
  from `collectWorkflowAstFacts` satisfy
  `isIdentifierBound(facts.lexicalBindings, "setterParam") === true` and
  `isIdentifierBound(facts.lexicalBindings, "methodParam") === true`. Before
  Work Item 1 both are `false`.
- The architecture guard proves `enterDeterministicTimeScope` calls
  `scopeOwnFacts` exactly once and uses the `*WithOwnFacts` variants. Before
  Work Item 2 the guard fails.
- Every pre-existing deterministic-time diagnostic test passes with no changed
  expectations, demonstrating diagnostics are unchanged.

Red-Green-Refactor evidence to record in `Progress` as work proceeds:

- Work Item 1: Red command
  `bun test tests/static-analysis/workflow-ast-bindings.test.ts` fails on the
  two new parameter assertions; Green after adding the collectors; Refactor
  re-runs `make all`.
- Work Item 2: Red command `bun test tests/diagnostics/architecture.test.ts`
  fails on the single-computation assertion; Green after the
  `enterDeterministicTimeScope` rewrite; Refactor re-runs `make all`.

Quality criteria ("done"):

- Tests: all suites pass under `make all`; the new Red tests fail before and
  pass after their implementation.
- Lint/typecheck: `make lint` and `make typecheck` (both inside `make all`)
  pass.
- Markdown (Work Item 3): `make markdownlint` and `make nixie` pass.
- No public API signature or exported-symbol inventory change.

The deterministic commit gates for this run are `make all`. `AGENTS.md` is
authoritative: `make all` runs `build`, `check-fmt`, `whitespace-hygiene`,
`lint`, `typecheck`, and `test`. Markdown changes additionally require
`make markdownlint` and `make nixie`. Do not report gates green unless every
required gate passed at HEAD.

## Idempotence and recovery

All steps are re-runnable. The source edits are additive (new collectors, new
`*WithOwnFacts` variants) plus one rewritten internal function; re-applying is
safe. If a gate fails, fix forward and re-run `make all`; nothing here is
destructive and no data migration is involved. If Work Item 2's guard test
proves too brittle to express against the TypeScript AST, fall back to an
equivalence property test (scanner diagnostics for a corpus of nested-scope
bodies must equal a snapshot captured before the refactor) and record the
substitution in the Decision Log.

## Interfaces and dependencies

Locked library facts, anchored to checked-in `bun.lock`, which pins
`@swc/core@1.15.43` and its `@swc/types@0.1.27` dependency:

- `SetterProperty extends PropBase, HasSpan { type: "SetterProperty"; param:
  Pattern; body?: BlockStatement }` — a single `param` pattern.
- `MethodProperty extends PropBase, Fn { type: "MethodProperty" }` — inherits
  `params` and `body` from `Fn`, so it is collected like a function expression.
- `GetterProperty extends PropBase, HasSpan { type: "GetterProperty"; body?:
  BlockStatement }` — no parameters.
- `Param { type: "Parameter"; pat: Pattern }` — `collectFunctionParamBindings`
  already unwraps `Parameter` to its `pat`.

New/changed internal signatures at milestone end:

- In `src/static-analysis/workflow-ast-scopes.ts`:

  ```typescript
  export const enterScopeWithOwnFacts: (
    view: LexicalBindingFacts,
    facts: ScopeOwnFacts,
  ) => LexicalBindingFacts;
  ```

- In `src/static-analysis/workflow-deterministic-time-aliases.ts`:

  ```typescript
  export const enterAliasScopeWithOwnFacts: (
    parentAliases: DeterministicTimeAliases,
    childBindings: LexicalBindingFacts,
    facts: ScopeOwnFacts,
    rules: DeterministicTimeAliasRules,
  ) => DeterministicTimeAliases;
  ```

- In `src/static-analysis/workflow-ast-bindings.ts`,
  `STATEMENT_BINDING_COLLECTORS` gains `SetterProperty` and `MethodProperty`
  entries of type `BindingCollector = (node: AstNode, boundNames: Set<string>)
  => void`.

No public package exports change. No new dependencies.

## Revision note

Initial draft (2026-07-05). Establishes three work items: (1) align public flat
binding facts to collect object-literal setter/method parameters; (2) compute
scope-owned facts once per scope-opening node via additive `*WithOwnFacts`
variants; (3) documentation. All branch-local facts verified by direct file
inspection because `bun test` and `grepai`/`leta` probes required interactive
approval unavailable to the planning agent; the divergence is nonetheless pinned
by the existing scope test and the absence of `SetterProperty`/`MethodProperty`
collectors in `workflow-ast-bindings.ts`, and will be confirmed by the Work
Item 1 Red test during implementation.

Revision 2 (2026-07-05). Resolved the sole design-review blocking point: the
`Tolerances` "Scope" trigger (`more than 6 source/test files … stop and
escalate`) contradicted the plan's own work list, which mandates nine
source/test edits (three in Work Item 1, six in Work Item 2). Under a
whole-plan reading, an implementer honouring the binding tolerance would have
had to stop-and-escalate before finishing the planned work, making the plan
non-executable. The `Scope` tolerance is now split into (a) the sanctioned
per-work-item and whole-plan footprint (three + six = nine source/test files,
plus up to two docs files) and (b) an escalation trigger stated as a
**per-code-work-item** 6-file bound and a whole-plan bound of >9 source/test
files, explicitly noting the planned footprint sits inside every bound so no
premature stop is forced. No work items, mechanisms, or verified library facts
changed.
