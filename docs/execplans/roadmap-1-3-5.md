# Add fixture metadata generation and refresh tooling

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: DRAFT

## Purpose / big picture

Roadmap task 1.3.5 gives maintainers one deterministic command for refreshing
the static-analysis fixture corpus. A fixture is a committed workflow source
file under `tests/static-analysis/fixtures/`; fixture metadata is the
TypeScript manifest data that pins each fixture's path, SHA-256 digest,
expected diagnostic status, UTF-8 source span and reviewer-facing `spanText`.

After this work, a maintainer can run `make refresh-fixtures` from the
repository root. The command copies the current allow-listed Open Dynamic
Workflows (ODW) example snapshots from the source-backed sibling checkout,
refreshes hashes for valid, invalid, masking and hostile metadata fixtures,
recomputes invalid-fixture diagnostic spans from stable reviewer text anchors,
and rewrites the TypeScript manifests in a reviewable, deterministic order. It
must not import, evaluate, execute or format raw workflow fixtures. The
underlying script also supports a non-mutating `--dry-run` mode that prints the
same `FixtureRefreshReport` shape as write mode, so tests and maintainers use
one command-output contract.

This task adds refresh tooling only. It does not implement the parser, linter
command, ODW loader parity execution, fixture drift reporting for new upstream
examples, or the no-side-effect lint execution regression.

## Constraints

- Run all commands from the roadmap worktree root that contains this ExecPlan.
  Do not edit the root/control worktree.
- Treat `origin/main` as the canonical integration branch.
- Use `grepai search --workspace Projects --project odw-lint "<English intent
  query>" --toon --compact` as the primary intent search tool. The GrepAI index
  reflects canonical `main` only; verify branch-local facts inside this
  worktree with `leta`, exact text search or file inspection before editing.
- Use `leta` for branch-local TypeScript symbol navigation, references, call
  graphs and refactoring. Use exact text search only for Markdown, raw fixture
  text, JSON and other non-symbol literals.
- Use `sem` instead of raw Git history commands when history, blame or
  entity-level diff review is needed.
- Load `biome-typescript` before touching TypeScript, JavaScript, JSON or
  formatter configuration. No TypeScript router skill is available in this
  environment, so `biome-typescript` is the matching local skill.
- Keep the static-analysis boundary from ADR 0001 intact. Production code must
  not import ODW executable loader, primitive factory, runtime launcher, worker
  or metadata-evaluating paths.
- The refresh tool must read raw fixture files as source text only. It must not
  import, dynamically import, evaluate, execute or run any raw `.js` fixture.
- Do not format copied ODW example snapshots or invalid workflow fixtures.
  Those files are intentionally raw source. Masking fixtures may be formatted by
  repository tooling because they are owned by `odw-lint`.
- Do not add a new package dependency. Use Bun, Node-compatible standard
  library APIs and existing `odw-lint` source-span helpers.
- The command must refresh only the existing ODW example allow-list from
  `ODW_EXAMPLE_FIXTURE_SNAPSHOTS`. New upstream ODW examples are reported as
  out-of-scope for roadmap task 4.1.1, not silently added here.
- Repository and ODW reference locations must be handled as normalized
  directory URLs. A `file:` URL without a trailing slash is still a directory
  input for this tool and must be normalized by appending `/` to its pathname
  before resolving the default sibling `open-dynamic-workflows/` checkout.
- Invalid fixture diagnostic spans are regenerated from existing `spanText`
  anchors. A non-empty anchor must appear exactly once in its raw fixture
  source. Empty `spanText` means a zero-length diagnostic anchored at the
  current start offset.
- Keep new code files under the 400-line project limit. If a new helper would
  exceed that limit, split it by fixture-refresh responsibility before
  committing.
- Use en-GB Oxford spelling in prose and comments.
- Format only changed files. For Markdown, run `mdtablefix` and
  `markdownlint-cli2 --fix` on the specific changed Markdown paths. For
  TypeScript, run Biome only on files definitely changed by the current work
  item after `make build`; use conditional formatting commands for optional
  generated manifest rewrites. Do not run repository-global mutating formatters
  such as `make fmt`, `bun fmt` or `mdformat-all`.
- Every work item changes this ExecPlan, so every work item must run
  file-scoped Markdown formatting on
  `docs/execplans/roadmap-1-3-5.md`, then run `make markdownlint` and
  `make nixie`.
- Every work item is independently committable and must pass its listed gates
  before the next work item begins.

If satisfying the objective requires violating a constraint, stop, record the
conflict in `Decision Log`, and escalate.

## Tolerances

- Scope: stop and escalate before changing production `src/**` files. This
  task should touch test-only refresh tooling, fixture manifests, fixture tests,
  `Makefile`, documentation, and this ExecPlan.
- Public API: stop and escalate before changing `src/index.ts`,
  `package.json` exports or any public `odw-lint` type signature.
- Dependencies: stop and escalate before adding or upgrading any package,
  including parser, code-generator, CLI or test dependencies.
- Fixture execution: stop immediately if the refresh tool or tests need to
  import or execute a raw fixture or an ODW runtime path.
- ODW examples: stop and escalate if the task cannot refresh the existing
  allow-listed ODW examples without adding new upstream examples.
- Span anchors: stop and document the fixture path if a non-empty diagnostic
  `spanText` anchor is missing or appears more than once. Do not guess a span.
- File count: stop and escalate if the implementation needs more than eight
  non-fixture tracked files beyond manifest files, documentation and this plan.
- Iterations: if a work item cannot pass `make all` after three focused fix
  attempts, record the failure and options in `Decision Log` before continuing.
- Formatter churn: if a formatter rewrites unrelated files, park that churn in
  a named discard stash:

  ```bash
  git stash push -m 'df12-stash v1 task=1.3.5 kind=discard reason="formatter-churn"'
  ```

## Risks

- Risk: the refresh script executes hostile fixture metadata while trying to
  inspect it. Severity: high. Likelihood: low. Mitigation: the tool must use
  filesystem reads, writes, copies, safe directory enumeration, SHA-256 hashing
  and the existing source-span helpers only. Tests must prove importing the
  tool does not set the hostile marker.

