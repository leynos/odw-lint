# Audit after roadmap task 3.1.7

This post-step audit was run after roadmap task 3.1.7, "Emit ODW-only validate
diagnostics in the lint pipeline", squash-merged into `origin/main` at commit
`83b8552`. That change added a production scanner for ODW-only
`validate(source)` calls (`src/static-analysis/workflow-odw-only-validate.ts`),
routed its `odw/no-odw-only-validate` info diagnostic through
`lintWorkflowSource`, registered the rule in the typed catalogue, and
reconciled the rule reference, developers' guide, technical design table, and
strict-Claude non-promotion coverage.

The audit verified every branch-local fact in a fresh worktree off
`origin/main` (branch `worktree-df12-audit-3.1.7-post`, base commit `284c381` —
the current `origin/main` head, three integrations after 3.1.7 landed) with
targeted file inspection, `grep`, and `git show` entity history.

The 3.1.7 scanner is well covered in isolation: its focused suite pins
bare-call detection, source-order emission, lexical and sibling-scope
shadowing, member and computed exclusion, arity independence, parse-failure
quiet, and a generated-name property oracle; its rule reference, catalogue
entry, rules index, technical-design table, and developers' guide entry are
mutually consistent and guarded. The findings below concentrate on what the new
scanner brought with it by cloning the shape of its deterministic-time sibling:
a freshly duplicated single-type narrower that re-entered outside the SWC seam,
the architecture guard's blind spot that let it through, the verbatim scanner
scaffolding the two body scanners now maintain in parallel, and the alias-scope
detection asymmetry between two sibling `claude-compatibility` scanners.

Normative references used:

