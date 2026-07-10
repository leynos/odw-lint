# Introduce a static workflow lint entry point (`lintWorkflowSource`)

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Today, every caller that wants a workflow file's complete static diagnostics
must hand-assemble them. The parity suite at
`tests/static-analysis/invalid-workflow-metadata-parity.test.ts` (lines 63-67)
writes `[...envelope.diagnostics, ...classifyWorkflowMetadata(envelope).diagnostics]`
by hand. Any future `check` command would have to reimplement that same merge
and, critically, the same *merge order*. Two independent transcriptions of the
merge is exactly the "parallel sources of truth" hazard that roadmap step 2.1
exists to remove.

Roadmap task 2.1.12 introduces one production function,
`lintWorkflowSource`, that owns the pipeline: build the original source file,
scan the envelope, classify the metadata, and merge the two diagnostic streams
in a single canonical order. After this change a novice can call one function
and observe the full envelope-plus-metadata diagnostic set for a workflow
source string, and the parity suite consumes that same call rather than a
hand-written merge.

You can see it working by running the new focused unit and property tests, and
by observing that the refactored parity suite still produces byte-identical
diagnostics while no longer transcribing the merge itself.

Roadmap reference: `docs/roadmap.md` task 2.1.12 (lines 502-508). Requires
2.1.3, 2.1.5, and 2.1.7 (all complete on this branch's base commit).

## Constraints

Hard invariants that must hold throughout implementation. Violation requires
escalation, not a workaround.

- **No source evaluation.** `lintWorkflowSource` and every module it imports
  must remain static. It must not import or call `loadWorkflowScript`,
  `createPrimitives`, the runtime `validate` primitive, `new Function`, `eval`,
  or any ODW loader, primitive, launcher, worker, runtime, scheduler,
  metadata-evaluating, or agent-dispatch path. Enforced by the existing
  forbidden-import architecture test (task 2.1.4) and
  `docs/technical-design.md` §5, §6.4, §12.1; `docs/adr/0001-static-analysis-boundary.md`.
- **Reuse the existing pipeline.** The new entry point must delegate to the
  existing `createOriginalSourceFile` (`src/static-analysis/source-file.ts`),
  `scanWorkflowEnvelope` (`src/static-analysis/workflow-envelope.ts`), and
  `classifyWorkflowMetadata` (`src/static-analysis/workflow-metadata.ts`). It
  must not fork, copy, or re-derive their logic.
- **Preserve behaviour of existing consumers.** The refactor of
  `tests/static-analysis/invalid-workflow-metadata-parity.test.ts` must keep
  every currently-asserted diagnostic (rule, severity, message, span, and
  `spanText`) byte-identical. This is a behaviour-preserving refactor.
- **Public API additions are guarded.** Any symbol re-exported from
  `src/index.ts` must be added to
  `tests/diagnostics/public-api-fixtures.ts` in the same commit, or
  `tests/diagnostics/public-api-surface.test.ts` fails. Do not weaken that
  guard.
- **Do not modify** `src/diagnostics/**` (the diagnostic contract is owned by
  earlier tasks), the ODW runtime, or any executable ODW path. Do not touch
  task 3.1.1's `odw/claude-pure-meta` emission.
- **Owned rule set only.** The merge must not add, drop, reorder, or rewrite any
  diagnostic beyond concatenating the two existing streams. No new rule ids.
- **Prose and commits** follow en-GB Oxford spelling ("-ize"/"-yse"/"-our") per
  `AGENTS.md` and `docs/documentation-style-guide.md`.

## Tolerances (exception triggers)

- **Scope:** if implementation requires changes to more than 8 files or ~250
  net lines, stop and escalate.
- **Interface:** the only new public symbols are `lintWorkflowSource` and the
  `WorkflowLintResult` type. If any *other* public signature must change, stop
  and escalate.
- **Dependencies:** if any new runtime or dev dependency is required, stop and
  escalate. (None is expected; `fast-check` and `bun:test` already exist.)
- **Behaviour drift:** if the parity refactor changes any asserted diagnostic
  value, stop and escalate — that means the merge order or contents differ, and
  the assumption behind this task is wrong.
- **Production offender:** if delivering the entry point surfaces a real
  production module that already imports an executable ODW path, stop and
  surface it; do not "fix" production code inside this task.
- **Iterations:** if `make all` still fails after 3 focused attempts on a work
  item, stop and escalate.

## Risks

- Risk: The de-facto merge order (`envelope` diagnostics first, then metadata)
  is only *implied* by current call sites, not documented.
  Severity: medium. Likelihood: low.
  Mitigation: Pin the order explicitly with a property test (WI1) that asserts
  `lintWorkflowSource(source).diagnostics` deep-equals
  `[...scan.diagnostics, ...classification.diagnostics]` for arbitrary
  generated sources, and document the order in the developers' guide (WI2).
  Evidence for current order: `invalid-workflow-metadata-parity.test.ts:64-66`
  and `hostile-metadata-security.test.ts` both spread envelope before metadata.
- Risk: Adding a public export perturbs the sorted export fixture and the
  package-entry module-specifier guard.
  Severity: low. Likelihood: medium.
  Mitigation: Re-export from the existing `./static-analysis` specifier (already
  present in `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS`), so only the
  export-name fixture in `public-api-fixtures.ts` changes; run
  `make test` to have the guard print the exact expected list.
- Risk: A red test that references a not-yet-existing export makes `tsc`
  (`make typecheck`) fail for the whole suite, so the *commit* cannot be green
  mid-work-item.
  Severity: low. Likelihood: high (by design of TDD here).
  Mitigation: Red and Green happen within one work item; only the final,
  green state is committed. Observe the red failure locally, implement, then
  gate and commit once. See "Concrete steps".

## Progress

- [x] (2026-07-02T11:26Z) WI1: Add `lintWorkflowSource` +
  `WorkflowLintResult` with focused unit and
  property tests (internal export only).
- [x] (2026-07-02T11:34Z) WI2: Promote
  `lintWorkflowSource`/`WorkflowLintResult` to the public package entry, update
  the reviewed surface guard and the developers' guide.
- [x] (2026-07-02T12:41Z) WI3: Route the invalid-workflow parity suite through
  `lintWorkflowSource` and document it as the single merge entry point.

## Surprises & discoveries

- Observation: There is no exhaustive module-inventory guard over
  `src/static-analysis/`; only `src/diagnostics/` is inventoried
  (`tests/diagnostics/architecture-fixtures.ts` `EXPECTED_DIAGNOSTIC_MODULE_FILES`
  and `architecture.test.ts:31-37`).
  Evidence: `grep` for readdir-based inventory found only the diagnostics
  inventory and the fixture-metadata-refresh manifest lists (test fixtures, not
  production modules).
  Impact: Adding `src/static-analysis/workflow-lint.ts` needs no
  static-analysis inventory fixture update. Adding it to the *representative*
  `EXPECTED_PARSEABLE_SOURCE_FILES` list is optional and is left out to avoid an
  unnecessary fixture edit.
- Observation: The required `scrutineer` sub-agent could not run WI1 gates
  because its fixed `gpt-5.3-codex-spark` quota was exhausted.
  Evidence: the sub-agent returned "You've hit your usage limit for
  GPT-5.3-Codex-Spark" before executing `make all`.
  Impact: WI1 used the repository's documented fallback pattern: the
  implementation agent ran the same deterministic gate locally, then invoked
  `coderabbit review --agent` directly after the gate was green.

## Decision log

- Decision: `lintWorkflowSource` accepts a `WorkflowSource`
  (`{ filePath, sourceText }`) and returns a `WorkflowLintResult` that exposes
  the built `sourceFile`, the `scan` result, the `classification`, and the
  merged `diagnostics`.
  Rationale: The CLI-facing input is raw file text, and
  `createOriginalSourceFile` already takes exactly `WorkflowSource`
  (`src/static-analysis/source-file.ts:22`). Returning `sourceFile` lets
  consumers such as the parity suite slice spans (`sliceSourceSpan`) and derive
  status without rebuilding the file, so the one call is sufficient for "tests
  and future CLI work" (roadmap success line).
  Date/Author: 2026-07-02, planning agent.
- Decision: Split delivery into an internal-first work item (WI1) then a public
  promotion (WI2).
  Rationale: `src/index.ts` re-exports a hand-listed set from `./static-analysis`
  (not `export *`), so adding to `src/static-analysis/index.ts` does not touch
  the guarded public surface. WI1 can therefore land fully green without
  touching `public-api-fixtures.ts`, keeping each commit's blast radius small.
  Date/Author: 2026-07-02, planning agent.
- Decision: Canonical merge order is envelope diagnostics first, then metadata
  diagnostics.
  Rationale: Matches both current call sites; keeps the refactor in WI3
  behaviour-preserving. Pinned by property test in WI1.
  Date/Author: 2026-07-02, planning agent.
- Decision: Continue WI1 validation with local `make all` and local
  `coderabbit review --agent` after `scrutineer` quota exhaustion.
  Rationale: The repository already models local self-run evidence as degraded
  but usable when independent reviewers are unavailable, and the task should not
  be marked blocked solely because the fixed scrutineer model quota is
  exhausted. The exact deterministic commands remained unchanged.
  Date/Author: 2026-07-02T11:26Z, implementation agent.
- Decision: Use the public-boundary test as the WI2 Red assertion before
  updating the root export and reviewed fixture.
  Rationale: The new consumer assertion failed with the precise missing package
  export (`Export named 'lintWorkflowSource' not found`) before public wiring
  existed. This proved the caller-visible gap directly; after adding the
  re-export and fixture names, the existing public API surface guard passed
  under `make all`.
  Date/Author: 2026-07-02T11:34Z, implementation agent.
- Decision: Leave `tests/static-analysis/hostile-metadata-security.test.ts`
  on its existing focused classifier path.
  Rationale: That suite proves hostile metadata is not evaluated and verifies
  cold public imports; it does not own the envelope-plus-metadata merge. WI3 is
  scoped to the parity helper that had manually transcribed the merge order, so
  changing the hostile suite would broaden the refactor without improving the
  task-owned invariant.
  Date/Author: 2026-07-02T12:41Z, implementation agent.

## Outcomes & retrospective

Roadmap task 2.1.12 is complete. `lintWorkflowSource` is the canonical static
workflow lint entry point, exported internally and at the root package entry.
It builds the original source file, scans the envelope, classifies workflow
metadata, and returns envelope diagnostics followed by metadata diagnostics.

The invalid-workflow metadata parity suite now consumes `lintWorkflowSource`
instead of rebuilding the pipeline by hand. The focused property test in
`tests/static-analysis/workflow-lint.test.ts` pins the same merge order for
generated sources. Documentation now points future callers to the single entry
point. Final `make all`, `make markdownlint`, and `make nixie` passed, and
CodeRabbit returned zero findings for each milestone after rate-limit backoffs
where required.

## Addenda

- [x] 2.1.12.1. Add a static-analysis module-inventory guard.
- [x] 2.1.12.2. Strengthen workflow-lint merge-order properties.
- [x] 2.1.12.3. Decide the static-analysis result freeze-depth contract.
- [x] 2.1.12.4. Consolidate identifier-character classification.
- [x] 2.1.12.5. Extract shared low-level scanner character predicates.
- [x] 2.1.12.6. Share workflow body parsing in the lint pipeline.
  - Source: review:3.1.2 and audit:3.1.2; severity medium.
  - Scope: wire `odw/body-syntax` diagnostics into `lintWorkflowSource` through
    one normalized body parse shared with Claude-compatibility detection while
    keeping syntax failures visible once and preserving deterministic-time
    failure silence when syntax diagnostics already own the error.
  - Success: the canonical lint pipeline emits body-syntax diagnostics and
    deterministic-time warnings from one parse result without double-parsing a
    workflow body.
- [x] 2.1.12.7. Add live-pipeline diagnostic docs coverage.
  - Source: audit:3.1.2; severity medium.
  - Scope: extend live `lintWorkflowSource` parity coverage so emitted rule
    diagnostics assert `docs === ruleDocsPath(rule)` across invalid fixtures.
  - Success: a missing docs field in any live pipeline diagnostic fails tests
    before reporters or fixtures can ship it.
- [x] 2.1.12.8. Complete low-level scanner predicate centralization.
  - Source: audit:2.2.7; severity medium.
  - Scope: finish the 2.1.12.5 predicate pass by promoting
    `isStringLikeDelimiter` to a reusable type guard, replacing duplicated
    local string-delimiter wrappers, and removing remaining low-level scanner
    whitespace or ASCII identifier idioms that should have one named home.
  - Success: scanner modules consume the shared predicates directly, tests pin
    the shared narrowing contract, and the completed 2.1.12 predicate
    centralization no longer leaves copy-prone local wrappers.

## Context and orientation

`odw-lint` is a static linter for Open Dynamic Workflows (ODW) source files. It
must never execute workflow source; it reads the text and reasons about it. The
package is private and exposes a single consumer surface, `src/index.ts`, pinned
by `package.json` (`main`, `types`, and the `.` export all point at
`./src/index.ts`).

The two functions this task unifies:

- `scanWorkflowEnvelope(sourceFile: OriginalSourceFile): WorkflowEnvelopeScanResult`
  in `src/static-analysis/workflow-envelope.ts`. It locates
  `export const meta = …`, rejects top-level import/export, identifies the body
  span, and returns `.diagnostics` (envelope-owned) plus an `.envelope` or a
  `missing-meta` status.
- `classifyWorkflowMetadata(scanResult: WorkflowEnvelopeScanResult): WorkflowMetadataClassification`
  in `src/static-analysis/workflow-metadata.ts`. It consumes the scan result and
  returns `.diagnostics` (metadata-owned) plus a `status` of `not-applicable`,
  `valid`, `runtime-invalid`, or `statically-unprovable`.

The source-file factory:

- `createOriginalSourceFile(source: WorkflowSource): OriginalSourceFile` in
  `src/static-analysis/source-file.ts`. `WorkflowSource` is
  `{ filePath: string; sourceText: string }` (`src/static-analysis/types.ts:15-25`).
  `OriginalSourceFile` is nominally branded (`ORIGINAL_SOURCE_FILE_BRAND`); only
  the factory can build one.

Re-export layering (important, because it decides which guards fire):

- `src/static-analysis/index.ts` re-exports a hand-listed set of static-analysis
  symbols.
- `src/index.ts` re-exports a hand-listed set *from* `./static-analysis` (see
  lines 55-89). It is not `export *`, so adding to `static-analysis/index.ts`
  alone does not change the public package surface.

Guards that will react to this change:

- `tests/diagnostics/public-api-surface.test.ts:172-181` asserts the package's
  named exports deep-equal `EXPECTED_PUBLIC_PACKAGE_EXPORTS` (sorted) from
  `tests/diagnostics/public-api-fixtures.ts`.
- `tests/diagnostics/package-entry.test.ts:43` asserts `src/index.ts`'s module
  specifiers equal `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS`
  (`tests/diagnostics/architecture-fixtures.ts:8-18`). `./static-analysis` is
  already listed, so this guard is *unaffected* as long as the new symbol is
  re-exported through `./static-analysis`.
- The forbidden-import architecture test (task 2.1.4) scans production imports;
  the new module's imports must stay static.

Key design references:

- `docs/technical-design.md` §5 (static-analysis boundary), §6.1 (components —
  the boundary between envelope scanner, static meta parser, and future rule
  engine/reporter), §6.3 (metadata classification categories), §6.4 (do not
  execute source), §12.1 (trust boundary).
- `docs/adr/0001-static-analysis-boundary.md` (owned static parser; no
  executable ODW paths in production).
- `docs/developers-guide.md` "static-analysis" section (lines ~55-89) and the
  public-API-surface section (lines ~231-240).
- `AGENTS.md` testing rules (behavioural + unit tests for new behaviour;
  `make all` is the gate) and the command list.

Testing framework: `bun:test` for unit/behavioural tests; `fast-check` for
property tests (see `tests/static-analysis/source-mask.property.test.ts` and
`tests/static-analysis/source-file.property.test.ts` for the repo's fast-check
idiom — `fc.assert(fc.property(generator, predicate))`).

## Plan of work

Three work items, each a vertical slice ending green with `make all` (plus
`make markdownlint` and `make nixie` when Markdown changes).

### WI1 — Add the merged static lint entry point (internal export)

Implements: `docs/technical-design.md` §5, §6.1, §6.3, §6.4; `docs/adr/0001`;
`AGENTS.md` testing rules. Roadmap 2.1.12 core deliverable.

Read first: `docs/technical-design.md` §§5, 6.1, 6.3, 6.4;
`docs/adr/0001-static-analysis-boundary.md`; `docs/developers-guide.md`
static-analysis section; the three collaborator modules named in
"Context and orientation".

Skills to load: `leta` (symbol navigation/verification), `grepai` (intent
search against `main`), the language router for TypeScript work
(`odw-authoring` is ODW-authoring-specific and not needed; use `leta` +
project standards), and `hypothesis`-equivalent thinking via `fast-check` for
the property test (no Python skill applies; follow the repo's existing
fast-check idiom).

Files:

1. New `src/static-analysis/workflow-lint.ts`:
   - Import `createOriginalSourceFile`, `scanWorkflowEnvelope`,
     `classifyWorkflowMetadata` from their sibling modules using relative
     imports (per developers' guide: static-analysis modules use relative
     internal imports).
   - Import types `OriginalSourceFile`, `WorkflowSource`,
     `WorkflowEnvelopeScanResult` from `./types`, `Diagnostic` from
     `../diagnostics/types`, and `WorkflowMetadataClassification` from
     `./workflow-metadata`.
   - Define and export:

     ```typescript
     // src/static-analysis/workflow-lint.ts
     export type WorkflowLintResult = {
       readonly sourceFile: OriginalSourceFile;
       readonly scan: WorkflowEnvelopeScanResult;
       readonly classification: WorkflowMetadataClassification;
       readonly diagnostics: readonly Diagnostic[];
     };

     export const lintWorkflowSource = (
       source: WorkflowSource,
     ): WorkflowLintResult => {
       const sourceFile = createOriginalSourceFile(source);
       const scan = scanWorkflowEnvelope(sourceFile);
       const classification = classifyWorkflowMetadata(scan);
       const diagnostics = Object.freeze([
         ...scan.diagnostics,
         ...classification.diagnostics,
       ]);
       return Object.freeze({ sourceFile, scan, classification, diagnostics });
     };
     ```

   - Match the file-doc-comment and JSDoc density of the sibling modules
     (`/** @file … */` header; a short JSDoc on the exported function).
2. Export both symbols from `src/static-analysis/index.ts` (add a
   `export { lintWorkflowSource, type WorkflowLintResult } from "./workflow-lint";`
   block; keep the file's alphabetical/grouped ordering consistent with its
   neighbours).

Tests (new `tests/static-analysis/workflow-lint.test.ts`, importing from the
internal module path `../../src/static-analysis/workflow-lint` — this keeps WI1
independent of the public surface):

- Unit — completeness and order: for a valid workflow source, assert
  `result.diagnostics` deep-equals
  `[...result.scan.diagnostics, ...result.classification.diagnostics]`.
- Unit — missing-meta path: a source with no `export const meta` yields the
  single `odw/meta-required` diagnostic and `classification.status ===
  "not-applicable"`, so `result.diagnostics.length === 1`.
- Unit — runtime-invalid path: a source with `export const meta = { name: "" }`
  yields the metadata `odw/meta-name` diagnostic *after* any envelope
  diagnostics.
- Unit — no-import-export path: a source with a top-level `import` yields the
  envelope `odw/no-import-export` diagnostic in `result.diagnostics`.
- Unit — result exposes the built `sourceFile` such that
  `sliceSourceSpan(result.sourceFile, result.diagnostics[0].span)` returns the
  expected original-source text (proves callers need not rebuild the file).
- Unit — the returned object and its `diagnostics` array are frozen
  (`Object.isFrozen`).
- Property (`fast-check`) — merge invariant: over generated workflow sources
  (reuse or adapt the segment generators in
  `tests/static-analysis/source-mask.property.test.ts` / build small
  meta-prefixed sources), assert `lintWorkflowSource(source).diagnostics`
  equals the concatenation of an independent
  `scanWorkflowEnvelope(createOriginalSourceFile(source))` then
  `classifyWorkflowMetadata(scan)`. This pins the canonical merge order as a
  behavioural invariant (Risk 1 mitigation).
- Security/no-eval — reuse a hostile-metadata style source (e.g. metadata whose
  value would write a global if evaluated) and assert no side-effect marker is
  observable and a diagnostic is produced. Keep this lightweight; the
  release-blocking hostile suite remains owned by task 2.1.5.

Red-Green-Refactor: write the test file first and run it (Red — fails to
resolve `lintWorkflowSource`). Add the module and export (Green). Refactor
JSDoc/formatting and re-run.

Validation: `make all`.

### WI2 — Promote to the public package entry and update the surface guard

Implements: `docs/technical-design.md` §5; `docs/developers-guide.md`
public-API-surface section; `AGENTS.md` public-API-change rule. Roadmap 2.1.12
(makes the one call available to future CLI work).

Read first: `src/index.ts`; `tests/diagnostics/public-api-fixtures.ts`;
`tests/diagnostics/public-api-surface.test.ts`;
`tests/diagnostics/package-entry.test.ts`; `tests/static-analysis/boundary.test.ts`;
`docs/developers-guide.md` public-API-surface section.

Skills to load: `leta` (verify the export list wiring), the TypeScript workflow
per project standards.

Files:

1. `src/index.ts`: extend the existing `from "./static-analysis"` re-export
   block to add `lintWorkflowSource` and `type WorkflowLintResult` (keep the
   block's alphabetical ordering). Because the specifier `./static-analysis` is
   unchanged, `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS` needs no edit.
2. `tests/diagnostics/public-api-fixtures.ts`: insert `"WorkflowLintResult"`
   (between `"WorkflowEnvelopeScanResult"` and `"WorkflowMetaValue"`) and
   `"lintWorkflowSource"` (between `"isRuleId"` and `"makeRuleId"`), preserving
   the file's ASCII-sorted order. Run `make test` first if unsure; the guard
   prints the exact expected order on failure.
3. `docs/developers-guide.md`: in the static-analysis section, add a short
   paragraph naming `lintWorkflowSource` as the single production entry point
   that merges envelope and metadata diagnostics (order: envelope then
   metadata), and note that the package entry now re-exports it.

Tests:

- Extend `tests/static-analysis/boundary.test.ts` (or add a focused
  `public-consumer`-style case) with a test that imports `lintWorkflowSource`
  and `WorkflowLintResult` from `"odw-lint"` and asserts the merged result for a
  small valid source — proving the public consumer path works end to end.
- The existing `public-api-surface.test.ts` guard now green with the updated
  fixture (Red before the fixture edit, Green after).

Red-Green-Refactor: add the public-consumer assertion and, before editing the
fixture, run `make test` to observe the surface guard fail (Red, listing the
missing names). Add the fixture names and the `src/index.ts` re-export (Green).

Validation: `make all`; `make markdownlint`; `make nixie` (developers' guide is
Markdown). Format the touched Markdown first with
`mdtablefix docs/developers-guide.md` then
`markdownlint-cli2 --fix docs/developers-guide.md`.

### WI3 — Route the parity suite through `lintWorkflowSource`

Implements: `docs/technical-design.md` §5 (single source of truth for the
merge); `AGENTS.md` refactor rule (behavioural tests pass before and after).
Roadmap 2.1.12 success line ("tests … consume one call … without reimplementing
merge order").

Read first: `tests/static-analysis/invalid-workflow-metadata-parity.test.ts`
(the `classifyInvalidFixture` helper, lines 54-79); `docs/developers-guide.md`
(the parity-test references, lines ~73-79).

Skills to load: `leta` (locate the merge call site and confirm no other
production merge sites exist), `grepai` for a consistency sweep.

Files:

1. `tests/static-analysis/invalid-workflow-metadata-parity.test.ts`: replace the
   hand-written pipeline in `classifyInvalidFixture` (currently
   `createOriginalSourceFile` → `scanWorkflowEnvelope` →
   `[...envelope.diagnostics, ...classifyWorkflowMetadata(envelope).diagnostics]`)
   with a single `lintWorkflowSource({ filePath, sourceText })` call, sourcing
   `result.sourceFile` for `sliceSourceSpan` and `result.diagnostics` for the
   filtered comparison. Keep the `TASK_2_1_3_RULES` filter and the comparison
   shape exactly as they are, so the asserted diagnostics stay byte-identical.
   Remove now-unused imports (`scanWorkflowEnvelope`, `classifyWorkflowMetadata`,
   `createOriginalSourceFile`) only if they become unused.
2. `docs/developers-guide.md`: update the parity-test reference to say the
   parity suite consumes `lintWorkflowSource` rather than assembling the merge
   itself.

Tests:

- No new assertions; the *existing* parity assertions are the behavioural
  guard. They must pass unchanged, proving the refactor is behaviour-preserving
  (Constraint: preserve behaviour of existing consumers). If any assertion
  changes value, stop and escalate (Tolerance: behaviour drift).
- Decide on the hostile-metadata suite: its in-process helper classifies
  metadata only (`classifyWorkflowMetadata(scanWorkflowEnvelope(...))`) and its
  cold-module-graph spawn script reconstructs imports by hand; it does *not*
  merge envelope+metadata diagnostics. Leave it unchanged (out of scope for the
  merge). Record this decision in the Decision Log at implementation time.

Red-Green-Refactor substitute: this is a pure refactor of test-support code.
Run the parity suite before the edit (Green baseline), refactor, run again
(still Green, identical output). Capture both transcripts in
"Artefacts and notes".

Validation: `make all`; `make markdownlint`; `make nixie`. Format the touched
Markdown first with `mdtablefix docs/developers-guide.md` then
`markdownlint-cli2 --fix docs/developers-guide.md`.

## Concrete steps

All commands run from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-12`.

WI1:

1. Create `tests/static-analysis/workflow-lint.test.ts` with the unit and
   property cases above.
2. Run the focused suite to observe Red:

   ```plaintext
   bun test tests/static-analysis/workflow-lint.test.ts
   # expect: fails to resolve `lintWorkflowSource`
   ```

3. Add `src/static-analysis/workflow-lint.ts` and export it from
   `src/static-analysis/index.ts`.
4. Re-run the focused suite (Green), then format the touched TypeScript files
   and run the gate:

   ```sh
   bunx biome format --write \
     src/static-analysis/workflow-lint.ts \
     src/static-analysis/index.ts \
     tests/static-analysis/workflow-lint.test.ts
   make all
   ```

5. Commit (gated).

WI2:

1. Add the public-consumer assertion to `tests/static-analysis/boundary.test.ts`.
2. Run `make test` to observe the surface guard fail and print the expected
   export list (Red).
3. Add the two names to `tests/diagnostics/public-api-fixtures.ts` and the
   re-export to `src/index.ts`; update `docs/developers-guide.md`.
4. Format the touched files:

   ```sh
   bunx biome format --write \
     src/index.ts \
     tests/diagnostics/public-api-fixtures.ts \
     tests/static-analysis/boundary.test.ts
   mdtablefix docs/developers-guide.md
   markdownlint-cli2 --fix docs/developers-guide.md
   ```

5. Run `make all`, `make markdownlint`, `make nixie`. Commit (gated).

WI3:

1. Capture the parity baseline:
   `bun test tests/static-analysis/invalid-workflow-metadata-parity.test.ts`.
2. Refactor `classifyInvalidFixture` to call `lintWorkflowSource`; update the
   developers' guide reference.
3. Re-run the parity suite; confirm identical pass output.
4. Format touched files (`bunx biome format --write …` for the test;
   `mdtablefix` + `markdownlint-cli2 --fix` for the guide).
5. Run `make all`, `make markdownlint`, `make nixie`. Commit (gated).

## Validation and acceptance

Per work item, the repository gate is authoritative:

- `make all` — runs build, `check-fmt`, whitespace-hygiene, lint, `typecheck`,
  and `test` (per `Makefile:5`). Expect all green.
- `make markdownlint` and `make nixie` — required for WI2 and WI3 because they
  edit `docs/developers-guide.md`. Expect all green.

Behavioural acceptance:

- New `tests/static-analysis/workflow-lint.test.ts` fails before WI1's module
  exists and passes after; the property test proves the merge order invariant.
- `tests/diagnostics/public-api-surface.test.ts` fails before WI2's fixture
  edit (listing the two missing names) and passes after.
- `tests/static-analysis/invalid-workflow-metadata-parity.test.ts` passes
  unchanged before and after WI3 with identical asserted diagnostics.

Quality criteria for "done":

- Tests: all Bun tests pass under `make test`; the new merge invariant is
  pinned by a property test.
- Lint/typecheck: `make lint` and `make typecheck` clean.
- Formatting: `make check-fmt` clean (files formatted with Biome; Markdown with
  mdtablefix + markdownlint-cli2).
- API: the only new public symbols are `lintWorkflowSource` and
  `WorkflowLintResult`; the surface guard reflects exactly those additions.

## Idempotence and recovery

Every step is re-runnable. The new module and test are additive; re-running
`make all` is safe. If a fixture edit puts the export list out of sorted order,
`public-api-surface.test.ts` prints the expected order — re-sort and re-run. If
the parity refactor drifts any assertion, revert the single test-helper change
and escalate (do not adjust assertions to match). No destructive operations are
involved.

## Artefacts and notes

- WI1 Red: `bun test tests/static-analysis/workflow-lint.test.ts` failed after
  `make build` with
  `Cannot find module '../../src/static-analysis/workflow-lint'`.
- WI1 Green: the same focused suite passed with `8 pass, 0 fail`.
- WI1 Gate: `make all` passed locally after fixing import order, private-helper
  JSDoc, and an explicit undefined-diagnostic invariant in the new test.
- WI1 Review: the initial `coderabbit review --agent` returned a recoverable
  rate limit. After `vsleep 79m`, the retry completed with
  `review_completed` and `findings: 0`.
- WI2 Red: `bun test tests/static-analysis/boundary.test.ts` failed with
  `Export named 'lintWorkflowSource' not found in module .../src/index.ts`.
- WI2 Green: the same focused boundary suite passed with `7 pass, 0 fail` after
  adding the root re-export and fixture names.
- WI2 Gate: `make all`, `make markdownlint`, and `make nixie` passed locally
  after formatting only `src/index.ts`,
  `tests/diagnostics/public-api-fixtures.ts`,
  `tests/static-analysis/boundary.test.ts`, and `docs/developers-guide.md`.
- WI2 Review: `coderabbit review --agent` completed with `review_completed` and
  `findings: 0`.
- WI3 Baseline: before the refactor,
  `bun test tests/static-analysis/invalid-workflow-metadata-parity.test.ts`
  passed with `2 pass, 0 fail, 31 expect() calls`.
- WI3 After: after routing through `lintWorkflowSource`, the same parity suite
  passed with `2 pass, 0 fail, 31 expect() calls`.
- WI3 Gate: `make all`, `make markdownlint`, and `make nixie` passed locally.
- WI3 Review: the first `coderabbit review --agent` returned a recoverable rate
  limit. After `vsleep 63m`, the retry completed with `review_completed` and
  `findings: 0`.

## Interfaces and dependencies

New production surface (in `src/static-analysis/workflow-lint.ts`, re-exported
via `src/static-analysis/index.ts` and `src/index.ts`):

```typescript
// src/static-analysis/workflow-lint.ts
export type WorkflowLintResult = {
  readonly sourceFile: OriginalSourceFile;
  readonly scan: WorkflowEnvelopeScanResult;
  readonly classification: WorkflowMetadataClassification;
  readonly diagnostics: readonly Diagnostic[];
};

export const lintWorkflowSource = (source: WorkflowSource) => WorkflowLintResult;
```

Reused, unchanged interfaces:

- `createOriginalSourceFile(source: WorkflowSource): OriginalSourceFile`
  (`src/static-analysis/source-file.ts`).
- `scanWorkflowEnvelope(sourceFile: OriginalSourceFile): WorkflowEnvelopeScanResult`
  (`src/static-analysis/workflow-envelope.ts`).
- `classifyWorkflowMetadata(scanResult: WorkflowEnvelopeScanResult): WorkflowMetadataClassification`
  (`src/static-analysis/workflow-metadata.ts`).

No new external dependencies. Test-only: `bun:test`, `fast-check` (both already
present).

## Revision note

Initial draft (2026-07-02). Decomposes roadmap task 2.1.12 into three gateable
work items: (WI1) add the internal merged entry point with unit + property
tests pinning the canonical merge order; (WI2) promote it to the public package
entry and update the reviewed surface guard and developers' guide; (WI3)
refactor the invalid-workflow parity suite to consume the one call. No prior
design-review points (round 1).

WI1 implementation update (2026-07-02T11:26Z). Added the internal
`lintWorkflowSource` entry point, exported it from `src/static-analysis`, and
covered it with unit, property, freeze, span-slicing, missing-meta,
unsupported-import/export, runtime-invalid metadata, and hostile-metadata
passivity tests. Scrutineer was quota-blocked, so the implementation agent ran
the same deterministic gate and CodeRabbit fallback locally; `make all` passed
and CodeRabbit returned zero findings after the mandated rate-limit backoff.
WI2 and WI3 remain unchanged.

WI2 implementation update (2026-07-02T11:34Z). Promoted
`lintWorkflowSource` and `WorkflowLintResult` through the package entry, updated
the reviewed public API fixture, added a public-boundary consumer assertion, and
documented `lintWorkflowSource` in the developers' guide as the single
envelope-then-metadata diagnostic entry point. The scrutineer role remained
quota-blocked, so deterministic gates and CodeRabbit were run locally as
recorded above. WI3 remains unchanged.

WI3 implementation update (2026-07-02T12:41Z). Refactored
`tests/static-analysis/invalid-workflow-metadata-parity.test.ts` to use
`lintWorkflowSource`, updated the developers' guide parity note, and left the
hostile-metadata security suite unchanged because it does not merge envelope
and metadata diagnostics. Final deterministic gates and CodeRabbit passed with
zero findings.
