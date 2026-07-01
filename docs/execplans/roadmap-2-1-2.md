# Implement static envelope extraction

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 2.1.2 adds the first production ODW (Open Dynamic Workflows)
envelope scanner. The scanner finds a real `export const meta =` declaration in
original workflow source without executing the file, records byte-accurate
original-source spans for the metadata envelope, and reports unsupported
top-level import or export syntax as `odw/no-import-export` diagnostics.

After this plan is implemented, maintainers can run the repository gate and see
that valid copied ODW examples produce no envelope diagnostics, masking
fixtures exercise the production scanner instead of a test-only probe, and the
invalid unsupported-import/export fixtures produce diagnostics matching their
manifest spans exactly. This task deliberately does not parse metadata fields,
execute metadata, parse workflow bodies with SWC, implement the CLI, or perform
ODW loader parity execution.

## Round-2 design-review resolution

This revision resolves the three blocking findings from the previous design
review.

1. Masked-source indexes are now handled through an explicit internal
   `spanFromTextIndexes(sourceFile, startIndex, endIndex)` helper owned by
   `src/static-analysis/source-position.ts`. It converts UTF-16 string indexes
   from `maskedText` into zero-based UTF-8 byte offsets before calling
   `spanFromOffsets`. Work item 1 includes non-ASCII-before-token tests so
   Unicode source cannot silently produce wrong spans.
2. The public `WorkflowEnvelope` contract is no longer exported before metadata
   value state is complete. Work item 1 keeps the scanner internal. Work item 2
   defines and exports a discriminated `WorkflowMetaValue` union that
   distinguishes `"object"`, `"non-object-expression"`, `"unterminated-object"`,
   and `"missing-value"` states before updating package exports.
3. Production scanner modules must use relative internal imports such as
   `../diagnostics/rule-id` and `./source-file`. The package entry
   `"odw-lint"` is reserved for public-consumer tests. This avoids a
   package-entry cycle through `src/index.ts` and
   `src/static-analysis/index.ts`.

## Constraints

- Work only in the assigned git-donkey worktree for roadmap task 2.1.2.
- Do not edit the root/control worktree.
- Treat `origin/main` as the canonical integration branch.
- Use this GrepAI command shape first for intent search against the canonical
  main-branch index:

  ```sh
  grepai search --workspace 'Projects' --project 'odw-lint' "<English intent query>" --toon --compact
  ```

  GrepAI reflects `main` only. Verify every branch-local fact inside this
  worktree with `leta`, exact text search, or file inspection before acting.
- Use `leta` for branch-local symbol navigation, references, call graphs, and
  refactoring commands. Exact text search is acceptable for literal strings,
  Markdown, JSON, lockfiles, raw fixture text, vendored dependency source, and
  other non-symbol content.
- Use `sem` instead of raw Git history commands if implementation needs
  codebase history, entity-level diffs, or blame.
- Follow `AGENTS.md` "Change Quality & Committing", "Markdown Guidance", and
  "TypeScript Guidance". Use en-GB Oxford spelling in prose, comments, and
  commit messages while preserving code identifiers and external API names.
- Load the relevant skills before implementation work: `execplans`, `grepai`,
  `leta`, `sem`, `en-gb-oxendict-style`, `firecrawl-mcp`, and
  `biome-typescript`. This environment does not list a TypeScript router skill;
  use `biome-typescript` plus `AGENTS.md` TypeScript Guidance for TypeScript
  formatting and linting work. If a future environment provides a TypeScript
  router skill, load that router before touching TypeScript.
- Production code must not import executable ODW loader, primitive, launcher,
  worker, runtime, scheduler, metadata-evaluating, or agent-dispatch paths.
  This follows `docs/technical-design.md` §5 and
  `docs/adr/0001-static-analysis-boundary.md` "Decision" and "Consequences".
- Do not call `new Function`, `eval`, dynamic import of workflow files, ODW
  `loadWorkflowScript`, ODW `createPrimitives`, or the ODW runtime
  `validate(source)` primitive.
- Do not copy or vendor ODW private loader helpers into production
  `odw-lint` code. Use repository-owned scanner code whose observable
  behaviour is pinned by tests and documented ODW source evidence.
- Do not add dependencies. The current `bun.lock` resolves Biome 2.5.1, Bun
  types 1.3.14, Fast-check 4.8.0, Oxlint 1.71.0, and TypeScript 5.9.3. It does
  not include `@swc/core`; SWC parser work belongs to roadmap task 2.2.1.
- Implement production code under `src/static-analysis/`. Keep work item 1
  internal to `src/static-analysis/workflow-envelope.ts`; update
  `src/static-analysis/index.ts`, `src/index.ts`, public API fixtures, and
  package-boundary tests only in work item 2 when the metadata-state contract is
  complete.
- The scanner must accept an `OriginalSourceFile` created by
  `createOriginalSourceFile`. It must not reconstruct source files
  structurally, because source-span helpers rely on private indexes recorded by
  the factory. See `docs/developers-guide.md` "Source-span helpers".
- The scanner must use `maskNonCodeSource` before looking for
  `export const meta =`, `import`, `export`, braces, comments, strings,
  templates, or regex-sensitive syntax. Do not duplicate source masking.
- The scanner must slice spans from the original source and report spans using
  `spanFromOffsets`; spans are zero-based UTF-8 byte offsets with one-based
  display line and column positions, as required by `docs/technical-design.md`
  §8 and `docs/developers-guide.md` "Source-span helpers".
- Never pass regex or string indexes from `maskedText` directly to
  `spanFromOffsets`. Convert UTF-16 text indexes to UTF-8 byte offsets with the
  local helper specified in "Interfaces and dependencies" first.
- Metadata field classification is out of scope. This task records whether the
  value after `export const meta =` is an object literal, a non-object
  expression, an unterminated object, or missing. It must not emit
  `odw/meta-name`, `odw/meta-description`,
  `odw/meta-statically-unprovable`, or `odw/claude-pure-meta`. Roadmap task
  2.1.3 owns those diagnostics.
- The missing-meta diagnostic is in scope because no real
  `export const meta =` declaration means static extraction failed. Emit
  `odw/meta-required` at the empty span `0..0`.
- Unsupported syntax detection is in scope only for real top-level `import`
  tokens and extra top-level `export` tokens in masked code after blanking the
  `export` keyword of the real metadata declaration. Ignore tokens inside
  strings, comments, whole templates, regex literals, and nested block depth.
- Top-level dynamic `import(...)` reports `odw/no-import-export` in this slice.
  ODW's current loader rejects masked top-level `import` tokens, and the body
  parser that could classify import expressions is deferred.
- Every work item below is independently committable and must pass its focused
  validation plus the repository gates before the next item starts.
- Format only changed files. For Markdown changed by a work item, run
  `mdtablefix` and `markdownlint-cli2 --fix` on the specific changed Markdown
  paths. For TypeScript changed by a work item, run Biome formatting only on
  the changed TypeScript paths after those paths exist. Do not run repo-global
  mutating formatters such as `make fmt`, `bun fmt`, or `mdformat-all`.
