# Add hostile metadata fixtures

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 1.3.4 adds deliberately hostile Open Dynamic Workflows (ODW)
metadata fixtures to the invalid workflow corpus. A hostile metadata fixture is
workflow source whose `export const meta` object contains code that would make a
visible change if an executable metadata loader evaluated it. The fixtures prove
that `odw-lint` treats workflow source as untrusted input and records the
expected static diagnostic contract before parser and rule-engine tasks run.

After this work, maintainers can inspect raw fixture files under
`tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/`, see the
expected `odw/meta-statically-unprovable` diagnostics in
`tests/static-analysis/fixtures/invalid-workflows.ts`, and run tests that read
those fixtures as passive source text without setting a hostile side-effect
marker. This task does not implement the linter, parser, source masker, or
runtime parity harness. Roadmap task 2.1.5 later turns these fixtures into the
release-blocking security regression for actual lint execution.

This plan has been implemented through three independently committed work
items. The remaining hostile metadata lint execution regression belongs to
roadmap task 2.1.5.

## Constraints

- Run implementation commands only from
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-3-4`. Confirm with
  `git branch --show` before editing. Do not edit the root/control worktree at
  `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as the canonical integration branch.
- Use `grepai search --workspace Projects --project odw-lint "<English intent
  query>" --toon --compact` as the primary intent search tool. The GrepAI index
  reflects canonical `main` only, so every branch-local fact must be rechecked
  with `leta`, exact text search, or file inspection inside this worktree.
- Use `leta` for branch-local TypeScript symbol navigation, references, call
  graphs, and refactoring. Use exact text search only for Markdown, JSON, raw
  fixture text, or other non-symbol literals.
- Use `sem` instead of raw Git history commands when codebase history
  navigation or entity-level diff review is needed.
- Do not implement the parser, source masker, rule engine, reporter, command,
  configuration loader, loader-parity harness, SWC adapter, or forbidden-import
  architecture test in this roadmap task. This is a fixture-corpus task.
- Do not add `@swc/core` or any other new package dependency.
- Do not execute, import, dynamically import, evaluate, or run raw workflow
  fixture files. Tests for this task must read fixture files as plain text only.
- Production code must not import ODW executable loader, primitive factory,
  runtime launcher, worker, run dispatch, or metadata-evaluating paths. This
  task should not change production `src/**` files.
- Hostile raw `.js` fixtures remain under
  `tests/static-analysis/fixtures/invalid-workflows/`, which `biome.jsonc` and
  `.oxlintrc.json` already exclude from formatting and linting.
- Raw hostile `.js` fixture files must be ASCII-only so the existing invalid
  fixture ASCII invariant remains true for this slice.
- Span assertions must use UTF-8 byte offsets, not JavaScript string slice
  indexes. The existing invalid fixture tests already decode spans from bytes;
  keep that contract intact.
- Keep validation path-safe. Prefer repository gates such as `make all`,
  `make markdownlint`, and `make nixie`. Any direct formatter, linter, or test
  command must list only paths that definitely exist at that point in the work
  item.
- Format only changed files. For Markdown, run `mdtablefix` and
  `markdownlint-cli2 --fix` on the specific changed Markdown paths. For
  TypeScript and JSON configuration, run Biome only on changed existing paths
  after `make build`. Do not run repository-global mutating formatters such as
  `make fmt`, `bun fmt`, or `mdformat-all`.
- Use en-GB Oxford spelling in prose and comments.
- Every work item must update this ExecPlan before its commit. At minimum,
  check off that item's `Progress` entry when complete. Also update
  `Surprises & Discoveries`, `Decision Log`, `Risks`,
  `Outcomes & Retrospective`, and the revision note when the work item changes
  assumptions or records new evidence.
- Because every work item updates this ExecPlan, every work item has a Markdown
  change. Run file-scoped Markdown formatting on
  `docs/execplans/roadmap-1-3-4.md`, then run `make markdownlint` and
  `make nixie` before committing that item.
- Each work item below is independently committable. Gate and commit each item
  before starting the next one.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances (exception triggers)

- Scope: stop and escalate if implementation needs to change production
  `src/**` files. This task should touch only raw fixtures, fixture manifests,
  fixture tests, snapshots, documentation, and this ExecPlan.
- File count: stop and escalate if more than two hostile raw `.js` fixtures are
  needed for task 1.3.4, or if more than six non-fixture tracked files need
  edits.
- Public API: stop and escalate if a public import from `odw-lint` must be
  renamed, removed, or moved to a package subpath.
- Rule identifiers: stop and escalate if the hostile fixtures cannot use the
  documented `odw/meta-statically-unprovable` rule identifier.
- Dependency: stop and escalate before adding any new package dependency,
  including parser, schema, property-test, or snapshot-helper packages.
- Runtime boundary: stop immediately if a test or production module would need
  to import `loadWorkflowScript`, `createPrimitives`, runtime
  `validate(source)`, ODW launcher paths, ODW worker paths, or any ODW path
  that evaluates metadata or dispatches agents.
- Fixture mechanism: stop and revise this plan if the proposed `globalThis`
  marker or thrown marker fixture cannot be represented as metadata object
  property values in the existing invalid fixture manifest.