- Risk: text-based manifest rewriting causes broad, noisy diffs. Severity:
  medium. Likelihood: medium. Mitigation: generate the small manifest modules
  from typed in-memory data in a stable order, then run Biome only on changed
  TypeScript manifest paths.

- Risk: an invalid diagnostic anchor is no longer unique after a fixture edit.
  Severity: medium. Likelihood: medium. Mitigation: fail the refresh with a
  clear fixture path, rule and anchor count. A maintainer must update the
  reviewer-facing `spanText` intentionally before rerunning.

- Risk: the copied ODW example corpus drifts when upstream adds examples.
  Severity: medium. Likelihood: high. Mitigation: refresh only the existing
  allow-list and report extra upstream files as future task 4.1.1 work.

- Risk: `node_modules` is absent or stale. Severity: low. Likelihood: medium.
  Mitigation: every work item runs `make build` before Bun package tooling.

- Risk: documentation commands fail on unrelated existing Markdown. Severity:
  medium. Likelihood: low. Mitigation: keep this task's Markdown changes
  narrow; if the repository-wide gate fails on unrelated files, record the
  failure and evidence in this plan before escalating.

## Progress

- [x] (2026-06-29T22:16Z) Confirmed work is running in
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-3-5`.
- [x] (2026-06-29T22:16Z) Loaded `execplans`, `leta`, `grepai`,
  `firecrawl-mcp`, `sem`, `biome-typescript`, and `en-gb-oxendict-style`.
- [x] (2026-06-29T22:16Z) Used GrepAI intent searches against canonical
  `odw-lint` for fixture metadata refresh seams, then verified branch-local
  files with `leta` and file inspection.
- [x] (2026-06-29T22:16Z) Read the required design, roadmap, developer,
  scripting, complexity, documentation-style, repository-layout and ADR docs.
- [x] (2026-06-29T22:16Z) Verified the sibling ODW checkout at
  `/data/leynos/Projects/open-dynamic-workflows` for loader, dual-compat,
  primitive validation and example behaviour relevant to this task.
- [x] (2026-06-29T22:16Z) Verified Bun runtime, `bun test`,
  `import.meta.main` and Biome CLI behaviour using local commands and official
  documentation via Firecrawl.
- [x] (2026-06-29T22:16Z) Verified current invalid diagnostic `spanText`
  anchors are unique, except the intentional empty zero-length missing-meta
  anchor.
- [x] (2026-06-29T22:37Z) Revised the plan after design review to define the
  `FixtureRefreshReport` and command-output contract, remove sibling-checkout
  dependency from `make all` tests, normalize directory URL handling, and make
  formatter commands path-safe.
- [x] (2026-06-29T22:49Z) Work item 1: Add import-safe fixture metadata
  derivation helpers.
- [ ] Work item 2: Add deterministic manifest refresh writing for every
  fixture corpus.
- [ ] Work item 3: Add the fixture refresh Make target and build-gate tests.
- [ ] Work item 4: Document the refresh workflow and close roadmap task 1.3.5.

## Surprises & discoveries

- Observation: `bun.lock` records `@biomejs/biome` 2.5.1, and
  `bunx @biomejs/biome --version` reported 2.5.1 in this worktree. Evidence:
  local command output during planning. Impact: implementation must run
  `make build` before using project package tooling, and this plan relies only
  on the explicit Biome CLI contract for path-scoped formatting.

- Observation: all current non-empty invalid fixture diagnostic `spanText`
  values occur exactly once in their corresponding raw fixture source. Evidence:
  a Bun read-only probe over `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS` reported
  one match for every non-empty anchor and the expected empty anchor at offset
  zero for `missing-meta.js`. Impact: the refresh tool can use `spanText` as
  the deterministic source of truth for span regeneration.

- Observation: the package entry already exports `createOriginalSourceFile`,
  `spanFromOffsets` and `snippetForSpan`. Evidence: branch-local inspection of
  `src/static-analysis/index.ts` and `src/index.ts`, plus `leta show` for the
  three helpers. Impact: refresh tooling can import the public facade from
  `odw-lint` without changing production exports.

- Observation: the sibling ODW loader evaluates metadata and compiles workflow
  bodies, while `checkMeta` is static and rejects computed metadata. Evidence:
  `/data/leynos/Projects/open-dynamic-workflows/src/loader.ts`,
  `src/dual-compat.ts` and `src/primitives.ts`. Impact: this task must not call
  ODW loader or runtime validation APIs; it may use the sibling checkout only
  as a source-backed example-file reference.

- Observation: `new URL("../../open-dynamic-workflows/", repositoryRoot)`
  resolves to the wrong parent if `repositoryRoot` is a `file:` URL without a
  trailing slash. Evidence: a local Bun probe resolved
  `file:///data/leynos/Projects/odw-lint.worktrees/roadmap-1-3-5` to
  `file:///data/leynos/open-dynamic-workflows/`, while the trailing-slash
  directory URL resolved to
  `file:///data/leynos/Projects/open-dynamic-workflows/`. Impact:
  `defaultOdwReferenceCheckout(repositoryRoot: URL)` must normalize directory
  URLs before resolving the sibling checkout and must have focused tests for
  trailing-slash and non-trailing-slash inputs.

- Observation: the first refresh helper slice can derive UTF-8 diagnostic spans
  from reviewer-facing `spanText` without importing any raw fixture module.
  Evidence: `bun test tests/static-analysis/fixture-metadata-refresh.test.ts`
  passed 11 tests after adding `refresh-metadata.ts`. Impact: later work items
  can build deterministic manifest writing on the same import-safe helper
  surface.

## Decision log

- Decision: implement refresh tooling as a Bun TypeScript script at
  `tests/static-analysis/fixtures/refresh-metadata.ts`, guarded by
  `import.meta.main`.
  Rationale: the repository is TypeScript-first, Bun can execute `.ts` files
  directly, tests can import the pure helper functions, and no new dependency is
  needed.
  Date/Author: 2026-06-29T22:16Z / Codex.