- Every work item updates this ExecPlan before its commit. At minimum, update
  `Progress`. Also update `Surprises & Discoveries`, `Decision Log`, `Risks`,
  `Outcomes & Retrospective`, and the revision note when assumptions,
  evidence, or scope change.
- Because every work item updates this ExecPlan, every work item includes a
  Markdown change and must run file-scoped Markdown formatting for
  `docs/execplans/roadmap-2-1-2.md`.
- Run `make all`, `make markdownlint`, and `make nixie` before each work-item
  commit. `make all` includes the `typecheck` target on current `origin/main`.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances

- Scope: stop and escalate if implementation requires the static metadata
  parser from 2.1.3, the hostile metadata execution regression from 2.1.5, the
  SWC parser adapter from 2.2.1, body normalization from 2.2.2, CLI behaviour,
  configuration, fixes, or ODW loader parity execution.
- File count: stop and escalate if functional work needs more than one new
  production module, two new static-analysis test files, one edit to
  `tests/static-analysis/source-mask-fixtures.test.ts`, public export updates,
  this ExecPlan, `docs/developers-guide.md`, and `docs/roadmap.md`.
- Public API: stop and escalate before renaming or removing any existing export
  from `src/index.ts` or `src/static-analysis/index.ts`.
- Dependencies: stop and escalate before adding or upgrading any package
  dependency, including parser, lexer, glob, snapshot, import-graph, or schema
  helpers.
- Runtime boundary: stop immediately if production code would need to import,
  call, or execute ODW runtime code, workflow files, `new Function`, `eval`,
  dynamic imports of workflow source, or primitive factories.
- Behaviour ambiguity: stop and escalate if `docs/technical-design.md`,
  `docs/roadmap.md`, committed fixtures, and current ODW loader evidence imply
  different visible results for a valid ODW example or an unsupported
  import/export fixture.
- Span contract: stop and escalate if any scanner span cannot be represented as
  a valid UTF-8 byte offset accepted by `spanFromOffsets`.
- Complexity: stop and refactor inside the current work item if any new
  production function exceeds the configured Oxlint complexity threshold of 8,
  nesting depth exceeds 3, or any tracked TypeScript source or test file would
  exceed 400 physical lines.
- Testing attempts: stop and escalate if the same focused test still fails for
  the same reason after three implementation attempts.
- Formatting: if a formatter rewrites unrelated files, park that churn in a
  named discard stash using
  `df12-stash v1 task=2.1.2 kind=discard reason="<short>"`, restore the
  intended file set, and re-run only file-scoped formatting.
- Time: stop and escalate if any work item takes more than one focused working
  day.

## Risks

- Risk: string-index scanning over masked source could produce byte-invalid
  diagnostic spans when non-ASCII source appears before a token.
  Severity: high.
  Likelihood: medium.
  Mitigation: all span construction flows through
  `spanFromTextIndexes(sourceFile, startIndex, endIndex)`, and work item 1 adds
  non-ASCII-before-token tests for metadata declaration spans.

- Risk: ODW's current runtime loader rejects any masked `import` or `export`
  token after blanking the metadata `export`, while the `odw-lint` design says
  unsupported top-level imports or exports.
  Severity: medium.
  Likelihood: medium.
  Mitigation: implement the documented `odw-lint` top-level scanner, cover the
  committed invalid fixtures exactly, and record the ODW loader difference as a
  parity point for roadmap task 2.3.1 if nested cases appear.

- Risk: A scanner could find a `{` later in the body after computed metadata
  such as `export const meta = makeMeta();`.
  Severity: high.
  Likelihood: medium.
  Mitigation: after the `=` token, inspect the next non-whitespace masked token
  and record `"non-object-expression"` when it is not `{`; do not search ahead
  for a later brace. Leave the diagnostic decision to task 2.1.3.

- Risk: Unsupported syntax spans drift from fixture manifests.
  Severity: high.
  Likelihood: medium.
  Mitigation: drive tests from
  `tests/static-analysis/fixtures/invalid-workflows/manifests/unsupported-import-export.ts`
  and compare emitted `rule`, `severity`, `message`, `span`, and `spanText`
  against the manifest.

- Risk: The envelope scanner duplicates source-mask logic and diverges from
  task 2.1.1.
  Severity: high.
  Likelihood: low.
  Mitigation: treat `maskNonCodeSource` as the only inert-region source, and
  replace the test-only probe in
  `tests/static-analysis/source-mask-fixtures.test.ts` with the production
  scanner once the scanner has equivalent coverage.

- Risk: Public exports grow accidentally or hide a breaking change.
  Severity: medium.
  Likelihood: low.
  Mitigation: update `tests/diagnostics/public-api-fixtures.ts` deliberately
  only in work item 2 and run the public API surface tests plus `make all`.

## Progress

- [x] (2026-07-01T10:52:35Z) Drafted the first planning round for roadmap task
  2.1.2 after GrepAI, Leta, local docs, current source, sibling ODW source,
  locked dependency, Bun docs, and existing fixture research.
- [x] (2026-07-01T11:03:53Z) Revised the ExecPlan for planning round 2 to add
  a UTF-16-to-UTF-8 span conversion contract, defer public exports until the
  metadata value state union is complete, and require relative internal imports
  from production scanner modules.
- [x] (2026-07-01T13:42:00Z) Work item 1: Built the byte-indexed metadata
  declaration scanner and covered missing metadata, Unicode-before-metadata
  spans, inert decoys, and runtime freezing.
- [x] (2026-07-01T13:42:00Z) Work item 2: Completed metadata value states,
  exported the envelope API, and updated public package boundary coverage.
- [x] (2026-07-01T13:42:00Z) Work item 3: Emitted source-ordered
  `odw/no-import-export` diagnostics and matched unsupported fixture manifests
  for rule, severity, message, span, and span text.
- [x] (2026-07-01T13:42:00Z) Work item 4: Replaced fixture probes with
  production envelope corpus
  coverage.
- [x] (2026-07-01T13:42:00Z) Work item 5: Documented the envelope scanner
  contract and closed roadmap task 2.1.2.

## Surprises & discoveries

- Observation: Leta initially failed with
  `error: unexpected argument 'tests' found` when multiple paths were passed to
  `leta files`, after the worktree was already registered.
  Evidence: `leta workspace add ... && leta files src tests docs` rejected the
  extra path arguments. `leta files src` and `leta grep ...` then succeeded.
  Impact: Leta is available for branch-local TypeScript navigation, but pass
  one path at a time.

- Observation: Current `origin/main` and this branch have no semantic code
  diff.
  Evidence: `sem diff --from origin/main --to HEAD` reported
  `No changes detected.`.
  Impact: this plan starts from the main-branch source state.

- Observation: The repository already has a test-only envelope probe in
  `tests/static-analysis/source-mask-fixtures.test.ts`.
  Evidence: the file defines `probeMaskedEnvelope`,
  `META_EXPORT_PATTERN`, `IMPORT_EXPORT_PATTERN`, and helper functions that
  use `maskNonCodeSource` and TypeScript only for masking fixture assertions.
  Impact: the implementation should promote the production-worthy envelope
  responsibility into `src/static-analysis/` and remove or shrink the duplicate
  test-only probe.

