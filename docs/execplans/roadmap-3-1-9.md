# Infer chained ODW-only validate aliases with scope-sensitive invalidation

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Open Dynamic Workflows (ODW) injects a `validate(source)` primitive that has no
pure Claude Code equivalent. The lint rule `odw/no-odw-only-validate` emits an
informational note wherever a workflow calls that primitive so authors know the
call will not port to plain Claude Code. Today the scanner follows the bare
`validate(source)` call and a single-hop alias (`const v = validate; v(source)`),
but it deliberately stops at a chained alias
(`const v = validate; const w = v; w(source)`): the second hop is silently
undetected and the rule page lists it as a conservative limit.

Roadmap task 3.1.9 asks whether that second hop can be followed with
scope-sensitive invalidation and *without* introducing false positives against
shadowed or reassigned identifiers. After reading the scanner, the scope
own-facts model, and the existing tests (see `Context and orientation`), this
plan concludes the answer is yes: chained aliases can be inferred by resolving
initializer identifiers against the alias set already computed for the current
and enclosing scopes, using the same whole-scope, shadow-aware model that direct
aliases already use. Following the chain does not create a new class of false
positive; it only extends the *already documented* whole-scope
reassignment/temporal-dead-zone (TDZ) bound one hop further.

After this change a workflow author can observe the following. Given a workflow
body:

```js
const v = validate;
const w = v;
const result = w(args.source);
```

running the one-command Claude compatibility pipeline (via `scanWorkflowEnvelope`
/ `lintWorkflowSource`, the same path the CLI uses) reports exactly one
`odw/no-odw-only-validate` info diagnostic, anchored on the `w` callee span, and
that note stays informational under `--strict-claude`. A shadowed second hop
(`const v = validate; const w = otherThing; w(args.source);`) reports nothing,
and a chain broken by a scope-local shadow of the base
(`const v = validate; { const v = other; const w = v; w(args.source); }`) reports
nothing for the shadowed branch.

## Constraints

Hard invariants that must hold throughout implementation. Violation requires
escalation, not a workaround.

- Never execute or import workflow source. The scanner is static-only per
  [docs/adr/0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md)
  and [docs/technical-design.md](../technical-design.md) §§2 and 9. Continue to
  parse the normalized body through the existing SWC path only.
- Keep `odw/no-odw-only-validate` informational (`info`) and never promoted by
  `--strict-claude`, per [docs/technical-design.md](../technical-design.md) §9.2
  and the rule page
  [docs/rules/no-odw-only-validate.md](../rules/no-odw-only-validate.md).
- Do not change any other rule's output. Deterministic-time, metadata, and
  orchestration diagnostics must be byte-for-byte unchanged.
- Reuse the shared SWC seam. Consume `isIdentifier`, `traverseAstSubtree`, and
  the `ScopeOwnFacts`/`ScopeOwnInitializer` model already provided by
  `src/static-analysis/swc-ast.ts`, `workflow-ast-scopes.ts`, and
  `workflow-ast-scope-own-facts.ts`; do not clone SWC shape helpers (guarded by
  roadmap 3.2.5.2 / 3.2.6.1).
- Introduce no new runtime dependency. The mechanism is pure TypeScript over the
  already-locked `@swc/core` AST facts.
- Follow the en-GB Oxford-spelling convention (`-ize`/`-yse`/`-our`) in prose,
  comments, and commit subjects, per
  [AGENTS.md](../../AGENTS.md) and the
  [documentation-style-guide.md](../documentation-style-guide.md).
- Respect the file-size and complexity guidance in
  [docs/complexity-antipatterns-and-refactoring-strategies.md](../complexity-antipatterns-and-refactoring-strategies.md);
  keep `workflow-odw-only-validate.ts` small and single-purpose.

## Tolerances (exception triggers)

- Scope: if the production change needs to touch more than 3 source files, or
  more than ~60 net lines in `workflow-odw-only-validate.ts`, stop and escalate.
- Model change: if following the chain cannot be done inside the existing
  `ScopeOwnFacts` model and would require a new whole-program data-flow pass
  or a new public binding-fact field, stop and escalate — a materially larger
  design than this task scopes.
- False positive: if any red/property test shows a chained-alias inference firing
  on a case that is *not* already covered by the documented whole-scope
  reassignment/TDZ bound (i.e. a genuinely new false-positive class), stop and
  escalate; the task explicitly forbids new false positives.
