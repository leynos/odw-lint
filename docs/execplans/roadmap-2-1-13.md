# Extract a shared scanner primitive layer

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

Implementation status: Work items 1 through 6 complete.

This is planning round 2. Do not begin implementation until the roadmap
workflow approves this plan. The round-1 design review raised two blocking
points (an incorrect module-inventory insertion slot and an incomplete
file-size risk for the growing test file); both are resolved in this revision
and recorded in the Decision Log and the closing revision note.

## Purpose / big picture

Roadmap task 2.1.13 consolidates the low-level source-scanning primitives that
are currently duplicated between the two static-analysis scanner families:

- the **source-mask** family
  (`src/static-analysis/source-mask.ts` and its `source-mask-*.ts` token
  modules), which blanks comments, quoted strings, whole template literals, and
  ODW-recognized regex literals for envelope scanning; and
- the **workflow-metadata** family
  (`src/static-analysis/workflow-metadata-parser.ts`,
  `workflow-metadata-parser-scan.ts`, `workflow-metadata-comment-scan.ts`, and
  `workflow-metadata-string-scan.ts`), which parses static `meta` object
  literals without executing source.

Both families independently re-implement the same JavaScript token grammar:
line-terminator and CRLF classification, a full-code-point reader, backslash
escape skipping, escape-aware delimited-string walks, line and block comment
boundary scanning, and identifier-run scanning (forward and backward, ASCII and
full Unicode). This duplication is the "Duplicated Code" and "Primitive
Obsession / Data Clumps" refactoring smell called out in `AGENTS.md`
"Refactoring Heuristics & Workflow", and it means a fix to the shared grammar
(as happened in tasks 2.1.12.4, 2.1.12.5, and 2.1.12.8) must be applied in two
places.

After this plan is implemented, both scanner families consume **one documented
primitive layer** — a new internal module
`src/static-analysis/source-scanner-primitives.ts` — for their shared
JavaScript token grammar. The observable behaviour is unchanged: the source
masker still blanks the same ranges, and the metadata parser still returns the
same `parsed` / `not-statically-provable` results with the same spans. The
change is a pure, behaviour-preserving internal refactor whose success is
proven by the existing masking and metadata test suites staying green, plus new
focused unit and property tests for the extracted primitives.

This task adds no external dependency, no parser-backed rule, no CLI surface,
and no change to any public `odw-lint` export. It does not touch SWC, the body
parser, or metadata classification semantics.

### How to observe success

1. `make all` passes in the worktree (build, format, lint, typecheck, tests).
2. The existing behaviour suites stay green with no snapshot churn:
   `tests/static-analysis/source-mask-fixtures.test.ts`,
   `source-mask.property.test.ts`, `source-mask-internals.test.ts`,
   `masking-fixtures.test.ts`, `workflow-metadata.test.ts`,
   `workflow-metadata-parser-edge.test.ts`,
   `workflow-metadata-comment-scan.test.ts`,
   `invalid-workflow-metadata-parity.test.ts`, and
   `invalid-workflow-fixtures.test.ts`.
3. A set of new per-concern suites proves each extracted primitive directly —
   `tests/static-analysis/source-scanner-classification.test.ts`,
   `source-scanner-escape.test.ts`, `source-scanner-comments.test.ts`,
   `source-scanner-delimited.test.ts`, and `source-scanner-identifiers.test.ts`
   — and a dedicated differential property test
   `tests/static-analysis/delimited-end-parity.property.test.ts` proves the two
   delimited-end orchestrators behave identically to their pre-refactor
   implementations over generated source. The unit tests are split per concern
   (one file per work item) and the parity oracle lives in its own file so no
   single test file approaches the 400-line source-and-test size gate.
4. Grepping the two scanner families shows each shared primitive defined once,
   in `source-scanner-primitives.ts`, and imported (not re-implemented)
   elsewhere.

## Constraints

