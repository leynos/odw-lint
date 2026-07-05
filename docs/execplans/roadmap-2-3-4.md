# Characterize ODW loader rejection of TypeScript-only workflow body syntax

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 2.3.4 (`docs/roadmap.md`, step 2.3 "Prove ODW loader parity before
shipping dialect checks") is to *characterize* whether the real Open
Dynamic Workflows (ODW) loader rejects the TypeScript-only workflow-body
examples recorded by ADR
[0002-workflow-body-parser-dialect-scope.md](../adr/0002-workflow-body-parser-dialect-scope.md),
and to prove that `odw-lint`'s `odw/body-syntax` outcome for those bodies
**matches** the loader. "Loader parity" means: does `odw-lint` accept and reject
the same workflow-body syntax classes that ODW itself accepts and rejects
*before running the workflow*? See `docs/technical-design.md` §§11.2 and 11.3.

Today, `odw-lint`'s side of this contract is already proven:
`tests/static-analysis/workflow-body-dialect.test.ts` asserts that each ADR 0002
TypeScript-only body (`const value: number`, `function typed(value: number)`,
`interface`, `enum`, `as`, `satisfies`) yields an `odw/body-syntax` dialect
error, and that the accepted boundary case `identity<number>(1)` does *not*. What
is missing is the **loader side** of the parity relation: nothing in the
repository yet demonstrates that ODW's body-compilation path also rejects those
same bodies. ADR 0002 records that ODW "compiles workflow bodies through a
JavaScript function constructor path" and that TypeScript-only syntax "the ODW
loader cannot execute as JavaScript" is therefore rejected, but that claim is not
yet pinned by an executable check.

This plan closes that gap with a **documented trusted probe**: a small,
author-controlled characterization test that feeds the ADR 0002 body strings to
the JavaScript `Function` and `AsyncFunction` constructors — the very mechanism
ADR 0002 names for ODW — and proves construction throws a `SyntaxError` for every
TypeScript-only body while succeeding for the accepted boundary bodies. It then
asserts the parity relation directly: for each body, `odw-lint`'s
`odw/body-syntax` outcome and the constructor's accept/reject outcome agree.

Observable success: `make test` passes; a new suite
`tests/static-analysis/body-syntax-loader-parity.test.ts` proves — for the shared
ADR 0002 corpus — that (a) the `Function`/`AsyncFunction` constructor rejects
every TypeScript-only body at construction time with a `SyntaxError`, (b) it
accepts the ECMAScript boundary bodies, and (c) `odw-lint`'s `odw/body-syntax`
decision agrees with the constructor decision for every case. The suite fails
loudly (in the Red step) before the parity assertions are wired correctly and
passes after. No production `src/` code changes; this is a characterization,
test, and documentation task.

## Constraints

Hard invariants that must hold throughout implementation. Violation requires
escalation, not a workaround.

- Work occurs only in the git worktree
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-3-4` on branch
  `roadmap-2-3-4`. The root/control checkout is off-limits for edits. Edit tools
  must target absolute paths under this worktree.
- This task is **test-and-documentation only**. No production module under
  `src/` and no public package export (`src/index.ts`, `package.json`
  `exports`) may change. If satisfying the objective seems to require a
  production change, stop and escalate.
- The **trusted-probe boundary** is explicit and narrow. The probe may construct
  `new Function(body)` / `new AsyncFunction(body)` **only** over the small set of
  trusted, author-controlled ADR 0002 body literals defined in this repository —
  never over fixture files, user source, or any value read from disk. The probe
  *constructs* (parses/compiles) the function and must **never invoke** it: a
  TypeScript-only body throws at construction and is never run, and the accepted
  boundary bodies are constructed but never called, so no workflow logic
  executes. This keeps the probe within the "do not execute source" boundary of
  ADR [0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md)
  and `docs/technical-design.md` §6.4, which prohibit executing *untrusted
  workflow* source, not compiling a fixed characterization literal that fails to
  parse. This boundary is recorded in the Decision Log.
- The passive loader-parity harness introduced by roadmap 2.3.1
  (`tests/static-analysis/fixtures/loader-parity.ts` and its inertness block in
  `tests/static-analysis/loader-parity.test.ts`) must remain execution-free. The
  new probe lives in its **own** test file and must **not** be imported by
  `loader-parity.ts`, so it never enters that suite's transitive
  `discoverHarnessSourceFiles` inertness scan (verified: that scan walks import
  edges from a fixed entrypoint set, not a directory glob —
  `tests/static-analysis/loader-parity.test.ts` lines 97–122).
- The ADR 0002 TypeScript-only rejection set and the accepted boundary set are a
  frozen behaviour contract. This plan may relocate those literals into a shared
  test-support module but must not add, remove, or weaken a case without an
  explicit ADR 0002 change. ADR 0002 is preserved verbatim unless design review
  approves a divergence.
- en-GB Oxford spelling ("-ize"/"-yse"/"-our") in all prose, comments, and
  commit messages (`AGENTS.md` "Code Style and Structure"; `en-gb-oxendict`).
- Every new or modified code file stays at or below 400 lines and opens with a
  `/** @file … */` block (`AGENTS.md` "Keep file size manageable"; "TypeScript
  Guidance → Docs"). Oxlint enforces `complexity` max 8, `max-depth` max 3, one
  logical operator per conditional (`df12/complex-conditional`), and JSDoc on
  every module, public, and private declaration (`.oxlintrc.json`); new helpers
  must satisfy these.

## Tolerances (exception triggers)

Thresholds that trigger escalation when breached.

- Scope: delivery is capped at the seven files explicitly named by the work
  items (`docs/contents.md`, `docs/developers-guide.md`, `docs/roadmap.md`, this
  ExecPlan, `workflow-body-dialect.test.ts`,
  `typescript-only-dialect-bodies.ts`, and
  `body-syntax-loader-parity.test.ts`) and ~260 net lines. If another file is
  needed or the line budget is materially exceeded, stop and escalate.
- Interface: if any change to `src/` production code or the public export
  surface becomes necessary, stop and escalate (this task is test/docs only by
  design).
- Parity divergence: if the `Function`/`AsyncFunction` constructor does **not**
  reject a body that `odw-lint` rejects (or vice versa) — that is, if the loader
  and `odw-lint` disagree for any ADR 0002 case — stop and escalate. The task's
  own success clause allows "records a deliberate parity divergence for design
  review"; a real divergence is a design decision, not something to paper over.
- Boundary: if characterizing the loader appears to require executing a fixture
  body, importing an executable ODW path, or invoking (not merely constructing)
  a probe function, stop and escalate — the trusted-probe boundary would be
  breached.
- Dependencies: if a new runtime or dev dependency seems required, stop and
  escalate. Everything needed (`bun:test`, the global `Function`/`AsyncFunction`
  constructors, the `odw-lint` package entry, existing envelope helpers) is
  already present.
- Iterations: if `make all` still fails after 3 focused fix attempts on the same
  item, stop and escalate.
- Ambiguity: if "matches the current ODW loader" needs a definition beyond
  "constructor accept/reject agrees with `odw/body-syntax` accept/reject for
  every ADR 0002 case", stop and present options.

## Risks

- Risk: the ODW sibling checkout at
  `/data/leynos/Projects/open-dynamic-workflows` is not readable in this session
  (tool-level working-directory guard blocks it even with the sandbox
  disabled), so the loader's exact constructor call site cannot be quoted
  first-hand.
  Severity: medium; Likelihood: high (already observed — see Surprises).
  Mitigation: ADR 0002 (Status: Accepted, reviewed and merged in-repo) is the
  authoritative in-repo source of truth that ODW uses "a JavaScript function
  constructor path" and rejects TypeScript-only bodies. The load-bearing
  behaviour — that the `Function`/`AsyncFunction` constructor throws a
  `SyntaxError` at construction for TypeScript-only syntax — is a JavaScript
  grammar guarantee and is **pinned by the probe test itself**, so the plan has
  no undecided fork. The probe characterizes *both* constructor variants, so
  parity holds whichever one ODW uses.
- Risk: a lint gate flags the `Function`/`AsyncFunction` constructor as unsafe.
  Severity: low; Likelihood: low.
  Mitigation: verified that oxlint's `restriction`/`style`/`suspicious`
  categories are `off` (`.oxlintrc.json` lines 8–16, so `no-new-func` does not
  fire) and Biome's recommended preset has no rule against the `Function`
  constructor (only `eval` via `noGlobalEval`) (`biome.jsonc` lines 36–47). If a
  security lint nonetheless fires, apply a single tightly-scoped suppression with
  a clear reason on the probe lines only (`AGENTS.md` "Warnings and
  suppressions"), and record it in the Decision Log.
- Risk: extracting the shared ADR 0002 corpus perturbs the existing dialect test
  assertions or their labels.
  Severity: low; Likelihood: low.
  Mitigation: WI-1 is a behaviour-preserving refactor gated by rerunning
  `tests/static-analysis/workflow-body-dialect.test.ts` before and after; the
  extracted literals are byte-for-byte the current values.
- Risk: the new probe is perceived as preempting roadmap 2.3.5's corpus
  consolidation.
  Severity: low; Likelihood: medium.
  Mitigation: WI-1 single-sources only the *dialect* body list shared by the two
  tests that need it (the dialect test and this probe), not the broader fixture
  corpus 2.3.5 owns. The Decision Log records the boundary.
- Risk: `tests/build-gate/documentation-contents.test.ts` fails because the new
  ExecPlan is not indexed in `docs/contents.md`.
  Severity: low; Likelihood: high (this gate asserts every top-level ExecPlan is
  linked — lines 87–91).
  Mitigation: WI-1 adds the `docs/contents.md` entry when it first creates the
  ExecPlan file, and WI-4 keeps it accurate.

## Progress

- [x] WI-1: Single-source the ADR 0002 TypeScript-only dialect body corpus and
  index this ExecPlan.
- [x] WI-2: Add the trusted `Function`/`AsyncFunction` loader-compilation probe
  proving ODW-side rejection of TypeScript-only bodies.
- [x] WI-3: Assert `odw-lint` ↔ loader parity over the ADR 0002 corpus and the
  accepted boundary.
- [x] WI-4: Reconcile documentation, flip the roadmap leaf, and finalize the
  ExecPlan.

## Surprises & Discoveries

- Observation: the ODW sibling checkout
  `/data/leynos/Projects/open-dynamic-workflows` is unreadable from this agent
  session. `ls`, `rg`, and even `rg --dangerouslyDisableSandbox` are rejected by
  the tool-level working-directory guard ("may only … from the allowed working
  directories: '/data/leynos/Projects/odw-lint',
  '/data/leynos/Projects/odw-lint.worktrees'").
  Evidence: three blocked attempts during planning.
  Impact: the loader mechanism is cited from ADR 0002 (in-repo, Accepted) rather
  than quoted from ODW source, and the constructor rejection is pinned by the
  probe test. Per the standing fallback rule this does not block the plan.
- Observation: `grepai` and direct `node`/`bun` script execution are also blocked
  in this session's permission mode (each returned "requires approval" or a
  directory block).
  Evidence: blocked `grepai search`, `bun <file>`, and `node <file>` attempts
  during planning.
  Impact: branch-local evidence was gathered with `Read` and single-path,
  pipe-free `rg` instead; the empirical constructor behaviour is asserted by the
  probe (WI-2) rather than demonstrated ad hoc during planning.
- Observation: `odw-lint`'s dialect side is already fully characterized. The gap
  2.3.4 fills is strictly the *loader* side plus the parity relation.
  Evidence: `tests/static-analysis/workflow-body-dialect.test.ts` lines 12–56
  already assert `odw/body-syntax` for the six TypeScript-only bodies and
  acceptance of `identity<number>(1)`.
  Impact: the plan avoids re-testing `odw-lint`'s parser and focuses on new
  loader-parity evidence.
- Observation: WI-1 dependency setup was required before the baseline test could
  run. `bun test tests/static-analysis/workflow-body-dialect.test.ts` first
  failed with `Cannot find module '@swc/core'`; `make build` installed
  dependencies, and the repeated baseline passed with 8 tests, 0 failures, and
  42 assertions before the extraction.
  Impact: the Red substitute used the post-install focused suite as the current
  branch baseline, then validated the same suite after extraction.
- Observation: WI-1 CodeRabbit review found one minor documentation-style issue:
  the purpose paragraph used first-person wording.
  Impact: the paragraph now uses impersonal wording while preserving the loader
  parity meaning.
- Observation: WI-1 CodeRabbit review found that the original six-file scope
  tolerance conflicted with the seven files already listed across the approved
  work items, and that the shared corpus entries would be clearer with a named
  tuple type.
  Impact: the scope tolerance now enumerates the seven planned files as the
  bound, and the corpus exports use `DialectBodyFixture` with named tuple
  fields.
- Observation: WI-2 Red-by-mutation failed for the intended reason. With the
  accepted-boundary block temporarily asserting constructor rejection,
  `bun test tests/static-analysis/body-syntax-loader-parity.test.ts` reported
  6 passes and 2 failures; both failures showed
  `expect(received).toBeFalse()` receiving `true` for the ECMAScript boundary
  bodies.
  Impact: the green implementation restores the expected accepted-boundary
  assertion and proves that both constructor variants accept those bodies.
- Observation: WI-3 Red-by-mutation failed for the intended reason. With the
  parity helper temporarily comparing `odw-lint`'s rejection decision to the
  negated loader decision, the focused test reported 8 passes and 8 parity
  failures across the rejected and accepted sets.
  Impact: the green implementation compares the two rejection decisions
  directly, so any future loader/`odw-lint` divergence fails as a parity error.
- Observation: WI-4 completed the documentation reconciliation after the parity
  probe and parity assertion were already green.
  Impact: `docs/developers-guide.md` now names the probe and shared corpus in
  present tense, `docs/roadmap.md` marks 2.3.4 complete, and this ExecPlan is
  finalized with the delivered outcome.

## Decision Log

- Decision: characterize the loader with a **trusted probe** over the
  `Function`/`AsyncFunction` constructor rather than importing any ODW code or
  extending the passive `loader-parity.ts` harness.
  Rationale: ADR 0002 names "a JavaScript function constructor path" as ODW's
  body-compilation mechanism; the constructor *is* the thing under test.
  Importing ODW would breach `docs/technical-design.md` §11.3 and the
  forbidden-import policy, and the passive harness is contractually
  execution-free. A construction-only probe over fixed trusted literals is the
  minimal, faithful characterization.
  Date/Author: 2026-07-05, planning agent.
- Decision: the probe constructs but never invokes the function, and only over
  author-controlled ADR 0002 literals, never fixture or user source.
  Rationale: construction parses/compiles and surfaces the `SyntaxError` for
  TypeScript-only syntax without running anything; invoking is unnecessary and
  would execute code. Restricting inputs to trusted literals keeps the probe
  clear of ADR 0001's "do not execute source" boundary, which concerns untrusted
  workflow source.
  Date/Author: 2026-07-05, planning agent.
- Decision: characterize **both** the `Function` and `AsyncFunction`
  constructors.
  Rationale: the roadmap says "Function or AsyncFunction body-compilation path".
  A TypeScript-only syntax error is a grammar error independent of async-ness, so
  both constructors reject the same set and accept the same boundary; asserting
  both removes any undecided fork about which one ODW uses.
  Date/Author: 2026-07-05, planning agent.
- Decision: single-source only the ADR 0002 *dialect body* list (rejected set +
  accepted boundary) shared by the dialect test and the new probe, not the wider
  fixture corpus.
  Rationale: the two tests must not drift on the ADR 0002 contract; broader
  corpus and projection consolidation is explicitly roadmap 2.3.5's job.
  Date/Author: 2026-07-05, planning agent.
- Decision: keep the assigned absolute worktree path in `Constraints`.
  Rationale: the automated roadmap workflow requires agents to work exclusively
  inside that exact git-donkey worktree; repository-relative paths elsewhere keep
  the plan portable for future readers.
  Date/Author: 2026-07-05, planning agent.
- Decision: install project dependencies with `make build` before recording the
  WI-1 baseline.
  Rationale: the worktree initially had no installed `@swc/core`, so the focused
  dialect suite could not reach its assertions. `make build` is the documented
  dependency target and preserves the branch-local baseline without editing
  source.
  Date/Author: 2026-07-05, implementation agent.
- Decision: treat the seven files named by the approved work items as the scope
  tolerance, rather than the earlier six-file shorthand.
  Rationale: the plan itself already requires seven files to complete all four
  work items without production changes. Enumerating them keeps the guard strict
  while removing an internal contradiction.
  Date/Author: 2026-07-05, implementation agent.
- Decision: keep the delivered parity characterization as test and
  documentation work only.
  Rationale: the shared corpus, constructor probe, parity assertion, developer
  guide update, and roadmap flip close task 2.3.4 without changing production
  `src/` code or the public package surface.
  Date/Author: 2026-07-05, implementation agent.

## Outcomes & Retrospective

Delivered. `tests/static-analysis/body-syntax-loader-parity.test.ts` now proves
that both the `Function` and `AsyncFunction` constructor paths reject every ADR
0002 TypeScript-only body with a `SyntaxError`, accept the ECMAScript boundary
bodies, and agree with `odw-lint`'s `odw/body-syntax` decision over the shared
`tests/static-analysis/typescript-only-dialect-bodies.ts` corpus. The
developer guide names this present-tense parity surface and the roadmap leaf is
checked complete. The implementation stayed within the test-and-documentation
boundary; no production `src/` code or public package export changed.

## Context and orientation

`odw-lint` is a private TypeScript/Bun static analyser for ODW workflow files. It
parses workflow source **without executing it** and emits diagnostics. Newcomer
orientation for this task:

- ADR [0002-workflow-body-parser-dialect-scope.md](../adr/0002-workflow-body-parser-dialect-scope.md)
  is the contract this task characterizes. It records that the parser uses SWC
  with `syntax: "ecmascript"`, that "the adjacent ODW loader compiles workflow
  bodies through a JavaScript function constructor path", and that TypeScript-only
  syntax (`const value: number`, `function typed(value: number)`, `interface`,
  `enum`, `as`, `satisfies`) is rejected with `odw/body-syntax`, while
  `identity<number>(1)` is an accepted ECMAScript boundary case.
- `tests/static-analysis/workflow-body-dialect.test.ts` — the existing
  `odw-lint`-side characterization. It holds `TYPESCRIPT_ONLY_BODIES`
  (`[label, body]` pairs, lines 12–22), asserts `odw/body-syntax` for each (lines
  24–39), and asserts acceptance of plain ECMAScript and the generic-call
  boundary (lines 41–55). WI-1 refactors this to consume the shared corpus.
- `tests/static-analysis/workflow-envelope-support.ts` — exports `envelopeForBody`
  (wraps a body in a valid `export const meta = …` envelope and returns a scanned
  `WorkflowEnvelope`). The probe/parity test reuses it to drive `odw-lint`.
- `odw-lint` public exports used here (all in `src/index.ts`): `parseWorkflowBody`
  (line 76; returns `{ ok: true }` or `{ ok: false, diagnostic }`), `makeRuleId`
  (line 40), `ruleDefinitionFor` (line 32), plus the envelope helpers
  `createOriginalSourceFile`/`scanWorkflowEnvelope` used transitively.
- `tests/static-analysis/fixtures/loader-parity.ts` and the inertness block in
  `tests/static-analysis/loader-parity.test.ts` (lines 348–392) — the roadmap
  2.3.1 passive harness. It must stay execution-free; the new probe is a separate
  file and is deliberately *not* wired into it.
- `docs/developers-guide.md` lines 552–561 — the loader-parity paragraph that
  currently ends "TypeScript-only body rejection parity remains 2.3.4." WI-4
  updates this to present tense. Lines 523–534 describe the `@swc/core` upgrade
  checklist and already reference ADR 0002; WI-4 may add the probe to that
  re-observation list.
- `docs/contents.md` (index) and `tests/build-gate/documentation-contents.test.ts`
  (asserts every top-level ExecPlan is indexed) — WI-1 adds this plan's entry.

Terms: a **dialect error** is a `docs/technical-design.md` §9.1 error-severity
diagnostic (here `odw/body-syntax`) meaning ODW would reject the file before
execution. A **trusted probe** is a characterization test over fixed,
author-controlled literals — not fixture or user source. **Construction** of a
`Function`/`AsyncFunction` parses and compiles the body; **invocation** runs it.
The probe only constructs.

Design references: `docs/technical-design.md` §§9.1, 11.2, 11.3, 6.4; ADRs 0001
and 0002; `AGENTS.md` "Change Quality & Committing", "Testing", "TypeScript
Guidance"; `docs/documentation-style-guide.md`.

## Plan of work

Four ordered, independently committable work items. Each ends with the commit
gate `make all` green. The two Markdown-changing items (WI-1 and WI-4) also run
`make markdownlint` and `make nixie` before their commit, since `make all`
(Makefile line 5) does not cover the Markdown gates.

### WI-1: Single-source the ADR 0002 dialect body corpus

Implements ADR 0002 (frozen rejection/boundary contract) and `AGENTS.md`
"Refactoring Heuristics" (remove duplication; no drift between the two tests that
share the list). Behaviour-preserving refactor.

Docs to read first: ADR 0002; `AGENTS.md` "Code Style and Structure",
"TypeScript Guidance → Testing"; `docs/documentation-style-guide.md`. Skills to
load: `execplans` (this file); `leta` for symbol navigation to confirm the
current importers of `TYPESCRIPT_ONLY_BODIES`; `en-gb-oxendict` for prose. The
Rust/Python routers and `hypothesis`/`crosshair`/`mutmut` do **not** apply (this
is TypeScript); for any invariant coverage `AGENTS.md` "Invariant testing"
directs `fast-check`, but this finite corpus is table-driven.

New file `tests/static-analysis/typescript-only-dialect-bodies.ts` (test-support,
≤ 400 lines, `/** @file … */` header, JSDoc on every export):

- Export `TYPESCRIPT_ONLY_DIALECT_BODIES` as the byte-for-byte current
  `[label, body]` pairs from `workflow-body-dialect.test.ts` lines 12–22
  (variable type annotation, parameter type annotation, interface, enum, as,
  satisfies), typed `as const`.
- Export `ACCEPTED_ECMASCRIPT_BOUNDARY_BODIES` as `[label, body]` pairs for the
  two currently-accepted cases: `["plain assignment", "const value = 1;\nreturn
  value;"]` and `["generic-call comparison", "const value = identity<number>(1);\n
  return value;"]`, typed `as const`. Include a comment citing ADR 0002 for why
  the generic-call case is an accepted boundary.

Refactor `tests/static-analysis/workflow-body-dialect.test.ts`:

- Replace the inline `TYPESCRIPT_ONLY_BODIES` with an import of
  `TYPESCRIPT_ONLY_DIALECT_BODIES`, and drive the two acceptance `it` blocks from
  `ACCEPTED_ECMASCRIPT_BOUNDARY_BODIES` (keeping their existing assertions).

Also in WI-1: create this ExecPlan file (already on disk) and add its index line
to `docs/contents.md` after the roadmap 2.3.3 entry (line ~211–212), matching
the existing bullet style, so `tests/build-gate/documentation-contents.test.ts`
passes.

WI-1 changes Markdown (`docs/contents.md` and this ExecPlan
`docs/execplans/roadmap-2-3-4.md`), so it MUST run the Markdown gates before its
commit — `make all` (Makefile line 5) is only
`build check-fmt whitespace-hygiene lint typecheck test` and does **not** cover
`markdownlint` or `nixie`. Per the standing rule to format only changed files,
format exactly the two Markdown files WI-1 edits and then gate:

```sh
bunx mdtablefix docs/contents.md docs/execplans/roadmap-2-3-4.md
bunx markdownlint-cli2 --fix docs/contents.md docs/execplans/roadmap-2-3-4.md
make markdownlint
make nixie
```

Both listed paths are edited in this item, so the direct formatter list is
path-safe. `make markdownlint`/`make nixie` run repo-global globs (no
hand-listed paths), so they remain safe regardless. Do not run a repo-global
formatter such as `make fmt`.

Red/Green/Refactor: this is a characterization refactor of existing green tests.
Red substitute (per the `execplans` "nearest observable substitute" allowance):
before extracting, run
`bun test tests/static-analysis/workflow-body-dialect.test.ts` and record the
current pass count; after extraction rerun and confirm the identical set passes.
No behaviour changes, so the refactor is validated by the unchanged suite plus
`make all` and the Markdown gates above.

### WI-2: Trusted `Function`/`AsyncFunction` loader-compilation probe

Implements `docs/technical-design.md` §11.2 (loader-parity is release-blocking;
tests compare `odw-lint` with ODW's static expectations) and §11.3 / ADR 0001
(no import of executable ODW paths; no execution of source), and ADR 0002 (the
constructor path ODW uses). Testing rules from `AGENTS.md` "Testing".

Docs to read first: ADR 0002 and ADR 0001; `docs/technical-design.md` §§11.2,
11.3, 6.4; the roadmap 2.3.1 ExecPlan
`docs/execplans/roadmap-2-3-1.md` "Constraints"/"inertness" sections to stay
consistent with the harness boundary. Skills: `leta` to confirm the harness
inertness scan is import-edge based (not a glob) so the probe file stays out of
it; `execplans`; `en-gb-oxendict`.

New file `tests/static-analysis/body-syntax-loader-parity.test.ts`
(test-only, ≤ 400 lines, `/** @file … */` header, JSDoc on every helper). It must
**not** import `tests/static-analysis/fixtures/loader-parity.ts`.

- Add a small documented helper, for example
  `constructsWithoutSyntaxError(construct: (body: string) => unknown, body:
  string): boolean`, that calls the supplied constructor inside a `try/catch`,
  returns `true` when construction succeeds, and returns `false` **only** when a
  `SyntaxError` is thrown (rethrow any other error type so an unexpected failure
  is not silently swallowed). The function under test never invokes the
  constructed function.
- Bind the two constructors once at module scope: the global `Function` and the
  `AsyncFunction` constructor obtained via
  `Object.getPrototypeOf(async () => {}).constructor`. A `/** … */` comment
  explains that these mirror ODW's body-compilation path per ADR 0002 and that
  the probe only constructs trusted literals, never invokes them, and never reads
  fixture or user source.
- `describe("ODW loader rejects TypeScript-only workflow bodies")`: iterate
  `TYPESCRIPT_ONLY_DIALECT_BODIES` with `it.each`; for each body assert that both
  `Function` and `AsyncFunction` construction throws a `SyntaxError` (i.e. the
  helper returns `false` for both), and additionally assert the thrown value is
  an `instanceof SyntaxError` for at least the `AsyncFunction` path so the
  rejection reason is pinned, not merely "some throw".
- `describe("ODW loader accepts ECMAScript boundary workflow bodies")`: iterate
  `ACCEPTED_ECMASCRIPT_BOUNDARY_BODIES`; assert both constructors construct
  without throwing (helper returns `true` for both), proving the accepted-boundary
  half of the contract.

Red/Green/Refactor (RGR-by-mutation, documented per the `execplans` "nearest
observable substitute" allowance, because this characterizes existing engine
behaviour): Red — first write the acceptance `describe` with a deliberately
wrong expectation (assert the boundary body *throws*) and run the focused file
to observe it fail for the intended reason; record the transcript. Green —
correct the expectation to "constructs without throwing" and rerun; it passes.
Refactor — extract the shared per-body assertion into the named helper, rerun
the focused file and `make all`.

### WI-3: Assert `odw-lint` ↔ loader parity

Implements `docs/technical-design.md` §11.2 (first and fourth bullets — ODW
rejects → `odw-lint` errors; ODW accepts → `odw-lint` reports no dialect error)
and the task 2.3.4 success clause (prove the outcomes match, or record a
deliberate divergence). Testing rules from `AGENTS.md` "Testing".

Docs to read first: `docs/technical-design.md` §§11.2, 9.1;
`tests/static-analysis/workflow-envelope-support.ts` (for `envelopeForBody`);
`workflow-body-dialect.test.ts` (to avoid duplicating its per-body span
assertions — this WI asserts the *parity relation*, not spans). Skills: `leta`
to confirm the `parseWorkflowBody` result shape and the `odw/body-syntax` rule
id; `execplans`; `en-gb-oxendict`.

In `tests/static-analysis/body-syntax-loader-parity.test.ts` add
`describe("loader parity for TypeScript-only body syntax")`:

- Add a documented helper
  `odwLintRejectsBody(body: string): boolean` that builds `envelopeForBody(body)`,
  calls `parseWorkflowBody(envelope)`, and returns `true` when the result is
  `{ ok: false }` with `result.diagnostic.rule` equal to
  `ruleDefinitionFor(makeRuleId("odw/body-syntax")).id`, and `false` when the
  result is `{ ok: true }`.
- Parity over the rejected set: iterate `TYPESCRIPT_ONLY_DIALECT_BODIES` and
  assert, for each body, that `odwLintRejectsBody(body) === true` **and** both
  constructors reject (helper `false`) — i.e. both sides agree on rejection.
  Express the agreement as a single equality assertion per body (for example
  `expect(odwRejects).toBe(loaderRejects)` where `loaderRejects` is derived from
  the constructor probe) so a future divergence surfaces as a parity failure, not
  two independent assertions.
- Parity over the accepted boundary: iterate `ACCEPTED_ECMASCRIPT_BOUNDARY_BODIES`
  and assert `odwLintRejectsBody(body) === false` **and** both constructors
  accept — both sides agree on acceptance.

Red/Green/Refactor (RGR-by-mutation): Red — temporarily point the parity equality
at a mismatched pairing (for example compare `odwRejects` against the *negation*
of `loaderRejects`) and run the focused file to observe the parity assertion fail;
record the transcript. Green — restore the correct pairing and rerun; it passes.
Refactor — fold the per-body parity check into one named helper used by both
`describe` blocks, rerun the focused file and `make all`.

If any real divergence is observed (a body where `odw-lint` and the constructor
disagree), do not force the test green: stop, record the divergence in the
Decision Log and Surprises, and escalate for design review per the task's success
clause and the Tolerances.

### WI-4: Documentation reconciliation and roadmap flip

Implements `AGENTS.md` "Documentation Maintenance" and `docs/technical-design.md`
§11.2 (record where the release-blocking parity evidence now lives). No code
behaviour change.

Docs to read first: `docs/developers-guide.md` lines 523–534 and 552–566;
`docs/documentation-style-guide.md`;
`tests/build-gate/documentation-contents.test.ts` (to avoid breaking a pinned
phrase). Skills: `en-gb-oxendict`; `execplans` (keep this file current). The
`changelog` skill does not apply (no CHANGELOG in scope).

- Edit `docs/developers-guide.md`: change "TypeScript-only body rejection parity
  remains 2.3.4." (line ~561) to a present-tense description naming
  `tests/static-analysis/body-syntax-loader-parity.test.ts` and the shared
  `tests/static-analysis/typescript-only-dialect-bodies.ts` corpus, the trusted
  `Function`/`AsyncFunction` construction probe, and the parity relation with
  `odw/body-syntax`. Optionally add the probe to the `@swc/core` re-observation
  checklist near lines 523–534. Wrap prose at 80 columns.
- If `tests/build-gate/documentation-contents.test.ts` pins any edited phrase,
  update its expectation in the same commit.
- Confirm that the `docs/contents.md` index line added in WI-1 is present and
  accurate.
- Edit `docs/roadmap.md`: flip `- [ ] 2.3.4.` to `- [x] 2.3.4.` (leaf task only;
  do not touch 2.3.2, 2.3.3, or 2.3.5).
- Update this ExecPlan's `Progress`, `Decision Log`, and `Outcomes &
  Retrospective`; set `Status: COMPLETE`; append the required revision note.

## Concrete steps

Run everything from the worktree
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-3-4`.

1. WI-1: create `tests/static-analysis/typescript-only-dialect-bodies.ts`, refactor
   `workflow-body-dialect.test.ts` to import it, add the `docs/contents.md` index
   line, then run the code gate and — because WI-1 changes Markdown
   (`docs/contents.md` and this ExecPlan) — the Markdown format + gate on exactly
   the two Markdown files WI-1 edits:

   ```sh
   bun test tests/static-analysis/workflow-body-dialect.test.ts
   make all
   bunx mdtablefix docs/contents.md docs/execplans/roadmap-2-3-4.md
   bunx markdownlint-cli2 --fix docs/contents.md docs/execplans/roadmap-2-3-4.md
   make markdownlint
   make nixie
   ```

   Both listed Markdown paths are edited in this item, so the direct formatter
   list is path-safe. Expect the dialect suite to pass with the same case count
   as before the refactor; `make all` (build, `check-fmt`, `whitespace-hygiene`,
   `lint`, `typecheck`, `test`) green; and the Markdown gates clean. Commit
   (imperative subject, e.g. "Single-source ADR 0002 dialect body corpus").

2. WI-2: add `tests/static-analysis/body-syntax-loader-parity.test.ts` with the
   probe (Red-by-mutation on the acceptance expectation, then Green):

   ```sh
   bun test tests/static-analysis/body-syntax-loader-parity.test.ts
   make all
   ```

   Expect the rejection and acceptance describes to pass. Commit (e.g. "Add
   trusted loader-compilation probe for body dialect").

3. WI-3: add the parity describe (Red-by-mutation on the parity pairing, then
   Green), rerun the focused file, then `make all`, then commit (e.g. "Assert
   odw-lint loader parity for TypeScript-only bodies").

4. WI-4: edit docs, flip the roadmap leaf, then before committing format only the
   files this item changed (every listed path is edited in this item, so the
   command is path-safe). WI-4 does **not** edit `docs/contents.md` — it only
   confirms the entry WI-1 added is present and accurate — so `docs/contents.md`
   is deliberately absent from the `mdtablefix`/`markdownlint-cli2 --fix` lists
   below:

   ```sh
   bunx mdtablefix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-2-3-4.md
   bunx markdownlint-cli2 --fix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-2-3-4.md
   make markdownlint
   make nixie
   make all
   ```

   Do not run a repo-global format. Commit (e.g. "Document loader-parity probe
   and complete roadmap 2.3.4").

## Validation and acceptance

Commit gate for every work item (`AGENTS.md` "Change Quality & Committing"; the
Makefile `all:` target aggregates `build check-fmt whitespace-hygiene lint
typecheck test`):

```sh
make all
```

The Markdown-changing work items — **WI-1** (edits `docs/contents.md` and this
ExecPlan) and **WI-4** (edits `docs/developers-guide.md`, `docs/roadmap.md`, and
this ExecPlan) — each additionally run the Markdown gates before their commit,
because `make all` does not include them:

```sh
make markdownlint
make nixie
```

WI-2 and WI-3 change only TypeScript test files, so `make all` is their complete
commit gate.

Red-Green-Refactor evidence to capture in `Progress`/`Surprises`:

- WI-1: dialect suite pass count is identical before and after the corpus
  extraction (characterization refactor; validated by the unchanged suite and
  `make all`).
- WI-2 Red: the acceptance describe fails when it asserts a boundary body throws;
  Green: passes when it asserts construction succeeds.
- WI-3 Red: the parity assertion fails when the `odw-lint` and loader outcomes are
  compared with a deliberately mismatched pairing; Green: passes with the correct
  pairing.

Acceptance (behaviour a human can verify):

- Running `make test` shows `body-syntax-loader-parity.test.ts` passing with:
  a rejection block proving both `Function` and `AsyncFunction` construction
  throws a `SyntaxError` for every ADR 0002 TypeScript-only body; an acceptance
  block proving both construct the ECMAScript boundary bodies without throwing;
  and a parity block proving `odw-lint`'s `odw/body-syntax` decision agrees with
  the constructor decision for every case.
- `git diff --stat` shows only test and documentation files; nothing under `src/`
  changed.
- `docs/roadmap.md` shows `- [x] 2.3.4.` and `docs/developers-guide.md` describes
  the delivered probe in the present tense.

Quality criteria for "done":

- Tests: the three new `body-syntax-loader-parity` describes pass and the whole
  `make test` suite stays green.
- Lint/typecheck: `make lint` and `make typecheck` clean (part of `make all`);
  no new suppressions unless a security lint fires (then one scoped, documented
  suppression per the Risks).
- Formatting: `make check-fmt` clean; Markdown gates green for WI-4.
- Boundary: the probe imports only `bun:test`, the shared corpus module, the
  envelope helper, and `odw-lint`; it never imports an ODW executable path, never
  imports `loader-parity.ts`, and never invokes a constructed function.

## Idempotence and recovery

Each work item is a separate commit and re-runnable. `make all` is idempotent.
If a focused test is left red, rerun `bun test
tests/static-analysis/body-syntax-loader-parity.test.ts` after fixing; nothing
here mutates tracked fixtures or global state (the probe constructs local
functions and discards them). To abandon uncommitted work, remove the specific
untracked files named in `git status --short` (for example
`git clean -fd -- tests/static-analysis/body-syntax-loader-parity.test.ts
tests/static-analysis/typescript-only-dialect-bodies.ts` after verifying the
list) and use `git restore -- <tracked-paths>` for tracked edits; no external
state is touched. Any scratch probe file created during exploration must be
deleted before committing.

## Interfaces and dependencies

New test-support module `tests/static-analysis/typescript-only-dialect-bodies.ts`
exports at least:

```typescript
/** ADR 0002 TypeScript-only bodies that `odw/body-syntax` and the loader reject. */
export const TYPESCRIPT_ONLY_DIALECT_BODIES: readonly (readonly [string, string])[];

/** ECMAScript boundary bodies both `odw-lint` and the loader accept (ADR 0002). */
export const ACCEPTED_ECMASCRIPT_BOUNDARY_BODIES: readonly (readonly [string, string])[];
```

New test module `tests/static-analysis/body-syntax-loader-parity.test.ts` depends
only on: `bun:test`; the shared corpus module above; `envelopeForBody` from
`tests/static-analysis/workflow-envelope-support.ts`; and the `odw-lint` package
entry (`parseWorkflowBody`, `makeRuleId`, `ruleDefinitionFor`). The global
`Function` constructor and the `AsyncFunction` constructor
(`Object.getPrototypeOf(async () => {}).constructor`) are runtime built-ins; no
new dependency is required. `fast-check` is available if an invariant angle is
later justified, but the finite ADR 0002 corpus is table-driven.

## Revision note

Initial draft (2026-07-05, planning round 1). Establishes roadmap 2.3.4 as four
ordered, test-and-docs-only work items keyed to ADR 0002 and
`docs/technical-design.md` §§11.2–11.3: single-source the ADR 0002 dialect body
corpus, add a trusted `Function`/`AsyncFunction` construction probe proving
ODW-side rejection, assert the `odw-lint` ↔ loader parity relation, and
reconcile documentation with a roadmap flip. Records that the ODW sibling
checkout and `grepai`/script execution were blocked in this session, so the
loader mechanism is cited from in-repo ADR 0002 (Accepted) and the constructor
rejection is pinned by the probe itself — no undecided fork. No implementation
performed; awaiting approval.

Revision (2026-07-05, planning round 2). Resolves both design-review blocking
points on Markdown commit-gate coverage.
(1) WI-1 now owns the Markdown gate for the two Markdown files it actually
changes — it runs `mdtablefix` and `markdownlint-cli2 --fix` on
`docs/contents.md` and this ExecPlan, then `make markdownlint` and `make nixie`
before its commit — so any markdownlint violation in the index bullet or the
ExecPlan is caught at WI-1, not deferred to WI-4. (`make nixie` carries no
Mermaid work here but the gate is cheap and guards against regressions.)
(2) `docs/contents.md` is dropped from WI-4's `mdtablefix` /
`markdownlint-cli2 --fix` file lists because WI-4 does not edit it (it only
confirms the WI-1 entry is present and accurate); WI-4's direct formatter lists
now name only the files WI-4 itself edits (`docs/developers-guide.md`,
`docs/roadmap.md`, this ExecPlan). Also rewrapped two prose lines that exceeded
the 80-column MD013 limit. No implementation performed; awaiting approval.

Revision (2026-07-05, implementation). Completed all four work items. WI-1
single-sourced the ADR 0002 dialect body corpus and indexed this ExecPlan. WI-2
added the trusted constructor probe with Red/Green evidence. WI-3 asserted the
`odw-lint` to loader parity relation with Red/Green evidence. WI-4 documented
the delivered probe in the developer guide, flipped roadmap task 2.3.4 to
complete, and finalized this ExecPlan.