- Decision: expose the maintainer command as `make refresh-fixtures`.
  Rationale: AGENTS.md and `docs/repository-layout.md` prefer Makefile targets
  as canonical maintainer entry points, while the implementation can stay in a
  tested TypeScript module.
  Date/Author: 2026-06-29T22:16Z / Codex.

- Decision: regenerate invalid diagnostic spans from `spanText`, not from ODW
  parsing or executable runtime validation.
  Rationale: `spanText` is reviewer-facing data already present in the
  manifests; exact-anchor matching is deterministic and keeps the refresh tool
  out of the ODW runtime trust boundary.
  Date/Author: 2026-06-29T22:16Z / Codex.

- Decision: refresh the existing ODW example allow-list only.
  Rationale: roadmap task 1.3.5 is about metadata refresh for the current
  corpus; roadmap task 4.1.1 owns adding new ODW examples and drift workflow.
  Date/Author: 2026-06-29T22:16Z / Codex.

- Decision: define `FixtureRefreshReport` and the `refresh-metadata.ts` CLI
  output contract before implementation.
  Rationale: dry-run counts, written-path reporting, extra-upstream-example
  reporting and actionable failures need one stable contract that tests,
  documentation and the Make target all implement.
  Date/Author: 2026-06-29T22:37Z / Codex.

- Decision: keep `defaultOdwReferenceCheckout(repositoryRoot: URL)`, but require
  directory URL normalization before resolving the sibling path.
  Rationale: accepting URLs keeps the existing plan shape and works well with
  `pathToFileURL`, but a non-trailing-slash `file:` URL is otherwise treated as
  a file path by WHATWG URL resolution.
  Date/Author: 2026-06-29T22:37Z / Codex.

- Decision: support both normal checkout roots and df12 worktree roots when
  resolving the default ODW reference checkout.
  Rationale: a normal `odw-lint` checkout can resolve the sibling through
  `../open-dynamic-workflows/`, while a task checkout under
  `odw-lint.worktrees/<task>` must resolve through the parent project
  directory to avoid looking inside the worktree container.
  Date/Author: 2026-06-29T22:49Z / Codex.

## Outcomes & retrospective

Work item 1 added the import-safe refresh helper core and focused tests. The
module now exports the report, failure, URL-resolution, SHA-256 and diagnostic
span derivation contracts that later work items extend into manifest writing
and a Makefile target. It still deliberately avoids repository writes.

## Context and orientation

The repository is a private TypeScript package named `odw-lint`. It currently
has no production linter command; the first roadmap phase is building the
static-analysis fixture and diagnostic spine. The fixture corpus lives under
`tests/static-analysis/fixtures/`.

There are three fixture groups relevant to this task:

- `tests/static-analysis/fixtures/odw-examples/` contains byte-for-byte copied
  upstream ODW example workflows. Its manifest is
  `tests/static-analysis/fixtures/odw-examples.ts`.
- `tests/static-analysis/fixtures/invalid-workflows/` contains deliberately
  invalid raw workflows, including the `hostile-metadata` family. Its aggregate
  manifest is `tests/static-analysis/fixtures/invalid-workflows.ts`, and
  family manifests live under
  `tests/static-analysis/fixtures/invalid-workflows/manifests/`.
- `tests/static-analysis/fixtures/masking/` contains `odw-lint`-owned masking
  fixtures. Its manifest is `tests/static-analysis/fixtures/masking.ts`.

Existing test-only helpers in
`tests/static-analysis/fixtures/corpus-support.ts` provide `sha256`,
`copiedFixtureFileNames`, `fixtureSourceUrl` and `readFixtureSource`.
Existing source-span helpers exported from `odw-lint` provide
`createOriginalSourceFile`, `spanFromOffsets` and `snippetForSpan`.

The source-backed ODW reference checkout is the sibling
`open-dynamic-workflows/` checkout. The refresh command must default
`ODW_REFERENCE_CHECKOUT` from a normalized repository-root directory URL,
choosing the relative path for either an ordinary checkout root or a df12
worktree root. Maintainers may override the environment variable with a
filesystem path when their checkout layout differs. Relative override values
are resolved from the repository root, not from the process that launched the
tests. The committed documentation must not record host-specific absolute paths
as the operational default.

## Research evidence

Primary repository and branch-local research:

- GrepAI searches used:
  `fixture metadata generation refresh tooling workflow examples manifest`,
  `roadmap fixture manifest metadata refresh tooling`, and
  `ODW example fixtures metadata manifests test corpus`.
- `leta show spanFromOffsets`, `leta show snippetForSpan` and
  `leta show createOriginalSourceFile` verified that source-span helpers derive
  spans and reviewer snippets from an `OriginalSourceFile`.
- `leta show invalidWorkflowFixture`,
  `leta show InvalidWorkflowFixtureDiagnostic`, and
  `leta show InvalidWorkflowFixtureSnapshot` verified current invalid manifest
  shapes.
- `sem diff --from origin/main --to HEAD` reported no semantic branch changes
  before this plan file was added.

Design and project documentation cited:

- `docs/roadmap.md` section 1.3.5 requires one command or focused target that
  refreshes fixture hashes, UTF-8 spans, display positions and reviewer-facing
  span text without executing or formatting raw workflow fixtures.
- `docs/roadmap.md` section 4.1 keeps adding new ODW examples and drift
  reporting out of scope for this task.
- `docs/terms-of-reference.md` sections "Job to be done", "Success criteria"
  and "Constraints" require static checks that align with ODW examples, avoid
  workflow execution and preserve ODW-vs-Claude compatibility distinctions.
- `docs/technical-design.md` sections 4, 5, 11.1, 11.2, 11.3, 15 and 16 define
  the static-analysis boundary, fixture corpus, loader parity constraints,
  security regression constraints, release gates and ODW source references.
- `docs/adr/0001-static-analysis-boundary.md` forbids production imports of
  ODW executable loader and primitive paths.
- `docs/developers-guide.md` sections "Workflow Fixture Corpus" and
  "Source-span helpers" define the fixture ownership rules and UTF-8
  line/column contract.
