# Apply lexical-binding facts to deterministic-time compatibility detection

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: IN PROGRESS

## Purpose / big picture

`odw-lint` statically checks Open Dynamic Workflows (ODW) source without
executing it. Roadmap task 3.1.4 (`docs/roadmap.md` lines 749-761) sharpens the
existing deterministic-time Claude-compatibility warnings so they use the
reusable *lexical binding facts* delivered by task 2.2.4. Today the scanner in
`src/static-analysis/workflow-deterministic-time.ts` matches `Date.now()`,
`Math.random()`, and arg-less `new Date()` purely syntactically: it warns even
when a workflow locally declares its own `Date` or `Math`, and it misses
computed access (`Date["now"]()`) and `globalThis` chains
(`globalThis.Date.now()`). The three rule docs record these exact gaps as
"Limitations … Revisit … after roadmap 2.2.4 adds lexical binding facts"
(`docs/rules/no-date-now.md` lines 51-55; `no-math-random.md` lines 44-48;
`no-argless-new-date.md` lines 44-49).

Verbatim roadmap success line (`docs/roadmap.md` lines 757-761): "Claude
compatibility warnings ignore locally shadowed `Date` or `Math` bindings while
detecting supported global `Date.now`, `Math.random`, arg-less `new Date`,
computed `Date["now"]()`, and `globalThis.Date.now()` forms with
original-source spans."

After this change, a workflow body that shadows a global — for example
`const Date = createClock();\nconst t = Date.now();` — produces **no**
`odw/no-date-now` warning, because `Date` is a lexical binding rather than the
JavaScript global. A body that reaches the real global through a supported form
— `Date["now"]()`, `globalThis.Date.now()`, `new globalThis.Date()`,
`Math["random"]()`, `globalThis.Math.random()` — **does** warn, with an
original-source span pointing at the offending expression. The nine trusted ODW
example fixtures continue to produce zero claude-compatibility diagnostics.

Observable proof (see `Validation and acceptance`):

1. `scanDeterministicTimeWarnings` on `const Date = 1;\nconst t = Date.now();`
   returns `[]`; on `const t = Date["now"]();` it returns one `odw/no-date-now`
   whose sliced span is `Date["now"]`; on `const t = globalThis.Date.now();` it
   returns one `odw/no-date-now` whose sliced span is `globalThis.Date.now`;
   and on `const Date = 1;\nconst t = globalThis.Date.now();` it **still**
   returns one warning (the `globalThis` chain bypasses the local shadow).
2. `lintWorkflowSource` over a full workflow that shadows `Date` reports zero
   `claudeCompatibility` diagnostics.
3. `make all` passes at every commit; `make markdownlint` and `make nixie`
   pass for the documentation commit.

### Scope boundary with adjacent tasks (read this first)

- **3.1.4 owns** the shadow-aware and member-form-aware detection *inside the
  existing three deterministic-time rules only* (`odw/no-date-now`,
  `odw/no-math-random`, `odw/no-argless-new-date`). It threads the 2.2.4
  lexical binding facts into the scanner and adds a global-object reference
  resolver. It changes no rule id, category, default severity, release status,
  or reviewed message, so the diagnostic JSON Schema enum snapshot
  (`tests/diagnostics/schema.test.ts`) stays byte-identical.
- **3.1.4 does not implement `--strict-claude`.** Severity promotion is task
  3.1.3 (`docs/roadmap.md` lines 745-748). This task keeps the default
  `warning` severity untouched.
- **3.1.4 does not build the orchestration rules.** `odw/bounded-loop` (3.2.1)
  and `odw/bounded-fanout` (3.2.2) will consume the *same* lexical binding
  facts to decide whether `Array`, `Object`, `Number`, and `Math` helpers are
  the real globals (`docs/roadmap.md` lines 786-808). This task only documents
  that shared consumption pattern; it adds no orchestration rule.
- **3.1.4 does not change the `WorkflowAstFacts` producer.** It *consumes*
  `collectLexicalBindings` (2.2.4). It adds no new public export and no new
  `@swc/core` type to the public surface.
- **Shadowing is a conservative name-set test, not scope-precise analysis.**
  This mirrors 2.2.4's own decision (`docs/execplans/roadmap-2-2-4.md` Decision
  Log): any same-named binding anywhere in the body suppresses the bare-global
  form. That prefers a false negative (one missed warning) over a false
  positive on legitimate local code. Scope-precise binding analysis remains a
  deferred refinement.

Design references: `docs/technical-design.md` §§4, 5, 6.1, 6.2 (the
`WorkflowAstFacts` layer that carries "randomness/time hazards" and shadow
facts), 6.4, 8, 9.2 (the three Claude-compatibility rules), 11.5 (span-mapping
invariant), 12.1 (trust boundary); `docs/adr/0001-static-analysis-boundary.md`;
`docs/developers-guide.md` "Workflow AST facts" (lines 79-100), "Source-span
helpers" (lines 65-77), and the Claude-compatibility merge-order note (lines
119-153); `docs/complexity-antipatterns-and-refactoring-strategies.md`
(single-responsibility helpers, extract predicates, files under 400 lines);
`docs/scripting-standards.md`; `docs/documentation-style-guide.md`;
`docs/roadmap.md` task 3.1.4 (requires 2.2.4 and 3.1.2, both `[x]`); `AGENTS.md`
(quality gates, TypeScript guidance, testing rules, file-size limit, en-GB
Oxford spelling, DRY / separate atomic refactors).