- Work only in the git-donkey worktree
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-13`. Never read-modify-
  write any file in the root/control worktree at
  `/data/leynos/Projects/odw-lint`; it is off-limits for edits.
- Treat `origin/main` as the canonical integration branch. The integration
  branch is `main`.
- **Behaviour preservation is the hard invariant.** No emitted diagnostic, no
  masked range, no metadata parse result, and no span may change. If any
  behaviour suite or snapshot changes, stop and escalate rather than updating a
  snapshot.
- Do not change any public `odw-lint` export. The static-analysis package
  boundary (`STATIC_ANALYSIS_BOUNDARY`, `STATIC_ANALYSIS_COMPONENTS`,
  `STATIC_ANALYSIS_STAGES`, and the re-exports in
  `src/static-analysis/index.ts` and `src/index.ts`) must remain byte-stable.
  The new primitive module is internal; it must not be re-exported from
  `src/static-analysis/index.ts` or `src/index.ts`.
- Keep each source file at or under 400 physical lines (`AGENTS.md` "Keep file
  size manageable"; enforced by
  `tests/static-analysis/source-file-architecture.test.ts` and
  `tests/build-gate/file-size.test.ts`).
- Follow `AGENTS.md` "Code Style and Structure", "Documentation Maintenance",
  "Tooling Defaults", "Change Quality & Committing", "Refactoring Heuristics &
  Workflow", "Markdown Guidance", and "TypeScript Guidance". In particular the
  "Abstraction / adapter / helper policy": sweep for an existing equivalent
  before extracting, document scope and reuse policy, and record the decision
  in developer/architecture documentation.
- Use en-GB Oxford spelling ("-ize" / "-yse" / "-our") in all prose, comments,
  and commit messages, except external API names.
- Each work item is a single atomic commit that passes the full commit gate
  (`make all`, plus `make markdownlint` and `make nixie` when Markdown
  changes). Refactors that move declarations between modules must update the
  module-inventory and architecture guards in the **same** commit, because
  those guards fail the moment a file's declaration set or the directory listing
  changes.

### Tooling constraints and observed availability

- GrepAI is the primary intent-search tool against the canonical main-branch
  index:

  ```sh
  grepai search --workspace 'Projects' --project 'odw-lint' \
    "<English intent query>" --toon --compact
  ```

  In this planning session, `grepai search` could not run: the agent sandbox
  rejected the command with "This command requires approval" before execution.
  The GrepAI index reflects `main` only and must never be treated as evidence
  for branch-local or newly changed code. Every fact in this plan was instead
  verified by direct file inspection inside the worktree (paths and line
  references are cited per work item). Implementation agents should retry
  `grepai search`; if it is still unavailable, record the exact failure and
  continue with branch-local `leta` / exact-text / file inspection.
- Use `leta` for branch-local symbol navigation, references, and call graphs
  (`leta show`, `leta refs`, `leta grep`, `leta files`). `leta` was not
  exercised in this planning session because the same sandbox approval gate
  blocks it; this is not a blocker. If `leta` fails at implementation time,
  record the exact failed command and fall back to precise file inspection.
  Leta unavailability is never a reason to set Status: BLOCKED.
- Use `sem` for codebase history (entity-level diffs and blame) instead of raw
  `git log` / `git blame`.
- No external library behaviour is load-bearing for this task. Every primitive
  is pure UTF-16 string logic already present in the tree; the plan pins each
  behavioural claim to a cited source location and an existing or new test.
  `@swc/core`, `fast-check`, and `bun:test` are used only as the parser (not
  touched here) and the test tools.

## Tolerances (exception triggers)

- Scope: if any single work item requires touching more than 12 files or more
  than roughly 400 net changed lines, stop and escalate.
- Behaviour: if any existing behaviour suite fails or any snapshot would change,
  stop and escalate. Do not update a behaviour snapshot to make a test pass.
- Interface: if satisfying a work item appears to require changing a public
  `odw-lint` export or the static-analysis boundary, stop and escalate.
- Merge safety: if a differential property test finds any input where a
  proposed unified delimited-end scanner diverges from the pre-refactor
  implementation, do not ship the unification; keep the scanners separate over
  shared low-level primitives and record the divergence.
- Dependencies: if a new external dependency seems necessary, stop and
  escalate (none is expected).
- Iterations: if a work item's tests still fail after 3 focused attempts, stop
  and escalate.
- Ambiguity: if the "shared primitive layer" boundary is genuinely ambiguous
  for a given helper (belongs to the primitive layer vs. stays family-local),
  record the decision in the Decision Log and proceed; only escalate if the
  choice materially changes observable behaviour.

## Risks

- Risk: the two escape-aware delimited-string walks
  (`scanEscapedDelimitedEnd` in `source-mask-delimiters.ts` and
  `scanDelimitedEnd` in `workflow-metadata-comment-scan.ts`) have genuinely
  different contracts (template `${...}` interpolation handling, an `endIndex`
  bound, and different unterminated-return values), so a naive merge would
  change masked ranges or metadata parses.
  Severity: high. Likelihood: medium.
  Mitigation: do not force a single orchestrator. Share only the lower-level
  escape-skip and delimiter-detection primitives, keep the two orchestrators
  distinct, and pin each with a differential property test that compares the
  refactored function against a frozen copy of the original implementation
  (Work item 4).
- Risk: two line-terminator sources of truth exist
  (`LINE_TERMINATORS` / `isLineTerminator` in `source-scan.ts` and
  `isLineTerminatorCharacter` in `source-mask-delimiters.ts`); consolidating
  them could subtly change which code points are treated as terminators.
  Severity: medium. Likelihood: low.
  Mitigation: the canonical set is exactly `\n`, `\r`, U+2028, and U+2029 in
  both places (verified in `source-scan.ts:13` and
  `source-mask-delimiters.ts:23-27`); a table-driven unit test enumerates all
  four plus negatives before migration.
- Risk: the architecture and inventory guards
  (`tests/static-analysis/source-file-architecture.test.ts`,
  `tests/diagnostics/architecture.test.ts` via
  `tests/diagnostics/architecture-fixtures.ts`) pin exact per-module
  declaration sets and the `src/static-analysis` directory listing, so any
  move breaks them unless updated in the same commit.
  Severity: medium. Likelihood: high.
  Mitigation: every structural work item updates those guards in the same
  commit and re-runs `make test` before committing.
- Risk: file-size guard (400 lines) trips on **either** the primitive module
  **or** an accumulating test file. `tests/build-gate/file-size.test.ts`
  enforces `SOURCE_AND_TEST_LINE_LIMIT` (400 physical lines, verified at
  `tests/build-gate/file-size-support.ts:7`) over every tracked TypeScript file
  under both `src/` and `tests/`
  (`isSourceOrTestTypeScriptPath`, `file-size-support.ts:41-46`;
  `.property.test.ts` files match the `.ts` extension and are therefore in
  scope). A single accumulating primitive test file would gather table-driven
  cases for roughly ten primitives across Work items 1-5 plus, in Work item 4, a
  frozen inline oracle that replicates the mutually-recursive
  `scanDelimitedEnd` / `scanTemplateExpressionEnd` / `scanCommentEnd` /
  `scanLineCommentEnd` / `scanBlockCommentEnd` cluster; that concentration would
  push a late work item past 400 lines and force an unplanned restructure.
  Severity: medium. Likelihood: medium (for a single-file layout).
  Mitigation (committed, not deferred): the test suite is split per concern —
  one focused unit-test file created by the work item that introduces each
  primitive group
  (`source-scanner-classification.test.ts`, `-escape.test.ts`,
  `-comments.test.ts`, `-delimited.test.ts`, `-identifiers.test.ts`) — and the
  Work item 4 differential parity oracle lives in its **own** dedicated file,
  `tests/static-analysis/delimited-end-parity.property.test.ts`, never inlined
  into a shared file. No single file accumulates across work items, so each
  file stays comfortably under 400 lines. The primitive module
  `source-scanner-primitives.ts` is likewise small; if it approaches the limit,
  split by concern (classification vs. run-scanning) and record the decision.
  This layout is a firm design decision (see Decision Log), not a fallback left
  to chance. There is no test-file inventory guard on `tests/static-analysis`
  (only `src/static-analysis` is pinned by
  `tests/diagnostics/architecture-fixtures.ts`), so adding these files trips no
  inventory assertion.
- Risk: lint flags a newly introduced module whose only consumers are tests, or
  flags an unused re-export during a transitional commit.
  Severity: low. Likelihood: medium.
  Mitigation: each work item both defines and migrates real consumers so no
  dead code lands; run `make lint` before each commit.

## Progress

- [x] (2026-07-04T13:48:13Z) Work item 1: Introduce the primitive module and
  consolidate line-terminator, CRLF, and full-code-point classification.
  Evidence: `bun test
  tests/static-analysis/source-scanner-classification.test.ts` passed with 3
  tests; `bun test tests/static-analysis/source-scanner-classification.test.ts
  tests/static-analysis/source-mask-fixtures.test.ts
  tests/static-analysis/source-mask.property.test.ts
  tests/static-analysis/source-mask-internals.test.ts
  tests/static-analysis/source-file.test.ts
  tests/static-analysis/source-file.property.test.ts
  tests/static-analysis/workflow-metadata.test.ts
  tests/static-analysis/workflow-metadata-parser-edge.test.ts
  tests/diagnostics/architecture.test.ts
  tests/static-analysis/source-file-architecture.test.ts` passed with 134 tests
  and 2 snapshots unchanged after migration.
- [x] (2026-07-04T16:55:06Z) Work item 2: Consolidate backslash escape-skip
  primitives. Evidence: `bun test
  tests/static-analysis/source-scanner-escape.test.ts` passed with 3 tests;
  `bun test tests/static-analysis/source-mask-strings.test.ts
  tests/static-analysis/source-mask-templates.test.ts
  tests/static-analysis/source-mask-regex.test.ts
  tests/static-analysis/source-mask.property.test.ts
  tests/static-analysis/workflow-metadata-comment-scan.test.ts
  tests/static-analysis/masking-fixtures.test.ts
  tests/static-analysis/source-file-architecture.test.ts` passed with 37 tests
  after migrating the escape advances.
- [x] (2026-07-04T18:31:59Z) Work item 3: Consolidate comment-boundary
  scanners and the duplicated comment dispatch. Evidence: `bun test
  tests/static-analysis/source-scanner-comments.test.ts` passed with 4 tests;
  `bun test tests/static-analysis/source-scanner-comments.test.ts
  tests/static-analysis/workflow-metadata-comment-scan.test.ts
  tests/static-analysis/source-mask-comments.test.ts
  tests/static-analysis/workflow-metadata.test.ts
  tests/static-analysis/workflow-metadata-parser-edge.test.ts
  tests/static-analysis/masking-fixtures.test.ts
  tests/static-analysis/source-file-architecture.test.ts` passed with 71 tests
  and 1 snapshot unchanged after migration.
- [x] (2026-07-04T18:50:29Z) Work item 4: Consolidate the escape-aware
  delimited-string walks behind shared primitives, pinned by a differential
  property test. Evidence: `bun test
  tests/static-analysis/source-scanner-delimited.test.ts
  tests/static-analysis/delimited-end-parity.property.test.ts` passed with 6
  tests; `bun test tests/static-analysis/source-scanner-delimited.test.ts
  tests/static-analysis/delimited-end-parity.property.test.ts
  tests/static-analysis/workflow-metadata-comment-scan.test.ts
  tests/static-analysis/source-mask.property.test.ts
  tests/static-analysis/source-mask-templates.test.ts
  tests/static-analysis/workflow-metadata.test.ts
  tests/static-analysis/masking-fixtures.test.ts
  tests/static-analysis/source-mask-internals.test.ts
  tests/static-analysis/source-file-architecture.test.ts` passed with 83 tests
  and 1 snapshot unchanged after migration.
- [x] (2026-07-04T19:06:54Z) Work item 5: Consolidate identifier-run scanners
  (forward Unicode, forward and backward ASCII). Evidence: `bun test
  tests/static-analysis/source-scanner-identifiers.test.ts` passed with 3
  tests; `bun test tests/static-analysis/source-scanner-identifiers.test.ts
  tests/static-analysis/source-mask-regex.test.ts
  tests/static-analysis/source-mask-templates.test.ts
  tests/static-analysis/source-mask-internals.test.ts
  tests/static-analysis/source-mask.property.test.ts
  tests/static-analysis/workflow-metadata-parser-edge.test.ts
  tests/static-analysis/javascript-identifiers.test.ts
  tests/static-analysis/masking-fixtures.test.ts
  tests/static-analysis/source-file-architecture.test.ts` passed with 58 tests
  and 2 snapshots unchanged after migration.
- [x] (2026-07-04T19:09:45Z) Work item 6: Document the shared scanner
  primitive layer in the technical design and developer guide. Evidence:
  `make markdownlint` and `make nixie` passed after updating the documentation
  source of truth.

## Surprises & discoveries

- Observation: the removed `isLineTerminatorCharacter` alias had production
  importers beyond the source-mask and workflow-metadata scanner files named in
  the work item: `workflow-envelope-statement.ts`,
  `workflow-envelope-unsupported.ts`, and `workflow-envelope-meta-value.ts`.
  Evidence: exact text search for `isLineTerminatorCharacter` after removing
  the delimiter export found those import sites.
  Impact: they were migrated to `isSourceLineTerminator` in the same work item,
  preserving one source of truth and avoiding a temporary compatibility alias.
- Observation: the final CodeRabbit confirmation pass for Work item 1 was
  quota-blocked after the last completed CodeRabbit finding was fixed.
  Evidence: after the `codePointStringAt` JSDoc correction, `make all`,
  `make markdownlint`, and `make nixie` passed, but the final
  `coderabbit review --agent` attempt returned `errorType:"rate_limit"` with
  wait times of 8 and 20 minutes before analysis began.
  Impact: Work item 1 has green deterministic gates and all completed
  CodeRabbit findings addressed; the remaining review issue is a deferred
  final confirmation pass caused by service quota, not an unresolved finding.

## Decision log

- Decision: introduce one new internal module
  `src/static-analysis/source-scanner-primitives.ts` rather than growing
  `source-mask-delimiters.ts` or `source-scan.ts`.
  Rationale: `source-mask-delimiters.ts` owns mask-range concepts
  (`SourceMaskRange`, `blankMaskedRange`, `createMaskedRange`) that the
  metadata family must not depend on; `source-scan.ts` owns the single
  production line/offset scan. A dedicated primitive module keeps the shared
  grammar free of family-specific concerns and gives it one documented home, as
  `AGENTS.md` "Abstraction / adapter / helper policy" requires.
  Date/Author: 2026-07-04, planning agent.
- Decision: keep the two delimited-string-end orchestrators
  (`scanEscapedDelimitedEnd`, `scanDelimitedEnd`) separate; share only the
  escape-skip and delimiter-detection primitives beneath them.
  Rationale: their unterminated-return values and template `${...}` handling
  differ (verified at `source-mask-delimiters.ts:71-91` and
  `workflow-metadata-comment-scan.ts:18-39`); a merged, over-parameterized
  scanner would be the "Excessive Parameters" smell and risks changing masked
  ranges. This is a firm decision, pinned by a differential property test in
  Work item 4 — not an open fork.
  Date/Author: 2026-07-04, planning agent.
- Decision: move delimiter type aliases and delimiter guards into
  `source-scanner-primitives.ts` before extracting `templateExpressionEnd`.
  Rationale: Work item 1 makes `source-mask-delimiters.ts` consume
  `source-scanner-primitives.ts` for line-terminator classification. If Work
  item 4 then made `source-scanner-primitives.ts` import delimiter guards from
  `source-mask-delimiters.ts`, the two modules would form a cycle. Owning the
  delimiter guards in the primitive layer keeps the dependency direction
  one-way while preserving the plan's shared grammar boundary.
  Date/Author: 2026-07-04, implementation agent after CodeRabbit review.
- Decision: split the primitive tests into per-concern files (one per work item)
  and place the Work item 4 differential parity oracle in its own dedicated file
  `tests/static-analysis/delimited-end-parity.property.test.ts`, rather than
  accumulating every case into a single `source-scanner-primitives.test.ts`.
  Rationale: `tests/build-gate/file-size.test.ts` enforces the 400-line limit
  over `tests/` as well as `src/`
  (`file-size-support.ts:7,41-46`); a single accumulating file gathering ~10
  primitives' cases plus the mutually-recursive delimited-end oracle would risk
  tripping the gate in a late work item and forcing an unplanned restructure.
  Per-concern files keep every test file small and keep each work item's tests
  self-contained. This resolves round-1 design-review blocking point 2.
  Date/Author: 2026-07-04, planning agent (round 2).
- Decision: insert `"source-scanner-primitives.ts"` into
  `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` **after** `"source-scan.ts"` and
  **before** `"source-snippet.ts"`, not before `"source-scan.ts"`.
  Rationale: `tests/diagnostics/architecture.test.ts:60` asserts
  `sourceModuleFiles("src/static-analysis").toEqual(EXPECTED_...)`, and
  `sourceModuleFiles` returns a default `.sort()`ed listing
  (`architecture.test.ts:33-40`). Under the default UTF-16 code-unit sort,
  `"source-scan.ts"` < `"source-scanner-primitives.ts"` < `"source-snippet.ts"`
  because after the shared prefix `"source-scan"` the next unit is `.`
  (U+002E, in `source-scan.ts`) versus `n` (U+006E, in
  `source-scanner-primitives.ts`), and `.` sorts first; then between
  `source-scanner-primitives` and `source-snippet` the units are `c` (U+0063)
  versus `n` (U+006E), and `c` sorts first. The earlier draft's slot (before
  `source-scan.ts`) would make the fixture disagree with the sorted directory
  listing and fail the guard. This resolves round-1 design-review blocking
  point 1.
  Date/Author: 2026-07-04, planning agent (round 2).
- Decision: do not update ADR 0001 for the scanner primitive layer.
  Rationale: the change consolidates internal static-analysis helper ownership
  and does not alter the accepted static-analysis boundary, package exports, or
  ODW runtime-separation decision recorded by the ADR. The technical design and
  developer guide are the right long-term documentation surfaces.
  Date/Author: 2026-07-04, implementation agent.

## Outcomes & retrospective

- Work item 1 introduced `source-scanner-primitives.ts` as the internal home
  for line-terminator, CRLF, and code-point classification, migrated existing
  scanner consumers, added focused classification tests, and kept the
  static-analysis behaviour suites and architecture guards green.
- Work item 2 added `indexAfterEscapedUnit`, migrated the plain backslash
  escape advances across source-mask and workflow-metadata scanners, and kept
  CRLF line-continuation specialization local to the callers that own it. The
  CodeRabbit review finding was addressed by adding an escaped astral-character
  case that documents the primitive's one-UTF-16-unit contract.
- Work item 3 added shared line-comment, block-comment, and comment-dispatch
  primitives, then migrated the source-mask, workflow-metadata parser, and
  workflow-envelope metadata-value scanners over them without changing
  behaviour. CodeRabbit reported no findings for the work item.
- Work item 4 moved delimiter guards and the template-expression walker into
  the primitive layer, migrated source-mask and workflow-metadata importers, and
  added differential property coverage for both delimited scanners. CodeRabbit
  reported no findings for the work item after one interrupted attempt was
  replaced by a completed review.
- Work item 5 added shared identifier-run primitives, migrated regex flag
  scanning, previous-token scanning, and metadata identifier scanning over them,
  and addressed CodeRabbit's test-boundary finding. The confirmation review
  reported no findings.
- Work item 6 documented `source-scanner-primitives.ts` as the shared
  internal token-grammar layer in the technical design and developer guide, and
  recorded that ADR 0001 did not need to change because the static-analysis
  boundary stayed the same.
- Work item 1 CodeRabbit review findings were addressed: the plan now avoids
  the future delimiter-guard import cycle, uses Oxford `-ize` spellings,
  records the correct remaining-work state, lists all line-terminator importers,
  clarifies `indexAfterEscapedUnit` EOF behaviour, and documents
  `codePointStringAt` low-surrogate behaviour. The final confirmation review is
  deferred by CodeRabbit rate limiting after deterministic gates passed.

## Context and orientation

The reader is assumed to know nothing about this repository. `odw-lint` is a
TypeScript static checker for Open Dynamic Workflows (ODW) workflow files. It is
built and tested with Bun and gated through a `Makefile`. All production source
lives under `src/`; all tests under `tests/`.

The relevant subsystem is `src/static-analysis/`. Two scanner families share a
JavaScript token grammar but each re-implement it. The concrete, verified
duplication (each fact confirmed by reading the cited file in this worktree):

1. **Line-terminator classification — two sources of truth.**
   - `src/static-analysis/source-scan.ts:13` defines `LINE_TERMINATORS` as the
     set of `\n`, `\r`, U+2028, and U+2029, and `isLineTerminator` (line 134).
   - `src/static-analysis/source-mask-delimiters.ts:23-27` defines
     `isLineTerminatorCharacter` with the identical four code points as an
     inline OR-chain. It is imported by `source-mask-strings.ts`,
     `source-mask-templates.ts`, `source-mask-comments.ts`,
     `workflow-metadata-comment-scan.ts`, and `workflow-metadata-string-scan.ts`.

2. **CRLF-pair detection — repeated inline.**
   - `source-scan.ts:145` `isCrLfTerminator(text, index)`.
   - `source-mask-strings.ts:78-84` `isEscapedCrLfLineContinuation`.
   - `source-mask-comments.ts:65` inline `text[i] === "\r" && text[i+1] === "\n"`.
   - `workflow-metadata-string-scan.ts:114-122` `isCrLfContinuation`.

3. **Full-code-point reader — duplicated.**
   - `workflow-metadata-parser-scan.ts:253-256` private `codePointAt`
     returning a string (or `""` at EOF).
   - `source-scan.ts:55-61` inlines `codePointAt` + `String.fromCodePoint`.

4. **Backslash escape-skip — repeated in six scanners.**
   `source-mask-delimiters.ts:80-83`, `source-mask-strings.ts:56-57` /
   `73-84`, `source-mask-templates.ts:125-131`, `source-mask-regex.ts:237-250`,
   `workflow-metadata-comment-scan.ts:26-28`, and
   `workflow-metadata-string-scan.ts:70-95` each hand-roll "on `\\`, advance
   past the escaped unit".

5. **Comment-boundary scanning — two contracts plus a duplicated dispatch.**
   - `source-mask-comments.ts:60-75` `scanLineCommentEnd(text, start)` consumes
     the terminator (returns the index after CRLF/LF) and block comments use
     `indexOf("*/")`.
   - `workflow-metadata-comment-scan.ts:49-74` `scanLineCommentEnd(text, start,
     end)` returns the terminator index (does not consume it) and
     `scanBlockCommentEnd(text, start, end)`.
   - The private `scanCommentEnd` dispatch is duplicated **verbatim** in
     `workflow-metadata-comment-scan.ts:104-112` and
     `workflow-metadata-parser-scan.ts:299-307`.

6. **Identifier-run scanning — four variants over the same predicates.**
   `src/static-analysis/javascript-identifiers.ts` already owns the character
   predicates (`isIdentifierStartCharacter`, `isIdentifierPartCharacter`,
   `isAsciiIdentifierStartCharacter`, `isAsciiIdentifierCharacter`), but the
   *runs* are re-implemented: forward Unicode run in
   `workflow-metadata-parser-scan.ts:154-170` (`scanIdentifierEnd`); forward
   ASCII run in `source-mask-regex.ts:334-342` (`scanRegexFlagsEnd`); backward
   ASCII run in `source-mask.ts:127-139` (`significantTokenEndingAt`) and
   `source-mask-templates.ts:184-205` (`previousSignificantTemplateToken`).

The design intent for this consolidation is `docs/technical-design.md` §6.2
("Static source model"), which already documents that the masker keeps a public
facade (`source-mask.ts`) with token-family internals, and §6.1's precedent of
a shared internal seam (`swc-ast.ts`) for parser-backed rules. The developer
guide `docs/developers-guide.md` "Internal source-helper ownership is split by
responsibility" (lines 574-605) is the list that must gain the new module.

### Guards that pin structure (update in the same commit that moves code)

- `tests/diagnostics/architecture-fixtures.ts`
  `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` (lines 38-80) pins the exact
  `src/static-analysis` directory listing; `tests/diagnostics/architecture.test.ts:60`
  asserts it.
- `tests/static-analysis/source-file-architecture.test.ts` pins the exact
  top-level declaration set of each source-helper module (`SOURCE_HELPER_MODULES`
  at lines 12-29, and the `expectModuleDeclarations` blocks at lines 154-363),
  and asserts every listed module is at or under 400 lines.
- `tests/build-gate/file-size.test.ts` enforces the 400-line limit repo-wide.

## Plan of work

Each work item follows Red-Green-Refactor: add or extend the primitive unit
tests first (Red — they fail because the primitive does not yet exist in its new
home), implement the primitive and migrate the duplicate call sites (Green),
then clean up and re-run the wider behaviour gates (Refactor). Because the
behaviour suites already exist and must stay green, they are the standing
safety net for every migration; the "Red" step for each item is the new
primitive-level test that specifies the extracted contract.

The primitive module is built up additively: Work item 1 creates it and moves
the first primitive group; later items add primitives to it and delete the
duplicates they replace, so each commit genuinely reduces duplication rather
than adding a parallel copy.

### Work item 1 — Introduce the primitive module and consolidate classification

Create `src/static-analysis/source-scanner-primitives.ts` with a
`/** @file ... */` block describing it as the single home for the low-level
JavaScript token-grammar primitives shared by the source-mask and
workflow-metadata scanner families, its permitted call sites (both families and
`source-scan.ts`), and its composition rules (pure UTF-16 string logic; no
dependency on mask-range or metadata types).

Define, with JSDoc:

- `isSourceLineTerminator(character: string): boolean` — the single source of
  truth for the four line-terminator code points.
- `isCrLfAt(text: string, index: number): boolean` — CRLF pair at `index`.
- `codePointStringAt(text: string, index: number): string` — the full code
  point at `index` as a string, `""` at or past EOF.

Migrate consumers to these primitives and delete the duplicates:

- `source-scan.ts`: replace the `LINE_TERMINATORS` set plus `isLineTerminator`
  body and the `isCrLfTerminator` body, and the inline `codePointAt` at
  lines 55-61, with delegations to the primitives. Keep the module's existing
  public function names/exports stable where other modules import them;
  re-export from the primitive where a name is shared.
- `source-mask-delimiters.ts`: `isLineTerminatorCharacter` delegates to (or is
  replaced by an import of) `isSourceLineTerminator`. If the declaration is
  removed, update every importer
  (`source-mask-strings.ts`, `source-mask-templates.ts`,
  `source-mask-comments.ts`, `workflow-metadata-comment-scan.ts`,
  `workflow-metadata-string-scan.ts`, `workflow-envelope-statement.ts`,
  `workflow-envelope-unsupported.ts`, and `workflow-envelope-meta-value.ts`) to
  import the primitive, and update the `source-mask-delimiters.ts` declaration
  list in
  `source-file-architecture.test.ts` (lines 204-219).
- `source-mask-strings.ts` `isEscapedCrLfLineContinuation`,
  `source-mask-comments.ts` inline CRLF check, and
  `workflow-metadata-string-scan.ts` `isCrLfContinuation`: express via
  `isCrLfAt` (keeping any surrounding bounds/`endIndex` logic local).
- `workflow-metadata-parser-scan.ts`: replace the private `codePointAt` with
  `codePointStringAt`.

Update guards in the same commit:

- Add `"source-scanner-primitives.ts"` to
  `EXPECTED_STATIC_ANALYSIS_MODULE_FILES`
  (`tests/diagnostics/architecture-fixtures.ts`) in the exact position the
  default sort produces: **after** `"source-scan.ts"` (currently line 51) and
  **before** `"source-snippet.ts"` (currently line 52). This is the
  default-`.sort()` UTF-16 order the guard requires, because
  `tests/diagnostics/architecture.test.ts:60` asserts
  `sourceModuleFiles("src/static-analysis").toEqual(EXPECTED_...)` against a
  `.sort()`ed directory listing (`architecture.test.ts:33-40`): after the shared
  prefix `"source-scan"`, `"source-scan.ts"` sorts first (next unit `.`,
  U+002E), then `"source-scanner-primitives.ts"` (next unit `n` beats
  `"source-snippet.ts"`'s later divergence at `c` vs `n`). Do **not** place it
  before `"source-scan.ts"` — that fails the guard. See the Decision Log entry
  for the full ordering derivation.
- Add `"source-scanner-primitives.ts"` to `SOURCE_HELPER_MODULES` and add an
  `expectModuleDeclarations` block for it in
  `tests/static-analysis/source-file-architecture.test.ts`; adjust the pinned
  declaration lists of any module whose declaration set changed.

Docs: add a one-line entry for the new module to the developer guide ownership
list (`docs/developers-guide.md` ~lines 574-605). Full documentation lands in
Work item 6; this keeps the commit self-consistent.

Design references: `docs/technical-design.md` §6.2; `AGENTS.md` "Refactoring
Heuristics & Workflow" (Duplicated Code) and "Abstraction / adapter / helper
policy"; `AGENTS.md` "TypeScript Guidance" (`/** @file ... */`, predicates,
immutability).

Skills to load: `execplans` (this document), `biomejs` (formatting/lint gate).
Testing per `AGENTS.md` "Testing": table-driven unit tests.

Tests:

- New `tests/static-analysis/source-scanner-classification.test.ts`:
  table-driven cases for `isSourceLineTerminator` (all four terminators plus
  negatives such as space, `\v`, `\f`, U+00A0, `""`), `isCrLfAt` (CRLF, lone
  `\r`, `\r` at EOF, `\n\r`), and `codePointStringAt` (ASCII, BMP, astral code
  point, mid-surrogate index, past-EOF → `""`). This is the WI1 concern file;
  later work items add their own per-concern files rather than growing this one.
- Behaviour safety net (must stay green, no snapshot change):
  `source-mask-fixtures.test.ts`, `source-mask.property.test.ts`,
  `source-mask-internals.test.ts`, `source-file.test.ts`,
  `source-file.property.test.ts`, `workflow-metadata.test.ts`,
  `workflow-metadata-parser-edge.test.ts`.
- Guard suites: `tests/diagnostics/architecture.test.ts`,
  `tests/static-analysis/source-file-architecture.test.ts`.

### Work item 2 — Consolidate backslash escape-skip primitives

Add to `source-scanner-primitives.ts`:

- `indexAfterEscapedUnit(text: string, backslashIndex: number): number` — the
  index just past a `\\`-escaped unit, i.e. `backslashIndex + 2`, defined once
  with the documented assumption that the caller has already matched `\\` at
  `backslashIndex`, has excluded out-of-bounds EOF calls before invoking it, and
  handles line-continuation specialization itself. The primitive does not clamp
  to `text.length`; scanners that intentionally allow an escape at EOF preserve
  the existing `backslashIndex + 2` advance.

Migrate the plain escape-skips to the primitive while leaving genuinely
specialized behaviour local and built on top of it:

- `source-mask-delimiters.ts:80-83` (`scanEscapedDelimitedEnd`).
- `source-mask-templates.ts:125-131` (`nextEscapedTemplateIndex`).
- `source-mask-regex.ts:237-250` (`nextEscapedRegexScanStep`) — keep the
  line-terminator rejection local; use the primitive for the advance.
- `workflow-metadata-comment-scan.ts:26-28` (inside `scanDelimitedEnd`).
- `source-mask-strings.ts` `nextEscapedQuotedStringIndex` and
  `workflow-metadata-string-scan.ts` `scanStringEscape`/`scanLineContinuationEnd`
  keep their CRLF-line-continuation specialization but compose `isCrLfAt`
  (from Work item 1) and the escape primitive rather than open-coding offsets.

Do not change any unterminated-return value or bound.

Design references: `docs/technical-design.md` §6.2; `AGENTS.md` "Refactoring
Heuristics & Workflow" (Duplicated Code);
`docs/complexity-antipatterns-and-refactoring-strategies.md` (extract shared
low-level helper, avoid duplicated escape logic).

Skills to load: `execplans`, `biomejs`.

Tests:

- New `tests/static-analysis/source-scanner-escape.test.ts` with
  `indexAfterEscapedUnit` cases (mid-string escape, escape before delimiter,
  escape at EOF). A dedicated WI2 concern file, not an extension of WI1's
  file.
- Safety net: the string, template, and regex scanner suites
  (`source-mask-strings.test.ts`, `source-mask-templates.test.ts`,
  `source-mask-regex.test.ts`, `source-mask.property.test.ts`) plus
  `workflow-metadata-comment-scan.test.ts` and the escaped-delimiter masking
  fixtures (`fixtures/masking/escaped-string-delimiter-decoy.js`,
  `escaped-regex-delimiter-decoy.js`, `crlf-decoy.js`) — all green, no change.

### Work item 3 — Consolidate comment-boundary scanners and dispatch

The two families need line and block comment boundaries with **different
terminator-consumption contracts**, so the primitive layer exposes both
explicitly rather than one ambiguous function.

Add to `source-scanner-primitives.ts`, with JSDoc that states the contract of
each precisely:

- `lineCommentContentEnd(text, start, end)` — index of the terminator (does not
  consume it); the metadata contract.
- `lineCommentTerminatorEnd(text, start)` — index after the terminator
  (consumes CRLF/LF); the mask contract.
- `blockCommentEnd(text, start, end)` — index after `*/`, or `end` when
  unterminated.
- `commentDispatchEnd(text, index, end)` — the shared `scanCommentEnd` dispatch
  (`//` → line-content end, `/*` → block end, else `undefined`), replacing the
  verbatim duplicate in `workflow-metadata-comment-scan.ts:104-112` and
  `workflow-metadata-parser-scan.ts:299-307`.

