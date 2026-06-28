# Import ODW example workflow fixture snapshots

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 1.3.1 imports the current Open Dynamic Workflows (ODW) example
workflows as trusted, read-only fixture snapshots for `odw-lint`. After this
work, maintainers can inspect one committed corpus that records every upstream
ODW example workflow and its expected `no-error` status before parser, rule, or
command broadening begins. This makes later dialect, span, and loader-parity
work observable against a stable source set rather than against the mutable
sibling checkout.

Success is visible when `make all` passes with the committed fixture corpus in
place, and the new tests prove all imported ODW example snapshot files are
listed in a manifest, match recorded SHA-256 content hashes, expose immutable
fixture metadata, and carry empty expected diagnostics for the current
roadmap slice.

Implementation must not begin until this draft is reviewed and approved.

## Constraints

- Run implementation commands from the repository root of the git-donkey
  worktree selected by the automation for branch `roadmap-1-3-1`. Confirm
  this with `git branch --show-current` before editing. Do not edit any
  control or integration worktree.
- Use `grepai search --workspace Projects --project odw-lint "<English intent
  query>" --toon --compact` as the primary intent search tool. The index is a
  canonical `main` snapshot only, so branch-local facts must be rechecked with
  `leta`, exact text search, or direct file inspection inside this worktree.
- Use `leta` for branch-local symbol navigation, references, and call graphs.
  Standard exact text search is acceptable for Markdown, JSON, and config
  literals that are not code symbols.
- Use `sem` for codebase history navigation if history is needed. This plan
  does not require history navigation.
- Do not execute untrusted workflow source. Trusted sibling ODW examples may
  be loaded only as a research check or future trusted parity test, never as
  production `odw-lint` behaviour.
- Production code must not import ODW executable loader, primitive factory,
  runtime launcher, worker, run dispatch, or metadata-evaluating paths.
- Preserve copied ODW example source text exactly. Do not reformat copied
  `.js` fixture snapshots to satisfy local style tools.
- Read-only means committed, reviewable, hash-guarded fixture inputs. Do not
  depend on file mode bits such as `0444`, because Git does not portably track
  ordinary read-only permissions.
- Keep validation path-safe. Prefer `make all`, `make markdownlint`, and
  `make nixie`; any direct formatter or linter command must list only paths
  that exist at that point in the work item.
- Format only changed files. Do not run repository-global mutating formatters
  such as `make fmt` or `bun fmt`.
- Use en-GB Oxford spelling in prose and comments.
- Commit after each completed work item, and run its stated gates before the
  commit.

## Tolerances (exception triggers)

- Scope: stop and escalate if this task requires production parser, command,
  reporter, rule-engine, or public package API changes. The fixture corpus may
  add test-only helpers and narrow tool ignore configuration.
- File count: stop and escalate if the implementation needs to change more
  than fifteen tracked files, excluding the nine copied ODW example `.js`
  snapshots.
- Dependency: stop and escalate before adding any new package dependency.
  This task must use the existing Bun, TypeScript, Biome, Oxlint, and Node
  compatibility surface already present in the lockfile.
- Runtime parity: stop and escalate if any current ODW example from
  `${ODW_REFERENCE_CHECKOUT}/examples` no longer loads through the sibling
  `loadWorkflowScript` research check or gains dual-compat warnings. The
  environment variable is a workflow-local execution detail and must not be
  replaced by a committed host-specific absolute path.
- Fixture drift: stop and record the drift if any upstream example hash differs
  from the values in this plan before import. Decide whether to update the
  plan first or import the newly observed sibling state.
- Gate attempts: stop and escalate if the same gate fails after three
  targeted fix attempts.

## Risks

- Risk: copied upstream examples violate local Biome or Oxlint style.
  Severity: medium.
  Likelihood: high.
  Mitigation: add scoped tool ignore configuration before importing the raw
  snapshots. Preserve source fidelity and validate config with `make all`.

- Risk: the manifest duplicates source truth and can drift from files.
  Severity: medium.
  Likelihood: medium.
  Mitigation: add tests that compare manifest filenames, sorted order, and
  SHA-256 hashes to the committed files.

- Risk: later implementers mistake this fixture import for loader parity.
  Severity: medium.
  Likelihood: medium.
  Mitigation: document that roadmap task 2.3.1 owns loader-parity execution.
  This task records expected `no-error` fixture status only.

- Risk: hidden execution enters through a convenience import from the sibling
  ODW runtime.
  Severity: high.
  Likelihood: low.
  Mitigation: keep all ODW imports out of production code and out of this
  task's tests. Use only committed copied files plus static hashes.

## Progress

- [x] (2026-06-28 00:00Z) Read `AGENTS.md`, `docs/roadmap.md`,
  `docs/technical-design.md`, `docs/terms-of-reference.md`, ADR 0001,
  `docs/developers-guide.md`, `docs/scripting-standards.md`,
  `docs/documentation-style-guide.md`, and the complexity guidance relevant to
  maintainable fixture helpers.
- [x] (2026-06-28 00:00Z) Loaded the `execplans`, `leta`,
  `en-gb-oxendict-style`, `firecrawl-mcp`, and `biome-typescript` skills.
