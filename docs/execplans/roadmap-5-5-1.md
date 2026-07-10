# Resolve the body-syntax span-narrowing surface

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint` statically checks Open Dynamic Workflows (ODW) source without ever
executing it. When a workflow body cannot be parsed, the SWC parser adapter
`parseWorkflowBody` (`src/static-analysis/workflow-body-parser.ts`) emits one
`odw/body-syntax` diagnostic. Roadmap task 2.2.6 built an internal seam,
`src/static-analysis/workflow-body-parser-spans.ts`, that would narrow that
diagnostic's span from the whole body to the offending token *if* the parser
exposed a structured (machine-readable) byte offset. The pinned
`@swc/core@^1.15.43` parser exposes only rendered prose on its thrown error, so
in production that seam always falls through to the conservative whole-body
span. The narrowing machinery is therefore **dormant**: built and unit-tested
against synthetic structured errors, but never exercised by the shipped parser.

Roadmap task 5.5.1 (`docs/roadmap.md` lines 1378-1384) requires a decision: wire
a real structured-offset parser channel, or explicitly quarantine
`workflow-body-parser-spans.ts` — and then align the rule docs, ADR 0002, and
design guidance with the current whole-body fallback. The verbatim success line
reads: "documentation and code agree on whether span narrowing is active,
inert, or intentionally deferred, with tests pinning the chosen contract."

This plan **decides to quarantine the seam as an intentionally deferred,
internal fallback** (see Decision Log for why wiring a channel is out of reach
under the locked parser) and delivers the documentation-and-code alignment the
success line demands:

1. The quarantine decision is recorded as a first-class ADR
   (`docs/adr/0003-body-syntax-span-narrowing-quarantine.md`) and cross-linked
   from ADR 0002.
2. The user-facing rule doc (`docs/rules/body-syntax.md`) and the design and
   developer guidance stop describing narrowing as an available capability and
   instead describe the shipped whole-body span with narrowing deferred.
3. A focused characterization test pins the shipped contract: the real SWC
   parser yields no structured range, `parseWorkflowBody` emits the whole-body
   span for real syntax errors, and the narrowing helpers stay off the public
   package entry.

What a reader gains after this change: `docs/` and code tell one consistent
story — for the parser `odw-lint` actually ships, an `odw/body-syntax`
diagnostic spans the whole normalized body (pointing into original source), the
token-narrowing path is a documented dormant seam awaiting a future parser
channel, and a test fails loudly if a dependency upgrade quietly changes that.

Observable proof (see `Validation and acceptance`): after the change,
`make all` stays green with a new named quarantine-contract test asserting the
dormant behaviour; `make markdownlint` and `make nixie` pass for the reconciled
Markdown; and a human can read `docs/rules/body-syntax.md`, ADR 0003, and the
`workflow-body-parser-spans.ts` `@file` docstring and find them in agreement.

## Scope boundary with adjacent tasks (read this first)

- **5.5.1 owns** the disposition decision for the dormant span-narrowing seam
  and the documentation-plus-test reconciliation. It records a decision, aligns
  docs, adds a pinning test, and (per the decision below) makes **no**
  production behaviour change to diagnostic spans.
- **5.5.1 must not** wire a new parser, add a dependency, bump `@swc/core`, or
  parse rendered diagnostic prose (`error.message`) to recover offsets. The
  2.2.6 contract and ADR 0002 forbid prose parsing, and the Tolerances below
  make a dependency change an escalation.
- **5.5.1 must not** change the `Diagnostic` object shape
  (`docs/technical-design.md` section 8) or the public signature of
  `parseWorkflowBody`. The whole-body span for real SWC failures must remain
  byte-for-byte unchanged (snapshots in
  `tests/static-analysis/__snapshots__/` and the span-equality assertions in
  `tests/static-analysis/workflow-body-parser.test.ts`).
- **5.5.1 requires 2.2.6 and 2.3.4** (`docs/roadmap.md` line 1379). 2.2.6
  (COMPLETE, `docs/execplans/roadmap-2-2-6.md`) built the seam and pinned the
  SWC no-offset surface; 2.3.4 (COMPLETE, `docs/execplans/roadmap-2-3-4.md`)
  proved ODW loader parity and introduced no structured-offset parser channel.
  Neither dependency changes the decision input.

## Constraints

- The static-analysis boundary is a security boundary
  (`docs/adr/0001-static-analysis-boundary.md`, `docs/technical-design.md`
  section 12.1). Production code must not execute, import, or evaluate workflow
  source. This task only edits docs, one `@file` docstring, and adds a test.
- Do not recover offsets by parsing `error.message` or any rendered diagnostic
  text (roadmap 2.2.6, `docs/roadmap.md` line 585; ADR 0002 parser contract).
- Do not add a new external dependency and do not bump `@swc/core`
  (`docs/technical-design.md` section 13, `package.json`). The
  span-narrowing seam stays internal: it must not be re-exported from
  `src/index.ts` or `src/static-analysis/index.ts` (developers guide lines
  61-65; audit decisions 2.2.6.2 and 2.2.6.4).
- Every emitted diagnostic `span` must continue to point into **original**
  source (`docs/technical-design.md` sections 8 and 11.5). This plan does not
  change any span value.
- en-GB Oxford spelling ("-ize"/"-yse"/"-our") in all prose, comments, and
  commit messages (`AGENTS.md`, `docs/documentation-style-guide.md`).
- No single code file exceeds 400 lines (`AGENTS.md`). The touched files stay
  well under this; the new test is a fresh file.
- ADRs are append-only decision records: record the new decision in a new ADR
  (0003) rather than rewriting the accepted ADR 0002; ADR 0002 gains only a
  cross-reference (`docs/adr/` convention, mirrored by ADR 0001/0002 style).

## Tolerances (exception triggers)

- Scope: if the reconciliation requires editing more than 8 files or more than
  ~200 net lines, stop and escalate.
- Interface: if any change would alter the public `Diagnostic` shape, the
  `parseWorkflowBody` signature, or the public export surface, stop and
  escalate.
- Dependencies: if honouring the success line appears to require a new
  dependency or an `@swc/core` bump, stop and escalate.
- Discovery: if, while writing the WI-3 contract test with `node_modules`
  present, the locked `@swc/core` is found to expose a structured,
  base-resolvable byte offset on parse errors (contradicting the pinned
  characterization in `tests/static-analysis/swc-parse-error-surface.test.ts`),
  stop and escalate — the "wire a channel" branch then becomes live and the
  decision must be re-planned before any doc says "deferred".
- Ambiguity: if a reviewer reads the roadmap wording as mandating a new ADR
  0003 be avoided in favour of amending ADR 0002 (or vice versa), stop and
  present both options rather than guessing.
- Iterations: if the focused test still fails after 3 attempts, stop and
  escalate.

## Risks

- Risk: the locked `@swc/core@^1.15.43` parse-error surface cannot be inspected
  empirically during planning (`node_modules` is absent in the worktree, and
  the `firecrawl_*` web tools require interactive approval that is denied in
  this non-interactive session).
  Severity: medium. Likelihood: low that the pinned conclusion is wrong.
  Mitigation: the fact is already pinned at HEAD by
  `tests/static-analysis/swc-parse-error-surface.test.ts` (an inline-snapshot
  characterization test the implementer re-runs with `node_modules` present),
  and WI-3 re-pins the same fact through the extractor. The Tolerances
  "Discovery" trigger covers the contradicting outcome.
- Risk: a reviewer expects a new ADR whereas the roadmap names "ADR 0002",
  or vice versa.
  Severity: low. Likelihood: medium.
  Mitigation: the plan records the decision in a new ADR 0003 **and** aligns
  ADR 0002 with a cross-reference, satisfying both readings; the Tolerances
  "Ambiguity" trigger escalates if a reviewer rejects that.
- Risk: a future `@swc/core` upgrade changes the error surface and silently
  activates or misdirects narrowing.
  Severity: medium. Likelihood: low.
  Mitigation: the existing characterization test plus the WI-3 quarantine
  contract test convert any such change into a red suite, and ADR 0003 records
  the re-observation trigger tied to the SWC upgrade checklist.
- Risk: doc churn accidentally reformats unrelated Markdown.
  Severity: low. Likelihood: low.
  Mitigation: format only the touched files with `mdtablefix` then
  `markdownlint-cli2 --fix`, then gate with the repository targets.

## Progress

- [x] (2026-07-05 22:35Z) WI-1: Record the span-narrowing quarantine decision
  in ADR 0003 and cross-reference it from ADR 0002.
- [x] (2026-07-05 22:39Z) WI-2: Reconcile the rule, design, and developer docs
  with the shipped whole-body fallback.
- [x] (2026-07-05 22:46Z) WI-3: Pin the dormant span-narrowing contract with a
  characterization test and link the internal module to ADR 0003.
- [x] (2026-07-05 22:52Z) WI-4: Tick roadmap task 5.5.1 and record
  completion.

## Surprises & discoveries

- Observation: the documentation is already partly aligned, but the
  user-facing rule doc is not.
  Evidence: `docs/developers-guide.md` lines 61-65 and
  `docs/technical-design.md` lines 117-123 already call the seam "intentionally
  internal" and note the whole-body fallback, whereas `docs/rules/body-syntax.md`
  lines 22-25 still tell users "the diagnostic span narrows to that offending
  token", a capability the shipped parser never triggers.
  Impact: WI-2 focuses the biggest correction on the rule doc; the design and
  developer edits are cross-reference and staleness fixes (for example
  `docs/developers-guide.md` line 654 still points "future narrowing" at the
  now-complete task 2.2.6).
- Observation: the shipped whole-body fallback is already test-pinned.
  Evidence: `tests/static-analysis/workflow-body-parser.test.ts` ("emits
  original-source body span text for %s") asserts `diagnostic.span` equals
  `envelope.bodySpan` for both syntax-error fixtures, and
  `tests/static-analysis/workflow-body-parser-ranges.test.ts` line 41 asserts
  `structuredNormalizedRangeFromParserError(realError, normalized)` is
  `undefined`.
  Impact: WI-3 adds a single named quarantine-contract test that composes these
  facts and adds the "not publicly exported" assertion, rather than duplicating
  existing coverage.
- Observation: `leta` could not open the linked worktree as a workspace.
  Evidence: `leta grep "span-narrowing" docs/adr` returned
  `Error: No workspace found for current directory`.
  Impact: WI-1 used GrepAI for canonical intent search and bounded
  branch-local file inspection for the ADR-only change, matching the standing
  fallback rule for transient Leta workspace failures.
- Observation: the first WI-1 gate run exposed repository documentation
  freshness issues outside the ADR files.
  Evidence: scrutineer reported `make test` failing because
  `execplans/roadmap-5-5-1.md` was missing from `docs/contents.md`, and
  `make markdownlint` failing on long lines in this ExecPlan.
  Impact: WI-1 includes a narrow `docs/contents.md` index update and mechanical
  ExecPlan reflow so the required deterministic gates can pass at HEAD.
- Observation: WI-2 found the rule page was the only user-facing document that
  still described token narrowing as observable behaviour.
  Evidence: `docs/rules/body-syntax.md` still promised a narrowed offending
  token span when a parser exposed a structured range, while
  `docs/technical-design.md` and `docs/developers-guide.md` already named the
  whole-body fallback but lacked ADR 0003 cross-references.
  Impact: WI-2 replaced the rule-page promise with the shipped whole-body
  contract and refreshed the design/developer guide wording instead of adding
  new behaviour or tests.
- Observation: WI-3 confirmed the locked SWC parser still leaves the
  span-narrowing seam dormant.
  Evidence: `bun test
  tests/static-analysis/body-syntax-span-narrowing-quarantine.test.ts` passed
  after asserting that the real `parseSync` error yields
  `structuredNormalizedRangeFromParserError(...) === undefined`,
  `parseWorkflowBody(...)` emits `envelope.bodySpan`, and the narrowing helpers
  are absent from the `odw-lint` public entry.
  Impact: the plan's Discovery tolerance did not trigger; WI-3 adds only a
  characterization test and a one-line ADR 0003 pointer in
  `src/static-analysis/workflow-body-parser-spans.ts`, with no production
  behaviour change.

## Decision log

- Decision: quarantine `workflow-body-parser-spans.ts` as an intentionally
  deferred, internal fallback seam rather than wiring a structured-offset parser
  channel.
  Rationale: the load-bearing input is that the locked `@swc/core@^1.15.43`
  `parseSync` throws a JavaScript `Error` carrying rendered prose in `message`
  and no structured, base-resolvable byte offset (pinned by
  `tests/static-analysis/swc-parse-error-surface.test.ts` and the 2.2.6 decision
  log, which explains SWC renders the Rust diagnostic to a caret string before
  it crosses the N-API boundary). Wiring a real channel would require either an
  `@swc/core` bump / different parser (a new dependency — a Tolerances breach)
  or parsing rendered prose (forbidden by ADR 0002 and roadmap 2.2.6). The
  roadmap clause "align ... with the current whole-body fallback" presumes the
  fallback stays shipped. Quarantine is therefore the only in-scope, evidence-
  backed disposition.
  Date/Author: 2026-07-05, planning agent.
- Decision: keep the seam wired into production (`bodySyntaxDiagnosticsForParse`
  keeps calling `narrowedSpanForParserError`) rather than removing the call to
  make the module test-only.
  Rationale: the seam's fallback branches ARE the mechanism that yields the
  shipped whole-body span (the extractor returns `undefined` for real SWC, so
  `narrowBodySyntaxSpan` returns `bodySpan`), so it is not dead code; audit
  decisions 2.2.6.2 and 2.2.6.4 deliberately kept it internal and wired.
  Removing the call would create a production module with no production consumer
  and force a future re-wire. Rejected alternative recorded so a reviewer can
  weigh it.
  Date/Author: 2026-07-05, planning agent.
- Decision: record the decision in a new ADR 0003 and add a one-line
  cross-reference to ADR 0002 rather than amending ADR 0002 in place.
  Rationale: ADR 0002 records the dialect-scope decision; span-narrowing
  disposition is a distinct decision about the same adapter. ADR hygiene favours
  a new record over mixing two decisions; the cross-reference satisfies the
  roadmap's "align ... ADR 0002" wording. Tolerances "Ambiguity" escalates if a
  reviewer rejects this split.
  Date/Author: 2026-07-05, planning agent.
- Decision: prove the chosen contract with a characterization test rather than
  Red-Green-Refactor.
  Rationale: the decision is "keep the shipped behaviour and document it", so
  the pinned behaviour is already correct; there is no natural failing state to
  drive. The execplans skill allows a characterization/golden substitute when
  strict Red-Green does not apply. The test's value is regression protection
  against a silent SWC upgrade and against accidental public export of the
  seam.
  Date/Author: 2026-07-05, planning agent.

## Outcomes & retrospective

Roadmap task 5.5.1 is complete. The delivered contract is that body-syntax span
narrowing is intentionally deferred: the shipped `@swc/core` parser exposes no
structured, base-resolvable syntax-error offset, so `odw/body-syntax`
diagnostics continue to span the whole normalized body while pointing into
original source. ADR 0003 records that quarantine decision, ADR 0002 links to
it, and the rule, design, developer, roadmap, and module documentation now tell
the same story.

The regression coverage pins the chosen contract through
`tests/static-analysis/body-syntax-span-narrowing-quarantine.test.ts`: real SWC
errors produce no structured range, `parseWorkflowBody` keeps the whole-body
fallback, and the narrowing helpers remain absent from the public package
entry. No production rule output, public API, dependency, or parser behaviour
changed.

## Context and orientation

`odw-lint` is a Bun/TypeScript package. Relevant files:

- `src/static-analysis/workflow-body-parser.ts` — the SWC adapter.
  `bodySyntaxDiagnosticsForParse` calls
  `narrowedSpanForParserError(sourceFile, normalized, bodySpan, error)` and
  builds one `odw/body-syntax` diagnostic from the returned span.
- `src/static-analysis/workflow-body-parser-spans.ts` — the dormant seam.
  `narrowedSpanForParserError` composes
  `structuredNormalizedRangeFromParserError` (reads only an allow-list of
  machine-readable fields, never `message`) with `narrowBodySyntaxSpan` (maps a
  structured normalized range back to original source via
  `originalSpanFromNormalizedOffsets`, else returns `bodySpan`). The `@file`
  docstring already states the helpers "remain internal until a real parser
  channel can exercise them".
- `src/static-analysis/workflow-body-parse.ts` — runs
  `parseSync(normalized.normalizedText, { syntax: "ecmascript", jsx: false })`
  and returns a frozen success/failure result.
- `src/index.ts`, `src/static-analysis/index.ts` — the public export surface.
  The narrowing helpers are **not** exported here (verified by search); they
  are internal.

Docs that must end up consistent:

- `docs/rules/body-syntax.md` — user-facing rule doc; lines 22-25 currently
  describe narrowing as an available capability.
- `docs/technical-design.md` — lines 117-123 describe the span mapper and the
  "internal, characterization-tested fallback seam".
- `docs/developers-guide.md` — lines 61-65 (seam is internal) and lines 646-654
  (span snapshot suite; line 654 stale "future narrowing belongs to roadmap
  task 2.2.6").
- `docs/adr/0002-workflow-body-parser-dialect-scope.md` — the parser dialect
  ADR to cross-reference.
- `docs/roadmap.md` — task 5.5.1 checkbox and completion link.

Tests and fixtures:

- `tests/static-analysis/swc-parse-error-surface.test.ts` — pins that SWC
  exposes prose and no structured offset (inline snapshot).
- `tests/static-analysis/workflow-body-parser.test.ts` — pins whole-body span
  equality for both syntax-error fixtures.
- `tests/static-analysis/workflow-body-parser-ranges.test.ts` — pins the
  extractor's behaviour for real and synthetic errors.
- `tests/static-analysis/body-syntax-span-narrowing.test.ts` — pins the pure
  narrowing helper against synthetic structured ranges.

Terms of art:

- *Structured offset*: a machine-readable numeric byte offset or `{ start, end }`
  range on a parser error object, as opposed to text scraped from a rendered
  message.
- *Dormant / quarantined seam*: production code that is present, wired, and
  unit-tested but whose non-fallback branch is never reached by the shipped
  parser.

## Plan of work

Four ordered, independently committable Work Items. Each ends with `make all`;
Markdown-touching items also run `make markdownlint` and `make nixie`. Update
this ExecPlan's `Progress` (and any relevant living section) as part of each
Work Item's commit.

### Work Item 1 — Record the quarantine decision in ADR 0003 and align ADR 0002

Goal: a first-class, reviewable decision record.

Docs to read: `docs/adr/0001-static-analysis-boundary.md` and
`docs/adr/0002-workflow-body-parser-dialect-scope.md` (ADR house style —
Status/Date/Context/Decision/Consequences/Rejected alternative);
`docs/documentation-style-guide.md`; roadmap 5.5.1 (`docs/roadmap.md` lines
1371-1384); this plan's Decision Log. Skills to load: `en-gb-oxendict` for
Oxford spelling; consult `AGENTS.md` "Documentation Maintenance".

Add `docs/adr/0003-body-syntax-span-narrowing-quarantine.md` with:

1. Context: the 2.2.6 seam exists; the locked `@swc/core@^1.15.43` exposes no
   structured syntax-error byte offset (cite the characterization test); wiring
   a channel would need a dependency change or forbidden prose parsing.
2. Decision: quarantine the seam as an intentionally deferred internal
   fallback; ship the whole-body span; keep the seam wired and internal; do not
   export it; re-activation is a future design decision gated on a parser that
   exposes stable, base-resolvable structured offsets.
3. Consequences: user docs describe the whole-body span; the seam stays
   characterization-tested; an `@swc/core` upgrade must re-observe the
   parse-error surface (tie to the developers-guide SWC upgrade checklist).
4. Rejected alternatives: wiring an SWC/alternative parser channel (dependency
   or bump); parsing rendered prose; deleting the seam (loses the tested
   mechanism and the coordinate-base guards a future channel needs).

Edit `docs/adr/0002-workflow-body-parser-dialect-scope.md` Consequences to add
one cross-reference line pointing at ADR 0003 for the span-narrowing
disposition (append-only; do not rewrite the accepted decision).

Tests: none (documentation only). Validation: format the touched Markdown, then
gate.

```bash
bunx mdtablefix docs/adr/0003-body-syntax-span-narrowing-quarantine.md \
  docs/adr/0002-workflow-body-parser-dialect-scope.md \
  docs/execplans/roadmap-5-5-1.md