- Observation: `maskNonCodeSource` preserves UTF-16 string indexes, while
  `spanFromOffsets` requires UTF-8 byte offsets.
  Evidence: `src/static-analysis/source-mask.ts` builds `maskedText` with
  `sourceText.split("")` and advances by JavaScript string indexes;
  `docs/developers-guide.md` "Source-span helpers" and
  `docs/technical-design.md` §8 require zero-based UTF-8 byte offsets.
  Impact: the scanner needs an explicit text-index-to-byte-offset conversion
  helper and Unicode span tests before any diagnostic spans are trusted.

- Observation: The locked project does not include `@swc/core`.
  Evidence: `package.json` lists no `@swc/core`; `bun.lock` resolves Biome
  2.5.1, Bun types 1.3.14, Fast-check 4.8.0, Oxlint 1.71.0, and TypeScript
  5.9.3.
  Impact: do not rely on SWC for task 2.1.2. Body parsing begins in task
  2.2.1.

- Observation: Current ODW loader source at sibling commit `ecc4867` extracts
  `export const meta` from masked source, slices the metadata literal from the
  original source, evaluates it with `new Function`, blanks only the metadata
  `export` keyword, and then rejects any remaining masked `import` or `export`
  token.
  Evidence: sibling checkout file `<open-dynamic-workflows>/src/loader.ts`
  functions `extractMeta`, `matchBrace`, and `maskNonCode`.
  Impact: `odw-lint` mirrors the non-executing masked-source extraction shape
  and forbidden import/export intent, but it must not mirror ODW's metadata
  evaluation or production imports.

- Observation: Firecrawl verified official Bun and Biome command behaviour used
  by this plan.
  Evidence: Firecrawl scraped Bun's test runner docs showing `bun test`, file
  filters, non-zero exit on failure, snapshot testing, and
  `--update-snapshots`; it scraped Biome's CLI reference showing `biome format`
  accepts paths and `biome check` / `biome ci` run formatting, linting, and
  import sorting checks.
  Impact: focused test and formatter commands are source-backed and
  path-scoped.

- Observation: `leta show createOriginalSourceFile` failed with
  `Error: EOF while parsing a value at line 1 column 0`, while `leta grep`,
  `leta files`, and `leta show` for other symbols worked.
  Evidence: branch-local helper code was then inspected directly in
  `src/static-analysis/source-file.ts`, `source-position.ts`, and
  `types.ts`.
  Impact: implementation continued with bounded local evidence rather than
  treating the transient Leta display failure as a blocker.

- Observation: Keeping all scanner helpers in
  `src/static-analysis/workflow-envelope.ts` exceeded the executable 400-line
  TypeScript file-size gate.
  Evidence: `wc -l src/static-analysis/workflow-envelope.ts` reported 509
  lines before type extraction and 422 lines before moving text-index
  conversion.
  Impact: the workflow-specific type contract moved into the existing
  `src/static-analysis/types.ts`, and UTF-16 text-index to UTF-8 byte-offset
  conversion moved into the existing source-position helper module.

- Observation: CodeRabbit caught that the missing-value body span used
  `assignmentEndIndex` as a byte offset.
  Evidence: `coderabbit review --agent` reported a high-severity finding for
  `src/static-analysis/workflow-envelope.ts` lines 213-236.
  Impact: `bodyStartOffset` now converts the empty missing-value text index
  through `spanFromTextIndexes`, and
  `tests/static-analysis/workflow-envelope.test.ts` covers a Unicode prefix
  before `export const meta =`.

- Observation: CodeRabbit also caught false positives in the unsupported
  import/export detector for top-level property access such as
  `import.meta.url` and `workflow.export.value`.
  Evidence: the follow-up `coderabbit review --agent` reported high-severity
  findings for `src/static-analysis/workflow-envelope.ts` around lines 223 and
  288.
  Impact: unsupported detection now checks declaration/import-expression context
  before reporting, and regression coverage asserts that top-level property
  access is not reported.

- Observation: Moving the unsupported import/export scanner into a colocated
  feature module was necessary after the context-aware detector grew the scanner
  past the file-size limit.
  Evidence: `wc -l src/static-analysis/workflow-envelope.ts` reported 461 lines
  before the split, then 324 lines after moving unsupported-syntax scanning into
  `src/static-analysis/workflow-envelope-unsupported.ts`.
  Impact: `workflow-envelope.ts` owns envelope assembly and metadata values,
  while `workflow-envelope-unsupported.ts` owns unsupported syntax collection.

- Observation: CodeRabbit caught that ASI-style line boundaries were invisible
  to the unsupported import/export detector after whitespace skipping.
  Evidence: the final `coderabbit review --agent` pass reported a high-severity
  finding for `src/static-analysis/workflow-envelope-unsupported.ts` line 112.
  Impact: the detector now records whether the backward scan crossed a line
  break before the previous code character, and regression coverage asserts
  that an extra export after an automatic semicolon insertion boundary is
  reported.

- Observation: CodeRabbit caught that `bodySpan` started at the metadata object
  close brace instead of the end of the complete metadata statement.
  Evidence: the final `coderabbit review --agent` pass reported a
  medium-severity finding for `src/static-analysis/workflow-envelope.ts` line
  76.
  Impact: `bodySpan` now starts after the full top-level metadata statement,
  and tests assert that the body does not include the metadata semicolon.

- Observation: CodeRabbit caught that the metadata declaration search accepted
  nested `export const meta =` declarations.
  Evidence: the final `coderabbit review --agent` pass reported a major finding
  for `src/static-analysis/workflow-envelope.ts` around lines 88-109.
  Impact: metadata matching now walks masked source at top-level delimiter depth
  only, and tests assert that a nested declaration is ignored in favour of the
  real workflow top-level declaration.

- Observation: CodeRabbit caught that top-level `import.meta` was still treated
  like an unsupported import statement.
  Evidence: the final `coderabbit review --agent` pass reported a minor finding
  for `src/static-analysis/workflow-envelope-unsupported.ts` around lines
  94-105.
  Impact: the import detector now skips `import.meta` while still reporting
  top-level dynamic `import(...)`, with both cases covered in scanner tests.

- Observation: The last CodeRabbit pass re-reported two already-fixed concerns
  and identified three remaining test and scanner refinements.
  Evidence: `bodyStartOffset` already converts the statement-end text index
  through `spanFromTextIndexes`, and the decision log already records
  `spanFromTextIndexes` ownership in `source-position.ts`; the same pass also
  flagged same-line `}` import/export boundaries, statement-end fallback
  coverage, and over-broad missing-metadata snapshots.
  Impact: no production or ownership change was needed, but unsupported
  import/export diagnostic summaries now pin the message as well as rule,
  severity, and span text, same-line closing braces count as top-level statement
  starts, statement scanner tests cover end-of-string and empty input fallbacks,
  and the missing-metadata snapshot uses a stable diagnostic projection.

