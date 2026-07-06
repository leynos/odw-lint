# Consolidate duplicated static-analysis helper fragments

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint` statically checks Open Dynamic Workflows (ODW) source without ever
executing it. Its static-analysis layer has grown three small code fragments
that are copied, byte-for-byte or near-so, into more than one module. Copies
drift: a fix applied to one copy silently leaves the others wrong. Roadmap task
5.4.1 (`docs/roadmap.md` lines 1363-1370) requires that each duplicated contract
gain **one** reviewed owner, that focused tests pin the behaviour, and that **no
production rule output changes**. The verbatim success line reads: "one reviewed
helper owns each duplicated contract, focused tests pin unchanged diagnostics,
and no production rule output changes."

Three duplicated fragments are in scope, confirmed by direct inspection of the
worktree:

1. **Compact-operator token handling.** `significantOperatorEndingAt`
   (`src/static-analysis/source-mask.ts` lines 136-148) and
   `significantTemplateOperatorEndingAt`
   (`src/static-analysis/source-mask-templates.ts` lines 155-167) have identical
   bodies: given a source index whose character is a non-identifier token end,
   they return `"++"`, `"--"`, or the single character. This is a pure
   token-grammar primitive.
2. **Source position/span copying helpers.** `sourcePosition`
   (`src/static-analysis/source-scan.ts` lines 177-179) and `frozenPosition`
   (`src/diagnostics/rule-diagnostic.ts` lines 50-53) are the identical body
   `Object.freeze({ ...position })`. Their sibling span builders — `sourceSpan`
   (`src/static-analysis/source-position.ts` lines 224-230) and `frozenSpan`
   (`src/diagnostics/rule-diagnostic.ts` lines 55-61) — share the "freeze a
   `{ start, end }` record" sub-contract but differ in whether they re-copy the
   nested positions (see Decision Log).
3. **The object-literal preceding-character set.** The inline magic string
   `"([{,;:?=+-*/%!&|^~<>"` used by `isObjectLiteralOpening`
   (`src/static-analysis/workflow-metadata-expression.ts` line 47) is the same
   "a `/`-or-`{` may begin an expression here" heuristic already owned as
   `REGEX_ALLOWED_PREVIOUS_CHARACTERS`
   (`src/static-analysis/source-mask-regex.ts` line 17). The two sets differ by
   exactly one member, `/` (see Decision Log for the verified set difference).

After this change a reader can see success by observing that: `make all` stays
green; the source-mask property tests, invalid-workflow parity snapshots, and
diagnostic tests are unchanged (no snapshot churn); the duplicated bodies exist
in exactly one place each; and the architecture inventory tests
(`tests/static-analysis/source-file-architecture.test.ts` and
`tests/diagnostics/architecture.test.ts`) still pass against the updated module
and declaration lists.

This is a refactor with a hard **behaviour-preservation** contract. Any change
to a snapshot, a parity fixture, or a diagnostic assertion is a red flag that
means the consolidation changed output; that is an escalation trigger, not a
"regenerate the snapshot" moment.

## Constraints

Hard invariants that must hold throughout implementation.

- **No production rule output changes.** No diagnostic message, span, severity,
  ordering, or JSON envelope may change. The existing behaviour tests are the
  oracle; a changed snapshot or parity fixture means escalate, not accept.
- **Layering direction is fixed.** `src/static-analysis/**` may import from
  `src/diagnostics/**`; `src/diagnostics/**` must not import from
  `src/static-analysis/**`. Any helper shared by both layers must live in
  `src/diagnostics/**`. (Verified: `src/static-analysis` imports
  `../diagnostics/*` widely; no `src/diagnostics` file imports
  `static-analysis`. See ADR 0001 for why the static-analysis boundary is
  load-bearing.)
- **Primitives seam stays type-clean.** `source-scanner-primitives.ts` "must be
  kept free of mask-range, parser-cursor, diagnostic, and public package types"
  (`docs/developers-guide.md` "Internal source-helper ownership"). Only helpers
  that operate on plain strings/characters may be added there; anything needing
  `SourcePosition`/`SourceSpan` must not.
- **No ODW runtime imports in production code** (ADR 0001 forbidden-import
  list). This refactor adds none, but the import-policy test remains a gate.
- **File-size and module-inventory discipline.** No source file may exceed 400
  lines (AGENTS.md). New module files must be registered in the architecture
  inventory fixtures (`tests/diagnostics/architecture-fixtures.ts`), and new or
  removed top-level declarations in pinned modules must be reflected in
  `tests/static-analysis/source-file-architecture.test.ts`.
- **Public package surface must not widen.** Newly introduced helpers are
  internal; they must not be added to `src/index.ts` / `package.json` exports.
  The package-entry test (`tests/diagnostics/package-entry.test.ts`) pins that
  surface.
- **en-GB Oxford spelling** ("-ize"/"-yse"/"-our") in all prose, comments, and
  commit messages (AGENTS.md).

## Tolerances (exception triggers)

- **Scope.** If any single work item requires touching more than 6 production
  files or more than ~120 net lines, stop and escalate.
- **Behaviour.** If any existing snapshot, parity fixture, or diagnostic
  assertion changes, stop and escalate — output has drifted.
- **Interface.** If consolidation appears to require widening the public package
  surface, changing a public API signature, or importing across the forbidden
  layering direction, stop and escalate.
- **Contract mismatch.** If, on close inspection, a "duplicate" turns out to
  have a divergent contract that cannot be preserved by the planned
  decomposition, stop and record the divergence in the Decision Log before
  proceeding.
- **Dependencies.** If a new external dependency seems necessary, stop and
  escalate. None is expected.
- **Iterations.** If a work item's gates still fail after 3 focused attempts,
  stop and escalate.

## Risks

- Risk: A "duplicate" is not truly identical, so merging changes behaviour.
  Severity: high. Likelihood: medium.
  Mitigation: each work item first proves the shared contract (identical body,
  or a set difference computed and pinned by test), then decomposes so every
  original call site keeps its exact prior behaviour. The property and parity
  tests are the backstop.
- Risk: Architecture inventory / declaration-pin tests fail because a module's
  file list or top-level declarations changed.
  Severity: low. Likelihood: high (expected).
  Mitigation: treat these pins as the structural "red" signal — update the
  expected lists in the same commit as the code move, and rely on `make test`
  to confirm the lists match.
- Risk: Adding a runtime helper to the primitives seam violates its "no
  diagnostic types" rule.
  Severity: medium. Likelihood: low.
  Mitigation: only the string-only helpers (compact-operator handling, the
  character set) go in the seam; the position/span copy helper — which needs
  `SourcePosition`/`SourceSpan` — goes in a new diagnostics-layer module.
- Risk: Cross-layer consolidation (WI-2) introduces an awkward import edge.
  Severity: low. Likelihood: low.
  Mitigation: the new owner is a small dedicated internal module in the
  diagnostics layer, consumed downward by static-analysis, matching the existing
  `static-analysis -> diagnostics` edges (for example `workflow-body-parser.ts`
  already imports `rule-diagnostic`).

## Progress

- [x] WI-1: Consolidate compact-operator token handling in the primitives seam
- [x] WI-2: Own source position and span freezing in a diagnostics helper
- [x] WI-3: Extract the shared expression-leading previous-character set
- [x] WI-4: Record the consolidated helper owners in documentation

2026-07-06 WI-1 evidence: added
`tests/static-analysis/source-scanner-compact-operator.test.ts`; the red run
failed on the missing `compactOperatorTokenEndingAt` export, then passed after
adding the primitive and rewiring `source-mask.ts` and
`source-mask-templates.ts`. The source-file architecture pin was updated to
reflect the new owner and removed local helper declarations. Scrutineer then
ran `make all`, `make markdownlint`, and `make nixie`; all passed.

2026-07-06 WI-2 evidence: added
`tests/diagnostics/source-coordinates.test.ts`; the red run failed on the
missing `../../src/diagnostics/source-coordinates` module, then passed after
adding `copySourcePosition` and `freezeSourceSpan` in
`src/diagnostics/source-coordinates.ts`. `rule-diagnostic.ts` now deep-copies
diagnostic span positions through the helper, while `source-scan.ts` preserves
the exported `sourcePosition` wrapper and `source-position.ts` preserves shallow
span freezing through `freezeSourceSpan(span.start, span.end)`. The diagnostics
architecture fixture lists were updated for the new private module. Focused
tests passed:
`bun test tests/diagnostics/source-coordinates.test.ts`,
`bun test tests/diagnostics/source-coordinates.test.ts
tests/diagnostics/rule-diagnostic.test.ts
tests/diagnostics/architecture.test.ts`, and
`bun test tests/static-analysis/source-file.test.ts`.

2026-07-06 WI-3 evidence: added
`tests/static-analysis/expression-leading-characters.test.ts`; the focused test
pins the shared base set exported from
`src/static-analysis/source-scanner-primitives.ts`, confirms regex scanning uses
that base unchanged, and confirms object-literal detection derives its local
`base ∪ { "/" }` contract while preserving arrow-body exclusion. Focused
validation passed with
`bun test tests/static-analysis/expression-leading-characters.test.ts`. The
full repository gate passed with `make all`.

2026-07-06 WI-4 evidence: documented the final helper owners in
`docs/developers-guide.md`, updated `docs/technical-design.md` §6.2 to name the
new primitives-seam contracts, and marked roadmap task 5.4.1 complete in
`docs/roadmap.md` with this ExecPlan as the completion record. The Markdown-only
format pass covered the changed files with `mdtablefix --in-place` and
`markdownlint-cli2 --fix`; final deterministic gates passed at HEAD with
`make all`, `make check-fmt`, `make lint`, `make typecheck`, `make test`,
`make markdownlint`, and `make nixie`.

## Surprises & discoveries

- Observation: the object-literal preceding-character set and the regex
  allowed-previous-character set differ by exactly one member.
  Evidence: object-literal string `"([{,;:?=+-*/%!&|^~<>"` (20 characters) minus
  `REGEX_ALLOWED_PREVIOUS_CHARACTERS` `"([{,;:=!&|?+-*%<>~^"` (19 characters)
  yields `{ "/" }`; the regex set is a subset of the object-literal set.
  Impact: WI-3 can own the shared 19-character base once and derive the
  object-literal set as `base ∪ { "/" }`, preserving behaviour exactly.
- Observation: `source-position.ts` `sourceSpan` freezes a shallow
  `{ start, end }` record, whereas `rule-diagnostic.ts` `frozenSpan` re-freezes
  each nested position first.
  Evidence: source lines cited in Purpose item 2.
  Impact: WI-2 keeps a single shallow `freezeSourceSpan(start, end)` owner and
  lets each caller decide whether to pre-copy the positions, so both prior
  contracts are preserved without change.
- Observation: the first WI-1 gate run failed before code assertions because
  `docs/contents.md` did not list this ExecPlan.
  Evidence: `tests/build-gate/documentation-contents.test.ts` reported missing
  `execplans/roadmap-5-4-1.md`.
  Impact: WI-1 includes a minimal contents-index entry so the repository gate
  can pass before the later documentation-owner work item begins.
- Observation: branch-local Leta symbol navigation was degraded during WI-2.
  Evidence: `leta grep "sourcePosition|sourceSpan|frozenPosition|frozenSpan"
  -k function --head 80` failed with `Error: Connection closed unexpectedly`;
  a narrower retry completed without useful symbol output.
  Impact: WI-2 used bounded direct inspection of the exact plan-named files
  after the required GrepAI main-branch intent search; this did not block
  implementation because the plan already identified the owned helper surfaces.

## Decision log

- Decision: place the shared compact-operator helper and the shared
  previous-character base set in the primitives seam
  `src/static-analysis/source-scanner-primitives.ts`.
  Rationale: `docs/technical-design.md` §6.2 designates that module the internal
  seam that "both the source-mask scanner family and workflow-metadata scanners
  compose", and `docs/developers-guide.md` confirms it "owns pure JavaScript
  token-grammar primitives shared by the source-mask and workflow-metadata
  scanner families". Both helpers are string-only, so they respect the seam's
  "no diagnostic/parser/public types" rule.
  Date/Author: 2026-07-06, planning agent.
- Decision: place the shared position/span freeze helpers in a new internal
  module `src/diagnostics/source-coordinates.ts` rather than the primitives seam
  or `diagnostics/types.ts`.
  Rationale: the helper needs `SourcePosition`/`SourceSpan`, which the
  primitives seam forbids. The only owner reachable by both layers under the
  fixed layering direction is in `src/diagnostics/**`. `diagnostics/types.ts` is
  re-exported at the package entry, so adding helpers there would widen the
  public surface; `rule-diagnostic.ts` is semantically about building rule
  diagnostics, so having `source-scan.ts` import it would be an awkward edge. A
  small dedicated internal
  module keeps the helper private and single-owned. This costs one entry each in
  `EXPECTED_DIAGNOSTIC_MODULE_FILES` and `EXPECTED_PARSEABLE_SOURCE_FILES`.
  Date/Author: 2026-07-06, planning agent.
- Decision: for the span copy, own only the "freeze a `{ start, end }` record"
  sub-contract (`freezeSourceSpan`) and keep position re-copying a caller
  concern.
  Rationale: `sourceSpan` (shallow) and `frozenSpan` (deep) genuinely differ;
  forcing one contract would change behaviour. Decomposing preserves both:
  `sourceSpan(span) = freezeSourceSpan(span.start, span.end)` and
  `frozenSpan(span) = freezeSourceSpan(copySourcePosition(span.start),
  copySourcePosition(span.end))`.
  Date/Author: 2026-07-06, planning agent.
- Decision: in WI-3 keep each divergent site local — regex uses the base set;
  the object-literal check uses `base ∪ { "/" }` — while owning the shared base
  once.
  Rationale: this mirrors the developers-guide "'where contracts match'
  exception" convention (helpers share the matching core and keep the divergent
  edge local and documented), and matches the roadmap wording "where contracts
  match". A single fused set would be wrong for regex, which must exclude `/`.
  Date/Author: 2026-07-06, planning agent.