bunx markdownlint-cli2 --fix \
  docs/adr/0003-body-syntax-span-narrowing-quarantine.md \
  docs/adr/0002-workflow-body-parser-dialect-scope.md \
  docs/execplans/roadmap-5-5-1.md
make markdownlint
make nixie
make all
```

All listed paths exist after this item creates ADR 0003 and this ExecPlan is
already on disk, so the formatter list is path-safe.

### Work Item 2 — Reconcile the rule, design, and developer docs

Goal: the user-facing rule doc and the design/developer guidance describe the
shipped whole-body fallback with narrowing deferred, and reference ADR 0003.

Docs to read: `docs/rules/body-syntax.md`, `docs/technical-design.md` (lines
108-123, sections 8 and 11.5), `docs/developers-guide.md` (lines 52-65 and
646-654), `docs/documentation-style-guide.md`. Skills to load: `en-gb-oxendict`.

Edits:

1. `docs/rules/body-syntax.md` — replace the "When the parser exposes a
   structured byte range ... the diagnostic span narrows to that offending
   token" paragraph (lines 22-25) with an accurate statement: the diagnostic
   spans the whole normalized body (always pointing into original source), and
   token narrowing is an intentionally deferred capability (link ADR 0003). Do
   not promise narrowing users will not observe.
2. `docs/technical-design.md` lines 117-123 — keep the description of the span
   mapper, but state the narrowing path is intentionally deferred per ADR 0003
   and add the cross-reference; ensure it does not imply an active user-facing
   narrowing contract.
3. `docs/developers-guide.md` — refresh the lines 61-65 block to reference ADR
   0003 as the disposition of record, and fix the stale line 654 ("future
   narrowing belongs to roadmap task 2.2.6") to point at the ADR 0003
   quarantine decision and its re-observation trigger.

Tests: none (documentation only). Validation:

```bash
bunx mdtablefix docs/rules/body-syntax.md docs/technical-design.md docs/developers-guide.md docs/execplans/roadmap-5-5-1.md
bunx markdownlint-cli2 --fix docs/rules/body-syntax.md docs/technical-design.md docs/developers-guide.md docs/execplans/roadmap-5-5-1.md
make markdownlint
make nixie
make all
```

All four paths are edited by this item (or already exist), so the list is
path-safe.

### Work Item 3 — Pin the dormant contract and link the module to ADR 0003

Goal: a named regression test that proves the shipped quarantine contract, plus
a one-line code pointer so the seam's docstring names its decision record.

Docs to read: `docs/technical-design.md` sections 8 and 11.5; the 2.2.6
execplan `Decision Log`; `AGENTS.md` "TypeScript Guidance" and the testing
rules. Skills to load: `leta` for symbol navigation and to confirm the export
surface; `en-gb-oxendict` for the test/docstring prose. (Hypothesis, CrossHair,
and mutmut are Python verification tools and do not apply to this Bun/TypeScript
suite; property coverage here uses the repo's `fast-check`, already exercising
the narrowing helper.)

Change (code pointer):

1. `src/static-analysis/workflow-body-parser-spans.ts` — extend the existing
   `@file` docstring to name ADR 0003 as the decision record for the dormant
   status. No behaviour change, no signature change, no new export.

Add characterization test
`tests/static-analysis/body-syntax-span-narrowing-quarantine.test.ts` asserting
the shipped contract (it passes on first run; its value is regression
protection — record this as a characterization test in the commit body):

1. Dormant extractor: build a scanned envelope for a malformed body, normalize
   it, catch the real `parseSync` error with the adapter's parse options, and
   assert `structuredNormalizedRangeFromParserError(error, normalized)` is
   `undefined` (real SWC exposes no structured range). Import the internal
   helper from `../../src/static-analysis/workflow-body-parser-spans`.
2. Whole-body fallback shipped: for at least one real syntax-error fixture (or
   an in-memory malformed body), assert `parseWorkflowBody(envelope)` returns a
   diagnostic whose `span` equals `envelope.bodySpan`, composing the shipped
   adapter with the dormant seam.
3. Seam stays internal: `import * as odwLint from "odw-lint"` and assert
   `narrowedSpanForParserError`, `structuredNormalizedRangeFromParserError`, and
   `narrowBodySyntaxSpan` are `undefined` on the public entry (the seam is
   quarantined, not part of the package API).

Because behaviour is unchanged, there is no Red stage; note in the commit
message and this plan's `Progress` that the test is a characterization/pinning
test per the execplans skill's allowance. If, while writing assertion 1 with
`node_modules` present, the real SWC error is found to expose a structured
base-resolvable offset, stop and escalate per the Tolerances "Discovery"
trigger.

Validation:

```bash
bun test tests/static-analysis/body-syntax-span-narrowing-quarantine.test.ts
make all
bunx mdtablefix docs/execplans/roadmap-5-5-1.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-5-5-1.md
make markdownlint
make nixie
```

The Markdown commands touch only this ExecPlan (updated `Progress`), which
exists, so the list is path-safe. `make all` covers the new test, the
`@file` docstring change, lint, and typecheck.

### Work Item 4 — Tick roadmap task 5.5.1 and record completion

Goal: keep `docs/roadmap.md` the source of truth and record the outcome.

Docs to read: `docs/roadmap.md` lines 1371-1384; the completion-link convention
used by sibling tasks (for example line 794, "Completed by
[roadmap-2-2-6.md](execplans/roadmap-2-2-6.md)."). Skills to load:
`en-gb-oxendict`.

Edits:

1. `docs/roadmap.md` — change `- [ ] 5.5.1.` to `- [x] 5.5.1.` and add a
   "Completed by [roadmap-5-5-1.md](execplans/roadmap-5-5-1.md)." line
   consistent with the surrounding style.
2. This ExecPlan — set `Status: COMPLETE`, complete `Outcomes & Retrospective`,
   and ensure `Progress` ticks every Work Item with timestamps.

Validation:

```bash
bunx mdtablefix docs/roadmap.md docs/execplans/roadmap-5-5-1.md
bunx markdownlint-cli2 --fix docs/roadmap.md docs/execplans/roadmap-5-5-1.md
make markdownlint
make nixie
make all
```

Both paths exist, so the formatter list is path-safe.

## Concrete steps

Run everything from the assigned worktree root. Confirm the branch is
`roadmap-5-5-1` (`git branch --show-current`). Ensure dependencies are present
once (`make build`, which runs `bun install`) so the WI-3 test can invoke
`parseSync`.

Per Work Item, make the edits, format only the touched Markdown, run the gates,
and commit once green (standing rule: commit after each change, gate each
commit). Use `commit-message` conventions and en-GB Oxford spelling. Commit
this ExecPlan first (Status: DRAFT) before any other work, and re-commit after
every revision.

Focused test run during WI-3:

```bash
bun test tests/static-analysis/body-syntax-span-narrowing-quarantine.test.ts
```

Expected: passes on first run and pins the dormant contract; the existing
`swc-parse-error-surface`, `workflow-body-parser`, and
`workflow-body-parser-ranges` suites remain green with unchanged snapshots.

## Validation and acceptance

Per-item gate for every commit:

```bash
make all
```

`make all` runs `build check-fmt whitespace-hygiene lint typecheck test`
(`Makefile`), covering Biome formatting/lint, Oxlint, `tsc --noEmit`, and the
Bun test suite (`AGENTS.md` names `make all` as the repository gate). For any
commit that touches Markdown, also run:

```bash
make markdownlint
make nixie
```

Acceptance (behaviour a human can verify), mapping to the verbatim success
line "documentation and code agree on whether span narrowing is active, inert,
or intentionally deferred, with tests pinning the chosen contract":

1. Decision recorded: `docs/adr/0003-body-syntax-span-narrowing-quarantine.md`
   exists and states the quarantine decision; ADR 0002 cross-references it.
2. Docs agree with code: `docs/rules/body-syntax.md`,
   `docs/technical-design.md`, and `docs/developers-guide.md` describe the
   shipped whole-body span with narrowing intentionally deferred, and the
   `workflow-body-parser-spans.ts` `@file` docstring names ADR 0003.
3. Contract pinned: `bun test
   tests/static-analysis/body-syntax-span-narrowing-quarantine.test.ts` passes,
   proving the real SWC error yields no structured range, `parseWorkflowBody`
   emits the whole-body span, and the seam is absent from the public entry.
4. No behaviour drift: the whole-body snapshots and the span-equality
   assertions in `tests/static-analysis/workflow-body-parser.test.ts` remain
   unchanged.

Quality criteria ("done"):

- Tests: `make test` passes; the new quarantine-contract test passes; existing
  characterization and span suites stay green with unchanged snapshots.
- Lint/typecheck: `make lint` and `make typecheck` pass (covered by `make all`).
- Docs: `make markdownlint` and `make nixie` pass for the Markdown changes.

Quality method: run the commands above in the worktree; the workflow host
independently re-runs `make all` (and the Markdown gates) against committed HEAD
before review and integration.

## Idempotence and recovery

Each Work Item is a separate commit; re-running `make all`, `make markdownlint`,
and `make nixie` is safe and repeatable. If a whole-body snapshot changes in
WI-3, do **not** run `--update-snapshots`: a changed snapshot signals an
unintended behaviour change, so investigate before re-recording. If the WI-3
test cannot be written to pass because SWC now exposes a structured offset,
stop and escalate per the Tolerances "Discovery" trigger rather than weakening
the assertion.

## Artefacts and notes

Planning-session tool notes (per the standing rules): `firecrawl_search`
required interactive approval and was denied in this non-interactive session, so
the external SWC error-surface behaviour was corroborated from the in-repo
pinned characterization test (`tests/static-analysis/swc-parse-error-surface.test.ts`)
and the 2.2.6 `Decision Log` rather than from a live web fetch; `node_modules`
is absent in the worktree, so `parseSync` could not be invoked during planning.
GrepAI and `leta` were available for branch-local navigation.

## Interfaces and dependencies

No new dependencies; no public API change. The internal seam keeps its current
signatures and internal-only visibility:

```ts
// src/static-analysis/workflow-body-parser-spans.ts (unchanged signatures)
export const narrowedSpanForParserError = (
  sourceFile: OriginalSourceFile,
  normalized: NormalizedWorkflowBody,
  bodySpan: SourceSpan,
  error: unknown,
): SourceSpan => { /* structured range → narrow, else bodySpan */ };

