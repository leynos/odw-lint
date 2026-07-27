# Reconcile workflow-body parser dialect scope

This ExecPlan (execution plan) is a living document. The sections `Constraints`,
`Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint` statically parses each ODW workflow body to raise the
`odw/body-syntax` diagnostic before a workflow ever runs. The production parser
adapter parses the normalized body with `@swc/core`'s `parseSync` using
`syntax: "ecmascript"` (see `src/static-analysis/workflow-body-parse.ts:34`),
so any TypeScript-only construct that the ECMAScript grammar cannot express — a
colon type annotation (`const x: number`, `function f(x: number)`), `interface`,
`enum`, `as`, `satisfies` — is a syntax error. (Generic *call* syntax such as
`identity<number>(1)` is the notable exception: the ECMAScript grammar parses
`<` and `>` as relational operators, so `identity<number>(1)` is the valid
comparison expression `(identity < number) > (1)` and is deliberately **not**
flagged; see the term definitions and Work item 2.) Several design, developer,
and rule documents nonetheless describe the parser as accepting "JavaScript or
TypeScript". That gap is the whole subject of roadmap task 2.2.7.

After this change a reader gains two things they can observe directly. First,
feeding TypeScript-only syntax into a workflow body produces an intentional,
tested `odw/body-syntax` diagnostic rather than an undocumented accident: a new
test suite proves it and would fail if a future `@swc/core` bump silently
started accepting TypeScript. Second, the roadmap, technical design, developer
guide, and the `odw/body-syntax` rule page all describe the same
ECMAScript-only dialect scope that production actually enforces, with a new ADR
recording the decision and its ODW-loader-parity rationale.

Success is exactly the roadmap's success criterion for 2.2.7: "TypeScript-in-
body input has an intentional, tested outcome, and roadmap, design, developer,
and rule documentation no longer describe a broader parser dialect than
production accepts."

## The decision (ratified by this plan)

Workflow bodies are parsed as **ECMAScript-only** source. TypeScript-only
syntax is rejected with `odw/body-syntax`. This ratifies the behaviour
production already ships; the task is to make that decision explicit, tested,
and documented rather than to change parser behaviour.

Rationale, with evidence verified in this repository and the pinned tooling:

1. Runtime parity. `docs/technical-design.md` §9 requires that "diagnostics
   that disagree with ODW's loader must be intentional and documented".
   `docs/adr/0001-static-analysis-boundary.md` records that the ODW loader
   "evaluates sliced metadata with `new Function`" and "compiles workflow
   bodies", and `docs/technical-design.md` §3 (table row "ODW loader") plus the
   `odw-authoring` skill both state ODW "wraps the body in an async function".
   A body compiled through the `Function`/`AsyncFunction` constructor is
   JavaScript; TypeScript type syntax is a runtime `SyntaxError` there. So ODW
   itself rejects TypeScript-only syntax in a body, and an ECMAScript-only
   `odw-lint` parser agrees with the loader. Accepting TypeScript would create
   an undocumented parity divergence.
2. The bundled trusted corpus. Every ODW example fixture under
   `tests/static-analysis/fixtures/odw-examples/` is a plain `.js` file with no
   TypeScript syntax (verified by inspection, e.g. `fan-out-reduce.js`).
3. Production already encodes the choice: `WORKFLOW_BODY_PARSE_OPTIONS` in
   `src/static-analysis/workflow-body-parse.ts` pins
   `syntax: "ecmascript", jsx: false`, and the characterization test
   `tests/static-analysis/swc-parse-error-surface.test.ts` already parses with
   `syntax: "ecmascript"`.

