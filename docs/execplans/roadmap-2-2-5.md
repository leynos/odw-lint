# Adopt message templates in the first parser-backed rule (roadmap 2.2.5)

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Today the only parser-backed rule, `odw/body-syntax`, emits a single fixed
sentence for every workflow-body syntax error: "Workflow body must be
syntactically complete after ODW normalization." Reviewers cannot tell one
syntax failure from another, and fixture parity can only assert that exact
string.

Roadmap task 2.2.5 makes `odw/body-syntax` the first rule to render a
**reviewed diagnostic message template** with real, source-specific parser
detail — for example, "Workflow body must be syntactically complete after ODW
normalization: Expected ';', '}' or &lt;eof&gt;". The reviewed structure stays
fixed and catalogue-owned; only the `{detail}` suffix varies per failure.

After this change, a reader can observe the difference directly:

- Running `bun test tests/static-analysis/workflow-body-parser.test.ts` shows
  the two syntax-error fixture snapshots carrying distinct, parser-derived
  detail after the fixed sentence, instead of the old bare sentence.
- Running `bun test tests/static-analysis/invalid-workflow-metadata-parity.test.ts`
  confirms the real parser output equals the reviewed manifest message
  exactly, and
  `bun test tests/static-analysis/invalid-workflow-fixtures.test.ts` confirms
  that message is accepted by `ruleAllowsMessage` **through the reviewed
  template branch** (`messageTemplates`), not the exact-message branch and not
  a substring assertion. This is the roadmap success criterion.

The mechanism (the branded `MessageTemplate` contract, `createMessageTemplate`,
`renderMessageTemplate`, `messageMatchesTemplate`, and the catalogue
`messageTemplates` field) already exists from task 2.1.8. This task is the
first *adoption* of that mechanism in a production rule.

The diagnostic string uses `normalization` because it preserves the existing
released rule message byte-for-byte. Surrounding prose uses en-GB Oxford
spelling.

## Context and orientation

Assume no prior knowledge of this repository. It is a Bun + TypeScript project.
The relevant files are:

- `src/diagnostics/message-template.ts` — the reviewed message-template
  contract. `createMessageTemplate(text)` parses reviewed template text with
  `{name}` placeholders into an opaque, frozen, branded `MessageTemplate`.
  `renderMessageTemplate(template, values)` renders a concrete message and
  **requires every declared placeholder to be present as an own, non-empty
  string** (it throws on missing, unknown, inherited, or empty values).
  `messageMatchesTemplate(template, message)` answers whether a concrete
  message could have been rendered from the template; matching is whole-message
  and anchored (each placeholder matches one or more characters). These three
  functions are already re-exported from the package entry `src/index.ts`.
- `src/diagnostics/rule-catalogue.ts` — the production source of truth for rule
  metadata. Each `RuleDefinition` has `messages: readonly string[]` (exact
  reviewed messages) and `messageTemplates: readonly MessageTemplate[]`
  (reviewed templates). `ruleDefinition({...})` accepts optional
  `messageTemplates?: readonly string[]` and maps them through
  `createMessageTemplate`. Today every rule leaves `messageTemplates` empty. The
  `odw/body-syntax` entry (around line 150) has a single exact `messages`
  string and no templates. Helpers `ruleDefinitionFor`, `firstReviewedRuleMessage`,
  and `reviewedRuleMessage` read that metadata.
- `src/static-analysis/workflow-body-parser.ts` — the SWC adapter. It calls
  `parseSync(normalized.normalizedText, {syntax: "ecmascript", jsx: false})`
  inside a `try`/`catch`. On any throw it returns a frozen `odw/body-syntax`
  diagnostic whose `message` is the module-level constant
  `BODY_SYNTAX_MESSAGE = firstReviewedRuleMessage(BODY_SYNTAX_RULE_DEFINITION)`.
  The `catch` currently discards the thrown error (`catch {`). It never
  executes workflow source.
- `@swc/core` is declared in `package.json` with the semver range `^1.15.43`
  and resolved to a concrete version by `bun.lock`. `parseSync` throws on
  syntax errors; the existing tests
  `tests/static-analysis/workflow-body-parser.test.ts` and
  `tests/static-analysis/body-diagnostic-spans.test.ts` already exercise this
  path and snapshot the resulting diagnostics.

Test and fixture surfaces this task touches:

- `tests/diagnostics/rule-catalogue.test.ts` — the catalogue contract test. The
  case "records empty reviewed message templates for current rules" (around
  line 222) asserts **every** rule's `messageTemplates` equals `[]`. This will
  fail the moment `odw/body-syntax` gains a template and must be updated in the
  same commit that adds the template. The case "records messages for released
  rules with invalid fixture diagnostics" (line 207) asserts every rule that
  owns an invalid-fixture diagnostic has `messages.length > 0`.
