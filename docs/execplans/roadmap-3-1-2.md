# Implement deterministic-time and randomness warnings (roadmap 3.1.2)

This ExecPlan (execution plan) is a living document. The sections `Constraints`,
`Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: IN PROGRESS

## Purpose / big picture

Roadmap task 3.1.2 makes `odw-lint` warn when a workflow uses wall-clock or
randomness primitives that Claude Code rejects because they break deterministic
run resumption: `Date.now()`, `Math.random()`, and arg-less `new Date()`. These
three rules already exist in the catalogue
(`src/diagnostics/rule-catalogue.ts`) and have documentation pages under
`docs/rules/`, but nothing emits them yet: the merged lint pipeline in
`src/static-analysis/workflow-lint.ts` only reports envelope and metadata
diagnostics.

After this change, running the static lint over a workflow body such as

```js
export const meta = { name: "x", description: "y" };
const t = Date.now();
const r = Math.random();
const started = new Date();
```

produces three `claude-compatibility` warnings — `odw/no-date-now`,
`odw/no-math-random`, and `odw/no-argless-new-date` — each with an
original-source span that points at the offending expression, while a workflow
that mentions those tokens only inside strings, comments, regex literals, or
template text produces none. The nine trusted ODW example fixtures (which
contain none of these patterns) continue to produce zero claude-compatibility
diagnostics, proving no false positives on trusted input.

Observable success: the new Bun tests fail before implementation and pass after;
`make all` is green; and `lintWorkflowSource` returns the three warnings in
canonical order after envelope and metadata diagnostics.

## Design sources (read these first)

- `docs/technical-design.md` §9.2 (Claude compatibility rule table — the exact
  three rules, default `warning` severity, and conditions), §6.1 (components:
  `swc-parser-adapter`, `span-mapper`, `rule-engine`), §6.2 (static source
  model / AST facts), §4 (design intent: `odw-lint` owns an SWC-based parser),
  §8 (diagnostic contract), §11.2 (loader parity for trusted fixtures), §11.5
  (span-mapping invariant), §12.1 (trust boundary — never execute source).
- `docs/adr/0001-static-analysis-boundary.md`: `odw-lint` owns its dual-compat
  scanning and MUST NOT import ODW's `scanDualCompat`, `loadWorkflowScript`,
  `createPrimitives`, `validate(source)`, or any ODW module that evaluates or
  compiles workflow source. Parity is kept via tests against trusted fixtures,
  not by importing ODW.
- `docs/developers-guide.md` §"Tests" (rule catalogue is the source of truth;
  updating a rule's reviewed messages requires updating the catalogue, the
  schema snapshot if `RULE_IDS` changes, the rule page, the index, fixture
  manifest expectations, parity test expectations, and — for new exports — the
  `public-api-surface` guard, all in the same change), §"Message templates",
  §"Workflow Fixture Corpus", §"Source-span helpers", §"Commit Gate".
- `docs/scripting-standards.md`,
  `docs/complexity-antipatterns-and-refactoring-strategies.md` (small
  single-responsibility functions; extract predicates; keep files under 400
  lines), `docs/documentation-style-guide.md` (rule-page and prose style).
- `AGENTS.md`: quality gates (`make all`, `make markdownlint`, `make nixie`),
  TypeScript guidance (ESM, `strict`, immutability, branded types, boundary
  error conversion), testing rules (`bun test`; `fast-check` for range
  behaviour; Bun snapshots for output contracts; deterministic tests), and the
  en-GB-oxendict ("-ize"/"-yse"/"-our") convention for all prose and comments.
- `docs/roadmap.md`: task 3.1.2 (this task; requires 2.2.2, already `[x]`) and
  its boundaries with sibling tasks — 3.1.1 (pure-literal metadata), 3.1.3
  (`--strict-claude` promotion), and 2.3.2 (the dedicated dual-compat *parity
  fixture* harness). This plan deliberately does not implement 2.3.2, 3.1.1, or
  3.1.3.

Skills to load: `execplans` (this document), `leta` (symbol navigation and
branch-local verification before every code touch), `grepai` (intent search
against the `main` index — treat as a pointer, verify branch-local facts with
`leta`/file inspection), `biomejs` (formatting/lint expectations),
`en-gb-oxendict` (prose and comments), and `firecrawl` (external library docs
when a dependency behaviour must be verified).

## Context and orientation

`odw-lint` is a private ESM TypeScript package run with Bun. It statically
analyses ODW workflow source *without executing it*. The relevant modules:

- `src/static-analysis/workflow-lint.ts` — `lintWorkflowSource(source)` builds
  an `OriginalSourceFile`, scans the envelope (`scanWorkflowEnvelope`),
  classifies metadata (`classifyWorkflowMetadata`), and returns a frozen
  `WorkflowLintResult` whose `diagnostics` are
  `[...scan.diagnostics, ...classification.diagnostics]`. Body parsing is *not*
  wired in here today.
- `src/static-analysis/types.ts` — `WorkflowEnvelopeScanResult` is a tagged
  union: `status: "scanned"` carries `envelope: WorkflowEnvelope` (with
  `bodySpan: SourceSpan`); `status: "missing-meta"` carries
  `envelope: undefined`.
- `src/static-analysis/workflow-body-normalizer.ts` —
  `normalizeWorkflowBody(envelope)` wraps the body slice in
  `async function __odwLintWorkflowBody__() { <body> }` (prefix byte length is
  recorded), and
  `originalSpanFromNormalizedOffsets(sourceFile, normalized,
  startByte, endByte)`
  maps a *normalized-text byte range* back to a validated original-source
  `SourceSpan`, throwing `SourceOffsetError` if the range touches the injected
  wrapper. This is the span-mapper seam this task uses.
- `src/static-analysis/workflow-body-parser.ts` — `parseWorkflowBody(envelope)`
  normalizes and calls `@swc/core` `parseSync` with
  `{ syntax: "ecmascript", jsx: false }`, currently only to detect
  `odw/body-syntax` failures; it discards the AST.
- `src/diagnostics/rule-catalogue.ts` — the three target rules already exist as
  `category: "claude-compatibility"`, `defaultSeverity: "warning"`,
  `releaseStatus: "released"`, but with empty `messages: []`.
- `src/diagnostics/types.ts` — `Diagnostic` shape:
  `{ file, rule, severity, message, span, docs?, suggestions? }`; spans are
  zero-based UTF-8 byte offsets with one-based display line/column.
- `src/index.ts` — the single public package entry (`odw-lint`); re-exports the
  static-analysis helpers and diagnostic contracts.

Existing patterns to imitate:

- Span snapshot suite: `tests/static-analysis/body-diagnostic-spans.test.ts`
  with the oracle helpers in `tests/static-analysis/source-span-oracle.ts`
  (`decodeSpanText`, `expectSpanToMatchSource`) and the public helpers
  `sliceSourceSpan` / `snippetForSpan`.
- Catalogue contract: `tests/diagnostics/rule-catalogue.test.ts`
  (`EXPECTED_RULE_ROWS` pins every rule's messages) and
  `tests/diagnostics/rule-catalogue-docs.test.ts` (released rule pages need
  `## Failing example` and `## Fixed example` `js` blocks — already present).
