# Add the hostile metadata security regression test

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 2.1.5 requires a dedicated, release-blocking **security regression
test** proving that linting hostile workflow metadata never evaluates that
metadata and therefore leaves no observable side effect, while still producing a
diagnostic. See `docs/roadmap.md` task 2.1.5 (requires 1.3.4 and 2.1.3) and
`docs/technical-design.md` §11.3.

The ODW loader boundary the linter reproduces is static: `odw-lint` must parse
the ODW envelope and classify metadata **without executing source**
(`docs/adr/0001-static-analysis-boundary.md`; `docs/technical-design.md` §§5,
6.2, 6.3, 9.1). Task 1.3.4 already added hostile-metadata fixtures whose
metadata would leave an observable marker if evaluated (a global write in
`global-marker.js`, a thrown error in `throw-marker.js`). Task 2.1.3 already
made `classifyWorkflowMetadata` classify these passively as
`odw/meta-statically-unprovable` warnings. What is still missing, per §11.3, is
a **single, focused, fixture-driven security regression test** that consolidates
the "diagnostic and no side effect" contract for the whole hostile family and
guards it against regression as the lint surface grows.

After work item 1 a maintainer can run `make all` (or `bun test`) and observe
a dedicated test file, `tests/static-analysis/hostile-metadata-security.test.ts`,
that:

1. lints every `hostile-metadata` fixture through the real static-analysis path
   (`scanWorkflowEnvelope` then `classifyWorkflowMetadata`), and
2. asserts each fixture yields the manifest's expected diagnostic (rule,
   severity, message), the classifier never throws, and the hostile global
   side effect marker `globalThis.__odwLintHostileMetadataWasEvaluated` remains
   `undefined` before and after linting.

Observable success: the new test passes under `make all`; a documented mutation
experiment (temporarily making the lint path evaluate the metadata) makes the
new test fail loudly, proving it is a real regression guard.

## Constraints

Hard invariants that must hold throughout implementation. Violation requires
escalation, not a workaround.

- **Static-analysis boundary (release-blocking).** No production or test code
  added by this plan may import, `eval`, `new Function`, dynamic-`import`, or
  otherwise execute any ODW workflow fixture, the ODW loader, primitive factory,
  runtime launcher, or worker path. Work item 2 may dynamically import only the
  public `odw-lint` entry point in a cold child process. The linter only ever
  reads fixture **source text**. See `docs/adr/0001-static-analysis-boundary.md`,
  `docs/technical-design.md` §§5, 11.3, and the existing forbidden-import guard
  from roadmap 2.1.4. This is the property under test; breaking it defeats the
  task.
- **Do not modify production `src/` behaviour.** Task 2.1.3 already implemented
  passive classification; 2.1.5 is a **test-only** deliverable. If the security
  test cannot pass because production code actually evaluates metadata, stop and
  surface the offender rather than editing production behaviour inside this task
  (mirrors the 2.1.4 planning constraint in `docs/roadmap.md`).
- **Do not grow the hostile fixture corpus in this task.** The existing two
  hostile fixtures already satisfy §11.3's disjunctive requirement ("writes a
  file, reads an environment variable, throws a custom side effect marker, or
  otherwise would be observable"). Adding fixtures would ripple through refresh
  counts and snapshots (`fixture-metadata-refresh-boundaries.test.ts`
  `hostileMetadata: 2`, the refresh snapshots, and the invalid-workflow
  snapshot) and is out of scope. See Decision Log.
- **File-size convention.** No single code file may exceed 400 lines
  (`AGENTS.md` "Keep file size manageable"). The new test must be a new file; do
  not append to `tests/static-analysis/workflow-metadata.test.ts` (already 386
  lines).
