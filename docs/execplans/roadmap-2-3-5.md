# Consolidate fixture corpus and parity projection ownership (roadmap 2.3.5)

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint` tests read two committed fixture corpora — trusted ODW example
workflows under `tests/static-analysis/fixtures/odw-examples/` and deliberately
invalid workflows under `tests/static-analysis/fixtures/invalid-workflows/` —
to prove loader parity, parser behaviour, envelope scanning, metadata
classification, and deterministic-time warnings (see
[technical-design.md](../technical-design.md) §§11.1–11.3). Today the invalid
corpus already has a single owner module
(`tests/static-analysis/fixtures/invalid-workflows/corpus.ts`, exporting
`INVALID_WORKFLOW_FIXTURE_CORPUS`), but the valid ODW-example corpus does not:
six test files each hand-write their own `new URL("./fixtures/odw-examples/",
import.meta.url)` location literal, and one file
(`loader-parity.test.ts`) also re-inlines the invalid-corpus location instead of
importing the existing owner. Separately, three suites each hand-roll a
near-identical "project a diagnostic to a comparable `{rule, severity, message,
docs, span, spanText}` shape" helper, so the manifest-to-comparison contract has
forked three ways.

After this change a reader can point at exactly one owner module per corpus and
exactly one shared diagnostic-projection module, and a build-gated architecture
test fails if anyone reintroduces an inline corpus-location literal in a
hand-written test. Observable success:

- `make all` passes with every ODW-example and invalid-workflow corpus consumer
  importing its owner module; `grep -rn 'new URL("./fixtures/odw-examples/'
  tests` returns only the owner module and generated manifest.
- A new architecture meta-test
  (`tests/static-analysis/fixture-corpus-ownership.test.ts`) fails before the
  routing is complete (proven against a crafted inline-literal sample) and
  passes after, and it fails if a new inline corpus-location literal is added to
  any hand-written corpus-consuming test.
- The three manifest-parity suites compare through one shared projection helper
  in `tests/static-analysis/fixtures/diagnostic-projection.ts`, exercised by its
  own unit tests.

This is release-relevant plumbing: 2.3.5 is a prerequisite for shipping the
`check` command test surface (roadmap step 2.4) on a single reviewed corpus
contract, and it protects the loader-parity release gate
([technical-design.md](../technical-design.md) §11.2) from silent corpus
divergence.

## Constraints

Hard invariants that must hold throughout implementation.

- Static-analysis boundary ([ADR 0001](../adr/0001-static-analysis-boundary.md);
  [technical-design.md](../technical-design.md) §§5, 6.4, 11.3): no new module
  may import, evaluate, execute, or format fixture workflow source. New owner and
  projection modules read fixtures only as passive UTF-8 text via the existing
  `readFixtureSource`/`fixtureSourceUrl` helpers in
  `tests/static-analysis/fixtures/corpus-support.ts`. No production `src/` module
  may import test fixtures; all new modules live under `tests/`.
- The loader-parity harness inertness contract in `loader-parity.test.ts` (the
  `discoverHarnessSourceFiles` import-edge audit and the hostile-metadata marker
  assertions) must keep passing unchanged: any module newly imported into the
  harness graph must itself contain no forbidden ODW import edges and no computed
  dynamic imports.
- Do not modify the fixture-metadata generator
  (`tests/static-analysis/fixtures/refresh-manifest-source.ts`) or the generated
  manifest files `tests/static-analysis/fixtures/odw-examples.ts` and
  `.../invalid-workflows/manifests/*.ts`. Those files are machine-owned and
  snapshot-pinned by `fixture-metadata-refresh-manifest-source.test.ts`; changing
  them forces a generator/snapshot churn that is out of scope for 2.3.5. See
  Decision Log entry 2026-07-05-A.
- Preserve every existing fixture manifest value (paths, SHA-256 digests, spans,
  `spanText`, expected diagnostics). This task moves *location* and *projection*
  ownership only; it changes no expected diagnostic data.
- No single code file exceeds 400 lines (AGENTS.md "Keep file size manageable").
- en-GB Oxford spelling ("-ize"/"-yse"/"-our") in all prose, comments, and commit
  messages (AGENTS.md; [documentation-style-guide.md](../documentation-style-guide.md)).
- No trailing whitespace (the `whitespace-hygiene` gate inside `make all`).
- Masking fixtures (`tests/static-analysis/fixtures/masking/`) are out of scope:
  they are `odw-lint`-owned synthetic decoys, not an ODW-parity corpus. The new
  guard must be scoped to the `odw-examples` and `invalid-workflows` corpora and
  must not flag the masking corpus. The guard achieves this with a single
  URL-path-segment detector (no property-key pattern), so the masking corpus is
  exempt by construction and `make all` stays green at the WI-4 commit. See
  Decision Log entries 2026-07-05-B and 2026-07-05-D.

## Tolerances (exception triggers)

Stop and escalate rather than working around these.

- Scope: if completing the routing requires touching more than 12 files
  (excluding this ExecPlan and snapshots), stop and escalate.
- Generator: if any work item appears to require editing
  `refresh-manifest-source.ts` or regenerating a `*.ts` manifest, stop and
  escalate — that is a signal the design has drifted from Decision Log 2026-07-05-A.
- Interface: if the shared `FixtureCorpusLocation` interface in
  `corpus-support.ts` must change shape (not merely be re-exported), stop and
  escalate.
- Snapshot churn: if any change reorders or rewrites an existing committed
  snapshot other than intentionally adding the two new-module unit snapshots,
  stop and escalate; a corpus/projection consolidation must not perturb pinned
  diagnostic snapshots.
- Iterations: if `make all` still fails after 3 focused fix attempts on one work
  item, stop and escalate.
- Ambiguity: if the diagnostic-projection field-set decision (Decision Log
  2026-07-05-C) proves to change a pinned assertion in a way that looks like a
  behavioural regression rather than a strengthening, stop and escalate.

## Risks

- Risk: routing a consumer through the owner module changes which fixture bytes
  are read (e.g. `manifestRoot` stripping differs), silently altering a test.
  Severity: high. Likelihood: low. Mitigation: the owner corpus carries the same
  `manifestRoot` the consumers used; a binding unit test asserts every
  `ODW_EXAMPLE_FIXTURE_SNAPSHOTS[i].fixturePath` starts with the owner
  `manifestRoot`, and `readFixtureSource` already tolerates both `fileName` and
  `fixturePath` inputs (it only strips `manifestRoot` when present). Run the full
  suite after each routing commit.
- Risk: adding the shared projection module to the loader-parity harness import
  graph trips the inertness audit. Severity: medium. Likelihood: low. Mitigation:
  the projection module is imported only by the three parity suites, not by
  `loader-parity.test.ts`; keep it free of ODW runtime imports and verify the
  inertness test still passes.
- Risk: the new guard is either too broad (flags the masking corpus or owner
  modules) or too narrow (misses a real inline literal). Severity: medium.
  Likelihood: low (was medium; reduced after Decision Log 2026-07-05-D). Mitigation:
  the sole detector is a single URL-path-segment rule scoped to the two ODW-parity
  corpus segments (`fixtures/odw-examples/`, `fixtures/invalid-workflows/`) inside
  `new URL(...)` string-literal first arguments. This is broad enough to catch all
  six real inline consumer literals (verified: envelope:19, odw-example:16,
  deterministic:30, body-parser:58, loader-parity:22/26) yet narrow enough
  that the masking `new URL("./fixtures/masking/", …)` and every
  owner/support/generated/refresh module escape by construction — so no
  property-key pattern and no corpus allowlist are needed. The guard's
  in-memory self-check proves the detector flags a crafted corpus literal and
  passes a crafted owner-style sample.
- Risk: unifying three projection call sites onto one full-field comparable shape
  changes a pinned expectation unexpectedly. Severity: medium. Likelihood: low.
  Mitigation: manifest diagnostics already carry `docs` and `spanText`, and live
  diagnostics carry `docs` with `spanText` derivable via `sliceSourceSpan`; pin
  the projection with dedicated unit tests and re-derive expectations mechanically
  (Decision Log 2026-07-05-C).

## Progress

- [x] WI-1 — Introduce the ODW-example corpus owner module and bind it.
- [x] WI-2 — Route inline corpus-location literals through the owner modules.
- [x] WI-3 — Extract the shared manifest-to-comparison diagnostic projection.
- [x] WI-4 — Add the corpus-ownership architecture guard meta-test.
- [x] WI-5 — Update developer documentation, roadmap note, and retrospective.

2026-07-05 WI-1 implementation note: added the ODW-example corpus owner module,
the binding/lookup test, and the docs contents index entry required for the new
ExecPlan. Red/green evidence and review notes are recorded in
`Artifacts and notes`.

2026-07-05 WI-2 implementation note: routed all hand-written ODW-example and
invalid-workflow corpus consumers through the owner modules. The focused suites,
loader-parity inertness block, deterministic gates, and CodeRabbit review all
passed after the required rate-limit backoff.

2026-07-05 WI-3 implementation note: extracted the shared diagnostic projection
module, routed the metadata, envelope, and body-parser parity suites through it,
and added runtime plus type-only contract coverage. CodeRabbit found several
edge-case hardening items during review; the final retry completed with no
findings after the focused tests and deterministic gates were green.

2026-07-05 WI-4 implementation note: added the architecture guard that scans
hand-written static-analysis TypeScript files for inline `new URL(...)` corpus
locations, excluding only its own crafted self-check. The guard derives protected
segments from the two owner modules, positively covers both owned corpora,
exempts masking fixtures by path segment, and pins the violation report shape.

2026-07-05 WI-5 implementation note: documented corpus and projection ownership
in the developers guide, marked roadmap task 2.3.5 complete, and recorded the
retrospective. The technical design already described the parity and
architecture-rule requirements accurately, so it was left unchanged.

## Surprises & discoveries

- Observation: `tests/static-analysis/fixtures/odw-examples.ts` is a *generated*
  file. Evidence: its header cites
  `tests/static-analysis/fixtures/refresh-metadata.ts`, and
  `refresh-manifest-source.ts::odwExampleTypesSource()` emits its
  `ODW_EXAMPLES_FIXTURE_ROOT`/`UPSTREAM_ODW_EXAMPLES_ROOT` literals verbatim;
  `fixture-metadata-refresh-manifest-source.test.ts` snapshots that output.
  Impact: the manifest module cannot be hand-edited to import the owner
  without a generator + snapshot change, so the owner module mirrors the
  invalid-corpus pattern and a binding test ties the two together (Decision
  Log 2026-07-05-A).
- Observation: `readFixtureSource(corpus, path)` strips `corpus.manifestRoot`
  only when defined, so one owner corpus with `manifestRoot` set works for both
  `fileName` callers (no match, passthrough) and `fixturePath` callers (stripped).
  Evidence: `corpus-support.ts::fixtureSourceUrl` line 58–61. Impact: a single
  owner corpus object can replace both the bare `{ fixtureDirectory }` literals
  and the `{ fixtureDirectory, manifestRoot }` literals.

## Decision log

- Decision (2026-07-05-A): Mirror the invalid-corpus owner pattern for the valid
  corpus instead of threading the location through the generator.
  Rationale: `odw-examples.ts` is generated and snapshot-pinned; routing the
  generated manifest through a new owner would force generator edits, a snapshot
  rewrite, and risk an import cycle (`corpus.ts` → manifest → `corpus.ts`). The
  invalid corpus is the reviewed precedent and already tolerates the repo-relative
  root living in both `manifest-types.ts` and `invalid-workflows/corpus.ts`. A
  binding unit test (every snapshot `fixturePath` starts with the owner
  `manifestRoot`; every `upstreamPath` starts with the owner upstream root)
  prevents silent divergence, giving verified single-sourcing for all *consumers*
  without touching the generator. Rejected alternative: a leaf
  `odw-examples/corpus-location.ts` imported by the generated manifest — rejected
  for generator/snapshot churn and cycle risk (Tolerances "Generator").
- Decision (2026-07-05-B): Scope the guard to the `odw-examples` and
  `invalid-workflows` corpora only; leave the masking corpus out of scope.
  Rationale: roadmap 2.3.5 names the "ODW-example fixture corpus" and the parity
  suites; masking fixtures are `odw-lint`-owned synthetic decoys with a separate
  ownership note in the developers guide. Folding masking in would be scope creep
  beyond the roadmap task. Recorded as a follow-up candidate, not a blocker.
- Decision (2026-07-05-C): The shared projection exposes one canonical
  `ComparableFixtureDiagnostic = { rule: string; severity; message; docs; span;
  spanText }`, and all three parity consumers compare that full shape.
  Rationale: the roadmap requires "one reviewed ... diagnostic-projection
  contract, with architecture coverage preventing the contract from forking".
  Keeping three field subsets would preserve the fork. Manifest diagnostics
  already carry `docs` and `spanText`; live diagnostics carry `docs` and
  `spanText` is derivable via `sliceSourceSpan`. This is a deliberate
  strengthening (body-parser gains `spanText`, metadata-parity gains `docs`),
  pinned by the projection module's own unit tests. If a call site cannot supply
  a field honestly, that is an escalation (Tolerances "Ambiguity"), not a reason
  to fork the shape.
- Decision (2026-07-05-D): The corpus-ownership guard uses exactly **one**
  detector — a `new URL(...)` whose first string-literal argument contains the
  path segment `fixtures/odw-examples/` or `fixtures/invalid-workflows/` — and
  does **not** additionally flag object-literal properties keyed
  `fixtureDirectory`/`manifestRoot`.
  Rationale: a property-key check cannot distinguish a masking corpus from an
  ODW/invalid corpus, because the location value is an indirected variable or URL
  (`masking-fixtures.test.ts:55` uses `{ fixtureDirectory: FIXTURE_DIRECTORY }`;
  `source-mask-fixtures.test.ts:11` uses
  `{ fixtureDirectory: new URL("./fixtures/masking/", …) }`) and is not resolvable
  from the property key alone. A key-name pattern would therefore flag those two
  hand-written masking test files, which are legitimately out of scope
  (Decision 2026-07-05-B) and not allowlisted, making the guard's
  "list is empty" assertion fail and breaking `make all` at the WI-4 commit —
  directly violating the masking-exclusion Constraint. The URL-path-segment
  detector avoids this entirely: it matches all six real inline consumer literals
  (verified in the worktree) and satisfies the roadmap's requirement that the
  guard "fails if anyone reintroduces an inline corpus-location literal", while
  `new URL("./fixtures/masking/", …)` and the owner modules'
  `new URL("./", import.meta.url)` both escape it. Because nothing legitimate
  matches the detector, no corpus allowlist is required beyond excluding the guard
  file itself (whose self-check embeds a crafted corpus literal). Rejected
  alternative: keep the property-key pattern and enlarge the allowlist to include
  the two masking test files — rejected because it couples the guard to an
  ever-growing hand-maintained masking allowlist and still cannot tell masking
  from ODW corpora structurally. This Decision supersedes the earlier two-pattern
  sketch in the round-1 draft and reconciles the WI-4 detector with Decision B.
- Decision (2026-07-05-E): Keep the `findOdwExampleFixture({ fileName })` query
  object signature for WI-1 instead of accepting a bare string.
  Rationale: the approved interface in this ExecPlan specifies the query object,
  and the matching invalid-corpus helper already uses an object-shaped query.
  CodeRabbit suggested a bare string and a shared lookup helper; both were
  declined for this work item because they would diverge from the approved
  public test-helper shape or introduce abstraction before there is meaningful
  duplication across lookup dimensions. The actionable uniqueness-test and
  documentation comments from that review were applied.

## Context and orientation

Everything in this plan lives under
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-3-5`. Run all commands from
that worktree root. The project is TypeScript on Bun; the full commit gate is
`make all` (which runs `build check-fmt whitespace-hygiene lint typecheck test`).
Markdown changes additionally gate on `make markdownlint` and `make nixie`
(AGENTS.md; [developers-guide.md](../developers-guide.md) "Workflow Fixture
Corpus"). The `typescript` package is already a dev dependency (used by
`invalid-fixture-diagnostic-source.test.ts` and
`source-file-architecture.test.ts`).

Key existing files:

- `tests/static-analysis/fixtures/corpus-support.ts` — defines the
  `FixtureCorpusLocation` interface and the passive readers `sha256`,
  `copiedFixtureFileNames`, `fixtureSourceUrl`, `readFixtureSource`. This is the
  shared read helper both corpora already use. Unchanged by this task except
  possibly a re-exported type.
- `tests/static-analysis/fixtures/invalid-workflows/corpus.ts` — the *existing*
  invalid-corpus owner: exports `INVALID_WORKFLOW_FIXTURE_CORPUS`
  (`FixtureCorpusLocation`) and `findInvalidWorkflowFixture`. The template to
  mirror for the valid corpus.
- `tests/static-analysis/fixtures/odw-examples.ts` — generated manifest
  (`ODW_EXAMPLE_FIXTURE_SNAPSHOTS`, `OdwExampleFixtureSnapshot`). Do not edit.
- `tests/static-analysis/fixtures/loader-parity.ts` — the parity outcome reducer
  (`loaderParityOutcome`, `expectedInvalidFixtureOutcome`, …). This is the
  *status/ruleClasses* projection and is already shared; it is distinct from the
  per-diagnostic comparable projection this task extracts. Unchanged.
- `tests/static-analysis/fixtures/manifest-freeze.ts` — `deepFreezeFixtureManifest`
  used to runtime-freeze owner objects (mirror `INVALID_WORKFLOW_FIXTURE_CORPUS`,
  which uses `Object.freeze`).

Inline corpus-location literals to remove (from `grep`):

- Valid ODW-example corpus:
  - `odw-example-fixtures.test.ts` — `FIXTURE_DIRECTORY`, `FIXTURE_CORPUS`,
    `MANIFEST_FIXTURE_ROOT`, `UPSTREAM_EXAMPLE_ROOT`.
  - `deterministic-time-spans.test.ts` — `FIXTURE_DIRECTORY`, `FIXTURE_CORPUS`.
  - `workflow-envelope-fixtures.test.ts` — `ODW_EXAMPLE_CORPUS`.
  - `workflow-body-parser.test.ts` — `ODW_EXAMPLE_FIXTURE_CORPUS`.
  - `loader-parity.test.ts` — `TRUSTED_EXAMPLE_CORPUS`.
- Invalid-workflow corpus (owner already exists):
  - `loader-parity.test.ts` — `INVALID_FIXTURE_CORPUS` (replace with the
    imported `INVALID_WORKFLOW_FIXTURE_CORPUS`).

Diagnostic-projection duplication to consolidate (three forks):

- `invalid-workflow-metadata-parity.test.ts` — `ComparableDiagnostic` type plus
  `classifyInvalidFixture`/`comparableFixtureDiagnostics` and
  `classifyBodySyntaxFixture`/`comparableBodySyntaxDiagnostics` (fields `rule,
  severity, message, span, spanText`; no `docs`).
- `workflow-envelope-fixtures.test.ts` — inline `.map` to `{rule, severity,
  message, docs, span, spanText}`.
- `workflow-body-parser.test.ts` — `expectedBodySyntaxDiagnosticFor` and the
  inline live projection (fields `rule, severity, message, span, docs`; no
  `spanText`).

Guard precedent to model:
`tests/static-analysis/invalid-fixture-diagnostic-source.test.ts` (TypeScript
compiler-API AST scan of a file set) and
`tests/static-analysis/source-file-architecture.test.ts` (module-ownership
pinning). [technical-design.md](../technical-design.md) §11.3 requires
architecture rules of exactly this shape.

## Plan of work

Each work item is an independent, gate-passable commit. Follow
Red-Green-Refactor: add or extend the smallest failing test first, watch it fail
for the intended reason, make it pass, then run the wider gate. Because every
committed state must pass `make all`, the *guard* that forbids inline literals
(WI-4) lands only after all consumers are routed (WI-2, WI-3).

### WI-1 — ODW-example corpus owner module + binding test

Docs to read: [technical-design.md](../technical-design.md) §§11.1–11.2;
[developers-guide.md](../developers-guide.md) "Workflow Fixture Corpus";
AGENTS.md "Abstraction / adapter / helper policy" and "TypeScript Guidance".
Skills to load: `leta` (symbol navigation), `python-router` is not relevant;
load nothing Python. Sweep first (AGENTS.md policy): confirm no existing
ODW-example corpus owner via `leta grep` / exact search before creating one.

Create `tests/static-analysis/fixtures/odw-examples/corpus.ts`, mirroring
`invalid-workflows/corpus.ts`. It must:

- import `type FixtureCorpusLocation` from `../corpus-support` and
  `ODW_EXAMPLE_FIXTURE_SNAPSHOTS`, `type OdwExampleFixtureSnapshot` from
  `../odw-examples`;
- export a runtime-frozen `ODW_EXAMPLE_FIXTURE_CORPUS` satisfying
  `FixtureCorpusLocation` with `fixtureDirectory: new URL("./", import.meta.url)`
  and `manifestRoot: "tests/static-analysis/fixtures/odw-examples/"`;
- export `ODW_EXAMPLE_UPSTREAM_ROOT = "open-dynamic-workflows/examples"` (consumed
  by the manifest-derivation assertion in `odw-example-fixtures.test.ts`);
- export `findOdwExampleFixture({ fileName })` returning the matching snapshot or
  throwing a clear `Missing ODW example fixture <fileName>.` error, mirroring
  `findInvalidWorkflowFixture`.

Interface to exist at end of WI-1:

```ts
// tests/static-analysis/fixtures/odw-examples/corpus.ts
export const ODW_EXAMPLE_FIXTURE_CORPUS: FixtureCorpusLocation;
export const ODW_EXAMPLE_UPSTREAM_ROOT: string;
export const findOdwExampleFixture: (query: { readonly fileName: string }) =>
  OdwExampleFixtureSnapshot;
```

Tests (new file
`tests/static-analysis/fixtures/odw-examples-corpus.test.ts` under
`tests/static-analysis/` — keep it beside the invalid-corpus test
`invalid-workflow-corpus.test.ts` for discoverability; use a name that does not
collide):

- Red: assert `ODW_EXAMPLE_FIXTURE_CORPUS.manifestRoot` binds the manifest —
  every `ODW_EXAMPLE_FIXTURE_SNAPSHOTS[i].fixturePath` starts with it, and every
  `upstreamPath` starts with `${ODW_EXAMPLE_UPSTREAM_ROOT}/`. Write this test
  before the module exists so it fails to import (red), then create the module
  (green).
- `findOdwExampleFixture({ fileName: "routing.js" })` returns the routing
  snapshot; an unknown file name throws the clear error.
- `readFixtureSource(ODW_EXAMPLE_FIXTURE_CORPUS, fixture.fixturePath)` and
  `readFixtureSource(ODW_EXAMPLE_FIXTURE_CORPUS, fixture.fileName)` both return
  the same source for a sample fixture (proves the `manifestRoot` strip is
  path-shape agnostic — the invariant WI-2 relies on).
- `Object.isFrozen(ODW_EXAMPLE_FIXTURE_CORPUS)` is true.

Validation: `bun test tests/static-analysis/fixtures/odw-examples-corpus.test.ts`
(red then green), then `make all`.

### WI-2 — Route inline corpus-location literals through the owner modules

Docs to read: [developers-guide.md](../developers-guide.md) "Workflow Fixture
Corpus"; AGENTS.md "Testing" (factories over ad hoc literals). Skills: `leta` to
confirm the import edges and find every reference before editing.

Edit each consumer to delete its local corpus-location literal and import the
owner instead. No behaviour change — only the source of the location object
changes.

- `tests/static-analysis/odw-example-fixtures.test.ts`: replace `FIXTURE_DIRECTORY`,
  `FIXTURE_CORPUS`, `MANIFEST_FIXTURE_ROOT`, `UPSTREAM_EXAMPLE_ROOT` with imports
  of `ODW_EXAMPLE_FIXTURE_CORPUS` and `ODW_EXAMPLE_UPSTREAM_ROOT`. The
  `MANIFEST_FIXTURE_ROOT` assertion — which checks that each `fixturePath`
  equals `MANIFEST_FIXTURE_ROOT` joined to the fixture `fileName` — becomes a
  comparison against the owner `manifestRoot` (strip the trailing slash inline,
  or assert `startsWith`), keeping the exact derivation semantics.
  `copiedFixtureFileNames` and `fixtureSourceUrl`/`readFixtureSource` calls take
  `ODW_EXAMPLE_FIXTURE_CORPUS`.
- `tests/static-analysis/deterministic-time-spans.test.ts`: replace
  `FIXTURE_DIRECTORY`/`FIXTURE_CORPUS` with `ODW_EXAMPLE_FIXTURE_CORPUS`.
- `tests/static-analysis/workflow-envelope-fixtures.test.ts`: replace
  `ODW_EXAMPLE_CORPUS` with `ODW_EXAMPLE_FIXTURE_CORPUS`.
- `tests/static-analysis/workflow-body-parser.test.ts`: replace the inline
  `ODW_EXAMPLE_FIXTURE_CORPUS` object with the imported owner constant (same
  name; delete the local `const`).
- `tests/static-analysis/loader-parity.test.ts`: replace `TRUSTED_EXAMPLE_CORPUS`
  with `ODW_EXAMPLE_FIXTURE_CORPUS`, and replace `INVALID_FIXTURE_CORPUS` with the
  imported `INVALID_WORKFLOW_FIXTURE_CORPUS` from
  `./fixtures/invalid-workflows/corpus`. After this edit, re-run the harness
  inertness test explicitly (see below) because it audits `loader-parity.test.ts`
  import edges: importing the two owner modules must not introduce forbidden ODW
  import edges or computed dynamic imports.

Tests: no new expected values; the existing suites are the oracle. This work item
is "green by construction" — it must leave every touched suite passing
unchanged. Do not weaken any assertion.

Validation, in order:

1. `bun test tests/static-analysis/odw-example-fixtures.test.ts
   tests/static-analysis/deterministic-time-spans.test.ts
   tests/static-analysis/workflow-envelope-fixtures.test.ts
   tests/static-analysis/workflow-body-parser.test.ts
   tests/static-analysis/loader-parity.test.ts` — all pass.
2. `make all` — full gate.

### WI-3 — Extract the shared manifest-to-comparison diagnostic projection

Docs to read: [developers-guide.md](../developers-guide.md) "Workflow Fixture
Corpus" (the manifest-as-single-source paragraph) and "Source-span helpers";
[technical-design.md](../technical-design.md) §8 (diagnostic contract) and §11.5
(span-mapping invariant); AGENTS.md "Abstraction / adapter / helper policy".
Skills: `leta` for reference discovery. Sweep for any existing projection helper
first (there is none shared today; three local forks exist).

Create `tests/static-analysis/fixtures/diagnostic-projection.ts` exporting one
canonical comparable shape and two projectors (Decision Log 2026-07-05-C):

```ts
// tests/static-analysis/fixtures/diagnostic-projection.ts
export interface ComparableFixtureDiagnostic {
  readonly rule: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly docs: RuleDocumentationPath;
  readonly span: SourceSpan;
  readonly spanText: string;
}
// From a manifest diagnostic (already carries docs + spanText).
export const manifestDiagnosticToComparable:
  (diagnostic: InvalidWorkflowFixtureDiagnostic) => ComparableFixtureDiagnostic;
// From a live diagnostic; spanText derived via sliceSourceSpan.
export const liveDiagnosticToComparable:
  (diagnostic: LiveComparableInput, sourceFile: OriginalSourceFile) =>
    ComparableFixtureDiagnostic;
```

`LiveComparableInput` is the structural minimum `{ rule: unknown; severity;
message; docs; span }` satisfied by both the lint `Diagnostic` and the body
parser adapter diagnostic. Import `sliceSourceSpan`, `type DiagnosticSeverity`,
`type SourceSpan`, `type OriginalSourceFile`, `type RuleDocumentationPath` from
`odw-lint`, and `type InvalidWorkflowFixtureDiagnostic` from
`./invalid-workflows/manifest-types`. Keep the module free of ODW runtime
imports (Constraints: static-analysis boundary).

Route the three consumers through it, comparing the full canonical shape:

- `invalid-workflow-metadata-parity.test.ts`: delete `ComparableDiagnostic` and
  the four bespoke projectors; build live comparables with
  `liveDiagnosticToComparable(diagnostic, result.sourceFile)` and expected
  comparables with `manifestDiagnosticToComparable`. Preserve the existing
  task-owned rule filtering (`TASK_2_1_3_RULES`, `BODY_SYNTAX_RULES`) and the
  `statusFromDiagnostics` helper; only the per-diagnostic mapping moves to the
  shared module. Expected sets now include `docs` (mechanical: manifest carries
  it).
- `workflow-envelope-fixtures.test.ts`: replace the inline live `.map` with
  `liveDiagnosticToComparable(..., sourceFile)` and compare to
  `fixture.expectedDiagnostics.map(manifestDiagnosticToComparable)`. (The valid
  branch keeps its empty-diagnostics equality.)
- `workflow-body-parser.test.ts`: replace `expectedBodySyntaxDiagnosticFor` and
  the inline live projection with the shared projectors; the comparison now
  includes `spanText` (derive live `spanText` from `envelope.sourceFile`).

Tests (new file `tests/static-analysis/diagnostic-projection.test.ts`):

- Red: assert `manifestDiagnosticToComparable` on a known invalid-fixture
  diagnostic yields the exact `{rule, severity, message, docs, span, spanText}`
  (write before the module exists → import failure red, then green).
- `liveDiagnosticToComparable` over a lint result for one invalid fixture equals
  the manifest comparable for the same rule (round-trip parity), proving the
  projection is the single contract both sides agree on.
- `rule` is always `String(diagnostic.rule)` (brand-stripped) and `spanText`
  equals `sliceSourceSpan(sourceFile, span)`.

Validation, in order:

1. `bun test tests/static-analysis/diagnostic-projection.test.ts` (red → green).
2. `bun test tests/static-analysis/invalid-workflow-metadata-parity.test.ts
   tests/static-analysis/workflow-envelope-fixtures.test.ts
   tests/static-analysis/workflow-body-parser.test.ts` — all pass.
3. `make all`.

### WI-4 — Corpus-ownership architecture guard meta-test

Docs to read: [technical-design.md](../technical-design.md) §11.3 (architecture
rule requirement); AGENTS.md "Refactoring Heuristics" (duplicated code) and
"Testing". Skills: `leta`; model on
`tests/static-analysis/invalid-fixture-diagnostic-source.test.ts` and
`tests/static-analysis/source-file-architecture.test.ts`.

Create `tests/static-analysis/fixture-corpus-ownership.test.ts`. Using the
`typescript` compiler API, it:

- enumerates every `.ts`/`.test.ts` file under `tests/static-analysis/`
  (recursively via `readdirSync`), excluding only this guard file itself (its
  self-check embeds a crafted corpus-location literal that would otherwise
  self-flag);
- flags, in every non-excluded file, exactly **one** pattern: a `new URL(...)`
  call-expression whose **first argument is a string literal (or no-substitution
  template literal) whose text contains the path segment `fixtures/odw-examples/`
  or `fixtures/invalid-workflows/`**. Report `{filePath, line, column, text}`
  for each match and assert the collected list is empty. This is the
  URL-path-segment detector mandated by Decision Log 2026-07-05-D; there is no
  property-key pattern (see the Decision for why a `fixtureDirectory`/
  `manifestRoot` key check is rejected);
- includes a self-check that runs the detector against two in-memory source
  strings (never written to disk): a crafted inline-literal sample
  (`new URL("./fixtures/odw-examples/", import.meta.url)`) that MUST be flagged
  (red proof of the detector), and a crafted owner-style sample
  (`new URL("./", import.meta.url)` plus a `manifestRoot` string constant) that
  MUST return empty (guards against false positives). This provides the
  Red-Green evidence internally without leaving the repo red.

Why the detector needs no corpus allowlist, and why masking is exempt by
construction (Decision Log 2026-07-05-B, 2026-07-05-D):

- After WI-2/WI-3 routing, the owner modules
  (`fixtures/odw-examples/corpus.ts`, `fixtures/invalid-workflows/corpus.ts`)
  build their directory URL as `new URL("./", import.meta.url)` and carry the
  corpus path only inside a plain `manifestRoot` **string constant**, not inside
  a `new URL(...)` first argument — so the URL-path-segment detector does not
  match them (verified: no file under `tests/static-analysis/fixtures/` currently
  holds a `new URL("…fixtures/odw-examples/…")` or `…invalid-workflows/…` string
  literal).
- The generated manifests (`fixtures/odw-examples.ts`,
  `fixtures/invalid-workflows/manifests/*.ts`) use repo-relative **strings**, not
  `new URL(...)`, and the refresh support modules
  (`fixtures/refresh-*.ts`, `fixtures/refresh-manifest-source.ts`) call
  `new URL(<variable>, …)` with non-literal first arguments — neither form
  matches the detector.
- The masking corpus is exempt for free: `masking-fixtures.test.ts:20` and
  `source-mask-fixtures.test.ts:11` use `new URL("./fixtures/masking/", …)`,
  whose path segment is neither `odw-examples/` nor `invalid-workflows/`, so the
  detector never flags them — even though those files carry
  `{ fixtureDirectory: … }` property literals (`masking-fixtures.test.ts:55`,
  `source-mask-fixtures.test.ts:11`). A property-key detector WOULD flag those
  two masking files (they are not, and must not be, in scope), which is precisely
  the contradiction Decision Log 2026-07-05-D removes. Because the sole detector
  is path-segment-scoped, no masking allowlist entry is needed and none is added,
  and `make all` passes at the WI-4 commit with the masking corpus untouched.

Validation: `bun test tests/static-analysis/fixture-corpus-ownership.test.ts`
(passes only because WI-2/WI-3 routed every consumer; temporarily reintroduce one
inline literal to observe a real failure, then revert), then `make all`.

### WI-5 — Documentation, roadmap note, and retrospective

Docs to read/edit: [developers-guide.md](../developers-guide.md) "Workflow
Fixture Corpus"; [documentation-style-guide.md](../documentation-style-guide.md);
AGENTS.md "Documentation Maintenance". Skills: `en-gb-oxendict` for prose.

- Update [developers-guide.md](../developers-guide.md) "Workflow Fixture Corpus"
  to state that (1) each corpus has one owner module — `ODW_EXAMPLE_FIXTURE_CORPUS`
  in `fixtures/odw-examples/corpus.ts` and `INVALID_WORKFLOW_FIXTURE_CORPUS` in
  `fixtures/invalid-workflows/corpus.ts` — and consumers must import the location
  rather than inline `new URL(...)`; (2)
  `tests/static-analysis/fixtures/diagnostic-projection.ts` is the single
  manifest-to-comparison diagnostic contract used by the parser, envelope, and
  metadata parity suites; (3)
  `fixture-corpus-ownership.test.ts` enforces both, and masking fixtures stay out
  of that contract. Document ownership, permitted call sites, and composition
  rules per AGENTS.md "Abstraction / adapter / helper policy". Keep prose wrapped
  at 80 columns.
- Assess whether [technical-design.md](../technical-design.md) §11.2/§11.3
  needs a sentence noting the single corpus-location and projection owners;
  add only if it improves accuracy (the design already mandates the
  architecture rule shape). Do not manufacture churn.
- Mark roadmap task 2.3.5 complete in [roadmap.md](../roadmap.md) with a
  completion note pointing at this ExecPlan, matching the style of sibling
  completed tasks (e.g. 2.3.1, 2.3.3). Use the `mapsplice` skill only if
  structural renumbering is needed; a checkbox flip plus a completion-note
  line is a plain edit.
- Fill in this ExecPlan's `Outcomes & retrospective` and flip `Status` to
  `COMPLETE`.

Validation for Markdown edits: run the formatter on only the files touched, then
gate:

```sh
bunx mdtablefix docs/execplans/roadmap-2-3-5.md docs/developers-guide.md docs/roadmap.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-3-5.md docs/developers-guide.md docs/roadmap.md
make markdownlint
make nixie
make all
```

(Adjust the file list to exactly the Markdown files this work item edits; if
`technical-design.md` is left unchanged, omit it. Every listed path must exist at
run time.)

## Concrete steps

Run from `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-3-5`.

Before starting, confirm a clean baseline:

```sh
git status
make all
```

Expected: `make all` passes on the untouched branch (baseline green).

Then implement WI-1 → WI-5 in order, committing after each with a gated commit
(`make all`, plus `make markdownlint`/`make nixie` for WI-5). Suggested commit
subjects (imperative mood, ≤50 chars):

- WI-1: `Add ODW-example fixture corpus owner module`
- WI-2: `Route corpus consumers through owner modules`
- WI-3: `Share manifest-to-comparison diagnostic projection`
- WI-4: `Guard against inline fixture corpus locations`
- WI-5: `Document consolidated fixture corpus ownership`

After each routing/extraction commit, spot-check no inline literal remains for
the corpus it covers:

```sh
grep -rn 'new URL("./fixtures/odw-examples/' tests
grep -rn 'new URL("./fixtures/invalid-workflows/' tests
```

Expected after WI-2/WI-3: matches only in the two owner modules (and the
generated manifest, which uses repo-relative strings, not `new URL`).

## Validation and acceptance

Deterministic commit gate for every code work item: `make all` (runs `build`,
`check-fmt`, `whitespace-hygiene`, `lint` = Biome + Oxlint, `typecheck` = `tsc
--noEmit`, `test` = `bun test`). AGENTS.md names `make test`, `make lint`, `make
typecheck`, and `make check-fmt`; all are subsumed by `make all`, and the plan
also runs the focused `bun test <file>` commands listed per work item to capture
Red-Green evidence. Markdown work items additionally run `make markdownlint` and
`make nixie`.

Acceptance (behaviour a human can verify):

- Tests: `make all` passes at HEAD after every commit. The new suites
  `odw-examples-corpus.test.ts`, `diagnostic-projection.test.ts`, and
  `fixture-corpus-ownership.test.ts` pass; each was observed red before its
  implementing change (import failure / crafted-sample detection) and green
  after.
- Corpus single-sourcing: `grep -rn 'new URL("./fixtures/odw-examples/' tests`
  and `grep -rn 'new URL("./fixtures/invalid-workflows/' tests` return only the
  owner modules. `fixture-corpus-ownership.test.ts` fails if a new inline
  corpus-location literal is added to a hand-written test (verify once by
  reintroducing and reverting a literal).
- Projection single-sourcing: `invalid-workflow-metadata-parity.test.ts`,
  `workflow-envelope-fixtures.test.ts`, and `workflow-body-parser.test.ts` import
  their comparable diagnostics from
  `tests/static-analysis/fixtures/diagnostic-projection.ts`; no local
  `ComparableDiagnostic`/`expectedBodySyntaxDiagnosticFor` remains.
- Loader-parity inertness unchanged: the
  `loader-parity harness inertness` describe block still passes after WI-2.
- Docs: [developers-guide.md](../developers-guide.md) describes the owner modules
  and projection contract; [roadmap.md](../roadmap.md) marks 2.3.5 complete;
  `make markdownlint` and `make nixie` pass.

Quality criteria ("done"):

- Tests: all suites green under `make all`; three new suites added, each with a
  captured red stage.
- Lint/typecheck: `make lint` and `make typecheck` clean (part of `make all`).
- No file over 400 lines; no trailing whitespace; en-GB Oxford spelling.

Quality method: `make all` after every commit; `make markdownlint` + `make
nixie` after the documentation commit; the focused `bun test` red/green captures
recorded in `Progress`/`Artifacts and notes`.

## Idempotence and recovery

Every step is a normal file edit under version control; re-running `make all` is
safe and cache-friendly. If a routing edit breaks a suite, `git diff` the single
touched consumer and compare against the owner module's `manifestRoot` — the most
likely fault is a `fileName`-vs-`fixturePath` mismatch that the WI-1 binding test
already characterizes. Never modify the generator or a generated manifest to
"fix" a routing failure (Constraints); that indicates a wrong turn. To abandon a
work item mid-flight, `git restore` the touched files (no external state is
mutated). If a stash is needed, name it per the run convention: `df12-stash v1
task=2.3.5 kind=<discard|keep> reason="<short>"`.

## Artifacts and notes

Record here, as work proceeds, the red/green transcripts that prove each new
test failed before its change and passed after (e.g. the `bun test` line for
`diagnostic-projection.test.ts` failing with an import error, then passing).
Keep transcripts short and focused on the assertion that proves the contract.

- WI-1 red: `bun test tests/static-analysis/odw-examples-corpus.test.ts` failed
  with `Cannot find module './fixtures/odw-examples/corpus'`.
- WI-1 green: `bun test tests/static-analysis/odw-examples-corpus.test.ts`
  passed with 6 tests and 24 assertions after adding the owner module and the
  uniqueness assertion requested during review.
- WI-1 gates: scrutineer reported `make all`, `make check-fmt`,
  `make typecheck`, `make lint`, `make test`, `make markdownlint`, and
  `make nixie` green after the docs contents index entry was added.
- WI-1 CodeRabbit: one run returned minor/trivial feedback. Applied the
  uniqueness assertion and prose/path fixes; kept the object-shaped lookup
  signature per Decision 2026-07-05-E. Scrutineer reran the deterministic gates
  green after those fixes.
- WI-2 focused green: `bun test tests/static-analysis/odw-example-fixtures.test.ts
  tests/static-analysis/deterministic-time-spans.test.ts
  tests/static-analysis/workflow-envelope-fixtures.test.ts
  tests/static-analysis/workflow-body-parser.test.ts
  tests/static-analysis/loader-parity.test.ts` passed with 128 tests and the
  loader-parity inertness checks green.
- WI-2 ownership scan: `rg -n 'new URL\("\./fixtures/(odw-examples|invalid-workflows)/'
  tests/static-analysis` returned no matches after routing.
- WI-2 gates: scrutineer reported `make all`, `make check-fmt`,
  `make typecheck`, `make lint`, and `make test` green. No Markdown files
  changed in the WI-2 patch before the ExecPlan update.
- WI-2 CodeRabbit: first attempt exited 143 after summarizing, second attempt
  was rate-limited with a 30-minute service hint, and the required 62-minute
  `vsleep` backoff was observed before retry. The final retry completed with
  `review_completed` and `findings: 0`; scrutineer reran deterministic gates
  green afterwards.
- WI-3 red: `bun test tests/static-analysis/diagnostic-projection.test.ts`
  failed with `Cannot find module './fixtures/diagnostic-projection'` before
  the shared projection module existed.
- WI-3 focused green: `bun test tests/static-analysis/diagnostic-projection.test.ts
  tests/static-analysis/invalid-workflow-metadata-parity.test.ts
  tests/static-analysis/workflow-envelope-fixtures.test.ts
  tests/static-analysis/workflow-body-parser.test.ts` passed with 44 tests, one
  snapshot, and 558 assertions after the projection routing and review hardening.
- WI-3 type contract: `bunx tsc --noEmit` passed with the type-only negative
  contract in `tests/static-analysis/diagnostic-projection-contract.ts`,
  proving `ComparableFixtureDiagnostic` still requires `docs`.
- WI-3 gates: scrutineer reported `make all`, `make check-fmt`, `make lint`,
  `make typecheck`, and `make test` green after the projection extraction and
  CodeRabbit follow-up fixes.
- WI-3 CodeRabbit: multiple review attempts produced actionable hardening
  comments that were applied: snapshot the manifest projection, extract the
  shared base projection helper, throw clearly when live diagnostics omit
  `docs`, avoid module-scope lint execution in the runtime test, and move the
  negative type assertion into a non-executed type-contract file. The final
  `coderabbit review --agent` run exited 0 with `findings: 0`.
- WI-4 red/self-check: temporarily adding
  `tests/static-analysis/tmp-inline-corpus-guard-check.test.ts` with
  `new URL("./fixtures/odw-examples/", import.meta.url)` made
  `bun test tests/static-analysis/fixture-corpus-ownership.test.ts` fail with
  the temporary file reported at line 1, column 25; the scratch file was removed.
- WI-4 focused green: `bun test tests/static-analysis/fixture-corpus-ownership.test.ts`
  passed with 2 tests, one inline snapshot, and 8 assertions after the guard
  derived protected segments from the owner modules and covered both corpora.
- WI-4 gates: scrutineer reported `make all`, `make check-fmt`,
  `make typecheck`, `make lint`, and `make test` green after the CodeRabbit
  follow-up fixes. No Markdown files changed before the ExecPlan update.
- WI-4 ownership scan: `rg -n 'new URL\("\./fixtures/(odw-examples|invalid-workflows)/'
  tests/static-analysis` returned only the guard's self-check literal, which is
  excluded by `GUARD_FILE_PATH`.
- WI-4 CodeRabbit: applied low-severity review feedback to normalize the guard
  path, snapshot the violation shape, document literal-only scope, derive
  protected segments from owner modules, and add invalid-workflow positive
  coverage. A later review suggested broadening the guard to raw string and
  template literals; that suggestion was declined as inconsistent with Decision
  2026-07-05-D and the WI-4 specification, which intentionally scan only
  `new URL(...)` first-argument literals so owner `manifestRoot` constants,
  generated manifests, and refresh support remain valid.
- WI-5 docs: updated the developers guide "Workflow Fixture Corpus" section,
  marked roadmap task 2.3.5 complete, and completed this retrospective. Leta
  prose lookup was unavailable for one Markdown search with `Connection refused
  (os error 111)`, so the documentation surfaces were verified by direct file
  inspection.

## Interfaces and dependencies

Modules to exist at completion (all under `tests/`, none in `src/`; static
analysis boundary preserved):

- `tests/static-analysis/fixtures/odw-examples/corpus.ts` —
  `ODW_EXAMPLE_FIXTURE_CORPUS: FixtureCorpusLocation`, `ODW_EXAMPLE_UPSTREAM_ROOT:
  string`, `findOdwExampleFixture({ fileName }): OdwExampleFixtureSnapshot`.
- `tests/static-analysis/fixtures/diagnostic-projection.ts` —
  `ComparableFixtureDiagnostic`, `manifestDiagnosticToComparable`,
  `liveDiagnosticToComparable`.
- `tests/static-analysis/fixtures/odw-examples-corpus.test.ts`,
  `tests/static-analysis/diagnostic-projection.test.ts`,
  `tests/static-analysis/fixture-corpus-ownership.test.ts` — new suites.

Reused, unchanged: `corpus-support.ts` (`FixtureCorpusLocation`,
`readFixtureSource`, `fixtureSourceUrl`, `copiedFixtureFileNames`),
`invalid-workflows/corpus.ts` (`INVALID_WORKFLOW_FIXTURE_CORPUS`),
`manifest-freeze.ts` (`deepFreezeFixtureManifest`/`Object.freeze`), `odw-lint`
public exports (`sliceSourceSpan`, `type Diagnostic`, `DiagnosticSeverity`,
`SourceSpan`, `OriginalSourceFile`, `RuleDocumentationPath`). New third-party
dependencies: none (`typescript` is already a dev dependency).

## Outcomes & retrospective

The result matches the Purpose. The valid ODW-example corpus now has
`tests/static-analysis/fixtures/odw-examples/corpus.ts`, the invalid workflow
corpus continues to use
`tests/static-analysis/fixtures/invalid-workflows/corpus.ts`, and every routed
consumer imports those owner modules instead of carrying its own corpus
location. The parser, envelope, and metadata parity suites now compare
diagnostics through `tests/static-analysis/fixtures/diagnostic-projection.ts`,
so the `{ rule, severity, message, docs, span, spanText }` contract has one
reviewed implementation.

The guard in `tests/static-analysis/fixture-corpus-ownership.test.ts` is
build-gated and covers the agreed architecture boundary: hand-written
TypeScript tests cannot reintroduce inline `new URL(...)` locations for the two
ODW-parity corpora. No consumer resisted routing. The one design tension was
whether to broaden the guard to raw path strings; that was rejected because it
would contradict Decision 2026-07-05-D and flag legitimate owner `manifestRoot`
constants, generated manifests, and refresh support. Masking fixtures should
remain out of this parity contract unless a later roadmap item chooses to give
them a separate owner pattern.

## Signposting: documentation and skills relied upon

Documentation consulted while drafting: [roadmap.md](../roadmap.md) task 2.3.5
and siblings 2.3.1/2.3.3; [technical-design.md](../technical-design.md) §§6.1,
6.4, 8, 11.1–11.3, 11.5; [adr/0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md);
[developers-guide.md](../developers-guide.md) "Workflow Fixture Corpus" and
"Source-span helpers"; AGENTS.md (gate set, abstraction policy, testing rules,
file-size and spelling conventions); [documentation-style-guide.md](../documentation-style-guide.md).
Skills to load during implementation: `execplans` (this plan's format), `leta`
(symbol navigation and reference discovery), `en-gb-oxendict` (prose in WI-5),
`mapsplice` (only if roadmap renumbering is needed). GrepAI reflects `main`
only; all branch-local facts in this plan were verified by direct file inspection
in the worktree.

## Revision note

- 2026-07-05: Initial DRAFT. First planning round. Decomposed 2.3.5 into five
  gate-passable work items (owner module + binding, consumer routing, shared
  projection, architecture guard, docs). Recorded the generated-manifest
  discovery and the three load-bearing decisions (mirror-the-invalid-pattern,
  masking out of scope, one canonical comparable shape) with rationale so no
  undecided fork remains for the implementer.
- 2026-07-05: Round 2 revision (design-review response). Resolved the sole
  blocking point: the round-1 WI-4 guard flagged two patterns, and pattern (b)
  (any object-literal property keyed `fixtureDirectory`/`manifestRoot`) was
  over-broad and self-contradicted Decision 2026-07-05-B. It would have flagged
  the two non-allowlisted hand-written masking test files
  (`masking-fixtures.test.ts:55`, `source-mask-fixtures.test.ts:11`), failing the
  guard's empty-list assertion and breaking `make all` at the WI-4 commit.
  Removed pattern (b) entirely; WI-4 now uses a single URL-path-segment detector
  (former pattern (a)) scoped to the two ODW-parity corpus segments, which the
  worktree confirms catches all six real inline consumer literals while the
  masking `new URL("./fixtures/masking/", …)` and the owner modules'
  `new URL("./", …)` escape by construction. Simplified the allowlist to just the
  guard file itself (no corpus/masking allowlist needed), verified no
  support/owner/generated/refresh module carries a matching `new URL` string
  literal, and recorded the change as Decision Log 2026-07-05-D. Updated the
  Constraints masking bullet and the "too broad" Risk accordingly.

## Addenda

- [ ] 2.3.5.1. Complete diagnostic-projection consolidation.
  - Source: audit:2.3.2, review:2.3.5, and audit:2.3.5.
  - Severity: medium.
  - Scope: migrate the dual-compat and remaining valid-branch parity
    comparisons onto `diagnostic-projection.ts`, make the ownership guard
    enforce that projection contract, and generalize the developer-guide suite
    enumeration.
  - Success: parity comparisons use one manifest-to-comparison shape for rule,
    severity, message, docs path, span, and `spanText`, and guard coverage
    catches local comparable-diagnostic forks.
- [ ] 2.3.5.2. Harden fixture corpus-support ergonomics.
  - Source: audit:2.3.5.
  - Severity: low.
  - Scope: anchor corpus root stripping in `corpus-support.ts` with an explicit
    dual-mode path contract and extract the duplicated owner-module
    find-or-throw lookup helper where contracts match.
  - Success: corpus source-path derivation cannot silently strip the wrong
    prefix, and ODW-example plus invalid-workflow owner modules share one
    reviewed lookup helper.
