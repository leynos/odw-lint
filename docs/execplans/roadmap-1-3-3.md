# Add masking fixtures for inert workflow syntax

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 1.3.3 adds fixture data for ODW workflow source that contains
decoy workflow syntax in places the future envelope scanner must ignore:
comments, ordinary strings, regular expression literals, and template literals.
The goal is not to implement the scanner in this task. The goal is to give
roadmap task 2.1.1 a committed, source-backed fixture corpus that says which
inputs must produce no envelope diagnostics when the source masker lands.

Success is visible when the repository contains a dedicated masking fixture
family under `tests/static-analysis/fixtures/`, Bun tests prove each fixture is
passive source text with empty expected envelope diagnostics, and `make all`
passes. When Markdown is changed, `make markdownlint` and `make nixie` must
also pass. Implementation must not begin until this draft is reviewed and
approved.

## Constraints

- Work only in the git-donkey worktree for branch `roadmap-1-3-3`:
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-3-3`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Use `grepai search --workspace Projects --project odw-lint "<English intent
  query>" --toon --compact` as the primary intent-search tool. Treat GrepAI
  results as canonical `main` evidence only. Recheck branch-local facts with
  `leta`, exact text search, or direct file inspection inside this worktree.
- Use `leta` for branch-local symbol navigation, references, call graphs, and
  TypeScript code verification. Exact text search is acceptable for Markdown,
  JSON, lockfile entries, and literal strings that are not code symbols.
- Use `sem` rather than raw `git log` or `git blame` if codebase history is
  needed. This plan does not currently require history navigation.
- Read and obey `AGENTS.md`, `docs/terms-of-reference.md`,
  `docs/technical-design.md`, `docs/adr/0001-static-analysis-boundary.md`,
  `docs/developers-guide.md`, `docs/scripting-standards.md`,
  `docs/complexity-antipatterns-and-refactoring-strategies.md`,
  `docs/documentation-style-guide.md`, and `docs/roadmap.md` before
  implementation. No `docs/users-guide.md` is present in this worktree.
- Use en-GB Oxford spelling in prose and comments.
- Do not execute workflow source. This task may add passive source fixtures and
  tests that read files as strings, but it must not call ODW runtime loader,
  primitive factory, runtime launcher, worker, agent dispatch, or any path that
  evaluates metadata or compiles workflow bodies.
- Do not add external dependencies. The task can use Bun, TypeScript, Biome,
  Oxlint, Node built-ins, and existing source helpers already present in this
  repository.
- Do not implement the source masker, envelope scanner, metadata parser, SWC
  parser adapter, CLI, or rule engine. Roadmap task 2.1.1 owns the masker, and
  later 2.x tasks own parser-backed diagnostics.
- Every synthetic JavaScript masking fixture added by this task must stay
  inside the normal repository Biome and Oxlint coverage. Do not broaden
  `biome.jsonc` or `.oxlintrc.json` ignores. Each `.js` fixture must start
  with a module-level `/** @file ... */` JSDoc block before any code, because
  `.oxlintrc.json` enables `df12/require-module-jsdoc` for all linted JS/TS
  files outside `tests/static-analysis/fixtures/odw-examples/**/*.js`.
- Keep each work item independently committable and gate-passable. Commit after
  each completed work item, and run that work item's stated gates before the
  commit.
- Format only changed files. Do not run repository-global mutating formatters
  such as `make fmt` or `bun fmt`.
- Keep validation path-safe. Prefer repository gates (`make all`,
  `make markdownlint`, `make nixie`). Any direct formatter command must list
  only paths that exist at that point in the work item and that the work item
  edits.
- Run long validation commands through `tee` into `/tmp`, for example
  `/tmp/all-odw-lint-roadmap-1-3-3.out`.

## Tolerances (exception triggers)

- Scope: stop and escalate if implementation requires production `src/`
  changes beyond imports needed to expose already-existing static-analysis
  types. The expected path is test fixtures and tests only, plus roadmap or
  developer documentation when closing the task.
- Interface: stop and escalate if a public package API signature or
  `package.json` export must change.
- Dependency: stop and escalate before adding or updating any package
  dependency.
- Scanner implementation: stop and escalate if a gate can pass only by adding
  masking or envelope-scanner production code. This roadmap slice is fixture
  preparation only.
- Fixture shape: stop and escalate if any planned `.js` fixture cannot remain
  valid JavaScript for the existing Biome/Oxlint gates, including
  module-level `@file` JSDoc, without broad ignore changes. Do not add a new
  ignore path merely to avoid writing parseable decoy fixtures.
- File count: stop and escalate if the fixture work needs more than ten
  tracked files before documentation updates.
- Gate attempts: stop and escalate if the same gate still fails after three
  targeted fix attempts.
- Ambiguity: stop and document options if "decoy workflow syntax" would need a
  materially different interpretation from the one in this plan.

