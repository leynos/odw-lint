# Assess and widen ODW-only validate callee detection

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: IN PROGRESS

## Purpose / big picture

`odw-lint` reports calls to ODW's injected `validate(source)` primitive as an
informational `odw/no-odw-only-validate` finding, because such a call is valid
inside ODW but does not map to pure Claude Code execution
([technical-design.md](../technical-design.md) §§3, 4, 5, and 9.2). Roadmap task
3.1.7 shipped the first emitter, which matches only a call whose callee is a
bare, lexically-unshadowed `validate` identifier
([src/static-analysis/workflow-odw-only-validate.ts](../../src/static-analysis/workflow-odw-only-validate.ts)).
Its rule page records that aliases (`const v = validate; v(source)`), member
forms (`namespace.validate(source)`), and computed callees
(`registry["validate"](source)`) are not detected
([docs/rules/no-odw-only-validate.md](../rules/no-odw-only-validate.md)
"Limitations").

Roadmap task 3.1.8 asks us to assess the false-positive risk for those alias,
namespace/member, and computed callee forms, then either widen the scanner where
the primitive identity can be proven or document the remaining conservative
bounds, so every such form has an intentional, tested lint outcome
([docs/roadmap.md](../roadmap.md) task 3.1.8).

The assessment, grounded in the ODW loader design and confirmed by the imported
ODW example fixtures, is recorded in full in the Decision Log. Its conclusion:

1. The injected `validate` primitive is a bare in-scope binding created by ODW's
   loader when it wraps the workflow body in an async function
   ([technical-design.md](../technical-design.md) §§3, 4, and 5). Every imported
   ODW example calls its primitives (`agent`, `parallel`) as bare identifiers,
   never as members (verified: `grep` over
   `tests/static-analysis/fixtures/odw-examples` shows only `agent(` and
   `parallel(` bare-call forms). The only free `validate` identifier in a
   workflow body is therefore the injected primitive
   ([technical-design.md](../technical-design.md) §4).
2. A single-hop alias such as `const v = validate; v(source)` provably binds
   `v` to the injected primitive when `validate` is lexically unshadowed at the
   alias declaration and `v` is unshadowed at the call site. Its identity is
   provable, and the deterministic-time rules already widened to lexical aliases
   in tasks 3.1.4-3.1.6
   ([src/static-analysis/workflow-deterministic-time-aliases.ts](../../src/static-analysis/workflow-deterministic-time-aliases.ts)).
   We therefore **widen** the scanner to detect single-hop `validate` aliases,
   reusing the same scope-precise fact infrastructure.
3. A member or namespace form (`schema.validate(source)`), a computed callee
   (`registry["validate"](source)`), and a `globalThis.validate(source)` form
   are, by construction, **not** the injected primitive: the primitive is never
   a property of an object and never a global. Matching any of them would be a
   false positive, so they remain intentionally undetected, pinned by negative
   tests and documented as bounds.
4. Chained aliases (`const v = validate; const w = v; w(source)`) stay out of
   scope, mirroring the deterministic-time alias model's "deliberately bounded
   to direct declarations" rule
   ([workflow-deterministic-time-aliases.ts](../../src/static-analysis/workflow-deterministic-time-aliases.ts)
   `rootAliasView` doc comment).

Observable success (verifiable behaviour):

1. For a workflow body containing `const v = validate; const out = v(args.source);`,
   `lintWorkflowSource(source).diagnostics` returns exactly one
   `odw/no-odw-only-validate` `info` diagnostic whose `span` covers the alias
   callee `v`, with the reviewed catalogue message and
   `docs === "docs/rules/no-odw-only-validate.md"`. Two alias calls yield two
   diagnostics in source order.
2. For bodies containing `schema.validate(args.source);`,
   `registry["validate"](args.source);`, `globalThis.validate(args.source);`,
   an alias shadowed at its call site, or a chained alias
   (`const v = validate; const w = v; w(args.source);`), no
   `odw/no-odw-only-validate` diagnostic is produced.
3. The bare-identifier behaviour from 3.1.7 is unchanged: `validate(args.source)`
   still emits one finding, a locally-declared `const validate = () => ok`
   suppresses it, and identity (not arity) drives the match.
4. [docs/rules/no-odw-only-validate.md](../rules/no-odw-only-validate.md)
   "Limitations" and the [developers-guide.md](../developers-guide.md) pipeline
   narrative match the shipped coverage: single-hop aliases are detected;
   member, computed, `globalThis`, and chained-alias forms are documented as
   intentionally undetected.
5. `make all` passes at each commit; `make markdownlint` and `make nixie` pass
   for the documentation commit.

## Scope boundary (what this task does and does not do)

