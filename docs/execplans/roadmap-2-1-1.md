# Implement source masking for inert workflow syntax

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 2.1.1 adds the source masker that future ODW (Open Dynamic
Workflows) envelope scanning will use before looking for workflow syntax such
as `export const meta =`, extra `export`, extra `import`, and metadata braces.
The masker must replace inert source regions with spaces while leaving real
code and source positions aligned. Inert source regions are comments, quoted
strings, whole template literals, and regex literals.

After this plan is implemented, maintainers can run the default repository
gate and see that masking fixtures containing decoy workflow syntax produce no
test envelope diagnostics. Each fixture's manifest `metaName` will match the
real metadata declaration extracted from the original source, not from a
rewritten or evaluated copy. The change does not add the full metadata parser,
the full envelope scanner, the SWC parser adapter, the command-line interface,
or loader-parity execution.

## Constraints

- Work only in
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-1`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as the canonical integration branch.
- Use this GrepAI shape first for intent search against the canonical
  main-branch index:

  ```sh
  grepai search --workspace Projects --project odw-lint "<English intent query>" --toon --compact
  ```

  The GrepAI index reflects `main` only. Verify every branch-local fact inside
  this worktree with `leta`, exact text search, or file inspection before
  acting.
- Use `leta` for branch-local symbol navigation, references, call graphs, and
  refactoring commands. Use exact text search only for literal strings,
  Markdown, JSON, raw fixture text, lockfiles, vendored dependency source, and
  other non-symbol content.
- Use `sem` instead of raw Git history commands if implementation needs
  codebase history, entity-level diffs, or blame.
- Follow `AGENTS.md` "Change Quality & Committing", "Markdown Guidance", and
  "TypeScript Guidance". Use en-GB Oxford spelling in prose, comments, and
  commit messages while preserving code identifiers and external API spellings.
- Load the relevant skills before implementation work: `execplans`, `grepai`,
  `leta`, `sem`, `en-gb-oxendict-style`, `firecrawl-mcp`, and
  `biome-typescript`. This environment does not list a TypeScript router skill;
  use `biome-typescript` plus `AGENTS.md` TypeScript Guidance for TypeScript
  formatting and linting work. If a future environment provides a TypeScript
  router skill, load that router before touching TypeScript.
- Production code must not import executable ODW loader, primitive, launcher,
  worker, runtime, scheduler, metadata-evaluating, or agent-dispatch paths.
  This is required by `docs/technical-design.md` §5 and
  `docs/adr/0001-static-analysis-boundary.md`.
- Do not copy or vendor ODW's private `maskNonCode` helper into production
  `odw-lint` code. Implement an owned masker whose observable behaviour is
  pinned by tests against documented fixtures and the source-backed ODW
  reference.
- Do not add package dependencies. The locked repository already provides Bun,
  TypeScript, Biome, Oxlint, Fast-check, markdownlint, and df12-lints.
- Add production code only under `src/static-analysis/` unless a required
  package entry export update touches `src/index.ts`.
- The source masker must accept an `OriginalSourceFile` created by
  `createOriginalSourceFile`; it must not reconstruct source files
  structurally. This follows `docs/developers-guide.md` "Source-span helpers".
- The masker must preserve `sourceText.length` in UTF-16 code units and must
  preserve every JavaScript line terminator character at its original index:
  LF, CR, CRLF as two characters, U+2028, and U+2029. Other masked characters
  become ordinary spaces.
- Whole template literals are inert for envelope scanning. Code inside `${...}`
  interpolation is masked for this task because ODW's metadata extraction uses
  `maskNonCode`, not `maskForDualScan`. Dual-compat scanning is a separate
  behaviour described in ODW's loader and is out of scope for this task.
- Regex detection must use the ODW loader's preceding-significant-character
  strategy for deciding whether `/` starts a regex literal. Once a slash is a
  regex candidate, the regex scanner must stop the candidate at any JavaScript
  line terminator: LF, CR, U+2028, or U+2029. If a slash cannot be proven to
  start a terminated regex literal before one of those terminators, leave it as
  code so division and later source text are not hidden.
- Property tests that label a slash segment as a regex must either generate it
  only in an ODW-allowed regex context or have their independent oracle reject
  it as code by modelling the previous significant visible code character.
  Slash segments in division contexts must stay visible.
- The implementation may use the TypeScript compiler API in tests to parse
  test-only metadata probes, but production source masking must not depend on
  TypeScript scanner behaviour for regex classification.
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
  `docs/execplans/roadmap-2-1-1.md`.
- Run `make all`, `make markdownlint`, and `make nixie` before each work-item
  commit. `make all` is still required even for documentation-only items.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances

- Scope: stop and escalate if the implementation requires a full envelope
  scanner, static metadata parser, SWC parser adapter, command-line interface,
  configuration surface, or rule engine.
- File count: stop and escalate if the functional work needs more than one new
  production TypeScript module, the four required static-analysis test files
  named in this plan, one optional small edit to the existing
  `tests/static-analysis/masking-fixtures.test.ts`, package entry export
  updates, this ExecPlan, `docs/developers-guide.md`, and `docs/roadmap.md`.
  The four required static-analysis test files are
  `tests/static-analysis/source-file-architecture.test.ts`,
  `tests/static-analysis/source-mask.test.ts`,
  `tests/static-analysis/source-mask.property.test.ts`, and
  `tests/static-analysis/source-mask-fixtures.test.ts`. Do not add a separate
  shared test-helper file for this task; keep helpers local to the test file
  that uses them.
- Public API: stop and escalate before renaming or removing an existing export
  from `src/index.ts` or `src/static-analysis/index.ts`.
- Dependencies: stop and escalate before adding or upgrading any package
  dependency, including parser, lexer, glob, snapshot, or import-graph helpers.
- Runtime boundary: stop immediately if production code would need to import,
  call, or execute ODW runtime loader paths, workflow files, `new Function`,
  `eval`, dynamic import of workflows, or primitive factories.
- Parity ambiguity: stop and escalate if current ODW behaviour and this plan's
  explicit contract disagree on a case that affects real ODW examples or the
  committed masking fixture corpus.
- Complexity: stop and refactor inside the current work item if any new
  production function exceeds the configured lint complexity threshold or if
  `src/static-analysis/source-mask.ts` would exceed 400 physical lines.
- Testing attempts: stop and escalate if the same focused test still fails for
  the same reason after three implementation attempts.
- Time: stop and escalate if any work item takes more than one focused working
  day.

## Risks

- Risk: ODW's private loader helper is hand-written and not exported, so exact
  parity can drift.
  Severity: medium.
  Likelihood: medium.
  Mitigation: pin this implementation to the sibling checkout evidence at
  `/data/leynos/Projects/open-dynamic-workflows` commit `ecc4867`, cite the
  current source lines, and add fixture tests that describe the intended
  observable contract rather than importing ODW private helpers.

- Risk: Regex literal detection is context-sensitive and a standalone scanner
  cannot prove every JavaScript grammar case.
  Severity: medium.
  Likelihood: medium.
  Mitigation: use the same preceding-significant-character heuristic as ODW's
  loader for this envelope-masking slice, test the committed regex fixtures,
  and leave grammar-level body validation to later parser tasks.

- Risk: Template interpolation could be mistaken for executable code that
  should remain visible.
  Severity: medium.
  Likelihood: low.
  Mitigation: document that this task implements envelope masking, where whole
  template literals are inert. ODW's `maskForDualScan` leaves interpolation
  code visible for compatibility warnings, but that is not this task.

- Risk: Source-span alignment breaks for CRLF or Unicode line terminators.
  Severity: high.
  Likelihood: low.
  Mitigation: preserve all JavaScript line terminator characters in the masked
  text and add property tests that compare original and masked line terminator
  positions.

- Risk: A public export update accidentally widens or breaks the package
  surface.
  Severity: medium.
  Likelihood: low.
  Mitigation: update `tests/diagnostics/public-api-fixtures.ts` deliberately
  and run the public API surface test plus `make all`.

## Progress

- [x] (2026-06-30T11:28:32Z) Drafted the first planning round for roadmap task
  2.1.1 after source, documentation, ODW loader, TypeScript, and Fast-check
  research.
- [x] (2026-06-30T11:42:50Z) Revised planning round 2 to resolve path-safe
  formatter commands, documentation formatting for conditional Markdown edits,
  runtime immutability tests, and regex line-terminator handling.
- [x] (2026-06-30T11:56:30Z) Revised planning round 3 to align file-count
  tolerance with the required test files and pin the regex property-test
  oracle.
- [x] (2026-06-30T12:21:09Z) Work item 1: Added the production
  source-mask module, public exports, contract tests, architecture coverage,
  and developer-guide ownership note.
- [x] (2026-06-30T12:27:11Z) Work item 2: Added source-mask
  property tests and a test-only masking fixture probe that extracts real
  metadata names and proves inert envelope decoys stay hidden.
- [x] (2026-06-30T12:43:03Z) Work item 3: Marked roadmap task
  2.1.1 complete and closed the ExecPlan with final validation evidence.

## Surprises & discoveries

- Observation: The GrepAI main-branch index already finds
  `tests/static-analysis/masking-fixtures.test.ts` and the masking fixture
  family, but branch-local source inspection confirms there is still no
  production source masker.
  Evidence: a GrepAI search for static-analysis masking false positives
  returned masking fixture tests and source scan helpers. `leta files` in this
  worktree listed `src/static-analysis/source-file.ts`,
  `source-indexes.ts`, `source-position.ts`, `source-scan.ts`,
  `source-snippet.ts`, and `types.ts`, but no `source-mask.ts`.
  Impact: this task should add one focused production masking module and update
  the source-helper architecture test.

- Observation: ODW's loader uses two different masks.
  Evidence:
  `/data/leynos/Projects/open-dynamic-workflows/src/loader.ts` lines 302-323
  use `maskNonCode` for metadata extraction and then slice the metadata
  literal from original source. Lines 120-149 describe `maskForDualScan`,
  which keeps template interpolation code visible for compatibility warnings.
  Impact: this task implements the metadata/envelope mask, not the
  dual-compat mask.

- Observation: The TypeScript compiler scanner is useful evidence but is not a
  complete production mechanism for this task.
  Evidence:
  `node_modules/typescript/lib/typescript.d.ts` lines 8511-8555 expose
  `createScanner`, token positions, `scan`, and `reScanSlashToken`.
  `node_modules/typescript/lib/typescript.js` lines 12948-12990 scan comments,
  lines 12409-12490 scan strings and template tokens, and lines 13319-13420
  rescan slash tokens into regex literals only after caller context says a
  slash token may be regex.
  Impact: tests may use TypeScript for static parsing, but production masking
  should use an owned ODW-style lexical pass so regex handling is explicit.

- Observation: ODW and TypeScript differ on regex line-terminator handling in
  the exact code paths reviewed for this plan.
  Evidence:
  `/data/leynos/Projects/open-dynamic-workflows/src/loader.ts` at commit
  `ecc4867` lines 282-298 and 417-443 stop regex scanning on LF only.
  Locked TypeScript `5.9.3` defines `isLineBreak` as LF, CR, U+2028, and
  U+2029 at `node_modules/typescript/lib/typescript.js` lines 11740-11742, and
  `reScanSlashToken` stops regex rescans on `isLineBreak` at lines 13326-13331.
  Impact: `odw-lint` must choose and test its own span-safe contract here. This
  plan chooses all JavaScript line terminators so malformed regex text cannot
  hide later source.

- Observation: `make build` installed locked dependencies without changing the
  worktree.
  Evidence: `bun install` reported TypeScript `5.9.3`, Fast-check `4.8.0`,
  Biome `2.5.1`, and Oxlint `1.71.0`; `git status --short` remained clean.
  Impact: implementers can inspect `node_modules` source after `make build`
  without committing dependency churn.

- Observation: CodeRabbit found that preserving the previous significant
  character across every masked range was too broad for expression-like inert
  ranges.
  Evidence: the first `coderabbit review --agent` pass for work item 1 reported
  that a slash after a masked string, template, or regex could inherit an
  earlier ODW-allowed character such as `=` and be misclassified as a regex.
  Impact: `maskNonCodeSource` now keeps comment ranges inert but updates the
  previous significant character from string, template, and regex ranges; the
  unit suite pins division after each of those expression forms.

- Observation: The masking fixtures contain a nested template literal inside
  an outer template interpolation.
  Evidence: `source-mask-fixtures.test.ts` initially reported
  `odw/no-import-export` for
  `template-interpolation-boundary-decoy.js`; the visible token came from
  `${`import "fake-${nestedName}";`}` inside the outer template.
  Impact: `scanTemplateRange` now keeps the whole outer template inert while
  skipping nested string-like delimiters inside interpolation expressions.

- Observation: The property generator can accidentally create real syntax at
  segment boundaries if generated slash segments are adjacent to comments or
  identifiers.
  Evidence: Fast-check shrank failures to malformed regex text followed by a
  line comment and valid regex text followed immediately by identifier code.
  Impact: generated regex literals now receive a semicolon separator, and
  disallowed regex-labelled segments use a value-like prefix so the oracle
  proves visible slash handling without synthesizing a different token.

## Decision log

- Decision: Add `src/static-analysis/source-mask.ts` with
  `maskNonCodeSource(sourceFile: OriginalSourceFile): MaskedSource`.
  Rationale: The masker belongs to the existing static-analysis source-helper
  area and should consume factory-created original source files so future span
  mapping remains tied to the original source model.
  Date/Author: 2026-06-30T11:28:32Z / Codex.

- Decision: Export the source-mask contract through `src/static-analysis` and
  the private root package entry.
  Rationale: The existing package entry already exposes static-analysis source
  helpers for downstream parser, mapper, and reporter code. A deliberate export
  update keeps the public API surface test authoritative rather than relying on
  deep imports.
  Date/Author: 2026-06-30T11:28:32Z / Codex.

- Decision: Preserve all JavaScript line terminator characters, not only LF,
  while masking non-code characters to spaces.
  Rationale: ODW's current private helper preserves LF in the replacement loop,
  but `odw-lint` source-span helpers explicitly recognize LF, CR, CRLF,
  U+2028, and U+2029. Preserving all line terminators strengthens span safety
  without changing the envelope search result for valid fixtures.
  Date/Author: 2026-06-30T11:28:32Z / Codex.

- Decision: Treat LF, CR, U+2028, and U+2029 as regex-candidate terminators.
  Rationale: The sibling ODW helper currently stops regex scanning on LF only,
  but `odw-lint` source-span helpers and the locked TypeScript scanner recognize
  the full JavaScript line-terminator set. Stopping on all four terminators is
  the conservative lint contract: an unterminated regex-like slash must not mask
  later code after CR, Unicode line separator, or Unicode paragraph separator.
  Date/Author: 2026-06-30T11:42:50Z / Codex.

- Decision: Do not use TypeScript's standalone scanner as the production
  masker.
  Rationale: Official TypeScript compiler API docs recommend `createSourceFile`
  and `forEachChild` for AST traversal, and the scanner docs describe
  `createScanner` and trivia access. The locked 5.9.3 scanner still needs
  caller context to turn `/` into `RegularExpressionLiteral` via
  `reScanSlashToken`; implementing that context would be a parser workaround.
  The ODW loader reference already uses a small context heuristic suitable for
  this envelope-masking slice.
  Date/Author: 2026-06-30T11:28:32Z / Codex.

- Decision: Property tests must classify regex-labelled segments with the
  previous-significant-character contract instead of treating labels as
  unconditional truth.
  Rationale: The source masker deliberately distinguishes regex literals from
  division-like slashes by ODW's preceding-significant-character heuristic. A
  property oracle that masks every generated regex label regardless of context
  would produce false expectations for division contexts. The generator must
  emit regex-labelled segments only after an allowed previous significant
  character, and the independent oracle must still model that state so
  division-labelled slashes remain visible.
  Date/Author: 2026-06-30T11:56:30Z / Codex.

- Decision: Treat comments as context-neutral but treat masked strings,
  templates, and regex literals as expression tokens for subsequent regex
  classification.
  Rationale: Comments do not affect JavaScript expression context, but strings,
  templates, and regex literals do. Updating the previous significant character
  after those masked ranges prevents a following division slash from inheriting
  an earlier regex-allowed punctuation character.
  Date/Author: 2026-06-30T12:21:09Z / Codex.

- Decision: Keep the fixture probe test-only and deliberately narrow.
  Rationale: Work item 2 must prove the source masker against masking fixtures
  without adding the production envelope scanner. The probe therefore reports
  only `odw/meta-required`, `odw/meta-object`, and `odw/no-import-export`
  inside the test file.
  Date/Author: 2026-06-30T12:27:11Z / Codex.

## Outcomes & retrospective

Roadmap task 2.1.1 is complete. Work item 1 implemented the owned
`source-mask.ts` module, public/private export surface updates, architecture
coverage, unit contract tests, and developer-guide ownership note. Work item 2
added bounded Fast-check coverage for generated code, comments, strings,
templates, regex literals, malformed regex candidates, and division-like
slashes, plus a test-only probe that consumes every masking fixture manifest
expectation. Work item 3 marked the roadmap task complete. The implementation
remains below the source file-size limit and does not import or execute ODW
runtime code.

## Context and orientation

This repository is a private TypeScript/Bun package. The current
static-analysis source-helper modules live in `src/static-analysis/`:

- `source-file.ts` creates `OriginalSourceFile` records from raw workflow
  source and records private lookup indexes.
- `source-scan.ts` scans original source into UTF-8 byte offsets, UTF-16 text
  indexes, display lines, and display columns.
- `source-indexes.ts` stores the private indexes for factory-created source
  records.
- `source-position.ts` maps byte offsets and validates source spans.
- `source-snippet.ts` slices validated spans and builds reviewer-facing
  snippets.
- `types.ts` owns the boundary labels and source data types.

The architecture test
`tests/static-analysis/source-file-architecture.test.ts` pins this module set.
Any new source-helper module must update that test intentionally. The public
package surface is pinned by
`tests/diagnostics/public-api-fixtures.ts` and
`tests/diagnostics/public-api-surface.test.ts`.

The committed masking fixtures live under
`tests/static-analysis/fixtures/masking/`, with their manifest in
`tests/static-analysis/fixtures/masking.ts` and basic corpus tests in
`tests/static-analysis/masking-fixtures.test.ts`. These fixtures contain one
real `export const meta = { ... }` declaration plus decoy workflow syntax
inside comments, quoted strings, regex literals, and template literals. The
manifest's `EXPECTED_NO_ENVELOPE_DIAGNOSTICS` value is currently an empty
frozen array. This task must make those empty expectations meaningful by
running them through a test-only masked-envelope probe.

A "source mask" in this plan means a string of the same UTF-16 length as the
original source where real code characters remain unchanged and non-code
characters are replaced by spaces. Line terminators remain unchanged. A
"mask range" means a half-open UTF-16 text-index range `[startIndex, endIndex)`
within the original `sourceText`; these are not UTF-8 byte offsets and must be
named as indexes, not offsets.

## Research evidence

- `docs/roadmap.md` §2.1 task 2.1.1 requires a source masker for comments,
  strings, template literals, and regex literals. Its success criteria are
  zero envelope diagnostics for the masking fixtures and manifest `metaName`
  values matching the real metadata declaration.
- `docs/technical-design.md` §5 and
  `docs/adr/0001-static-analysis-boundary.md` require an owned static parser
  path and forbid production imports of executable ODW runtime helpers.
- `docs/technical-design.md` §6.2 defines `WorkflowEnvelope` as the envelope
  scanner output and says the envelope scanner should use the same string,
  comment, template, and regex masking strategy as ODW's loader.
- `docs/technical-design.md` §6.4 says workflow source is untrusted and must
  not be executed for linting convenience.
- `docs/technical-design.md` §9.1 names the dialect diagnostics that later
  envelope and metadata work will report, including `odw/meta-required` and
  `odw/no-import-export`.
- `docs/technical-design.md` §§11.1, 11.2, 11.3, and 11.5 require fixture
  coverage for strings, comments, regex literals, template literals, hostile
  metadata, loader parity, and original-source spans.
- `docs/terms-of-reference.md` §§1, 5, 6, 7, 8, and 9 define the product need:
  host-side workflow checks before execution, no source execution, runtime
  parity, and deterministic source diagnostics.
- `docs/developers-guide.md` "Static-Analysis Boundary" says the first
  implementation owns static analysis inside this repository and must not
  depend on ODW publishing a static API.
- `docs/developers-guide.md` "Workflow Fixture Corpus" documents masking
  fixtures, hash-pinned manifests, and empty `no-envelope-diagnostics`
  expectations for future envelope-scanner work.
- `docs/developers-guide.md` "Source-span helpers" requires parser, mapper,
  and reporter code to use `createOriginalSourceFile` rather than rebuilding
  `OriginalSourceFile` structurally.
- `docs/developers-guide.md` "Commit Gate", "Tests", "Markdown", and
  "Documentation Upkeep" define `make all`, `make markdownlint`, test
  expectations, and documentation maintenance expectations.
- `docs/documentation-style-guide.md` "Spelling", "Markdown rules",
  "Formatting", and "Roadmap task writing guidelines" govern prose, wrapping,
  Markdown syntax, and roadmap completion updates.
- `docs/scripting-standards.md` "Language and runtime", "Testing
  expectations", and "Operational guidelines" were reviewed. This task does
  not add scripts, so those sections impose no extra implementation files.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` §§4.A, 4.B,
  and 5.C support small functions, guard clauses, extract-method refactoring,
  and declarative test tables for the lexical state machine.