- Decision: do not generalise the position copy into an untyped
  `frozenCopy<T>`; keep it typed to `SourcePosition`.
  Rationale: AGENTS.md prefers narrow domain types; `sourceLine` and the
  suggestion copy remain their own concerns and are out of this task's scope.
  Date/Author: 2026-07-06, planning agent.
- Decision: include the missing `docs/contents.md` ExecPlan entry with WI-1
  rather than defer it to WI-4.
  Rationale: `make all` treats the documentation contents index as a freshness
  gate for every current top-level ExecPlan. The entry is required gate
  bookkeeping for this approved plan and does not document the consolidated
  helper ownership that WI-4 still owns.
  Date/Author: 2026-07-06, WI-1 implementation agent.

## Outcomes & retrospective

WI-1 complete: compact-operator token handling now has one internal owner,
`compactOperatorTokenEndingAt`, in
`src/static-analysis/source-scanner-primitives.ts`. The source-mask and
template-mask callers delegate to it, and the focused test pins the unchanged
`++`, `--`, and single-character operator behaviour. No production snapshots or
parity fixtures changed.

WI-2 complete: source-coordinate freezing now has one internal diagnostics
owner, `src/diagnostics/source-coordinates.ts`. The focused diagnostics test
pins that `copySourcePosition` returns frozen copies and `freezeSourceSpan`
freezes only the `{ start, end }` record while preserving nested references.
The rule-diagnostic path still deep-copies nested positions by composing both
helpers, and the static-analysis source-span path still keeps its prior shallow
behaviour. No production snapshots or parity fixtures changed.