## Risks

- Risk: a fixture accidentally contains real unsupported import/export syntax
  rather than inert decoy text.
  Severity: high.
  Likelihood: medium.
  Mitigation: keep each fixture's real code minimal, keep the real `export
  const meta = ...` declaration at the top, place decoy syntax only inside the
  target non-code form, and add tests that assert the expected envelope
  diagnostics array is empty.

- Risk: raw ODW-style top-level `return` makes new `.js` fixtures fail Biome
  parsing.
  Severity: medium.
  Likelihood: medium.
  Mitigation: these masking fixtures do not need top-level `return`. Keep them
  parseable ECMAScript modules with top-level `await` only where useful.

- Risk: implementers conflate this fixture task with the later masker
  implementation.
  Severity: medium.
  Likelihood: medium.
  Mitigation: keep production code untouched, name the expected outcome
  `no-envelope-diagnostics`, and cite roadmap task 2.1.1 as the consumer of
  these fixtures.

- Risk: template literals are ambiguous because ODW's generic envelope masker
  blanks whole template literals, while ODW dual-compat scanning keeps
  interpolation code visible.
  Severity: medium.
  Likelihood: medium.
  Mitigation: include a template fixture with decoy syntax in template text and
  a nested ordinary string inside interpolation, then document that envelope
  diagnostics must stay empty while future dual-compat scanner tests can add
  separate executable-interpolation cases.

## Progress

- [x] (2026-06-28 12:22Z) Confirmed the worktree and branch:
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-3-3` on
  `roadmap-1-3-3`.
- [x] (2026-06-28 12:22Z) Loaded `leta`, `grepai`, `execplans`,
  `firecrawl-mcp`, `commit-message`, `en-gb-oxendict-style`, and
  `biome-typescript` skills for this planning pass.
- [x] (2026-06-28 12:22Z) Used GrepAI against canonical `main` and rechecked
  branch-local files with `leta` and direct file inspection.
- [x] (2026-06-28 12:22Z) Read the required design, roadmap, developer,
  scripting, documentation-style, and complexity guidance.
- [x] (2026-06-28 12:22Z) Researched sibling ODW source at
  `/data/leynos/Projects/open-dynamic-workflows` for loader masking,
  dual-compat scanning, and `validate(source)` behaviour.
- [x] (2026-06-28 12:22Z) Verified locked/local tool behaviour for Bun test
  declarations, Biome CLI package entry, the repository Makefile, and the
  existing ODW fixture manifest tests.
- [x] (2026-06-28 12:36Z) Rechecked the round-2 design-review blockers
  against branch-local `.oxlintrc.json`, `biome.jsonc`, the locked
  `df12-lints` plugin source, and an Oxlint probe for missing and present
  module-level `@file` JSDoc.
- [x] (2026-06-28 13:18Z) Work item 1: Added passive comment and string
  masking fixtures, a frozen manifest, and Bun manifest tests. `make all`
  passed before CodeRabbit and again after the review fix.
- [x] (2026-06-28 13:29Z) Work item 2: Added regex and template-literal
  masking fixtures, expanded context coverage to all four planned contexts,
  and pinned the new hashes. `make all` passed, and CodeRabbit reported zero
  findings.
- [x] (2026-06-28 13:36Z) Work item 3: Documented synthetic masking fixture
  maintenance, marked roadmap task 1.3.3 complete, and updated this ExecPlan
  with final implementation evidence. `make all`, `make markdownlint`, and
  `make nixie` passed before commit.
- [x] (2026-06-28 13:15Z) Fix round 1: Addressed the blocking review finding
  by adding an escaped single-quote sequence to the ordinary string decoy
  fixture and repinning that fixture's SHA-256 hash. `make all` passed and
  `coderabbit review --agent` reported zero findings before commit `ad6616d`.
- [x] (2026-06-28 13:30Z) Fix round 2: Rebased the branch onto
  `origin/main` to preserve completed roadmap task 1.3.2 while retaining the
  1.3.3 masking additions. Direct branch-local checks confirmed
  `docs/execplans/roadmap-1-3-2.md`, `docs/issues/audit-1.3.2.md`, invalid
  workflow fixtures, snapshots, lint ignores, developer-guide guidance, and
  the checked 1.3.2 roadmap item are present. `make all`, `make markdownlint`,
  `make nixie`, and
  `coderabbit review --agent` passed before the ExecPlan commit.

## Surprises & discoveries

- Observation: GrepAI's task-specific code searches returned no direct code
  matches, and broader searches mostly pointed to the terms of reference and
  ADR.
  Evidence: `grepai search --workspace Projects --project odw-lint "workflow
  syntax masking comments strings regex template literals" --toon --compact`
  returned zero results, while broader parser searches returned design docs.
  Impact: this is still a fixture-corpus planning task rather than an
  implementation task; branch-local verification must rely on current tests and
  docs.