- Tests: if a work item cannot pass `make all` after three focused fix
  attempts, record the failure and options in `Decision Log` before continuing.
- Formatting: if a formatter rewrites unrelated files, park that churn in a
  named discard stash using
  `df12-stash v1 task=1.3.4 kind=discard reason="<short>"`, then re-run only
  file-scoped formatting.

## Risks

- Risk: a hostile fixture accidentally executes during tests. Severity: high.
  Likelihood: medium. Mitigation: tests must read fixture files with
  `readFileSync` only, must not use dynamic import or ODW runtime helpers, and
  must assert that the hostile `globalThis` marker remains absent after fixture
  validation.

- Risk: a fixture writes to the repository if someone evaluates it manually.
  Severity: medium. Likelihood: low. Mitigation: use a `globalThis` property
  and a thrown marker error as the two hostile mechanisms. Do not use file
  writes, environment reads, network calls, process exits, child processes, or
  other external side effects in task 1.3.4 fixtures.

- Risk: current tests only prove manifest expectations, not real linter
  output. Severity: medium. Likelihood: high. Mitigation: document explicitly
  that roadmap task 2.1.5 owns the actual lint security regression. This task
  pins expected diagnostics in the fixture manifest and verifies no side-effect
  marker under the current passive harness.

- Risk: hostile fixture metadata drifts out of ODW loader reality. Severity:
  high. Likelihood: medium. Mitigation: keep both fixtures as object-literal
  `meta` declarations with computed `description` values. The sibling ODW
  loader slices object literals and evaluates them with `new Function`, so these
  expressions are load-bearing examples of code that would run if evaluated.

- Risk: Bun snapshot updates obscure reviewer signal. Severity: medium.
  Likelihood: medium. Mitigation: keep the existing compact manifest snapshot
  shape and update it only through the focused invalid fixture test. Inspect the
  snapshot diff before committing.

- Risk: fixture family ordering becomes unstable. Severity: low. Likelihood:
  medium. Mitigation: extend the existing `FAMILY_ORDER` and
  `EXPECTED_FILE_NAMES` constants so hostile metadata sits after
  `malformed-metadata` and before `unsupported-import-export`.

## Progress