- `/data/leynos/Projects/open-dynamic-workflows/src/loader.ts` at sibling
  checkout commit `ecc4867` is the source-backed ODW reference. Lines 75 and
  302-323 show metadata extraction using `EXPORT_META.exec(masked)`, brace
  matching on masked source, and slicing the literal from original source.
  Lines 364-454 show `maskNonCode` replacing strings, template literals,
  comments, and regex literal bodies with spaces, plus the
  `regexAllowed(prevSig)` heuristic. Lines 120-149 explain that
  `maskForDualScan` deliberately differs by keeping template interpolation
  code visible.
- The official TypeScript compiler API wiki at
  <https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API>
  documents `createSourceFile` and recursive `forEachChild` traversal for
  AST-based test parsing.
- The official TypeScript scanner wiki at
  <https://github.com/microsoft/TypeScript/wiki/Codebase-Compiler-Scanner>
  documents `createScanner`, trivia, `setText`, `scan`, token positions, and
  the `skipTrivia` flag.
- The locked TypeScript package is `typescript@5.9.3` in `bun.lock`.
  `node_modules/typescript/lib/typescript.d.ts` lines 8511-8555 expose the
  scanner API. `node_modules/typescript/lib/typescript.js` lines 11740-11742
  define the JavaScript line-break set as LF, CR, U+2028, and U+2029. Lines
  12409-12490 scan strings and template tokens, lines 12948-12990 scan
  comments, and lines 13319-13420 rescan slash tokens as regex literals only
  when caller context requests it. The regex rescan stops on `isLineBreak`,
  so the locked scanner does not allow regex bodies to cross any JavaScript
  line terminator.