- Observation: `node_modules` was absent before research.
  Evidence: `test -d node_modules` reported `node_modules missing`.
  Impact: run `make build` before direct locked-tool inspection or direct
  `./node_modules/.bin/biome` formatter invocations.

- Observation: ODW uses two masking strategies.
  Evidence: `open-dynamic-workflows/src/loader.ts` has `maskNonCode` for meta
  extraction and `maskForDualScan` for compatibility hazards. `maskNonCode`
  blanks strings, template literals, comments, and regex literals while
  preserving newlines. `maskForDualScan` blanks template text but leaves
  interpolation code visible.
  Impact: 1.3.3 fixtures should focus on envelope diagnostics. Future
  dual-compat fixtures must distinguish template text from executable
  interpolation code.

- Observation: `docs/users-guide.md` is not present.
  Evidence: `leta files` and `find docs -maxdepth 3 -type f` listed the docs
  tree without a users guide.
  Impact: do not create a users guide for this internal fixture task; update
  `docs/developers-guide.md` only if fixture maintenance guidance changes.

- Observation: the synthetic masking `.js` fixtures are not covered by the
  existing ODW-example lint ignores.
  Evidence: branch-local `biome.jsonc` excludes only
  `tests/static-analysis/fixtures/odw-examples/**/*.js`; branch-local
  `.oxlintrc.json` has the same ODW-example ignore and enables
  `df12/require-module-jsdoc`. The locked `df12-lints` plugin source checks
  `MODULE_JSDOC_PATTERN` in `tools/oxlint-plugin-df12/index.js` and reports
  `JS/TS files must start with a module-level JSDoc block containing @file.`
  A direct Oxlint probe with no `@file` block exited 1, and the same probe with
  `/** @file ... */` exited 0.
  Impact: every synthetic `.js` masking fixture in work items 1 and 2 must
  start with module-level `@file` JSDoc and remain linted; this plan must not
  add or recommend broader ignore rules.

- Observation: CodeRabbit caught that the first work-item manifest type
  advertised `regex` and `template` contexts before those fixtures existed.
  Evidence: `coderabbit review --agent` reported a major finding against
  `tests/static-analysis/fixtures/masking.ts` after `make all` passed for work
  item 1.
  Impact: work item 1 narrows `MaskingFixtureContext` to `comment | string`;
  work item 2 will expand the type when regex and template fixtures are added.

- Observation: the branch had been forked before roadmap task 1.3.2 landed on
  `origin/main`.
  Evidence: before the rebase, branch-local checks showed
  `docs/execplans/roadmap-1-3-2.md`,
  `docs/issues/audit-1.3.2.md`,
  `tests/static-analysis/fixtures/invalid-workflows.ts`,
  `tests/static-analysis/invalid-workflow-fixtures.test.ts`, and the
  invalid-workflow snapshot were absent. After rebasing onto `origin/main`,
  those paths are present, the invalid-workflow Biome and Oxlint ignores are
  present, and `docs/roadmap.md` keeps 1.3.2 checked.
  Impact: fix round 2 is a freshness repair only; it preserves the 1.3.2
  corpus and keeps 1.3.3's masking fixture additions without expanding scope.

## Decision log

- Decision: create a new masking fixture family rather than extending
  `ODW_EXAMPLE_FIXTURE_SNAPSHOTS`.
  Rationale: imported ODW examples are read-only upstream snapshots with
  `expectedStatus: "no-error"`. Masking fixtures are synthetic adversarial
  cases whose purpose is future scanner regression coverage, so a separate
  manifest keeps ownership and refresh rules clear.
  Date/Author: 2026-06-28, planning agent.

- Decision: split fixture implementation into comment/string first, then
  regex/template.
  Rationale: each commit remains small, gate-passable, and independently
  reviewable while covering all four syntactic forms required by roadmap task
  1.3.3.
  Date/Author: 2026-06-28, planning agent.

- Decision: do not add property, snapshot, behavioural, or end-to-end tests in
  this roadmap slice.
  Rationale: the required input space is a finite fixture matrix, the CLI does
  not exist yet, and no parser-backed output contract changes. Table-driven
  Bun unit tests over fixed fixtures are the right level of rigour. Property
  and span snapshot tests remain important for later source-mapper and parser
  work under technical design §§11.4 and 11.5.
  Date/Author: 2026-06-28, planning agent.

- Decision: keep new masking `.js` fixture files parseable by Biome rather than
  adding ignore configuration.
  Rationale: the existing ODW example snapshots need ignores because they
  preserve upstream dialect source exactly. Synthetic fixtures in this task can
  avoid top-level `return` and broad formatting exceptions.
  Date/Author: 2026-06-28, planning agent.