- [x] (2026-06-28T10:10Z) Confirmed this work is in branch `roadmap-1-3-4` at
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-3-4`.
- [x] (2026-06-28T10:15Z) Read `AGENTS.md`, `docs/roadmap.md`,
  `docs/technical-design.md`, `docs/terms-of-reference.md`, ADR 0001,
  `docs/developers-guide.md`, `docs/scripting-standards.md`,
  `docs/complexity-antipatterns-and-refactoring-strategies.md`, and
  `docs/documentation-style-guide.md`.
- [x] (2026-06-28T10:20Z) Loaded the `execplans`, `leta`, `grepai`,
  `firecrawl-mcp`, `odw-authoring`, `en-gb-oxendict-style`,
  `biome-typescript`, and `sem` skills.
- [x] (2026-06-28T10:26Z) Used GrepAI intent searches against canonical `main`
  for metadata fixture validation and hostile metadata risk, then verified
  branch-local fixture code with `leta` and file inspection inside this
  worktree.
- [x] (2026-06-28T10:36Z) Researched sibling ODW loader, primitive validation,
  and pure metadata behaviour in
  `/data/leynos/Projects/open-dynamic-workflows`.
- [x] (2026-06-28T10:45Z) Used Firecrawl to verify official Bun snapshot docs
  and Node file-system docs for load-bearing test-runner and file-reading
  behaviour.
- [x] (2026-06-28T10:50Z) Verified with Node v24.13.1 that `new Function`
  evaluation can set a `globalThis` marker and throw the custom hostile marker
  error proposed for the two fixtures.
- [x] (2026-06-28T13:52Z) Revised planning-round-2 validation commands so
  Biome formats only processable TypeScript paths, while Bun snapshot updates
  and focused tests validate the `.snap` file.
- [x] (2026-06-28T14:07Z) Work item 1: Add the hostile global-marker fixture
  and passive side-effect guard.
- [x] (2026-06-28T14:14Z) Work item 2: Add the hostile thrown-marker fixture
  and extend the compact manifest snapshot.
- [x] (2026-06-28T14:20Z) Work item 3: Document hostile fixture maintenance
  and close roadmap task 1.3.4.

## Surprises & discoveries

- Observation: the branch already has the invalid workflow fixture corpus from
  roadmap task 1.3.2. Evidence: `leta files` lists
  `tests/static-analysis/fixtures/invalid-workflows.ts`, raw fixture families,
  `tests/static-analysis/invalid-workflow-fixtures.test.ts`, and the compact
  invalid fixture snapshot. Impact: 1.3.4 should extend that corpus rather than
  create a new fixture system.

- Observation: raw invalid workflow fixtures are already excluded from Biome
  and Oxlint. Evidence: `biome.jsonc` excludes
  `tests/static-analysis/fixtures/invalid-workflows/**/*.js`, and
  `.oxlintrc.json` has the same ignore pattern. Impact: no formatter-ignore
  configuration change is needed for hostile raw `.js` files.

- Observation: ODW runtime metadata loading is intentionally executable.
  Evidence: sibling `src/loader.ts` `extractMeta` slices the original metadata
  object literal and evaluates it with `new Function`, while
  `src/primitives.ts` runtime `validate(source)` calls `loadWorkflowScript`.
  Impact: tests for hostile fixtures must not call ODW loader or primitive
  APIs.

- Observation: ODW's pure metadata checker rejects computed forms without
  executing workflow bodies. Evidence: sibling `src/dual-compat.ts`
  `checkMeta` uses `LiteralParser`, and `parseValue` treats identifiers,
  calls, template interpolation, and other computed values as impure. Impact:
  hostile fixture expectations should use `odw/meta-statically-unprovable`.

- Observation: a file-write hostile fixture would be stronger but riskier in
  this early corpus task. Evidence: the technical design allows writes,
  environment reads, thrown markers, or any observable side effect. Impact: use
  a `globalThis` property assignment and a thrown custom marker error now; leave
  actual file-marker security regression checks to roadmap task 2.1.5.

- Observation: Biome 2.5.1 does not process the Bun `.snap` fixture snapshot.
  Evidence: `bun.lock` resolves `@biomejs/biome` to 2.5.1. Running Biome
  format against
  `tests/static-analysis/__snapshots__/invalid-workflow-fixtures.test.ts.snap`
  exits non-zero with `No files were processed in the specified paths`. The
  same formatter command against the two TypeScript fixture harness files
  processes two files successfully. Impact: work items must not pass the
  `.snap` file to Biome. Snapshot changes are validated by Bun's focused
  snapshot update, focused Bun test, diff review, and `make all`.

## Decision log

- Decision: store hostile fixtures under
  `tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/`.
  Rationale: task 1.3.4 extends the deliberately invalid workflow corpus. A
  dedicated family keeps hostile fixtures separate from ordinary malformed
  metadata and makes later security regression tests easy to target.
  Date/Author: 2026-06-28, planning agent.

- Decision: add exactly two hostile fixtures in this task:
  `global-marker.js` and `throw-marker.js`. Rationale: the first fixture would
  set `globalThis.__odwLintHostileMetadataWasEvaluated` if evaluated; the
  second would throw `ODW_LINT_HOSTILE_METADATA_EVALUATED` if evaluated. These
  are observable without touching files, environment variables, network, child
  processes, or process state outside the JavaScript global object.
  Date/Author: 2026-06-28, planning agent.

- Decision: model both hostile fixtures as warnings with
  `odw/meta-statically-unprovable`. Rationale: ODW's executable loader could
  enter these computed metadata property values, but `odw-lint` cannot prove
  them safely without evaluation. This matches `docs/technical-design.md`
  section 6.3 and the existing computed metadata fixture contract.
  Date/Author: 2026-06-28, planning agent.

- Decision: do not add a real linter execution assertion in task 1.3.4.
  Rationale: roadmap task 2.1.5 explicitly depends on 1.3.4 and 2.1.3 and owns
  the actual "linting hostile metadata leaves no side-effect marker" security
  regression. This task should pin fixtures and passive test invariants only.
  Date/Author: 2026-06-28, planning agent.

- Decision: avoid file-write and environment-read hostile mechanisms for the
  initial corpus. Rationale: they are allowed by the design, but they add
  cleanup and platform risk before the real linter exists. The selected
  mechanisms still prove the security boundary because ODW's executable loader
  evaluates object-literal property values in the global JavaScript runtime.
  Date/Author: 2026-06-28, planning agent.

- Decision: do not run Biome over
  `tests/static-analysis/__snapshots__/invalid-workflow-fixtures.test.ts.snap`.
  Rationale: the repository's locked Biome 2.5.1 and current `biome.jsonc`
  ignore or cannot process that file, and the official Bun snapshot workflow is
  `bun test --update-snapshots`. The scoped alternative is to update snapshots
  through Bun, review the snapshot diff, and rely on the focused test plus
  `make all` for validation.
  Date/Author: 2026-06-28, planning-round-2 agent.

## Outcomes & retrospective

This plan is complete. The invalid fixture corpus now contains the
`hostile-metadata` family with `global-marker.js` and `throw-marker.js`, both
raw fixtures are manifest-backed with `odw/meta-statically-unprovable` warning
diagnostics, and the passive fixture harness reads both files as source text
without setting the hostile global marker.

Work item 1 added the hostile global-marker raw fixture, pinned its
`odw/meta-statically-unprovable` warning diagnostic in the invalid fixture
manifest, and extended the passive fixture harness to prove reading that raw
source leaves `globalThis.__odwLintHostileMetadataWasEvaluated` unset.

Work item 2 added the hostile thrown-marker raw fixture, pinned the second
`odw/meta-statically-unprovable` diagnostic, and extended the passive hostile
fixture test and compact snapshot to cover both hostile metadata files.

Work item 3 documented hostile fixture maintenance in
`docs/developers-guide.md`, marked roadmap task 1.3.4 complete, and left
roadmap task 2.1.5 open for the future lint execution security regression.

## Context and orientation

This repository is an ESM-first TypeScript package run with Bun. The production
static-analysis boundary currently exposes source and diagnostic helpers, while
the workflow dialect parser and metadata classifier are still future roadmap
tasks. The invalid fixture corpus already exists and is the correct extension
point for task 1.3.4.

The relevant existing files are:

```plaintext
tests/static-analysis/fixtures/invalid-workflows.ts
tests/static-analysis/fixtures/invalid-workflows/
tests/static-analysis/invalid-workflow-fixtures.test.ts
tests/static-analysis/__snapshots__/invalid-workflow-fixtures.test.ts.snap
docs/developers-guide.md
docs/roadmap.md
docs/execplans/roadmap-1-3-4.md
```

The existing manifest exposes `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS`, with each
entry carrying a family, filename, repository-relative fixture path, SHA-256
hash, expected status, expected diagnostics, UTF-8 source span, and
reviewer-facing `spanText`. The existing tests verify sorted fixture paths,
runtime freezing, raw fixture hashes, ASCII-only raw fixture text, byte-aware
span decoding, rule/status coverage, and a compact Bun snapshot.

The new fixture family is:

```plaintext
hostile-metadata
```

Add it to `InvalidWorkflowFixtureFamily`, `FAMILY_ORDER`, the expected family
set, and the manifest entries. Place it after `malformed-metadata` and before
`unsupported-import-export`.

Use these exact raw fixture files.

```javascript
export const meta = {
  name: "hostile-global-marker",
  description: (() => {
    globalThis.__odwLintHostileMetadataWasEvaluated = "hostile-global-marker";
    return "Hostile metadata fixture.";
  })(),
  phases: [{ title: "Run" }],
};