- The official Fast-check properties documentation at
  <https://fast-check.dev/docs/core-blocks/properties/> documents
  `fc.property` and `fc.assert` for synchronous properties. The string
  arbitrary documentation at
  <https://fast-check.dev/docs/core-blocks/arbitraries/primitives/string/>
  documents `fc.string` options. The locked package is `fast-check@4.8.0`;
  `node_modules/fast-check/lib/fast-check.d.ts` exposes `property`, `assert`,
  `string`, `constantFrom`, and `array`, and the existing
  `tests/static-analysis/source-file.property.test.ts` already uses
  `fc.assert` with deterministic runner options.

## Interfaces and dependencies

Add `src/static-analysis/source-mask.ts` with the following production API:

```ts
import type { OriginalSourceFile } from "./types";

export type SourceMaskKind = "comment" | "string" | "template" | "regex";

export interface SourceMaskRange {
  readonly kind: SourceMaskKind;
  readonly startIndex: number;
  readonly endIndex: number;
}

export interface MaskedSource {
  readonly sourceFile: OriginalSourceFile;
  readonly maskedText: string;
  readonly ranges: readonly SourceMaskRange[];
}

export const maskNonCodeSource = (sourceFile: OriginalSourceFile): MaskedSource => {
  // Implemented in work item 1.
};
```

