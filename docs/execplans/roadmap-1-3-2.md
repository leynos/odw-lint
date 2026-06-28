# Add invalid workflow fixture families

This ExecPlan (execution plan) is a living document. The sections `Constraints`,
`Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 1.3.2 adds deliberately invalid Open Dynamic Workflows (ODW)
fixture families for missing metadata, malformed metadata, unsupported imports
or exports, and syntax errors. After this work, maintainers can review one
committed invalid corpus that records expected rule identifiers, severities,
messages, source spans, and fixture hashes before the parser, rule engine, and
command-line interface are implemented.

Success is visible when `make all`, `make markdownlint`, and `make nixie` pass;
`tests/static-analysis/invalid-workflow-fixtures.test.ts` proves every
committed invalid fixture is present, sorted, hash-pinned, runtime-frozen,
usable as passive `WorkflowSource` text, and carries expected diagnostics whose
spans point into the original fixture source. The task does not implement
linting. It records the fixture contract that later roadmap tasks must satisfy.

Implementation must not begin until this draft is reviewed and approved.

## Constraints

- Run implementation commands only from
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-3-2`. Confirm with
  `git branch --show-current` before editing. Do not edit the root/control
  worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as the canonical integration branch.
- Use `grepai search` with `--workspace Projects`, `--project odw-lint`,
  `--toon`, and `--compact` as the primary intent search tool. The GrepAI index
  reflects canonical `main` only, so every branch-local fact must be rechecked
  with `leta`, exact text search, or file inspection inside this worktree.
- Use `leta` for branch-local TypeScript symbol navigation, references, call
  graphs, and refactoring. Use exact text search only for Markdown, JSON, raw
  fixture text, or other non-symbol literals.
- Use `sem` rather than raw Git history commands if history navigation or
  entity-level diff review is needed.
- Do not implement the parser, source masker, rule engine, reporter, command,
  configuration loader, loader-parity harness, or SWC adapter in this roadmap
  task. This task is a fixture-corpus task.
- Do not add `@swc/core` or any other new package dependency. Syntax-error
  fixtures record expected original-source spans for future parser work; they
  must not depend on a parser API in this slice.
- Do not execute untrusted workflow source. Tests for this task read fixture
  files as plain text only.
- Production code must not import ODW executable loader, primitive factory,
  runtime launcher, worker, run dispatch, or metadata-evaluating paths. This
  task should not change production `src/**` files at all.
- Keep the hostile-metadata side-effect fixture out of this task. Roadmap task
  1.3.4 owns hostile metadata. Keep decoy workflow syntax in comments, strings,
  regex literals, and template literals out of this task except where ordinary
  invalid fixtures need JavaScript strings. Roadmap task 1.3.3 owns masking
  fixtures.
- Raw invalid `.js` fixture files may intentionally contain ODW dialect syntax
  or JavaScript syntax errors. They must be excluded from Biome and Oxlint
  checks before they are added, and they must not be rewritten by formatters.
- Raw invalid `.js` fixture files for this 1.3.2 slice must be ASCII-only.
  Unicode source-span fixture coverage is deferred to roadmap tasks 1.2.2 and
  2.2.3, where line-index and parser-backed span helpers are implemented.
- Span assertions must use UTF-8 byte offsets, not JavaScript string slice
  indexes. The `SourceSpan.offset` contract in `docs/technical-design.md`
  section 8 is a byte contract, while JavaScript strings use UTF-16 code units.
- Keep validation path-safe. Prefer repository gates such as `make all`,
  `make markdownlint`, and `make nixie`. Any direct formatter or linter command
  must list only paths that definitely exist at that point in the work item.
- Format only changed files. For Markdown, run `mdtablefix` and
  `markdownlint-cli2 --fix` on the specific changed Markdown paths. For
  TypeScript and JSON configuration, run Biome only on the changed existing
  paths after `make build`. Do not run repository-global mutating formatters
  such as `make fmt`, `bun fmt`, or `mdformat-all`.
- Use en-GB Oxford spelling in prose and comments.
- Every work item must update this ExecPlan before its commit. At minimum,
  check off that item's `Progress` entry when the item is complete. Also update
  `Surprises & Discoveries`, `Decision Log`, `Risks`,
  `Outcomes & Retrospective`, and the revision note when the work item changes
  the plan's assumptions or records new evidence.
- Because every work item updates this ExecPlan, every work item has a Markdown
  change. Run file-scoped Markdown formatting on
  `docs/execplans/roadmap-1-3-2.md`, then run `make markdownlint` and
  `make nixie` before committing that item.
- Each work item below is independently committable. Gate and commit each item
  before starting the next one.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances (exception triggers)

- Scope: stop and escalate if implementation needs to change production
  `src/**` files. This task should touch only configuration, test fixtures,
  test helpers, tests, and documentation.
- File count: stop and escalate if the invalid corpus needs more than fourteen
  copied `.js` fixtures or more than eight non-fixture tracked files.
- Public API: stop and escalate if a public import from `odw-lint` must be
  renamed, removed, or moved to a package subpath.
- Rule identifiers: stop and escalate if a required expected diagnostic is not
  one of the documented rule identifiers already accepted by
  `tests/diagnostics/fixtures.ts`.
- Dependency: stop and escalate before adding any new package dependency,
  including parser, schema, property-test, or snapshot-helper packages.
- Runtime boundary: stop immediately if a test or production module would need
  to import `loadWorkflowScript`, `createPrimitives`, runtime
  `validate(source)`, ODW launcher paths, ODW worker paths, or any ODW path
  that evaluates metadata or dispatches agents.
- Fixture families: stop and revise this plan if implementation discovers that
  missing metadata, malformed metadata, unsupported import/export, or body
  syntax errors cannot be represented without overlapping roadmap task 1.3.3 or
  1.3.4.
- Tests: if a work item cannot pass `make all` after three focused fix attempts,
  record the failure and options in `Decision Log` before continuing.
- Formatting: if a formatter rewrites unrelated files, park that churn in a
  named discard stash using
  `df12-stash v1 task=1.3.2 kind=discard reason="<short>"`, then re-run only
  file-scoped formatting.

## Risks

- Risk: intentionally invalid JavaScript files can break Biome or Oxlint before
  the fixture corpus is complete. Severity: high. Likelihood: high. Mitigation:
  first add narrow `biome.jsonc` and `.oxlintrc.json` ignores for
  `tests/static-analysis/fixtures/invalid-workflows/**/*.js`, then add raw
  fixtures in later work items. Validate each step with `make all`.

- Risk: expected spans become decorative if tests only check hashes and rule
  identifiers. Severity: high. Likelihood: medium. Mitigation: the manifest
  records concrete `SourceSpan` objects. Tests recompute line and column
  positions from UTF-8 byte offsets, assert that offsets point to valid UTF-8
  boundaries inside the original source, and decode the byte range before
  comparing it with the fixture's reviewer-facing `spanText`.

- Risk: future parser diagnostics may initially report a different point for
  syntax errors than the fixture expectation. Severity: medium. Likelihood:
  medium. Mitigation: this task deliberately pins the user-facing
  original-source span contract with tests. Roadmap task 2.2.1 must map parser
  errors to this contract or explicitly revise the fixture expectations with
  evidence.

- Risk: fixture examples accidentally become broad rule-engine tests.
  Severity: medium. Likelihood: medium. Mitigation: every fixture has exactly
  the expected diagnostics for this slice. Avoid combining unrelated invalid
  conditions in one file unless a work item says that a multi-diagnostic case
  is intentional.

