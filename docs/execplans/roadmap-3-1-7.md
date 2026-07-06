# Emit ODW-only validate diagnostics in the lint pipeline

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint` distinguishes ODW runtime validity from Claude Code portability. Its
rule catalogue advertises `odw/no-odw-only-validate` (category
`claude-compatibility`, default severity `info`, release status `released`) for
workflows that call ODW's injected `validate(source)` primitive. ODW injects
`validate` only inside its own loader, so a workflow that calls it is valid
under ODW but does not map to pure Claude Code execution
([technical-design.md](../technical-design.md) §§9.2 and the ODW primitive
inventory row at §4).

The problem this task fixes is a documented catalogue-versus-code
inconsistency. The post-3.1.3 audit
([issues/audit-3.1.3.md](../issues/audit-3.1.3.md), Finding 1) records that
`odw/no-odw-only-validate` is marked `released` yet has no production emitter
and declares no reviewed `messages`: no scanner produces it, its rule page shows
a "Failing example" that produces nothing when linted, and the developers guide
claims strict-Claude mode preserves this informational finding — a behaviour
that can never be observed because the finding is never emitted. Finding 2 of
the same audit records that no invariant test cross-checks the released rules
against the emitter set, which is exactly why the inconsistency passed every
gate.

After this change a novice can lint a workflow that calls the injected
`validate(source)` primitive and observe a real `odw/no-odw-only-validate`
`info` diagnostic flow through the merged `lintWorkflowSource` pipeline; observe
that `strictClaude: true` leaves that finding informational while promoting the
`warning`-level Claude-compatibility rules to `error`; and rely on a new
catalogue invariant test so a `released` rule can never again advertise an
absent emitter.

Observable success (verifiable behaviour):

1. For workflow source whose body contains `const result =
   validate(args.generatedWorkflowSource);`, calling
   `lintWorkflowSource(source).diagnostics` returns a diagnostic with
   `rule === "odw/no-odw-only-validate"`, `severity === "info"`, a `message`
   equal to the reviewed catalogue message, `docs ===
   "docs/rules/no-odw-only-validate.md"`, and a `span` covering the `validate`
   callee identifier. The same diagnostic appears in the `claudeCompatibility`
   sub-view.
2. For a workflow whose body shadows the name (for example `const validate =
   () => ok; validate(source);`), no `odw/no-odw-only-validate` diagnostic is
   produced, mirroring the deterministic-time scanner's shadow suppression.
3. For source combining `validate(source)` with `Date.now()`,
   `lintWorkflowSource(source, { strictClaude: true }).diagnostics` reports the
   `odw/no-date-now` finding as `error` while the `odw/no-odw-only-validate`
   finding stays `info`.
4. `make all` passes, including a new invariant test asserting every
   `RELEASED_RULE_IDS` entry is referenced by a production emitter outside
   `src/diagnostics/rule-catalogue.ts`.

## Scope boundary (what this task does and does not do)

This task delivers the library-layer emitter and pipeline wiring only. Task
3.1.7 requires 3.1.3 and 3.1.6, both library-layer. The executable
`odw-lint check` command (roadmap step 2.4) and the configuration loader
(roadmap step 3.3) remain out of scope: strict-Claude is reached through the
existing `lintWorkflowSource(source, { strictClaude: true })` option, not a
parsed CLI flag. The scanner detects direct calls whose callee is a bare,
lexically-unshadowed `validate` identifier. Alias forms (`const v = validate;
v(source)`), member forms (`schema.validate(x)`), and dynamic/computed callees
are intentionally out of scope for this first emitter and are documented as
limitations, consistent with how the deterministic-time rule pages document
their own conservative bounds. Argument count is not part of the match:
identity of the injected primitive is decided by the unshadowed bare-identifier
callee, not arity.

## Constraints

Hard invariants that must hold throughout implementation.

1. Do not execute or evaluate workflow source. The scanner walks the SWC AST of
   the normalized body and never imports ODW runtime code, consistent with
   [adr/0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md)
   and [technical-design.md](../technical-design.md) §6.4. It reads only the
   parsed body and the inert rule catalogue.
2. The rule catalogue stays the single source of truth for rule identifiers,
   categories, default severities, docs slugs, and reviewed messages
   ([src/diagnostics/rule-catalogue.ts](../../src/diagnostics/rule-catalogue.ts)
   header). The scanner obtains its message via `firstReviewedRuleMessage` and
   its severity via `rule.defaultSeverity`; it must not hard-code a literal
   message string.
3. `odw/no-odw-only-validate` stays `info` and is never promoted by
   strict-Claude. Only `claude-compatibility` diagnostics whose effective
   severity is `warning` are promoted
   ([src/diagnostics/strict-claude.ts](../../src/diagnostics/strict-claude.ts),
   `STRICT_CLAUDE_PROMOTION_POLICY`); the `info` finding must pass through
   unchanged, matching [technical-design.md](../technical-design.md) §9.2 ("The
   `validate(source)` rule should remain informational").
4. Canonical pipeline order is preserved: envelope, then metadata, then body
   syntax, then Claude compatibility
   ([src/static-analysis/workflow-lint.ts](../../src/static-analysis/workflow-lint.ts)).
   The new emitter contributes to the `claudeCompatibility` stage only.
5. Default behaviour of existing rules is unchanged. No existing fixture or
   example may gain or lose a diagnostic. (Verified precondition: no fixture
   under `tests/` currently contains a `validate(` call, so no existing corpus
   is affected — see Surprises & Discoveries.)
6. No source file exceeds 400 lines and Markdown wraps at 80 columns for prose
   and 120 for code blocks (AGENTS.md "Keep file size manageable" and "Markdown
   Guidance").
7. Prose, comments, and commit messages use en-GB Oxford spelling
   ("-ize"/"-yse"/"-our"), per AGENTS.md and
   [documentation-style-guide.md](../documentation-style-guide.md).

## Tolerances (exception triggers)

1. Scope: if any single work item requires changing more than 6 files or more
   than roughly 250 net lines, stop and escalate.
2. Interface: if delivering the emitter requires changing a public signature of
   `lintWorkflowSource`, `createRuleDiagnostic`, or the `RuleDefinition` type,
   stop and escalate.
3. Dependencies: if any new runtime or dev dependency is required, stop and
   escalate.
4. Behaviour drift: if wiring the emitter changes the diagnostics of any
   existing fixture, example, or snapshot, stop and escalate — this indicates a
   false-positive match and the match predicate must be reconsidered before
   proceeding.
5. Iterations: if `make all` still fails after 3 focused attempts on a work
   item, stop and escalate.
6. Ambiguity: if the ODW `validate` primitive's identity turns out to require
   alias or member resolution to satisfy a reviewer, stop and escalate rather
   than widening the match silently.

## Risks

- Risk: the bare-identifier match produces false positives on unrelated
  `validate(...)` helper calls that are not the ODW primitive.
  Severity: medium. Likelihood: low.
  Mitigation: require the callee to be a bare `Identifier` whose name is not
  lexically bound at the use site (`isIdentifierBound` returns false), reusing
  the scope-precise binding facts built for the deterministic-time rules. In an
  ODW workflow body the only free `validate` is the injected primitive
  ([technical-design.md](../technical-design.md) §4). Member calls and shadowed
  locals are excluded by construction and pinned by unit tests.
- Risk: adding a reviewed message to the catalogue breaks the row-exact
  catalogue contract test.
  Severity: low. Likelihood: high (expected).
  Mitigation: WI-1 updates `EXPECTED_RULE_ROWS` in the same commit as the
  catalogue change.
- Risk: the released-rule invariant test (WI-4) is over-strict and fails for a
  legitimately released-but-string-indirect rule.
  Severity: low. Likelihood: low.
  Mitigation: verified precondition — all eleven currently-released rule ids
  already appear as string literals in `src/static-analysis` emitters (see
  Surprises & Discoveries). The invariant carries an explicit, empty,
  rationale-bearing exception list for future computed-id cases.
- Risk: span attribution differs between normalized-body offsets and original
  source, producing a misplaced span.
  Severity: low. Likelihood: low.
  Mitigation: reuse `originalSpanFromNormalizedOffsets` and the module base
  offset exactly as `workflow-deterministic-time.ts` does, and assert
  `spanText === "validate"` with the shared `expectSpanToMatchSource` oracle.

## Progress

- [x] WI-1: Record the reviewed no-odw-only-validate message in the catalogue
- [x] WI-2: Add the ODW-only validate(source) production scanner and tests
- [x] WI-3: Route ODW-only validate notes through lintWorkflowSource
- [x] WI-4: Add a released-rule emitter invariant test
- [x] WI-5: Reconcile the rule page and developers guide

2026-07-06: WI-1 complete. Red evidence:
`bun test tests/diagnostics/rule-catalogue.test.ts --test-name-pattern
"contains the reviewed rule metadata in taxonomy order"` failed after updating
`EXPECTED_RULE_ROWS` because the production catalogue still returned an empty
message array for `odw/no-odw-only-validate`. Green evidence: the same focused
test passed after adding the reviewed message to
`src/diagnostics/rule-catalogue.ts`.

2026-07-06: Gate housekeeping completed for the already-added ExecPlan itself:
`docs/contents.md` now links `execplans/roadmap-3-1-7.md`, because the
documentation contents freshness test rejected the new standalone plan while
running the WI-1 gate.

2026-07-06: WI-2 complete. Red evidence:
`bun test tests/static-analysis/workflow-odw-only-validate.test.ts` failed
before the scanner existed with `Cannot find module
'../../src/static-analysis/workflow-odw-only-validate'`. Green evidence: the
same focused test passed with 8 tests after adding
`scanOdwOnlyValidateNotes`, its public re-exports, and the reviewed export and
module-manifest fixture entries. Additional focused guards passed:
`bun test tests/diagnostics/public-api-surface.test.ts
tests/diagnostics/architecture.test.ts`. Full deterministic gate evidence:
`make check-fmt`, `make typecheck`, `make lint`, `make test`, and `make all`
passed after formatting the six touched TypeScript files.

2026-07-06: WI-3 complete. Red evidence:
`bun test tests/static-analysis/workflow-lint.test.ts` failed in the new
"routes ODW-only validate notes through the merged pipeline" case because
`result.claudeCompatibility` was still empty. `bun test
tests/static-analysis/workflow-lint-strict-claude.test.ts` also failed in the
new strict-Claude pipeline case because `odw/no-odw-only-validate` was absent
from the merged diagnostics. Green evidence: both focused tests passed after
`lintScannedWorkflowBody` appended `scanOdwOnlyValidateNotes(envelope,
bodyParse)` after the deterministic-time warnings. Deterministic gate evidence:
scrutineer reported `make check-fmt`, `make typecheck`, `make lint`,
`make test`, and `make all` passing on the WI-3 code changes.

2026-07-06: WI-4 complete. Red evidence: after adding
`tests/diagnostics/released-rule-emitters.test.ts`, temporarily excluding
`src/static-analysis/workflow-odw-only-validate.ts` from the production source
walk made `bun test tests/diagnostics/released-rule-emitters.test.ts` fail with
`["odw/no-odw-only-validate"]` as the missing released rule. Green evidence:
restoring the source walk made the same focused test pass, and
`bun test tests/diagnostics/released-rule-emitters.test.ts
tests/diagnostics/rule-catalogue.test.ts` passed with 14 tests. Deterministic
gate evidence: scrutineer reported `make check-fmt`, `make typecheck`,
`make lint`, `make test`, `make all`, `make markdownlint`, and `make nixie`
passing after the lint predicate extraction.

2026-07-06: WI-5 complete. Documentation evidence:
`docs/rules/no-odw-only-validate.md` now states the scanner's direct-call
limitations, and `docs/developers-guide.md` now lists the ODW-only
`validate(source)` scanner in the Claude compatibility stage. Formatting and
gate evidence: `bunx mdtablefix docs/rules/no-odw-only-validate.md
docs/developers-guide.md` and `bunx markdownlint-cli2 --fix
docs/rules/no-odw-only-validate.md docs/developers-guide.md` completed
successfully. Scrutineer then reported `make check-fmt`, `make lint`,
`make typecheck`, `make test`, `make markdownlint`, `make nixie`, and
`make all` passing.

## Surprises & discoveries

- Observation: no test fixture or example currently contains a `validate(`
  call.
  Evidence: `grep -rn "validate" src docs tests` returns only prose, the
  catalogue entry, three `.ts` test files
  (`tests/diagnostics/strict-claude.test.ts`,
  `tests/diagnostics/rule-catalogue.test.ts`), and the schema snapshot; no
  fixture `.js` under `tests/static-analysis/fixtures/` matches.
  Impact: wiring the emitter cannot change any existing fixture, example, or
  snapshot, so Constraint 5 and Tolerance 4 hold on a clean baseline.
- Observation: all eleven currently-released rule ids already appear as string
  literals inside `src/static-analysis` emitters.
  Evidence: `grep -rho '<each released id>' src/static-analysis` counts each id
  at least once (`odw/body-syntax` twice, the rest once).
  Impact: the WI-4 invariant is green the moment the new scanner adds the
  twelfth released reference, and its exception list is empty.
- Observation: `strict-claude.test.ts` already unit-tests transform-level
  non-promotion of `odw/no-odw-only-validate` via a synthetic diagnostic.
  Evidence: `tests/diagnostics/strict-claude.test.ts:77-79`.
  Impact: WI-3 adds the missing *pipeline-level* non-promotion coverage (a real
  emitted `info` finding surviving `strictClaude: true`) rather than duplicating
  the transform-level case.
- Observation: the committed ExecPlan was missing from the documentation
  contents index when WI-1 gate execution first ran.
  Evidence: `make all` and `make test` failed in
  `tests/build-gate/documentation-contents.test.ts` with
  `execplans/roadmap-3-1-7.md` listed as an unlinked standalone documentation
  file.
  Impact: WI-1 includes a narrow `docs/contents.md` index update so the
  repository gate can pass without changing the work item's behavioural scope.
- Observation: Biome's import/export organiser sorts
  `workflow-odw-only-validate` after `workflow-metadata`, even though the
  implementation plan asked to place it immediately beside
  `workflow-deterministic-time`.
  Evidence: `make check-fmt` rejected the adjacent placement in
  `src/static-analysis/index.ts`; `bunx @biomejs/biome check --write
  src/static-analysis/index.ts` moved the export to the formatter-approved
  order.
  Impact: the public barrel still re-exports `scanOdwOnlyValidateNotes`, and
  the only deviation from the planned edit shape is formatter-mandated export
  ordering.
- Observation: adding the invariant to `rule-catalogue.test.ts` would push that
  file over the 400-line project limit.
  Evidence: `wc -l tests/diagnostics/rule-catalogue.test.ts` reported 417 lines
  during the first implementation attempt.
  Impact: WI-4 uses the plan's dedicated
  `tests/diagnostics/released-rule-emitters.test.ts` option instead, keeping the
  existing catalogue contract file at 369 lines and the new invariant test at
  56 lines.

## Decision log

- Decision: match a call whose callee is a bare, lexically-unshadowed
  `Identifier` named `validate`, regardless of argument count, and exclude
  member/computed/alias callees.
  Rationale: this is the smallest predicate that uniquely identifies the ODW
  injected primitive in a workflow body ([technical-design.md](../technical-design.md)
  §4) while reusing the scope-precise binding facts from 3.1.5/3.1.6. Arity is
  not part of primitive identity, and widening to aliases/members would exceed
  the informational rule's purpose and Tolerance 6.
  Date/Author: 2026-07-06, planning agent.
- Decision: resolve Finding 1 by implementing the emitter (keeping the rule
  `released`) rather than the audit's alternative of reclassifying it to
  `planned`.
  Rationale: roadmap task 3.1.7 explicitly directs a production scanner and
  "the released rule catalogue no longer advertises an unemitted rule"; the
  emitter path is the requirement.
  Date/Author: 2026-07-06, planning agent.
- Decision: include the released-rule emitter invariant test (audit Finding 2)
  in this task as WI-4.
  Rationale: the roadmap success criterion is that the catalogue no longer
  advertises an unemitted rule; the invariant is the regression guard that makes
  that property durable, and it is the direct dependant the audit named.
  Date/Author: 2026-07-06, planning agent.
- Decision: reuse inline source strings for the scanner and pipeline tests
  rather than extending the `dual-compat` fixture manifest.
  Rationale: `odw/no-odw-only-validate` is odw-lint-specific and is not part of
  ODW's `scanDualCompat`, so it does not belong in the loader-parity corpus
  (`tests/static-analysis/dual-compat-parity.test.ts` compares against ODW
  behaviour). Inline sources through `lintWorkflowSource` satisfy the
  "merged pipeline" success criterion without the sha256/anchored-span refresh
  machinery. This mirrors `workflow-lint-strict-claude.test.ts`.
  Date/Author: 2026-07-06, planning agent.
- Decision: append `scanOdwOnlyValidateNotes` after deterministic-time warnings
  in the Claude-compatibility stage while reusing the same `bodyParse`.
  Rationale: the ordering preserves the established deterministic-time-first
  stream and avoids a second parse of the normalized workflow body.
  Date/Author: 2026-07-06, WI-3 implementation agent.
- Decision: put the released-rule invariant in
  `tests/diagnostics/released-rule-emitters.test.ts` instead of extending
  `tests/diagnostics/rule-catalogue.test.ts`.
  Rationale: the dedicated file was an explicitly allowed WI-4 option and keeps
  the existing catalogue contract file below the AGENTS.md 400-line limit while
  preserving the same invariant.
  Date/Author: 2026-07-06, WI-4 implementation agent.

## Outcomes & retrospective

Roadmap task 3.1.7 is complete. The released
`odw/no-odw-only-validate` catalogue entry now has a reviewed message, a
production scanner, merged-pipeline coverage, strict-Claude non-promotion
coverage, and a released-rule emitter invariant. The rule page and developers
guide now describe the implemented behaviour and its conservative detection
limits.

The main lesson from this task is that catalogue release status needs an
executable invariant, not just documentation review. The dedicated
released-rule emitter test now makes future catalogue-versus-emitter drift
visible during `make all`.

## Context and orientation

You are working in the git worktree at
`/data/leynos/Projects/odw-lint.worktrees/roadmap-3-1-7` on branch
`roadmap-3-1-7`. The project is a TypeScript library run with Bun; the full
commit gate is `make all`
(`build check-fmt whitespace-hygiene lint typecheck test`, from the
[Makefile](../../Makefile)). Markdown gates are `make markdownlint` and
`make nixie`.

Key files for this task, by full repository-relative path:

- [src/diagnostics/rule-catalogue.ts](../../src/diagnostics/rule-catalogue.ts):
  the inert catalogue. The `odw/no-odw-only-validate` entry
  (`ruleDefinition({ id: "odw/no-odw-only-validate", category:
  "claude-compatibility", defaultSeverity: "info", releaseStatus: "released" })`)
  currently declares no `messages`. `firstReviewedRuleMessage`,
  `ruleDefinitionFor`, `RELEASED_RULE_IDS`, and `findRuleDefinition` are
  exported here.
- [src/diagnostics/rule-diagnostic.ts](../../src/diagnostics/rule-diagnostic.ts):
  `createRuleDiagnostic({ file, rule, severity, message, span })` builds a
  frozen diagnostic and derives `docs` from the rule.
- [src/static-analysis/workflow-deterministic-time.ts](../../src/static-analysis/workflow-deterministic-time.ts):
  the reference emitter. It parses the normalized body, walks the SWC AST with
  `traverseAstSubtree`, enters lexical scopes with `rootScopeView` /
  `enterScopeWithOwnFacts` / `scopeOwnFacts`, collects `{ rule, span }` matches,
  and maps each to a diagnostic via `originalSpanFromNormalizedOffsets` and
  `firstReviewedRuleMessage`. Copy this shape.
- [src/static-analysis/workflow-global-object-reference.ts](../../src/static-analysis/workflow-global-object-reference.ts):
  shows `isIdentifierBound(bindings, name)` used to treat a bare identifier as a
  free global only when it is not lexically shadowed. The new scanner uses the
  same helper for `validate`.
- [src/static-analysis/swc-ast.ts](../../src/static-analysis/swc-ast.ts):
  `isIdentifier`, `isMemberExpression`, and `traverseAstSubtree<Context>(root,
  context, visit)`.
- [src/static-analysis/workflow-lint.ts](../../src/static-analysis/workflow-lint.ts):
  `lintWorkflowSource`. Its private `lintScannedWorkflowBody` builds
  `claudeCompatibility` from `scanDeterministicTimeWarnings(envelope, bodyParse)`
  over a single shared `parseNormalizedWorkflowBody(envelope)` result.
- [src/static-analysis/index.ts](../../src/static-analysis/index.ts): the
  static-analysis barrel. It performs the leaf re-export
  `export { scanDeterministicTimeWarnings } from "./workflow-deterministic-time";`
  (line 47). The new scanner needs a matching leaf re-export here.
- [src/index.ts](../../src/index.ts): re-exports the public surface. It pulls
  `scanDeterministicTimeWarnings` (line 94) out of the `} from "./static-analysis"`
  re-export block (which ends at line 112) and also re-exports `isIdentifierBound`.
  It has **no** top-level declarations of its own — `architecture.test.ts:320`
  asserts `topLevelDeclarationNames(parseSource("src/index.ts"))` equals `[]`, so
  only re-export lines may be added.
- [tests/diagnostics/public-api-fixtures.ts](../../tests/diagnostics/public-api-fixtures.ts):
  `EXPECTED_PUBLIC_PACKAGE_EXPORTS`, the sorted reviewed list of named package
  exports (`scanDeterministicTimeWarnings` at line 97, `scanWorkflowEnvelope` at
  line 98). `public-api-surface.test.ts` (the "matches the reviewed named export
  list" case, lines 172-181) asserts the package's named exports EXACTLY equal
  this list.
- [tests/diagnostics/architecture-fixtures.ts](../../tests/diagnostics/architecture-fixtures.ts):
  `EXPECTED_STATIC_ANALYSIS_MODULE_FILES`, the sorted manifest of files under
  `src/static-analysis/` (lines 41-91). `architecture.test.ts:315` asserts
  `sourceModuleFiles("src/static-analysis")` EQUALS this manifest.
- [docs/rules/no-odw-only-validate.md](../rules/no-odw-only-validate.md): the
  rule page with a failing and a fixed example.
- [docs/developers-guide.md](../developers-guide.md): the pipeline and
  strict-Claude narrative (validate mention near line 182).

Terms of art:

- *Injected primitive*: a function ODW's loader supplies to a workflow at load
  time (for example `validate`, `agent`, `parallel`). Not a language global; not
  present in pure Claude Code execution.
- *Normalized body*: the workflow body after ODW normalization, parsed to an SWC
  module; scanners work over this and translate spans back to the original file
  with `originalSpanFromNormalizedOffsets`.
- *Lexically unshadowed*: no binding of the same name is visible at the use site
  in the scope-precise binding facts; `isIdentifierBound` returns false.

## Plan of work

Each work item is an independently committable, gate-passable change. Follow
Red-Green-Refactor: write the failing test first, run it to see the expected
failure, make the minimal change to pass, then run `make all`.

### WI-1: Record the reviewed diagnostic message in the catalogue

Docs to read: [src/diagnostics/rule-catalogue.ts](../../src/diagnostics/rule-catalogue.ts)
header and the `RULE_CATALOGUE` block;
[technical-design.md](../technical-design.md) §9.2;
[issues/audit-3.1.3.md](../issues/audit-3.1.3.md) Finding 1. Skills/tools:
`execplans`, `leta` (symbol navigation), `biomejs` (TypeScript conventions),
`en-gb-oxendict`.

Change: in `RULE_CATALOGUE`, give the `odw/no-odw-only-validate` entry a single
reviewed message. The message is one catalogue line (do not wrap it in code):
"Workflow calls ODW-only validate(source), which Claude Code cannot run because
the validate primitive is injected only by the ODW loader."

Keep `category: "claude-compatibility"`, `defaultSeverity: "info"`,
`releaseStatus: "released"`.

Tests (Red first): update
[tests/diagnostics/rule-catalogue.test.ts](../../tests/diagnostics/rule-catalogue.test.ts)
`EXPECTED_RULE_ROWS` — replace the empty `[]` messages array of the
`odw/no-odw-only-validate` row (currently lines 134-141) with the reviewed
message. The row-exact test "contains the reviewed rule metadata in taxonomy
order" is the red/green oracle: it fails before the catalogue edit and passes
after. Do not add the rule to `RULE_IDS_WITH_INVALID_FIXTURE_DIAGNOSTICS` (that
whitelist is scoped to dialect rules with invalid-workflow fixtures).

Design references: AGENTS.md "Documentation Maintenance" (catalogue is source of
truth); [technical-design.md](../technical-design.md) §9.2.

Validation: `make all`. Acceptance: the catalogue contract test passes with the
new message; `firstReviewedRuleMessage(ruleDefinitionFor(makeRuleId("odw/no-odw-only-validate")))`
now returns the reviewed message (relied on by WI-2).

### WI-2: Add the ODW-only `validate(source)` production scanner and tests

Docs to read: [src/static-analysis/workflow-deterministic-time.ts](../../src/static-analysis/workflow-deterministic-time.ts)
(emitter template), [src/static-analysis/workflow-global-object-reference.ts](../../src/static-analysis/workflow-global-object-reference.ts)
(shadow check), [src/static-analysis/swc-ast.ts](../../src/static-analysis/swc-ast.ts),
[adr/0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md),
[adr/0002-*](../adr/) if present for the ECMAScript parser dialect note.
Also read the two public-surface guards whose fixtures this work item edits:
[tests/diagnostics/public-api-surface.test.ts](../../tests/diagnostics/public-api-surface.test.ts)
(lines 172-181) with its fixture
[tests/diagnostics/public-api-fixtures.ts](../../tests/diagnostics/public-api-fixtures.ts),
and [tests/diagnostics/architecture.test.ts](../../tests/diagnostics/architecture.test.ts)
(line 315, plus the `src/index.ts` no-declarations assertion at line 320) with its
fixture
[tests/diagnostics/architecture-fixtures.ts](../../tests/diagnostics/architecture-fixtures.ts).
Skills/tools: `execplans`, `leta`, `arch-crate-design` (module boundary),
`biomejs`, `hypothesis`/`crosshair` are Python-only so not applicable — use
`fast-check` property testing as the existing deterministic-time tests do.

Create `src/static-analysis/workflow-odw-only-validate.ts` exporting:

```typescript
export const scanOdwOnlyValidateNotes = (
  envelope: WorkflowEnvelope,
  parseResult?: NormalizedBodyParseResult,
): readonly Diagnostic[];
```

Behaviour, mirroring `scanDeterministicTimeWarnings`:

1. Default `parseResult` to `parseNormalizedWorkflowBody(envelope)`; return a
   frozen empty list when `!parseResult.ok`.
2. Build `rootScopeView(parseResult.module)`; walk with `traverseAstSubtree`,
   entering scopes via `enterScopeWithOwnFacts(bindings, scopeOwnFacts(node))`
   at each node (bindings only — no alias context).
3. Match a node when it is a `CallExpression` whose `callee` is a bare
   `Identifier` with `value === "validate"` and `isIdentifierBound(bindings,
   "validate") === false`. Record `{ span: node.callee.span }`. Exclude member
   and computed callees by construction (only `isIdentifier(callee)` matches).
4. Map each match to a diagnostic with `createRuleDiagnostic`, using the
   catalogued rule (`ruleDefinitionFor(makeRuleId("odw/no-odw-only-validate"))`,
   preloaded once at module scope like `RULE_DEFINITIONS`), `severity:
   rule.defaultSeverity`, `message: firstReviewedRuleMessage(rule)`, and `span:
   originalSpanFromNormalizedOffsets(envelope.sourceFile, parseResult.normalized,
   span.start - moduleBase, span.end - moduleBase)` where `moduleBase =
   parseResult.module.span.start`.

Keep the file well under 400 lines; factor a small `matchOdwOnlyValidateCall`
predicate and a `diagnosticForMatch` builder to keep functions single-purpose
(AGENTS.md "Small, meaningful functions").

Publish `scanOdwOnlyValidateNotes` on the public surface via the barrel, exactly
as `scanDeterministicTimeWarnings` is published, and update the two fixtures the
export-surface and module-manifest guards pin. This work item therefore touches
**six** files (right at the Tolerance 1 limit; do not exceed it): the new scanner,
the new scanner test, the barrel, the root re-export, and two test fixtures. All
six are committed together so `make all` stays green at HEAD.

WI-2 sub-steps (all in one commit):

1. Create `src/static-analysis/workflow-odw-only-validate.ts` (the scanner above).
2. Create `tests/static-analysis/workflow-odw-only-validate.test.ts` (tests below).
3. **Barrel re-export.** Add
   `export { scanOdwOnlyValidateNotes } from "./workflow-odw-only-validate";`
   to [src/static-analysis/index.ts](../../src/static-analysis/index.ts),
   immediately alongside the existing
   `export { scanDeterministicTimeWarnings } from "./workflow-deterministic-time";`
   (line 47).
4. **Root re-export.** Add `scanOdwOnlyValidateNotes` to the
   `} from "./static-analysis"` re-export block in
   [src/index.ts](../../src/index.ts), inserting it (sorted) between
   `scanDeterministicTimeWarnings` (line 94) and `scanWorkflowEnvelope` (line 95).
   Add only the re-export name — no top-level declaration — so
   `architecture.test.ts:320` (`topLevelDeclarationNames(src/index.ts) === []`)
   still holds.
5. **Export-surface fixture.** Insert `"scanOdwOnlyValidateNotes"` into
   `EXPECTED_PUBLIC_PACKAGE_EXPORTS` in
   [tests/diagnostics/public-api-fixtures.ts](../../tests/diagnostics/public-api-fixtures.ts),
   sorted between `"scanDeterministicTimeWarnings"` (line 97) and
   `"scanWorkflowEnvelope"` (line 98). Without this,
   `public-api-surface.test.ts` "matches the reviewed named export list"
   (lines 172-181) fails because the actual named exports would no longer equal
   the fixture.
6. **Module-manifest fixture.** Insert `"workflow-odw-only-validate.ts"` into
   `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` in
   [tests/diagnostics/architecture-fixtures.ts](../../tests/diagnostics/architecture-fixtures.ts),
   sorted between `"workflow-metadata.ts"` (line 89) and
   `"workflow-suppression-mask.ts"` (line 90). Without this,
   `architecture.test.ts:315` (`sourceModuleFiles("src/static-analysis")` equals
   the manifest) fails because the new module file is unlisted.

Tests (Red first): create
`tests/static-analysis/workflow-odw-only-validate.test.ts`, importing the
scanner from `../../src/static-analysis/workflow-odw-only-validate` and building
envelopes with `scanWorkflowEnvelope(createOriginalSourceFile(...))` exactly as
`workflow-deterministic-time.test.ts` does. Cover, at minimum:

- Positive: body `const result = validate(args.source);` yields one diagnostic
  with `rule === "odw/no-odw-only-validate"`, `severity === "info"`, message
  equal to `firstReviewedRuleMessage(rule)`, and `spanText === "validate"`
  (assert with `expectSpanToMatchSource` / `decodeSpanText` from
  `./source-span-oracle`).
- Multiple calls: two `validate(...)` calls yield two diagnostics in source
  order.
- Shadow suppression: `const validate = () => ok; validate(args.source);`
  yields no diagnostic; also a sibling-scope shadow does not suppress a global
  use in an unrelated scope (mirror the deterministic-time scope cases).
- Exclusions: `schema.validate(x)`, `obj["validate"](x)`, and a bare
  `validate` reference that is not a call (for example `const fn = validate;`)
  yield no diagnostic.
- Arity independence: `validate()` (no args) and `validate(a, b)` each yield one
  diagnostic (identity, not arity, drives the match).
- Unparsable body: a body that fails to parse yields an empty list.
- Property test (`fast-check`): for randomly generated identifier names that are
  not exactly `validate` (including `validateFoo`, `myValidate`), the scanner
  never emits, mirroring the deterministic-time property style.

The positive test is the red oracle: it fails (module does not exist / no
emission) before the scanner is written and passes after.

Validation: `make all`. Acceptance: the new scanner test passes; the
export-surface guard (`public-api-surface.test.ts`) and the module manifest guard
(`architecture.test.ts`) pass because sub-steps 5 and 6 updated their fixtures in
the same commit; and no *behavioural* corpus test changes — the emitter is
published on the public surface but not yet wired into `lintWorkflowSource`, so
no fixture, example, or diagnostics snapshot gains or loses a finding
(Constraint 5).

### WI-3: Route ODW-only validate notes through `lintWorkflowSource`

Docs to read: [src/static-analysis/workflow-lint.ts](../../src/static-analysis/workflow-lint.ts),
[docs/developers-guide.md](../developers-guide.md) pipeline section,
[technical-design.md](../technical-design.md) §§9.2 and 7.4,
[src/diagnostics/strict-claude.ts](../../src/diagnostics/strict-claude.ts).
Skills/tools: `execplans`, `leta`, `biomejs`, `en-gb-oxendict`.

Change: in `lintScannedWorkflowBody`
([src/static-analysis/workflow-lint.ts](../../src/static-analysis/workflow-lint.ts)),
extend the `claudeCompatibility` stream to concatenate
`scanOdwOnlyValidateNotes(envelope, bodyParse)` after
`scanDeterministicTimeWarnings(envelope, bodyParse)`, reusing the same shared
`bodyParse`. Preserve canonical order (deterministic-time findings first, then
the validate note) so the merged `diagnostics` order and the `claudeCompatibility`
sub-view stay deterministic. Do not change `lintWorkflowSource`'s public
signature or the strict-Claude transform; the existing
`promoteStrictClaudeSeverity` already leaves `info` findings unchanged
(Constraint 3).

Tests (Red first):

1. Extend [tests/static-analysis/workflow-lint.test.ts](../../tests/static-analysis/workflow-lint.test.ts)
   with a case: source exporting valid `meta` plus a body calling
   `validate(args.source)` produces, in both `result.claudeCompatibility` and
   `result.diagnostics`, exactly one `odw/no-odw-only-validate` `info`
   diagnostic with the reviewed message and a `validate`-covering span, and no
   spurious diagnostics.
2. Extend [tests/static-analysis/workflow-lint-strict-claude.test.ts](../../tests/static-analysis/workflow-lint-strict-claude.test.ts)
   with a pipeline non-promotion case: source combining `validate(args.source)`
   with `Date.now()` under `{ strictClaude: true }` promotes `odw/no-date-now`
   to `error` while `odw/no-odw-only-validate` stays `info` in the merged
   `diagnostics`; and `createDiagnosticReport` counts the `info` finding as
   neither an error nor a warning.

These assertions fail before the wiring (the validate note is absent) and pass
after.

Validation: `make all`. Acceptance: the two extended tests pass; all existing
`workflow-lint*`, `dual-compat-parity`, `odw-example-fixtures`, and snapshot
tests remain green (Constraint 5 / Tolerance 4). If any existing corpus test
changes, stop and escalate.

### WI-4: Add a released-rule emitter invariant test

Docs to read: [issues/audit-3.1.3.md](../issues/audit-3.1.3.md) Finding 2;
[src/diagnostics/rule-catalogue.ts](../../src/diagnostics/rule-catalogue.ts)
(`RELEASED_RULE_IDS`). Skills/tools: `execplans`, `biomejs`, `python-testing`
is not applicable; use `bun:test`.

Change: add a test — either a new `describe` in
[tests/diagnostics/rule-catalogue.test.ts](../../tests/diagnostics/rule-catalogue.test.ts)
or a dedicated `tests/diagnostics/released-rule-emitters.test.ts` — asserting
that every `RELEASED_RULE_IDS` entry appears as a string literal in at least one
production source file under `src/` other than
`src/diagnostics/rule-catalogue.ts`. Implementation: read the tracked `.ts`
files under `src/` with `node:fs`/`node:path` (walk `src/`, skip
`rule-catalogue.ts`), and for each released id assert some file's contents
`.includes(String(id))`. Provide an explicit, documented, and (after this task)
empty exception array `RELEASED_RULES_WITHOUT_EMITTER` for any future rule
deliberately released without a string-literal emitter reference (for example a
computed id), so omissions are a rationale-bearing choice rather than a silent
gap.

Tests (Red first): to prove the invariant has teeth, first assert it with the
new scanner *absent* — i.e. run this test on the WI-1/WI-2 baseline before WI-3
wiring only conceptually; in practice, since WI-2 already adds the emitter
reference, demonstrate the red state by temporarily narrowing the search to
exclude `workflow-odw-only-validate.ts` and observing the failure for
`odw/no-odw-only-validate`, then restore. Record this red evidence in Progress.
The green state: all twelve released ids are referenced; the exception list is
empty.

Validation: `make all`. Acceptance: the invariant test passes; deliberately
removing the `odw/no-odw-only-validate` literal from the scanner (local
experiment, reverted) makes it fail — proving it guards Finding 1.

### WI-5: Reconcile the rule page and developers guide

Docs to read: [docs/rules/no-odw-only-validate.md](../rules/no-odw-only-validate.md),
[docs/developers-guide.md](../developers-guide.md),
[docs/rules/no-date-now.md](../rules/no-date-now.md) (limitation-section style),
[documentation-style-guide.md](../documentation-style-guide.md). Skills/tools:
`execplans`, `en-gb-oxendict`, `changelog` not required.

Changes:

1. [docs/rules/no-odw-only-validate.md](../rules/no-odw-only-validate.md): the
   present-tense "This rule reports calls to ODW-only `validate(source)`" is now
   truthful — keep it, and confirm the "Failing example" body (`const result =
   validate(args.generatedWorkflowSource);`) now genuinely emits the finding.
   Add a short "Limitations" subsection stating that detection covers direct
   calls to a lexically-unshadowed bare `validate` identifier, and that alias
   forms (`const v = validate; v(source)`), member forms
   (`namespace.validate(...)`), and dynamic/computed callees are not detected in
   this release — matching the conservative-bounds wording used by the
   deterministic-time rule pages.
2. [docs/developers-guide.md](../developers-guide.md): update the pipeline
   narrative so the Claude-compatibility stage lists the ODW-only validate
   scanner alongside the deterministic-time scanner, and keep the existing
   sentence that strict-Claude preserves `odw/no-odw-only-validate` (now backed
   by a real emitter and the WI-3 pipeline test).

No change is needed to [docs/rules/index.md](../rules/index.md) (already lists
the rule as `released`) or [technical-design.md](../technical-design.md) §9.2
(already correct).

Validation: format only the touched files, then gate:

```plaintext
bunx mdtablefix docs/rules/no-odw-only-validate.md docs/developers-guide.md
bunx markdownlint-cli2 --fix docs/rules/no-odw-only-validate.md docs/developers-guide.md
make markdownlint
make nixie
make all
```

Acceptance: `make markdownlint` and `make nixie` pass; the rule page and guide
describe behaviour that the WI-2/WI-3 tests demonstrate.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-3-1-7`. Confirm the branch
first:

```plaintext
git branch --show-current
# roadmap-3-1-7
```

For each work item: write the red test, run the focused Bun test to see it fail,
implement, then run the gate. Focused test example:

```plaintext
bun test tests/static-analysis/workflow-odw-only-validate.test.ts
```

Full gate before each commit:

```plaintext
make all
```

For WI-5 also run `make markdownlint` and `make nixie`. Commit each work item
separately with an en-GB imperative subject, for example:

```plaintext
Emit odw/no-odw-only-validate for injected validate calls
```

Do not run repo-global Markdown formatting (`make fmt` / mdformat-all); format
only the two Markdown files WI-5 edits.

## Validation and acceptance

Quality criteria ("done"):

- Tests: `make test` passes. New scanner unit/property test passes; the
  `workflow-lint.test.ts` and `workflow-lint-strict-claude.test.ts` additions
  pass; the WI-4 invariant test passes; `rule-catalogue.test.ts` passes with the
  new message row. No existing fixture/example/snapshot changes.
- Lint/typecheck: `make lint` and `make typecheck` pass (`biome ci` + `oxlint` +
  `tsc --noEmit`).
- Formatting/hygiene: `make check-fmt` and `make whitespace-hygiene` pass.
- Markdown (WI-5): `make markdownlint` and `make nixie` pass.