- Decision: require module-level `@file` JSDoc in every synthetic `.js`
  masking fixture and include those files in direct Biome formatting commands.
  Rationale: branch-local `.oxlintrc.json` applies `df12/require-module-jsdoc`
  to new synthetic fixtures, and branch-local `biome.jsonc` includes
  `tests/**/*` except copied ODW examples. Keeping the fixtures linted and
  formatted preserves the static-analysis boundary without broad ignore churn.
  Date/Author: 2026-06-28, planning agent.

- Decision: narrow `MaskingFixtureContext` during work item 1 and expand it
  only when additional contexts are pinned.
  Rationale: each atomic commit should expose a manifest contract that matches
  the fixture corpus committed at that point. This supersedes the initial
  work-item-1 instruction to declare all four contexts before all four
  fixtures exist.
  Date/Author: 2026-06-28, implementation agent.

- Decision: satisfy the escaped-quote fixture requirement with an escaped
  single quote inside `singleQuotedDecoy`.
  Rationale: Biome normalizes an escaped double-quote attempt back to a
  single-quoted string with unescaped double quotes. Adding `\'escaped
  boundary\'` inside the single-quoted literal survives the formatter and gives
  the future masker a real escaped delimiter boundary.
  Date/Author: 2026-06-28, fix-round agent.

- Decision: resolve the rebase documentation conflict by combining fixture
  maintenance guidance rather than choosing one side.
  Rationale: `origin/main` owns the invalid-workflow fixture family from
  roadmap task 1.3.2, while this branch owns the synthetic masking fixture
  family from roadmap task 1.3.3. `docs/developers-guide.md` must describe
  both families so future fixture maintenance does not delete or reformat the
  wrong corpus.
  Date/Author: 2026-06-28, fix-round-2 agent.

## Outcomes & retrospective

Work item 1 added `comment-decoy.js`, `string-decoy.js`,
`tests/static-analysis/fixtures/masking.ts`, and
`tests/static-analysis/masking-fixtures.test.ts`. The first fixture commit pins
comment and string decoys only; `MaskingFixtureContext` is deliberately narrowed
until work item 2 adds regex and template coverage. Validation passed with
`make all` before CodeRabbit and again after addressing its major finding.

Work item 2 added `regex-decoy.js` and `template-literal-decoy.js`, expanded
`MaskingFixtureContext` to `comment | regex | string | template`, and added a
context coverage test that proves each planned masking context appears exactly
once. Validation passed with `make all`, and CodeRabbit reported no findings.

Work item 3 documented the synthetic masking fixture family in
`docs/developers-guide.md`, marked roadmap task 1.3.3 complete in
`docs/roadmap.md`, and closed this ExecPlan as complete. Final validation at
HEAD passed with `make all`, `make markdownlint`, and `make nixie`; CodeRabbit
reported no findings for the documentation close-out.

Fix round 1 corrected `tests/static-analysis/fixtures/masking/string-decoy.js`
so the ordinary string fixture includes `\'escaped boundary\'` inside a
single-quoted literal. The manifest hash in
`tests/static-analysis/fixtures/masking.ts` was repinned to the formatted
source. Validation passed with `make all`, and `coderabbit review --agent`
reported zero findings before commit `ad6616d`.

Fix round 2 rebased the branch onto `origin/main` and resolved the only
conflict in `docs/developers-guide.md` by preserving both invalid-workflow and
masking fixture guidance. The final diff against `origin/main` contains the
intended 1.3.3 masking fixture corpus and combined developer-guide text, while
the completed 1.3.2 ExecPlan, audit document, invalid fixtures, snapshot test,
lint ignores, developer-guide guidance, and roadmap checkbox remain present.
Validation passed with `make all`, `make markdownlint`, and `make nixie`;
CodeRabbit reported zero findings.

## Context and orientation

`odw-lint` is a TypeScript/Bun project. The design goal is a static checker for
Open Dynamic Workflows (ODW) source that never runs workflow code. Current
production static-analysis scaffolding lives under `src/static-analysis/`.
Current fixture tests live under `tests/static-analysis/`.

The existing ODW example fixture corpus uses
`tests/static-analysis/fixtures/odw-examples.ts` as a typed manifest and
`tests/static-analysis/odw-example-fixtures.test.ts` as a Bun test suite. That
test suite reads fixture files as UTF-8 text, checks SHA-256 hashes, proves the
manifest is sorted and frozen, and records empty expected diagnostics for the
current slice. This task should follow that pattern without reusing the
upstream example manifest.

The future envelope scanner is described in `docs/technical-design.md` §6.2.
It will locate the real `export const meta =` declaration and reject real
unsupported top-level imports or exports. It must ignore decoy workflow syntax
inside non-code regions. The ODW sibling loader verifies why this matters:
`open-dynamic-workflows/src/loader.ts` extracts metadata from a masked source
copy using `EXPORT_META.exec(masked)` and `matchBrace(masked)`, then slices the
literal from the original source. Its `maskNonCode` helper blanks strings,
template literals, comments, and regex literals while preserving newlines.

