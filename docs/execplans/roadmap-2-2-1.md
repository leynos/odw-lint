# Add `@swc/core` and implement the workflow body parser adapter

This ExecPlan (execution plan) is a living document. The sections `Constraints`,
`Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint` statically checks ODW workflow files without executing them. Today
the pipeline stops at the workflow *envelope* (the `export const meta`
declaration and top-level import/export rejection) and metadata classification.
The body of a workflow — everything after the metadata declaration — is never
parsed, so a workflow whose body is not syntactically valid JavaScript is not
reported at all; a naive parse would instead throw.

Roadmap task 2.2.1 (`docs/roadmap.md` lines 541-545) closes that gap by adding
the first real parser to the project. After this change a novice can call one
new function, `parseWorkflowBody`, on a scanned workflow envelope and observe
that a body with a syntax error (an unclosed block, an unterminated call)
becomes a single `odw/body-syntax` diagnostic pointing into the *original*
source file, rather than a thrown exception. A valid body returns a success
result and no diagnostic.

Observable proof comes from the new focused adapter tests and the updated
invalid-fixture parity suite: the two `syntax-error` fixtures under
`tests/static-analysis/fixtures/invalid-workflows/syntax-error/`, which today
carry *deferred* `odw/body-syntax` expectations that no code emits, are now
satisfied by real parser output.

Roadmap success line (verbatim): "body syntax errors become `odw/body-syntax`
diagnostics rather than thrown exceptions."