This task refines the library-layer scanner and its documentation only. It does
**not** touch the rule catalogue (the message, category `claude-compatibility`,
default severity `info`, and `released` status stay exactly as 3.1.7 shipped
them), the pipeline wiring in
[workflow-lint.ts](../../src/static-analysis/workflow-lint.ts) (the scanner is
already merged into the `claudeCompatibility` stage), the strict-Claude policy
(`odw/no-odw-only-validate` stays informational and unpromoted), or the
`odw-lint check` CLI (roadmap step 2.4) and configuration loader (roadmap step
3.3), both still out of scope. The public signature of `scanOdwOnlyValidateNotes`
is unchanged, so no public-API or module-manifest fixture changes. The only
widening is single-hop alias detection; member, computed, `globalThis`, and
chained-alias forms remain intentionally undetected by design.

## Constraints

Hard invariants that must hold throughout implementation.

1. Do not execute or evaluate workflow source. The scanner walks the SWC AST of
   the normalized body and never imports ODW runtime code, per
   [adr/0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md)
   and [technical-design.md](../technical-design.md) §6.4.
2. Workflow bodies are parsed under the ECMAScript-only dialect fixed by
   [adr/0002-workflow-body-parser-dialect-scope.md](../adr/0002-workflow-body-parser-dialect-scope.md);
   do not add TypeScript-syntax handling.
3. The rule catalogue stays the single source of truth for the rule identifier,
   category, default severity, docs slug, and reviewed message
   ([src/diagnostics/rule-catalogue.ts](../../src/diagnostics/rule-catalogue.ts)).
   The scanner keeps obtaining its message via `firstReviewedRuleMessage` and
   its severity via `rule.defaultSeverity`; it must not hard-code a literal
   message.
4. `scanOdwOnlyValidateNotes` keeps its exact exported signature
   `(envelope: WorkflowEnvelope, parseResult?: NormalizedBodyParseResult) =>
   readonly Diagnostic[]`, so
   [tests/diagnostics/public-api-fixtures.ts](../../tests/diagnostics/public-api-fixtures.ts)
   and [tests/diagnostics/architecture-fixtures.ts](../../tests/diagnostics/architecture-fixtures.ts)
   need no edits (verified: no new module and no new public export).
5. `odw/no-odw-only-validate` stays `info` and is never promoted by
   strict-Claude
   ([src/diagnostics/strict-claude.ts](../../src/diagnostics/strict-claude.ts)).
6. Canonical Claude-compatibility merge order is preserved: deterministic-time
   findings first, then ODW-only validate notes
   ([workflow-lint.ts](../../src/static-analysis/workflow-lint.ts)). Widening the
   validate match must not reorder that stream.
7. No existing fixture, example, or snapshot may gain or lose a diagnostic.
   (Verified precondition: no fixture under `tests/static-analysis/fixtures/`
   contains a `validate(` call, per the 3.1.7 discovery recorded in
   [execplans/roadmap-3-1-7.md](roadmap-3-1-7.md) "Surprises & discoveries";
   re-confirm before implementation.)
8. No source or test file exceeds 400 lines; Markdown wraps at 80 columns for
   prose and 120 for code blocks (AGENTS.md "Keep file size manageable" and
   "Markdown Guidance").
9. Prose, comments, and commit messages use en-GB Oxford spelling
   ("-ize"/"-yse"/"-our"), per AGENTS.md and
   [documentation-style-guide.md](../documentation-style-guide.md).

## Tolerances (exception triggers)

1. Scope: if any single work item requires changing more than 4 files or more
   than roughly 180 net lines, stop and escalate.
2. Interface: if delivering alias detection requires changing a public signature
   of `scanOdwOnlyValidateNotes`, `lintWorkflowSource`, `createRuleDiagnostic`,
   or the `RuleDefinition` type, stop and escalate.
3. Dependencies: if any new runtime or dev dependency is required, stop and
   escalate.
4. Behaviour drift: if the alias widening changes the diagnostics of any
   existing fixture, example, or snapshot, stop and escalate — that signals a
   false-positive match and the predicate must be reconsidered.
5. File size: if the widened
   [workflow-odw-only-validate.ts](../../src/static-analysis/workflow-odw-only-validate.ts)
   would exceed roughly 340 lines (leaving headroom under the 400-line guard),
   stop and escalate rather than silently splitting; the split into a dedicated
   `workflow-odw-only-validate-aliases.ts` module (with the accompanying
   `architecture-fixtures.ts` manifest edit) would be a scoped follow-up, not an
   in-flight improvisation.
6. Iterations: if `make all` still fails after 3 focused attempts on a work
   item, stop and escalate.
7. Ambiguity: if a reviewer holds that even single-hop alias detection carries
   unacceptable false-positive risk, stop and fall back to the documented
   document-only path (keep the 3.1.7 bare-identifier behaviour, and turn WI-1
   into negative alias tests plus a documented bound) rather than widening
   silently.

## Risks

- Risk: single-hop alias detection produces a false positive on
  `const v = validate` where `validate` is not the injected primitive.
  Severity: medium. Likelihood: low.
  Mitigation: record an alias only when the initializer is a bare `Identifier`
  named `validate` that is **not** `isIdentifierBound` at the alias declaration
  scope, reusing the scope-precise binding facts from 3.1.5/3.1.6. In an ODW
  workflow body the only free `validate` is the injected primitive
  ([technical-design.md](../technical-design.md) §4). A body-local
  `const validate = …` is a shadow, so no alias is recorded. Pinned by the
  shadowed-initializer unit test in WI-1.