The fixtures added by this task should all contain one real metadata
declaration:

```javascript
export const meta = {
  name: "masking-<context>-decoy",
  description: "Fixture proving <context> decoys are inert.",
};
```

Each fixture then places one or more fake ODW envelope tokens, such as
`export const meta =`, `import`, `export`, and unmatched-looking braces, inside
one target syntactic form. Those fake tokens are decoys. They are not meant to
change the real envelope and must not produce future envelope diagnostics.

## Research evidence

- `docs/terms-of-reference.md` §§1, 5, 6, 7, 8, and 9 require a static
  host-side check that catches workflow dialect problems before execution,
  aligns with ODW runtime behaviour, and keeps the static-analysis boundary
  explicit.
- `docs/technical-design.md` §§5, 6.2, 6.4, 11.1, 11.3, 11.5, 12.1, and 15
  require an owned static parser path, a source model that masks comments,
  strings, regex literals, and template literals, fixtures for decoy workflow
  syntax, original-source spans, and no source execution.
- `docs/adr/0001-static-analysis-boundary.md` forbids production imports of
  executable ODW loader, primitive, runtime launcher, worker, or agent-dispatch
  paths. Tests may use executable ODW runtime APIs only in narrow trusted
  parity tests; this fixture task does not need them.
- `docs/developers-guide.md` "Workflow Fixture Corpus" documents the existing
  copied ODW example snapshots and says ordinary tests must not import,
  evaluate, or execute workflow bodies.
- `docs/developers-guide.md` "Source-span helpers" says original workflow
  source records must be built with `createOriginalSourceFile` when source-span
  data is needed. This task only needs passive `WorkflowSource` text records,
  but later scanner tests should use the helper.
- `docs/documentation-style-guide.md` "Spelling", "Markdown rules",
  "Formatting", and "Roadmap task writing guidelines" govern prose, wrapping,
  Markdown syntax, and roadmap completion updates.
- `AGENTS.md` "Testing", "Linting & Formatting", and "Change Quality &
  Committing" require deterministic Bun tests, focused fixture coverage, lint
  fixes rather than suppressions, `make all` before commit, and
  `make markdownlint` when Markdown changes.
- `open-dynamic-workflows/src/loader.ts` verifies that ODW loader extraction
  currently masks strings, template literals, comments, and regex literals for
  metadata extraction. It also shows `scanDualCompat` uses a different
  template-aware mask for executable interpolation code.
- `open-dynamic-workflows/src/primitives.ts` verifies that the injected
  `validate(source)` primitive calls `loadWorkflowScript(source,
  "candidate.js")` and `scanDualCompat(source)`. It is executable runtime
  behaviour and must not be used by production `odw-lint` code for this task.
- `node_modules/bun-types/test.d.ts` from locked `bun-types@1.3.14` declares
  `describe`, `test`, the `it` alias, `test.each`, and `expect`. Bun itself
  reported version `1.3.11`. The official Bun test documentation at
  <https://bun.sh/docs/test/writing> documents the same Jest-like API and
  table-driven tests.
- `bun.lock` pins `@biomejs/biome@2.5.1`, and
  `node_modules/@biomejs/biome/package.json` declares the `biome` binary.
  `./node_modules/.bin/biome --version` reports `Version: 2.5.1`. The official
  Biome CLI documentation at <https://biomejs.dev/reference/cli/> documents
  `biome check` and `biome format` over explicit paths.
- `bun.lock` pins `oxlint@1.71.0` and `df12-lints` to Git commit
  `08ca59b`. Branch-local `.oxlintrc.json` loads
  `df12-lints/oxlint-plugin`, ignores only copied ODW example `.js` fixtures,
  and enables `df12/require-module-jsdoc`. The locked plugin source at
  `node_modules/df12-lints/tools/oxlint-plugin-df12/index.js` defines
  `MODULE_JSDOC_PATTERN` and reports missing module `@file` JSDoc from
  `requireModuleJsDocRule`. The df12-lints users guide documents the same
  requirement, and the official Oxlint configuration reference at
  <https://oxc.rs/docs/guide/usage/linter/config-file-reference.html>
  documents `jsPlugins`, `ignorePatterns`, and `rules`.
- Branch-local `biome.jsonc` includes `tests/**/*` and excludes only
  `tests/static-analysis/fixtures/odw-examples/**/*.js`; branch-local
  `Makefile` runs `make check-fmt` with `bunx biome check` over `src`, `tests`,
  and config files. Therefore new synthetic `.js` fixtures under
  `tests/static-analysis/fixtures/masking/` are format-checked unless they are
  explicitly formatted or the plan illegally broadens ignores.
- ECMAScript lexical syntax for comments, string literals, regular expression
  literals, and template literals is specified by TC39 at
  <https://tc39.es/ecma262/multipage/ecmascript-language-lexical-grammar.html>.
  These are the syntactic categories the masking fixtures exercise.