Migrate:

- `workflow-metadata-comment-scan.ts` `scanLineCommentEnd`/`scanBlockCommentEnd`
  become thin re-exports of (or direct delegations to) the primitives, and the
  private `scanCommentEnd` is deleted in favour of `commentDispatchEnd`.
- `workflow-metadata-parser-scan.ts` deletes its private `scanCommentEnd` and
  imports `commentDispatchEnd`.
- `source-mask-comments.ts` `scanLineCommentEnd` delegates to
  `lineCommentTerminatorEnd`; keep `scanCommentRange` and `isCommentStart`
  local (they build mask ranges).

Update `source-file-architecture.test.ts` declaration lists for
`source-mask-comments.ts` (lines 220-224) and any changed module.
`workflow-metadata-comment-scan.ts` is not in the source-helper architecture
list, but its exported surface is exercised by
`workflow-metadata-comment-scan.test.ts`, which must stay green.

Design references: `docs/technical-design.md` §6.2; `AGENTS.md` "Predicates"
and command/query segregation.

Skills to load: `execplans`, `biomejs`.

Tests:

- New `tests/static-analysis/source-scanner-comments.test.ts`: both
  line-comment contracts (content-end vs terminator-end) over LF, CRLF,
  EOF-without-terminator; block-comment terminated / unterminated /
  bounded-by-`end`; dispatch for `//`, `/*`, and non-comment. A dedicated WI3
  concern file.
