# Normalize workflow bodies for top-level `return` and `await`

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`,
`Surprises & Discoveries`, `Decision Log`, and
`Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint` statically checks Open Dynamic Workflows (ODW) source without
executing it. Task 2.2.1 added the standalone SWC parser adapter
`parseWorkflowBody`, which parses the *raw* workflow body slice. That raw
parse cannot accept the body shapes ODW workflows actually use: a valid ODW
body runs as the inside of an async function, so it may contain a top-level
`return` statement (for example
`tests/static-analysis/fixtures/odw-examples/adversarial-verify.js:60`,
`return { confirmed, considered: findings.length }`) and top-level `await`
expressions (for example `routing.js:64`,
`const classification = await agent(`). A plain parse of
`return { ... }` throws "return outside of function", so today
`parseWorkflowBody` would report a false `odw/body-syntax` diagnostic for a
perfectly valid ODW example.

Roadmap task 2.2.2 (`docs/roadmap.md` lines 551-556) closes that gap by
adding the two static-analysis components the design already names:
a **body normalizer** that produces SWC-parseable source by wrapping the
body the same way ODW does — inside an async function — and a **span
mapper** that maps offsets in the normalized source back to original-source
byte offsets. After this change a novice can call `parseWorkflowBody` on any
of the nine trusted ODW example fixtures and observe `{ ok: true }` (no
false syntax diagnostic), and can map a normalized-source AST node span back
to the exact original text it came from.

Roadmap success line (verbatim): "ODW examples containing top-level
`return` and `await` parse with original-source span mapping."

Observable proof:

1. A new focused test proves a body whose only top-level statement is
   `return { done: true };` returns `{ ok: true }` — it returns
   `{ ok: false, diagnostic: odw/body-syntax }` before this change (Red) and
   `{ ok: true }` after (Green).
2. A new test parses each of the nine ODW example fixtures'
   bodies through `parseWorkflowBody` and asserts every one returns
   `{ ok: true }`.
3. A new span-mapping test parses a normalized body with SWC, takes a real
   AST node byte span, maps it through the span mapper, and asserts the
   mapped original span slices back to the exact original identifier text —
   the `docs/technical-design.md` section 11.5 "span points into original
   source" invariant for normalized-body AST nodes.

Roadmap reference: `docs/roadmap.md` task 2.2.2 (lines 551-556). Requires
2.2.1 (complete on this branch's base;
`docs/execplans/roadmap-2-2-1.md` Status COMPLETE). Design references:
`docs/technical-design.md` sections 3 (sources table, ODW loader row),
4, 5, 6.1, 6.2, 8, 11.1, 11.5, 12.1, 12.2, 13;
`docs/adr/0001-static-analysis-boundary.md`.

### Scope boundary with adjacent tasks (read this first)

This is the most important design decision in the plan. Keep 2.2.2 to
*normalization plus span mapping*, no more.

- **2.2.2 owns** the body normalizer, the span mapper, and rewiring
  `parseWorkflowBody` so it normalizes before parsing (so valid ODW example
  bodies parse and so a mapped normalized span points into original source).
- **2.2.3 owns** span snapshot assertions across LF, CRLF, Unicode,
  comments, regex literals, template text, and template interpolation for
  *parser-backed diagnostics* (`docs/roadmap.md` lines 557-562). 2.2.2 adds
  one focused span-mapping proof, not the full snapshot matrix.
- **2.2.4 owns** exposing workflow AST facts (lexical bindings, source
  masks) for rules (`docs/roadmap.md` lines 563-572). 2.2.2 must **not**
  expose the SWC `Module`/AST on `parseWorkflowBody`'s result or add binding
  facts. The span mapper takes plain numeric offsets and returns a
  `SourceSpan`; no `@swc/core` AST type leaks into the public surface.
- **2.2.6 owns** narrowing `odw/body-syntax` spans to the offending token
  once SWC exposes structured syntax-error offsets (`docs/roadmap.md`
  lines 581-589). 2.2.2 keeps 2.2.1's decision that a syntax **error**
  diagnostic reports the whole `envelope.bodySpan` (strategy S2), because
  `@swc/core` 1.15.43 exposes no structured syntax-error offset
  (`docs/execplans/roadmap-2-2-1.md` Decision Log "WI1 selected fallback
  strategy S2"). Normalization changes which bodies *parse*; it does not
  change the error-span strategy.
- **Do not wire `parseWorkflowBody` into `lintWorkflowSource`.** The full
  pipeline over valid examples is the loader-parity harness in task 2.3.1
  (`docs/roadmap.md` lines 598-603, "Requires steps 2.1-2.2"), and
  `lintWorkflowSource`'s property test in
  `tests/static-analysis/workflow-lint.test.ts` is outside this task.
  `parseWorkflowBody` stays a standalone adapter, now normalization-capable.

## Constraints

Hard invariants that must hold throughout implementation. Violation
requires escalation, not a workaround.

- **No source evaluation.** The normalizer, span mapper, and every module
  they import must remain static. They must not import or call
  `loadWorkflowScript`, `createPrimitives`, the runtime `validate`
  primitive, `new Function`, `eval`, or any ODW loader, primitive, runtime,
  scheduler, or agent-dispatch path. "Wrapping the body in an async
  function" means **building a source string** for SWC to *parse*, never
  constructing or running a function. `parseSync` only parses. Enforced by
  `tests/diagnostics/import-policy.test.ts`
  (`docs/technical-design.md` sections 5, 12.1;
  `docs/adr/0001-static-analysis-boundary.md`).
- **Static string imports only in production code.**
  `tests/diagnostics/import-policy.test.ts` fails production code that uses
  computed `import(expr)`/`require(expr)`. Keep the existing static
  `import { parseSync } from "@swc/core"` edge; add no dynamic imports.
- **Spans point into original source.** Every span the mapper returns must
  be a validated half-open original-source span built through
  `spanFromOffsets(file, startByteOffset, endByteOffset)` in
  `src/static-analysis/source-position.ts`. Never surface a span in
  normalized-source coordinates (`docs/technical-design.md` section 8 span
  invariants, section 11.5).
- **Byte-offset arithmetic only.** SWC positions are UTF-8 byte offsets
  (`BytePos`) shifted by a process-global base counter, so the span mapper
  must operate on byte offsets and its caller must subtract *this parse's*
  program-span base, never a constant (`docs/execplans/roadmap-2-2-1.md`
  Risks "SWC span positions are offset by a process-global BytePos base
  counter"). The normalizer's injected prefix is pure ASCII, so its byte
  length equals its string length; compute it with `TextEncoder` regardless.
- **Catalogue owns the rule.** The syntax-error diagnostic must keep using
  the catalogued `odw/body-syntax` rule with its exact reviewed message and
  `docs/rules/body-syntax.md` docs path
  (`src/diagnostics/rule-catalogue.ts`). Do not add, rename, or re-message
  any rule; `src/diagnostics/**` is owned by earlier tasks and unchanged.
- **Do not change the syntax-error span strategy.** A body that fails to
  parse still yields a single `odw/body-syntax` diagnostic whose `span` is
  `envelope.bodySpan` (strategy S2 from 2.2.1). The two `syntax-error`
  fixtures and their snapshots/parity must stay green with unchanged spans.
- **Public API additions are guarded.** Any symbol re-exported from
  `src/index.ts` must be added to
  `tests/diagnostics/public-api-fixtures.ts` in the same commit, and the new
  module file under `src/static-analysis/` must be added to
  `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` in
  `tests/diagnostics/architecture-fixtures.ts`
  (`tests/diagnostics/architecture.test.ts`). Do not weaken those guards.
- **No new dependency.** `@swc/core` is already a caret dependency. This
  task adds no runtime or dev dependency.
- **File size.** No source or test TypeScript file may exceed 400 physical
  lines (`AGENTS.md` "Keep file size manageable"). The new module is small;
  keep the parser and its test under the limit.
- **Prose and commits** follow en-GB Oxford spelling
  ("-ize"/"-yse"/"-our") per `AGENTS.md` and
  `docs/documentation-style-guide.md`. Every new module opens with a
  `/** @file … */` block (`AGENTS.md` docs rule).

## Tolerances (exception triggers)

- **SWC AST shape:** if the WI2 probe shows `parseSync` does not return a
  program object with a `.span.start` byte base and child nodes bearing
  `.span.start`/`.span.end` byte offsets (so the span mapper cannot be fed
  real offsets), stop and escalate — span mapping of normalized AST nodes is
  the task's core deliverable and this would be a design-level blocker, not
  a workaround target.
- **Wrapper parity:** if wrapping the body in an async function makes any of
  the two `syntax-error` fixtures *parse* (so `odw/body-syntax` would stop
  firing), stop and escalate — the wrapper must not mask genuine body syntax
  errors.
- **Scope:** if implementation requires changes to more than 10 files or
  ~400 net lines, stop and escalate.
- **Interface:** the only new public symbols are `normalizeWorkflowBody`,
  `NormalizedWorkflowBody`, and `originalSpanFromNormalizedOffsets`, plus the
  unchanged-shape `parseWorkflowBody`. If any *other* public signature must
  change (including `WorkflowBodyParseResult`), stop and escalate.
- **Dependencies:** if any new dependency appears required, stop and
  escalate.
- **Fixture drift:** if a `syntax-error` fixture's real diagnostic span
  changes, update it **only** through `make refresh-fixtures` and record the
  before/after. Do not hand-edit generated manifests. (No change is
  expected: the error span stays `envelope.bodySpan`.)
- **Iterations:** if `make all` still fails after 3 focused attempts on a
  work item, stop and escalate.

## Risks

- Risk (tooling, already observed): this planning session could not read the
  sibling ODW checkout
  (`/data/leynos/Projects/open-dynamic-workflows/src/loader.ts`,
  permission-gated), could not run `grepai`/`firecrawl` (permission-gated),
  and `node_modules/@swc` is not installed (build not run), so the exact ODW
  wrapper string and the live SWC AST shape are not quoted from source here.
  Severity: medium. Likelihood: certain.
  Mitigation: the ODW normalization contract is pinned by the in-repo design
  doc — `docs/technical-design.md` section 3 sources table (ODW loader row):
  ODW "strips only the `export` keyword, wraps the body in an async
  function, rejects other top-level imports or exports" — and section 6.1
  ("Body normalizer: Produce SWC-parseable source by stripping the `export`
  token and wrapping or replacing top-level `return`"). We match that
  contract semantically (async-function wrap makes both `return` and `await`
  legal). The live SWC AST shape is pinned by the WI2 probe **test** the
  implementer runs, exactly as 2.2.1 pinned SWC's error shape by probe.
- Risk: a crafted body could "escape" the wrapper — for example a top-level
  `}` closes the injected function early, so wrapped source parses as
  something other than a single function body.
  Severity: low (parse-only; no execution; ODW's own async-function wrapper
  has the identical property, so this is parity-correct behaviour, not a new
  hole). Likelihood: low for trusted examples.
  Mitigation: we do not claim brace-balance validation in 2.2.2; the wrapper
  matches ODW's wrapper, and every one of the nine trusted examples is
  asserted to parse. A malformed escaping body still surfaces later as a
  structural/rule finding in a future task, not here. Recorded in the
  Decision Log.
- Risk: a body ending in a line comment with no trailing newline
  (`// note` at EOF) could swallow an appended `}` if the suffix were on the
  same line.
  Severity: medium (would corrupt every such body's parse). Likelihood:
  medium.
  Mitigation: the wrapper suffix begins with a newline (`"\n}"`), so the
  closing brace is never inside a trailing line comment. A dedicated unit
  test covers a body ending in `// trailing` with no final newline.
- Risk: mishandling SWC's global `BytePos` base (subtracting a constant
  instead of this parse's `program.span.start`) silently corrupts mapped
  spans.
  Severity: high. Likelihood: medium.
  Mitigation: the span mapper takes already-0-based normalized offsets and
  its integration test derives them by subtracting the observed
  `program.span.start`; the assertion slices the mapped span back to the
  exact original text and fails loudly on any base error. The pure unit test
  derives offsets from `indexOf` into the normalized string (already
  0-based), isolating the arithmetic.
- Risk: dropping the `topLevelAwait` parse option (now that the async-fn
  wrapper makes `await` legal) changes behaviour for an await body.
  Severity: low. Likelihood: low.
  Mitigation: a test asserts a top-level-await body still returns
  `{ ok: true }` after the rewire; `await` inside an async function is legal
  regardless of the `topLevelAwait` module option.

## Progress

- [x] WI1: Add the body normalizer and span mapper module
  (`src/static-analysis/workflow-body-normalizer.ts`) with pure unit and
  property tests; export it and update the architecture/public-API guards.
- [x] WI2: Rewire `parseWorkflowBody` to normalize before parsing; add the
  top-level-`return` Red→Green test, the nine-example parse test, and the
  span-mapping integration test; confirm the `syntax-error` fixtures and
  their snapshots/parity stay green.
- [x] WI3: Document the normalizer, the span mapper, and the updated
  `parseWorkflowBody` contract (and the 2.2.4 AST-facts boundary) in the
  developers' guide.

## Surprises & discoveries

- Observation: the current adapter already parses with
  `topLevelAwait: true` (`src/static-analysis/workflow-body-parser.ts:22-26`),
  so top-level *await* already parses in 2.2.1's raw slice; only top-level
  *return* throws. 2.2.2 replaces that module-level await hack with the
  async-function wrapper, which covers both uniformly.
  Impact: the Red test that motivates 2.2.2 must use top-level *return*
  (which genuinely throws today), not top-level await.
- Observation: the design already reserves passive component labels
  `"body-normalizer"` and `"span-mapper"` in
  `STATIC_ANALYSIS_COMPONENTS` (`src/static-analysis/types.ts:155-164`) and a
  `"body"` stage in `STATIC_ANALYSIS_STAGES` (lines 174-181).
  Impact: the new module realizes existing design slots; no label change is
  needed.
- Observation: `parseWorkflowBody` has exactly two consumers today —
  `tests/static-analysis/workflow-body-parser.test.ts` and (for
  `syntax-error` fixtures) the invalid-fixture parity suite — and is
  re-exported through `src/static-analysis/index.ts` and `src/index.ts`. It
  is not wired into `lintWorkflowSource`.
  Impact: rewiring the adapter internally has a contained blast radius.
- Observation: WI1 implementation exposed two local test-boundary details.
  First, `scanWorkflowEnvelope` treats the body as the exact text after the
  metadata declaration, so tests that need exact body byte offsets must not
  silently insert separator text. Second, arbitrary byte offsets can split a
  multi-byte UTF-8 character; the normalizer property test now derives byte
  ranges from real source string boundaries, matching the mapper caller
  contract.
  Impact: the span-mapping proof still exercises non-ASCII byte arithmetic
  without asserting behaviour for invalid byte boundaries.
- Observation: the WI2 SWC probe over normalized
  `const marker = 42;\nreturn marker;\n` returned `program.span.start === 1`
  and `program.span.end === 79`; child nodes carried numeric byte spans such
  as an `Identifier` at normalized offsets `[48, 54]` and another at
  `[68, 74]` after subtracting the program base. The in-body span range was
  bounded by `prefixByteLength === 42` and `bodyByteLength === 34`.
  Impact: the parser test can subtract the observed program base and feed
  0-based normalized byte offsets into `originalSpanFromNormalizedOffsets`;
  no SWC AST type needs to become public.
- Observation: the Red parser test failed exactly on top-level `return` and
  all nine trusted ODW examples before the rewire, while the standalone
  normalizer span-mapping integration test already passed. After the rewire,
  the same parser suite passed with 24 tests, 2 snapshots, and 417
  assertions; the two `syntax-error` snapshots remained unchanged.
  Impact: WI2 demonstrates both sides of the success line: valid return/await
  examples parse, and a real SWC body node span maps back to original source.
- Observation: `docs/developers-guide.md` still described the raw-body parser
  and warned maintainers not to run `parseWorkflowBody` over top-level
  `return` bodies. WI3 replaced that stale guidance with the shipped
  normalizer/span-mapper contract and the remaining `lintWorkflowSource`
  integration boundary.
  Impact: developer documentation now matches the code committed by WI1 and
  WI2.

## Decision log

- Decision: Normalize by wrapping the body in a single-line async function
  declaration: prefix `async function __odwLintWorkflowBody__() {` and
  suffix `\n}` (leading newline on the suffix), with the original body slice
  between them verbatim.
  Rationale: matches ODW's documented normalization — wrap the body in an
  async function (`docs/technical-design.md` section 3 ODW loader row,
  section 6.1) — so both top-level `return` and top-level `await` become
  legal with one transform. A single-line ASCII prefix makes the
  prefix byte length a constant equal to its string length, keeping the span
  mapping a simple shift. The suffix's leading newline stops a trailing
  line comment from swallowing the closing brace.
  Date/Author: 2026-07-02, planning agent.
- Decision: The span mapper takes already-0-based normalized byte offsets
  (`normalizedStartByte`, `normalizedEndByte`) and returns a validated
  original `SourceSpan`; the caller subtracts this parse's
  `program.span.start` before calling it.
  Rationale: SWC's `BytePos` base varies per parse
  (`docs/execplans/roadmap-2-2-1.md` Risks), so base subtraction belongs to
  whoever holds the parsed program, not to a constant inside the mapper. A
  numeric-offset boundary also keeps the SWC AST type out of the public
  surface, preserving 2.2.4's freedom to design the AST-facts API.
  Date/Author: 2026-07-02, planning agent.
- Decision: Keep the syntax-error path on strategy S2 (report
  `envelope.bodySpan`); normalization does not change error spans.
  Rationale: `@swc/core` 1.15.43 exposes no structured syntax-error offset
  (`docs/execplans/roadmap-2-2-1.md` Decision Log). Narrowing error spans is
  task 2.2.6.
  Date/Author: 2026-07-02, planning agent.
- Decision: Accept the wrapper "escape" property (a top-level `}` can close
  the injected function early) rather than adding brace-balance validation
  in 2.2.2.
  Rationale: ODW's own async-function wrapper has the identical property, so
  matching it is parity-correct; structural validation beyond parseability
  is out of this task's success line.
  Date/Author: 2026-07-02, planning agent.
- Decision: Do not wire `parseWorkflowBody` into `lintWorkflowSource`.
  Rationale: running the parser across the full pipeline over valid examples
  is the task 2.3.1 loader-parity harness; keeping the adapter standalone
  preserves the `workflow-lint` property test and the 2.3 boundary.
  Date/Author: 2026-07-02, planning agent.
- Decision: Keep `originalSpanFromNormalizedOffsets` strict for wrapper
  ranges and reversed ranges, and document both failure modes in the public
  docblock.
  Rationale: callers should surface invalid normalized AST spans loudly
  rather than silently clamp them to original source. CodeRabbit identified
  the reversed-range case as under-documented during WI1 review.
  Date/Author: 2026-07-02, implementation agent.
- Decision: Drop `topLevelAwait` from `WORKFLOW_BODY_PARSE_OPTIONS` when
  parsing normalized bodies.
  Rationale: the body now sits inside an injected async function, so
  top-level ODW `await` is ordinary in-function `await` for SWC. Keeping the
  module-level option would obscure the real normalization contract.
  Date/Author: 2026-07-02, implementation agent.
- Decision: Keep the SWC span walker private to the parser test.
  Rationale: WI2 only needs proof that real SWC byte spans can be mapped back
  to original source. Exposing reusable AST traversal or workflow AST facts
  remains task 2.2.4.
  Date/Author: 2026-07-02, implementation agent.
- Decision: Document `parseWorkflowBody` as a standalone normalized parser,
  not as part of `lintWorkflowSource`.
  Rationale: WI2 made valid ODW bodies parse through the adapter, but the
  full loader-parity pipeline remains a later integration task. The developer
  guide should make that boundary clear so future rule work does not
  accidentally widen this task's scope.
  Date/Author: 2026-07-02, implementation agent.

## Outcomes & retrospective

Roadmap task 2.2.2 is complete. `parseWorkflowBody` now parses normalized
workflow body text, so trusted ODW examples containing top-level `return` and
`await` return `{ ok: true }` instead of false `odw/body-syntax` diagnostics.
`originalSpanFromNormalizedOffsets` maps normalized body byte offsets back to
validated original-source spans, and the parser test proves that a real SWC
body node span slices back to the original `marker` identifier. The developer
guide now documents the normalizer, mapper, unchanged syntax-error span
strategy, and the remaining 2.2.4 AST-facts boundary.

## Context and orientation

`odw-lint` is a static linter for ODW source. It must never execute workflow
source; it reads text and reasons about it. The package is private and
exposes one consumer surface, `src/index.ts`.

The static pipeline this task extends (all under
`src/static-analysis/`):

1. `createOriginalSourceFile(source)` (`source-file.ts`) builds a branded
   `OriginalSourceFile` (`types.ts:59-70`) carrying `filePath`,
   `sourceText`, `byteLength`, and line indexes. Only the factory can build
   one; span helpers rely on its private indexes.
2. `scanWorkflowEnvelope(sourceFile)` (`workflow-envelope.ts`) returns, on
   `status === "scanned"`, an `envelope` (`types.ts:86-94`) whose `bodySpan`
   is a half-open original-source span from just after the metadata
   declaration to end of file
   (`workflow-envelope.ts:159-177`).
3. `parseWorkflowBody(envelope)` (`workflow-body-parser.ts`) currently
   slices the body with `sliceSourceSpan(envelope.sourceFile,
   envelope.bodySpan)` and calls `parseSync(bodyText, options)` with options
   `{ syntax: "ecmascript", jsx: false, topLevelAwait: true }`
   inside a `try`, returning `Object.freeze({ ok: true })` on success or a
   frozen `odw/body-syntax` diagnostic (span `envelope.bodySpan`) on any
   throw. **This task changes only the parse input (normalized instead of
   raw) and the parse options; the result shape is unchanged.**
4. `lintWorkflowSource(source)` (`workflow-lint.ts`) merges envelope and
   metadata diagnostics. **This task does not change `lintWorkflowSource`.**

Span helpers:

- `spanFromOffsets(file, startByteOffset, endByteOffset)`
  (`source-position.ts:62-75`) builds a validated half-open original-source
  span from UTF-8 byte offsets and throws `SourceOffsetError` on invalid or
  reversed offsets.
- `sliceSourceSpan(file, span)` (`source-snippet.ts`, re-exported from
  `odw-lint`) returns the original text a span covers; the tests use it to
  prove a mapped span points into original source.

The rule and fixtures:

- `odw/body-syntax` is catalogued and released
  (`src/diagnostics/rule-catalogue.ts`): message "Workflow body must be
  syntactically complete after ODW normalization.", docs
  `docs/rules/body-syntax.md`.
- Nine trusted ODW example fixtures live under
  `tests/static-analysis/fixtures/odw-examples/` (enumerated in
  `tests/static-analysis/odw-example-fixtures.test.ts:19-29`), read with
  `readFixtureSource` from
  `tests/static-analysis/fixtures/corpus-support.ts`. Several contain
  top-level `return` (`adversarial-verify.js:60`, `routing.js:91`,
  `loop-until-dry.js:61`, `tournament.js:82`, `deep-research.js:318`,
  `generate-and-filter.js:99`, `codex-claude-loop.js:113`,
  `fan-out-reduce.js:30`, `agent-daily-digest.js:491`) and top-level
  `await` (`routing.js:64`, `generate-and-filter.js:57`, `tournament.js:36`,
  `agent-daily-digest.js:187`, `adversarial-verify.js:36`).
- The two `syntax-error` fixtures
  (`tests/static-analysis/fixtures/invalid-workflows/syntax-error/body-unclosed-block.js`
  and `body-unclosed-call.js`) and their manifest `manifests/syntax-error.ts`
  drive `parseWorkflowBody`'s current snapshot and parity tests
  (`tests/static-analysis/workflow-body-parser.test.ts:94-120`;
  `tests/static-analysis/invalid-workflow-metadata-parity.test.ts`).

Guards that react to this change:

- `tests/diagnostics/architecture.test.ts` compares files under
  `src/static-analysis/` to `EXPECTED_STATIC_ANALYSIS_MODULE_FILES`
  (`tests/diagnostics/architecture-fixtures.ts:37-61`). Adding
  `workflow-body-normalizer.ts` requires inserting it in sorted position
  (before `workflow-body-parser.ts`).
- `tests/diagnostics/public-api-surface.test.ts` deep-equals the package's
  named exports to `EXPECTED_PUBLIC_PACKAGE_EXPORTS`
  (`tests/diagnostics/public-api-fixtures.ts`). New public symbols must be
  added there in ASCII-sorted position; on failure the guard prints the
  exact expected sorted list.
- `tests/diagnostics/package-entry.test.ts` checks `src/index.ts` module
  specifiers; `./static-analysis` is already listed, so re-exporting new
  symbols through it needs no edit there.
- `tests/diagnostics/import-policy.test.ts` scans production imports; keep
  imports as static string edges.
- The `tests/build-gate` file-size test (run through `make test`): no file
  over 400 lines.

Testing framework: `bun:test` for unit and behavioural tests; `fast-check`
for property tests (`fc.assert(fc.property(gen, predicate))`; see the
existing `tests/static-analysis/workflow-body-parser.test.ts`). Snapshots use
Bun's built-in snapshot support.

Key design references: `docs/technical-design.md` sections 3 (ODW loader
row: async-function wrap), 4 (design intent step 3: "Transform the workflow
body into parseable JavaScript while preserving source-span mappings"),
5 and 12.1 (no source evaluation), 6.1 (Body normalizer, Span mapper, SWC
parser adapter components), 6.2 (static source model), 8 (span always refers
to original source), 11.1 (differential corpus includes top-level return and
top-level await cases), 11.5 (span-mapping invariant), 12.2 (parser crash to
`odw/body-syntax`), 13 (packaging);
`docs/adr/0001-static-analysis-boundary.md`;
`docs/complexity-antipatterns-and-refactoring-strategies.md` (keep the
normalizer a small pure function); `AGENTS.md` testing, error-handling,
docs, and TypeScript sections.

## Plan of work

Three work items, each a vertical slice ending green with `make all` (plus
`make markdownlint` and `make nixie` when Markdown changes). Stage order per
item: understand → Red test → minimal implementation → refactor and gate.

### WI1 — Body normalizer and span mapper module

Implements: `docs/technical-design.md` sections 4 (step 3), 6.1 (Body
normalizer, Span mapper), 8, 11.5; `docs/adr/0001-static-analysis-boundary.md`
(static, no execution). Roadmap 2.2.2 foundation.

Read first: `docs/technical-design.md` sections 4, 6.1, 8, 11.5;
`src/static-analysis/source-position.ts` (`spanFromOffsets` and its
`SourceOffsetError` contract); `src/static-analysis/source-snippet.ts`
(`sliceSourceSpan`); `src/static-analysis/types.ts:59-94`
(`OriginalSourceFile`, `WorkflowEnvelope`, `bodySpan`);
`docs/execplans/roadmap-2-2-1.md` Risks/Decision Log (BytePos base, S2).

Skills to load: `leta` (navigate `spanFromOffsets`, `sliceSourceSpan`,
`WorkflowEnvelope`, and confirm no existing normalizer); `grepai` (intent
search against `main` for span-mapping helpers — record if unavailable);
the repo `fast-check` idiom. No language-router skill applies (TypeScript
follows repo standards directly).

New module `src/static-analysis/workflow-body-normalizer.ts`:

- `/** @file … */` header: static body normalizer and span mapper; wraps the
  body in an async function so top-level `return`/`await` parse and maps
  normalized byte offsets back to original source. Never executes source.
- Import `spanFromOffsets` from `./source-position`, `sliceSourceSpan` from
  `./source-snippet`, `OriginalSourceFile`/`WorkflowEnvelope` from `./types`,
  and `SourceSpan` from `../diagnostics/types`.
- Public surface:

  ```typescript
  // src/static-analysis/workflow-body-normalizer.ts
  export type NormalizedWorkflowBody = {
    /** SWC-parseable source: async-function wrapper around the body slice. */
    readonly normalizedText: string;
    /** UTF-8 byte length of the injected wrapper prefix. */
    readonly prefixByteLength: number;
    /** Original-source byte offset where the body slice begins. */
    readonly bodyByteOffset: number;
    /** UTF-8 byte length of the original body slice. */
    readonly bodyByteLength: number;
  };

  export const normalizeWorkflowBody = (
    envelope: WorkflowEnvelope,
  ): NormalizedWorkflowBody => { /* … */ };

  export const originalSpanFromNormalizedOffsets = (
    sourceFile: OriginalSourceFile,
    normalized: NormalizedWorkflowBody,
    normalizedStartByte: number,
    normalizedEndByte: number,
  ): SourceSpan => { /* … */ };
  ```

- `normalizeWorkflowBody`: `const bodyText = sliceSourceSpan(sourceFile,
  envelope.bodySpan)`; build `normalizedText = WRAP_PREFIX + bodyText +
  WRAP_SUFFIX` where `WRAP_PREFIX = "async function __odwLintWorkflowBody__() {"`
  and `WRAP_SUFFIX = "\n}"`; compute `prefixByteLength` and `bodyByteLength`
  with a module-level `TextEncoder`; set `bodyByteOffset =
  envelope.bodySpan.start.offset`. Return `Object.freeze(...)`.
- `originalSpanFromNormalizedOffsets`: compute
  `relativeStart = normalizedStartByte - normalized.prefixByteLength` and
  `relativeEnd = normalizedEndByte - normalized.prefixByteLength`; if
  `relativeStart < 0`, `relativeEnd > normalized.bodyByteLength`, or
  `relativeEnd < relativeStart`, throw `SourceOffsetError` (imported from
  `./types`) with a message naming the out-of-body offset (an offset landing
  in the wrapper is a caller error, surfaced loudly, not silently clamped);
  otherwise return
  `spanFromOffsets(sourceFile, relativeStart + normalized.bodyByteOffset,
  relativeEnd + normalized.bodyByteOffset)`.
- Keep the file small (well under 400 lines).

Exports and guards:

1. `src/static-analysis/index.ts`: re-export `normalizeWorkflowBody`,
   `type NormalizedWorkflowBody`, and `originalSpanFromNormalizedOffsets`
   (keep grouped ordering).
2. `src/index.ts`: extend the existing `from "./static-analysis"` block to
   add the same three names (specifier `./static-analysis` unchanged).
3. `tests/diagnostics/architecture-fixtures.ts`: insert
   `"workflow-body-normalizer.ts"` into
   `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` before `"workflow-body-parser.ts"`.
4. `tests/diagnostics/public-api-fixtures.ts`: insert
   `"NormalizedWorkflowBody"`, `"normalizeWorkflowBody"`, and
   `"originalSpanFromNormalizedOffsets"` in ASCII-sorted position (run
   `make test` first if unsure; the guard prints the expected order).

Tests — new `tests/static-analysis/workflow-body-normalizer.test.ts`
(import the public symbols from `odw-lint`, plus `createOriginalSourceFile`,
`scanWorkflowEnvelope`, `sliceSourceSpan`; reuse `expectScannedEnvelope` from
`tests/static-analysis/workflow-envelope-support`):

- Unit — wrapper shape: for a simple body (`return { done: true };\n`),
  assert `normalizedText` starts with the prefix, ends with `"\n}"`, and
  contains the verbatim body slice; assert `prefixByteLength ===
  Buffer.byteLength(prefix)` and `bodyByteOffset === envelope.bodySpan.start.offset`.
- Unit — pure round-trip mapping: pick a marker substring in the body
  (for example the identifier in `const marker = 42;\nreturn marker;\n`);
  find its index in `normalizedText` via `indexOf`, convert the UTF-16 index
  to a byte offset with `TextEncoder` over `normalizedText.slice(0, index)`,
  map `[start, end]` through `originalSpanFromNormalizedOffsets`, and assert
  `sliceSourceSpan(sourceFile, span)` equals the marker text. Include a
  Unicode body (a multi-byte character before the marker) so the arithmetic
  is exercised on non-ASCII bytes.
- Unit — trailing line comment: a body ending `x;\n// trailing` with no final
  newline still yields a `normalizedText` whose closing `}` is on its own
  line (assert `normalizedText.endsWith("\n}")` and that the `}` is not
  inside the comment).
- Unit — out-of-body offset rejected: an offset before `prefixByteLength`
  (or past the body) throws `SourceOffsetError`
  (`expect(() => …).toThrow(SourceOffsetError)`).
- Unit — frozen: `normalizeWorkflowBody` returns a frozen record.
- Property (`fast-check`) — mapping is exact for arbitrary in-body slices:
  over a generator of small bodies (ASCII and a few multi-byte characters),
  choose a random valid `[start, end]` byte range **inside the body region**
  of `normalizedText`, map it, and assert the mapped original span slices to
  the same bytes the normalized range covers. Assert the mapper never throws
  for in-body ranges and always throws for ranges intruding into the prefix.

Red-Green-Refactor: write the test file first; run it (Red — cannot resolve
`normalizeWorkflowBody`). Add the module and exports (Green). Refactor JSDoc
and formatting; re-run.

Validation: `make all` (build, check-fmt, whitespace-hygiene, lint,
typecheck, test — all green). No Markdown changed in WI1.

### WI2 — Rewire `parseWorkflowBody` to normalize before parsing

Implements: `docs/technical-design.md` sections 4 (step 3), 6.1, 11.1
(top-level return/await corpus), 11.5, 12.2; roadmap 2.2.2 success line.

Read first: `src/static-analysis/workflow-body-parser.ts` (whole file);
WI1's normalizer module; `tests/static-analysis/workflow-body-parser.test.ts`
(existing snapshot, valid-body, never-throws, and 2.2.1 property tests);
`tests/static-analysis/invalid-workflow-metadata-parity.test.ts`
(`syntax-error` parity); `tests/static-analysis/odw-example-fixtures.test.ts`
and `tests/static-analysis/fixtures/corpus-support.ts` (`readFixtureSource`,
fixture directory URL).

Skills to load: `leta` (confirm `parseWorkflowBody`'s consumers and the
example-fixture reader); `grepai` (consistency sweep on `odw/body-syntax`
and `topLevelAwait` — record if unavailable); the `fast-check` idiom.

Prototyping probe (before editing the parser; scratch `*.ts` under a
gitignored `tmp/` path, run with `bun run`, **deleted before commit**, as
2.2.1 did): after `make build` installs `@swc/core`, `parseSync` a wrapped
body (`normalizeWorkflowBody` output for `const marker = 42;\nreturn marker;\n`)
and record: (a) the returned program object has `.span.start` (the byte
base); (b) child nodes carry `.span.start`/`.span.end` byte offsets within
`[base + prefixByteLength, base + prefixByteLength + bodyByteLength]`;
(c) a recursive walk over the program can collect node spans without knowing
exact field names (traverse any value with a `span:{start,end}` shape).
Go/no-go: if there is no program `.span.start` byte base or node spans are
not byte offsets, stop and escalate (Tolerance: SWC AST shape). Record the
observed shape in the Decision Log.

Production change — `src/static-analysis/workflow-body-parser.ts`:

- Import `normalizeWorkflowBody` from `./workflow-body-normalizer`.
- Replace the raw-slice parse: build `const normalized =
  normalizeWorkflowBody(envelope)` and `parseSync(normalized.normalizedText,
  WORKFLOW_BODY_PARSE_OPTIONS)`.
- Change `WORKFLOW_BODY_PARSE_OPTIONS` to
  `{ syntax: "ecmascript", jsx: false }` (drop `topLevelAwait`: the
  async-function wrapper makes `await` legal, so the module-level option is
  no longer needed). Keep the `try`/`catch`: on success return
  `Object.freeze({ ok: true })`; on any throw return the frozen
  `odw/body-syntax` diagnostic with `span: envelope.bodySpan` (unchanged S2).
- Do not expose the parsed AST on the result (2.2.4 owns AST facts).

Tests — extend `tests/static-analysis/workflow-body-parser.test.ts` (keep it
under 400 lines; if it approaches the limit, split the new integration cases
into `tests/static-analysis/workflow-body-normalization.test.ts`):

- Unit — top-level `return` now parses (the motivating Red→Green): assert
  `parseWorkflowBody(envelopeForBody("return { done: true };\n"))` returns
  `{ ok: true }`. This returns `{ ok: false }` before the rewire (Red) and
  `{ ok: true }` after (Green).
- Unit — top-level `await` still parses:
  `parseWorkflowBody(envelopeForBody('const x = await agent("ok");\nreturn x;\n'))`
  returns `{ ok: true }` (guards the dropped `topLevelAwait` option).
- Behavioural — nine ODW examples parse: read each fixture in
  `EXPECTED_FILE_NAMES` with `readFixtureSource`, scan the envelope, and
  assert `parseWorkflowBody(envelope)` returns `{ ok: true }`. Drive it with
  `it.each` over the file list (parameterized per `AGENTS.md`). This is the
  direct proof of the roadmap success line for the return/await corpus
  (`docs/technical-design.md` section 11.1).
- Integration — span mapping through real SWC output: `parseSync` the
  normalized `const marker = 42;\nreturn marker;\n` body; recursively collect
  every node with a `span:{start,end}`; subtract the program `.span.start`
  base; for each in-body node map through `originalSpanFromNormalizedOffsets`
  and slice; assert the set of mapped slices includes `"marker"` (the exact
  original identifier). Proves normalized AST byte spans map to original text
  (section 11.5) and that the global BytePos base is handled.
- Regression — `syntax-error` fixtures unchanged: keep the existing snapshot
  and original-source-span tests
  (`workflow-body-parser.test.ts:94-120`) green; both fixtures still return
  `{ ok: false }` with `span === envelope.bodySpan`. Add an explicit
  assertion that wrapping did **not** make them parse (Tolerance: wrapper
  parity).
- Keep the existing 2.2.1 never-throws property test intact (it does not
  generate return-only bodies, so it still passes unchanged).

Snapshot note: the two `syntax-error` snapshots must not change (span stays
`envelope.bodySpan`). Do **not** run with `--update-snapshots` unless a
snapshot legitimately changed; if one does, stop — that means the error span
changed unexpectedly (Tolerance/escalation).

Parity note: `tests/static-analysis/invalid-workflow-metadata-parity.test.ts`
must stay green with no manifest edit. If (unexpectedly) a `syntax-error`
span changes, reconcile only via `make refresh-fixtures` and record the
before/after; do not hand-edit the manifest.

Red-Green-Refactor: add the top-level-`return` test first and run it (Red —
current adapter returns `{ ok: false }`). Rewire the parser (Green). Add the
example and span-mapping tests; refactor; re-run.

Validation: `make all`. No Markdown changed in WI2.

### WI3 — Document the normalizer, span mapper, and updated parser contract

Implements: `docs/developers-guide.md` "Documentation Upkeep";
`docs/documentation-style-guide.md`; roadmap 2.2.2 (developer-facing
contract).

Read first: `docs/developers-guide.md` static-analysis section (the
paragraph 2.2.1 added describing `parseWorkflowBody` and the deferred
normalization boundary) and the roadmap-sequencing paragraph.

Skills to load: `en-gb-oxendict` (British/Oxford spelling); `leta` (verify
documented symbol names match the shipped exports).

Change — `docs/developers-guide.md`:

- Update the `parseWorkflowBody` description: it now normalizes the body by
  wrapping it in an async function (via `normalizeWorkflowBody`) before
  parsing, so ODW bodies with top-level `return`/`await` parse; syntax
  errors still become `odw/body-syntax` diagnostics with original-source
  spans (`envelope.bodySpan`); it never executes source and is still not
  wired into `lintWorkflowSource`.
- Describe the new `normalizeWorkflowBody` and
  `originalSpanFromNormalizedOffsets` helpers and the async-function wrapper
  contract, noting that the span mapper returns original-source spans and
  that exposing workflow AST facts (lexical bindings, masks) remains task
  2.2.4's boundary. Update the roadmap-sequencing note so 2.2.2 owns body
  normalization and span mapping.

Tests: none (prose). Validated by the Markdown gates.

Validation: `make all`; then `make markdownlint`; then `make nixie`. Format
only the touched file first: `mdtablefix docs/developers-guide.md` then
`markdownlint-cli2 --fix docs/developers-guide.md` (this file definitely
exists and is edited by this work item).

## Concrete steps

All commands run from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-2-2`.

WI1:

1. Create `tests/static-analysis/workflow-body-normalizer.test.ts` with the
   unit and property cases above. Run to observe Red:

   ```plaintext
   bun test tests/static-analysis/workflow-body-normalizer.test.ts
   # expect: fails to resolve `normalizeWorkflowBody`
   ```

2. Add `src/static-analysis/workflow-body-normalizer.ts`; re-export the three
   symbols from `src/static-analysis/index.ts` and `src/index.ts`; add the
   module to `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` and the three names to
   `public-api-fixtures.ts` (sorted).
3. Re-run the focused suite (Green), then format and gate:

   ```sh
   bunx @biomejs/biome format --write \
     src/static-analysis/workflow-body-normalizer.ts \
     src/static-analysis/index.ts \
     src/index.ts \
     tests/static-analysis/workflow-body-normalizer.test.ts \
     tests/diagnostics/architecture-fixtures.ts \
     tests/diagnostics/public-api-fixtures.ts
   make all
   ```

4. Commit (gated).

WI2:

1. Add the top-level-`return` test to
   `tests/static-analysis/workflow-body-parser.test.ts`; run it to observe
   Red (`{ ok: false }` today).
2. Run the scratch SWC probe under `tmp/` (deleted before commit); record
   the observed program/node span shape in the Decision Log and choose the
   recursive-walk mapping approach.
3. Rewire `src/static-analysis/workflow-body-parser.ts` (normalize before
   parsing; drop `topLevelAwait`). Add the await, nine-example, span-mapping,
   and wrapper-parity tests.
4. Re-run the focused suite (Green), delete the scratch probe, then format
   and gate:

   ```sh
   bunx @biomejs/biome format --write \
     src/static-analysis/workflow-body-parser.ts \
     tests/static-analysis/workflow-body-parser.test.ts
   make all
   ```

   (If the integration cases were split into
   `tests/static-analysis/workflow-body-normalization.test.ts`, add that path
   to the format list — it will exist at that point.)
5. Commit (gated).

WI3:

1. Edit `docs/developers-guide.md` per WI3.
2. Format the touched file and gate:

   ```sh
   mdtablefix docs/developers-guide.md
   markdownlint-cli2 --fix docs/developers-guide.md
   make all
   make markdownlint
   make nixie
   ```

3. Commit (gated).

## Validation and acceptance

Per work item, the repository gate is authoritative:

- `make all` — build (installs `@swc/core`), `check-fmt`,
  whitespace-hygiene, lint, `typecheck`, and `test`. Expect all green.
- `make markdownlint` and `make nixie` — required for WI3 (edits
  `docs/developers-guide.md`). Expect all green.

Behavioural acceptance:

- `tests/static-analysis/workflow-body-normalizer.test.ts` fails before WI1's
  module exists and passes after; it proves the wrapper shape and that a
  mapped in-body normalized span slices back to the exact original text
  (including a multi-byte case).
- The top-level-`return` test in the parser suite returns `{ ok: false }`
  before WI2 and `{ ok: true }` after.
- The nine-example parse test proves every trusted ODW example body parses
  `{ ok: true }` after normalization.
- The span-mapping integration test proves a real SWC node byte span maps to
  its exact original identifier text.
- The two `syntax-error` fixtures still return `{ ok: false }` with
  `span === envelope.bodySpan`; their snapshots and the parity suite are
  unchanged; `lintWorkflowSource` and its property test are untouched.

Quality criteria for "done":

- Tests: all Bun tests pass under `make test`; the normalizer and mapper are
  covered by unit and property tests; the parser is covered by Red→Green,
  example-corpus, span-mapping, and regression tests.
- Lint/typecheck: `make lint` and `make typecheck` clean; imports are static
  string edges; no `@swc/core` AST type leaks into the public surface.
- Formatting: `make check-fmt` clean; touched Markdown formatted with
  `mdtablefix` and `markdownlint-cli2`.
- API: the only new public symbols are `NormalizedWorkflowBody`,
  `normalizeWorkflowBody`, and `originalSpanFromNormalizedOffsets`; the
  module-inventory and public-API guards reflect exactly those additions;
  `parseWorkflowBody`/`WorkflowBodyParseResult` shapes are unchanged.
- Dependency: no new dependency; `bun.lock` unchanged.

## Idempotence and recovery

Every step is re-runnable. Adding the module, exports, and tests is additive;
re-running `make all` is safe. If the export list is mis-sorted,
`public-api-surface.test.ts` prints the expected order — re-sort and re-run.
If the module-inventory fixture is missing the new file,
`architecture.test.ts` prints the diff. The scratch SWC probe lives under a
gitignored `tmp/` path and is deleted before commit, so it leaves no trace.
No `syntax-error` manifest edit is expected; if one is unavoidable,
`make refresh-fixtures` is deterministic and its refresh tests confirm sync —
revert and re-derive if a refresh looks wrong. No destructive operations are
involved.

## Artifacts and notes

- WI1 implementation evidence (2026-07-02):
  `bun test tests/static-analysis/workflow-body-normalizer.test.ts` passed
  with 6 tests, 1 snapshot, and 215 assertions after CodeRabbit follow-up
  changes. Scrutineer ran
  `cd /data/leynos/Projects/odw-lint.worktrees/roadmap-2-2-2 && make all`
  after the follow-up changes; it exited 0. Scrutineer then ran
  `coderabbit review --agent`; CodeRabbit completed without rate limiting and
  reported three low-severity items, all addressed before the post-review
  `make all` rerun. No Markdown files were changed before the WI1 gate, so
  Markdown-specific gates were deferred until this ExecPlan update.
- WI2 implementation evidence (2026-07-02): before the production rewire,
  `bun test tests/static-analysis/workflow-body-parser.test.ts` failed on
  the new top-level `return` assertion and all nine trusted ODW examples with
  `odw/body-syntax`, establishing the Red stage. After rewiring
  `parseWorkflowBody` to parse `normalizeWorkflowBody(envelope).normalizedText`,
  the focused parser suite passed with 24 tests, 2 snapshots, and 417
  assertions. Scrutineer ran `make all`; after two local lint/typecheck
  refinements in the test span walker, the gate exited 0. Scrutineer then
  ran `coderabbit review --agent`; CodeRabbit completed without rate
  limiting and reported no actionable findings.
- WI3 documentation evidence (2026-07-02): `docs/developers-guide.md` now
  describes `normalizeWorkflowBody`, `originalSpanFromNormalizedOffsets`, the
  updated `parseWorkflowBody` contract, the unchanged `lintWorkflowSource`
  boundary, and the 2.2.4 AST-facts boundary. The touched Markdown files were
  formatted with `mdtablefix` and `markdownlint-cli2 --fix`. Scrutineer ran
  `make all`, `make markdownlint`, and `make nixie`; all exited 0.
  Scrutineer then ran `coderabbit review --agent`; CodeRabbit completed
  without rate limiting and reported no actionable findings.
- Planning-session tooling limitations (record, not blockers): the sibling
  ODW checkout, `grepai`, and `firecrawl` were permission-gated, and
  `node_modules/@swc` was not installed (build not run). The ODW async-
  function wrapper contract is pinned by `docs/technical-design.md`
  sections 3 and 6.1; the live SWC AST span shape is now pinned by the WI2
  probe observation and parser integration test above.

## Interfaces and dependencies

New production surface (in
`src/static-analysis/workflow-body-normalizer.ts`, re-exported via
`src/static-analysis/index.ts` and `src/index.ts`):

```typescript
// src/static-analysis/workflow-body-normalizer.ts
export type NormalizedWorkflowBody = {
  readonly normalizedText: string;
  readonly prefixByteLength: number;
  readonly bodyByteOffset: number;
  readonly bodyByteLength: number;
};

export const normalizeWorkflowBody: (
  envelope: WorkflowEnvelope,
) => NormalizedWorkflowBody;

export const originalSpanFromNormalizedOffsets: (
  sourceFile: OriginalSourceFile,
  normalized: NormalizedWorkflowBody,
  normalizedStartByte: number,
  normalizedEndByte: number,
) => SourceSpan;
```

Changed production surface (shape unchanged):

- `parseWorkflowBody(envelope: WorkflowEnvelope): WorkflowBodyParseResult`
  (`src/static-analysis/workflow-body-parser.ts`) now normalizes the body
  before parsing.

Reused, unchanged interfaces:

- `scanWorkflowEnvelope(sourceFile)` — supplies `envelope.bodySpan`.
- `spanFromOffsets(file, start, end)`, `sliceSourceSpan(file, span)` —
  original-source span construction and slicing.
- `RULE_CATALOGUE` / `ruleDocsPath` / `makeRuleId` — the catalogued
  `odw/body-syntax` message and docs path.

External dependency: `@swc/core` (already a caret dependency; no change).
Test-only: `bun:test`, `fast-check` (both present).

## Revision note

Initial draft (2026-07-02). Decomposes roadmap task 2.2.2 into three
gateable work items: (WI1) add the pure body normalizer and span mapper
(`workflow-body-normalizer.ts`), verified by unit and property tests; (WI2)
rewire `parseWorkflowBody` to wrap the body in an async function before
parsing so top-level `return`/`await` bodies parse, proven by a
Red→Green top-level-`return` test, a nine-example parse test, and a
span-mapping integration test that maps a real SWC node span to original
text, while keeping the `syntax-error` fixtures and their snapshots/parity
unchanged; (WI3) document the new components and the updated parser contract.
The central design decision — match ODW's documented async-function wrapper
and map normalized byte offsets back to original source via a numeric-offset
boundary that keeps the SWC AST out of the public surface — is pinned by
`docs/technical-design.md` sections 3 and 6.1 and by the WI2 SWC probe test.
Tooling limitations recorded: sibling ODW checkout, `grepai`, `firecrawl`,
and `@swc` node_modules were unavailable in the planning session, so the ODW
wrapper is cited from the in-repo design doc and the SWC AST shape is pinned
by a probe test rather than a live run. No prior design-review points
(round 1).