- Interface: if any exported signature in `src/index.ts` /
  `src/static-analysis/index.ts` must change, stop and escalate.
- Iterations: if the gate (`make all`) still fails after 3 fix attempts on a
  single work item, stop and escalate.
- Ambiguity: if evidence emerges that the roadmap intends chained aliases to
  remain *unsupported* (documented bound only) rather than detected, stop and
  present both branches with trade-offs before writing production code.

## Risks

- Risk: within a single scope, `ScopeOwnInitializer` records appear in source
  order, so a naive single forward pass would miss a reverse-declared chain
  (`const w = v; const v = validate;`).
  Severity: low. Likelihood: medium.
  Mitigation: resolve the alias set to a fixpoint over the scope's own
  initializers (iterate until a pass adds nothing). This keeps chained aliases
  whole-scope-visible, matching how direct aliases already behave, and is bounded
  by the initializer count. WI-1 pins this with a reverse-order test.
- Risk: a chained inference could fire on a reassigned base
  (`let v = validate; v = other; const w = v;`) and be read as a *new* false
  positive.
  Severity: low. Likelihood: medium.
  Mitigation: this is the *same* whole-scope reassignment/TDZ bound the rule
  already documents for direct aliases (roadmap 3.1.8.1; rule page "Limitations").
  Because it is not a new class, WI-3 extends the documented bound to cover chains
  rather than treating it as a defect. A test pins the behaviour as intentional.
- Risk: cross-scope shadowing of the base could leak an inference into a branch
  where the base is rebound.
  Severity: medium. Likelihood: low.
  Mitigation: the existing `validateAliasesForOwnFacts` already deletes every
  `ownName` from the inherited alias set before adding new aliases, so a
  shadow of the base removes it before any chained hop is resolved. WI-1 pins
  this with a nested-scope shadow test.
- Risk: changing the alias builder could perturb the single-hop or bare-call
  output that other tests and snapshots depend on.
  Severity: medium. Likelihood: low.
  Mitigation: the change is purely additive (it only adds names that resolve to
  the existing alias set); the full existing `workflow-odw-only-validate.test.ts`,
  `workflow-lint.test.ts`, and strict-Claude suites must stay green under
  `make all`.

## Progress

- [x] WI-1: Infer chained validate aliases with a scope-fixpoint resolver
- [x] WI-2: Prove chained aliases through the merged pipeline and strict-Claude
- [x] WI-3: Refresh the validate rule page for supported chained aliases

## Surprises & discoveries

- Observation: the sibling ODW checkout at
  `/data/leynos/Projects/open-dynamic-workflows` is outside the sandbox's allowed
  working directories, so it could not be read from this planning session.
  Evidence: `grep`/`ls` against that path returned "blocked … may only search …
  '/data/leynos/Projects/odw-lint', '/data/leynos/Projects/odw-lint.worktrees'".
  Impact: none for this task. The `validate(source)` premise is already grounded
  in-repo by [docs/technical-design.md](../technical-design.md) §§9.2 and the
  primitive table at §2 (`/src/primitives.ts`,
  `validate(source)` → `{ ok, meta?, errors, warnings }`), and the rule is
  already released (roadmap 3.1.7/3.1.8). This plan adds no new ODW-library API
  surface — it is pure static AST analysis over already-locked `@swc/core` facts.
- Observation: the WI-1 red suite first failed before assertions because the
  worktree had no installed Bun dependencies (`fast-check` was missing). Running
  `make build` installed the locked dependencies, after which the focused suite
  failed on the planned chained-alias assertions with zero diagnostics.
  Impact: no design change. The dependency bootstrap was an environment
  prerequisite, not a code or test deviation.
- Observation: GrepAI was available and returned
  `src/static-analysis/workflow-odw-only-validate.ts` as the primary main-branch
  hit for "ODW-only validate alias inference chained scope fixpoint". Leta was
  available for branch-local symbol lookup and confirmed the existing
  `validateAliasesForOwnFacts`, `isUnshadowedValidateAliasInitializer`, and
  `scanOdwOnlyValidateNotes` surfaces before editing.
  Impact: implementation proceeded against the intended scanner seam and reused
  the existing `isIdentifier` helper.
- Observation: the delegated scrutineer gate report returned green, but reported
  a clean worktree on branch `main` while this task worktree still had the
  expected WI-1 changes. The report was therefore treated as a workflow attempt,
  not as final HEAD evidence.
  Impact: final gate evidence was collected locally after the ExecPlan update so
  it covered the actual task worktree state.
