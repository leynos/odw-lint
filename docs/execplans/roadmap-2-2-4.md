# Implement workflow AST facts for lexical bindings and source masks

This ExecPlan (execution plan) is a living document. The sections `Constraints`,
`Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint` statically checks Open Dynamic Workflows (ODW) source without
executing it. Roadmap task 2.2.4 (`docs/roadmap.md` lines 563-572) adds the
first reusable *workflow AST facts*: derived data that later orchestration and
Claude-compatibility rules read instead of re-walking the parser output.
Verbatim roadmap success line: "rule tests can distinguish JavaScript globals
from shadowed `parallel`, `Array`, `Number`, `Object`, and `Math` identifiers,
and directive-like text in strings, templates, regexes, and block comments is
ignored."

Two facts are produced by this task, mirroring the two clauses of that success
line (see `docs/technical-design.md` sections 6.2 and 9.3):

1. **Lexical binding facts.** By walking the SWC abstract syntax tree (AST) of
   the normalized workflow body, `odw-lint` records the set of identifier names
   the body *binds* (declares). A future rule such as `odw/no-math-random`
   (`docs/technical-design.md` section 9.2) or `odw/bounded-fanout` (section
   9.3) can then ask "is this reference to `Math` / `parallel` the real global,
   or a user-declared binding that shadows it?" and avoid false positives on a
   workflow that legitimately declares its own `parallel`, `Array`, `Number`,
   `Object`, or `Math`.
2. **Suppression source masks.** By reusing the existing inert-region masker
   (`src/static-analysis/source-mask.ts`, delivered by task 2.1.9), `odw-lint`
   produces a *directive-scan view* of the original source in which quoted
   strings, template literals, regex literals, and **block** comments are
   blanked, while **line** comments remain visible. A future suppression parser
   can then find `// odw-lint-…`-style directives in line comments while
   ignoring identical decoy text that appears inside strings, templates,
   regexes, and block comments.

What a reader gains after this change: a new, `@swc/core`-free public fact
object, `WorkflowAstFacts`, obtainable from a scanned envelope through
`collectWorkflowAstFacts(envelope)`. Its `lexicalBindings` answers shadowing
questions by name, and its `suppressionMasks` exposes a directive-scan text
plus the inert ranges that were blanked. Both are proven by focused tests;
neither emits a diagnostic, changes the `Diagnostic` shape, or wires anything
new into `lintWorkflowSource` (those remain later tasks).

Observable proof (see `Validation and acceptance`):

1. `collectWorkflowAstFacts` on a body that declares `const parallel = …`
   (and the same for `Array`, `Number`, `Object`, `Math`, via `const`/`let`/
   `var`/function declaration/parameter/destructuring/catch binding) returns
   `lexicalBindings` for which `isIdentifierBound(facts.lexicalBindings, name)`
   is `true`; on a body that only *uses* those names (`Math.random()`,
   `parallel(items)`) it is `false`.
2. `collectWorkflowAstFacts` on a body containing the decoy token
   `odw-lint-disable` inside a string, a template, a regex, and a block comment
   returns `suppressionMasks` whose `directiveScanText` no longer contains that
   token at those positions, while the same token inside a `//` line comment
   survives.
3. `make all` passes at every commit; the new suites are deterministic and
   build their sources in memory.

### Scope boundary with adjacent tasks (read this first)

This is the most important design decision in the plan. Keep 2.2.4 to
*producing reusable facts* only.

- **2.2.4 owns** the reusable `WorkflowAstFacts` (lexical bindings and
  suppression masks). `docs/developers-guide.md` lines 71-72 and 133-138 name
  this task as the owner of "workflow AST facts, lexical bindings, and source
  masks". It adds new production modules, new public exports, tests, and
  documentation.
- **2.2.4 emits no diagnostics and defines no rule.** The consuming rules
  (`odw/no-math-random`, `odw/no-date-now`, `odw/bounded-loop`,
  `odw/bounded-fanout`, and a future suppression mechanism) are later roadmap
  tasks in phase 3. This task provides the *facts* those rules will read; it
  must not add a rule id, a catalogue entry, or a diagnostic. It must not
  invent suppression-directive grammar or semantics — only the mask that lets a
  future parser scan for directives safely.
- **2.2.4 must not change the `Diagnostic` object shape.** The diagnostic
  contract in `docs/technical-design.md` section 8 gates any shape change
  behind a schema-version review this task does not carry.
- **2.2.4 must not wire facts into `lintWorkflowSource`.** Per
  `docs/developers-guide.md` lines 94-99, `parseWorkflowBody` is deliberately
  not yet in the production lint pipeline; the same restraint applies here.
  `collectWorkflowAstFacts` is a standalone, independently testable producer.
- **Binding facts are name-based, not span-based, in this task.** SWC AST node
  spans use a non-zero global byte-offset base (`program.span.start`; proven by
  `tests/static-analysis/workflow-body-parser.test.ts` lines 242-259). Mapping
  those offsets to original-source spans is possible with
  `originalSpanFromNormalizedOffsets`, but narrowing spans to structured parser
  offsets is explicitly **task 2.2.6's** boundary (`docs/roadmap.md` lines
  581-589). To keep 2.2.4 independent of 2.2.6, lexical binding facts record
  only *names* (a shadowing query needs a name-set, not a span). Adding binding
  spans is a justified later refinement, recorded in `Decision Log`.
- **The public facts object is `@swc/core`-free.** The raw SWC `Module` is an
  internal implementation detail. `collectWorkflowAstFacts` returns only
  derived, parser-type-free data so the public package surface does not leak
  `@swc/core` types. This matches the existing care in
  `originalSpanFromNormalizedOffsets`, which "deliberately accepts numeric
  offsets rather than SWC AST types" (`docs/developers-guide.md` line 70).

Design references: `docs/technical-design.md` sections 4, 5, 6.1, 6.2, 6.4, 8,
9.2, 9.3, 11.1, 12.1, 12.2; `docs/adr/0001-static-analysis-boundary.md`;
`docs/developers-guide.md` "Workflow body parser adapter" (lines 49-72),
"Workflow envelope scanner" (lines 74-138), the source-mask module map (lines
478-491), and "Source-span helpers" (lines 436-476); `AGENTS.md` (Testing,
Snapshot scope, file-size limit, DRY/Separate Atomic Refactors). Requires 2.1.9
(source-mask scanners split — COMPLETE, `docs/roadmap.md` line 478) and 2.2.2
(body normalization and span mapping — COMPLETE,
`docs/execplans/roadmap-2-2-2.md`).

## Constraints

Hard invariants that must hold throughout implementation. Violation requires
escalation, not a workaround.

