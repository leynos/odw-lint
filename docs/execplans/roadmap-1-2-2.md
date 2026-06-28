# Implement original-source line indexes and spans

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 1.2.2 adds the original-source position spine that every later
parser, rule, and reporter will use. After the implementation, `odw-lint`
production code can build a line index for a workflow source file, convert
valid zero-based UTF-8 byte offsets into documented one-based display
positions, construct half-open `SourceSpan` values from original offsets, and
slice reviewer-useful snippets from the original file text. The public slicing
helpers must validate caller-supplied spans before returning text, so consumers
cannot accidentally display snippets that disagree with the original-source
diagnostic position contract.

Success is observable without running any ODW workflow. A maintainer can create
an original source-file record from a `WorkflowSource`, ask for the
`SourcePosition` at a byte offset, build a `SourceSpan` from two offsets, and
round-trip the span back to the exact original source substring. Unit and
property tests prove that LF, CRLF, Unicode code points, and trailing-newline
variants keep the diagnostic contract from `docs/technical-design.md` section
8: offsets are zero-based UTF-8 byte offsets, lines and columns are one-based
display positions, and columns count Unicode code points rather than UTF-16 code
units.

This task deliberately does not read files from disk, discover workflow paths,
parse ODW envelopes, normalize bodies for SWC, run rules, implement the command
line interface, or import ODW runtime code. Later roadmap tasks own those
responsibilities. This task supplies the reusable source helpers that those
tasks must call.

## Constraints