- Observation: WI-2 needed no production wiring change. The existing merged
  `lintWorkflowSource` path already consumed the chained-alias scanner output
  added by WI-1; the new pipeline and strict-Claude tests passed immediately.
  Impact: the work item stayed limited to behavioural coverage in
  `tests/static-analysis/workflow-lint.test.ts` and
  `tests/static-analysis/workflow-lint-strict-claude.test.ts`.
- Observation: the delegated scrutineer run for WI-2 reported
  `make check-fmt`, `make typecheck`, `make lint`, `make test`, and `make all`
  green against the dirty task worktree after the TypeScript test additions.
  Impact: no implementation correction was required before updating this
  ExecPlan; because the ExecPlan changed afterwards, markdown-specific gates
  were rerun locally before commit.
- Observation: WI-3 updated `docs/rules/no-odw-only-validate.md` only. The page
  now lists chained aliases as reported, removes them from the unsupported
  forms, and states that the existing whole-scope reassignment and
  temporal-dead-zone bound applies to each hop in a chain.
  Impact: no code or test update was required for this work item; the
  documentation now matches the WI-1/WI-2 behaviour.
- Observation: the delegated scrutineer run for WI-3 reported
  `make check-fmt`, `make typecheck`, `make lint`, `make test`, `make all`,
  `make markdownlint`, and `make nixie` green against the dirty task worktree
  after the rule-page update.
  Impact: after this ExecPlan update, the full required gate set was rerun
  against the final tree before commit.

## Decision log

- Decision: detect chained aliases (implement) rather than only document them as
  an unsupported bound.
  Rationale: the scope own-facts model already carries every `const w = v`
  declaration as a `ScopeOwnInitializer` with an identifier `init`, and the alias
  builder already computes a shadow-aware, whole-scope alias set per scope.
  Following the chain is a small, additive extension of that builder — resolve an
  initializer identifier against the alias set instead of only against the literal
  name `validate`. It introduces no new false-positive class beyond the
  already-documented whole-scope reassignment/TDZ bound, so the roadmap success
  criterion "intentional lint outcomes through the one-command Claude
  compatibility pipeline" is achievable without weakening the rule.
  Date/Author: 2026-07-06, planning agent.
- Decision: resolve the per-scope alias set to a fixpoint over the scope's own
  initializers rather than a single source-order pass.
  Rationale: the rule's documented model states alias visibility is whole-scope
  and does not model declaration order (rule page "Limitations"; roadmap 3.1.6.3
  and 3.1.8.1). A fixpoint keeps chained aliases whole-scope-visible exactly like
  direct aliases, avoiding a subtle order-dependent inconsistency, and is bounded
  by the (small) initializer count per scope.
  Date/Author: 2026-07-06, planning agent.
- Decision: treat a chained inference off a reassigned base as intentional and
  extend the documented bound, not as a defect to suppress.
  Rationale: it is the identical whole-scope reassignment bound already accepted
  for direct aliases; suppressing it for chains only would make the two paths
  inconsistent for no correctness gain on an `info`-level rule.
  Date/Author: 2026-07-06, planning agent.
- Decision: keep `isUnshadowedValidateAliasInitializer` and add
  `resolvesToValidateAlias` as the chained-alias predicate rather than folding
  both concerns into one larger helper.
  Rationale: retaining the direct-primitive helper keeps the old semantics
  visible and lets the chained resolver express the additive rule: an
  initializer resolves to `validate` if it is the unshadowed literal primitive
  or a name already present in the current alias fixpoint.
  Date/Author: 2026-07-06, WI-1 implementation agent.

## Outcomes & retrospective

Roadmap 3.1.9 delivered the intended implementation branch. A chained
`const v = validate; const w = v; w(source)` produces exactly one
`odw/no-odw-only-validate` info note through the merged pipeline and remains
informational under strict-Claude. Focused scanner coverage also proves
multi-hop chains, reverse-declared whole-scope chains, nested-scope shadowing,
workflow-local bases, and the intentional reassigned-base bound.

The rule page now documents chained aliases as supported and moves them out of
the unsupported conservative-limits list. It also records that whole-scope
reassignment and temporal-dead-zone conservatism applies to each hop of a chain,
matching the scanner's existing direct-alias model rather than adding a new
false-positive class.

## Context and orientation