- Risk: the alias set leaks across scopes, suppressing or spuriously matching an
  unrelated same-named binding.
  Severity: medium. Likelihood: low.
  Mitigation: mirror `enterAliasScopeWithOwnFacts`
  ([workflow-deterministic-time-aliases.ts](../../src/static-analysis/workflow-deterministic-time-aliases.ts))
  exactly — delete each scope's `ownNames` from the inherited alias set before
  adding that scope's own aliases, so a nested redeclaration shadows the alias.
  Pinned by the sibling-scope and call-site-shadow unit tests in WI-1.
- Risk: widening changes the diagnostic span or message shape for the bare case.
  Severity: low. Likelihood: low.
  Mitigation: keep the bare-identifier branch's `{ span: node.callee.span }`
  unchanged; the alias branch reports the alias callee's own span. The message
  is catalogue-derived and generic about the primitive, so it is identical for
  bare and alias forms. Pinned by the unchanged bare-case assertions.
- Risk: the added alias code pushes the scanner file over the 400-line guard.
  Severity: low. Likelihood: low.
  Mitigation: the file is 123 lines today; the alias view for a single free
  identifier is a `ReadonlySet<string>` and is far simpler than the
  deterministic-time global/member alias module. Estimated final size ~210
  lines. Tolerance 5 gates the split decision if the estimate is wrong.

## Progress

- [x] WI-1: Widen the ODW-only validate scanner to single-hop aliases with tests
- [x] WI-2: Reconcile the validate rule page and guide with shipped coverage

2026-07-06 WI-1 implementation: Added scanner support for scope-precise
single-hop aliases of the unshadowed injected `validate` primitive, plus focused
scanner tests, a merged-pipeline `lintWorkflowSource` regression, and the
required `docs/contents.md` index entry for this ExecPlan. Red evidence:
`bun test tests/static-analysis/workflow-odw-only-validate.test.ts
tests/static-analysis/workflow-lint.test.ts` failed before production changes
because alias calls emitted no diagnostics. Green evidence: the same focused
test command passed after the alias view and match branch landed. Gate evidence:
scrutineer ran `make all`, `make check-fmt`, `make typecheck`, `make lint`,
`make test`, `make markdownlint`, and `make nixie`; all passed.

2026-07-06 WI-2 implementation: Reconciled the released rule page and
developers guide with the WI-1 shipped coverage. The rule page now documents
that bare `validate(source)` calls and direct single-hop aliases emit
`odw/no-odw-only-validate`, while member, computed, `globalThis`, and chained
alias forms remain intentionally undetected because their primitive identity
cannot be proven. The developers guide now describes the same bare and
single-hop-alias coverage in the Claude-compatibility pipeline narrative.
`docs/contents.md` already carried the 3.1.8 ExecPlan index entry from WI-1, so
WI-2 left that file untouched. Green evidence: `make markdownlint`, `make nixie`,
and the full deterministic gate set passed at committed HEAD.

## Surprises & discoveries

- Observation: the ODW checkout at
  `/data/leynos/Projects/open-dynamic-workflows` is outside this agent's
  sandboxed working directories, so its source could not be read directly during
  planning, and `grepai`/`git` read commands required interactive approval that
  was unavailable in the planning session.
  Evidence: `ls /data/leynos/Projects/open-dynamic-workflows` returned
  "blocked … may only list files in the allowed working directories".
  Impact: the assessment is grounded in the in-repo authoritative capture of ODW
  loader behaviour ([technical-design.md](../technical-design.md) §§3-5, which
  cite `open-dynamic-workflows/src/primitives.ts` and `/src/loader.ts`) and in
  the imported ODW example fixtures under
  `tests/static-analysis/fixtures/odw-examples`, which show primitives called as
  bare identifiers. The implementer should, if the checkout becomes readable,
  cross-check `src/primitives.ts`/`src/loader.ts` to reconfirm that `validate`
  is injected as a bare binding, and record the result here.
- Observation: the planning session's permission mode denied every mutating
  `git` operation (`git add`, `git commit`, `git checkout --`) and every
  non-`git` build command (`bunx`, `make`, `markdownlint-cli2`). The worktree's
  git directory is `/data/leynos/Projects/odw-lint/.git/worktrees/roadmap-3-1-8`,
  outside the sandbox-writable worktree, so committing needs a sandbox override
  that the session also declined.
  Evidence: `git add docs/execplans/roadmap-3-1-8.md` returned "This command
  requires approval" both with and without the sandbox override; `git checkout`
  was additionally blocked by the Safety Net hook.
  Impact: the planning agent could not self-commit, so ExecPlan durability is
  carried by the workflow host's plan-salvage path, which commits the ExecPlan
  when it is the sole uncommitted path in the worktree. Round 1 left
  `docs/contents.md` dirty as well, so salvage declined. This revision folds the
  `docs/contents.md` index entry into WI-2 and reverts that file in the worktree
  (via the editor, not `git checkout`), leaving `docs/execplans/roadmap-3-1-8.md`
  as the only uncommitted path so salvage can commit it. The implementer runs
  under a permissive mode and commits each work item directly.