- Safety net: `workflow-metadata-comment-scan.test.ts`,
  `source-mask-comments.test.ts`, `workflow-metadata.test.ts`,
  `workflow-metadata-parser-edge.test.ts`,
  `fixtures/masking/comment-decoy.js` via `masking-fixtures.test.ts` — green,
  no change.

### Work item 4 — Consolidate the delimited-string walks

Per the Decision Log, the two orchestrators stay separate; this item extracts
the shared sub-scanners beneath them and proves equivalence.

Add to `source-scanner-primitives.ts`:

- the delimiter type aliases and guards currently owned by
  `source-mask-delimiters.ts`:
  `QuotedStringDelimiter`, `TemplateDelimiter`, `RegexDelimiter`,
  `StringLikeDelimiter`, `isQuotedStringDelimiter`, `isRegexDelimiter`,
  `isStringLikeDelimiter`, and `isTemplateDelimiter`. Migrate
  `source-mask-delimiters.ts` and existing importers to consume these from the
  primitive layer so dependency direction stays one-way:
  scanner-family modules → `source-scanner-primitives.ts`. Do not make
  `source-scanner-primitives.ts` import `source-mask-delimiters.ts`; that would
  create a circular dependency because `source-mask-delimiters.ts` already uses
  line-terminator primitives.
