# Split source-file helper responsibilities

This ExecPlan (execution plan) is a living document. The sections `Constraints`,
`Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 1.2.4 splits the current original-source helper module into
focused helper modules before parser span-mapping work starts. The existing
source-position spine is already behaviourally useful: callers can build an
`OriginalSourceFile`, map zero-based UTF-8 byte offsets to one-based display
positions, build half-open original-source spans, and slice or describe
snippets from the original file text.

The current implementation concentrates construction, scanning, private index
storage, offset validation, span validation, slicing, and snippet extraction in
`src/static-analysis/source-file.ts`. That makes the next parser and mapper
tasks harder to extend without creating a broad, bumpy helper module. After
this plan is implemented, the public import surface remains unchanged through
`odw-lint`, but the internal responsibilities are separated into named modules:

- `src/static-analysis/source-scan.ts` owns the single production scan over
  original source text.
- `src/static-analysis/source-indexes.ts` owns private lookup-table storage for
  factory-created `OriginalSourceFile` records.
- `src/static-analysis/source-position.ts` owns offset lookup, span
  construction, and span validation.
- `src/static-analysis/source-snippet.ts` owns validated original-text slicing
  and reviewer-useful snippets.
- `src/static-analysis/source-file.ts` stays as the original-source factory and
  compatibility facade that re-exports the public helpers.

This task is a structural refactor, not a behaviour expansion. Success is
observable when every existing source-file unit and property test still passes,
the public package entry still exports the same helper names, architecture
tests pin the new module ownership, and the roadmap can proceed to envelope and
parser span-mapping work without extending one monolithic source helper.

This task deliberately does not implement JavaScript line-separator coverage
from roadmap addendum 1.2.2.5, the ODW envelope scanner, the source masker, SWC
body parsing, parser-backed diagnostics, file discovery, configuration, CLI
behaviour, loader parity, hostile metadata lint execution, or rule-engine
logic. Those remain separate roadmap tasks.

## Constraints

- Work only in
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-2-4`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as the canonical integration branch.
- Use this GrepAI shape first for intent search against the canonical
  main-branch index:

  ```sh
  grepai search --workspace Projects --project odw-lint "<English intent query>" --toon --compact
  ```

  The GrepAI index reflects `main` only, so every branch-local fact must be
  verified with `leta`, exact text search, or file inspection inside this
  worktree before acting.
- Use `leta` for branch-local symbol navigation, references, call graphs, and
  refactoring commands such as `leta mv`.
- Use `sem` instead of raw Git history commands when reviewing semantic changes
  or codebase history.
- Do not change public package imports. Existing consumers that import
  `createOriginalSourceFile`, `positionAtOffset`, `spanFromOffsets`,
  `sliceSourceSpan`, `snippetForSpan`, `OriginalSourceFile`, `SourceLine`,
  `SourceSnippet`, `SourceOffsetError`, `WorkflowSource`, and diagnostic types
  from `odw-lint` must keep working after every work item.
- Do not add package dependencies. The locked dependency set already contains
  Bun, TypeScript, Biome, Oxlint, Fast-check, and df12-lints support for this
  refactor.
- Do not add `@swc/core`. `docs/developers-guide.md` assigns direct SWC calls
  to roadmap task 2.2.1.
- Do not import executable ODW runtime paths in production code. Forbidden
  imports include `loadWorkflowScript`, `createPrimitives`, runtime
  `validate(source)`, ODW worker paths, launch paths, runtime scheduler paths,
  or any path that evaluates metadata, compiles workflow bodies, starts runs,
  or dispatches agents. This implements ADR 0001 and `docs/technical-design.md`
  sections 5, 6.4, 11.3, and 12.1.
- Preserve the original-source contract from `docs/technical-design.md`
  section 8 and `docs/developers-guide.md` "Source-span helpers": offsets are
  zero-based UTF-8 byte offsets into original source text, lines and columns
  are one-based display positions, and columns count Unicode code points rather
  than UTF-16 code units.
- Every diagnostic span and snippet produced by these helpers must refer to
  original, pre-normalized source text. It must not refer to masked,
  normalized, wrapped, parser-generated, or formatted source.
- `OriginalSourceFile` records must still be created by
  `createOriginalSourceFile`. Helpers must reject structurally constructed
  records that lack the private indexes.
- Public slicing and snippet helpers must still revalidate caller-supplied
  spans against the same `OriginalSourceFile` before returning text.
- Keep source modules under 400 lines. This task must reduce concentration of
  responsibilities rather than move one large module into another large module.
- Keep functions within the configured Oxlint limits, including `complexity`
  max 8, `max-depth` max 3, and the df12 complex-conditional limit.
- Every new source module must start with a module JSDoc block. Public and
  private declarations need useful JSDoc because Oxlint loads the df12-lints
  plugin.
- Use en-GB Oxford spelling in prose and comments. Preserve external API
  spellings exactly when naming imported symbols or package APIs.
- Format only changed files. For Markdown, run `mdtablefix` and
  `markdownlint-cli2 --fix` on the specific changed Markdown paths. For
  TypeScript, run Biome formatting only over changed existing TypeScript paths.
  Do not run repo-global mutating formatters such as `make fmt`, `bun fmt`, or
  `mdformat-all`.
- Every work item must update this ExecPlan before its commit. At minimum,
  check off the item in `Progress`. Also update `Surprises & Discoveries`,
  `Decision Log`, `Risks`, `Outcomes & Retrospective`, and the revision note
  when an item changes assumptions or records new evidence.
- Because every work item updates this ExecPlan, every work item has a Markdown
  change. Run file-scoped Markdown formatting on
  `docs/execplans/roadmap-1-2-4.md`, then run `make markdownlint` and
  `make nixie` before committing that item.
- Each work item below is independently committable. Gate and commit each item
  before starting the next one.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances

- Scope: stop and escalate if implementation needs production files outside
  `src/static-analysis/**`, `src/index.ts`, and narrow package-entry or
  developer-guide documentation updates needed to preserve the public helper
  contract.
- Tests: stop and escalate if the work needs tests outside
  `tests/static-analysis/**`, `tests/diagnostics/architecture.test.ts`, and
  `tests/diagnostics/public-consumer.test.ts`.
- Public API: stop and escalate if any public import from `odw-lint` must be
  renamed, removed, or moved to a package subpath.
- Dependency: stop and escalate before adding any package dependency,
  including SWC, Zod, Ajv, a Unicode display-width package, a parser helper, or
  another test utility.