- Observation: A further CodeRabbit pass caught that line-break fallback needed
  to be ASI-aware.
  Evidence: `coderabbit review --agent` reported a high-severity finding for
  `src/static-analysis/workflow-envelope-statement.ts` lines 24-25 and follow-up
  coverage gaps in statement-boundary tests.
  Impact: top-level statement scanning now checks significant characters around
  a line break before treating it as a statement end, covers multiline
  assignment and member-chain continuations, treats `export const meta =;` as a
  missing value, recognises Unicode line separators in unsupported syntax
  boundary checks, and uses an explicit missing-metadata assertion instead of a
  broad snapshot.

- Observation: CodeRabbit caught one remaining ASI continuation case after the
  first ASI fix.
  Evidence: `coderabbit review --agent` reported that a line break after an
  arrow token (`=>`) was still treated as a statement boundary, and asked for
  fixture-corpus guards.
  Impact: statement scanning now treats arrow bodies as continued statements,
  regression tests cover that shape, and fixture corpus suites assert that the
  manifest arrays are non-empty before their parameterized cases.

- Observation: The next review pass found lower-severity boundary refinements
  and one out-of-scope metadata-first suggestion.
  Evidence: `coderabbit review --agent` asked for comma/comparison continuation
  cases, non-zero statement-start coverage, code-point-aware unsupported keyword
  boundaries, and a metadata-first top-level contract.
  Impact: statement scanning now treats commas and comparison operators as
  line-continuation markers, tests cover non-zero statement starts, unsupported
  keyword boundary checks use whole Unicode code points, and metadata-first
  enforcement remains deferred because this slice intentionally emits only
  `odw/meta-required` and `odw/no-import-export` diagnostics.

- Observation: CodeRabbit's next pass found only low-severity maintainability
  and continuation coverage gaps.
  Evidence: `coderabbit review --agent` asked for leading-operator continuation
  coverage, removal of redundant arrow-token special-casing, and a shared
  unsupported-diagnostic expectation constant.
  Impact: leading `&&` continuation is covered, arrow continuation now follows
  the same `>` continuation set entry as comparison expressions, and
  unsupported diagnostic assertions share one expected message/rule/severity
  object.

- Observation: The following review pass found a performance risk in ASI
  fallback scanning and a metadata expression span edge case.
  Evidence: `coderabbit review --agent` reported repeated next-significant
  rescans in `workflow-envelope-statement.ts`, a trailing semicolon in
  non-object metadata expression spans, and missing helper coverage.
  Impact: statement scanning now precomputes next-significant characters once,
  tracks the previous significant character during the main scan, trims trailing
  statement terminators from non-object metadata expression spans, and tests
  cover unmatched `}` and `]` clamping plus exported depth helper behaviour.

## Decision Log

- Decision: Implement task 2.1.2 with an owned masked-text envelope scanner and
  no new parser dependency.
  Rationale: `docs/technical-design.md` §§5, 6.2, 6.4, and ADR 0001 require
  non-executing `odw-lint` ownership. `@swc/core` is not locked yet and is
  explicitly sequenced to task 2.2.1.
  Date/Author: 2026-07-01T10:52:35Z / Codex.

- Decision: Keep work item 1 internal and export the scanner only after work
  item 2 defines complete metadata value states.
  Rationale: exporting optional `metaValueSpan` or `bodySpan` before
  distinguishing missing, non-object, and unterminated values would make the
  public contract ambiguous for tests and downstream code.
  Date/Author: 2026-07-01T11:03:53Z / Codex.

- Decision: Convert masked-source text indexes to UTF-8 byte offsets inside
  static-analysis source-position helpers.
  Rationale: the scanner is the first consumer that starts from UTF-16
  `maskedText` matches. Keeping the helper inside `source-position.ts` avoids
  widening the public package facade while preserving one owner for source
  offset conversion.
  Date/Author: 2026-07-01T11:03:53Z / Codex.

- Decision: Keep `spanFromTextIndexes` internal to the static-analysis source
  helper layer, but place it in `src/static-analysis/source-position.ts`
  instead of `workflow-envelope.ts`.
  Rationale: the helper belongs to source-position ownership, and moving it to
  an existing helper module kept the new scanner below the 400-line source-file
  gate without adding a second production scanner module or widening the
  package facade.
  Date/Author: 2026-07-01T13:42:00Z / Codex.

- Decision: Production scanner code must use relative imports instead of
  importing from `"odw-lint"`.
  Rationale: `"odw-lint"` resolves through `src/index.ts`, which re-exports
  `src/static-analysis/index.ts`. Self-importing through that package entry
  would create an avoidable facade cycle. Public-consumer tests may still
  import from `"odw-lint"`.
  Date/Author: 2026-07-01T11:03:53Z / Codex.

- Decision: Emit only `odw/meta-required` and `odw/no-import-export`
  diagnostics in this slice.
  Rationale: task 2.1.2 owns finding the metadata declaration and unsupported
  imports/exports. Metadata value diagnostics belong to task 2.1.3, and body
  syntax belongs to task 2.2.1.
  Date/Author: 2026-07-01T10:52:35Z / Codex.

- Decision: Treat top-level dynamic `import(...)` as an unsupported import
  token for now, but do not scan nested block depth.
  Rationale: ODW's current loader rejects masked `import` tokens broadly, but
  `docs/technical-design.md` §9.1 frames the rule as unsupported top-level
  import/export. This catches top-level import hazards without pretending to
  parse body semantics before task 2.2.1.
  Date/Author: 2026-07-01T10:52:35Z / Codex.

- Decision: Keep unsupported import/export scanning in
  `src/static-analysis/workflow-envelope-unsupported.ts` as an internal
  feature module.
  Rationale: context-aware unsupported detection is substantial enough to exceed
  the 400-line gate if kept in `workflow-envelope.ts`, but it is still owned by
  the workflow-envelope feature and should not become a generic source helper.
  Date/Author: 2026-07-01T14:18:00Z / Codex.

- Decision: Keep machine-specific checkout paths out of this reusable ExecPlan.
  Rationale: the workflow runner supplies the concrete assigned worktree, while
  the plan should remain readable and portable for later agents and review
  tooling.
  Date/Author: 2026-07-01T14:43:00Z / Codex.

- Decision: Share top-level statement and delimiter-depth scanning through
  `src/static-analysis/workflow-envelope-statement.ts`.
  Rationale: metadata body spans and unsupported import/export diagnostics need
  the same statement boundary semantics. A small workflow-envelope-owned helper
  avoids duplicate boundary logic without making it a generic source helper.
  Date/Author: 2026-07-01T15:06:00Z / Codex.

## Outcomes & Retrospective

Implemented `scanWorkflowEnvelope` as a non-executing masked-source scanner.
It finds the real `export const meta =` declaration outside inert source
regions, records declaration and metadata value spans in original UTF-8 byte
offsets, distinguishes object, non-object expression, unterminated object, and
missing value states, emits `odw/meta-required` for missing metadata, and emits
source-ordered `odw/no-import-export` diagnostics for unsupported top-level
imports and extra exports.

Validation evidence before the full gate:

```plaintext
bunx tsc --noEmit
bun run lint:biome
bun run lint:oxlint
bun test ./tests/static-analysis/workflow-envelope.test.ts \
  ./tests/static-analysis/workflow-envelope-fixtures.test.ts \
  ./tests/static-analysis/source-mask-fixtures.test.ts \
  ./tests/static-analysis/boundary.test.ts \
  ./tests/diagnostics/public-api-surface.test.ts

Result: typecheck, Biome, Oxlint, and 46 focused tests passed.
```

CodeRabbit follow-up addressed the missing-value body span byte/text mismatch,
aligned the ExecPlan with `source-position.ts` ownership for
`spanFromTextIndexes`, expanded unsupported import/export diagnostic
assertions to include rule and severity, added a missing-metadata diagnostic
snapshot, and extracted fixture scan setup helpers.

A second CodeRabbit follow-up addressed property-access false positives in the
unsupported detector, added focused snapshot coverage for unsupported
diagnostics, moved shared scanned-envelope assertions into test support, and
parameterized fixture corpus checks for per-fixture isolation.

A third CodeRabbit follow-up addressed ASI line-boundary detection, moved
`bodySpan` to the end of the complete metadata statement, removed hard-coded
machine paths from this ExecPlan, threaded unsupported statement-end indexes
without recomputation, and shared source-span text helpers across envelope
tests.

A final CodeRabbit follow-up addressed nested metadata false positives,
`import.meta` false positives, British-English snapshot guidance, and shared
top-level statement scanning between envelope and unsupported-syntax modules.

The last review pass also tightened sticky metadata matching, anchored
unsupported keywords so `import$` and `exporté` are not treated as keywords,
added table-driven statement-boundary tests for CRLF and delimiter edge cases,
removed redundant diagnostic assertions where a snapshot already pins the
shape, pinned envelope span-helper imports to `source-position.ts`, and added
message assertions to unsupported import/export diagnostic summaries. The
subsequent review pass added same-line closing-brace boundary handling, tighter
statement-boundary fallback tests, and a projected missing-metadata snapshot.
A later ASI-focused pass replaced that projected snapshot with an explicit
assertion, added multiline continuation handling to the statement scanner,
treated a bare metadata semicolon as a missing value, and recognised Unicode
line separators while checking unsupported import/export statement starts. The
next review pass added arrow-body continuation handling and non-empty fixture
corpus guards. The following pass added comma and comparison line-continuation
handling, non-zero statement-start coverage, and code-point-aware unsupported
keyword boundary checks. Metadata-first enforcement remains outside this slice
until the diagnostic catalogue has a dedicated rule for that public behaviour.
The final low-severity follow-up added leading-operator continuation coverage,
removed redundant arrow-token special-casing, and deduplicated unsupported
diagnostic expectations in scanner tests.
The subsequent follow-up made ASI fallback scanning linear, trimmed non-object
metadata expression terminators, and added direct depth-helper regression tests.

Remaining scope is deliberately deferred: metadata field classification still
belongs to roadmap task 2.1.3, hostile metadata side-effect regression coverage
belongs to 2.1.5, and body parsing still belongs to 2.2.1.

## Context and orientation

The current static-analysis package entry is `src/static-analysis/index.ts`,
re-exported by `src/index.ts`. Source-file construction lives in
`src/static-analysis/source-file.ts`, source masking lives in
`src/static-analysis/source-mask.ts`, source-span helpers live in
`src/static-analysis/source-position.ts` and
`src/static-analysis/source-snippet.ts`, and shared static-analysis types live
in `src/static-analysis/types.ts`.

The scanner adds `src/static-analysis/workflow-envelope.ts` for envelope assembly
and `src/static-analysis/workflow-envelope-unsupported.ts` for unsupported
syntax collection. It exposes one public entry point named `scanWorkflowEnvelope`
that accepts
`OriginalSourceFile` and returns an immutable result. Keep the implementation
concrete and small; do not introduce a generic parser abstraction.

Use these terms consistently:

- "Original source" means the exact workflow text as read from a file or
  future standard input.
- "Masked source" means `maskNonCodeSource(sourceFile).maskedText`, where
  comments, strings, whole templates, and regex literals are blanked but
  JavaScript string indexes and line terminators remain aligned.
- "Text index" means a UTF-16 JavaScript string index into `sourceText` or
  `maskedText`.
- "Byte offset" means a zero-based UTF-8 byte offset into original source, as
  required by diagnostics.
- "Envelope" means the source facts around `export const meta =`, the metadata
  value state, the source span available for future body parsing, and envelope
  diagnostics.
- "Metadata classification" means checking `meta.name`, `meta.description`,
  pure literal status, ODW runtime-invalid status, and Claude compatibility.
  That is not part of this plan.

The relevant fixture surfaces are:

- valid copied examples under `tests/static-analysis/fixtures/odw-examples/`;
- invalid unsupported import/export fixtures under
  `tests/static-analysis/fixtures/invalid-workflows/unsupported-import-export/`;
- invalid fixture manifests under
  `tests/static-analysis/fixtures/invalid-workflows/manifests/`;
- masking fixtures under `tests/static-analysis/fixtures/masking/`; and
- current test-only masking probe in
  `tests/static-analysis/source-mask-fixtures.test.ts`.

## Interfaces and dependencies

All production imports in `src/static-analysis/workflow-envelope.ts` must be
relative internal imports. The module must not import from `"odw-lint"`.
Use this shape:

```ts
import { makeRuleId } from "../diagnostics/rule-id";
import type { Diagnostic, SourceSpan } from "../diagnostics/types";
import { maskNonCodeSource } from "./source-mask";
import { spanFromOffsets } from "./source-file";
import type { OriginalSourceFile } from "./types";
```

Public-consumer tests such as `tests/static-analysis/boundary.test.ts` and
`tests/diagnostics/public-api-surface.test.ts` should continue importing from
`"odw-lint"` because they intentionally verify the package entry.

Define these types in `src/static-analysis/types.ts` by the end of work item
2, and export `scanWorkflowEnvelope` from
`src/static-analysis/workflow-envelope.ts`:

```ts
export type WorkflowEnvelopeScanResult =
  | {
      readonly status: "missing-meta";
      readonly sourceFile: OriginalSourceFile;
      readonly diagnostics: readonly Diagnostic[];
      readonly envelope: undefined;
    }
  | {
      readonly status: "scanned";
      readonly sourceFile: OriginalSourceFile;
      readonly diagnostics: readonly Diagnostic[];
      readonly envelope: WorkflowEnvelope;
    };

export type WorkflowEnvelope = {
  readonly sourceFile: OriginalSourceFile;
  readonly metaDeclarationSpan: SourceSpan;
  readonly metaExportKeywordSpan: SourceSpan;
  readonly metaAssignmentOperatorSpan: SourceSpan;
  readonly metaValue: WorkflowMetaValue;
  readonly bodySpan: SourceSpan;
  readonly unsupportedDeclarations: readonly UnsupportedWorkflowSyntax[];
};

export type WorkflowMetaValue =
  | {
      readonly kind: "object";
      readonly span: SourceSpan;
      readonly openBraceSpan: SourceSpan;
      readonly closeBraceSpan: SourceSpan;
    }
  | {
      readonly kind: "non-object-expression";
      readonly expressionStartSpan: SourceSpan;
      readonly expressionSpan: SourceSpan;
    }
  | {
      readonly kind: "unterminated-object";
      readonly openBraceSpan: SourceSpan;
      readonly span: SourceSpan;
    }
  | {
      readonly kind: "missing-value";
      readonly span: SourceSpan;
    };

export type UnsupportedWorkflowSyntax = {
  readonly kind: "import" | "export";
  readonly keyword: "import" | "export";
  readonly span: SourceSpan;
  readonly sourceText: string;
};
```