await agent("This body must not run.");
```

```javascript
export const meta = {
  name: "hostile-throw-marker",
  description: (() => {
    throw new Error("ODW_LINT_HOSTILE_METADATA_EVALUATED");
  })(),
  phases: [{ title: "Run" }],
};

await agent("This body must not run.");
```

The expected diagnostic policy for both fixtures is:

- `expectedStatus`: `warning`.
- `rule`: `odw/meta-statically-unprovable`.
- `severity`: `warning`.
- `message`: `Workflow metadata must remain statically provable without
  evaluation.`
- `span`: the full IIFE expression assigned to `description`.

Precomputed fixture data:

```plaintext
global-marker.js
sha256: af52ec3eea9c361ed0b5bd98263ea76e40a2bf202d5c35074962b1dddb0dcfa3
span.start: { offset: 70, line: 3, column: 16 }
span.end: { offset: 204, line: 6, column: 7 }
spanText:
(() => {
    globalThis.__odwLintHostileMetadataWasEvaluated = "hostile-global-marker";
    return "Hostile metadata fixture.";
  })()

throw-marker.js
sha256: 859aa4e942c7db65de27f225232b9c244ad607da20fc07c913201e2d6074600d
span.start: { offset: 69, line: 3, column: 16 }
span.end: { offset: 144, line: 5, column: 7 }
spanText:
(() => {
    throw new Error("ODW_LINT_HOSTILE_METADATA_EVALUATED");
  })()
```

When adding side-effect guard tests, use a string-keyed global property instead
of a global declaration:

```typescript
const HOSTILE_MARKER_PROPERTY = "__odwLintHostileMetadataWasEvaluated";

const clearHostileMarker = (): void => {
  delete (globalThis as Record<string, unknown>)[HOSTILE_MARKER_PROPERTY];
};

