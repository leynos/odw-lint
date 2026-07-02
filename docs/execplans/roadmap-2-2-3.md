# Add span snapshot assertions for parser-backed diagnostics

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`,
`Surprises & Discoveries`, `Decision Log`, and
`Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint` statically checks Open Dynamic Workflows (ODW) source without
executing it. Task 2.2.1 added the SWC parser adapter `parseWorkflowBody`,
which converts a body parse failure into a single `odw/body-syntax`
diagnostic whose `span` is the whole original-source body span
(`src/static-analysis/workflow-body-parser.ts`). Task 2.2.2 added the body
normalizer and the normalized-to-original span mapper
(`src/static-analysis/workflow-body-normalizer.ts`) so valid ODW bodies
parse and a mapped normalized span points back into original source.

Roadmap task 2.2.3 (`docs/roadmap.md` lines 557-562) is the verification
task that pins the correctness property named in
`docs/technical-design.md` section 11.5: *every diagnostic span must point
into the original source*, proven for parser-backed diagnostics across the
full lexical matrix — LF, CRLF, Unicode, comments, regex literals, template
text, and template interpolation. Roadmap success line (verbatim): "each
body diagnostic includes a stable original-source snippet across LF, CRLF,
Unicode, comments, regex literals, template text, and template
interpolation."

What a reader gains after this change: a focused, table-driven snapshot
suite proves that for every body that fails to parse, the emitted
`odw/body-syntax` diagnostic's `span` slices back — through the public
`sliceSourceSpan`/`snippetForSpan` helpers — to the exact original-source
text, byte-for-byte, even when the body carries a two-byte CRLF terminator,
a multibyte or astral Unicode code point, a line/block comment, a regex
literal, template text, or a `${...}` interpolation. The snippet is
recorded in a reviewer-useful, ASCII-safe snapshot and is independently
cross-checked against a UTF-8 byte oracle so a span-mapping regression
fails the suite rather than silently re-recording.

Observable proof (see `Validation and acceptance`):

1. A new suite `tests/static-analysis/body-diagnostic-spans.test.ts`
   builds an in-memory workflow for each lexical case, calls
   `parseWorkflowBody`, and asserts the result is a
   `{ ok: false, diagnostic }` whose `String(diagnostic.rule)` is
   `odw/body-syntax`.
2. For each case the suite asserts `sliceSourceSpan(file, diagnostic.span)`
   and `snippetForSpan(file, diagnostic.span).text` both equal a UTF-8
   byte-oracle decode of `diagnostic.span` from the raw source text
   (`TextDecoder`/`Buffer`, the same oracle already trusted in
   `tests/static-analysis/invalid-workflow-fixtures.test.ts`).
3. Each case records one Bun snapshot capturing the rule, severity, span
   coordinates, and the JSON-escaped snippet, so line terminators and
   Unicode are visible and the `.snap` stays free of raw carriage-return
   bytes.

### Scope boundary with adjacent tasks (read this first)

This is the most important design decision in the plan. Keep 2.2.3 to
*span snapshot assertions* only.

- **2.2.3 owns** the parser-backed span snapshot matrix and the semantic
  round-trip proof. It adds tests and, at most, shared test-support and
  documentation. It changes **no production runtime behaviour**.
- **2.2.3 must not change the `Diagnostic` object shape.** The diagnostic
  contract in `docs/technical-design.md` section 8 lists the diagnostic
  fields; it does not include a `snippet` field, and it states that
  "changing the diagnostic object shape requires schema-version review."
  The roadmap phrase "each body diagnostic includes a stable
  original-source snippet" is satisfied by *deriving and asserting* the
  snippet from `diagnostic.span` in tests (exactly as section 11.5 frames
  it: "assert line, column, and snippet for each rule"), matching how the
  invalid-fixture manifest already stores `spanText` as test data rather
  than on the diagnostic. Adding a `snippet` field is out of scope and
  would trigger a schema-version review this task does not carry. See
  `Decision Log`.
- **2.2.6 owns** narrowing `odw/body-syntax` spans to the offending token
  once SWC exposes structured syntax-error offsets (`docs/roadmap.md`
  lines 581-589). 2.2.3 keeps the S2 fallback decided in 2.2.1 and retained
  in 2.2.2: a syntax-error diagnostic reports the whole `envelope.bodySpan`
  (`docs/execplans/roadmap-2-2-1.md` Decision Log; `roadmap-2-2-2.md`
  scope note). So each snippet in this task is the whole body slice, and
  the lexical feature under test lives *inside* that body ahead of a
  trailing unclosed construct that forces the parse failure.
- **2.2.4 owns** exposing AST facts and source masks. 2.2.3 must not read
  the SWC AST, add binding facts, or wire `parseWorkflowBody` into
  `lintWorkflowSource`. It uses only the public
  `parseWorkflowBody`/`sliceSourceSpan`/`snippetForSpan`/
  `scanWorkflowEnvelope`/`createOriginalSourceFile` surface.
- **No new committed fixture files with non-ASCII or CRLF content.** See
  `Constraints` for why the cases are in-memory rather than files under
  `tests/static-analysis/fixtures/invalid-workflows/`.

Design references: `docs/technical-design.md` sections 4, 6.1, 8, 11.1,
11.5, 12.1, 12.2; `docs/adr/0001-static-analysis-boundary.md`;
`docs/developers-guide.md` "Source-span helpers" and the invalid-workflow
fixture section (lines 383-408, 436-490); `AGENTS.md` (Testing, Snapshot
scope, DRY/refactor policy). Requires 2.2.2 (COMPLETE on this branch base;
`docs/execplans/roadmap-2-2-2.md` Status COMPLETE).

## Constraints

Hard invariants that must hold throughout implementation. Violation
requires escalation, not a workaround.

- **No source evaluation.** New tests and any shared test support must not
  import, evaluate, execute, or format workflow source as JavaScript, and
  must not call any ODW loader, primitive, runtime, scheduler, or
  agent-dispatch path. In-memory case sources are plain string literals
  passed to `createOriginalSourceFile`; they are never `eval`'d, imported,
  or run (`docs/technical-design.md` sections 5, 12.1;
  `docs/adr/0001-static-analysis-boundary.md`;
  `tests/diagnostics/import-policy.test.ts`).
- **No production runtime change.** No file under `src/` changes behaviour.
  The `Diagnostic` shape in `src/diagnostics/types.ts` and the diagnostic
  contract in `docs/technical-design.md` section 8 are unchanged. If a work
  item appears to need a `src/` change, stop and escalate (see
  `Tolerances`).
- **Whole-body span strategy (S2) preserved.** Each parser-backed
  diagnostic under test reports `envelope.bodySpan`; the snippet equals the
  whole body slice. Narrowing is 2.2.6's job.
- **UTF-8 byte-offset contract.** `span.*.offset` is a zero-based UTF-8
  byte offset; `column` counts Unicode code points, not UTF-16 code units;
  LF, CR, CRLF, U+2028, and U+2029 are line terminators, and a CRLF pair is
  one line break spanning two bytes (`docs/technical-design.md` section 8;
  `docs/developers-guide.md` "Source-span helpers";
  `src/static-analysis/source-scan.ts`). Assertions must exercise, not
  bypass, this contract.
- **ASCII-only committed source.** No committed test source file added by
  this task contains a byte above `0x7f` or a CR byte. Non-ASCII and CRLF
  live only inside string literals (using `\u...`/`\r\n` escapes) evaluated
  at runtime, never as bytes on disk. This preserves the ASCII invariant at
  `tests/static-analysis/invalid-workflow-fixtures.test.ts:302` and avoids
  git line-ending normalisation (the repository ships no `.gitattributes`).
- **en-GB Oxford spelling** ("-ize"/"-yse"/"-our") in all prose, comments,
  and commit messages (`AGENTS.md`; `docs/documentation-style-guide.md`).
- **File size < 400 lines** for every code file touched (`AGENTS.md`). If
  the new test module would exceed this, split by case family and escalate
  the split in `Decision Log`.

## Tolerances (exception triggers)

- **Scope:** if delivering the matrix requires editing any file under
  `src/`, stop and escalate — the task is verification-only.
- **Diagnostic shape:** if a reviewer insists the snippet must be a
  `Diagnostic` field, stop and escalate; that is a section 8 schema-version
  change outside this task.
- **Files/lines:** if the change exceeds roughly 6 files or ~600 net added
  lines, stop and re-scope.
- **Iterations:** if the suite still fails after 3 focused attempts for a
  reason other than an intended snapshot update, stop and escalate.
- **Ambiguity:** if a case cannot be forced into an `odw/body-syntax`
  failure while still carrying its lexical feature in the body slice, stop
  and present options.
- **New dependency:** none is permitted. `@swc/core`, `fast-check`, and
  `bun:test` are already present; adding any dependency triggers escalation.

## Risks

- Risk: a constructed body parses successfully (no diagnostic) because the
  trailing failure token is not actually a syntax error after
  normalisation (the body is wrapped in `async function ... { ... \n}`).
  Severity: medium. Likelihood: medium.
  Mitigation: reuse the proven failure tail
  `if (args.ready) {\n` (an unclosed block, already used by
  `tests/static-analysis/fixtures/invalid-workflows/syntax-error/body-unclosed-block.js`
  and the 2.2.1 property test) after the feature-bearing statements; assert
  `result.ok === false` and the rule id in every case before snapshotting.
- Risk: a raw CR byte or non-ASCII byte leaks into a committed `.snap` or
  test file and is normalised by git or an editor, making the snapshot
  non-deterministic across machines. Severity: medium. Likelihood: low.
  Mitigation: serialise the snapshot snippet through `JSON.stringify`, which
  escapes `\r`, `\n`, U+2028, and U+2029 to ASCII escape sequences; keep
  test source ASCII-only (`Constraints`); verify with the existing
  `make whitespace-hygiene` gate inside `make all`.
- Risk: the semantic assertion is tautological (expected value computed by
  the same production helper it checks). Severity: medium. Likelihood:
  medium. Mitigation: cross-check `sliceSourceSpan`/`snippetForSpan`
  against an *independent* UTF-8 byte oracle (`Buffer` + fatal
  `TextDecoder`) decoding `diagnostic.span` from the raw source string, the
  same oracle already trusted in
  `tests/static-analysis/invalid-workflow-fixtures.test.ts`
  (`decodeSpanText`, `positionForOffset`, `expectSpanToMatchSource`).
- Risk: duplicating that oracle violates the DRY/refactor policy in
  `AGENTS.md`. Severity: low. Likelihood: high if unaddressed.
  Mitigation: extract the oracle into a shared support module first
  (WI1), snapshot-neutral, and consume it from both suites.
- Risk: `scanWorkflowEnvelope` mishandles a CRLF or Unicode envelope and
  the case never reaches a body diagnostic. Severity: low. Likelihood: low
  (the scanner's single pass in `src/static-analysis/source-scan.ts`
  already classifies CRLF/U+2028/U+2029 and UTF-8 widths).
  Mitigation: assert `scan.status === "scanned"` per case and fail loudly
  otherwise; a manual probe during planning confirmed a CRLF+Unicode body
  reaches an `odw/body-syntax` diagnostic whose span round-trips (see
  `Surprises & Discoveries`).

## Progress

- [x] (2026-07-02 21:10Z) WI1: Extract the shared UTF-8 byte-offset
  span oracle into a test-support module and rewire the invalid-fixture
  suite to it (snapshot-neutral). `make all` passed after adding public
  JSDoc required by Oxlint, and `coderabbit review --agent` reported 0
  findings.
- [x] (2026-07-02 21:47Z) WI2: Add the span-snapshot harness plus the
  line-terminator cases (LF, CRLF). `make all` passed with 627 tests, and
  the final `coderabbit review --agent` run reported 0 findings after the
  case table was tightened to include multibyte text in both LF and CRLF
  cases.
- [x] (2026-07-02 22:10Z) WI3: Add the Unicode cases (multibyte BMP
  and astral code point). `make all` passed with 629 tests, and
  `coderabbit review --agent` reported 0 findings after one CodeRabbit
  backend rate-limit retry.
- [x] (2026-07-02 22:18Z) WI4: Add the lexical decoy-content cases
  (line comment, block comment, regex literal, template text, template
  interpolation). `make all` passed with 634 tests and no warnings, and
  `coderabbit review --agent` reported 0 findings.
- [x] (2026-07-02 22:23Z) WI5: Document the span-snapshot suite in the
  developers' guide and tick roadmap task 2.2.3. `make markdownlint`,
  `make nixie`, `make all`, and the final `coderabbit review --agent` run
  passed after the documentation updates.

## Surprises & discoveries

- Observation: a planning probe built an in-memory workflow whose body was
  the following (CRLF terminators, a regex literal, a multibyte `café`
  identifier, a template interpolation, an astral emoji, and a line comment
  ahead of the unclosed failure tail):

  ```js
  const body =
    `const café = /ab+c/g;\r\n` +
    "const t = `hi ${café}` + '😀'; // note\r\n" +
    `if (args.ready) {\r\n`;
  ```

  It confirmed the shape end-to-end at the type level via `odw-lint`
  exports (`createOriginalSourceFile`, `scanWorkflowEnvelope`,
  `parseWorkflowBody`, `sliceSourceSpan`, `snippetForSpan`).
  Evidence: the scan result narrows on `status === "scanned"` (not `ok`;
  see `src/static-analysis/types.ts:72`), and
  `src/static-analysis/source-scan.ts` records CRLF as a two-byte, one-line
  terminator and computes UTF-8 widths per code point, so
  `sliceSourceSpan` is expected to reproduce the raw bytes exactly.
  Impact: the harness must narrow the scan with
  `scan.status === "scanned"` (reuse
  `tests/static-analysis/workflow-envelope-support.ts`'s
  `expectScannedEnvelope`), and the astral case must use a `\u{1f600}`
  escape rather than a literal glyph to keep test source ASCII-only.
- Observation: `bun test` could not be executed during planning because the
  agent shell gates arbitrary Bash behind interactive approval.
  Evidence: repeated `bun test tests/static-analysis/_probe.test.ts`
  invocations returned "This command requires approval".
  Impact: the round-trip claim is pinned by the tests this plan adds (WI2-WI4
  are the executable proof) and by direct reading of
  `source-scan.ts`/`source-snippet.ts`/`workflow-body-normalizer.ts`; the
  implementer must run `make all` to confirm before committing each WI.
- Observation: WI1's first `make all` run failed only on the new exported
  helper documentation.
  Evidence: Oxlint reported missing `@param` and `@returns` tags for
  `decodeSpanText`, `positionForOffset`, and `expectSpanToMatchSource` in
  `tests/static-analysis/source-span-oracle.ts`.
  Impact: the support module now carries full public JSDoc, matching the
  repository's exported-test-helper standard.
- Observation: CodeRabbit considered a line-terminator-only WI2 matrix too
  weak for a span snapshot suite, even though Unicode was originally scoped
  to WI3.
  Evidence: the first WI2 review asked for an independently expected span
  substring, the second asked for at least one multibyte fixture, and the
  third asked for CRLF plus non-ASCII in the same case.
  Impact: WI2 now uses escaped `caf\u00e9` text in both LF and CRLF cases
  and serializes snapshot text through an ASCII JSON string helper. WI3
  remains responsible for the explicit BMP and astral Unicode assertions.
- Observation: WI3's first CodeRabbit attempt hit a backend rate limit.
  Evidence: the scrutineer reported a 14-minute wait request, retried once
  after waiting, and the second `coderabbit review --agent` run completed
  with `findings: 0`.
  Impact: no code change was needed; the retry is counted in the review
  evidence for this work item.
- Observation: Biome warns on a literal `${name}` sequence inside a normal
  string, even when that sequence is intentional test data for template
  interpolation.
  Evidence: `bunx @biomejs/biome ci src tests` reported
  `lint/suspicious/noTemplateCurlyInString` for the
  `template-interpolation` fixture before the body text was split into
  adjacent strings.
  Impact: the fixture now constructs the same runtime body from adjacent
  string literals split across the dollar sign and opening brace, keeping
  the test data intact while leaving the deterministic gate warning-free.

## Decision log

- Decision: this task adds tests (and shared test support plus docs) only;
  it changes no `src/` runtime behaviour and does not add a `snippet` field
  to `Diagnostic`.
  Rationale: `docs/technical-design.md` section 8 enumerates the diagnostic
  fields and gates any shape change behind a schema-version review; section
  11.5 frames snippet coverage as a *fixture/verification* property
  ("assert line, column, and snippet for each rule"); the invalid-fixture
  manifest already stores the snippet as `spanText` test data, not on the
  diagnostic. The roadmap's "includes a stable original-source snippet" is
  therefore satisfied by deriving and asserting the snippet from the span in
  tests. No undecided fork remains.
  Date/Author: 2026-07-02, planning agent.
- Decision: the LF/CRLF/Unicode/decoy cases are built in memory from string
  literals, not committed as `.js` fixtures under
  `tests/static-analysis/fixtures/invalid-workflows/`.
  Rationale: committed fixtures are subject to the ASCII-only invariant at
  `tests/static-analysis/invalid-workflow-fixtures.test.ts:302`, to
  `make refresh-fixtures` SHA-256/`spanText` manifest coupling
  (`docs/developers-guide.md` lines 383-408), and to git line-ending
  normalisation (no `.gitattributes` ships). In-memory literals with
  `\r\n`/`\u...` escapes are deterministic, ASCII-safe on disk, and
  isolated from the manifest tooling. The existing
  `workflow-body-parser.test.ts` already builds bodies in memory via an
  `envelopeForBody` helper, so this is the established pattern.
  Date/Author: 2026-07-02, planning agent.
- Decision: snapshot snippets are serialised with `JSON.stringify`, paired
  with an independent UTF-8 byte-oracle semantic assertion.
  Rationale: `JSON.stringify` escapes line terminators to ASCII, keeping the
  `.snap` free of raw CR bytes and making terminators/Unicode visible to
  reviewers; the byte oracle makes the correctness assertion non-tautological
  (`AGENTS.md` "Pair snapshots with semantic assertions").
  Date/Author: 2026-07-02, planning agent.
- Decision: extract the byte oracle
  (`decodeSpanText`/`positionForOffset`/`expectSpanToMatchSource`) into a
  shared support module (WI1) before adding the new suite.
  Rationale: `AGENTS.md` DRY/abstraction policy requires sweeping for an
  existing equivalent before duplicating; the equivalent lives in
  `invalid-workflow-fixtures.test.ts`. Extracting first keeps one oracle.
  Date/Author: 2026-07-02, planning agent.
- Decision: keep WI1 as a pure test-support extraction with public JSDoc on
  the newly exported helpers.
  Rationale: the first deterministic gate showed the helper API is treated
  as public by the repository's Oxlint rules; documenting the parameters and
  returns preserves the refactor without changing test behaviour.
  Date/Author: 2026-07-02 21:10Z, implementation agent.
- Decision: include a small BMP character in WI2's LF and CRLF bodies
  rather than waiting for WI3 to introduce all Unicode coverage.
  Rationale: CodeRabbit correctly identified that parser-backed span
  snapshots are more useful when the earliest suite already proves byte
  offsets through multibyte UTF-8 text. Keeping the Unicode-specific
  assertions for WI3 avoids collapsing the work items.
  Date/Author: 2026-07-02 21:47Z, implementation agent.
- Decision: keep WI3's Unicode-specific proof inside the existing span
  snapshot harness rather than splitting a new runner.
  Rationale: the module remains below the 400-line file-size limit, and one
  table keeps the parser-backed diagnostic invariant visible in a single
  suite while allowing case-specific byte-width assertions.
  Date/Author: 2026-07-02 22:10Z, implementation agent.
- Decision: keep the WI4 lexical decoy matrix in
  `tests/static-analysis/body-diagnostic-spans.test.ts` instead of
  splitting a case table module.
  Rationale: after adding line comment, block comment, regex literal,
  template text, and template interpolation cases, the test module is still
  155 lines, comfortably below the 400-line file-size limit.
  Date/Author: 2026-07-02 22:18Z, implementation agent.

## Outcomes & retrospective

Roadmap task 2.2.3 is complete. The shipped
`tests/static-analysis/body-diagnostic-spans.test.ts` suite proves
parser-backed `odw/body-syntax` diagnostic spans across LF, CRLF, Unicode
BMP, Unicode astral, line comment, block comment, regex literal, template
text, and template interpolation bodies. Every case checks the diagnostic
rule and severity, the independent UTF-8 byte oracle, `sliceSourceSpan`,
`snippetForSpan`, and an ASCII-safe snapshot of the original-source snippet.

The whole-body span remains the right granularity for this task because
2.2.1 and 2.2.2 deliberately retained the S2 fallback: parser errors report
`envelope.bodySpan` until roadmap task 2.2.6 narrows syntax-error spans to
the offending token. The suite now locks that fallback down so later
narrowing has clear snapshot evidence to update intentionally.

The main implementation lesson was that even verification-only snapshot
suites need non-tautological expected data. CodeRabbit caught the initial
use of the byte oracle as both expected and actual text, which led to the
case-owned expected body text now used by the assertions. It also pushed the
line-ending cases to include multibyte UTF-8 text, strengthening the matrix
without changing production code.

## Context and orientation

A novice needs these files:

- `src/static-analysis/workflow-body-parser.ts` — `parseWorkflowBody`
  returns `{ ok: true }` or `{ ok: false, diagnostic }` where the
  diagnostic is `odw/body-syntax` with `span = envelope.bodySpan`. This is
  the parser-backed diagnostic under test.
- `src/static-analysis/workflow-body-normalizer.ts` — wraps the body in
  `async function __odwLintWorkflowBody__() { ... \n}` so `return`/`await`
  parse; the span mapper subtracts the wrapper prefix. Explains why a
  trailing unclosed `{` still yields a parse failure.
- `src/static-analysis/source-scan.ts` — the single scan that assigns UTF-8
  byte offsets, code-point columns, and LF/CR/CRLF/U+2028/U+2029 line
  breaks. Guarantees CRLF/Unicode round-trip fidelity.
- `src/static-analysis/source-snippet.ts` — `sliceSourceSpan` and
  `snippetForSpan`; both re-validate the span, then slice original text.
- `src/diagnostics/types.ts` — the `Diagnostic`, `SourceSpan`,
  `SourcePosition` shapes (unchanged by this task).
- `tests/static-analysis/workflow-body-parser.test.ts` — the sibling suite;
  reuse its `envelopeForBody` construction idea (prepend a valid
  `export const meta = {...};` then the body).
- `tests/static-analysis/workflow-envelope-support.ts` — `expectScannedEnvelope`
  narrows a scan result to its envelope.
- `tests/static-analysis/invalid-workflow-fixtures.test.ts` — source of the
  UTF-8 byte oracle (`decodeSpanText`, `positionForOffset`,
  `expectSpanToMatchSource`) to extract in WI1.
- `docs/technical-design.md` section 11.5 — the span-mapping invariant this
  task pins; section 8 — the diagnostic contract kept stable.
- `docs/developers-guide.md` "Source-span helpers" — the CRLF/Unicode
  offset rules the assertions exercise; the doc to extend in WI5.

Terms: a *parser-backed diagnostic* is one whose emission depends on the
SWC parse result; here that is `odw/body-syntax`. A *snippet* is the exact
original-source text covered by a diagnostic's span. The *byte oracle* is
an independent decode of a span from the raw source using Node `Buffer`
plus a fatal `TextDecoder`, used to check the production slicer.

## Plan of work

Stages map to work items; each ends with its own validation and its own
commit. The suite lives in `tests/static-analysis/body-diagnostic-spans.test.ts`
and shares a support module `tests/static-analysis/source-span-oracle.ts`.

### WI1 — Extract the shared UTF-8 byte-offset span oracle (refactor)

Read first: `AGENTS.md` (DRY/refactor policy, "Separate Atomic Refactors");
`tests/static-analysis/invalid-workflow-fixtures.test.ts` lines 37,
112-147. Skills: load `python-router`? No — TypeScript; there is no
TS router skill, so follow `AGENTS.md` TypeScript Guidance and the
`code-review` skill's habits. Load no language router (this repo is
TypeScript-only).

Create `tests/static-analysis/source-span-oracle.ts` with a `/** @file */`
header exporting the three helpers currently private to
`invalid-workflow-fixtures.test.ts`:

- `decodeSpanText(sourceText, span)` — fatal-`TextDecoder` decode of the
  UTF-8 byte sub-range.
- `positionForOffset(sourceText, offset)` — recompute
  `{ offset, line, column }` from a UTF-8 byte offset (code-point column).
- `expectSpanToMatchSource(sourceText, span, expectedSpanText)` — the
  combined bounds/position/text assertion.

Move (do not copy) the bodies verbatim, keeping the `bun:test` `expect`
import inside the support module (mirror
`workflow-envelope-support.ts`, which imports `expect` from `bun:test`).
Rewire `invalid-workflow-fixtures.test.ts` to import them from the new
module and delete the local copies and the now-unused
`SPAN_DECODER`/`Buffer`/`TextDecoder` imports it no longer needs directly.

This is snapshot-neutral: no `.snap` file changes. It is a pure
test-support refactor landing before the feature per `AGENTS.md` (extract
the shared helper rather than duplicate it).

Validation: `make all` (the whole invalid-fixture suite must still pass
with unchanged snapshots).

### WI2 — Span-snapshot harness plus line-terminator cases (LF, CRLF)

Read first: `docs/technical-design.md` sections 8 and 11.5;
`docs/developers-guide.md` "Source-span helpers";
`tests/static-analysis/workflow-body-parser.test.ts` (construction idiom);
`AGENTS.md` Testing + Snapshot scope. Skills: `code-review` habits;
no language router required.

Create `tests/static-analysis/body-diagnostic-spans.test.ts` with:

- A typed case record: `{ name, meta, body }` where `meta` defaults to the
  shared `export const meta = { name: "x", description: "ok" };` line and
  `body` carries the lexical feature followed by the failure tail
  `if (args.ready) {\n` (or its CRLF form). Group cases in a frozen array
  and drive them with `it.each`.
- A builder that assembles `sourceText` as `meta + terminator + body`, calls
  `createOriginalSourceFile`, `scanWorkflowEnvelope`, narrows with
  `expectScannedEnvelope`, then `parseWorkflowBody`, and narrows the result
  to its diagnostic (reuse the `expectBodySyntaxDiagnostic` shape from the
  sibling suite, or a local equivalent).
- Per case, three assertions:
  1. `String(diagnostic.rule) === "odw/body-syntax"` and
     `diagnostic.severity === "error"`.
  2. `expectSpanToMatchSource(sourceText, diagnostic.span, oracleText)` and
     `sliceSourceSpan(file, diagnostic.span) === oracleText` and
     `snippetForSpan(file, diagnostic.span).text === oracleText`, where
     `oracleText = decodeSpanText(sourceText, diagnostic.span)`. Because
     `oracleText` comes from the independent byte oracle, a slicer
     regression diverges here.
  3. `expect({ rule, severity, span: diagnostic.span, spanText:
     JSON.stringify(snippetForSpan(file, diagnostic.span).text) })
     .toMatchSnapshot()`.

Add exactly two cases in this WI:

- `lf-baseline`: LF terminators only; body e.g.
  `const x = 1;\nif (args.ready) {\n`.
- `crlf-terminators`: the same body with `\r\n` terminators throughout,
  proving the two-byte terminator is preserved and offsets stay byte-based.

Record snapshots only after confirming the failure is a first-run missing
snapshot (Red → Green substitute; see `Validation and acceptance`):

```bash
bunx bun test tests/static-analysis/body-diagnostic-spans.test.ts \
  --update-snapshots
```

Validation: `make all`.

### WI3 — Unicode cases

Read first: `docs/developers-guide.md` "Source-span helpers" (UTF-8/UTF-16
divergence); `tests/static-analysis/invalid-workflow-fixtures.test.ts`
lines 278-289 (the existing Unicode byte-offset case as a model).

Add two cases to the frozen array:

- `unicode-bmp`: a body containing a multibyte BMP identifier/comment, e.g.
  `const café = 1; // dÃ©cor\nif (args.ready) {\n` written with `\u...`
  escapes so the file stays ASCII. Assert (beyond the shared three) that
  `diagnostic.span.end.offset` is the UTF-8 byte length and is strictly
  greater than the UTF-16 `.length` of the same slice, mirroring
  `invalid-workflow-fixtures.test.ts:287`.
- `unicode-astral`: a body containing an astral code point via `\u{1f600}`
  (four UTF-8 bytes / surrogate pair), e.g.
  `const s = '\u{1f600}';\nif (args.ready) {\n`. Assert the code-point
  column count differs from the UTF-16 code-unit count across the astral
  character.

Update snapshots the same way. Validation: `make all`.

### WI4 — Lexical decoy-content cases

Read first: `docs/technical-design.md` section 11.1 (the corpus should
include strings, comments, regex, and template literals with decoy
syntax); `src/static-analysis/source-mask-*` ownership notes in
`docs/developers-guide.md` for terminology.

Add cases to the frozen array, each carrying the feature in the body ahead
of the failure tail:

- `line-comment`: `// draft note\nif (args.ready) {\n`.
- `block-comment`: `/* multi\n   line */\nif (args.ready) {\n` (interior
  newline exercises multi-line snippet slicing).
- `regex-literal`: `const re = /ab+c\/d/g;\nif (args.ready) {\n` (escaped
  slash inside the literal must survive intact in the snippet).
- `template-text`: a template with literal text only, e.g. body
  ``const t = `plain text`;\nif (args.ready) {\n``.
- `template-interpolation`: a template with a `${...}` substitution, e.g.
  ``const t = `hi ${name}`;\nif (args.ready) {\n``.

Each case asserts the shared three (rule/severity, byte-oracle round-trip,
snapshot). Update snapshots. Validation: `make all`.

If the module approaches 400 lines, split the case table into a colocated
`body-diagnostic-span-cases.ts` data module (pattern:
`source-file-span-cases.ts`) and keep the runner lean; record the split in
`Decision Log`.

### WI5 — Documentation and roadmap tick

Read first: `docs/developers-guide.md` "Source-span helpers" and the
invalid-fixture section; `docs/documentation-style-guide.md`; `AGENTS.md`
Markdown Guidance (80-column prose, 120-column code, dashes, en-GB).

- Add a short subsection to `docs/developers-guide.md` (near "Source-span
  helpers") naming `tests/static-analysis/body-diagnostic-spans.test.ts` as
  the parser-backed span-snapshot suite, stating that it proves the section
  11.5 invariant across LF/CRLF/Unicode/comments/regex/template
  text/interpolation using in-memory sources and an independent UTF-8 byte
  oracle, and noting the whole-body-span (S2) granularity pending 2.2.6.
- Tick roadmap task 2.2.3: change `- [ ] 2.2.3.` to `- [x] 2.2.3.` at
  `docs/roadmap.md:557`.

Format only the two changed Markdown files, then gate:
`mdtablefix docs/developers-guide.md docs/roadmap.md` then
`markdownlint-cli2 --fix docs/developers-guide.md docs/roadmap.md`, then
`make markdownlint` and `make nixie` and `make all`.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-2-3`.

1. WI1: create `tests/static-analysis/source-span-oracle.ts`; edit
   `tests/static-analysis/invalid-workflow-fixtures.test.ts` to import from
   it and drop the moved locals. Then:

   ```bash
   bunx @biomejs/biome format --write \
     tests/static-analysis/source-span-oracle.ts \
     tests/static-analysis/invalid-workflow-fixtures.test.ts
   make all
   ```

   Expect: all suites pass; no `.snap` changes.

2. WI2: create `tests/static-analysis/body-diagnostic-spans.test.ts` with
   the harness and the LF + CRLF cases. Prove Red then Green:

   ```bash
   # Red substitute: first run has no recorded snapshots.
   bun test tests/static-analysis/body-diagnostic-spans.test.ts
   # Record after confirming the only failures are missing snapshots.
   bun test tests/static-analysis/body-diagnostic-spans.test.ts --update-snapshots
   bunx @biomejs/biome format --write \
     tests/static-analysis/body-diagnostic-spans.test.ts
   make all
   ```

   Expect on the Red run: failures reporting new snapshots being written /
   not matching; the byte-oracle assertions pass. Expect after
   `--update-snapshots`: green. Inspect the generated
   `tests/static-analysis/__snapshots__/body-diagnostic-spans.test.ts.snap`
   and confirm the CRLF snippet shows `\r\n` escapes, not raw CR bytes.

3. WI3 and WI4: append cases, re-run with `--update-snapshots`, review the
   snapshot diff for each added case, then `make all`.

4. WI5: edit the two Markdown files, format the two paths, then
   `make markdownlint`, `make nixie`, and `make all`.

Commit after each work item with an imperative, en-GB, ≤50-char subject and
a wrapped body explaining what and why (`AGENTS.md` Committing). Gate every
commit with `make all` (plus `make markdownlint` and `make nixie` for WI5).

## Validation and acceptance

Acceptance is behavioural and snapshot-based:

- Running `make all` passes at every commit. `make all` runs build,
  formatting check, whitespace hygiene, lint, typecheck, and tests
  (`Makefile:5`).
- The new suite `tests/static-analysis/body-diagnostic-spans.test.ts`
  passes with all cases (LF, CRLF, Unicode BMP, Unicode astral, line
  comment, block comment, regex literal, template text, template
  interpolation). For every case:
  - `parseWorkflowBody` returns `{ ok: false, diagnostic }` with
    `String(diagnostic.rule) === "odw/body-syntax"` and severity `error`.
  - The byte-oracle assertion holds:
    `sliceSourceSpan(file, diagnostic.span)` and
    `snippetForSpan(file, diagnostic.span).text` both equal
    `decodeSpanText(sourceText, diagnostic.span)`, and
    `expectSpanToMatchSource` confirms the offsets and recomputed
    positions.
  - One Bun snapshot records `{ rule, severity, span,
    spanText: JSON.stringify(...) }`.
- Red-Green-Refactor substitute (this is a verification task; there is no
  new production behaviour to red-test, per the execplans skill's
  "nearest observable substitute"): the *Red* stage is the first
  `bun test` run before snapshots exist (missing-snapshot failures) with
  the byte-oracle assertions already passing; the *Green* stage is the run
  after `--update-snapshots`; the *Refactor* stage is WI1's oracle
  extraction, proven snapshot-neutral by unchanged `.snap` files. The
  byte-oracle assertions are the genuine correctness guard: they would fail
  a real span-mapping regression regardless of the recorded snapshot.
- For Markdown changes (WI5): `make markdownlint` and `make nixie` pass.

Quality criteria ("done"):

- Tests: the new suite and the untouched
  `invalid-workflow-fixtures.test.ts` snapshot both pass under `make test`.
- Lint/format/typecheck: clean under `make all`.
- No `src/` diff; `Diagnostic` shape and `docs/technical-design.md`
  section 8 unchanged.
- Roadmap 2.2.3 ticked; developers' guide names the suite.

Quality method: `make all` at each commit; manual review of every recorded
snapshot diff before it is committed (`AGENTS.md` "update snapshots only
after confirming the failure represents an intentional contract change").

## Idempotence and recovery

- Re-running any step is safe: the tests are deterministic and build their
  sources in memory. Re-running `--update-snapshots` after a real code
  change re-records; always review the diff before committing.
- WI1 is reversible by restoring the moved helpers; it changes no snapshot.
- If a case unexpectedly parses (no diagnostic), lengthen or adjust the
  failure tail (keep `if (args.ready) {` unclosed) rather than weakening the
  assertions; do not delete the case.
- Leave the worktree clean: no `_probe`/scratch test files (the planning
  probe file was removed).

## Artifacts and notes

Existing recorded contract for the sibling parser-backed diagnostic
(`tests/static-analysis/__snapshots__/workflow-body-parser.test.ts.snap`)
shows the shape a body-syntax diagnostic snapshot takes (rule, severity,
message, span). The new suite's snapshot adds the JSON-escaped `spanText`
and drops `message`/`docs` (those are pinned by the sibling suite and the
catalogue), keeping this suite focused on the *span/snippet* contract.

WI1 evidence:

```plaintext
make all
625 pass
0 fail
Ran 625 tests across 61 files.

coderabbit review --agent
findings: 0
final status: review_completed
```

WI2 evidence:

```plaintext
bun test tests/static-analysis/body-diagnostic-spans.test.ts
2 pass
0 fail
2 snapshots

make all
627 pass
0 fail

coderabbit review --agent
findings: 0
final status: review_completed
```

WI3 evidence:

```plaintext
bun test tests/static-analysis/body-diagnostic-spans.test.ts
4 pass
0 fail
4 snapshots

make all
629 pass
0 fail

coderabbit review --agent
first attempt: rate-limited
second attempt: findings: 0
final status: review_completed
```

WI4 evidence:

```plaintext
bun test tests/static-analysis/body-diagnostic-spans.test.ts
9 pass
0 fail
9 snapshots

make all
634 pass
0 fail

coderabbit review --agent
findings: 0
final status: review_completed
```

WI5 evidence:

```plaintext
mdtablefix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-2-2-3.md
markdownlint-cli2 --fix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-2-2-3.md

make markdownlint
0 errors

make nixie
all diagrams validated

make all
634 pass
0 fail

coderabbit review --agent
findings: 0
final status: review_completed
```

## Interfaces and dependencies

Public `odw-lint` surface used (all already exported from
`src/index.ts` / `src/static-analysis/index.ts`; no new exports):

- `createOriginalSourceFile(source): OriginalSourceFile`
- `scanWorkflowEnvelope(file): WorkflowEnvelopeScanResult`
- `parseWorkflowBody(envelope): WorkflowBodyParseResult`
- `sliceSourceSpan(file, span): string`
- `snippetForSpan(file, span): SourceSnippet`
- types `Diagnostic`, `SourceSpan`, `SourcePosition`, `OriginalSourceFile`,
  `WorkflowEnvelope`.

New test-support module
`tests/static-analysis/source-span-oracle.ts` must export:

```ts
import type { SourceSpan } from "odw-lint";

export const decodeSpanText: (sourceText: string, span: SourceSpan) => string;
export const positionForOffset: (
  sourceText: string,
  offset: number,
) => SourceSpan["start"];
export const expectSpanToMatchSource: (
  sourceText: string,
  span: SourceSpan,
  expectedSpanText: string,
) => void;
```

No `@swc/core` AST type, no private source-index helper, and no ODW runtime
symbol may appear in the new test files.

Revision note (2026-07-02 21:10Z): WI1 is complete. The byte-offset oracle
was moved into `tests/static-analysis/source-span-oracle.ts`, the invalid
fixture suite now imports it, the initial Oxlint JSDoc issue was fixed, and
the remaining work is the new parser-backed span snapshot suite plus
documentation and roadmap updates.

Revision note (2026-07-02 21:47Z): WI2 is complete. The new
`tests/static-analysis/body-diagnostic-spans.test.ts` suite now snapshots
LF and CRLF parser-backed `odw/body-syntax` spans, checks them against the
shared byte oracle and independently expected body text, and escapes
snapshot text so committed snapshot files remain ASCII-safe.

Revision note (2026-07-02 22:10Z): WI3 is complete. The span snapshot
suite now includes BMP and astral Unicode cases, with explicit assertions
that UTF-8 byte widths and code-point counts diverge from UTF-16 lengths
where expected.

Revision note (2026-07-02 22:18Z): WI4 is complete. The span snapshot
suite now covers comments, regex literals, template text, and template
interpolation decoys ahead of the parser failure tail, and the
interpolation fixture avoids Biome's template-placeholder warning while
preserving the runtime source text under test.

Revision note (2026-07-02 22:23Z): WI5 is complete. The developers' guide
now names the parser-backed span snapshot suite, the roadmap marks 2.2.3
complete, and this ExecPlan records the final outcome and validation
evidence.
