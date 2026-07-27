# Audit after roadmap task 3.1.8

This post-step audit was run after roadmap task 3.1.8, "Assess and widen
ODW-only validate callee detection", merged into `origin/main` at commit
`64b4f23`. The change widened
`src/static-analysis/workflow-odw-only-validate.ts` to detect proven single-hop
`validate` aliases, pinned member, computed, and chained forms as intentional
non-detections, and refreshed the rule page, developers' guide, and roadmap
evidence.

The audit was performed in a fresh worktree off `origin/main`. `grepai` was
unavailable in this agent session (every `grepai search` invocation was refused
by the command-approval layer before execution), so canonical `main` intent
search could not be used; every fact below was instead verified branch-locally
with targeted file inspection and `git show` against the merged surface.

Normative references used:

- `AGENTS.md`
- `docs/adr/0001-static-analysis-boundary.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/rules/no-odw-only-validate.md`
- `docs/scripting-standards.md`
- `docs/technical-design.md`
- `docs/execplans/roadmap-3-1-8.md`
- `docs/issues/audit-3.1.6.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.

The 3.1.8 surface is small and of high quality: the scanner reuses the shared
`diagnosticsForBodyMatches` harness, the alias detection is provably bounded to
one hop, the rule page limitations match the shipped coverage exactly, and the
new tests pin bare, alias, shadowing, chained-alias, and member/computed cases
including two `fast-check` properties. The findings below are structural and
consistency observations on the newly merged code plus the sibling scanner it
now closely parallels; none blocks the released rule.

## Finding 1: Alias-scope tracking machinery is duplicated between the two scanners

Category: similarity

Severity: medium

Location:

- `src/static-analysis/workflow-odw-only-validate.ts:128`
- `src/static-analysis/workflow-odw-only-validate.ts:157`
- `src/static-analysis/workflow-deterministic-time-aliases.ts:93`
- `src/static-analysis/workflow-deterministic-time-aliases.ts:165`

Description:

The per-scope alias view that 3.1.8 added to the validate scanner is a
structural clone of the deterministic-time alias machinery.
`rootValidateAliasView` (`workflow-odw-only-validate.ts:121`) mirrors
`rootAliasView` (`workflow-deterministic-time-aliases.ts:52`);
`enterValidateAliasScope` (`workflow-odw-only-validate.ts:129`) mirrors
`enterAliasScopeWithOwnFacts` (`workflow-deterministic-time-aliases.ts:93`) —
same `ownNames.length === 0 && ownInitializers.length === 0` short-circuit,
same delegate; and `validateAliasesForOwnFacts`
(`workflow-odw-only-validate.ts:158`) mirrors `aliasViewForOwnFacts`
(`workflow-deterministic-time-aliases.ts:166`) — copy the parent container,
delete every owned name to model shadowing, then add owned aliases classified
from the initializer. The only genuine variation is the classifier
(`isUnshadowedValidateAliasInitializer` versus `aliasForExpression`) and the
container type (`Set<string>` versus `Map<string, DeterministicTimeAlias>`). As
roadmap step 3.2 adds orchestration-risk scanners, this "shadow owned names,
add owned aliases per scope" policy is on track to be copied a third and fourth
time, and any correction to the shadowing rule would then have to be applied in
every copy.

Proposed fix:

Extract a generic scope-alias tracker into a shared module (for example
`workflow-ast-alias-scopes.ts`) parametrized by a
`classify(initializer, bindings) => TAlias | undefined` callback and returning
an immutable `ReadonlyMap<string, TAlias>`. Have both scanners build their
views on it: the validate scanner uses a classifier that returns a marker for a
single-hop unshadowed `validate` identifier, and the deterministic-time module
supplies its existing `aliasForExpression`. The `Set<string>` in the validate
scanner becomes a `Map<string, true>` (or a thin `Set` adapter over the shared
map) so the container difference disappears. Gate on both scanners' focused
suites and the merged-pipeline suite passing unedited.

## Finding 2: Scanner walk-and-enter driver is duplicated verbatim across scanners

Category: duplication

Severity: low

Location:

- `src/static-analysis/workflow-odw-only-validate.ts:66`
- `src/static-analysis/workflow-odw-only-validate.ts:106`
- `src/static-analysis/workflow-deterministic-time.ts:84`
- `src/static-analysis/workflow-deterministic-time.ts:128`

Description:

Beyond the alias view of Finding 1, the two scanners share their traversal
driver almost line for line. `walkOdwOnlyValidateCalls`
(`workflow-odw-only-validate.ts:66`) and `walkDeterministicTimeHazards`
(`workflow-deterministic-time.ts:84`) are identical but for the match callback:
each seeds a `matches` array, calls
`traverseAstSubtree(root, initialContext, ...)`, pushes the per-node match when
defined, and returns `enter...Scope`. `enterValidateScanScope`
(`workflow-odw-only-validate.ts:106`) and `enterDeterministicTimeScope`
(`workflow-deterministic-time.ts:128`) both compute `scopeOwnFacts(node)` once,
enter the binding scope, and enter the alias scope from those facts. The shared
`workflow-body-scanner-harness.ts` already owns the parse-and-project
scaffolding but stops short of this scope-aware walk, so each scanner
re-implements it.

Proposed fix:

Add a generic scope-aware collector to `workflow-body-scanner-harness.ts`, for
example
`collectScopedMatches(root, initialContext, { matchNode, enterScope })`, that
owns the `traverseAstSubtree` loop, match accumulation, and scope threading.
Each scanner then supplies only its `matchNode` and `enterScope` callbacks.
This composes cleanly with the alias tracker of Finding 1 and shrinks each
future orchestration scanner to its rule-specific matching logic.

## Finding 3: `CallExpression` and `NewExpression` narrowers are re-declared per module

Category: duplication

Severity: low

Location:

- `src/static-analysis/workflow-odw-only-validate.ts:116`
- `src/static-analysis/workflow-deterministic-time-aliases.ts:237`
- `src/static-analysis/workflow-deterministic-time.ts:191`
- `src/static-analysis/swc-ast.ts:14`

Description:

`swc-ast.ts` centralizes `isAstNode`, `isExpression`, `isIdentifier`, and
`isMemberExpression`, but the call- and constructor-expression narrowers are
still defined locally. 3.1.8 added a third copy of the call narrower under a
scanner-specific name, `isValidateCallExpression`
(`workflow-odw-only-validate.ts:116`), alongside the pre-existing
`isCallExpression` (`workflow-deterministic-time-aliases.ts:237`) and
`isNewExpression` (`workflow-deterministic-time.ts:191`). Each is the same
one-line `node.type === "..."` guard. This reinforces Finding 3 of
`audit-3.1.6.md`, which already recommended consolidating SWC narrowers into
`swc-ast.ts`; the new copy shows the divergence widening rather than closing.

Proposed fix:

As part of resolving Finding 3 of `audit-3.1.6.md`, add `isCallExpression` and
`isNewExpression` to `swc-ast.ts` with the same `unknown`-accepting,
`isAstNode`-guarded contract as the existing narrowers, and replace the local
`isValidateCallExpression`, `isCallExpression`, and `isNewExpression` copies
with imports. The change is behaviour-preserving; re-run the static-analysis
suite to confirm no output change.

## Finding 4: Merged Claude-compatibility diagnostics are ordered by scanner, not source position

Category: inconsistency

Severity: low

Location:

- `src/static-analysis/workflow-lint.ts:112`
- `docs/developers-guide.md:193`

Description:

`lintScannedWorkflowBody` builds the `claudeCompatibility` stream by spreading
`scanDeterministicTimeWarnings(...)` and then `scanOdwOnlyValidateNotes(...)`
(`workflow-lint.ts:112`). Each scanner emits its own matches in source order,
but the merged stage concatenates all deterministic-time diagnostics before all
validate diagnostics regardless of their positions in the source. A workflow
whose `validate(source)` call precedes a later `Date.now()` therefore reports
the `Date.now` finding first, and no downstream stage re-sorts by span
(`src/diagnostics/report.ts`, `report-json.ts`, and `text.ts` all preserve
input order). The developers' guide documents the between-stage canonical order
("envelope … metadata … body syntax … Claude compatibility",
`developers-guide.md:193`) but is silent on intra-stage ordering, so the
behaviour is underspecified rather than contradicted. As more
Claude-compatibility scanners land under step 3.2, the by-scanner interleaving
will become more visible to users reading the report top to bottom.

Proposed fix:

Decide and record the intra-stage contract. Either sort the combined
`claudeCompatibility` list by span start (then by a stable scanner tiebreak)
before freezing it in `lintScannedWorkflowBody`, which gives users a single
top-to-bottom source order across all Claude-compatibility rules; or, if
by-scanner grouping is intended, state that explicitly in the "canonical order"
paragraph of `developers-guide.md`. Pin whichever contract is chosen with the
combined-body test proposed in Finding 5.

## Finding 5: No test pins the merged order of validate and deterministic-time findings

Category: test-gap

Severity: low

Location:

- `tests/static-analysis/workflow-lint.test.ts:193`

Description:

The merged-pipeline suite covers deterministic-time hazards and validate calls
only in isolation: the validate cases at `workflow-lint.test.ts:193` and `:218`
contain no `Date.now`/`Math.random` call, and the deterministic-time cases
contain no `validate` call. No test builds a single workflow body that emits
both a deterministic-time and a validate diagnostic, so the cross-scanner
ordering within `claudeCompatibility` (Finding 4) is unpinned, and a future
refactor that reorders the scanner spread — or the sort proposed in Finding 4 —
would not be caught by the suite.

Proposed fix:

Add a merged-pipeline test whose body triggers both scanners, for example
`const result = validate(args.source);` followed by
`const timestamp = Date.now();`, and assert the exact `claudeCompatibility`
rule sequence and spans that the chosen Finding 4 contract specifies. Extend it
with the reverse source ordering (the `Date.now` call first) so the test
distinguishes source-position ordering from scanner-registration ordering.

## Finding 6: The Claude-compatibility scanner list is hard-coded in the pipeline

Category: separation-of-concerns

Severity: low

Location:

- `src/static-analysis/workflow-lint.ts:110`

Description:

`lintScannedWorkflowBody` enumerates the Claude-compatibility scanners inline
as a fixed spread of `scanDeterministicTimeWarnings` and
`scanOdwOnlyValidateNotes` (`workflow-lint.ts:110`). Every scanner shares the
same `(envelope, parseResult) => readonly Diagnostic[]` signature, yet adding a
scanner means editing this function's body, and the developers' guide narrative
that lists the active scanners (`developers-guide.md:197`) must be kept in step
by hand. With the step 3.2 orchestration-risk rules due to add several more
scanners of the same shape, this becomes a recurring edit point and an easy
place for the code and its documentation to drift apart.

Proposed fix:

Introduce a module-level `readonly` array of Claude-compatibility scanner
functions (each typed as the shared
`(envelope, parseResult) => readonly Diagnostic[]` signature) and have
`lintScannedWorkflowBody` `flatMap` the shared `bodyParse` through it. New
scanners then register by appending to the array, and the pipeline body stops
changing per rule. Keep the ordering decision from Finding 4 in mind when the
array is iterated.

## Relationship to earlier audits

Finding 3 restates and reinforces Finding 3 of `audit-3.1.6.md` (SWC node-type
narrowers duplicated across modules); 3.1.8 added a further copy rather than
resolving it. Findings 1, 2, 4, 5, and 6 concern surface that 3.1.8 introduced
or first made concrete by adding a second parser-backed alias scanner alongside
the deterministic-time one.