const hostileMarkerValue = (): unknown => {
  return (globalThis as Record<string, unknown>)[HOSTILE_MARKER_PROPERTY];
};
```

Before reading hostile fixture files, clear the marker. After reading and
validating fixture source as text, assert `hostileMarkerValue()` is
`undefined`. Do not evaluate the source to prove this; the test proves the
current harness remains passive.

## Research evidence for load-bearing APIs

This plan does not add dependencies. It relies on current repository docs,
existing branch-local fixture harness code, sibling ODW source, official Bun
and Node documentation, and one local Node runtime probe.

Repository evidence:

- `docs/terms-of-reference.md` sections 5, 6, 7, 8, and 9 define the job as
  checking workflow files without running agents, require dialect and metadata
  diagnostics, exclude workflow execution, name "Hostile metadata cannot
  execute during lint" as a success criterion, and require an explicit static
  analysis boundary.
- `docs/roadmap.md` section 1.3 requires a workflow fixture corpus. Task 1.3.4
  specifically requires hostile metadata fixtures that would leave an
  observable side effect if evaluated, with diagnostics and no side-effect
  marker.
- `docs/technical-design.md` sections 5, 6.3, 6.4, 11.1, 11.3, 12.1, and 12.2
  require a static-analysis boundary, non-executing metadata handling, hostile
  metadata fixture coverage, and release-blocking prevention of hostile
  metadata execution.
- `docs/adr/0001-static-analysis-boundary.md` records that ODW executable
  loader and primitive APIs are forbidden in production, and that the first
  dialect slice must include a hostile metadata fixture with a diagnostic and
  no side effect.
- `docs/developers-guide.md` sections "Static-Analysis Boundary", "Tests", and
  "Workflow Fixture Corpus" require raw invalid fixtures to stay passive and
  manifest-backed.
- `AGENTS.md` sections "Change Quality & Committing", "TypeScript Guidance",
  and "Testing" require tests for behaviour changes, focused validation,
  strict TypeScript, Bun tests, and Markdown gates for Markdown changes.
- Branch-local `tests/static-analysis/invalid-workflow-fixtures.test.ts`
  already validates invalid fixture hashes, ASCII source text, byte-aware
  spans, rule/status coverage, and compact snapshots.
- Branch-local `biome.jsonc` and `.oxlintrc.json` already exclude
  `tests/static-analysis/fixtures/invalid-workflows/**/*.js`.
- Branch-local `bun.lock` resolves `@biomejs/biome` to 2.5.1. Local Biome
  source evidence is the installed package under
  `node_modules/@biomejs/biome/package.json` and binary wrapper
  `node_modules/@biomejs/biome/bin/biome`; `bunx @biomejs/biome --version`
  reports 2.5.1 in this worktree.
- Local Biome 2.5.1 behaviour confirms the direct formatter file list must not
  include the Bun `.snap` file. Formatting
  `tests/static-analysis/__snapshots__/invalid-workflow-fixtures.test.ts.snap`
  exits 1 with `No files were processed in the specified paths`, while
  formatting `tests/static-analysis/fixtures/invalid-workflows.ts` and
  `tests/static-analysis/invalid-workflow-fixtures.test.ts` processes two
  files.

Sibling ODW evidence:

- `/data/leynos/Projects/open-dynamic-workflows/src/loader.ts` `extractMeta`
  masks non-code, finds `export const meta`, slices the object literal from the
  original source, and evaluates it with `new Function`.
- `/data/leynos/Projects/open-dynamic-workflows/src/primitives.ts`
  `validate(source)` calls `loadWorkflowScript(source, "candidate.js")`, so it
  reaches the executable metadata loader and is not safe for hostile fixtures.
- `/data/leynos/Projects/open-dynamic-workflows/src/dual-compat.ts`
  `checkMeta` parses a pure-literal subset with `LiteralParser` and treats
  computed values as not pure without executing workflow bodies.

Official documentation evidence:

- Bun's official snapshot documentation at
  <https://bun.com/docs/test/snapshots> documents `.toMatchSnapshot()`,
  `__snapshots__` files, and `bun test --update-snapshots`.
- `bun test --help` in this worktree confirms Bun 1.3.11 accepts file pattern
  arguments and `--update-snapshots`.
- Biome's official CLI documentation at <https://biomejs.dev/reference/cli/>
  documents that `biome format` runs the formatter on a set of explicit paths,
  and that unmatched or unprocessed path sets are errors unless suppressed with
  `--no-errors-on-unmatched`.
- Biome's official configuration documentation at
  <https://biomejs.dev/reference/configuration/> documents
  `files.includes`, `files.ignoreUnknown`, and `formatter.includes`, including
  the rule that formatter includes are applied after file includes. This
  matches the branch-local `.snap` non-processing behaviour.
- Node's official file-system documentation at
  <https://nodejs.org/api/fs.html> documents synchronous file APIs and that
  most `node:fs` functions accept `file:` `URL` objects, matching the existing
  fixture harness style.
- Local Node v24.13.1 runtime probe confirmed that `new Function` evaluation
  can set `globalThis.__odwLintHostileMetadataWasEvaluated` and can throw an
  `Error` with message `ODW_LINT_HOSTILE_METADATA_EVALUATED`.

No library can safely express the desired hostile check by delegating to ODW's
runtime loader in this task. The scoped alternative is to add static hostile
fixtures and passive no-marker tests now, then let roadmap task 2.1.5 exercise
the future linter against those fixtures.

## Plan of work

### Work item 1: Add the hostile global-marker fixture and passive side-effect guard

Read:

- `AGENTS.md` sections "Change Quality & Committing", "Markdown Guidance", and
  "TypeScript Guidance".
- `docs/terms-of-reference.md` sections "Job to be done", "Goals",
  "Non-goals", "Success criteria", and "Constraints".
- `docs/roadmap.md` sections 1.3, 1.3.4, and 2.1.5.
- `docs/technical-design.md` sections 5, 6.3, 6.4, 11.1, 11.3, 12.1, and
  12.2.
- `docs/adr/0001-static-analysis-boundary.md` sections "Decision" and
  "Consequences".
- `docs/developers-guide.md` sections "Static-Analysis Boundary", "Tests", and
  "Workflow Fixture Corpus".
- `docs/scripting-standards.md` sections "Pathlib: robust path manipulation"
  and "Operational guidelines" for path-safe, idempotent file handling.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections
  "Avoiding the antipattern: proactive strategies" and "Clean refactoring
  approaches to reduce cognitive complexity" for keeping test helpers small and
  flat.
- `docs/documentation-style-guide.md` sections "Spelling", "Markdown rules",
  and "Formatting".

Load or keep active these skills:

- `execplans`
- `grepai`
- `leta`
- `odw-authoring`
- `biome-typescript`
- `en-gb-oxendict-style`
- `sem` if reviewing entity-level diffs before commit

Edit:

- Create
  `tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/global-marker.js`
  with the exact source shown in `Context and orientation`.
- Update `tests/static-analysis/fixtures/invalid-workflows.ts`:
  add `hostile-metadata` to `InvalidWorkflowFixtureFamily` and add one
  manifest entry for `global-marker.js` using the precomputed SHA-256, warning
  status, `odw/meta-statically-unprovable` diagnostic, span, and `spanText`.
- Update `tests/static-analysis/invalid-workflow-fixtures.test.ts`:
  add the new fixture path to `EXPECTED_FILE_NAMES`, add one
  `odw/meta-statically-unprovable` entry to `EXPECTED_RULES`, extend
  `FAMILY_ORDER`, extend the expected family set, and add helper functions that
  clear and inspect the hostile global marker.
- Add or update a unit test that reads hostile fixture source as plain text,
  validates the source contains the hostile marker string, and verifies
  `globalThis.__odwLintHostileMetadataWasEvaluated` remains unset after
  fixture validation.
- Update `docs/execplans/roadmap-1-3-4.md` progress and any new discoveries.

Tests to add or update:

- Unit test: hostile fixture text reading must not set the global marker.
- Unit test updates: expected file names, expected family set, expected rules,
  manifest hash/span validation, and compact snapshot.
- Snapshot update: focused invalid manifest snapshot only.
- No behavioural, property, exhaustive proof, or end-to-end test is required in
  this work item because there is still no linter execution path.

Validation commands from the worktree root:

```bash
make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-3-4.out
bun test --update-snapshots \
  tests/static-analysis/invalid-workflow-fixtures.test.ts \
  2>&1 | tee /tmp/snapshots-odw-lint-roadmap-1-3-4.out