- `docs/scripting-standards.md` section "Operational guidelines" requires
  idempotent scripts, pure functions with configuration objects, POSIX-like
  exit codes and minimal dependencies.
- `docs/documentation-style-guide.md` sections "Spelling", "Markdown rules",
  "Formatting" and "Contents file" define the documentation style and contents
  upkeep rule.
- `docs/repository-layout.md` sections "Test and fixture boundaries" and
  "Tooling entry points" locate fixture ownership and Makefile validation
  entry points.

External and sibling source research:

- Sibling ODW `src/loader.ts` defines `loadWorkflowScript(source, filename)`.
  It extracts `export const meta`, evaluates metadata through `new Function`,
  masks non-code while scanning, and compiles the workflow body with injected
  globals. The refresh tool must not call it.
- Sibling ODW `src/dual-compat.ts` defines `checkMeta(source)` and a
  pure-literal parser that rejects computed metadata without executing source.
  This supports keeping hostile metadata fixtures as static expectations.
- Sibling ODW `src/primitives.ts` defines `validate(source)` as a runtime
  primitive that calls `loadWorkflowScript`; the refresh tool must not call it.
- Sibling ODW `examples/` currently contains the same nine allow-listed files
  as `ODW_EXAMPLE_FIXTURE_SNAPSHOTS`.
- Installed Bun 1.3.11 help reports `bun run ./my-script.ts` for executing a
  file and `bun test` for tests. Official Bun runtime docs state that
  `bun run index.ts` executes TypeScript files and transpiles them on the fly:
  <https://bun.com/docs/runtime>.
- Official Bun docs state `import.meta.main` identifies the current entrypoint:
  <https://bun.com/docs/guides/util/entrypoint>. A local
  `bun -e 'console.log(import.meta.main === true)'` check returned `true`.
- Official Bun test docs state `bun test` supports TypeScript tests, path
  filters and snapshots: <https://bun.com/docs/test>.
- Local Biome CLI help and official Biome CLI docs verify
  `biome format --write [PATH]...` runs the formatter on explicit paths:
  <https://biomejs.dev/reference/cli/>. The plan relies only on that CLI
  contract after `make build`, not on Biome internals. `bun.lock` pins
  `@biomejs/biome` to 2.5.1, and `bunx @biomejs/biome --version` reported
  2.5.1 in this worktree.
- Official Node URL docs for `new URL(input, base)` state that a relative
  input is parsed against the base URL, and a local Bun probe confirmed the
  trailing-slash directory behaviour that affects
  `defaultOdwReferenceCheckout(repositoryRoot: URL)`:
  <https://nodejs.org/api/url.html#new-urlinput-base>.

## Command and report contract

The refresh module and CLI must implement one exact reporting contract. The
module returns a `FixtureRefreshReport`; the CLI prints that report as
pretty-printed JSON with a trailing newline. Tests should assert the parsed
JSON shape, not incidental property ordering.

The report types are:

```typescript
export type FixtureRefreshMode = "dry-run" | "write";

export type FixtureRefreshFailureCode =
  | "invalid-arguments"
  | "missing-odw-reference-checkout"
  | "missing-upstream-example"
  | "missing-fixture-source"
  | "missing-anchor"
  | "duplicate-anchor"
  | "manifest-write-failed"
  | "unexpected-error";

export interface FixtureRefreshFailure {
  readonly code: FixtureRefreshFailureCode;
  readonly message: string;
  readonly path: string | null;
  readonly rule: string | null;
  readonly anchor: string | null;
  readonly occurrenceCount: number | null;
  readonly remediation: string;
}

export interface FixtureRefreshCounts {
  readonly odwExamples: number;
  readonly masking: number;
  readonly invalidWorkflows: number;
  readonly hostileMetadata: number;
  readonly invalidDiagnostics: number;
  readonly totalFixtures: number;
}

export interface FixtureRefreshReport {
  readonly mode: FixtureRefreshMode;
  readonly repositoryRoot: string;
  readonly odwReferenceCheckout: string;
  readonly counts: FixtureRefreshCounts;
  readonly managedPaths: readonly string[];
  readonly wouldWritePaths: readonly string[];
  readonly writtenPaths: readonly string[];
  readonly unchangedPaths: readonly string[];
  readonly extraUpstreamExamples: readonly string[];
  readonly failures: readonly FixtureRefreshFailure[];
}
```

`repositoryRoot` and `odwReferenceCheckout` are absolute filesystem paths
serialized with `fileURLToPath`. `managedPaths`, `wouldWritePaths`,
`writtenPaths`, `unchangedPaths` and `extraUpstreamExamples` are
repository-relative paths or upstream example basenames sorted in bytewise
lexicographic order. `managedPaths` includes every repository file the refresh
owns: the copied allow-listed ODW example files and all manifest modules.
`wouldWritePaths` names managed paths whose bytes differ from the generated
content. `writtenPaths` is empty in dry-run mode and names only files actually
written in write mode. `unchangedPaths` names managed paths already matching
the generated content. `extraUpstreamExamples` names sibling ODW example
basenames that are not in the allow-list; they are informational and are not a
failure for task 1.3.5.

The CLI contract for `tests/static-analysis/fixtures/refresh-metadata.ts` is:

- `bun run tests/static-analysis/fixtures/refresh-metadata.ts` runs write mode.
- `bun run tests/static-analysis/fixtures/refresh-metadata.ts --dry-run` runs
  dry-run mode.
- On success, stdout contains exactly one JSON `FixtureRefreshReport` with
  `failures: []`, stderr is empty, and the exit code is `0`.
- On actionable refresh failure, stdout is empty, stderr contains exactly one
  JSON `FixtureRefreshReport` with one or more `failures`, and the exit code is
  `1`.
- On invalid CLI arguments, stdout is empty, stderr contains exactly one JSON
  `FixtureRefreshReport` with an `invalid-arguments` failure, and the exit code
  is `2`.
- Unexpected thrown values are caught, converted to one `unexpected-error`
  failure with a remediation message, printed to stderr as the same report
  shape, and exit with code `1`.