- **No source evaluation.** New production and test code must not import,
  evaluate, execute, or `Function`-construct workflow source, and must not call
  any ODW loader, primitive, runtime, scheduler, or agent-dispatch path. The
  only permitted parser call is `@swc/core`'s `parseSync` over normalized,
  parse-only text, exactly as `parseWorkflowBody` already uses it
  (`docs/technical-design.md` sections 5, 6.4, 12.1;
  `docs/adr/0001-static-analysis-boundary.md`;
  `tests/diagnostics/import-policy.test.ts`).
- **No diagnostic emission and no `Diagnostic` shape change.** This task
  produces facts, not diagnostics. `src/diagnostics/types.ts` and
  `docs/technical-design.md` section 8 are unchanged. No new rule id or
  catalogue entry is added.
- **No new public leak of `@swc/core` types.** The public `WorkflowAstFacts`
  and everything re-exported from `src/index.ts` must not reference an
  `@swc/core` AST type. The raw `Module` stays internal.
- **No wiring into `lintWorkflowSource`.**
  `src/static-analysis/workflow-lint.ts` is unchanged.
- **UTF-8 / UTF-16 index discipline.** `SourceSpan` offsets are UTF-8 byte
  offsets; source-mask ranges are UTF-16 text indexes
  (`src/static-analysis/source-mask-types.ts`). Suppression-mask facts stay in
  the masker's UTF-16 index space and reference the same `OriginalSourceFile`;
  they must not silently mix the two coordinate systems
  (`docs/developers-guide.md` "Source-span helpers").
- **Frozen result containers.** Producer-owned result containers and the arrays
  they own are frozen before leaving their module, matching the existing
  static-analysis contract (`docs/developers-guide.md` lines 101-107).
- **en-GB Oxford spelling** ("-ize"/"-yse"/"-our") in all prose, comments, and
  commit messages (`AGENTS.md`; `docs/documentation-style-guide.md`).
- **File size < 400 lines** for every code file touched (`AGENTS.md` line 31).
  Split by responsibility (bindings, masks, aggregator) rather than growing one
  module.

## Tolerances (exception triggers)

- **Scope creep into rules:** if delivering the facts appears to require adding
  a rule id, a catalogue entry, or a diagnostic, stop and escalate — that is a
  phase-3 task.
- **Diagnostic shape:** if a reviewer insists a fact must live on `Diagnostic`,
  stop and escalate; that is a section 8 schema-version change.
- **SWC pattern shape mismatch:** if the empirical shape probe (WI2, step 1)
  shows the SWC pattern node fields differ from those assumed here in a way
  that cannot be handled by a small, tested adjustment, stop and record the
  real shape in `Surprises & Discoveries` before continuing.
- **Files/lines:** if the change exceeds roughly 8 files or ~700 net added
  lines, stop and re-scope.
- **Iterations:** if a suite still fails after 3 focused attempts for a reason
  other than an intended snapshot update, stop and escalate.
- **New dependency:** none is permitted. `@swc/core`, `fast-check`, and
  `bun:test` are already present; adding any dependency triggers escalation.

## Risks

- Risk: an assumed SWC AST field name (for example an array pattern's
  `elements`, an object pattern's `properties`, or a binding identifier's
  `value`) does not match the pinned `@swc/core@1.15.43` / `@swc/types@0.1.27`
  output, so the binding collector silently misses or miscounts a name.
  Severity: high. Likelihood: medium. Mitigation: WI2 begins with a
  deterministic shape probe that parses one destructuring sample and inspects
  `JSON.stringify(parseSync(...))`, so the collector is written against the
  *observed* shape rather than recollection; every binding case is then pinned
  by a table-driven test that fails loudly if a name is missed. The existing
  generic AST walk in `tests/static-analysis/workflow-body-parser.test.ts`
  (lines 155-176) is independent evidence the tree is a plain, `.type`-keyed
  object of span-bearing nodes.
- Risk: **wrapper-name pollution.** `normalizeWorkflowBody` wraps every body in
  the named declaration `async function __odwLintWorkflowBody__() { … }`
  (`src/static-analysis/workflow-body-normalizer.ts` line 17), so the parsed
  `Module`'s only top-level statement is that wrapper `FunctionDeclaration`. A
  faithful "walk the module and collect every `FunctionDeclaration` name" walk
  would collect `__odwLintWorkflowBody__` into `boundNames`, leaking a
  normalization implementation detail into the public
  `LexicalBindingFacts.boundNames` and contradicting this plan's own contract
  ("the set of identifier names the body binds"). Severity: high
  (public-surface correctness). Likelihood: high without a guard. Mitigation
  (both directions, so the wart is pinned twice): (a) the collector does
  **not** start at `module.body`; it unwraps the single top-level wrapper
  `FunctionDeclaration` and begins traversal at that function's body statements
  (`BlockStatement.stmts`, probe-confirmed), so the wrapper's own binding name
  and its (empty) parameter list are never visited; (b) as a defensive
  backstop, the collector seeds an excluded-name set with the shared
  `WORKFLOW_BODY_WRAP_FUNCTION_NAME` constant so the synthetic name is filtered
  even if the tree shape ever changes. WI2's negative matrix asserts
  `boundNames` does not contain `__odwLintWorkflowBody__`, and one
  representative body asserts `boundNames` equals *exactly* the user-declared
  set, so any regression fails loudly.
- Risk: the collector counts an identifier *reference* as a binding (for
  example the `Math` in a default value `function f(x = Math.max(1, 2)) {}`, or
  the computed key in `const { [Math]: y } = o`), producing a false "shadowed"
  answer and a future false negative in a global-helper rule. Severity: medium.
  Likelihood: medium. Mitigation: the collector recurses only through binding
  positions (declarator `id`, param patterns, function/class declaration
  identifiers, catch param) and, inside patterns, only through binding sub-nodes
  (`AssignmentPattern.left`, not `.right`; pattern-property values, not
  computed keys). WI2 adds explicit negative-position tests (default-value
  reference, computed key, member-expression object) asserting those names are
  **absent** from `boundNames`.
- Risk: the suppression mask blanks line comments (where real directives live)
  or fails to blank a block comment, inverting the success criterion. Severity:
  high. Likelihood: low. Mitigation: classify each masker "comment" range as
  line vs block by the character after the opening slash (`/` → line, `*` →
  block; the same distinction `src/static-analysis/source-mask-comments.ts`
  already makes at scan time), reveal only line-comment ranges, and pin both
  directions with tests (a `//` directive survives; a `/* */` decoy is blanked).
- Risk: a body that fails to parse leaves the binding collector with no AST,
  and a caller expects facts anyway. Severity: low. Likelihood: medium.
  Mitigation: `collectWorkflowAstFacts` mirrors `parseWorkflowBody`'s defensive
  posture: on parse failure it returns `parseSucceeded: false` with an empty
  binding set, while suppression masks (which derive from the original source,
  not the AST) are still produced. A test pins the parse-failure path.