A reader new to this repository needs the following map. All paths are
repository-relative from the worktree root.

The rule lives in
`src/static-analysis/workflow-odw-only-validate.ts`. Its entry point
`scanOdwOnlyValidateNotes(envelope, parseResult?)` parses the normalized workflow
body, then walks the SWC module with `walkOdwOnlyValidateCalls`. At each node it
calls `matchOdwOnlyValidateCall` (emits a match for an unshadowed bare `validate`
call or a call whose callee is a known alias) and `enterValidateScanScope` (enters
the paired binding scope and alias scope for that node).

The alias set is built by `validateAliasesForOwnFacts(parentAliases, facts,
bindings)`. It copies the parent aliases, deletes every `facts.ownNames` entry
(shadowing), then for each `facts.ownInitializers` entry calls
`isUnshadowedValidateAliasInitializer(initializer.init, bindings)` — which today
returns true *only* when `init` is the identifier `validate` and `validate` is not
lexically bound. That literal-`validate`-only check is exactly why a second hop
(`const w = v`) is not followed: `v` is an identifier but not the literal
`validate`.

The facts come from `src/static-analysis/workflow-ast-scope-own-facts.ts`. Type
`ScopeOwnInitializer = { readonly name: string; readonly init: Expression }` and
`ScopeOwnFacts = { readonly ownNames: readonly string[]; readonly
ownInitializers: readonly ScopeOwnInitializer[] }`. `collectSimpleInitializer`
records *any* `Expression` initializer for a simple declarator (not just
identifiers), so `const w = v` is already present in `ownInitializers` with `init`
being the identifier `v`. `ownInitializers` preserves source (push) order;
`ownNames` is sorted. The scope-entry plumbing (`rootScopeView`,
`enterScopeWithOwnFacts`, `rootScopeOwnFacts`, `scopeOwnFacts`) lives in
`src/static-analysis/workflow-ast-scopes.ts`, and lexical-binding lookups
(`isIdentifierBound`, `LexicalBindingFacts`) in
`src/static-analysis/workflow-ast-bindings.ts`.

The shared SWC helpers (`isIdentifier`, `traverseAstSubtree`) live in
`src/static-analysis/swc-ast.ts`.

Wiring: `scanOdwOnlyValidateNotes` is exported through
`src/static-analysis/index.ts` and re-exported from `src/index.ts`, and is called
by the merged pipeline in `src/static-analysis/workflow-lint.ts` (around line
114). The published rule page is
`docs/rules/no-odw-only-validate.md`.

Tests:

- `tests/static-analysis/workflow-odw-only-validate.test.ts` — focused scanner
  tests. Line ~177 currently asserts `"does not follow chained validate
  aliases"` expects `[]`; line ~159 asserts a workflow-local base
  (`const validate = makeValidator(); const v = validate; v(...)`) is ignored;
  line ~227 is a `fast-check` property test for generated single-hop aliases.
- `tests/static-analysis/workflow-lint.test.ts` — merged-pipeline routing
  (line ~193 bare, ~218 single-hop alias), asserting `docs` path and span.
- `tests/static-analysis/workflow-lint-strict-claude.test.ts` — proves the note
  stays `info` under strict-Claude (line ~119).

Key terms. "Alias" — a `const`/`let`/`var` name bound directly to another
identifier. "Chained alias" — an alias whose initializer is itself an alias
(`const w = v` where `v` resolves to `validate`). "Whole-scope visibility" — the
scanner treats an alias as visible everywhere in its declaring scope, without
modelling statement order or the temporal dead zone. "Shadow" — a name redeclared
in a scope, which removes any inherited alias meaning for that name in that scope.
"Fixpoint" — repeat a pass until it stops changing the result.

## Plan of work

Three ordered work items. Each is independently committable and passes the full
gate on its own.

### WI-1 — Infer chained aliases with a scope-fixpoint resolver

Implements the roadmap 3.1.9 success criterion "chained `validate` aliases … have
intentional lint outcomes", grounded in
[docs/technical-design.md](../technical-design.md) §9.2 and
[docs/adr/0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md)
(static-only). Docs to read first:
[docs/complexity-antipatterns-and-refactoring-strategies.md](../complexity-antipatterns-and-refactoring-strategies.md)
(keep the resolver small and single-purpose) and the `Testing` and
`Invariant testing` sections of [AGENTS.md](../../AGENTS.md). Skills to load:
`leta` (symbol navigation / references before editing), `python-router` is not
relevant; this is TypeScript, so load no Rust/Python router — follow the
repository's Biome/Oxlint conventions in [AGENTS.md](../../AGENTS.md). Load the
`hypothesis`-equivalent invariant approach via `fast-check` (already the project's
property tool) as directed by AGENTS.md `Invariant testing`.