## Constraints

- **Never execute or evaluate workflow source.** Detection is parse-and-walk
  only; the sole permitted parser call remains `@swc/core`'s `parseSync` over
  normalized text via `parseNormalizedWorkflowBody`
  (`docs/technical-design.md` §12.1; `docs/adr/0001`;
  `tests/static-analysis/hostile-metadata-security.test.ts` and
  `tests/diagnostics/import-policy.test.ts` must stay green).
- **Do not import ODW runtime or ODW static helpers** (`scanDualCompat`,
  `checkMeta`, `loadWorkflowScript`, `createPrimitives`, `validate`) in
  production code (`docs/adr/0001`; the forbidden-import architecture test).
- **No public `@swc/core` type leak.** The new resolver consumes SWC types
  internally; nothing new is re-exported from `src/index.ts` or
  `src/static-analysis/index.ts`. The resolver module is an internal
  collaborator, like `workflow-body-parse.ts` and `workflow-ast-bindings.ts`.
- **No `Diagnostic` shape change and no catalogue change.** `RULE_IDS`, rule
  categories, default severities, release statuses, and reviewed messages are
  unchanged; `tests/diagnostics/schema.test.ts` and
  `tests/diagnostics/rule-catalogue.test.ts` stay green with no edits.
- **Span discipline.** Diagnostic spans remain UTF-8 byte offsets mapped
  through `originalSpanFromNormalizedOffsets`; the module-base subtraction
  (`node.span.start - module.span.start`) is preserved exactly as today
  (`docs/technical-design.md` §11.5).
- **File size < 400 physical lines** for every touched code file
  (`tests/build-gate/file-size.test.ts`; `AGENTS.md`). Split the global-object
  resolver into its own module rather than growing the scanner past the limit.
- **Do not modify raw fixtures** under
  `tests/static-analysis/fixtures/odw-examples/` or
  `.../fixtures/invalid-workflows/` (`docs/developers-guide.md` "Workflow
  Fixture Corpus").
- **en-GB Oxford spelling** ("-ize"/"-yse"/"-our") in all prose, comments, and
  commit messages (`AGENTS.md`; `docs/documentation-style-guide.md`).

## Tolerances (exception triggers)

- **Scope:** if implementation net-touches more than 10 files or ~450 net lines
  of code, stop and escalate.
- **Interface:** if the `@swc/core@1.15.43` AST shape for computed members or
  `globalThis` chains differs from the shapes pinned in "Interfaces and
  dependencies" (for example `ComputedPropName.type` is not `"Computed"`, or
  its key is not `expression`) such that a public type or a new dependency is
  needed, stop and escalate.
- **Facts seam:** if `collectLexicalBindings(module)` cannot be reused as the
  shadow oracle without also pulling in suppression-mask construction or a
  public export change, stop and record the seam problem before improvising.
- **Dependencies:** no new runtime dependency is expected. If one appears
  necessary, stop and escalate.
- **Iterations:** if a milestone's focused tests still fail after 4 attempts
  for a reason other than an intended snapshot update, stop and escalate.
- **Ambiguity:** if a supported form in the success line cannot be detected
  without evaluating source or importing ODW, stop and present options.

## Risks

- Risk: the SWC computed-member shape assumed here
  (`property` is `ComputedPropName { type: "Computed", expression:
  StringLiteral { value } }`) does not match the pinned parser, so
  `Date["now"]()` is silently missed or mis-typed.
  Severity: high. Likelihood: low.
  Mitigation: the shape is pinned from
  `node_modules/@swc/types/index.d.ts` (verified: `MemberExpression.property:
  Identifier | PrivateName | ComputedPropName`, line 1352; `ComputedPropName`
  `type: "Computed"`, `expression: Expression`, lines 1723-1726; `StringLiteral
  { value: string }`, lines 1516-1519). WI1 begins with a one-shot in-repo
  shape probe that parses `Date["now"](); globalThis.Date.now();` and inspects
  the tree, then deletes the probe. Every supported form is pinned by a
  positive test that fails loudly if the shape is wrong.