- Risk: a helper for spans or fixtures grows into a general parser substitute.
  Severity: medium. Likelihood: low. Mitigation: test helpers may compute
  positions from text and verify manifest values, but they must not scan for
  ODW semantics beyond unique span text assertions.

- Risk: this task drifts into hostile metadata.
  Severity: medium. Likelihood: medium. Mitigation: do not include metadata
  that writes files, reads environment variables, throws side-effect markers,
  or otherwise proves non-execution. Roadmap task 1.3.4 owns those fixtures.

## Progress

- [x] (2026-06-28T11:13Z) Confirmed this work is in branch `roadmap-1-3-2` at
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-3-2`.
- [x] (2026-06-28T11:13Z) Read `AGENTS.md`, `docs/roadmap.md`,
  `docs/technical-design.md`, `docs/terms-of-reference.md`, ADR 0001,
  `docs/developers-guide.md`, `docs/scripting-standards.md`,
  `docs/documentation-style-guide.md`, and the complexity guidance relevant to
  small fixture helpers.
- [x] (2026-06-28T11:13Z) Loaded the `execplans`, `leta`, `grepai`,
  `firecrawl-mcp`, `sem`, `biome-typescript`, `en-gb-oxendict-style`, and
  `odw-authoring` skills.
- [x] (2026-06-28T11:13Z) Used GrepAI intent searches against canonical `main`
  and branch-local `leta` inspection to verify the current static-analysis
  boundary, valid ODW example fixture manifest, diagnostic types, and rule
  identifier fixtures.
- [x] (2026-06-28T11:13Z) Researched sibling ODW loader and pure metadata
  behaviour in `/data/leynos/Projects/open-dynamic-workflows`.
- [x] (2026-06-28T11:13Z) Installed locked dependencies through `make build` and
  inspected installed Bun type declarations, Biome schema, and Oxlint schema.
- [x] (2026-06-28T11:13Z) Used Firecrawl to verify official Bun, Biome, and
  Oxlint documentation for the load-bearing test and ignore mechanisms.
- [x] (2026-06-28T11:32Z) Revised the plan after design review round 2 to
  replace the non-conformant computed-call metadata fixture with an ODW
  loader-compatible object-literal computed expression fixture.
- [x] (2026-06-28T11:32Z) Revised the span contract after design review round 2
  so tests use UTF-8 byte-aware span decoding and line/column recomputation,
  while 1.3.2 raw fixtures remain ASCII-only.
- [x] (2026-06-28T11:55Z) Work item 1: Prepared invalid fixture tooling and the
  shared manifest contract.
- [x] (2026-06-28T12:04Z) Work item 2: Added missing metadata invalid
  fixtures.
- [x] (2026-06-28T12:17Z) Work item 3: Added malformed metadata invalid
  fixtures.
- [x] (2026-06-28T12:26Z) Work item 4: Added unsupported import and export
  invalid fixtures.
- [x] (2026-06-28T12:40Z) Work item 5: Added body syntax-error invalid fixtures
  and the final manifest snapshot.
- [x] (2026-06-28T12:53Z) Work item 6: Documented invalid fixture maintenance
  and closed roadmap task 1.3.2.
- [x] (2026-06-28T12:29Z) Fix round 1: reconciled the branch with
  `origin/main`, restored the public source-position spine and completed 1.2.2
  documentation and validation assets, and verified that the remaining diff is
  limited to the 1.3.2 invalid fixture corpus, its focused tool ignores, and
  its documentation updates.
- [x] (2026-06-28T12:49Z) Fix round 1 validation: `make all`,
  `make markdownlint`, and `make nixie` passed after the merge and file-scoped
  Markdown cleanup. `coderabbit review --agent` initially returned a
  recoverable rate limit with a 12 minute 32 second wait; after waiting that
  full window, the retry completed with zero findings.
- [x] (2026-06-28T13:02Z) Fix round 2: deep-froze nested diagnostic
  `SourceSpan` coordinate objects, added runtime mutation assertions for both
  start and end offsets, and changed the compact manifest snapshot summary to
  use `spanTextLines` so multiline span text cannot introduce trailing
  whitespace in the committed snapshot.
- [x] (2026-06-28T13:12Z) Fix round 2 validation: focused invalid-fixture
  tests, `make all`, `make markdownlint`, and `make nixie` passed.
  `coderabbit review --agent` completed with zero findings.

## Surprises & discoveries

- Observation: the worktree initially had no `node_modules`, so locked package
  source files were unavailable. Evidence: direct checks for
  `node_modules/bun-types/test.d.ts`,
  `node_modules/@biomejs/biome/configuration_schema.json`, and
  `node_modules/oxlint/configuration_schema.json` reported missing files before
  `make build`. Impact: research and implementation commands that inspect
  locked package source must run `make build` first.

- Observation: GrepAI's canonical `main` index found prior roadmap and audit
  documentation for this concept, while branch-local source inspection showed
  no invalid fixture corpus exists yet. Evidence: GrepAI searches for invalid
  fixture families returned `docs/execplans/roadmap-1-2-3.md`,
  `docs/terms-of-reference.md`, and audit notes;
  `leta files tests/static-analysis` listed only the current `odw-examples`
  corpus. Impact: use GrepAI only as main-branch orientation and verify the new
  plan against branch-local files.

- Observation: `docs/users-guide.md` is not present.
  Evidence: `leta files docs` listed the documentation tree and no users guide
  was present. Impact: do not invent a users guide for this internal
  fixture-corpus task; update `docs/developers-guide.md` in the closure work
  item if maintenance guidance changes.

- Observation: ODW runtime metadata loading is intentionally executable, but
  ODW also has a pure-literal metadata checker for Claude compatibility.
  Evidence: sibling `src/loader.ts` `extractMeta` evaluates the sliced literal
  with `new Function`, while sibling `src/dual-compat.ts` `checkMeta` parses a
  pure-literal subset and reports impurity without executing body code. Impact:
  this task must record static fixture expectations only. It must not import or
  execute ODW runtime loader paths to populate the manifest.

- Observation: no SWC parser dependency is locked in this repository yet.
  Evidence: `package.json` and `bun.lock` do not contain `@swc/core`. Impact:
  syntax-error fixtures must pin the desired user-facing span contract without
  depending on current SWC error objects. Roadmap task 2.2.1 owns the parser
  adapter and any future SWC API research.

- Observation: a top-level `export const meta = buildMeta();` fixture is not a
  valid example of statically unprovable metadata for this corpus. Evidence:
  sibling ODW `extractMeta` searches for the first object-literal `{` after
  `export const meta =`; without one, it reports that it cannot find the meta
  object literal before any helper call could be evaluated. Impact: the warning
  fixture must keep `meta` as an object literal and put the computed expression
  inside a metadata property value.

- Observation: `SourceSpan.offset` is a UTF-8 byte offset, not a JavaScript
  string index. Evidence: `docs/technical-design.md` section 8 defines offsets
  as zero-based UTF-8 byte offsets and columns as Unicode code points. Impact:
  tests must use byte-aware decoding, and this task must not assert spans with
  `source.slice(start.offset, end.offset)`.

- Observation: CodeRabbit accepted work items 1 through 3, but the work item 4
  review hit a rate limit twice. Evidence: the first work item 4
  `coderabbit review --agent` response reported `waitTime` "3 minutes and 41
  seconds"; after waiting 240 seconds, the single retry reported `waitTime` "9
  minutes and 34 seconds". Impact: deterministic gates were green, so work item
  4 was committed with CodeRabbit review deferred for a later run.

- Observation: fix round 1 began from a stale branch that was eight commits
  ahead of and four commits behind `origin/main`. Evidence:
  `git rev-list --left-right --count HEAD...origin/main` returned `8 4`, and
  `leta grep` could not find `createOriginalSourceFile` before the merge
  because this branch had deleted the source-position module. Impact: merge
  `origin/main` before review completion so the branch preserves the accepted
  1.2.2 source-position spine, its `fast-check` property-test dependency, and
  the newer roadmap-workflow review-gate content.

- Observation: merging current `origin/main` introduced one extra blank line in
  both `docs/developers-guide.md` and `docs/roadmap.md`. Evidence:
  `make markdownlint` reported MD012 for those two files before the file-scoped
  Markdown fix. Impact: run `mdtablefix` and `markdownlint-cli2 --fix` on only
  those two touched Markdown files and rerun the deterministic gates.

- Observation: Bun serializes multiline string snapshot values in a shape that
  leaves trailing whitespace after the property key. Evidence:
  `git diff --check origin/main...HEAD` reported trailing whitespace on the
  `spanText` lines in
  `tests/static-analysis/__snapshots__/invalid-workflow-fixtures.test.ts.snap`.
  Impact: snapshot a line-array summary for reviewer-facing span text while
  keeping the manifest's actual `spanText` contract unchanged.

## Decision log

- Decision: store invalid fixtures under
  `tests/static-analysis/fixtures/invalid-workflows/`. Rationale: this keeps
  invalid source separate from the trusted ODW example snapshots under
  `tests/static-analysis/fixtures/odw-examples/` and lets tool ignores target
  only deliberately malformed source files. Date/Author: 2026-06-28, planning
  agent.

- Decision: represent invalid fixture expectations in a TypeScript manifest at
  `tests/static-analysis/fixtures/invalid-workflows.ts`. Rationale: the
  existing valid corpus uses a TypeScript manifest, and TypeScript keeps rule
  identifiers, severities, spans, file paths, fixture family labels, and
  runtime freezing type-checked without adding a JSON import or schema
  dependency. Date/Author: 2026-06-28, planning agent.

- Decision: add one focused test file,
  `tests/static-analysis/invalid-workflow-fixtures.test.ts`, for invalid corpus
  invariants. Rationale: the valid corpus already has
  `tests/static-analysis/odw-example-fixtures.test.ts`; a parallel invalid test
  file keeps fixture-corpus assertions discoverable and avoids mixing valid and
  invalid responsibilities. Date/Author: 2026-06-28, planning agent.

- Decision: manually pin expected spans in the manifest and verify them against
  fixture source text in tests. Rationale: this task does not have a parser or
  rule engine. Hard-coded manifest spans plus independent line/column
  recomputation are the smallest useful contract for later parser tasks.
  Date/Author: 2026-06-28, planning agent.

- Decision: use these initial fixture families and rule mappings:
  `missing-metadata` maps to `odw/meta-required`, `odw/meta-name`, and
  `odw/meta-description`; `malformed-metadata` maps to `odw/meta-object`,
  `odw/meta-statically-unprovable`, `odw/meta-name`, and `odw/meta-description`;
  `unsupported-import-export` maps to `odw/no-import-export`; `syntax-error`
  maps to `odw/body-syntax`. Rationale: these rule identifiers already appear in
  `tests/diagnostics/fixtures.ts` and in `docs/technical-design.md` section
  9.1. Date/Author: 2026-06-28, planning agent.

- Decision: do not include hostile metadata or masking decoys in this task.
  Rationale: roadmap task 1.3.3 owns masking fixtures, and roadmap task 1.3.4
  owns hostile metadata. Mixing them into 1.3.2 would make the fixture contract
  less atomic. Date/Author: 2026-06-28, planning agent.

- Decision: use a compact Bun snapshot only after all invalid families are
  present, and snapshot a reviewer-focused manifest summary rather than full
  fixture source bodies. Rationale: Bun's official snapshot guidance favours
  small, focused snapshots. Full source bodies are better protected by SHA-256
  hashes and span assertions. Date/Author: 2026-06-28, planning agent.

- Decision: replace `computed-meta-call.js` with `computed-meta-expression.js`.
  Rationale: ODW's real loader accepts object-literal metadata and evaluates
  the sliced object literal, but it does not accept a bare call expression after
  `export const meta =`. A fixture with
  `description: "Computed " + "description."` is ODW-runtime-valid and still
  statically unprovable without evaluating source. Date/Author: 2026-06-28,
  planning round 2 agent.

- Decision: keep 1.3.2 raw fixtures ASCII-only, but make the span test helper
  byte-aware and test that helper with an inline Unicode sample. Rationale: the
  invalid fixture families do not need Unicode to prove their dialect
  contracts, yet the helper must enforce the repository's UTF-8 byte-offset
  diagnostic contract before Unicode fixture coverage arrives in tasks 1.2.2
  and 2.2.3. Date/Author: 2026-06-28, planning round 2 agent.

- Decision: resolve fix round 1 by taking current `origin/main` for all
  source-position, 1.2.2 documentation, package dependency, lockfile, and
  roadmap-freshness content while preserving this branch's 1.3.2 invalid
  fixture additions. Rationale: the ExecPlan explicitly forbids production
  `src/**` changes and public API removals for this fixture-corpus task, so the
  rollback was out of scope and had to be removed before review completion.
  Date/Author: 2026-06-28, fix round 1 agent.

- Decision: freeze diagnostic spans by copying and freezing `span.start`,
  `span.end`, and the containing `span` object in the manifest builder.
  Rationale: the success criterion requires the invalid corpus to be
  runtime-frozen, and shallow-freezing the diagnostic object leaves nested
  coordinate objects mutable after import. Date/Author: 2026-06-28, fix round 2
  agent.

- Decision: snapshot `spanTextLines` instead of raw multiline `spanText`.
  Rationale: the manifest still records and validates exact span text, while
  the compact snapshot becomes whitespace-clean under `git diff --check` and
  remains easy for reviewers to inspect. Date/Author: 2026-06-28, fix round 2
  agent.

## Outcomes & retrospective

Roadmap task 1.3.2 is complete. The repository now has twelve deliberately
invalid ODW workflow fixtures across the required missing metadata, malformed
metadata, unsupported import/export, and syntax-error families. The manifest
records SHA-256 hashes, expected statuses, diagnostics, UTF-8 byte spans, and
span text for every fixture. The invalid fixture test suite verifies family
coverage, sorted paths, passive `WorkflowSource` shape, runtime freezing,
ASCII-only raw fixtures, hash pinning, byte-aware span integrity, rule/status
coverage, and a compact manifest snapshot.

The task did not change production `src/**` files and did not add dependencies.
CodeRabbit reviews passed for work items 1, 2, 3, and 5. Work item 4's review
was deferred after the required rate-limit wait and single retry; deterministic
gates were green and the deferral is recorded in `Surprises & Discoveries`. Fix
round 1 reconciled the branch with current `origin/main`, so accepted
source-position helpers, 1.2.2 validation assets, `fast-check`, and the
roadmap-workflow review-gate section remain intact.

Fix round 2 closed the blocking review findings by making diagnostic
`SourceSpan` objects and their nested coordinates immutable at runtime, adding
tests that mutation attempts for start and end offsets throw and leave values
unchanged, and replacing raw multiline `spanText` snapshot entries with
line-array summaries. The manifest's stored `spanText` values and source-span
validation contract remain unchanged.

Fix round 2 validation passed with the focused invalid-fixture test,
`make all`, `make markdownlint`, `make nixie`, and CodeRabbit review. The
working-tree whitespace check was clean after the snapshot projection changed;
the remaining `origin/main...HEAD` whitespace failure was the pre-commit branch
state and is expected to clear once this fix round is committed.

## Context and orientation

This repository is an ESM-first TypeScript package run with Bun. The current
production static-analysis boundary is passive: `src/static-analysis/types.ts`
exports `WorkflowSource`, static-analysis component labels, and stage labels,
but no parser or rules exist yet. The current valid fixture corpus lives under
`tests/static-analysis/fixtures/odw-examples/`, with its manifest in
`tests/static-analysis/fixtures/odw-examples.ts` and tests in
`tests/static-analysis/odw-example-fixtures.test.ts`.

Roadmap task 1.3.2 should add a parallel invalid corpus. The invalid source
files are not test code and are not examples to copy into real workflows. They
are static inputs that later parser and rule-engine work will use to prove
diagnostic behaviour. Tests in this task should read those files as strings and
verify their manifest expectations. They must not import or evaluate the files.

The target files for implementation are:

```plaintext
biome.jsonc
.oxlintrc.json
tests/static-analysis/fixtures/invalid-workflows.ts
tests/static-analysis/fixtures/invalid-workflows/**/*.js
tests/static-analysis/invalid-workflow-fixtures.test.ts
tests/static-analysis/__snapshots__/invalid-workflow-fixtures.test.ts.snap
docs/developers-guide.md
docs/roadmap.md
docs/execplans/roadmap-1-3-2.md
```

The snapshot file should be created only in work item 5, after the complete
invalid manifest exists.

The planned fixture files are:

```plaintext
tests/static-analysis/fixtures/invalid-workflows/missing-metadata/missing-meta.js
tests/static-analysis/fixtures/invalid-workflows/missing-metadata/missing-meta-name.js
tests/static-analysis/fixtures/invalid-workflows/missing-metadata/missing-meta-description.js
tests/static-analysis/fixtures/invalid-workflows/malformed-metadata/meta-not-object.js
tests/static-analysis/fixtures/invalid-workflows/malformed-metadata/computed-meta-expression.js
tests/static-analysis/fixtures/invalid-workflows/malformed-metadata/empty-meta-name.js
tests/static-analysis/fixtures/invalid-workflows/malformed-metadata/numeric-meta-description.js
tests/static-analysis/fixtures/invalid-workflows/malformed-metadata/unterminated-meta-object.js
tests/static-analysis/fixtures/invalid-workflows/unsupported-import-export/top-level-import.js
tests/static-analysis/fixtures/invalid-workflows/unsupported-import-export/extra-export-const.js
tests/static-analysis/fixtures/invalid-workflows/syntax-error/body-unclosed-call.js
tests/static-analysis/fixtures/invalid-workflows/syntax-error/body-unclosed-block.js
```

Use short fixture bodies. Each fixture should contain one invalid condition
unless the work item says otherwise. When a fixture has valid metadata, keep it
literal and simple:

```javascript
export const meta = {
  name: "fixture-name",
  description: "Fixture description.",
  phases: [{ title: "Run" }],
};
```

The expected span policy for this task is:

- `odw/meta-required`: zero-width span at the start of the file, offset 0,
  line 1, column 1.
- `odw/meta-name` for a missing `name` property: span covering the whole meta
  object literal.
- `odw/meta-description` for a missing `description` property: span covering
  the whole meta object literal.
- `odw/meta-object`: span covering the non-object metadata value, or from the
  opening meta object brace to end of file for an unterminated object literal.
- `odw/meta-statically-unprovable`: span covering the computed metadata
  expression inside an object-literal metadata value, for example
  `"Computed " + "description."`.
- `odw/meta-name` for an invalid present value: span covering the invalid
  `name` value.
- `odw/meta-description` for an invalid present value: span covering the invalid
  `description` value.
- `odw/no-import-export`: span covering the unsupported import or extra export
  declaration.
- `odw/body-syntax`: span covering the smallest reviewer-useful original-source
  region that explains the syntax error, such as the broken call expression or
  the unclosed block from its opening brace to end of file.

Every manifest diagnostic should include a `spanText` field. For zero-width
spans, `spanText` is the empty string. Tests must not use
`source.slice(span.start.offset, span.end.offset)` because `SourceSpan.offset`
is a zero-based UTF-8 byte offset and JavaScript string slicing uses UTF-16
code units. Instead, tests should convert the source to UTF-8 bytes with
`Buffer.from(sourceText, "utf8")`, decode
`bytes.subarray(span.start.offset, span.end.offset)` with a fatal
`TextDecoder`, compare that decoded value with `spanText`, and recompute the
recorded line and column values from byte prefixes decoded the same way. Work
item 1 must include an inline helper test with non-ASCII text to prove the byte
conversion, even though committed 1.3.2 raw fixture files remain ASCII-only.

## Research evidence for load-bearing APIs

This plan does not add dependencies. It relies on current repository docs,
installed locked packages, sibling ODW source, and official documentation.

ODW source-backed behaviour:

- Sibling `/data/leynos/Projects/open-dynamic-workflows/src/loader.ts` defines
  `loadWorkflowScript(source, filename)` around lines 78-120. It calls
  `extractMeta`, injects workflow globals, compiles body source with
  `AsyncFunction`, and returns `{ meta, run(...) }`.
- The same file defines `extractMeta` around lines 302-356. It scans masked
  source for `export const meta =`, requires a meta object literal, evaluates
  the literal with `new Function`, rejects any other top-level `export` or
  `import`, and strips only the `export` keyword from the body. A bare
  `export const meta = buildMeta();` therefore fails as "could not find the
  meta object literal" rather than exercising the documented statically
  unprovable metadata case.
- The same file defines `maskNonCode` around lines 370-456. It replaces
  comments, strings, template literals, and regex literals with spaces while
  preserving newlines, so scans see only code positions.
- The same file defines `assertMeta` around lines 456-467. It requires metadata
  to be an object, `meta.name` to be a non-empty string, and `meta.description`
  to be a string.
- Sibling `/data/leynos/Projects/open-dynamic-workflows/src/dual-compat.ts`
  defines `checkMeta(source)` around lines 35-59. It finds
  `export const meta =`, runs a recursive-descent pure-literal parser, and
  returns `{ found, pure, reason, name }` without executing the body. Its
  `LiteralParser` around lines 62-275 rejects variables, calls, spreads,
  template interpolation, operators, invalid object keys, invalid arrays, and
  unterminated strings as impure or malformed literal metadata.

Repository and locked package evidence:

- `package.json` declares the package as ESM and exposes the public package
  entry through `src/index.ts`. It declares `@biomejs/biome`, `bun-types`,
  `df12-lints`, `oxlint`, and `typescript` as development dependencies.
- `bun.lock` resolves `@biomejs/biome@2.5.1`, `bun-types@1.3.14`,
  `df12-lints` at Git commit `08ca59b`, `oxlint@1.71.0`, and `typescript@5.9.3`.
- `make build` installed those locked packages with Bun 1.3.11. The installed
  `node_modules/bun-types/test.d.ts` declares module `bun:test` at line 16,
  documents `bun test` at lines 1-14, and declares `toMatchSnapshot` overloads
  around lines 1450-1470.
- The installed Biome schema
  `node_modules/@biomejs/biome/configuration_schema.json` exposes top-level
  `files` and `overrides` properties around lines 23-60; override formatter and
  linter `enabled` properties around lines 7193-7272; and override `includes`,
  `formatter`, and `linter` around lines 7273-7335.
- The installed Oxlint schema
  `node_modules/oxlint/configuration_schema.json` exposes top-level
  `ignorePatterns` around lines 50-58 and `overrides` around lines 84-91.

Official documentation evidence gathered with Firecrawl:

- `https://bun.sh/docs/test/snapshots`, scrape id
  `019f0dff-25af-72eb-9231-a2c709d551a7`, status 200, documents
  `.toMatchSnapshot()`, generated `__snapshots__` files, the
  `bun test --update-snapshots` command, and best practices to keep snapshots
  small and focused.
- `https://biomejs.dev/reference/configuration/`, scrape id
  `019f0dfe-e6a5-7568-b235-2b89d3a4477f`, status 200, documents
  `files.includes`, negated include patterns, formatter and linter includes, and
  `overrides.<ITEM>.includes`, `overrides.<ITEM>.formatter`, and
  `overrides.<ITEM>.linter`.
- `https://oxc.rs/docs/guide/usage/linter/config.html`, scrape id
  `019f0dfe-fdc8-773c-a2ce-0806edce6b52`, status 200, documents
  `.oxlintrc.json`, automatic config lookup, `ignorePatterns`, and overrides.

No current work item relies on an SWC API. The technical design still selects
SWC for future parser work, but `@swc/core` is not locked in this repository
yet. The syntax-error fixture work item therefore records the expected
diagnostic contract without specifying parser adapter internals.

## Source documents to follow

Every work item must apply these project documents:

- `AGENTS.md`: code style, documentation maintenance, TypeScript guidance,
  testing expectations, formatter policy, and quality gates.
- `docs/terms-of-reference.md`: section 6 goals for missing or malformed
  metadata diagnostics, unsupported import/export diagnostics, source-span
  reporting, and alignment with ODW examples; section 8 success criteria for
  invalid fixtures, original-source spans, and no source execution; section 9
  constraints against executing workflow source.
- `docs/technical-design.md`: sections 5, 6.1, 6.2, 6.3, 6.4, 8, 9.1, 11.1,
  11.2, 11.3, 11.5, 12.1, 12.2, 13, and 15.
- `docs/adr/0001-static-analysis-boundary.md`: accepted decision forbidding
  production imports of executable ODW runtime paths and requiring parity to be
  maintained by fixtures and drift tests.
- `docs/developers-guide.md`: Static-Analysis Boundary, Commit Gate, Bun
  Scripts, Formatting, Linting, Type Checking, Tests, Workflow Fixture Corpus,
  Markdown, and Documentation Upkeep sections.
- `docs/scripting-standards.md`: only if implementation unexpectedly adds an
  automation script. This plan does not require a script.
- `docs/complexity-antipatterns-and-refactoring-strategies.md`: sections 2 and
  3, especially the guidance on keeping control flow understandable and
  avoiding "Bumpy Road" helper functions.
- `docs/documentation-style-guide.md`: spelling, punctuation, headings,
  Markdown rules, formatting, and document-type guidance.
- `docs/roadmap.md`: task 1.3.2 under "Establish the workflow fixture corpus",
  and later tasks 1.3.3, 1.3.4, 2.1.2, 2.1.3, 2.2.1, and 2.3.1 to avoid
  stealing their scope.

## Skills to load during execution

The implementing agent must load these skills before editing:

- `execplans`: maintain this living plan while work proceeds.
- `grepai`: use canonical-main semantic search before branch-local
  verification, following the project search rules.
- `leta`: use for branch-local TypeScript symbol navigation and verification.
- `sem`: use for semantic diffs or history navigation if needed.
- `biome-typescript`: use for Biome configuration, TypeScript formatting, and
  linting decisions. No general TypeScript router skill is installed in this
  session.
- `en-gb-oxendict-style`: use for prose and comments.
- `odw-authoring`: use for ODW workflow-dialect fixture source conventions and
  to avoid accidentally writing real executable workflow examples in invalid
  fixtures.
- `firecrawl-mcp`: use if official documentation needs refreshing beyond the
  URLs already researched in this plan.

Hypothesis, CrossHair, and mutmut are Python verification tools and are not
applicable to this TypeScript fixture-corpus task. Rust router skills are not
applicable because no Rust code is touched.

## Plan of work

### Work item 1: Prepare invalid fixture tooling and the shared manifest contract

This work item makes the repository gates compatible with deliberately invalid
raw `.js` fixtures and adds the empty, typed manifest shape that later family
work items fill in.

Documentation implemented:

- `AGENTS.md` "Change Quality & Committing", "Linting & Formatting",
  "TypeScript Guidance", and "Testing".
- `docs/technical-design.md` sections 5, 8, 11.1, 11.3, 11.5, and 12.1.
- `docs/adr/0001-static-analysis-boundary.md` "Decision" and "Consequences".
- `docs/developers-guide.md` "Static-Analysis Boundary", "Formatting",
  "Linting", "Tests", and "Workflow Fixture Corpus".
- `docs/documentation-style-guide.md` "Markdown rules" and "Formatting".

Skills to load:

- `execplans`.
- `grepai`.
- `leta`.
- `biome-typescript`.
- `en-gb-oxendict-style`.
- `odw-authoring`.

Edits:

- Update `biome.jsonc` so `files.includes` excludes
  `!tests/static-analysis/fixtures/invalid-workflows/**/*.js`. Add a matching
  override that disables formatter and linter for
  `tests/static-analysis/fixtures/invalid-workflows/**/*.js`.
- Update `.oxlintrc.json` so `ignorePatterns` includes
  `tests/static-analysis/fixtures/invalid-workflows/**/*.js`, preserving the
  existing ODW example ignore.
- Add `tests/static-analysis/fixtures/invalid-workflows.ts`.
- In that manifest file, define:
  - `InvalidWorkflowFixtureFamily` with values `missing-metadata`,
    `malformed-metadata`, `unsupported-import-export`, and `syntax-error`.
  - `InvalidWorkflowFixtureStatus` with values `error` and `warning`.
  - `InvalidWorkflowFixtureDiagnostic` with `rule`, `severity`, `message`,
    `span`, and `spanText`.
  - `InvalidWorkflowFixtureSnapshot` with `family`, `fileName`, `fixturePath`,
    `sha256`, `expectedStatus`, and `expectedDiagnostics`.
  - `INVALID_WORKFLOW_FIXTURE_SNAPSHOTS`, initially an empty frozen array.
- Add `tests/static-analysis/invalid-workflow-fixtures.test.ts` with helper
  functions for reading fixture source, hashing source text, proving committed
  raw fixtures are ASCII-only, recomputing line/column positions from UTF-8
  byte offsets, and asserting that every diagnostic span is inside the source
  and matches its `spanText` after byte-range decoding.
- In this first work item, the tests should assert the empty manifest is frozen
  and that helper functions behave on small inline ASCII and Unicode strings.
  Later work items replace the empty-manifest assertion with complete-family
  assertions.

Tests to add or update:

- Unit tests: add tests for the empty invalid manifest, runtime freezing, and
  span helper behaviour on inline sample text, including one non-ASCII sample
  that demonstrates UTF-8 byte offsets differ from JavaScript UTF-16 indexes.
- Behavioural tests: none.
- Property tests: none. The finite helper cases are clearer as table-driven
  unit tests.
- Snapshot tests: none in this work item.
- End-to-end tests: `make all` validates build, formatting, linting, type
  checking, and the Bun test suite.

Validation commands:

```bash
make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-3-2.out
./node_modules/.bin/biome format --write \
  biome.jsonc \
  .oxlintrc.json \
  tests/static-analysis/fixtures/invalid-workflows.ts \
  tests/static-analysis/invalid-workflow-fixtures.test.ts
mdtablefix --in-place --wrap docs/execplans/roadmap-1-3-2.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-3-2.md
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-2.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-3-2.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-3-2.out
```

Commit only if all gates exit 0.

### Work item 2: Add missing metadata invalid fixtures

This work item adds the fixture family for metadata that is absent or missing
required fields.

Documentation implemented:

- `docs/terms-of-reference.md` section 6 goal to report missing workflow
  metadata, and section 8 success criteria for no `export const meta` and
  stable source spans.
- `docs/technical-design.md` sections 8, 9.1, 11.1, and 11.5.
- `docs/adr/0001-static-analysis-boundary.md` "Decision", because expected
  metadata errors must be recorded without calling executable ODW runtime paths.
- `docs/developers-guide.md` "Tests" and "Workflow Fixture Corpus".

Skills to load:

- `execplans`.
- `grepai`.
- `leta`.
- `biome-typescript`.
- `en-gb-oxendict-style`.
- `odw-authoring`.

Edits:

- Add
  `tests/static-analysis/fixtures/invalid-workflows/missing-metadata/missing-meta.js`.
  It should contain a short ODW-like body with no real `export const meta`.
  Expected diagnostic: `odw/meta-required`, severity `error`, zero-width
  `spanText` at file start.
- Add
  `tests/static-analysis/fixtures/invalid-workflows/missing-metadata/missing-meta-name.js`.
  It should contain literal metadata with `description` and `phases`, but no
  `name`. Expected diagnostic: `odw/meta-name`, severity `error`, span covering
  the whole meta object literal.
- Add
  `tests/static-analysis/fixtures/invalid-workflows/missing-metadata/missing-meta-description.js`.
  It should contain literal metadata with `name` and `phases`, but no
  `description`. Expected diagnostic: `odw/meta-description`, severity `error`,
  span covering the whole meta object literal.
- Update `tests/static-analysis/fixtures/invalid-workflows.ts` with manifest
  entries for those three files. Keep entries sorted by `family` and then
  `fileName`. Compute SHA-256 hashes from the committed fixture source.
- Update `tests/static-analysis/invalid-workflow-fixtures.test.ts` so it asserts
  the copied file list, family list, rule identifiers, hashes, `WorkflowSource`
  shape, runtime freezing, and span assertions for this family.
- Update this ExecPlan `Progress` before committing.

Tests to add or update:

- Unit tests: update invalid fixture manifest tests for file presence, sorted
  order, unique names, family coverage for `missing-metadata`, hash pinning,
  expected statuses, expected rule identifiers, and source-span integrity.
- Behavioural tests: none. There is no CLI or linter behaviour yet.
- Property tests: none. This is a finite fixture manifest.
- Snapshot tests: none in this work item.
- End-to-end tests: `make all`.

Validation commands:

```bash
make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-3-2.out
./node_modules/.bin/biome format --write \
  tests/static-analysis/fixtures/invalid-workflows.ts \
  tests/static-analysis/invalid-workflow-fixtures.test.ts
mdtablefix --in-place --wrap docs/execplans/roadmap-1-3-2.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-3-2.md
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-2.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-3-2.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-3-2.out
```

Commit only if all gates exit 0.

### Work item 3: Add malformed metadata invalid fixtures

This work item adds metadata fixtures where a `meta` declaration exists but the
static contract is malformed, incomplete, or not safely provable.

Documentation implemented:

- `docs/terms-of-reference.md` section 6 goal to report malformed workflow
  metadata and preserve ODW-vs-Claude compatibility distinctions.
- `docs/technical-design.md` sections 6.3, 8, 9.1, 11.1, and 11.5.
- `docs/adr/0001-static-analysis-boundary.md` "Decision" and "Consequences".
- `docs/developers-guide.md` "Tests" and "Workflow Fixture Corpus".
- Sibling ODW source evidence for `assertMeta` and `checkMeta`, recorded in this
  plan's research section.

Skills to load:

- `execplans`.
- `grepai`.
- `leta`.
- `biome-typescript`.
- `en-gb-oxendict-style`.
- `odw-authoring`.

Edits:

- Add
  `tests/static-analysis/fixtures/invalid-workflows/malformed-metadata/meta-not-object.js`.
  Use `export const meta = "not an object";`. Expected diagnostic:
  `odw/meta-object`, severity `error`, span covering `"not an object"`.
- Add
  `tests/static-analysis/fixtures/invalid-workflows/malformed-metadata/computed-meta-expression.js`.
  Use an object-literal metadata declaration whose `description` value is the
  harmless computed expression `"Computed " + "description."`, with no helper
  declaration. ODW's loader can slice and evaluate that object literal, but
  `odw-lint` must not evaluate it. Expected diagnostic:
  `odw/meta-statically-unprovable`, severity `warning`, span covering
  `"Computed " + "description."`. This fixture's `expectedStatus` is `warning`.
- Add
  `tests/static-analysis/fixtures/invalid-workflows/malformed-metadata/empty-meta-name.js`.
  Use literal metadata with `name: ""`. Expected diagnostic: `odw/meta-name`,
  severity `error`, span covering `""`.
- Add
  `tests/static-analysis/fixtures/invalid-workflows/malformed-metadata/numeric-meta-description.js`.
  Use literal metadata with `description: 123`. Expected diagnostic:
  `odw/meta-description`, severity `error`, span covering `123`.
- Add
  `tests/static-analysis/fixtures/invalid-workflows/malformed-metadata/unterminated-meta-object.js`.
  Start a metadata object literal and omit its closing brace. Expected
  diagnostic: `odw/meta-object`, severity `error`, span from the opening meta
  object brace to end of file.
- Update `tests/static-analysis/fixtures/invalid-workflows.ts` with sorted
  manifest entries and SHA-256 hashes for all five malformed metadata fixtures.
- Update `tests/static-analysis/invalid-workflow-fixtures.test.ts` so it asserts
  the new family, rule mix, warning status for `computed-meta-expression.js`,
  and span integrity for each malformed metadata diagnostic.
- Update this ExecPlan `Progress` before committing.

Tests to add or update:

- Unit tests: update invalid fixture manifest tests for the malformed metadata
  family, including one ODW-runtime-valid but statically unprovable warning
  fixture and four error fixtures.
- Behavioural tests: none.
- Property tests: none.
- Snapshot tests: none in this work item.
- End-to-end tests: `make all`.

Validation commands:

```bash
make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-3-2.out
./node_modules/.bin/biome format --write \
  tests/static-analysis/fixtures/invalid-workflows.ts \
  tests/static-analysis/invalid-workflow-fixtures.test.ts
mdtablefix --in-place --wrap docs/execplans/roadmap-1-3-2.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-3-2.md
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-2.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-3-2.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-3-2.out
```

Commit only if all gates exit 0.

### Work item 4: Add unsupported import and export invalid fixtures

This work item adds body-envelope fixtures for unsupported top-level imports
and extra exports.

Documentation implemented:

- `docs/terms-of-reference.md` sections 2, 6, and 8, especially unsupported
  imports or exports tied to original source spans.
- `docs/technical-design.md` sections 6.1, 6.2, 8, 9.1, 11.1, and 11.5.
- `docs/adr/0001-static-analysis-boundary.md` "Decision" and "Consequences".
- `docs/developers-guide.md` "Static-Analysis Boundary", "Tests", and
  "Workflow Fixture Corpus".
- `odw-authoring` "Script Contract", which says ODW primitives are injected and
  ordinary workflows must not import primitives or add extra top-level exports.

Skills to load:

- `execplans`.
- `grepai`.
- `leta`.
- `biome-typescript`.
- `en-gb-oxendict-style`.
- `odw-authoring`.

Edits:

- Add
  `tests/static-analysis/fixtures/invalid-workflows/unsupported-import-export/top-level-import.js`.
  Include a valid literal `meta` declaration and an unsupported top-level
  `import`. Expected diagnostic: `odw/no-import-export`, severity `error`, span
  covering the import declaration.
- Add
  `tests/static-analysis/fixtures/invalid-workflows/unsupported-import-export/extra-export-const.js`.
  Include valid literal metadata and an extra top-level `export const helper`.
  Expected diagnostic: `odw/no-import-export`, severity `error`, span covering
  the extra export declaration.
- Update `tests/static-analysis/fixtures/invalid-workflows.ts` with sorted
  manifest entries and SHA-256 hashes for both fixtures.
- Update `tests/static-analysis/invalid-workflow-fixtures.test.ts` so it asserts
  the new `unsupported-import-export` family, both import and export coverage,
  and span integrity for `odw/no-import-export`.
- Update this ExecPlan `Progress` before committing.

Tests to add or update:

- Unit tests: update invalid fixture manifest tests for unsupported import and
  export coverage, expected rule identifiers, hashes, and spans.
- Behavioural tests: none.
- Property tests: none.
- Snapshot tests: none in this work item.
- End-to-end tests: `make all`.

Validation commands:

```bash
make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-3-2.out
./node_modules/.bin/biome format --write \
  tests/static-analysis/fixtures/invalid-workflows.ts \
  tests/static-analysis/invalid-workflow-fixtures.test.ts
mdtablefix --in-place --wrap docs/execplans/roadmap-1-3-2.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-3-2.md
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-2.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-3-2.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-3-2.out
```

Commit only if all gates exit 0.

### Work item 5: Add body syntax-error invalid fixtures and the final manifest snapshot

This work item adds fixtures where metadata and envelope shape are otherwise
valid, but the body is syntactically invalid after ODW normalization. It also
adds the compact snapshot for the completed invalid manifest.

Documentation implemented:

- `docs/terms-of-reference.md` sections 6 and 8, especially syntax, source
  spans, invalid fixtures, and no source execution.
- `docs/technical-design.md` sections 6.1, 8, 9.1, 11.1, 11.5, and 12.2.
- `docs/developers-guide.md` "Tests" and "Workflow Fixture Corpus".
- Official Bun snapshot documentation recorded in this plan's research section.

Skills to load:

- `execplans`.
- `grepai`.
- `leta`.
- `biome-typescript`.
- `en-gb-oxendict-style`.
- `odw-authoring`.

Edits:

- Add
  `tests/static-analysis/fixtures/invalid-workflows/syntax-error/body-unclosed-call.js`.
  Include valid literal metadata and a body statement such as an unclosed
  `agent("draft"` call. Expected diagnostic: `odw/body-syntax`, severity
  `error`, span covering the broken call expression.
- Add
  `tests/static-analysis/fixtures/invalid-workflows/syntax-error/body-unclosed-block.js`.
  Include valid literal metadata and an unclosed body block. Expected
  diagnostic: `odw/body-syntax`, severity `error`, span from the opening body
  block brace to end of file.
- Update `tests/static-analysis/fixtures/invalid-workflows.ts` with sorted
  manifest entries and SHA-256 hashes for both syntax-error fixtures.
- Update `tests/static-analysis/invalid-workflow-fixtures.test.ts` so it asserts
  the new `syntax-error` family, complete family coverage, complete fixture
  count, complete rule coverage for roadmap task 1.3.2, hash pinning,
  `WorkflowSource` text shape, runtime freezing, and span integrity.
- Add a compact Bun snapshot over a stable projection of the complete manifest:
  `family`, `fileName`, expected status, diagnostic rules, severities, and
  `spanText`. Do not snapshot full fixture source text.
- Update this ExecPlan `Progress` before committing.

Tests to add or update:

- Unit tests: update invalid fixture manifest tests for the syntax-error family,
  complete family coverage, complete rule coverage, hashes, statuses, and spans.
- Behavioural tests: none.
- Property tests: none.
- Snapshot tests: add a Bun snapshot of the compact manifest summary in
  `tests/static-analysis/__snapshots__/invalid-workflow-fixtures.test.ts.snap`.
- End-to-end tests: `make all`.

Validation commands:

```bash
make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-3-2.out
./node_modules/.bin/biome format --write \
  tests/static-analysis/fixtures/invalid-workflows.ts \
  tests/static-analysis/invalid-workflow-fixtures.test.ts
bun test ./tests/static-analysis/invalid-workflow-fixtures.test.ts \
  --update-snapshots 2>&1 | tee /tmp/snapshots-odw-lint-roadmap-1-3-2.out
mdtablefix --in-place --wrap docs/execplans/roadmap-1-3-2.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-3-2.md
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-2.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-3-2.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-3-2.out
```

Commit only if all gates exit 0.

### Work item 6: Document invalid fixture maintenance and close roadmap task 1.3.2

This work item records how to maintain the invalid corpus and marks the roadmap
task complete after all fixture families and tests are in place.

Documentation implemented:

- `AGENTS.md` "Documentation Maintenance" and "Change Quality & Committing".
- `docs/technical-design.md` sections 11.1, 11.5, 12.1, 12.2, and 15.
- `docs/developers-guide.md` "Workflow Fixture Corpus" and "Documentation
  Upkeep".
- `docs/documentation-style-guide.md` spelling, Markdown rules, and formatting.
- `docs/roadmap.md` task 1.3.2.

Skills to load:

- `execplans`.
- `grepai`.
- `leta`.
- `en-gb-oxendict-style`.
- `odw-authoring`.

Edits:

- Update `docs/developers-guide.md` "Workflow Fixture Corpus" to explain that
  invalid workflow fixtures live under
  `tests/static-analysis/fixtures/invalid-workflows/`, are intentionally raw,
  must not be executed, must not be formatted as ordinary JavaScript, and must
  be kept in sync with `tests/static-analysis/fixtures/invalid-workflows.ts`.
- Update `docs/roadmap.md` task 1.3.2 from unchecked to checked.
- Update this ExecPlan: set `Status: COMPLETE`, check off work item 6 in
  `Progress`, record implementation outcomes in `Outcomes & Retrospective`, and
  append a revision note.

Tests to add or update:

- Unit tests: none in this work item.
- Behavioural tests: none.
- Property tests: none.
- Snapshot tests: none.
- End-to-end tests: `make all` plus Markdown gates because Markdown changes.

Validation commands:

```bash
mdtablefix --in-place --wrap docs/execplans/roadmap-1-3-2.md docs/developers-guide.md docs/roadmap.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-3-2.md docs/developers-guide.md docs/roadmap.md
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-2.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-3-2.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-3-2.out
```

Commit only if all gates exit 0.

## Concrete steps

Use these steps for the first implementation pass:

1. Confirm the worktree and branch.

   ```bash
   cd /data/leynos/Projects/odw-lint.worktrees/roadmap-1-3-2
   git branch --show-current
   ```

   Expected output:

   ```plaintext
   roadmap-1-3-2
   ```

2. Load the required skills named in "Skills to load during execution".

3. Run one GrepAI intent search before source edits, then verify branch-local
   facts with `leta`.

   ```bash
   grepai search --workspace Projects --project odw-lint \
     "invalid workflow fixture diagnostics manifest spans" --toon --compact
   leta files tests/static-analysis
   leta show WorkflowSource -n 8
   ```

4. Implement one work item at a time. Update this ExecPlan before each commit.
   Do not start the next work item until the current work item has passed its
   gates and been committed.

5. Use the validation commands listed in each work item. Keep logs under
   `/tmp` with the `roadmap-1-3-2` branch suffix.

6. Before each commit, review changed entities with `sem diff` and review the
   ordinary patch only when line-level detail is necessary.

   ```bash
   sem diff
   git status --short
   ```

7. Commit each completed, gated work item with an imperative subject and a body
   explaining what changed and why.

## Validation and acceptance

The complete task is accepted when:

- `tests/static-analysis/fixtures/invalid-workflows/` contains exactly the four
  required invalid families: `missing-metadata`, `malformed-metadata`,
  `unsupported-import-export`, and `syntax-error`.
- Each invalid fixture has one or more manifest diagnostics with a documented
  rule identifier from `docs/technical-design.md` section 9.1 and
  `tests/diagnostics/fixtures.ts`.
- Every expected diagnostic has a `SourceSpan` in original source coordinates,
  and a `spanText` checked against the committed fixture source by decoding the
  UTF-8 byte range named by the span.
- The invalid fixture tests prove sorted file order, unique file names, unique
  fixture paths, SHA-256 hashes, expected statuses, expected rule identifiers,
  span integrity, runtime freezing, and passive `WorkflowSource` shape.
- Raw invalid `.js` fixtures are not formatted, linted, imported, or executed.
- The complete manifest summary snapshot is focused and reviewer-useful.
- `docs/developers-guide.md` documents invalid fixture maintenance.
- `docs/roadmap.md` marks task 1.3.2 complete.
- These commands pass from the worktree root:

  ```bash
  make all
  make markdownlint
  make nixie
  ```

## Idempotence and recovery

Fixture files and manifest entries are ordinary tracked files. Re-running tests
is safe. Re-running `make build` is safe; it refreshes `node_modules` from the
locked dependency set.

Do not re-run `bun test --update-snapshots` unless the manifest summary
snapshot intentionally changed. When a snapshot changes, inspect the diff
before committing and confirm it reflects intended fixture additions, not
accidental span or rule churn.

If a formatter touches unrelated files, do not keep the churn. Park it in a
named discard stash:

```bash
git stash push -m 'df12-stash v1 task=1.3.2 kind=discard reason="formatter-churn"'
```

Then re-apply only the intended changes if necessary and rerun file-scoped
formatting commands.

If a fixture hash test fails, do not update the hash blindly. First inspect the
fixture source. If the source changed intentionally, update the manifest hash
in the same work item. If the source changed accidentally, restore the intended
fixture text by editing that fixture directly.

If span tests fail, prefer fixing the manifest span or the fixture text so the
span still points at the smallest reviewer-useful region. Do not weaken the
span assertion to make tests pass.

## Artifacts and notes

Important command logs for this plan should use these paths:

```plaintext
/tmp/build-odw-lint-roadmap-1-3-2.out
/tmp/all-odw-lint-roadmap-1-3-2.out
/tmp/markdownlint-odw-lint-roadmap-1-3-2.out
/tmp/nixie-odw-lint-roadmap-1-3-2.out
/tmp/snapshots-odw-lint-roadmap-1-3-2.out
```

The completed invalid corpus should include twelve raw `.js` fixtures:

```plaintext
3 missing metadata fixtures
5 malformed metadata fixtures
2 unsupported import/export fixtures
2 syntax-error fixtures
```

The `computed-meta-expression.js` fixture is intentionally a warning-only
invalid static-contract fixture. Its purpose is to preserve the technical
design's distinction between "ODW runtime accepts this object-literal metadata"
and "`odw-lint` cannot prove it safely without source evaluation".

## Interfaces and dependencies

No production interface changes are expected.

The test-only invalid manifest should expose these names from
`tests/static-analysis/fixtures/invalid-workflows.ts`:

```typescript
export type InvalidWorkflowFixtureFamily =
  | "missing-metadata"
  | "malformed-metadata"
  | "unsupported-import-export"
  | "syntax-error";

export type InvalidWorkflowFixtureStatus = "error" | "warning";

export interface InvalidWorkflowFixtureDiagnostic {
  readonly rule: RuleId;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly span: SourceSpan;
  readonly spanText: string;
}

export interface InvalidWorkflowFixtureSnapshot {
  readonly family: InvalidWorkflowFixtureFamily;
  readonly fileName: string;
  readonly fixturePath: string;
  readonly sha256: string;
  readonly expectedStatus: InvalidWorkflowFixtureStatus;
  readonly expectedDiagnostics: readonly InvalidWorkflowFixtureDiagnostic[];
}

export const INVALID_WORKFLOW_FIXTURE_SNAPSHOTS: readonly InvalidWorkflowFixtureSnapshot[];
```

Use `RuleId`, `DiagnosticSeverity`, and `SourceSpan` from the public `odw-lint`
package entry. Use `makeRuleId` when constructing manifest entries so invalid
or misspelled rule identifiers fail early.

The test helper in `tests/static-analysis/invalid-workflow-fixtures.test.ts`
should use standard Bun and Node-compatible APIs already used in the repository:

- `describe`, `expect`, and `it` from `bun:test`.
- `Buffer` from `node:buffer`.
- `createHash` from `node:crypto`.
- `existsSync`, `readdirSync`, and `readFileSync` from `node:fs`.
- `TextDecoder` from `node:util`, configured with `{ fatal: true }` for span
  decoding.
- `WorkflowSource` from `odw-lint` for passive source-shape assertions.

No new package dependency is permitted for this task.

## Revision note

- 2026-06-28: Initial draft for roadmap task 1.3.2. It defines the invalid
  fixture families, manifest shape, tests, validation commands, research
  evidence, and six independently committable work items. Implementation has
  not begun.
- 2026-06-28: Round 2 revision resolves design-review blockers by replacing the
  non-conformant computed-call fixture with an object-literal computed
  expression fixture and by requiring UTF-8 byte-aware span assertions rather
  than JavaScript string slicing. Implementation has not begun.
- 2026-06-28: Implementation completed the twelve-fixture invalid corpus,
  compact manifest snapshot, maintenance documentation, and roadmap closure.
- 2026-06-28: Fix round 1 restored the branch to current `origin/main` for the
  source-position spine, 1.2.2 documentation and tests, dependency lock state,
  and roadmap-freshness guidance while keeping the 1.3.2 fixture-corpus work.
- 2026-06-28: Fix round 2 deep-froze nested diagnostic span coordinates,
  changed the compact manifest snapshot projection to line arrays, and recorded
  green deterministic gates plus a zero-finding CodeRabbit review.