## Plan of work

### Work item 1: Add passive comment and string masking fixtures

Read `AGENTS.md` "Testing", "Linting & Formatting", and "Change Quality &
Committing"; `docs/technical-design.md` §§6.2 and 11.1;
`docs/developers-guide.md` "Workflow Fixture Corpus"; and
`docs/adr/0001-static-analysis-boundary.md` before editing. Load the `leta`,
`grepai`, `biome-typescript`, and `en-gb-oxendict-style` skills. No Python or
Rust router skill is needed because this work item touches TypeScript and
JavaScript fixtures only.

Add `tests/static-analysis/fixtures/masking/comment-decoy.js`. It must contain
one module-level `/** @file ... */` JSDoc block at the top of the file, one
real `export const meta = ...` declaration, and decoy `export const meta =`,
`import`, `export`, and brace-like text inside line and block comments only.
Keep the executable body minimal and parseable without relying on injected ODW
globals, for example by assigning a constant and awaiting `Promise.resolve` on
that constant.

Add `tests/static-analysis/fixtures/masking/string-decoy.js`. It must contain
one module-level `/** @file ... */` JSDoc block at the top of the file, one
real metadata declaration, and decoy workflow syntax inside ordinary single or
double quoted strings only. Include escaped quote content so the future masker
has a non-trivial string boundary, but keep the file valid JavaScript and avoid
undefined workflow globals.

Add `tests/static-analysis/fixtures/masking.ts` with:

- `MaskingFixtureContext = "comment" | "string" | "regex" | "template"`;
- `MaskingFixtureExpectedStatus = "no-envelope-diagnostics"`;
- an immutable `MaskingFixtureSnapshot` interface;
- `MASKING_FIXTURE_ROOT = "tests/static-analysis/fixtures/masking"`;
- `EXPECTED_NO_ENVELOPE_DIAGNOSTICS = Object.freeze([]) satisfies readonly []`;
- a helper that derives `fixturePath` from `fileName`, sets
  `expectedStatus: "no-envelope-diagnostics"`, and freezes entries; and
- `MASKING_FIXTURE_SNAPSHOTS` containing the comment and string fixture
  entries, sorted by `fileName`.

Add `tests/static-analysis/masking-fixtures.test.ts` modelled on
`tests/static-analysis/odw-example-fixtures.test.ts`. The tests must:

- assert the manifest file names match the copied `.js` files and are sorted;
- assert fixture file names are unique;
- assert each `fixturePath` is derived from `MASKING_FIXTURE_ROOT`;
- pin each fixture's SHA-256 hash;
- read each fixture as passive `WorkflowSource` text;
- assert all current `expectedDiagnostics` arrays are empty; and
- assert the manifest, entries, and expected diagnostics arrays are frozen.

Unit tests: add the Bun tests above. Behavioural tests: none, because there is
no user-facing CLI or BDD workflow in this slice. Property tests: none, because
the fixture matrix is finite and table-driven. Snapshot tests: none, because
hashes are the reviewer-useful contract. End-to-end tests: none, because
`odw-lint check` is not implemented yet.

Format only changed TypeScript and JavaScript fixture files after they exist:

```sh
./node_modules/.bin/biome format --write \
  tests/static-analysis/fixtures/masking/comment-decoy.js \
  tests/static-analysis/fixtures/masking/string-decoy.js \
  tests/static-analysis/fixtures/masking.ts \
  tests/static-analysis/masking-fixtures.test.ts
```

Validate before commit:

```sh
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-3.out
```

Commit this work item with a file-based commit message, for example
`Add comment and string masking fixtures`.

### Work item 2: Extend masking fixtures with regex and template-literal decoys

Read `docs/technical-design.md` §§6.2, 11.1, and 11.5,
`docs/complexity-antipatterns-and-refactoring-strategies.md` §4 and §5.C, and
the ODW sibling loader comments in `open-dynamic-workflows/src/loader.ts`
before editing. Load `leta`, `grepai`, `biome-typescript`, and
`en-gb-oxendict-style`.

Add `tests/static-analysis/fixtures/masking/regex-decoy.js`. It must start
with module-level `/** @file ... */` JSDoc, contain one real metadata
declaration, and place decoy workflow syntax inside a regular expression
literal. Include a regex character class or escaped slash so the future masker
cannot treat the first slash-like token as the end too early. The fixture
should not contain real top-level `import` or extra `export` syntax outside
the regex.

Add `tests/static-analysis/fixtures/masking/template-literal-decoy.js`. It
must start with module-level `/** @file ... */` JSDoc, contain one real
metadata declaration, and place decoy workflow syntax in template literal
text. Include one interpolation that contains an ordinary string with decoy
workflow syntax, for example `${"export const meta = { name:
\"nested-string-decoy\" }"}`, so future scanner work has coverage for nested
non-code inside interpolation without requiring this task to implement
dual-compat scanning. Do not include executable `Date.now()` or `Math.random()`
inside interpolation; those belong to later Claude-compatibility diagnostics.