bunx @biomejs/biome format --write \
  tests/static-analysis/fixtures/invalid-workflows.ts \
  tests/static-analysis/invalid-workflow-fixtures.test.ts
: "Review the Bun-managed snapshot diff; do not pass .snap files to Biome."
git diff -- \
  tests/static-analysis/__snapshots__/invalid-workflow-fixtures.test.ts.snap
mdtablefix docs/execplans/roadmap-1-3-4.md
markdownlint-cli2 --fix docs/execplans/roadmap-1-3-4.md
bun test tests/static-analysis/invalid-workflow-fixtures.test.ts \
  2>&1 | tee /tmp/test-invalid-fixtures-odw-lint-roadmap-1-3-4.out
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-4.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-3-4.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-3-4.out
```

Expected result: the focused test passes, `make all`, `make markdownlint`, and
`make nixie` pass, and the global hostile marker is never set by the tests.
Commit this work item before starting work item 2.

Suggested commit message:

```plaintext
Add hostile metadata marker fixture

Record the first hostile metadata fixture as passive invalid workflow source.
The manifest pins the expected static diagnostic and the fixture test proves
that reading the corpus does not evaluate metadata or set the hostile marker.
```

### Work item 2: Add the hostile thrown-marker fixture and extend the compact manifest snapshot

Read:

- Everything from work item 1.
- `docs/technical-design.md` section 11.3, specifically the allowance for a
  thrown custom side-effect marker as the hostile mechanism.
- Bun official snapshot docs at <https://bun.com/docs/test/snapshots> before
  updating the compact snapshot.
- Biome official CLI and configuration docs at
  <https://biomejs.dev/reference/cli/> and
  <https://biomejs.dev/reference/configuration/> before changing formatter
  file lists.

Load or keep active these skills:

- `execplans`
- `grepai`
- `leta`
- `odw-authoring`
- `biome-typescript`
- `en-gb-oxendict-style`
- `sem` if reviewing entity-level diffs before commit

Edit:

- Create
  `tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/throw-marker.js`
  with the exact source shown in `Context and orientation`.
- Update `tests/static-analysis/fixtures/invalid-workflows.ts` with one
  manifest entry for `throw-marker.js` using the precomputed SHA-256, warning
  status, `odw/meta-statically-unprovable` diagnostic, span, and `spanText`.
- Update `tests/static-analysis/invalid-workflow-fixtures.test.ts`:
  add the new fixture path to `EXPECTED_FILE_NAMES`, add the second
  `odw/meta-statically-unprovable` expected rule occurrence, and keep the
  hostile no-marker assertion covering both hostile fixture files.
- Update the compact invalid manifest snapshot through Bun's focused snapshot
  update command.
- Update `docs/execplans/roadmap-1-3-4.md` progress and any new discoveries.

Tests to add or update:

- Unit test updates: expected file names, expected rules, manifest hash/span
  validation, passive hostile source reading, and compact snapshot.
- No behavioural, property, exhaustive proof, or end-to-end test is required in
  this work item because there is still no linter execution path.

Validation commands from the worktree root:

```bash
make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-3-4.out
bun test --update-snapshots \
  tests/static-analysis/invalid-workflow-fixtures.test.ts \
  2>&1 | tee /tmp/snapshots-odw-lint-roadmap-1-3-4.out
bunx @biomejs/biome format --write \
  tests/static-analysis/fixtures/invalid-workflows.ts \
  tests/static-analysis/invalid-workflow-fixtures.test.ts
: "Review the Bun-managed snapshot diff; do not pass .snap files to Biome."
git diff -- \
  tests/static-analysis/__snapshots__/invalid-workflow-fixtures.test.ts.snap