Stage B (red). In `tests/static-analysis/workflow-odw-only-validate.test.ts`:

1. Replace the `"does not follow chained validate aliases"` test (currently
   expecting `[]`) with `"follows chained validate aliases"`, asserting one
   diagnostic on the `w` callee span for the body
   `const v = validate;\nconst w = v;\nw(args.source);`.
2. Add `"follows multi-hop validate alias chains"` for the three-hop body
   `const a = validate;\nconst b = a;\nconst c = b;\nc(args.source);`,
   asserting the span is `c`.
3. Add `"follows a reverse-declared chain within one scope"` for the body
   `var w = v;\nvar v = validate;\nw(args.source);` (uses `var` so it is valid
   runtime code), asserting the `w` diagnostic. This pins the fixpoint decision.
4. Add `"stops a chain when the base is shadowed in a nested scope"`: for a body
   that opens `const v = validate;` then, inside `if (args.local) { … }`,
   declares `const v = other;\nconst w = v;\nw(args.source);`, assert `[]`.
5. Add `"ignores a chain whose base is workflow-local"`, asserting `[]` for a
   two-hop extension of the existing workflow-local-initializer case:
   `const validate = makeValidator();\nconst v = validate;\nconst w = v;\nw(args.source);`.
6. Add `"treats a chain off a reassigned base as the documented whole-scope
   bound"`, asserting one diagnostic for the body
   `let v = validate;\nv = other;\nconst w = v;\nw(args.source);` (intentional
   per Decision Log; pins the bound rather than a defect).
7. Extend the `fast-check` property block with a property that the two-hop body
   `const <a> = validate;\nconst <b> = <a>;\n<b>(args.source);` (names drawn
   from `VALIDATE_ALIAS_IDENTIFIER`, required distinct) reports exactly one
   diagnostic on the `<b>` span.

Run the focused suite and observe red (the new positive assertions fail because
the second hop is not followed):

```bash
bun test tests/static-analysis/workflow-odw-only-validate.test.ts
```

Stage C (green). In `src/static-analysis/workflow-odw-only-validate.ts`, change
the alias builder so an initializer identifier that already resolves to a
validate alias adds a new alias, resolved to a fixpoint:

- Add a helper `resolvesToValidateAlias(init, aliases, bindings)` returning true
  when `init` is an identifier that is either the unshadowed literal `validate`
  (the current `isUnshadowedValidateAliasInitializer` check) or a name currently
  present in `aliases`.
- Rewrite `validateAliasesForOwnFacts` to: copy `parentAliases`, delete every
  `ownName`, then repeatedly scan `facts.ownInitializers`, adding
  `initializer.name` whenever `resolvesToValidateAlias(initializer.init, aliases,
  bindings)` and the name is not already present, until a full pass adds nothing
  (fixpoint). Keep the shadow-deletion step before the fixpoint so a redeclared
  base cannot seed a chain.
- Keep `matchOdwOnlyValidateCall` unchanged: it already flags any callee whose
  name is in `context.aliases`, so multi-hop names flow through once they are in
  the set.

Add a short en-GB comment explaining why the resolver iterates to a fixpoint
(whole-scope, order-independent visibility) to satisfy the documentation-density
convention of the surrounding file.

Re-run the focused suite and expect green, then run the full gate.

Stage D (refactor). Ensure the fixpoint helper is small and named clearly; make
sure no SWC shape helper is cloned (the `isIdentifier` seam is reused). Confirm
`isUnshadowedValidateAliasInitializer` is either folded into
`resolvesToValidateAlias` or retained and reused (no dead code — Biome/Oxlint will
flag unused symbols).

Tests this work item adds/updates: the six focused unit tests and one property
test above (unit + property). No snapshot changes are expected here; if
`make test` reports an unexpected snapshot diff, stop and escalate (it signals a
perturbation of existing output, a tolerance breach).

Validation: `make all`.

### WI-2 — Prove chained aliases through the merged one-command pipeline