The internal source-position span helper must exist before any scanner spans
are created:

```ts
const spanFromTextIndexes = (
  sourceFile: OriginalSourceFile,
  startIndex: number,
  endIndex: number,
): SourceSpan => {
  const startOffset = byteOffsetFromTextIndex(sourceFile, startIndex);
  const endOffset = byteOffsetFromTextIndex(sourceFile, endIndex);

  return spanFromOffsets(sourceFile, startOffset, endOffset);
};
```

`byteOffsetFromTextIndex` remains private to `source-position.ts`. It must
validate integer bounds, reject indexes in the middle of a surrogate pair,
compute UTF-8 byte length from `sourceFile.sourceText.slice(0, index)`, and
return a byte offset accepted by `spanFromOffsets`. Use `TextEncoder` or an
equivalent explicit UTF-8 width scan; do not use `index` as the byte offset.
Tests must prove this with non-ASCII text before the token being spanned.

Locked and external tool behaviour used by this plan:

- `bun.lock` pins Biome 2.5.1, Bun types 1.3.14, Fast-check 4.8.0, Oxlint
  1.71.0, and TypeScript 5.9.3. The local commands report Bun 1.3.11, Biome
  2.5.1, TypeScript 5.9.3, and Oxlint 1.71.0.
- Firecrawl verified official Bun test documentation for `bun test`, path
  filters, non-zero exit on failure, snapshot testing, and
  `bun test --update-snapshots`.
- Firecrawl verified official Biome CLI documentation for path-scoped
  `biome format` and checking commands.
- Sibling ODW source evidence is `<open-dynamic-workflows>/src/loader.ts` at
  commit `ecc4867`. It is source evidence only; production `odw-lint` code must
  not import it.

## Plan of work

### Work item 1: Build internal byte-indexed metadata declaration scanner

Read before starting:

- `docs/terms-of-reference.md` §§1, 5, 6, 8, and 9.
- `docs/technical-design.md` §§5, 6.1, 6.2, 6.4, 8, 9.1, 11.1, 11.3, 12.1,
  and 15.
- `docs/adr/0001-static-analysis-boundary.md` "Decision" and "Consequences".
- `docs/developers-guide.md` "Static-Analysis Boundary", "Tests", "Workflow
  Fixture Corpus", and "Source-span helpers".
- `docs/scripting-standards.md` for script and Bun conventions.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` for extraction
  heuristics if scanner helpers start growing.
- `AGENTS.md` "Change Quality & Committing" and "TypeScript Guidance".

Load and follow these skills:

- `execplans` for living-plan updates.
- `grepai` for intent search before code navigation.
- `leta` for branch-local symbols.
- `biome-typescript` for TypeScript formatting and lint expectations.
- `en-gb-oxendict-style` for prose and comments.

Add `src/static-analysis/workflow-envelope.ts`, but do not export it from
`src/static-analysis/index.ts` or `src/index.ts` yet. Define the internal
`spanFromTextIndexes` source-position helper first. Then
implement the first internal `scanWorkflowEnvelope(sourceFile)` behaviour:

- call `maskNonCodeSource(sourceFile)`;
- find only a real masked `export const meta =` declaration;
- record `metaDeclarationSpan`, `metaExportKeywordSpan`, and
  `metaAssignmentOperatorSpan` through `spanFromTextIndexes`;
- emit `odw/meta-required` at `0..0` when no real declaration exists; and
- freeze returned arrays and objects.

The result shape may be module-exported for internal tests, but it must not be
re-exported through the package facades until work item 2 completes the
metadata value state union.

Add `tests/static-analysis/workflow-envelope.test.ts` with red-green unit tests
for:

- a source with no real metadata declaration returning exactly one
  `odw/meta-required` diagnostic at `0..0`;
- a real `export const meta =` declaration returning declaration, export
  keyword, and assignment spans in original-source byte coordinates;
- a source with `café`, `雪`, or an astral-plane character before the real
  `export const meta =` declaration proving spans use UTF-8 bytes rather than
  UTF-16 indexes;
- a decoy `export const meta =` in a line comment, block comment, string,
  whole template, and regex not being treated as the real declaration; and
- result arrays and nested facts being frozen at runtime.

Do not add snapshot tests in this work item. Do not parse metadata field
values. Do not update public API fixtures in this work item.

Focused validation for this work item:

```sh
bunx @biomejs/biome format --write \
  src/static-analysis/workflow-envelope.ts \
  tests/static-analysis/workflow-envelope.test.ts