- `tests/static-analysis/invalid-workflow-fixtures.test.ts` — defines the local
  helper `ruleAllowsMessage(rule, message)` which returns true when the message
  is in `rule.messages` (exact branch) or matches any entry in
  `rule.messageTemplates` via `messageMatchesTemplate` (template branch).
  The case "matches fixture diagnostics to the rule catalogue" asserts
  `ruleAllowsMessage(rule, diagnostic.message)` for every manifest diagnostic.
  The case "accepts reviewed templates without allowing near-miss messages"
  already references the exact intended template text
  `"Workflow body must be syntactically complete after ODW normalization: {detail}"`.
  The case "records the expected metadata status and rule coverage" asserts the
  set of fixture-referenced rule ids equals the set of catalogue rules with
  `messages.length > 0`.
- `tests/static-analysis/invalid-workflow-metadata-parity.test.ts` — the case
  "matches body syntax diagnostics for syntax-error fixtures" runs the **real**
  parser (`parseWorkflowBody`) on the two syntax-error fixtures and asserts,
  via `toEqual`, that the emitted `{rule, severity, message, span, spanText}`
  equals the manifest's stored diagnostic. This is an **exact** comparison, so
  the manifest `message` must equal the real rendered message byte-for-byte.
- `tests/static-analysis/fixtures/invalid-workflows/manifests/syntax-error.ts`
  — the two syntax-error fixture manifest entries. Each stores
  `message: "Workflow body must be syntactically complete after ODW normalization."`
  today. The header comment marks the file as generated by
  `tests/static-analysis/fixtures/refresh-metadata.ts`; the refresh tooling
  recomputes only `sha256`, `span`, and `spanText` from source anchors and
  **preserves** `message` (verified in `refresh-derivation.ts` /
  `refresh-writers.ts`, which never derive the message field), so hand-editing
  `message` is safe and survives a refresh.
- `tests/static-analysis/__snapshots__/workflow-body-parser.test.ts.snap` — two
  snapshot entries that include the `message` field and must be regenerated.
  `tests/static-analysis/__snapshots__/body-diagnostic-spans.test.ts.snap` does
  **not** include `message` (its `snapshotForDiagnostic` captures only rule,
  severity, span, spanText), so it is unaffected.
- `tests/diagnostics/architecture-fixtures.ts` — `EXPECTED_STATIC_ANALYSIS_MODULE_FILES`
  (around line 37) enumerates every file under `src/static-analysis/`. The
  readdir-based module-inventory guard in `tests/diagnostics/architecture.test.ts`
  (task 2.1.12.1) fails if a static-analysis module is added without updating
  this list. Adding a new extractor module requires one edit here.
  `tests/diagnostics/public-api-fixtures.ts` enumerates the package-entry
  exports; this task adds **no** new public export, so it is not touched.

Design authority for this task:

- `docs/technical-design.md` §8 (diagnostic contract: "`message` must equal one
  of the exact message strings recorded for the rule in the catalogue or match
  one of that rule's reviewed message templates. Templates are reserved for
  dynamic parser-backed diagnostics") and the paragraph beginning "Reviewed
  message templates keep dynamic diagnostics inside the same catalogue
  contract" (placeholder grammar, non-empty render values, whole-message
  matching).
- `docs/technical-design.md` §§6.1 and 11.5 (body parsing and original-source
  span mapping) and §9.1 (dialect rule intent).
- `docs/developers-guide.md` "Message templates" (authoring guidance;
  `messageTemplates` are authored as raw strings in the catalogue, empty until
  a rule "emits dynamic parser-backed diagnostics") and "Rule catalogue and
  documentation parity".
- `docs/adr/0001-static-analysis-boundary.md` (SWC is the owned static parser;
  never execute workflow source).
- `AGENTS.md` — file-size limit (no code file over 400 lines), testing rules
  (deterministic `bun test`; happy/unhappy/edge coverage; snapshots paired with
  semantic assertions and normalized nondeterministic fields; `fast-check` for
  input ranges; dependency injection over process-global mutation), en-GB
  Oxford spelling, and the `make all` commit gate.

Roadmap 2.2.5 requires tasks 2.1.8 (template mechanism — done) and 2.2.1
(parser adapter — done). Both are complete on this branch.

## Constraints

- Do not execute workflow source anywhere in production code. The new detail
  extractor consumes only the *thrown SWC error value* (a diagnostic string),
  never fixture source, and performs pure string manipulation
  (ADR 0001; `docs/technical-design.md` §5).
- Do not change the diagnostic object shape, the `odw/body-syntax` rule id,
  category, default severity (`error`), docs slug, or `docs` path. `schemaVersion`
  must not change (`docs/technical-design.md` §8).
- Keep the existing exact reviewed message
  "Workflow body must be syntactically complete after ODW normalization." in
  `odw/body-syntax.messages`. It stays live as the **no-detail fallback**
  (emitted when the parser produces no usable detail), which keeps the
  catalogue truthful and keeps the coverage invariants
  (`messages.length > 0` for fixture-owning rules) green without editing those
  tests.