- Behaviour: stop and escalate if LF, CRLF, CR, Unicode code point, trailing
  newline, invalid offset, reversed span, structural construction, slicing, or
  snippet behaviour must change to complete this split.
- Deferred line separators: stop and revise the plan if the refactor cannot
  preserve current line-terminator behaviour without also implementing roadmap
  addendum 1.2.2.5 for U+2028 and U+2029. That addendum is not part of this
  plan.
- Runtime boundary: stop immediately if production code would need an ODW
  loader, primitive, scheduler, launcher, worker, agent, or metadata-evaluating
  import.
- Architecture tests: stop and escalate if the new module-ownership tests
  require ad hoc string parsing where the existing TypeScript compiler API
  helpers can express the check structurally.
- Iterations: if `make all` still fails after three focused fix attempts in one
  work item, record the failure and options in `Decision Log` before continuing.
- Formatting: if a formatter rewrites unrelated files, park that churn in a
  named discard stash using
  `df12-stash v1 task=1.2.4 kind=discard reason="<short>"`, restore the
  intended file set, and re-run only file-scoped formatting.

## Risks

- Risk: the split creates circular imports between construction, private index
  storage, validation, and snippets. Severity: high. Likelihood: medium.
  Mitigation: keep `source-scan.ts` independent of public helpers, make
  `source-indexes.ts` depend on scan types only through `import type`, make
  `source-position.ts` depend on indexes, and make `source-snippet.ts` depend
  on position validation. `source-file.ts` should sit at the top as a facade.

- Risk: moving the private `WeakMap` breaks the nominal factory contract and
  allows structural `OriginalSourceFile` values to pass accidentally. Severity:
  high. Likelihood: medium. Mitigation: work item 1 moves private index storage
  as a unit and keeps the existing "requires factory construction" test green
  after the move.

- Risk: extracting validation changes which invalid offset error is thrown
  first. Severity: medium. Likelihood: medium. Mitigation: work item 2 keeps
  the table-driven invalid-offset and invalid-span tests unchanged. It may move
  helper names, but not observable exceptions.

- Risk: slicing by UTF-16 string index after moving helpers could drift from
  UTF-8 byte offsets for multibyte Unicode. Severity: high. Likelihood: medium.
  Mitigation: work item 3 keeps `textIndexAtOffset` behind private index access
  and runs both table-driven Unicode slice tests and Fast-check round-trip
  properties.

- Risk: architecture tests become brittle by asserting incidental line order
  rather than ownership. Severity: medium. Likelihood: medium. Mitigation: use
  TypeScript compiler API traversal, following the existing
  `tests/diagnostics/architecture.test.ts` pattern, to assert top-level
  declaration ownership and export declarations structurally.

- Risk: over-splitting creates many tiny modules that are harder to follow than
  the original file. Severity: medium. Likelihood: medium. Mitigation: use
  exactly the five production modules named in this plan. Do not introduce a
  general source-helper framework, class hierarchy, or cross-module abstraction
  beyond the private index access module.

- Risk: the refactor absorbs deferred behaviour work such as U+2028/U+2029 line
  separators or parser normalization. Severity: medium. Likelihood: medium.
  Mitigation: keep behaviour-preservation tests as the acceptance boundary and
  leave open roadmap items untouched unless a separate plan is approved.

## Progress

