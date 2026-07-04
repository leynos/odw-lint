# Add scope-precise deterministic-time shadowing

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint` statically checks Open Dynamic Workflows (ODW) source without
executing it. Roadmap task 3.1.5 (`docs/roadmap.md` lines 833-840) sharpens the
deterministic-time Claude-compatibility warnings so a workflow-local `Date`,
`Math`, or `globalThis` binding suppresses only the bare-global references that
are *lexically in scope at the use site*, instead of every same-named reference
anywhere in the body.

Task 3.1.4 delivered shadow-aware detection but used a deliberately conservative
*whole-body name-set* oracle: `collectLexicalBindings(module)` flattens every
binding declared anywhere in the body into a single `boundNames` list, and
`isIdentifierBound(facts, name)` answers "is this name declared *somewhere* in
the body?" (`docs/execplans/roadmap-3-1-4.md` Decision Log: "shadow suppression
is conservative name-set membership … not scope-precise analysis … Scope-precise
binding analysis remains a deferred refinement"). Task 3.1.5 *is* that deferred
refinement.

Verbatim roadmap success line (`docs/roadmap.md` lines 838-840): "fixtures prove
same-name bindings in unrelated scopes no longer hide supported Claude
compatibility warnings, while local shadows remain suppressed."

The concrete defect this fixes: today a nested function that names a parameter
`Date` adds `Date` to the whole-body set, so an *unrelated* top-level
`Date.now()` is silently suppressed. After this change:

```js
function withLocalClock(Date) {
  return Date.now(); // local shadow → still suppressed (no warning)
}
const stamp = Date.now(); // real global in an unrelated scope → warns
```

The first `Date.now()` resolves to the parameter and stays suppressed; the
second resolves to the JavaScript global and now emits exactly one
`odw/no-date-now` warning with an original-source span. Every existing
top-level shadow case (a body-level `const Date = …` before a body-level
`Date.now()`) remains suppressed, and the nine trusted ODW example fixtures
continue to produce zero Claude-compatibility diagnostics.

Observable proof (see `Validation and acceptance`):

1. `scanDeterministicTimeWarnings` on
   `function f(Date) { return Date.now(); }\nconst t = Date.now();` returns
   exactly one `odw/no-date-now` whose sliced span is the *second* `Date.now`
   (the top-level one); today it returns `[]`.
2. `scanDeterministicTimeWarnings` on
   `const Date = createClock();\nconst t = Date.now();` still returns `[]` (the
   body-level shadow encloses the use).
3. `lintWorkflowSource` over the same two-scope workflow reports exactly one
   `claudeCompatibility` diagnostic.
4. `make all` passes at every commit; `make markdownlint` and `make nixie`
   pass for the documentation commit.

### Scope boundary with adjacent tasks (read this first)

- **3.1.5 owns** scope-precise shadowing for the *bare-identifier and
  `globalThis`-root* resolution used by the three existing deterministic-time
  rules only (`odw/no-date-now`, `odw/no-math-random`, `odw/no-argless-new-date`).
  It introduces a lexical *scope* view layered on top of the existing binding
  collector and threads a per-scope binding view through the scanner's walk. It
  changes no rule id, category, default severity, release status, or reviewed
  message, so the diagnostic JSON Schema enum snapshot
  (`tests/diagnostics/schema.test.ts`) and the rule catalogue tests stay
  byte-identical.
- **3.1.5 does not change the public `WorkflowAstFacts` surface.**
  `LexicalBindingFacts` keeps its exact shape (`{ readonly boundNames: readonly
  string[] }`), and `collectLexicalBindings` / `isIdentifierBound` keep their
  current whole-body behaviour and signatures. `collectWorkflowAstFacts` and its
  test (`tests/static-analysis/workflow-ast-facts.test.ts`, which pins the type
  with `expectTypeOf`) are untouched. The scope view is an *internal*
  collaborator, not a new public export.
- **3.1.5 keeps alias handling whole-body-conservative.** Direct aliases
  (`const now = Date.now; now()` and `const D = Date; D.now()`) are collected by
  `collectDeterministicTimeAliases` using the whole-body facts, exactly as
  today. Making alias declaration/use resolution scope-precise is a separate,
  bounded refinement and is explicitly out of scope here (recorded in the
  Decision Log and the rule-doc limitations). This mirrors the existing
  "Alias handling is deliberately bounded" note in
  `src/static-analysis/workflow-deterministic-time-aliases.ts`.
- **Scope precision is at *function* granularity.** Function-like nodes are the
  only scope boundaries; block, `for`, and `catch` scopes are treated as part of
  their enclosing function scope. **The function-like set is the complete set of
  ECMAScript-dialect (ADR 0002) nodes that introduce parameter/local scope:**
  `FunctionDeclaration`, `FunctionExpression`, `ArrowFunctionExpression`,
  `Constructor`, `ClassMethod`, `PrivateMethod`, **and the object-literal
  function forms `MethodProperty`, `GetterProperty`, and `SetterProperty`**
  (verified against `@swc/types/index.d.ts`: `MethodProperty extends PropBase,
  Fn` line 1719 — params + body; `SetterProperty` line 1714 — `param: Pattern` +
  body; `GetterProperty` line 1709 — body). Omitting the object-literal forms
  would let an object-method/accessor parameter or local leak into the enclosing
  function scope and over-suppress an unrelated same-name use — for example
  `const o = { m(Date) { return Date.now(); } };\nconst t = Date.now();` would
  attribute `Date` to the root scope and silence the unrelated top-level
  `Date.now()`, the exact leak the success line forbids. WI2 pins this with a
  positive test. This over-attributes block-scoped `let`/`const` shadows to the
  whole enclosing function, which can only *suppress* a warning that a stricter
  analysis would emit (a false negative), never emit a warning a stricter
  analysis would suppress (a false positive). Preferring a false negative to a
  false positive matches `docs/technical-design.md` §9.2 ("warn and explain")
  and ADR 0001's static-only trust boundary. Block-level precision is a
  documented further refinement.

Design references: `docs/technical-design.md` §§4, 5, 6.1, 6.2 (the
`WorkflowAstFacts` layer that carries shadow facts), 6.4, 8, 9.2 (the three
Claude-compatibility rules), 11.5 (span-mapping invariant), 12.1 (trust
boundary); `docs/adr/0001-static-analysis-boundary.md`;
`docs/adr/0002-workflow-body-parser-dialect-scope.md` (ECMAScript dialect, no
TypeScript-only nodes); `docs/developers-guide.md` "Workflow AST facts"
(lines 83-104); `docs/complexity-antipatterns-and-refactoring-strategies.md`
(single-responsibility helpers, extract predicates, files under 400 lines);
`docs/scripting-standards.md`; `docs/documentation-style-guide.md`;
`docs/roadmap.md` task 3.1.5 (requires 2.2.4 and 3.1.4, both `[x]`); `AGENTS.md`
(quality gates, TypeScript guidance, testing rules, 400-line file limit, DRY /
separate atomic refactors, en-GB Oxford spelling).

## Constraints

- **Never execute or evaluate workflow source.** Detection stays parse-and-walk
  only; the sole permitted parser call remains `@swc/core`'s `parseSync` over
  normalized text via `parseNormalizedWorkflowBody` (`docs/technical-design.md`
  §12.1; `docs/adr/0001`;
  `tests/static-analysis/hostile-metadata-security.test.ts` and
  `tests/diagnostics/import-policy.test.ts` stay green).
- **Do not import ODW runtime or ODW static helpers** (`scanDualCompat`,
  `checkMeta`, `loadWorkflowScript`, `createPrimitives`, `validate`) in
  production code (`docs/adr/0001`; the forbidden-import architecture test).
- **No public API change.** `LexicalBindingFacts` keeps shape `{ readonly
  boundNames: readonly string[] }`; `collectLexicalBindings`, `isIdentifierBound`
  keep their signatures and whole-body behaviour; nothing new is re-exported from
  `src/index.ts` or `src/static-analysis/index.ts`
  (`tests/diagnostics/public-api-fixtures.ts` and
  `tests/static-analysis/workflow-ast-facts.test.ts` stay green with no edits).
  New modules are internal collaborators like
  `src/static-analysis/workflow-global-object-reference.ts`.
- **No `@swc/core` type leak.** New modules consume SWC types internally only;
  no SWC type is re-exported.
- **No `Diagnostic` shape change and no catalogue change.** `RULE_IDS`, rule
  categories, default severities, release statuses, and reviewed messages are
  unchanged; `tests/diagnostics/schema.test.ts` and
  `tests/diagnostics/rule-catalogue.test.ts` stay green with no edits.
- **Span discipline.** Diagnostic spans remain UTF-8 byte offsets mapped through
  `originalSpanFromNormalizedOffsets`; the module-base subtraction
  (`node.span.start - module.span.start`) is preserved exactly
  (`docs/technical-design.md` §11.5). The walk still visits a node before its
  children, so diagnostic source order and the 3.1.2.1 ordering snapshots are
  unchanged.
- **Trusted fixtures stay warning-free.** The nine ODW example fixtures under
  `tests/static-analysis/fixtures/odw-examples/` must continue to produce zero
  Claude-compatibility diagnostics; the zero-false-positive assertion in
  `tests/static-analysis/deterministic-time-spans.test.ts` stays green.
- **Do not modify raw fixtures** under
  `tests/static-analysis/fixtures/odw-examples/` or
  `.../fixtures/invalid-workflows/` (`docs/developers-guide.md` "Workflow
  Fixture Corpus").
- **File size < 400 physical lines** for every touched code file
  (`tests/build-gate/file-size.test.ts`; `AGENTS.md`). Split the scope resolver
  and any shared pattern-collection helper into their own modules rather than
  growing `workflow-ast-bindings.ts` past the limit.
- **en-GB Oxford spelling** ("-ize"/"-yse"/"-our") in all prose, comments, and
  commit messages (`AGENTS.md`; `docs/documentation-style-guide.md`).

## Tolerances (exception triggers)

- **Scope:** if implementation net-touches more than 12 files or ~500 net lines
  of code, stop and escalate.
- **Interface:** if a public API signature (`LexicalBindingFacts`,
  `collectLexicalBindings`, `isIdentifierBound`, `resolveGlobalObjectIdentity`,
  `scanDeterministicTimeWarnings`) must change to achieve scope precision, stop
  and escalate.
- **Facts seam:** if the whole-body `collectLexicalBindings` cannot be reused as
  the *flat* input for the alias pass while a *separate* per-scope view drives
  the hazard walk — for example if the two views cannot share the destructuring
  pattern collectors without a public-export change — stop and record the seam
  problem before improvising.
- **Trusted-fixture behaviour:** if scope precision turns a previously-zero ODW
  example fixture into a warning, stop and escalate before editing any fixture:
  either the fixture harbours a genuine unrelated-scope global (a real finding to
  surface) or the scope model is wrong. Do not silence it by editing the raw
  fixture.
- **Dependencies:** no new runtime dependency is expected. If one appears
  necessary, stop and escalate.
- **Iterations:** if a milestone's focused tests still fail after 4 attempts for
  a reason other than an intended snapshot update, stop and escalate.
- **Ambiguity:** if scope-precise suppression for a supported form cannot be
  decided without evaluating source or importing ODW, stop and present options.

## Risks

- Risk: the scope own-name collector accidentally attributes a *nested
  function's* parameters or locals to the enclosing scope, reintroducing the
  whole-body leak this task removes (for example `function f(Date){}` still
  suppresses a sibling `Date.now()`).
  Severity: high (this is the task's core behaviour). Likelihood: medium.
  Mitigation: the collector's single rule is "record a nested function-like
  node's *declared name* in the enclosing scope, but never descend into its
  params or body". WI2 pins the exact unrelated-scope positive
  (`function f(Date){ Date.now(); }\nconst t = Date.now();` warns exactly once)
  and the enclosed-scope negative (`function f(Date){ return Date.now(); }` warns
  zero) as Red→Green cases.
- Risk: the function-like scope-boundary set is *incomplete* and omits
  object-literal function forms (`MethodProperty`, `GetterProperty`,
  `SetterProperty`), so an object-method/accessor param or local leaks into the
  enclosing scope and over-suppresses an unrelated same-name use — contradicting
  the success line and the "function-like nodes are the only scope boundaries"
  invariant.
  Severity: high. Likelihood: medium (the omission was present in planning round
  1).
  Mitigation: `FUNCTION_LIKE_SCOPE_TYPES` is defined once and enumerates all
  nine ECMAScript-dialect scope-opening node types, verified against
  `@swc/types/index.d.ts` (lines 1709/1714/1719). WI2 pins the object-method,
  getter, and setter unrelated-scope positives (each warns exactly once) and the
  enclosed-scope negative (`const o = { m(Date){ return Date.now(); } };` warns
  zero) as Red→Green regression guards.
- Risk: the refactor that shares the destructuring pattern collectors between
  the flat collector and the scope collector regresses `collectLexicalBindings`
  output (which `collectWorkflowAstFacts` and its type test depend on).
  Severity: high. Likelihood: low.
  Mitigation: WI1 is a behaviour-preserving extraction guarded by the existing,
  comprehensive `tests/static-analysis/workflow-ast-bindings.test.ts` (every
  binding form, nested defaults, class members, the fast-check name property).
  The flat collector keeps passing its function-descending recursion callback, so
  its output is unchanged; the suite must stay green before and after with no
  edits.
- Risk: a `var` or function declaration inside a nested block is block-attributed
  and therefore under-suppresses relative to true `var` hoisting.
  Severity: low. Likelihood: low.
  Mitigation: the scope collector recurses *through* non-function blocks (blocks
  are transparent, part of the enclosing function scope), so `var`/function/`let`
  declared in a nested block are attributed to the enclosing function — the
  safe (over-suppressing) direction. Documented as an intentional conservative
  limit; a WI3 case pins it.
- Risk: reintroducing per-scope facts changes the source order or count pinned by
  the 3.1.2.1 intra-expression ordering snapshots
  (`tests/static-analysis/deterministic-time-spans.test.ts`).
  Severity: medium. Likelihood: low.
  Mitigation: the walk still visits each node before its children and only
  *filters* matches by the current scope view; it never reorders them. The
  ordering snapshots and the trusted-fixture zero assertion must pass unchanged.
- Risk: the sibling ODW checkout is outside this session's sandbox, so
  `scanDualCompat`'s scope behaviour cannot be read for a parity claim.
  Severity: low. Likelihood: high (already observed — see Tooling note).
  Mitigation: `docs/adr/0001` forbids importing `scanDualCompat`; the 3.1.5
  success line is defined against lexical scope, not against a live ODW import,
  so behaviour is pinned by the success line and tests.

## Tooling availability note (planning session)

Per the standing rules, advisory tooling that was unavailable during planning,
with the bounded local fallback used instead:

- `grepai search` and `leta` invocations were blocked in this agent session
  (the harness required per-command approval for the `grepai`/`leta`
  executables). Fallback: every branch-local claim in this plan was verified by
  direct file inspection in the worktree (the source modules, tests, fixtures,
  rule docs, and `docs/roadmap.md` line ranges are all cited from reads
  performed this session). The implementer should use `leta` for navigation as
  normal once approved.
- The sibling ODW checkout `/data/leynos/Projects/open-dynamic-workflows` was
  not read; `docs/adr/0001` bars importing `scanDualCompat`, so behaviour is
  pinned to the roadmap success line and trusted-fixture parity instead.
- `@swc/core@1.15.x` AST shapes were pinned by reading the installed
  `@swc/types` declarations at
  `/data/leynos/Projects/odw-lint/node_modules/@swc/types/index.d.ts` (function
  and parameter shapes cited under "Interfaces and dependencies"). The worktree
  itself may need `make build` before `bun test`.

## Context and orientation

A novice needs these files:

- `src/static-analysis/workflow-deterministic-time.ts` —
  `scanDeterministicTimeWarnings(envelope, parseResult?)` parses the normalized
  body, computes `bindings = collectLexicalBindings(parseResult.module)` once
  (line 65), collects aliases, then walks the SWC AST in source order
  (`visitNode` before children) passing the *same* `bindings` object to every
  match. `matchDeterministicTimeHazard` → `isGlobalMemberCall` /
  `isArglessNewDate` → `objectIdentityForExpression(expr, bindings, aliases)`.
  This constant `bindings` is what 3.1.5 replaces with a per-scope view during
  the walk.
- `src/static-analysis/workflow-ast-bindings.ts` —
  `collectLexicalBindings(module): LexicalBindingFacts` returns a frozen, sorted,
  unique whole-body `boundNames` list (wrapper name excluded);
  `isIdentifierBound(facts, name)` is the membership predicate. It recurses into
  *everything*, including nested function bodies (proved by the test "reports
  nested function locals in the conservative name set"). The private collectors
  (`STATEMENT_BINDING_COLLECTORS`, `PATTERN_BINDING_COLLECTORS`,
  `OBJECT_PROPERTY_BINDING_COLLECTORS`, `collectPatternBindings`,
  `collectFunctionLikeBindings`, `asNode`, `arrayValue`, `identifierName`,
  `EXCLUDED_BINDING_NAMES`) are the reuse surface for the scope collector.
- `src/static-analysis/workflow-global-object-reference.ts` —
  `resolveGlobalObjectIdentity(node, bindings: LexicalBindingFacts)` and
  `resolveStaticMemberName(property)`. `unshadowedGlobalIdentity` calls
  `isIdentifierBound(bindings, name)`. Because the shadow oracle is *just a
  `LexicalBindingFacts`*, passing a per-scope `LexicalBindingFacts` here makes
  the resolver scope-precise with **no signature change** and no edit to its
  unit test (`tests/static-analysis/workflow-global-object-reference.test.ts`).
- `src/static-analysis/workflow-deterministic-time-aliases.ts` —
  `collectDeterministicTimeAliases(module, bindings, rules)`,
  `objectIdentityForExpression(expr, bindings, aliases)`, `aliasCallMatch`. The
  alias *collection* keeps using the whole-body `bindings`; only the hazard-walk
  call to `objectIdentityForExpression` receives the per-scope view.
- `src/static-analysis/workflow-body-normalizer.ts` —
  `WORKFLOW_BODY_WRAP_FUNCTION_NAME` (the synthetic wrapper) and
  `originalSpanFromNormalizedOffsets`. The wrapper `FunctionDeclaration` is the
  root user scope.
- `src/static-analysis/workflow-body-parse.ts` — internal shared parse helper;
  `parseNormalizedWorkflowBody` returns `{ ok, module, normalized }` on success.
- `src/static-analysis/workflow-body-parser.ts` — public body-syntax adapter
  over that shared parse helper. Unchanged.
- `src/static-analysis/workflow-ast-facts.ts` — `collectWorkflowAstFacts`
  aggregates `lexicalBindings` via `collectLexicalBindings`. Unchanged;
  guarantees the flat collector's output contract must not drift.
- `src/static-analysis/workflow-lint.ts` (line 93) calls
  `scanDeterministicTimeWarnings(envelope, bodyParse)`; this wiring is unchanged.
- `tests/static-analysis/workflow-deterministic-time.test.ts` — `POSITIVE_CASES`,
  `NEGATIVE_BODIES`, `SHADOW_NEGATIVE_BODIES` (top-level shadows), `scanBody`,
  the source-order test, and the fast-check shadow-invariance property. The
  unrelated-scope headline lands here.
- `tests/static-analysis/workflow-ast-bindings.test.ts` — the regression guard
  for the WI1 extraction (must stay green unedited).
- `tests/static-analysis/deterministic-time-spans.test.ts` — span-oracle
  snapshots including the 3.1.2.1 ordering cases and the
  `ODW_EXAMPLE_FIXTURE_SNAPSHOTS` zero-false-positive proof.
- `tests/static-analysis/workflow-lint.test.ts` — full-pipeline merge-order and
  freeze assertions.
- `tests/diagnostics/architecture-fixtures.ts` —
  `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` (lines 38-77) pins the exact
  static-analysis module inventory; every new module filename must be inserted in
  alphabetical position.

Terms:

- **Lexical binding.** A name the body *declares* (`const`/`let`/`var`, a
  function or class declaration name, a parameter, a destructured element, a
  `catch (e)` parameter). A *reference* is not a binding.
- **Scope (this task).** A region governed by a function-like node
  (`FunctionDeclaration`, `FunctionExpression`, `ArrowFunctionExpression`,
  `Constructor`, `ClassMethod`, `PrivateMethod`, `MethodProperty`,
  `GetterProperty`, `SetterProperty`) plus the synthetic wrapper body that holds
  the top-level user statements. Blocks, `for` heads, and `catch` clauses are
  *not* separate scopes here; they belong to the enclosing function scope.
- **Own names of a scope.** The names a scope binds directly: its parameters plus
  every binding declared in its body that is not inside a nested function scope.
  A nested function-like declaration contributes only its *name* to the
  enclosing scope, not its params or body — and it contributes a name **only**
  when the node carries a hoisted binding identifier (`FunctionDeclaration`; a
  `FunctionExpression`'s own name and an object-method/accessor *property key*
  are not bindings in the enclosing scope, so no name is recorded for them). The
  scope collector reads the declared name solely from the node's `identifier`
  field (present on `FunctionDeclaration`/`FunctionExpression`, absent on
  `MethodProperty`/`GetterProperty`/`SetterProperty`), so a property key such as
  `Date` in `{ Date() {} }` is never mistaken for a `Date` binding.
- **Scope binding view.** A `LexicalBindingFacts` whose `boundNames` is the union
  of the own names of every scope on the path from the module root down to the
  current node. Passing this view to `resolveGlobalObjectIdentity` yields
  scope-precise shadowing.
- **Shadowed at the use site.** A bare `Date`/`Math`/`globalThis` reference is
  shadowed iff its name is in the scope binding view at that node — i.e. some
  enclosing scope owns the name.

## Detection contract (the behaviour this task pins)

The scanner still walks the parsed body in source order and emits one diagnostic
per match, and the *shape* of a match is unchanged from 3.1.4 (bare/computed/
`globalThis`-chain `Date.now`/`Math.random` calls and arg-less `new Date`). The
only change is the shadow oracle: instead of one whole-body
`LexicalBindingFacts` consulted everywhere, the walk threads a **scope binding
view** that grows and shrinks as it enters and leaves function scopes.

Define, over a parsed `module`:

- `ownScopeNames(scopeNode)`: the own names of one function-like scope (or the
  synthetic wrapper body) — its parameter bindings plus every binding declared in
  its body, recursing through non-function blocks/statements/initializers but
  **stopping at nested function-like nodes** (the full set:
  `FunctionDeclaration`, `FunctionExpression`, `ArrowFunctionExpression`,
  `Constructor`, `ClassMethod`, `PrivateMethod`, `MethodProperty`,
  `GetterProperty`, `SetterProperty`), of which only the declared name is
  recorded — and only when the node carries an `identifier` binding
  (`FunctionDeclaration`; object-method/accessor property keys are not bindings
  and record no name). The synthetic wrapper name
  (`WORKFLOW_BODY_WRAP_FUNCTION_NAME`) is excluded, matching the flat collector.
- `enterScope(view, node)`: if `node` is a function-like scope boundary, return
  a new `LexicalBindingFacts` whose `boundNames` is `view.boundNames ∪
  ownScopeNames(node)`; otherwise return `view` unchanged.
- The walk seeds the top-level view from the module and calls `enterScope`
  before descending into each node, passing the resulting view to
  `matchDeterministicTimeHazard` for that node's subtree.

Then the three hazards resolve exactly as in 3.1.4's contract, but every
`resolveGlobalObjectIdentity(object, view)` / `objectIdentityForExpression(expr,
view, aliases)` call consults the scope binding view rather than the whole-body
set:

- `odw/no-date-now`: a call whose callee member resolves to `Date` object
  identity and `now` member name, where a bare/`globalThis`-root `Date` is a
  global iff not owned by any enclosing scope at that call.
- `odw/no-math-random`: the same with `Math` and `random`.
- `odw/no-argless-new-date`: an arg-less `NewExpression` whose callee resolves to
  `Date` object identity under the scope view.

Consequences, pinned by tests:

- A local shadow that *encloses* the use (parameter, or a body-level binding in
  the same or an enclosing scope) → **no** warning (unchanged from 3.1.4 for
  top-level cases; newly correct for parameter/nested cases).
- A same-named binding in an *unrelated* scope (a sibling function, or a nested
  function whose binding does not enclose the use) → the use **warns** (the new
  behaviour; previously suppressed).
- `globalThis.Date.now()` still warns even when `Date` is locally bound, because
  the chain's object identity comes from `globalThis`; a shadowed `globalThis`
  in an enclosing scope suppresses the whole chain.
- Recognized global roots stay `Date`, `Math`, `globalThis` only. Aliases,
  optional chaining, `window`/`self`/`global`, and dynamic computed keys keep
  their documented 3.1.4 treatment. Alias suppression stays whole-body
  (conservative), unchanged.
- Block/`for`/`catch` shadows are attributed to the enclosing function scope
  (over-suppression), a documented conservative limit.

## Plan of work

Stages map to work items; each is a single atomic commit that passes `make all`
(plus `make markdownlint` and `make nixie` for the documentation commit) and
follows Red → Green → Refactor. No language-router skill applies (the repository
is TypeScript-only); follow `AGENTS.md` TypeScript Guidance and the `code-review`
habits. Load `execplans` (this plan), `leta` (symbol navigation and branch-local
verification before each code touch), `grepai` (intent search against the `main`
index — treat as a pointer, verify with `leta`/file inspection), `biomejs`
(formatting/lint), `en-gb-oxendict` (prose/comments), and — for WI3's property
coverage — consult `python-verification`'s sibling reasoning only as background;
the concrete tool here is `fast-check` (see the Decision Log note; no CrossHair/
mutmut/Hypothesis, which are Python-only).

### WI1 — Extract shared binding-pattern collectors (refactor, no behaviour change)

Read first: `docs/complexity-antipatterns-and-refactoring-strategies.md`
(extract-helper, single responsibility, DRY); `AGENTS.md` "Abstraction / adapter
/ helper policy" and "Separate Atomic Refactors";
`src/static-analysis/workflow-ast-bindings.ts`;
`tests/static-analysis/workflow-ast-bindings.test.ts`;
`tests/diagnostics/architecture-fixtures.ts`.
Skills: `leta`, `biomejs`, `en-gb-oxendict`.

Sweep first (AGENTS.md abstraction policy): confirm with `leta` that no existing
module already exposes reusable pattern-binding collectors (only
`workflow-ast-bindings.ts` does, privately). Record the sweep in the Decision
Log.

Extract the destructuring/parameter pattern collectors and the small AST helpers
into a new internal module `src/static-analysis/workflow-ast-binding-patterns.ts`
(not re-exported). The extracted surface, parameterised by an injected
"recurse into an initialiser expression" callback so each caller supplies its own
recursion policy:

```ts
// src/static-analysis/workflow-ast-binding-patterns.ts
import type { Node } from "@swc/core";