The non-zero conditions are missing reference checkout, missing allow-listed
upstream example, missing copied fixture source, missing diagnostic anchor,
duplicate diagnostic anchor, manifest or fixture write failure, invalid CLI
arguments, and unexpected errors. Every failure message must include the
affected path when one exists, and every failure must include a concrete
`remediation` field.

## Plan of work

### Work item 1: Add import-safe fixture metadata derivation helpers

This work item creates the pure derivation core and tests it without writing
repository files. It is the red-green foundation for the later mutating
refresh command.

Read before editing:

- `docs/roadmap.md` section 1.3.5.
- `docs/technical-design.md` sections 11.1 and 11.3.
- `docs/developers-guide.md` sections "Workflow Fixture Corpus" and
  "Source-span helpers".
- `docs/scripting-standards.md` section "Operational guidelines".
- `docs/adr/0001-static-analysis-boundary.md`.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` section
  "Avoiding the antipattern: proactive strategies".

Load these skills:

- `execplans`
- `grepai`
- `leta`
- `biome-typescript`
- `en-gb-oxendict-style`
- `sem` for reviewing entity-level diffs before commit

Edit:

- Create `tests/static-analysis/fixtures/refresh-metadata.ts`.
- Create `tests/static-analysis/fixture-metadata-refresh.test.ts`.
- Update `docs/execplans/roadmap-1-3-5.md` progress and discoveries.

The helper module must export pure functions and types, including these stable
interfaces:

```typescript
export interface DiagnosticSpanAnchor {
  readonly fixturePath: string;
  readonly rule: string;
  readonly spanText: string;
  readonly fallbackByteOffset: number;
}

export interface RefreshedDiagnosticSpan {
  readonly span: SourceSpan;
  readonly spanText: string;
}

export interface FixtureRefreshOptions {
  readonly repositoryRoot: URL;
  readonly odwReferenceCheckout: URL;
  readonly shouldWrite: boolean;
}
```

It must also export:

- `deriveSha256(sourceText: string): string`, delegating to the existing
  `sha256` helper or matching its Node `createHash("sha256")` contract.
- `deriveAnchoredDiagnosticSpan(source: WorkflowSource, anchor:
  DiagnosticSpanAnchor): RefreshedDiagnosticSpan`.
- `normalizeDirectoryUrl(url: URL): URL`, which returns a copy with no search or
  hash and with a trailing `/` appended to the pathname when absent. It must not
  call `new URL("./", url)` for normalization because that treats a
  non-trailing-slash directory URL as a file.
- `defaultOdwReferenceCheckout(repositoryRoot: URL): URL`.
- `resolveOdwReferenceCheckout(repositoryRoot: URL, overridePath: string |
  undefined): URL`. The override is a filesystem path, not a `file:` URL; a
  relative override is resolved from the normalized repository-root directory.
- `refreshFixtureMetadata(options: FixtureRefreshOptions): FixtureRefreshReport`
  as a non-mutating stub that returns the exact report shape from "Command and
  report contract" when `shouldWrite` is `false`.

`defaultOdwReferenceCheckout(repositoryRoot)` must be layout-aware. For a
normal checkout root such as `file:///tmp/Projects/odw-lint`, it resolves
`../open-dynamic-workflows/`. For the df12 build-worktree shape
`file:///tmp/Projects/odw-lint.worktrees/roadmap-1-3-5` and the equivalent
trailing-slash URL, it resolves `../../open-dynamic-workflows/`. Both layouts
must produce `file:///tmp/Projects/open-dynamic-workflows/`.

The anchor derivation algorithm is fixed:

1. Build an `OriginalSourceFile` with `createOriginalSourceFile`.
2. If `anchor.spanText` is non-empty, find exact occurrences in
   `source.sourceText`. Exactly one occurrence is required.
3. Convert the text start and end indexes to UTF-8 offsets with
   `Buffer.byteLength(source.sourceText.slice(0, index), "utf8")`.
4. Use `spanFromOffsets(file, startOffset, endOffset)`.
5. Use `snippetForSpan(file, span).text` as the canonical refreshed
   `spanText`.
6. If `anchor.spanText` is empty, use a zero-length span at
   `anchor.fallbackByteOffset` and recompute its display position.

Tests to add:

- Unit test: derives SHA-256 using the same contract as
  `tests/static-analysis/fixtures/corpus-support.ts`.
- Unit test: derives ASCII spans and reviewer text from a unique anchor.
- Unit test: derives Unicode-aware byte offsets and display columns from a
  unique anchor.
- Unit test: derives a zero-length span from an empty anchor.
- Unit test: rejects missing anchors and duplicate anchors with actionable
  errors that include the fixture path and rule.
- Unit test: `defaultOdwReferenceCheckout(repositoryRoot)` resolves the df12
  worktree-to-sibling path correctly for both trailing-slash and
  non-trailing-slash repository-root URLs.
- Unit test: `resolveOdwReferenceCheckout(repositoryRoot, overridePath)`
  resolves a relative `ODW_REFERENCE_CHECKOUT` override from the repository
  root, not from the process current working directory.
- Unit test: dry-run `refreshFixtureMetadata({ shouldWrite: false })` returns a
  `FixtureRefreshReport` with current corpus counts, sorted managed paths,
  empty `writtenPaths`, and `failures: []` when supplied with a temporary ODW
  reference checkout.
- Unit test: importing `refresh-metadata.ts` does not mutate files or set the
  hostile metadata global marker.

No behavioural Gherkin, property test, snapshot or end-to-end test is required
in this work item. The externally observable command does not exist yet.

Validation commands from the worktree root:

```bash
make build
bunx @biomejs/biome format --write \
  tests/static-analysis/fixtures/refresh-metadata.ts \
  tests/static-analysis/fixture-metadata-refresh.test.ts
mdtablefix docs/execplans/roadmap-1-3-5.md
markdownlint-cli2 --fix docs/execplans/roadmap-1-3-5.md
bun test tests/static-analysis/fixture-metadata-refresh.test.ts
make all
make markdownlint
make nixie
```

Expected result: the focused test fails before the derivation helpers exist,
passes after the helpers are implemented, and all repository gates pass.
Commit this item before starting work item 2.