The returned `MaskedSource` must be frozen deeply enough that callers cannot
mutate the result object, the `ranges` array, or any range entry. Implement this
by freezing each `SourceMaskRange`, freezing the final `ranges` array, and
freezing the returned `MaskedSource` object. Each `SourceMaskRange` must satisfy
`0 <= startIndex <= endIndex <= sourceFile.sourceText.length`. Ranges must be
sorted, non-overlapping, and expressed in UTF-16 text indexes because they
align with JavaScript string operations over `sourceText` and `maskedText`.

Production code uses no new package dependency. TypeScript remains a test
dependency for static parsing helpers only. Fast-check remains a test
dependency for bounded source-mask invariants only.

## Plan of work

### Work item 1: Add the production source-mask module and contract tests

Docs to read before starting: `docs/roadmap.md` §2.1 task 2.1.1,
`docs/technical-design.md` §§5, 6.2, 6.4, 11.1, 11.5, and 12.1,
`docs/adr/0001-static-analysis-boundary.md` "Decision" and "Consequences",
`docs/developers-guide.md` "Static-Analysis Boundary", "Source-span helpers",
"Tests", and "Documentation Upkeep",
`docs/complexity-antipatterns-and-refactoring-strategies.md` §§4.A, 4.B, and
5.C, and `AGENTS.md` TypeScript Guidance.