- Work only in
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-2-2`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as the canonical integration branch.
- Use GrepAI first for intent search against the canonical main-branch index.
  The index reflects `main` only, so verify every branch-local fact with
  `leta`, exact text search, or file inspection inside this worktree before
  acting.
- Use `leta` for branch-local symbol navigation, references, call graphs, and
  package-entry verification.
- Use `sem` rather than raw git history commands for semantic history,
  entity-level diffs, and change review before each commit.
- Keep the implementation inside `src/static-analysis/**`,
  `tests/static-analysis/**`, and package-entry or architecture-test updates
  needed to publish the helper API. Changes to `src/diagnostics/**` are out of
  scope unless a type-only import adjustment is unavoidable.
- Preserve the public diagnostic JSON shape from
  `docs/technical-design.md` section 8. `SourcePosition` remains
  `{ offset, line, column }`; `SourceSpan` remains `{ start, end }`.
- Every diagnostic span produced by these helpers must refer to the original
  source text, never masked, normalized, or wrapped source.
- Public slicing and snippet helpers must not trust caller-supplied
  `SourceSpan` objects. They must validate start and end offsets, reversed
  spans, end-of-file bounds, CRLF-interior offsets, multibyte-interior offsets,
  and line/column consistency against the supplied `OriginalSourceFile` before
  slicing original text.
- Offsets are zero-based UTF-8 byte offsets into the original source. Valid
  offsets must be code point boundaries or the end-of-file byte offset.
- Lines and columns are one-based display positions. Columns count Unicode code
  points. A non-Basic Multilingual Plane code point such as an emoji counts as
  one display column even though it is two UTF-16 code units and four UTF-8
  bytes.
- Treat CRLF as one line terminator for line counting and snippets. Diagnostic
  offsets that fall between the CR and LF bytes of one CRLF terminator do not
  represent a display cell and must be rejected by position helpers.
- Empty source has one valid position: offset 0, line 1, column 1. A trailing
  line terminator creates an end-of-file position on the next line, column 1.
- Do not import executable ODW runtime paths in production code. Forbidden
  imports include `loadWorkflowScript`, `createPrimitives`, runtime
  `validate(source)`, worker paths, launcher paths, or any path that evaluates
  metadata, compiles workflow bodies, starts runs, or dispatches agents. This
  implements ADR 0001 and `docs/technical-design.md` sections 5, 6.4, 11.3,
  and 12.1.
- Do not add `@swc/core` in this roadmap task. `docs/developers-guide.md`
  assigns the SWC parser adapter to roadmap task 2.2.1.
- The only new package dependency permitted by this plan is `fast-check` as a
  development dependency for property tests. If another package appears
  necessary, stop and revise the plan before implementation.
- Keep every source module under 400 lines. Keep functions within the
  configured Oxlint complexity limits: `complexity` max 8, `max-depth` max 3,
  and `df12/complex-conditional` max 1 logical operator.
- Every new source module must start with a module JSDoc block. Every public
  and private declaration must have useful JSDoc because Oxlint loads the
  `df12-lints` plugin.
- Use en-GB Oxford spelling in prose and comments. Preserve external API
  spellings exactly when naming imported symbols or package APIs.
- Format only files changed by the current work item. Do not run repository
  global mutating format commands such as `make fmt`, `bun fmt`, or
  `mdformat-all`.
- Because every work item updates this ExecPlan, every work item includes a
  Markdown change. Format every Markdown file changed by the current item, and
  no other Markdown files, with the dynamic changed-Markdown discovery command
  in "Concrete steps". For work item 6, that changed set must include both
  `docs/execplans/roadmap-1-2-2.md` and `docs/roadmap.md` because that item
  closes the roadmap task.
- Do not run formatting, linting, type checking, or tests in parallel.
- Each work item below is independently committable. Gate and commit each item
  before starting the next one.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances (exception triggers)

- Scope: stop and escalate if implementation needs production files outside
  `src/static-analysis/source-file.ts`, `src/static-analysis/index.ts`,
  `src/static-analysis/types.ts`, `src/index.ts`, and a narrow type-only import
  adjustment in `src/diagnostics/types.ts`.
- Tests: stop and escalate if tests need files outside
  `tests/static-analysis/**`, `tests/diagnostics/architecture.test.ts`, and
  package-lock updates required by `fast-check`.
- Public API: stop and escalate if any existing public import from `odw-lint`
  must be renamed, removed, or moved to a package subpath.
- Dependency: stop and escalate if anything other than `fast-check` is needed.
  Do not add Zod, Ajv, SWC, a CLI parser, or a Unicode display-width package
  for this task.
- Unicode display width: stop and escalate if reviewers require terminal cell
  width semantics, grapheme-cluster width, tab expansion, or East Asian width.
  The documented contract says columns are Unicode code points, not terminal
  cells or grapheme clusters.
- Runtime boundary: stop immediately if production code would need any ODW
  loader, primitive, scheduler, launcher, worker, or agent import.
- Error contract: stop and escalate if invalid offsets need to become user
  diagnostics in this task. The planned helper contract may throw a
  project-owned `SourceOffsetError` for programmer misuse and expose
  validation helpers for tests, but command-facing read or parse diagnostics
  are later tasks.
- Iterations: if `make all` still fails after three focused fix attempts in a
  work item, record the failure and options in `Decision Log` before
  continuing.
- Formatting: if a formatter rewrites unrelated files, park that churn in a
  named discard stash using
  `df12-stash v1 task=1.2.2 kind=discard reason="<short>"`, restore the
  intended file set, and re-run only file-scoped formatting.

## Risks

- Risk: confusing UTF-16 JavaScript string indexes with UTF-8 diagnostic byte
  offsets would produce spans that look correct for ASCII but drift on Unicode.
  Severity: high. Likelihood: medium. Mitigation: work item 3 must include
  Unicode table tests and `fast-check` property tests that compare helper
  offsets with `TextEncoder` UTF-8 byte lengths.

- Risk: CRLF handling can create an invisible display position between `\r`
  and `\n`.
  Severity: medium. Likelihood: medium. Mitigation: define that CRLF is a
  single display terminator, reject the interior CRLF offset for position
  lookup, and test the behaviour explicitly.

- Risk: a convenient snippet helper could grow into the future text reporter.
  Severity: medium. Likelihood: medium. Mitigation: keep snippets to original
  source slicing and line text needed for later diagnostics. Do not add colour,
  caret rendering, stdout policy, reporter ordering, or CLI flags.

- Risk: adding property tests can make the suite nondeterministic or slow.
  Severity: medium. Likelihood: low. Mitigation: every `fc.assert` in
  `tests/static-analysis/source-file.property.test.ts` must pass the same
  explicit runner parameters object, `SOURCE_SPAN_PROPERTY_RUNNER`, containing
  `seed: 0x1222026` and `numRuns: 200`; no property test may rely on
  fast-check's `Date.now()` seed default.

- Risk: exposing every helper through the public package entry could freeze a
  premature API.
  Severity: medium. Likelihood: medium. Mitigation: export only the source
  model and helper names needed by later roadmap tasks, document their original
  source contract in JSDoc, and pin package-entry assertions so accidental
  wildcard exports do not appear.

- Risk: public snippet helpers could return misleading text if they accept a
  caller-constructed `SourceSpan` whose offsets and positions disagree.
  Severity: high. Likelihood: medium. Mitigation: work item 4 must validate
  every caller-supplied span through the same original-file lookup path as
  `spanFromOffsets` and test invalid manually constructed spans directly.

- Risk: current ODW runtime helper behaviour can tempt production imports for
  parity.
  Severity: high. Likelihood: low. Mitigation: use sibling ODW source only as
  research evidence. Production code remains self-contained, and work item 5
  keeps architecture tests focused on `odw-lint` boundaries.

## Progress

- [x] (2026-06-28T09:07Z) Read `AGENTS.md`, the ExecPlan skill, the Leta
  skill, the GrepAI skill, the Sem skill, the Biome TypeScript skill, the
  Firecrawl skill, the ODW authoring skill, the Python router skill, the Rust
  router skill, and the commit-message skill.
- [x] (2026-06-28T09:07Z) Confirmed the worktree is
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-2-2` on branch
  `roadmap-1-2-2`, not `main`.
- [x] (2026-06-28T09:07Z) Ran GrepAI intent searches against the canonical
  main-branch index for source-span helpers. The first query returned no code
  hits; the second returned only `AGENTS.md`, so branch-local facts were
  verified with `leta` and direct document inspection.
- [x] (2026-06-28T09:22Z) Verified with
  `sem diff --from origin/main --to HEAD --format json` that the branch now
  carries pre-existing committed changes in
  `docs/execplans/roadmap-1-2-3.md`, `docs/roadmap.md`,
  `src/diagnostics/schema.ts`, `tests/diagnostics/architecture.test.ts`, and
  `tests/diagnostics/schema.test.ts`, plus this ExecPlan. These are
  carry-forward branch facts that must be reconciled before the 1.2.2 source
  helper commit series starts.
- [x] (2026-06-28T09:07Z) Read the governing design, roadmap, ADR, developer,
  documentation-style, scripting, and complexity documents relevant to task
  1.2.2. No `docs/users-guide.md` exists in this worktree.
- [x] (2026-06-28T09:07Z) Verified current branch-local diagnostic and
  static-analysis symbols with `leta`, including `SourcePosition`,
  `SourceSpan`, `WorkflowSource`, `DIAGNOSTIC_REPORT_SCHEMA`,
  `createDiagnosticReport`, and the existing static-analysis exports.
- [x] (2026-06-28T09:07Z) Verified sibling ODW loader, dual-compat, and
  primitive validation behaviour from
  `/data/leynos/Projects/open-dynamic-workflows/src`.
- [x] (2026-06-28T09:07Z) Verified `fast-check` 4.8.0 package metadata,
  tarball declarations, and official documentation before planning property
  tests.
- [x] (2026-06-28T09:22Z) Revised the plan after round-2 design review to add
  a baseline reconciliation work item, require dynamic changed-Markdown
  formatting that includes `docs/roadmap.md` when it changes, and pin
  fast-check properties to explicit `seed` and `numRuns` runner parameters.
- [x] (2026-06-28T09:38Z) Revised the plan after round-3 design review to
  require `git fetch origin main` before the baseline `sem diff`, to define
  validation for public caller-supplied span slicing, and to replace ambiguous
  JSON Schema validation wording with direct assertions against
  `DIAGNOSTIC_REPORT_SCHEMA`.
- [x] (2026-06-28T09:51Z) Draft accepted for implementation by the
  df12-build workflow instruction.
- [x] (2026-06-28T09:51Z) Work item 1 committed and gated. `make all`,
  `make markdownlint`, `make nixie`, and CodeRabbit review passed with no
  findings.
- [x] (2026-06-28T10:01Z) Work item 2 committed and gated. `make all`,
  `make markdownlint`, and `make nixie` passed after addressing three
  CodeRabbit findings.
- [x] (2026-06-28T10:07Z) Work item 3 offset-position implementation is
  ready for deterministic gates and CodeRabbit review.
- [x] (2026-06-28T10:16Z) Work item 3 committed and gated. `make all`,
  `make markdownlint`, and `make nixie` passed after addressing one
  CodeRabbit finding.
- [x] (2026-06-28T10:24Z) Work item 4 span and snippet implementation is
  ready for deterministic gates and CodeRabbit review.
- [x] (2026-06-28T10:29Z) Work item 4 committed and gated. `make all`,
  `make markdownlint`, `make nixie`, and CodeRabbit review passed with no
  findings.
- [x] (2026-06-28T10:33Z) Work item 5 diagnostic integration coverage is
  ready for deterministic gates and CodeRabbit review.
- [x] (2026-06-28T10:37Z) Work item 5 committed and gated. `make all`,
  `make markdownlint`, and `make nixie` passed after addressing one
  CodeRabbit finding.
- [x] (2026-06-28T10:35Z) Post-commit review found
  `src/static-analysis/source-file.ts` had grown to 418 lines, exceeding the
  400-line file-size rule.
- [x] (2026-06-28T10:35Z) Committed a separate refactor,
  `Split source-file public types`, moving passive public source-file shapes
  and `SourceOffsetError` into `src/static-analysis/types.ts`. The refactor
  reduced `src/static-analysis/source-file.ts` to 367 lines and passed
  `make all`, `make markdownlint`, `make nixie`, and CodeRabbit review.
- [x] (2026-06-28T10:35Z) Work item 6 committed and gated. `make all`,
  `make markdownlint`, `make nixie`, and CodeRabbit review passed after
  closing roadmap task 1.2.2.
- [x] (2026-06-28T11:01Z) Fix round 1 for blocking review item 1 committed
  as `4f10862`. Split oversized source-file test tables and property-test
  oracle helpers into focused modules under `tests/static-analysis/`, reducing
  `tests/static-analysis/source-file.test.ts` to 100 lines and
  `tests/static-analysis/source-file.property.test.ts` to 220 lines.
- [x] (2026-06-28T11:01Z) Fix round 1 validation passed with `make all` and
  CodeRabbit review. The first CodeRabbit pass requested bare-CR position and
  span table coverage; those cases were added before the final 0-finding
  review.
- [x] (2026-06-28T15:20Z) Fix round 2 reconciled the branch with current
  `origin/main` by merging `origin/main` into `roadmap-1-2-2` with
  `--no-commit`. The merge applied cleanly and restored the newer 1.3.1
  fixture corpus, audit documentation, developer-guide material,
  Biome/Oxlint exclusions, 1.2.3 addendum updates, and roadmap entries that
  the pre-merge `sem diff --from origin/main --to HEAD` reported as
  branch-local deletions or reversions.
- [x] (2026-06-28T15:29Z) Fix round 2 reconciliation committed as `4002109`
  after `make all`, `make markdownlint`, `make nixie`, and
  `coderabbit review --agent` all passed. CodeRabbit reported zero findings.

## Surprises & discoveries

- Observation: the canonical GrepAI index had no useful code hits for the
  first source-span query.
  Evidence: the query "line index source span helpers original files
  diagnostics mapping" returned `[0]`.
  Impact: the plan relies on branch-local `leta` verification and source-file
  inspection for current code shape.

- Observation: there is no `docs/users-guide.md` in this worktree.
  Evidence: `test -f docs/users-guide.md` reported no file.
  Impact: user-facing source-span behaviour is governed by
  `docs/terms-of-reference.md`, `docs/technical-design.md`,
  `docs/developers-guide.md`, and `AGENTS.md` until a user's guide exists.

- Observation: `SourcePosition` and `SourceSpan` already exist as public
  diagnostic types, but no branch-local helper builds them from original source
  offsets.
  Evidence: `leta show SourcePosition`, `leta show SourceSpan`, and
  `leta refs SourceSpan` found only the diagnostic types, clone helpers, schema
  references, public exports, and architecture tests.
  Impact: task 1.2.2 should add focused source helpers without changing the
  diagnostic shape.

- Observation: `STATIC_ANALYSIS_COMPONENTS` already includes `"source-reader"`
  and `"span-mapper"`, but `src/static-analysis/` currently contains only the
  passive boundary constants and `WorkflowSource`.
  Evidence: `leta show WorkflowSource` and
  `leta show STATIC_ANALYSIS_COMPONENTS`.
  Impact: the helper module belongs under `src/static-analysis/`, not under
  `src/diagnostics/`.

- Observation: this branch is not a clean topic branch against fresh
  `origin/main`.
  Evidence: after `git fetch origin main`, the baseline semantic diff lists
  `docs/execplans/roadmap-1-2-3.md`, `docs/roadmap.md`,
  `src/diagnostics/schema.ts`, `tests/diagnostics/architecture.test.ts`,
  `tests/diagnostics/schema.test.ts`, and this ExecPlan.
  Impact: implementation must begin with an explicit carry-forward
  reconciliation item. Future 1.2.2 commits must be attributable on top of that
  baseline and must not silently absorb the existing 1.2.3 or diagnostic
  cleanup changes.

- Observation: CodeRabbit found that item 2's first source-line tests missed
  newline-only sources, that readonly TypeScript source records were not frozen
  at runtime, and that lone carriage returns could be mishandled.
  Evidence: CodeRabbit review on 2026-06-28T10:01Z returned one major finding
  for runtime immutability and two minor findings for newline-only and lone-CR
  line splitting.
  Impact: item 2 now freezes the source-file record, the line array, and each
  line record, and tests cover single LF, single CRLF, and single CR inputs.

- Observation: CodeRabbit found that item 3's first monotonicity property
  exercised only the independent expected-position oracle instead of the
  production mapper.
  Evidence: CodeRabbit review on 2026-06-28T10:14Z returned one major finding
  for `tests/static-analysis/source-file.property.test.ts`.
  Impact: the monotonicity property now builds an `OriginalSourceFile`, maps
  every generated valid offset through `positionAtOffset`, and checks those
  production positions for monotonic ordering.

- Observation: CodeRabbit found that item 5's schema-minimum assertion helper
  checked the start-position schema branch for both start and end positions.
  Evidence: CodeRabbit review on 2026-06-28T10:36Z returned one minor finding
  for `tests/static-analysis/source-diagnostic.test.ts`.
  Impact: the helper now receives the specific position schema branch, so the
  end-position assertion exercises `sourceSpanSchema.properties.end`.

- Observation: the first fix-round review correctly identified that the moved
  fixture matrices still lacked bare-CR position and span round-trip cases.
  Evidence: CodeRabbit review on 2026-06-28T10:58Z returned two trivial
  findings for `tests/static-analysis/source-file-position-cases.ts` and
  `tests/static-analysis/source-file-span-cases.ts`.
  Impact: the split fixture modules now preserve the original coverage and add
  explicit lone-carriage-return position and multiline span examples.

- Observation: fix round 2 confirmed that the branch tip had not incorporated
  current `origin/main`.
  Evidence: before reconciliation,
  `sem diff --from origin/main --to HEAD` reported branch-local deletions for
  `docs/execplans/roadmap-1-3-1.md`, `docs/issues/audit-1.3.1.md`,
  `tests/static-analysis/fixtures/odw-examples/**`,
  `tests/static-analysis/odw-example-fixtures.test.ts`, and reversions in
  `docs/developers-guide.md`, `biome.jsonc`, and `.oxlintrc.json`.
  Impact: the correct fix is a real merge of `origin/main`, not a selective
  documentation note or a justification for deleting newer main-branch work.

## Decision log

- Decision: implement line-index and span helpers as an `odw-lint` owned
  static-analysis module rather than delegating to ODW.
  Rationale: ADR 0001 and `docs/technical-design.md` sections 5, 6.4, 11.3,
  and 12.1 make the static-analysis boundary a security boundary. Sibling ODW
  `primitives.ts` shows `validate(source)` calls `loadWorkflowScript`, and
  `loader.ts` compiles workflow bodies with `new AsyncFunction`, so those paths
  are not safe production dependencies for host-side lint.
  Date/Author: 2026-06-28, Codex.

- Decision: use `fast-check` property tests for offset and span invariants.
  Rationale: `AGENTS.md` says invariant testing should use `fast-check` when a
  change introduces behaviour over a range of inputs. Source offset mapping is
  exactly that kind of invariant, and official fast-check docs plus the 4.8.0
  declaration file confirm the needed APIs.
  Date/Author: 2026-06-28, Codex.

- Decision: columns remain Unicode code point counts, not UTF-16 code units,
  terminal cells, or grapheme clusters.
  Rationale: `docs/technical-design.md` section 8 explicitly says columns are
  counted in Unicode code points. Implementing grapheme or terminal-cell width
  would change the public diagnostic contract and require extra dependencies.
  Date/Author: 2026-06-28, Codex.

- Decision: define CRLF as one display line terminator and reject the offset
  between the CR and LF bytes for position lookup.
  Rationale: editors and diagnostic formats present CRLF as one line break.
  Accepting an interior display position would produce a line and column that
  users cannot point to visually.
  Date/Author: 2026-06-28, Codex.

- Decision: keep the already-committed 1.2.3 and diagnostic cleanup work as
  carry-forward branch state instead of rebasing or rewriting it during this
  planning revision.
  Rationale: the worktree is clean, and the task is to revise the 1.2.2 plan,
  not to edit or re-parent earlier completed commits. A dedicated baseline
  reconciliation work item now forces the implementer to fetch `origin/main`,
  then verify or rebase that state before adding 1.2.2 source helper commits.
  Date/Author: 2026-06-28, Codex.

- Decision: reconcile fix round 2 by merging `origin/main` into the topic
  branch before shipping.
  Rationale: the blocking review finding is about merge safety against current
  main, not a source-helper bug. A merge commit preserves 1.2.2 implementation
  history while making main's newer fixture corpus, audit notes,
  documentation, and tool exclusions part of this branch's tested tree.
  Date/Author: 2026-06-28, Codex.

- Decision: keep `sliceSourceSpan` and `snippetForSpan` public, but make them
  validating APIs rather than thin slicing helpers.
  Rationale: later diagnostics and package consumers need exact
  original-source snippets, and `docs/technical-design.md` section 11.5 makes
  span mapping a correctness invariant. Validation inside the public helpers
  prevents caller-constructed spans with stale or inconsistent positions from
  producing misleading text.
  Date/Author: 2026-06-28, Codex.

- Decision: validate diagnostic integration tests by direct assertions against
  the existing `DIAGNOSTIC_REPORT_SCHEMA` object, not by adding Ajv, Zod, or
  another JSON Schema validator.
  Rationale: the repository currently exposes a schema object and has no JSON
  Schema validator dependency. The dependency tolerance permits only
  `fast-check`, so work item 5 must stay within existing schema tests and
  package-entry assertions.
  Date/Author: 2026-06-28, Codex.

## Outcomes & retrospective

Work item 1 confirmed the carried-forward branch baseline after a fresh
`git fetch origin main`. GrepAI returned source-span-adjacent main-branch
diagnostic text and audit hits, while branch-local `leta` verification
confirmed the current `SourcePosition`, `SourceSpan`, `WorkflowSource`,
`DIAGNOSTIC_REPORT_SCHEMA`, and `createDiagnosticReport` contracts. The
semantic diff against `origin/main` still contains only the expected
carry-forward files plus this ExecPlan:
`docs/execplans/roadmap-1-2-2.md`,
`docs/execplans/roadmap-1-2-3.md`, `docs/roadmap.md`,
`src/diagnostics/schema.ts`, `tests/diagnostics/architecture.test.ts`, and
`tests/diagnostics/schema.test.ts`. No source helper implementation has
started yet.

Work item 2 added `src/static-analysis/source-file.ts` with
`OriginalSourceFile`, `SourceLine`, `SourceSnippet`, `SourceOffsetError`, and
`createOriginalSourceFile`. The implementation records UTF-8 byte length and
display-line metadata for original workflow source text without adding offset
lookup, span construction, source slicing, file-system reads, SWC parser code,
or ODW runtime imports. New table-driven tests cover empty source, ASCII, LF,
CRLF, Unicode, newline-only, lone-CR, and trailing-newline variants. The
reviewed implementation freezes the returned source record, line array, and
line records at runtime so consumers cannot mutate offsets after creation.

Work item 3 added `positionAtOffset` and a private offset lookup table for
source records created by `createOriginalSourceFile`. It maps valid UTF-8 byte
offsets to one-based line and Unicode-code-point columns, rejects negative,
non-integer, out-of-range, CRLF-interior, and multibyte-interior offsets with
`SourceOffsetError`, and adds deterministic `fast-check` property tests using
`SOURCE_SPAN_PROPERTY_RUNNER` with `seed: 0x1222026` and `numRuns: 200`.
CodeRabbit's monotonicity-test finding was valid and is fixed by routing the
generated valid offsets through `positionAtOffset` before asserting ordering.

Work item 4 added `spanFromOffsets`, `sliceSourceSpan`, and `snippetForSpan`.
The implementation validates every caller-supplied `SourceSpan` against the
original file's private offset indexes before slicing, so reversed spans,
out-of-range offsets, CRLF-interior offsets, multibyte-interior offsets, and
mismatched line or column values fail with `SourceOffsetError`. Table tests
cover ASCII, LF, CRLF, Unicode, zero-length EOF, and trailing-newline spans;
property tests compare generated valid spans against an independent original
substring oracle and check reversed and mutated generated spans.
CodeRabbit review passed with no findings after the deterministic gates were
green.

Work item 5 added a package-entry integration test that builds an original
source span, inserts it into a `Diagnostic`, clones it through
`createDiagnosticReport`, checks the report and diagnostic against the exported
schema object's required keys, enum values, and source-position minimums, and
formats the resulting diagnostic text. The test mutates the caller-owned span
after report creation to prove the report keeps the original span unchanged.
CodeRabbit's schema-branch finding was valid and is fixed by passing the start
or end schema branch into the minimum assertion helper.

Work item 6 performed the required post-commit review and found one refactor
need: `src/static-analysis/source-file.ts` exceeded the 400-line file-size
limit after the span helpers landed. The separate refactor commit moved passive
public source-file shapes and `SourceOffsetError` into
`src/static-analysis/types.ts`, preserving package exports while reducing
`src/static-analysis/source-file.ts` to 367 lines. The roadmap now marks only
task 1.2.2 complete. Final validation passed with `make all`,
`make markdownlint`, and `make nixie`; CodeRabbit review for the closing
documentation reported no findings.

Fix round 1 resolved the blocking review finding that two new test files
violated the 400-line file-size rule. The executable source-file tests now hold
only assertions and import focused fixture modules for line metadata, position
cases, span cases, and the independent property-test oracle. The split keeps
every touched TypeScript file below 400 lines and keeps the public source-span
behaviour unchanged. Final validation passed with `make all`; CodeRabbit's
first pass requested bare-CR table coverage, and the second pass reported zero
findings after those cases were added.

Fix round 2 resolved the blocking review finding that the branch was not
reconciled with current `origin/main`. The branch now incorporates main's
1.3.1 fixture corpus, fixture manifest tests, audit document, developer-guide
fixture guidance, Biome and Oxlint fixture exclusions, 1.2.3 addendum updates,
and roadmap additions instead of presenting them as deletions or reversions
relative to main. The 1.2.2 source-span helper work remains the branch-local
implementation scope. The reconciliation commit is `4002109`; validation
passed with `make all`, `make markdownlint`, `make nixie`, and a zero-finding
CodeRabbit review.

## Addenda

- [ ] 1.2.2.1. Clarify the original-source construction contract.
  - Source: review:1.2.2 and audit:1.2.2, medium.
  - Scope: make the `OriginalSourceFile` construction requirement visible in
    the public API contract, including the nominal or structural construction
    decision before parser, mapper, and reporter work pass source records
    across module boundaries.
  - Success: callers can tell from types, documentation, and focused tests
    whether original-source records must come from `createOriginalSourceFile`
    or may be structurally constructed.
- [ ] 1.2.2.2. Single-source production source scanning.
  - Source: audit:1.2.2, medium.
  - Scope: refactor production source scanning so line metadata and private
    offset lookup indexes come from one pass while the independent
    property-test oracle stays separate.
  - Success: CRLF and multibyte Unicode regression coverage proves the merged
    production scanner preserves existing source-span behaviour.
- [ ] 1.2.2.3. Document source-span helper usage.
  - Source: audit:1.2.2, low.
  - Scope: add compact source-span helper examples and a developer-guide note
    covering UTF-8 offsets, display columns, half-open spans, and original
    pre-normalized workflow source.
  - Success: parser and reporter contributors can follow source-span usage
    from exported helper examples and maintainer documentation instead of
    inferring the contract from tests.
- [ ] 1.2.2.4. Clean up source-file property-test harness repetition.
  - Source: audit:1.2.2, low.
  - Scope: centralize generated source setup for source-file property tests
    without sharing production scanner logic or changing deterministic runner
    settings.
  - Success: property bodies focus on the invariant being asserted, and the
    oracle remains independent from production implementation details.

## Context and orientation

The repository is a private TypeScript and Bun package. `src/index.ts` is the
public package entry point and currently re-exports diagnostic types and the
static-analysis boundary. `src/diagnostics/types.ts` defines
`SourcePosition` and `SourceSpan`; `src/diagnostics/schema.ts` pins the JSON
Schema minimums for `offset`, `line`, and `column`; `src/diagnostics/report.ts`
clones spans when building report envelopes.

The static-analysis area is currently passive. `src/static-analysis/types.ts`
defines `WorkflowSource` with `filePath` and `sourceText`, plus component and
stage labels. `src/static-analysis/index.ts` is a barrel. Existing tests in
`tests/static-analysis/boundary.test.ts` verify those exports through
`odw-lint`. Existing tests in `tests/diagnostics/architecture.test.ts` verify
package-entry shape and parseable source files.

The new helper module should be named `src/static-analysis/source-file.ts`.
That name keeps the implementation close to the `source-reader` and
`span-mapper` components from `docs/technical-design.md` section 6.1 without
starting file-system reading or SWC parsing. The module should define:

- `OriginalSourceFile`: an immutable record containing `filePath`,
  `sourceText`, UTF-8 `byteLength`, line metadata, and lookup data needed by
  helper functions.
- `SourceLine`: immutable metadata for one original source line, including
  one-based line number, start offset, content end offset, terminator end
  offset, and the original line text without its line terminator.
- `SourceSnippet`: a small immutable return type for reviewer-useful snippets,
  containing the sliced original text plus the start and end positions used to
  produce it.
- `SourceOffsetError`: a project-owned `Error` subclass for invalid helper
  inputs such as negative offsets, offsets past end of file, offsets inside a
  UTF-8 code point, offsets inside a CRLF terminator, or reversed span offsets.
- `createOriginalSourceFile(source: WorkflowSource): OriginalSourceFile`.
- `positionAtOffset(file: OriginalSourceFile, offset: number): SourcePosition`.
- `spanFromOffsets`: construct a `SourceSpan` from valid start and end
  offsets.
- `sliceSourceSpan(file: OriginalSourceFile, span: SourceSpan): string`.
- `snippetForSpan(file: OriginalSourceFile, span: SourceSpan): SourceSnippet`.

The implementation should build lookup metadata in one linear scan over
`sourceText`. Use `TextEncoder` or an equivalent local byte-length helper to
measure UTF-8 bytes. Do not call `Buffer.byteLength` unless a source comment
explains why the Node compatibility dependency is preferable in Bun. Store the
set of valid display offsets so `positionAtOffset` can reject offsets that are
inside multi-byte UTF-8 code points or inside one CRLF display terminator.

The helper API is deliberately narrow. It returns positions and original source
slices only. It does not render carets, normalize tabs, colorize output, choose
stdout or stderr, read files, or convert parser failures to diagnostics.

## Research evidence

The local project evidence is:

- `docs/roadmap.md` task 1.2.2 requires line-index and source-span helpers for
  original files. Its success criterion is that offsets, lines, columns, and
  snippets round-trip for LF, CRLF, Unicode, and trailing-newline fixtures.
- `sem diff --from origin/main --to HEAD --format json` on
  2026-06-28T09:38Z, after `git fetch origin main`, showed this branch already
  carries changes in
  `docs/execplans/roadmap-1-2-3.md`, `docs/roadmap.md`,
  `src/diagnostics/schema.ts`, `tests/diagnostics/architecture.test.ts`,
  `tests/diagnostics/schema.test.ts`, and this ExecPlan. This plan treats those
  as carry-forward baseline state that must be verified before 1.2.2 source
  helper commits begin.
- `docs/technical-design.md` section 6.1 assigns line-index building to the
  source reader and original-source span mapping to the span mapper.
- `docs/technical-design.md` section 8 defines the diagnostic position
  contract: offset is a zero-based UTF-8 byte offset, line and column are
  one-based display positions, and column counts Unicode code points.
- `docs/technical-design.md` section 11.5 makes original-source span mapping
  the most important correctness property after dialect parity.
- `docs/developers-guide.md` "Static-Analysis Boundary" says
  `src/static-analysis/` owns the static-analysis implementation and that SWC
  direct calls belong to roadmap task 2.2.1.
- `docs/adr/0001-static-analysis-boundary.md` decides that `odw-lint` owns its
  static-analysis implementation and must not import executable ODW runtime
  paths in production code.

The sibling ODW evidence from
`/data/leynos/Projects/open-dynamic-workflows` is:

- `src/loader.ts` documents that ODW extracts `meta`, strips `export`, wraps
  the body, and compiles with `new AsyncFunction`. It also performs
  string/comment/regex-aware masking for loader searches.
- `src/dual-compat.ts` defines `checkMeta` and a pure-literal parser for
  Claude Code compatibility. This is useful evidence for future metadata work,
  but task 1.2.2 does not need it in production.
- `src/primitives.ts` defines `validate(source)` by calling
  `loadWorkflowScript(source, "candidate.js")` and `scanDualCompat(source)`.
  That confirms the runtime primitive is not a safe production dependency for
  this static helper task.

The external dependency evidence is:

- `npm view fast-check version dist.tarball --json` returned version `4.8.0`
  and tarball `https://registry.npmjs.org/fast-check/-/fast-check-4.8.0.tgz`.
- The 4.8.0 tarball `package/package.json` exports ESM and CommonJS entry
  points with TypeScript declarations, has `main: "lib/fast-check.js"`,
  `module: "lib/fast-check.js"`, and `types: "lib/fast-check.d.ts"`.
- The 4.8.0 declaration file `package/lib/fast-check.d.ts` defines the
  required APIs: `Parameters<T>` at line 786 with `seed?: number` and
  `numRuns?: number`, `property` at line 1197, `assert` at lines 1254, 1267,
  and 1282, `constantFrom` at lines 1610 and 1621, `integer` at line 2047,
  `string` at line 2904, `option` at line 3334, `record` at line 3385,
  `tuple` at line 3556, and `stringMatching` at line 4739.
- The official fast-check "Properties" page
  `https://fast-check.dev/docs/core-blocks/properties/` says synchronous
  properties are declared with `fc.property(...arbitraries, predicate)`, and
  the predicate may throw, return `true` or `undefined` for success, or return
  `false` for failure.
- The official fast-check "Runners" page
  `https://fast-check.dev/docs/core-blocks/runners/` says `fc.assert` executes
  a property and throws automatically on failure, with synchronous and
  asynchronous signatures.
- The official fast-check `Parameters<T>` API page
  `https://fast-check.dev/docs/api/interfaces/Parameters/` says `seed` defaults
  to `Date.now()` and `numRuns` defaults to 100. Therefore every property in
  this task must call `fc.assert(property, SOURCE_SPAN_PROPERTY_RUNNER)` where
  `SOURCE_SPAN_PROPERTY_RUNNER` contains explicit `seed` and `numRuns` values.

## Plan of work

### Work item 1: Reconcile the carried-forward branch baseline

Read `AGENTS.md` sections "Branches", "Plans", "Commands", and "Change
Quality & Committing"; `docs/roadmap.md` section 1.2;
`docs/developers-guide.md` sections "Static-Analysis Boundary" and "Commit
Gate"; `docs/documentation-style-guide.md` sections "Spelling", "Markdown
rules", and "Formatting"; `docs/execplans/roadmap-1-2-3.md` sections
"Purpose / big picture", "Outcomes & retrospective", and "Revision note"; and
the `execplans`, `grepai`, `leta`, `sem`, and `commit-message` skills.

This item is a plan-and-baseline reconciliation item. It does not add source
helpers. It implements the branch, plan, command, and commit-gate constraints
from `AGENTS.md`; the roadmap sequencing in `docs/roadmap.md` section 1.2; and
the static-analysis ownership boundary in `docs/developers-guide.md`
"Static-Analysis Boundary".

Begin with an explicit, non-mutating remote refresh:

```sh
git fetch origin main
```

Only after that fetch succeeds, run GrepAI for the canonical main-branch view,
then verify the live branch directly:

- `sem diff --from origin/main --to HEAD --format json` must show only the
  known carried-forward files recorded in "Research evidence" plus any
  deliberate updates to this ExecPlan.
- `leta show SourcePosition`, `leta show SourceSpan`,
  `leta show WorkflowSource`, `leta show DIAGNOSTIC_REPORT_SCHEMA`, and
  `leta show createDiagnosticReport` must still reflect the branch-local
  diagnostic and static-analysis contracts described above.
- `docs/execplans/roadmap-1-2-3.md` must remain complete and must not be edited
  by this item.

If `origin/main` has advanced and already contains the carried-forward 1.2.3 or
diagnostic cleanup changes, rebase this worktree onto `origin/main`, re-run the
same checks, and update this ExecPlan's evidence before continuing. If
`origin/main` has not absorbed them, keep those files unchanged as explicit
carry-forward branch state. If `sem diff` shows any unexpected file before
1.2.2 work starts, stop and revise this plan instead of mixing that work into
the source-span commits.

Tests for this item:

- Unit: none. No source behaviour changes.
- Behavioural: none. No command-line behaviour changes.
- Property: none. No invariant implementation changes.
- Snapshot: none.
- End-to-end: none.

Expected commit title: `Record source-span branch baseline`.

### Work item 2: Introduce original source-file records and line metadata

Read `AGENTS.md` sections "Code Style and Structure", "Change Quality &
Committing", and "TypeScript Guidance"; `docs/roadmap.md` task 1.2.2;
`docs/technical-design.md` sections 6.1, 8, 11.1, and 11.5;
`docs/developers-guide.md` sections "Static-Analysis Boundary", "Commit
Gate", "Tests", and "Markdown"; `docs/documentation-style-guide.md` sections
"Spelling", "Markdown rules", and "Formatting"; and
`docs/complexity-antipatterns-and-refactoring-strategies.md` sections 2, 4,
and 5. Load the `execplans`, `leta`, `sem`, and `biome-typescript` skills.
There is no installed TypeScript router skill in this session; use
`biome-typescript` for TypeScript tooling guidance.

This item implements the source-reader line-index responsibility from
`docs/technical-design.md` section 6.1, the diagnostic span shape from
`docs/technical-design.md` section 8, the differential span-fixture direction
from `docs/technical-design.md` section 11.1, the source-span invariant from
`docs/technical-design.md` section 11.5, and roadmap task 1.2.2.

Add `src/static-analysis/source-file.ts` with the module JSDoc and the
immutable types `OriginalSourceFile`, `SourceLine`, `SourceSnippet`, and
`SourceOffsetError`. Implement `createOriginalSourceFile`. The first
implementation must calculate
`byteLength`, split source into display lines, record each line's start offset,
content end offset, terminator end offset, and line text, and preserve the
original `filePath` and `sourceText`. It must not yet expose offset lookup or
span slicing beyond the metadata needed by later work items.

Export the new types and `createOriginalSourceFile` through
`src/static-analysis/index.ts` and `src/index.ts`. Update
`tests/static-analysis/boundary.test.ts` so a package consumer can import the
new source-file model from `odw-lint`. Update
`tests/diagnostics/architecture.test.ts` so the package-entry source list
includes `src/static-analysis/source-file.ts` and still proves `src/index.ts`
has no helper implementations of its own.

Tests for this item:

- Unit: add `tests/static-analysis/source-file.test.ts` with table-driven
  cases for empty source, one ASCII line with no newline, LF, CRLF, Unicode
  characters, and trailing newline variants. Assert line counts, byte lengths,
  line text, and line boundary offsets.
- Behavioural: none. This item is an internal helper without a command-line or
  Gherkin behaviour yet.
- Property: none in this item. The dependency is introduced in work item 3
  when offset invariants need generated inputs.
- Snapshot: none. The metadata is compact and clearer as semantic assertions.
- End-to-end: none. The CLI does not exist yet.

Expected commit title: `Add original source-file records`.

### Work item 3: Map UTF-8 offsets to display positions

Read `docs/technical-design.md` sections 8 and 11.5;
`docs/terms-of-reference.md` sections 5, 6, 8, and 9; `AGENTS.md` sections
"Runtime Validation & Types", "Error Handling", and "Testing"; the official
fast-check "Properties" and "Runners" pages cited above; and the fast-check
4.8.0 declaration evidence in this plan. Load the `execplans`, `leta`, `sem`,
`biome-typescript`, and `firecrawl-mcp` skills if any dependency-doc refresh is
needed.

Add `fast-check` as a development dependency with a caret range, using Bun so
`package.json` and `bun.lock` are updated together. Pin the tests to APIs
verified in fast-check 4.8.0: `fc.assert`, `fc.property`, `fc.string`,
`fc.integer`, `fc.constantFrom`, `fc.record`, and `fc.tuple`. Do not use
unverified fast-check APIs. Define one runner-parameter constant in
`tests/static-analysis/source-file.property.test.ts`:

```ts
const SOURCE_SPAN_PROPERTY_RUNNER = { seed: 0x1222026, numRuns: 200 } as const;
```

Every `fc.assert` call in this task must pass that constant as its second
argument. Do not call `fc.assert(property)` without parameters, because
fast-check 4.8.0 defaults `seed` to `Date.now()` and would make the test suite
time-dependent.

This item implements the UTF-8 byte-offset and Unicode-code-point display
contract from `docs/technical-design.md` section 8, the original-source span
invariant from `docs/technical-design.md` section 11.5, the job-to-be-done and
success criteria in `docs/terms-of-reference.md` sections 5 and 8, and the
invariant-testing rule in `AGENTS.md` "Testing".

Implement `positionAtOffset`. It must accept offset 0 and the end-of-file byte
offset. It must reject negative offsets, non-integer offsets, offsets past the
end of file, offsets inside a multi-byte UTF-8 code point, and offsets between
the CR and LF of a CRLF terminator by throwing `SourceOffsetError`. It must
return line 1, column 1 for empty source at offset 0. For valid offsets, it
must return the original-source `SourcePosition` described in
`docs/technical-design.md` section 8.

Tests for this item:

- Unit: extend `tests/static-analysis/source-file.test.ts` with exact
  assertions for ASCII, LF, CRLF, Unicode code points, non-Basic Multilingual
  Plane code points, trailing newline, invalid negative offsets, invalid
  non-integer offsets, invalid offsets past EOF, invalid offsets inside a
  multi-byte code point, and invalid offsets inside a CRLF display terminator.
- Behavioural: none. There is still no user-facing command.
- Property: add `tests/static-analysis/source-file.property.test.ts`. Generate
  bounded source strings from ASCII segments, Unicode segments, LF, CRLF, and
  trailing-newline variants. Assert that every accepted offset is at a
  `TextEncoder` UTF-8 boundary, positions are monotonically ordered, EOF maps
  to the expected final line and column, and `SourceOffsetError` is thrown for
  generated invalid offsets. Each property must be wrapped as
  `fc.assert(fc.property(...), SOURCE_SPAN_PROPERTY_RUNNER)` so the seed and
  run count are deterministic.
- Snapshot: none. Property counterexamples should be reported by fast-check,
  not stored as snapshots.
- End-to-end: none. The CLI does not exist yet.

Expected commit title: `Map source offsets to positions`.

### Work item 4: Construct spans and original snippets

Read `docs/technical-design.md` sections 6.1, 8, 11.1, and 11.5;
`docs/roadmap.md` task 1.2.2; `AGENTS.md` sections "Testing" and "Error
Handling"; and `docs/complexity-antipatterns-and-refactoring-strategies.md`
sections 4 and 5. Load the `execplans`, `leta`, `sem`, and
`biome-typescript` skills.

This item implements the span-mapper responsibility from
`docs/technical-design.md` section 6.1, the public diagnostic span contract
from `docs/technical-design.md` section 8, and the original-source snippet
invariant from `docs/technical-design.md` section 11.5.

Implement `spanFromOffsets`, `sliceSourceSpan`, and `snippetForSpan`.
`spanFromOffsets` must require valid start and end offsets and reject reversed
spans with `SourceOffsetError`.

`sliceSourceSpan` and `snippetForSpan` are public helpers, so they must validate
the entire caller-supplied `SourceSpan` before slicing. They must:

- validate `span.start.offset` and `span.end.offset` through
  `positionAtOffset`, which rejects negative, non-integer, out-of-range,
  multibyte-interior, and CRLF-interior offsets;
- reject reversed spans where `span.start.offset > span.end.offset`;
- recompute the start and end positions from the original file and reject spans
  whose supplied `line` or `column` differs from the recomputed position; and
- accept zero-length spans, including the zero-length span at EOF, when both
  supplied positions exactly match the original file.

After validation, `sliceSourceSpan` must return the exact original substring
represented by the span's byte offsets. `snippetForSpan` must return the exact
original slice plus the validated start and end positions; it may also include
the first source line's text without its line terminator for future reporter
use. Do not render carets or colour.

Tests for this item:

- Unit: extend `tests/static-analysis/source-file.test.ts` with exact
  round-trip cases for LF, CRLF, Unicode, multi-line spans, zero-length spans,
  spans at EOF, and trailing-newline spans. Assert `span.start` and `span.end`
  positions and assert that `sliceSourceSpan` returns the expected original
  text. Add separate tests that call `sliceSourceSpan` and `snippetForSpan`
  with manually constructed invalid `SourceSpan` objects, not spans produced by
  `spanFromOffsets`. These tests must cover reversed offsets, offsets past EOF,
  offsets inside CRLF terminators, offsets inside multibyte UTF-8 code points,
  and mismatched supplied line or column values.
- Behavioural: none.
- Property: extend `tests/static-analysis/source-file.property.test.ts` so
  generated valid start and end offsets always produce spans whose slice equals
  the equivalent original substring, generated reversed pairs throw
  `SourceOffsetError`, and caller-supplied spans with mutated line or column
  values are rejected before slicing. Reuse `SOURCE_SPAN_PROPERTY_RUNNER` for
  every new `fc.assert` call; do not introduce a second seed or rely on
  defaults.
- Snapshot: none. Snippet strings are short and should be asserted directly.
- End-to-end: none.

Expected commit title: `Build source spans and snippets`.

### Work item 5: Prove diagnostic integration and package architecture

Read `docs/technical-design.md` sections 8, 11.5, 12.1, and 15;
`docs/adr/0001-static-analysis-boundary.md` sections "Decision" and
"Consequences"; `docs/developers-guide.md` sections "Static-Analysis
Boundary", "Linting", and "Type Checking"; and `AGENTS.md` sections "Runtime
Validation & Types", "Observability", and "Linting & Formatting". Load the
`execplans`, `leta`, `sem`, `biome-typescript`, and `odw-authoring` skills.
The ODW authoring skill is relevant only as context for the workflow dialect
and trust boundary; do not write or run ODW workflows in this task.

This item implements the diagnostic contract from `docs/technical-design.md`
section 8, the original-source span invariant from section 11.5, the trust
boundary from section 12.1, the release acceptance direction from section 15,
and ADR 0001 sections "Decision" and "Consequences".

Add integration tests proving that a `SourceSpan` built from
`spanFromOffsets` can be used in a `Diagnostic`, cloned through
`createDiagnosticReport`, checked directly against the existing
`DIAGNOSTIC_REPORT_SCHEMA` object, and formatted through
`formatTextDiagnostics` without changing the original span. Keep these as
package-entry tests that import from `odw-lint`, not relative source paths.

Do not add a JSON Schema validator dependency. The exact validation mechanism
for this item is direct assertion against the exported schema object and the
report object:

- assert the report has exactly the top-level keys listed in
  `DIAGNOSTIC_REPORT_SCHEMA.required` and no extra owned keys;
- assert the diagnostic has every key listed in
  `DIAGNOSTIC_REPORT_SCHEMA.properties.diagnostics.items.required`;
- assert the diagnostic severity is included in the schema enum;
- assert the diagnostic span start and end offsets, lines, and columns satisfy
  the schema minimums; and
- assert the report remains equal to the expected object after
  `createDiagnosticReport` clones the caller-owned diagnostic.

This test complements `tests/diagnostics/schema.test.ts`, which already
snapshots and asserts the schema shape. It is not a full JSON Schema validator
and must not pretend to be one.

Harden architecture assertions so the new static-analysis helper module is
explicitly parseable, the public entry point remains a pure export barrel, and
the diagnostic module list remains focused. Do not add forbidden-import checks
for ODW runtime paths here; `docs/developers-guide.md` assigns that
architecture test to roadmap task 2.1.4.

Tests for this item:

- Unit: add or extend a static-analysis integration test that constructs a
  diagnostic from an original-source span and asserts report cloning, direct
  `DIAGNOSTIC_REPORT_SCHEMA` compatibility checks as described above, and text
  formatting.
- Behavioural: none.
- Property: none unless work item 4 exposes a missed invariant. Do not broaden
  property tests without a concrete invariant.
- Snapshot: none. Reuse existing diagnostic text snapshots only if they change
  because of package-entry test ownership; do not introduce optional snapshot
  paths.
- End-to-end: none.

Expected commit title: `Cover source spans in diagnostics`.

### Work item 6: Close roadmap task 1.2.2

Read `docs/roadmap.md` section 1.2; `docs/developers-guide.md` section
"Documentation Upkeep"; `docs/documentation-style-guide.md` sections
"Spelling", "Markdown rules", and "Formatting"; and the `execplans` skill
revision note requirement. Load the `execplans`, `leta`, and `sem` skills.

Update this ExecPlan's living sections with the final implementation evidence,
including gate commands, any surprises, and the outcome. Mark roadmap task
1.2.2 complete in `docs/roadmap.md` only after all source, tests, and gates are
complete. Do not mark later roadmap tasks complete.

Perform the post-commit review required by `AGENTS.md` and the complexity
heuristics: inspect changed source modules for long functions, duplicated
logic, complex conditionals, data clumps, excessive parameters, and
over-abstraction. If a refactor is needed, make it a separate atomic commit
with its own tests and gates before closing this work item.

Tests for this item:

- Unit: none unless the post-commit review finds a small refactor that needs
  coverage.
- Behavioural: none.
- Property: none.
- Snapshot: none.
- End-to-end: none.

Expected commit title: `Close source-span roadmap task`.

## Concrete steps

Start every work item from the roadmap worktree:

```sh
cd /data/leynos/Projects/odw-lint.worktrees/roadmap-1-2-2
git branch --show
```

The branch command must print:

```plaintext
roadmap-1-2-2
```

Before editing code in a work item, refresh branch-local orientation:

```sh
grepai search --workspace Projects --project odw-lint \
  "original source line index source span diagnostics mapping" --toon --compact
leta files src/ tests/
leta grep "SourcePosition|SourceSpan|WorkflowSource|STATIC_ANALYSIS" \
  "src/.*|tests/.*" -k function,constant,interface,type
git fetch origin main
sem diff --from origin/main --to HEAD
```

For work item 1, the `git fetch origin main` step is mandatory before any
baseline decision that depends on `origin/main`, and the JSON form of the diff
must be captured for the ExecPlan evidence:

```sh
git fetch origin main
sem diff --from origin/main --to HEAD --format json
```

After each work item's edits, format only changed files. Discover existing
changed Markdown paths dynamically, then pass exactly that set to `mdtablefix`
and `markdownlint-cli2 --fix`. This is path-safe for plan-only items and for
work item 6, where the changed set must include both
`docs/execplans/roadmap-1-2-2.md` and `docs/roadmap.md`:

```sh
branch="$(git branch --show)"
changed_markdown_file="/tmp/changed-markdown-odw-lint-${branch##*/}.nul"
{
  git diff --name-only -z --diff-filter=ACMRT -- '*.md'
  git ls-files -z --others --exclude-standard -- '*.md'
} | sort -zu > "$changed_markdown_file"
if test -s "$changed_markdown_file"; then
  xargs -0 mdtablefix < "$changed_markdown_file" \
    2>&1 | tee "/tmp/mdtablefix-odw-lint-${branch##*/}.out"
  xargs -0 bunx markdownlint-cli2 --fix < "$changed_markdown_file" \
    2>&1 | tee "/tmp/markdownlint-fix-odw-lint-${branch##*/}.out"