- [x] (2026-06-28 00:00Z) Used `grepai search` against canonical `main` and
  branch-local `leta` inspection to verify existing static-analysis boundary
  symbols and tests.
- [x] (2026-06-28 00:00Z) Researched sibling ODW loader, dual-compat, primitive
  validation, and current example behaviour.
- [x] (2026-06-28 00:00Z) Researched locked/local tool behaviour for Bun,
  Biome, Oxlint, Node `fs`, and Node `crypto`.
- [x] (2026-06-28 10:15Z) Revised the plan after design-review round 2 to
  cite official Firecrawl evidence for external-tool behaviour and replace
  committed host-specific absolute paths with workflow-local environment
  variables and relative checkout conventions.
- [x] (2026-06-28 12:00Z) Revised the plan after design-review round 3 to add
  an explicit `make build` dependency-install step before every direct
  `./node_modules/.bin/biome` formatter invocation, including work item 1 and
  the concrete steps.
- [x] (2026-06-28 10:02Z) Work item 1: Prepare tooling to preserve raw copied
  fixtures. Added scoped Biome and Oxlint ignores for the future copied ODW
  example snapshot directory, ran `make all`, ran `coderabbit review --agent`
  with zero findings, and committed
  `Preserve raw ODW fixture snapshots`.
- [x] (2026-06-28 10:13Z) Work item 2: Import ODW example snapshots and pin
  the fixture manifest. Copied all nine ODW example `.js` snapshots from the
  sibling checkout, added the frozen TypeScript manifest and hash tests, kept
  production `src/` untouched, ran `make all`, `make markdownlint`, and
  `make nixie`, and ran `coderabbit review --agent`. CodeRabbit reported five
  major findings inside copied upstream snapshot files; they were deliberately
  skipped because this task must preserve those files byte-for-byte as
  read-only fixture snapshots rather than repair upstream workflow behaviour.
- [x] (2026-06-28 10:13Z) Work item 3: Document fixture maintenance and close
  the roadmap task. Documented the workflow fixture corpus refresh convention
  in `docs/developers-guide.md`, marked roadmap task 1.3.1 complete in
  `docs/roadmap.md`, updated this ExecPlan, ran `make all`,
  `make markdownlint`, and `make nixie`, and ran
  `coderabbit review --agent` with zero findings.

## Surprises & discoveries

- Observation: raw upstream ODW examples are not expected to match this
  repository's JavaScript formatting style.
  Evidence: `biome.jsonc` enforces double quotes and semicolons across
  `tests/**/*`, while the ODW examples intentionally use the upstream style.
  Impact: the plan must first add narrow Biome and Oxlint ignores for the
  copied snapshot directory.

- Observation: the worktree does not currently contain `docs/users-guide.md`.
  Evidence: `leta files` listed the documentation tree and no users guide was
  present.
  Impact: do not invent a users guide for this internal fixture-corpus task;
  update `docs/developers-guide.md` instead.

- Observation: local `bunx @biomejs/biome` used before `make build` selected
  an incompatible Biome version.
  Evidence: it reported a schema-version mismatch against
  `biome.jsonc`; `make build` then installed locked `@biomejs/biome@2.5.1`.
  Impact: all implementation validation must run through repository targets or
  `./node_modules/.bin/...` after `make build`. The repository Makefile proves
  this ordering: `node_modules` runs `bun install`, and `build` depends on
  `node_modules`.

- Observation: Biome `overrides` can disable formatting and linting for raw
  snapshot files, but `make check-fmt` still asks Biome to parse every file
  matched by the top-level `tests/**/*` include.
  Evidence: after copying the ODW example snapshots, `make all` failed in
  `make check-fmt` with Biome parse errors for the ODW dialect's top-level
  `return` statements.
  Impact: the Biome configuration must also exclude the copied ODW example
  `.js` snapshots from `files.includes`; otherwise the fixture corpus cannot
  preserve upstream source byte-for-byte.

- Observation: CodeRabbit reviews copied ODW example snapshots as ordinary
  workflow code and can identify upstream behavioural risks inside them.
  Evidence: the work item 2 review reported five major findings in
  `agent-daily-digest.js`, `generate-and-filter.js`, and `tournament.js`.
  Impact: those findings are not fixed in this repository during snapshot
  import because modifying the copied `.js` files would violate the fixture
  fidelity requirement. Future ODW example maintenance should address such
  findings upstream before refreshing hashes here.

## Decision log

- Decision: preserve upstream ODW example `.js` source exactly and exclude the
  copied snapshot directory from Biome and Oxlint checks.
  Rationale: roadmap task 1.3.1 is a snapshot import. Reformatting upstream
  examples would make the fixture corpus less useful for drift review and
  later loader-parity work.
  Date/Author: 2026-06-28, planning agent.

- Decision: represent expected fixture outcomes in a TypeScript manifest
  rather than JSON.
  Rationale: TypeScript keeps the manifest type-checked, supports immutable
  `readonly` arrays, avoids a runtime JSON-import contract, and follows the
  existing test style in `tests/diagnostics/fixtures.ts`.
  Date/Author: 2026-06-28, planning agent.