`docs/terms-of-reference.md` §9 ("ODW's current implementation and examples are
TypeScript and JavaScript") is a statement about the language ODW itself is
*written in*, not about the workflow-body dialect the parser accepts; it is
reviewed and intentionally left unchanged. `docs/terms-of-reference.md` §4
table row "Parser libraries" ("Parse JavaScript and TypeScript source") is a
statement about the market category of parser libraries, not about `odw-lint`'s
configured dialect; it is also reviewed and left unchanged. Both are called out
here so a reviewer can see they were considered rather than missed.

## Constraints

- Work exclusively inside the git worktree at
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-2-7`. Never edit the
  root/control worktree.
- Do not change the shipped parser behaviour.
  `syntax: "ecmascript", jsx: false` in
  `src/static-analysis/workflow-body-parse.ts` stays; this plan ratifies and
  documents it, it does not alter it. (Per
  `docs/adr/0001-static-analysis-boundary.md`, the static-analysis boundary is
  a security boundary — the parser must never execute workflow source.)
- Do not import or call executable ODW runtime paths (`loadWorkflowScript`,
  `createPrimitives`, the runtime `validate` primitive) in production code
  (`docs/adr/0001-static-analysis-boundary.md`, `docs/technical-design.md` §5).
- Do not add, remove, or bump any package dependency. `@swc/core` stays pinned
  at `^1.15.43` (`package.json`).
- Do not change the public package surface. New tests use the existing
  re-exports from `odw-lint` (`parseWorkflowBody`, `scanWorkflowEnvelope`,
  `createOriginalSourceFile`, `ruleDefinitionFor`, `makeRuleId`,
  `lintWorkflowSource`) and the internal test helper `envelopeForBody` from
  `tests/static-analysis/workflow-envelope-support`. Do not add a new export to
  `src/index.ts` (guarded by `tests/diagnostics/public-api-surface.test.ts`).
- Every tracked TypeScript source and test file stays at or below the 400
  physical-line file-size guard (`docs/developers-guide.md`; enforced by
  `make test`).
- Prose, comments, and commit messages use en-GB Oxford spelling
  ("-ize"/"-yse"/"-our"), per the workflow standing rules and
  `docs/documentation-style-guide.md`.
- Rule documentation edits must preserve the metadata table fields and the
  `## Failing example` / `## Fixed example` headings that
  `tests/diagnostics/rule-catalogue-docs.test.ts` asserts.
- Format only the files each work item changes: run `bunx mdtablefix` (if
  tables changed) then `bunx markdownlint-cli2 --fix` on the specific Markdown
  paths touched, and Biome only on changed TypeScript paths. Do not run a
  repo-global reformat.

## Tolerances (exception triggers)

- Scope: if implementation requires changing more than 8 files or more than 250
  net lines, stop and escalate.
- Behaviour: if pinning the TypeScript-in-body outcome would require changing
  `WORKFLOW_BODY_PARSE_OPTIONS` or any parser behaviour (i.e. TypeScript
  constructs turn out **not** to be rejected by the pinned `@swc/core`), stop
  and escalate — that is a genuine design fork, not a mechanical doc fix.
- Interface: if any public API signature or `src/index.ts` export must change,
  stop and escalate.
- Dependencies: if a new dependency or a `@swc/core` bump appears necessary,
  stop and escalate.
- Iterations: if `make all` still fails after 3 focused attempts on one work
  item, stop and escalate.
- Ambiguity: if evidence emerges that ODW's loader actually accepts TypeScript
  bodies (contradicting the parity rationale above), stop and escalate before
  ratifying the ECMAScript-only decision.

## Risks

- Risk: the pinned `@swc/core@1.15.43` ECMAScript parser silently accepts some
  TypeScript construct (e.g. treats a stray annotation as valid), so a "TS is
  rejected" test would wrongly pass or wrongly fail. Severity: medium.
  Likelihood: low. Mitigation: Work item 2 drives a table of six distinct
  TypeScript-only constructs that the ECMAScript grammar genuinely cannot
  express — a variable type annotation (`const value: number`), a parameter
  type annotation (`function typed(value: number)`), `interface`, `enum`, `as`,
  and `satisfies` — and asserts each is rejected, with a plain-JavaScript
  control case asserted to parse. Every listed construct is TypeScript-only by
  construction: each hinges on a colon annotation or a reserved TypeScript
  keyword, none on generic angle brackets (which alias to relational operators
  in ECMAScript). The Red step (see Plan of work) first proves the test detects
  the behaviour before it is trusted. If any construct parses OK, the Behaviour
  tolerance fires.
- Risk: editing `docs/rules/body-syntax.md` breaks the rule-doc parity test.
  Severity: low. Likelihood: low. Mitigation: only prose changes; keep the
  metadata table and example headings intact; `make test` (which runs
  `rule-catalogue-docs.test.ts`) gates it.
- Risk: the sibling ODW checkout at
  `/data/leynos/Projects/open-dynamic-workflows` could not be read from this
  agent session (sandbox restricts reads to the allowed working directories),
  so the loader mechanism was confirmed from repository docs and the
  `odw-authoring` skill rather than ODW source directly. Severity: low.
  Likelihood: n/a (already observed). Mitigation: the parity rationale rests on
  `docs/technical-design.md` §3/§9,
  `docs/adr/0001-static-analysis-boundary.md`, and the `odw-authoring` skill,
  all of which are in-repo/authoritative sources of truth; the SWC-rejects-TS
  claim is additionally pinned by the Work item 2 test.

## Progress

- [x] Work item 1: Record the ECMAScript-only dialect decision (ADR 0002 +
  technical-design pointer).
- [x] Work item 2: Pin the TypeScript-in-body outcome to `odw/body-syntax` with
  a table-driven parser/rule test.
- [x] Work item 3: Align design, developer, and rule documentation, and add the
  roadmap completion note.
- 2026-07-03: Work item 1 implemented in
  `docs/adr/0002-workflow-body-parser-dialect-scope.md` and
  `docs/technical-design.md`. Formatted the changed Markdown files with
  `bunx mdtablefix` and `bunx markdownlint-cli2 --fix`. Scrutineer reported
  `make all`, `make markdownlint`, and `make nixie` green; CodeRabbit reported
  zero findings.
- 2026-07-03: Work item 2 implemented in
  `src/static-analysis/workflow-body-parse.ts` and
  `tests/static-analysis/workflow-body-dialect.test.ts`. The Red run of
  `bun test tests/static-analysis/workflow-body-dialect.test.ts` failed on the
  six TypeScript-only rows because `normalized.ok` was `false` rather than the
  naive `true`; the Green run passed after flipping those rows to rejection and
  `odw/body-syntax` diagnostic assertions. Scrutineer reported `make all`
  green. The first CodeRabbit run returned two low-severity test-shape
  findings; the table now owns the representative diagnostic assertions and the
  duplicate standalone case was removed. Scrutineer re-ran `make all` green and
  CodeRabbit then reported zero findings.
- 2026-07-03: Work item 3 aligned `docs/rules/body-syntax.md`,
  `docs/technical-design.md`, `docs/developers-guide.md`, and `docs/roadmap.md`
  to the ECMAScript-only body dialect. Formatted the changed Markdown files with
  `bunx mdtablefix` and `bunx markdownlint-cli2 --fix`; corrected one
  table-alignment lint finding in `docs/technical-design.md`. Scrutineer
  reported `make all`, `make markdownlint`, and `make nixie` green. The first
  CodeRabbit attempt was rate-limited, so the workflow slept with `vsleep` for
  61 minutes and retried; CodeRabbit then reported zero findings.

## Surprises & discoveries

- Observation (implementation Work item 1): `docs/execplans/roadmap-2-2-7.md`
  was untracked in this worktree before implementation began, so Work item 1
  commits the approved ExecPlan along with the ADR and design pointer. This
  keeps the required in-place progress evidence under version control.
- Observation (implementation Work item 2): CodeRabbit flagged that the
  variable type annotation was covered both by the shared table and by a
  standalone representative test. The final test keeps the finite construct set
  in one `it.each` table and asserts the stable diagnostic rule, body span, and
  catalogue category there.
- Observation (implementation Work item 3): `bunx mdtablefix` printed the
  full Markdown documents to stdout but did not fully align the shortened SWC
  parser adapter table row. `markdownlint-cli2 --fix` then reported MD060 on
  `docs/technical-design.md`; adding one padding space to the row resolved the
  changed-file Markdown gate.
- Observation (implementation Work item 3): CodeRabbit rate-limited the first
  review attempt with an 18-minute reported wait. Following the workflow rule,
  the implementation slept for 61 minutes via `vsleep` before retrying.

- Observation: `bun`/`node` execution and reads outside the allowed working
  directories required interactive approval in this planning session and were
  denied, so live execution of a throwaway SWC probe script and reading the ODW
  sibling checkout were not possible during planning. Evidence: `node`/`bun`
  invocations returned "This command requires approval"; cross-directory reads
  returned "blocked … only … allowed working directories". Impact: the
  SWC-rejects-TypeScript behavioural claim is pinned by the Work item 2 test
  (an allowed fallback per the workflow rules) rather than by a planning-time
  probe; the ODW-loader-parity rationale is grounded in in-repo docs and the
  `odw-authoring` skill.
- Observation (round 2): the round-1 Work item 2 table included a generic-call
  row `const value = identity<number>(1);` asserted to be rejected. This is
  false. Under `syntax: "ecmascript"` SWC parses `identity<number>(1)` as the
  valid relational expression `(identity < number) > (1)`, so
  `parseNormalizedWorkflowBody(...).ok === true` — the construct is NOT a
  syntax error and NOT reported by `odw/body-syntax`. Generic *call* syntax is
  indistinguishable from comparison in the ECMAScript grammar. Evidence: the
  ECMAScript relational-operator grammar (`<`, `>` are `RelationalExpression`
  operators); confirmed by the design reviewer. A direct `@swc/core@1.15.43`
  probe was authored to empirically confirm the full construct set, but `node`/
  `bun` execution was approval-denied in this session, so the set is instead
  pinned by ECMAScript-grammar guarantees and, at implementation time, by the
  Work item 2 test (the reviewer accepted "an actual probe or the test
  itself"). Impact: the generic-call row is removed from the Work item 2 table
  and replaced with a parameter type annotation
  (`function typed(value: number) { return value; }`), which is TypeScript-only
  by construction and grammar-guaranteed rejected. The term definitions, the
  ADR 0002 content, and all four Work item 3 doc edits are reconciled to the
  same six-construct set and now explicitly note that generic call syntax is
  deliberately NOT flagged.

## Decision log

- Decision: Ratify ECMAScript-only workflow-body parsing rather than adding
  TypeScript support. Rationale: matches production behaviour, matches the
  plain-`.js` trusted corpus, and preserves ODW-loader parity (ODW compiles
  bodies via a `Function`/`AsyncFunction` constructor, which is
  JavaScript-only). Adding TypeScript would create an undocumented parity
  divergence forbidden by `docs/technical-design.md` §9. Date/Author:
  2026-07-03, planning agent (df12-build roadmap 2.2.7).
- Decision: Record the choice in a new `docs/adr/0002-...` rather than only in
  the ExecPlan. Rationale: `AGENTS.md` requires an ADR when a decision
  "materially affects architecture, dependencies, public behaviour"; the parser
  dialect scope is a public-behaviour contract, and ADR 0001 set the precedent
  of homing parser/boundary decisions in `docs/adr/`. Date/Author: 2026-07-03,
  planning agent.
- Decision: Use a table-driven test (finite construct set) as the primary
  verification, not a `fast-check` property test. Rationale: `AGENTS.md`
  Testing guidance prefers "table-driven tests for small finite case sets"; the
  TypeScript-only constructs form exactly such a set. Date/Author: 2026-07-03,
  planning agent.
- Decision: Express the Red step by first asserting the naive expectation (TS
  parses OK) so the test is observed to fail for the intended reason, then flip
  to the real assertion (TS is rejected with `odw/body-syntax`). Rationale:
  production already enforces the target behaviour, so a plain characterization
  test would be green on first run; the flipped-assertion Red step is the
  nearest honest Red-Green substitute (execplans skill: use the nearest
  observable substitute when strict Red-Green is unavailable). Date/Author:
  2026-07-03, planning agent.
- Decision (round 2): Exclude generic *call* syntax (`identity<number>(1)`)
  from the reported construct set entirely, and pin it as an accepted-boundary
  control instead. Rationale: the ECMAScript grammar parses `<`/`>` as
  relational operators, so `identity<number>(1)` is the valid expression
  `(identity < number) > (1)` and the `syntax: "ecmascript"` parser accepts it
  (`.ok === true`). It is not TypeScript-only and `odw/body-syntax` cannot
  report it. The round-1 plan wrongly asserted it as rejected; documenting it
  as accepted keeps the plan implementable and prevents the doc edits from
  introducing a new false claim. The reported set is the six colon-annotation /
  reserved-keyword constructs, which the ECMAScript grammar genuinely cannot
  express. Date/Author: 2026-07-03, planning agent (round 2 design-review
  remediation).

## Outcomes & retrospective

Roadmap task 2.2.7 is complete. Workflow-body parsing remains ECMAScript-only,
ADR 0002 records the public dialect decision, and the parser comment points to
that decision. The new workflow-body dialect test proves six TypeScript-only
constructs produce `odw/body-syntax`, while plain ECMAScript and the
generic-call-looking comparison boundary parse successfully. The living design,
developer, rule, and roadmap documentation now describe the ECMAScript-only
scope instead of a broader JavaScript-or-TypeScript body dialect.

Validation completed with `make all`, `make markdownlint`, and `make nixie`
green after the final documentation edit. CodeRabbit review completed with zero
findings after one rate-limit backoff retry.

## Addenda

- [x] 2.2.7.1. Add explicit SWC-bump dialect re-observation guidance.
  - Source: review:2.2.7; severity low.
  - Scope: add maintainer or dependency-update guidance tying intentional
    `@swc/core` bumps to rerunning
    `tests/static-analysis/workflow-body-dialect.test.ts` and preserving ADR
    0002's TypeScript-in-body rejection set.
  - Success: reviewers can see the dialect-rejection check in the dependency
    bump path, not only in the ADR and test file.

## Context and orientation

`odw-lint` is an ESM-first TypeScript package run with Bun. The static-analysis
pipeline lives under `src/static-analysis/`. The relevant files for this task:

- `src/static-analysis/workflow-body-parse.ts` — internal helper
  `parseNormalizedWorkflowBody(envelope)`. Defines
  `WORKFLOW_BODY_PARSE_OPTIONS = { syntax: "ecmascript", jsx: false }` (line
  34) and parses the normalized body with `parseSync`. Returns a frozen
  discriminated result (`ok: true` with the SWC `Module`, or `ok: false` with
  the thrown `error`). This is the single home of the dialect choice.
- `src/static-analysis/workflow-body-parser.ts` — public adapter
  `parseWorkflowBody(envelope)` and `bodySyntaxDiagnosticsForParse(...)`. Turns
  a failed parse into an `odw/body-syntax` diagnostic (rule id
  `odw/body-syntax`).
- `src/static-analysis/workflow-body-normalizer.ts` — `normalizeWorkflowBody`
  wraps the original body slice verbatim in an injected async function so
  top-level `return`/`await` parse; the wrapper is parse-only text.
- `src/diagnostics/rule-catalogue.ts` — `odw/body-syntax` rule definition
  (category `dialect`, severity `error`), message and `{detail}` template.
- `src/index.ts` — package entry; re-exports `parseWorkflowBody`,
  `scanWorkflowEnvelope`, `createOriginalSourceFile`, `ruleDefinitionFor`,
  `makeRuleId`, `lintWorkflowSource`, and related contracts.

Test surfaces to mirror:

- `tests/static-analysis/workflow-body-parse.test.ts` — shows the
  `envelopeForBody(...)` + `parseNormalizedWorkflowBody(...)` pattern and the
  `ok`/`!ok` narrowing idiom.
- `tests/static-analysis/workflow-body-parser.test.ts` — shows
  `parseWorkflowBody` used through the `odw-lint` public re-exports and how a
  diagnostic's `rule`/`message` are asserted.
- `tests/static-analysis/swc-parse-error-surface.test.ts` — characterization
  test that pins the `@swc/core@1.15.43` error surface; the model for a "pin
  the pinned parser's behaviour" test.
- `tests/static-analysis/workflow-envelope-support.ts` — provides
  `envelopeForBody(bodyText)` and `expectScannedEnvelope(...)` helpers.

Documentation to reconcile (production-facing, living docs):

- `docs/rules/body-syntax.md` line 11-12: "cannot be parsed as JavaScript or
  TypeScript" — the rule page a user reads.
- `docs/technical-design.md` §6.1 components table, row "SWC parser adapter"
  (line 110): "Parse normalized JavaScript or TypeScript source …".
- `docs/developers-guide.md` body-parser section (around lines 49-66):
  describes normalization and "ordinary JavaScript function bodies"; add the
  explicit ECMAScript-only statement and ADR reference.
- `docs/roadmap.md` task 2.2.7 (lines 647-654): add a completion note like the
  sibling 2.2.6 entry.

The following are point-in-time historical records and must NOT be rewritten:
`docs/execplans/roadmap-*.md`, `docs/issues/audit-*.md`. They legitimately
quote the old wording as it stood when written.

Term definitions: "ECMAScript-only" means the SWC `syntax: "ecmascript"`
grammar — standard JavaScript with no TypeScript type syntax. "TypeScript-only
syntax" means constructs that are valid TypeScript but not valid ECMAScript,
such as a variable type annotation `const x: number = 1`, a parameter type
annotation `function f(x: number)`, `interface`, `enum`, `x as T`, and
`x satisfies T`.

Not TypeScript-only (deliberately not flagged): generic *call* syntax such as
`identity<number>(1)`. Although this reads as a TypeScript generic call, the
ECMAScript grammar treats `<` and `>` as relational operators, so
`identity<number>(1)` is the valid comparison expression
`(identity < number) > (1)`. The `syntax: "ecmascript"` parser accepts it
(`parseNormalizedWorkflowBody(...).ok === true`), so `odw/body-syntax` does not
and cannot report it. This construct is therefore excluded from the reported
set in Work item 2 and from every documentation edit in Work item 3.

## Plan of work

Three ordered, independently committable work items. Each ends with its own
validation and a gated commit.

### Work item 1 — Record the ECMAScript-only dialect decision

Implements: `AGENTS.md` (ADR requirement for public-behaviour decisions);
follows the format precedent of `docs/adr/0001-static-analysis-boundary.md`;
supports `docs/technical-design.md` §9 (loader-parity must be intentional and
documented) and the roadmap 2.2.7 success criterion.

Add `docs/adr/0002-workflow-body-parser-dialect-scope.md`, mirroring ADR 0001's
structure (title, `Status: Accepted`, `Date:`, `## Context`, `## Decision`,
`## Consequences`). Content: state that workflow bodies are parsed
ECMAScript-only via `syntax: "ecmascript"`; that TypeScript-only syntax the
ECMAScript grammar cannot express — a colon type annotation on a variable or
parameter (`const x: number`, `function f(x: number)`), `interface`, `enum`,
`as`, and `satisfies` — is a rejected `odw/body-syntax` error; the
ODW-loader-parity rationale (bodies are compiled through a `Function`/
`AsyncFunction` constructor and are therefore JavaScript); and the consequence
that a future `@swc/core` bump must re-observe this outcome (cross-reference
the existing SWC-bump guidance in `docs/developers-guide.md`).

The ADR MUST include a "not reported" caveat: generic *call* syntax such as
`identity<number>(1)` is accepted, not flagged, because the ECMAScript grammar
parses `<`/`>` as relational operators (`identity<number>(1)` ≡
`(identity < number) > (1)`). This is the boundary that round 1 of this plan
got wrong; the ADR records it so no future reader re-introduces the false
claim. Do NOT list "generic type arguments" among the reported constructs
anywhere in the ADR.

In `docs/technical-design.md` §5 or §6.1, add a one-line pointer to ADR 0002
next to the existing ADR 0001 reference, so the design doc routes readers to
the dialect decision. (The §6.1 table row itself is corrected in Work item 3;
keep this WI docs-additive to stay atomic.)

Read before starting: `docs/adr/0001-static-analysis-boundary.md`,
`docs/technical-design.md` §§4-6 and §9, `docs/documentation-style-guide.md`,
`AGENTS.md` (Documentation, Decisions/ADR sections). Skills to load:
`execplans` (this plan), `en-gb-oxendict` (Oxford spelling for the ADR prose).
No router skill needed — this work item is Markdown only.

Tests: no automated test changes. This is documentation; verification is
`make markdownlint` and `make nixie` on the new/changed Markdown, plus
`make all` to confirm nothing else regresses. The ADR carries no Mermaid, so
`nixie` is a no-op safety check.

### Work item 2 — Pin the TypeScript-in-body outcome with a test

Implements: roadmap 2.2.7 success ("TypeScript-in-body input has an
intentional, tested outcome"); `AGENTS.md` Testing (table-driven finite cases,
deterministic Bun tests); ADR 0002 (from Work item 1);
`docs/technical-design.md` §11 (fixture/parity verification strategy).

Production change (minimal, behaviour-preserving): in
`src/static-analysis/workflow-body-parse.ts`, extend the existing comment above
`WORKFLOW_BODY_PARSE_OPTIONS` to cite ADR 0002 as the home of the
ECMAScript-only dialect decision. No option value changes.

New test file `tests/static-analysis/workflow-body-dialect.test.ts`:

- A `describe("workflow body dialect scope", ...)` suite.
- A table of exactly six TypeScript-only body snippets, each rejected because
  it uses a colon type annotation or a reserved TypeScript keyword the
  ECMAScript grammar cannot express — NOT because of angle brackets:
  1. variable type annotation — `const value: number = 1;\nreturn value;`
  2. parameter type annotation —
     `function typed(value: number) { return value; }\nreturn typed(1);`
  3. `interface` declaration — `interface Shape { size: number }\nreturn 1;`
  4. `enum` declaration — `enum Mode { On }\nreturn Mode.On;`
  5. `as` type assertion — `const value = 1 as number;\nreturn value;`
  6. `satisfies` operator — `const value = 1 satisfies number;\nreturn value;`
  For each, build an envelope with `envelopeForBody(snippet)` and assert
  `parseNormalizedWorkflowBody(envelope).ok === false`, and that
  `parseWorkflowBody(envelope)` returns `ok: false` with `diagnostic.rule`
  equal to the `odw/body-syntax` rule id
  (`ruleDefinitionFor(makeRuleId("odw/body-syntax"))`), asserting on the
  diagnostic's rule identity rather than brittle parser prose. Do NOT add a
  generic-call row such as `identity<number>(1)`: the ECMAScript grammar
  accepts it as the relational expression `(identity < number) > (1)`, so it
  parses `ok: true` and cannot be asserted as rejected (this was the round-1
  defect; see Surprises & discoveries).
- A plain-JavaScript control case (e.g. `const value = 1;\nreturn value;`)
  asserted to parse `ok: true`, proving the suite distinguishes the dialects
  and is not trivially always-failing.
- A second "accepted" control that pins the boundary explicitly: the
  generic-call snippet `const value = identity<number>(1);\nreturn value;`
  asserted to parse `ok: true`. `parseSync` only parses (it never resolves
  references), so undeclared `identity`/`number` are irrelevant — the parser
  reads the line as the relational expression `(identity < number) > (1)`. This
  control documents that generic *call* syntax is deliberately NOT flagged and
  guards against a future reader "fixing" it into a rejection. Add a code
  comment on this row citing ADR 0002's "not reported" caveat.
- One assertion that the emitted diagnostic for a representative TypeScript
  snippet carries the `dialect` category / `odw/body-syntax` id, tying the
  outcome to the catalogue.

Red-Green evidence (documented in Validation): first author the six
TypeScript-only rows asserting `.ok === true` (the naive "TS is accepted"
expectation), run the focused test, and observe those six rows FAIL because the
pinned parser rejects each construct — this proves the test genuinely detects
dialect rejection. Then flip those six assertions to `.ok === false` +
`odw/body-syntax` (Green) and rerun. The Red flip applies ONLY to the six
TypeScript-only rows; the two accepted controls (plain JavaScript and the
generic-call boundary case) assert `.ok === true` throughout and must be green
in both the Red and Green runs — if the generic-call control ever reports
`.ok === false`, the pinned parser's behaviour has changed and the Behaviour
tolerance fires. This is the honest Red-Green substitute for behaviour
production already enforces (see Decision Log).

Read before starting: `src/static-analysis/workflow-body-parse.ts`,
`src/static-analysis/workflow-body-parser.ts`,
`tests/static-analysis/workflow-body-parse.test.ts`,
`tests/static-analysis/workflow-body-parser.test.ts`,
`tests/static-analysis/workflow-envelope-support.ts`,
`tests/static-analysis/swc-parse-error-surface.test.ts`, `AGENTS.md` Testing.
Skills to load: `execplans`; `biome-typescript` (repository TypeScript
formatting/lint conventions — there is no Rust/Python router relevant here);
`leta` for branch-local symbol navigation (`leta show parseWorkflowBody`,
`leta refs parseNormalizedWorkflowBody`) to confirm signatures and re-exports
before writing assertions.

Tests to add/update: the new
`tests/static-analysis/workflow-body-dialect.test.ts` (unit + behavioural
table). No snapshot is added (assert on rule identity and `ok` discriminant,
which are stable). No property test — the construct set is finite and
table-driven per `AGENTS.md`.

### Work item 3 — Align design, developer, and rule documentation

Implements: roadmap 2.2.7 success ("roadmap, design, developer, and rule
documentation no longer describe a broader parser dialect than production
accepts"); ADR 0002; `AGENTS.md` (keep `docs/` current);
`docs/documentation-style-guide.md`.

Edits:

1. `docs/rules/body-syntax.md` — replace "cannot be parsed as JavaScript or
   TypeScript" with wording that says the normalized body must be valid
   ECMAScript (the dialect ODW accepts), and add a sentence that
   TypeScript-only syntax the ECMAScript grammar cannot express — colon type
   annotations on variables or parameters (`const x: number`,
   `function f(x: number)`), `interface`, `enum`, `as`, and `satisfies` — is
   reported by this rule. Do NOT list "generic type arguments": generic *call*
   syntax such as `identity<number>(1)` parses as a valid ECMAScript relational
   expression and is not reported. If clarity warrants, add one sentence noting
   that generic call syntax aliases to comparison operators and is therefore
   accepted, not flagged. Keep the metadata table and the `## Failing example` /
   `## Fixed example` sections unchanged so `rule-catalogue-docs.test.ts`
   still passes.
2. `docs/technical-design.md` §6.1 components table, row "SWC parser adapter":
   change "Parse normalized JavaScript or TypeScript source …" to "Parse
   normalized ECMAScript source …", consistent with ADR 0002.
3. `docs/developers-guide.md` body-parser section: add one sentence stating the
   adapter parses ECMAScript-only (`syntax: "ecmascript"`) and that
   TypeScript-only syntax yields `odw/body-syntax`, cross-referencing ADR 0002.
4. `docs/roadmap.md` task 2.2.7: add a completion note line matching the 2.2.6
   pattern, e.g. "Completed by [roadmap-2-2-7.md](execplans/roadmap-2-2-7.md)."
   (Leave the `- [ ]`/`- [x]` checkbox state to the integrator per house
   convention; add only the note line.)

Explicitly reviewed and intentionally NOT changed (record in the commit body):
`docs/terms-of-reference.md` §9 (about ODW's implementation language) and §4
"Parser libraries" row (about the parser-library market category); neither is a
claim about `odw-lint`'s configured dialect.

Read before starting: `docs/rules/body-syntax.md`,
`tests/diagnostics/rule-catalogue-docs.test.ts`, `docs/technical-design.md`
§6.1, `docs/developers-guide.md` body-parser section, `docs/roadmap.md` 2.2.6
and 2.2.7 entries, `docs/documentation-style-guide.md`. Skills to load:
`execplans`; `en-gb-oxendict` (Oxford spelling); `biome-typescript` is not
required (Markdown only).

Tests to add/update: none new; `make test` runs
`tests/diagnostics/rule-catalogue-docs.test.ts` which guards the rule-page
structure after the prose edit.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-2-7`.

Work item 1:

1. Write `docs/adr/0002-workflow-body-parser-dialect-scope.md` (see Work item 1
   content).
2. Add the ADR 0002 pointer in `docs/technical-design.md`.
3. Format changed Markdown only:

   ```bash
   bunx mdtablefix docs/adr/0002-workflow-body-parser-dialect-scope.md docs/technical-design.md
   bunx markdownlint-cli2 --fix docs/adr/0002-workflow-body-parser-dialect-scope.md docs/technical-design.md
   ```

4. Gate and commit:

   ```bash
   make markdownlint
   make nixie
   make all
   ```

Work item 2:

1. Add the ADR 0002 comment reference in
   `src/static-analysis/workflow-body-parse.ts`.
2. Author `tests/static-analysis/workflow-body-dialect.test.ts` with the naive
   `.ok === true` assertions (Red).
3. Observe the Red failure:

   ```bash
   bun test tests/static-analysis/workflow-body-dialect.test.ts
   ```

   Expect failures reporting the TypeScript snippets did not parse (`ok` was
   `false`, not `true`).
4. Flip assertions to `.ok === false` + `odw/body-syntax` (Green) and rerun:

   ```bash
   bun test tests/static-analysis/workflow-body-dialect.test.ts
   ```

   Expect all cases passing, including the plain-JavaScript control.
5. Format the changed TypeScript only:

   ```bash
   bunx @biomejs/biome format --write \
     src/static-analysis/workflow-body-parse.ts \
     tests/static-analysis/workflow-body-dialect.test.ts
   ```

6. Gate and commit:

   ```bash
   make all
   ```

Work item 3:

1. Edit `docs/rules/body-syntax.md`, `docs/technical-design.md`,
   `docs/developers-guide.md`, `docs/roadmap.md` (see Work item 3 edits).
2. Format changed Markdown only:

   ```bash
   bunx mdtablefix docs/rules/body-syntax.md docs/technical-design.md \
     docs/developers-guide.md docs/roadmap.md
   bunx markdownlint-cli2 --fix docs/rules/body-syntax.md \
     docs/technical-design.md docs/developers-guide.md docs/roadmap.md
   ```

3. Gate and commit:

   ```bash
   make markdownlint
   make nixie
   make all
   ```

## Validation and acceptance

Quality criteria (what "done" means):

- Tests: `make test` passes. The new
  `tests/static-analysis/workflow-body-dialect.test.ts` fails on its six
  TypeScript-only rows before the Green assertions (naive `.ok === true`) and
  passes after; the plain-JavaScript control and the generic-call boundary
  control both assert `ok: true` throughout.
  `tests/diagnostics/rule-catalogue-docs.test.ts` still passes after the rule
  page edit.
- Lint/typecheck/format: `make all` (which runs
  `build check-fmt whitespace-hygiene lint typecheck test`) passes at each
  commit.
- Markdown: `make markdownlint` and `make nixie` pass for every commit that
  touches Markdown.

Quality method (how we check): run `make all` for every work item; additionally
run `make markdownlint` and `make nixie` for Work items 1 and 3. Behavioural
acceptance for the reconciliation: after Work item 2, feeding
`const value: number = 1;\nreturn value;` as a workflow body through
`parseWorkflowBody` yields `ok: false` with rule `odw/body-syntax`; after Work
item 3, no living design/developer/rule document describes the parser as
accepting TypeScript.

## Idempotence and recovery

Each work item is a separate commit and is independently re-runnable: the ADR
and doc edits are pure text replacements, and the test file is additive. If
`make all` fails, fix forward within the Iterations tolerance (3 attempts per
work item) and re-run; no destructive or irreversible steps are involved. No
fixtures are regenerated, so the fixture manifests and their freeze tests are
untouched.

## Interfaces and dependencies

No public interface changes. The plan relies on existing symbols:

- `src/static-analysis/workflow-body-parse.ts`:
  `parseNormalizedWorkflowBody(envelope): NormalizedBodyParseResult` and the
  internal `WORKFLOW_BODY_PARSE_OPTIONS`.
- `odw-lint` re-exports: `parseWorkflowBody`, `scanWorkflowEnvelope`,
  `createOriginalSourceFile`, `ruleDefinitionFor`, `makeRuleId`,
  `lintWorkflowSource`.
- Test helper: `envelopeForBody` from
  `tests/static-analysis/workflow-envelope-support.ts`.
- Parser dependency: `@swc/core@^1.15.43` (pinned; unchanged).

## Revision note

Initial draft (2026-07-03): first planning round for roadmap task 2.2.7.
Decomposed the task into three atomic, independently gate-passable work items —
ratify the ECMAScript-only decision in ADR 0002, pin the TypeScript-in-body
outcome with a table-driven test, and reconcile the design/developer/rule/
roadmap documentation. Recorded that the ODW sibling checkout was unreadable
and live `bun` probes were approval-gated in this session, so the SWC-rejects-
TypeScript claim is pinned by the Work item 2 test and the loader-parity
rationale rests on in-repo docs and the `odw-authoring` skill.

Revision 2 (2026-07-03): design-review round 2 remediation. Corrected a false
library claim: the round-1 Work item 2 table asserted the generic-call snippet
`const value = identity<number>(1);` is rejected with `odw/body-syntax`, but
under `syntax: "ecmascript"` SWC parses it as the valid relational expression
`(identity < number) > (1)` (`.ok === true`), so it is neither a syntax error
nor reportable. Removed the generic-call row from the Work item 2 reported set;
replaced it with a parameter type annotation
(`function typed(value: number) { return value; }`), giving six
colon-annotation / reserved-keyword constructs the ECMAScript grammar genuinely
cannot express. Added the generic-call snippet back as an explicit
accepted-boundary control (asserts `.ok === true`). Reconciled the Purpose
section, term definitions, Risk mitigation, Decision log, ADR 0002 authoring
instructions, and all four Work item 3 doc edits (rule page, technical design,
developers guide, roadmap) to the same six-construct set, and added an explicit
"generic call syntax is deliberately NOT flagged" note to the term definitions,
the ADR, and the rule page. Attempted a direct `@swc/core@1.15.43` probe to
empirically confirm the set (the installed root-checkout copy is exactly
1.15.43, matching the pin), but `node`/`bun` execution was approval-denied, so
the corrected set is pinned by ECMAScript-grammar guarantees and by the Work
item 2 test at implementation time (per the reviewer, "an actual probe or the
test itself").