fi
```

For TypeScript, JSON, and JSONC formatting, discover only existing changed
files in Biome's configured scope and pass those paths to Biome. This avoids
listing optional files, deleted files, or files that the current work item did
not edit:

```sh
changed_biome="$({
  git diff --name-only --diff-filter=ACMRT -- \
    src tests package.json biome.jsonc bunfig.toml tsconfig.json .oxlintrc.json
  git ls-files --others --exclude-standard -- \
    src tests package.json biome.jsonc bunfig.toml tsconfig.json .oxlintrc.json
} | sort -u)"
test -z "$changed_biome" || bunx @biomejs/biome format --write $changed_biome
```

Run gates sequentially, never in parallel. Use `tee` logs under `/tmp`:

```sh
branch="$(git branch --show)"
make all 2>&1 | tee "/tmp/make-all-odw-lint-${branch##*/}.out"
make markdownlint 2>&1 | tee "/tmp/make-markdownlint-odw-lint-${branch##*/}.out"
make nixie 2>&1 | tee "/tmp/make-nixie-odw-lint-${branch##*/}.out"
```

Review semantic changes and status before each commit:

```sh
sem diff --from origin/main --to HEAD
git status --short
```

Commit only after the gates pass. Each commit message must use imperative mood
with a concise subject and a body explaining what changed and why.

## Validation and acceptance

The full roadmap task is accepted when all of the following are true:

- `createOriginalSourceFile` records original file text, byte length, and line
  metadata for empty, LF, CRLF, Unicode, and trailing-newline source variants.
- `positionAtOffset` maps valid UTF-8 byte offsets to one-based line and
  Unicode-code-point column positions, and rejects invalid offsets with
  `SourceOffsetError`.
- `spanFromOffsets`, `sliceSourceSpan`, and `snippetForSpan` build half-open
  original-source spans and return exact original source slices.
- `sliceSourceSpan` and `snippetForSpan` validate caller-supplied spans before
  slicing: invalid offsets, reversed spans, EOF-bound violations,
  CRLF-interior offsets, multibyte-interior offsets, and mismatched
  line/column positions throw `SourceOffsetError`.
- Property tests using `fast-check` exercise generated source variants and pin
  offset, monotonicity, EOF, and span-slice invariants. Every `fc.assert` call
  in `tests/static-analysis/source-file.property.test.ts` passes
  `SOURCE_SPAN_PROPERTY_RUNNER`, whose required value is
  `{ seed: 0x1222026, numRuns: 200 }`.
- Package consumers can import the new helpers through `odw-lint`, and
  `src/index.ts` remains an explicit export barrel.
- No production code imports sibling ODW runtime helpers or adds SWC parser
  code.
- The living ExecPlan and `docs/roadmap.md` accurately reflect the completed
  task.

The required validation commands are:

```sh
make all
make markdownlint
make nixie
```

Expected successful output is a zero exit status from each command. `make all`
runs build, format checking, linting, type checking, and tests.
`make markdownlint` validates all Markdown files. `make nixie` validates
Mermaid diagrams in Markdown; this task should not add Mermaid diagrams, but
the repository gate is required for Markdown changes.

## Idempotence and recovery

The source helper implementation should be pure and deterministic. Re-running
tests or rebuilding an `OriginalSourceFile` for the same `WorkflowSource` must
produce the same metadata and positions.

If `fast-check` finds a counterexample, keep the shrunk input in the failing
test output while debugging. Add a focused regression case only after
confirming the counterexample represents an intended contract edge.

If `bun add --dev fast-check@^4.8.0` changes unrelated dependency versions,
inspect `bun.lock` before continuing. If the change is unrelated and cannot be
explained by lockfile resolution, stop and record the options in
`Decision Log`.

If formatting creates unrelated churn, park only that churn with a named stash:

```sh
git stash push -m 'df12-stash v1 task=1.2.2 kind=discard reason="formatter-churn"' -- <paths>
```

Do not use a bare `git stash`. Do not modify or restore files in the root
control worktree.

## Artifacts and notes

Planning commands already run:

```plaintext
pwd && git branch --show
/data/leynos/Projects/odw-lint.worktrees/roadmap-1-2-2
roadmap-1-2-2
```

```plaintext
git fetch origin main
From github.com:leynos/odw-lint
 * branch            main       -> FETCH_HEAD