WI-3 complete: expression-leading previous-character handling now has one shared
base owner, `EXPRESSION_LEADING_PREVIOUS_CHARACTERS`, in
`src/static-analysis/source-scanner-primitives.ts`. Regex scanning consumes that
base unchanged, while object-literal detection derives its prior local contract
as the base plus `/`. The focused test pins the shared base, the one-character
divergence, and the arrow-body exclusion. No production snapshots or parity
fixtures changed.

WI-4 complete: `docs/developers-guide.md`, `docs/technical-design.md`, and
`docs/roadmap.md` now record the consolidated helper owners and mark roadmap
task 5.4.1 complete. The plan achieved its behaviour-preservation goal: one
reviewed helper owns each duplicated contract, focused tests pin unchanged
diagnostics, and no production rule output changed.

## Context and orientation

`odw-lint` is a Bun + TypeScript project. Production source lives under `src/`,
split into two layers: `src/diagnostics/` (report shapes, rule catalogue,
diagnostic construction) and `src/static-analysis/` (source scanning, masking,
envelope and metadata analysis). Tests live under `tests/` and are run with
`bun test` via `make test`.

Key files for this task:

- `src/static-analysis/source-scanner-primitives.ts` — the internal
  token-grammar seam shared by the source-mask and workflow-metadata scanner
  families. String-only helpers such as `asciiIdentifierRunStart` live here.
  Currently 255 lines. Its exact top-level declaration set is pinned by
  `tests/static-analysis/source-file-architecture.test.ts` (the
  `source-scanner-primitives.ts` block).