- The diagnostic `span` remains the whole normalized body span mapped to
  original source. Narrowing the span to the offending token is explicitly
  out of scope; that is roadmap task 2.2.6.
- Do not add a new package-entry (`src/index.ts`) export. The new extractor and
  any new catalogue helper are internal, imported by production code and tests
  via relative `../../src/...` paths, matching the existing internal-module
  test pattern (`tests/static-analysis/source-mask-internals.test.ts`).
- No new runtime dependency. `renderMessageTemplate`, `messageMatchesTemplate`,
  `createMessageTemplate`, and `@swc/core` already exist.
- Every code file stays at or under 400 lines (`AGENTS.md`).
- All prose, comments, and commit messages use en-GB Oxford spelling
  (`-ize`/`-yse`/`-our`).

## Tolerances (exception triggers)

- Scope: if delivery requires touching more than 8 files (net) beyond those
  named in this plan, stop and escalate.
- Interface: if any package-entry (`src/index.ts`) export must change, or the
  `Diagnostic` type must change, stop and escalate.
- Dependencies: if a new dependency is required, stop and escalate.
- Parser detail quality: if the observed SWC detail for the two fixtures is
  empty, non-deterministic across two consecutive local runs, or leaks raw
  fixture source lines / box-drawing characters into the message, stop and
  escalate before committing (see Risks and the WI-3 refinement note). Do not
  paper over it by weakening the extractor to a hard-coded constant.
- Iterations: if the parity or snapshot tests still fail after 3 focused
  attempts, stop and escalate.
- Ambiguity: if any reviewed message string would need to embed a value that is
  not a stable, single-line summary, stop and present options.

## Risks

- Risk: SWC error prose is version-coupled. The exact `{detail}` text depends
  on the `@swc/core` version resolved in `bun.lock`, so an SWC upgrade could
  change the two reviewed fixture messages and the parser snapshot.
  Severity: medium. Likelihood: low (the resolved version is locked in
  `bun.lock`).
  Mitigation: the detail flows through a single extractor seam
  (`workflow-body-syntax-detail.ts`); the two exact strings are pinned by the
  parser snapshot and the parity `toEqual`; on an intentional SWC bump the
  reviewer re-observes and updates both in one change, exactly like any
  lockfile-pinned third-party snapshot.
- Risk: the exact SWC first-line format could not be executed during planning
  (see Surprises), so the extractor's line-selection heuristic is designed
  defensively rather than against observed output.
  Severity: medium. Likelihood: medium.
  Mitigation: WI-2 pins the *sanitization contract* with synthetic-input unit
  tests that never touch SWC; WI-3 captures the *real* detail from a failing
  snapshot and records it. If the observed detail is noisy, WI-3's refinement
  note narrows line selection to the miette marker line before recording.
- Risk: `renderMessageTemplate` throws on an empty placeholder value.
  Severity: high if unhandled. Likelihood: low.
  Mitigation: the parser only renders the template when `detail.length > 0`;
  otherwise it emits the fallback exact message. WI-2 unit-tests the empty and
  non-`Error` throw cases to guarantee the extractor returns `""` rather than
  throwing, and WI-3 tests the fallback branch.
- Risk: the two syntax-error fixtures might both yield the *same* detail,
  making the "distinct detail" demonstration weak.
  Severity: low. Likelihood: low (unclosed `{` vs unclosed `(` differ).
  Mitigation: acceptable either way; the success criterion is template-branch
  parity, not distinctness. Record the observed strings in Decision Log.

## Progress

- [x] WI-1: Add the reviewed `odw/body-syntax` message template to the
  catalogue and update the catalogue template-emptiness test.
- [x] WI-2: Add the import-safe parser-detail extractor module with
  deterministic synthetic-input unit tests and register it in the module
  inventory fixture.
- [x] WI-3: Render the template in the body parser, capture the real parser
  detail into the syntax-error manifest and snapshot, and assert
  template-branch parity.
- [x] WI-4: Update the developer guide and the `odw/body-syntax` rule doc for
  the dynamic message.

## Surprises & discoveries

- Observation: the planning session could not execute Bun or `@swc/core`.
  Evidence: `bun` invocations were denied by the sandbox, filesystem access
  outside the worktree was blocked, and `node_modules/@swc/core` is not present
  in this worktree. Impact: the exact SWC first-line prose is not quoted in
  this plan; WI-3 captures it from a real failing snapshot, and WI-2 pins the
  extractor contract with SWC-independent synthetic inputs. The SWC integration
  facts used here are grounded in the `@swc/core` semver range `^1.15.43`, the
  lockfile-resolved package version, the existing `parseSync` call site in
  `workflow-body-parser.ts`, and the existing parser/span snapshot tests that
  already drive that path.