- Observation: the first WI-1 gate run exposed a repository freshness dependency
  that was planned for WI-2 but blocks `make test`: `docs/contents.md` must list
  every current top-level ExecPlan, including this one. The same gate run also
  reported an Oxlint `complex-conditional` finding in the new alias initializer
  predicate.
  Evidence: scrutineer reported `tests/build-gate/documentation-contents.test.ts`
  missing `execplans/roadmap-3-1-8.md`, and
  `src/static-analysis/workflow-odw-only-validate.ts` failing
  `df12(complex-conditional)`.
  Impact: WI-1 moved only the `docs/contents.md` index line forward from WI-2 so
  mandatory gates can pass before the first work-item commit. The substantive
  rule-page and developers-guide wording remain in WI-2. The conditional was
  split into a named predicate, preserving the planned scanner scope.

## Decision log

- Decision: widen the scanner to detect single-hop `validate` aliases
  (`const v = validate; v(source)`), and keep member, computed, `globalThis`,
  and chained-alias forms intentionally undetected.
  Rationale: the injected `validate` primitive is a bare in-scope binding
  ([technical-design.md](../technical-design.md) §§3-5), so a single-hop alias of
  the free `validate` identifier provably references it, whereas an object member
  or computed access provably does not (matching those would be a false
  positive). This mirrors the deterministic-time rules' 3.1.4-3.1.6 widening to
  lexical aliases and satisfies the roadmap's "extend … where the primitive
  identity can be proven" while documenting the remaining bounds.
  Date/Author: 2026-07-06, planning agent.
- Decision: bound alias detection to single-hop direct declarations; do not chase
  chained aliases.
  Rationale: chained inference needs scope-sensitive invalidation to stay
  false-positive-free, and the deterministic-time alias model already draws this
  bound deliberately
  ([workflow-deterministic-time-aliases.ts](../../src/static-analysis/workflow-deterministic-time-aliases.ts)
  `rootAliasView`). Consistency keeps one alias mental model across the
  Claude-compatibility rules.
  Date/Author: 2026-07-06, planning agent.
- Decision: keep the alias view inside
  [workflow-odw-only-validate.ts](../../src/static-analysis/workflow-odw-only-validate.ts)
  rather than adding a new module.
  Rationale: the validate alias set is a single-kind `ReadonlySet<string>` and is
  much smaller than the deterministic-time alias module; keeping it in-file avoids
  a `architecture-fixtures.ts` module-manifest edit and keeps the change atomic.
  Tolerance 5 gates a split if the file approaches the size guard.
  Date/Author: 2026-07-06, planning agent.
- Decision: make no catalogue, pipeline, or strict-Claude change.
  Rationale: 3.1.7 already shipped the message, the merged-pipeline wiring, the
  strict-Claude non-promotion, and the released-rule emitter invariant. Alias
  calls reuse the same catalogue message (generic about the primitive), so
  nothing downstream changes.
  Date/Author: 2026-07-06, planning agent.
- Decision: include the `docs/contents.md` ExecPlan index entry in the WI-1
  commit, ahead of the remaining WI-2 documentation reconciliation.
  Rationale: the repository's documentation contents freshness test is part of
  `make test` and rejects an unindexed `docs/execplans/roadmap-3-1-8.md`. Moving
  this single index line forward is the narrowest way to satisfy the mandatory
  commit gate without changing the rule-page or developers-guide behaviour
  documentation assigned to WI-2.
  Date/Author: 2026-07-06, implementation agent.

## Outcomes & retrospective

The task shipped the planned conservative widening. `odw/no-odw-only-validate`
still reports bare, lexically unshadowed `validate(source)` calls and now also
reports direct single-hop aliases whose initializer is the unshadowed injected
primitive. The rule remains informational, catalogue-derived, and unpromoted by
strict Claude mode.

The documented bounds match the implemented tests: member calls, computed
callees, `globalThis.validate(source)`, aliases shadowed at the call site, and
chained aliases remain intentionally undetected. No catalogue, strict-Claude,
CLI, configuration, or public API surface changed. The deterministic-time alias
precedent was useful for the scope-shadowing algorithm, but the validate rule
needed only a smaller private `ReadonlySet<string>` alias view inside the
existing scanner module.

## Context and orientation

You are working in the git worktree at
`/data/leynos/Projects/odw-lint.worktrees/roadmap-3-1-8` on branch
`roadmap-3-1-8`. The project is a TypeScript library run with Bun. The full
commit gate is `make all`
(`build check-fmt whitespace-hygiene lint typecheck test`, from the
[Makefile](../../Makefile)). Markdown gates are `make markdownlint` and
`make nixie`. AGENTS.md is authoritative for the gate set: run `make all` for
every commit, and additionally `make markdownlint` and `make nixie` for the
documentation commit (WI-2).