Implements the roadmap 3.1.9 success phrase "through the one-command Claude
compatibility pipeline" and the strict-Claude non-promotion constraint from
[docs/technical-design.md](../technical-design.md) §9.2. Docs to read:
[AGENTS.md](../../AGENTS.md) `Testing` (end-to-end coverage when externally
observable behaviour changes) and the existing
`tests/static-analysis/workflow-lint.test.ts` /
`workflow-lint-strict-claude.test.ts` for the established pattern. Skills:
`leta` to locate the merged-pipeline test helpers and the `scanWorkflowEnvelope`
public entry.

Stage B (red). Add to `tests/static-analysis/workflow-lint.test.ts` a test
`"routes chained ODW-only validate aliases through the merged pipeline"` that runs
`const v = validate;\nconst w = v;\nconst result = w(args.source);` through the
same public `scanWorkflowEnvelope`/pipeline helper the existing alias test uses
(line ~218), asserting exactly one `odw/no-odw-only-validate` diagnostic, its
`docs` field equals `docs/rules/no-odw-only-validate.md`, and its span matches the
`w` callee text. Add to
`tests/static-analysis/workflow-lint-strict-claude.test.ts` a case proving the
chained-alias body keeps `["odw/no-odw-only-validate", "info"]` under strict-Claude
(mirror the existing line ~119 assertion). Run:

```bash
bun test tests/static-analysis/workflow-lint.test.ts tests/static-analysis/workflow-lint-strict-claude.test.ts
```

These are red before WI-1 is present in the tree; because WI-1 lands first, they
verify the pipeline wiring surfaces the new behaviour (the focused scanner change
alone does not prove the merged path). If WI-1 is already merged, treat this as
characterization coverage and confirm it passes only because of WI-1 by
temporarily reverting is unnecessary — the merged-pipeline assertion is the new
guarantee.

Stage C. No production change is expected: `workflow-lint.ts` already routes the
scanner. If the tests fail for a wiring reason, that is a discovery — record it
in `Surprises & Discoveries` and fix the wiring within tolerance.

Tests added: two integration/behavioural tests (merged pipeline + strict-Claude).

Validation: `make all`.

### WI-3 — Refresh the rule page

Implements the roadmap 3.1.9 alternative-satisfying documentation update and the
`docs/rules` contract cited by
[docs/technical-design.md](../technical-design.md) §9.2. Docs to read:
[docs/documentation-style-guide.md](../documentation-style-guide.md) and
[docs/scripting-standards.md](../scripting-standards.md) for example formatting,
and the en-GB rules in [AGENTS.md](../../AGENTS.md). Skill: `en-gb-oxendict` for
the prose; `changelog` is not required.

Edit `docs/rules/no-odw-only-validate.md`:

1. In "Failing example", add a chained-alias snippet
   (`const v = validate; const w = v; const result = w(source);`) alongside the
   existing single-hop example, described as also reported.
2. In "Limitations", move chained aliases *out* of the conservative-limits
   sentence (currently lists `const v = validate; const w = v; w(source)` as
   undetected) so only member/computed/global forms remain listed as unsupported.
3. Update the alias-resolution paragraph to state that chained aliases resolve
   through the same whole-scope model, and that the whole-scope reassignment and
   temporal-dead-zone bound (already stated for direct aliases) applies to
   each hop of a chain — so a chain off a reassigned or TDZ-ordered base stays
   conservatively broad.

Tests/validation: markdown-only. Format only the touched file, then gate:

```bash
mdtablefix docs/rules/no-odw-only-validate.md
markdownlint-cli2 --fix docs/rules/no-odw-only-validate.md
make all
make markdownlint
make nixie
```

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-3-1-9`.

WI-1:

```bash
# red
bun test tests/static-analysis/workflow-odw-only-validate.test.ts
# …edit src + tests…
# green + full gate
make all
git add -A && git commit
```

Expected red transcript (abridged) before the production edit:

```plaintext
(fail) scanOdwOnlyValidateNotes > follows chained validate aliases
  expect(received).toHaveLength(1)  // received length 0