- Risk: extracting a shared parse helper (WI1) changes the behaviour of the
  shipped `parseWorkflowBody`, breaking the 2.2.1/2.2.3 snapshots. Severity:
  medium. Likelihood: low. Mitigation: WI1 is a pure, snapshot-neutral refactor
  validated by the existing `workflow-body-parser.test.ts` and
  `body-diagnostic-spans.test.ts` suites passing unchanged before the feature
  work begins (`AGENTS.md` "Separate Atomic Refactors").
- Risk: `bun test` cannot be run during planning because the agent shell gates
  arbitrary Bash behind approval, so the exact AST shape is unconfirmed at plan
  time. Severity: medium. Likelihood: high (already observed). Mitigation:
  every load-bearing shape claim is pinned by a Red test in this plan, and WI2
  step 1 is an explicit in-repo shape probe the implementer runs before writing
  the collector. Network research tools (firecrawl / WebFetch) were
  permission-gated in the planning session, so the pinned-version `@swc/types`
  file could not be fetched; the in-repo probe plus tests are the authoritative
  substitute.

## Progress

- [x] (2026-07-03 03:52Z) WI1: Extract a shared internal normalized-body parse
  helper and rewire `parseWorkflowBody` onto it (snapshot-neutral refactor).
  Deterministic gate: `make all` passed under `scrutineer`. CodeRabbit first
  hit a recoverable rate limit, then completed after the mandated `vsleep`
  backoff; its direct-helper-test finding was fixed in
  `tests/static-analysis/workflow-body-parse.test.ts`. A later review repeated
  the parser-error and overload-guard findings; both were fixed, and `make all`,
  `make markdownlint`, and `make nixie` passed again. Final CodeRabbit
  re-review remains deferred because the allowed retry budget for WI1 was
  consumed.
- [x] (2026-07-03 06:23Z) WI2: Export the wrapper-name constant, then add the
  lexical binding facts module (unwrapping the synthetic wrapper) and its
  tests. Focused tests pass for helper shadowing, reference-only negatives,
  wrapper exclusion, exact user-declared sets, and generated `const` bindings.
  CodeRabbit found missing class constructor and method parameter bindings;
  collectors and regression coverage for `Constructor`, `ClassMethod`, and
  `PrivateMethod` were added before re-gating. Follow-up review requested
  clearer class-specific collectors, runtime-stable code-unit sorting, and an
  explicit nested-function-scope test; all three were fixed before final gates.
  A final review found that declarations nested inside default initializers and
  the raw-module fallback path were not covered; the collector now traverses
  default initializer expressions, and regression tests pin both cases.
- [x] (2026-07-03 08:48Z) WI3: Add the suppression source-mask module and
  its tests. The directive-scan view now re-exposes line comments, keeps
  strings, templates, regex literals, and block comments inert, and provides a
  binary-search `isIndexInInertRegion` predicate over sorted mask ranges.
  Focused tests cover fixed decoys, full-text snapshots, line-terminator
  preservation, and generated source invariants. `make all` and CodeRabbit were
  green after follow-up review fixes.
- [x] (2026-07-03 10:25Z) WI4: Assemble `WorkflowAstFacts`, add
  `collectWorkflowAstFacts`, export the public surface, and add an integration
  test. The public fact object stays `@swc/core`-free, while an internal
  `collectWorkflowAstFactsFromParseResult` seam lets future internal callers
  reuse an existing parse result. The internal parse result now carries
  source-file and body-span identity, and reused fact assembly fails fast on
  mismatched envelopes. Public export fixtures and package-entry tests were
  updated for the six new public fact names. `make all` and CodeRabbit were
  green after follow-up review fixes.
- [x] (2026-07-03 10:42Z) WI5: Document the facts in the developers' guide
  and tick roadmap 2.2.4. The developers' guide now names
  `collectWorkflowAstFacts`, `WorkflowAstFacts`, `LexicalBindingFacts`,
  `isIdentifierBound`, `WorkflowSuppressionMasks`, and `isIndexInInertRegion`,
  and records that facts remain standalone producers rather than lint-pipeline
  diagnostics. Roadmap 2.2.4 is marked complete. Deterministic gates
  (`make all`, `make markdownlint`, `make nixie`) and CodeRabbit are green.

## Surprises & discoveries

- Observation: the repository already walks the SWC AST as a generic tree of
  span-bearing objects and already knows the global offset base. Evidence:
  `tests/static-analysis/workflow-body-parser.test.ts` lines 155-176 collect
  "any node with a numeric span" recursively, and lines 244-259 subtract
  `program.span.start` before mapping node spans through
  `originalSpanFromNormalizedOffsets`. Impact: WI2's collector reuses the same
  "plain object keyed by `.type`" walk assumption; binding facts need no span
  mapping, so the offset base is irrelevant to this task.
- Observation: the source masker preserves line terminators when blanking and
  distinguishes line from block comments at scan time. Evidence:
  `src/static-analysis/source-mask-delimiters.ts` `blankMaskedRange` keeps
  terminator characters; `source-mask-comments.ts` branches on
  `nextCharacter === "/"` (line) versus block. Impact: WI3 can build the
  directive-scan text from the existing `maskedText` (index-aligned,
  terminators intact) and re-reveal line comments by copying their original
  characters back, without re-implementing scanning.
- Observation: adding a new source module requires updating the architecture
  inventory test. Evidence: WI1's first `make all` failed in
  `tests/diagnostics/architecture.test.ts` until
  `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` included `workflow-body-parse.ts`.
  Impact: every later new source module in this plan must update the same
  pinned inventory alongside the implementation.
- Observation: the WI2 SWC shape probe matched the plan's assumed wrapper and
  binding-pattern fields. Evidence: parsing the destructuring probe through
  `parseNormalizedWorkflowBody` returned one top-level `FunctionDeclaration`;
  the wrapper name lives in `identifier.value`; user statements live in the
  wrapper `BlockStatement`'s `stmts`; array patterns use `elements`; object
  patterns use `properties` with `AssignmentPatternProperty`,
  `KeyValuePatternProperty`, and `RestElement`; function parameters use
  `params[].pat`; default bindings use `AssignmentPattern.left`; rest bindings
  use `argument`; catch bindings use `handler.param`. Impact:
  `collectLexicalBindings` can unwrap the synthetic function and walk only
  those binding-position fields without span mapping.
- Observation: `fast-check`'s `stringMatching(/[A-Za-z0-9_]{0,8}/u)` produced
  a whitespace-containing counter-example (`"a "`). Evidence: the initial WI2
  property failed with counter-example `["a "]`. Impact: the final identifier
  generator uses an explicit finite set of valid identifier continuation
  characters instead of regex-generated strings.
- Observation: SWC stores class constructor parameters on `Constructor.params`
  and public/private method parameters on `ClassMethod.function.params` /
  `PrivateMethod.function.params`. Evidence: the class-method shape probe over
  `class C { constructor({ a }) {} method([b]) {} #secret(c = 1) {} }` showed
  those exact node fields. Impact: `collectLexicalBindings` includes dedicated
  collectors for `Constructor`, `ClassMethod`, and `PrivateMethod` so method
  parameters are not missed by future global-helper shadowing rules.