- `templateExpressionEnd(text, start, end)` — the balanced `${ ... }` scanner
  currently private in `workflow-metadata-comment-scan.ts:77-101`
  (`scanTemplateExpressionEnd`), which itself recurses through nested
  string-like delimiters and comments. Extract it (composing
  `commentDispatchEnd` and the primitive-layer delimiter type guards) so the
  metadata `scanDelimitedEnd` and any future consumer share one interpolation
  walker.

Refactor the two orchestrators to build on the shared escape primitive
(Work item 2) and, for the metadata one, the shared `templateExpressionEnd`,
keeping every observable output identical:

- `source-mask-delimiters.ts:71-91` `scanEscapedDelimitedEnd` (returns
  `text.length` when unterminated; no `${}` handling).
- `workflow-metadata-comment-scan.ts:18-39` `scanDelimitedEnd` (bounded by
  `endIndex`; handles `${}`; returns `endIndex` when unterminated).

Verification is the gate here. Add a **differential property test** in its own
dedicated file `tests/static-analysis/delimited-end-parity.property.test.ts`
(mandatory — not inlined into a shared primitive test file, so the frozen oracle
does not push any file toward the 400-line size gate). In that file, capture a
frozen copy of each original function body — the mutually-recursive
`scanDelimitedEnd` / `scanTemplateExpressionEnd` / `scanCommentEnd` /
`scanLineCommentEnd` / `scanBlockCommentEnd` cluster — inline as a reference
oracle, generate randomized source strings with `fast-check` (mixing quotes,
backticks, escapes, `${...}` nesting, unterminated tails, CRLF), and assert the
refactored function equals the oracle for every input. If any input diverges,
per the merge-safety tolerance, do not ship the change — keep the original and
record the divergence. If the frozen oracle plus generators alone approach the
400-line limit, split the generators into a sibling
`delimited-end-parity-support.ts` helper (imported by the property test) and
record the decision; do not let the file grow unbounded.