Terms of art:

- *Injected primitive*: a function ODW's loader supplies to a workflow body at
  load time (for example `validate`, `agent`, `parallel`). It is a bare in-scope
  binding inside the wrapped async workflow function — not a language global and
  not a member of any object.
- *Normalized body*: the workflow body after ODW normalization, parsed to an SWC
  module; scanners translate spans back to the original file with
  `originalSpanFromNormalizedOffsets`.
- *Lexically unshadowed*: no binding of the same name is visible at the use site
  in the scope-precise binding facts (`isIdentifierBound` returns false).
- *Single-hop alias*: a direct `const name = validate` declaration whose
  initializer is the free `validate` identifier; the alias `name` then denotes
  the primitive at call sites where `name` is unshadowed.

Key files for this task, by full repository-relative path:

- [src/static-analysis/workflow-odw-only-validate.ts](../../src/static-analysis/workflow-odw-only-validate.ts):
  the scanner to widen. Today it walks the AST with `traverseAstSubtree`,
  threading only `LexicalBindingFacts`, and matches a `CallExpression` whose
  callee is a bare `Identifier` named `validate` with
  `isIdentifierBound(bindings, "validate") === false`. 123 lines.
- [src/static-analysis/workflow-deterministic-time.ts](../../src/static-analysis/workflow-deterministic-time.ts):
  the reference emitter that already threads a `{ bindings, aliases }` context
  through `traverseAstSubtree`, entering paired binding and alias scopes per node
  via `enterScopeWithOwnFacts` and `enterAliasScopeWithOwnFacts`. Copy this
  threading shape.
- [src/static-analysis/workflow-deterministic-time-aliases.ts](../../src/static-analysis/workflow-deterministic-time-aliases.ts):
  the alias-view precedent. `rootAliasView`, `enterAliasScopeWithOwnFacts`, and
  the private `aliasViewForOwnFacts` show the "delete `ownNames`, then add owned
  aliases from `ownInitializers`" shadowing algorithm to mirror for a
  `ReadonlySet<string>` of validate aliases.
- [src/static-analysis/workflow-ast-scopes.ts](../../src/static-analysis/workflow-ast-scopes.ts)
  and
  [src/static-analysis/workflow-ast-scope-own-facts.ts](../../src/static-analysis/workflow-ast-scope-own-facts.ts):
  `rootScopeView`, `enterScopeWithOwnFacts`, `scopeOwnFacts`,
  `rootScopeOwnFacts`. `ScopeOwnFacts` exposes `ownNames: readonly string[]` and
  `ownInitializers: readonly { name: string; init: Expression }[]` — the raw
  material for the alias view.
- [src/static-analysis/workflow-ast-bindings.ts](../../src/static-analysis/workflow-ast-bindings.ts):
  `isIdentifierBound(bindings, name)` and the `LexicalBindingFacts` type.
- [src/static-analysis/swc-ast.ts](../../src/static-analysis/swc-ast.ts):
  `isIdentifier`, `isMemberExpression`, `traverseAstSubtree<Context>(root,
  context, visit)`.
- [tests/static-analysis/workflow-odw-only-validate.test.ts](../../tests/static-analysis/workflow-odw-only-validate.test.ts):
  the focused scanner test (152 lines). It builds envelopes with
  `createOriginalSourceFile` + `scanWorkflowEnvelope`, asserts spans with
  `decodeSpanText`/`expectSpanToMatchSource` from `./source-span-oracle`, and
  runs a `fast-check` property with `SOURCE_SPAN_PROPERTY_RUNNER`. The shared
  `expectValidateDiagnostic` helper currently asserts `spanText === "validate"`;
  alias assertions need a variant that accepts the expected callee text.
- [tests/static-analysis/workflow-lint.test.ts](../../tests/static-analysis/workflow-lint.test.ts)
  and
  [tests/static-analysis/workflow-lint-strict-claude.test.ts](../../tests/static-analysis/workflow-lint-strict-claude.test.ts):
  the merged-pipeline and strict-Claude coverage, already exercising a bare
  `validate` call.
- [docs/rules/no-odw-only-validate.md](../rules/no-odw-only-validate.md): the
  rule page with the "Limitations" subsection to update.
- [docs/developers-guide.md](../developers-guide.md): the Claude-compatibility
  pipeline narrative (validate scanner mentioned near lines 188-197).
- [docs/rules/no-date-now.md](../rules/no-date-now.md): the limitation-section
  wording style to match for conservative bounds.

## Plan of work

Two ordered, independently committable work items. Follow Red-Green-Refactor:
write the failing test first, run it to see the expected failure, make the
minimal change to pass, then run `make all`.

### WI-1: Widen the ODW-only validate scanner to single-hop aliases with tests