Quality method: `make all` at each commit (plus `make markdownlint` and
`make nixie` for WI-5). The workflow host independently re-runs the configured
gates against committed HEAD; do not claim gates green unless `make all`
(and the Markdown gates for WI-5) passed at HEAD.

Red-Green-Refactor evidence to record in Progress as work proceeds:

- WI-1 Red: `rule-catalogue.test.ts` "contains the reviewed rule metadata in
  taxonomy order" fails on the empty-messages row before the catalogue edit.
  Green: passes after the message is added to both catalogue and expected rows.
- WI-2 Red: the new scanner positive test fails (no module/emission). Green:
  passes after the scanner is implemented.
- WI-3 Red: the `workflow-lint.test.ts` validate case fails (no validate note in
  `diagnostics`). Green: passes after the pipeline wiring.
- WI-4 Red: narrowing the source scan to exclude the new scanner shows the
  invariant fail for `odw/no-odw-only-validate`. Green: passes with the full
  scan; exception list empty.
- WI-5: no code test; the rule page and guide assertions are backed by the
  WI-2/WI-3 tests. Markdown gates pass.

Overall acceptance is the four observable-success behaviours in Purpose.

## Idempotence and recovery

Every step is re-runnable. `make all` is deterministic and side-effect-free
beyond `node_modules` install. If a work item's gate fails, fix forward within
Tolerance 5 (3 attempts) or escalate. No destructive operations; no data
migration. If wiring in WI-3 causes an unexpected corpus diagnostic, revert the
one-line concatenation, reconsider the WI-2 match predicate, and escalate under
Tolerance 4 before retrying.