```

Expected green after the edit: the focused file reports all tests passing, and
`make all` finishes with build, check-fmt, whitespace-hygiene, lint, typecheck,
and test all green.

WI-2:

```bash
bun test tests/static-analysis/workflow-lint.test.ts tests/static-analysis/workflow-lint-strict-claude.test.ts
make all
git add -A && git commit
```

WI-3:

```bash
mdtablefix docs/rules/no-odw-only-validate.md
markdownlint-cli2 --fix docs/rules/no-odw-only-validate.md
make all
make markdownlint
make nixie
git add -A && git commit
```

## Validation and acceptance

Commit gate for every work item: `make all` (which runs, in order, `build`,
`check-fmt`, `whitespace-hygiene`, `lint`, `typecheck`, `test`, per the
`Makefile` and [AGENTS.md](../../AGENTS.md) §"repository gate is `make all`"). For
WI-3 (markdown), additionally run `make markdownlint` and `make nixie`. The
workflow host re-runs these gates against committed HEAD; do not report gates
green unless every listed target passed at HEAD.

Red-Green-Refactor evidence (WI-1):

- Red: `bun test tests/static-analysis/workflow-odw-only-validate.test.ts` fails
  on the new chained-alias assertions because the second hop is not followed
  (received length 0, expected 1).
- Green: after extending `validateAliasesForOwnFacts` with the fixpoint resolver,
  the same command passes.
- Refactor: `make all` passes after the resolver is tidied and no SWC helper is
  cloned.

Behavioural acceptance (WI-2): a chained-alias workflow body run through
`scanWorkflowEnvelope`/the merged pipeline yields exactly one
`odw/no-odw-only-validate` info diagnostic with `docs` =
`docs/rules/no-odw-only-validate.md`, span on the final-hop callee, unchanged
under `--strict-claude`.

Quality criteria ("done"):

- Tests: focused scanner suite, merged-pipeline suite, and strict-Claude suite all
  pass under `bun test`; the new chained-alias unit, property, and integration
  tests are present.
- Lint/typecheck: `make lint` and `make typecheck` clean (no new suppressions).
- Docs: `make markdownlint` and `make nixie` clean after WI-3.
- No behaviour drift: no unexpected snapshot updates; all pre-existing validate,
  deterministic-time, metadata, and orchestration tests stay green.

## Idempotence and recovery

Every step is re-runnable. The production change is additive and local to one
file; if `make all` fails, re-read the failure, fix, and re-run — no external
state is mutated. If a snapshot appears to need updating, do not blanket-update:
inspect the diff first; an unexpected snapshot change is a tolerance breach
(behaviour drift) and must be escalated. If the branch drifts from `origin/main`,
use the `rebase` skill before the final commit. Do not run a repo-global
formatter; format only the specific markdown file touched in WI-3.

## Artefacts and notes

The load-bearing production edit is confined to
`src/static-analysis/workflow-odw-only-validate.ts`, specifically the
`validateAliasesForOwnFacts` builder and a new `resolvesToValidateAlias` helper.
The change relies only on already-present facts: `ScopeOwnInitializer.init` is
already an `Expression` and already carries `const w = v` identifiers (verified
in `workflow-ast-scope-own-facts.ts`, `collectSimpleInitializer`), so no change
to the scope-own-facts collector is required.

## Interfaces and dependencies

No public interface changes. `scanOdwOnlyValidateNotes` keeps its signature and
export path (`src/static-analysis/index.ts`, `src/index.ts`). Internally, after
WI-1:

```ts
// src/static-analysis/workflow-odw-only-validate.ts
const resolvesToValidateAlias = (
  init: unknown,
  aliases: ReadonlySet<string>,
  bindings: LexicalBindingFacts,
): boolean => {
  /* identifier `validate` unshadowed, or an identifier already in `aliases` */
};

const validateAliasesForOwnFacts = (
  parentAliases: ReadonlySet<string>,
  facts: ScopeOwnFacts,
  bindings: LexicalBindingFacts,
): ReadonlySet<string> => {
  /* copy parent, delete ownNames, then fixpoint over ownInitializers */
};
```

Dependencies: `@swc/core` AST types only (already locked), consumed through the
`swc-ast.ts` seam. No new runtime dependency; `fast-check` (already a dev
dependency) drives the new property test.

## Revision note

Initial draft (2026-07-06). Decomposes roadmap 3.1.9 into three ordered work
items: implement the scope-fixpoint chained-alias resolver with focused
unit/property tests (WI-1), prove it through the merged one-command pipeline and
strict-Claude (WI-2), and refresh the rule page (WI-3). The plan commits to
*detecting* chained aliases (not merely documenting a bound) on the evidence that
the scope own-facts model already carries the second-hop declaration and the
alias builder already computes a shadow-aware whole-scope alias set, so following
the chain adds no new false-positive class beyond the already-documented
whole-scope reassignment/TDZ bound.
