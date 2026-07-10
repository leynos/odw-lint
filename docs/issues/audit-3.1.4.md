# Audit after roadmap task 3.1.4

This post-step audit was run after roadmap task 3.1.4, which taught the
deterministic-time scanner to recognize `globalThis` and string-key member
forms, merged into `origin/main` at commit `c344083`. The audit used `grepai`
against the canonical
`main` index for intent search, then verified every branch-local fact in a fresh
worktree off `origin/main` with `leta`, targeted file inspection, and `sem`
entity history.

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

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- `grepai`: canonical `main` intent search.
- `leta`: branch-local symbol and source navigation.
- `sem`: entity-level diff and blame inspection.

The 3.1.4 change extracted global-object resolution out of the
deterministic-time scanner into a new `workflow-global-object-reference.ts`
module and taught it to recognize `globalThis` chains, string-key member access,
and lexical shadowing. The findings below concentrate on that newly merged
surface, with a small number of adjacent observations in the shared traversal
and guard helpers it depends on.

## Finding 1: `workflow-global-object-reference.ts` has no dedicated unit test

Category: test-gap

Severity: medium

Location:

- `src/static-analysis/workflow-global-object-reference.ts:52`
- `src/static-analysis/workflow-global-object-reference.ts:30`
- `tests/static-analysis/workflow-deterministic-time.test.ts`

Description:

The 3.1.4 change created a new module that exports two contract-bearing pure
functions, `resolveGlobalObjectIdentity` and `resolveStaticMemberName`, but
added no test file targeting them directly. The only coverage is indirect,
through `scanDeterministicTimeWarnings` in
`tests/static-analysis/workflow-deterministic-time.test.ts`.

Because the coverage is indirect, one non-trivial behaviour of the module is
completely unexercised: the transparent-wrapper unwrapping in
`innerTransparentExpression`/`isTransparentWrapperExpression`. No test drives a
parenthesized global such as `(Date).now()`, `(globalThis).Date.now()`, or a
shadow interacting through parentheses such as
`const Date = x;\n(Date).now();`. The recursive `resolveGlobalObjectIdentity`
call that peels wrappers is therefore never entered by the suite, so a
regression that broke parenthesis handling would pass CI.

Proposed fix:

Add `tests/static-analysis/workflow-global-object-reference.test.ts` that calls
the two exported functions directly against small SWC expression fixtures.
Cover: parenthesized roots (`(Date)`, `(globalThis).Date`), nested `globalThis`
chains, computed string-literal keys (`globalThis["Date"]`), a shadowed
identifier seen through a wrapper (must resolve to `undefined`), and computed
non-string keys (must resolve to `undefined`). Retain the end-to-end cases in
`workflow-deterministic-time.test.ts`.

## Finding 2: Five of the six transparent-wrapper node types are unreachable

Category: complexity

Severity: low

Location:

- `src/static-analysis/workflow-global-object-reference.ts:15`

Description:

`TRANSPARENT_WRAPPER_TYPES` lists six node types:

```ts
const TRANSPARENT_WRAPPER_TYPES = Object.freeze([
  "ParenthesisExpression",
  "TsAsExpression",
  "TsConstAssertion",
  "TsNonNullExpression",
  "TsSatisfiesExpression",
  "TsTypeAssertion",
] as const);
```

The five `Ts…` entries are TypeScript-only AST nodes. The workflow body parser
in `workflow-body-parse.ts` is pinned to `syntax: "ecmascript"` with a comment
citing ADR 0002, which records that workflow bodies stay ECMAScript-only for ODW
parity. SWC therefore never emits any `Ts…` node for a workflow body, so those
five branches are unreachable, untested, and — per the complexity-antipatterns
guide — speculative generality that a reader must still reason about when
auditing the shadowing logic.

Proposed fix:

Reduce `TRANSPARENT_WRAPPER_TYPES` to `["ParenthesisExpression"]` and add a
short comment referencing ADR 0002 to explain why TypeScript wrappers are
intentionally excluded, or, if TypeScript workflow bodies are a planned dialect
expansion, record that intent at the declaration and add a guarding fixture so
the branches are exercised rather than dormant. Either way, add the parenthesis
coverage from
Finding 1 so the one reachable wrapper type is pinned.

## Finding 3: Node/record type guards are re-implemented instead of shared

Category: duplication

Severity: low

Location:

- `src/static-analysis/workflow-deterministic-time.ts:217`
- `src/static-analysis/workflow-deterministic-time.ts:222`
- `src/static-analysis/workflow-global-object-reference.ts:133`
- `src/static-analysis/value-guards.ts:18`

Description:

`isNode` in `workflow-deterministic-time.ts` and `isExpression` in
`workflow-global-object-reference.ts` are byte-identical:

```ts
return typeof value === "object" && value !== null && "type" in value;
```