- Decision: use content hashes and semantic manifest assertions rather than
  Bun snapshots for the full workflow source bodies.
  Rationale: Bun snapshots are appropriate for small reviewer-useful output,
  but the ODW example files include one large 31 KB example. Hashes protect
  exact source content without producing a noisy generated `.snap` file for
  entire workflow bodies.
  Date/Author: 2026-06-28, planning agent.

- Decision: loader-parity execution is explicitly deferred to roadmap task
  2.3.1.
  Rationale: `docs/technical-design.md` section 11.2 makes parity
  release-blocking for the first dialect slice, while task 1.3.1 only imports
  ODW examples as valid fixture snapshots with expected `no-error` status.
  Date/Author: 2026-06-28, planning agent.

- Decision: every direct local formatter command that calls
  `./node_modules/.bin/biome` must be preceded in the same work item by
  `make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-3-1.out`.
  Rationale: the Makefile makes `build` the dependency-installing target through
  `node_modules: package.json` and `build: node_modules`, so a clean worktree
  cannot rely on `./node_modules/.bin/biome` until that target has completed.
  Date/Author: 2026-06-28, planning agent.

- Decision: exclude copied ODW example `.js` snapshots from Biome's top-level
  `files.includes` as well as disabling formatter and linter tools for the
  same path.
  Rationale: Biome parses files matched by top-level includes even when
  formatter and linter overrides are disabled. The ODW dialect intentionally
  contains top-level `return`, so the scanner-level exclusion is required to
  preserve exact upstream snapshots while keeping the normal gate green.
  Date/Author: 2026-06-28, implementation agent.

## Outcomes & retrospective

Roadmap task 1.3.1 is implemented. The repository now carries all nine current
ODW example workflows as committed read-only fixture snapshots under
`tests/static-analysis/fixtures/odw-examples/`, with a typed manifest in
`tests/static-analysis/fixtures/odw-examples.ts` that records metadata names,
upstream paths, SHA-256 hashes, expected `no-error` status, and empty expected
diagnostics.

The new `tests/static-analysis/odw-example-fixtures.test.ts` suite proves the
manifest is complete, sorted, unique, hash-pinned, runtime-frozen, and usable
as passive `WorkflowSource` text without importing or executing ODW runtime
code. The copied `.js` snapshots compare byte-for-byte with the sibling ODW
checkout used during implementation.

Implementation tightened the Biome configuration beyond the initial plan:
formatter and linter overrides preserve intent, but a top-level
`files.includes` exclusion is also required because Biome parses matched files
before tool-specific overrides apply. CodeRabbit findings against copied
upstream workflow behaviour were recorded and skipped in this repository to
preserve snapshot fidelity.

## Context and orientation

This repository is an ESM-first TypeScript package run with Bun. The current
static-analysis production boundary is `src/static-analysis/`, and
`tests/static-analysis/boundary.test.ts` already proves that `WorkflowSource`
can represent raw workflow source text. Roadmap task 1.3.1 extends the fixture
corpus around that passive source model. It does not add the parser, source
masker, rule engine, command, or ODW loader-parity harness.

The source-backed ODW reference checkout is supplied to implementation commands
through `ODW_REFERENCE_CHECKOUT`. This keeps committed documentation free of
host-specific absolute paths as required by `docs/developers-guide.md`
"Documentation Upkeep". In the df12 build tree convention, when commands run
from `odw-lint.worktrees/roadmap-1-3-1`, the relative value
`../../open-dynamic-workflows` points at the sibling checkout; if a host uses a
different layout, set `ODW_REFERENCE_CHECKOUT` in the shell before running the
research or copy commands.

Its current example workflow files are:

```plaintext
examples/adversarial-verify.js
examples/agent-daily-digest.js
examples/codex-claude-loop.js
examples/deep-research.js
examples/fan-out-reduce.js
examples/generate-and-filter.js
examples/loop-until-dry.js
examples/routing.js
examples/tournament.js
```

Research against the sibling checkout showed:

- `$ODW_REFERENCE_CHECKOUT/src/loader.ts` defines
  `loadWorkflowScript(source, filename)` around lines 78-88. It calls an
  internal `extractMeta` around lines 302-325, evaluates trusted metadata with
  `new Function`, rejects other top-level `export` or `import` tokens, strips
  the `export` keyword, and compiles the workflow body with `AsyncFunction`
  defined around line 71.
- `$ODW_REFERENCE_CHECKOUT/src/loader.ts` also defines
  `scanDualCompat(source)` around line 129, which reports warnings for
  `Date.now()`, `Math.random()`, and arg-less `new Date()` in executable code,
  using a mask that keeps template interpolations visible.
- `$ODW_REFERENCE_CHECKOUT/src/dual-compat.ts` defines `checkMeta(source)`
  around lines 35-46, a pure-literal metadata parser whose recursive-descent
  grammar is described around lines 65-68. It does not execute the body and
  returns `{ found, pure, reason, name }`.