- Pipeline tests: `tests/static-analysis/workflow-lint.test.ts` (merge order,
  freeze, and a `fast-check` property that pins the exact merged order).

Definitions used below. *Envelope*: the `export const meta = …` declaration
plus the workflow *body* that follows it. *Body*: the workflow code after the
metadata declaration, normalized by wrapping in an async function so top-level
`return`/`await` parse. *Span-mapper*: `originalSpanFromNormalizedOffsets`.
*Non-computed member access*: `Date.now` (an `Identifier` property), as opposed
to computed `Date["now"]`.

## Detection contract (the behaviour this task pins)

The detector walks the successfully parsed body AST and, for each match, emits
one diagnostic whose span is mapped back to original source:

- `odw/no-date-now`: a `CallExpression` whose `callee` is a *non-computed*
  `MemberExpression` with `object` an `Identifier` named `Date` and `property`
  an `Identifier` named `now` — i.e. a call `Date.now(...)`. Span = the callee
  member-expression span (`Date.now`).
- `odw/no-math-random`: a `CallExpression` whose `callee` is a non-computed
  `MemberExpression` with `object` `Identifier` `Math` and `property`
  `Identifier` `random` — a call `Math.random(...)`. Span = the callee member
  span (`Math.random`).
- `odw/no-argless-new-date`: a `NewExpression` whose `callee` is an
  `Identifier` named `Date` and whose `arguments` is `undefined` or empty — i.e.
  `new Date` or `new Date()`. `new Date(x)` (one or more arguments) does NOT
  warn. Span = the whole `NewExpression` span.

Deliberate, documented scope (Decision Log): detection is *syntactic* AST
matching with no binding/shadow analysis. Roadmap 2.2.4 (workflow AST facts for
lexical bindings) is not a dependency of 3.1.2 and is not yet done; the
shadow-aware global-helper analysis called out for the orchestration rules
(roadmap 3.2.1) is out of scope here. Consequently a locally shadowed `Date` or
`Math`, and computed access `Date["now"]`, are known limitations that mirror a
simple syntactic scanner and match the conservative "warn, explain risk"
philosophy of §9.2. These limitations are recorded in the rule docs.

Because detection runs over the parsed AST, decoy occurrences inside strings,
comments, regex literals, and template text never appear as call/new
expressions and therefore never warn — no separate masking pass is needed
(contrast the metadata scanner, which masks raw text).

The detector contributes diagnostics only when the envelope scan produced a body
(`scan.status === "scanned"`) and the body parses. When the body has a syntax
error the detector contributes nothing; `odw/body-syntax` reporting remains a
separate concern wired by its own roadmap step and is out of scope here.

## Constraints

- Never execute or evaluate workflow source (`docs/technical-design.md` §12.1;
  `docs/adr/0001`). Detection is parse-and-walk only. The
  `does not evaluate hostile metadata` invariant in
  `tests/static-analysis/workflow-lint.test.ts` must keep passing.
- Do not import ODW runtime or ODW static helpers (`scanDualCompat`,
  `checkMeta`, `loadWorkflowScript`, `createPrimitives`, `validate`) in
  production code (`docs/adr/0001`). The forbidden-import architecture test
  (`tests/diagnostics/import-policy.test.ts` / `architecture.test.ts`) must
  stay green.