export const structuredNormalizedRangeFromParserError = (
  error: unknown,
  normalized: NormalizedWorkflowBody,
): NormalizedByteRange | undefined => { /* allow-listed fields only */ };
```

`parseWorkflowBody` keeps its public signature and `WorkflowBodyParseResult`
return; no span value changes.

## Revision note

Initial draft (2026-07-05). First planning round; no prior design-review points
to address. The decision is to quarantine the dormant span-narrowing seam as an
intentionally deferred internal fallback, backed by the in-repo pinned SWC
no-offset characterization; the load-bearing external behaviour could not be
re-fetched live (firecrawl denied, `node_modules` absent) and is instead pinned
by the WI-3 contract test, with a Tolerances "Discovery" escalation if the
pinned conclusion is contradicted at implementation time.

WI-1 update (2026-07-05). Added ADR 0003, cross-referenced it from ADR 0002,
and indexed the new ADR plus this ExecPlan in `docs/contents.md` so the
repository documentation freshness gate can pass. Remaining work starts at
WI-2 and must not broaden the ADR-only decision already recorded here.

WI-3 update (2026-07-05). Added
`tests/static-analysis/body-syntax-span-narrowing-quarantine.test.ts` as a
characterization/pinning test for the dormant contract and linked the internal
span helper module to ADR 0003. The test passes on the current behaviour rather
than driving a Red-Green production change because the selected disposition is
to keep the shipped whole-body fallback unchanged.

## Addenda

- [x] 5.5.1.1. Consolidate SWC parser-error surface guard scaffolding.
  - Extract one shared real-SWC parse-error capture helper and parser-options
    constant, bind the structured-field surface guard to the production
    allow-list, remove the redundant range assertion, and name the guard in the
    SWC upgrade checklist.