Design references: `docs/technical-design.md` §6.2; `AGENTS.md` "Invariant
testing" (fast-check property tests when behaviour ranges over inputs);
`docs/complexity-antipatterns-and-refactoring-strategies.md`.

Skills to load: `execplans`, `biomejs`. Property-test authoring follows the
`AGENTS.md` "Testing" `fast-check` rule (there is no separate router skill for
TypeScript in this repository; `hypothesis`/`crosshair`/`mutmut` are
Python-only and do not apply).

Tests:

- New `tests/static-analysis/source-scanner-delimited.test.ts` with
  `templateExpressionEnd` cases (simple, nested, string-inside-expression,
  comment-inside-expression, unterminated). A dedicated WI4 unit concern file.
- New differential property test in its own dedicated file
  `tests/static-analysis/delimited-end-parity.property.test.ts` (mandatory — the
  frozen oracle is never inlined into a shared unit-test file).
- Safety net: `workflow-metadata-comment-scan.test.ts`,
  `source-mask.property.test.ts`, `source-mask-templates.test.ts`,
  `workflow-metadata.test.ts`,
  `fixtures/masking/template-literal-decoy.js` and
  `template-interpolation-boundary-decoy.js` via `masking-fixtures.test.ts` —
  green, no change.

### Work item 5 — Consolidate identifier-run scanners