- `$ODW_REFERENCE_CHECKOUT/src/primitives.ts` defines `ValidationReport`
  around line 58 and `createPrimitives` around line 88, where runtime
  `validate(source)` is part of the injected workflow primitive surface. This
  is not safe to import in production `odw-lint` code.
- A trusted research command loaded all nine current example files through
  sibling `loadWorkflowScript`, `checkMeta`, and `scanDualCompat`. Every file
  produced `pureMeta: true` and `dualWarnings: []`.

The upstream example hashes observed during planning are:

```plaintext
8e00d852e9a621b23a7617b4d4dd4e65de67b27a668e553d925385c923e48fd2  adversarial-verify.js
0cd3fad023f1f6f68cfd670e93addd550386b40848008d18fa724ed556e9f24e  agent-daily-digest.js
37b6d0b26803d5ab27b650e318b587b60ef49f0b6276923b15763f39e2f026de  codex-claude-loop.js
c703b2d7708e66136b38556171be799eca121a241343819a6654d1eae865ff84  deep-research.js
81d8fc5a87d19297afa2c3b72b469562d980b966090b1aafcd76ca39af732fa3  fan-out-reduce.js
2ee526156d10b4622eec4563baa08ad71904621c97e457ef666997145ee6e5c9  generate-and-filter.js
8e856df8d09521ed1810e41e7873ca583a7472b15e0067bacff80dd94a269238  loop-until-dry.js
0d595872da03aa7e1bfd91bb8da84ba5b1605d4f82f8b522e492d17343645f3c  routing.js
6baa807e3bfbe991a83cc923fc6c5b31988f8099bd46091755c509b07f2c7b62  tournament.js
```

## Research evidence for load-bearing APIs

This plan does not add dependencies. It relies on existing locked tools and
runtime-compatible APIs:

- Bun snapshots: local `bun --version` is `1.3.11`; `bun.lock` installs
  `bun-types@1.3.14`. Firecrawl scraped the official Bun snapshots page
  `https://bun.sh/docs/test/snapshots` on 2026-06-28 with status 200
  (`scrapeId` `019f0d91-d485-700b-ae0c-1c2c117ccb0e`). The page documents
  `.toMatchSnapshot()`, says snapshots are written under a `__snapshots__`
  directory beside the test file, documents `bun test --update-snapshots`, and
  advises keeping snapshots focused. This plan therefore uses Bun snapshots
  only if a compact manifest projection is reviewer-useful; full workflow
  source bodies are protected by hashes instead. Existing tests such as
  `tests/diagnostics/report.test.ts` and `tests/diagnostics/schema.test.ts`
  already use `toMatchSnapshot()`.
- `bun:test`: the locked declaration file
  `node_modules/bun-types/test.d.ts` declares `module "bun:test"` at line 16
  and declares `toMatchSnapshot(...)` overloads around lines 1457 and 1470.
  A local smoke command confirmed that `test` and `expect` import as functions
  under Bun 1.3.11.
- Node file reads: Firecrawl scraped the official Node file-system page
  `https://nodejs.org/api/fs.html` on 2026-06-28 with status 200 (`scrapeId`
  `019f0d91-e139-73fe-86ac-cc428bd3f8a7`). The page documents that string
  paths may be relative to `process.cwd()` and that most `node:fs` functions
  accept `file:` URL objects. A local Bun smoke command read `package.json`
  through `readFileSync(new URL("./package.json", import.meta.url), "utf8")`.
- Node hashing: Firecrawl scraped the official Node crypto page
  `https://nodejs.org/api/crypto.html` on 2026-06-28 with status 200
  (`scrapeId` `019f0d91-f5db-728a-b53d-799500cda41b`). The page marks
  `node:crypto` as stable and documents `crypto.createHash(algorithm[,
  options])`, `Hash.update`, and `Hash.digest`. A local Bun smoke command
  confirmed that
  `createHash("sha256").update(text, "utf8").digest("hex")` returns a
  64-character hex digest.
- Biome: `bun.lock` installs `@biomejs/biome@2.5.1`. Firecrawl scraped the
  official Biome configuration reference
  `https://biomejs.dev/reference/configuration/` on 2026-06-28 with status 200
  (`scrapeId` `019f0d92-109f-7548-bd90-c6c1ebebf48c`). The page documents
  `overrides`, `overrides.<ITEM>.includes`,
  `overrides.<ITEM>.formatter`, and `overrides.<ITEM>.linter`. The locked
  schema `node_modules/@biomejs/biome/configuration_schema.json` confirms this
  for version 2.5.1: top-level `overrides` appears around line 58,
  `$defs.OverridePattern` exposes `includes`, `formatter`, and `linter` around
  lines 7273-7335, `OverrideFormatterConfiguration.enabled` appears around
  lines 7193-7254, and `OverrideLinterConfiguration.enabled` appears around
  lines 7255-7272.