Skills to load: `execplans`, `grepai`, `leta`, `sem`,
`en-gb-oxendict-style`, and `biome-typescript`. Load a TypeScript router skill
too if one is available in the implementing environment.

Implement `src/static-analysis/source-mask.ts` with small named helpers:
`maskNonCodeSource`, a line-terminator predicate, a range blanking helper, a
string/template scanner, a comment scanner, a regex scanner, and
`isRegexAllowedAfter`. Do not copy ODW's helper; write an owned implementation
from the contract above. The string scanner masks from opening quote through
the matching closing quote or end of file, preserving line terminators. The
template scanner masks from opening backtick through the matching closing
backtick or end of file and does not leave interpolation code visible. The
regex scanner masks only a terminated regex when
`isRegexAllowedAfter(prevSignificantCharacter)` is true; it must abandon the
regex candidate at LF, CR, U+2028, or U+2029 if no closing delimiter was seen
first. Otherwise it leaves the slash as code.

Export the new types and `maskNonCodeSource` from
`src/static-analysis/index.ts` and `src/index.ts`. Update
`tests/diagnostics/public-api-fixtures.ts` so the package export guard expects
the new names. Update `tests/static-analysis/source-file-architecture.test.ts`
so `SOURCE_HELPER_MODULES` includes `source-mask.ts` and the source-helper
ownership expectations include the new module.

Add `tests/static-analysis/source-mask.test.ts` with table-driven unit tests:

- comments are masked for `//`, `/* ... */`, unterminated block comments, and
  CRLF-containing comments;
- single-quoted and double-quoted strings are masked with escaped delimiters;
- whole template literals are masked, including `${...}` interpolation code;
- regex literals are masked after ODW-allowed preceding characters, including
  escaped slashes and character classes;
- regex scanning stops without masking when a candidate reaches CR, U+2028, or
  U+2029 before a closing delimiter, matching the same conservative contract as
  LF so malformed regex text cannot hide later code;