- `src/static-analysis/source-mask.ts` — inert-region masker facade;
  `significantTokenEndingAt` calls the local `significantOperatorEndingAt`.
- `src/static-analysis/source-mask-templates.ts` — template-literal masking;
  `previousSignificantTemplateToken` calls the local
  `significantTemplateOperatorEndingAt`.
- `src/static-analysis/source-mask-regex.ts` — regex-literal masking; owns
  `REGEX_ALLOWED_PREVIOUS_CHARACTERS` and `isRegexAllowedAfter`.
- `src/static-analysis/workflow-metadata-expression.ts` — exports
  `expressionContainsObjectLiteralCandidate`; its private
  `isObjectLiteralOpening` holds the inline object-literal character set.
- `src/static-analysis/source-scan.ts` — single production source scan; exports
  `sourcePosition` and `sourceLine`.
- `src/static-analysis/source-position.ts` — offset validation and span
  construction; holds the private `sourceSpan` freeze helper.
- `src/diagnostics/rule-diagnostic.ts` — builds diagnostics from catalogued
  rules; holds the private `frozenPosition`/`frozenSpan` freeze helpers.
- `src/diagnostics/types.ts` — defines `SourcePosition` and `SourceSpan`;
  re-exported at the package entry (so it must not gain internal helpers).