export type AstNode = { readonly type?: string; readonly [key: string]: unknown };
export type ExpressionRecursion = (node: AstNode | undefined) => void;

export const asNode: (value: unknown) => AstNode | undefined;
export const arrayValue: (value: unknown) => readonly unknown[];
export const identifierName: (node: AstNode | undefined) => string | undefined;

/** Collects binding names from a pattern; `recurse` handles nested initialisers. */
export const collectPatternBindings: (
  pattern: unknown,
  boundNames: Set<string>,
  recurse: ExpressionRecursion,
  excluded: ReadonlySet<string>,
) => void;

/** Collects parameter-pattern bindings for a function-like node. */
export const collectFunctionParamBindings: (
  node: AstNode,
  boundNames: Set<string>,
  recurse: ExpressionRecursion,
  excluded: ReadonlySet<string>,
) => void;
```

`workflow-ast-bindings.ts` keeps `collectLexicalBindings`, `isIdentifierBound`,
`LexicalBindingFacts`, `EXCLUDED_BINDING_NAMES`, `STATEMENT_BINDING_COLLECTORS`,
and `compareIdentifierNames`, but delegates pattern extraction to the new module,
passing its existing function-descending `collectStatementBindings` as the
`recurse` callback. Its output is byte-for-byte identical.

Add `"workflow-ast-binding-patterns.ts"` to
`EXPECTED_STATIC_ANALYSIS_MODULE_FILES` in alphabetical position — it sorts
**before** `"workflow-ast-bindings.ts"` (`'-'` `0x2d` precedes `'s'` `0x73`
after the shared prefix `workflow-ast-binding`).

Tests (regression-guarded refactor): no new behaviour, so
`tests/static-analysis/workflow-ast-bindings.test.ts` must pass **unedited**
before and after (it already exercises `const`/`let`/`var`, function
declarations and parameters, object/array destructure, default and catch
parameters, class constructor/method params, nested function locals, nested
defaults, the raw-module fallback, and a fast-check name property). Optionally
add focused unit tests for the extracted `collectPatternBindings` if `leta`
shows a coverage gap, but do not duplicate the existing matrix.

Follow Red → Green → Refactor as a pure refactor: run the binding suite green,
extract, run it green again unchanged.

Validation: `make all`.

### WI2 — Add the scope resolver and rewire the scanner to scope-precise shadowing (feature)

Read first: `docs/technical-design.md` §§6.1, 6.2, 9.2, 11.5; `docs/adr/0001`;
`docs/adr/0002`; `docs/developers-guide.md` "Workflow AST facts";
`src/static-analysis/workflow-deterministic-time.ts`,
`workflow-ast-bindings.ts`, `workflow-ast-binding-patterns.ts`,
`workflow-global-object-reference.ts`, and
`workflow-deterministic-time-aliases.ts`.
Skills: `leta`, `biomejs`, `en-gb-oxendict`.

Create `src/static-analysis/workflow-ast-scopes.ts` (internal, not re-exported)
exporting a small scope-view API built on the WI1 pattern collectors:

```ts
// src/static-analysis/workflow-ast-scopes.ts
import type { Module, Node } from "@swc/core";
import type { LexicalBindingFacts } from "./workflow-ast-bindings";