mdtablefix docs/execplans/roadmap-1-3-4.md
markdownlint-cli2 --fix docs/execplans/roadmap-1-3-4.md
bun test tests/static-analysis/invalid-workflow-fixtures.test.ts \
  2>&1 | tee /tmp/test-invalid-fixtures-odw-lint-roadmap-1-3-4.out
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-4.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-3-4.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-3-4.out
```

Expected result: both hostile metadata fixtures are present, hash-pinned,
span-checked, recorded as warning fixtures, included in the compact snapshot,
and read without evaluating metadata. Commit this work item before starting
work item 3.

Suggested commit message:

```plaintext
Add hostile metadata throw fixture

Add a second hostile metadata fixture that would throw a custom marker if
evaluated. Keep it manifest-backed and prove the invalid fixture harness reads
the source passively.
```

### Work item 3: Document hostile fixture maintenance and close roadmap task 1.3.4

Read:

- `docs/developers-guide.md` sections "Workflow Fixture Corpus" and
  "Documentation Upkeep".
- `docs/terms-of-reference.md` sections "Success criteria" and "Constraints".
- `docs/roadmap.md` sections 1.3.4 and 2.1.5.
- `docs/scripting-standards.md` section "Operational guidelines" for
  idempotent validation and recovery instructions.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` section
  "Avoiding the antipattern: proactive strategies", especially its code-review
  guidance, for the final changed-code review.
- `docs/documentation-style-guide.md` sections "Spelling", "Markdown rules",
  "Formatting", and "Roadmap task writing guidelines".
- `docs/technical-design.md` sections 11.3, 12.1, and 15.

Load or keep active these skills:

- `execplans`
- `grepai`
- `leta`
- `odw-authoring`
- `en-gb-oxendict-style`
- `biome-typescript` if TypeScript tests need a final formatting adjustment
- `sem` if reviewing entity-level diffs before commit

Edit:

- Update `docs/developers-guide.md` "Workflow Fixture Corpus" to mention the
  `hostile-metadata` invalid fixture family, the rule that these files must not
  be imported or evaluated, and that no-side-effect lint execution remains
  owned by roadmap task 2.1.5.
- Update `docs/roadmap.md` to mark task 1.3.4 complete only after both hostile
  fixtures, manifest expectations, tests, and gates are complete. Do not mark
  task 2.1.5 complete.
- Update `docs/execplans/roadmap-1-3-4.md`: mark work items complete, set
  status to `COMPLETE`, update `Outcomes & Retrospective`, and append a
  revision note.

Tests to add or update:

- No new test files are expected in this work item. The existing focused
  invalid fixture test must still pass after documentation closure.
- No behavioural, property, exhaustive proof, or end-to-end test is required in
  this documentation closure item.

Validation commands from the worktree root:

```bash
make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-3-4.out
mdtablefix \
  docs/developers-guide.md \
  docs/roadmap.md \
  docs/execplans/roadmap-1-3-4.md
markdownlint-cli2 --fix \
  docs/developers-guide.md \
  docs/roadmap.md \
  docs/execplans/roadmap-1-3-4.md
bun test tests/static-analysis/invalid-workflow-fixtures.test.ts \
  2>&1 | tee /tmp/test-invalid-fixtures-odw-lint-roadmap-1-3-4.out
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-4.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-3-4.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-3-4.out
```

Expected result: roadmap task 1.3.4 is checked off, maintainer documentation
explains the hostile fixture family, the focused invalid fixture test still
passes, and all repository gates pass. Commit this work item.

Suggested commit message:

```plaintext
Document hostile metadata fixtures

Close roadmap task 1.3.4 after adding the hostile fixture family and document
how maintainers must keep those fixtures passive until the linter security
regression lands.
```

## Concrete steps

For every work item:

1. Confirm the branch and working tree:

   ```bash
   git branch --show
   git status --short
   ```

2. Re-read the relevant sections listed for the item.

3. Use GrepAI for intent search if new uncertainty appears:

   ```bash
   grepai search --workspace Projects --project odw-lint \
     "hostile metadata fixture static diagnostics" --toon --compact
   ```

4. Verify branch-local symbols with `leta` before changing TypeScript:

   ```bash
   leta grep "INVALID_WORKFLOW_FIXTURE_SNAPSHOTS" \
     -k function,method,class,constant,variable
   leta refs INVALID_WORKFLOW_FIXTURE_SNAPSHOTS -n 2
   ```

5. Make only that work item's edits.

6. Update this ExecPlan's `Progress`, and update living sections if anything
   changes.

7. Run the work item's validation commands with `tee` logs.

8. Review changes before committing:

   ```bash
   sem diff
   git diff --check
   git status --short
   ```

9. Commit only after all gates pass.

## Validation and acceptance

Quality criteria:

- Fixture corpus: two raw hostile metadata fixtures exist under
  `tests/static-analysis/fixtures/invalid-workflows/hostile-metadata/`.
- Diagnostics: both hostile fixtures are manifest-backed with
  `odw/meta-statically-unprovable` warning diagnostics whose spans cover the
  computed `description` IIFE expressions.
- Passive harness: tests read hostile fixture source as text and prove the
  hostile global marker remains unset.
- Snapshot: the compact invalid manifest snapshot includes both hostile
  fixtures and remains reviewer-sized.