Definitions:

- **Compact operator token**: `++` or `--` written with no space, as opposed to
  a single-character operator; the masker must read the whole two-character
  token when it ends at a given index.
- **Preceding-character heuristic**: a JavaScript scanner cannot know whether a
  `/` starts a regex or a `{` starts an object literal without looking at the
  previous significant character; both use a small allow-set of characters after
  which an expression may begin.
- **Architecture inventory / declaration-pin tests**: tests that assert the
  exact list of source files in a directory and the exact set of top-level
  declarations in specific modules, so structural moves are reviewed
  deliberately.

Verified inventory constraints (from reading the tests):

- Adding `src/diagnostics/source-coordinates.ts` requires adding
  `"source-coordinates.ts"` to `EXPECTED_DIAGNOSTIC_MODULE_FILES` and
  `"src/diagnostics/source-coordinates.ts"` to `EXPECTED_PARSEABLE_SOURCE_FILES`
  in `tests/diagnostics/architecture-fixtures.ts`, and **not** adding it to
  `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS`.
- Adding a declaration to `source-scanner-primitives.ts`, or removing
  `significantOperatorEndingAt` from `source-mask.ts` /
  `significantTemplateOperatorEndingAt` from `source-mask-templates.ts`,
  requires editing the matching blocks in
  `tests/static-analysis/source-file-architecture.test.ts`.
- `workflow-metadata-expression.ts` is not covered by
  `source-file-architecture.test.ts`, so a new declaration there needs no pin
  update there; `make test` will reveal any other coverage.

## Plan of work

The work is four independent, individually committable work items. Each is a
behaviour-preserving refactor: the "red" step establishes a focused unit test
(and/or an architecture-pin edit) that fails before the move, and the "green"
step makes the smallest change that satisfies it while all wider gates stay
green. No milestone may proceed if `make all` is not green at its end.

### WI-1: Consolidate compact-operator token handling