- Do not leak `@swc/core` AST types through the public package entry
  (`src/index.ts`). The detector consumes SWC types internally and exposes only
  project `Diagnostic` values and project-owned types (AGENTS.md "Boundary
  errors"; "Avoid wildcard re-exports").
- Keep every touched source file under 400 physical lines
  (`tests/build-gate/file-size.test.ts`; AGENTS.md). Split modules if needed.
- Do not change existing rule identifiers, categories, default severities, or
  release statuses; only add reviewed `messages`. `RULE_IDS` is unchanged, so
  the diagnostic JSON Schema enum snapshot (`tests/diagnostics/schema.test.ts`)
  must remain byte-identical.
- Do not modify or reformat files under
  `tests/static-analysis/fixtures/odw-examples/` or
  `tests/static-analysis/fixtures/invalid-workflows/` (upstream/raw fixtures;
  `docs/developers-guide.md` §"Workflow Fixture Corpus").
- All prose, comments, and commit messages use en-GB-oxendict spelling.

## Tolerances (exception triggers)

- Scope: if implementation net-touches more than 12 files or more than ~450 net
  lines of code, stop and escalate.
- Interface: if the `@swc/core` parsed AST shape differs from the assumptions in
  "Interfaces and dependencies" (for example, `Identifier` uses a field other
  than `value`, or `BlockStatement` uses a field other than `stmts`) such that
  a public type or a second production dependency is needed, stop and escalate.
- Dependencies: no new runtime dependency is expected. If one appears necessary,
  stop and escalate.
- Span base: if, after the span Red test in WI2, recovered spans cannot be made
  to match the original source with the documented `module.span.start`
  base-subtraction technique within 3 attempts, stop and escalate with the
  observed offsets.
- Iterations: if a milestone's focused tests still fail after 4 attempts, stop
  and escalate.
- Ambiguity: if `make all` reveals a pre-existing failure unrelated to this task
  on a clean `roadmap-3-1-2` worktree, stop and escalate rather than fixing
  unrelated code.

## Risks

- Risk: `@swc/core` `parseSync` returns node spans as offsets into a
  process-global byte-position counter, so `node.span.start` is not a 0-based
  offset into the parsed string. Severity: high. Likelihood: high. Mitigation:
  subtract the parsed `Module`'s base (`module.span.start`) from every node
  span before mapping. Pin the result with the WI2 span Red test, which asserts
  `sliceSourceSpan(file, diagnostic.span) === "Date.now"` for a known source
  and fails loudly if the base is mishandled.
- Risk: SWC AST field names differ from assumptions (`Identifier.value`,
  `BlockStatement.stmts`, `NewExpression.arguments` optional). Severity:
  medium. Likelihood: medium. Mitigation: the WI2 Red tests fail if the walker
  misreads the AST; verify the live shape with a throwaway Bun script
  (`bun -e`) or `firecrawl` against the `@swc/[email protected]` type
  declarations before writing the walker. Escalate per the Interface tolerance
  if a field differs materially.
- Risk: wiring the detector into `lintWorkflowSource` changes the merged
  diagnostic order and breaks the merge-order property test. Severity: low.
  Likelihood: high (expected). Mitigation: update the two order assertions and
  the `fast-check` property in `workflow-lint.test.ts` to append the third
  stage; the generated sources contain no target patterns, so the stage is
  empty for them.
- Risk: adding messages without updating `EXPECTED_RULE_ROWS` breaks the
  catalogue contract test. Severity: low. Likelihood: medium. Mitigation: WI1
  updates the rows and messages together.

## Tooling availability note (planning session)

During planning the following advisory tooling was unavailable and bounded
local evidence was used instead, per the standing rules:

- The sibling ODW checkout `/data/leynos/Projects/open-dynamic-workflows` is
  outside this session's sandbox; `ls`/`grep`/`find`/`Read` on it were denied,
  and a delegated helper agent confirmed the same. `scanDualCompat`'s source
  could not be read. This is acceptable: `docs/adr/0001` states ODW does not
  export `scanDualCompat` and `odw-lint` must not import it, so the behaviour
  is pinned against `docs/technical-design.md` §9.2 and trusted fixtures, not
  against a live import.
- `firecrawl_scrape` and `bun install` required interactive approval that a
  non-interactive session cannot grant, so the `@swc/core` AST shape below is
  from documented knowledge and MUST be confirmed by the implementer via the
  WI2 Red tests (deps are present in a normal implementation environment) or a
  `bun -e` probe / firecrawl fetch of the `@swc/types` declarations.
- GrepAI and Leta were not exercised for branch-local facts during planning;
  all branch-local claims here were verified by direct file inspection in the
  worktree. The implementer should use `leta` for navigation as normal.

## Plan of work

Stage A (understand — no code): confirm the `@swc/core` `1.15.43` parsed AST
shape (node `type` strings, `Identifier.value`, `MemberExpression`
object/property, `CallExpression.callee`/`arguments`, `NewExpression.callee`/
`arguments` optionality, `BlockStatement.stmts`, `Module.span`) with a throwaway
`bun -e` script or the `@swc/types` `.d.ts`. Record findings in
`Surprises & Discoveries`. No commit.

Stages B–D are delivered as the ordered work items below. Each work item is a
single atomic commit that passes `make all` (and, where Markdown changes,
`make markdownlint` and `make nixie`). Each follows Red → Green → Refactor.

### Work item 1 — Add reviewed messages for the three rules

Read: `docs/developers-guide.md` §"Tests" and §"Message templates";
`docs/technical-design.md` §9.2; `docs/documentation-style-guide.md`. Skills:
`execplans`, `en-gb-oxendict`, `leta`.

Change `src/diagnostics/rule-catalogue.ts` to give each of `odw/no-date-now`,
`odw/no-math-random`, and `odw/no-argless-new-date` exactly one reviewed
`messages` entry (plain sentence, en-GB, no Markdown, matching the existing
dialect-rule message style), for example (final wording is reviewed and pinned
by the catalogue test):

```text
odw/no-date-now:
  Workflow calls Date.now(), which Claude Code rejects because it breaks
  deterministic run resumption.
odw/no-math-random:
  Workflow calls Math.random(), which Claude Code rejects because it breaks
  deterministic run resumption.
odw/no-argless-new-date:
  Workflow constructs new Date() without arguments, which Claude Code rejects
  because it breaks deterministic run resumption.
```

Each catalogued message is one single-line string; the wrapping above is for
this plan's readability only. Keep `messageTemplates` empty (the
`records empty reviewed message templates` test asserts all templates are
empty; use fixed messages, not templates).