- Oxlint: `bun.lock` installs `oxlint@1.71.0`. Firecrawl scraped the official
  Oxlint configuration guide
  `https://oxc.rs/docs/guide/usage/linter/config.html` on 2026-06-28 with
  status 200 (`scrapeId` `019f0d92-1fce-7519-a1dc-e522169a0ae5`). The page
  says Oxlint automatically looks for `.oxlintrc.json`, lists
  `ignorePatterns` as a top-level configuration field, and documents
  `overrides` for file patterns. The locked schema
  `node_modules/oxlint/configuration_schema.json` confirms
  `ignorePatterns` around line 50 and describes those globs as resolved from
  the configuration file path.

## Source documents to follow

Every work item must apply these project documents:

- `AGENTS.md`: code style, documentation maintenance, TypeScript guidance,
  testing expectations, formatter policy, and quality gates.
- `docs/terms-of-reference.md`: section 6 goal to align diagnostics with ODW
  examples, section 8 success criteria for a representative ODW example
  corpus, and section 9 constraints against executing workflow source.
- `docs/technical-design.md`: sections 5, 6.1, 6.2, 8, 11.1, 11.2, 11.3,
  11.5, 12.1, 13, and 15.
- `docs/adr/0001-static-analysis-boundary.md`: accepted decision forbidding
  production imports of executable ODW runtime paths and requiring parity to
  be maintained by fixtures and drift tests.
- `docs/developers-guide.md`: Static-Analysis Boundary, Commit Gate, Bun
  Scripts, Formatting, Linting, Type Checking, Tests, Markdown, and
  Documentation Upkeep sections, especially the requirement to avoid
  host-specific absolute paths in committed documentation.
- `docs/scripting-standards.md`: only if an implementation chooses to add an
  automation script. This plan does not require a script.
- `docs/complexity-antipatterns-and-refactoring-strategies.md`: keep fixture
  helpers small and avoid "Bumpy Road" control flow.
- `docs/documentation-style-guide.md`: en-GB Oxford spelling, Markdown
  wrapping, fenced code language tags, footnotes, and heading order.
- `docs/roadmap.md`: task 1.3.1 under "Establish the workflow fixture corpus".

## Skills to load during execution

The implementing agent must load these skills before editing:

- `execplans`: maintain this living plan while work proceeds.
- `grepai`: use canonical-main semantic search before branch-local
  verification, following the project search rules.
- `leta`: use for branch-local TypeScript symbol navigation.
- `biome-typescript`: use for TypeScript formatting and linting decisions.
  No general TypeScript router skill is installed in this session.
- `en-gb-oxendict-style`: use for prose and comments.
- `firecrawl-mcp`: use if official documentation needs refreshing beyond the
  URLs already researched in this plan.

Hypothesis, CrossHair, and mutmut are Python verification tools and are not
applicable to this TypeScript fixture-corpus task. Rust router skills are not
applicable because no Rust code is touched.

## Plan of work

### Work item 1: Prepare tooling to preserve raw copied fixtures

This work item makes the local quality gates compatible with exact upstream
snapshot copies before any snapshot file is imported.

Documentation implemented:

- `AGENTS.md` "Change Quality & Committing", "Linting & Formatting", and
  "Documentation Maintenance".
- `docs/technical-design.md` section 11.1, which requires every ODW example
  workflow in the fixture corpus.
- `docs/adr/0001-static-analysis-boundary.md` "Decision" and "Consequences",
  because fixture parity must not be achieved by importing executable ODW
  paths into production code.
- `docs/developers-guide.md` "Formatting" and "Linting".

Skills to load:

- `execplans`.
- `leta`, before inspecting TypeScript symbols.
- `biome-typescript`, before editing Biome/Oxlint-adjacent TypeScript tooling
  assumptions.
- `en-gb-oxendict-style`.

Edits:

- Update `biome.jsonc` by adding a new override after the existing `.d.ts`
  override:

```json
{
  "includes": ["tests/static-analysis/fixtures/odw-examples/**/*.js"],
  "formatter": {
    "enabled": false
  },
  "linter": {
    "enabled": false
  }
}
```

- Update `.oxlintrc.json` with a top-level `ignorePatterns` entry for the same
  copied snapshot files:

```json
"ignorePatterns": ["tests/static-analysis/fixtures/odw-examples/**/*.js"]
```

Tests and validation for this work item:

- Unit tests: none added, because this is quality-gate configuration for a
  path that does not exist until work item 2.
- Behavioural tests: none.
- Property tests: none.
- Snapshot tests: none.
- End-to-end tests: `make all` is the end-to-end validation for the repository
  gate.
- Direct formatting, after the files are edited:

```bash
make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-3-1.out
./node_modules/.bin/biome format --write biome.jsonc .oxlintrc.json
```

- Gate:

```bash
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-1.out
```

Commit this work item only if `make all` exits 0.

### Work item 2: Import ODW example snapshots and pin the fixture manifest

This work item imports the trusted upstream source snapshots and adds
test-only metadata that future static-analysis tests can consume without
touching the sibling checkout.

Documentation implemented:

- `docs/roadmap.md` task 1.3.1 success statement: every fixture records
  expected `no error` status before any rule broadening.
- `docs/technical-design.md` section 11.1, especially "Every ODW example
  workflow" and "For each fixture, tests assert expected diagnostics and
  spans". In this slice, expected diagnostics are empty and spans are deferred
  until rules exist.