Implements the roadmap's "shared compact-operator token handling", guided by
`docs/technical-design.md` §6.2 (scanner-family modules "must not re-implement
the shared" token loops) and `docs/developers-guide.md` "Internal source-helper
ownership".

1. Red: add a focused unit test (new file
   `tests/static-analysis/source-scanner-compact-operator.test.ts`, or a new
   block in an existing `source-scanner-*` test) importing a not-yet-existing
   `compactOperatorTokenEndingAt` from
   `src/static-analysis/source-scanner-primitives.ts`. Assert: for `"a++"` at
   the final index it returns `"++"`; for `"a--"` it returns `"--"`; for `"a+b"`
   at the `+` index it returns `"+"`; for a lone `"+"` at index 0 it returns
   `"+"`. Run the focused test and observe the import failure.
2. Green: add exported
   `compactOperatorTokenEndingAt(sourceText: string, index: number): string` to
   `source-scanner-primitives.ts` with the body currently in
   `significantOperatorEndingAt` (return `"++"`/`"--"` on a doubled `+`/`-`,
   else the single character). Add a `/** ... */` doc comment. Add
   `"compactOperatorTokenEndingAt"` to the `source-scanner-primitives.ts`
   declaration block in `source-file-architecture.test.ts`.
3. Green: in `source-mask.ts`, make `significantTokenEndingAt` call
   `compactOperatorTokenEndingAt` and delete the local
   `significantOperatorEndingAt`; import the new primitive. Remove
   `"significantOperatorEndingAt"` from the `source-mask.ts` declaration block
   in `source-file-architecture.test.ts`.
4. Green: in `source-mask-templates.ts`, make
   `previousSignificantTemplateToken` call `compactOperatorTokenEndingAt` and
   delete the local `significantTemplateOperatorEndingAt`; import the new
   primitive. Remove `"significantTemplateOperatorEndingAt"` from the
   `source-mask-templates.ts` declaration block in
   `source-file-architecture.test.ts`.
5. Refactor/verify: run `make all`. The source-mask property test
   (`tests/static-analysis/source-mask.property.test.ts`), the mask fixtures,
   and the template masking tests must pass unchanged (no snapshot churn).

Files touched (production): `source-scanner-primitives.ts`, `source-mask.ts`,
`source-mask-templates.ts`. Tests: the new focused test plus the
`source-file-architecture.test.ts` pin edits.

### WI-2: Own source position and span freezing once

Implements the roadmap's "source position/span copying helpers". Guided by
AGENTS.md "Abstraction / adapter / helper policy" (sweep for an existing
equivalent, document scope and ownership when an abstraction crosses module
boundaries) and ADR 0001 (layering as a security boundary).

1. Red: add a focused unit test
   `tests/diagnostics/source-coordinates.test.ts` importing not-yet-existing
   `copySourcePosition` and `freezeSourceSpan` from
   `src/diagnostics/source-coordinates.ts`. Assert: `copySourcePosition`
   returns a frozen object with the same `offset`/`line`/`column`, not the same
   reference as its input; `freezeSourceSpan(start, end)` returns a frozen
   `{ start, end }` whose `start`/`end` are the exact references passed in
   (shallow). Run it; observe the import failure.
2. Green: create `src/diagnostics/source-coordinates.ts` with a
   `/** @file ... */` block, exporting
   `copySourcePosition(position: SourcePosition): SourcePosition` returning
   `Object.freeze({ ...position })`, and
   `freezeSourceSpan(start: SourcePosition, end: SourcePosition): SourceSpan`
   returning `Object.freeze({ start, end })`. Import the types from `./types`.
3. Green: register the module in `tests/diagnostics/architecture-fixtures.ts` —
   add `"source-coordinates.ts"` to `EXPECTED_DIAGNOSTIC_MODULE_FILES` and
   `"src/diagnostics/source-coordinates.ts"` to
   `EXPECTED_PARSEABLE_SOURCE_FILES` (both lists are sorted; keep alphabetical
   order). Do not touch `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS`.
4. Green: in `rule-diagnostic.ts`, replace the body of `frozenPosition` with a
   call to `copySourcePosition` (or delete `frozenPosition` and use
   `copySourcePosition` directly), and rewrite `frozenSpan` as
   `freezeSourceSpan(copySourcePosition(span.start),
   copySourcePosition(span.end))`. The deep-copy behaviour is preserved.
5. Green: in `source-scan.ts`, redefine `sourcePosition` to delegate to
   `copySourcePosition` (keep the exported name `sourcePosition` so its
   architecture pin holds); import from `../diagnostics/source-coordinates`.
6. Green: in `source-position.ts`, rewrite the private `sourceSpan` as
   `freezeSourceSpan(span.start, span.end)` (keep the name `sourceSpan`; shallow
   behaviour preserved); import from `../diagnostics/source-coordinates`.
7. Refactor/verify: run `make all`. `rule-diagnostic.test.ts`, the source-file
   and source-position suites, and all diagnostic snapshots must pass unchanged.

Files touched (production): new `source-coordinates.ts`, `rule-diagnostic.ts`,
`source-scan.ts`, `source-position.ts`. Tests: new focused test plus
`architecture-fixtures.ts` edits.

### WI-3: Extract the shared expression-leading previous-character set

Implements the roadmap's "the object-literal preceding-character set where
contracts match". Guided by `docs/technical-design.md` §6.2 (shared token
primitives live in the primitives seam) and the developers-guide "'where
contracts match' exception" convention.

1. Red: add a focused unit test
   (`tests/static-analysis/expression-leading-characters.test.ts`) that pins the
   verified relationship. Assert: a not-yet-existing exported base set
   `EXPRESSION_LEADING_PREVIOUS_CHARACTERS` from
   `source-scanner-primitives.ts` has exactly the 19 members of the current
   regex set; `REGEX_ALLOWED_PREVIOUS_CHARACTERS` equals the base set; the
   object-literal set equals the base set plus `/`. Also add/extend a regression
   assertion on `expressionContainsObjectLiteralCandidate` that a `{` following
   `/` (for example `a / {}`) is still treated as an object-literal opening,
   while `=>{` (arrow body) is still not. Run it; observe failure.
2. Green: add exported
   `EXPRESSION_LEADING_PREVIOUS_CHARACTERS: ReadonlySet<string>` to
   `source-scanner-primitives.ts` initialised from the 19-character base
   `"([{,;:=!&|?+-*%<>~^"`, with a doc comment explaining it is the set of
   single characters after which a `/` may begin a regex or a `{` may begin an
   object literal. Add its name to the `source-scanner-primitives.ts` block in
   `source-file-architecture.test.ts`.