Tests (Red first): update `tests/diagnostics/rule-catalogue.test.ts`
`EXPECTED_RULE_ROWS` so the three rows carry the new message arrays. Run
`make test` and watch the
`contains the reviewed rule metadata in taxonomy order` case fail (rows differ)
before editing the catalogue, then pass after. The
`keeps rule page metadata aligned` and schema-enum tests are unaffected (no
id/severity/status change).

Validation: `make all`.

### Work item 2 — Implement the deterministic-time and randomness AST detector

Read: `docs/technical-design.md` §§6.1, 6.2, 11.5; `docs/adr/0001`;
`docs/developers-guide.md` §"Source-span helpers";
`docs/complexity-antipatterns-and-refactoring-strategies.md`. Skills: `leta`
(find `normalizeWorkflowBody` and `originalSpanFromNormalizedOffsets`
callers/shape), `grepai` (locate similar AST-walk code, if any), `biomejs`,
`firecrawl` (confirm `@swc/core` AST types if not done in Stage A).

Add a new module `src/static-analysis/workflow-deterministic-time.ts` exporting:

```ts
import type { Diagnostic } from "../diagnostics/types";
import type { WorkflowEnvelope } from "./types";

/**
 * Emits Claude-compatibility warnings for wall-clock and randomness
 * primitives (`Date.now()`, `Math.random()`, arg-less `new Date()`) found in
 * a workflow body. Returns an empty list when the body is absent or fails to
 * parse. Never executes workflow source.
 */
export const scanDeterministicTimeWarnings = (
  envelope: WorkflowEnvelope,
): readonly Diagnostic[];
```

Internally: call `normalizeWorkflowBody(envelope)`, parse with `@swc/core`
`parseSync` using the same `{ syntax: "ecmascript", jsx: false }` options as
`workflow-body-parser.ts` (extract the shared options constant if that keeps
both files DRY without crossing a module boundary awkwardly — see AGENTS.md
abstraction policy; otherwise duplicate the tiny literal with a comment). On a
parse throw, return `[]`. On success, compute the module base
(`module.span.start`) and walk the AST with a small recursive visitor over
plain node objects, matching the three shapes in the Detection contract. For
each match, convert the chosen SWC node span to normalized-text byte offsets
(`nodeStart = node.span.start - base`, `nodeEnd = node.span.end - base`), then
call
`originalSpanFromNormalizedOffsets(envelope.sourceFile, normalized,
nodeStart, nodeEnd)`
to get the original span, and build a frozen `Diagnostic` using
`ruleDefinitionFor` + `firstReviewedRuleMessage` + `ruleDocsPath` (as
`workflow-body-parser.ts` does) with `severity` from the catalogue default.
Keep the walker and the three matchers as small, named, single-responsibility
helpers; if the file approaches 400 lines, split the generic AST walk into
`src/static-analysis/workflow-ast-walk.ts`.

Do not export SWC types. Keep all `@swc/core` imports internal to this module.

Tests (Red first) — new file
`tests/static-analysis/workflow-deterministic-time.test.ts`, driven by
in-memory sources built like `body-diagnostic-spans.test.ts`
(`createOriginalSourceFile` + `scanWorkflowEnvelope`, then call the detector on
`scan.envelope`):

- Positive: each of `Date.now()`, `Math.random()`, `new Date()`, and `new Date`
  (no parens) yields exactly one diagnostic with the expected rule id and the
  catalogue message. Assert the span via the oracle (`decodeSpanText`/
  `expectSpanToMatchSource`) and `sliceSourceSpan` — e.g.
  `sliceSourceSpan(file, d.span) === "Date.now"`, `"Math.random"`, and
  `"new Date()"` / `"new Date"`. This is the SWC span-base Red test; write it
  first and confirm it fails before the walker exists, then passes.