### Work item 2: Add deterministic manifest refresh writing for every fixture corpus

This work item makes the helper capable of rewriting the existing TypeScript
manifests and copying the current allow-listed ODW example files.

Read before editing:

- Everything from work item 1.
- `docs/roadmap.md` section 4.1, to preserve the boundary between refreshing
  existing examples and adding new examples.
- `docs/repository-layout.md` section "Test and fixture boundaries".
- Official Bun runtime docs at <https://bun.com/docs/runtime>.
- Official Bun entrypoint docs at
  <https://bun.com/docs/guides/util/entrypoint>.

Load these skills:

- `execplans`
- `grepai`
- `leta`
- `biome-typescript`
- `en-gb-oxendict-style`
- `sem` for reviewing entity-level diffs before commit

Edit:

- Extend `tests/static-analysis/fixtures/refresh-metadata.ts`.
- Extend `tests/static-analysis/fixture-metadata-refresh.test.ts`.
- The script may rewrite these existing manifest files when executed:
  `tests/static-analysis/fixtures/odw-examples.ts`,
  `tests/static-analysis/fixtures/masking.ts`, and the five files under
  `tests/static-analysis/fixtures/invalid-workflows/manifests/`.
- It may copy the nine existing files listed in
  `ODW_EXAMPLE_FIXTURE_SNAPSHOTS` from
  `${ODW_REFERENCE_CHECKOUT}/examples/` into
  `tests/static-analysis/fixtures/odw-examples/`.
- Update this ExecPlan progress and discoveries.

The implementation must not add a parser dependency. Generate manifest source
from imported manifest data plus refreshed source facts. Preserve these
contracts:

- ODW example manifests keep the current file allow-list, `fixturePath`,
  `upstreamPath`, `expectedStatus: "no-error"` and empty expected diagnostics.
- Masking manifests keep the current file list, contexts, metadata names,
  expected status and empty expected diagnostics.
- Invalid family manifests keep current family, file name, status, diagnostic
  rule, severity and message values. Only `sha256`, `span`, and canonical
  `spanText` are regenerated.
- Hostile metadata fixtures are handled as ordinary invalid fixtures in the
  `hostile-metadata` family.
- Extra files in the sibling ODW `examples/` directory are reported in the
  refresh summary as out-of-scope for roadmap task 4.1.1.

Tests to add or update:

- Unit test: `refreshFixtureMetadata({ shouldWrite: false })` reports current
  corpus counts without writing.
- Unit test with a temporary repository tree: `shouldWrite: true` rewrites a
  copied manifest deterministically and preserves raw `.js` fixture bytes.
- Unit test: missing allow-listed upstream ODW example fails with a message
  naming the missing file and `ODW_REFERENCE_CHECKOUT`.
- Unit test: an extra upstream ODW example is reported but not copied.
- Integration-style Bun test: running the refresh function twice against a
  temporary repository tree and a temporary ODW reference checkout is
  idempotent. The first write may report `writtenPaths`; the second write must
  report `writtenPaths: []` and the same sorted `managedPaths`. This test must
  not read `../../open-dynamic-workflows` or require the sibling checkout
  during `make all`.
- CLI test: `bun run tests/static-analysis/fixtures/refresh-metadata.ts
  --dry-run` with an injected temporary `ODW_REFERENCE_CHECKOUT` prints a
  parseable success `FixtureRefreshReport` to stdout, leaves stderr empty, and
  exits `0`.
- CLI test: an actionable failure, such as a missing allow-listed upstream
  example in a temporary checkout, prints a failure `FixtureRefreshReport` to
  stderr, leaves stdout empty, and exits `1`.
- Existing unit and snapshot tests:
  `tests/static-analysis/odw-example-fixtures.test.ts`,
  `tests/static-analysis/masking-fixtures.test.ts`, and
  `tests/static-analysis/invalid-workflow-fixtures.test.ts` must continue to
  pass after the refresh.

No new behavioural Gherkin test is required. The command will be exposed in
work item 3. No property test is required because the source-span helpers
already have property tests and this item is deterministic manifest generation.

Validation commands from the worktree root:

```bash
make build
ODW_REFERENCE_CHECKOUT="${ODW_REFERENCE_CHECKOUT:-../../open-dynamic-workflows/}" \
  bun run tests/static-analysis/fixtures/refresh-metadata.ts
bunx @biomejs/biome format --write \
  tests/static-analysis/fixtures/refresh-metadata.ts \
  tests/static-analysis/fixture-metadata-refresh.test.ts
mapfile -t modified_manifest_paths < <(git status --short -- \
  tests/static-analysis/fixtures/odw-examples.ts \
  tests/static-analysis/fixtures/masking.ts \
  tests/static-analysis/fixtures/invalid-workflows/manifests/*.ts \
  | awk '$1 !~ /^D/ {print $2}')
test "${#modified_manifest_paths[@]}" -eq 0 || \
  bunx @biomejs/biome format --write "${modified_manifest_paths[@]}"
mdtablefix docs/execplans/roadmap-1-3-5.md
markdownlint-cli2 --fix docs/execplans/roadmap-1-3-5.md
bun test \
  tests/static-analysis/fixture-metadata-refresh.test.ts \
  tests/static-analysis/odw-example-fixtures.test.ts \
  tests/static-analysis/masking-fixtures.test.ts \
  tests/static-analysis/invalid-workflow-fixtures.test.ts
make all
make markdownlint
make nixie
```

Expected result: the refresh script is idempotent in the current worktree,
fixture tests pass, raw invalid and copied ODW example fixture contents are not
formatted, and all repository gates pass. Commit this item before starting work
item 3.

### Work item 3: Add the fixture refresh Make target and build-gate tests

This work item exposes the one documented maintainer command.

Read before editing:

- `AGENTS.md` "Tooling Defaults" and "Change Quality & Committing".
- `docs/repository-layout.md` section "Tooling entry points".
- `docs/developers-guide.md` sections "Build and Validation" and "Workflow
  Fixture Corpus".