Docs to read:
[workflow-deterministic-time.ts](../../src/static-analysis/workflow-deterministic-time.ts)
(context-threading template),
[workflow-deterministic-time-aliases.ts](../../src/static-analysis/workflow-deterministic-time-aliases.ts)
(alias-view shadowing algorithm),
[workflow-ast-scope-own-facts.ts](../../src/static-analysis/workflow-ast-scope-own-facts.ts)
(`ScopeOwnFacts` shape),
[workflow-ast-bindings.ts](../../src/static-analysis/workflow-ast-bindings.ts)
(`isIdentifierBound`),
[adr/0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md),
[adr/0002-workflow-body-parser-dialect-scope.md](../adr/0002-workflow-body-parser-dialect-scope.md),
[technical-design.md](../technical-design.md) §§4 and 9.2. Skills/tools:
`execplans`, `leta` (symbol navigation and references), `arch-crate-design`
(module-boundary judgement for Tolerance 5), `biomejs` (TypeScript conventions),
`en-gb-oxendict`. This project has no Python, so `hypothesis`/`crosshair`/`mutmut`
do not apply; use `fast-check` property testing as the existing scanner test
does.

Change, in
[src/static-analysis/workflow-odw-only-validate.ts](../../src/static-analysis/workflow-odw-only-validate.ts):

1. Introduce a scanner context `type ValidateScanContext = { readonly bindings:
   LexicalBindingFacts; readonly aliases: ReadonlySet<string> }` and thread it
   through `traverseAstSubtree` in place of the bare `LexicalBindingFacts`,
   mirroring `DeterministicTimeContext` and `enterDeterministicTimeScope` in
   [workflow-deterministic-time.ts](../../src/static-analysis/workflow-deterministic-time.ts).
2. Build the root alias set from `rootScopeOwnFacts(module)` and enter child
   alias scopes from `scopeOwnFacts(node)`. The alias view for one scope copies
   the inherited set, deletes every name in `facts.ownNames` (shadowing), then
   adds each `initializer.name` whose `initializer.init` is a bare `Identifier`
   with `value === "validate"` and `isIdentifierBound(childBindings, "validate")
   === false`. This is the free-identifier analogue of `aliasViewForOwnFacts`.
3. Extend `matchOdwOnlyValidateCall` so a `CallExpression` whose callee is a bare
   `Identifier` matches when either the name is `"validate"` and
   `isIdentifierBound(bindings, "validate") === false` (the unchanged 3.1.7
   branch, reporting `node.callee.span`) **or** the name is present in the alias
   set (the new branch, also reporting `node.callee.span`, which covers the alias
   identifier). Member and computed callees still fail `isIdentifier(node.callee)`
   and never match.
4. Keep `diagnosticForMatch` and the catalogue-derived message and severity
   exactly as they are (Constraint 3).