```

```plaintext
sem diff --from origin/main --to HEAD --format json
{
  "summary": {
    "added": 24,
    "deleted": 13,
    "fileCount": 6,
    "modified": 5,
    "moved": 0,
    "renamed": 0,
    "total": 42
  },
  "files": [
    "docs/execplans/roadmap-1-2-2.md",
    "docs/execplans/roadmap-1-2-3.md",
    "docs/roadmap.md",
    "src/diagnostics/schema.ts",
    "tests/diagnostics/architecture.test.ts",
    "tests/diagnostics/schema.test.ts"
  ]
}
```

```plaintext
npm view fast-check version dist.tarball --json
{
  "version": "4.8.0",
  "dist.tarball": "https://registry.npmjs.org/fast-check/-/fast-check-4.8.0.tgz"
}
```

The most important branch-local symbols verified with `leta` were
`SourcePosition`, `SourceSpan`, `WorkflowSource`,
`DIAGNOSTIC_REPORT_SCHEMA`, `createDiagnosticReport`, and
`STATIC_ANALYSIS_COMPONENTS`.

Firecrawl verification of
`https://fast-check.dev/docs/api/interfaces/Parameters/` confirmed that
fast-check `seed` defaults to `Date.now()` and `numRuns` defaults to 100.
Tarball verification of `fast-check@4.8.0` confirmed the same parameters exist
in `package/lib/fast-check.d.ts` and that `assert` accepts `Parameters<T>` as
its second argument.