## Artifacts and notes

Reviewed diagnostic message (single source of truth in the catalogue), one line:
"Workflow calls ODW-only validate(source), which Claude Code cannot run because
the validate primitive is injected only by the ODW loader."

Emitter shape to copy (abbreviated), from
`src/static-analysis/workflow-deterministic-time.ts`:

```typescript
const rootBindings = rootScopeView(parseResult.module);
const diagnostics = walk(parseResult.module, rootBindings).map((match) =>
  createRuleDiagnostic({
    file: envelope.sourceFile.filePath,
    rule,
    severity: rule.defaultSeverity,
    message: firstReviewedRuleMessage(rule),
    span: originalSpanFromNormalizedOffsets(
      envelope.sourceFile,
      parseResult.normalized,
      match.span.start - moduleBase,
      match.span.end - moduleBase,
    ),
  }),
);
```

## Interfaces and dependencies

New module `src/static-analysis/workflow-odw-only-validate.ts` must export:

```typescript
export const scanOdwOnlyValidateNotes: (
  envelope: WorkflowEnvelope,
  parseResult?: NormalizedBodyParseResult,
) => readonly Diagnostic[];
```

re-exported from the `src/static-analysis` barrel
([src/static-analysis/index.ts](../../src/static-analysis/index.ts)) and thence
from [src/index.ts](../../src/index.ts), matching how
`scanDeterministicTimeWarnings` reaches the public surface. Adding the name to the
public surface obliges two fixture edits in the same commit (WI-2 sub-steps 5-6):
`EXPECTED_PUBLIC_PACKAGE_EXPORTS` in
[tests/diagnostics/public-api-fixtures.ts](../../tests/diagnostics/public-api-fixtures.ts)
and `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` in
[tests/diagnostics/architecture-fixtures.ts](../../tests/diagnostics/architecture-fixtures.ts).
It depends only on existing modules:
`@swc/core` types, `./swc-ast` (`isIdentifier`, `traverseAstSubtree`),
`./workflow-ast-scopes` (`rootScopeView`, `enterScopeWithOwnFacts`,
`scopeOwnFacts`), `./workflow-ast-bindings` (`isIdentifierBound`,
`LexicalBindingFacts`), `./workflow-body-normalizer`
(`originalSpanFromNormalizedOffsets`, `NormalizedWorkflowBody`),
`./workflow-body-parse` (`parseNormalizedWorkflowBody`,
`NormalizedBodyParseResult`), `./types` (`WorkflowEnvelope`),
`../diagnostics/rule-catalogue` (`ruleDefinitionFor`, `firstReviewedRuleMessage`,
`RuleDefinition`), `../diagnostics/rule-diagnostic` (`createRuleDiagnostic`),
`../diagnostics/rule-id` (`makeRuleId`, `RuleId`), and `../diagnostics/types`
(`Diagnostic`). No new external dependency (Tolerance 3).