- Observation: the implementation worktree initially lacked installed
  dependencies, so the first focused `bun test
  tests/diagnostics/rule-catalogue.test.ts` failed before tests ran with
  `Cannot find module '@swc/core'`. Running `make build` installed the locked
  dependencies; the focused catalogue test then passed.
  Impact: dependency installation is an environment setup step, not a code
  issue. Later `make all` gates passed.
- Observation: CodeRabbit hit a rate limit once during WI-1 review with
  `Rate limit exceeded`. The workflow slept for 61 minutes with `vsleep` and
  retried; subsequent actionable review findings were resolved, and the final
  CodeRabbit pass returned zero findings.
  Impact: no open review issue remains for WI-1.
- Observation: the first WI-2 `make all` failed in Oxlint because the new
  private helpers `textFromThrownValue` and `firstNonEmptyLine` needed JSDoc
  under the repository lint rules.
  Impact: adding concise helper-contract comments fixed the lint failure; the
  focused extractor tests, architecture inventory test, `make all`, and
  CodeRabbit review then passed.
- Observation: SWC produced stable, single-line syntax details for both
  syntax-error fixtures across two consecutive parser test runs:
  `Expected '}', got '<eof>'` for `body-unclosed-block.js`, and
  `Expected ',', got '}'` for `body-unclosed-call.js`.
  Impact: the extractor did not need refinement; the messages were recorded in
  the syntax-error manifest and parser snapshot.
- Observation: after recording dynamic messages, the fixture refresh dry-run
  initially reported `syntax-error.ts` in `wouldWritePaths` because the refresh
  generator wrote long `message` fields on one line while Biome required them
  wrapped.
  Impact: WI-3 added a `messageProperty` helper in
  `tests/static-analysis/fixtures/refresh-manifest-source.ts`, mirroring the
  existing `spanTextProperty` wrapping seam. After regenerating the manifest
  and updating refresh report snapshots, refresh dry-run reported no drift and
  `make all` passed.
- Observation: `docs/roadmap.md` still marked roadmap task 2.2.5 incomplete
  after the code-facing work was implemented.
  Impact: WI-4 updated the roadmap entry with a completion note alongside the
  technical design, developer guide, and rule documentation so the source of
  truth reflects the shipped behaviour.

## Decision log

