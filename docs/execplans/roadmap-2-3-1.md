# Add a minimal loader-parity harness against trusted ODW example snapshots and known invalid fixtures

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 2.3.1 (`docs/roadmap.md`, step 2.3 "Prove ODW loader parity
before shipping dialect checks") asks for a *minimal loader-parity harness*.
Loader parity means: does `odw-lint` accept and reject the same workflow
classes that the real Open Dynamic Workflows (ODW) loader would accept and
reject *before it executes any workflow body*? The technical design
(`docs/technical-design.md` §11.2) makes this release-blocking for the first
dialect slice, not a later hardening task.

After this change a maintainer can run `make test` and see a single reusable
harness that:

1. runs the live static lint pipeline (`lintWorkflowSource`) over every
   trusted ODW example snapshot and proves those examples produce **no dialect
   errors** (§11.2, fourth bullet); and
2. runs the same pipeline over every known invalid fixture and proves each one
   maps to its **expected rule classes and rejection status** (§11.2, first
   bullet — "If ODW would reject a fixture before execution, `odw-lint` must
   report an error").

The harness must never execute a fixture body and must never import an
executable ODW loader, primitive factory, runtime launcher, or worker path
(§11.2 final paragraph and §11.3). It is deliberately *minimal*: dual-compat
parity for `checkMeta`/`scanDualCompat` is roadmap 2.3.2, driving dialect
diagnostic tests from the invalid manifest is 2.3.3, and TypeScript-only body
rejection parity is 2.3.4. This plan builds the shared harness those tasks will
consume; it does not implement them.

Observable success: `make test` passes; the new suite
`tests/static-analysis/loader-parity.test.ts` fails before the harness helper
exists with a compile or resolve error and passes after the helper lands. It
also fails loudly if a trusted example emits a dialect error or a hostile side
effect marker is set while the harness runs.

## Constraints

Hard invariants that must hold throughout implementation. Violation requires
escalation, not a workaround.

- Work occurs only in the git worktree
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-3-1` on branch
  `roadmap-2-3-1`. The root/control checkout is off-limits for edits.
- No production module and no new test/harness module may import an executable
  ODW path. `docs/technical-design.md` §11.3 and the string-based policy in
  `tests/diagnostics/odw-import-policy.ts` (`isForbiddenOdwImport`) define the
  forbidden set — verified by reading that file (lines 8–57) and its fixture
  table in `tests/diagnostics/import-policy.test.ts` (line ~202): bare `odw`;
  the package-scoped paths `odw/src/index`, `odw/src/loader`,
  `odw/src/primitives`, `odw/src/runtime`, `odw/src/runtime/<tail>` and their
  `odw/dist/…` equivalents; and the sibling-checkout equivalents matching
  `…/open-dynamic-workflows/{src,dist}/{index,loader,primitives,runtime,runtime/<tail>}`.
  Extensions `.ts/.mts/.cts/.js` are stripped before matching. Crucially, the
  bare-shortcut lookalikes `odw/index`, `odw/loader`, `odw/primitives`, and
  `odw/runtime` (without the `src/`/`dist/` segment) are classified **not**
  forbidden by the real code — only the `src/`/`dist/`-qualified forms are.
  Any forbidden-edge demonstration must therefore use a genuinely forbidden
  specifier such as `odw/src/loader`, `odw/src/runtime/worker`, or bare `odw`.
  The harness imports only from the `odw-lint` package entry (`src/index.ts`)
  and existing test fixture support.
- The harness must not evaluate, `import()`, `require`, `new Function`, or
  otherwise execute any fixture body (`docs/technical-design.md` §11.2 final
  paragraph, §6.4 "Do not execute source", ADR
  `docs/adr/0001-static-analysis-boundary.md`). It reads fixture text through
  `readFixtureSource` and lints it as passive source only.
- Trusted ODW example fixtures under
  `tests/static-analysis/fixtures/odw-examples/` are read-only upstream
  snapshots. Their bytes and SHA-256 pins in
  `tests/static-analysis/fixtures/odw-examples.ts` must not change. Do not run
  a mutating formatter over them.
- The invalid fixture manifests under
  `tests/static-analysis/fixtures/invalid-workflows/` remain the source of
  truth for expected diagnostics (roadmap 2.3.3 preserves this). This plan
  *reads* them; it must not weaken or edit expectations to make the harness
  pass.
- Public package surface (`src/index.ts` and `package.json` `exports`) must
  stay stable; this plan adds test-only code, not new exports.
- en-GB Oxford spelling ("-ize"/"-yse"/"-our") in all prose, comments, and
  commit messages (`AGENTS.md` "Code Style and Structure", `en-gb-oxendict`).
- Every new or modified code file in this task stays at or below 400 lines and
  every new or modified module opens with a `/** @file … */` block (`AGENTS.md`
  "Keep file size manageable", "TypeScript Guidance → Docs").

## Tolerances (exception triggers)

- Scope: if delivery needs to touch more than 8 files or add more than ~320
  net lines, stop and escalate.
- Interface: if any change to `src/` production code or the public export
  surface becomes necessary, stop and escalate (this task is test-only by
  design).
- Parity divergence: if a trusted ODW example produces **any** live dialect
  error, or an invalid fixture's live output is missing a manifest rule class,
  stop and escalate. Extra collateral diagnostics from the broader lint pass
  are allowed only when the aggregate outcome snapshot records them and the
  manifest rejection class remains present.
- Dependencies: if a new runtime or dev dependency seems required, stop and
  escalate. Everything needed (`bun:test`, `fast-check`, `odw-lint` entry,
  existing fixture helpers) is already present.
- Iterations: if `make all` still fails after 3 focused fix attempts on the
  same item, stop and escalate.
- Ambiguity: if "expected rule classes" needs a definition beyond "the set of
  rule ids the manifest expects", stop and present options.

## Risks

- Risk: a trusted example emits a live diagnostic the empty manifest does not
  record (for example a deterministic-time compat warning).
  Severity: medium; Likelihood: low.
  Mitigation: verified by inspection that no example fixture contains
  `Date.now`, `Math.random`, `new Date`, or `performance.now`; every example's
  only export is the sanctioned `export const meta` envelope. The example
  assertion therefore expects zero dialect errors and matches the recorded
  `no-error` status. If a live diagnostic still appears, the Tolerance above
  fires (escalate).
- Risk: the harness accidentally overlaps the existing task-owned parity suite
  `tests/static-analysis/invalid-workflow-metadata-parity.test.ts`, creating
  duplicate/competing expectations.
  Severity: low; Likelihood: medium.
  Mitigation: that suite deliberately filters to the *task 2.1.3* rule subset
  plus body-syntax; the new harness asserts live status and the manifest rule
  classes that must be present in the whole pipeline. The Decision Log records
  the boundary so reviewers see they are complementary, not redundant.
- Risk: the harness is perceived as re-implementing 2.3.2/2.3.3/2.3.4.
  Severity: low; Likelihood: medium.
  Mitigation: scope the harness to status + rule-class-set parity only; do not
  import `checkMeta`/`scanDualCompat`, do not restructure dialect tests, do not
  probe TypeScript-only bodies. Document the deferral explicitly.
- Risk: `tests/build-gate/documentation-contents.test.ts` pins developers-guide
  content and fails when the loader-parity paragraph changes.
  Severity: low; Likelihood: medium.
  Mitigation: read that test before editing docs and keep any pinned phrases
  intact or update the test in the same commit (see Concrete steps).

## Progress

- [x] WI-1: Add the shared loader-parity harness helper and prove trusted ODW
  examples emit no dialect errors.
- [x] WI-2: Extend the harness suite to known invalid fixtures and prove
  rejection-status and rule-class parity.
- [x] WI-3: Prove harness inertness — no body execution, no side effects, no
  forbidden ODW import.
- [x] WI-4: Document the harness and reconcile the developers guide and
  roadmap.

## Surprises & Discoveries

- Observation: `tests/static-analysis/odw-example-fixtures.test.ts` validates
  the example *manifest* (paths, hashes, `expectedStatus: "no-error"`) but
  never runs `lintWorkflowSource` over the example bytes, so nothing today
  proves the live pipeline is clean on trusted source.
  Evidence: that file's assertions read `fixture.expectedStatus` /
  `fixture.expectedDiagnostics` only; there is no `lintWorkflowSource` call.
  Impact: this is precisely the gap WI-1 closes; it is why 2.3.1 is a distinct
  task rather than already-covered by the corpus tests.
- Observation: GrepAI was available for main-branch intent search, and branch
  facts were verified directly inside the assigned worktree.
  Evidence: `grepai search --workspace 'Projects' --project 'odw-lint'
  "minimal loader parity harness trusted ODW example roadmap 2.3.1" --toon
  --compact` returned relevant canonical-main context; branch-local code and
  fixtures were then inspected with `leta` and direct file reads.
  Impact: the required main-branch intent pass succeeded, while the harness
  remains grounded in current worktree files and never imports live ODW runtime
  code.
- Observation: WI-1 Red/Green behaved as planned. With
  `tests/static-analysis/loader-parity.test.ts` importing the not-yet-created
  helper, `bun test tests/static-analysis/loader-parity.test.ts` failed with
  `Cannot find module './fixtures/loader-parity'`; after adding
  `tests/static-analysis/fixtures/loader-parity.ts`, the focused suite passed
  with 11 tests and later 13 tests after review hardening.
  Impact: the harness has an observable failing stage and now pins non-empty
  trusted-example coverage plus reducer rule-class de-duplication.
- Observation: adding the new ExecPlan file required indexing it from
  `docs/contents.md` before `make all` could pass, because
  `tests/build-gate/documentation-contents.test.ts` checks every top-level
  ExecPlan link.
  Impact: `docs/contents.md` is intentionally included in WI-1 even though the
  plan originally expected most documentation reconciliation in WI-4.
- Observation: WI-2 exposed a deliberate manifest/live-pipeline distinction for
  `unsupported-import-export/extra-export-const.js`: the live pipeline reports
  both `odw/no-import-export` and parser fallout via `odw/body-syntax`, while
  the generated invalid manifest remains unchanged and records only the
  rejection class owned by that fixture family.
  Evidence: the first focused WI-2 run failed exact equality on the extra
  `odw/body-syntax` rule; `bun tests/static-analysis/fixtures/refresh-metadata.ts
  --dry-run` reported no would-write paths and 16 invalid diagnostics.
  Impact: the harness now requires live status to equal the manifest status and
  requires all manifest rule classes to be present. This preserves the
  manifest as the ODW rejection contract without making 2.3.1 own collateral
  diagnostics that 2.3.3 will consolidate.
- Observation: WI-3 proved the import-policy detector itself with
  `isForbiddenOdwImport("odw/src/loader") === true` and the documented
  bare-shortcut lookalike with `isForbiddenOdwImport("odw/loader") === false`
  before applying the detector to real harness import edges.
  Impact: the inertness test guards against accidental executable ODW imports
  while preserving the current string-policy contract.

## Decision Log

- Decision: define "expected rule classes" as the sorted, de-duplicated set of
  rule ids the fixture manifest declares (`InvalidWorkflowFixtureDiagnostic.rule`
  for invalid fixtures; empty for `no-error` examples), paired with the
  manifest `expectedStatus`.
  Rationale: matches the manifest contract in
  `tests/static-analysis/fixtures/invalid-workflows/manifest-types.ts`, keeps
  the minimal harness free of span/message coupling (that already lives in the
  fixture and metadata-parity suites), and gives a clean equality assertion.
  Date/Author: 2026-07-05, planning agent.
- Decision: the example assertion checks for zero **dialect-error** diagnostics
  and equality to the recorded `no-error` status, not zero diagnostics of every
  category.
  Rationale: §11.2's fourth bullet is worded "must not report dialect errors";
  scoping to dialect errors keeps compat-warning parity (§9.2) as 2.3.2's job
  while still proving the examples are clean today (verified: no compat-warning
  triggers present).
  Date/Author: 2026-07-05, planning agent.
- Decision: build one shared harness module consumed by example and invalid
  assertions rather than two ad-hoc test bodies.
  Rationale: the task literally asks for a "harness"; a single parity relation
  is DRY and is the reuse surface 2.3.2–2.3.4 will extend.
  Date/Author: 2026-07-05, planning agent.
- Decision: keep reducer assertions semantic and snapshot-backed only at the
  compact outcome boundary.
  Rationale: status, rule-class set, dialect-error set, and non-empty corpus
  coverage remain the primary invariant. Inline snapshots on the tiny reducer
  shape add drift visibility without coupling the fixture corpus to noisy
  full-diagnostic output.
  Date/Author: 2026-07-05, implementation agent.
- Decision: keep the assigned absolute worktree path in `Constraints`.
  Rationale: the automated roadmap workflow's standing instruction requires
  agents to work exclusively inside that exact git-donkey worktree. The
  ExecPlan remains portable for future humans through repository-relative file
  paths in implementation steps, but this run's safety boundary is deliberately
  absolute.
  Date/Author: 2026-07-05, implementation agent.
- Decision: invalid-fixture loader parity requires manifest rule classes to be
  present, not exact equality with every live lint rule class.
  Rationale: the invalid manifests are generated, stable fixture-family
  contracts; the live pipeline may legitimately add collateral parser
  diagnostics while still rejecting for the manifest class. Exact rule-set
  equality would make roadmap 2.3.1 own later manifest-driven diagnostic
  consolidation that is explicitly deferred to 2.3.3.
  Date/Author: 2026-07-05, implementation agent.

## Outcomes & Retrospective

WI-1 delivered the shared `loaderParityOutcome` reducer and trusted-example
proof. The reducer uses the public `odw-lint` static pipeline, derives status
from diagnostic severities, exposes sorted unique rule classes and dialect
error rules, and stays below the file-size limit. The focused reducer tests
prove valid inline source, invalid inline metadata, duplicate rule-class
de-duplication, and warning/error ordering. The trusted-example block proves a
non-empty ODW example corpus and zero dialect errors for every trusted example.

WI-2 extended the suite to every invalid workflow fixture. Live outcomes now
must match manifest status, must include every manifest rule class, must keep
warning-only fixtures out of `dialectErrorRules`, and must map every
error-status fixture to at least one dialect-error rule. The focused run covers
16 invalid fixtures, records a compact snapshot of outcome rows, and documents
the one known collateral-diagnostic case.

WI-3 added the inertness proof. Hostile metadata fixtures remain passive under
the loader-parity harness, the global hostile marker stays unset, computed
dynamic imports and CommonJS requires are absent from the harness sources, and
the existing forbidden ODW import detector finds no executable ODW import edge.

WI-4 reconciled the developer guide and roadmap. The developer guide now names
the harness files, the parity relation, the inertness guarantees, and the
explicit deferrals to roadmap tasks 2.3.2 through 2.3.4. `docs/roadmap.md`
marks 2.3.1 complete and `docs/contents.md` indexes this ExecPlan.

## Context and orientation

`odw-lint` is a private TypeScript/Bun static analyser for ODW workflow files.
It parses workflow source **without executing it** and emits diagnostics. Key
files a newcomer needs:

- `src/static-analysis/workflow-lint.ts` — exports `lintWorkflowSource(source)`
  returning `WorkflowLintResult` with `.diagnostics` (canonical merged order:
  envelope, metadata, body-syntax, Claude-compat), `.sourceFile`, `.scan`,
  `.classification`. This is the single pipeline the harness drives.
- `src/index.ts` — the only consumer-facing surface. It re-exports
  `lintWorkflowSource`, `sliceSourceSpan`, `RULE_CATALOGUE`,
  `ruleDefinitionFor`, `ruleDocsPath`, the `Diagnostic`/`SourceSpan` types, and
  more. Tests import from `"odw-lint"`, never from deep paths.
- `tests/static-analysis/fixtures/corpus-support.ts` — `readFixtureSource`,
  `fixtureSourceUrl`, `copiedFixtureFileNames`, `sha256`. Reads fixture text
  passively.
- `tests/static-analysis/fixtures/odw-examples.ts` — frozen
  `ODW_EXAMPLE_FIXTURE_SNAPSHOTS` (nine upstream examples), each with
  `fixturePath`, `sha256`, `expectedStatus: "no-error"`, and empty
  `expectedDiagnostics`.
- `tests/static-analysis/fixtures/invalid-workflows.ts` — frozen
  `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS` across families `missing-metadata`,
  `malformed-metadata`, `hostile-metadata`, `unsupported-import-export`,
  `syntax-error`. Types in
  `tests/static-analysis/fixtures/invalid-workflows/manifest-types.ts`:
  `expectedStatus` is `"error" | "warning"`; each expected diagnostic carries
  `rule`, `severity`, `message`, `docs`, `span`, `spanText`.
- `tests/static-analysis/invalid-workflow-metadata-parity.test.ts` — existing
  parity suite scoped to the **task 2.1.3 rule subset** plus body-syntax. The
  new harness checks live whole-pipeline status and required manifest rule
  classes; it is complementary, not a replacement.
- `tests/static-analysis/hostile-metadata-security.test.ts` — existing
  no-side-effect regression for hostile fixtures; WI-3 reuses its marker
  approach rather than duplicating it.
- `tests/diagnostics/odw-import-policy.ts` (`isForbiddenOdwImport`) and
  `tests/diagnostics/import-edge-extraction.ts` — the string-based forbidden-
  import classifier and its import-edge extractor, reused by WI-3 to prove the
  harness has no forbidden ODW import edge.
- `docs/developers-guide.md` line ~544: "Loader-parity execution remains owned
  by roadmap task 2.3.1." — the sentence WI-4 replaces with the delivered
  description.

Terms: a **dialect error** is a §9.1 error-severity diagnostic (metadata,
import/export, body-syntax) that means ODW would reject the file before
execution. A **compat warning** is a §9.2 warning (for example
deterministic-time) — out of scope for this minimal harness. A **rule class**
here is a rule id such as `odw/meta-required`.

Design references: `docs/technical-design.md` §§5, 6.4, 9.1, 11.2, 11.3, 11.5;
ADR `docs/adr/0001-static-analysis-boundary.md`; `AGENTS.md` "Change Quality &
Committing" and "Testing".

## Plan of work

Four ordered, independently committable work items. Each ends with the commit
gate green.

### WI-1: Shared harness helper + trusted-example parity proof

Implements `docs/technical-design.md` §11.2 (fourth bullet — examples valid →
no dialect errors; final paragraph — helpers must be static), §5 and §6.4 and
ADR 0001 (no execution). Testing rules from `AGENTS.md` "Testing".

Docs to read first: `docs/technical-design.md` §§11.2, 5, 6.4; ADR 0001;
`AGENTS.md` "TypeScript Guidance" and "Testing"; `docs/developers-guide.md`
lines ~155–195 and ~535–560. Skills to load: `execplans` (this file),
`python-router` is **not** applicable; load the TypeScript-relevant guidance in
`AGENTS.md` directly (no Rust/Python router applies), `leta` for symbol
navigation, `hypothesis`/`crosshair`/`mutmut` are Python-only so they do **not**
apply — for TypeScript invariant coverage use `fast-check` as `AGENTS.md`
"Invariant testing" directs.

New file `tests/static-analysis/fixtures/loader-parity.ts` (harness helper,
test-only, ≤ 400 lines, `/** @file … */` header):

- Export a small pure reducer, for example
  `loaderParityOutcome(source: WorkflowSource): LoaderParityOutcome` where
  `LoaderParityOutcome` is an interface with `readonly status: "no-error" |
  "warning" | "error"`, `readonly ruleClasses: readonly string[]`, and
  `readonly dialectErrorRules: readonly string[]`. It calls
  `lintWorkflowSource(source)`, derives `status` from the highest severity
  present (`error` > `warning` > `no-error`), and derives `ruleClasses` as the
  sorted unique set of `String(diagnostic.rule)`; `dialectErrorRules` is the
  sorted unique set of rule ids whose severity is `error`.
- Export `expectedNoErrorOutcome()` returning
  `{ status: "no-error", ruleClasses: [], dialectErrorRules: [] }` for reuse by
  the example assertion.
- Import only from `"odw-lint"` and `./corpus-support`. No ODW runtime import;
  no body execution.

New file `tests/static-analysis/loader-parity.test.ts`:

- A focused unit `describe` for the reducer itself, driving it with inline
  passive source strings (a valid `export const meta = { name: "x",
  description: "y" };\nreturn agent("ok");\n` → `no-error`; a
  `export const meta = {};\n` style invalid source → `error` with the expected
  metadata rule id) so the reducer's status/rule-class derivation is proven in
  isolation, not only through fixtures.
- A `describe("trusted ODW example loader parity")` that iterates
  `ODW_EXAMPLE_FIXTURE_SNAPSHOTS`, reads each via `readFixtureSource`, runs
  `loaderParityOutcome`, and asserts `dialectErrorRules` is empty and `status`
  equals the manifest `expectedStatus` (`"no-error"`).

Red/Green/Refactor: Red — add `loader-parity.test.ts` importing the not-yet-
created `./fixtures/loader-parity` helper and run the focused file; it fails to
resolve/compile (documented expected failure). Green — add the helper; the
focused file passes. Refactor — extract any shared shaping, rerun the focused
file and `make test`.

### WI-2: Invalid-fixture rejection-class parity

Implements `docs/technical-design.md` §11.2 (first bullet — ODW would reject →
`odw-lint` reports an error) and §11.5 (spans stay in original source — the
harness must not disturb this; it reuses `lintWorkflowSource` output). Testing
rules from `AGENTS.md` "Testing".

Docs to read first: `docs/technical-design.md` §§11.2, 9.1, 11.5;
`tests/static-analysis/fixtures/invalid-workflows/manifest-types.ts`;
`tests/static-analysis/invalid-workflow-metadata-parity.test.ts` (to keep the
boundary clear). Skills: `leta` for navigating the manifest types and existing
parity suite; `fast-check` (per `AGENTS.md` "Invariant testing") only if a
property angle is warranted — otherwise a table-driven fixture iteration is the
correct shape for a small finite set.

In `tests/static-analysis/loader-parity.test.ts` add
`describe("invalid fixture loader parity")` that iterates
`INVALID_WORKFLOW_FIXTURE_SNAPSHOTS`. For each fixture: derive the expected
outcome from the manifest (sorted unique set of `String(d.rule)` over
`expectedDiagnostics`, plus `expectedStatus`), run `loaderParityOutcome` on the
fixture source, and assert live `status` equals `expectedStatus` and live
`ruleClasses` contains the manifest rule-class set. Add one assertion that every
error-status fixture yields a non-empty `dialectErrorRules` (the §11.2 first
bullet: ODW-rejected → `odw-lint` error), and that warning-only fixtures (for
example `hostile-metadata` → `odw/meta-statically-unprovable`) carry the
warning class without a dialect error.

Red/Green/Refactor: Red — first wire the assertion against a deliberately wrong
expected set (for example append a bogus rule id) and run the focused file to
observe it fail for the intended reason; record the transcript. Green — switch
to the manifest-derived expected set and rerun; it passes. Refactor — fold the
manifest→outcome mapping into a named helper in `loader-parity.ts`, rerun the
focused file and `make test`. (RGR-by-mutation is used because this is
characterization parity over existing behaviour; documented per the `execplans`
skill's "nearest observable substitute" allowance.)

### WI-3: Harness inertness proof

Implements `docs/technical-design.md` §11.2 (parity tests must not execute
fixture body code; may import only static helpers) and §11.3 (no executable ODW
import), and ADR 0001 boundary. Testing rules from `AGENTS.md` "Testing".

Docs to read first: `docs/technical-design.md` §§11.2, 11.3;
`tests/diagnostics/odw-import-policy.ts`;
`tests/diagnostics/import-edge-extraction.ts`;
`tests/static-analysis/hostile-metadata-security.test.ts`. Skills: `leta` to
locate `isForbiddenOdwImport` and the import-edge extractor and confirm their
signatures before reuse; `code-review` heuristics for the no-duplication check
against the existing hostile-metadata suite.

Add to `tests/static-analysis/loader-parity.test.ts` (or a sibling
`loader-parity-inertness.test.ts` if the primary file approaches the 400-line
limit) a `describe("loader-parity harness inertness")` with:

- A side effect guard: clear the hostile marker, run `loaderParityOutcome` over
  every `hostile-metadata` fixture, and assert the global marker stays
  `undefined` afterwards (reuse the marker property name and helper style from
  `hostile-metadata-security.test.ts`; do not re-implement the fixture reading
  it already owns — call the harness, then assert inertness).
- A static import-hygiene assertion: read the harness source files
  (`tests/static-analysis/fixtures/loader-parity.ts` and the test file) via the
  existing import-edge extractor and assert `isForbiddenOdwImport` returns
  `false` for every extracted specifier, proving the harness never reaches an
  executable ODW path.

Red/Green/Refactor: Red — write the import-hygiene assertion first against a
temporary throwaway string list containing a genuinely forbidden specifier such
as `"odw/src/loader"` (verified `isForbiddenOdwImport` returns `true` for it;
the bare-shortcut `"odw/loader"` returns `false` and would NOT trip the
assertion — see Constraints) to confirm the assertion detects a forbidden edge
(observe failure), then point it at the real extracted edges. Green — real edges
are clean, assertion passes. Refactor — tidy helper names, rerun focused file and
`make test`.

### WI-4: Documentation and roadmap reconciliation

Implements `AGENTS.md` "Documentation Maintenance" and `docs/technical-design.md`
§11.2 (record where the release-blocking parity check now lives). No code
behaviour change.

Docs to read first: `docs/developers-guide.md` lines ~535–560 (the
loader-parity paragraph) and ~155–195; `docs/documentation-style-guide.md`;
`tests/build-gate/documentation-contents.test.ts` (to avoid breaking a pinned
phrase). Skills: `en-gb-oxendict` for spelling; `changelog` does not apply (no
CHANGELOG in scope); `execplans` for keeping this file current.

- Edit `docs/contents.md` if this ExecPlan is not already indexed.
- Edit `docs/developers-guide.md`: replace "Loader-parity execution remains
  owned by roadmap task 2.3.1. …" with a present-tense description naming
  `tests/static-analysis/loader-parity.test.ts` and
  `tests/static-analysis/fixtures/loader-parity.ts`, the parity relation
  (status + rule-class set), the example-vs-invalid split, the inertness
  guarantees, and the explicit deferral of `checkMeta`/`scanDualCompat` parity
  to 2.3.2, manifest-driven dialect tests to 2.3.3, and TypeScript-only body
  parity to 2.3.4. Wrap prose at 80 columns.
- If `tests/build-gate/documentation-contents.test.ts` pins any edited phrase,
  update its expectation in the same commit.
- Edit `docs/roadmap.md`: flip `- [ ] 2.3.1.` to `- [x] 2.3.1.` (leaf task
  only; do not touch 2.3.2–2.3.4).
- Update this ExecPlan's `Progress`, `Decision Log`, and
  `Outcomes & Retrospective`, then append the required revision note.

## Concrete steps

Run everything from the worktree
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-3-1`.

1. WI-1 Red:

   ```sh
   bun test tests/static-analysis/loader-parity.test.ts
   ```

   Expect a resolve/compile failure referencing the missing
   `./fixtures/loader-parity` module.

2. WI-1 Green: add `tests/static-analysis/fixtures/loader-parity.ts`, rerun the
   focused command; expect the reducer unit and the nine-example describe to
   pass.

3. WI-1 gate + commit:

   ```sh
   make all
   ```

   Expect build, `check-fmt`, `whitespace-hygiene`, `lint`, `typecheck`, and
   `test` to pass. Commit (imperative subject, e.g. "Add loader-parity harness
   and prove trusted examples clean").

4. WI-2: add the invalid-fixture describe (Red-by-mutation, then Green), rerun
   `bun test tests/static-analysis/loader-parity.test.ts`, then `make all`,
   then commit.

5. WI-3: add the inertness describe (Red-by-mutation on a genuinely forbidden
   specimen — e.g. `"odw/src/loader"`, `"odw/src/runtime/worker"`, or bare
   `"odw"`; NOT the bare-shortcut `"odw/loader"`, which the real classifier
   passes as clean — then Green), rerun the focused file, then `make all`, then
   commit.

6. WI-4: edit docs, then run the documentation gates and commit:

   ```sh
   make markdownlint
   make nixie
   make all
   ```

   Before committing docs, format only the files this item changed:

   ```sh
   bunx mdtablefix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-2-3-1.md
   bunx markdownlint-cli2 --fix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-2-3-1.md
   ```

   Every listed path exists at this point (all three are edited in this item),
   so the formatter command is path-safe. Do not run a repo-global format.

## Validation and acceptance

Commit gate for every work item (`AGENTS.md` "Change Quality & Committing";
`make all` aggregates `build check-fmt whitespace-hygiene lint typecheck test`
per the Makefile `all:` target):

```sh
make all
```

Markdown-changing work item (WI-4) additionally runs:

```sh
make markdownlint
make nixie
```

Red-Green-Refactor evidence to capture in `Progress`/`Surprises`:

- WI-1 Red: `bun test tests/static-analysis/loader-parity.test.ts` fails to
  resolve `./fixtures/loader-parity`. Green: same command passes after adding
  the helper.
- WI-2 Red: focused file fails when the expected rule-class set is deliberately
  wrong (observed once, then reverted). Green: passes against the manifest-
  derived set.
- WI-3 Red: import-hygiene assertion flags an injected, genuinely forbidden
  specimen — `"odw/src/loader"` (or `"odw/src/runtime/worker"` / bare `"odw"`).
  Do NOT use `"odw/loader"`: `isForbiddenOdwImport` returns `false` for that
  bare-shortcut lookalike (verified against
  `tests/diagnostics/odw-import-policy.ts`), so it could not produce the Red.
  Green: real extracted edges are clean.

Acceptance (behaviour a human can verify):

- Running `make test` shows `tests/static-analysis/loader-parity.test.ts`
  passing with: a reducer unit block; a nine-example block asserting zero
  dialect errors and `no-error` status; an invalid-fixture block asserting
  status equality and manifest rule-class presence; and an inertness block
  asserting no hostile marker is set and no forbidden ODW import edge exists.
- Corrupting a trusted example fixture byte (locally, then reverted) makes the
  SHA pin in the existing corpus test fail and, if bytes change the diagnostics,
  makes the harness example block fail — proving the harness has teeth.
- No production file under `src/` changed; `git diff --stat` shows only test
  and docs files.

Quality criteria for "done":

- Tests: the four `loader-parity` describes pass; the whole `make test` suite
  stays green.
- Lint/typecheck: `make lint` and `make typecheck` clean (part of `make all`).
- Formatting: `make check-fmt` clean; markdown gates green for WI-4.
- Boundary: the new modules import only `"odw-lint"` and existing fixture
  helpers; `isForbiddenOdwImport` is `false` for every harness import edge.

## Idempotence and recovery

Each work item is a separate commit and re-runnable. `make all` is idempotent.
If a focused test is left red, re-run `bun test
tests/static-analysis/loader-parity.test.ts` after fixing; nothing here mutates
tracked fixtures or global state (the inertness block clears and re-checks the
hostile marker). To abandon uncommitted implementation files, remove the
specific untracked files named in `git status --short` (for example with
`git clean -fd -- tests/static-analysis/loader-parity.test.ts
tests/static-analysis/fixtures/loader-parity.ts` after verifying the path list)
and use `git restore -- <tracked-paths>` only for tracked files; no external
state is touched.

## Artifacts and notes

Tooling notes from implementation:

- GrepAI main-branch intent search succeeded for the loader-parity harness
  query. Branch-local facts were verified inside this worktree with `leta`,
  focused file reads, and focused Bun test runs.
- A later `leta grep` call closed unexpectedly after the workspace had already
  been added and relevant symbols had been inspected. The task was not blocked;
  exact branch-local file inspection supplied the remaining evidence.
- No live ODW import was needed or permitted (§11.2/§11.3); ODW's static
  rejection classes are captured in the in-repo invalid manifests and
  `docs/technical-design.md` §§9.1, 11.2. TypeScript-only body-compilation
  parity remains roadmap 2.3.4.

Verified facts underpinning the plan:

- `lintWorkflowSource` merges diagnostics in canonical order and is exported
  from `src/index.ts` (`src/static-analysis/workflow-lint.ts`).
- Example fixtures contain no `Date.now`/`Math.random`/`new Date`/
  `performance.now`; each exports only `meta` — so zero live diagnostics are
  expected (verified by grep over
  `tests/static-analysis/fixtures/odw-examples/`).
- Invalid manifest statuses are exactly `{"error","warning"}`; hostile-metadata
  maps to the `odw/meta-statically-unprovable` warning class, so the harness
  keys parity off the manifest status, not a blanket "invalid ⇒ error".

## Interfaces and dependencies

New test-only module `tests/static-analysis/fixtures/loader-parity.ts` must
export at least:

```typescript
import type { WorkflowSource } from "odw-lint";

export interface LoaderParityOutcome {
  readonly status: "no-error" | "warning" | "error";
  readonly ruleClasses: readonly string[];
  readonly dialectErrorRules: readonly string[];
}

export const loaderParityOutcome: (source: WorkflowSource) => LoaderParityOutcome;
export const expectedNoErrorOutcome: () => LoaderParityOutcome;
```

Dependencies (all already present): `bun:test`, the `odw-lint` package entry
(`lintWorkflowSource`, `Diagnostic`, `SourceSpan`, `WorkflowSource`), the
fixture helpers in `tests/static-analysis/fixtures/corpus-support.ts`, the
manifests `ODW_EXAMPLE_FIXTURE_SNAPSHOTS` and
`INVALID_WORKFLOW_FIXTURE_SNAPSHOTS`, and for WI-3 the reused
`isForbiddenOdwImport` and import-edge extractor from `tests/diagnostics/`.
`fast-check` is available if an invariant angle is chosen, but a table-driven
fixture iteration is the expected shape for this finite corpus.

## Revision note

Initial draft (2026-07-05). Establishes the minimal loader-parity harness as
four ordered, test-and-docs-only work items keyed to `docs/technical-design.md`
§§11.2, 11.3 and ADR 0001, with example parity, invalid-fixture rejection
parity, inertness, and documentation as separable commits. No implementation
performed; awaiting approval.

Revision 2 (2026-07-05, planning round 2). Corrected two blocking design-review
defects about the forbidden-import boundary, both verified by reading
`tests/diagnostics/odw-import-policy.ts` (lines 8–57) and its fixture table in
`tests/diagnostics/import-policy.test.ts` (line ~202):

1. The WI-3 Red demonstration previously injected `"odw/loader"` as the
   forbidden specimen. `isForbiddenOdwImport("odw/loader")` in fact returns
   `false` (it slices to `"loader"`, which is not in
   `FORBIDDEN_PRIVATE_ODW_MODULES` = {`src/index`, `dist/index`, `src/loader`,
   `dist/loader`, `src/primitives`, `dist/primitives`} and is not a `src/dist`
   runtime path), so the Red could never fail. Replaced every reference (WI-3
   body, Concrete steps §5, Validation "WI-3 Red") with genuinely forbidden
   specimens — `"odw/src/loader"`, `"odw/src/runtime/worker"`, or bare `"odw"`.
2. The Constraints section mis-stated the forbidden set as including the
   bare-shortcuts `odw/index`, `odw/loader`, `odw/primitives`, `odw/runtime*`.
   The real classifier treats those (without the `src/`/`dist/` segment) as
   not-forbidden lookalikes. Rewrote the enumeration to the true set: bare
   `odw`, the `odw/src/…` and `odw/dist/…` qualified paths, and the sibling
   `…/open-dynamic-workflows/{src,dist}/…` equivalents, with the lookalike
   exclusion stated explicitly. No implementation performed; awaiting approval.

Revision 3 (2026-07-05, WI-1 implementation). Added
`tests/static-analysis/fixtures/loader-parity.ts` and
`tests/static-analysis/loader-parity.test.ts` to drive the public
`lintWorkflowSource` pipeline over passive source. Recorded the Red/Green
evidence, CodeRabbit follow-up decisions, and the `docs/contents.md` index
update needed by the documentation freshness gate. Deterministic gates
`make all`, `make markdownlint`, and `make nixie` passed before review, and
again after review fixes.

Revision 4 (2026-07-05, completion). Finished WI-2 through WI-4 in the same
harness surface: invalid workflow fixtures now assert manifest status and
required manifest rule-class presence, warning/error buckets are pinned,
hostile fixtures prove no marker side effect, and import-edge extraction proves
the harness has no executable ODW import. The developer guide now names the
delivered harness and the roadmap marks 2.3.1 complete. Focused
`bun test tests/static-analysis/loader-parity.test.ts` passed with 36 tests and
one aggregate invalid-outcome snapshot after the final CodeRabbit trivial
snapshot request was addressed.