`lintWorkflowSource` keeps its signature; only the private
`lintScannedWorkflowBody` body changes to append the new scanner's diagnostics
to the `claudeCompatibility` stream.

## Revision note

2026-07-06 initial draft. First planning round for roadmap task 3.1.7. It
decomposes the work into five ordered, independently gate-passable work items:
catalogue message (WI-1), production scanner and tests (WI-2), pipeline wiring
and merged coverage (WI-3), released-rule emitter invariant (WI-4, from
audit-3.1.3 Finding 2), and documentation reconciliation (WI-5). No remaining
ambiguity blocks implementation.

2026-07-06 planning round 2, addressing the design reviewer's three blocking
points, all against WI-2's public-surface handling:

1. Publishing `scanOdwOnlyValidateNotes` breaks the export-surface guard. WI-2
   now includes an explicit sub-step (5) inserting `"scanOdwOnlyValidateNotes"`
   into `EXPECTED_PUBLIC_PACKAGE_EXPORTS`
   (`tests/diagnostics/public-api-fixtures.ts`), sorted between
   `scanDeterministicTimeWarnings` and `scanWorkflowEnvelope`, committed with the
   scanner. The false acceptance line "no other test changes" is corrected to
   name the export-surface and module-manifest guards explicitly.
2. The new module file breaks the static-analysis module manifest. WI-2 sub-step
   (6) inserts `"workflow-odw-only-validate.ts"` into
   `EXPECTED_STATIC_ANALYSIS_MODULE_FILES`
   (`tests/diagnostics/architecture-fixtures.ts`), sorted between
   `workflow-metadata.ts` and `workflow-suppression-mask.ts`.
3. The barrel re-export was omitted and the export path mis-described. WI-2 now
   describes the two-hop publish path: a leaf re-export in the
   `src/static-analysis` barrel (`src/static-analysis/index.ts`, sub-step 3) and
   the name added to the `} from "./static-analysis"` re-export block in
   `src/index.ts` (sub-step 4, no top-level declaration so
   `architecture.test.ts:320` holds). Both the barrel and the two fixtures are
   now listed in the Key files and Interfaces sections. WI-2's true footprint —
   six files (new scanner, new scanner test, `src/static-analysis/index.ts`,
   `src/index.ts`, `public-api-fixtures.ts`, `architecture-fixtures.ts`) — is
   enumerated and flagged as being at the Tolerance 1 limit.

2026-07-06 WI-4 implementation. Added the released-rule emitter invariant as a
dedicated diagnostics test file, recorded the temporary-exclusion red evidence,
and ticked WI-4. Remaining work is WI-5 documentation reconciliation.

2026-07-06 WI-5 implementation. Reconciled the rule page and developers guide
with the implemented ODW-only `validate(source)` scanner, recorded the
scrutineer gate evidence, ticked WI-5, and marked the plan complete. No later
roadmap items remain in this ExecPlan.