- `docs/technical-design.md` section 11.2: current ODW examples are valid
  today, and future loader-parity tests must not execute arbitrary fixture body
  code.
- `docs/technical-design.md` sections 11.3 and 12.1: keep this import outside
  production runtime execution paths.
- `AGENTS.md` "Testing" and "Runtime Validation & Types".

Skills to load:

- `execplans`.
- `leta`, before checking existing fixture helper symbols.
- `biome-typescript`, before adding TypeScript test helpers.
- `en-gb-oxendict-style`.

Edits:

- Create `tests/static-analysis/fixtures/odw-examples/`.
- Copy these files exactly from `${ODW_REFERENCE_CHECKOUT}/examples/` into
  that directory. Before copying, set `ODW_REFERENCE_CHECKOUT` to the
  source-backed ODW checkout or use the relative sibling convention documented
  in "Context and orientation":

```plaintext
adversarial-verify.js
agent-daily-digest.js
codex-claude-loop.js
deep-research.js
fan-out-reduce.js
generate-and-filter.js
loop-until-dry.js
routing.js
tournament.js
```

- Add `tests/static-analysis/fixtures/odw-examples.ts` as the typed manifest.
  The manifest must export:

```typescript
export type OdwExampleFixtureStatus = "no-error";

export interface OdwExampleFixtureSnapshot {
  readonly fileName: string;
  readonly fixturePath: string;
  readonly upstreamPath: string;
  readonly metaName: string;
  readonly sha256: string;
  readonly expectedStatus: OdwExampleFixtureStatus;
  readonly expectedDiagnostics: readonly [];
}

export const ODW_EXAMPLE_FIXTURE_SNAPSHOTS =
  Object.freeze([...]) satisfies readonly OdwExampleFixtureSnapshot[];
```

  Each entry must use `fixturePath:
  "tests/static-analysis/fixtures/odw-examples/<fileName>"`,
  `upstreamPath: "open-dynamic-workflows/examples/<fileName>"`, the observed
  metadata name, the SHA-256 value recorded in this plan, `expectedStatus:
  "no-error"`, and `expectedDiagnostics: []`.

- Add `tests/static-analysis/odw-example-fixtures.test.ts`. The test file must
  import from `bun:test`, `node:crypto`, and `node:fs`, plus the manifest and
  `WorkflowSource` type. It must not import any ODW sibling source.
- The test suite must assert:
  - the manifest filenames are sorted and exactly match the nine-file corpus;
  - every manifest entry has a unique filename and a unique `metaName`;
  - every copied fixture file exists and its SHA-256 digest equals the manifest
    digest;
  - every fixture source can be represented as `WorkflowSource` with
    `filePath` equal to the manifest `fixturePath` and `sourceText` equal to
    the copied file contents;
  - every fixture records `expectedStatus: "no-error"` and
    `expectedDiagnostics: []`;
  - the top-level manifest array and each `expectedDiagnostics` array are
    frozen, or the helper returns defensive read-only copies. Prefer freezing
    the manifest to make "read-only" visible at runtime.

Tests and validation for this work item:

- Unit tests: add `tests/static-analysis/odw-example-fixtures.test.ts` as
  described above.
- Behavioural tests: none, because no public CLI behaviour exists yet.
- Property tests: none, because this is a finite imported corpus.
- Snapshot tests: do not snapshot full workflow bodies. Optionally snapshot the
  compact manifest projection of filenames, metadata names, hashes, and
  expected status only if the resulting `.snap` is reviewer-useful and small.
- End-to-end tests: `make all`.
- Direct formatting, after all listed files exist:

```bash
make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-3-1.out
./node_modules/.bin/biome format --write \
  tests/static-analysis/fixtures/odw-examples.ts \
  tests/static-analysis/odw-example-fixtures.test.ts
```

- Gate:

```bash
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-1.out
```

Commit this work item only if `make all` exits 0 and the copied `.js` fixture
files remain byte-for-byte identical to the sibling examples for the hashes
listed in this plan.

### Work item 3: Document fixture maintenance and close the roadmap task

This work item records the fixture-corpus convention for maintainers and marks
the roadmap task complete after the tests from work item 2 are green.

Documentation implemented:

- `AGENTS.md` "Documentation Maintenance" and "Markdown Guidance".
- `docs/developers-guide.md` "Documentation Upkeep", "Tests", and
  "Static-Analysis Boundary".
- `docs/documentation-style-guide.md` spelling, headings, Markdown rules, and
  wrapping guidance.
- `docs/roadmap.md` task 1.3.1.

Skills to load:

- `execplans`.
- `en-gb-oxendict-style`.
- `biome-typescript`, only if TypeScript tests are adjusted during this
  documentation pass.

Edits:

- Update `docs/developers-guide.md` with a short "Workflow fixture corpus"
  subsection under or near the testing/static-analysis guidance. It must say:
  - ODW example snapshots live under
    `tests/static-analysis/fixtures/odw-examples/`;
  - the sibling checkout identified by `ODW_REFERENCE_CHECKOUT` is the
    source-backed reference for refreshing those snapshots;
  - copied `.js` snapshots are intentionally excluded from Biome and Oxlint so
    their source stays byte-for-byte upstream;
  - `tests/static-analysis/fixtures/odw-examples.ts` records hashes and
    expected `no-error` diagnostics;
  - loader-parity execution remains owned by roadmap task 2.3.1.
- Update `docs/roadmap.md` by marking task 1.3.1 complete only after work item
  2 is validated.
- Update this ExecPlan's `Progress`, `Surprises & Discoveries`, `Decision log`,
  and `Outcomes & retrospective` sections with what actually happened.

Tests and validation for this work item:

- Unit tests: none added unless documentation edits reveal a test-helper gap.
- Behavioural tests: none.
- Property tests: none.
- Snapshot tests: none.
- End-to-end tests: `make all`.
- Markdown-specific formatting, after all listed files exist:

```bash
mdtablefix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-1-3-1.md
bunx markdownlint-cli2 --fix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-1-3-1.md
```

- Gates:

```bash
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-1.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-3-1.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-3-1.out
```

Commit this work item only if all three gates exit 0.

## Concrete steps

Run every command from the repository root of the current git-donkey worktree,
confirmed with `git branch --show-current`. Use `tee` for long-running gates
so truncated terminal output can be reviewed from `/tmp`. When commands need
the sibling ODW checkout, set `ODW_REFERENCE_CHECKOUT`; with the df12 build
tree convention, this relative value is expected to work from the worktree:

```bash
export ODW_REFERENCE_CHECKOUT="${ODW_REFERENCE_CHECKOUT:-../../open-dynamic-workflows}"
test -d "$ODW_REFERENCE_CHECKOUT/examples"
```

Before each work item:

```bash
git branch --show-current
git status --short
grepai search --workspace Projects --project odw-lint "<work item intent>" --toon --compact
leta files | sed -n '1,240p'
```

Expected branch output:

```plaintext
roadmap-1-3-1
```

For work item 1:

1. Edit `biome.jsonc` and `.oxlintrc.json`.
2. Run `make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-3-1.out` so
   locked dependencies and `./node_modules/.bin/biome` exist before direct local
   formatter use.
3. Format the two config files with the direct Biome command listed in work
   item 1.
4. Run `make all` through `tee`.
5. Commit with a message in imperative mood, for example:

```plaintext
Preserve raw ODW fixture snapshots

Exclude the future copied ODW example snapshot directory from Biome and
Oxlint so the fixture corpus can remain byte-for-byte identical to upstream
examples while the rest of the repository keeps its normal gates.
```

For work item 2:

1. Copy the nine `.js` files exactly from the sibling checkout.
2. Add the TypeScript fixture manifest and tests.
3. Run `make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-3-1.out` so
   locked dependencies and `./node_modules/.bin/biome` exist before direct local
   formatter use.
4. Format only the new TypeScript files with the direct Biome command listed
   in work item 2.
5. Run `make all` through `tee`.
6. Commit with a message in imperative mood, for example:

```plaintext
Import ODW example fixtures

Add read-only static-analysis fixture snapshots for the current ODW example
workflows, plus manifest tests that pin filenames, expected no-error status,
and SHA-256 content hashes.
```

For work item 3:

1. Update developer documentation, roadmap status, and this ExecPlan.
2. Run the Markdown format/fix commands listed in work item 3.
3. Run `make all`, `make markdownlint`, and `make nixie` through `tee`.
4. Commit with a message in imperative mood, for example:

```plaintext
Document ODW fixture maintenance

Record how the read-only ODW example snapshot corpus is refreshed and mark
roadmap task 1.3.1 complete after the manifest and hash tests pass.
```

## Validation and acceptance

The plan is accepted when the repository has:

- scoped Biome and Oxlint ignores for only
  `tests/static-analysis/fixtures/odw-examples/**/*.js`;
- the nine copied ODW example workflow `.js` files under
  `tests/static-analysis/fixtures/odw-examples/`;
- a TypeScript fixture manifest with the observed SHA-256 values, metadata
  names, source paths, `expectedStatus: "no-error"`, and
  `expectedDiagnostics: []` for every copied example;
- tests that fail if a manifest entry is missing, duplicated, unsorted, points
  to a missing file, has a stale hash, or records non-empty diagnostics for
  this roadmap slice;
- maintainer documentation describing how to refresh the corpus without
  formatting or executing the copied workflows;
- `docs/roadmap.md` marking task 1.3.1 complete after validation.

Quality criteria:

- Tests: `make test` runs through `make all`, and the new finite-corpus unit
  tests pass.
- Lint/typecheck: `make all` passes with the new fixture corpus in place.
- Markdown: `make markdownlint` and `make nixie` pass after Markdown changes.
- Security: no production file imports sibling ODW runtime code, and tests for
  this task do not import ODW runtime code.
- Fidelity: copied `.js` fixture snapshots retain the SHA-256 hashes listed in
  this plan.

## Idempotence and recovery

Work item 1 is safe to rerun: repeated formatter runs on `biome.jsonc` and
`.oxlintrc.json` should converge.