/** The scope binding view for the top level of a parsed module. */
export const rootScopeView: (module: Module) => LexicalBindingFacts;

/**
 * Returns a child scope view when `node` opens a function-like scope; otherwise
 * returns `view` unchanged. The child view's `boundNames` is the union of the
 * parent view and the node's own scope names.
 */
export const enterScope: (
  view: LexicalBindingFacts,
  node: Node,
) => LexicalBindingFacts;
```

Define the function-like scope-boundary predicate **once** as a shared constant
in `workflow-ast-scopes.ts` and reuse it in both `enterScope` and
`ownScopeNames` so the two can never drift:

```ts
const FUNCTION_LIKE_SCOPE_TYPES: ReadonlySet<string> = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "Constructor",
  "ClassMethod",
  "PrivateMethod",
  "MethodProperty",   // object-literal method: `{ m(p) {} }`
  "GetterProperty",   // object-literal getter: `{ get x() {} }`
  "SetterProperty",   // object-literal setter: `{ set x(v) {} }`
]);
```

This set is the complete list of ECMAScript-dialect (ADR 0002) nodes that open a
parameter/local scope; verified against `@swc/types/index.d.ts` (`MethodProperty
extends PropBase, Fn` line 1719; `SetterProperty` line 1714 with `param:
Pattern`; `GetterProperty` line 1709). Omitting the three object-literal forms
would let their params/locals leak into the enclosing function scope and
over-suppress unrelated same-name uses.

Implement `ownScopeNames(scopeNode)` with a focused recursive walk whose single
scope rule is: on encountering a node whose `type` is in
`FUNCTION_LIKE_SCOPE_TYPES` that is *not* the scope node itself, record its
declared name **only** from its `identifier` field via `identifierName` (present
on `FunctionDeclaration`/`FunctionExpression`; absent on
`MethodProperty`/`GetterProperty`/`SetterProperty`, whose property *key* is not
a lexical binding and must not be recorded), then do **not** descend into its
params or body; otherwise collect the node's direct bindings and recurse through
its non-function children. Direct-binding collection must cover all three param
shapes the boundary nodes carry when they *are* the scope node:
`collectFunctionParamBindings` for the `params` array on nodes that carry it
directly (`Fn`-based `FunctionDeclaration`/`FunctionExpression`/
`ArrowFunctionExpression`, `MethodProperty` — which `extends Fn` — and
`Constructor`) and via the wrapped `function` field on `ClassMethod`/
`PrivateMethod` (reuse the existing `asNode(node.function) ?? node` unwrap), and
`collectPatternBindings(node.param, …)` for the singular `param` field on
`SetterProperty` and `CatchClause` (`GetterProperty` has no params).
Exclude `WORKFLOW_BODY_WRAP_FUNCTION_NAME`. Materialise each view as a frozen,
sorted, unique `LexicalBindingFacts` so it is a drop-in for
`resolveGlobalObjectIdentity`. `rootScopeView(module)` unwraps the synthetic
wrapper (mirroring `collectLexicalBindings`' `userBodyStatements`) so top-level
user declarations are the root scope's own names.

`enterScope(view, node)` opens a child scope for every node in
`FUNCTION_LIKE_SCOPE_TYPES` (so descending the walk into an object method body
correctly enters that method's scope and suppresses uses shadowed by its
params), unioning the parent view with `ownScopeNames(node)`; for any other
node it returns `view` unchanged.

Rewire `src/static-analysis/workflow-deterministic-time.ts`:

- Keep `const bindings = collectLexicalBindings(parseResult.module)` and pass it
  to `collectDeterministicTimeAliases` unchanged (alias collection stays
  whole-body-conservative).
- Thread a `LexicalBindingFacts` *scope view* through the walk instead of the
  constant `bindings`: seed `walkDeterministicTimeHazards` with
  `rootScopeView(parseResult.module)`; in `visitNode`, compute
  `const childView = enterScope(view, node)`, match the hazard on `node` using
  `view` (a scope-boundary node is never itself a hazard, so `view` vs
  `childView` is immaterial for the match), and descend into children with
  `childView`.
- `matchDeterministicTimeHazard` / `isGlobalMemberCall` / `isArglessNewDate` pass
  the threaded scope view to `objectIdentityForExpression`. `aliasCallMatch` is
  unchanged (it consults the alias map, not bindings).

`resolveGlobalObjectIdentity`, `objectIdentityForExpression`,
`collectDeterministicTimeAliases`, and their signatures are **unchanged**: they
already accept a `LexicalBindingFacts`, and a scope view is one.

Add `"workflow-ast-scopes.ts"` to `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` in
alphabetical position — after `"workflow-ast-facts.ts"`, before
`"workflow-body-normalizer.ts"` (`workflow-ast-scopes` vs `workflow-ast-facts`:
`'s'` follows `'f'`).

Tests (Red first) — extend
`tests/static-analysis/workflow-deterministic-time.test.ts`:

- **Unrelated-scope headline (Red→Green):** add positive cases where a nested or
  sibling function binds `Date`/`Math` and a *top-level* bare use follows, and
  assert exactly one warning on the top-level use with its original-source span
  via the span oracle (`decodeSpanText` / `expectSpanToMatchSource` /
  `sliceSourceSpan`). Examples:
  `function f(Date) { return Date.now(); }\nconst t = Date.now();` →
  one `odw/no-date-now` on the second `Date.now`;
  `function g(Math) { return Math.random(); }\nconst s = Math.random();` →
  one `odw/no-math-random`;
  `function h(Date) { return new Date(); }\nconst d = new Date();` →
  one `odw/no-argless-new-date`. These return `[]` under the old scanner (Red)
  and warn once after the rewire (Green).
- **Enclosed-scope negatives (must stay green):** every existing
  `SHADOW_NEGATIVE_BODIES` case (top-level and parameter shadows enclosing the
  use) still returns `[]`. Add nested-enclosing cases:
  `function f(Date) { const t = Date.now(); return t; }` → `[]`;
  an arrow `const f = (Math) => Math.random();` → `[]`.
- **`globalThis` cross-scope:** `function f(globalThis){ return
  globalThis.Date.now(); }` → `[]` (the parameter encloses the chain), while a
  top-level `globalThis.Date.now()` in the same body → one warning. Keep the two
  existing top-level `globalThis` cases green.
- **Sibling-scope independence:** two sibling functions, one binding `Date` and
  one using bare `Date.now()`, warn exactly once (only the non-binding sibling).
- **Object-literal method/accessor scope (Red→Green regression guard for
  blocking point 1):** an object method or accessor whose parameter or local
  shadows `Date` must *not* leak into the enclosing scope. Each of the three
  positive bodies below, followed by a top-level `const t = Date.now();`, warns
  exactly once on that top-level `Date.now` (the object member's binding does not
  reach the root scope):

  ```js
  const o1 = { m(Date) { return Date.now(); } };            // method param
  const o2 = { get x() { const Date = clock(); return Date.now(); } }; // getter local
  const o3 = { set x(Date) { return Date.now(); } };        // setter param
  ```

  Enclosed negative: the method body alone,
  `const o = { m(Date) { return Date.now(); } };` with no top-level use, returns
  `[]` — the method's own param still suppresses the use *inside* the method
  scope. Under a scope model that omits the object-literal forms the three
  positives return `[]` (Red); after the complete boundary set they warn once
  (Green).

Follow Red → Green → Refactor: write the failing unrelated-scope cases first,
confirm the Red for the intended reason (old scanner suppresses via the
whole-body set), then implement the scope view and rewire.

Validation: `make all`.

### WI3 — Scope-precision span, pipeline, and property coverage (tests)

Read first: `docs/technical-design.md` §11.5; `AGENTS.md` Testing (span
snapshots, `fast-check` for range/ordering behaviour, deterministic tests);
`tests/static-analysis/deterministic-time-spans.test.ts`,
`tests/static-analysis/workflow-lint.test.ts`, and
`tests/static-analysis/workflow-deterministic-time.test.ts`.
Skills: `leta`, `biomejs`, `en-gb-oxendict`.

- Extend `deterministic-time-spans.test.ts` with the unrelated-scope span case:
  a body binding `Date` in a nested function followed by a top-level
  `Date.now()` produces one diagnostic whose original-source span is the
  top-level `Date.now`. Leave the 3.1.2.1 intra-expression ordering cases and the
  `ODW_EXAMPLE_FIXTURE_SNAPSHOTS` zero-false-positive assertion unchanged — they
  must still pass, proving trusted fixtures stay warning-free under scope
  precision.
- Add a full-pipeline case to `workflow-lint.test.ts`: a complete workflow with
  a parameter-shadowing helper and an unrelated top-level `Date.now()` returns
  exactly one `claudeCompatibility` diagnostic from `lintWorkflowSource`, and a
  workflow whose only `Date.now()` is enclosed by a `Date` parameter returns
  zero. This proves the scope view reaches the merged pipeline, not just the
  standalone scanner.
- Add one `fast-check` property to `workflow-deterministic-time.test.ts`: for a
  generated valid identifier `name` **drawn from a generator that excludes the
  `Date` root**, the body
  `function helper(Date) { return Date.now(); }\nconst ${name} = Date.now();`
  always yields exactly one `odw/no-date-now` (the top-level use), independent of
  `name`; and the body `function helper(Date) { const inner = Date.now(); return
  inner; }` always yields `[]`. **Do not reuse the existing `VALID_IDENTIFIER`
  generator (line 47): it includes `fc.constant("Date")`, and when `name` is
  `Date` the body becomes `const Date = Date.now();`, whose top-level
  `const Date` is a root-scope own name that shadows the top-level `Date.now()`
  — the scanner then returns `[]`, falsifying the "exactly one, independent of
  `name`" invariant.** Introduce a dedicated `NON_DATE_IDENTIFIER` generator
  (the same first-char/rest-char construction as `VALID_IDENTIFIER` but
  *without* the `fc.constant("Date")` arm and with a `.filter`-free guard so no
  generated name equals `Date` — build it by construction from the
  lower-case/`_`/`$` first-character set, which cannot produce that capitalised
  root, to avoid the fast-check filtering trap per
  `AGENTS.md` and the 2.2.4 whitespace counter-example). The invariant this
  property pins is therefore:
  *for any non-`Date` identifier `name`, the two-scope body warns exactly
  once on the top-level use.* Record in the Decision Log why `fast-check`
  invariance — not CrossHair/mutmut/Hypothesis (Python-only) — is the right
  adversary for an exact-membership scope invariant, and why the generator must
  exclude the `Date` root. Keep `Math` and `globalThis` coverage in the focused
  example tests where those names are semantically relevant.
- Add one conservative-limit case documenting block-attribution: a body
  `{ const Date = createClock(); }\nconst t = Date.now();` is *suppressed*
  (over-attribution to the enclosing function scope) and is pinned as the
  intended conservative behaviour, not a bug.

Validation: `make all`.

### WI4 — Documentation and roadmap tick (docs)

Read first: `docs/documentation-style-guide.md`; `AGENTS.md` Markdown Guidance
(80-column prose, 120-column code, en-GB); `docs/developers-guide.md` "Workflow
AST facts"; the three rule docs.
Skills: `en-gb-oxendict`, `execplans`.

- Update the "## Limitations" section of `docs/rules/no-date-now.md`,
  `docs/rules/no-math-random.md`, and `docs/rules/no-argless-new-date.md`:
  replace "declares a local `Date` binding" (whole-body wording) with
  scope-precise wording — the scanner ignores a bare `Date`/`Math` reference only
  when a `Date`/`Math` binding is **in scope at that reference** (its own scope
  or an enclosing scope); a same-named binding in an unrelated scope no longer
  hides the warning. Note the residual conservative limits: block/`for`/`catch`
  shadows are attributed to the enclosing function scope (may over-suppress), and
  alias suppression remains whole-body. Keep the `## Failing example` and
  `## Fixed example` blocks intact (the docs contract test requires them).