- [x] (2026-06-28T15:01Z) Confirmed this worktree is
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-2-4` on branch
  `roadmap-1-2-4`.
- [x] (2026-06-28T15:01Z) Read `AGENTS.md`, the ExecPlan skill, the Leta
  skill, the GrepAI skill, the Firecrawl skill, the en-GB Oxford spelling
  skill, the Sem skill, and the Biome TypeScript skill.
- [x] (2026-06-28T15:01Z) Used GrepAI intent searches against the canonical
  `odw-lint` main-branch index for source-helper and parser span-mapping
  responsibilities. The index returned sparse results, so branch-local facts
  were verified with `leta` and direct document inspection.
- [x] (2026-06-28T15:01Z) Added this worktree to Leta and verified
  branch-local source-helper symbols, references, and call graphs.
- [x] (2026-06-28T15:01Z) Read the governing terms of reference, technical
  design, ADR 0001, developer guide, scripting standards, complexity guide,
  documentation style guide, roadmap, and neighbouring ExecPlans.
- [x] (2026-06-28T15:01Z) Verified sibling ODW loader, dual-compat, primitive
  validation, and public entry behaviour from
  `/data/leynos/Projects/open-dynamic-workflows/src`.
- [x] (2026-06-28T15:01Z) Verified locked package versions from `bun.lock`,
  installed source/declarations for Fast-check 4.8.0 and TypeScript 5.9.3,
  installed Biome and Oxlint wrappers, and official Fast-check, TypeScript, and
  Biome documentation through Firecrawl.
- [x] (2026-06-28T15:01Z) Ran `git fetch origin main` and
  `sem diff --from origin/main --to HEAD --format json`; no branch changes were
  detected before drafting this plan.
- [x] (2026-06-28T16:10Z) Work item 1: extracted original-source scanning
  into `source-scan.ts`, private index storage into `source-indexes.ts`, and
  added source-helper architecture coverage for the first split.
- [x] (2026-06-28T16:30Z) Work item 2: extracted offset lookup, span
  construction, and caller-supplied span validation into `source-position.ts`,
  with the facade re-exporting the public helpers.
- [x] (2026-06-28T16:48Z) Work item 3: extracted original-text slicing and
  reviewer-facing snippets into `source-snippet.ts`, with the facade
  re-exporting `sliceSourceSpan` and `snippetForSpan`.
- [x] (2026-06-28T17:04Z) Work item 4: pinned the final source-helper module
  allowlist, facade shape, and 400-line ceiling in architecture tests, and
  documented internal module ownership in `docs/developers-guide.md`.
- [x] (2026-06-28T17:18Z) Work item 5: marked roadmap task 1.2.4 complete,
  set this ExecPlan to `COMPLETE`, and recorded final outcomes and validation
  evidence.
- [x] (2026-06-28T16:20Z) Fix round 1: restored
  `docs/issues/audit-1.4.1.md` from `origin/main` after `sem diff` confirmed it
  was an unrelated deletion.
- [x] (2026-06-28T16:20Z) Fix round 1: narrowed
  `tests/static-analysis/source-file-architecture.test.ts` so it pins the
  source-helper files by name without asserting that every
  `src/static-analysis/*.ts` module must belong to that helper set.
- [x] (2026-06-28T16:34Z) Fix round 1: passed `make all`,
  `make markdownlint`, and `make nixie`, then completed
  `coderabbit review --agent`.

## Surprises & discoveries

- Observation: GrepAI returned little code signal for this task, with useful
  hits mainly in prior ExecPlan and terms-of-reference documents. Evidence: the
  semantic queries for source helper span mapping returned only
  `docs/execplans/roadmap-1-2-3.md`, `docs/terms-of-reference.md`, and one
  diagnostic text result. Impact: implementation must still start with GrepAI
  for canonical-main intent, but `leta` and direct worktree inspection are the
  source of truth for branch-local helper ownership.

- Observation: `src/static-analysis/source-file.ts` is 393 lines, just below
  the project's 400-line ceiling. Evidence: `leta files` reports the current
  file at 11.9 KB and 393 lines. Impact: the refactor should reduce this file
  materially and should not move all responsibilities into a new near-limit
  module.

- Observation: roadmap addendum 1.2.2.5 for JavaScript line and paragraph
  separators is still open. Evidence: `docs/roadmap.md` section 1.2 lists
  1.2.2.5 unchecked. Impact: task 1.2.4 must preserve current behaviour and
  avoid silently completing or partially implementing that addendum.

- Observation: `bun test --version` runs the Bun test suite instead of printing
  only a version in this environment. Evidence: the command printed 119 passing
  tests across 15 files. Impact: later validation should use Makefile targets
  with `tee` logs and should not rely on `bun test --version` as a harmless
  version probe.

- Observation: the first split can preserve the existing public facade without
  touching `src/static-analysis/index.ts` or `src/index.ts`. Evidence:
  `source-file.ts` now calls `scanOriginalSource` and `recordSourceIndexes`
  internally while retaining the same exported helper names. Impact: public
  package-entry tests should remain unchanged for this work item.

- Observation: CodeRabbit flagged per-code-point `TextEncoder` allocation in
  the scan loop and a narrow architecture-test declaration collector. Evidence:
  the first reviewer run reported one trivial finding in `source-scan.ts` and
  one minor finding in `source-file-architecture.test.ts`. Impact: the scan now
  uses direct UTF-8 byte-width arithmetic for already decoded code points, and
  architecture ownership checks include classes, enums, and namespaces.

- Observation: CodeRabbit flagged that malformed JavaScript callers could pass
  non-span values to public slicing helpers and reach a raw `TypeError` before
  span validation. Evidence: the second reviewer run reported one major finding
  in `source-position.ts`. Impact: `validateSourceSpan` now rejects malformed
  span shapes with `SourceOffsetError`, and the unit suite covers the public
  slicing and snippet helpers.

- Observation: CodeRabbit flagged that snippet line lookup could use the
  one-based line number as an array index instead of scanning `file.lines` for
  each snippet. Evidence: the third reviewer run reported one trivial finding in
  `source-snippet.ts`. Impact: `lineTextAtPosition` now indexes
  `file.lines[position.line - 1]` while keeping the existing
  `SourceOffsetError` bounds check.

- Observation: after the final split, the largest source-helper implementation
  module remains well below the 400-line project limit. Evidence:
  `leta files src/static-analysis` reports `source-scan.ts` at 176 lines and
  `source-position.ts` at 167 lines, with the facade at 38 lines. Impact: the
  architecture test now pins the line ceiling for every static-analysis source
  helper module.

- Observation: the work item 5 CodeRabbit review could not complete before
  commit because the service remained rate-limited after the required quoted
  wait and single retry. Evidence: the first attempt quoted
  `15 minutes and 29 seconds`; after waiting 960 seconds, the single retry
  still returned a rate limit quoting `4 minutes and 10 seconds`. Impact:
  deterministic gates passed, so this closure commit records the deferred final
  CodeRabbit review as an open issue for a later run.

- Observation: fix round 1 confirmed the branch was deleting an unrelated
  audit file from the integration branch. Evidence:
  `sem diff --from origin/main --to HEAD --format json` listed
  `docs/issues/audit-1.4.1.md` as deleted with all post-step audit headings.
  Impact: the file was restored from `origin/main` because it is outside the
  roadmap task 1.2.4 tolerance.

- Observation: the source-helper architecture test over-pinned the whole
  `src/static-analysis` directory. Evidence: `staticAnalysisModuleFiles()` read
  every TypeScript module in that directory and compared the result with
  `SOURCE_HELPER_MODULES`. Impact: the test now verifies that the named
  source-helper files exist while allowing future parser, envelope-scanner,
  span-mapper, and SWC adapter modules to land under the same static-analysis
  boundary.

- Observation: CodeRabbit's fix-round review reported one trivial finding in
  restored `docs/issues/audit-1.4.1.md`, asking to implement that audit's
  proposed future fixture-refresh workflow. Evidence:
  `coderabbit review --agent` completed with one finding against lines 167-174
  of the restored audit file. Impact: the finding was skipped as out of scope
  for roadmap task 1.2.4 because this fix round restores that unrelated audit
  file exactly from `origin/main` and must not rewrite its proposed findings.

## Decision Log

- Decision: split the source helper into exactly five production modules:
  `source-scan.ts`, `source-indexes.ts`, `source-position.ts`,
  `source-snippet.ts`, and the existing `source-file.ts` facade. Rationale:
  these names map directly to the responsibilities in roadmap task 1.2.4 while
  avoiding both a monolith and speculative tiny abstractions. Date/Author:
  2026-06-28T15:01Z, planning agent.

- Decision: keep `src/static-analysis/source-file.ts` as the public helper
  facade rather than moving public exports directly to every new module.
  Rationale: existing exports through `src/static-analysis/index.ts` and
  `src/index.ts` can remain stable, and later parser work can choose internal
  modules without freezing public subpaths. Date/Author: 2026-06-28T15:01Z,
  planning agent.

- Decision: use TypeScript compiler API traversal for source-helper
  architecture tests. Rationale: the repository already uses this pattern in
  `tests/diagnostics/architecture.test.ts`, TypeScript 5.9.3 is locked, and the
  official compiler API documentation supports `createSourceFile` and
  `forEachChild` traversal for structural source inspection. Date/Author:
  2026-06-28T15:01Z, planning agent.

- Decision: do not add new property-test dependencies or proof tools for this
  refactor. Rationale: Fast-check 4.8.0 is already locked and used for the
  existing source-file invariant suite. The change preserves existing finite
  and generated behaviours rather than adding a new state machine or bounded
  proof target. Date/Author: 2026-06-28T15:01Z, planning agent.

- Decision: leave U+2028 and U+2029 line-separator coverage to roadmap addendum
  1.2.2.5. Rationale: the current task is a responsibility split before parser
  span-mapping work. Mixing a semantic line-terminator expansion into this
  refactor would make review harder and would close an unchecked roadmap item
  without its own acceptance evidence. Date/Author: 2026-06-28T15:01Z, planning
  agent.

- Decision: keep `SourceIndexes` in `source-scan.ts` and import it by type from
  `source-indexes.ts`. Rationale: the scan produces the lookup-table shape and
  the index module owns only storage and guarded access. Date/Author:
  2026-06-28T16:10Z, implementation agent.

- Decision: keep `recordSourceIndexes` and `sourceIndexes` as exported
  internal module helpers instead of making them module-private after
  CodeRabbit's major finding. Rationale: the approved module split requires
  `source-file.ts` to record factory indexes and later `source-position.ts` to
  read them from sibling modules, while `src/static-analysis/index.ts` and
  `src/index.ts` do not re-export these helpers as public package APIs.
  Date/Author: 2026-06-28T16:19Z, implementation agent.

- Decision: keep the public package barrels unchanged while documenting only
  the internal source-helper map in the developer guide. Rationale: task 1.2.4
  is an internal responsibility split, not a public API expansion or package
  subpath change. Date/Author: 2026-06-28T17:04Z, implementation agent.

- Decision: restore `docs/issues/audit-1.4.1.md` exactly from `origin/main`.
  Rationale: the audit belongs to roadmap task 1.4.1, not this source-helper
  split, and dropping it would silently remove unrelated review findings from
  the integration branch. Date/Author: 2026-06-28T16:20Z, fix-round agent.

- Decision: pin the source-helper module set by checking the named helper files
  exist, not by asserting `src/static-analysis` has no other TypeScript
  modules. Rationale: task 1.2.4 exists to unblock later parser span-mapping
  work, so the architecture test must not fail solely because future parser or
  mapper modules are added under the static-analysis boundary. Date/Author:
  2026-06-28T16:20Z, fix-round agent.

- Decision: skip CodeRabbit's trivial request to implement fixture-refresh
  workflow changes from the restored audit. Rationale: that request belongs to
  a future roadmap item described by the audit itself, while this fix round's
  blocking requirement is to restore `docs/issues/audit-1.4.1.md` without
  unrelated 1.2.4 churn. Date/Author: 2026-06-28T16:34Z, fix-round agent.

## Outcomes & retrospective

Roadmap task 1.2.4 is complete. The original source helper is split into the
approved five-module shape: `source-file.ts` is the factory and public
compatibility facade; `source-scan.ts` owns original-source scanning;
`source-indexes.ts` owns private lookup-table storage; `source-position.ts`
owns offset lookup and span validation; and `source-snippet.ts` owns validated
slicing and snippets.

Public imports from `odw-lint` remain unchanged. The architecture suite pins
the final module allowlist, facade shape, declaration ownership, and 400-line
ceiling. The developer guide now records the internal ownership map for parser,
mapper, and reporter contributors.

Validation passed for each committed work item with `make all`,
`make markdownlint`, and `make nixie`. The final validation before closing the
roadmap task also passed those gates. CodeRabbit completed for work items 1
through 4, and the work item 5 review was attempted twice before being deferred
because of rate limits. Its actionable findings were addressed except for the
work item 1 request to make `recordSourceIndexes` and `sourceIndexes`
module-private, which was verified against the approved plan and skipped
because sibling modules require those helpers as internal, non-package exports.

Open issue: work item 5's final CodeRabbit review is deferred because the
service remained rate-limited after the required wait and single retry. A later
run should execute `coderabbit review --agent` from this worktree or its
integration branch once the rate limit clears.

Fix round 1 restored the unrelated task 1.4.1 audit file and narrowed the
source-helper architecture test so it protects the helper split without
blocking future static-analysis modules. Validation and review evidence for
this fix round are recorded in the revision note. CodeRabbit completed with one
trivial out-of-scope finding against the restored audit file; no code or
documentation change was made for that future fixture-refresh item.

## Addenda

- [ ] 1.2.4.1. Tighten internal source-helper export surface.
  - Source: review:1.2.4 and audit:1.2.4.
  - Severity: low.
  - Scope: remove or explicitly justify the unused source-scan byte-length
    helper, and update source-helper architecture coverage so internal helper
    modules do not keep dead exports merely to satisfy structural tests.
  - Success: the production source-scan module exposes only helpers used across
    module boundaries or documented as intentional, and architecture tests
    continue to protect the helper split without pinning unused declarations.
- [ ] 1.2.4.2. Clarify deferred review status in the ExecPlan.
  - Source: review:1.2.4.
  - Severity: low.
  - Scope: reconcile the outcomes, retrospective, revision note, and review
    evidence so the deferred work-item 5 review and the completed fix-round
    review cannot be read as contradictory statuses.
  - Success: a future roadmap agent can tell which review was deferred, which
    fix-round review completed, and which findings were intentionally skipped
    without cross-reading unrelated notes.

## Context and orientation

The repository is a private TypeScript and Bun package. `src/index.ts` is the
public package entry point. `src/static-analysis/index.ts` is the
static-analysis barrel. Public consumers import source helpers from `odw-lint`,
not from package subpaths.

`src/static-analysis/types.ts` defines `WorkflowSource`, `SourceLine`,
`OriginalSourceFile`, `SourceSnippet`, `SourceOffsetError`, component labels,
and stage labels. Before this plan was implemented,
`src/static-analysis/source-file.ts` defined all source-helper behaviour:

- `createOriginalSourceFile` constructs a frozen `OriginalSourceFile` and
  stores private scan indexes in a `WeakMap`.
- `positionAtOffset` validates an offset and returns a display position.
- `spanFromOffsets` builds half-open spans from valid byte offsets.
- `sliceSourceSpan` validates caller-supplied spans and returns original text.
- `snippetForSpan` validates caller-supplied spans and returns original text,
  positions, and first-line text.
- Private helpers scan the source, track UTF-8 byte offsets and UTF-16 string
  indexes, validate offsets, validate spans, and build frozen line, position,
  and span records.

Existing tests already cover the behaviour that must survive the split:

- `tests/static-analysis/source-file.test.ts` covers line metadata, runtime
  freezing, factory construction, offset mapping, invalid offsets, span
  slicing, snippets, and invalid spans.
- `tests/static-analysis/source-file.property.test.ts` covers generated valid
  offsets, monotonic positions, end-of-file offsets, invalid offsets, substring
  round trips, reversed spans, and mutated caller positions with Fast-check.
- `tests/static-analysis/source-diagnostic.test.ts` proves original-source
  spans thread through diagnostic reports and text output.
- `tests/static-analysis/boundary.test.ts` verifies the helpers are visible at
  the public package boundary.
- `tests/diagnostics/architecture.test.ts` already demonstrates the structural
  TypeScript compiler API pattern that should be reused for source-helper
  module-ownership checks.

Terms used in this plan:

- "Original source" means the workflow file text before masking, normalization,
  wrapping, parsing, formatting, or any generated parser representation.
- "UTF-8 byte offset" means a zero-based byte position in the original source
  after UTF-8 encoding.
- "Display position" means `{ offset, line, column }`, where `line` and
  `column` are one-based and `column` counts Unicode code points.
- "Half-open span" means a `SourceSpan` where `start.offset` is inclusive and
  `end.offset` is exclusive.
- "Private indexes" means lookup tables attached to factory-created source
  files in a module-private `WeakMap`, not fields exposed on
  `OriginalSourceFile`.

## Research evidence

The local project evidence is:

- `docs/roadmap.md` task 1.2.4 requires scanning, validation, slicing, snippet,
  and construction concerns to be separated in
  `src/static-analysis/source-file.ts` without changing source-span behaviour.
- `docs/roadmap.md` section 1.2 says this work requires task 1.2.2 and unlocks
  parser and span-mapper work.
- `docs/technical-design.md` section 6.1 names source reader, span mapper, SWC
  parser adapter, and reporter as separate components.
- `docs/technical-design.md` section 6.2 says the future envelope scanner
  should use the same string, comment, template, and regex masking strategy as
  ODW's loader.
- `docs/technical-design.md` section 8 defines the diagnostic source-position
  contract and says spans always refer to original source.
- `docs/technical-design.md` section 11.5 says every diagnostic span must point
  into original source and makes span mapping the most important correctness
  property after dialect parity.
- `docs/developers-guide.md` "Source-span helpers" says parser, mapper, and
  reporter code must pass factory-created `OriginalSourceFile` records through
  the pipeline instead of reconstructing them structurally.
- `docs/developers-guide.md` "Static-Analysis Boundary" says direct SWC calls
  belong to roadmap task 2.2.1, not this task.
- `docs/adr/0001-static-analysis-boundary.md` decides that production
  `odw-lint` owns its static-analysis implementation and must not import ODW
  executable runtime helpers.
- `leta grep` on `src/static-analysis/source-file.ts` found one current module
  containing `createOriginalSourceFile`, `positionAtOffset`, `spanFromOffsets`,
  `sliceSourceSpan`, `snippetForSpan`, `scanOriginalSource`, validation
  helpers, slicing helpers, index lookup, and record factories.
- `leta calls --from createOriginalSourceFile`, `spanFromOffsets`,
  `sliceSourceSpan`, and `snippetForSpan` confirmed the current call graph:
  construction calls scanning; span construction calls position lookup; slicing
  and snippets call span validation and private text-index lookup.
- `sem diff --from origin/main --to HEAD --format json` after
  `git fetch origin main` reported no branch changes before this plan was
  drafted.

The sibling ODW evidence from `/data/leynos/Projects/open-dynamic-workflows` is:

- `src/loader.ts` documents and implements ODW's runtime transform: it extracts
  `export const meta`, strips the `export` keyword, wraps the body in an async
  function, and compiles with `new AsyncFunction`.
- `src/loader.ts` implements `maskNonCode` for string, comment, template, and
  regex-aware loader searches. This is future envelope-scanner evidence only;
  task 1.2.4 does not port or vendor the masker.
- `src/loader.ts` evaluates metadata with `new Function`, which confirms why
  production `odw-lint` cannot depend on the runtime loader for host-side lint
  of untrusted source.
- `src/dual-compat.ts` implements `checkMeta` with a pure-literal parser and
  rejects variables, calls, spreads, computed keys, and template interpolation.
  This is future metadata-classification evidence only.
- `src/primitives.ts` implements `validate(source)` by calling
  `loadWorkflowScript(source, "candidate.js")` and `scanDualCompat(source)`.
  That confirms runtime `validate(source)` is not a safe production dependency
  for this repository's static helper path.
- `src/index.ts` exports workflow metadata types, primitives, and runtime entry
  points, but not a safe static source-analysis API for this task.

The external dependency evidence is:

- `bun.lock` resolves `@biomejs/biome` to 2.5.1, `fast-check` to 4.8.0,
  `oxlint` to 1.71.0, and `typescript` to 5.9.3.
- Installed Fast-check 4.8.0 declarations in
  `node_modules/fast-check/lib/cjs/fast-check.d.ts` define `assert` overloads
  for synchronous and asynchronous properties, and installed implementation
  code in `node_modules/fast-check/lib/cjs/fast-check.js` implements `property`,
  `assert`, and `numRuns` parameter reading with a default of 100.
- Official Fast-check documentation at
  `https://fast-check.dev/docs/tutorials/quick-start/our-first-property-based-test/`
  shows `fc.assert(fc.property(...))` as the normal property-test pattern.
- Official Fast-check documentation at
  `https://fast-check.dev/docs/configuration/global-settings/` shows per-test
  runner settings such as `fc.assert(myProp, { numRuns: 10 })`.
- Installed TypeScript 5.9.3 declarations in
  `node_modules/typescript/lib/typescript.d.ts` provide the compiler API used
  by existing architecture tests. Official TypeScript compiler API
  documentation at
  `https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API` shows
  `ts.createSourceFile` and `ts.forEachChild` for AST traversal.
- Installed Biome 2.5.1 exposes the local npm wrapper through
  `node_modules/@biomejs/biome/bin/biome`. Official Biome CLI documentation at
  `https://biomejs.dev/reference/cli/` says `biome format` and `biome check`
  accept a list of path arguments, which supports file-scoped formatting.
- The project Makefile defines the repository gates: `make all`,
  `make markdownlint`, and `make nixie`.
- `mdtablefix --help` confirms `mdtablefix --in-place --wrap <files>` rewrites
  named Markdown files only. `nixie --help` confirms `nixie --no-sandbox`
  validates Markdown diagrams from the repository when no path is supplied.

## Plan of work

### Work item 1: Extract original-source scanning and index ownership

Purpose: move the single production scan and private index storage out of the
public helper facade while preserving construction behaviour.

Documentation implemented:

- `docs/roadmap.md` task 1.2.4, especially scanning and construction concern
  separation.
- `docs/technical-design.md` sections 6.1, 8, and 11.5.
- `docs/developers-guide.md` "Source-span helpers".
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 4.A,
  4.B, 5.A, and 5.B.
- `AGENTS.md` "Code Style and Structure", "Refactoring Heuristics & Workflow",
  and "TypeScript Guidance".

Skills to load:

- `execplans`, `grepai`, `leta`, `sem`, `biome-typescript`, and
  `en-gb-oxendict-style`.

Edits:

- Create `src/static-analysis/source-scan.ts` with a module JSDoc block.
- Move `SourceIndexes`, `SourceScan`, `scanOriginalSource`, `utf8ByteLength`,
  `isLineTerminator`, `isCrLfTerminator`, `sourceLine`, and `sourcePosition`
  into `source-scan.ts`. Keep `scanOriginalSource` internal to
  `src/static-analysis/**`; do not export it from the package entry.
- Create `src/static-analysis/source-indexes.ts` with a module JSDoc block.
- Move the private `WeakMap` currently named `SOURCE_INDEXES` into
  `source-indexes.ts`, along with `sourceIndexes` and `textIndexAtOffset`.
  Export only internal helpers needed by sibling static-analysis modules, such
  as `recordSourceIndexes`, `sourceIndexes`, and `textIndexAtOffset`.
- Update `src/static-analysis/source-file.ts` so
  `createOriginalSourceFile` calls `scanOriginalSource` and
  `recordSourceIndexes`. Keep the public function name and return type
  unchanged.
- Add or update `tests/static-analysis/source-file-architecture.test.ts` using
  the TypeScript compiler API pattern from
  `tests/diagnostics/architecture.test.ts`. At this point it must assert:
  `source-scan.ts`, `source-indexes.ts`, and `source-file.ts` exist; scanning
  declarations live in `source-scan.ts`; private index declarations live in
  `source-indexes.ts`; and `source-file.ts` still declares
  `createOriginalSourceFile`.
- Update this ExecPlan's `Progress`, `Decision Log`, and revision note before
  committing.

Tests required:

- Unit: run `bun test tests/static-analysis/source-file.test.ts` and keep line
  metadata, factory construction, and freeze tests green.
- Architecture: run
  `bun test tests/static-analysis/source-file-architecture.test.ts`.
- Property: run `bun test tests/static-analysis/source-file.property.test.ts`
  so generated offset and monotonic-position properties still pass.
- Behavioural: none. No CLI or Gherkin behaviour changes.
- Snapshot: none. No snapshot payload changes are expected.
- End-to-end: none beyond the repository gate.

Expected commit title: `Split source scanning indexes`.

### Work item 2: Extract offset lookup and span validation

Purpose: isolate position lookup, offset bounds checking, span construction,
and caller-supplied span validation from construction and snippet slicing.

Documentation implemented:

- `docs/roadmap.md` task 1.2.4, especially validation concern separation.
- `docs/technical-design.md` sections 8 and 11.5.
- `docs/developers-guide.md` "Source-span helpers".
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 4.A,
  4.B, 5.A, and 5.B.
- `AGENTS.md` "Runtime Validation & Types" and "Error Handling".

Skills to load:

- `execplans`, `grepai`, `leta`, `sem`, `biome-typescript`, and
  `en-gb-oxendict-style`.

Edits:

- Create `src/static-analysis/source-position.ts` with a module JSDoc block.
- Move `positionAtOffset`, `spanFromOffsets`, `validateOffsetBounds`,
  `validateSourceSpan`, `isSamePosition`, and `sourceSpan` into
  `source-position.ts`.
- Keep `positionAtOffset` and `spanFromOffsets` public through
  `src/static-analysis/source-file.ts`, `src/static-analysis/index.ts`, and
  `src/index.ts`. `validateSourceSpan` may be exported only internally for
  `source-snippet.ts`; do not re-export it through the package entry.
- Update `src/static-analysis/source-file.ts` to re-export `positionAtOffset`
  and `spanFromOffsets` from `source-position.ts`.
- Extend `tests/static-analysis/source-file-architecture.test.ts` to assert
  position and span-validation declarations live in `source-position.ts`, while
  `source-file.ts` no longer declares them.
- Update this ExecPlan's `Progress`, `Decision Log`, and revision note before
  committing.

Tests required:

- Unit: run `bun test tests/static-analysis/source-file.test.ts` and keep all
  invalid-offset, span construction, and invalid-span cases green.
- Architecture: run
  `bun test tests/static-analysis/source-file-architecture.test.ts`.
- Property: run `bun test tests/static-analysis/source-file.property.test.ts`
  and keep invalid generated offsets, reversed spans, and mutated caller-span
  properties green.
- Behavioural: none. No command-line behaviour changes.
- Snapshot: none. No snapshot payload changes are expected.
- End-to-end: none beyond the repository gate.

Expected commit title: `Split source position validation`.

### Work item 3: Extract slicing and snippet helpers

Purpose: keep original-text slicing and reviewer-facing snippets in one module
that depends on validated spans and private text-index lookup.

Documentation implemented:

- `docs/roadmap.md` task 1.2.4, especially slicing and snippet concern
  separation.
- `docs/technical-design.md` sections 8, 11.5, and 12.2.
- `docs/developers-guide.md` "Source-span helpers".
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 4.A,
  4.B, 5.A, and 5.B.
- `AGENTS.md` "Observability" and "Error Handling".

Skills to load:

- `execplans`, `grepai`, `leta`, `sem`, `biome-typescript`, and
  `en-gb-oxendict-style`.

Edits:

- Create `src/static-analysis/source-snippet.ts` with a module JSDoc block.
- Move `sliceSourceSpan`, `snippetForSpan`, `sliceValidatedSourceSpan`, and
  `lineTextAtPosition` into `source-snippet.ts`.
- Import internal validation from `source-position.ts` and private
  `textIndexAtOffset` from `source-indexes.ts`.
- Keep `sliceSourceSpan` and `snippetForSpan` public through
  `src/static-analysis/source-file.ts`, `src/static-analysis/index.ts`, and
  `src/index.ts`.
- Extend `tests/static-analysis/source-file-architecture.test.ts` to assert
  slicing and snippet declarations live in `source-snippet.ts`, while
  `source-file.ts` no longer declares them.
- Update this ExecPlan's `Progress`, `Decision Log`, and revision note before
  committing.

Tests required:

- Unit: run `bun test tests/static-analysis/source-file.test.ts` and keep all
  slice and snippet cases green.
- Unit: run `bun test tests/static-analysis/source-diagnostic.test.ts` so spans
  still thread through diagnostics, schema checks, and text output.
- Architecture: run
  `bun test tests/static-analysis/source-file-architecture.test.ts`.
- Property: run `bun test tests/static-analysis/source-file.property.test.ts`
  and keep generated substring round trips and mutated caller-span rejection
  green.
- Behavioural: none. No CLI or workflow behaviour changes.
- Snapshot: none. No snapshot payload changes are expected.
- End-to-end: none beyond the repository gate.

Expected commit title: `Split source snippet helpers`.

### Work item 4: Pin source-helper architecture and maintainer guidance

Purpose: finish the public facade and document the internal module boundaries
for parser and span-mapper contributors.

Documentation implemented:

- `docs/roadmap.md` task 1.2.4.
- `docs/technical-design.md` sections 6.1, 8, and 11.5.
- `docs/developers-guide.md` "Source-span helpers" and "Documentation Upkeep".
- `docs/documentation-style-guide.md` "Developer's guide", "Design document",
  and "Roadmap task writing guidelines".
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 5.A
  and 5.B.
- `AGENTS.md` "Documentation Maintenance" and "Public APIs".

Skills to load:

- `execplans`, `grepai`, `leta`, `sem`, `biome-typescript`, and
  `en-gb-oxendict-style`.

Edits:

- Reduce `src/static-analysis/source-file.ts` to the public compatibility
  facade: module JSDoc, imports needed for `createOriginalSourceFile`, the
  factory itself, and public re-exports for `positionAtOffset`,
  `spanFromOffsets`, `sliceSourceSpan`, and `snippetForSpan`.
- Keep `src/static-analysis/index.ts` and `src/index.ts` as explicit public
  barrels. Do not add package subpath exports.
- Extend `tests/static-analysis/source-file-architecture.test.ts` to assert the
  final module allowlist for source helpers: `source-file.ts`,
  `source-indexes.ts`, `source-position.ts`, `source-scan.ts`,
  `source-snippet.ts`, `index.ts`, and `types.ts`.
- Extend architecture tests to assert `source-file.ts` is a facade and that no
  source helper module exceeds 400 lines.
- Update `tests/static-analysis/boundary.test.ts` and
  `tests/diagnostics/public-consumer.test.ts` only if needed to pin the public
  package entry after the internal split.
- Update `docs/developers-guide.md` "Source-span helpers" with a compact
  internal map for the five source-helper modules and their ownership. Do not
  change the user-facing helper contract.
- Update this ExecPlan's `Progress`, `Decision Log`, and revision note before
  committing.

Tests required:

- Unit: run `bun test tests/static-analysis/boundary.test.ts`.
- Unit: run `bun test tests/diagnostics/public-consumer.test.ts` if that file
  changes.
- Architecture: run
  `bun test tests/static-analysis/source-file-architecture.test.ts`.
- Property: run `bun test tests/static-analysis/source-file.property.test.ts`
  to prove the final split preserved generated source-span invariants.
- Behavioural: none. No command-line behaviour changes.
- Snapshot: none. No snapshot payload changes are expected.
- End-to-end: none beyond the repository gate.

Expected commit title: `Document source helper modules`.

### Work item 5: Close roadmap task 1.2.4 and record outcomes

Purpose: mark the roadmap task complete only after the refactor is implemented,
validated, and committed.

Documentation implemented:

- `docs/roadmap.md` task 1.2.4.
- `docs/documentation-style-guide.md` "Roadmap task writing guidelines".
- `AGENTS.md` "Documentation Maintenance" and "Change Quality & Committing".

Skills to load:

- `execplans`, `grepai`, `sem`, and `en-gb-oxendict-style`.

Edits:

- Update `docs/roadmap.md` task 1.2.4 from `[ ]` to `[x]` after the previous
  work items are committed and gated.
- Update this ExecPlan `Status` to `COMPLETE`.
- Complete the `Progress` checklist.
- Fill `Outcomes & Retrospective` with the implemented module split,
  validation commands, and any follow-up tasks discovered.
- Append or update the revision note at the bottom of this ExecPlan.

Tests required:

- Unit: none. Documentation-only closure.
- Architecture: none beyond the repository gate.
- Property: none.
- Behavioural: none.
- Snapshot: none.
- End-to-end: none.

Expected commit title: `Close source helper split`.

## Concrete steps

Run every command from `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-2-4`.

Before each implementation work item, refresh the branch-local view:

```sh
git branch --show
grepai search --workspace Projects --project odw-lint \
  "source file helper responsibilities parser span mapping" --toon --compact
leta files src/static-analysis
```

Before committing each work item, review semantic changes:

```sh
sem diff --format json
```

Format changed TypeScript files only:

```sh
mapfile -t candidate_ts < <({
  git diff --name-only --diff-filter=ACMRTUXB -- '*.ts' '*.tsx'
  git diff --cached --name-only --diff-filter=ACMRTUXB -- '*.ts' '*.tsx'
  git ls-files --others --exclude-standard -- '*.ts' '*.tsx'
} | sort -u)
changed_ts=()
for path in "${candidate_ts[@]}"; do
  if [[ -f "$path" ]]; then
    changed_ts+=("$path")
  fi
done
if ((${#changed_ts[@]})); then
  bunx biome format --write "${changed_ts[@]}"
fi
```

Format this ExecPlan for every work item:

```sh
mdtablefix --in-place --wrap docs/execplans/roadmap-1-2-4.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-2-4.md
```

For work item 4, format both changed Markdown files after updating the
developer guide:

```sh
mdtablefix --in-place --wrap docs/execplans/roadmap-1-2-4.md docs/developers-guide.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-2-4.md docs/developers-guide.md
```

For work item 5, format both changed Markdown files after updating the roadmap:

```sh
mdtablefix --in-place --wrap docs/execplans/roadmap-1-2-4.md docs/roadmap.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-2-4.md docs/roadmap.md
```

Run targeted tests named in each work item first, then run the full gates
sequentially with logs. Use the same log pattern for any targeted command that
may produce long output:

```sh
log=/tmp/all-$(get-project)-$(git branch --show).out
make all 2>&1 | tee "$log"
test ${PIPESTATUS[0]} -eq 0

log=/tmp/markdownlint-$(get-project)-$(git branch --show).out
make markdownlint 2>&1 | tee "$log"
test ${PIPESTATUS[0]} -eq 0

log=/tmp/nixie-$(get-project)-$(git branch --show).out
make nixie 2>&1 | tee "$log"
test ${PIPESTATUS[0]} -eq 0
```

If all gates pass, stage only the work item files and commit. Do not commit a
change that fails a gate.

## Validation and acceptance

The whole roadmap task is complete when all of these are true:

- `src/static-analysis/source-file.ts` is a small public facade containing
  `createOriginalSourceFile` and public re-exports, not the scanner,
  validation, slicing, or snippet implementation.
- `src/static-analysis/source-scan.ts` owns the single production scan that
  builds line metadata, display positions, UTF-8 byte offsets, and UTF-16 text
  indexes.
- `src/static-analysis/source-indexes.ts` owns the private index `WeakMap` and
  lookup helpers for factory-created source records.
- `src/static-analysis/source-position.ts` owns `positionAtOffset`,
  `spanFromOffsets`, and internal span validation.
- `src/static-analysis/source-snippet.ts` owns `sliceSourceSpan` and
  `snippetForSpan`.
- Public imports from `odw-lint` still work for every source helper and related
  type that worked before this task.
- Existing source-file unit tests and Fast-check property tests pass without
  changing expected behaviour.
- Architecture tests pin the final source-helper module names and ownership.
- `docs/developers-guide.md` tells maintainers which internal source-helper
  module owns each responsibility.
- `docs/roadmap.md` task 1.2.4 is checked off only after implementation and
  validation.
- `make all`, `make markdownlint`, and `make nixie` pass before every commit.

Expected final gate transcript:

```plaintext
make all
# exits 0
make markdownlint
# exits 0
make nixie
# exits 0
```

## Idempotence and recovery

All work items are safe to repeat if the working tree is clean at the start of
the item. Re-running file-scoped Biome and Markdown formatting should converge
without changing unrelated files.

If `leta mv` is used and updates imports incorrectly, inspect the changed
imports with `leta refs` and `sem diff`, fix the import graph, and re-run
`make typecheck` before broader gates.

If a formatter rewrites unrelated files, do not keep the churn. Park it with a
named discard stash:

```sh
git stash push -m 'df12-stash v1 task=1.2.4 kind=discard reason="formatter churn"'
```

Then restore only the intended file set by re-applying the work item edits
carefully. Do not use a bare `git stash`.

If `make all` fails because of existing unrelated branch state, verify with
`sem diff --from origin/main --to HEAD --format json` before changing anything.
Do not repair unrelated work inside this task unless the failing gate directly
blocks the source-helper split and the fix is part of the same responsibility.

## Artifacts and notes

Planning evidence collected before implementation:

```plaintext
git branch --show
roadmap-1-2-4

sem diff --from origin/main --to HEAD --format json
No changes detected.

bun.lock locked packages:
@biomejs/biome 2.5.1
fast-check 4.8.0
oxlint 1.71.0
typescript 5.9.3
```

The incidental `bun test --version` invocation during planning ran the test
suite and reported 119 passing tests. Treat that as a useful baseline only, not
as a substitute for the required per-commit `make all` gate.

## Interfaces and dependencies

At the end of work item 4, the internal module interfaces should be:

```ts
// src/static-analysis/source-file.ts
export const createOriginalSourceFile: (source: WorkflowSource) => OriginalSourceFile;
export { positionAtOffset, spanFromOffsets } from "./source-position";
export { sliceSourceSpan, snippetForSpan } from "./source-snippet";
```

```ts
// src/static-analysis/source-scan.ts
export type SourceScan = {
  readonly byteLength: number;
  readonly lines: readonly SourceLine[];
  readonly positions: ReadonlyMap<number, SourcePosition>;
  readonly textIndexes: ReadonlyMap<number, number>;
};
export const scanOriginalSource: (sourceText: string) => SourceScan;
```

```ts
// src/static-analysis/source-indexes.ts
export const recordSourceIndexes: (
  file: OriginalSourceFile,
  indexes: SourceScan,
) => void;
export const sourceIndexes: (file: OriginalSourceFile) => SourceScan;
export const textIndexAtOffset: (
  file: OriginalSourceFile,
  offset: number,
) => number;
```

```ts
// src/static-analysis/source-position.ts
export const positionAtOffset: (
  file: OriginalSourceFile,
  offset: number,
) => SourcePosition;
export const spanFromOffsets: (
  file: OriginalSourceFile,
  startOffset: number,
  endOffset: number,
) => SourceSpan;
export const validateSourceSpan: (
  file: OriginalSourceFile,
  span: SourceSpan,
) => SourceSpan;
```

```ts
// src/static-analysis/source-snippet.ts
export const sliceSourceSpan: (
  file: OriginalSourceFile,
  span: SourceSpan,
) => string;
export const snippetForSpan: (
  file: OriginalSourceFile,
  span: SourceSpan,
) => SourceSnippet;
```

`validateSourceSpan`, `recordSourceIndexes`, `sourceIndexes`, and
`textIndexAtOffset` are internal static-analysis helpers. They must not be
re-exported from `src/index.ts` or `src/static-analysis/index.ts` unless a
later approved plan deliberately changes the public API.

No new external dependency is needed. The plan relies on already locked tools:
Fast-check 4.8.0 for property tests, TypeScript 5.9.3 for architecture-test AST
inspection, Biome 2.5.1 for file-scoped TypeScript formatting, Oxlint 1.71.0
through `make lint`, and Bun 1.3.11 through the repository's Makefile targets.

## Revision note

Initial draft for roadmap task 1.2.4. This draft records the researched module
split, path-safe validation commands, documentation and skill signposts, and
per-item testing requirements. Implementation was approved by the df12-build
workflow and is now complete: the source-helper responsibilities are split,
architecture and developer-guide guidance are pinned, roadmap task 1.2.4 is
checked off, and the final gates passed.

Fix round 1 update: restored `docs/issues/audit-1.4.1.md` from `origin/main`
because it belongs to roadmap task 1.4.1, not the 1.2.4 source-helper split.
The architecture test now checks that the named source-helper modules exist and
retains the facade and line-limit checks for those helpers, but it no longer
asserts that every future `src/static-analysis/*.ts` file must be in that
helper set.

Fix round 1 validation:
`bun test tests/static-analysis/source-file-architecture.test.ts`, `make all`,
`make markdownlint`, and `make nixie` passed. `coderabbit review --agent`
completed with one trivial finding against the restored
`docs/issues/audit-1.4.1.md`; the finding was skipped because it asks to
implement a future fixture-refresh workflow from that unrelated audit rather
than resolve a roadmap task 1.2.4 blocker.