Keep the file well under 400 lines (Tolerance 5). Factor small single-purpose
helpers (`rootValidateAliasView`, `enterValidateAliasScope`, and a private
`validateAliasesForOwnFacts`) so functions stay focused (AGENTS.md "Small,
meaningful functions").

Tests (Red first): extend
[tests/static-analysis/workflow-odw-only-validate.test.ts](../../tests/static-analysis/workflow-odw-only-validate.test.ts).
Add a `spanText`-parameterised assertion helper (generalise
`expectValidateDiagnostic` to accept the expected callee text, defaulting to
`"validate"`), then cover at minimum:

- Positive alias (red oracle): `const v = validate;\nconst out = v(args.source);`
  yields one diagnostic with `severity === "info"`, the reviewed message, and a
  span covering `v`. This fails before the widening (no diagnostic) and passes
  after.
- Multiple alias calls: `const v = validate;\nv(args.a);\nv(args.b);` yields two
  diagnostics in source order.
- Alias plus bare call: `const v = validate;\nv(args.a);\nvalidate(args.b);`
  yields two diagnostics whose spans are `v` then `validate`.
- Shadowed initializer (intentional non-detection): `const validate =
  makeValidator();\nconst v = validate;\nv(args.source);` yields no diagnostic
  (the aliased `validate` is a body-local shadow, not the primitive).
- Call-site alias shadow: `const v = validate;\nif (args.local) {\n  const v
  = other;\n  v(args.source);\n}` yields no diagnostic inside the block; the same
  alias used after the block still yields one.
- Chained alias (documented bound): `const v = validate;\nconst w =
  v;\nw(args.source);` yields no diagnostic (single-hop only).
- Member/computed/globalThis exclusions: extend the existing exclusion case with
  `namespace.validate(args.source);`, `registry["validate"](args.source);`, and
  `globalThis.validate(args.source);`, each yielding no diagnostic.
- Regression (unchanged 3.1.7 behaviour): keep the existing bare positive,
  multiple, shadow, sibling-scope, non-call, arity, and unparsable cases green.
- Property test (`fast-check`): for a randomly generated alias name that is a
  valid identifier not colliding with `validate`, `const <name> =
  validate;\n<name>(args.source);` always yields exactly one diagnostic covering
  `<name>`; and the existing "non-validate identifiers never emit" property
  stays green.

Also confirm the merged-pipeline path: extend
[tests/static-analysis/workflow-lint.test.ts](../../tests/static-analysis/workflow-lint.test.ts)
with one case proving an alias call flows through `lintWorkflowSource` into both
`result.claudeCompatibility` and `result.diagnostics` as a single `info` finding
(Constraint 6 / observable success 1).

Validation: `make all`. Acceptance: the new alias tests pass; every existing
`workflow-odw-only-validate`, `workflow-lint`, `workflow-lint-strict-claude`,
`dual-compat-parity`, `odw-example-fixtures`, and snapshot test stays green
(Constraints 4-7 / Tolerance 4). If any existing corpus test changes, stop and
escalate under Tolerance 4.

### WI-2: Reconcile the validate rule page and developers guide to shipped coverage

Docs to read:
[docs/rules/no-odw-only-validate.md](../rules/no-odw-only-validate.md),
[docs/developers-guide.md](../developers-guide.md),
[docs/rules/no-date-now.md](../rules/no-date-now.md) (limitation-section style),
[documentation-style-guide.md](../documentation-style-guide.md). Skills/tools:
`execplans`, `en-gb-oxendict`.

Changes:

1. [docs/rules/no-odw-only-validate.md](../rules/no-odw-only-validate.md):
   rewrite the "Limitations" subsection so it states that detection now covers
   direct calls to a lexically-unshadowed bare `validate` identifier **and**
   single-hop aliases of it (`const v = validate; v(source)`), while member forms
   (`namespace.validate(source)`), computed callees
   (`registry["validate"](source)`), `globalThis.validate(source)`, and chained
   aliases (`const v = validate; const w = v; w(source)`) are intentionally not
   detected because they cannot be proven to reference the injected primitive.
   Optionally add a second failing example showing the alias form now emitting,
   matching the conservative-bounds wording used by the deterministic-time rule
   pages. Keep the present-tense summary and the fixed example unchanged.
2. [docs/developers-guide.md](../developers-guide.md): update the
   Claude-compatibility pipeline narrative (near lines 188-197) so the ODW-only
   `validate(source)` scanner is described as covering bare and single-hop-alias
   callees, keeping the existing sentence that strict-Claude preserves
   `odw/no-odw-only-validate` as informational.
3. [docs/contents.md](../contents.md): add the index entry for this ExecPlan in
   roadmap order, between the 3.1.7 and 3.2.5 entries, matching the surrounding
   two-line link style (for example: "- [Roadmap 3.1.8
   ExecPlan](execplans/roadmap-3-1-8.md) plans assessing and widening ODW-only
   validate callee detection to single-hop aliases."). This index line was
   deferred from the planning commit because the planning session's permission
   mode denied mutating `git` (see "Surprises & discoveries"); land it here so
   the index stays complete.

No change is needed to [docs/rules/index.md](../rules/index.md) (already lists
the rule as `released`) or [technical-design.md](../technical-design.md) §9.2
(the rule-taxonomy row is form-agnostic).

Validation: format only the touched files, then gate:

```plaintext
bunx mdtablefix docs/rules/no-odw-only-validate.md docs/developers-guide.md docs/contents.md
bunx markdownlint-cli2 --fix docs/rules/no-odw-only-validate.md docs/developers-guide.md docs/contents.md
make markdownlint
make nixie
make all
```

Acceptance: `make markdownlint` and `make nixie` pass; the rule page and guide
describe behaviour that the WI-1 tests demonstrate. Do not run repo-global
Markdown formatting (`make fmt` / `mdformat-all`); format only the three edited
files.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-3-1-8`. Confirm the branch
first:

```plaintext
git branch --show-current
# roadmap-3-1-8
```

Re-confirm the clean baseline (Constraint 7) before implementing WI-1:

```plaintext
grep -rn "validate(" tests/static-analysis/fixtures
# expect: no matches
```

For each work item, write the red test, run the focused Bun test to see it fail
for the intended reason, implement, then run the gate:

```plaintext
bun test tests/static-analysis/workflow-odw-only-validate.test.ts
make all
```

For WI-2 also run `make markdownlint` and `make nixie`. Commit each work item
separately with an en-GB imperative subject, for example:

```plaintext
Detect single-hop validate aliases in odw-only-validate scanner
```

## Validation and acceptance

Quality criteria ("done"):

- Tests: `make test` passes. The widened scanner's alias unit and property tests
  pass; the `workflow-lint.test.ts` alias case passes; all existing scanner,
  pipeline, parity, fixture, and snapshot tests stay green with no
  fixture/example/snapshot diagnostic changes.
- Lint/typecheck: `make lint` and `make typecheck` pass (`biome ci` + `oxlint` +
  `tsc --noEmit`).
- Formatting/hygiene: `make check-fmt` and `make whitespace-hygiene` pass.
- File size: the widened scanner and its test each stay under 400 lines.
- Markdown (WI-2): `make markdownlint` and `make nixie` pass.

Quality method: `make all` at each commit (plus `make markdownlint` and
`make nixie` for WI-2). The workflow host independently re-runs the configured
gates against committed HEAD; do not claim gates green unless `make all` (and the
Markdown gates for WI-2) passed at HEAD.

Red-Green-Refactor evidence to record in Progress as work proceeds:

- WI-1 Red: the positive-alias scanner test fails (no diagnostic emitted) before
  the widening. Green: passes after the alias view and match branch land, with
  every prior 3.1.7 case still green.
- WI-2: no code test; the rule page and guide assertions are backed by the WI-1
  alias tests. Markdown gates pass.

Overall acceptance is the five observable-success behaviours in Purpose.

## Idempotence and recovery

Every step is re-runnable. `make all` is deterministic and side-effect-free
beyond `node_modules` install. If WI-1's widening causes an unexpected corpus
diagnostic, revert the alias branch, reconsider the match predicate, and
escalate under Tolerance 4 before retrying. No destructive operations; no data
migration.

## Artifacts and notes

Alias-view shadowing algorithm to mirror (from `aliasViewForOwnFacts` in
[workflow-deterministic-time-aliases.ts](../../src/static-analysis/workflow-deterministic-time-aliases.ts)),
specialised to a `ReadonlySet<string>` of validate aliases:

```typescript
const validateAliasesForOwnFacts = (
  parent: ReadonlySet<string>,
  facts: ScopeOwnFacts,
  bindings: LexicalBindingFacts,
): ReadonlySet<string> => {
  const aliases = new Set(parent);
  for (const name of facts.ownNames) {
    aliases.delete(name);
  }
  for (const initializer of facts.ownInitializers) {
    if (
      isIdentifier(initializer.init) &&
      initializer.init.value === "validate" &&
      !isIdentifierBound(bindings, "validate")
    ) {
      aliases.add(initializer.name);
    }
  }
  return aliases;
};
```

## Interfaces and dependencies

The exported surface is unchanged. `scanOdwOnlyValidateNotes` keeps its
signature:

```typescript
export const scanOdwOnlyValidateNotes: (
  envelope: WorkflowEnvelope,
  parseResult?: NormalizedBodyParseResult,
) => readonly Diagnostic[];
```

New symbols are private to
[workflow-odw-only-validate.ts](../../src/static-analysis/workflow-odw-only-validate.ts):
`ValidateScanContext`, `rootValidateAliasView`, `enterValidateAliasScope`, and
`validateAliasesForOwnFacts`. The module gains imports of `rootScopeOwnFacts`
from [workflow-ast-scopes.ts](../../src/static-analysis/workflow-ast-scopes.ts)
(or [workflow-ast-scope-own-facts.ts](../../src/static-analysis/workflow-ast-scope-own-facts.ts),
whichever re-exports it) and reuses its existing imports of `isIdentifier`,
`traverseAstSubtree`, `isIdentifierBound`, `enterScopeWithOwnFacts`,
`rootScopeView`, `scopeOwnFacts`, `originalSpanFromNormalizedOffsets`,
`parseNormalizedWorkflowBody`, and the catalogue helpers. No new external
dependency (Tolerance 3), no public-API or module-manifest fixture edit
(Constraint 4).

## Addenda

- [ ] 3.1.8.1. Document validate alias reassignment limits.
  - Source: review:3.1.8; severity low.
  - Scope: update `docs/rules/no-odw-only-validate.md` so the limitations
    section states that validate alias visibility is computed for the whole
    current scope and does not model reassignment order or temporal dead zones,
    matching the deterministic-time rule-page limitation wording where the
    scanner semantics align.
  - Success: the ODW-only validate rule page and deterministic-time rule pages
    describe the same whole-scope alias conservatism, and Markdown gates pass.

## Revision note

2026-07-06 initial draft. First planning round for roadmap task 3.1.8. It
records the alias/member/computed false-positive assessment (Decision Log,
grounded in [technical-design.md](../technical-design.md) §§3-5 and the ODW
example fixtures), then decomposes the work into two ordered, independently
gate-passable work items: widen the scanner to single-hop `validate` aliases with
unit, pipeline, and property tests (WI-1), and reconcile the rule page and
developers guide with the shipped coverage (WI-2). Member, computed,
`globalThis`, and chained-alias forms are intentionally undetected and pinned by
negative tests. No remaining ambiguity blocks implementation.

2026-07-06 round 2 revision. Resolves the design reviewer's sole blocking point
(ExecPlan durability). The planning session's permission mode denied every
mutating `git` command, so the ExecPlan is made durable through the workflow
host's plan-salvage path: the worktree is reduced to `roadmap-3-1-8.md` as its
only uncommitted path. The `docs/contents.md` index entry that round 1 left
uncommitted (and which blocked salvage) is reverted in the worktree and folded
into WI-2, and its markdown formatter/gate commands are extended to include
`docs/contents.md` (which WI-2 edits, so the path stays valid). The tooling
limitation and durability strategy are recorded in "Surprises & discoveries".
No work-item scope, constraint, tolerance, or test changed.