Add to `source-scanner-primitives.ts`, composed over the existing
`javascript-identifiers.ts` predicates (do not re-implement the predicates):

- `identifierRunEnd(text, start, end)` — forward full-code-point identifier run
  (replaces `scanIdentifierEnd` core in
  `workflow-metadata-parser-scan.ts:154-170`).
- `asciiIdentifierRunEnd(text, start): number` — forward ASCII run (replaces
  the `scanRegexFlagsEnd` loop, `source-mask-regex.ts:334-342`).
- `asciiIdentifierRunStart(text, end): number` — backward ASCII run returning
  the run's start index, so callers can slice the token (replaces the backward
  loops in `source-mask.ts:127-139` `significantTokenEndingAt` and
  `source-mask-templates.ts:196-205` `previousSignificantTemplateToken`).

Migrate the four call sites to the primitives, preserving each caller's
surrounding logic (operator-token handling in `significantOperatorEndingAt`,
comment-skipping in `previousSignificantTemplateToken`). Keep the public
declaration names of the migrated modules unless the architecture pins are
updated in the same commit; update `source-file-architecture.test.ts`
declaration lists for `source-mask.ts` (lines 189-198),
`source-mask-templates.ts` (lines 231-254), and `source-mask-regex.ts`
(lines 255-275) for any removed private helper.

Design references: `docs/technical-design.md` §6.2; tasks 2.1.12.4 / 2.1.12.5 /
2.1.12.8 established `javascript-identifiers.ts` as the predicate home — this
item adds the *run* layer over it, per `AGENTS.md` "Use functions and
composition".

Skills to load: `execplans`, `biomejs`.

Tests:

- New `tests/static-analysis/source-scanner-identifiers.test.ts`: forward
  Unicode run (ZWNJ/ZWJ continuation, astral start), forward ASCII run (regex
  flags, stop at non-ASCII), backward ASCII run (token start at buffer start,
  after operator, after whitespace). A dedicated WI5 concern file.
- Safety net: `source-mask-regex.test.ts`, `source-mask-templates.test.ts`,
  `source-mask-internals.test.ts`, `source-mask.property.test.ts`,
  `workflow-metadata-parser-edge.test.ts`, `javascript-identifiers.test.ts`,
  and the `unicode-decoy.js`/`regex-decoy.js` masking fixtures — green, no
  change.

### Work item 6 — Document the shared scanner primitive layer