- Observation: `maskNonCodeSource` emits sorted, non-overlapping ranges, so
  filtering out revealed line comments preserves the range invariant needed by
  `isIndexInInertRegion`'s binary search. Evidence: `source-mask-types.ts`
  documents sorted, disjoint ranges, and WI3's generated invariant test checks
  inert membership across mixed block and line comment sources. Impact: the
  suppression-mask predicate can stay logarithmic without adding a second
  range-normalization pass.
- Observation: public `WorkflowAstFacts` can remain parser-type-free while
  internal code still reuses an existing SWC parse result. Evidence: WI4 keeps
  `collectWorkflowAstFacts` as the package-facing API and adds internal-only
  `collectWorkflowAstFactsFromParseResult`, guarded by source-file and
  body-span identity carried on `NormalizedBodyParseResult`. Impact: downstream
  rule code can avoid a second parse without exposing `@swc/core`'s `Module`
  through `src/index.ts`.

## Decision log

- Decision: this task adds production fact producers plus tests and docs; it
  emits no diagnostics, defines no rule, changes no `Diagnostic` shape, and
  does not wire into `lintWorkflowSource`. Rationale:
  `docs/developers-guide.md` lines 71-72 and 133-138 scope 2.2.4 to "reusable
  workflow AST facts"; the consuming rules are phase-3 tasks; section 8 gates
  diagnostic-shape changes. Date/Author: 2026-07-03, planning agent.
- Decision: lexical binding facts are name-based (a `boundNames` set), not
  span-based. Rationale: the shadowing query the success line requires needs
  only a name-set; recording binding spans would pull in SWC offset-base
  handling that `docs/roadmap.md` lines 581-589 reserve for task 2.2.6.
  Name-based facts keep 2.2.4 independent of 2.2.6. Span-carrying bindings are
  a justified later refinement. Date/Author: 2026-07-03, planning agent.
- Decision: shadowing is a conservative name-set membership test, not
  scope-precise analysis. Rationale: a global-helper rule that suppresses on
  any same-named binding is safe (it prefers a false negative — one missed
  warning — over a false positive on a legitimate local). Scope-precise binding
  analysis is a deferred refinement noted for phase-3 rule work. The success
  line — "distinguish JavaScript globals from shadowed `parallel`, `Array`,
  `Number`, `Object`, and `Math`" — is met by name membership. Date/Author:
  2026-07-03, planning agent.
- Decision: `collectLexicalBindings` unwraps the synthetic wrapper
  `FunctionDeclaration` and begins traversal at its body statements, and also
  seeds an excluded-name set with the shared `WORKFLOW_BODY_WRAP_FUNCTION_NAME`
  constant. Rationale: `normalizeWorkflowBody` wraps every body in a *named*
  declaration `async function __odwLintWorkflowBody__() { … }`
  (`src/static-analysis/workflow-body-normalizer.ts` line 17), so the parsed
  module's only top-level statement is that wrapper. Collecting binding names
  straight off `module.body` would report `__odwLintWorkflowBody__` — a
  normalization implementation detail — in the public
  `LexicalBindingFacts.boundNames`, contradicting the "names the body binds"
  contract and the *Lexical binding* term. Unwrapping is the primary fix; the
  name exclusion via the shared constant is a shape-independent backstop, and
  lifting the literal into `WORKFLOW_BODY_WRAP_FUNCTION_NAME` (byte-identical
  prefix, snapshot-neutral) keeps the wrapper name defined in exactly one place
  (`AGENTS.md` DRY). Two tests pin the wart: `boundNames` excludes
  `__odwLintWorkflowBody__`, and one body's `boundNames` equals exactly the
  user-declared set. Date/Author: 2026-07-03, planning agent (round 2,
  design-review response).
- Decision: the suppression mask reveals line comments and blanks strings,
  templates, regexes, and block comments, reusing `maskNonCodeSource` rather
  than adding a second scanner. Rationale: the success line lists exactly those
  four inert kinds ("strings, templates, regexes, and block comments") and
  omits line comments, because real directives live in line comments. Deriving
  from the existing masker (option (c)) avoids duplicating the scan
  orchestration and keeps one masking contract (`AGENTS.md` DRY policy).
  Date/Author: 2026-07-03, planning agent.
- Decision: `WorkflowAstFacts` is `@swc/core`-free; the raw `Module` stays
  internal to the parse helper and collector. Rationale: keeps the public
  package surface stable and parser-agnostic, matching
  `originalSpanFromNormalizedOffsets`'s numeric-offset boundary
  (`docs/developers-guide.md` line 70). Date/Author: 2026-07-03, planning agent.
- Decision: WI1 extracts a shared internal parse helper so `parseWorkflowBody`
  and the facts collector share one normalize-and-parse path and one
  `ParseOptions` constant. Rationale: `AGENTS.md` requires sweeping for an
  existing equivalent before duplicating; the equivalent is
  `parseWorkflowBody`'s `normalizeWorkflowBody` + `parseSync` sequence.
  Extracting first, as a separate atomic refactor, keeps one parse path.
  Date/Author: 2026-07-03, planning agent.
- Decision: keep Oxford `-ize` spellings in the ExecPlan and reject
  CodeRabbit's `normalise` / `normaliser` spelling suggestion. Rationale:
  `AGENTS.md` and `docs/documentation-style-guide.md` explicitly require en-GB
  Oxford spelling, where this project standardizes on `-ize` and reserves
  `-yse` for words such as `analyse`. Date/Author: 2026-07-03, implementation
  agent.
- Decision: preserve the caught SWC parse error on the internal
  `NormalizedBodyParseResult` failure branch. Rationale: the helper is not
  public, so carrying `error: unknown` does not leak parser types through
  `src/index.ts`; it keeps future parser-backed diagnostics able to inspect
  parser context without changing `parseWorkflowBody`'s public diagnostic shape
  in WI1. Date/Author: 2026-07-03, implementation agent.

## Outcomes & retrospective

The shipped `WorkflowAstFacts` matches the plan's intended boundary: the public
object is `@swc/core`-free, reports parse success, exposes name-based lexical
bindings for global-helper shadowing, and carries suppression masks that blank
strings, templates, regex literals, and block comments while keeping line
comments visible. Focused tests cover lexical binding syntax forms, reference
negatives, class members, default initializers, source-mask decoys,
line-comment visibility, parser-failure facts, public exports, and guarded
internal parse-result reuse. No diagnostic shape changed, no new rule id was
added, and `lintWorkflowSource` remains unchanged.

## Context and orientation

A novice needs these files:

- `src/static-analysis/workflow-body-parser.ts` — `parseWorkflowBody` today
  normalizes the body, calls `parseSync`, and discards the AST. WI1 refactors
  the normalize-and-parse step into a shared helper that also *returns* the
  parsed `Module`.