- division-like slashes remain visible when the preceding significant
  character makes regex impossible;
- the returned object satisfies `Object.isFrozen(maskedSource)`, its `ranges`
  array satisfies `Object.isFrozen(maskedSource.ranges)`, and every range entry
  satisfies `Object.isFrozen(range)`;
- the returned `ranges` are sorted, non-overlapping, correctly typed by
  `SourceMaskKind`, and bounded by text indexes;
- `maskedText.length` equals `sourceText.length`;
- every original line terminator character remains unchanged in `maskedText`;
- code outside mask ranges remains unchanged.

Update `docs/developers-guide.md` "Source-span helpers" to include
`src/static-analysis/source-mask.ts` as the owner of inert-region masking for
future envelope scanning. Do not change ADR 0001 unless the static-analysis
boundary itself changes.

Red-Green-Refactor for this work item:

1. Red: add the tests and export expectations first, then run:

   ```sh
   bun test tests/static-analysis/source-mask.test.ts tests/static-analysis/source-file-architecture.test.ts tests/diagnostics/public-api-surface.test.ts
   ```

   Expect failure because `source-mask.ts` and `maskNonCodeSource` do not yet
   exist.

2. Green: add the minimal production implementation and exports, then rerun
   the same focused command. Expect all listed tests to pass.

3. Refactor: split helpers until the implementation is readable, then rerun
   the focused command.

Path-safe formatting and gates for this work item:

```sh
bunx @biomejs/biome format --write \
  src/static-analysis/source-mask.ts \
  src/static-analysis/index.ts \
  src/index.ts \
  tests/static-analysis/source-mask.test.ts \
  tests/static-analysis/source-file-architecture.test.ts \
  tests/diagnostics/public-api-fixtures.ts
mdtablefix docs/execplans/roadmap-2-1-1.md docs/developers-guide.md
bunx markdownlint-cli2 --fix \
  docs/execplans/roadmap-2-1-1.md \
  docs/developers-guide.md
make all
make markdownlint
make nixie
```

Commit message subject: `Add source masking contract`.

### Work item 2: Prove fixture and property behaviour for the source masker

Docs to read before starting: `docs/developers-guide.md` "Workflow Fixture
Corpus" and "Source-span helpers", `docs/technical-design.md` §§6.2, 9.1,
11.1, 11.2, and 11.5, `docs/roadmap.md` §2.1 task 2.1.1,
`docs/documentation-style-guide.md` "Markdown rules", and the Fast-check
research evidence in this ExecPlan.

Skills to load: `execplans`, `grepai`, `leta`, `sem`,
`en-gb-oxendict-style`, `firecrawl-mcp`, and `biome-typescript`. Load a
TypeScript router skill too if one is available in the implementing
environment.

Add `tests/static-analysis/source-mask.property.test.ts`. Use a deterministic
runner modelled on `SOURCE_SPAN_PROPERTY_RUNNER`. Generate bounded source text
from labelled code and non-code segments rather than arbitrary invalid
programs. Build each generated source left-to-right while tracking the previous
significant visible code character. Code labels update that state by ignoring
whitespace and recording the last non-whitespace code character; comment,
string, and template labels do not update it because they are inert. Regex
labels may be emitted only when the tracked previous significant character is
empty or one of `([{,;:=!&|?+-*%<>~^`, matching ODW's `regexAllowed` contract.
The generator should construct such allowed contexts directly instead of
filtering arbitrary slash positions. Division-labelled slash/code segments must
also be generated in disallowed contexts so the property proves they remain
visible. The independent expected-mask oracle must model the same previous
significant-character state and create expected regex mask ranges only for
regex-labelled segments in allowed contexts. If a regex-labelled segment
contains LF, CR, U+2028, or U+2029 before its closing delimiter, the oracle must
leave that candidate visible because the production contract treats it as
unterminated code, not as a mask range. Assert the same invariants from work
item 1 over many orders and combinations: length preservation,
line-terminator preservation, code preservation, masked-region spacing, and no
overlapping ranges.

Add `tests/static-analysis/source-mask-fixtures.test.ts`. This is a test-only
probe, not the production envelope scanner. For each
`MASKING_FIXTURE_SNAPSHOTS` entry:

1. Read the fixture with `readFixtureSource`.
2. Build an `OriginalSourceFile` with `createOriginalSourceFile`.
3. Call `maskNonCodeSource`.
4. Search `maskedText` for the real `\bexport\s+const\s+meta\s*=` match.
5. Match the metadata object braces in `maskedText`.
6. Slice the metadata literal from the original source at the same text
   indexes.
7. Parse that literal, wrapped in parentheses so TypeScript treats it as an
   object literal expression rather than a block, in a test-only TypeScript
   `SourceFile` without evaluating it.
8. Extract the static `name` property when it is a string literal.
9. Assert it equals the manifest `metaName`.
10. Blank the real `export` keyword in the masked copy and assert the test
    probe's envelope diagnostics equal `EXPECTED_NO_ENVELOPE_DIAGNOSTICS`.

The test-only diagnostics should be deliberately narrow: `odw/meta-required`
when no real meta export is found, `odw/meta-object` when brace matching or
test-only name extraction fails, and `odw/no-import-export` when another
`export` or `import` keyword remains after masking and after blanking the real
metadata export. Do not add these as production diagnostics in this work item.

Extend `tests/static-analysis/masking-fixtures.test.ts` only if the existing
manifest tests need a small assertion that the fixture expectations are now
consumed by `source-mask-fixtures.test.ts`. Do not edit fixture source files or
repin hashes unless a test exposes a real fixture defect; if that happens,
document it in `Surprises & Discoveries` before changing fixtures.

Red-Green-Refactor for this work item:

1. Red: add the property and fixture tests first, then run:

   ```sh
   bun test tests/static-analysis/source-mask.property.test.ts tests/static-analysis/source-mask-fixtures.test.ts tests/static-analysis/masking-fixtures.test.ts
   ```

   Expect failure only where the source-mask implementation or test-only probe
   does not yet satisfy the new assertions.

2. Green: make the smallest source-mask or test-helper correction needed for
   the focused tests to pass. Do not broaden production scope into a full
   envelope scanner.

3. Refactor: simplify duplicated test helpers into small local functions in
   the same test files. Do not create a shared helper file in this task. If a
   shared helper becomes necessary, stop, update `Tolerances`, and get the plan
   revised before implementation continues.

Path-safe formatting and gates for this work item:

```sh
bunx @biomejs/biome format --write \
  tests/static-analysis/source-mask.property.test.ts \
  tests/static-analysis/source-mask-fixtures.test.ts
git diff --quiet -- src/static-analysis/source-mask.ts || \
  bunx @biomejs/biome format --write src/static-analysis/source-mask.ts
git diff --quiet -- tests/static-analysis/masking-fixtures.test.ts || \
  bunx @biomejs/biome format --write tests/static-analysis/masking-fixtures.test.ts
mdtablefix docs/execplans/roadmap-2-1-1.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-1.md
make all
make markdownlint
make nixie
```

The two `git diff --quiet` guarded formatter commands are intentional: they format
`src/static-analysis/source-mask.ts` and
`tests/static-analysis/masking-fixtures.test.ts` only when this work item has
actually edited those files.

Commit message subject: `Prove source mask fixture behaviour`.

### Work item 3: Close roadmap and documentation state

Docs to read before starting: `docs/roadmap.md` §2.1,
`docs/developers-guide.md` "Documentation Upkeep",
`docs/documentation-style-guide.md` "Roadmap task writing guidelines", and
`AGENTS.md` "Documentation Maintenance".

Skills to load: `execplans`, `grepai`, `leta`, `sem`, and
`en-gb-oxendict-style`.

Update `docs/roadmap.md` to mark task 2.1.1 complete only after work items 1
and 2 have passed their gates. Add a concise completion note under task 2.1.1
only if the roadmap needs to record a scoped behaviour that future tasks must
know, such as whole-template masking for envelope scans or test-only envelope
probe coverage. Keep the note short and aligned with the roadmap style guide.

Update this ExecPlan to `Status: COMPLETE`, check off all progress entries
with timestamps, record final validation evidence in `Artifacts and notes`,
and write a final `Outcomes & Retrospective` entry. Do not start task 2.1.2.

No production code changes should occur in this work item. If a final
documentation update reveals that `docs/technical-design.md` or ADR 0001 is
stale, update the relevant design document in this same item and explain why
in `Decision Log`. When doing so, append every changed Markdown path to the
file-scoped Markdown formatter commands below before running them. For example,
if `docs/technical-design.md` is edited, include
`docs/technical-design.md`; if `docs/adr/0001-static-analysis-boundary.md` is
edited, include that ADR path. Do not list an unchanged optional Markdown file
in the file-scoped formatter commands.

Path-safe formatting and gates for this work item:

```sh
changed_markdown_paths=(
  docs/execplans/roadmap-2-1-1.md
  docs/roadmap.md
)
# If this work item edits docs/technical-design.md or
# docs/adr/0001-static-analysis-boundary.md, append each changed path to
# changed_markdown_paths before running the formatter commands.
mdtablefix "${changed_markdown_paths[@]}"
bunx markdownlint-cli2 --fix "${changed_markdown_paths[@]}"
make all
make markdownlint
make nixie
```

Commit message subject: `Complete source masking roadmap task`.

## Concrete steps

