# Narrow body-syntax spans when parser offsets are structured

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`,
`Surprises & Discoveries`, `Decision Log`, and
`Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint` statically checks Open Dynamic Workflows (ODW) source without ever
executing it. When the normalized workflow body cannot be parsed, the SWC
parser adapter `parseWorkflowBody`
(`src/static-analysis/workflow-body-parser.ts`) emits a single
`odw/body-syntax` diagnostic. Today that diagnostic's `span` is the **whole**
original-source body span (`envelope.bodySpan`): the catch handler discards the
thrown parser error entirely (`} catch {`) and points the reader at every line
of the body rather than the offending token.

Roadmap task 2.2.6 (`docs/roadmap.md` lines 581-589) requires the
implementation to **narrow** that span to the failing token *when the parser
exposes structured byte offsets*, "without parsing rendered diagnostic prose",
and to prove this "without weakening the fallback for parsers that expose no
offset". The verbatim success line reads: "parser-backed syntax diagnostics
still use original-source spans, and a structured-offset fixture proves the
span narrows to the failure token without weakening the fallback for parsers
that expose no offset."

What a reader gains after this change: when a structured (machine-readable)
byte range for the failure is available, an `odw/body-syntax` diagnostic points
at the offending token in the original source instead of the whole body; when
no structured offset is available (the current reality of the locked
`@swc/core@1.15.43` error channel), the diagnostic keeps its whole-body
original-source span exactly as it does today. The narrowing reuses the
already-proven normalized-to-original span mapper
`originalSpanFromNormalizedOffsets`
(`src/static-analysis/workflow-body-normalizer.ts`), so every emitted span
still points into original source.

Observable proof (see `Validation and acceptance`):

1. A new characterization test proves the locked `@swc/core@1.15.43`
   `parseSync` throws an `Error` whose only failure detail is a prose
   `message` string and which exposes **no** structured numeric byte offset.
   This pins the load-bearing fact that today's SWC error channel yields no
   offset, and turns a silent SWC upgrade that changes this into a test
   failure.
2. A new pure helper `narrowBodySyntaxSpan` maps a structured
   normalized-source byte range back to a **narrowed** original-source span
   whose sliced text equals the offending token, and falls back to the
   whole-body span when the range is absent, reversed, or touches injected
   wrapper text.
3. `parseWorkflowBody` uses the narrowed span when a structured range is
   resolvable from the parser error and the whole-body span otherwise. The
   existing whole-body snapshots for the real SWC syntax-error fixtures remain
   byte-for-byte unchanged, proving the fallback is not weakened.

## Scope boundary with adjacent tasks (read this first)

This is the most important design decision in the plan.

- **2.2.6 owns** the structured-offset narrowing seam for `odw/body-syntax`
  and its fallback. It changes the *span value* of a body-syntax diagnostic
  only when a structured offset is available; it does **not** change the
  `Diagnostic` object shape (`docs/technical-design.md` section 8, which states
  that "changing the diagnostic object shape requires schema-version review").
- **2.2.6 must not** parse rendered diagnostic prose (`error.message`) to
  recover offsets. The roadmap wording forbids it and prose is unstable across
  SWC versions and locales.
- **2.2.6 must not** touch metadata, envelope, dual-compat, or any rule other
  than `odw/body-syntax`. It must not add or change any public message
  template (that is task 2.2.5) and must not add AST-fact collection (task
  2.2.4).
- **2.2.6 requires 2.2.3** (`docs/roadmap.md` line 582), which is COMPLETE: the
  span-mapping invariant of `docs/technical-design.md` section 11.5 (every
  diagnostic span points into original source) is already proven for
  parser-backed diagnostics, and `originalSpanFromNormalizedOffsets` is already
  exported and covered by `tests/static-analysis/workflow-body-parser.test.ts`
  ("maps a real SWC body node span back to original source").

## Constraints

- The static-analysis boundary is a security boundary
  (`docs/adr/0001-static-analysis-boundary.md`,
  `docs/technical-design.md` section 12.1). Production code must not execute,
  import, or evaluate workflow source, and must not import
  `loadWorkflowScript`, `createPrimitives`, `validate(source)`, or any ODW
  runtime module. This task only builds strings, spans, and diagnostics.
- Every emitted diagnostic `span` must point into **original** source, not
  normalized source (`docs/technical-design.md` sections 8 and 11.5). `offset`
  is a zero-based UTF-8 byte offset into the original file (section 8).
- Do not change the `Diagnostic` object shape (`docs/technical-design.md`
  section 8). `odw/body-syntax` stays a single diagnostic with the fields it
  has today (`file`, `rule`, `severity`, `message`, `span`, `docs`).
- Do not recover offsets by parsing `error.message` or any rendered diagnostic
  text (roadmap 2.2.6, `docs/roadmap.md` line 585).
- Do not add a new external dependency. `@swc/core` remains the only parser
  dependency (`docs/technical-design.md` section 13, `package.json`).
- Keep `parseWorkflowBody` total: it must never throw for any body, valid or
  malformed. This is the 2.2.1 contract already pinned by
  `tests/static-analysis/workflow-body-parser.test.ts` ("never throws for
  generated bodies in the 2.2.1 contract"). Narrowing must be wrapped so a
  span-mapping failure degrades to the whole-body span rather than escaping.
- en-GB Oxford spelling ("-ize"/"-yse"/"-our") in all prose, comments, and
  commit messages (`AGENTS.md`, `docs/documentation-style-guide.md`).
- No single code file exceeds 400 lines (`AGENTS.md`). If
  `workflow-body-normalizer.ts` would exceed this, split the narrowing helper
  into a sibling module.

## Tolerances (exception triggers)

- Scope: if implementation requires changing more than 6 files or more than
  ~250 net lines of code, stop and escalate.
- Interface: if narrowing forces a change to the public `Diagnostic` shape or
  to the signature of `parseWorkflowBody` observable to package consumers,
  stop and escalate.
- Dependencies: if narrowing appears to require a new dependency or a SWC
  version bump, stop and escalate.
- Discovery: if the Work Item 1 characterization test reveals that
  `@swc/core@1.15.43` **does** expose a structured, base-resolvable byte offset
  on parse errors (contradicting the Decision Log entry below), stop and
  escalate before wiring, because the real-SWC narrowing path and its snapshots
  then become live and must be re-planned.
- Iterations: if the focused tests still fail after 3 attempts on any Work
  Item, stop and escalate.
- Ambiguity: if "the failing token" is ambiguous for a given structured offset
  (for example a bare caret point with no token end), stop and escalate rather
  than guessing a token boundary by re-lexing.

## Risks

- Risk: the locked `@swc/core@1.15.43` `parseSync` error surface could not be
  empirically verified in the planning session (network egress and
  `bun install` were both blocked; see `Surprises & Discoveries`).
  Severity: medium. Likelihood: low that the pinned conclusion is wrong.
  Mitigation: Work Item 1 is a characterization test that the implementer runs
  with `node_modules` present; it pins the real behaviour and gates the rest of
  the plan. The Tolerances "Discovery" trigger handles the contradicting case.
- Risk: a future SWC upgrade changes the error surface (adds or removes an
  offset field), silently altering spans.
  Severity: medium. Likelihood: low.
  Mitigation: the Work Item 1 characterization test asserts the current
  surface, so any change fails the suite and forces a conscious update.
- Risk: a structured offset could map into injected wrapper text
  (`async function __odwLintWorkflowBody__() {` / `\n}`) and produce a
  misleading or out-of-range span.
  Severity: medium. Likelihood: medium if the extractor is ever wired to a real
  parser.
  Mitigation: `originalSpanFromNormalizedOffsets` already throws
  `SourceOffsetError` for wrapper-touching or reversed ranges
  (`src/static-analysis/workflow-body-normalizer.ts`); `narrowBodySyntaxSpan`
  catches it and falls back to the whole-body span, and a unit test pins that
  fallback.
- Risk: narrowing changes an existing snapshot unexpectedly.
  Severity: low. Likelihood: low.
  Mitigation: for the real SWC fixtures the extractor returns no offset, so the
  whole-body snapshots must remain unchanged; the plan treats any change to
  those snapshots as a regression, not a re-record.

## Progress

- [x] (2026-07-03) Work Item 1: characterize and pin the SWC parse-error
      surface. Added `tests/static-analysis/swc-parse-error-surface.test.ts`;
      `bun test tests/static-analysis/swc-parse-error-surface.test.ts` and the
      scrutineer-run `make all` pass. CodeRabbit completed with one low
      portability concern against this ExecPlan, addressed by replacing the
      host-specific worktree path with generic assigned-worktree wording. A
      follow-up CodeRabbit pass suggested a snapshot-style error-surface
      assertion, which was added; repeated absolute-path feedback was stale and
      the requested `-ise` spelling was rejected because AGENTS.md requires
      Oxford-style `-ize`. A later CodeRabbit pass requested the pinned
      `@swc/core@1.15.43` version in the test file documentation, which was
      added. The final allowed CodeRabbit retry flagged duplicate offset-field
      scanning in the test helper; `hasStructuredParserOffset` now derives from
      the captured surface summary.
- [x] (2026-07-03) Work Item 2: add the pure `narrowBodySyntaxSpan` helper
      (red-green-refactor). Red evidence:
      `bun test tests/static-analysis/body-syntax-span-narrowing.test.ts`
      failed because `narrowBodySyntaxSpan` was not exported. Green evidence:
      the focused helper and public export-surface tests pass, the
      scrutineer-run `make all` passes, and CodeRabbit returned zero findings
      after replacing the duplicated ASCII token fixture with a unique
      multibyte `café` substring.
- [x] (2026-07-03) Work Item 3: resolve a structured range from the parser
      error and wire narrowing into `parseWorkflowBody`; prove the fallback
      holds. Red evidence:
      `bun test tests/static-analysis/workflow-body-parser.test.ts` failed
      because `narrowedSpanForParserError` was not exported. Green evidence:
      the focused parser suite passes with unchanged snapshots, the
      scrutineer-run `make all` passes, and CodeRabbit returned zero findings
      after the mandated rate-limit wait and retry.
- [x] (2026-07-03) Work Item 4: document the narrowing contract and tick the
      roadmap. Updated `docs/rules/body-syntax.md`,
      `docs/technical-design.md`, and `docs/roadmap.md`; formatted only the
      touched Markdown paths; and validated the documentation with
      `make markdownlint`, `make nixie`, and the final `make all` gate.

## Surprises & discoveries

- Observation: the SWC parse-error object surface could not be inspected
  empirically during planning.
  Evidence: `bun install` and all network tools (`firecrawl_*`, `WebFetch`)
  required interactive approval and were denied in this non-interactive
  session; `node_modules` is absent in the worktree, so `parseSync` could not
  be invoked. Filesystem search is sandboxed to the worktree, so no sibling
  `@swc/core` checkout was reachable.
  Impact: the load-bearing claim (SWC's parse error exposes no structured byte
  offset today) is pinned by the Work Item 1 characterization test rather than
  by a planning-time transcript. The plan is written to be correct whichever
  way that test lands, with the Tolerances "Discovery" trigger covering the
  contradicting outcome.
- Observation: the narrowing mechanism already exists and is proven.
  Evidence: `originalSpanFromNormalizedOffsets`
  (`src/static-analysis/workflow-body-normalizer.ts`) maps normalized byte
  ranges back to validated original-source spans and rejects wrapper-touching
  or reversed ranges with `SourceOffsetError`;
  `tests/static-analysis/workflow-body-parser.test.ts` ("maps a real SWC body
  node span back to original source") shows SWC AST nodes expose
  `{ span: { start, end } }` byte offsets in a module-global coordinate space
  whose base is `program.span.start`.
  Impact: Work Item 2 reuses this mapper rather than inventing a new mapping,
  and the "structured-offset fixture" can supply a real normalized byte range.
- Observation: Work Item 1 confirmed the current `@swc/core@1.15.43`
  parse-error surface exposes rendered prose but no allow-listed structured
  numeric byte offset.
  Evidence: `bun test tests/static-analysis/swc-parse-error-surface.test.ts`
  passes and asserts the thrown value is an `Error`, has a non-empty `message`,
  and lacks finite numeric `span`, `byteOffset`, `pos`, `start`, or `offset`
  fields.
  Impact: the Work Item 3 real-SWC path remains a no-offset fallback path; the
  structured-offset narrowing path must be exercised with synthetic structured
  data rather than by parsing SWC prose.
- Observation: the scanner's `bodySpan` slice, not the raw body snippet passed
  to a test helper, is the source of truth for normalized body offsets.
  Evidence: the first Work Item 2 green attempt mapped a synthetic `"marker"`
  range to `" marke"` until the test computed byte offsets from
  `sliceSourceSpan(envelope.sourceFile, envelope.bodySpan)`.
  Impact: the structured-offset fixture now mirrors production normalization
  by deriving its byte range from the exact scanned body span text.
- Observation: CodeRabbit rate-limited the first Work Item 3 review attempt.
  Evidence: scrutineer reported two rate-limited `coderabbit review --agent`
  attempts with service guidance to wait six minutes; the workflow-mandated
  random `vsleep` window selected 85 minutes. The subsequent CodeRabbit retry
  completed with zero findings.
  Impact: no parser wiring review issue remained open, but the Work Item 3
  review took a delayed retry rather than a single pass.

## Decision log

- Decision: treat "the locked `@swc/core@1.15.43` `parseSync` error exposes no
  structured, base-resolvable byte offset" as the working truth, pinned by a
  characterization test, and build the narrowing as a parser-agnostic seam that
  activates only when a structured range is resolvable.
  Rationale: `@swc/core` formats the Rust parser diagnostic to a rendered caret
  string before it crosses the N-API boundary, so the thrown JavaScript `Error`
  carries prose in `message` and no structured span; unlike an AST node, a
  thrown error also has no accompanying `program.span.start` base, so even a
  raw offset would not be convertible to normalized coordinates. The roadmap
  wording ("once it exposes stable syntax-error byte offsets", "without parsing
  rendered diagnostic prose", "the fallback for parsers that expose no offset")
  frames the offset as conditional and expects a fallback, which matches this
  reality. Escalate via the Tolerances "Discovery" trigger if Work Item 1
  contradicts this.
  Date/Author: 2026-07-03, planning agent.
- Decision: the narrowing seam consumes a structured normalized-source byte
  **range** `{ start, end }`, not a single caret offset.
  Rationale: the proven mapper `originalSpanFromNormalizedOffsets` takes a
  start and an end and is what already round-trips a real SWC node span to the
  token text "marker". Narrowing to a full token span (rather than a zero-width
  caret) is what the success line means by "the failure token", and it reuses
  the proven path verbatim. Synthesizing a token end by re-lexing a broken body
  is out of scope and would hit the Tolerances "Ambiguity" trigger.
  Date/Author: 2026-07-03, planning agent.
- Decision: prove end-to-end narrowing at the helper-composition level (unit
  tests over `narrowBodySyntaxSpan` and the range extractor) plus an
  integration test that pins the real-SWC fallback, rather than forcing SWC to
  throw a structured error it does not produce.
  Rationale: honest evidence. The production mapping path is exercised with a
  real normalized range and real source text; the `parseWorkflowBody` wiring is
  proven to use the fallback for real SWC and to compose the extractor with the
  narrower. This satisfies the success line without a fake parser masquerading
  as SWC in an end-to-end assertion.
  Date/Author: 2026-07-03, planning agent.
- Decision: remove the host-specific absolute worktree path from the ExecPlan's
  generic run instructions while keeping the automated-workflow standing rule
  authoritative for this execution.
  Rationale: CodeRabbit correctly flagged the embedded checkout path as
  non-portable plan text. The workflow prompt already pins this run to the
  assigned git-donkey worktree, so the ExecPlan can say "assigned worktree
  root" without weakening this execution's isolation rule.
  Date/Author: 2026-07-03, implementation agent.
- Decision: keep Oxford-style `-ize` spellings such as "characterization" and
  "normalized" in this ExecPlan and test prose.
  Rationale: CodeRabbit requested `-ise` spellings, but AGENTS.md and
  `docs/documentation-style-guide.md` explicitly require en-GB Oxford spelling
  with `-ize` / `-yse` / `-our` conventions, except where external API names
  require otherwise.
  Date/Author: 2026-07-03, implementation agent.
- Decision: expose `NormalizedByteRange` and `narrowBodySyntaxSpan` through
  the package entry and update the reviewed public export-surface fixture.
  Rationale: the ExecPlan makes the narrowing helper a reusable parser-backed
  span contract, and consumer-style tests import static-analysis helpers from
  `odw-lint`. The export-surface guard correctly forced the public facade to be
  reviewed explicitly.
  Date/Author: 2026-07-03, implementation agent.
- Decision: split structured parser-range validation into guard clauses plus
  `isReversedRange`.
  Rationale: Oxlint flagged the first implementation's compound conditional as
  too complex. Named guard clauses keep the extractor readable and make invalid
  range rejection explicit.
  Date/Author: 2026-07-03, implementation agent.

## Outcomes & retrospective

Roadmap task 2.2.6 is complete. The delivered parser adapter preserves
original-source spans, narrows from structured normalized parser-error ranges
through the existing mapper, and keeps the whole-body fallback for the current
real SWC error surface. The structured-offset fixture proves token narrowing
with a multibyte substring, and the unchanged body-syntax snapshots prove the
fallback remains intact for parsers that expose no offset.

The main lesson was that the scanned `bodySpan` slice is the only reliable
source for synthetic normalized ranges in tests; hand-built body snippets can
be one byte out of step with the production scanner.

## Addenda

- [ ] 2.2.6.1. Guard parser-error offset coordinate bases.
  - Source: review:2.2.6; severity medium.
  - Scope: reject or normalize future parser-error offsets unless their
    coordinate base is explicit, including scalar caret offsets that require a
    resolvable base and token-end synthesis.
  - Success: structured parser-error tests cover body-relative, module-global,
    wrapper-touching, and scalar-offset inputs without silently narrowing from
    the wrong coordinate base.
- [ ] 2.2.6.2. Reconcile the span-narrowing public surface.
  - Source: audit:2.2.6; severity medium.
  - Scope: document that the current pinned SWC parser keeps narrowing inert,
    trim speculative exports that no production consumer can exercise, and
    align characterization coverage with the production parser path.
  - Success: public exports and characterization tests reflect the active
    parser-backed span contract rather than a future parser channel.
- [ ] 2.2.6.3. Consolidate parser-range type guards.
  - Source: audit:2.2.5; severity medium.
  - Scope: move duplicated low-level object-record and finite-number guards
    from parser-range production code and tests into one reviewed
    static-analysis helper.
  - Success: parser offset extraction, source-position parsing, and tests use
    the shared helper without broadening accepted parser-error shapes.

## Context and orientation

`odw-lint` is a Bun/TypeScript package. Relevant files:

- `src/static-analysis/workflow-body-parser.ts` — the SWC adapter.
  `parseWorkflowBody(envelope)` normalizes the body, calls
  `parseSync(normalized.normalizedText, { syntax: "ecmascript", jsx: false })`,
  and on success returns `{ ok: true }`. On failure the `} catch {` block
  currently **discards** the error and returns
  `{ ok: false, diagnostic: bodySyntaxDiagnostic(envelope) }` where
  `bodySyntaxDiagnostic` sets `span: envelope.bodySpan` (the whole body).
- `src/static-analysis/workflow-body-normalizer.ts` — `normalizeWorkflowBody`
  wraps the body in `async function __odwLintWorkflowBody__() { … \n}` and
  records `prefixByteLength`, `bodyByteOffset`, and `bodyByteLength`.
  `originalSpanFromNormalizedOffsets(sourceFile, normalized, startByte,
  endByte)` subtracts `prefixByteLength`, rejects wrapper-touching or reversed
  ranges with `SourceOffsetError`, and returns a validated original-source
  `SourceSpan` via `spanFromOffsets`.
- `src/static-analysis/source-position.ts` — `spanFromOffsets` /
  `positionAtOffset`, which throw `SourceOffsetError` for invalid offsets.
- `src/static-analysis/source-snippet.ts` — `sliceSourceSpan(file, span)`
  returns the exact original text a span covers (used by tests to assert token
  text).
- `src/static-analysis/types.ts` — `WorkflowEnvelope` (has `bodySpan`),
  `OriginalSourceFile`, `SourceOffsetError`.
- `src/index.ts` and `src/static-analysis/index.ts` — the package export
  surface. `normalizeWorkflowBody`, `originalSpanFromNormalizedOffsets`,
  `parseWorkflowBody`, `sliceSourceSpan`, `spanFromOffsets`,
  `createOriginalSourceFile`, and `scanWorkflowEnvelope` are already exported.

Tests and fixtures:

- `tests/static-analysis/workflow-body-parser.test.ts` — adapter tests,
  including "maps a real SWC body node span back to original source" (the
  proven narrowing mechanism) and the 2.2.1 "never throws" property test.
- `tests/static-analysis/__snapshots__/workflow-body-parser.test.ts.snap` —
  whole-body span snapshots for the two syntax-error fixtures.
- `tests/static-analysis/body-diagnostic-spans.test.ts` and its snapshot — the
  2.2.3 lexical span matrix (LF, CRLF, Unicode, comments, regex, template).
- `tests/static-analysis/fixtures/invalid-workflows/syntax-error/` —
  `body-unclosed-call.js` (ends with `await agent("draft"`) and
  `body-unclosed-block.js` (ends with an unclosed `if (args.ready) {`).

Terms of art:

- *Normalized source*: the wrapped, SWC-parseable string produced by
  `normalizeWorkflowBody`. Byte offsets into it are "normalized offsets".
- *Original source*: the untouched workflow file. Diagnostic spans must point
  here.
- *Structured offset*: a machine-readable numeric byte offset or range on the
  parser error object, as opposed to text scraped from a rendered message.

## Plan of work

Four ordered, independently committable Work Items. Each ends with `make all`
(and, for Markdown, `make markdownlint` and `make nixie`).

### Work Item 1 — Characterize and pin the SWC parse-error surface

Goal: turn the load-bearing assumption into a pinned, test-guarded fact.

Docs to read: `docs/technical-design.md` sections 12.1-12.2 (failure modes,
"Catch parser exceptions and emit `odw/body-syntax`"), section 8 (diagnostic
contract), roadmap 2.2.6 (`docs/roadmap.md` lines 581-589),
`docs/adr/0001-static-analysis-boundary.md`. Skills to load: `leta` for symbol
navigation; consult the code-style testing rules in `AGENTS.md`.

Add `tests/static-analysis/swc-parse-error-surface.test.ts`. It builds a
normalized broken body (reuse `normalizeWorkflowBody` on a scanned envelope for
`await agent("draft"\n`), calls `parseSync` with the adapter's parse options
inside a `try`/`catch`, and asserts on the caught value:

1. it is an `instanceof Error`;
2. its `message` is a non-empty string (rendered prose);
3. it exposes **no** structured numeric byte offset: probe a documented
   allow-list of candidate fields the adapter would ever read — for example
   `error.span`, `error.byteOffset`, `error.pos`, `error.start`, `error.offset`
   — and assert none is a finite number (nor a `{ start, end }` numeric pair).

This is a characterization/pinning test (per the execplans skill's allowance
for a golden/characterization substitute when strict Red-Green does not apply):
it passes immediately and its value is regression protection. It justifies the
fallback branch built in Work Item 3.

Tests added: one unit/characterization test file. Validation: `make all`.

If assertion 3 fails (SWC does expose a structured offset), stop and escalate
per the Tolerances "Discovery" trigger.

### Work Item 2 — Add the pure `narrowBodySyntaxSpan` helper

Goal: a pure, well-tested function that narrows to a token span when given a
structured normalized range and falls back to the whole-body span otherwise.
Reuses `originalSpanFromNormalizedOffsets`.

Docs to read: `docs/technical-design.md` sections 6.1 (span mapper) and 11.5
(span-mapping invariant);
`docs/complexity-antipatterns-and-refactoring-strategies.md` (small pure
functions, predicate extraction). Skills to load: `leta`; the `fast-check`
property-testing guidance in `AGENTS.md` (Invariant testing).

Red: add `tests/static-analysis/body-syntax-span-narrowing.test.ts` that fails
before the helper exists:

1. Table case: build an in-memory workflow whose body contains an identifiable
   token (for example `const marker = 42;\nreturn marker;\n`), normalize it,
   compute the **real** normalized byte range covering `marker` (prefix byte
   length plus the body-relative byte offsets of the token), call
   `narrowBodySyntaxSpan(sourceFile, normalized, bodySpan, range)`, and assert
   `sliceSourceSpan(sourceFile, result)` equals `"marker"` and that the result
   is strictly inside `bodySpan` (narrowed, not the whole body).
2. Fallback case: pass `undefined` as the range and assert the result is
   exactly `bodySpan`.
3. Fallback case: pass a range that touches the wrapper (for example
   `{ start: 0, end: 4 }`, inside the prefix) or a reversed range, and assert
   the result is exactly `bodySpan` and that the call does not throw.
4. Property (`fast-check`): for any range wholly inside the body, the narrowed
   span is within `bodySpan` and non-reversed
   (`start.offset <= end.offset`).

Green: implement `narrowBodySyntaxSpan(sourceFile, normalized, bodySpan,
range?: { readonly start: number; readonly end: number })` next to the mapper.
If it keeps `workflow-body-normalizer.ts` under 400 lines, add it there and
export it from `src/static-analysis/index.ts` and `src/index.ts`; otherwise put
it in a new `src/static-analysis/workflow-body-span.ts`. Behaviour: if `range`
is `undefined`, return `bodySpan`; otherwise `try` to return
`originalSpanFromNormalizedOffsets(sourceFile, normalized, range.start,
range.end)` and, on `SourceOffsetError`, return `bodySpan`.

Refactor: extract a small predicate if branching grows; keep the JSDoc `@file`
and per-function docs. Rerun the focused test then `make all`.

Tests added/updated: one new unit + property test file; new export.

### Work Item 3 — Resolve a structured range and wire narrowing into the adapter

Goal: `parseWorkflowBody` narrows the body-syntax span when a structured range
is resolvable from the parser error, and keeps the whole-body span (unchanged
snapshots) otherwise.

Docs to read: `docs/technical-design.md` sections 6.1, 8, 11.5, 12.2; roadmap
2.2.6. Skills to load: `leta`; `AGENTS.md` error-handling rules (convert
unknown thrown values to project-owned shapes at the boundary; discriminated
unions).

Red: extend `tests/static-analysis/workflow-body-parser.test.ts` (and, if
needed, the narrowing test file) with:

1. Fallback proof: for both real syntax-error fixtures, assert
   `diagnostic.span` still equals `envelope.bodySpan` and that the existing
   whole-body snapshots are unchanged. (These assertions already exist for the
   span-equality case; keep them green.)
2. Extractor unit: `structuredNormalizedRangeFromParserError(error)` returns
   `undefined` for the real caught SWC error (composing with Work Item 1's
   finding) and returns `{ start, end }` for a synthetic error-like object that
   carries the allow-listed structured field(s). It must never read
   `error.message`.
3. Narrowing composition: given the synthetic structured error plus a real
   normalized body, the composed `narrowedSpanForParserError(sourceFile,
   normalized, bodySpan, error)` returns a narrowed span whose sliced text is
   the intended token; given the real SWC error it returns `bodySpan`.

Green: add `structuredNormalizedRangeFromParserError(error: unknown):
{ readonly start: number; readonly end: number } | undefined` that reads only
the documented allow-list of structured numeric fields (never prose) and
returns `undefined` when none is present or when a base offset needed to
normalize the coordinate is unavailable (the SWC-today case). Change
`bodySyntaxDiagnostic` to accept the resolved span, and change the
`parseWorkflowBody` catch handler from `} catch {` to `} catch (error) {`,
computing `span = narrowedSpanForParserError(...)` before building the
diagnostic. Keep `parseWorkflowBody` total: the whole catch body must not
throw (narrowing already degrades to `bodySpan`).

Refactor: keep `workflow-body-parser.ts` under 400 lines; move the extractor to
its own module if needed. Rerun focused tests, then `make all`. Confirm the
2.2.1 "never throws" property test and the 2.2.3 lexical matrix still pass and
that the whole-body snapshots are byte-for-byte unchanged.

Tests added/updated: adapter test additions; extractor and composition units.

### Work Item 4 — Document the narrowing contract and tick the roadmap

Goal: keep `docs/` the source of truth and record completion.

Docs to read: `docs/documentation-style-guide.md`, `docs/scripting-standards.md`
(Markdown/prose conventions), `AGENTS.md` (documentation maintenance). Skills to
load: `en-gb-oxendict`.

Edits:

1. `docs/rules/body-syntax.md` — add a short paragraph: the diagnostic span
   narrows to the offending token when the parser exposes a structured byte
   offset, and otherwise spans the whole normalized body; spans always point
   into original source.
2. `docs/technical-design.md` section 6.1 or 11.5 — one sentence noting the
   span mapper now also narrows body-syntax diagnostics from a structured
   parser-error range, with the no-offset fallback.
3. `docs/roadmap.md` — tick `- [ ] 2.2.6` to `- [x] 2.2.6` and, if the audit
   convention is used elsewhere, add a one-line addendum pointing at this
   ExecPlan.

Format only the files touched, then gate:

```bash
bunx mdtablefix docs/rules/body-syntax.md docs/technical-design.md docs/roadmap.md docs/execplans/roadmap-2-2-6.md
bunx markdownlint-cli2 --fix docs/rules/body-syntax.md docs/technical-design.md docs/roadmap.md docs/execplans/roadmap-2-2-6.md
make markdownlint
make nixie
```

All four Markdown paths exist at this point (three are edited here; the
ExecPlan is this file), so the formatter list is path-safe.

## Concrete steps

Run everything from the assigned worktree root. Confirm the branch is
`roadmap-2-2-6` (`git branch --show-current`). Ensure dependencies are present
once (`make build`, which runs `bun install`).

Per Work Item, follow Red-Green-Refactor and commit after each item once
`make all` is green (the standing rule: commit after each change, gate each
commit). Use `commit-message` conventions and en-GB Oxford spelling.

Focused test runs during development:

```bash
bun test tests/static-analysis/swc-parse-error-surface.test.ts
bun test tests/static-analysis/body-syntax-span-narrowing.test.ts
bun test tests/static-analysis/workflow-body-parser.test.ts
```

Expected: the red test in Work Item 2 fails before `narrowBodySyntaxSpan`
exists (referenced symbol undefined / import error) and passes after the green
step; the Work Item 1 characterization test passes on first run and pins the
surface; the whole-body snapshots in
`tests/static-analysis/__snapshots__/workflow-body-parser.test.ts.snap` remain
unchanged after Work Item 3.

## Validation and acceptance

Per-item gate for code changes:

```bash
make all
```

`make all` runs `build check-fmt whitespace-hygiene lint typecheck test`
(`Makefile`), which includes Biome formatting/lint, Oxlint, `tsc --noEmit`, and
the Bun test suite. Expect all green.

For the Markdown-only Work Item 4:

```bash
make markdownlint
make nixie
```

Acceptance (behaviour a human can verify), mapping to the verbatim success
line:

1. Original-source spans preserved: for both syntax-error fixtures,
   `sliceSourceSpan(file, diagnostic.span)` equals the sliced whole body and
   the snapshots are unchanged — the no-offset fallback still points into
   original source.
2. A structured-offset fixture narrows to the failure token: in
   `tests/static-analysis/body-syntax-span-narrowing.test.ts`, a real
   normalized byte range fed through `narrowBodySyntaxSpan` yields a span whose
   `sliceSourceSpan` text equals the offending token and is strictly inside the
   body span.
3. Fallback not weakened: `structuredNormalizedRangeFromParserError` returns
   `undefined` for the real SWC error (pinned by Work Item 1), so
   `parseWorkflowBody` emits the whole-body span for real SWC failures, proven
   by the unchanged snapshots and the retained span-equality assertions.

Red-Green-Refactor evidence to record in `Progress`/`Artifacts` as work
proceeds: the Work Item 2 red command and its failure reason, the green pass,
and the post-refactor `make all` pass.

Quality criteria ("done"):

- Tests: `make test` passes; the new narrowing and characterization tests pass;
  the 2.2.1 "never throws" property test and 2.2.3 lexical matrix still pass;
  whole-body snapshots unchanged.
- Lint/typecheck: `make lint` and `make typecheck` pass (`make all` covers
  both).
- Docs: `make markdownlint` and `make nixie` pass for the Markdown changes.

## Idempotence and recovery

Each Work Item is a separate commit; re-running `make all` is safe and
repeatable. If a snapshot changes unexpectedly in Work Item 3, do **not** run
`--update-snapshots`: a changed whole-body snapshot signals a regression in the
fallback, so investigate the extractor rather than re-recording. If the Work
Item 2 red test cannot be made to fail first (for example because the symbol is
stubbed), delete the stub and re-establish the red state before implementing.

## Interfaces and dependencies

No new dependencies. New/changed symbols at the end of the task:

In `src/static-analysis/workflow-body-normalizer.ts` (or a new
`src/static-analysis/workflow-body-span.ts`), exported through
`src/static-analysis/index.ts` and `src/index.ts`:

```ts
export const narrowBodySyntaxSpan = (
  sourceFile: OriginalSourceFile,
  normalized: NormalizedWorkflowBody,
  bodySpan: SourceSpan,
  range?: { readonly start: number; readonly end: number },
): SourceSpan => { /* map or fall back to bodySpan */ };
```

In `src/static-analysis/workflow-body-parser.ts` (or a small sibling module):

```ts
const structuredNormalizedRangeFromParserError = (
  error: unknown,
): { readonly start: number; readonly end: number } | undefined => {
  /* read allow-listed structured numeric fields only; never error.message */
};
```

`parseWorkflowBody` keeps its public signature and its
`WorkflowBodyParseResult` discriminated-union return; only the diagnostic
`span` value changes, and only when a structured range is resolvable.

## Revision note

Initial draft (2026-07-03). First planning round; no prior design-review points
to address. Load-bearing SWC error-surface behaviour could not be verified
empirically in the planning session (network and `bun install` blocked); it is
pinned instead by the Work Item 1 characterization test, with a Tolerances
"Discovery" escalation if the pinned conclusion is contradicted at
implementation time.