3. Green: in `source-mask-regex.ts`, initialise
   `REGEX_ALLOWED_PREVIOUS_CHARACTERS` from the base
   (`new Set(EXPRESSION_LEADING_PREVIOUS_CHARACTERS)`), keeping the exported
   name so its pin is unchanged. Confirm membership is byte-identical to today.
4. Green: in `workflow-metadata-expression.ts`, replace the inline magic string
   with a named constant derived from the base
   (`new Set([...EXPRESSION_LEADING_PREVIOUS_CHARACTERS, "/"])`) and change
   `isObjectLiteralOpening` to test membership with `.has(...)`. Add a comment
   noting the `/` divergence (division and regex-close contexts still permit a
   following object-literal expression) so future readers understand why the two
   sets differ by one member.
5. Refactor/verify: run `make all`. `source-mask-regex.test.ts` and the
   workflow-metadata suites must pass unchanged (no output change).

Files touched (production): `source-scanner-primitives.ts`,
`source-mask-regex.ts`, `workflow-metadata-expression.ts`. Tests: new focused
test plus the `source-file-architecture.test.ts` pin edit.

### WI-4: Record the consolidated helper owners in documentation

Implements AGENTS.md "Documentation Maintenance" and the "Abstraction / adapter
/ helper policy" requirement to record cross-module ownership.

1. Update `docs/developers-guide.md` "Internal source-helper ownership" to name
   the two new primitives-seam owners (`compactOperatorTokenEndingAt` and
   `EXPRESSION_LEADING_PREVIOUS_CHARACTERS`) and the new diagnostics-layer owner
   (`src/diagnostics/source-coordinates.ts`, owning `copySourcePosition` and
   `freezeSourceSpan`), including the `/` divergence for the object-literal set.
2. Update `docs/technical-design.md` §6.2 to note that compact-operator token
   handling and the expression-leading previous-character set are now owned in
   the primitives seam rather than re-implemented per scanner family.
3. Mark roadmap task 5.4.1 complete in `docs/roadmap.md` (change `[ ]` to `[x]`
   and add a "Completed by [roadmap-5-4-1.md](execplans/roadmap-5-4-1.md)." line
   in the same style as task 5.5.1) as the final commit.
4. Format only the changed markdown files with `mdtablefix` then
   `markdownlint-cli2 --fix`, then run `make markdownlint` and `make nixie`.