- `src/static-analysis/workflow-body-normalizer.ts` — `normalizeWorkflowBody`
  wraps the body in `async function __odwLintWorkflowBody__() { … \n}` and
  records prefix/offset metadata. The wrapper is why a top-level function body
  parses. **Consequence for WI2:** the parsed `Module`'s single top-level
  statement *is* this named wrapper `FunctionDeclaration`
  (`workflow-body-normalizer.ts` line 17), so a naïve "collect every
  `FunctionDeclaration` name" walk would wrongly report the synthetic
  `__odwLintWorkflowBody__` binding. The wrapper is a normalization
  implementation detail and must never appear in public `boundNames`; WI2's
  collector unwraps it (see WI2). The wrapper name literal lives only here, so
  WI2 lifts it into an exported `WORKFLOW_BODY_WRAP_FUNCTION_NAME` constant
  (built into the existing prefix; snapshot-neutral) that the collector imports
  for a defensive exclusion, rather than re-declaring the string.
- `src/static-analysis/source-mask.ts` — `maskNonCodeSource(sourceFile)`
  returns `MaskedSource { sourceFile, maskedText, ranges }` where each range is
  `{ kind: "comment"|"string"|"template"|"regex", startIndex, endIndex }` in
  UTF-16 text indexes. This is the base for suppression masks.
- `src/static-analysis/source-mask-comments.ts` — shows the line/block comment
  distinction (`nextCharacter === "/"` opens a line comment) that WI3 reuses to
  classify a "comment" range as line or block.
- `src/static-analysis/source-mask-delimiters.ts` — `blankMaskedRange`
  preserves line terminators while blanking; the alignment contract WI3 depends
  on.
- `src/static-analysis/types.ts` — `WorkflowEnvelope`, `OriginalSourceFile`,
  `SourceSpan`, and the `SourceOffsetError`. `WorkflowAstFacts` will live
  alongside these or in the new fact modules.
- `src/static-analysis/index.ts` and `src/index.ts` — the two re-export
  surfaces WI4 extends.
- `tests/static-analysis/workflow-body-parser.test.ts` — the AST-walk and
  `envelopeForBody` construction idioms to reuse; `envelopeForBody(body)`
  builds a scanned envelope from `export const meta = {…};\n` + `body`.
- `tests/static-analysis/workflow-envelope-support.ts` — `expectScannedEnvelope`
  narrows a scan result to its envelope.
- `docs/technical-design.md` sections 6.2 (static source model / masking
  strategy) and 9.2-9.3 (the rules that will consume these facts);
  `docs/developers-guide.md` lines 49-138 and 478-491.

Terms:

- **Lexical binding.** A name a piece of source *declares* in a scope: `const`,
  `let`, `var`, a function or class declaration name, a function/arrow
  parameter, a destructured pattern element, or a `catch (e)` parameter. A
  *reference* (reading a name) is not a binding.
- **Shadowing.** Declaring a binding whose name equals a global (for example a
  workflow-local `const Math = …`) so that a use of that name resolves to the
  local, not the global.
- **Global helper.** For this task, the identifiers the success line names:
  the ODW-injected `parallel` and the JavaScript built-ins `Array`, `Number`,
  `Object`, and `Math`.
- **Inert region / mask.** A span of source (comment, string, template, or
  regex) whose text is not code. `maskNonCodeSource` blanks these to spaces
  (keeping terminators and indexes) so scanners do not read decoy syntax.
- **Directive-scan text.** A variant masked view in which strings, templates,
  regexes, and *block* comments are blanked but *line* comments are left
  intact, so a future suppression parser can read directives only from line
  comments.

## Plan of work

Stages map to work items; each ends with its own validation and its own commit.
No language-router skill applies (this repository is TypeScript-only); follow
`AGENTS.md` TypeScript Guidance and the `code-review` skill's habits. Load the
`execplans` skill (this plan) and keep it current.

### WI1 — Extract a shared internal normalized-body parse helper (refactor)

Read first: `AGENTS.md` "Separate Atomic Refactors" (lines 144-149) and DRY
policy; `docs/developers-guide.md` lines 49-72;
`src/static-analysis/workflow-body-parser.ts`.

Create `src/static-analysis/workflow-body-parse.ts` exporting an internal
helper that normalizes and parses one envelope and returns the parsed module:

```ts
import type { Module } from "@swc/core";

export type NormalizedBodyParseResult =
  | { readonly ok: true; readonly module: Module }
  | { readonly ok: false };

export const parseNormalizedWorkflowBody: (
  envelope: WorkflowEnvelope,
) => NormalizedBodyParseResult;
```

Move the `WORKFLOW_BODY_PARSE_OPTIONS` constant and the `normalizeWorkflowBody`

- `parseSync` call into this module. Rewire `parseWorkflowBody` (in
`workflow-body-parser.ts`) to call `parseNormalizedWorkflowBody`; on
`{ ok: false }` it builds the same `odw/body-syntax` diagnostic as today. This
module is **not** re-exported publicly (it returns an `@swc/core` type); it is
an internal collaborator.

This is snapshot-neutral: `parseWorkflowBody`'s observable result is unchanged.
It is a pure refactor landing before the feature, so the shared parse path
exists for WI2 and WI4.

Validation: `make all` — the existing `workflow-body-parser.test.ts` and
`body-diagnostic-spans.test.ts` suites pass unchanged, with no `.snap` diffs.

### WI2 — Lexical binding facts module (feature)

Read first: `docs/technical-design.md` sections 6.2 and 9.2-9.3;
`tests/static-analysis/workflow-body-parser.test.ts` lines 63-176 (AST-walk
idiom); `AGENTS.md` Testing (table-driven + `fast-check`).

Step 1 (shape probe — do this before writing the collector). Add a temporary
scratch test that parses one destructuring sample through
`parseNormalizedWorkflowBody` and prints
`JSON.stringify(result.module, null, 2)` for a body such as:

```js
const { a, b: c, d = 1, ...rest } = obj;
const [e, , f = 2, ...g] = list;
function h(i, { j }, [k], l = Math.max(1, 2)) {}
try {} catch (m) {}
```

Run it once to capture the real node shapes, and specifically confirm the
**wrapper unwrap** path the collector depends on:

- `module.body` is a single-element array whose element is the wrapper
  `FunctionDeclaration` (`type: "FunctionDeclaration"`);
- the wrapper's name identifier field (expected
  `identifier.value === "__odwLintWorkflowBody__"`, matching
  `WORKFLOW_BODY_WRAP_FUNCTION_NAME`);
- the wrapper's body statement-list field (expected `body.stmts`, the SWC
  `BlockStatement` field), which is where user declarations live;

plus the pattern shapes (identifier name field, array pattern element field,
object pattern property/`RestElement` fields, `AssignmentPattern` left/right
fields). Record the observed shapes in `Surprises & Discoveries`, then **delete
the scratch test** before committing. This replaces the network research that
was unavailable at plan time. If the probe shows the wrapper is not the sole
top-level statement, or the body-statement field is not `stmts`, record the
real shape and adjust the unwrap accordingly (the defensive name exclusion in
step (b) below still holds regardless of tree shape).