- Negative: `new Date(0)` / `new Date(args.t)` produce no diagnostic;
  `Date.now`/`Math.random` as bare references without a call produce none (per
  the contract — only calls warn); computed `Date["now"]()` produces none
  (documented limitation); and decoy occurrences inside a string, a line
  comment, a block comment, a regex literal, and template text/interpolation
  produce none (reuse decoy shapes from
  `tests/static-analysis/fixtures/masking/`).
- Multiplicity/order: a body with all three patterns yields three diagnostics
  in source order.
- `fast-check` property: for arbitrary safe surrounding whitespace/comment
  prefixes and suffixes around a single `Date.now()` call, the detector always
  returns exactly one `odw/no-date-now` diagnostic whose sliced span is
  `Date.now` (invariance to benign context). Use a bounded generator per
  AGENTS.md testing rules.

Validation: `make all`. The detector is not yet wired into
`lintWorkflowSource`, so pipeline tests are unaffected.

### Work item 3 — Wire the detector into the lint pipeline and export it

Read: `docs/technical-design.md` §8; `docs/developers-guide.md` §"Tests"
(public-api guard). Skills: `leta` (trace `lintWorkflowSource` callers and the
`WorkflowLintResult` shape), `biomejs`.

Change `src/static-analysis/workflow-lint.ts` so that, when
`scan.status === "scanned"`, it calls
`scanDeterministicTimeWarnings(scan.envelope)` and appends the result as the
third canonical stage. Extend `WorkflowLintResult` with a frozen
`claudeCompatibility: readonly Diagnostic[]` field (name per review; keep it a
plain frozen array) and define `diagnostics` as
`[...scan.diagnostics, ...classification.diagnostics, ...claudeCompatibility]`.
Freeze the new field like the others.

Export `scanDeterministicTimeWarnings` from `src/static-analysis/index.ts` and
re-export it from `src/index.ts`, and update
`tests/diagnostics/public-api-surface.test.ts`
`EXPECTED_PUBLIC_PACKAGE_EXPORTS` in the same change (the guard fails
otherwise).

Tests (Red first): update `tests/static-analysis/workflow-lint.test.ts`:

- Change the two order assertions
  (`returns envelope diagnostics before metadata diagnostics`,
  `reports runtime-invalid metadata …`) and the
  `preserves the canonical merge order` `fast-check` property to append
  `...result.claudeCompatibility` (equivalently
  `...scan…, ...classification…, ...deterministic…`). These stay green for the
  existing generated sources because they contain no target patterns.
- Add a new case: a valid workflow whose body contains `Date.now()`,
  `Math.random()`, and `new Date()` produces, after the metadata diagnostics,
  the three claude-compatibility warnings in order; assert rule ids via the
  existing `diagnosticRules` helper.
- Extend the freeze test to assert `result.claudeCompatibility` is frozen.
- Confirm the hostile-metadata no-evaluation test still passes (the body of the
  hostile fixture is parsed, never executed).

Validation: `make all`.

### Work item 4 — Span snapshots and trusted-fixture parity

Read: `docs/technical-design.md` §§11.2, 11.5; `docs/developers-guide.md`
§"Workflow Fixture Corpus" and §"Source-span helpers". Skills: `leta`, `grepai`.

Add `tests/static-analysis/deterministic-time-spans.test.ts` mirroring
`body-diagnostic-spans.test.ts`: a matrix over LF, CRLF, Unicode BMP, and
Unicode astral surroundings for each of the three rules, asserting the
diagnostic span against the independent UTF-8 oracle, `sliceSourceSpan`, and
`snippetForSpan`, and recording a reviewer-facing Bun snapshot
(`toMatchSnapshot`) of `{ rule, severity, span, spanText }` with non-ASCII
escaped as in the existing suite. New snapshots are created on first run; keep
them in `tests/static-analysis/__snapshots__/`.

Add a parity assertion proving no false positives on trusted input: iterate the
nine `ODW_EXAMPLE_FIXTURE_SNAPSHOTS`, lint each through the public
`lintWorkflowSource`, and assert the `claude-compatibility` diagnostics are
empty (they contain none of the three patterns — verified during planning by a
repository-wide search that found zero `Date.now`/`Math.random`/`new Date`
occurrences under `tests/static-analysis/fixtures/`). Place this either in the
new spans test or extend `tests/static-analysis/odw-example-fixtures.test.ts`
without disturbing its manifest-only assertions.

Note in the test file comment that the *full* dual-compat parity-fixture
harness is roadmap task 2.3.2 and is out of scope here; this task asserts
detector correctness plus zero false positives on the trusted example corpus.

Validation: `make all`.

### Work item 5 — Documentation actualization

Read: `docs/documentation-style-guide.md`; `docs/developers-guide.md`
§"Documentation Upkeep"; AGENTS.md §"Markdown Guidance". Skills:
`en-gb-oxendict`.