- Risk: a `globalThis` chain that should warn is suppressed because the code
  consults the `Date`/`Math` binding on the wrong branch, or a bare shadowed
  `Date` still warns because the binding check is skipped.
  Severity: high (this is the task's core behaviour). Likelihood: medium.
  Mitigation: the resolver only consults the `Date`/`Math` binding on the *bare
  identifier* branch; the `globalThis.X` branch consults only the `globalThis`
  binding. WI1 adds the exact cross-shadow test
  (`const Date = 1; globalThis.Date.now()` still warns;
  `const globalThis = 1; globalThis.Date.now()` does not).
- Risk: the existing negative case `const value = Date["now"]();`
  (`tests/static-analysis/workflow-deterministic-time.test.ts` line 72) and the
  syntactic-limitation prose in the three rule docs contradict the new
  behaviour, so leaving them unchanged fails the suite or ships stale docs.
  Severity: medium. Likelihood: high (expected).
  Mitigation: WI1 moves that line from `NEGATIVE_BODIES` to the positive matrix
  (this is the headline Red→Green flip); WI3 rewrites the three "Limitations"
  sections.
- Risk: reintroducing shadow suppression accidentally changes the source order
  or count pinned by the 3.1.2.1 intra-expression ordering snapshots
  (`tests/static-analysis/deterministic-time-spans.test.ts`).
  Severity: medium. Likelihood: low.
  Mitigation: the walk order is unchanged (node visited before children); the
  resolver only *filters* matches, never reorders them. The existing ordering
  snapshots must pass unchanged; WI2 adds new-form spans without editing the
  ordering fixtures.
- Risk: the sibling ODW checkout is outside this session's sandbox, so
  `scanDualCompat`'s exact `globalThis`/shadow behaviour cannot be read for a
  parity claim. Severity: low. Likelihood: high (already observed — see Tooling
  note). Mitigation: `docs/adr/0001` forbids importing `scanDualCompat`; the
  3.1.4 success line is defined against lexical binding facts, not against a
  live ODW import, so behaviour is pinned by the success line and tests.

## Tooling availability note (planning session)

Per the standing rules, advisory tooling that was unavailable during planning,
with the bounded local fallback used instead:

- The sibling ODW checkout `/data/leynos/Projects/open-dynamic-workflows` is
  outside the session's allowed directories: `grep`/`ls` were blocked
  ("may only search … allowed working directories"). `scanDualCompat` could not
  be read. Fallback: `docs/adr/0001` bars importing it; the plan pins behaviour
  to the roadmap success line and trusted-fixture parity instead.
- `bun install` / `bun test` were not run in-session (the worktree has no
  `node_modules` yet); the `@swc/core` AST shapes were pinned by reading the
  pinned `@swc/types` `.d.ts` in the sibling installed tree
  (`/data/leynos/Projects/odw-lint/node_modules/@swc/types/index.d.ts`) and are
  re-pinned by the WI1 shape probe and positive tests the implementer runs.
- GrepAI and Leta were not exercised for branch-local facts during planning;
  every branch-local claim here was verified by direct file inspection in the
  worktree. The implementer should use `leta` for navigation as normal.

## Context and orientation

A novice needs these files:

- `src/static-analysis/workflow-deterministic-time.ts` —
  `scanDeterministicTimeWarnings(envelope, parseResult?)` parses the normalized
  body, walks the SWC AST in source order (`visitNode` before children), and
  emits one `Diagnostic` per syntactic match via `diagnosticForMatch`. Today
  `isNamedMemberCall` matches only *non-computed* `Object.property` calls with
  bare-identifier objects, and `isArglessNewDate` matches only a bare-identifier
  `Date` callee. This is the module 3.1.4 rewires.
- `src/static-analysis/workflow-ast-bindings.ts` — `collectLexicalBindings(
  module): LexicalBindingFacts` returns a frozen, sorted, unique `boundNames`
  list (the wrapper name is excluded); `isIdentifierBound(facts, name)` is the
  membership predicate. This is the 2.2.4 fact this task consumes as the
  shadow oracle.
- `src/static-analysis/workflow-body-parse.ts` — `parseNormalizedWorkflowBody(
  envelope): NormalizedBodyParseResult`; on `ok: true` it carries `module`
  (the SWC `Module`) and `normalized` (the `NormalizedWorkflowBody`). The
  scanner already reuses this result via its optional `parseResult` parameter
  and `lintScannedWorkflowBody` passes the shared parse in.
- `src/static-analysis/workflow-body-normalizer.ts` —
  `originalSpanFromNormalizedOffsets(sourceFile, normalized, startByte,
  endByte)` maps a normalized-text byte range back to an original `SourceSpan`.
- `src/static-analysis/workflow-lint.ts` — `lintScannedWorkflowBody` (lines
  79-95) calls `scanDeterministicTimeWarnings(envelope, bodyParse)` for the
  `claudeCompatibility` stage; this wiring is unchanged by 3.1.4.
- `tests/static-analysis/workflow-deterministic-time.test.ts` — the positive
  matrix (`POSITIVE_CASES`), `NEGATIVE_BODIES` (line 67), the `scanBody` helper,
  and the source-order test. The headline flip lives here.
- `tests/static-analysis/deterministic-time-spans.test.ts` — span-oracle
  snapshots including the 3.1.2.1 intra-expression ordering cases and the
  zero-false-positive proof over `ODW_EXAMPLE_FIXTURE_SNAPSHOTS`.
- `tests/static-analysis/workflow-lint.test.ts` — the full-pipeline merge-order
  property and freeze assertions.
- `tests/diagnostics/architecture-fixtures.ts` —
  `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` (lines 38-73) pins the exact
  static-analysis module inventory; adding the resolver module requires adding
  its filename here (a discovery already recorded in 2.2.4).
- `node_modules/@swc/types/index.d.ts` (in the installed tree) — the pinned
  parser type declarations used to pin the AST shapes below.

Terms:

- **Lexical binding.** A name the body *declares* (`const`/`let`/`var`, a
  function or class declaration name, a parameter, a destructured element, a
  `catch (e)` parameter). A *reference* is not a binding.
- **Shadowing.** Declaring a binding whose name equals a global (e.g. a
  workflow-local `const Date = …`) so a use of that name resolves to the local.
- **Computed member access.** `Date["now"]` — a `MemberExpression` whose
  `property` is a `ComputedPropName` wrapping a `StringLiteral`, as opposed to
  non-computed `Date.now` (property is an `Identifier`).
- **`globalThis` chain.** Reaching a global through the universal global object,
  e.g. `globalThis.Date.now()` or `globalThis["Date"]["now"]()`. The chain
  bypasses any local `Date` binding, but is itself suppressed if `globalThis`
  is shadowed.
- **Global-object identity.** The resolver's answer to "what global object does
  this expression denote?" — `"Date"`, `"Math"`, `"globalThis"`, or none.

## Detection contract (the behaviour this task pins)

The scanner still walks the parsed body in source order and emits one
diagnostic per match, but every match is now gated by a *global-object
identity resolver* that consults the body's lexical binding facts.

Define, over a resolved binding set `bindings = collectLexicalBindings(module)`:

- `resolveStaticMemberName(property)`: `"now"` for `Identifier { value: "now" }`
  and for `ComputedPropName { expression: StringLiteral { value: "now" } }`;
  `undefined` for `PrivateName`, a computed non-string-literal key
  (`Date[key]`, `Date[0]`), or anything else. (No source evaluation: only a
  literal string key resolves.)
- `resolveGlobalObjectIdentity(node, bindings)`:
  - a bare `Identifier { value: N }` resolves to `N` **iff**
    `!isIdentifierBound(bindings, N)` (an unshadowed global); a shadowed name
    resolves to `undefined`;
  - a `MemberExpression` resolves to `resolveStaticMemberName(property)` **iff**
    `resolveGlobalObjectIdentity(object, bindings) === "globalThis"` (drill only
    through the universal global root); this recursive step is what turns
    `globalThis.Date.now()` and `globalThis["Date"]["now"]()` into a `Date`
    object followed by a `now` member; otherwise `undefined`;
  - anything else resolves to `undefined`.

Then the three hazards are:

- `odw/no-date-now`: a `CallExpression` whose `callee` is a `MemberExpression`
  with `resolveStaticMemberName(property) === "now"` and
  `resolveGlobalObjectIdentity(object) === "Date"`. Span = the callee
  member-expression span (`Date.now`, `Date["now"]`, or `globalThis.Date.now`).
- `odw/no-math-random`: the same with member name `"random"` and object
  identity `"Math"`. Span = the callee member span.
- `odw/no-argless-new-date`: a `NewExpression` with no arguments whose `callee`
  has `resolveGlobalObjectIdentity(callee) === "Date"`. Span = the whole
  `NewExpression` span (`new Date`, `new Date()`, `new globalThis.Date()`).

Consequences, pinned by tests:

- Locally shadowed `Date`/`Math` (bare form) → **no** warning.
- `globalThis.Date.now()` warns even when `Date` is locally bound, because the
  chain's object identity comes from `globalThis`, not the bare `Date`.
- `globalThis` shadowed → the whole chain is suppressed.
- Recognized global roots are `Date`, `Math`, and `globalThis` only.
  `window`/`self`/`global` are **not** treated as global roots (conservative,
  documented). Optional chaining (`Date?.now()`), aliasing
  (`const d = Date; d.now()`), and dynamic computed keys (`Date[k]()`) remain
  undetected (documented limitations).
- Decoys inside strings, comments, regex literals, and template text never
  parse as call/new expressions, so no masking pass is needed (unchanged).

## Plan of work

Stages map to work items; each is a single atomic commit that passes `make all`
(plus `make markdownlint` and `make nixie` for the documentation commit) and
follows Red → Green → Refactor. No language-router skill applies (the repository
is TypeScript-only); follow `AGENTS.md` TypeScript Guidance and the
`code-review` habits. Load `execplans` (this plan), `leta` (symbol navigation
and branch-local verification before each code touch), `grepai` (intent search
against the `main` index — treat as a pointer, verify with `leta`/file
inspection), `biomejs` (formatting/lint), and `en-gb-oxendict` (prose/comments).

### WI1 — Resolve global-object identity with lexical bindings and rewire the scanner (feature)

Read first: `docs/technical-design.md` §§6.1, 6.2, 9.2, 11.5; `docs/adr/0001`;
`docs/developers-guide.md` "Workflow AST facts" and "Source-span helpers";
`docs/complexity-antipatterns-and-refactoring-strategies.md`;
`src/static-analysis/workflow-deterministic-time.ts`,
`workflow-ast-bindings.ts`, and `workflow-body-parse.ts`.
Skills: `leta`, `biomejs`, `en-gb-oxendict`.

Step 1 (shape probe — before writing the resolver). Add a temporary scratch
test that parses, through `parseNormalizedWorkflowBody`, a body such as:

```js
const a = Date["now"]();
const b = globalThis.Date.now();
const c = globalThis["Math"]["random"]();
const d = new globalThis.Date();
```

and prints `JSON.stringify(result.module, null, 2)`. Confirm: computed members
appear as `property: { type: "Computed", expression: { type: "StringLiteral",
value: "now" } }`; `globalThis.Date.now` nests `MemberExpression` objects with
`Identifier { value: "globalThis" }` at the root; `NewExpression.callee` is the
`MemberExpression` for `new globalThis.Date()`. Record the observed shapes in
`Surprises & Discoveries`, then **delete the scratch test** before committing.

Create `src/static-analysis/workflow-global-object-reference.ts` (internal, not
re-exported) exporting:

```ts
import type { Expression, MemberExpression, Node } from "@swc/core";
import type { LexicalBindingFacts } from "./workflow-ast-bindings";

export type GlobalObjectIdentity = "Date" | "Math" | "globalThis";

/** Resolves a static member key (`Identifier` or string-literal `Computed`). */
export const resolveStaticMemberName: (
  property: MemberExpression["property"],
) => string | undefined;

/**
 * Resolves which global object an expression denotes, honouring lexical
 * shadowing. Returns `"Date"`, `"Math"`, `"globalThis"`, or `undefined`.
 */
export const resolveGlobalObjectIdentity: (
  node: Expression | Node,
  bindings: LexicalBindingFacts,
) => GlobalObjectIdentity | undefined;
```

Implement the contract above using `isIdentifierBound` from
`workflow-ast-bindings.ts`. Keep the SWC narrowing predicates local and small
(reuse `src/static-analysis/value-guards.ts` if an equivalent narrowing already
exists — sweep with `leta` first per `AGENTS.md` DRY). No `@swc/core` type
escapes this module.

Rewire `src/static-analysis/workflow-deterministic-time.ts`:

- After `parseResult.ok`, compute `const bindings =
  collectLexicalBindings(parseResult.module)` once and thread it (with the
  module base) through `walkDeterministicTimeHazards` → `visitNode` →
  `matchDeterministicTimeHazard`.
- Replace `isNamedMemberCall`/`isDateNowCall`/`isMathRandomCall` with a matcher
  that, for a `CallExpression` whose callee is a `MemberExpression`, checks
  `resolveStaticMemberName(callee.property)` against `"now"`/`"random"` and
  `resolveGlobalObjectIdentity(callee.object, bindings)` against
  `"Date"`/`"Math"`.
- Replace `isArglessNewDate` with a check that the `NewExpression` has no
  arguments and `resolveGlobalObjectIdentity(callee, bindings) === "Date"`.
- Spans are unchanged in principle: callee member span for calls, whole
  `NewExpression` span for arg-less new.

Update `tests/diagnostics/architecture-fixtures.ts`:
`EXPECTED_STATIC_ANALYSIS_MODULE_FILES` gains
`"workflow-global-object-reference.ts"` in sorted position (after
`workflow-envelope.ts`? — insert to keep the array's existing alphabetical
order; the array is the pinned inventory the `architecture.test.ts` compares).

Tests (Red first) — extend
`tests/static-analysis/workflow-deterministic-time.test.ts`:

- **Headline flip:** move `'const value = Date["now"]();'` out of
  `NEGATIVE_BODIES` and into the positive matrix with `rule =
  DATE_NOW_RULE`, `spanText = 'Date["now"]'`. Confirm the suite is Red (the old
  scanner produces `[]`), then Green after the rewire.
- **New positive forms** (each asserted with the span oracle —
  `decodeSpanText`/`expectSpanToMatchSource`/`sliceSourceSpan`): `Math["random"]()`
  (`Math["random"]`), `globalThis.Date.now()` (`globalThis.Date.now`),
  `globalThis.Math.random()` (`globalThis.Math.random`),
  `globalThis["Date"]["now"]()` (`globalThis["Date"]["now"]`),
  `new globalThis.Date()` (`new globalThis.Date()`).
- **Shadow negatives** (table-driven over the binding forms 2.2.4 supports —
  `const`/`let`/`var`, function declaration, parameter, object-destructure,
  array-destructure, `catch`): each body binds `Date` (or `Math`) and then uses
  the bare form (`Date.now()`, `new Date()`, `Math.random()`); assert the
  scanner returns `[]`.
- **globalThis shadow negative:** `const globalThis = fakeGlobal;\nconst t =
  globalThis.Date.now();` returns `[]`.
- **Cross-shadow positive:** `const Date = 1;\nconst t = globalThis.Date.now();`
  still returns exactly one `odw/no-date-now` (the chain bypasses the local
  `Date`).
- **Out-of-scope negatives:** `window.Date.now()`, `self.Date.now()`,
  `Date?.now()`, and a dynamic computed key `const k = "now";\nDate[k]();`
  return `[]` (documented conservative limits).

Follow Red-Green-Refactor: write the failing positive/negative cases first,
confirm the Red for the intended reason, then implement the resolver and rewire.

Validation: `make all`.

### WI2 — Span, pipeline, and property coverage for the new forms (tests)

Read first: `docs/technical-design.md` §11.5; `AGENTS.md` Testing (span
snapshots, `fast-check` for range/invariance behaviour, deterministic tests);
`tests/static-analysis/deterministic-time-spans.test.ts` and
`tests/static-analysis/workflow-lint.test.ts`.
Skills: `leta`, `biomejs`, `en-gb-oxendict`. (No verification adversary skill is
needed: the invariants here are exact-match spans and membership, best pinned by
`fast-check` invariance rather than CrossHair/mutmut. Record that choice in the
Decision Log.)

- Extend `deterministic-time-spans.test.ts` `RULE_SPAN_CASES` with the new
  forms — `Date["now"]` → `Date["now"]`, `globalThis.Date.now()` →
  `globalThis.Date.now`, `new globalThis.Date()` → `new globalThis.Date()` —
  proving the original-source span for each; leave the 3.1.2.1 intra-expression
  ordering cases and the `ODW_EXAMPLE_FIXTURE_SNAPSHOTS` zero-false-positive
  assertion unchanged (they must still pass).
- Add a full-pipeline case to `workflow-lint.test.ts`: a complete workflow that
  shadows `Date` (`const Date = createClock();\nconst t = Date.now();`) returns
  zero `claudeCompatibility` diagnostics from `lintWorkflowSource`, and a
  workflow using `globalThis.Date.now()` returns exactly one. This proves the
  facts reach the merged pipeline, not just the standalone scanner.
- Add one `fast-check` property to `workflow-deterministic-time.test.ts`: for a
  generated valid identifier `name` bound by `const <name> = 1;`, a following
  bare `<name>.now()` (when `name === "Date"`) is suppressed, and — the more
  general invariant — for any body that binds `Date`, a bare `Date.now()`
  produces no diagnostic while `globalThis.Date.now()` in the same body always
  produces exactly one. Use a bounded generator constrained to valid identifier
  characters (avoid the `fast-check` filtering trap per `AGENTS.md` and
  2.2.4's recorded whitespace counter-example).

Validation: `make all`.

### WI3 — Documentation and roadmap tick (docs)

Read first: `docs/documentation-style-guide.md`; `AGENTS.md` Markdown Guidance
(80-column prose, 120-column code, en-GB); `docs/developers-guide.md` "Workflow
AST facts"; the three rule docs.
Skills: `en-gb-oxendict`, `execplans`.

- Rewrite the "## Limitations" section of `docs/rules/no-date-now.md`,
  `docs/rules/no-math-random.md`, and `docs/rules/no-argless-new-date.md`:
  replace the "Detection is syntactic … Revisit … after roadmap 2.2.4"
  paragraphs with the shipped behaviour — a locally shadowed `Date`/`Math`
  binding is ignored; computed string-key access (`Date["now"]()`) and
  `globalThis` chains (`globalThis.Date.now()`) are detected; the remaining
  conservative limits are aliasing (`const d = Date; d.now()`), optional
  chaining (`Date?.now()`), dynamic computed keys (`Date[k]()`), and non-
  `globalThis` roots (`window`/`self`/`global`). Keep the `## Failing example`
  and `## Fixed example` blocks intact (the docs contract test requires them).
- Extend `docs/developers-guide.md` "Workflow AST facts" (near lines 87-92) to
  note that the deterministic-time scanner is the *first consumer* of
  `LexicalBindingFacts` (it suppresses shadowed `Date`/`Math`) and that the
  orchestration rules `odw/bounded-loop` (3.2.1) and `odw/bounded-fanout`
  (3.2.2) will consume the same facts to classify `Array`, `Object`, `Number`,
  and `Math` helpers — documenting the shared hardening path the roadmap task
  calls for.
- Tick roadmap task 3.1.4: change `- [ ] 3.1.4.` to `- [x] 3.1.4.` at
  `docs/roadmap.md` line 749.

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
`/data/leynos/Projects/odw-lint.worktrees/roadmap-3-1-4`.

1. WI1: add the scratch shape probe, run it once, record shapes, delete it.
   Create `workflow-global-object-reference.ts`; rewire
   `workflow-deterministic-time.ts`; update
   `tests/diagnostics/architecture-fixtures.ts`; flip the `Date["now"]()` case
   and add the new positive/negative cases. Prove Red then Green:

   ```bash
   bun test tests/static-analysis/workflow-deterministic-time.test.ts
   # after the rewire:
   bun test tests/static-analysis/workflow-deterministic-time.test.ts
   bunx @biomejs/biome format --write \
     src/static-analysis/workflow-global-object-reference.ts \
     src/static-analysis/workflow-deterministic-time.ts \
     tests/static-analysis/workflow-deterministic-time.test.ts \
     tests/diagnostics/architecture-fixtures.ts
   make all
   ```

2. WI2: extend the span, pipeline, and property suites:

   ```bash
   bun test tests/static-analysis/deterministic-time-spans.test.ts
   bunx @biomejs/biome format --write \
     tests/static-analysis/deterministic-time-spans.test.ts \
     tests/static-analysis/workflow-lint.test.ts \
     tests/static-analysis/workflow-deterministic-time.test.ts
   make all
   ```

3. WI3: edit the five Markdown files, format them, then run the Markdown gates
   and `make all`.

Commit after each work item with an imperative, en-GB, ≤50-character subject and
a wrapped body explaining what and why (`AGENTS.md` Committing). Gate every
commit with `make all` (plus `make markdownlint` and `make nixie` for WI3).

## Validation and acceptance

Acceptance is behavioural at the scanner and pipeline level and gate-based.

- Running `make all` passes at every commit (build, format check, whitespace
  hygiene, lint, typecheck, tests — `docs/developers-guide.md` lines 148-156).
- Shadow suppression (WI1): every shadow-negative case (each binding form for
  `Date` and `Math`, plus the `globalThis` shadow) returns `[]`; the
  cross-shadow case (`const Date = 1; globalThis.Date.now()`) returns exactly
  one `odw/no-date-now`.
- New supported forms (WI1, WI2): `Date["now"]()`, `Math["random"]()`,
  `globalThis.Date.now()`, `globalThis.Math.random()`,
  `globalThis["Date"]["now"]()`, and `new globalThis.Date()` each produce
  exactly one diagnostic whose sliced original-source span equals the offending
  expression text.
- Out-of-scope forms (WI1): `window.Date.now()`, `Date?.now()`, and dynamic
  computed keys return `[]`.
- Regression (WI2): the 3.1.2.1 intra-expression ordering snapshots and the
  nine-fixture zero-false-positive assertion pass unchanged; the merge-order
  property in `workflow-lint.test.ts` still holds; `RULE_IDS` and the schema
  snapshot are byte-identical.
- Red-Green-Refactor evidence: the `Date["now"]()` flip and the shadow
  negatives are Red before the rewire (old scanner warns on shadowed `Date` and
  ignores `Date["now"]`), then Green after.
- Markdown (WI3): `make markdownlint` and `make nixie` pass; the three rule-doc
  Limitations sections describe the shipped behaviour; roadmap 3.1.4 is ticked.

Quality criteria ("done"):

- Tests: the extended deterministic-time, span, and pipeline suites pass under
  `make test`; existing suites pass unchanged.
- Lint/format/typecheck: clean under `make all`; no `@swc/core` type appears in
  a public export; every touched file stays under 400 lines.
- Docs: three rule pages and the developers' guide updated; roadmap 3.1.4
  `[x]`.

Quality method: `make all` at each commit; manual review of any span-snapshot
diff before committing (`AGENTS.md` snapshot policy).

## Idempotence and recovery

- Every new test builds its source in memory and is deterministic; re-running
  any step is safe.
- The WI1 scratch shape probe must be deleted before committing; leave the
  worktree clean (no scratch files).
- If a supported form unexpectedly fails to warn, fix the resolver's branch
  handling (member vs bare identity, or static member-name resolution) rather
  than weakening an assertion; if a shadowed form still warns, confirm
  `collectLexicalBindings` is consulted on the bare-identifier branch.
- The rewire is reversible by restoring the syntactic matchers; it changes no
  rule id or message, so no catalogue rollback is needed.

## Interfaces and dependencies

Internal-only module added (not re-exported from any index):

```ts
// src/static-analysis/workflow-global-object-reference.ts
import type { Expression, MemberExpression, Node } from "@swc/core";
import type { LexicalBindingFacts } from "./workflow-ast-bindings";

export type GlobalObjectIdentity = "Date" | "Math" | "globalThis";

export const resolveStaticMemberName: (
  property: MemberExpression["property"],
) => string | undefined;

export const resolveGlobalObjectIdentity: (
  node: Expression | Node,
  bindings: LexicalBindingFacts,
) => GlobalObjectIdentity | undefined;
```

Existing signatures reused unchanged: `collectLexicalBindings`,
`isIdentifierBound` (`workflow-ast-bindings.ts`); `parseNormalizedWorkflowBody`,
`NormalizedBodyParseResult` (`workflow-body-parse.ts`);
`originalSpanFromNormalizedOffsets` (`workflow-body-normalizer.ts`);
`createRuleDiagnostic`, `firstReviewedRuleMessage`, `ruleDefinitionFor`
(`diagnostics`). `scanDeterministicTimeWarnings`'s public signature is
unchanged.

Pinned `@swc/core@1.15.43` AST shapes (verified against
`node_modules/@swc/types/index.d.ts`):

- `MemberExpression { object: Expression; property: Identifier | PrivateName |
  ComputedPropName }` (line 1349-1353).
- `ComputedPropName { type: "Computed"; expression: Expression }` (line
  1723-1726).
- `StringLiteral { type: "StringLiteral"; value: string }` (line 1516-1519).
- `NewExpression { callee: Expression; arguments?: Argument[] }` (line
  1377-1382).
- `Identifier { type: "Identifier"; value: string }` (line 1275-1278).

No new dependency. `@swc/core`, `fast-check`, and `bun:test` are already
present. No ODW runtime or static-helper symbol may appear in any new file.

## Progress

- [x] WI1: Resolve global-object identity with lexical bindings and rewire the
  scanner; flip `Date["now"]()` to positive; add shadow/global/cross-shadow and
  out-of-scope cases; update the module inventory. Gate `make all`.
- [x] WI2: Add new-form span cases, the shadowed/`globalThis` pipeline cases,
  and the `fast-check` shadow-invariance property. Gate `make all`.
- [x] WI3: Rewrite the three rule-doc Limitations sections, extend the
  developers' guide AST-facts section, and tick roadmap 3.1.4. Gate
  `make markdownlint`, `make nixie`, `make all`.

## Surprises & discoveries

- Observation: the existing scanner already lists `const value =
  Date["now"]();` as a *negative* case and the three rule docs record the
  syntactic limitation, so 3.1.4 is a deliberate behaviour flip, not an
  additive-only change. Evidence:
  `tests/static-analysis/workflow-deterministic-time.test.ts` line 72;
  `docs/rules/no-date-now.md` lines 51-55. Impact: WI1 must move that case and
  WI3 must rewrite the docs.
- Observation: `scanDeterministicTimeWarnings` already accepts and reuses a
  `NormalizedBodyParseResult`, and `lintScannedWorkflowBody` passes the shared
  parse in. Evidence: `workflow-deterministic-time.ts` lines 47-49;
  `workflow-lint.ts` lines 80-94. Impact: the binding facts can be computed from
  `parseResult.module` with no extra parse and no pipeline rewiring.
- Observation: the WI1 scratch probe confirmed the pinned SWC shapes:
  `Date["now"]()` uses a `MemberExpression` property
  `{ type: "Computed", expression: { type: "StringLiteral", value: "now" } }`;
  `globalThis.Date.now()` nests member expressions with an identifier
  `globalThis` root; `new globalThis.Date()` stores the member expression in
  `NewExpression.callee`. Impact: the resolver can stay syntactic and needs no
  dependency or public type leak.
- Observation: the first WI1 `make all` attempt failed at Biome import
  organization, and the second failed at TypeScript narrowing for broad
  `Expression | Node` unions. Impact: imports are now organized with Biome, and
  the resolver uses local narrowing helpers before reading identifier/member
  fields.
- Observation: the first WI1 CodeRabbit pass requested a type-safe global
  identity union, clearer ExecPlan wording for `globalThis` chains, and wrapper
  expression handling. Impact: `GlobalObjectIdentity` is exported from the
  internal resolver, the chain contract is clarified here, and transparent
  parenthesized/TypeScript wrapper expressions are unwrapped. Optional chaining
  remains intentionally out of scope per the detection contract.
- Observation: WI2 added 26 deterministic-time span snapshots: four
  surrounding-source variants each for `Date["now"]`,
  `globalThis.Date.now`, and `new globalThis.Date()`, while leaving the
  intra-expression ordering snapshots and trusted ODW fixture assertion
  unchanged. Impact: new supported forms now have reviewer-visible
  original-source span evidence.
- Observation: the pipeline test now proves a workflow-local `Date` binding
  suppresses `Date.now()` in `lintWorkflowSource`, while
  `globalThis.Date.now()` still reports one Claude compatibility warning.
  Impact: lexical binding facts are proven through the merged lint pipeline,
  not only the standalone scanner.
- Observation: WI3 rewrote all three deterministic-time rule Limitations
  sections, extended the developers' guide AST-facts note, and ticked roadmap
  3.1.4. Impact: user-facing rule docs now match the shipped shadow-aware and
  `globalThis`-aware behaviour, while the roadmap records the task as complete.

## Decision log

- Decision: consume `collectLexicalBindings(parseResult.module)` directly as the
  shadow oracle rather than `collectWorkflowAstFactsFromParseResult`.
  Rationale: the scanner needs only the binding names; the facts aggregator also
  builds suppression masks the scanner does not use, and reusing the leaner
  producer keeps one parse and no unused work (`AGENTS.md` DRY / abstraction
  policy).
  Date/Author: 2026-07-03, planning agent.
- Decision: recognize `Date`, `Math`, and `globalThis` as the only global
  roots; treat `window`/`self`/`global`, optional chaining, aliasing, and
  dynamic computed keys as documented conservative limits.
  Rationale: the success line names exactly `Date`, `Math`, and
  `globalThis.Date.now()`; §9.2's philosophy is "warn and explain", preferring
  a false negative to a false positive, and a static tool cannot follow aliases
  or dynamic keys without evaluating source (`docs/adr/0001`; §12.1).
  Date/Author: 2026-07-03, planning agent.
- Decision: shadow suppression is conservative name-set membership, mirroring
  2.2.4's name-based model, not scope-precise analysis.
  Rationale: any same-named binding suppresses the bare-global form, which is
  safe (prefers a missed warning to a false positive on legitimate local code);
  scope precision is a deferred refinement (`docs/execplans/roadmap-2-2-4.md`
  Decision Log).
  Date/Author: 2026-07-03, planning agent.
- Decision: extract the resolver into `workflow-global-object-reference.ts`
  rather than growing the scanner.
  Rationale: keeps each file single-responsibility and under the 400-line limit
  (`docs/complexity-antipatterns-and-refactoring-strategies.md`; `AGENTS.md`).
  Date/Author: 2026-07-03, planning agent.
- Decision: return the internal `GlobalObjectIdentity` union from the resolver
  instead of a broad `string`.
  Rationale: the scanner only supports `Date`, `Math`, and `globalThis`; making
  that vocabulary explicit keeps future consumers and comparisons type-safe
  without changing the package public surface.
  Date/Author: 2026-07-03, implementing agent.
- Decision: unwrap parenthesized and TypeScript-only transparent expression
  wrappers, but keep optional chaining undetected.
  Rationale: parentheses and non-null/type wrappers do not change the referenced
  global identity, while optional chaining is a documented conservative limit in
  this task and remains covered as a negative case.
  Date/Author: 2026-07-03, implementing agent.
- Decision: use `fast-check` for the WI2 generated binding invariant rather
  than a heavier verification adversary.
  Rationale: the invariant is a small exact-membership property over generated
  valid identifier text and a fixed `Date` binding; table-driven examples plus
  bounded property generation give direct regression coverage without adding a
  second analysis tool.
  Date/Author: 2026-07-03, implementing agent.

## Outcomes & retrospective

Task 3.1.4 is complete. The scanner ignores shadowed bare `Date`, `Math`, and
`globalThis` forms, detects computed string-key and supported `globalThis`
chains with original-source spans, and keeps trusted ODW fixtures free of
Claude compatibility diagnostics. The rule catalogue and diagnostic schema are
unchanged.

## Addenda

- [x] 3.1.4.1. Harden deterministic-time syntactic escape handling.
  - Source: review:3.1.4; severity low.
  - Scope: add bounded alias and optional-chain coverage for common
    deterministic-time forms while keeping dynamic computed keys inside
    documented no-eval limits.
  - Success: supported alias and optional-chain fixtures emit the expected
    Claude compatibility warnings, and dynamic-key cases remain documented
    conservative limits.
- [x] 3.1.4.2. Pin global-object resolver unit coverage.
  - Source: audit:3.1.4; severity medium.
  - Scope: add focused `workflow-global-object-reference` tests and trim
    unreachable TypeScript-only wrapper branches under the ECMAScript parser
    dialect.
  - Success: resolver tests directly cover reachable transparent-wrapper and
    member-resolution behaviour, and speculative wrapper branches no longer
    remain unexercised.