- Update `docs/developers-guide.md` "Workflow AST facts" (lines 91-104): keep the
  statement that the public `LexicalBindingFacts` model is name-based/whole-body,
  and add that the deterministic-time scanner now layers a *function-scope* view
  on top of those facts internally, so it suppresses `Date`/`Math`/`globalThis`
  references only when shadowed at the use site, while the public facts and the
  future orchestration rules keep consuming the whole-body model.
- Tick roadmap task 3.1.5: change `- [ ] 3.1.5.` to `- [x] 3.1.5.` at
  `docs/roadmap.md` line 833.

Format only the changed Markdown files, then run the documented validators:

```bash
mdtablefix docs/rules/no-date-now.md docs/rules/no-math-random.md \
  docs/rules/no-argless-new-date.md docs/developers-guide.md docs/roadmap.md
markdownlint-cli2 --fix docs/rules/no-date-now.md docs/rules/no-math-random.md \
  docs/rules/no-argless-new-date.md docs/developers-guide.md docs/roadmap.md
make markdownlint
make nixie
```

Validation: `make markdownlint`, `make nixie`, and `make all`.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-3-1-5`. If `bun test` fails to
resolve modules, run `make build` first to install dependencies.

1. WI1: sweep for existing pattern helpers with `leta`; extract
   `workflow-ast-binding-patterns.ts`; delegate from `workflow-ast-bindings.ts`;
   add the module to the inventory. Prove the binding suite green before and
   after, unedited:

   ```bash
   bun test tests/static-analysis/workflow-ast-bindings.test.ts
   # after the extraction, unchanged suite:
   bun test tests/static-analysis/workflow-ast-bindings.test.ts
   bunx @biomejs/biome format --write \
     src/static-analysis/workflow-ast-binding-patterns.ts \
     src/static-analysis/workflow-ast-bindings.ts \
     tests/diagnostics/architecture-fixtures.ts
   make all
   ```

2. WI2: create `workflow-ast-scopes.ts`; rewire the scanner walk; add the module
   to the inventory; add the unrelated-scope Red cases first. Prove Red then
   Green:

   ```bash
   bun test tests/static-analysis/workflow-deterministic-time.test.ts
   # after the rewire:
   bun test tests/static-analysis/workflow-deterministic-time.test.ts
   bunx @biomejs/biome format --write \
     src/static-analysis/workflow-ast-scopes.ts \
     src/static-analysis/workflow-deterministic-time.ts \
     tests/static-analysis/workflow-deterministic-time.test.ts \
     tests/diagnostics/architecture-fixtures.ts
   make all
   ```

3. WI3: extend the span, pipeline, and property suites:

   ```bash
   bun test tests/static-analysis/deterministic-time-spans.test.ts
   bunx @biomejs/biome format --write \
     tests/static-analysis/deterministic-time-spans.test.ts \
     tests/static-analysis/workflow-lint.test.ts \
     tests/static-analysis/workflow-deterministic-time.test.ts
   make all
   ```

4. WI4: edit the five Markdown files, format them, then run the Markdown gates
   and `make all`.

Commit after each work item with an imperative, en-GB, ≤50-character subject and
a wrapped body explaining what and why (`AGENTS.md` Committing). Gate every
commit with `make all` (plus `make markdownlint` and `make nixie` for WI4). Name
any parked formatter churn per the standing stash convention.

## Validation and acceptance

Acceptance is behavioural at the scanner and pipeline level and gate-based.

- Running `make all` passes at every commit (build, format check, whitespace
  hygiene, lint, typecheck, tests).
- Unrelated-scope precision (WI2, WI3): a body with a `Date`/`Math` binding in a
  nested or sibling function and an unrelated top-level bare use warns exactly
  once on the top-level use, with the original-source span pointing at it; today
  it returns `[]` (the Red→Green headline).
- Enclosed-scope suppression (WI2): parameter and body-level shadows that enclose
  the use return `[]`; all existing `SHADOW_NEGATIVE_BODIES` stay green.
- `globalThis` behaviour (WI2): an enclosing `globalThis` binding suppresses the
  chain; an unrelated `Date` binding does not.
- Regression (WI1, WI3): `tests/static-analysis/workflow-ast-bindings.test.ts`
  passes unedited; the 3.1.2.1 intra-expression ordering snapshots and the
  nine-fixture zero-false-positive assertion pass unchanged; the merge-order
  property in `workflow-lint.test.ts` still holds; `RULE_IDS`, the schema
  snapshot, and the public-API fixtures are byte-identical.
- Red-Green-Refactor evidence: the unrelated-scope positives are Red before the
  rewire (old scanner suppresses via the whole-body set) and Green after; WI1 is
  a behaviour-preserving refactor guarded by an unedited suite.
- Markdown (WI4): `make markdownlint` and `make nixie` pass; the three rule-doc
  Limitations sections describe scope-precise behaviour; roadmap 3.1.5 is ticked.

Quality criteria ("done"):

- Tests: the extended deterministic-time, span, and pipeline suites pass under
  `make test`; existing suites pass unchanged.
- Lint/format/typecheck: clean under `make all`; no `@swc/core` type appears in
  a public export; every touched file stays under 400 lines.
- Docs: three rule pages and the developers' guide updated; roadmap 3.1.5 `[x]`.

Quality method: `make all` at each commit; manual review of any span-snapshot
diff before committing (`AGENTS.md` snapshot policy).

## Idempotence and recovery

- Every new test builds its source in memory and is deterministic; re-running any
  step is safe.
- The WI1 extraction is reversible by re-inlining the collectors; because the
  flat collector's output is unchanged, no downstream fixture changes.
- If an unrelated-scope use fails to warn, confirm `ownScopeNames` does not
  descend into nested function params/bodies (the leak) and that `enterScope`
  unions rather than replaces the parent view; if an enclosed use warns, confirm
  the scope view is threaded (not the whole-body `bindings`) into
  `objectIdentityForExpression`.
- The rewire changes no rule id or message, so no catalogue rollback is ever
  needed. Leave the worktree clean (no scratch files); if a shape probe is used
  to confirm SWC function shapes, delete it before committing.

## Interfaces and dependencies

Internal-only modules added (not re-exported from any index):

```ts
// src/static-analysis/workflow-ast-binding-patterns.ts  (WI1)
export type AstNode = { readonly type?: string; readonly [key: string]: unknown };
export type ExpressionRecursion = (node: AstNode | undefined) => void;
export const asNode: (value: unknown) => AstNode | undefined;
export const arrayValue: (value: unknown) => readonly unknown[];
export const identifierName: (node: AstNode | undefined) => string | undefined;
export const collectPatternBindings: (
  pattern: unknown, boundNames: Set<string>,
  recurse: ExpressionRecursion, excluded: ReadonlySet<string>,
) => void;
export const collectFunctionParamBindings: (
  node: AstNode, boundNames: Set<string>,
  recurse: ExpressionRecursion, excluded: ReadonlySet<string>,
) => void;