From the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-1`, the implementer
should proceed item by item:

1. Refresh branch-local context:

   ```sh
   pwd
   git status --short --branch
   grepai search --workspace Projects --project odw-lint \
     "source masking workflow envelope comments strings templates regex" \
     --toon --compact
   leta files | head -n 300
   sem diff --from origin/main --to HEAD
   ```

2. Complete work item 1 using the Red-Green-Refactor loop and validation
   commands listed under that item.

3. Commit work item 1 only after `make all`, `make markdownlint`, and
   `make nixie` pass.

4. Complete work item 2 using its Red-Green-Refactor loop and validation
   commands.

5. Commit work item 2 only after `make all`, `make markdownlint`, and
   `make nixie` pass.

6. Complete work item 3 documentation closeout and final gates.

7. Commit work item 3 only after final validation passes.

8. Leave the worktree clean except for intentional committed changes:

   ```sh
   git status --short --branch
   sem diff --from origin/main --to HEAD
   ```

Expected successful gate output is ordinary command completion with exit code
0. If any command fails, record the failing command and concise error summary
in `Surprises & Discoveries` or `Decision Log` before retrying.

## Validation and acceptance

Acceptance is observable when all of the following are true:

- `maskNonCodeSource` is exported from `odw-lint` and returns a frozen
  `MaskedSource` for an `OriginalSourceFile`.
- Runtime immutability tests assert `Object.isFrozen(maskedSource)`,
  `Object.isFrozen(maskedSource.ranges)`, and `Object.isFrozen(range)` for
  every returned range entry.
- `maskedText` always has the same UTF-16 length as the original source.
- Comments, quoted strings, whole template literals, and ODW-recognized regex
  literals are blanked with spaces while all line terminator characters remain
  unchanged.
- Unterminated regex candidates stop at LF, CR, U+2028, and U+2029 and are left
  visible instead of hiding following source text.
- Real code outside masked ranges remains unchanged.
- Division-like slashes remain visible.
- `tests/static-analysis/source-mask.test.ts` covers unit edge cases for all
  four mask kinds.
- `tests/static-analysis/source-mask.property.test.ts` covers bounded
  combinations of code and non-code segments with Fast-check, including
  regex-labelled segments generated in ODW-allowed contexts and
  division-labelled slashes generated in disallowed contexts.
- `tests/static-analysis/source-mask-fixtures.test.ts` proves every masking
  fixture has zero test envelope diagnostics and that each manifest `metaName`
  matches the real metadata declaration extracted from original source.
- The package public API surface test passes with the deliberate new source
  mask exports.
- `docs/developers-guide.md` documents source-mask ownership.
- `docs/roadmap.md` marks task 2.1.1 complete only after implementation gates
  pass.

Focused validation commands:

```sh
bun test tests/static-analysis/source-mask.test.ts tests/static-analysis/source-file-architecture.test.ts tests/diagnostics/public-api-surface.test.ts
bun test tests/static-analysis/source-mask.property.test.ts tests/static-analysis/source-mask-fixtures.test.ts tests/static-analysis/masking-fixtures.test.ts
```

Repository validation commands:

```sh
make all
make markdownlint
make nixie
```

Quality criteria:

- Tests: focused source-mask tests, fixture tests, property tests, public API
  tests, and the full Bun test suite pass.
- Lint/typecheck: `make all` passes Biome, Oxlint, TypeScript type checking,
  and tests.
- Documentation: `make markdownlint` and `make nixie` pass after Markdown
  edits.
- Security: production code imports no executable ODW runtime path and does
  not evaluate workflow source.
- Scope: no CLI, rule engine, metadata parser, SWC parser adapter, or full
  envelope scanner is added.

## Idempotence and recovery

The work items are additive and can be retried safely. If a red test is added
and implementation stalls, keep the red test and update `Progress` and
`Decision Log`; do not commit a failing gate. If a mutating formatter touches
unrelated files, inspect `git status --short`, then revert only the unrelated
formatter churn that the implementer caused. Do not revert pre-existing user
changes.

If dependency installation creates ignored `node_modules` state, leave it
untracked. If a stash is absolutely necessary, use a named stash such as:

```sh
git stash push -m 'df12-stash v1 task=2.1.1 kind=discard reason="formatter churn"'
```

Do not use a bare or default stash message.

## Artifacts and notes

Research commands already run for this planning round:

```sh
grepai search --workspace 'Projects' --project 'odw-lint' \
  "source masker comments strings template roadmap task 2.1.1" \
  --toon --compact
grepai search --workspace 'Projects' --project 'odw-lint' \
  "static analysis comments strings template literal masking false positives" \
  --toon --compact --limit 10
leta workspace add /data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-1
leta files | head -n 500
sem diff --from origin/main --to HEAD
make build
```

Round 3 research and validation commands:

```sh
grepai search --workspace 'Projects' --project 'odw-lint' \
  "source masker comments strings template regex static analysis" \
  --toon --compact --limit 8
leta files src/
leta files tests/static-analysis
sem diff --format json
```

Round 3 also used `firecrawl_scrape` on the official TypeScript compiler API
wiki, TypeScript scanner wiki, Fast-check properties documentation, and
Fast-check string arbitrary documentation to reconfirm the external behaviour
already cited in `Research evidence`.

Work item 1 implementation evidence:

```sh
bun test tests/static-analysis/source-mask.test.ts tests/static-analysis/source-file-architecture.test.ts tests/diagnostics/public-api-surface.test.ts
bun run lint:biome
bun run lint:oxlint
```

The initial focused test run failed before `src/static-analysis/source-mask.ts`
and `maskNonCodeSource` existed. After implementation and CodeRabbit fixes, the
focused test command passed with 34 tests and 367 assertions, and both Biome
and Oxlint passed without warnings.

Work item 2 implementation evidence:

```sh
bun test tests/static-analysis/source-mask.property.test.ts tests/static-analysis/source-mask-fixtures.test.ts tests/static-analysis/masking-fixtures.test.ts
```

The initial work item 2 focused run failed on the nested-template fixture and
on generated slash-boundary cases. After tightening template scanning and the
property generator, the focused command passed with 12 tests and 11,355
assertions.

Key source-backed references:

```plaintext
ODW sibling checkout: /data/leynos/Projects/open-dynamic-workflows
ODW checkout commit: ecc4867
ODW loader reference: src/loader.ts lines 75, 120-149, 282-323, 351-454
TypeScript locked version: 5.9.3
Fast-check locked version: 4.8.0
```

## Revision note

Initial draft created for roadmap task 2.1.1. It fixes the production mechanism
as an owned `src/static-analysis/source-mask.ts` module, splits delivery into
three independently gateable work items, and records source-backed ODW,
TypeScript, and Fast-check research so implementation does not start from an
unverified workaround menu.

Round 2 revision resolves the design-review blockers: work item 2 now formats
`src/static-analysis/source-mask.ts` only when this work item edits it, work
item 3 requires every conditionally changed Markdown path to be added to the
file-scoped formatter commands, the runtime immutability contract freezes and
tests the `MaskedSource` object, the `ranges` array, and each range entry, and
the regex contract now stops candidates on LF, CR, U+2028, and U+2029 with
explicit tests required for CR and Unicode terminators.

Round 3 revision resolves the remaining design-review blockers: the file-count
tolerance now permits the four required static-analysis test files plus one
optional existing masking-fixture test edit without permitting a separate
shared helper, and work item 2 now pins the regex property-test generator and
oracle to ODW's previous-significant-character contract so regex and division
expectations cannot diverge.