bun test ./tests/static-analysis/workflow-envelope.test.ts
mdtablefix docs/execplans/roadmap-2-1-2.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-2.md
make all
make markdownlint
make nixie
```

Expected focused test result: the new workflow-envelope tests fail before
production code for missing `scanWorkflowEnvelope` or byte-incorrect spans,
then pass after the minimal implementation. `make all`, `make markdownlint`,
and `make nixie` pass.

### Work item 2: Complete metadata value states and export the envelope API

Read before starting:

- `docs/technical-design.md` §§6.1, 6.2, 6.3, 6.4, 8, and 9.1.
- `docs/developers-guide.md` "Source-span helpers".
- ODW source evidence in sibling checkout:
  `<open-dynamic-workflows>/src/loader.ts` functions `extractMeta` and
  `matchBrace` at commit `ecc4867`.

Load and follow these skills:

- `execplans`, `grepai`, `leta`, `biome-typescript`, and
  `en-gb-oxendict-style`.

Extend `scanWorkflowEnvelope` so the result uses the public state contract from
"Interfaces and dependencies":

- after the metadata `=` sign, find the next non-whitespace masked token;
- if no token exists, set `metaValue.kind` to `"missing-value"` with an empty
  span at end-of-file;
- if the token is `{`, match the closing `}` by brace depth over masked source
  and set `metaValue.kind` to `"object"`;
- if the object is unterminated, set `metaValue.kind` to
  `"unterminated-object"` and leave metadata diagnostics to 2.1.3;
- if that token is not `{`, set `metaValue.kind` to
  `"non-object-expression"` and do not search ahead for a later brace;
- set `bodySpan` to the half-open span from the end of the metadata object
  when available, or from the end of the declaration prefix or file when no
  object span exists, through end-of-file; and
- keep `diagnostics` limited to `odw/meta-required` in this work item.

Export `scanWorkflowEnvelope` and the public envelope types from
`src/static-analysis/index.ts` and `src/index.ts`. Update
`tests/diagnostics/public-api-fixtures.ts` and
`tests/static-analysis/boundary.test.ts` in the same work item. Production code
must continue using relative internal imports; only public-consumer tests should
import the scanner from `"odw-lint"`.

Update `tests/static-analysis/workflow-envelope.test.ts` with tests for:

- nested object and array braces inside metadata preserving the whole
  `metaValue.span`;
- comments and strings inside metadata not affecting brace matching;
- computed or non-object metadata producing `"non-object-expression"` and not
  stealing a later body brace;
- an unterminated metadata object producing `"unterminated-object"` without
  executing source;
- an empty declaration tail producing `"missing-value"`; and
- root package imports exposing the completed contract only after these states
  exist.

No property test is required in this work item. The source-mask property tests
already generate broad inert-region cases, and this scanner behaviour is
table-driven over known envelope states. Add a property test only if the
implementation introduces a generated helper whose invariant is clearer under
Fast-check than under table tests.

Focused validation for this work item:

```sh
bunx @biomejs/biome format --write \
  src/static-analysis/workflow-envelope.ts \
  src/static-analysis/index.ts \
  src/index.ts \
  tests/static-analysis/workflow-envelope.test.ts \
  tests/static-analysis/boundary.test.ts \
  tests/diagnostics/public-api-fixtures.ts
bun test \
  ./tests/static-analysis/workflow-envelope.test.ts \
  ./tests/static-analysis/boundary.test.ts \
  ./tests/diagnostics/public-api-surface.test.ts
mdtablefix docs/execplans/roadmap-2-1-2.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-2.md
make all
make markdownlint
make nixie
```

Expected focused test result: the new object-state tests fail before metadata
value scanning, then pass after implementation. The public API fixture changes
are intentional and reviewed by the public API surface test. The wider gates
pass.

### Work item 3: Emit exact unsupported import/export diagnostics

Read before starting:

- `docs/technical-design.md` §§6.2, 8, 9.1, 11.1, and 11.5.
- `docs/rules/no-import-export.md`.
- `tests/static-analysis/fixtures/invalid-workflows/manifests/unsupported-import-export.ts`.
- ODW loader evidence:
  `<open-dynamic-workflows>/src/loader.ts` `extractMeta` at commit `ecc4867`.

Load and follow these skills:

- `execplans`, `grepai`, `leta`, `biome-typescript`, and
  `en-gb-oxendict-style`.

Extend the scanner to collect top-level unsupported syntax from masked source:

- blank only the real metadata `export` keyword before scanning;
- walk masked source once while tracking `{}`, `[]`, and `()` depth;
- at top-level depth, find standalone `import` and `export` tokens;
- classify `export` tokens other than the real metadata export as
  `kind: "export"`;
- classify top-level `import` tokens, including top-level dynamic
  `import(...)`, as `kind: "import"`;
- compute every unsupported declaration span through `spanFromTextIndexes`;
- compute a diagnostic span from the keyword through the end of the unsupported
  top-level statement or declaration. Prefer a semicolon at zero nested depth;
  otherwise use the current line content end, matched block end for export
  function/class declarations, or end-of-file;
- create one `odw/no-import-export` diagnostic per unsupported declaration,
  severity `error`, message
  `Workflow body must not add top-level imports or exports.`, and the exact
  original source span; and
- keep diagnostics sorted by source order.

Update `tests/static-analysis/workflow-envelope.test.ts` with table tests for:

- a static top-level import before metadata;
- an extra `export const` after metadata;
- a top-level dynamic `import("...")`;
- non-ASCII text before an unsupported token proving unsupported diagnostics
  also use UTF-8 byte offsets;
- a nested `import` token inside a function body not being reported in this
  slice;
- an `export` token hidden in a string, comment, template, and regex not being
  reported; and
- multiple unsupported tokens producing source-ordered diagnostics.

Add `tests/static-analysis/workflow-envelope-fixtures.test.ts`. Drive the
unsupported fixture assertions from `UNSUPPORTED_IMPORT_EXPORT_FIXTURES`, read
each raw fixture, run `scanWorkflowEnvelope(createOriginalSourceFile(...))`,
and compare emitted diagnostics against each manifest diagnostic for `rule`,
`severity`, `message`, `span`, and `spanText`. Decode `spanText` from UTF-8
source bytes, as existing invalid fixture tests do.

Focused validation for this work item:

```sh
bunx @biomejs/biome format --write \
  src/static-analysis/workflow-envelope.ts \
  tests/static-analysis/workflow-envelope.test.ts \
  tests/static-analysis/workflow-envelope-fixtures.test.ts
bun test \
  ./tests/static-analysis/workflow-envelope.test.ts \
  ./tests/static-analysis/workflow-envelope-fixtures.test.ts
mdtablefix docs/execplans/roadmap-2-1-2.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-2.md
make all
make markdownlint
make nixie
```

Expected focused test result: the unsupported import/export tests fail before
diagnostic implementation, then pass with exact manifest spans. The wider gates
pass.

### Work item 4: Replace fixture probes with production envelope corpus coverage

Read before starting:

- `docs/roadmap.md` task 2.1.2.
- `docs/technical-design.md` §§11.1 and 15.
- `docs/developers-guide.md` "Workflow Fixture Corpus".
- `tests/static-analysis/source-mask-fixtures.test.ts`.
- `tests/static-analysis/fixtures/odw-examples.ts`.
- `tests/static-analysis/fixtures/masking.ts`.

Load and follow these skills:

- `execplans`, `grepai`, `leta`, `biome-typescript`, and
  `en-gb-oxendict-style`.

Replace the test-only probe in
`tests/static-analysis/source-mask-fixtures.test.ts` with calls to the
production scanner. The test should continue to prove that masking fixtures
locate the real metadata declaration and produce no envelope diagnostics as
their manifest expects. Because production scanner intentionally does not parse
`meta.name`, assert the real `metaDeclarationSpan`, empty diagnostics, and
manifest `expectedDiagnostics`; move the metadata-name assertion to task 2.1.3.

Extend `tests/static-analysis/workflow-envelope-fixtures.test.ts` so it also
drives valid copied ODW examples from `ODW_EXAMPLE_FIXTURE_SNAPSHOTS`. For each
valid example:

- read the raw fixture text without importing it;
- construct an `OriginalSourceFile`;
- run `scanWorkflowEnvelope`;
- assert that envelope diagnostics are empty;
- assert that `metaDeclarationSpan` slices to text beginning with
  `export const meta =`; and
- assert that `bodySpan` is within the original file.

Add a concise Bun snapshot only if it improves review quality. If added, the
snapshot should normalise to stable file paths, metadata declaration text, and
diagnostic summaries. Do not list the optional snapshot path in formatter or
lint commands; rely on `make all` and `make markdownlint` after Bun creates or
updates it.

Focused validation for this work item:

```sh
bunx @biomejs/biome format --write \
  tests/static-analysis/source-mask-fixtures.test.ts \
  tests/static-analysis/workflow-envelope-fixtures.test.ts
bun test \
  ./tests/static-analysis/source-mask-fixtures.test.ts \
  ./tests/static-analysis/workflow-envelope-fixtures.test.ts
mdtablefix docs/execplans/roadmap-2-1-2.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-2.md
make all
make markdownlint
make nixie
```

If a snapshot is intentionally added or changed, use Bun's source-backed
command verified from official documentation:

```sh
bun test --update-snapshots ./tests/static-analysis/workflow-envelope-fixtures.test.ts
```

Expected focused test result: the masking and valid-example corpus tests fail
before the production scanner replaces the probe, then pass. The wider gates
pass.

### Work item 5: Document the envelope scanner contract and close roadmap task 2.1.2

Read before starting:

- `docs/documentation-style-guide.md` "Spelling", "Markdown rules",
  "Diagrams", and "Architectural decision records".
- `docs/developers-guide.md` "Static-Analysis Boundary", "Tests", "Workflow
  Fixture Corpus", and "Source-span helpers".
- `docs/roadmap.md` task 2.1.2.
- `AGENTS.md` "Documentation Maintenance" and "Markdown Guidance".

Load and follow these skills:

- `execplans`.
- `en-gb-oxendict-style`.
- `biome-typescript` only if TypeScript files still need final import or
  formatting cleanup.

Update `docs/developers-guide.md` with a short "Workflow envelope scanner"
subsection under static-analysis guidance. It must state:

- the scanner accepts only `OriginalSourceFile`;
- production scanner code uses `maskNonCodeSource`;
- scanner spans are original-source UTF-8 byte offsets, even though masked
  source matching starts from UTF-16 string indexes;
- metadata value state is recorded but metadata field diagnostics are deferred
  to task 2.1.3; and
- production modules use relative internal imports, while public-consumer tests
  may import from `"odw-lint"`.

Update `docs/roadmap.md` task 2.1.2 from incomplete to complete only after the
previous work items and gates have passed. Add a concise completion note naming
the production scanner, exact unsupported import/export diagnostics, Unicode
span coverage, and deferred metadata classification. Do not add a new ADR
unless implementation changes the static-analysis ownership decision,
dependency policy, public behaviour beyond task 2.1.2, or long-term
architecture.

Focused validation for this work item:

```sh
mdtablefix \
  docs/execplans/roadmap-2-1-2.md \
  docs/developers-guide.md \
  docs/roadmap.md
bunx markdownlint-cli2 --fix \
  docs/execplans/roadmap-2-1-2.md \
  docs/developers-guide.md \
  docs/roadmap.md
make all
make markdownlint
make nixie
```

Expected result: documentation lint passes, `make all` still passes after the
roadmap and developer guide updates, and this ExecPlan's `Progress`,
`Outcomes & Retrospective`, and revision note reflect completion.

## Concrete steps

Start every work item from the assigned worktree:

```sh
cd "$ROADMAP_WORKTREE"
git status --short --branch
```

Before editing code in each work item, run a fresh intent search and
branch-local symbol check:

```sh
grepai search --workspace 'Projects' --project 'odw-lint' \
  "workflow envelope export const meta masked source span offsets unsupported import export" \
  --toon --compact
leta grep "(scanWorkflowEnvelope|maskNonCodeSource|spanFromOffsets|createOriginalSourceFile)" \
  "src/" -k function,constant,type,interface --head 80
```

If GrepAI, Leta, sem, or Firecrawl is unavailable, record the exact command and
failure in `Surprises & Discoveries`, continue from bounded local docs/source
evidence, and do not mark the plan blocked solely for that tooling failure.

The red-green-refactor loop for each code work item is:

1. Add or update the smallest tests that specify the work item.
2. Run the focused `bun test ...` command and confirm failure for the expected
   reason.
3. Make the smallest production change that satisfies the test.
4. Run the focused tests again and confirm pass.
5. Refactor only within the work item scope, then rerun focused tests and the
   listed gates.
6. Update this ExecPlan's living sections before committing the work item.

## Validation and acceptance

The full task is accepted when all of the following are true:

- `scanWorkflowEnvelope(createOriginalSourceFile(...))` finds a real
  `export const meta =` declaration outside inert source regions.
- All scanner spans are original-source UTF-8 byte offsets and pass
  `spanFromOffsets`, including sources with non-ASCII text before metadata or
  unsupported tokens.
- Missing metadata emits exactly one `odw/meta-required` diagnostic at `0..0`.
- Metadata value state distinguishes object, non-object expression,
  unterminated object, and missing value without executing source.
- Unsupported top-level import or extra export emits `odw/no-import-export`
  diagnostics matching committed fixture manifests for `rule`, `severity`,
  `message`, `span`, and `spanText`.
- Valid copied ODW example fixtures produce no envelope diagnostics.
- Masking fixtures use the production scanner instead of a test-only envelope
  probe.
- Production scanner modules use relative internal imports and do not import
  from `"odw-lint"` or ODW runtime paths.
- `docs/developers-guide.md` documents the scanner contract and
  `docs/roadmap.md` marks task 2.1.2 complete.

Final validation commands:

```sh
make all
make markdownlint
make nixie
```

Expected result: all three commands pass. `make all` includes dependency
installation, formatting check, whitespace hygiene, lint, typecheck, and Bun
tests on current `origin/main`.

## Idempotence and recovery

All work items are additive or narrowly replacing tests. Re-running focused
tests and gates is safe. If a work item fails after partial edits, inspect
`git diff`, update or revert only the files changed for that work item, and
rerun the focused test before moving on. Do not use `git reset --hard` or
`git checkout --` unless the user explicitly requests destructive recovery.

If a formatter rewrites unrelated files, park only that unrelated churn in a
named discard stash:

```sh
git stash push -m 'df12-stash v1 task=2.1.2 kind=discard reason="formatter unrelated churn"' -- <paths>
```

Then restore the intended file set and use file-scoped formatting commands.

## Artifacts and notes

Useful source-backed evidence gathered for this plan:

```plaintext
grepai search --workspace 'Projects' --project 'odw-lint' \
  "static export const meta extraction workflow envelope masked source byte offset diagnostics spanFromOffsets" \
  --toon --compact

Returned main-branch hits in src/static-analysis/types.ts,
src/static-analysis/source-file.ts, docs/rules/meta-required.md, and masking
fixtures. Branch-local facts were then verified with Leta and file inspection.
```

```plaintext
leta show createOriginalSourceFile
leta show maskNonCodeSource
leta show spanFromOffsets

Verified that createOriginalSourceFile records private indexes, maskNonCodeSource
returns maskedText aligned to JavaScript string indexes, and spanFromOffsets
requires valid UTF-8 byte offsets.
```

```plaintext
sem diff --from origin/main --to HEAD

No changes detected.
```

```plaintext
Firecrawl: https://bun.com/docs/cli/test

Verified bun test, path filters, non-zero failure exit, snapshot testing, and
--update-snapshots.
```

```plaintext
Firecrawl: https://biomejs.dev/reference/cli/

Verified Biome path-scoped format and check command behaviour.
```

## Revision note

2026-07-01 round-2 revision: rewrote the work-item boundaries so the first
slice stays internal, added a mandatory UTF-16 text-index to UTF-8 byte-offset
helper and Unicode span tests, defined the complete metadata value state union
before public export, and required relative internal imports for production
scanner modules. The remaining work is implementable without design ambiguity
and without beginning implementation in this planning task.