A third guard, `isObjectRecord` in `workflow-deterministic-time.ts`, expresses a
near-identical concept (`typeof value === "object" && value !== null`) to the
already-shared `isUnknownRecord` in `value-guards.ts`, differing only in that it
does not exclude arrays — a distinction that happens not to matter at its single
call site because the array case is handled earlier. The static-analysis layer
already has a `value-guards.ts` module for exactly this purpose, yet the 3.1.4
modules grew their own copies rather than extending it.

Proposed fix:

Add a single `isAstNode` (object, non-null, has a `type` key) guard to
`value-guards.ts` and import it in both new modules, replacing `isNode` and
`isExpression`. Replace `isObjectRecord` with `isUnknownRecord` from
`value-guards.ts`, or, if the array-permissive shape is genuinely wanted,
document why at the call site.

## Finding 4: Generic SWC child traversal is hand-rolled twice

Category: separation-of-concerns

Severity: low

Location:

- `src/static-analysis/workflow-deterministic-time.ts:99`
- `src/static-analysis/workflow-ast-bindings.ts:275`

Description:

Two modules independently re-derive "walk into an SWC node's children, recursing
through arrays and nested record values". `workflow-deterministic-time.ts` does
it with `visitChildValue`/`childRecordValues`/`isTraversableChildKey` (a
pre-order full-tree walk that skips `span`, `type`, and `ctxt`), while
`workflow-ast-bindings.ts` does it with `collectChildBindings` (an
`Object.values` recursion). The two strategies diverge in detail but share the
same underlying traversal concern, and neither reuses the other. A future
node-shape assumption (for example, a new wrapper field that holds child nodes)
would need to be taught to both walkers.

Proposed fix:

Extract a shared `forEachChildNode(node, visit)` traversal primitive into a
small helper module (alongside the guard from Finding 3) and express both the
hazard walk and the binding collector as visitors over it. This localizes the
knowledge of which SWC fields carry child nodes to one place.

## Finding 5: `childValues` is a redundant pass-through wrapper

Category: ergonomics

Severity: low

Location:

- `src/static-analysis/workflow-deterministic-time.ts:125`

Description:

```ts
/** Returns child fields that may contain nested SWC nodes. */
const childValues = (node: Node): readonly unknown[] => {
  return childRecordValues(node);
};
```

`childValues` forwards to `childRecordValues` with the same argument and adds no
behaviour. It has a single caller (`visitNode`). The extra name adds a layer of
indirection that a reader must resolve to confirm nothing else happens,
mirroring the `textIndexForOffset` pass-through called out in the 2.1.12 audit.

Proposed fix:

Delete `childValues` and call `childRecordValues(node)` directly in `visitNode`.

## Finding 6: `isIdentifierBound` performs a linear scan on every hazard check

Category: complexity

Severity: low

Location:

- `src/static-analysis/workflow-ast-bindings.ts:94`
- `src/static-analysis/workflow-global-object-reference.ts:81`

Description:

`collectLexicalBindings` returns `boundNames` as a frozen sorted `readonly
string[]`, and `isIdentifierBound` looks names up with
`facts.boundNames.includes(name)`. During a full-tree hazard walk,
`unshadowedGlobalIdentity` calls `isIdentifierBound` for every candidate global
identifier, so lookup cost is `O(bindings)` per identifier and `O(bindings ×
identifiers)` for the body. The sorted array is deliberate for stable,
deterministic output, but the lookup does not need to pay for that ordering.

Proposed fix:

Keep the sorted array on the public `LexicalBindingFacts` for stable output,
but back `isIdentifierBound` with a `Set<string>` built once (either stored
alongside the array on the frozen facts object, or memoized inside the module)
so membership checks are `O(1)`. This is a small change with no behavioural
effect.

## Finding 7: `no-argless-new-date` docs and tests omit the computed-key form

Category: inconsistency

Severity: low

Location:

- `docs/rules/no-argless-new-date.md:47`
- `tests/static-analysis/workflow-deterministic-time.test.ts:116`

Description:

`resolveGlobalObjectIdentity` resolves both `globalThis.Date` and the
string-key form `globalThis["Date"]` via `resolveStaticMemberName`, so
`new globalThis["Date"]()` is detected by `odw/no-argless-new-date` just as
`new globalThis.Date()` is. The rule documentation only mentions the dotted
`globalThis` chain, and the positive test cases include
`new globalThis.Date()` but no computed-key equivalent. By contrast,
`no-date-now.md` and the `Date.now` positive cases do document and test the
`Date["now"]()` and `globalThis["Date"]["now"]()` forms. The argless-new-date
surface is therefore documented and pinned less precisely than the sibling rule
it shares resolution logic with.

Proposed fix:

Add a `new globalThis["Date"]()` positive case to the `POSITIVE_CASES` table in
`workflow-deterministic-time.test.ts`, and extend the "Limitations" section of
`no-argless-new-date.md` to state that string-key `globalThis` access is
detected, matching the wording already in `no-date-now.md`.
</content>
</invoke>