## Interfaces and dependencies

At the end of work item 5, the package entry should expose these names through
`odw-lint`:

```ts
export type OriginalSourceFile = {
  readonly filePath: string;
  readonly sourceText: string;
  readonly byteLength: number;
  readonly lines: readonly SourceLine[];
};

export type SourceLine = {
  readonly line: number;
  readonly startOffset: number;
  readonly contentEndOffset: number;
  readonly terminatorEndOffset: number;
  readonly text: string;
};

export type SourceSnippet = {
  readonly text: string;
  readonly start: SourcePosition;
  readonly end: SourcePosition;
  readonly lineText: string;
};

export class SourceOffsetError extends Error {}

export const createOriginalSourceFile: (source: WorkflowSource) => OriginalSourceFile;
export const positionAtOffset: (
  file: OriginalSourceFile,
  offset: number,
) => SourcePosition;
export const spanFromOffsets: (
  file: OriginalSourceFile,
  startOffset: number,
  endOffset: number,
) => SourceSpan;
export const sliceSourceSpan: (file: OriginalSourceFile, span: SourceSpan) => string;
export const snippetForSpan: (file: OriginalSourceFile, span: SourceSpan) => SourceSnippet;
```

The exact type declarations may add readonly internal fields if the
implementation needs lookup tables, but public helper names and the
original-source semantics above should remain stable. `sliceSourceSpan` and
`snippetForSpan` are validating public APIs: they must recompute positions from
the supplied `OriginalSourceFile` and reject caller-supplied spans whose
offsets or line/column positions do not match that file. If implementation
proves that a helper name or return shape is wrong, stop and revise this plan
before continuing.

The only dependency addition permitted by this plan is:

```json
"fast-check": "^4.8.0"
```

Use it only from tests.

The property-test runner configuration is part of the test contract:

```ts
const SOURCE_SPAN_PROPERTY_RUNNER = { seed: 0x1222026, numRuns: 200 } as const;
```

Every `fc.assert` in `tests/static-analysis/source-file.property.test.ts` must
pass that constant as its second argument.

## Revision note

Fix-round-2 revision for roadmap task 1.2.2. It records the required
`origin/main` reconciliation after the blocking review found that the branch
would otherwise remove newer main-branch fixture-corpus, documentation,
configuration, and roadmap work. The source-span implementation scope remains
unchanged.