The three rule pages (`docs/rules/no-date-now.md`,
`docs/rules/no-math-random.md`, `docs/rules/no-argless-new-date.md`) already
carry the required metadata table and `## Failing example` / `## Fixed example`
sections, so the parity tests already pass. Update their prose to state
precisely what the rule now detects (call vs bare reference; arg-less
`new Date` and `new Date()` both warn while `new Date(x)` does not) and add a
short "Limitations" note that detection is syntactic, so a shadowed `Date`/
`Math` binding or computed `Date["now"]` access is not detected (revisit if
roadmap 2.2.4 lands). Keep line wrapping at 80 columns for prose and 120 for
code blocks.

Only touch these Markdown files; the `docs/rules/index.md` table and catalogue
metadata are unchanged (no id/severity/status change), so their parity tests
stay green.

Validation, path-safe (each listed path exists and is edited by this work item):

```sh
bunx mdtablefix docs/rules/no-date-now.md docs/rules/no-math-random.md docs/rules/no-argless-new-date.md
bunx markdownlint-cli2 --fix docs/rules/no-date-now.md docs/rules/no-math-random.md docs/rules/no-argless-new-date.md
make markdownlint
make nixie
make all
```

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-3-1-2` on branch
`roadmap-3-1-2`. Install dependencies once with `make build` (runs the package
install) before the first `make test`.

Per work item: write the Red test(s), run `make test` (or the focused
`bun test <path>`) and confirm the expected failure, implement the minimal
change, re-run to green, refactor, then run the full gate:

```sh
make all
```

For WI5 also run `make markdownlint` and `make nixie` (see the path-safe block
above). Commit each work item separately with an imperative en-GB subject line
(for example `Emit deterministic-time compatibility warnings`), gating every
commit with `make all`.

## Validation and acceptance

Quality criteria (what "done" means):

- Tests: `make test` passes, including the new
  `tests/static-analysis/workflow-deterministic-time.test.ts`,
  `tests/static-analysis/deterministic-time-spans.test.ts`, the updated
  `tests/static-analysis/workflow-lint.test.ts`, the updated
  `tests/diagnostics/rule-catalogue.test.ts`, and the updated
  `tests/diagnostics/public-api-surface.test.ts`. Each new test fails before
  its implementation work item and passes after.
- Lint/format/type: `make all` (build, `biome` format check, `biome` + `oxlint`
  lint, `tsc --noEmit`, and `bun test`) is green.
- Markdown (WI5 only): `make markdownlint` and `make nixie` are green.
- Behaviour: `lintWorkflowSource` over a body containing `Date.now()`,
  `Math.random()`, and `new Date()` returns those three `claude-compatibility`
  warnings after envelope and metadata diagnostics, with spans that slice back
  to `Date.now`, `Math.random`, and `new Date()`; the same tokens inside
  strings/comments/regex/templates produce none; and the nine ODW example
  fixtures produce zero claude-compatibility diagnostics.

Quality method (how we check): `make all` locally on the `roadmap-3-1-2`
worktree, plus `make markdownlint` and `make nixie` for WI5.

Red-Green evidence to record as work proceeds:

- WI1 Red: `make test` fails on
  `rule catalogue › contains the reviewed rule metadata in taxonomy order`.
  Green after adding messages.
- WI2 Red: the span assertion `sliceSourceSpan(file, d.span) === "Date.now"`
  fails (no detector / wrong span base). Green after the walker + base handling.
- WI3 Red: the new pipeline case expecting three trailing warnings fails. Green
  after wiring; order assertions updated.
- WI4 Red: snapshot cases have no committed snapshot / parity assertion fails if
  a false positive appears. Green once snapshots are written and parity holds.

## Idempotence and recovery

Each work item is an independent commit and is re-runnable. Tests build source
in memory or read pinned fixtures, so re-running `make all` is safe and
deterministic. If a Bun snapshot needs an intentional update, re-run with
`bun test --update-snapshots` only after confirming the diff is an intended
contract change (AGENTS.md snapshot rule), then re-gate. No destructive or
irreversible steps are involved; revert a commit to roll back.

## Interfaces and dependencies

Production, in `src/static-analysis/workflow-deterministic-time.ts`:

```ts
export const scanDeterministicTimeWarnings = (
  envelope: WorkflowEnvelope,
): readonly Diagnostic[];
```

Re-exported from `src/static-analysis/index.ts` and `src/index.ts`.

`WorkflowLintResult` (in `src/static-analysis/workflow-lint.ts`) gains:

```ts
readonly claudeCompatibility: readonly Diagnostic[];
```

with `diagnostics` = envelope ++ metadata ++ `claudeCompatibility`.

Dependency: `@swc/core` `1.15.43` (already locked). The parser adapter uses
`parseSync(text, { syntax: "ecmascript", jsx: false })`. Assumed parsed-AST
shape to confirm in Stage A / WI2 (SWC ESTree-like nodes):

- `Module` = `{ type: "Module", body: ModuleItem[], span: { start, end } }`;
  the wrapper makes `body[0]` a `FunctionDeclaration` whose `body` is a
  `BlockStatement` with `stmts: Statement[]`.
- `Identifier` = `{ type: "Identifier", value: string, span }` (name is
  `value`, not `name`).
- `MemberExpression` = `{ type: "MemberExpression", object, property, span }`;
  computed access uses `property: { type: "Computed", … }`.
- `CallExpression` =
  `{ type: "CallExpression", callee, arguments: Argument[], span }`.
- `NewExpression` =
  `{ type: "NewExpression", callee, arguments?: Argument[] | undefined, span }`.
- Node byte spans are relative to a process-global base; subtract
  `module.span.start` before span mapping.

No new runtime dependency. Test-only libraries already present: `fast-check`
(property tests) and Bun's built-in snapshot support.

## Progress

- [x] Stage A: confirm `@swc/core` `1.15.43` AST shape and span base.
  Completed 2026-07-03.
- [x] WI1: reviewed messages for the three rules + catalogue test rows.
  Completed 2026-07-03.
- [x] WI2: `scanDeterministicTimeWarnings` detector + focused tests.
  Completed 2026-07-03.
- [x] WI3: wire into `lintWorkflowSource`, export, update pipeline + public-api
  tests. Completed 2026-07-03.
- [x] WI4: span snapshots + trusted-fixture parity assertion.
  Completed 2026-07-03.
- [x] WI5: rule-doc actualization + Markdown gates.
  Completed 2026-07-03.

## Surprises & discoveries

- Observation: the three target rules are already catalogued as `released` with
  empty `messages`, and their `docs/rules/*.md` pages already exist and satisfy
  the released-page example test, yet nothing emits them — `lintWorkflowSource`
  merges only envelope and metadata diagnostics and never parses the body.
  Evidence: `src/diagnostics/rule-catalogue.ts` lines 163–180;
  `src/static-analysis/workflow-lint.ts` line 35; `docs/rules/no-date-now.md`.
  Impact: this task adds messages + emission + wiring; no id/severity/status or
  schema changes are needed.
- Observation: no existing fixture under `tests/static-analysis/fixtures/`
  contains `Date.now`, `Math.random`, or `new Date`. Evidence: repository-wide
  search during planning returned zero matches. Impact: wiring the rule cannot
  regress existing example/masking expectations, and the trusted-fixture parity
  assertion (zero warnings) holds by inspection.
- Observation: live `@swc/core` `1.15.43` parsing confirms the assumed AST
  shape for this task. `Module.span.start` is `1`; the wrapper function is a
  `FunctionDeclaration`; its body is a `BlockStatement` with `stmts`;
  identifiers use `value`; `Date["now"]()` has a `Computed` property; and
  arg-less `new Date` reports `arguments: null` while `new Date()` reports an
  empty array. Evidence: `bun -e` probe run in the implementation worktree on
  2026-07-03. Impact: the detector can use the documented base-subtraction
  technique and must treat both `null` and an empty array as arg-less
  constructor calls.
- Observation: WI1 Red failed for the expected catalogue-row mismatch after
  the test rows were updated, then passed after adding the reviewed messages to
  `src/diagnostics/rule-catalogue.ts`. Evidence:
  `bun test tests/diagnostics/rule-catalogue.test.ts` failed on
  `rule catalogue > contains the reviewed rule metadata in taxonomy order`,
  then passed with 10 tests and 167 assertions. Impact: the rule catalogue now
  has fixed reviewed messages ready for emission by the detector.
- Observation: the existing invalid-workflow fixture coverage guard inferred
  its expected rule set from every catalogue entry with reviewed messages. That
  became too broad once Claude compatibility rules gained messages but are
  covered by detector-specific tests rather than the invalid metadata/import
  fixture corpus. Evidence: `make all` failed in
  `tests/static-analysis/invalid-workflow-fixtures.test.ts` on the rule
  coverage assertion after WI1. The test now pins the seven rules intentionally
  represented by the invalid workflow fixture families. Impact: future
  message-only rules no longer have to add unrelated invalid workflow fixtures,
  while the existing fixture corpus still proves coverage for its owned
  families.
- Observation: WI2 Red failed before the detector module existed, then passed
  after adding the SWC AST walker and span-base mapping. Evidence:
  `bun test tests/static-analysis/workflow-deterministic-time.test.ts` first
  failed with
  `Cannot find module '../../src/static-analysis/workflow-deterministic-time'`,
  then passed with 8 tests and 876 assertions. `bunx tsc --noEmit` also passed
  after narrowing `CallExpression` and `NewExpression` explicitly. Impact:
  focused tests now prove positive matches, negative decoys, source-order
  emission, parse-failure silence, and `Date.now` span stability around benign
  context.
- Observation: WI2 gates passed after adding the new static-analysis module to
  the reviewed architecture fixture list. A first combined
  `make all && make markdownlint && make nixie` run hit a transient `nixie`
  stdout `BlockingIOError` after successful diagram validation; rerunning
  `make nixie` with output redirected passed. Evidence: `make all` passed with
  642 tests and 27,522 assertions; `make markdownlint` passed with 81 files;
  redirected `make nixie` ended with `All diagrams validated successfully`.
  Impact: no implementation change was needed for the transient validator I/O
  failure.
- Observation: CodeRabbit review is currently service-rate-limited.
  Evidence: scrutineer reported `coderabbit review --agent` returned
  `Rate limit exceeded` with `waitTime: "6 minutes"` after WI1 gates passed.
  Impact: CodeRabbit feedback is deferred; deterministic gates remain the
  current acceptance evidence until the external review quota recovers.
- Observation: WI3 Red failed for the expected missing `claudeCompatibility`
  pipeline field and missing public export, then passed after wiring the
  detector into `lintWorkflowSource` and re-exporting it. Evidence:
  `bun test tests/static-analysis/workflow-lint.test.ts
  tests/diagnostics/public-api-surface.test.ts`
  first failed on undefined `result.claudeCompatibility` and missing
  `scanDeterministicTimeWarnings` in the public export list, then passed with
  29 tests and 243 assertions after implementation. `bunx tsc --noEmit` passed.
  Impact: `lintWorkflowSource` now returns a frozen `claudeCompatibility` stage
  and merges diagnostics as envelope, metadata, then Claude compatibility.
- Observation: WI4 added deterministic span snapshots for LF, CRLF, Unicode
  BMP, and Unicode astral surroundings across all three emitted rules, plus a
  zero-false-positive check over the nine trusted ODW examples. Evidence:
  `bun test tests/static-analysis/deterministic-time-spans.test.ts` passed with
  13 tests, added 12 snapshots, and made 195 assertions. Impact:
  reviewer-facing snapshots now pin the emitted spans and the public lint
  pipeline proves the trusted corpus has no Claude compatibility warnings for
  this rule slice.
- Observation: WI5 updated the three rule pages to match the implemented
  detection contract and document syntactic limitations. Evidence:
  `docs/rules/no-date-now.md`, `docs/rules/no-math-random.md`, and
  `docs/rules/no-argless-new-date.md` now distinguish calls from bare
  references, document arg-less `new Date` handling, and state shadow/computed
  access limitations. Impact: user-facing rule documentation is aligned with
  the code and focused tests.
- Observation: a later direct CodeRabbit retry did not return findings or a
  new structured error before the local process was interrupted after several
  minutes with no output beyond setup/analyzing status lines. Evidence:
  `coderabbit review --agent` printed setup and summarizing status, then
  produced no further output before `SIGINT`. Impact: CodeRabbit remains a
  deferred external-review issue; no actionable review feedback is available to
  address in this implementation turn.

## Decision log

- Decision: detect syntactically over the parsed AST with no binding/shadow
  analysis; warn on `new Date` and `new Date()` but not `new Date(x)`; warn
  only on `Date.now(...)`/`Math.random(...)` calls (not bare references) and
  not on computed access. Rationale: 3.1.2 requires only 2.2.2 (not the 2.2.4
  binding facts); §9.2 keeps these warnings conservative and explanatory; a
  simple syntactic scanner is the parity target and the residual false-positive
  surface (shadowed globals, computed access) is documented as a known
  limitation, consistent with the heuristic philosophy. Date/Author:
  2026-07-03, planning agent.
- Decision: the detector owns its own normalize+parse and never exposes SWC
  types; it returns `[]` on body syntax failure; `odw/body-syntax` wiring stays
  out of scope. Rationale: keeps the public surface free of dependency types
  (AGENTS.md boundary rules; ADR 0001 ownership), keeps the change atomic, and
  avoids double-reporting a concern owned elsewhere. A future refactor can
  share one parse between body-syntax and claude-compat once body-syntax is
  wired. Date/Author: 2026-07-03, planning agent.
- Decision: define parity as (a) detector correctness via unit/span tests and
  (b) zero claude-compatibility diagnostics on the nine trusted ODW example
  fixtures; the full dual-compat parity-fixture harness stays with roadmap
  2.3.2. Rationale: ADR 0001 states ODW does not export `scanDualCompat` and it
  must not be imported; the ODW checkout was unreadable in planning; §11.2 pins
  parity against trusted fixtures, and 2.3.2 is the dedicated fixture task.
  Date/Author: 2026-07-03, planning agent.
- Decision: Status remains DRAFT pending design review and the standing approval
  gate; do not begin implementation until approved. Rationale: `execplans`
  approval gate. Date/Author: 2026-07-03, planning agent.

## Outcomes & retrospective

The implemented scanner emits `odw/no-date-now`, `odw/no-math-random`, and
`odw/no-argless-new-date` warnings from parsed workflow bodies without
executing source. Focused tests cover positive matches, non-matching decoys,
parse-failure silence, source-order emission, pipeline ordering, public export
coverage, span snapshots, and zero false positives on the nine trusted ODW
examples. The main implementation surprise was that SWC represents `new Date`
with `arguments: null`; the detector treats both `null` and an empty array as
arg-less construction. CodeRabbit review remains deferred because the external
service returned a rate limit after deterministic gates passed.

## Addenda

- [x] 3.1.2.1. Snapshot intra-expression deterministic-time ordering.
  - Source: review:3.1.2; severity low.
  - Scope: add deterministic-time fixtures that pin hazard ordering inside one
    expression, including mixed `Math.random()`, `Date.now()`, and nested
    `new Date(Date.now())` cases.
  - Success: a future SWC traversal or matcher change cannot reorder
    same-expression deterministic-time diagnostics without a focused snapshot
    failure.