Extend `tests/static-analysis/fixtures/masking.ts` so
`MASKING_FIXTURE_SNAPSHOTS` contains all four entries in sorted filename order.
Extend `tests/static-analysis/masking-fixtures.test.ts` with a table-driven
assertion that the manifest covers exactly the four contexts
`comment`, `regex`, `string`, and `template`. Keep all expected envelope
diagnostics empty.

Unit tests: update the Bun manifest tests for the four-context matrix.
Behavioural tests: none. Property tests: none. Snapshot tests: none. End-to-end
tests: none.

Format only changed TypeScript and JavaScript fixture files after they exist:

```sh
./node_modules/.bin/biome format --write \
  tests/static-analysis/fixtures/masking.ts \
  tests/static-analysis/masking-fixtures.test.ts \
  tests/static-analysis/fixtures/masking/regex-decoy.js \
  tests/static-analysis/fixtures/masking/template-literal-decoy.js
```

Validate before commit:

```sh
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-3.out
```

Commit this work item with a file-based commit message, for example
`Add regex and template masking fixtures`.

### Work item 3: Document fixture maintenance and close roadmap task 1.3.3

Read `docs/documentation-style-guide.md` "Spelling", "Markdown rules", and
"Roadmap task writing guidelines"; `docs/developers-guide.md` "Workflow
Fixture Corpus"; and `docs/roadmap.md` §1.3 before editing. Load `execplans`,
`en-gb-oxendict-style`, and `biome-typescript`.

Update `docs/developers-guide.md` "Workflow Fixture Corpus" to mention that
synthetic masking fixtures live under
`tests/static-analysis/fixtures/masking/`, are owned by `odw-lint`, may be
formatted by repository tooling, and record empty envelope-diagnostic
expectations for future scanner work. Keep the copied ODW examples guidance
unchanged: those snapshots remain byte-for-byte upstream copies and must not
be formatted.

Update `docs/roadmap.md` §1.3 by marking task 1.3.3 complete after work items
1 and 2 are committed and validated. Do not mark 1.3.4 or any 2.x task
complete.

Update this ExecPlan's `Progress`, `Surprises & Discoveries`, `Decision log`,
and `Outcomes & retrospective` sections with implementation evidence and final
validation output.

Tests: no new tests are required in this work item unless documentation changes
surface a broken invariant. Behavioural tests: none. Property tests: none.
Snapshot tests: none. End-to-end tests: none.

Format only changed Markdown files after they exist. These paths are existing
files by this work item:

```sh
mdtablefix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-1-3-3.md
bunx markdownlint-cli2 --fix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-1-3-3.md
```

Validate before commit:

```sh
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-3.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-3-3.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-3-3.out
```

Commit this work item with a file-based commit message, for example
`Document masking fixture maintenance`.

## Concrete steps

Start every implementation session in the worktree root:

```sh
cd /data/leynos/Projects/odw-lint.worktrees/roadmap-1-3-3
git branch --show
```

Expected branch output:

```plaintext
roadmap-1-3-3
```

Before editing code, refresh branch-local orientation:

```sh
grepai search --workspace Projects --project odw-lint "workflow fixture corpus masking decoy syntax" --toon --compact
leta files
leta grep ".*fixture.*|.*Fixture.*" "tests/static-analysis" -k function,constant,variable,type,interface --head 120
```

If `node_modules` is absent, install locked dependencies through the repository
target before direct Biome formatting:

```sh
make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-3-3.out
```

Proceed through work items 1, 2, and 3 in order. Do not combine commits. Do
not proceed to the next work item if the current work item's validation fails.

## Validation and acceptance

Acceptance for the implemented roadmap task:

- `tests/static-analysis/fixtures/masking/comment-decoy.js` exists and contains
  module-level `@file` JSDoc plus decoy workflow syntax only inside comments.
- `tests/static-analysis/fixtures/masking/string-decoy.js` exists and contains
  module-level `@file` JSDoc plus decoy workflow syntax only inside ordinary
  strings.
- `tests/static-analysis/fixtures/masking/regex-decoy.js` exists and contains
  module-level `@file` JSDoc plus decoy workflow syntax only inside a regex
  literal.
- `tests/static-analysis/fixtures/masking/template-literal-decoy.js` exists and
  contains module-level `@file` JSDoc plus decoy workflow syntax in template
  literal text and a nested string inside interpolation.
- `tests/static-analysis/fixtures/masking.ts` exposes a sorted immutable
  manifest with four entries and `expectedStatus:
  "no-envelope-diagnostics"`.
- `tests/static-analysis/masking-fixtures.test.ts` proves file presence,
  sorted order, unique names, derived paths, SHA-256 hashes, passive
  `WorkflowSource` text, empty expected diagnostics, context coverage, and
  runtime freezing.