// src/static-analysis/workflow-ast-scopes.ts  (WI2)
import type { Module, Node } from "@swc/core";
import type { LexicalBindingFacts } from "./workflow-ast-bindings";
export const rootScopeView: (module: Module) => LexicalBindingFacts;
export const enterScope: (view: LexicalBindingFacts, node: Node) => LexicalBindingFacts;
```

Existing signatures reused unchanged: `collectLexicalBindings`,
`isIdentifierBound`, `LexicalBindingFacts` (`workflow-ast-bindings.ts`);
`resolveGlobalObjectIdentity`, `resolveStaticMemberName`
(`workflow-global-object-reference.ts`);
`collectDeterministicTimeAliases`, `objectIdentityForExpression`, `aliasCallMatch`
  (`workflow-deterministic-time-aliases.ts`); `parseNormalizedWorkflowBody`
  (`workflow-body-parse.ts`); `parseWorkflowBody`
  (`workflow-body-parser.ts`); `originalSpanFromNormalizedOffsets`,
`WORKFLOW_BODY_WRAP_FUNCTION_NAME` (`workflow-body-normalizer.ts`).
`scanDeterministicTimeWarnings`'s public signature is unchanged.

Pinned `@swc/core@1.15.x` AST shapes (verified against
`/data/leynos/Projects/odw-lint/node_modules/@swc/types/index.d.ts`):

- `Fn`-based `FunctionDeclaration { type: "FunctionDeclaration"; identifier:
  Identifier; params: Param[]; body?: BlockStatement }` (line 1249) and
  `FunctionExpression { type: "FunctionExpression"; identifier?: Identifier }`
  (line 1335).
- `ArrowFunctionExpression { type: "ArrowFunctionExpression"; params: Pattern[];
  body: BlockStatement | Expression }` (lines 1387-1395) — params are bare
  `Pattern`s, not `Param` wrappers.
- `Param { type: "Parameter"; pat: Pattern }` (lines 1210-1213); `Constructor {
  type: "Constructor"; params: (TsParameterProperty | Param)[]; body?:
  BlockStatement }` (lines 1214-1221); `ClassMethodBase { function: Fn }` with
  `ClassMethod` / `PrivateMethod` (lines 1222-1238) — the existing
  `collectFunctionLikeBindings` already handles the `Parameter`-wrapped vs bare
  pattern distinction.
- `VariableDeclarator { id: Pattern; init?: Expression }` (lines 1266-1271);
  `Identifier { type: "Identifier"; value: string }` (lines 1275-1279).
- Object-literal function forms (the round-2 boundary additions):
  `MethodProperty extends PropBase, Fn { type: "MethodProperty"; key:
  PropertyName; params: Param[]; body?: BlockStatement }` (line 1719 + `Fn`);
  `SetterProperty { type: "SetterProperty"; key: PropertyName; param: Pattern;
  body?: BlockStatement }` (lines 1714-1718 — note the *singular* `param`, a
  bare `Pattern`, like `CatchClause`); `GetterProperty { type: "GetterProperty";
  key: PropertyName; body?: BlockStatement }` (lines 1709-1713 — no params).
  Their `key` is a `PropertyName` (`Identifier | StringLiteral | …`), not a
  binding, so it is never recorded as an own name.

No new dependency. `@swc/core`, `fast-check`, and `bun:test` are already present.
No ODW runtime or static-helper symbol may appear in any new file.

## Progress

- [x] (2026-07-04T03:43Z) WI1: Extract
  `workflow-ast-binding-patterns.ts` and delegate from
  `workflow-ast-bindings.ts`; add to the module inventory; binding suite green
  unedited. Gate `make all`, `make markdownlint`, and `make nixie`.
  CodeRabbit initially rate-limited, then completed after the required sleep;
  its computed-key and collector-test findings were addressed before commit.
- [x] (2026-07-04T04:03Z) WI2: Add `workflow-ast-scopes.ts` with the complete nine-type
  `FUNCTION_LIKE_SCOPE_TYPES` boundary set (including `MethodProperty`,
  `GetterProperty`, `SetterProperty`); thread the scope view through the scanner
  walk; add unrelated-scope Red→Green, object-method/getter/setter Red→Green, and
  enclosed-scope negative cases; add to the module inventory. Gate `make all`.
  CodeRabbit initially rate-limited, then completed with zero findings; `make
  all` was rerun green afterwards.
- [x] (2026-07-04T05:37Z) WI3: Add unrelated-scope span, pipeline,
  `fast-check` invariance (using a generator that excludes the `Date` root),
  and the block-attribution conservative-limit cases. Gate `make all`.
  CodeRabbit rate-limited twice, then completed after the required sleep with
  zero findings; `make all` was rerun green afterwards.
- [x] (2026-07-04T05:40Z) WI4: Update three rule-doc Limitations sections and
  the developers' guide AST-facts note; tick roadmap 3.1.5. Gate
  `make markdownlint`, `make nixie`, `make all`.
- [x] (2026-07-04T06:03Z) Fix round 1: Address blocking review finding for
  named function and class expressions. Added Red→Green cases for
  `const clock = function Date() { ... }; Date.now()` and
  `const Clock = class Date {}; Date.now()`; narrowed the scope collector so
  expression names stop traversal without becoming enclosing-scope bindings.
  Focused Red before the production change: `bun test
  tests/static-analysis/workflow-deterministic-time-scopes.test.ts` failed with
  zero diagnostics for the new function-expression case. Green after the
  production change: the same focused suite passed. Scrutineer reran `make all`
  with exit 0, then `coderabbit review --agent` with exit 0 and zero findings.

## Surprises & discoveries

- Observation: the shadow oracle is *only* a `LexicalBindingFacts`
  (`resolveGlobalObjectIdentity(node, bindings)` →
  `isIdentifierBound(bindings, name)`), so scope precision needs no signature
  change — the walk simply passes a per-scope `LexicalBindingFacts` instead of a
  constant one. Evidence: `workflow-global-object-reference.ts` lines 47-86.
  Impact: WI2 is contained to the scanner walk plus one new module; the
  resolver, aliases module, and their unit tests are untouched.
- Observation: `collectLexicalBindings` intentionally flattens nested function
  locals into the whole-body set (test "reports nested function locals in the
  conservative name set"), which is exactly the source of the unrelated-scope
  false negative 3.1.5 removes. Evidence:
  `tests/static-analysis/workflow-ast-bindings.test.ts` lines 110-115. Impact:
  the scope collector must stop at nested-function boundaries, unlike the flat
  collector.
- Observation: `LexicalBindingFacts` shape is pinned by an `expectTypeOf`
  assertion and the symbol is re-exported publicly and listed in the public-API
  fixture. Evidence: `tests/static-analysis/workflow-ast-facts.test.ts` line 96;
  `tests/diagnostics/public-api-fixtures.ts` lines 20, 76. Impact: the plan keeps
  the flat facts and their shape intact and adds only internal scope modules.
- Observation (round 2, blocking point 1): object-literal methods and accessors
  are function-like scopes in the ECMAScript dialect. Evidence:
  `@swc/types/index.d.ts` — `MethodProperty extends PropBase, Fn` (line 1719,
  has `params` + `body`), `SetterProperty` (line 1714, `param: Pattern` +
  `body`), `GetterProperty` (line 1709, `body`). The flat
  `collectLexicalBindings` never records object-method params (its generic
  `collectChildBindings` recursion does not treat a bare identifier as a
  binding), but the scope collector actively
  collects param/local bindings while recursing, so omitting these three node
  types from the boundary set would over-attribute their params/locals to the
  enclosing scope. Impact: `FUNCTION_LIKE_SCOPE_TYPES` must include all nine
  types; the property key of an object method/accessor is *not* a binding, so no
  name is recorded for it (the collector reads names only from the `identifier`
  field, which these nodes lack).
- Observation (round 2, blocking point 2): the existing `VALID_IDENTIFIER`
  generator (`workflow-deterministic-time.test.ts` line 47) includes
  `fc.constant("Date")`. Evidence: lines 47-55, and the existing property at
  lines 366-368 already special-cases `name === "Date"`. Impact: the new WI3
  two-scope property must use a generator that excludes the global roots, or the
  `name === "Date"` case makes the top-level `const Date = Date.now();` a
  root-scope shadow and the property fails.
- Observation: CodeRabbit caught that the shared `KeyValuePatternProperty`
  collector must recurse into computed keys, otherwise declarations hidden in a
  computed destructuring key would no longer be visible to the flat collector.
  Evidence: CodeRabbit WI1 review after deterministic gates passed; the fix is
  covered by `workflow-ast-binding-patterns.test.ts`.
  Impact: WI1 now includes focused coverage for the exported collector surface,
  including computed keys, excluded names, and function parameter wrappers.
- Observation: `workflow-deterministic-time.test.ts` was already near the
  400-line file-size threshold after existing coverage, so the WI2
  scope-precision cases were split into
  `tests/static-analysis/workflow-deterministic-time-scopes.test.ts`.
  Evidence: `wc -l` showed the original file would exceed the limit when the
  new cases stayed inline.
  Impact: the focused scanner suite remains under the repository file-size gate
  while the new test file owns scope-specific behaviour.
- Observation: the WI3 generated-identifier property belongs in the dedicated
  scope test file, not the older scanner matrix.
  Evidence: `workflow-deterministic-time-scopes.test.ts` already owns the
  two-scope fixtures introduced in WI2 and remains well below the file-size
  limit after adding the property and block-attribution case.
  Impact: the property, the block-attribution conservative-limit assertion, and
  the example-level scope cases stay colocated.
- Observation (fix round 1): named `FunctionExpression` and `ClassExpression`
  nodes stop the enclosing-scope collector from descending into their bodies, but
  their own names are not bindings in the enclosing scope.
  Evidence: the new `workflow-deterministic-time-scopes.test.ts` cases failed
  Red with zero diagnostics before the collector change, because `Date` from the
  expression name was recorded in the root scope and suppressed the following
  top-level `Date.now()`.
  Impact: only `FunctionDeclaration` contributes an identifier at a nested
  function-like boundary, and only `ClassDeclaration` contributes a class
  identifier to `collectDirectOwnNames`; function and class expressions remain
  traversal boundaries without leaking names outward.

## Decision log

- Decision: layer a function-scope view over the existing whole-body
  `LexicalBindingFacts` rather than replacing the public facts model.
  Rationale: keeps the public API (`LexicalBindingFacts`, `collectLexicalBindings`,
  `isIdentifierBound`) and `collectWorkflowAstFacts` stable while making only the
  deterministic-time scanner scope-precise; the resolver already accepts a
  `LexicalBindingFacts`, so a per-scope view is a drop-in with no signature churn.
  Date/Author: 2026-07-04, planning agent.
- Decision: function-granularity scopes (blocks/`for`/`catch` are part of the
  enclosing function scope).
  Rationale: over-attributing block-scoped shadows to the enclosing function can
  only suppress a warning (false negative), never emit a spurious one (false
  positive); §9.2 prefers false negatives, and function granularity is enough to
  satisfy the success line ("unrelated scopes no longer hide warnings") because
  unrelated scopes are sibling/nested functions. Block precision is a documented
  further refinement.
  Date/Author: 2026-07-04, planning agent.
- Decision: keep alias collection and alias-use suppression whole-body
  (conservative), out of scope for 3.1.5.
  Rationale: the roadmap task names bare `Date`/`Math`/`globalThis` reference
  resolution; aliases are a separate, already-bounded mechanism
  (`workflow-deterministic-time-aliases.ts` "deliberately bounded"). Scoping
  aliases would widen the change materially; it is recorded as a possible future
  refinement and documented in the rule-doc limitations.
  Date/Author: 2026-07-04, planning agent.
- Decision: extract shared pattern collectors into a new module (WI1) parameterised
  by an injected recursion callback, rather than duplicating them in the scope
  module or growing `workflow-ast-bindings.ts` past 400 lines.
  Rationale: the flat and scope collectors share destructuring/param extraction
  but differ only in the "recurse into initialisers" policy (descend into
  functions vs stop at them); dependency-injecting that one policy keeps the
  collectors DRY and each file small (`AGENTS.md` abstraction policy and 400-line
  limit).
  Date/Author: 2026-07-04, planning agent.
- Decision: use `fast-check` for the WI3 scope invariance rather than a heavier
  verification adversary.
  Rationale: the invariant is exact membership over generated valid-identifier
  text with fixed scope structure; `fast-check` invariance gives direct
  regression coverage, and CrossHair/mutmut/Hypothesis are Python-only tools not
  applicable to this TypeScript suite.
  Date/Author: 2026-07-04, planning agent.
- Decision (round 2): treat object-literal methods and accessors
  (`MethodProperty`, `GetterProperty`, `SetterProperty`) as function-like scope
  boundaries — i.e. *fix* the omission rather than document it as a further
  conservative limit.
  Rationale: these nodes carry params/locals; leaving them out over-suppresses
  unrelated same-name uses (the exact failure the success line forbids), whereas
  including them makes the analysis correct with no extra risk (their property
  keys are not bindings, so nothing is over-recorded). A single shared
  `FUNCTION_LIKE_SCOPE_TYPES` constant keeps `enterScope`/`ownScopeNames` in
  lock step and makes the "function-like nodes are the only scope boundaries"
  invariant true by construction. Pinned by WI2's object-method/getter/setter
  Red→Green tests.
  Date/Author: 2026-07-04, planning agent (round 2).
- Decision (round 2): the WI3 two-scope `fast-check` property draws `name` from
  a generator that excludes the recognised `Date` root.
  Rationale: with `name === "Date"` the body `const ${name} = Date.now();`
  becomes a root-scope shadow that suppresses the top-level use, so the
  "exactly one, independent of `name`" invariant is false for that value. The
  generator excludes the root by construction (lower-case/`_`/`$` first
  character can never produce the capitalised root), avoiding the fast-check
  filtering trap. The invariant is restated as holding for any non-`Date`
  identifier.
  Date/Author: 2026-07-04, planning agent (round 2).
- Decision: keep `workflow-body-parse.ts` references in the ExecPlan while
  adding an explicit `workflow-body-parser.ts` orientation entry.
  Rationale: `parseNormalizedWorkflowBody` really lives in the shared internal
  parse helper, while `workflow-body-parser.ts` is the body-syntax adapter over
  it. Naming both modules removes ambiguity without rewriting the implementation
  seam.
  Date/Author: 2026-07-04T03:43Z, implementation agent.
- Decision: place WI2 scope-precision scanner tests in a dedicated companion
  test file.
  Rationale: this keeps the existing deterministic-time scanner test below the
  400-line limit while preserving focused Red→Green coverage for unrelated
  scopes, enclosing shadows, object methods/accessors, and `globalThis`.
  Date/Author: 2026-07-04T04:03Z, implementation agent.
- Decision: implement WI3's generated identifier property with
  `NON_DATE_IDENTIFIER`, not a broader root-excluding generator.
  Rationale: the generated body only varies a declaration adjacent to
  `Date.now()`, so `Date` is the sole root that can turn the top-level
  declaration into a same-scope shadow. `Math` and `globalThis` remain covered
  by focused examples where they are relevant.
  Date/Author: 2026-07-04T05:37Z, implementation agent.
- Decision (fix round 1): fix named function and class expression leakage rather
  than document it as a conservative limitation.
  Rationale: the plan's own "Own names of a scope" contract says expression
  names are not enclosing-scope bindings, and the roadmap success line requires
  same-name bindings in unrelated scopes not to hide supported warnings. The
  correct conservative behaviour is to stop at expression boundaries while
  recording no outward name.
  Date/Author: 2026-07-04T06:03Z, implementation agent.
- Decision (fix round 2): make named class expression names visible to their
  own child binding views rather than documenting the false positive as a known
  limitation.
  Rationale: a named class expression such as `class Date { m() { return
  Date.now(); } }` binds `Date` inside the class body, so emitting
  `odw/no-date-now` there is a false positive and violates this plan's
  conservative-analysis invariant. Treating `ClassExpression` as a child
  scope-opening node records the expression name for descendant members while
  preserving fix round 1's no-outward-leak behaviour.
  Date/Author: 2026-07-04T07:05Z, implementation agent.

## Revision note

- 2026-07-04T03:43Z: WI1 completed. The implementation extracted the shared
  binding-pattern collectors, added focused collector tests after CodeRabbit
  review, updated the documentation contents index for this ExecPlan, and
  recorded the computed-key recursion decision. Remaining work starts at WI2.
- 2026-07-04T04:03Z: WI2 completed. The implementation added the internal
  function-scope binding view, rewired deterministic-time scanning to thread it
  through the AST walk, added the scope-specific scanner tests, and recorded the
  file-size-driven test split. Remaining work starts at WI3.
- 2026-07-04T05:37Z: WI3 completed. The implementation added the
  unrelated-scope span assertion, merged-pipeline scope assertion, generated
  non-`Date` identifier property, and block-attribution conservative-limit case.
  Remaining work starts at WI4.
- 2026-07-04T05:40Z: WI4 completed. The implementation updated the three
  deterministic-time rule limitation sections, clarified the developers' guide
  AST-facts note, and ticked roadmap task 3.1.5. Remaining work is final
  validation at HEAD.
- 2026-07-04T06:03Z: Fix round 1 completed. The implementation corrected
  named function/class expression over-attribution in
  `workflow-ast-scopes.ts`, added focused scope-regression cases, reran
  `make all` through scrutineer, and received a clean CodeRabbit review.
- 2026-07-04T07:05Z: Fix round 2 completed. The implementation made named class
  expressions open an internal child binding view, added `Date`, `Math`, and
  `globalThis` member-scope regression coverage, reran `make all` through
  scrutineer, and received a clean CodeRabbit review.

## Outcomes & retrospective

Completed implementation: the deterministic-time scanner suppresses
`Date`/`Math`/`globalThis` references only when shadowed at the use site;
unrelated-scope same-name bindings no longer hide warnings; local and enclosing
shadows stay suppressed; trusted ODW fixtures stay warning-free; the rule
catalogue, diagnostic schema, and public API are unchanged.

Fix round 1 closed the remaining expression-name gap: named function and class
expressions no longer leak their names into the enclosing scope, so a following
top-level `Date.now()` still reports `odw/no-date-now`.

Fix round 2 closed the inward class-expression gap: named class expression
members now inherit the class expression's own binding view, so member-local
`Date.now()`, `Math.random()`, and `globalThis.Date.now()` references stay
suppressed when those recognised global names resolve to the class expression
name rather than the JavaScript global.

## Addenda

- [ ] 3.1.5.1. Add block/for/catch-precise deterministic-time shadowing.
  - Source: review:3.1.5; severity low.
  - Scope: narrow block, `for`, and `catch` shadow attribution for
    deterministic-time rules so sibling-block global uses no longer disappear
    behind conservative function-scope suppression.
  - Success: block-, `for`-, and `catch`-local shadows suppress only uses they
    lexically enclose, while existing local-shadow and unrelated-scope fixtures
    keep their current deterministic-time diagnostics.
- [ ] 3.1.5.2. Add direct scope-view unit coverage.
  - Source: audit:3.1.5; severity low.
  - Scope: add focused `workflow-ast-scopes` coverage for nested parameters,
    setter params, named class-expression member scope, and documented
    block-to-function attribution.
  - Success: the scope-view unit suite pins the internal `rootScopeView` and
    `enterScope` behaviour needed before later collector-unification work.