Work item 2 is safe to rerun if the copied fixtures are overwritten from the
sibling checkout and the hashes are recomputed. If a copy step is interrupted,
delete only the incomplete files under
`tests/static-analysis/fixtures/odw-examples/`, copy the nine examples again,
and rerun the manifest tests. Do not delete unrelated test fixtures.

Work item 3 is safe to rerun through Markdown formatters. If Markdown
formatting produces unrelated churn, park it only with a named stash:

```bash
git stash push -m 'df12-stash v1 task=1.3.1 kind=discard reason="markdown formatter unrelated churn"' -- <paths>
```

Use a pathspec that names only the unwanted unrelated churn. Do not use a bare
stash.

## Interfaces and dependencies

No public production interface changes are planned.

Test-only manifest interface:

```typescript
export type OdwExampleFixtureStatus = "no-error";

export interface OdwExampleFixtureSnapshot {
  readonly fileName: string;
  readonly fixturePath: string;
  readonly upstreamPath: string;
  readonly metaName: string;
  readonly sha256: string;
  readonly expectedStatus: OdwExampleFixtureStatus;
  readonly expectedDiagnostics: readonly [];
}
```

The test helper may include a private `sha256(sourceText: string): string`
function in `tests/static-analysis/odw-example-fixtures.test.ts` that uses
`createHash("sha256").update(sourceText, "utf8").digest("hex")`.

Do not introduce a new abstraction under `src/` for this task. The fixture
corpus is test data until parser and CLI slices need production source-reader
behaviour.

## Artifacts and notes

Research command used to prove current ODW example status:

```bash
export ODW_REFERENCE_CHECKOUT="${ODW_REFERENCE_CHECKOUT:-../../open-dynamic-workflows}"
"$ODW_REFERENCE_CHECKOUT/node_modules/.bin/tsx" -e '
void (async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const root = process.env.ODW_REFERENCE_CHECKOUT;
  if (root === undefined) throw new Error("ODW_REFERENCE_CHECKOUT is required");
  const { checkMeta } = await import(join(root, "src/dual-compat.ts"));
  const { loadWorkflowScript, scanDualCompat } = await import(join(root, "src/loader.ts"));
  const examplesRoot = join(root, "examples");
  const names = readdirSync(examplesRoot).filter((name) => name.endsWith(".js")).sort();
  const results = names.map((name) => {
    const file = join(examplesRoot, name);
    const source = readFileSync(file, "utf8");
    const loaded = loadWorkflowScript(source, file);
    const metaCheck = checkMeta(source);
    return {
      name,
      metaName: loaded.meta.name,
      pureMeta: metaCheck.pure,
      dualWarnings: scanDualCompat(source),
    };
  });
  console.log(JSON.stringify(results, null, 2));
})();
'
```

Key output:

```json
[
  { "name": "adversarial-verify.js", "metaName": "adversarial-verify", "pureMeta": true, "dualWarnings": [] },
  { "name": "agent-daily-digest.js", "metaName": "agent-daily-digest", "pureMeta": true, "dualWarnings": [] },
  { "name": "codex-claude-loop.js", "metaName": "codex-claude-loop", "pureMeta": true, "dualWarnings": [] },
  { "name": "deep-research.js", "metaName": "deep-research", "pureMeta": true, "dualWarnings": [] },
  { "name": "fan-out-reduce.js", "metaName": "fan-out-reduce", "pureMeta": true, "dualWarnings": [] },
  { "name": "generate-and-filter.js", "metaName": "generate-and-filter", "pureMeta": true, "dualWarnings": [] },
  { "name": "loop-until-dry.js", "metaName": "loop-until-dry", "pureMeta": true, "dualWarnings": [] },
  { "name": "routing.js", "metaName": "routing", "pureMeta": true, "dualWarnings": [] },
  { "name": "tournament.js", "metaName": "tournament", "pureMeta": true, "dualWarnings": [] }
]
```

Local runtime smoke command used to prove file URL reads and hashing under Bun
1.3.11:

```bash
bun -e '
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const text = readFileSync(new URL("./package.json", import.meta.url), "utf8");
console.log({
  startsWithBrace: text.trimStart().startsWith("{"),
  hashLength: createHash("sha256").update(text, "utf8").digest("hex").length,
});
'
```

Key output:

```json
{ "startsWithBrace": true, "hashLength": 64 }
```

Revision note: round 2 revision for roadmap task 1.3.1. It adds explicit
official-documentation URLs and Firecrawl evidence for Bun, Node `fs`, Node
`crypto`, Biome, and Oxlint; cites locked local schema/declaration files for
load-bearing tool behaviour; replaces committed host-specific absolute paths
with `ODW_REFERENCE_CHECKOUT` and relative checkout conventions; and keeps the
implementation work deferred until this revised plan is approved.

Revision note: round 3 revision for roadmap task 1.3.1. It adds an explicit
`make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-3-1.out` step before every
direct `./node_modules/.bin/biome` formatter invocation, including work item 1
and the concrete steps, so clean worktrees install locked dependencies before
using local tool binaries.