- `docs/scripting-standards.md` section "Operational guidelines".
- Official Bun test docs at <https://bun.com/docs/test>.
- Official Biome CLI docs at <https://biomejs.dev/reference/cli/>.

Load these skills:

- `execplans`
- `grepai`
- `leta`
- `biome-typescript`
- `en-gb-oxendict-style`
- `sem` for reviewing entity-level diffs before commit

Edit:

- Update `Makefile`:
  - add `refresh-fixtures` to `.PHONY`;
  - define `refresh-fixtures: build ## Refresh workflow fixture metadata`;
  - run `bun run tests/static-analysis/fixtures/refresh-metadata.ts`.
- Update `tests/build-gate/makefile.test.ts` to assert the target exists and
  its dry-run schedules the Bun refresh script after build prerequisites.
- Update this ExecPlan progress and discoveries.

Tests to add or update:

- Unit/build-gate test: `Makefile` exposes `refresh-fixtures` as a documented
  phony target.
- Unit/build-gate test: a dry-run of `make refresh-fixtures` contains
  `bun run tests/static-analysis/fixtures/refresh-metadata.ts`.
- Existing fixture refresh unit tests from work item 2 must continue to pass.
- No new snapshot, property or end-to-end test is required. The dry-run
  Makefile test validates the command wiring without mutating repository files.

Validation commands from the worktree root:

```bash
make build
bunx @biomejs/biome format --write tests/build-gate/makefile.test.ts
mdtablefix docs/execplans/roadmap-1-3-5.md
markdownlint-cli2 --fix docs/execplans/roadmap-1-3-5.md
mbake validate Makefile
bun test \
  tests/build-gate/makefile.test.ts \
  tests/static-analysis/fixture-metadata-refresh.test.ts
make refresh-fixtures
make all
make markdownlint
make nixie
```

Expected result: `make refresh-fixtures` refreshes the corpus without changing
an already-current worktree, the build-gate tests prove the target is wired,
and all repository gates pass. Commit this item before starting work item 4.

### Work item 4: Document the refresh workflow and close roadmap task 1.3.5

This work item records the maintainer workflow and closes the roadmap task
after the command, tests and gates are complete.

Read before editing:

- `docs/developers-guide.md` sections "Workflow Fixture Corpus",
  "Source-span helpers", "Markdown" and "Documentation Upkeep".
- `docs/repository-layout.md` sections "Test and fixture boundaries" and
  "Tooling entry points".
- `docs/contents.md` section "Execution plans".
- `docs/documentation-style-guide.md` sections "Spelling", "Markdown rules",
  "Formatting" and "Contents file".
- `docs/roadmap.md` sections 1.3.5 and 4.1.
- `docs/terms-of-reference.md` sections "Success criteria" and
  "Constraints".

Load these skills:

- `execplans`
- `grepai`
- `leta` if branch-local code references need another check
- `biome-typescript` if TypeScript formatting changes are still needed
- `en-gb-oxendict-style`
- `sem` for reviewing entity-level diffs before commit

Edit:

- Update `docs/developers-guide.md` "Workflow Fixture Corpus" to document:
  - `make refresh-fixtures`;
  - the optional `ODW_REFERENCE_CHECKOUT` override;
  - the rule that copied ODW examples and invalid workflow fixtures must not be
    formatted or executed;
  - the anchor rule for invalid diagnostic `spanText`;
  - expected validation after a refresh.
- Update `docs/repository-layout.md` to list `make refresh-fixtures` under the
  fixture/tooling boundary and point at the refresh script.
- Update `docs/contents.md` to add this ExecPlan link under "Execution plans".
- Update `docs/roadmap.md` to mark task 1.3.5 complete only after the command,
  tests, docs and gates pass. Do not mark section 4.1 tasks complete.
- Update this ExecPlan: mark work items complete, set status to `COMPLETE`,
  update `Outcomes & Retrospective`, and append a revision note.

Tests to add or update:

- No new tests are expected in this documentation closure item.
- The focused refresh, Makefile and fixture tests from prior items must still
  pass.

Validation commands from the worktree root:

```bash
make build
mdtablefix \
  docs/developers-guide.md \
  docs/repository-layout.md \
  docs/contents.md \
  docs/roadmap.md \
  docs/execplans/roadmap-1-3-5.md
markdownlint-cli2 --fix \
  docs/developers-guide.md \
  docs/repository-layout.md \
  docs/contents.md \
  docs/roadmap.md \
  docs/execplans/roadmap-1-3-5.md
bun test \
  tests/build-gate/makefile.test.ts \
  tests/static-analysis/fixture-metadata-refresh.test.ts \
  tests/static-analysis/odw-example-fixtures.test.ts \
  tests/static-analysis/masking-fixtures.test.ts \
  tests/static-analysis/invalid-workflow-fixtures.test.ts
make refresh-fixtures
make all
make markdownlint
make nixie
```

Expected result: maintainer documentation describes one refresh command,
roadmap task 1.3.5 is checked off, task 4.1 remains open, focused tests pass,
and all repository gates pass. Commit this item.

## Concrete steps

For each work item:

1. Confirm the worktree and branch.

   ```bash
   pwd
   git branch --show-current
   git status --short
   ```

2. Re-run a targeted GrepAI search if uncertainty appears. Treat results as
   canonical-main hints only.

   ```bash
   grepai search --workspace Projects --project odw-lint \
     "fixture metadata refresh static analysis manifests" --toon --compact
   ```

3. Use Leta before TypeScript edits to verify symbols and references.

   ```bash
   leta grep "refresh|Fixture|Span|Manifest" \
     "tests/static-analysis|src/static-analysis" \
     -k function,method,interface,type,constant,variable
   ```

4. Make only the current work item's edits.

5. Update this ExecPlan's living sections.

6. Run the work item's validation commands.

7. Review changed entities and whitespace before committing.

   ```bash
   sem diff
   git diff --check
   git status --short
   ```

8. Commit only after all gates pass.

## Validation and acceptance

Acceptance is observable when:

- `make refresh-fixtures` exists and runs from the repository root.
- The command copies the existing allow-listed ODW examples from
  `ODW_REFERENCE_CHECKOUT` and refreshes all manifest hashes.