- `AGENTS.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/technical-design.md`
- `docs/issues/audit-3.2.7.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- Branch-local file inspection, `grep`, and `git show`: source and
  entity-history verification.

Tooling note: `grepai` intent search and the `git-donkey`/`git` write- and
network-backed commands were unavailable in this agent session (each was
auto-denied by the sandbox permission layer). The fresh inspection worktree was
therefore created with the harness `EnterWorktree` mechanism off `origin/main`,
and every finding below is grounded in direct branch-local file inspection
rather than the canonical `main` `grepai` index.

## Finding 1: a `CallExpression` narrower was cloned outside the SWC seam

Category: duplication

Severity: low

Location:

- `src/static-analysis/workflow-odw-only-validate.ts:99`
- `src/static-analysis/workflow-deterministic-time-aliases.ts:237`
- `src/static-analysis/swc-ast.ts:36`

Description:

The SWC seam (`swc-ast.ts`) is the single home for single-type node narrowers,
exporting `isExpression`, `isIdentifier`, and `isMemberExpression`. Task
3.2.5.3 unified the divergent copies of those narrowers onto the seam, and
`docs/issues/audit-3.2.7.md` Finding 1 tracked the last stray copy until it too
was removed. Task 3.1.7's new scanner reintroduces the pattern for a type the
seam does not yet export:

```ts
/** Narrows nodes to SWC call expressions. */
const isValidateCallExpression = (node: Node): node is CallExpression => {
  return node.type === "CallExpression";
};
```

This is byte-identical (modulo name) to `isCallExpression` in
`workflow-deterministic-time-aliases.ts:237`:

```ts
/** Narrows nodes to SWC call expressions. */
const isCallExpression = (node: Node): node is CallExpression => {
  return node.type === "CallExpression";
};
```

Two modules now maintain the same `CallExpression` narrowing contract in two
private copies, and neither routes through the seam. This is exactly the
"rule-local shape helper" duplication the seam exists to prevent. Because the
`deterministic-time-aliases` copy predates 3.1.7 and is module-private, the new
scanner could not reuse it; the seam gap made re-cloning the path of least
resistance.

Proposed fix:

Add an exported `isCallExpression` to `swc-ast.ts` in the same `value: unknown`
form as its siblings — `isAstNode(value) && value.type === "CallExpression"` —
then delete both private copies and import the seam narrower in
`workflow-odw-only-validate.ts` and `workflow-deterministic-time-aliases.ts`.
`Node` is assignable to `unknown`, so both call sites keep working unchanged.
Adopting the `isAstNode(value) && value.type === "…"` form also brings the
narrower under the existing architecture guard (see Finding 2).

## Finding 2: the single-type-narrower guard cannot see bare `.type` discriminants

Category: test-gap

Severity: medium

Location:

- `tests/diagnostics/architecture.test.ts:176`
- `tests/diagnostics/architecture.test.ts:251`
- `tests/diagnostics/architecture.test.ts:266`

Description:

Following `docs/issues/audit-3.2.7.md` Finding 2, the architecture suite gained
a shape-based detector, `hasClonedSwcSingleTypeNarrowerShape`, to catch cloned
seam narrowers regardless of name. It flags a declaration whose single return
expression is either `isAstNode(value)` or
`isAstNode(value) && value.type === "X"`:

```ts
return isAstNodeCall(expression) || isAstNodeAndTypeDiscriminantCheck(expression);
```

Both clones in Finding 1 return a bare `node.type === "CallExpression"` — an
`isTypeDiscriminantCheck` with no conjoined `isAstNode(...)` call, because the
parameter is already typed `Node`. That form matches neither `isAstNodeCall` nor
`isAstNodeAndTypeDiscriminantCheck`, so both `CallExpression` narrowers sail
past the guard and the suite stays green while duplicate narrowers live outside
the seam. The detector already owns a standalone `isTypeDiscriminantCheck`
predicate (`architecture.test.ts:266`), so it recognizes the shape internally
but never asserts on it in isolation. This is the same class of gap 3.2.7
Finding 2 documented — a guard that keys on the specific shapes it has seen
rather than the full family of single-type narrowers — recurring one shape
along.

Proposed fix:

Extend `hasClonedSwcSingleTypeNarrowerShape` to also return true when the
single return expression is a standalone `isTypeDiscriminantCheck(expression)`
whose discriminated operand is the narrower's own parameter, so a
`(node: Node): node is T => node.type === "…"` clone is flagged like its
`isAstNode`-guarded cousins. Add a positive case to the existing "detects
cloned single-type SWC narrower shapes" test (`architecture.test.ts:343`)
covering the bare-`.type` form, and confirm the suite flags Finding 1's
narrowers before they are hoisted to the seam. Hoisting per Finding 1 closes
the gap for these two narrowers; hardening the guard closes it for every future
bare-`.type` clone.

## Finding 3: the two body scanners maintain verbatim scaffolding in parallel

Category: similarity

Severity: low

Location:

- `src/static-analysis/workflow-odw-only-validate.ts:39`
- `src/static-analysis/workflow-odw-only-validate.ts:103`
- `src/static-analysis/workflow-deterministic-time.ts:68`
- `src/static-analysis/workflow-deterministic-time.ts:204`

Description:

`workflow-odw-only-validate.ts` was built by cloning the structure of
`workflow-deterministic-time.ts`, and three pieces of scaffolding are now
duplicated between them:

- The `scanX` entry function: guard on `!parseResult.ok`, build a root scope
  view, walk the module, `.map` each match through `diagnosticForMatch`, and
  `Object.freeze` the result (`workflow-odw-only-validate.ts:39` vs
  `workflow-deterministic-time.ts:68`).
- The `walkX` function: allocate a `matches` array, `traverseAstSubtree` with a
  visitor that pushes matches and returns the entered scope, and return the
  array (`workflow-odw-only-validate.ts:62` vs
  `workflow-deterministic-time.ts:92`).
- The `diagnosticForMatch` function: its `createRuleDiagnostic` call is
  byte-identical between the two files; only how each resolves its
  `RuleDefinition` differs (a module constant here, a `Map` lookup there). The
  shared body is:

```ts
return createRuleDiagnostic({
  file: envelope.sourceFile.filePath,
  rule,
  severity: rule.defaultSeverity,
  message: firstReviewedRuleMessage(rule),
  span: originalSpanFromNormalizedOffsets(
    envelope.sourceFile,
    normalized,
    match.span.start - moduleBase,
    match.span.end - moduleBase,
  ),
});
```

The `diagnosticForMatch` body in particular is verbatim shared logic that turns
a normalized-offset span into a project diagnostic — the same offset-rebasing
contract copied into every body scanner. As step 3.2 adds more parser-backed
scanners (`odw/bounded-loop`, `odw/bounded-fanout`, `odw/no-promise-race`),
each new scanner will re-clone this scaffold, multiplying the places the
normalized-to-original span contract must stay correct.

Proposed fix:

Extract the highest-value, lowest-risk piece first: a shared
`diagnosticForNormalizedSpan(envelope, normalized, moduleBase, rule, span)`
helper (a natural home is alongside `originalSpanFromNormalizedOffsets` in
`workflow-body-normalizer.ts`, or a small `workflow-body-scan.ts` seam), and
have both scanners' `diagnosticForMatch` delegate to it. If the `scanX`/`walkX`
symmetry proves stable across a third scanner, follow with a generic
`collectBodyMatches(root, initialContext, matchFn, enterFn)` walk so new body
scanners supply only their match and scope-entry predicates. Keep each
scanner's rule-resolution and context type local, since those are the parts
that legitimately differ.

## Finding 4: sibling Claude-compatibility scanners diverge in alias-scope detection

Category: inconsistency

Severity: low

Location:

- `src/static-analysis/workflow-odw-only-validate.ts:83`
- `src/static-analysis/workflow-deterministic-time-aliases.ts:165`
- `docs/rules/no-odw-only-validate.md`

Description:

The deterministic-time scanner resolves aliases: it tracks lexical re-bindings
such as `const d = Date; d.now()`, `globalThis` forms, and string-key member
access, via the alias view in `workflow-deterministic-time-aliases.ts`. The
ODW-only-validate scanner, a sibling `claude-compatibility` body scanner
emitting through the same pipeline, deliberately matches only a lexically
unshadowed bare `validate` identifier (`matchOdwOnlyValidateCall`), so
`const v = validate; v(source)`, `namespace.validate(source)`, and
`registry["validate"](source)` are not reported. The rule reference documents
this as a release limitation, and the scanner's tests pin the exclusions, so
this is a scoped decision rather than a defect. The concern is consistency: two
rules in the same category, surfaced side by side to workflow authors, apply
materially different detection depth, and nothing records why the newer rule
stops at bare identifiers while its sibling resolves aliases. An author who
trusts `odw/no-date-now` to see through a `const d = Date` alias may reasonably
expect `odw/no-odw-only-validate` to see through `const v = validate`, and be
silently under-warned.

Proposed fix:

This is a scope question for the root agent, not a fix to land in this audit.
Near-term, add one sentence to the "Limitations" section of
`docs/rules/no-odw-only-validate.md` (and/or the deterministic-time rule pages)
noting explicitly that alias resolution is a deterministic-time-only capability
in this release, so the asymmetry is deliberate and documented rather than
incidental. Longer-term, consider the proposed roadmap item below to extend the
shared alias-resolution machinery to the validate scanner, which also reduces
the Finding 3 divergence by pushing both scanners onto one alias-aware harness.

## Summary of prior-audit status

For continuity with `docs/issues/audit-3.2.7.md`, whose findings concern the
3.2.x deterministic-time reconciliation rather than the 3.1.7 validate scanner:

- 3.2.7 Finding 1 (a re-cloned `isExpression` in
  `workflow-ast-scope-own-facts.ts`): unchanged by 3.1.7 and out of this
  audit's scope; not re-verified here.
- 3.2.7 Finding 2 (name-keyed narrower guard): the proposed shape-based detector
  `hasClonedSwcSingleTypeNarrowerShape` **was implemented**, but it covers only
  the `isAstNode`-guarded narrower family and misses the bare
  `node.type === "X"` form 3.1.7 cloned, carried forward as Finding 2 above.
- 3.2.7 Findings 3 and 4 (orphaned scope-entry wrappers; unlinked node-type
  enumerations): unchanged by 3.1.7 and out of scope; not re-verified here.