First, lift the wrapper name into a shared constant. Edit
`src/static-analysis/workflow-body-normalizer.ts` to export
`WORKFLOW_BODY_WRAP_FUNCTION_NAME = "__odwLintWorkflowBody__"` and rebuild the
existing private `WORKFLOW_BODY_WRAP_PREFIX` from it
(`` `async function ${WORKFLOW_BODY_WRAP_FUNCTION_NAME}() {` ``). This produces
byte-identical `normalizedText`, so the normalizer and body-parser snapshots do
not change (verified:
`tests/static-analysis/__snapshots__/workflow-body-normalizer.test.ts.snap`
line 4 already embeds the same prefix). Do **not** add this constant to
`src/static-analysis/index.ts` or `src/index.ts`; it stays an internal
collaborator imported by the collector via its module path.

Create `src/static-analysis/workflow-ast-bindings.ts`:

- Type `LexicalBindingFacts = { readonly boundNames: readonly string[] }`
  (sorted, unique, frozen).
- `collectLexicalBindings(module: Module): LexicalBindingFacts` — **unwrap the
  synthetic wrapper before walking.** `normalizeWorkflowBody` makes the parsed
  module's sole top-level statement the named wrapper `FunctionDeclaration`
  `__odwLintWorkflowBody__`; collecting from `module.body` directly would leak
  that synthetic name (see the wrapper-name-pollution risk). Therefore:
  1. Locate the wrapper: the single top-level `FunctionDeclaration` whose
     `identifier.value === WORKFLOW_BODY_WRAP_FUNCTION_NAME`. Begin the
     recursive walk at that wrapper's body statements (`body.stmts`,
     probe-confirmed), **not** at the wrapper node itself, so neither the
     wrapper's binding name nor its parameter list is ever visited. (If the
     probe shows a different top-level shape, walk from whatever holds the user
     statements; the exclusion in the next bullet is the invariant backstop.)
  2. Defensive backstop: seed the collector's accumulator with an excluded-name
     set containing `WORKFLOW_BODY_WRAP_FUNCTION_NAME`, and drop any binding
     whose name is in that set before it reaches `boundNames`, so the synthetic
     name can never surface even if the tree shape changes.
  From the unwrapped statements, walk recursively, collecting binding names
  from binding positions only:
  - `VariableDeclarator.id` patterns,
  - `FunctionDeclaration` / `ClassDeclaration` name identifiers,
  - function / arrow / method parameter patterns,
  - `CatchClause` parameter pattern,
  - named `FunctionExpression` / `ClassExpression` binding names.
  Inside a pattern, recurse through binding sub-nodes only: array pattern
  elements, object pattern property *values* and rest elements,
  `AssignmentPattern.left` (never `.right`), and `RestElement` arguments. Read
  the identifier name from the field the probe confirmed (expected `value`). Do
  **not** collect names reached only through references (member-expression
  objects, computed keys, default-value expressions, call arguments).
- `isIdentifierBound(facts: LexicalBindingFacts, name: string): boolean` —
  membership predicate the future rules call.

Tests: `tests/static-analysis/workflow-ast-bindings.test.ts`:

- Table-driven positive matrix: for each of `parallel`, `Array`, `Number`,
  `Object`, `Math`, a body that binds it via, across the table, `const`, `let`,
  `var`, function declaration, function parameter, object-destructure,
  array-destructure, default-parameter binding, and `catch` parameter; assert
  `isIdentifierBound(facts, name) === true`.
- Negative matrix: bodies that only *reference* those names
  (`Math.random();`, `parallel(items);`, `const y = Array.from(items);`), a
  default-value reference (`function f(x = Math.max(1, 2)) {}`), and a computed
  key (`const { [Math]: z } = o;`); assert
  `isIdentifierBound(facts, name) === false` for the referenced-but-unbound
  global.
- Wrapper-exclusion (pins the wrapper-name-pollution wart): for a representative
  body such as `const parallel = 1; function h() {}`, assert
  `isIdentifierBound(facts, "__odwLintWorkflowBody__") === false` and that
  `facts.boundNames` does **not** include `"__odwLintWorkflowBody__"`. This
  test must fail on any collector that walks `module.body` without unwrapping
  the wrapper.
- Exact-set (pins that `boundNames` is exactly the user-declared set for one
  body, with no synthetic or spurious names): for a body such as
  `const a = 1; function b() {} const { c } = o;`, assert
  `[...facts.boundNames].sort()` deep-equals `["a", "b", "c"]` — i.e. neither
  `__odwLintWorkflowBody__` nor any reference leaks in.
- One `fast-check` property: for a generated identifier name declared with
  `const <name> = 1;`, `boundNames` always contains `<name>` (invariant: every
  declared name is reported). Use a generator constrained to valid identifier
  starts to avoid the filtering trap (`AGENTS.md` `fast-check` guidance).

Follow Red-Green-Refactor: write the failing positive test first, confirm it
fails for the intended reason (empty `boundNames`), then implement the
collector.

Validation: `make all`.

### WI3 — Suppression source-mask module (feature)

Read first: `docs/technical-design.md` section 6.2 (masking strategy) and 11.1
(decoy corpus); `src/static-analysis/source-mask.ts`,
`source-mask-comments.ts`, and `source-mask-delimiters.ts`;
`docs/developers-guide.md` lines 478-491.

Create `src/static-analysis/workflow-suppression-mask.ts`:

- Type
  `WorkflowSuppressionMasks = { readonly sourceFile: OriginalSourceFile;
  readonly directiveScanText: string;
  readonly inertRanges: readonly SourceMaskRange[] }`
  (frozen; `inertRanges` are the ranges blanked in `directiveScanText`).
- `buildSuppressionMasks(sourceFile: OriginalSourceFile): WorkflowSuppressionMasks`
  — call `maskNonCodeSource(sourceFile)`; classify each `kind: "comment"` range
  as line vs block using the character after its opening slash
  (`sourceText[startIndex + 1]`: `"/"` → line, else block); build
  `directiveScanText` from `maskedText` by copying the original characters back
  over every *line-comment* range (revealing them) and leaving strings,
  templates, regexes, and block comments blanked; `inertRanges` is every
  string/template/regex range plus every block-comment range.
- `isIndexInInertRegion(masks: WorkflowSuppressionMasks, index: number): boolean`
  — membership predicate over `inertRanges` for a future suppression scanner.

Tests: `tests/static-analysis/workflow-suppression-mask.test.ts`:

- Reveal case: a `// odw-lint-disable` line comment survives verbatim in
  `directiveScanText` and its index is **not** in an inert region.