- Invalid and hostile metadata fixture diagnostics have refreshed UTF-8 byte
  spans, display line/column positions and `spanText`.
- The command is idempotent on an already-current worktree.
- The command does not import, evaluate, execute or format raw invalid workflow
  fixtures or copied ODW example snapshots.
- Documentation explains the command, the `ODW_REFERENCE_CHECKOUT` override,
  raw-fixture safety rules and validation after refresh.
- Roadmap task 1.3.5 is complete and roadmap section 4.1 remains open.

Final quality method:

```bash
make refresh-fixtures
make all
make markdownlint
make nixie
```

Focused quality method:

```bash
bun test \
  tests/build-gate/makefile.test.ts \
  tests/static-analysis/fixture-metadata-refresh.test.ts \
  tests/static-analysis/odw-example-fixtures.test.ts \
  tests/static-analysis/masking-fixtures.test.ts \
  tests/static-analysis/invalid-workflow-fixtures.test.ts
```

Expected result: every command exits with status `0`, and `git status --short`
after `make refresh-fixtures` shows no unexpected changes when the manifests
are current.

## Idempotence and recovery

The refresh command must be safe to rerun. If manifests are current, rerunning
`make refresh-fixtures` should leave the worktree unchanged.

If `ODW_REFERENCE_CHECKOUT` is unset, the command resolves the sibling
`open-dynamic-workflows/` checkout from the normalized repository-root
directory URL, using the ordinary checkout layout or the df12 worktree layout
as appropriate. If that directory is missing, the command exits non-zero with
a `missing-odw-reference-checkout` failure that names `ODW_REFERENCE_CHECKOUT`,
the resolved path and the remediation. If `ODW_REFERENCE_CHECKOUT` is set, its
value is a filesystem path; a relative value is resolved from the repository
root.

If an allow-listed upstream example is missing, stop and inspect the sibling ODW
checkout. Do not delete the corresponding copied fixture automatically.

If extra upstream examples are present, report them as out-of-scope for roadmap
task 4.1.1 and continue refreshing the existing allow-list.

If an invalid diagnostic anchor is missing or duplicated, do not guess. Update
the manifest's reviewer-facing `spanText` intentionally, rerun the refresh, and
commit both the fixture/source change and regenerated metadata together.

If the hostile metadata marker is set during tests, stop immediately. Inspect
the refresh script and tests for any import or execution path touching raw
fixtures, remove that path, and record the incident in `Decision Log`.

If a formatter touches raw ODW example or invalid workflow `.js` fixtures, do
not keep the churn. Restore those raw fixture bytes from the source-backed
reference or the previous commit, then rerun only file-scoped formatting on
changed TypeScript and Markdown files.

## Artifacts and notes

Use these log paths when capturing validation output:

```plaintext
/tmp/build-odw-lint-roadmap-1-3-5.out
/tmp/refresh-fixtures-odw-lint-roadmap-1-3-5.out
/tmp/test-refresh-fixtures-odw-lint-roadmap-1-3-5.out
/tmp/all-odw-lint-roadmap-1-3-5.out
/tmp/markdownlint-odw-lint-roadmap-1-3-5.out
/tmp/nixie-odw-lint-roadmap-1-3-5.out
```

The hostile metadata marker that must remain absent is:

```plaintext
__odwLintHostileMetadataWasEvaluated
```

When a shell fallback is needed outside the TypeScript resolver, choose the
relative path for the checkout layout explicitly. A normal checkout root uses
`../open-dynamic-workflows/`; a df12 worktree root under
`odw-lint.worktrees/<task>` uses `../../open-dynamic-workflows/`:

```bash
ODW_REFERENCE_CHECKOUT="${ODW_REFERENCE_CHECKOUT:-../open-dynamic-workflows/}"
```

## Interfaces and dependencies

No public package interface changes are expected.

The new implementation surface is test-only:

- `tests/static-analysis/fixtures/refresh-metadata.ts`
- `tests/static-analysis/fixture-metadata-refresh.test.ts`
- `Makefile` target `refresh-fixtures`

`tests/static-analysis/fixtures/refresh-metadata.ts` must export the report,
failure, count, option and span-anchor interfaces named in "Command and report
contract" and work item 1. It must also export `normalizeDirectoryUrl`,
`defaultOdwReferenceCheckout`, `resolveOdwReferenceCheckout`,
`deriveSha256`, `deriveAnchoredDiagnosticSpan`, and
`refreshFixtureMetadata`.

Use existing dependencies and runtime APIs only:

- Bun 1.3.11 or the repository-selected Bun runtime for executing TypeScript
  files and running tests.
- Node-compatible APIs from `node:buffer`, `node:crypto`, `node:fs`,
  `node:path` and `node:url`.
- Existing `odw-lint` source-span helpers:
  `createOriginalSourceFile`, `spanFromOffsets` and `snippetForSpan`.
- Existing fixture support helper `sha256`.
- Biome CLI only for explicit changed TypeScript path formatting after
  `make build`.

Do not add or use:

- ODW `loadWorkflowScript`
- ODW `createPrimitives`
- runtime `validate(source)`
- ODW runtime launcher, worker, scheduler or agent dispatch paths
- new parser, code-generation, CLI or schema dependencies

## Revision note

- 2026-06-29: Initial draft for roadmap task 1.3.5. The plan chooses a Bun
  TypeScript refresh script plus `make refresh-fixtures`, defines the
  deterministic span-anchor refresh algorithm, separates four independently
  committable work items, and records verified ODW, Bun, Biome and
  branch-local evidence. Work item implementation followed in later revisions.
- 2026-06-29: Planning round 2 revision after design review. The plan now
  defines the exact `FixtureRefreshReport` type, stdout/stderr and exit-code
  contract, deterministic temporary-checkout idempotence tests that do not
  require a sibling checkout during `make all`, normalized directory URL
  handling for `defaultOdwReferenceCheckout(repositoryRoot: URL)`, and
  path-safe formatter commands for optional generated files. Work item 1 has
  since implemented the import-safe helper slice.
