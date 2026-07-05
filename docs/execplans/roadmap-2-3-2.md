# Add dual-compat parity fixtures for pure metadata and deterministic-time warnings

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 2.3.2 (`docs/roadmap.md`, step 2.3 "Prove ODW loader parity before
shipping dialect checks") asks for a *dual-compat parity fixture corpus* covering
two Claude-portability surfaces: **pure metadata** and **deterministic-time
warnings**. "Dual compatibility" is ODW's distinction between a workflow that the
ODW runtime loader accepts and a workflow that is *also* portable to plain Claude
Code execution. ODW captures this in `open-dynamic-workflows/src/dual-compat.ts`
through two static helpers named in `docs/technical-design.md` §11.2:

- `checkMeta` — validates the workflow's `export const meta` declaration. Claude
  portability additionally requires that `meta` is a *pure literal* (Terms of
  Reference table row, `docs/technical-design.md` line 46: "Claude compatibility
  requires a pure-literal `meta`; ODW's runtime loader is more lenient").
- `scanDualCompat` — flags deterministic-time and randomness hazards that make a
  workflow non-reproducible under Claude Code (`Date.now()`, `Math.random()`,
  argless `new Date()`), mapping to the §9.2 warnings `odw/no-date-now`,
  `odw/no-math-random`, and `odw/no-argless-new-date`.

`odw-lint` has already vendored this behaviour as its own source of truth
(`docs/developers-guide.md` lines 28–29: "v1 vendors the pure-literal parser
behaviour from ODW's `dual-compat.ts` into `odw-lint`"). The deterministic-time
scanner ships today in `src/static-analysis/workflow-deterministic-time.ts`
(exported as `scanDeterministicTimeWarnings` and wired into
`lintWorkflowSource`), and the metadata classifier in
`src/static-analysis/workflow-metadata.ts` owns the `checkMeta`-equivalent
`odw/meta-*` rules. Task 2.3.1 built the reusable loader-parity harness
(`tests/static-analysis/fixtures/loader-parity.ts`) and *explicitly deferred*
`checkMeta`/`scanDualCompat` parity to this task. The current span suite states
the boundary plainly (`tests/static-analysis/deterministic-time-spans.test.ts`
lines 3–4: "The full dual-compatibility parity fixture harness belongs to
roadmap 2.3.2").

After this change a maintainer can run `make test` and see a dedicated
`dual-compat` fixture corpus whose *trusted static expectations* are the source
of truth, and a parity suite that proves `odw-lint`'s live diagnostics match
those expectations without importing or executing any ODW runtime path:

1. **Pure-metadata parity** (`checkMeta` accept-path): ODW-valid workflows
   with a pure-literal `meta` and a portable body produce zero diagnostics —
   proving
   `checkMeta`-accepted metadata is portability-clean and does not leak a false
   `odw/meta-*` error.
2. **Deterministic-time parity** (`scanDualCompat`): ODW-valid workflows that
   call `Date.now()`, `Math.random()`, or argless `new Date()` produce exactly
   the equivalent §9.2 warning for each hazard, at a span that points into the
   original source; and a shadowed/portable counter-example produces *no*
   warning (the false-positive discipline §9.3 mandates for heuristic-adjacent
   rules).

Observable success: `make test` passes; a new parity suite
`tests/static-analysis/dual-compat-parity.test.ts` fails before the corpus and
manifest exist (unresolved import / missing fixtures) and passes after they land;
mutating an expected rule, severity, message, or anchor in the manifest makes the
suite fail for the intended reason, and the loader-parity harness reports the new
corpus with `warning`/`no-error` status parity.

Explicit non-goals (kept out to stay atomic and to honour the roadmap
sequencing): this task does **not** implement user-visible `odw/claude-pure-meta`
emission — that is deferred to task 3.1.1 by `docs/roadmap.md` lines 486–487 and
`docs/developers-guide.md` lines 180–183, and must not be added to the metadata
classifier here. It does not restructure the invalid-fixture manifest-driven
dialect tests (task 2.3.3), does not probe TypeScript-only body rejection (task
2.3.4), and does not consolidate corpus ownership (task 2.3.5).

## Constraints

Hard invariants that must hold throughout implementation. Violation requires
escalation, not a workaround.

- Work occurs only in the git worktree
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-3-2` on branch
  `roadmap-2-3-2`. The root/control checkout is off-limits for edits.
- No production module and no new test/harness/fixture module may import an
  executable ODW path. The forbidden set is defined by
  `tests/diagnostics/odw-import-policy.ts` (`isForbiddenOdwImport`): bare `odw`;
  the qualified paths `odw/src/{index,loader,primitives,runtime,runtime/<tail>}`
  and their `odw/dist/…` equivalents; and the sibling-checkout equivalents under
  `…/open-dynamic-workflows/{src,dist}/…`. The parity corpus and its suite import
  only from the `odw-lint` package entry (`src/index.ts`) and existing in-repo
  test fixture helpers. `checkMeta`/`scanDualCompat` are consumed only as
  *documented static contracts* re-expressed by the in-repo manifest, never as
  live ODW imports (`docs/technical-design.md` §11.2 final paragraph forbids
  executing fixture bodies; §11.3 forbids executable ODW imports; ADR
  `docs/adr/0001-static-analysis-boundary.md`).
- The suite must not evaluate, `import()`, `require`, `new Function`, or
  otherwise execute any fixture body. Fixtures are read as passive UTF-8 text via
  the existing `readFixtureSource` helper only.
- This task is **test-and-docs-only**. No file under `src/` and no public export
  in `src/index.ts` or `package.json` `exports` may change. In particular,
  `odw/claude-pure-meta` emission stays deferred to task 3.1.1 and must not be
  added to `src/static-analysis/workflow-metadata.ts` (`docs/roadmap.md`
  lines 486–487; `docs/developers-guide.md` lines 180–183).
- Existing frozen corpora are read-only here: the trusted ODW example snapshots
  under `tests/static-analysis/fixtures/odw-examples/` and their manifest, and
  the invalid-workflow fixtures/manifests, must not change. Do not run a mutating
  formatter over any `.js` fixture file.
- New dual-compat fixture `.js` files are ODW-valid by construction: each has a
  real pure-literal `export const meta = { name, description }` and a body that
  parses, so the only diagnostics they may emit are the intended §9.2 Claude
  compatibility warnings (or none). If a fixture emits any §9.1 dialect *error*,
  the fixture is wrong — fix the fixture, never weaken an expectation.
- en-GB Oxford spelling ("-ize"/"-yse"/"-our") in all prose, comments, and commit
  messages (`AGENTS.md` "Code Style and Structure"; `en-gb-oxendict`).
- Every new or modified code file stays at or below 400 lines and opens with a
  `/** @file … */` block (`AGENTS.md` "Keep file size manageable" line 31;
  "Docs" line 273).

## Tolerances (exception triggers)

- Scope: if delivery needs to touch more than 12 files or add more than ~420 net
  lines (fixtures included), stop and escalate.
- Interface: if any change to `src/` production code or the public export surface
  becomes necessary to make a parity assertion pass, stop and escalate — that
  signals the parity target is a real production gap (for example a §9.2 rule not
  actually emitted), which is a design decision, not a fixture edit.
- Emission gap: if a documented dual-compat expectation cannot be met because
  `odw-lint` does not emit the equivalent rule today (for example
  `odw/claude-pure-meta`, deferred to 3.1.1), do **not** add the rule. Record the
  scoped exclusion in the Decision Log and cover only the accept-path
  (portability-clean) parity for that surface.
- Dependencies: if a new runtime or dev dependency seems required, stop and
  escalate. Everything needed (`bun:test`, `fast-check`, the `odw-lint` entry,
  the fixture helpers) is already present.
- Iterations: if `make all` still fails after 3 focused fix attempts on the same
  item, stop and escalate.
- Ambiguity: if "trusted static expectation" needs a definition beyond "the
  hand-authored manifest value derived from the §9.2 contract and the vendored
  `dual-compat.ts` behaviour, guarded for freshness against the fixture source",
  stop and present options.

## Risks

- Risk: a dual-compat fixture accidentally trips a dialect error (for example a
  computed `meta`, an extra `export`, or an unparseable body), so its expected
  status is no longer a clean `warning`/`no-error`.
  Severity: medium; Likelihood: medium.
  Mitigation: build each fixture from a known-portable skeleton (pure-literal
  `meta`, `return agent("…")` body) and add only the single hazard under test;
  the parity suite asserts `dialectErrorRules` is empty for every dual-compat
  fixture, so any accidental dialect error fails loudly.
- Risk: the deterministic-time scanner reports a hazard span differently from a
  hand-authored anchor (for example `Date.now` versus `Date.now()`), making the
  manifest span text drift from live output.
  Severity: medium; Likelihood: medium.
  Mitigation: derive the expected span from the fixture source and the
  reviewer-facing anchor with the existing `deriveAnchoredDiagnosticSpan`
  (exported from `tests/static-analysis/fixtures/refresh-metadata.ts`) and cross-
  check the live span with `sliceSourceSpan`, exactly as
  `tests/static-analysis/deterministic-time-spans.test.ts` already does. The span
  suite (that file) already pins the detector's exact span text (`Date.now`,
  `Date["now"]`, etc.), so anchors are copied from proven behaviour, not guessed.
- Risk: `odw/claude-pure-meta` looks like an in-scope "pure metadata" expectation
  but is not emitted by production.
  Severity: medium; Likelihood: high.
  Mitigation: verified in `src/static-analysis/workflow-lint.ts` line 93 that
  `claudeCompatibility` is built solely from `scanDeterministicTimeWarnings`;
  `claude-pure-meta` is catalogued but unemitted and deferred to 3.1.1. The
  pure-metadata parity is therefore scoped to the `checkMeta` *accept-path*
  (pure-literal valid `meta` ⇒ no diagnostic), documented in the Decision Log.
- Risk: a new fixture directory that no manifest owns causes a corpus/directory
  mismatch or a stale-manifest failure in
  `tests/static-analysis/fixture-metadata-refresh.test.ts`.
  Severity: medium; Likelihood: medium.
  Mitigation: register the corpus, its manifest, and a corpus-vs-directory
  reconciliation check together in the same work item (WI-1), and add a freshness
  meta-test that recomputes `sha256` and anchored spans from the fixture source
  so the manifest can never silently drift.
- Risk: `tests/build-gate/documentation-contents.test.ts` fails when the new
  ExecPlan is not indexed or when a pinned developers-guide phrase changes.
  Severity: low; Likelihood: medium.
  Mitigation: index this ExecPlan in `docs/contents.md` in WI-1 (as 2.3.1 had
  to), and read the build-gate test before editing docs in WI-4.

## Progress

- [x] (2026-07-05T13:58:01Z) WI-1: Scaffold the dual-compat parity fixture
  corpus and prove pure-literal metadata is portability-clean (`checkMeta`
  accept-path parity).
- [x] (2026-07-05T14:17:46Z) WI-2: Add deterministic-time dual-compat fixtures
  and assert `scanDualCompat` warning parity (rule, severity, message, span) plus
  a portable counter-example.
- [x] (2026-07-05T14:27:22Z) WI-3: Integrate the dual-compat corpus into the
  loader-parity harness and add inertness plus manifest-freshness guards.
- [x] (2026-07-05T14:31:00Z) WI-4: Reconcile the developers guide and roadmap.

## Surprises & Discoveries

- Observation: the ODW sibling checkout at
  `/data/leynos/Projects/open-dynamic-workflows` is unreadable from this agent
  session — `grep`/`cat`/`python` file reads and the `Read` tool are all refused
  by the Claude Code working-directory security policy ("may only … from allowed
  working directories: '/data/leynos/Projects/odw-lint',
  '/data/leynos/Projects/odw-lint.worktrees'").
  Evidence: repeated blocked commands against
  `open-dynamic-workflows/src/dual-compat.ts`.
  Impact: `checkMeta`/`scanDualCompat` behaviour is pinned instead to (a) the
  documented contract in `docs/technical-design.md` §§9.2 and 11.2, (b) the
  vendored behaviour statement in `docs/developers-guide.md` lines 28–29, and
  (c) `odw-lint`'s own shipped scanner, which is the actual diagnostic producer
  this task asserts against. No parity claim depends on a live ODW import — that
  is forbidden anyway (§11.3). This is the recorded tooling-failure fallback the
  standing rules allow; it does not block the plan.
- Observation: production `claudeCompatibility` is derived only from
  `scanDeterministicTimeWarnings`.
  Evidence: `src/static-analysis/workflow-lint.ts` line 93.
  Impact: the "pure metadata" parity surface has no positive emitted rule today;
  it is scoped to the accept-path (see Decision Log).
- Observation: new `.js` fixtures are covered by the normal Biome/Oxlint gates.
  Evidence: WI-1 `make all` failed first on module-level `return`, then on
  missing `@file` headers in the new dual-compat fixture files.
  Impact: dual-compat fixtures use top-level `await agent(...)` instead of
  top-level `return await agent(...)`, and include module-level `@file` comments.
  This preserves passive fixture semantics while satisfying the repository-wide
  JavaScript gates.
- Observation: the WI-2 red check failed on the provisional `Date.now` span.
  Evidence: `bun test ./tests/static-analysis/dual-compat-parity.test.ts`
  reported the expected line 9 / offset 240 span while the live diagnostic used
  line 10 / offset 234 after fixture headers were included.
  Impact: deterministic-time manifest spans are derived from live
  `lintWorkflowSource` output over the committed fixture text, then cross-checked
  with `expectSpanToMatchSource` in the parity suite.
- Observation: a local `const Date = …` negative fixture trips Biome's
  restricted-global shadowing rule.
  Evidence: WI-2 `make all` failed in `lint:biome` with
  `lint/suspicious/noShadowRestrictedNames` for the shadowed `Date` binding.
  Impact: the portable counter-example is now `masked-text.js`, which keeps
  `Date.now()`, `Math.random()` and `new Date()` inside an inert string literal.
  It still proves the scanner avoids masked-token false positives without
  weakening repository lint rules.
- Observation: the freshness guard requires each diagnostic anchor to appear
  exactly once in its fixture.
  Evidence: WI-3 focused test failed because `Date.now` appeared in the fixture
  header, metadata description, and hazard expression.
  Impact: deterministic-time fixture comments and metadata descriptions avoid
  exact diagnostic anchor text, leaving the expression as the only anchor source.

## Decision Log

- Decision: scope "pure metadata" parity to the `checkMeta` accept-path
  (pure-literal, valid `meta` ⇒ no `odw/meta-*` and no Claude finding), not to a
  positive `odw/claude-pure-meta` assertion.
  Rationale: `odw/claude-pure-meta` emission is deferred to task 3.1.1
  (`docs/roadmap.md` lines 486–487; `docs/developers-guide.md` lines 180–183) and
  is not emitted by production (`src/static-analysis/workflow-lint.ts` line 93).
  Asserting a positive `claude-pure-meta` here would require production changes
  this task forbids. The reject-side of `checkMeta` (invalid/computed `meta`) is
  already covered by the invalid-workflows corpus and task 2.3.3.
  Date/Author: 2026-07-05, planning agent.
- Decision: the dual-compat manifest is the parity source of truth, hand-authored
  with reviewer-facing anchors, and guarded for freshness by recomputing
  `sha256` and anchored spans from the fixture source using the existing
  `deriveSha256` and `deriveAnchoredDiagnosticSpan` helpers exported from
  `tests/static-analysis/fixtures/refresh-metadata.ts`.
  Rationale: mirrors the established invalid-workflows manifest pattern
  (`tests/static-analysis/fixtures/invalid-workflows/manifest-types.ts` builders,
  `tests/static-analysis/invalid-workflow-metadata-parity.test.ts` assertions)
  without extending the shared refresh writer, keeping each work item atomic and
  gate-passable. Spans are never hand-counted; they are derived from the anchor
  and cross-checked against live output.
  Date/Author: 2026-07-05, planning agent.
- Decision: name the corpus family `dual-compat`, rooted at
  `tests/static-analysis/fixtures/dual-compat/`, with `pure-metadata/` and
  `deterministic-time/` subdirectories.
  Rationale: matches the documented "dual-compatibility parity fixture harness"
  language (`tests/static-analysis/deterministic-time-spans.test.ts` lines 3–4)
  and the ToR/`dual-compat.ts` naming, and keeps the corpus distinct from the
  dialect-error `invalid-workflows` corpus.
  Date/Author: 2026-07-05, planning agent.
- Decision: keep the assigned absolute worktree path in `Constraints`.
  Rationale: the automated roadmap workflow requires agents to work exclusively
  inside that exact git-donkey worktree; repository-relative paths keep the plan
  portable for later humans.
  Date/Author: 2026-07-05, planning agent.
- Decision: export `DUAL_COMPAT_FIXTURE_ROOT` from the dual-compat manifest type
  module and validate status/diagnostic consistency in `dualCompatFixture`.
  Rationale: CodeRabbit flagged the duplicated corpus root string and the lack of
  a manifest status invariant in WI-1. Sharing the root constant and rejecting a
  `no-error` fixture that carries warnings, or a `warning` fixture with no
  warning diagnostic, keeps the manifest honest without changing production code.
  Date/Author: 2026-07-05, implementation agent.

## Outcomes & Retrospective

All four work items are complete. The delivered dual-compat corpus covers the
pure-metadata accept path with two no-diagnostic fixtures and the
deterministic-time surface with `Date.now`, `Math.random`, argless `new Date`,
and masked-text counter-example fixtures. The parity suite now checks live
diagnostics against manifest rule, severity, message, span, and `spanText`
expectations, reduces every fixture through the loader-parity harness, recomputes
fixture hashes and anchored spans from source text, and proves the suite/corpus
import surface has no executable ODW runtime edge. No production `src/` files or
public exports changed, and `odw/claude-pure-meta` remains deferred to task
3.1.1 as intended.

## Context and orientation

`odw-lint` is a private TypeScript/Bun static analyser for ODW workflow files. It
parses workflow source **without executing it** and emits diagnostics. Key files
a newcomer needs for this task:

- `src/static-analysis/workflow-lint.ts` — `lintWorkflowSource(source)` returns
  `WorkflowLintResult` with a canonical merged `.diagnostics` stream (envelope,
  metadata, body-syntax, Claude compatibility). Line 93 shows
  `claudeCompatibility` is built from `scanDeterministicTimeWarnings` only.
- `src/static-analysis/workflow-deterministic-time.ts` — the `scanDualCompat`
  equivalent. `scanDeterministicTimeWarnings(envelope, parseResult)` emits
  `odw/no-date-now`, `odw/no-math-random`, and `odw/no-argless-new-date` warnings
  for global (non-shadowed) `Date.now()`, `Math.random()`, and argless `new Date`
  uses, with spans mapped back to original source.
- `src/static-analysis/workflow-metadata.ts` — the `checkMeta` equivalent; emits
  `odw/meta-object`, `odw/meta-name`, `odw/meta-description`, and one
  `odw/meta-statically-unprovable` warning. Pure-literal valid `meta` yields no
  metadata diagnostic. `odw/claude-pure-meta` is **not** emitted here
  (deferred to 3.1.1).
- `src/index.ts` — the only consumer-facing surface. Tests import from
  `"odw-lint"`, never deep paths. It re-exports `lintWorkflowSource`,
  `sliceSourceSpan`, `snippetForSpan`, `makeRuleId`, `ruleDefinitionFor`,
  `ruleDocsPath`, `RULE_CATALOGUE`, and the `Diagnostic`/`SourceSpan`/`RuleId`
  types.
- `tests/static-analysis/fixtures/loader-parity.ts` — the task 2.3.1 harness.
  `loaderParityOutcome(source)` returns `{ status, ruleClasses,
  dialectErrorRules }`; `expectedNoErrorOutcome()` returns the clean outcome.
  WI-3 reuses this for status/rule-class parity on the new corpus.
- `tests/static-analysis/fixtures/invalid-workflows/manifest-types.ts` — the
  manifest builder pattern (`invalidWorkflowFixture`, `diagnostic`,
  `InvalidWorkflowFixtureSnapshot`, `InvalidWorkflowFixtureDiagnostic`,
  `expectedStatus: "error" | "warning"`); each diagnostic carries `rule`,
  `severity`, `message`, `docs`, `span`, `spanText`. The dual-compat manifest
  mirrors this shape with `expectedStatus: "no-error" | "warning"`.
- `tests/static-analysis/fixtures/invalid-workflows/corpus.ts` —
  `INVALID_WORKFLOW_FIXTURE_CORPUS` (a `FixtureCorpusLocation`) and
  `findInvalidWorkflowFixture`. The dual-compat corpus mirrors this location
  contract.
- `tests/static-analysis/invalid-workflow-metadata-parity.test.ts` — the model
  for a manifest-driven parity suite: it runs `lintWorkflowSource`, projects a
  `ComparableDiagnostic` (`rule`, `severity`, `message`, `span`, `spanText` via
  `sliceSourceSpan`), and asserts against the manifest. WI-2 follows this shape.
- `tests/static-analysis/deterministic-time-spans.test.ts` — proves the detector
  spans and zero false positives on the trusted examples; its lines 3–4 name
  roadmap 2.3.2 as the owner of the *full parity fixture harness*. Reuse its
  span-oracle helpers (`tests/static-analysis/source-span-oracle.ts`:
  `expectSpanToMatchSource`, `decodeSpanText`) rather than re-implementing span
  checks.
- `tests/static-analysis/fixtures/corpus-support.ts` — `readFixtureSource`,
  `fixtureSourceUrl`, `copiedFixtureFileNames`, `sha256`, `FixtureCorpusLocation`.
- `tests/static-analysis/fixtures/refresh-metadata.ts` — re-exports
  `deriveSha256`, `deriveAnchoredDiagnosticSpan`, `FixtureRefreshError`. WI-1 and
  WI-3 reuse `deriveSha256`/`deriveAnchoredDiagnosticSpan` for the freshness
  guard.
- `tests/static-analysis/fixture-metadata-refresh.test.ts` — existing manifest
  freshness suite; WI-1 keeps the new corpus consistent with it (or adds a
  focused freshness meta-test scoped to the dual-compat manifest).
- `tests/diagnostics/odw-import-policy.ts` (`isForbiddenOdwImport`) and
  `tests/diagnostics/import-edge-extraction.ts` — reused by WI-3 to prove the new
  corpus and suite have no executable ODW import edge.
- `docs/contents.md` line ~209 — indexes ExecPlans; add a `roadmap-2-3-2` entry.

Terms. A **dialect error** is a §9.1 error-severity diagnostic (metadata,
import/export, body-syntax) meaning ODW would reject the file before execution.
A **compat warning** is a §9.2 warning (deterministic-time, or the deferred
`claude-pure-meta`). A **pure literal `meta`** is an `export const meta` whose
value is an object literal of literal fields — statically provable without
evaluation. An **anchor** is the reviewer-facing source substring the manifest
records so a byte span can be derived deterministically from the fixture text.

Design references: `docs/technical-design.md` §§5, 6.4, 9.1, 9.2, 11.2, 11.3,
11.5; `docs/terms-of-reference.md` (dual-compatibility row); ADR
`docs/adr/0001-static-analysis-boundary.md`; `docs/developers-guide.md`
lines 28–29 and 164–195; `AGENTS.md` "Change Quality & Committing", "Testing",
"TypeScript Guidance"; `docs/documentation-style-guide.md`.

## Plan of work

Four ordered, independently committable work items. Every work item ends with the
deterministic commit gate (`make all`) green.

**Markdown commit gate (applies to every work item that changes any Markdown
file).** `make all` is `build check-fmt whitespace-hygiene lint typecheck test`
(Makefile line 5); it does **not** run Markdown linting, so AGENTS.md line 89
("Passes Markdown linting when Markdown files change. (`make markdownlint`
verifies this.)") is not satisfied by `make all` alone. Therefore any work item
whose commit touches a Markdown file must, *in the same commit*, format exactly
the Markdown paths it changed and then run the Markdown gates:

```sh
bunx mdtablefix <changed .md paths>
bunx markdownlint-cli2 --fix <changed .md paths>
make markdownlint
make nixie
```

Because this ExecPlan is a living document, **every** work item records its
`Progress` (and, where relevant, `Surprises`/`Decision Log`) tick in the same
commit — that edit alone makes `docs/execplans/roadmap-2-3-2.md` a changed
Markdown path, so every work item runs the Markdown gate on at least that file.
The per-item Markdown path lists below name only files that item definitely
edits, so each formatter invocation is path-safe.

### WI-1: Dual-compat corpus scaffold + pure-metadata accept-path parity

Implements `docs/technical-design.md` §11.2 (third bullet — `checkMeta` accept
side: valid pure-literal metadata is portability-clean) and §5/§6.4 + ADR 0001
(no execution). Testing rules from `AGENTS.md` "Testing".

Docs to read first: `docs/technical-design.md` §§9.1, 9.2, 11.2; `docs/terms-of-
reference.md` dual-compatibility row; `docs/developers-guide.md` lines 164–195;
`AGENTS.md` "Testing" and "TypeScript Guidance". Skills to load: `execplans`
(this file); `leta` for symbol navigation of `lintWorkflowSource`, the manifest
builders, and `FixtureCorpusLocation`; `grepai` for main-branch intent search
only; `en-gb-oxendict` for prose. The Rust/Python router skills and
`hypothesis`/`crosshair`/`mutmut` do **not** apply (TypeScript); use `fast-check`
if an invariant angle is warranted, per `AGENTS.md` "Invariant testing".

Add:

- Fixture files under `tests/static-analysis/fixtures/dual-compat/pure-metadata/`
  — at least two ODW-valid, portable workflows with a pure-literal
  `export const meta = { name, description }` and a `return agent("…")`-style body
  that emits **no** diagnostics. Include one "adversarial-but-clean" case (for
  example a `meta` whose string field text contains decoy `Date.now` inside a
  string literal, proving masking keeps it clean).
- `tests/static-analysis/fixtures/dual-compat/manifest-types.ts` — mirror
  `invalid-workflows/manifest-types.ts`: a `DualCompatFixtureSnapshot`
  (`family`, `fileName`, `fixturePath`, `sha256`, `expectedStatus: "no-error" |
  "warning"`, `expectedDiagnostics`) and a `DualCompatFixtureDiagnostic`
  (`rule`, `severity`, `message`, `docs`, `span`, `spanText`), with frozen
  builders that validate each rule against `RULE_CATALOGUE`.
- `tests/static-analysis/fixtures/dual-compat.ts` — the frozen
  `DUAL_COMPAT_FIXTURE_SNAPSHOTS` manifest; pure-metadata entries declare
  `expectedStatus: "no-error"` with empty `expectedDiagnostics`.
- `tests/static-analysis/fixtures/dual-compat/corpus.ts` —
  `DUAL_COMPAT_FIXTURE_CORPUS` (a `FixtureCorpusLocation`) and a
  `findDualCompatFixture` lookup, mirroring the invalid-workflows corpus module.
- `tests/static-analysis/dual-compat-parity.test.ts` — a `describe("dual-compat
  pure-metadata parity")` that iterates the pure-metadata snapshots, runs
  `lintWorkflowSource`, and asserts the live diagnostics list is empty and
  `loaderParityOutcome(...)` equals `expectedNoErrorOutcome()`. Add a
  directory-vs-manifest reconciliation assertion (every fixture file is
  manifested and vice versa) using `copiedFixtureFileNames`.
- Index this ExecPlan in `docs/contents.md` (required by the build-gate
  documentation-contents test).

Tests this work item adds: the pure-metadata parity `describe`; the
directory/manifest reconciliation assertion. Snapshot use is not needed here
(the expectation is "zero diagnostics"); a semantic assertion is clearer per
`AGENTS.md` "Snapshot scope".

Red/Green/Refactor: Red — add `dual-compat-parity.test.ts` importing the
not-yet-created `./fixtures/dual-compat` manifest and run the focused file; it
fails to resolve (documented expected failure). Green — add the fixtures,
manifest types, manifest, and corpus module; the focused file passes. Refactor —
extract any shared projection helper, rerun the focused file and `make test`.

Markdown files this work item edits: `docs/contents.md` (the new `roadmap-2-3-2`
index entry — mandatory here, because `tests/build-gate/documentation-contents.
test.ts` runs inside `make test` and fails the moment the already-present
`docs/execplans/roadmap-2-3-2.md` is unindexed, so the index edit cannot be
deferred to WI-4) and `docs/execplans/roadmap-2-3-2.md` (this file's `Progress`
tick). Per the Markdown commit gate above, this work item runs, before `make
all`:

```sh
bunx mdtablefix docs/contents.md docs/execplans/roadmap-2-3-2.md
bunx markdownlint-cli2 --fix docs/contents.md docs/execplans/roadmap-2-3-2.md
make markdownlint
make nixie
```

Both listed paths exist at this point (`docs/contents.md` is edited here and
`docs/execplans/roadmap-2-3-2.md` already exists on the branch), so the formatter
command is path-safe.

### WI-2: Deterministic-time (`scanDualCompat`) warning parity

Implements `docs/technical-design.md` §11.2 (second bullet — `scanDualCompat`
warning ⇒ equivalent `odw-lint` rule), §9.2 (the three deterministic-time
warnings), and §11.5 (spans point into original source). §9.3's rule-quality
discipline motivates the negative counter-example. Testing rules from `AGENTS.md`
"Testing".

Docs to read first: `docs/technical-design.md` §§9.2, 11.2, 11.5;
`src/static-analysis/workflow-deterministic-time.ts` (top comment + rule ids);
`tests/static-analysis/deterministic-time-spans.test.ts` (span text it already
proves); `tests/static-analysis/source-span-oracle.ts`. Skills: `leta` for the
detector and span helpers; `en-gb-oxendict`; `fast-check` only if a property
angle is warranted (a finite table of hazards is the natural shape here).

Add under `tests/static-analysis/fixtures/dual-compat/deterministic-time/`:

- One fixture per hazard: a `Date.now()` call, a `Math.random()` call, and an
  argless `new Date()` call — each inside an otherwise-portable, ODW-valid
  workflow. Copy the exact expected span text from the proven detector behaviour
  in `deterministic-time-spans.test.ts` (for example `Date.now` for
  `const t = Date.now();`).
- One portable counter-example whose deterministic-time-looking token is shadowed
  or lives in a masked region (for example a workflow-local `const Date = …` or
  the token inside a string/comment), which must emit **no** warning — the
  false-positive guard.

Extend `DUAL_COMPAT_FIXTURE_SNAPSHOTS` with these entries: the hazard fixtures
declare `expectedStatus: "warning"` and one `expectedDiagnostics` entry each
(`rule`, `severity: "warning"`, `message` from the rule catalogue, `docs`,
`span`, `spanText` anchor); the counter-example declares
`expectedStatus: "no-error"` with empty diagnostics.

In `dual-compat-parity.test.ts` add `describe("dual-compat deterministic-time
parity")`: iterate the deterministic-time snapshots, run `lintWorkflowSource`,
project a `ComparableDiagnostic` (`rule`, `severity`, `message`, `span`,
`spanText` via `sliceSourceSpan`) exactly as
`invalid-workflow-metadata-parity.test.ts` does, and assert the live projection
equals the manifest's `expectedDiagnostics`. Cross-check each span with
`expectSpanToMatchSource` (span oracle) so §11.5 is enforced. Assert every hazard
fixture yields `status: "warning"` and empty `dialectErrorRules` through
`loaderParityOutcome`, and that the counter-example yields `no-error`.

Tests this work item adds: the deterministic-time parity `describe`; per-hazard
span-oracle assertions; the negative counter-example assertion.

Red/Green/Refactor: Red — wire the parity assertion against a deliberately wrong
expected value first (for example an off-by-one anchor or a swapped rule id) and
observe it fail for the intended reason; record the transcript. Green — switch to
the manifest-derived expectation and rerun; it passes. Refactor — fold the
manifest→comparable projection into a shared helper reused by both parity
`describe`s, rerun the focused file and `make test`. (Red-by-mutation is the
documented "nearest observable substitute" for characterization parity over
existing behaviour.)

Markdown files this work item edits: `docs/execplans/roadmap-2-3-2.md` (this
file's `Progress` tick). Per the Markdown commit gate above, run before `make
all`:

```sh
bunx mdtablefix docs/execplans/roadmap-2-3-2.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-3-2.md
make markdownlint
make nixie
```

### WI-3: Harness integration + inertness + manifest-freshness guards

Implements `docs/technical-design.md` §11.2 (parity tests must not execute
fixture bodies; the harness reuse point) and §11.3 (no executable ODW import),
plus the freshness discipline that keeps the manifest honest. Testing rules from
`AGENTS.md` "Testing".

Docs to read first: `docs/technical-design.md` §§11.2, 11.3;
`tests/static-analysis/fixtures/loader-parity.ts`;
`tests/diagnostics/odw-import-policy.ts`;
`tests/diagnostics/import-edge-extraction.ts`;
`tests/static-analysis/hostile-metadata-security.test.ts`;
`tests/static-analysis/fixtures/refresh-metadata.ts` (the `deriveSha256` /
`deriveAnchoredDiagnosticSpan` exports). Skills: `leta` to confirm the reused
signatures; `code-review` heuristics to avoid duplicating the existing
hostile-metadata suite.

Add to `dual-compat-parity.test.ts` (or a sibling
`dual-compat-parity-guards.test.ts` if the primary file nears 400 lines):

- A **harness-integration** `describe`: iterate the whole
  `DUAL_COMPAT_FIXTURE_SNAPSHOTS` and assert `loaderParityOutcome(source).status`
  equals the manifest `expectedStatus` and the outcome `ruleClasses` contains the
  manifest rule-class set — proving the 2.3.1 harness reduces the new corpus the
  same way it reduces the existing corpora.
- A **manifest-freshness** `describe`: for every dual-compat snapshot, recompute
  `deriveSha256(readFixtureSource(...))` and assert it equals the manifest
  `sha256`; for every expected diagnostic, re-derive the span from the anchor
  with `deriveAnchoredDiagnosticSpan` and assert it equals the manifest `span`.
  This makes silent fixture/manifest drift impossible.
- An **inertness** `describe`: read the corpus/suite source files through the
  existing import-edge extractor and assert `isForbiddenOdwImport` returns
  `false` for every extracted specifier (Red-by-mutation first against a
  genuinely forbidden specimen such as `"odw/src/loader"` — never the
  bare-shortcut `"odw/loader"`, which the classifier passes as clean — then point
  at the real edges).

Tests this work item adds: harness-integration parity; manifest-freshness
recomputation; import-hygiene inertness.

Red/Green/Refactor: Red — the import-hygiene assertion flags the injected
forbidden specimen; the freshness assertion fails if a manifest `sha256` is
mutated. Green — real edges are clean and the recomputed values match.
Refactor — tidy helper names, rerun the focused file and `make all`.

Markdown files this work item edits: `docs/execplans/roadmap-2-3-2.md` (this
file's `Progress` tick). Per the Markdown commit gate above, run before `make
all`:

```sh
bunx mdtablefix docs/execplans/roadmap-2-3-2.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-3-2.md
make markdownlint
make nixie
```

### WI-4: Documentation and roadmap reconciliation

Implements `AGENTS.md` "Documentation Maintenance" and records where the
dual-compat parity corpus now lives. No code behaviour change.

Docs to read first: `docs/developers-guide.md` lines 164–195 and the
loader-parity paragraph near line 544; `docs/documentation-style-guide.md`;
`tests/build-gate/documentation-contents.test.ts` (to avoid breaking a pinned
phrase). Skills: `en-gb-oxendict`; `execplans` for keeping this file current.

- Edit `docs/developers-guide.md`: add a present-tense paragraph naming
  `tests/static-analysis/fixtures/dual-compat.ts`,
  `tests/static-analysis/fixtures/dual-compat/…`, and
  `tests/static-analysis/dual-compat-parity.test.ts`; describe the two parity
  surfaces (pure-metadata accept-path and deterministic-time warnings), the
  manifest-as-source-of-truth + freshness guard, and the explicit deferral of
  `odw/claude-pure-meta` emission to task 3.1.1. Keep the existing 3.1.1 deferral
  sentence (lines 180–183) intact. Wrap prose at 80 columns.
- If `tests/build-gate/documentation-contents.test.ts` pins any edited phrase,
  update its expectation in the same commit.
- Edit `docs/roadmap.md`: flip `- [ ] 2.3.2.` to `- [x] 2.3.2.` (leaf task only;
  do not touch 2.3.3–2.3.5) and add a one-line completion note referencing this
  ExecPlan, following the style of the 2.3.1 completion note.
- Update this ExecPlan's `Progress`, `Decision Log`, and
  `Outcomes & Retrospective`, then append the required revision note.

Markdown files this work item edits: `docs/developers-guide.md`,
`docs/roadmap.md`, and `docs/execplans/roadmap-2-3-2.md`. It does **not** edit
`docs/contents.md` — that index entry landed in WI-1 — so `docs/contents.md`
must not appear in this work item's formatter path list (standing rule: direct
formatter/linter file lists name only files that work item changed). Per the
Markdown commit gate above, run before `make all`:

```sh
bunx mdtablefix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-2-3-2.md
bunx markdownlint-cli2 --fix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-2-3-2.md
make markdownlint
make nixie
```

## Concrete steps

Run everything from the worktree
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-3-2`.

1. WI-1 Red:

   ```sh
   bun test tests/static-analysis/dual-compat-parity.test.ts
   ```

   Expect a resolve failure referencing the missing `./fixtures/dual-compat`
   module.

2. WI-1 Green: add the pure-metadata fixtures, `dual-compat/manifest-types.ts`,
   `dual-compat.ts`, `dual-compat/corpus.ts`, and the pure-metadata `describe`;
   add the `docs/contents.md` index entry; rerun the focused command; expect the
   pure-metadata and reconciliation assertions to pass.

3. WI-1 gate + commit. This commit changes Markdown (`docs/contents.md` and this
   ExecPlan's `Progress` tick), so run the Markdown gate on exactly those paths
   before `make all`:

   ```sh
   bunx mdtablefix docs/contents.md docs/execplans/roadmap-2-3-2.md
   bunx markdownlint-cli2 --fix docs/contents.md docs/execplans/roadmap-2-3-2.md
   make markdownlint
   make nixie
   make all
   ```

   Expect the Markdown gates to pass and then `build`, `check-fmt`,
   `whitespace-hygiene`, `lint`, `typecheck`, and `test` to pass. Commit with an
   imperative subject (for example "Add dual-compat pure-metadata parity
   fixtures"). Do not run a repo-global format.

4. WI-2: add the deterministic-time fixtures and manifest entries (Red-by-
   mutation, then Green), rerun `bun test
   tests/static-analysis/dual-compat-parity.test.ts`. This commit also ticks the
   ExecPlan `Progress`, so run the Markdown gate on the ExecPlan before `make
   all`, then commit:

   ```sh
   bunx mdtablefix docs/execplans/roadmap-2-3-2.md
   bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-3-2.md
   make markdownlint
   make nixie
   make all
   ```

5. WI-3: add the harness-integration, freshness, and inertness `describe`s
   (Red-by-mutation on a genuinely forbidden specimen and on a mutated `sha256`,
   then Green), rerun the focused file. This commit also ticks the ExecPlan
   `Progress`, so run the Markdown gate on the ExecPlan before `make all`, then
   commit:

   ```sh
   bunx mdtablefix docs/execplans/roadmap-2-3-2.md
   bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-3-2.md
   make markdownlint
   make nixie
   make all
   ```

6. WI-4: edit docs, format only the files this item changes, then run the
   documentation gates and commit:

   ```sh
   bunx mdtablefix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-2-3-2.md
   bunx markdownlint-cli2 --fix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-2-3-2.md
   make markdownlint
   make nixie
   make all
   ```

   The three listed Markdown paths are all edited in this work item (WI-4 does
   **not** touch `docs/contents.md`, which was indexed in WI-1), so the formatter
   command is path-safe. Do not run a repo-global format.

## Validation and acceptance

Commit gate for every work item (`AGENTS.md` "Change Quality & Committing"; the
Makefile `all:` target runs `build check-fmt whitespace-hygiene lint typecheck
test` in order):

```sh
make all
```

Every work item whose commit changes a Markdown file additionally formats exactly
the changed paths and runs the Markdown gates (AGENTS.md line 89; `make all` does
not run Markdown linting). This applies to **all four** work items, because each
ticks this ExecPlan's `Progress` in its commit: WI-1 also changes
`docs/contents.md`; WI-4 also changes `docs/developers-guide.md` and
`docs/roadmap.md`; WI-2 and WI-3 change only this ExecPlan. The per-item
formatter path list names only files that item edits, so each is path-safe:

```sh
bunx mdtablefix <changed .md paths>
bunx markdownlint-cli2 --fix <changed .md paths>
make markdownlint
make nixie
```

Red-Green-Refactor evidence to capture in `Progress`/`Surprises`:

- WI-1 Red: `bun test tests/static-analysis/dual-compat-parity.test.ts` fails to
  resolve `./fixtures/dual-compat`. Green: same command passes after the corpus
  and manifest land.
- WI-2 Red: the deterministic-time parity `describe` fails when an anchor or rule
  id is deliberately wrong (observed once, then reverted). Green: passes against
  the manifest-derived expectation with span-oracle cross-checks.
- WI-3 Red: the import-hygiene assertion flags an injected genuinely forbidden
  specimen (`"odw/src/loader"`), and the freshness assertion fails on a mutated
  manifest `sha256`. Green: real edges are clean and recomputed values match.

Acceptance (behaviour a human can verify):

- Running `make test` shows `tests/static-analysis/dual-compat-parity.test.ts`
  passing with: a pure-metadata block asserting zero diagnostics and clean
  parity outcome; a deterministic-time block asserting the exact §9.2 warning,
  severity, message, and original-source span for each of `Date.now`,
  `Math.random`, and argless `new Date`, plus a portable counter-example with no
  warning; a harness-integration block asserting status and rule-class parity
  through the 2.3.1 reducer; a freshness block; and an inertness block asserting
  no forbidden ODW import edge.
- Corrupting a dual-compat fixture byte (locally, then reverted) makes the
  freshness `sha256` assertion fail, and if the corruption changes diagnostics,
  makes the parity block fail — proving the corpus has teeth.
- No production file under `src/` changed; `git diff --stat` shows only test and
  docs files.

Quality criteria for "done":

- Tests: the `dual-compat-parity` `describe`s pass; the whole `make test` suite
  stays green.
- Lint/typecheck: `make lint` and `make typecheck` clean (part of `make all`).
- Formatting: `make check-fmt` and `make whitespace-hygiene` clean; Markdown gates
  green for WI-4.
- Boundary: the new modules import only `"odw-lint"` and existing fixture
  helpers; `isForbiddenOdwImport` is `false` for every dual-compat import edge;
  `src/` and public exports are unchanged.

## Idempotence and recovery

Each work item is a separate commit and re-runnable. `make all` is idempotent.
If a focused test is left red, re-run `bun test
tests/static-analysis/dual-compat-parity.test.ts` after fixing; nothing here
mutates tracked fixtures or global state. To abandon uncommitted implementation
files, remove the specific untracked files named in `git status --short` (for
example `git clean -n` first to preview, then `git clean -fd -- <verified
paths>`) and use `git restore -- <tracked-paths>` only for tracked files; no
external state is touched.

## Artifacts and notes

Tooling notes for the implementer:

- GrepAI (main-branch intent index) and `leta` (branch-local navigation) are the
  primary search tools; verify every branch-local fact directly in this worktree
  before acting.
- The ODW sibling checkout at `/data/leynos/Projects/open-dynamic-workflows` is
  **not readable** from the automated agent session (Claude Code working-directory
  security policy refuses `grep`/`cat`/`python`/`Read` against it). This is the
  recorded tooling-failure fallback: `checkMeta`/`scanDualCompat` behaviour is
  pinned to `docs/technical-design.md` §§9.2/11.2, the vendored-behaviour
  statement in `docs/developers-guide.md` lines 28–29, and `odw-lint`'s own
  shipped scanner — never to a live ODW import (forbidden by §11.3). If a future
  run regains read access, cross-check the anchors against
  `open-dynamic-workflows/src/dual-compat.ts` and record any divergence.

Verified facts underpinning the plan:

- `lintWorkflowSource` builds `claudeCompatibility` solely from
  `scanDeterministicTimeWarnings` (`src/static-analysis/workflow-lint.ts` line
  93); `odw/claude-pure-meta` is catalogued but unemitted (deferred to 3.1.1 per
  `docs/roadmap.md` lines 486–487 and `docs/developers-guide.md` lines 180–183).
- The deterministic-time rule ids are `odw/no-date-now`, `odw/no-math-random`,
  and `odw/no-argless-new-date` (`workflow-deterministic-time.ts` lines 37–39);
  their proven span text lives in `deterministic-time-spans.test.ts`.
- The invalid-workflows manifest builder + parity suite
  (`invalid-workflows/manifest-types.ts`,
  `invalid-workflow-metadata-parity.test.ts`) is the reuse template for the
  dual-compat manifest and its `ComparableDiagnostic` projection.
- `deriveSha256` and `deriveAnchoredDiagnosticSpan` are exported from
  `tests/static-analysis/fixtures/refresh-metadata.ts` for the freshness guard.

## Interfaces and dependencies

New test-only manifest module
`tests/static-analysis/fixtures/dual-compat/manifest-types.ts` must export at
least:

```typescript
import type { DiagnosticSeverity, RuleId, RuleDocumentationPath, SourceSpan } from "odw-lint";

export type DualCompatFixtureFamily = "pure-metadata" | "deterministic-time";
export type DualCompatFixtureStatus = "no-error" | "warning";

export interface DualCompatFixtureDiagnostic {
  readonly rule: RuleId;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly docs: RuleDocumentationPath;
  readonly span: SourceSpan;
  readonly spanText: string;
}

export interface DualCompatFixtureSnapshot {
  readonly family: DualCompatFixtureFamily;
  readonly fileName: string;
  readonly fixturePath: string;
  readonly sha256: string;
  readonly expectedStatus: DualCompatFixtureStatus;
  readonly expectedDiagnostics: readonly DualCompatFixtureDiagnostic[];
}
```

`tests/static-analysis/fixtures/dual-compat.ts` exports the frozen
`DUAL_COMPAT_FIXTURE_SNAPSHOTS`; `tests/static-analysis/fixtures/dual-compat/
corpus.ts` exports `DUAL_COMPAT_FIXTURE_CORPUS` (a `FixtureCorpusLocation`) and
`findDualCompatFixture`.

Dependencies (all already present): `bun:test`; the `odw-lint` entry
(`lintWorkflowSource`, `sliceSourceSpan`, `snippetForSpan`, `makeRuleId`,
`ruleDefinitionFor`, `ruleDocsPath`, `RULE_CATALOGUE`, and the
`Diagnostic`/`SourceSpan`/`RuleId` types); the fixture helpers in
`corpus-support.ts`; the 2.3.1 harness in `fixtures/loader-parity.ts`; the span
oracle in `source-span-oracle.ts`; `deriveSha256`/`deriveAnchoredDiagnosticSpan`
from `fixtures/refresh-metadata.ts`; and, for WI-3, `isForbiddenOdwImport` and
the import-edge extractor under `tests/diagnostics/`. `fast-check` is available
if an invariant angle is chosen, but a table-driven fixture iteration is the
expected shape for this finite corpus.

## Revision note

Initial draft (2026-07-05, planning round 1). Establishes the dual-compat parity
fixture corpus as four ordered, test-and-docs-only work items keyed to
`docs/technical-design.md` §§9.2, 11.2, 11.3, 11.5 and ADR 0001: a `checkMeta`
accept-path (pure-metadata) parity surface, a `scanDualCompat` deterministic-time
warning parity surface with a portable counter-example, harness integration plus
inertness and manifest-freshness guards, and documentation reconciliation. Scopes
out the deferred `odw/claude-pure-meta` emission (task 3.1.1) and records that the
ODW sibling checkout is unreadable from this session, with the design pinned to
in-repo vendored behaviour and the documented §9.2/§11.2 contract. No
implementation performed; awaiting approval.

Round 2 (2026-07-05, planning agent). Resolved the design reviewer's single
blocking point: `make all` (verified Makefile line 5 =
`build check-fmt whitespace-hygiene lint typecheck test`) does **not** run
`make markdownlint`/`make nixie`, yet WI-1 must commit a Markdown change —
`docs/contents.md` cannot be deferred to WI-4 because
`tests/build-gate/documentation-contents.test.ts` (run by `make test` inside
WI-1's `make all`) fails the instant the already-present
`docs/execplans/roadmap-2-3-2.md` is unindexed (verified AGENTS.md line 89
requires Markdown linting whenever Markdown changes). Fix: added a shared
"Markdown commit gate" definition to the Plan of work, and folded `mdtablefix` +
`markdownlint-cli2 --fix` on exactly the changed Markdown paths, plus
`make markdownlint`/`make nixie`, into WI-1's gate and into every other
work item that changes Markdown (WI-2/WI-3 tick this ExecPlan's `Progress`; WI-4
edits the developers guide and roadmap). Correspondingly dropped
`docs/contents.md` from WI-4's formatter path list, since WI-4 does not edit
it — keeping every direct formatter file list scoped to files that item actually
changes (path-safety standing rule). No implementation performed; awaiting
approval.

Round 3 (2026-07-05, implementation agent). Implemented and committed WI-1
through WI-4 in order. Each work item ran the required Markdown gates and
`make all`; CodeRabbit completed for WI-1 and WI-2, WI-3 required one retry after
an exit-130 stall and then completed with zero findings, and WI-4 documentation
reconciled the developers guide and roadmap. The final state is complete with
all dual-compat parity evidence owned by the `dual-compat-parity` test and its
fixture manifest.