Files touched: `docs/developers-guide.md`, `docs/technical-design.md`,
`docs/roadmap.md`, and this ExecPlan.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-5-4-1`.

For each work item:

1. Make the edits described in the Plan of work.
2. Run the focused test first, for example:

   ```bash
   bun test tests/static-analysis/source-scanner-compact-operator.test.ts
   ```

   Expect the red run to fail on a missing import, then pass after the green
   edit.
3. Run the full gate:

   ```bash
   make all
   ```

   Expect a green build, format check, lint, typecheck, and test run with no
   snapshot updates.
4. For WI-4 (markdown), additionally run:

   ```bash
   make markdownlint
   make nixie
   ```

5. Commit with an en-GB imperative subject (for example
   `Consolidate compact-operator token handling`). Commit each work item
   separately.

## Validation and acceptance

Quality criteria (what "done" means):

- Tests: `make test` passes with no changed snapshots and no changed parity
  fixtures. The new focused tests fail before their work item's production edit
  and pass after.
- Lint/format/types: `make all` passes (it runs build, format check, lint,
  typecheck, and tests).
- Markdown (WI-4 only): `make markdownlint` and `make nixie` pass.
- Structure: `tests/static-analysis/source-file-architecture.test.ts` and
  `tests/diagnostics/architecture.test.ts` pass against the updated module and
  declaration lists.
- Behaviour: the source-mask property test, mask fixtures, invalid-workflow
  parity tests, and diagnostic tests are unchanged.

Quality method (how we check): run `make all` at the end of every work item;
run the focused test before and after each production edit to capture
Red-Green evidence. The deterministic commit gate for this run is `make all`;
AGENTS.md also names sequential `make check-fmt`, `make lint`, `make typecheck`,
and `make test`, so run those if `make all` does not clearly aggregate them.
The workflow host re-runs the configured gates against the committed HEAD.

Red-Green-Refactor evidence to record per work item:

- Red: `bun test <focused test>` fails on the missing import (the shared helper
  does not yet exist).
- Green: after adding the helper and rewiring call sites, `bun test <focused
  test>` passes and `make all` is green.
- Refactor: no separate refactor is expected beyond removing the now-dead local
  helpers; rerun `make all` to confirm.

## Idempotence and recovery

Every step is a source edit under version control; re-running an edit is safe.
If a work item's gate fails, revert the working tree for that item
(`git restore` / `git checkout -- <files>`) and retry. No step is destructive or
touches state outside the repository. Do not `git stash` without a named
message per the run's stash-naming rule. Commit each work item only when its
`make all` is green.

## Artifacts and notes

Verified set difference (object-literal minus regex previous-character sets):

- object-literal set: `"([{,;:?=+-*/%!&|^~<>"` (20 characters)
- regex set (`REGEX_ALLOWED_PREVIOUS_CHARACTERS`): `"([{,;:=!&|?+-*%<>~^"` (19
  characters)
- difference: `{ "/" }`; the regex set is a subset of the object-literal set.

Identical compact-operator bodies (verbatim from both source modules):

```ts
// src/static-analysis/source-scanner-primitives.ts (new owner)
const character = sourceText[index] ?? "";
const previousCharacter = sourceText[index - 1] ?? "";
if (character === "+" && previousCharacter === "+") {
  return "++";
}
if (character === "-" && previousCharacter === "-") {
  return "--";
}
return character;
```

## Interfaces and dependencies

New/changed internal interfaces at completion:

- In `src/static-analysis/source-scanner-primitives.ts`:

  ```ts
  export const compactOperatorTokenEndingAt = (
    sourceText: string,
    index: number,
  ): string => { /* ++ / -- / single char */ };

  export const EXPRESSION_LEADING_PREVIOUS_CHARACTERS: ReadonlySet<string>;
  ```

- In `src/diagnostics/source-coordinates.ts` (new internal module, not exported
  at the package entry):

  ```ts
  export const copySourcePosition = (position: SourcePosition): SourcePosition =>
    Object.freeze({ ...position });

  export const freezeSourceSpan = (
    start: SourcePosition,
    end: SourcePosition,
  ): SourceSpan => Object.freeze({ start, end });
  ```

No new external dependencies. No public package surface change.

## Addenda

- [x] 5.4.1.1. Extract parser-backed body-scanner harness helpers.
  - Source: audit:3.1.7; severity low.
  - Scope: extract the shared normalized-span diagnostic constructor used by
    parser-backed body scanners, and introduce a shared body-match collection
    helper where the scanner contracts align.
  - Success: existing parser-backed scanners share one reviewed
    normalized-span diagnostic path, future bounded-loop, bounded-fanout, and
    `Promise.race` scanners have a single harness to reuse, and no production
    diagnostic output changes.

## Signposting: documentation read and skills to load

Documentation treated as source of truth for this plan:

- `docs/roadmap.md` (task 5.4.1, lines 1357-1370) — scope and success line.
- `docs/technical-design.md` §6.2 — the source-mask facade and the
  `source-scanner-primitives.ts` shared-seam contract.
- `docs/developers-guide.md` "Internal source-helper ownership" — the per-module
  ownership split and the "'where contracts match' exception" convention.
- `docs/adr/0001-static-analysis-boundary.md` — why the static-analysis boundary
  and its import rules are load-bearing.
- `AGENTS.md` — quality gates, the abstraction/helper policy, TypeScript style,
  testing rules, and en-GB Oxford spelling.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` — Extract Method
  guidance for the duplicated fragments.

Skills to load when implementing:

- `execplans` — to keep this plan a living document.
- `python-router`/`rust-router` are not applicable; this is TypeScript. Follow
  AGENTS.md "TypeScript Guidance" directly. Load `leta` for symbol navigation
  and reference checks, and `grepai` for intent search against the main-branch
  index
  (verify branch-local facts in the worktree).
- `commit-message` — for the en-GB imperative commit subjects.

## Revision note

Initial draft (2026-07-06). Establishes four work items to give each duplicated
static-analysis fragment a single reviewed owner: compact-operator handling and
the expression-leading previous-character set move to the primitives seam, and
the position/span freeze helpers move to a new internal diagnostics module. The
plan pins each contract with a focused test and preserves all existing
behaviour; no production output changes are expected.

Completion update (2026-07-06). Marks WI-4 and the ExecPlan complete after
recording the consolidated helper owners in the developers guide, technical
design, and roadmap. Remaining work is none for roadmap task 5.4.1.