Roadmap reference: `docs/roadmap.md` task 2.2.1 (lines 541-545). Requires 2.1.2
and 2.1.8 (both complete on this branch's base). Design references:
`docs/technical-design.md` sections 4 and 6.1;
`docs/adr/0001-static-analysis-boundary.md`.

### Scope boundary with task 2.2.2 (read this first)

This is the single most important design decision in the plan. Task 2.2.1 adds
the parser *adapter*; task 2.2.2 (the next roadmap task, `docs/roadmap.md`
lines 546-551) adds *body normalization for top-level `return` and `await`*.
The two must stay separate.

Valid ODW example workflows use top-level `return` — for example
`fixtures/odw-examples/adversarial-verify.js:60` is
`return { confirmed, considered: findings.length }` at column 1. A plain SWC
parse of such a body throws "return outside of function". Normalizing that
(wrapping the body so top-level `return`/`await` parse, and remapping spans
back) is exactly task 2.2.2's deliverable, with success criterion "ODW examples
containing top-level `return` and `await` parse with original-source span
mapping".

Therefore task 2.2.1 **must not** wire `parseWorkflowBody` into the shared
`lintWorkflowSource` entry point or run it over valid-example bodies yet.
Concrete proof this would break the build today: the property generator in
`tests/static-analysis/workflow-lint.test.ts:50` emits `"return 'done';"` as a
generated top-level body; a parser wired into `lintWorkflowSource` would report
a false `odw/body-syntax` for those generated returns and fail that property
test. The two `syntax-error` fixtures this task *does* consume use top-level
`await` (legal in a module) with a genuine delimiter error, so they parse-fail
for the right reason without any normalization.

The adapter is delivered standalone and consumed by focused adapter tests and
the invalid-fixture parity suite. Full pipeline integration over valid examples
is deferred to 2.2.2 (normalization) and 2.3.x (loader parity). This boundary
is recorded in the developers' guide in WI3.

## Constraints

Hard invariants that must hold throughout implementation. Violation requires
escalation, not a workaround.

- **No source evaluation.** The parser adapter and every module it
  imports must remain static. It must not import or call `loadWorkflowScript`,
  `createPrimitives`, the runtime `validate` primitive, `new Function`, `eval`,
  or any ODW loader, primitive, launcher, worker, runtime, scheduler,
  metadata-evaluating, or agent-dispatch path. SWC's `parseSync` only *parses*
  — it never executes source — which is why it is the sanctioned parser
  (`docs/technical-design.md` section 4 step 4, section 5;
  `docs/adr/0001-static-analysis-boundary.md`; section 12.1 trust boundary).
  Enforced by `tests/diagnostics/import-policy.test.ts` ("keeps production code
  free of executable ODW imports").
- **Static string imports only in production code.**
  `tests/diagnostics/import-policy.test.ts` also fails production code that
  uses computed `import(expr)` or `require(expr)`. The adapter must import
  `@swc/core` with a plain static `import { parseSync } from "@swc/core"` edge
  (`isForbiddenOdwImport("@swc/core")` is `false`, verified by
  `tests/diagnostics/odw-import-policy.ts`).
- **Spans point into original source.** Every emitted `odw/body-syntax`
  span must be an original-source, half-open span built through the existing
  `src/static-analysis/source-position.ts` helpers (`spanFromOffsets`) against
  the factory-built `OriginalSourceFile`. Never emit a span in the parsed
  body-slice coordinate system (`docs/technical-design.md` section 8 span
  invariants, section 11.5).
- **Catalogue is the source of truth for the rule.** The diagnostic must
  use the already-catalogued rule `odw/body-syntax` with its exact reviewed
  message "Workflow body must be syntactically complete after ODW
  normalization." and docs path `docs/rules/body-syntax.md`
  (`src/diagnostics/rule-catalogue.ts:150-156`, `ruleDocsPath`). Do not add,
  rename, or re-message any rule. `src/diagnostics/**` is owned by earlier
  tasks and must not be modified.
- **Do not do 2.2.2's job.** No body wrapping or normalization for
  top-level `return`/`await`, and no wiring into `lintWorkflowSource` or the
  valid-example pipeline (see "Scope boundary" above). No AST-fact exposure
  (that is task 2.2.4).
- **Public API additions are guarded.** Any symbol re-exported from
  `src/index.ts` must be added to `tests/diagnostics/public-api-fixtures.ts` in
  the same commit, and any new file under `src/static-analysis/` must be added
  to `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` in
  `tests/diagnostics/architecture-fixtures.ts`
  (`tests/diagnostics/architecture.test.ts:32`). Do not weaken those guards.
- **Dependency hygiene.** `@swc/core` is added with a caret range and a
  `dependencyJustifications` entry in `package.json`; `bun.lock` is committed
  (`AGENTS.md` version policy and lockfile rules).
- **Prose and commits** follow en-GB Oxford spelling
  ("-ize"/"-yse"/"-our") per `AGENTS.md` and
  `docs/documentation-style-guide.md`. Every new module opens with a
  `/** @file … */` block (`AGENTS.md` docs rule).

## Tolerances (exception triggers)

- **Native binding:** if `@swc/core`'s native binding does not load and
  run `parseSync` under Bun in this repository (WI1 probe), stop and escalate —
  the packaging decision (`docs/technical-design.md` section 13) assumes a
  working TypeScript/Bun + SWC path and this is a design-level blocker, not a
  workaround target.
- **Error shape:** if SWC's thrown syntax error exposes no usable position
  information at all (no byte offset and no line/column), stop and record it;
  fall back to the conservative-span strategy in the Decision Log rule below
  and flag for review rather than inventing a heuristic.
- **Scope:** if implementation requires changes to more than 10 files or
  ~400 net lines, stop and escalate.
- **Interface:** the only new public symbols are `parseWorkflowBody` and
  `WorkflowBodyParseResult`. If any *other* public signature must change, stop
  and escalate.
- **Dependencies:** `@swc/core` is the only new dependency. If any *other*
  runtime or dev dependency is required, stop and escalate.
- **Fixture drift:** if the real SWC-derived span for either
  `syntax-error` fixture differs from the seeded anchor, update the anchor
  **only** through the deterministic `make refresh-fixtures` path and record
  the before/after. Do not hand-edit generated manifests.
- **Iterations:** if `make all` still fails after 3 focused attempts on a
  work item, stop and escalate.

## Risks

- Risk: The seeded `odw/body-syntax` fixture spans in
  `manifests/syntax-error.ts` (span `145-179` / anchor
  `'{\n  await agent("Draft status.");\n'` for `body-unclosed-block.js`; span
  `133-147` / anchor `'agent("draft"\n'` for `body-unclosed-call.js`) were
  hand-authored before any parser existed. The refresh tool only re-derives
  offsets from the hand-authored `spanText` *anchor*
  (`tests/static-analysis/fixtures/refresh-derivation.ts:49-64`); it does not
  run a parser. So the real SWC-derived span may not match the seeded anchor.
  Severity: medium. Likelihood: medium. Mitigation: WI1 probe discovers the
  real span first (prototyping milestone with a go/no-go). WI2 reconciles the
  anchors to the real span through `make refresh-fixtures` (deterministic) and
  records the diff. The behavioural contract (`docs/technical-design.md`
  section 11.5) is "span points into original source", not "match a pre-seeded
  literal".
- Risk: SWC span positions are offset by a process-global `BytePos` base
  counter, so raw node/error offsets are not 0-based into the parsed string.
  Severity: high (silent off-by-base span corruption). Likelihood: high.
  Mitigation: WI1 probe measures the base explicitly and the adapter normalizes
  by subtracting the parse's own program base (`program.span.start`) before
  mapping to original coordinates; a WI1 unit test asserts the emitted span
  slices to the expected original text, which fails loudly if the base is
  mishandled.
- Risk: Wiring the adapter into `lintWorkflowSource` would break the
  `workflow-lint` property test (top-level `return 'done';` generator) and
  produce false errors on valid examples. Severity: high. Likelihood: high if
  wired. Mitigation: Do not wire it in (see "Scope boundary"); the adapter is
  standalone. Documented in WI3.
- Risk: `@swc/core` publishes frequent minor releases; pinning an
  over-narrow range causes churn, an over-broad range risks drift. Severity:
  low. Likelihood: medium. Mitigation: caret range `^<installed>` per
  `AGENTS.md`; commit `bun.lock`; justification recorded in
  `dependencyJustifications`.
- Risk (tooling): the planning session could not install `@swc/core`
  (sandbox/approval) or reach the web (Firecrawl/WebFetch permission-gated), so
  the exact thrown-error shape is not verified in this document. Severity:
  medium. Likelihood: certain (already observed). Mitigation: the load-bearing
  SWC behaviour is pinned by the WI1 probe **test** the implementer runs
  (`bun add @swc/core` is in-scope for WI1); the plan commits to one primary
  strategy and one explicit fallback keyed to the probe result, not a menu. See
  Decision Log "SWC error → span strategy".

## Progress

- [x] WI1: Add `@swc/core`; implement `parseWorkflowBody` (syntax error to
  `odw/body-syntax`) with a probe-verified span strategy and focused unit and
  property tests. Completed 2026-07-02: `@swc/core` 1.15.43 is installed,
  `parseWorkflowBody` is exported, focused adapter tests and snapshots pass,
  `make all` passed, and the final allowed CodeRabbit retry reported only
  low-severity findings.
- [x] WI2: Reconcile the two `syntax-error` fixture anchors with real SWC
  spans and route them through the invalid-fixture parity suite (retire the
  deferred guard). Completed 2026-07-02: `make refresh-fixtures` regenerated
  only `manifests/syntax-error.ts`, and
  `invalid-workflow-metadata-parity.test.ts` now compares real
  `parseWorkflowBody` output for both `syntax-error` fixtures.
- [x] WI3: Document the parser adapter and the deferred normalization
  boundary in the developers' guide. Completed 2026-07-02:
  `docs/developers-guide.md` now describes `parseWorkflowBody`, its
  non-execution contract, and the task 2.2.2 normalization boundary.
- [x] Fix round 1: Resolve blocking review findings on the SWC error
  boundary. Completed 2026-07-02: `parseWorkflowBody` now converts every
  `parseSync` throw from a scanned workflow body into `odw/body-syntax`, imports
  `ParseOptions` through the declared `@swc/core` dependency, and covers
  non-`Expected` syntax families in focused tests. `make all` passed and
  `coderabbit review --agent` reported zero findings before commit `5f9115a`.

## Surprises & discoveries

- Observation: the `odw/body-syntax` fixture expectations already exist
  but are explicitly *deferred* —
  `invalid-workflow-metadata-parity.test.ts:117-129` asserts that the
  task-owned path emits *no* body-syntax diagnostic yet and that
  `taskOwnedFixtureDiagnostics` filters it out. Evidence: that test ("preserves
  deferred body syntax fixture expectations"). Impact: WI2 retires this guard
  by making the emission real.
- Observation: the `swc-parser-adapter` component label and the
  `body`/`ast` stage labels already exist as passive design constants
  (`src/static-analysis/types.ts:155-186`; asserted in
  `tests/static-analysis/boundary.test.ts:35-63`). Impact: no change needed to
  those labels; the adapter realizes an existing slot.
- Observation: the developers' guide already reserves SWC for this task —
  "Direct SWC calls belong only in the future parser adapter from roadmap task
  2.2.1" (`docs/developers-guide.md:47-48`). Impact: WI3 replaces that forward
  reference with the implemented contract.
- Observation: the WI1 SWC probe loaded `@swc/core` under Bun and parsed a
  valid body with `program.span.start === 1`. Syntax failures threw ordinary
  `Error` values with only enumerable key `code`, value `"GenericFailure"`, and
  rendered syntax text ending in `Caused by:\n    Syntax Error`; no structured
  byte offset or reliable line/column was exposed. Impact: WI1 selected
  fallback strategy S2 and emits `envelope.bodySpan` for `odw/body-syntax`
  diagnostics. The final CodeRabbit retry still preferred a precise SWC failure
  span, but that is not implementable from the observed `@swc/core` error shape
  without parsing human diagnostic prose.
- Observation: the seeded `syntax-error` fixture anchors did not match the
  adapter's S2 whole-body spans. `body-unclosed-block.js` moved from offsets
  `145-179` (`'{\n  await agent("Draft status.");\n'`) to offsets `127-179`
  (`'\n\nif (args.ready) {\n  await agent("Draft status.");\n'`).
  `body-unclosed-call.js` moved from offsets `133-147` (`'agent("draft"\n'`) to
  offsets `125-147` (`'\n\nawait agent("draft"\n'`). Impact:
  `make refresh-fixtures` regenerated
  `tests/static-analysis/fixtures/invalid-workflows/manifests/syntax-error.ts`
  deterministically, and the parity suite now proves the manifest matches real
  parser output.

## Decision log

- Decision: Deliver the parser as a standalone adapter
  `parseWorkflowBody`, not wired into `lintWorkflowSource`. Rationale: Valid
  ODW bodies use top-level `return`
  (`fixtures/odw-examples/adversarial-verify.js:60`) and the `workflow-lint`
  property generator emits `"return 'done';"` (`workflow-lint.test.ts:50`);
  wiring in a pre-normalization parser would emit false `odw/body-syntax`
  errors and break those tests. Normalization is task 2.2.2. Standalone
  delivery satisfies the 2.2.1 success line (adapter converts syntax errors to
  diagnostics) without stealing 2.2.2's scope. Date/Author: 2026-07-02,
  planning agent.
- Decision: The adapter returns a discriminated union
  `{ ok: true } | { ok: false; diagnostic: Diagnostic }`. Rationale:
  `AGENTS.md` error-handling — "Use discriminated unions for recoverable
  conditions that callers branch on" and "Convert unknown thrown values and
  third-party failures to project-owned error shapes at API or command
  boundaries." The SWC `Module` AST is *not* exposed on the success branch in
  2.2.1 (AST facts are task 2.2.4), so no `@swc/core` type leaks into the
  public surface and 2.2.4 stays free to design that surface. Date/Author:
  2026-07-02, planning agent.
- Decision (SWC error → span strategy): Primary strategy S1 — map SWC's
  reported failure position to an original-source offset and build the
  `odw/body-syntax` span from it. Fallback strategy S2 (used only if the WI1
  probe shows the thrown error exposes no usable byte offset or line/column) —
  emit a span covering the workflow body (`envelope.bodySpan`) so the
  diagnostic still points into original source. The WI1 probe selects the
  branch; the choice and the observed error shape are recorded here at
  implementation time. No third "heuristic" branch. Rationale: satisfies
  "verified-and-cited OR pinned by a test in the plan" — the choice is pinned
  by the probe test. Avoids leaving the implementer an unverified menu.
  Date/Author: 2026-07-02, planning agent.
- Decision: Parse the workflow **body slice** (original text of
  `envelope.bodySpan` obtained via `sliceSourceSpan`) as EcmaScript, and map
  SWC byte offsets to original coordinates by
  `original = (swcPos - program.span.start) + bodySpan.start.offset`.
  Rationale: the slice is a contiguous UTF-8 byte range of the original, so
  adding the body-start byte offset is exact; subtracting the program base
  neutralizes SWC's global counter. `syntax: "ecmascript"` matches the path/glob
  `*.js` target (`docs/technical-design.md` section 7.2); TypeScript-syntax
  support is out of scope for 2.2.1. Date/Author: 2026-07-02, planning agent.
- Decision: WI1 selected fallback strategy S2 for body syntax diagnostic
  spans. Rationale: `@swc/core` 1.15.43 did not expose a structured
  syntax-error offset from `parseSync`. Mapping the exact failure token would
  require parsing rendered human text, which the plan forbids as a heuristic.
  The adapter therefore reports the scanned original-source body span
  (`envelope.bodySpan`) and locks that shape with snapshot tests. This keeps
  diagnostics in original-source coordinates while leaving finer parser span
  extraction for a future task if SWC exposes stable data. Date/Author:
  2026-07-02, implementation agent.
- Decision: Treat all `parseSync` throws from the scanned body parse as
  `odw/body-syntax`. Rationale: the parser adapter owns an EcmaScript parse
  over a body slice that has already passed envelope scanning. SWC's thrown
  syntax failures are only reliably visible as ordinary `Error` values with
  `code: "GenericFailure"`, and rendered message text is not a stable contract.
  Native binding and module-load faults occur before this adapter catch
  boundary, so the project diagnostic boundary should not rethrow based on
  unrecognized syntax-error prose. Date/Author: 2026-07-02, fix-round agent.

## Outcomes & retrospective

WI1 completed the standalone parser adapter. `parseWorkflowBody` converts
observed SWC syntax failures into frozen `odw/body-syntax` diagnostics, uses
the catalogue severity/message/docs path, keeps the result as a discriminated
union, and leaves `lintWorkflowSource` untouched so the 2.2.2 normalization
boundary remains intact. WI2 still owns manifest parity for the two
`syntax-error` fixtures, and WI3 still owns the developer-guide update.

Fix round 1 removed the brittle SWC rendered-message classifier that
contradicted the 2.2.1 success criterion. The adapter no longer imports from
the undeclared `@swc/types` specifier, and the robustness tests now include
unterminated string, invalid numeric literal, missing expression, and stray
closing-brace bodies so the never-throw contract covers syntax families beyond
delimiter-only examples.

## Context and orientation

`odw-lint` is a static linter for Open Dynamic Workflows (ODW) source. It must
never execute workflow source; it reads text and reasons about it. The package
is private and exposes one consumer surface, `src/index.ts`, pinned by
`package.json` (`main`, `types`, and the `.` export all point at
`./src/index.ts`).

The static pipeline this task extends:

1. `createOriginalSourceFile(source)` in
   `src/static-analysis/source-file.ts`. `WorkflowSource` is
   `{ filePath: string; sourceText: string }`
   (`src/static-analysis/types.ts:15-25`). `OriginalSourceFile` is nominally
   branded; only the factory can build one, and the source-position helpers
   rely on its private indexes.
2. `scanWorkflowEnvelope(sourceFile)` in
   `src/static-analysis/workflow-envelope.ts`. On success
   (`status === "scanned"`) it returns an `envelope` whose `bodySpan` is a
   half-open original-source span from just after the metadata declaration to
   end of file (`src/static-analysis/types.ts:86-94`; body span built at
   `workflow-envelope.ts:159-177`).
3. `classifyWorkflowMetadata(scan)` in
   `src/static-analysis/workflow-metadata.ts`.
4. `lintWorkflowSource(source)` in
   `src/static-analysis/workflow-lint.ts` merges envelope then metadata
   diagnostics. **This task does not change `lintWorkflowSource`.**

Span helpers (`src/static-analysis/source-position.ts`,
`src/static-analysis/source-snippet.ts`):

- `spanFromOffsets(file, startByteOffset, endByteOffset)` builds a
  validated half-open original-source span from UTF-8 byte offsets.
- `sliceSourceSpan(file, span)` returns the original text a span covers
  (public; used by parity tests to prove spans point into original source).
- `positionAtOffset`, `snippetForSpan` are position and snippet lookups.

The rule and its fixtures:

- `odw/body-syntax` is catalogued and `released`
  (`src/diagnostics/rule-catalogue.ts:150-156`): message "Workflow body must be
  syntactically complete after ODW normalization.", docs slug `body-syntax`
  (`docs/rules/body-syntax.md` exists). `ruleDocsPath` yields
  `docs/rules/body-syntax.md`.
- `Diagnostic` shape (`src/diagnostics/types.ts`, re-exported from
  `odw-lint`): `{ file, rule, severity, message, span, docs }` — mirror the
  envelope's `noImportExportDiagnostic` builder
  (`workflow-envelope.ts:191-201`).
- The two `syntax-error` fixtures and their manifest:
  `fixtures/invalid-workflows/syntax-error/body-unclosed-block.js` (body
  `if (args.ready) {\n  await agent("Draft status.");` — unclosed block),
  `body-unclosed-call.js` (body `await agent("draft"` — unterminated call), and
  `manifests/syntax-error.ts` (the seeded `odw/body-syntax` expectations,
  header notes it is generated by `refresh-metadata.ts`).

Guards that will react to this change:

- `tests/diagnostics/architecture.test.ts:32` compares the actual files
  under `src/static-analysis/` to `EXPECTED_STATIC_ANALYSIS_MODULE_FILES`
  (`tests/diagnostics/architecture-fixtures.ts:37-63`). Adding
  `src/static-analysis/workflow-body-parser.ts` requires adding it to that list.
- `tests/diagnostics/public-api-surface.test.ts` deep-equals the package's
  named exports to `EXPECTED_PUBLIC_PACKAGE_EXPORTS`
  (`tests/diagnostics/public-api-fixtures.ts`). New public symbols must be
  added there; the guard prints the exact expected sorted list on failure.
- `tests/diagnostics/package-entry.test.ts` checks `src/index.ts` module
  specifiers against `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS`
  (`architecture-fixtures.ts:8-18`). `./static-analysis` is already listed, so
  re-exporting the new symbols through `./static-analysis` leaves this guard
  unaffected.
- `tests/diagnostics/import-policy.test.ts` scans production imports; the
  static `@swc/core` import must be a plain string edge (it is).
- The file-size guard (a `tests/build-gate` file-size test run through
  `make test`): no source or test TypeScript file may exceed 400 physical lines
  (`AGENTS.md`).

Testing framework: `bun:test` for unit and behavioural tests; `fast-check` for
property tests (idiom: `fc.assert(fc.property(generator, predicate))`, see
`tests/static-analysis/source-mask.property.test.ts` and
`tests/static-analysis/workflow-lint.test.ts`).

Key design references: `docs/technical-design.md` section 4 (design intent —
parse with SWC, step 4), section 6.1 (components — "SWC parser adapter: Parse
normalized JavaScript or TypeScript source and return AST plus syntax errors";
"Span mapper"), section 8 (diagnostic/span invariants), section 11.5
(span-mapping invariant), section 12.2 ("Parser crash on malformed input →
Catch parser exceptions and emit `odw/body-syntax`"), section 13 (packaging —
`@swc/core`); `docs/adr/0001-static-analysis-boundary.md` (owned SWC-based
parser; no executable ODW paths); `AGENTS.md` testing, error-handling, docs,
and dependency rules.

## Plan of work

Three work items, each a vertical slice ending green with `make all` (plus
`make markdownlint` and `make nixie` when Markdown changes).

### WI1 — Add `@swc/core`; implement the `parseWorkflowBody` adapter

Implements: `docs/technical-design.md` sections 4, 6.1, 12.2, 13;
`docs/adr/0001-static-analysis-boundary.md`; `AGENTS.md` testing,
error-handling, docs, and dependency rules. Roadmap 2.2.1 core deliverable.

Read first: `docs/technical-design.md` sections 4, 6.1, 12.2, 13;
`docs/adr/0001-static-analysis-boundary.md`; `docs/developers-guide.md`
static-analysis section (lines ~44-105);
`src/static-analysis/workflow-envelope.ts` (the `noImportExportDiagnostic`
builder and the `bodySpan` construction);
`src/static-analysis/source-position.ts` and `source-snippet.ts`;
`src/diagnostics/rule-catalogue.ts:150-156`; `AGENTS.md` error-handling and
dependency sections.

Skills to load: `leta` (symbol navigation and verification of the envelope,
span helpers, and Diagnostic shape); `grepai` (intent search against `main` for
existing diagnostic builders); the repository's `fast-check` idiom for the
property test. No language-router skill applies — TypeScript work follows repo
standards directly.

Prototyping milestone (do this before writing the adapter): after
`bun add @swc/core`, write a throwaway probe (a scratch `*.ts` file under a
gitignored `tmp/` path, run with `bun run`, **deleted before commit**) that
calls `parseSync` on the two `syntax-error` fixture bodies and on a valid
non-`return` body, and records: (a) that `parseSync` loads and runs under Bun;
(b) the exact shape of the thrown error on a syntax error (does it carry a byte
offset? a line/column? only a message?); (c) `program.span.start` for a
successful parse (the SWC base counter). Use the findings to select strategy S1
or S2 (Decision Log) and to write the WI1 span assertion. Go/no-go: if the
native binding fails under Bun, stop and escalate (Tolerance: native binding).
Record the observed error shape in the Decision Log.

Files:

1. `package.json`: add `@swc/core` to `dependencies` (a production
   dependency of the parser) with a caret range `^<installed version>`, and add
   a `dependencyJustifications` entry, for example: "`@swc/core` is the owned
   static parser chosen by ADR 0001 and technical-design section 13; used only
   by the workflow body parser adapter to detect body syntax errors without
   executing source." Commit the updated `bun.lock`.
2. New `src/static-analysis/workflow-body-parser.ts`:
   - A `/** @file … */` header describing the adapter: parse the workflow
     body slice with SWC and convert syntax errors to `odw/body-syntax`
     diagnostics without executing source.
   - `import { parseSync } from "@swc/core";` (a static string edge).
   - Import the `WorkflowEnvelope` type from `./types`, `Diagnostic` from
     `../diagnostics/types`, `sliceSourceSpan`/`spanFromOffsets` from the
     span modules, and the catalogue helpers used to build the diagnostic
     (`makeRuleId`, `ruleDocsPath`, and the `odw/body-syntax` rule
     definition lookup — mirror the pattern in
     `workflow-envelope.ts:34-43` and `:191-201`).
   - Public surface:

     ```typescript
     // src/static-analysis/workflow-body-parser.ts
     export type WorkflowBodyParseResult =
       | { readonly ok: true }
       | { readonly ok: false; readonly diagnostic: Diagnostic };

     export const parseWorkflowBody = (
       envelope: WorkflowEnvelope,
     ): WorkflowBodyParseResult => { /* … */ };
     ```

   - Behaviour: slice the body text with
     `sliceSourceSpan(envelope.sourceFile, envelope.bodySpan)`; call
     `parseSync(bodyText, { syntax: "ecmascript", jsx: false })` inside a
     `try`; on success return `Object.freeze({ ok: true })`; on a thrown
     error, convert it (per strategy S1/S2) to a frozen `odw/body-syntax`
     `Diagnostic` whose `span` is built with
     `spanFromOffsets(envelope.sourceFile, originalStart, originalEnd)` and
     return `Object.freeze({ ok: false, diagnostic })`. The `catch` must
     convert the third-party throw into the project diagnostic shape and
     must not rethrow (`AGENTS.md` boundary-error rule;
     `docs/technical-design.md` section 12.2).
   - Keep the file well under 400 lines; if span-mapping helpers grow,
     colocate them here (this task adds one focused module).
3. `tests/diagnostics/architecture-fixtures.ts`: add
   `"workflow-body-parser.ts"` to `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` in
   sorted position (between `workflow-envelope.ts` and `workflow-lint.ts`).
4. `src/static-analysis/index.ts`: re-export `parseWorkflowBody` and
   `type WorkflowBodyParseResult` (keep the file's grouped ordering).
5. `src/index.ts`: extend the existing `from "./static-analysis"`
   re-export block to add `parseWorkflowBody` and
   `type WorkflowBodyParseResult` (the specifier `./static-analysis` is
   unchanged, so `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS` needs no edit).
6. `tests/diagnostics/public-api-fixtures.ts`: insert
   `"WorkflowBodyParseResult"` and `"parseWorkflowBody"` in ASCII-sorted
   position (run `make test` first if unsure; the guard prints the expected
   order).

Tests (new `tests/static-analysis/workflow-body-parser.test.ts`, importing the
adapter and the envelope scanner plus `createOriginalSourceFile`/
`sliceSourceSpan` from `odw-lint`, or the adapter via its internal path if
preferred for isolation):

- Unit — unclosed block: build the envelope for the
  `body-unclosed-block.js` fixture source (read via `readFixtureSource`) and
  assert `parseWorkflowBody` returns `{ ok: false }` with one diagnostic whose
  `rule` is `odw/body-syntax`, `severity` `error`, `message` the exact
  catalogue message, and `docs` `docs/rules/body-syntax.md`.
- Unit — unclosed call: the same for `body-unclosed-call.js`.
- Unit — span points into original source: for both fixtures, assert
  `sliceSourceSpan(sourceFile, result.diagnostic.span)` equals the expected
  original text (the value chosen by the probe under S1/S2 — this is the
  assertion that fails loudly on any SWC-base mishandling).
- Unit — valid body: a body with no top-level `return` (for example
  `const x = 1;` or a closed `await agent("ok");`) returns `{ ok: true }` and
  no diagnostic.
- Unit — never throws: a deliberately malformed body (unbalanced braces)
  returns a result, never propagating a thrown SWC error
  (`expect(() => …).not.toThrow()`).
- Unit — frozen: the returned result (and its `diagnostic`, when present)
  is `Object.isFrozen`.
- Property (`fast-check`) — robustness: over a generator of small bodies
  that mixes clearly-valid non-`return` snippets and clearly-broken snippets
  (unbalanced brackets/parens), assert `parseWorkflowBody` always returns a
  `WorkflowBodyParseResult` and never throws, and that broken inputs yield
  `{ ok: false }` with an `odw/body-syntax` diagnostic. Do **not** generate
  top-level `return`/`await`-only bodies whose validity depends on 2.2.2
  normalization; keep the generator within 2.2.1's contract.

Red-Green-Refactor: write the test file first and run it (Red — fails to resolve
`parseWorkflowBody`). Add the dependency and module (Green). Refactor JSDoc
and formatting and re-run.

Validation: `make all` (installs `@swc/core` via `make build`, then check-fmt,
whitespace-hygiene, lint, typecheck, test — all green). No Markdown changed in
WI1.

### WI2 — Route the `syntax-error` fixtures through the parity suite

Implements: `docs/technical-design.md` sections 11.1 and 11.5 (fixtures assert
expected diagnostics and original-source spans); roadmap 2.2.1 success line.
Retires the deferred body-syntax guard.

Read first: `tests/static-analysis/invalid-workflow-metadata-parity.test.ts`
(the `TASK_2_1_3_RULES` filter at lines 21-28, `classifyInvalidFixture` at
49-72, and the "preserves deferred body syntax fixture expectations" test at
117-129); `manifests/syntax-error.ts`;
`tests/static-analysis/fixtures/refresh-derivation.ts` and
`refresh-manifest-source.ts` (how anchors derive offsets); the
`make refresh-fixtures` target (`Makefile`).

Skills to load: `leta` (locate the parity call site and confirm no other
body-syntax consumer exists); `grepai` for a consistency sweep on
`odw/body-syntax` references.

Steps:

1. Reconcile fixture anchors with the real parser output. Run the adapter
   over the two `syntax-error` fixtures (a scratch check or the WI1 tests
   already prove the real span). If the real diagnostic span for either fixture
   differs from the seeded anchor in `manifests/syntax-error.ts`, update the
   anchor `spanText` to the real span text and run `make refresh-fixtures` to
   regenerate the manifest deterministically, then record the before/after in
   Surprises & Discoveries. If they already match, note that. Do not hand-edit
   the generated manifest.
2. `tests/static-analysis/invalid-workflow-metadata-parity.test.ts`: add a
   parity assertion for the `syntax-error` family that runs the real parser.
   Because the parser is standalone (not in `lintWorkflowSource`), obtain the
   scanned envelope (`result.scan.envelope` when `status === "scanned"`, or
   `scanWorkflowEnvelope(createOriginalSourceFile(...))`) and call
   `parseWorkflowBody(envelope)`; compare the emitted `odw/body-syntax`
   diagnostic (rule, severity, message, span, and `sliceSourceSpan` text)
   against the fixture manifest's `odw/body-syntax` expectation. Replace the
   "preserves deferred body syntax fixture expectations" test (lines 117-129)
   with a real-emission assertion; keep the existing task-2.1.3 metadata parity
   assertion intact (its `TASK_2_1_3_RULES` filter still governs the
   metadata/envelope comparison).
3. Do not change `lintWorkflowSource` or its tests.

Tests: the updated parity assertions are the behavioural guard — before WI1
there was no emitter, and this suite now proves both `syntax-error` fixtures
produce the manifest-expected `odw/body-syntax` diagnostic with the expected
original-source span. If a manifest span was refreshed in step 1, the
fixture-metadata refresh tests
(`tests/static-analysis/fixture-metadata-refresh*.test.ts`) confirm the
manifest is in sync.

Red-Green-Refactor: point the new parity assertion at the real parser and run
(Red if anchors still mismatch; Green after step 1 reconciliation). If nothing
needs refreshing, the assertion is Green immediately and the retired deferred
guard is the observable change.

Validation: `make all`. WI2 edits only `.ts` files (test plus, if refreshed,
the generated manifest); no Markdown, so `make markdownlint` and `make nixie`
are not required. If step 1 leaves any doc reference stale, defer that edit to
WI3.

### WI3 — Document the parser adapter and the normalization boundary

Implements: `docs/developers-guide.md` "Documentation Upkeep";
`docs/documentation-style-guide.md`; roadmap 2.2.1 (developer-facing contract).

Read first: `docs/developers-guide.md` static-analysis section (lines ~44-105),
especially the forward reference at lines 47-48 and the roadmap-sequencing
paragraph at lines 102-105.

Skills to load: `en-gb-oxendict` (British/Oxford spelling for prose); `leta` to
verify the documented symbol names match the shipped exports.

Files:

1. `docs/developers-guide.md`: in the static-analysis section, replace the
   forward reference "Direct SWC calls belong only in the future parser adapter
   from roadmap task 2.2.1" with a short paragraph describing the shipped
   `parseWorkflowBody`: it parses the workflow body slice (`envelope.bodySpan`)
   with `@swc/core`'s `parseSync`, converts syntax errors to `odw/body-syntax`
   diagnostics with original-source spans, and never executes source. State
   explicitly that it is **not** wired into `lintWorkflowSource` yet and does
   not normalize top-level `return`/`await` — that normalization and the
   valid-example pipeline are task 2.2.2 — so callers must not run it over
   bodies containing top-level `return` before 2.2.2 lands. Update the
   roadmap-sequencing paragraph (lines 102-105) to mark task 2.2.1 as owning
   the shipped adapter and 2.2.2 as owning body normalization.

Tests: none (documentation only); the developers' guide is prose.

Red-Green-Refactor substitute: documentation change; validated by the Markdown
gates.

Validation: `make all`; `make markdownlint`; `make nixie`. Format the touched
Markdown first: `mdtablefix docs/developers-guide.md` then
`markdownlint-cli2 --fix docs/developers-guide.md`.

## Concrete steps

All commands run from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-2-1`.

WI1:

1. `bun add @swc/core` (records the installed version and updates
   `bun.lock`), then add the `dependencyJustifications` entry and confirm the
   range is a caret.
2. Prototyping probe (scratch, deleted before commit): write a small
   `bun run` script under a gitignored `tmp/` path that `parseSync`-es the two
   fixture bodies and a valid body; record the thrown-error shape and
   `program.span.start` in the Decision Log; choose S1 or S2.
3. Create `tests/static-analysis/workflow-body-parser.test.ts` with the
   unit and property cases above. Run it to observe Red:

   ```plaintext
   bun test tests/static-analysis/workflow-body-parser.test.ts
   # expect: fails to resolve `parseWorkflowBody`
   ```

4. Add `src/static-analysis/workflow-body-parser.ts`; export it from
   `src/static-analysis/index.ts` and `src/index.ts`; add the module to
   `EXPECTED_STATIC_ANALYSIS_MODULE_FILES` and the two names to
   `public-api-fixtures.ts`.
5. Re-run the focused suite (Green), delete the scratch probe, then format
   and gate:

   ```sh
   bunx biome format --write \
     src/static-analysis/workflow-body-parser.ts \
     src/static-analysis/index.ts \
     src/index.ts \
     tests/static-analysis/workflow-body-parser.test.ts \
     tests/diagnostics/architecture-fixtures.ts \
     tests/diagnostics/public-api-fixtures.ts
   make all
   ```

6. Commit (gated).

WI2:

1. Confirm the real span for each `syntax-error` fixture (from the WI1
   tests). If a seeded anchor mismatches, update its `spanText` anchor and run
   `make refresh-fixtures`; otherwise skip refresh.
2. Update
   `tests/static-analysis/invalid-workflow-metadata-parity.test.ts`: add the
   real body-syntax parity assertion and retire the deferred guard.
3. Format and gate:

   ```sh
   bunx biome format --write \
     tests/static-analysis/invalid-workflow-metadata-parity.test.ts
   make all
   ```

   If step 1 refreshed the manifest, also format
   `tests/static-analysis/fixtures/invalid-workflows/manifests/syntax-error.ts`
   before `make all`; otherwise omit it and rely on the `make all` gate.
4. Commit (gated).

WI3:

1. Edit `docs/developers-guide.md` per WI3.
2. Format and gate:

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

- `make all` — runs build (installs `@swc/core`), `check-fmt`,
  whitespace-hygiene, lint, `typecheck`, and `test` (`Makefile`). Expect all
  green.
- `make markdownlint` and `make nixie` — required for WI3 (it edits
  `docs/developers-guide.md`). Expect all green.

Behavioural acceptance:

- New `tests/static-analysis/workflow-body-parser.test.ts` fails before
  WI1's module exists and passes after; it proves a syntax error yields one
  `odw/body-syntax` diagnostic (not a throw) whose span slices to the expected
  original text, and a valid body yields `{ ok: true }`.
- The updated `invalid-workflow-metadata-parity.test.ts` proves both
  `syntax-error` fixtures produce the manifest-expected `odw/body-syntax`
  diagnostic; the deferred guard is retired.
- `lintWorkflowSource` and `workflow-lint.test.ts` are unchanged and stay
  green (the 2.2.2 boundary is intact).

Quality criteria for "done":

- Tests: all Bun tests pass under `make test`; the adapter is covered by
  unit and property tests; parity proves fixture emission.
- Lint/typecheck: `make lint` and `make typecheck` clean; the `@swc/core`
  import is a static string edge and passes the forbidden-import guard.
- Formatting: `make check-fmt` clean; Markdown formatted with mdtablefix
  and markdownlint-cli2.
- API: the only new public symbols are `parseWorkflowBody` and
  `WorkflowBodyParseResult`; the module-inventory and public-API guards reflect
  exactly those additions.
- Dependency: `@swc/core` is a caret dependency with a justification and a
  committed `bun.lock`.

## Idempotence and recovery

Every step is re-runnable. Adding the module, exports, and tests is additive;
re-running `make all` is safe. If the export list is mis-sorted,
`public-api-surface.test.ts` prints the expected order — re-sort and re-run. If
the module-inventory fixture is missing the new file, `architecture.test.ts`
prints the diff. If a fixture anchor is refreshed, `make refresh-fixtures` is
deterministic and the refresh tests confirm sync; if a refresh looks wrong,
revert the manifest and re-derive from the observed real span. The scratch SWC
probe lives under a gitignored `tmp/` path and is deleted before commit, so it
leaves no trace. No destructive operations are involved.

## Artefacts and notes

- WI1 installed `@swc/core` 1.15.43 with caret range `^1.15.43`.
- WI1 probe result: valid body parse succeeded with
  `program.span.start === 1`; syntax errors exposed only
  `code: "GenericFailure"` plus rendered syntax text, so S2 was selected.
- WI1 focused tests:
  `bun test tests/static-analysis/workflow-body-parser.test.ts
  --update-snapshots`
  passed with eight tests and two diagnostic-shape snapshots.
- WI1 deterministic gates: final delegated `make all`, `make markdownlint`, and
  `make nixie` passed on 2026-07-02.
- WI1 CodeRabbit: final allowed retry completed with high `0`, medium
  `0`, low `3`. Two low test-structure findings were fixed before the final
  deterministic gate. The remaining low precise-span preference is documented
  as intentionally deferred because SWC exposes no structured syntax-error
  offset.
- WI2 deterministic gates and CodeRabbit passed with zero findings after
  the syntax-error manifest and compact invalid-fixture snapshot were refreshed.
- WI3 deterministic gates (`make all`, `make markdownlint`, and
  `make nixie`) passed, and CodeRabbit completed with zero findings.

## Interfaces and dependencies

New production surface (in `src/static-analysis/workflow-body-parser.ts`,
re-exported via `src/static-analysis/index.ts` and `src/index.ts`):

```typescript
// src/static-analysis/workflow-body-parser.ts
export type WorkflowBodyParseResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly diagnostic: Diagnostic };

export const parseWorkflowBody = (
  envelope: WorkflowEnvelope,
) => WorkflowBodyParseResult;
```

Reused, unchanged interfaces:

- `scanWorkflowEnvelope(sourceFile)` in
  `src/static-analysis/workflow-envelope.ts` — supplies `envelope.bodySpan`.
- `sliceSourceSpan(file, span)`, `spanFromOffsets(file, start, end)` in
  `src/static-analysis/source-snippet.ts` and `source-position.ts`.
- `RULE_CATALOGUE` / `ruleDocsPath` / `makeRuleId` in
  `src/diagnostics/rule-catalogue.ts` and `rule-id.ts` — for the catalogued
  `odw/body-syntax` message and docs path.

New external dependency: `@swc/core` (caret range; production `dependencies`; a
`dependencyJustifications` entry; `bun.lock` committed). Used only by the
parser adapter, via a static `import { parseSync } from "@swc/core"`. Test-only:
`bun:test`, `fast-check` (both already present).

## Revision note

Initial draft (2026-07-02). Decomposes roadmap task 2.2.1 into three gateable
work items: (WI1) add `@swc/core` and implement the standalone
`parseWorkflowBody` adapter that converts body syntax errors to
`odw/body-syntax` diagnostics with original-source spans, verified by a
probe-selected span strategy plus unit and property tests; (WI2) route the two
`syntax-error` fixtures through the invalid-fixture parity suite and retire the
deferred guard, reconciling seeded anchors with real SWC spans through
`make refresh-fixtures`; (WI3) document the adapter and the deferred
`lintWorkflowSource`/normalization boundary. The central design decision — keep
the adapter standalone rather than wiring it into `lintWorkflowSource` — is
justified by valid ODW bodies' top-level `return` and by the `workflow-lint`
property generator emitting `"return 'done';"`, which a pre-normalization
parser would falsely flag. Tooling limitation recorded: the planning session
could not install `@swc/core` or reach the web, so the exact thrown-error shape
is pinned by the WI1 probe test rather than cited from a live run. No prior
design-review points (round 1).