- **Determinism and environment hygiene.** Tests must be deterministic
  (`AGENTS.md` Testing). Any global-state mutation (the hostile marker) must be
  cleared and restored in a shared helper (`AGENTS.md` "Environment-dependent
  tests").
- **Prose conventions.** All prose, comments, and commit messages use en-GB
  Oxford spelling ("-ize"/"-yse"/"-our"); see `AGENTS.md` and the
  documentation-style guide.

## Tolerances (exception triggers)

- **Scope:** if implementation requires changing more than 3 files, or more than
  ~250 net new lines, stop and escalate.
- **Production change:** if any file under `src/` must change to make the test
  pass, stop and escalate (a real static-boundary offender has been found).
- **Interface:** if a public API signature in `src/index.ts` must change, stop
  and escalate.
- **Dependencies:** if a new runtime or dev dependency is required, stop and
  escalate. (`node:child_process`, `node:util`, and `bun:test` are already in
  use.)
- **Iterations:** if `make all` still fails after 3 focused fix attempts, stop
  and escalate.
- **Ambiguity:** if a reviewer reads §11.3 as mandating a filesystem-write or
  env-read hostile fixture specifically (not the disjunction), stop and escalate
  before growing the corpus.

## Risks

- Risk: The behaviour under test already passes (2.1.3 shipped passive
  classification), so a naive test would be green from the start and prove
  nothing.
  Severity: medium. Likelihood: high.
  Mitigation: Use the Red-Green-Refactor substitute in "Validation and
  acceptance": a documented mutation experiment that temporarily evaluates the
  metadata to observe the test failing, plus an in-test **canary** assertion
  that the marker detector genuinely fires when the marker is set directly.
- Risk: Redundancy with existing hostile assertions in
  `tests/static-analysis/workflow-metadata.test.ts` and
  `tests/static-analysis/invalid-workflow-fixtures.test.ts`.
  Severity: low. Likelihood: medium.
  Mitigation: The new file is the single fixture-driven security-regression
  surface: it iterates the whole `hostile-metadata` family (auto-covering future
  fixtures), asserts non-throwing classification for `throw-marker.js`
  explicitly, and adds the out-of-process cold-module-graph guard that the other
  files do not. Cite the distinction in the file header.
- Risk: The out-of-process guard is flaky or slow (spawns a process).
  Severity: low. Likelihood: low.
  Mitigation: Mirror the proven pattern in
  `tests/static-analysis/fixture-metadata-refresh-cli.test.ts` ("stays
  import-safe … in a fresh module graph") with a bounded `timeout` and
  `process.execPath`.
- Risk: Global-marker leakage across tests in the same Bun process.
  Severity: low. Likelihood: medium.
  Mitigation: Clear the marker in `beforeEach`/`afterEach` and assert it
  `undefined` both before and after each lint.

## Progress

- [x] Work item 1: Add the in-process hostile metadata security regression test
  (red via mutation experiment, then green).
- [x] Work item 2: Add the out-of-process cold-module-graph import-safety guard
  to the same test file.
- [x] Work item 3: Record the security regression test in docs and tick roadmap
  task 2.1.5.

  Progress note (2026-07-01): Added
  `tests/static-analysis/hostile-metadata-security.test.ts` with marker cleanup,
  a canary test, and a manifest-driven loop over every `hostile-metadata`
  fixture. The normal static path passed with
  `bun test tests/static-analysis/hostile-metadata-security.test.ts`. The
  temporary mutation experiment failed for the intended reasons: the
  global-marker fixture set the hostile marker, and the throw-marker fixture
  propagated `ODW_LINT_HOSTILE_METADATA_EVALUATED`. After reverting the
  mutation, `make all` passed. The requested scrutineer delegation failed
  because its fixed GPT-5.3-Codex-Spark quota was exhausted, so the same gate
  and `coderabbit review --agent` were run directly in the assigned worktree.
  CodeRabbit reported valid findings for the fixture-count guard and diagnostic
  comparison; both were fixed before commit. A later CodeRabbit pass correctly
  identified that the test helper should preserve each real fixture path, which
  was also fixed. Its snapshot assertion suggestion was skipped because this
  ExecPlan deliberately uses semantic assertions and introduces no snapshot
  files.

  Progress note (2026-07-01): Added the child-process guard to
  `tests/static-analysis/hostile-metadata-security.test.ts`. The test imports
  only the public `odw-lint` entry in a fresh module graph, reads hostile
  fixtures as source text, lints them through
  `createOriginalSourceFile`, `scanWorkflowEnvelope`, and
  `classifyWorkflowMetadata`, and exits non-zero if diagnostics are absent or
  the hostile marker appears. `bun test
  tests/static-analysis/hostile-metadata-security.test.ts` and `make all`
  passed. `coderabbit review --agent` reported zero findings for this work
  item. The requested scrutineer delegation remained unavailable because its
  fixed GPT-5.3-Codex-Spark quota was exhausted, so the deterministic gate and
  CodeRabbit command were run directly in the assigned worktree.

  Progress note (2026-07-01): Updated `docs/developers-guide.md` to point at
  the delivered hostile metadata security test, marked `docs/roadmap.md` task
  2.1.5 complete, and added the roadmap completion note. Markdown formatting
  was applied only to the touched Markdown files. `make markdownlint`,
  `make nixie`, and `make all` passed after the documentation update.

  Fix round 1 note (2026-07-02): Re-verified the blocking review findings from
  inside `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-5`. The
  worktree, this ExecPlan, the implementation diff, documentation updates, and
  validation surfaces were all readable. The branch was clean and ahead of
  `origin/main` by three commits:
  `Add hostile metadata regression test`,
  `Guard hostile metadata public imports`, and
  `Document hostile metadata guard`. `grepai search --workspace 'Projects'
  --project 'odw-lint' "metadata classification diagnostics documentation
  roadmap 2.1.5" --toon --compact --limit 8` succeeded against the canonical
  main-branch index; branch-local checks then used `leta` and direct file
  inspection in this worktree. `leta workspace add` reported the workspace was
  already added, and `leta files` listed
  `tests/static-analysis/hostile-metadata-security.test.ts` plus this ExecPlan.
  `sem diff --from origin/main --to HEAD --file-exts .ts` showed the only
  TypeScript entity additions were the hostile metadata security test helpers
  and tests. Focused validation passed with
  `bun test tests/static-analysis/hostile-metadata-security.test.ts` (5 pass,
  0 fail, 20 assertions). Repository validation passed with `make all` (490
  tests, 0 failures, 34 snapshots, 24697 assertions), `make markdownlint` (71
  Markdown files, 0 errors), and `make nixie` (all diagrams validated
  successfully). The requested scrutineer delegation was attempted first, but
  the sub-agent failed before running commands with:
  `You've hit your usage limit for GPT-5.3-Codex-Spark. Switch to another model
  now, or try again at Jul 7th, 2026 11:20 AM.` Because the deterministic gates
  were green and scrutineer was unavailable, `coderabbit review --agent` was run
  directly from this worktree and completed with `findings: 0`.

## Surprises & discoveries

- Observation: `classifyWorkflowMetadata`, `scanWorkflowEnvelope`, and
  `createOriginalSourceFile` are all re-exported from the public `odw-lint`
  entry (`src/index.ts` lines ~48-75), so the out-of-process guard can lint via
  the packaged surface, not just internal paths.
  Evidence: `grep -n "scanWorkflowEnvelope" src/index.ts` -> line 69.
  Impact: Work item 2 can assert the **public** lint surface is import-safe.
- Observation: The hostile marker property name is
  `__odwLintHostileMetadataWasEvaluated`, and the throw marker string is
  `ODW_LINT_HOSTILE_METADATA_EVALUATED`.
  Evidence:
  `tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/*.js`
  and the manifest `manifests/hostile-metadata.ts`.
  Impact: Reuse these constants; do not invent new ones.
- Observation: The blocking dual-review findings for fix round 1 were caused by
  the reviewer session being unable to read the worktree, not by a confirmed
  implementation defect.
  Evidence: `git status --short --branch` in this worktree reported
  `## roadmap-2-1-5...origin/main [ahead 3]`; this ExecPlan and the changed
  files were readable; `bun test
  tests/static-analysis/hostile-metadata-security.test.ts`, `make all`,
  `make markdownlint`, and `make nixie` all passed on 2026-07-02.
  Impact: Fix round 1 records fresh worktree-local evidence instead of changing
  the already-passing implementation behaviour.

## Decision log

- Decision: Reuse the existing two hostile fixtures rather than add a
  filesystem-write or env-read fixture.
  Rationale: `docs/technical-design.md` §11.3 states the security regression
  fixture must include metadata that "writes a file, reads an environment
  variable, throws a custom side effect marker, **or** otherwise would be
  observable if evaluated." This is a disjunction; the global-write and thrown
  marker fixtures already satisfy it. Adding fixtures would force regenerating
  hashes/spans via the 1.3.5 refresh tool and updating multiple snapshot and
  boundary-count tests (`fixture-metadata-refresh-boundaries.test.ts`
  `hostileMetadata: 2`, `__snapshots__/fixture-metadata-refresh*.snap`,
  `__snapshots__/invalid-workflow-fixtures.test.ts.snap`), inflating blast
  radius against the "atomic, gate-passable" requirement. Escalation trigger
  recorded in Tolerances if a reviewer reads §11.3 as conjunctive.
  Date/Author: 2026-07-01, planning agent.
- Decision: Deliver a new dedicated test file rather than extend an existing
  hostile test.
  Rationale: `AGENTS.md` 400-line file limit (workflow-metadata.test.ts is 386
  lines) and the need for a single, discoverable security-regression surface.
  Date/Author: 2026-07-01, planning agent.
- Decision: Satisfy Red-Green-Refactor via a documented mutation experiment plus
  an in-test canary, because the production behaviour already exists.
  Rationale: The execplans skill permits the "nearest observable substitute"
  when true red is unavailable; the deliverable is a regression guard, not new
  production behaviour.
  Date/Author: 2026-07-01, planning agent.
- Decision: Treat the five fix-round blocking findings as stale
  evidence-access failures once the assigned worktree proved readable and the
  gates passed.
  Rationale: Each finding explicitly said the reviewer could not inspect the
  branch, ExecPlan, documentation, or validation output. Fresh verification in
  the assigned worktree showed those artefacts are accessible and that the
  implementation still satisfies the task scope.
  Date/Author: 2026-07-02, fix-round agent.

## Outcomes & retrospective

Delivered the dedicated hostile metadata security regression test for roadmap
2.1.5. The test covers every hostile-metadata fixture through the in-process
static scan and classify path, proves the hostile marker detector is
falsifiable, and verifies the public `odw-lint` entry remains import-safe in a
fresh child process. The deliberate mutation experiment failed for the intended
marker and thrown-error reasons, and the reverted implementation passes
`bun test tests/static-analysis/hostile-metadata-security.test.ts`,
`make markdownlint`, `make nixie`, and `make all`.

The only process deviation was tooling-related: the requested `scrutineer`
sub-agent could not run because its fixed GPT-5.3-Codex-Spark quota was
exhausted. The deterministic gates and CodeRabbit commands were run directly
from the assigned worktree instead, with the same command surfaces recorded in
Progress.

Fix round 1 rechecked the same delivery from the assigned worktree after a
dual-review access failure. The worktree and changed files were readable, the
implementation diff was inspectable with `sem`, branch-local evidence was
verified with `leta` and direct inspection, and the focused, full, Markdown,
and Mermaid gates passed. `coderabbit review --agent` also completed with
`findings: 0`. No implementation or user-facing documentation change was
required by the blocking findings; this revision records the fresh verification
evidence, the scrutineer quota failure, and the clean CodeRabbit result.

## Context and orientation

`odw-lint` is a Bun/TypeScript static linter for Open Dynamic Workflows (ODW).
It reproduces ODW's loader boundary **statically**: it parses the workflow
"envelope" (`export const meta = { … }` plus import/export/top-level
constraints) and classifies metadata **without executing any workflow source**.

Key production modules (all under `src/static-analysis/`, re-exported from
`src/index.ts`):

- `workflow-envelope.ts` — `scanWorkflowEnvelope(sourceFile)` extracts the
  masked metadata declaration and returns a `WorkflowEnvelopeScanResult`.
- `workflow-metadata.ts` — `classifyWorkflowMetadata(scanResult)` returns a
  frozen classification `{ status, diagnostics, … }`. For metadata that cannot
  be proven statically (for example an IIFE expression), status is
  `statically-unprovable` and it emits one passive
  `odw/meta-statically-unprovable` **warning**. It never evaluates the source.
- `source-file.ts` — `createOriginalSourceFile({ filePath, sourceText })` builds
  the immutable source record consumed by the scanner.

Existing hostile-metadata assets (test-only):

- Fixtures:
  `tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/global-marker.js`
  (metadata description is an IIFE that assigns
  `globalThis.__odwLintHostileMetadataWasEvaluated = "hostile-global-marker"`)
  and `.../hostile-metadata/throw-marker.js` (metadata description is an IIFE
  that throws `new Error("ODW_LINT_HOSTILE_METADATA_EVALUATED")`).
- Manifest:
  `tests/static-analysis/fixtures/invalid-workflows/manifests/hostile-metadata.ts`
  exports `HOSTILE_METADATA_FIXTURES` (family `hostile-metadata`,
  `expectedStatus: "warning"`, one `odw/meta-statically-unprovable` diagnostic
  each). Surfaced through `tests/static-analysis/fixtures/invalid-workflows.ts`
  as `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS`.
- Corpus helpers: `tests/static-analysis/fixtures/corpus-support.ts` exports
  `readFixtureSource(corpus, fixturePath)`, `sha256`, `fixtureSourceUrl`,
  `copiedFixtureFileNames`.
- Existing partial coverage to distinguish from (do not duplicate wholesale):
  `tests/static-analysis/workflow-metadata.test.ts` ("keeps hostile
  global-marker metadata passive", "returns a warning instead of throwing
  hostile throw-marker metadata"); `invalid-workflow-fixtures.test.ts` ("reads
  hostile fixture source without setting the global marker");
  `fixture-metadata-refresh-cli.test.ts` ("stays import-safe … in a fresh module
  graph").

Terms of art:

- **Envelope** — the static, non-executing surface of a workflow module: its
  `export const meta` declaration plus import/export and top-level constraints.
- **Side-effect marker** — an observable artefact (here a `globalThis` property,
  or a thrown error) that would only appear if the linter evaluated the
  metadata. Absence of the marker proves the linter stayed static.
- **Statically unprovable** — metadata whose value cannot be reduced to a
  literal without evaluation (for example an IIFE); classified as a passive
  `odw/meta-statically-unprovable` warning, never executed.

## Plan of work

Three atomic, independently committable and gate-passable work items. Each ends
with `make all`. Work items 1 and 2 build one new test file; work item 3 updates
docs. Stage the file so each commit passes gates on its own.

### Work item 1 — In-process hostile metadata security regression test

Docs to read first: `docs/technical-design.md` §11.3 (and §§5, 6.3, 9.1 for the
static boundary); `docs/adr/0001-static-analysis-boundary.md`; `AGENTS.md`
"Testing" and "Keep file size manageable"; `docs/roadmap.md` task 2.1.5. Skills
to load: `leta` (symbol navigation and branch-local verification); `biomejs`
(TypeScript lint/format expectations enforced by the gate). Python verification
skills (`hypothesis`, `crosshair`, `mutmut`) do **not** apply — this is
TypeScript, and verification uses the documented mutation experiment instead.

Create `tests/static-analysis/hostile-metadata-security.test.ts`. Its header
comment must state its distinct role (the single fixture-driven security
regression surface for §11.3) and note that it never imports or evaluates any
fixture — it lints source **text** only.

Structure:

1. Import from `bun:test`: `beforeEach`, `afterEach`, `describe`, `expect`,
   `it`. Import `createOriginalSourceFile` (from
   `../../src/static-analysis/source-file`), `scanWorkflowEnvelope` (from
   `../../src/static-analysis/workflow-envelope`), and
   `classifyWorkflowMetadata` (from
   `../../src/static-analysis/workflow-metadata`). Import `readFixtureSource`
   from `./fixtures/corpus-support` and `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS`
   from `./fixtures/invalid-workflows`.
2. Define shared constants and helpers reused from the existing pattern in
   `workflow-metadata.test.ts` / `invalid-workflow-fixtures.test.ts`:
   `HOSTILE_MARKER_PROPERTY = "__odwLintHostileMetadataWasEvaluated"`; the
   invalid-fixture corpus location object (`fixtureDirectory` URL,
   `manifestRoot`, `recursive: true`); `clearHostileMarker()` and
   `hostileMarkerValue()`; a `lintSource(sourceText)` helper that builds the
   source file and returns
   `classifyWorkflowMetadata(scanWorkflowEnvelope(createOriginalSourceFile(...)))`.
3. `beforeEach`/`afterEach` call `clearHostileMarker()`.
4. A **canary** test proving the detector works: set
   `globalThis.__odwLintHostileMetadataWasEvaluated = "canary"` directly, assert
   `hostileMarkerValue()` reads it, then `clearHostileMarker()` and assert it is
   `undefined`. This makes the "no side effect" assertions falsifiable.
5. A **fixture-driven** loop over the `hostile-metadata` family: filter
   `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS` to entries whose `family` equals
   `"hostile-metadata"`.
   Assert the family is non-empty (guards against a silently empty loop). For
   each fixture, an `it("lints <fileName> without a side effect")` that:
   - asserts `hostileMarkerValue()` is `undefined` before linting;
   - reads the source via `readFixtureSource(corpus, fixture.fixturePath)`;
   - lints via `lintSource` **inside** `expect(() => …).not.toThrow()` (this is
     the throw-marker security assertion: classification must not propagate the
     fixture's `throw`);
   - asserts the classification `diagnostics` are non-empty and exactly match
     the fixture's `expectedDiagnostics` from the manifest, including
     cardinality, source file, rule, severity, message, and span (parity with
     the fixture snapshot and, transitively, the rule catalogue — consistent
     with 2.1.7);
   - asserts `hostileMarkerValue()` is still `undefined` after linting.

Red-Green-Refactor for this work item is documented in "Validation and
acceptance" (mutation experiment). Keep the file well under 400 lines and prefer
compact loops over duplicated cases (`AGENTS.md` "Parameterized tests").

Tests added/updated: the whole new file is the added test (unit +
security-regression). No snapshot files are introduced (semantic assertions
only, per `AGENTS.md` snapshot-scope guidance). No production or fixture files
change.

### Work item 2 — Out-of-process cold-module-graph import-safety guard

Docs to read first: `docs/technical-design.md` §11.3; `AGENTS.md`
"Environment-dependent tests". Skills: `leta` for confirming the public export
surface; `biomejs` for lint/format expectations.

Append one `describe`/`it` to
`tests/static-analysis/hostile-metadata-security.test.ts` mirroring
`fixture-metadata-refresh-cli.test.ts`'s "stays import-safe … in a fresh module
graph". Using `spawnSync(process.execPath, ["--eval", script], { cwd:
repositoryRoot, encoding: "utf8", timeout: 5000 })`, run a small script that:

1. sets `globalThis.__odwLintHostileMetadataWasEvaluated = undefined;`
2. `await import("odw-lint")` (the public entry) and destructures
   `createOriginalSourceFile`, `scanWorkflowEnvelope`, `classifyWorkflowMetadata`;
3. reads each hostile fixture's source text with `node:fs` `readFileSync` (text
   only — never `import()` the fixture) and lints it through the public surface;
4. exits non-zero if any classification yields zero diagnostics, or if
   `globalThis.__odwLintHostileMetadataWasEvaluated !== undefined` after linting.

Assert `result.error` is `undefined`, `result.signal` is `null`,
`result.status` is `0`, and `stderr` is empty. Compute the repository root with
`resolve(dirname(fileURLToPath(import.meta.url)), "../..")` as the existing CLI
test does. This proves the **packaged** lint surface is import-safe in a cold
module graph, a property the in-process test cannot fully establish.

Tests added/updated: one additional out-of-process test in the same file. No new
dependencies (`node:child_process`, `node:path`, `node:url`, `node:fs` already
used across the suite).

### Work item 3 — Document and tick roadmap 2.1.5

Docs to read first: `docs/documentation-style-guide.md`;
`docs/developers-guide.md` (verification/testing section, if it enumerates the
corpus/security tests); `docs/roadmap.md`. Skills: `en-gb-oxendict` for prose;
`execplans` for keeping this plan current.

1. If `docs/developers-guide.md` (or the verification strategy list in
   `docs/technical-design.md` §11) enumerates the hostile/security regression
   tests, add a one-line pointer to
   `tests/static-analysis/hostile-metadata-security.test.ts` next to the
   existing corpus/parity references. If no such enumeration exists, skip this
   sub-step (do not invent a new doc section) and record the skip in Progress.
2. In `docs/roadmap.md`, change task 2.1.5 from `- [ ]` to `- [x]` and add a
   `Completion note:` in the same style as sibling tasks (2.1.3/2.1.4),
   summarizing that a dedicated fixture-driven security regression test lints
   every hostile-metadata fixture through the real scan+classify path and the
   public entry, asserting diagnostics with no side effect marker.

Tests added/updated: none (documentation only). Markdown gates apply.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-5`.

1. Confirm the branch and clean tree:

   ```bash
   git branch --show-current   # expect: roadmap-2-1-5
   git status --short          # expect: clean before starting
   ```

2. Work item 1 — create the test file, then observe **red** via the mutation
   experiment before committing:

   ```bash
   # After writing tests/static-analysis/hostile-metadata-security.test.ts:
   bun test tests/static-analysis/hostile-metadata-security.test.ts
   # Expect: PASS (production is already static). Then prove the guard bites:
   ```

   Mutation experiment (temporary, reverted immediately): in a throwaway edit of
   the lint helper, force evaluation of the metadata (for example `eval` the
   fixture's masked description or `import()` the fixture) and re-run the test:

   ```bash
   bun test tests/static-analysis/hostile-metadata-security.test.ts
   # Expect: FAIL — either the marker is now defined, or throw-marker propagates,
   #         proving the security assertions are falsifiable. Revert the mutation.
   git checkout -- .   # discard the throwaway mutation (keep only the test file)
   ```

   Format only the changed file, then gate and commit:

   ```bash
   bunx @biomejs/biome format --write tests/static-analysis/hostile-metadata-security.test.ts
   make all
   git add tests/static-analysis/hostile-metadata-security.test.ts
   git commit   # message via file, imperative mood, en-GB Oxford spelling
   ```

3. Work item 2 — append the out-of-process guard, gate, commit:

   ```bash
   bun test tests/static-analysis/hostile-metadata-security.test.ts   # expect PASS
   bunx @biomejs/biome format --write tests/static-analysis/hostile-metadata-security.test.ts
   make all
   git add tests/static-analysis/hostile-metadata-security.test.ts
   git commit
   ```

4. Work item 3 — docs and roadmap tick. Format only the changed markdown files,
   then gate:

   ```bash
   # For each changed markdown file (docs/roadmap.md and, if edited,
   # docs/developers-guide.md), run in sequence:
   mdtablefix docs/roadmap.md
   markdownlint-cli2 --fix docs/roadmap.md
   make markdownlint
   make nixie
   make all
   git add docs/roadmap.md
   git commit
   ```

Do **not** run a repo-global formatter (`make fmt`, `mdformat-all`); format only
the files this task changed.

## Validation and acceptance

Quality criteria (what "done" means):

- Tests: `tests/static-analysis/hostile-metadata-security.test.ts` passes under
  `bun test` and `make all`. It fails under the documented evaluation mutation
  (red evidence) and passes after reverting it (green).
- Behaviour: for every `hostile-metadata` fixture, the real scan+classify path
  and the public `odw-lint` entry produce a diagnostic and leave
  `globalThis.__odwLintHostileMetadataWasEvaluated` `undefined`; classification
  never throws for `throw-marker.js`.
- Lint/typecheck: `make all` passes (it runs build, Biome/oxlint, `typecheck`,
  and `bun test`), per `docs/roadmap.md` note that `make all` includes
  `typecheck` on current `origin/main`.
- Markdown (work item 3 only): `make markdownlint` and `make nixie` pass.

Red-Green-Refactor evidence to record in Progress and Decision Log:

- Red: the mutation experiment (temporarily evaluating the metadata) makes the
  new test FAIL for the intended reason (marker set or throw propagated). This
  substitutes for a production red because 2.1.3 already shipped the static
  behaviour; the canary sub-test independently proves the marker detector fires.
- Green: with production unchanged, the new test PASSES.
- Refactor: tidy helpers (shared marker/corpus helpers, compact fixture loop)
  without changing assertions; rerun
  `bun test tests/static-analysis/hostile-metadata-security.test.ts` and
  `make all`.

Validation commands (path-safe; rely on repository gates):

- `make all` — full commit gate (build, format check, lint, typecheck, tests).
- `make markdownlint` and `make nixie` — for the work item 3 markdown changes.

## Idempotence and recovery

- Creating the test file is idempotent; re-running `make all` is safe.
- The mutation experiment must be reverted before committing; `git status
  --short` must show only the intended additions. If the throwaway mutation is
  accidentally staged, `git restore --staged` and `git checkout --` the affected
  source file.
- If `make all` fails on an unrelated pre-existing issue, stop and escalate
  (Tolerances) rather than editing unrelated code.

## Artifacts and notes

Reference pattern for the in-process assertions (existing, do not duplicate
verbatim — the new file is fixture-driven over the whole family):

```ts
// tests/static-analysis/workflow-metadata.test.ts (excerpt)
it("keeps hostile global-marker metadata passive", () => {
  const sourceText = invalidFixtureSource("hostile-metadata", "global-marker.js");
  expect(diagnosticSummary(sourceText)).toEqual([/* odw/meta-statically-unprovable warning */]);
  expect((globalThis as Record<string, unknown>)[HOSTILE_MARKER_PROPERTY]).toBeUndefined();
});
```

Reference pattern for the out-of-process guard:

```ts
// tests/static-analysis/fixture-metadata-refresh-cli.test.ts (excerpt)
const result = spawnSync(process.execPath, ["--eval", script], {
  cwd: repositoryRootPath, encoding: "utf8", timeout: 5_000,
});
expect(result.status).toBe(0);
```

## Addenda

- [ ] 2.1.5.1. Extract structured cold-module-graph import-safety helpers.
  - Source: review:2.1.5; severity low.
  - Scope: centralize the duplicated fresh-module-graph spawn guard shared by
    hostile metadata and fixture refresh tests, including typed script
    construction and structured failure output.
  - Success: both import-safety guards consume one helper and report actionable
    failure details without weakening the no-execution security assertions.

## Interfaces and dependencies

Use these existing, stable surfaces (no new APIs are introduced):

- `src/static-analysis/source-file.ts` -> `createOriginalSourceFile({ filePath,
  sourceText }): OriginalSourceFile`.
- `src/static-analysis/workflow-envelope.ts` -> `scanWorkflowEnvelope(sourceFile):
  WorkflowEnvelopeScanResult`.
- `src/static-analysis/workflow-metadata.ts` -> `classifyWorkflowMetadata(scanResult):
  { readonly status: string; readonly diagnostics: readonly Diagnostic[] }`.
- Public entry `odw-lint` (`src/index.ts`) re-exports all three plus
  `WorkflowEnvelopeScanResult`, used by the out-of-process guard.
- `tests/static-analysis/fixtures/corpus-support.ts` -> `readFixtureSource`,
  `sha256`, `fixtureSourceUrl`.
- `tests/static-analysis/fixtures/invalid-workflows.ts` ->
  `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS` (filter `family === "hostile-metadata"`).

The final deliverable is a single new file,
`tests/static-analysis/hostile-metadata-security.test.ts`, plus a roadmap tick
and optional developers-guide pointer.

## Revision note

Initial draft (2026-07-01, planning agent). Decomposes roadmap 2.1.5 into three
atomic work items: an in-process fixture-driven security regression test, an
out-of-process cold-module-graph import-safety guard, and docs/roadmap updates.
Grounded in `docs/technical-design.md` §11.3,
`docs/adr/0001-static-analysis-boundary.md`, and the existing hostile
fixtures/classifier; corpus growth deliberately excluded to keep the change
atomic.

Fix round 1 revision (2026-07-02, fix-round agent). Records that the blocking
review findings were stale worktree-access failures, adds fresh worktree-local
verification evidence for the implementation, documentation, plan adherence,
and gates, and captures the exact scrutineer quota failure that required direct
local gate execution. Updated after CodeRabbit completed with `findings: 0`.