- Documentation: `docs/developers-guide.md` explains hostile fixture
  maintenance, and `docs/roadmap.md` marks 1.3.4 complete without closing
  2.1.5.
- No production code: no `src/**` file changes are required.
- No dependencies: `package.json` and `bun.lock` should not change.
- Formatting and linting: changed Markdown and TypeScript files are formatted,
  and repository gates pass.

Quality method:

```bash
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-4.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-3-4.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-3-4.out
```

Focused test method:

```bash
bun test tests/static-analysis/invalid-workflow-fixtures.test.ts \
  2>&1 | tee /tmp/test-invalid-fixtures-odw-lint-roadmap-1-3-4.out
```

Acceptance is observable when the focused fixture test, `make all`,
`make markdownlint`, and `make nixie` pass, the hostile global marker is absent
after fixture validation, and `git diff --check` reports no whitespace errors.

## Idempotence and recovery

The work items are additive and can be retried safely. Re-running focused Bun
tests or repository gates should not mutate files except when
`--update-snapshots` is used intentionally.

If a snapshot update changes entries other than the hostile fixtures, inspect
the diff before proceeding. Revert accidental snapshot churn manually rather
than accepting it.

If a fixture hash test fails, do not update the hash blindly. Inspect the raw
fixture source first. If the source changed intentionally, recompute the
manifest hash in the same work item. If the source changed accidentally, fix
the raw fixture text.

If a span test fails, fix the manifest span or fixture text so the span still
points at the full hostile IIFE expression. Do not weaken the byte-aware span
assertion.

If a hostile marker appears during tests, stop immediately. Document the
failure in `Decision Log`, inspect which code path evaluated the fixture, and
remove that evaluation path before continuing.

If a formatter touches unrelated files, do not keep the churn. Park it in a
named discard stash:

```bash
git stash push -m 'df12-stash v1 task=1.3.4 kind=discard reason="formatter-churn"'
```

Then re-apply only intended changes if necessary and rerun file-scoped
formatting.

## Artifacts and notes

Important command logs for this plan should use these paths:

```plaintext
/tmp/build-odw-lint-roadmap-1-3-4.out
/tmp/snapshots-odw-lint-roadmap-1-3-4.out
/tmp/test-invalid-fixtures-odw-lint-roadmap-1-3-4.out
/tmp/all-odw-lint-roadmap-1-3-4.out
/tmp/markdownlint-odw-lint-roadmap-1-3-4.out
/tmp/nixie-odw-lint-roadmap-1-3-4.out
```

The hostile global marker property is:

```plaintext
__odwLintHostileMetadataWasEvaluated
```

The hostile thrown marker message is:

```plaintext
ODW_LINT_HOSTILE_METADATA_EVALUATED
```

These markers must appear only as inert source text unless someone violates the
no-evaluation constraint.

## Interfaces and dependencies

No production interface changes are expected.

Extend the test-only invalid manifest types in
`tests/static-analysis/fixtures/invalid-workflows.ts` by adding one fixture
family:

```typescript
export type InvalidWorkflowFixtureFamily =
  | "missing-metadata"
  | "malformed-metadata"
  | "hostile-metadata"
  | "unsupported-import-export"
  | "syntax-error";
```

Use the existing manifest interfaces and `diagnostic()` helper. Do not change
the public `odw-lint` package entry point.

Use existing Bun and Node-compatible APIs already present in the repository:

- `describe`, `expect`, and `it` from `bun:test`.
- `Buffer` from `node:buffer`.
- `createHash` from `node:crypto`.
- `existsSync`, `readdirSync`, and `readFileSync` from `node:fs`.
- `TextDecoder` from `node:util`.
- `RuleId`, `DiagnosticSeverity`, `SourceSpan`, and `makeRuleId` from
  `odw-lint`, as already used by the invalid fixture manifest.

No new package dependency is permitted for this task.

## Revision note

- 2026-06-28: Initial draft for roadmap task 1.3.4. It defines the hostile
  metadata fixture mechanisms, manifest expectations, passive no-marker test
  contract, documentation closure, validation commands, and three
  independently committable work items. Implementation has not begun.
- 2026-06-28: Planning round 2 removed the unsupported `.snap` path from both
  Biome formatter command lists, added snapshot diff review under the
  Bun-backed snapshot update flow, recorded the locked Biome 2.5.1 behaviour
  and official Biome docs evidence, and added missing scripting and complexity
  standards citations to the work-item read lists. Implementation has not
  begun.
- 2026-06-28: Follow-up planning-round-2 amendment added explicit
  `docs/terms-of-reference.md` section citations to the repository evidence and
  work-item read lists, and labelled the snapshot diff command as Bun-managed
  review rather than Biome formatting. Implementation has not begun.
- 2026-06-28: Work item 1 implementation added `global-marker.js`, its
  manifest diagnostic, and a passive no-marker test for raw hostile source
  reading.
- 2026-06-28: Work item 2 implementation added `throw-marker.js`, its manifest
  diagnostic, and the compact snapshot entry for the second hostile fixture.
- 2026-06-28: Work item 3 documented the hostile fixture family, marked
  roadmap task 1.3.4 complete, and set this ExecPlan to `COMPLETE`.