- Blank cases (table-driven over string, template, regex, block comment): the
  decoy token `odw-lint-disable` placed inside each is blanked in
  `directiveScanText` (asserted by
  `directiveScanText.indexOf("odw-lint-disable")` at that position returning
  `-1`) and its index **is** reported inert.
- Alignment invariant:
  `directiveScanText.length === sourceFile.sourceText.length` and every
  line-terminator position is preserved (spot-check with a multi-line block
  comment so its interior newlines survive).
- Optional reviewer snapshot of `directiveScanText` for one representative
  mixed body, paired with the semantic assertions above (`AGENTS.md` "pair
  snapshots with semantic assertions"). Serialize through `JSON.stringify` so
  blanked runs and terminators are visible and the `.snap` stays ASCII-safe.

Validation: `make all`.

### WI4 — Assemble `WorkflowAstFacts` and export the surface (feature)

Read first: `docs/developers-guide.md` lines 101-107 (freezing contract) and
128-131 (public re-export policy); `src/static-analysis/index.ts`;
`src/index.ts`.

Create `src/static-analysis/workflow-ast-facts.ts`:

```ts
export type WorkflowAstFacts = {
  readonly parseSucceeded: boolean;
  readonly lexicalBindings: LexicalBindingFacts;
  readonly suppressionMasks: WorkflowSuppressionMasks;
};

export const collectWorkflowAstFacts: (
  envelope: WorkflowEnvelope,
) => WorkflowAstFacts;
```

`collectWorkflowAstFacts` calls `parseNormalizedWorkflowBody(envelope)`; on
`{ ok: true }` it sets `parseSucceeded: true` and
`lexicalBindings = collectLexicalBindings(module)`; on `{ ok: false }` it sets
`parseSucceeded: false` and empty bindings. It always builds
`suppressionMasks = buildSuppressionMasks(envelope.sourceFile)` (masks derive
from the original source, independent of parse success). Freeze the returned
container.

Re-export `collectWorkflowAstFacts`, `WorkflowAstFacts`, `LexicalBindingFacts`,
`isIdentifierBound`, `WorkflowSuppressionMasks`, and `isIndexInInertRegion` from
`src/static-analysis/index.ts`, and re-export the same names from
`src/index.ts` (alphabetically, matching the existing block). Do not export
`parseNormalizedWorkflowBody`, `NormalizedBodyParseResult`, or any `@swc/core`
type.

Tests: `tests/static-analysis/workflow-ast-facts.test.ts`:

- Happy path: a realistic body that declares `const Math = customMath;` and
  references `parallel(items)` returns `parseSucceeded: true`,
  `isIdentifierBound(facts.lexicalBindings, "Math") === true`, and
  `isIdentifierBound(facts.lexicalBindings, "parallel") === false`, plus a
  suppression-mask assertion for a decoy inside a string.
- Parse-failure path: a body with an unclosed block
  (`if (args.ready) {\n`) returns `parseSucceeded: false`, empty `boundNames`,
  and still-populated `suppressionMasks`.
- Public-surface test: import the new names from `"odw-lint"` and assert they
  are callable where they are runtime values, and cover exported fact types
  (`WorkflowAstFacts`, `LexicalBindingFacts`, and `WorkflowSuppressionMasks`)
  with compile-time `expectTypeOf` assertions.
- Freeze test: `Object.isFrozen(facts)` is `true`.

No behavioural (Gherkin) or end-to-end test is required: this task changes no
externally observable CLI behaviour (`AGENTS.md` adds e2e only "when a change
affects externally observable behaviour"). Record that rationale in the commit
body.

Validation: `make all`.

### WI5 — Documentation and roadmap tick (docs)

Read first: `docs/documentation-style-guide.md`; `AGENTS.md` Markdown Guidance
(80-column prose, 120-column code, en-GB); `docs/developers-guide.md` the
body-parser and source-mask sections.

- Add a "Workflow AST facts" subsection to `docs/developers-guide.md` (after
  the body-parser adapter section, near line 72) naming
  `collectWorkflowAstFacts`, `WorkflowAstFacts`, `LexicalBindingFacts` /
  `isIdentifierBound`, and `WorkflowSuppressionMasks` / `isIndexInInertRegion`;
  stating the name-based shadowing model and the line-comment-visible
  directive-scan mask; and recording that facts emit no diagnostics and are not
  yet wired into `lintWorkflowSource`.
- Update the sentence at `docs/developers-guide.md` lines 71-72 so it no longer
  says exposing AST facts "remains task 2.2.4's boundary" once the facts exist;
  point instead at the new subsection.
- Tick roadmap task 2.2.4: change `- [ ] 2.2.4.` to `- [x] 2.2.4.` at
  `docs/roadmap.md` line 563.

Format only the two changed Markdown files, then run the documented Markdown
validators:

```bash
mdtablefix docs/developers-guide.md docs/roadmap.md
markdownlint-cli2 --fix docs/developers-guide.md docs/roadmap.md
make markdownlint
make nixie
```

Validation: `make markdownlint`, `make nixie`, and `make all`.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-2-4`.

1. WI1: create `src/static-analysis/workflow-body-parse.ts`; edit
   `workflow-body-parser.ts` to consume it. Then:

   ```bash
   bunx @biomejs/biome format --write \
     src/static-analysis/workflow-body-parse.ts \
     src/static-analysis/workflow-body-parser.ts
   make all
   ```

   Expect: all suites pass; no `.snap` diffs.

2. WI2: add the scratch shape probe, run it once (confirm the wrapper-unwrap
   shape and pattern shapes), record the shapes, delete it. Export
   `WORKFLOW_BODY_WRAP_FUNCTION_NAME` from `workflow-body-normalizer.ts` and
   rebuild the prefix from it (snapshot-neutral). Then create
   `workflow-ast-bindings.ts` (unwrapping the wrapper + excluding its name) and
   its test. Prove Red then Green:

   ```bash
   bun test tests/static-analysis/workflow-ast-bindings.test.ts
   # After the collector is implemented:
   bun test tests/static-analysis/workflow-ast-bindings.test.ts
   bunx @biomejs/biome format --write \
     src/static-analysis/workflow-body-normalizer.ts \
     src/static-analysis/workflow-ast-bindings.ts \
     tests/static-analysis/workflow-ast-bindings.test.ts
   make all
   ```

3. WI3: create `workflow-suppression-mask.ts` and its test; if a snapshot is
   recorded, review the diff and confirm blanked runs are visible:

   ```bash
   bun test tests/static-analysis/workflow-suppression-mask.test.ts \
     --update-snapshots
   bunx @biomejs/biome format --write \
     src/static-analysis/workflow-suppression-mask.ts \
     tests/static-analysis/workflow-suppression-mask.test.ts
   make all
   ```

4. WI4: create `workflow-ast-facts.ts`, extend both index files, add the
   integration test:

   ```bash
   bunx @biomejs/biome format --write \
     src/static-analysis/workflow-ast-facts.ts \
     src/static-analysis/index.ts src/index.ts \
     tests/static-analysis/workflow-ast-facts.test.ts
   make all
   ```

5. WI5: edit the two Markdown files, format the two paths, then
   `make markdownlint`, `make nixie`, and `make all`.

Commit after each work item with an imperative, en-GB, ≤50-character subject
and a wrapped body explaining what and why (`AGENTS.md` Committing). Gate every
commit with `make all` (plus `make markdownlint` and `make nixie` for WI5).

## Validation and acceptance

Acceptance is behavioural at the fact-API level and gate-based.

- Running `make all` passes at every commit. `make all` runs build, format
  check, whitespace hygiene, lint, typecheck, and tests
  (`docs/developers-guide.md` lines 148-156).
- Lexical binding facts (WI2, WI4): for every case in the positive matrix,
  `isIdentifierBound(facts.lexicalBindings, name)` is `true`; for every
  reference-only case, it is `false`; the `fast-check` property holds that a
  declared name always appears in `boundNames`. The synthetic wrapper name
  `__odwLintWorkflowBody__` never appears in `boundNames`, and for the
  representative exact-set body `boundNames` equals precisely the user-declared
  set (no synthetic or reference names).
- Suppression masks (WI3, WI4): a `//` directive survives in
  `directiveScanText` and is not inert; the decoy token inside a string,
  template, regex, and block comment is blanked and inert;
  `directiveScanText.length` equals the original source length and terminators
  are preserved.
- Parse-failure path (WI4): `collectWorkflowAstFacts` on an unparseable body
  returns `parseSucceeded: false`, empty `boundNames`, and populated
  `suppressionMasks`.
- Red-Green-Refactor evidence: WI2 and WI3 add a failing test before the
  production code (Red: the fact is empty / unmasked), then the minimal
  collector/masker turns it green; WI1 is the refactor stage, proven neutral by
  unchanged snapshots.
- Markdown changes (WI5): `make markdownlint` and `make nixie` pass.

Quality criteria ("done"):

- Tests: the four new suites pass under `make test`, and the existing
  body-parser and span-snapshot suites pass unchanged.
- Lint/format/typecheck: clean under `make all`; no `@swc/core` type appears in
  a public export.
- No `Diagnostic` diff; `docs/technical-design.md` section 8 unchanged;
  `workflow-lint.ts` unchanged.
- Roadmap 2.2.4 ticked; developers' guide documents the facts.

Quality method: `make all` at each commit; manual review of any recorded
snapshot diff before committing (`AGENTS.md` snapshot policy).

## Idempotence and recovery

- Every new test builds its source in memory and is deterministic; re-running
  any step is safe.
- WI1 is reversible by inlining the helper back into `parseWorkflowBody`; it
  changes no snapshot.
- The WI2 scratch shape probe must be deleted before committing; leave the
  worktree clean (no `_probe`/scratch files).
- If a binding case unexpectedly reports the wrong membership, fix the
  collector's position handling rather than weakening the assertion; if a
  suppression case blanks the wrong region, fix the line/block classification.

## Interfaces and dependencies

Public `odw-lint` surface added (re-exported from `src/index.ts` and
`src/static-analysis/index.ts`):

```ts
import type { OriginalSourceFile, WorkflowEnvelope } from "odw-lint";
import type { SourceMaskRange } from "odw-lint";

export type LexicalBindingFacts = { readonly boundNames: readonly string[] };
export const isIdentifierBound: (
  facts: LexicalBindingFacts,
  name: string,
) => boolean;

export type WorkflowSuppressionMasks = {
  readonly sourceFile: OriginalSourceFile;
  readonly directiveScanText: string;
  readonly inertRanges: readonly SourceMaskRange[];
};
export const isIndexInInertRegion: (
  masks: WorkflowSuppressionMasks,
  index: number,
) => boolean;

export type WorkflowAstFacts = {
  readonly parseSucceeded: boolean;
  readonly lexicalBindings: LexicalBindingFacts;
  readonly suppressionMasks: WorkflowSuppressionMasks;
};
export const collectWorkflowAstFacts: (
  envelope: WorkflowEnvelope,
) => WorkflowAstFacts;
```

Internal-only (not re-exported):

```ts
// src/static-analysis/workflow-body-parse.ts
import type { Module } from "@swc/core";
export type NormalizedBodyParseResult =
  | {
      readonly ok: true;
      readonly module: Module;
      readonly sourceFile: WorkflowEnvelope["sourceFile"];
      readonly bodySpan: SourceSpan;
    }
  | {
      readonly ok: false;
      readonly error: unknown;
      readonly sourceFile: WorkflowEnvelope["sourceFile"];
      readonly bodySpan: SourceSpan;
    };
export const parseNormalizedWorkflowBody: (
  envelope: WorkflowEnvelope,
) => NormalizedBodyParseResult;

// src/static-analysis/workflow-ast-facts.ts
export const collectWorkflowAstFactsFromParseResult: (
  envelope: WorkflowEnvelope,
  parseResult: NormalizedBodyParseResult,
) => WorkflowAstFacts;

// src/static-analysis/workflow-body-normalizer.ts (existing module)
// Newly exported so the binding collector can exclude the synthetic wrapper
// name; NOT re-exported from any index — internal collaborator only.
export const WORKFLOW_BODY_WRAP_FUNCTION_NAME = "__odwLintWorkflowBody__";
```

Dependencies: `@swc/core@1.15.43` (`parseSync`, `Module` type) and the existing
`maskNonCodeSource` / `normalizeWorkflowBody` collaborators. No new dependency.
No ODW runtime symbol may appear in any new file.

## Revision notes

- 2026-07-03: Marked WI1 complete after extracting the internal
  normalize-and-parse helper, adding focused helper tests, preserving SWC parse
  errors internally, and pinning the SWC `Module` overload with
  `ModuleParseOptions`. Deterministic gates are green; the remaining WI1
  CodeRabbit state is a deferred final re-review after the retry budget was
  exhausted.
- 2026-07-03: Marked WI2 complete after adding lexical binding facts, the
  wrapper-name exclusion, class constructor/method parameter support, default
  initializer traversal, generated identifier coverage, and raw-module fallback
  coverage. Deterministic gates are green; CodeRabbit follow-up items were
  fixed before the WI2 commit.
- 2026-07-03: Marked WI3 complete after adding directive-scan suppression
  masks, inert-region lookup, fixed-case decoy tests, full-text snapshots, and
  generated invariant coverage. Deterministic gates and CodeRabbit are green.
- 2026-07-03: Marked WI4 complete after adding `WorkflowAstFacts`,
  package-entry exports, public API fixture updates, parser-failure coverage,
  an internal parse-result reuse seam, and identity-guard regression tests.
  Deterministic gates and CodeRabbit are green.
- 2026-07-03: Marked WI5 complete after documenting workflow AST facts in the
  developers' guide, ticking roadmap 2.2.4, and completing the retrospective.
  Deterministic gates and CodeRabbit are green.