- No production `src/` parser, scanner, CLI, or runtime code changes are made.
- `docs/developers-guide.md` explains the synthetic masking fixture family
  once implementation is complete.
- `docs/roadmap.md` marks 1.3.3 complete only after tests and gates pass.

Required gates:

```sh
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-3-3.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-3-3.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-3-3.out
```

`make markdownlint` and `make nixie` are required for the work item that edits
Markdown. Running them after the whole roadmap task is also acceptable and
recommended before the final commit.

## Idempotence and recovery

The fixture commits are additive and can be re-run safely if a gate fails. If
hash tests fail after editing fixture source, update the manifest hash only
after confirming the fixture content is intentional and the decoy syntax still
lives in the intended non-code form. If Biome reformats a fixture in a way that
removes or changes decoy syntax, adjust the source to preserve the same
semantics and re-run the hash tests.

Do not use an unnamed stash. If unrelated formatter or build churn appears and
must be parked, use a named stash with the required format:

```sh
git stash push -m 'df12-stash v1 task=1.3.3 kind=discard reason="park unrelated formatter churn"'
```

If implementation discovers that new masking fixtures cannot remain parseable
and lint-clean with module-level `@file` JSDoc under the existing Biome/Oxlint
configuration, stop, document the conflict in `Decision log`, and escalate
before adding ignores.

## Artifacts and notes

Research commands already run during planning:

```plaintext
grepai search --workspace Projects --project odw-lint \
  "workflow syntax masking comments strings regex template literals" \
  --toon --compact --limit 10
grepai search --workspace Projects --project odw-lint \
  "fixtures for lint rules with valid and invalid workflows" \
  --toon --compact --limit 10
leta files
make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-3-3.out
```

Important observed outputs:

```plaintext
roadmap-1-3-3
grepai version 0.35.0
bun install v1.3.11 (af24e281)
+ @biomejs/biome@2.5.1
+ fast-check@4.8.0
+ oxlint@1.71.0
+ typescript@5.9.3
Version: 2.5.1
```

## Interfaces and dependencies

This task should add test-only fixture interfaces. Do not add production
interfaces.

The intended test-only manifest shape is:

```typescript
export type MaskingFixtureContext = "comment" | "string" | "regex" | "template";

export type MaskingFixtureExpectedStatus = "no-envelope-diagnostics";

export interface MaskingFixtureSnapshot {
  readonly fileName: string;
  readonly fixturePath: string;
  readonly context: MaskingFixtureContext;
  readonly sha256: string;
  readonly expectedStatus: MaskingFixtureExpectedStatus;
  readonly expectedDiagnostics: readonly [];
}
```

Use these existing dependencies and APIs only:

- Bun `1.3.11` and `bun:test` declarations from locked `bun-types@1.3.14` for
  `describe`, `it`, `expect`, and table-driven tests.
- Node built-ins `node:crypto` and `node:fs`, following the existing
  `tests/static-analysis/odw-example-fixtures.test.ts` pattern.
- Existing `WorkflowSource` from `odw-lint` for passive source text shape.
- Locked Biome `2.5.1` for direct formatting of explicit changed paths.

Do not use:

- ODW `loadWorkflowScript`, `createPrimitives`, `validate(source)`, runtime
  launcher, worker, or agent-dispatch APIs.
- `@swc/core`; it is not currently a dependency and belongs to roadmap task
  2.2.1 if added later.
- `fast-check`, unless the implementation broadens beyond the finite fixture
  matrix and the plan is revised first.

## Revision note

Initial draft for roadmap task 1.3.3. It records a fixture-only implementation
path, cites the design and sibling ODW source evidence, decomposes the work
into three gate-passable commits, and specifies path-safe validation commands.

Round-2 revision for design review. It makes module-level `@file` JSDoc a hard
requirement for every synthetic `.js` masking fixture, cites the branch-local
Oxlint/Biome evidence that makes this necessary, and updates work item 1's
direct Biome formatter command to include the newly created `comment-decoy.js`
and `string-decoy.js` fixture files after they exist.

Implementation close-out revision. It records the completed comment, string,
regex, and template masking fixture corpus, the CodeRabbit-driven work-item-1
contract narrowing, the work-item-2 context expansion, and the final
documentation updates that close roadmap task 1.3.3.

Fix-round-1 revision. It records the escaped-quote correction to
`string-decoy.js`, the manifest hash update, the passing `make all` gate, the
zero-finding CodeRabbit review, and the fixture-fix commit `ad6616d`.

Fix-round-2 revision. It records the rebase onto `origin/main`, preservation
of roadmap task 1.3.2's invalid-workflow corpus, audit document, and
documentation, the combined developer-guide fixture guidance, and the passing
full gate plus CodeRabbit review for the freshness repair.