Update documentation so the design docs are the source of truth for the new
layer (`AGENTS.md` "Documentation Maintenance"; "Abstraction / adapter / helper
policy" requires recording the decision where it changes long-term structure).

- `docs/technical-design.md` §6.2: add a paragraph describing
  `source-scanner-primitives.ts` as the shared low-level token-grammar layer
  consumed by both the source-mask facade and the workflow-metadata scanners,
  naming the primitive groups (classification, escape, comment boundaries,
  delimited/interpolation walks, identifier runs), its internal-only status,
  and the rule that neither family re-implements these primitives.
- `docs/developers-guide.md` "Internal source-helper ownership" list
  (lines 574-605): finalize the entry for the new module, including permitted
  call sites and composition rules.
- Consider whether `docs/adr/0001-static-analysis-boundary.md` needs a note;
  if the ownership boundary is unchanged (it is — this is internal
  consolidation), record in the Decision Log that no ADR change is required and
  do not edit the ADR.

Wrap prose at 80 columns, code blocks at 120; use en-GB Oxford spelling.

Skills to load: `execplans`, `en-gb-oxendict` (spelling). Do not touch a
changelog unless one already exists and is maintained (verify first; do not
create one).

Tests / validation: `make markdownlint` and `make nixie` (for any Mermaid), and
`tests/build-gate/documentation-contents.test.ts` if it asserts on the touched
docs — verify and keep green.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-13`.

Each work item creates its own focused test file (the per-concern layout that
keeps every test file under the 400-line source-and-test size gate). The
`$FOCUSED` file for each work item is:

- Work item 1: `tests/static-analysis/source-scanner-classification.test.ts`
- Work item 2: `tests/static-analysis/source-scanner-escape.test.ts`
- Work item 3: `tests/static-analysis/source-scanner-comments.test.ts`
- Work item 4: `tests/static-analysis/source-scanner-delimited.test.ts` **and**
  `tests/static-analysis/delimited-end-parity.property.test.ts`
- Work item 5: `tests/static-analysis/source-scanner-identifiers.test.ts`
- Work item 6: no new unit test file (documentation only; validate with
  `make markdownlint` and `make nixie`).

Per work item, substituting that work item's `$FOCUSED` file(s):

1. Write the failing primitive unit test(s) in this work item's `$FOCUSED`
   file(s) and run only those to observe the expected failure (Red):

   ```sh
   bun test $FOCUSED
   ```

   Expect the run to fail because the primitive/module does not yet exist.

2. Implement the primitive(s) in
   `src/static-analysis/source-scanner-primitives.ts` and migrate the duplicate
   call sites; delete the replaced duplicates. Re-run the focused suite (Green):

   ```sh
   bun test $FOCUSED
   ```

   Expect all focused cases to pass.

3. Run the behaviour safety net and guards for the touched families, expecting
   no failures and no snapshot changes:

   ```sh
   bun test tests/static-analysis tests/diagnostics/architecture.test.ts
   ```

4. Format only the files this work item changed, then gate:

   ```sh
   bun run fmt        # Biome writes formatting for changed src/tests
   make all
   ```

   For a work item that changes Markdown (Work item 6), additionally run:

   ```sh
   make markdownlint
   make nixie
   ```

5. Commit with an imperative-mood subject (at most 50 characters) and a wrapped
   body explaining what moved and why behaviour is unchanged, for example:

   ```text
   Share scanner line-terminator primitives

   Consolidate line-terminator, CRLF, and code-point readers used by the
   source-mask and workflow-metadata scanners into one internal
   source-scanner-primitives module. Behaviour-preserving; existing masking
   and metadata suites stay green.
   ```

Do not run a repo-global Markdown reformat (`make fmt` / `mdformat-all`); format
only the specific files touched.

## Validation and acceptance

Quality criteria ("done"):

- Tests: every existing static-analysis and diagnostics suite passes unchanged
  (no snapshot updates), and the new primitive unit tests plus the Work item 4
  differential property test pass. `make test` is green.
- Lint/typecheck: `make lint` and `make typecheck` are clean; no new
  suppressions.
- Format: `make check-fmt` is clean.
- Structure: `tests/diagnostics/architecture.test.ts` (module inventory) and
  `tests/static-analysis/source-file-architecture.test.ts` (declaration
  ownership, 400-line limit) pass with the new module present.
- Behaviour: no change to any masked range, metadata parse result, span, or
  diagnostic. This is the acceptance behaviour — observable via the unchanged
  behaviour suites and snapshots.
- Docs: `make markdownlint` and `make nixie` pass after Work item 6.

Quality method:

- Full repository gate before each commit:

  ```sh
  make all
  ```

- Markdown gates when Markdown changes:

  ```sh
  make markdownlint
  make nixie
  ```

Red-Green-Refactor evidence to record in `Progress` and `Outcomes` per work
item: the focused-suite failure before implementation, the focused-suite pass
after, and the wider-gate pass after cleanup.

## Idempotence and recovery

- Every step is re-runnable; `bun test` and `make all` are read-only apart from
  Biome formatting writes and Bun's snapshot files (which must not change here).
- If a migration breaks a behaviour suite, revert the migration commit
  (`git revert` or reset the uncommitted change) and re-examine the primitive's
  contract against the cited source before retrying; do not adjust a behaviour
  snapshot to force a pass.
- The primitive module is additive; if a work item must be abandoned, the
  partially-migrated primitive can remain only if all its call sites and guards
  are consistent and gates pass; otherwise reset to the last green commit.
- Name any stash deterministically, e.g.
  `df12-stash v1 task=2.1.13 kind=park reason="formatter churn"`; never use a
  bare stash message. Formatter/build churn to discard is `kind=discard`.

## Interfaces and dependencies

New internal module `src/static-analysis/source-scanner-primitives.ts` (not
re-exported from any package entry). Final intended surface (names may be
refined during implementation, but the contracts are fixed):

```ts
// Classification (Work item 1)
export const isSourceLineTerminator: (character: string) => boolean;
export const isCrLfAt: (text: string, index: number) => boolean;
export const codePointStringAt: (text: string, index: number) => string;

// Escape (Work item 2)
export const indexAfterEscapedUnit: (text: string, backslashIndex: number) => number;

// Comment boundaries (Work item 3)
export const lineCommentContentEnd: (text: string, start: number, end: number) => number;
export const lineCommentTerminatorEnd: (text: string, start: number) => number;
export const blockCommentEnd: (text: string, start: number, end: number) => number;
export const commentDispatchEnd: (text: string, index: number, end: number) => number | undefined;

// Delimited / interpolation walks (Work item 4)
export type QuotedStringDelimiter = "'" | '"';
export type TemplateDelimiter = "`";
export type RegexDelimiter = "/";
export type StringLikeDelimiter = QuotedStringDelimiter | TemplateDelimiter;
export const isQuotedStringDelimiter: (character: string) => character is QuotedStringDelimiter;
export const isRegexDelimiter: (character: string) => character is RegexDelimiter;
export const isStringLikeDelimiter: (character: string) => character is StringLikeDelimiter;
export const isTemplateDelimiter: (character: string) => character is TemplateDelimiter;
export const templateExpressionEnd: (text: string, start: number, end: number) => number;

// Identifier runs (Work item 5)
export const identifierRunEnd: (text: string, start: number, end: number) => number;
export const asciiIdentifierRunEnd: (text: string, start: number) => number;
export const asciiIdentifierRunStart: (text: string, end: number) => number;
```

Dependencies: `javascript-identifiers.ts` (predicates, consumed by the
identifier-run primitives). Delimiter type guards move into
`source-scanner-primitives.ts` before `templateExpressionEnd` uses them, so
dependency direction remains scanner-family modules →
`source-scanner-primitives.ts`; the primitive layer must never import
`source-mask-delimiters.ts`. No external dependency is added.

## Revision note

Round 2 (2026-07-04) — resolves the two round-1 design-review blocking points.

- What changed (blocking point 1): Work item 1's module-inventory insertion slot
  was corrected. The new module `"source-scanner-primitives.ts"` is now inserted
  into `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` **after** `"source-scan.ts"` and
  **before** `"source-snippet.ts"`, matching the default `.sort()` UTF-16 order
  the guard asserts (`tests/diagnostics/architecture.test.ts:60` against the
  `.sort()`ed listing at `architecture.test.ts:33-40`). The earlier "before
  `source-scan.ts`" slot would have failed the guard. A Decision Log entry
  records the full ordering derivation.
- What changed (blocking point 2): the file-size Risk now explicitly covers the
  test files, citing `tests/build-gate/file-size.test.ts` and
  `file-size-support.ts:7,41-46` (400-line limit over `src/` **and** `tests/`,
  `.property.test.ts` in scope). The plan now commits to a per-concern test-file
  layout — one focused unit file per work item
  (`source-scanner-classification`/`-escape`/`-comments`/`-delimited`/
  `-identifiers`.test.ts) — and mandates the Work item 4 differential parity
  oracle in its own dedicated file
  `tests/static-analysis/delimited-end-parity.property.test.ts` (with a
  documented split to a `-support.ts` helper if even that approaches the limit).
  No single test file accumulates across work items, so the size gate cannot be
  tripped late. A Decision Log entry records this layout as a firm decision.
- Why it changed: both points were verified against the real fixtures in the
  worktree before revising, so the plan is now implementable exactly as written.
- Effect on remaining work: no work item was added or removed; the six work
  items remain unchanged in scope. Work item 1 is now complete, and work items
  2 through 6 remain. The round-2 planning update changed only the test-file
  names, the WI1 guard slot, the Risk analysis, the Concrete-steps focused-test
  mapping, and the Decision Log.

## Addenda

- [ ] 2.1.13.1. Complete scanner delimiter-depth primitive consolidation.
  - Source: audit:1.5.12; severity low.
  - Scope: move the remaining delimiter-depth folding logic behind one
    primitive so unbalanced delimiters are clamped consistently across scanner
    families.
  - Success: workflow-metadata and envelope scanners share the same
    delimiter-depth primitive where their contracts match, with existing
    scanner behaviour unchanged.
- [ ] 2.1.13.2. Reconcile primitive interface notes.
  - Source: review:2.1.13; severity low.
  - Scope: align this ExecPlan's interface-signature notes with the shipped
    `source-scanner-primitives.ts` API, including the `identifierRunEnd`
    `number | undefined` return contract already documented in module JSDoc.
  - Success: the plan no longer describes a narrower primitive return type
    than the implementation actually exposes.
- [ ] 2.1.13.3. Add delimited-oracle provenance checks.
  - Source: review:2.1.13; severity low.
  - Scope: make the hand-frozen delimited-end parity oracles self-checking or
    clearly provenance-anchored, either through a build-time guard or by folding
    the faithfulness check into standing scanner behaviour fixtures.
  - Success: future scanner grammar changes cannot leave the parity oracle
    relationship implicit or dependent on reviewer memory alone.
- [ ] 2.1.13.4. Enrich scanner primitive boundary coverage.
  - Source: review:2.1.13; severity low.
  - Scope: add direct table-driven primitive tests for line-comment terminator
    variants, bounded block-comment endings, and nested
    `templateExpressionEnd` comment or string paths.
  - Success: boundary failures localize to the primitive suites before they
    surface only through downstream masking or metadata behaviour tests.
- [ ] 2.1.13.5. Reconcile comment scanner wrapper naming.
  - Source: audit:2.1.13; severity low.
  - Scope: standardize `scanLineCommentEnd` wrapper ownership, or remove thin
    wrappers in favour of direct primitive imports, so source-mask and
    workflow-metadata comment scanners do not expose same-name functions with
    divergent semantics.
  - Success: scanner comment-boundary call sites have one documented naming and
    indirection policy, with existing source-mask and metadata behaviour
    unchanged.