- Decision: keep the existing exact `odw/body-syntax` message as a no-detail
  fallback and add the template alongside it, rather than making the rule
  template-only.
  Rationale: template-only would empty `odw/body-syntax.messages`, which breaks
  the coverage invariants in `rule-catalogue.test.ts` ("records messages for
  released rules with invalid fixture diagnostics") and in
  `invalid-workflow-fixtures.test.ts` ("records the expected metadata status
  and rule coverage"), forcing wider test churn. Keeping the exact message as a
  genuinely-emitted fallback (used when the parser yields no detail) keeps both
  the exact and template branches live and keeps those invariants green with no
  edit. Both strings are reviewed and reachable.
  Date/Author: 2026-07-03, planning agent.
- Decision: place the detail extractor in a new focused module
  `src/static-analysis/workflow-body-syntax-detail.ts` rather than inlining it
  in the parser.
  Rationale: a dedicated module gives the sanitization contract a direct,
  SWC-independent unit-test home (mirroring `source-mask-internals.test.ts`),
  keeps `workflow-body-parser.ts` small, and matches the repository's
  focused-module convention. Cost is one entry in
  `EXPECTED_STATIC_ANALYSIS_MODULE_FILES`.
  Date/Author: 2026-07-03, planning agent.
- Decision: the reviewed template text is
  `"Workflow body must be syntactically complete after ODW normalization: {detail}"`.
  Rationale: it is the exact string already anticipated by the 2.1.8 test
  "accepts reviewed templates without allowing near-miss messages", extends the
  existing exact sentence with a single `{detail}` placeholder, and satisfies
  the placeholder grammar (ASCII-letter start).
  Date/Author: 2026-07-03, planning agent.
- Decision: keep the newly added `firstReviewedRuleTemplate(...)` helper
  internal to `src/diagnostics/rule-catalogue.ts`.
  Rationale: WI-3 needs a production accessor for parser wiring and internal
  tests, but the roadmap explicitly avoids expanding the package entry surface.
  Tests import the helper by relative path, matching the existing internal test
  pattern.
  Date/Author: 2026-07-03, implementation agent.
- Decision: update the fixture refresh manifest generator during WI-3.
  Rationale: dynamic parser messages made `syntax-error.ts` long enough that
  the generated manifest and Biome formatting disagreed. Teaching the generator
  to wrap long `message` properties keeps refresh idempotent and avoids
  hand-maintained generated output.
  Date/Author: 2026-07-03, implementation agent.

## Outcomes & retrospective

Delivered. `odw/body-syntax` now carries the reviewed `{detail}` template and
the parser renders SWC syntax detail through it when available. The two
syntax-error fixtures record distinct parser-derived messages accepted through
the template branch, not the exact fallback. The exact reviewed message remains
reachable as the no-detail fallback. The fixture refresh generator now wraps
long generated `message` fields so refreshed manifests remain Biome-clean and
idempotent.

## Plan of work

The work is four ordered, independently committable stages. Each ends with the
full repository gate `make all`. Stages follow Red-Green-Refactor: write or
update the smallest failing test, make it pass with the minimal production
change, then tidy.

### WI-1: Add the reviewed body-syntax message template to the catalogue

Implements `docs/technical-design.md` §8 (templates are catalogue-owned) and
§9.1; `docs/developers-guide.md` "Message templates".

Read first: `docs/technical-design.md` §8 (the "Reviewed message templates"
paragraph); `docs/developers-guide.md` "Message templates"; `AGENTS.md`
testing and file-size rules. Skills to load: `execplans` (this document);
`en-gb-oxendict` for all prose. No language router applies (TypeScript); follow
`biome.jsonc`/`.oxlintrc.json` conventions already in force.

First, in `tests/diagnostics/rule-catalogue.test.ts`, change the case "records
empty reviewed message templates for current rules" so it asserts the reviewed
contract instead of blanket emptiness: every rule *except* `odw/body-syntax`
keeps `messageTemplates` deep-equal to `[]`, and `odw/body-syntax` has exactly
one `MessageTemplate` equal to
`createMessageTemplate(...)` with the reviewed body-syntax detail template text.
Assert with `messageMatchesTemplate(...)` that the template accepts a concrete
parser-detail message. Keep the frozen-array and `expectTypeOf` assertions. Run
`bun test tests/diagnostics/rule-catalogue.test.ts` and confirm it fails because
the catalogue template is absent.

Then, in `src/diagnostics/rule-catalogue.ts`, add a `messageTemplates` array
holding the single reviewed template string
`Workflow body must be syntactically complete after ODW normalization: {detail}`
to the `odw/body-syntax` `ruleDefinition({...})` call, keeping its existing
`messages` entry unchanged. Re-run the focused test to green. No refactor is
expected; confirm no other rule gained a template.

Tests (unit): the updated `rule-catalogue.test.ts` case is the specification.
No production behaviour changes yet — the parser still emits the exact message,
so `invalid-workflow-*` and parity suites stay green (the manifest message is
still in `messages`, matched via the exact branch).

Validation: `make all`.

### WI-2: Add the import-safe parser-detail extractor with unit tests

Implements ADR 0001 (import-safe static analysis) and `docs/technical-design.md`
§8 (dynamic detail feeding a reviewed template). Registers the module in the
2.1.12.1 inventory guard.

Read first: `tests/static-analysis/source-mask-internals.test.ts` (internal
relative-import test pattern); `src/static-analysis/workflow-body-parser.ts`
(the `catch` site that will supply the error); `AGENTS.md` testing rules.
Skills: `execplans`, `en-gb-oxendict`.

- Create `src/static-analysis/workflow-body-syntax-detail.ts` exporting a pure
  function `bodySyntaxDetail(error: unknown): string` that uses only
  parser-owned textual error payloads:
  - Use `error.message` when `error` is an object with an own string `message`.
  - Use `String(error)` for primitive string, number, boolean, bigint or symbol
    throws.
  - Return `""` for `null`, `undefined`, generic object throws without an own
    string `message`, and values whose coercion would throw. This avoids
    exposing unreviewed object serialisations such as `[object Object]`.
  - Split usable text on line terminators and take the first non-empty, trimmed
    line.
  - Strip a leading miette/SWC marker if present (a leading `×`/`x` glyph, or a
    leading `Syntax Error:`/`Syntax Error` prefix) and any leading punctuation
    left behind.
  - Collapse internal whitespace runs to single spaces and trim.
  - Truncate to a bounded maximum length (define a module constant, e.g. 200
    characters) so a single line cannot bloat the message.
  - Return `""` when nothing usable remains.
  The module performs only string operations and imports nothing from
  `diagnostics` or `@swc/core`, keeping it import-safe.
- Register the module: add `"workflow-body-syntax-detail.ts"` to
  `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` in
  `tests/diagnostics/architecture-fixtures.ts`, in sorted position.
- Red then Green: add `tests/static-analysis/workflow-body-syntax-detail.test.ts`
  importing `bodySyntaxDetail` via `../../src/static-analysis/workflow-body-syntax-detail`.
  Cover, with table-driven cases (happy/unhappy/edge, per `AGENTS.md`):
  a multi-line miette-shaped input (marker summary line plus a boxed source
  excerpt and `,-[1:19]` position line) reduces to the cleaned summary line and
  drops the excerpt; a leading `×`/`x`/`Syntax Error` marker is stripped;
  interior whitespace is collapsed; an overlong single line is truncated to the
  bound; empty string, whitespace-only string, `undefined`, `null`, a number,
  and an object without a string `message` each return `""`; and — as an
  invariant — `bodySyntaxDetail` never throws for any of these. Optionally add a
  small `fast-check` property that `bodySyntaxDetail` returns a single-line
  string no longer than the bound for arbitrary strings. These inputs are
  synthetic, so the test is fully deterministic and independent of SWC.
- Refactor: keep the module under 400 lines (it will be far smaller).

Tests (unit + optional property): the new extractor test file. This stage does
not wire the extractor into the parser, so all existing suites stay green.

Validation: `make all` (the architecture inventory guard now expects the new
module).

### WI-3: Render the template in the parser and pin the real detail

Implements `docs/technical-design.md` §8 (message equals a reviewed template
match) and §§6.1/11.5 (parser diagnostics on original-source spans); the
roadmap 2.2.5 success criterion.

Read first: `src/static-analysis/workflow-body-parser.ts`;
`tests/static-analysis/workflow-body-parser.test.ts` and its snapshot;
`tests/static-analysis/invalid-workflow-metadata-parity.test.ts`;
`tests/static-analysis/invalid-workflow-fixtures.test.ts` (the `ruleAllowsMessage`
helper and the "accepts reviewed templates" case);
`tests/static-analysis/fixtures/invalid-workflows/manifests/syntax-error.ts`;
`docs/developers-guide.md` "Workflow Fixture Corpus" (refresh behaviour).
Skills: `execplans`, `en-gb-oxendict`.

- Add a catalogue accessor `firstReviewedRuleTemplate(rule: RuleDefinition): MessageTemplate`
  in `src/diagnostics/rule-catalogue.ts`, mirroring `firstReviewedRuleMessage`:
  return `rule.messageTemplates[0]`, throwing a clear error
  (`Missing reviewed diagnostic message template 0 for ${rule.id}.`) when
  absent. Add a focused unit case in `rule-catalogue.test.ts` proving it
  returns the `odw/body-syntax` template and throws for a rule without
  templates (e.g. `odw/bounded-loop`). Do **not** re-export it from
  `src/index.ts`.
- Wire the parser in `src/static-analysis/workflow-body-parser.ts`:
  - Import `renderMessageTemplate` from `../diagnostics/message-template`,
    `firstReviewedRuleTemplate` from `../diagnostics/rule-catalogue`, and
    `bodySyntaxDetail` from `./workflow-body-syntax-detail`.
  - Add a module constant
    `BODY_SYNTAX_TEMPLATE = firstReviewedRuleTemplate(BODY_SYNTAX_RULE_DEFINITION)`.
  - Change the `catch` to bind the error (`catch (error) {`) and pass it into
    `bodySyntaxDiagnostic(envelope, error)`.
  - In `bodySyntaxDiagnostic`, compute `const detail = bodySyntaxDetail(error);`
    and set `message = detail.length > 0
      ? renderMessageTemplate(BODY_SYNTAX_TEMPLATE, { detail })
      : BODY_SYNTAX_MESSAGE;`. Keep the diagnostic frozen and unchanged
    otherwise. Keep `BODY_SYNTAX_MESSAGE` (the fallback).
- Capture the real detail (Red → observe → record):
  1. Run `bun test tests/static-analysis/workflow-body-parser.test.ts`. The two
     "converts ... to body diagnostics" snapshots now fail: the emitted
     `message` includes the parser detail suffix.
  2. Inspect the actual emitted `message` for
     `syntax-error/body-unclosed-block.js` and
     `syntax-error/body-unclosed-call.js` (from the snapshot diff). Confirm each
     is a single-line, deterministic string of the form
     `Workflow body must be syntactically complete after ODW normalization: <detail>`.
     Re-run once to confirm the detail is byte-stable. If a detail is empty,
     multi-line, or embeds raw fixture source, apply the refinement note below
     before recording, and if it still cannot be made a clean single-line
     summary, stop and escalate (Tolerances).
  3. Record the two observed messages verbatim into the `message` fields of the
     two entries in
     `tests/static-analysis/fixtures/invalid-workflows/manifests/syntax-error.ts`,
     escaping quotes/backslashes for the TypeScript string literal. Note the two
     observed strings in this plan's Decision Log.
  4. Regenerate the parser snapshot only after confirming the change is
     intentional: `bun test tests/static-analysis/workflow-body-parser.test.ts --update-snapshots`.
- Add the semantic template-branch assertion (pairs with the snapshot per
  `AGENTS.md`): in `tests/static-analysis/workflow-body-parser.test.ts`,
  resolve the `odw/body-syntax` rule via
  `ruleDefinitionFor(makeRuleId("odw/body-syntax"))` and its template via
  `firstReviewedRuleTemplate(...)`. For each syntax-error fixture, assert that
  `messageMatchesTemplate(template, diagnostic.message)` is true and that
  `diagnostic.message` does **not** equal the exact fallback `rule.messages[0]`
  (so the template branch, not the exact branch, is what accepts it). Import the
  needed helpers from `odw-lint`.
- Confirm parity with no further edits:
  `tests/static-analysis/invalid-workflow-metadata-parity.test.ts`
  ("matches body syntax diagnostics") now compares the real parser message with
  the recorded manifest message via `toEqual` — green once the manifest matches.
  `tests/static-analysis/invalid-workflow-fixtures.test.ts`
  ("matches fixture diagnostics to the rule catalogue") accepts the manifest
  message through `ruleAllowsMessage`'s template branch, because the recorded
  dynamic message is not in `messages`. This is the roadmap success criterion.
- Refinement note (only if the observed detail is noisy): tighten
  `bodySyntaxDetail` line selection to prefer the line beginning with the
  miette marker glyph (`×`/`x`) before falling back to the first non-empty line,
  and re-run WI-2's synthetic tests (add a case for the marker-line preference)
  plus this stage. This keeps the sanitization contract test-pinned.
- Confirm no refresh drift by running the fixture refresh in dry-run mode
  (`bun run tests/static-analysis/fixtures/refresh-metadata.ts --dry-run`) and
  confirm it reports no changes to the syntax-error manifest (the message field
  is preserved by refresh).

Tests (unit + snapshot + parity): updated `workflow-body-parser.test.ts`
(snapshot + new `messageMatchesTemplate` assertions), `rule-catalogue.test.ts`
(new accessor case), and the now-green
`invalid-workflow-metadata-parity.test.ts` and
`invalid-workflow-fixtures.test.ts` (unchanged, re-run to prove green).

Validation: `make all`.

### WI-4: Update the developer guide and rule documentation

Implements `docs/developers-guide.md` upkeep and
`docs/documentation-style-guide.md`; `AGENTS.md` "update documentation for
behaviour changes".

Read first: `docs/developers-guide.md` "Message templates";
`docs/rules/body-syntax.md`; `docs/documentation-style-guide.md`;
`docs/scripting-standards.md` (only if editing any script — none here). Skills:
`execplans`, `en-gb-oxendict`, `documentation-style-guide` conventions.

- In `docs/technical-design.md` §8, add a short rule-specific note that
  `odw/body-syntax` is the first reviewed-template diagnostic and renders
  parser syntax detail into `{detail}`, while keeping the exact message as the
  no-detail fallback.
- In `docs/developers-guide.md` "Message templates", revise the sentence
  "Current rules keep `messageTemplates` empty until they emit dynamic
  parser-backed diagnostics." to record that `odw/body-syntax` now carries a
  reviewed template rendering source-specific parser detail, while other rules
  remain exact-message only. Keep the placeholder-grammar and matching
  paragraphs accurate.
- In `docs/rules/body-syntax.md`, add one sentence (below the existing
  description, before the examples) noting that the diagnostic message appends
  the parser's syntax-error detail after the fixed sentence
  (e.g. "…after ODW normalization: &lt;parser detail&gt;"), without quoting a
  specific SWC string, so the doc does not couple to a parser version.
- Format only the changed Markdown files with the project's file-scoped
  Markdown formatter entry points, then validate with `make markdownlint`,
  `make nixie`, and `make all`.

Tests: none (documentation only), but the doc changes are validated by the
markdown gates.

Validation: `make all`, plus `make markdownlint` and `make nixie` for the
Markdown changes.

## Concrete steps

Run everything from the checked-out worktree root.

1. WI-1: edit `src/diagnostics/rule-catalogue.ts` and
   `tests/diagnostics/rule-catalogue.test.ts`, then:

   ```bash
   bun test tests/diagnostics/rule-catalogue.test.ts
   make all
   ```

   Expect the focused test to fail before the catalogue edit and pass after,
   and `make all` to pass. Commit.

2. WI-2: add `src/static-analysis/workflow-body-syntax-detail.ts`,
   `tests/static-analysis/workflow-body-syntax-detail.test.ts`, and the
   inventory entry in `tests/diagnostics/architecture-fixtures.ts`, then:

   ```bash
   bun test tests/static-analysis/workflow-body-syntax-detail.test.ts
   bun test tests/diagnostics/architecture.test.ts
   make all
   ```

   Expect the extractor test to fail before the module exists and pass after,
   the architecture guard to pass once the inventory is updated, and `make all`
   to pass. Commit.

3. WI-3: edit `src/diagnostics/rule-catalogue.ts` (accessor),
   `src/static-analysis/workflow-body-parser.ts`,
   `tests/static-analysis/workflow-body-parser.test.ts`, and record the observed
   messages in
   `tests/static-analysis/fixtures/invalid-workflows/manifests/syntax-error.ts`:

   ```bash
   bun test tests/static-analysis/workflow-body-parser.test.ts
   # inspect the failing snapshot to read the real messages, record them in the
   # manifest, then:
   bun test tests/static-analysis/workflow-body-parser.test.ts --update-snapshots
   bun test tests/static-analysis/invalid-workflow-metadata-parity.test.ts
   bun test tests/static-analysis/invalid-workflow-fixtures.test.ts
   bun run tests/static-analysis/fixtures/refresh-metadata.ts --dry-run
   make all
   ```

   Expect: the parser snapshot to change to the dynamic messages; parity and
   fixture-catalogue suites green; the refresh dry-run to report no manifest
   drift; `make all` to pass. Commit.

4. WI-4: edit `docs/technical-design.md`, `docs/developers-guide.md`, and
   `docs/rules/body-syntax.md`, then:

   ```bash
   make markdownlint
   make nixie
   make all
   ```

   Expect all markdown gates and `make all` to pass. Commit.

## Validation and acceptance

Acceptance is behavioural and observable:

- `bun test tests/static-analysis/workflow-body-parser.test.ts` — the two
  "converts ... to body diagnostics" snapshots show a `message` of the form
  `Workflow body must be syntactically complete after ODW normalization: <detail>`
  with real, distinct parser detail, and the new assertions prove each message
  is accepted by `messageMatchesTemplate` against the catalogue template and is
  not equal to the exact fallback message.
- `bun test tests/static-analysis/invalid-workflow-metadata-parity.test.ts` —
  "matches body syntax diagnostics for syntax-error fixtures" passes: the real
  parser message equals the reviewed manifest message exactly.
- `bun test tests/static-analysis/invalid-workflow-fixtures.test.ts` — "matches
  fixture diagnostics to the rule catalogue" passes with the syntax-error
  diagnostic accepted through the `messageTemplates` branch of
  `ruleAllowsMessage` (the recorded dynamic message is absent from `messages`).
  This is the roadmap 2.2.5 success criterion.
- `bun test tests/diagnostics/rule-catalogue.test.ts` — `odw/body-syntax` has
  exactly one reviewed template; all other rules keep `messageTemplates` empty.
- `bun test tests/static-analysis/workflow-body-syntax-detail.test.ts` — the
  extractor sanitizes synthetic SWC-shaped inputs, never throws, and returns
  `""` for empty or non-`Error` throws.

Quality criteria ("done"):

- Tests: `make test` passes; the new and updated suites above pass; the two
  new red tests failed for the intended reason before their implementation.
- Lint/format/typecheck: `make all` passes (`build`, `check-fmt`,
  `whitespace-hygiene`, `lint` via Biome and Oxlint, `typecheck`, `test`).
- Docs: `make markdownlint` and `make nixie` pass for the Markdown changes.
- File size: every changed/added code file is at or under 400 lines.

Quality method: `make all` (full commit gate) is run before each commit; the
Markdown gates are run for WI-4.

## Idempotence and recovery

- Every step is re-runnable. `make all` and the focused `bun test` commands are
  read-only against the repository except for `--update-snapshots`, which is
  applied only in WI-3 after confirming the message change is intentional.
- The fixture refresh is run in `--dry-run` mode only, to confirm no drift; it
  writes nothing.
- If a snapshot update is applied prematurely, `git checkout --
  tests/static-analysis/__snapshots__/workflow-body-parser.test.ts.snap`
  restores it; re-run WI-3 from the capture step.
- No destructive or outward-facing actions are involved.

## Interfaces and dependencies

- `src/static-analysis/workflow-body-syntax-detail.ts` (new):

  ```typescript
  // Import-safe: pure string reduction of a thrown parser error into a single,
  // bounded, reviewable detail line. Returns "" when no usable detail exists.
  export const bodySyntaxDetail = (error: unknown): string => { /* ... */ };
  ```

- `src/diagnostics/rule-catalogue.ts` (add): `messageTemplates` on
  `odw/body-syntax`, and

  ```typescript
  export const firstReviewedRuleTemplate = (rule: RuleDefinition): MessageTemplate => { /* ... */ };
  ```

- `src/static-analysis/workflow-body-parser.ts` (change): the `odw/body-syntax`
  diagnostic `message` becomes
  `renderMessageTemplate(BODY_SYNTAX_TEMPLATE, { detail })` when
  `bodySyntaxDetail(error)` is non-empty, else the existing exact
  `BODY_SYNTAX_MESSAGE`. `WorkflowBodyParseResult` and the diagnostic shape are
  unchanged.
- Existing contracts relied upon (unchanged): `createMessageTemplate`,
  `renderMessageTemplate`, `messageMatchesTemplate`, `MessageTemplate`
  (`src/diagnostics/message-template.ts`); `@swc/core` `parseSync`
  (`^1.15.43`, locked).

## Revision note

Initial draft (2026-07-03). Establishes the four-stage plan: catalogue template
(WI-1), import-safe detail extractor with synthetic-input tests (WI-2), parser
wiring with real-detail capture into the manifest and snapshot plus
template-branch parity (WI-3), and documentation (WI-4). Records the planning
constraint that SWC could not be executed in-session, so the exact `{detail}`
strings are pinned by the parser snapshot and parity `toEqual` at
implementation time rather than quoted here, while the extractor's sanitization
contract is pinned by SWC-independent unit tests.
