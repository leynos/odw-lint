# Derive reviewer availability from harness state (roadmap 1.5.8)

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

The reviewer-run audit gate `make review-evidence` re-runs the repository
gates and then names which "dual-review path" backed the review: the
independent `scrutineer` reviewer, the `coderabbit` fallback, or a degraded
`local-self-run`. Today an unparameterised run defaults every path to
`available` (see `defaultPathAvailability` in
`tests/build-gate/review-evidence-cli.ts:64`). That optimism lets an automated
review print `dual-review path: scrutineer (primary; scrutineer available)`
and exit `0` even when no scrutineer actually reviewed the change. This
contradicts the whole point of the gate, which exists so a quota-blocked or
absent reviewer cannot be silently substituted (AGENTS.md, "Roadmap Review &
Audit Evidence").

After this change, reviewer availability is derived from the observed state the
harness (the roadmap / df12-build workflow) supplies, not assumed. The harness
declares what it actually knows through environment variables
(`ODW_LINT_REVIEW_SCRUTINEER`, `ODW_LINT_REVIEW_CODERABBIT`,
`ODW_LINT_REVIEW_LOCAL_SELF_RUN`), the same environment-first pattern already
used for `ODW_LINT_REVIEW_EXEC` and `ODW_LINT_REVIEW_GATE_TIMEOUT_MS`. Absent
any such declaration, the run defaults pessimistically: `scrutineer` and
`coderabbit` are `unavailable`, only `local-self-run` is `available`.

The behaviour is observable by running the CLI two ways from the worktree
root:

- With no harness state and no flags, the run is honestly degraded:

      $ bun run tests/build-gate/review-evidence-cli.ts --no-exec
      Review evidence: degraded
      - dual-review path: local-self-run (degraded fallback; scrutineer unavailable; coderabbit unavailable; …)
      - degraded reason: command execution unavailable; gates were not independently executed
      - degraded reason: no independent dual-review path available

  Exit code `3`. It cannot claim a scrutineer review.

- When the harness declares a scrutineer, the primary path is selected:

      $ ODW_LINT_REVIEW_SCRUTINEER=available bun run tests/build-gate/review-evidence-cli.ts
      Review evidence: verified
      - gate make all: passed
      - gate make markdownlint: passed
      - gate make nixie: passed
      - dual-review path: scrutineer (primary; scrutineer available)

  Exit code `0`.

This satisfies the roadmap 1.5.8 success criterion: "an unparameterised
automated review cannot claim a scrutineer review when the harness knows only
coderabbit or local-self-run evidence is available."

## Constraints

Hard invariants that must hold throughout implementation.

- Work exclusively inside the git worktree
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-8`. Never edit files in
  the root/control checkout.
- Do not change the pure classifier contract in
  `tests/build-gate/review-evidence.ts` (`ReviewPath`,
  `ReviewPathAvailability`, `selectReviewPath`, `classifyReviewEvidence`,
  `ReviewEvidenceResult`) or the report formatter
  `tests/build-gate/review-evidence-report.ts`. This task changes only how the
  CLI *derives* the `pathAvailability` facts it feeds into the classifier.
- Do not change the mapping of statuses to exit codes in `exitCodeFor`
  (`verified`→0, `failed`→1, `usage-error`→2, `degraded`→3).
- Keep the existing environment-first CLI conventions: an environment value
  seeds the option, and an explicit CLI flag overrides it. Invalid values are
  reported as `usage-error` (exit 2), mirroring
  `parseEnvironmentGateTimeoutMs`.
- No code file may exceed 400 physical lines
  (`tests/build-gate/file-size-support.ts:7`,
  `SOURCE_AND_TEST_LINE_LIMIT = 400`). `review-evidence-cli.ts` is already 354
  lines, so new derivation logic must live in a new module rather than being
  bolted onto the CLI.
- `make review-evidence` stays outside `make all` (it is a reviewer-run audit
  gate, not a recursive commit-gate step). The Makefile target itself needs no
  change: environment variables flow through the bare `bun run` invocation.
- All prose, comments, and commit messages use en-GB Oxford spelling
  ("-ize"/"-yse"/"-our") per AGENTS.md and
  `docs/documentation-style-guide.md`.
- `tsconfig.json` sets `exactOptionalPropertyTypes: true` and
  `noPropertyAccessFromIndexSignature: true` (AGENTS.md, "Tooling Defaults");
  index-signature access (e.g. `env["ODW_LINT_REVIEW_SCRUTINEER"]`) and
  optional-property construction must respect these.

## Tolerances (exception triggers)

- Scope: if implementation requires changing more than 4 non-test source/test
  files or more than ~220 net lines, stop and escalate.
- Interface: if the classifier or report public types in
  `review-evidence.ts` / `review-evidence-report.ts` must change to complete
  this task, stop and escalate — that indicates the task was mis-scoped.
- Dependencies: no new runtime or dev dependency is expected (`fast-check` and
  `bun:test` are already used by
  `tests/build-gate/review-evidence.property.test.ts`). If one appears
  necessary, stop and escalate.
- File size: if any touched file would exceed 400 lines after a work item,
  stop and re-plan the split rather than shipping the violation.
- Iterations: if `make all` still fails after 3 focused fix attempts on a work
  item, stop and escalate.
- Ambiguity: if the "happy-path `verified`" expectation documented in
  AGENTS.md cannot be reconciled with the pessimistic default without a
  product decision, stop and present options.

## Risks

- Risk: changing the default flips the documented df12 happy-path result from
  `verified` to `degraded` for any invocation that does not export harness
  state, surprising operators who run `make review-evidence` by hand.
  Severity: medium. Likelihood: high.
  Mitigation: this is the intended behaviour (the roadmap explicitly rejects
  optimistic defaulting). Work item 3 does not merely *add* a pessimistic-default
  note: it rewrites the two pre-existing statements that attribute `verified` to
  toolchain provisioning alone (AGENTS.md's "In the fully provisioned df12
  environment … the expected happy-path result is `verified`" sentence and the
  developer's-guide "so a clean tree is expected to report `verified`" sentence)
  so that `verified` is conditioned on the harness exporting scrutineer
  availability. It documents the exact env vars and flags to assert real
  availability and states that a bare run is honestly degraded. Leaving either
  statement unchanged would make the docs self-contradictory — one paragraph
  saying a bare/clean run is `verified`, the added text saying it is `degraded`
  — which violates "docs as source of truth".
- Risk: the AGENTS.md audit-contract test
  (`tests/build-gate/review-evidence-audit.test.ts`) matches specific patterns
  in the "Roadmap Review & Audit Evidence" section; editing that section could
  break those matches.
  Severity: low. Likelihood: medium.
  Mitigation: preserve the required substrings (`` `make review-evidence` ``,
  `required`/`must`, `record`, and the `coderabbit … no usable output`
  clause). Re-run `bun test tests/build-gate/review-evidence-audit.test.ts`
  after editing.
- Risk: once path availability is env-derived, any CLI test that does not
  inject `env` silently depends on whatever the df12-build harness happens to
  export (`ODW_LINT_REVIEW_SCRUTINEER`/`_CODERABBIT`/`_LOCAL_SELF_RUN`), making
  results non-deterministic across environments. This is a real gap today, not
  a hypothetical: the `runCli` helper drops the `env` key when a test passes
  none (`tests/build-gate/review-evidence-cli.test.ts:82`,
  `...(options.env === undefined ? {} : { env: options.env })`), so such a run
  falls through to the ambient `process.env`.
  Severity: medium. Likelihood: high (the df12 harness may export reviewer
  state while running this very suite).
  Mitigation (work item 2): change the `runCli` helper so `env` defaults to a
  concrete empty object (`env: options.env ?? {}`), isolating the *whole* suite
  — not just the enumerated subset — from ambient state, so an un-injected test
  deterministically gets the pessimistic default. The two direct
  `runReviewEvidenceCli(...)` call sites that bypass the helper
  (`review-evidence-cli.test.ts:317` and `:330`) each inject their own explicit
  `env`. Every test asserting an availability-dependent status additionally
  declares the availability it needs. This respects `exactOptionalPropertyTypes`
  because `options.env ?? {}` is always a defined object (AGENTS.md,
  "Environment-dependent tests", "Tooling Defaults").
- Risk: growing `review-evidence-cli.ts` past 400 lines.
  Severity: medium. Likelihood: medium.
  Mitigation: extract availability parsing/derivation into a new module
  (`review-evidence-availability.ts`) in work item 1 before adding behaviour.

## Progress

- [x] Work item 1: Extract reviewer-availability parsing into a dedicated
  build-gate module (pure refactor, no behaviour change).
- [x] Work item 2: Derive reviewer availability from harness environment state
  and drop the optimistic default.
- [x] Work item 3: Rewrite the two optimistic `verified` statements and
  document the harness reviewer-availability contract in AGENTS.md and the
  developer's guide.

Work item 1 evidence (2026-07-03):

- Focused checks passed:
  `bun test tests/build-gate/review-evidence-cli.test.ts tests/build-gate/review-evidence-availability.test.ts`.
- Deterministic gates passed after review follow-up:
  `make all`, `make markdownlint`, and `make nixie`.
- CodeRabbit initially found availability-test and type-narrowing follow-ups;
  after fixing them, `coderabbit review --agent` returned
  `{"type":"complete","status":"review_completed","findings":0}`.

Work item 2 evidence (2026-07-03):

- Red stage: focused CLI tests failed before production changes because a bare
  environment still selected `scrutineer`, invalid harness environment values
  were ignored, and `--local-self-run=` was unknown.
- Green stage: focused checks passed:
  `bun test tests/build-gate/review-evidence-cli.test.ts`
  `tests/build-gate/review-evidence-cli-availability.test.ts`
  `tests/build-gate/review-evidence-availability.test.ts`.
- Deterministic gate passed after splitting the CLI availability tests below
  the 400-line file-size limit: `make all`.
- CodeRabbit first returned test-snapshot and command-invocation findings; after
  fixing them and retrying one interrupted run, `coderabbit review --agent`
  completed with `findings: 0`.

Work item 3 evidence (2026-07-03):

- Focused audit check passed:
  `bun test tests/build-gate/review-evidence-audit.test.ts`.
- Stale optimistic documentation was checked with exact text search; no
  remaining sentence asserts that a bare or clean run reports `verified` based
  on toolchain provisioning alone.
- Changed Markdown files were formatted with `mdtablefix` and
  `markdownlint-cli2 --fix`.
- Deterministic documentation and repository gates passed:
  `make markdownlint`, `make nixie`, and `make all`.
- CodeRabbit review completed with `findings: 0`.

## Surprises & discoveries

- Observation: the entire review-evidence feature lives under
  `tests/build-gate/`, not `src/`.
  Evidence: `tests/build-gate/review-evidence*.ts`; `src/` holds only
  `diagnostics` and `static-analysis`.
  Impact: new modules and tests for this task belong in `tests/build-gate/`,
  and the file-size gate (`SOURCE_AND_TEST_LINE_LIMIT`) applies there too.
- Observation: the new availability parser needed a stricter contract than the
  original object-or-string return to satisfy review feedback.
  Evidence: CodeRabbit requested an exhaustive value list, all-path tests, and
  a discriminated parse result before returning zero findings.
  Impact: `parseAvailabilityValue` now returns `ParsedAvailabilityValue`
  (`ok: true` with a value or `ok: false` with a usage error), while preserving
  the same CLI error text.
- Observation: Work item 2 pushed `review-evidence-cli.test.ts` over the
  400-line source/test limit.
  Evidence: `make all` failed with
  `tests/build-gate/review-evidence-cli.test.ts: 415 physical lines exceeds 400`.
  Impact: harness-specific CLI tests now live in
  `tests/build-gate/review-evidence-cli-availability.test.ts`, leaving both
  files under the limit.
- Observation: the AGENTS.md audit-contract test was stable after rewriting the
  review-evidence section.
  Evidence: `bun test tests/build-gate/review-evidence-audit.test.ts` passed
  after the documentation changes.
  Impact: the rewrite preserved the required audit-contract substrings while
  removing the stale optimistic `verified` claim.

## Decision log

- Decision: derive reviewer availability from environment variables
  (`ODW_LINT_REVIEW_SCRUTINEER`, `ODW_LINT_REVIEW_CODERABBIT`,
  `ODW_LINT_REVIEW_LOCAL_SELF_RUN`) rather than any other channel.
  Rationale: the repository has no in-tree df12-build workflow script to wire
  into; the harness contract is expressed through AGENTS.md and the process
  environment. Environment-first parsing is the established pattern
  (`ODW_LINT_REVIEW_EXEC`, `ODW_LINT_REVIEW_GATE_TIMEOUT_MS` in
  `parseCliArgs`, `tests/build-gate/review-evidence-cli.ts:196-207`), so the
  harness can export what it observes and the CLI derives from it.
  Date/Author: 2026-07-03, planning agent.
- Decision: default `scrutineer` and `coderabbit` to `unavailable` and
  `local-self-run` to `available` when neither an env var nor a flag is given.
  Rationale: an automated run only *knows* it can run the gates locally; it
  cannot assert that an independent reviewer looked at the change. This makes a
  bare run degrade (exit 3) and select `local-self-run`, exactly satisfying the
  success criterion. Positive availability must be asserted by the harness.
  Date/Author: 2026-07-03, planning agent.
- Decision: precedence is explicit CLI flag > harness env var > pessimistic
  default, per path.
  Rationale: mirrors the timeout precedence already in the CLI and lets an
  operator override harness state for local investigation.
  Date/Author: 2026-07-03, planning agent.
- Decision: extract availability parsing/derivation into a new module
  `tests/build-gate/review-evidence-availability.ts` and have the CLI consume
  it.
  Rationale: keeps `review-evidence-cli.ts` under the 400-line gate, gives the
  new behaviour a directly unit-testable seam, and anticipates the shared
  build-gate CLI consolidation planned in roadmap 1.5.9 without pre-empting it.
  Date/Author: 2026-07-03, planning agent.
- Decision: isolate the CLI test suite from ambient state by defaulting the
  `runCli` helper's `env` to a concrete `{}` (rather than dropping the key), and
  treat the two direct `runReviewEvidenceCli(...)` call sites as separate cases
  that inject their own `env`.
  Rationale: once availability is env-derived, an un-injected test would read
  `process.env` and could be silently flipped by whatever the df12 harness
  exports while running this suite. Defaulting to `{}` makes an un-injected test
  deterministically exercise the pessimistic default; the enumerated table then
  gives each availability-dependent test the state it must assert. This is the
  reviewer-sanctioned "default the helper's env to `{}`" option.
  Date/Author: 2026-07-03, planning agent (round 3).
- Decision: the WI2 CLI-test change-set is a complete, closed table keyed by
  line number, not an open "and similar tests" description.
  Rationale: the failure is not confined to inline-snapshot / `scrutineer
  (primary …)` tests — the degraded-path short-circuit (`review-evidence.ts:116`)
  also collapses the timeout, killed-gate, default-timeout, gate-derivation,
  coderabbit-fallback, and real-runner tests to `degraded`/exit 3. Enumerating
  each explicitly is required for `make all` to pass on a literal read of the
  plan.
  Date/Author: 2026-07-03, planning agent (round 3).
- Decision: add a `--local-self-run=` flag for parity with `--scrutineer=` and
  `--coderabbit=`.
  Rationale: all three paths are now derivable from harness state; the CLI
  override surface should be symmetric so an operator can express any observed
  state. `setPathAvailability` is widened from `"scrutineer" | "coderabbit"` to
  the full `ReviewPath`.
  Date/Author: 2026-07-03, planning agent.
- Decision: use a discriminated availability-parse result in the extracted
  module.
  Rationale: CodeRabbit flagged the previous object-or-string union as weaker
  for callers. The tagged result keeps usage-error text stable while making
  success and failure branches explicit before work item 2 adds environment
  parsing on the same seam.
  Date/Author: 2026-07-03, implementation agent.
- Decision: keep the Work item 2 harness CLI behaviour tests in a dedicated
  test file.
  Rationale: the existing CLI test file was already close to the 400-line gate.
  Splitting only the new harness-availability scenarios preserves the original
  coverage shape while keeping each file comfortably below the repository's
  source/test file-size limit.
  Date/Author: 2026-07-03, implementation agent.
- Decision: document `verified` as depending on both passing re-run gates and
  exported reviewer state.
  Rationale: a fully provisioned toolchain only proves that the local gate
  commands can run; it does not prove that an independent reviewer was
  available. The AGENTS.md and developer-guide wording now matches the
  pessimistic CLI default and tells operators how to export or override real
  harness state.
  Date/Author: 2026-07-03, implementation agent.

## Outcomes & retrospective

Roadmap 1.5.8 is complete. The review-evidence CLI now derives reviewer
availability from harness state instead of assuming all review paths are
available. A bare run with no availability environment selects degraded
`local-self-run` evidence and cannot print `scrutineer (primary …)`; a harness
run with `ODW_LINT_REVIEW_SCRUTINEER=available` still selects the primary
scrutineer path and reaches `verified` when the gates pass. Invalid harness
availability values produce usage errors before any gate execution.

The documentation now states the same contract in AGENTS.md and the developer's
guide: `verified` requires both passing re-run gates and exported reviewer state
that selects an independent dual-review path. The harness variables are
`ODW_LINT_REVIEW_SCRUTINEER`, `ODW_LINT_REVIEW_CODERABBIT`, and
`ODW_LINT_REVIEW_LOCAL_SELF_RUN`, and explicit `--scrutineer=`,
`--coderabbit=`, and `--local-self-run=` flags override the environment for
operator investigation.

Skills and tools relied on during implementation: `grepai` for main-branch
intent search, `leta` for branch-local symbol/text checks, `sem` for semantic
diff context, `biome-typescript` for TypeScript quality conventions,
`execplans` for this living plan update, and `commit-message` for file-based
commits. Source-of-truth signposts were AGENTS.md "Roadmap Review & Audit
Evidence", `docs/developers-guide.md` review-evidence text,
`docs/documentation-style-guide.md`, and
`tests/build-gate/review-evidence-audit.test.ts`.

## Context and orientation

This is a TypeScript project built with Bun (`package.json`, `bunfig.toml`),
linted with Biome and Oxlint and type-checked with `tsc --noEmit`. The
reviewer-run audit gate is implemented across four files in
`tests/build-gate/`:

- `review-evidence.ts` — the pure classifier. `ReviewPath` is
  `"scrutineer" | "coderabbit" | "local-self-run"`; `ReviewPathAvailability`
  is `"available" | "quota-blocked" | "unavailable" | "no-output"`.
  `selectReviewPath(pathAvailability)` picks `scrutineer` if it is `available`,
  else `coderabbit` if it is `available`, else a degraded `local-self-run`.
  `classifyReviewEvidence(input)` combines gate executions with the selected
  path into a `ReviewEvidenceResult`. This file is not modified by this task.
- `review-evidence-report.ts` — formats a `ReviewEvidenceResult` into stable,
  greppable lines such as
  `- dual-review path: scrutineer (primary; scrutineer available)`. Not
  modified.
- `review-evidence-cli.ts` — the CLI. `parseCliArgs(args, env, defaultTimeout)`
  builds `CliOptions { executionEnabled, gateTimeoutMs, pathAvailability }`.
  Today it seeds `pathAvailability` from the constant `defaultPathAvailability`
  (all `available`, line 64) and then applies `--scrutineer=` / `--coderabbit=`
  flags via `parseCliArg` / `setPathAvailability`. `parseAvailability` and
  `reviewerAvailabilityValues` validate flag values. This is the file whose
  derivation logic changes.
- `review-evidence-cli.test.ts`, `review-evidence.test.ts`,
  `review-evidence-report.test.ts`, `review-evidence.property.test.ts`,
  `review-evidence-audit.test.ts` — the existing tests. The CLI tests inject
  `env`, `writeOut`, `writeErr`, `createRunner`, and `gateCommands`, so they
  never touch the real environment or spawn real processes.

Key terms:

- "Harness state": what the roadmap / df12-build workflow observes about
  reviewer availability (for example, that the scrutineer quota is exhausted).
  In this repository it is conveyed through environment variables.
- "Dual-review path": which independent reviewer backed the review — the
  primary `scrutineer`, the `coderabbit` fallback, or the degraded
  `local-self-run` when no independent reviewer remains.
- "Optimistic default": the current behaviour of assuming every path is
  `available` when nothing says otherwise. This task removes it.

The Makefile target (`Makefile:45-46`) runs
`bun run tests/build-gate/review-evidence-cli.ts` with no arguments, inheriting
the process environment. Environment variables the harness exports therefore
reach the CLI unchanged; no Makefile edit is required.

Documents that are the source of truth for this task:

- AGENTS.md, "Roadmap Review & Audit Evidence" (the gate's contract and the
  non-silent-substitution requirement) and "Testing" / "Tooling Defaults" (the
  testing rules and `tsconfig` strictness).
- `docs/developers-guide.md`, the review-evidence subsection (lines ~213-247),
  which documents the target, its env/flag overrides, exit codes, and path
  ordering.
- `docs/documentation-style-guide.md` (en-GB Oxford spelling; Markdown rules).
- `docs/complexity-antipatterns-and-refactoring-strategies.md` (primitive
  obsession / small-function guidance backing the module extraction).
- `docs/roadmap.md`, task 1.5.8 (the requirement and success criterion) and
  its dependencies 1.5.6 and 1.5.7.

The technical-design, terms-of-reference, and ADR documents do not cover this
internal build-gate tooling; they are reviewed and found not to constrain this
task. `docs/scripting-standards.md` targets Python/Cyclopts scripts and is not
load-bearing here beyond its general environment-first philosophy, which the
existing CLI already follows.

## Plan of work

### Work item 1 — Extract reviewer-availability parsing into a dedicated module

Goal: move the availability-parsing primitives out of
`review-evidence-cli.ts` into a new module with no behaviour change, creating
the seam and headroom for work item 2 and keeping the CLI under 400 lines.

Read first: AGENTS.md "Code Style and Structure" (small modules, group by
feature) and "Testing";
`docs/complexity-antipatterns-and-refactoring-strategies.md` (extract-function
/ primitive-obsession sections). Skills to load: none language-specific beyond
the general TypeScript quality tools already wired into `make all`; this is a
mechanical extraction.

Create `tests/build-gate/review-evidence-availability.ts` exporting:

    import type { ReviewPath, ReviewPathAvailability } from "./review-evidence";

    export type PathAvailabilityFacts = Readonly<
      Record<ReviewPath, ReviewPathAvailability>
    >;

    export const reviewerAvailabilityValues: readonly ReviewPathAvailability[];

    export const parseAvailabilityValue: (
      name: string,
      value: string,
    ) => { readonly value: ReviewPathAvailability } | string;

    export const setPathAvailability: (
      facts: PathAvailabilityFacts,
      path: ReviewPath,
      value: ReviewPathAvailability,
    ) => PathAvailabilityFacts;

Move `reviewerAvailabilityValues`, `parseAvailability` (renamed to
`parseAvailabilityValue`, with the caller supplying the field name so the
`invalid <name> availability:` message is unchanged), `setPathAvailability`
(widened to accept any `ReviewPath`), and `defaultPathAvailability` (unchanged,
still all `available` at this step) into the module. Update
`review-evidence-cli.ts` to import them. Keep `parseCliArg` calling
`parseAvailabilityValue("scrutineer", …)` / `("coderabbit", …)` so behaviour
and error strings are byte-for-byte identical.

This is a pure refactor: every existing test must still pass unchanged.

### Work item 2 — Derive reviewer availability from harness environment state

Goal: replace the optimistic default with harness-state derivation and a
pessimistic fallback, and add the `--local-self-run=` flag.

Read first: `review-evidence-cli.ts:190-223` (`parseCliArgs` /
`parseEnvironmentGateTimeoutMs` — the env-then-flag precedence to mirror);
AGENTS.md "Testing" ("Invariant testing" with `fast-check`,
"Environment-dependent tests", "Parameterized tests"); `docs/developers-guide.md`
review-evidence subsection. Skills to load: none beyond the standard gate.

Add to `review-evidence-availability.ts`:

    // scrutineer & coderabbit "unavailable"; "local-self-run" "available"
    export const pessimisticPathAvailability: PathAvailabilityFacts;

    export const deriveHarnessPathAvailability: (
      env: NodeJS.ProcessEnv,
    ) => PathAvailabilityFacts | string; // string = usage error

`deriveHarnessPathAvailability` reads `ODW_LINT_REVIEW_SCRUTINEER`,
`ODW_LINT_REVIEW_CODERABBIT`, and `ODW_LINT_REVIEW_LOCAL_SELF_RUN`. For each,
`undefined` keeps the pessimistic default for that path; a defined value is
validated with `parseAvailabilityValue` and, on failure, the whole function
returns the usage-error string (mirroring how `parseEnvironmentGateTimeoutMs`
short-circuits `parseCliArgs`). Access env keys through destructuring or
bracket access consistent with `noPropertyAccessFromIndexSignature`, as the
existing code already does at `review-evidence-cli.ts:196-199`.

Rewire `parseCliArgs` in `review-evidence-cli.ts`:

- After parsing the timeout, call `deriveHarnessPathAvailability(env)`; if it
  returns a string, return `{ usageError }`.
- Seed `options.pathAvailability` from that derived value instead of
  `defaultPathAvailability` (remove the now-unused constant).
- Extend `parseCliArg` with a `--local-self-run=` branch alongside
  `--scrutineer=` and `--coderabbit=`, all delegating to
  `parseAvailabilityValue` + `setPathAvailability`.

No change to `collectReviewEvidence`, the classifier, or the report formatter:
they already handle every availability combination.

**Why the existing CLI suite must be updated exhaustively.** The classifier
short-circuits to `degraded` whenever the selected review path is degraded
(`review-evidence.ts:116` returns `degraded` as soon as
`degradedEvidenceReasons` is non-empty, and a degraded `local-self-run`
contributes `"no independent dual-review path available"` at
`review-evidence.ts:199`). Under the new pessimistic default, an un-parameterized
run therefore selects a degraded `local-self-run` and its status collapses to
`degraded` (exit 3) — this outranks even a failed gate. Consequently **every**
existing CLI test that asserts a non-degraded outcome (`verified`/exit 0, or
`failed`/exit 1) or that asserts `scrutineer (primary …)` will break unless it
declares reviewer availability. Enumerating only the inline-snapshot and
`scrutineer (primary …)` tests is insufficient: the timeout, killed-gate,
default-timeout, gate-derivation, coderabbit-fallback, and real-runner tests
also break. The complete, closed enumeration — every affected test, its exact
line, why it breaks, and the precise remediation — is given as a table in the
Concrete steps for this work item. That table is the authoritative change-set;
following it leaves `make all` green.

Two structural fixes accompany the per-test edits:

- Change the `runCli` helper (`review-evidence-cli.test.ts:82`) so `env`
  defaults to a concrete empty object: replace
  `...(options.env === undefined ? {} : { env: options.env })` with
  `env: options.env ?? {}`. This isolates the whole suite from ambient
  `process.env`, so an un-injected test deterministically exercises the
  pessimistic default rather than whatever the df12 harness exported. It is
  `exactOptionalPropertyTypes`-safe because `options.env ?? {}` is always
  defined.
- The two tests that call `runReviewEvidenceCli(...)` directly rather than
  through `runCli` (`:317` and `:330`) bypass that helper default, so each must
  inject its own explicit `env` in its options object.

### Work item 3 — Document the harness reviewer-availability contract

Goal: update the source-of-truth docs so operators and the df12 harness know
that reviewer availability is now derived, not assumed — which means both
rewriting the two pre-existing statements that credit `verified` to toolchain
provisioning alone and adding the harness-availability contract, so no paragraph
is left contradicting the pessimistic default.

Read first: `docs/documentation-style-guide.md` (Spelling, Markdown rules,
Developer's guide section); the existing AGENTS.md "Roadmap Review & Audit
Evidence" section and the developer's-guide review-evidence subsection; the
patterns asserted by `tests/build-gate/review-evidence-audit.test.ts`. Skills
to load: none; prose edits under the markdown gates.

This work item both *adds* the harness-availability contract and *rewrites* the
two pre-existing statements that currently attribute `verified` to toolchain
provisioning alone. Both edits are mandatory; adding the new note without
rewriting the old statements would leave each document self-contradictory (one
paragraph claiming a bare/clean run is `verified`, the new text claiming it is
`degraded`), violating "docs as source of truth" and the roadmap's rejection of
optimistic defaulting.

AGENTS.md "Roadmap Review & Audit Evidence" — two changes:

1. Rewrite the existing sentence (currently AGENTS.md:121-124): "In the fully
   provisioned df12 environment, which is the same toolchain used for this
   repository's `make nixie` validation, the expected happy-path result is
   `verified` (exit 0)." Replace it so `verified` is conditioned on **both** the
   provisioned toolchain (so every re-run gate passes) **and** the harness
   exporting its observed reviewer state (for example
   `ODW_LINT_REVIEW_SCRUTINEER=available`) so an independent dual-review path is
   selected. State explicitly that a bare run which provisions the toolchain but
   exports no reviewer state is honestly `degraded` (exit 3) on the
   `local-self-run` path, not `verified`. Keep the neighbouring sentences intact:
   "The recorded report is the deliverable whatever its classification." before
   it, and the `failed` (1) / `usage-error` (2) blocking sentence and the "Do
   not state or imply that any specific Mermaid renderer is selected …" sentence
   after it.
2. Add the harness-availability contract: the roadmap / df12-build harness must
   export its observed reviewer state (`ODW_LINT_REVIEW_SCRUTINEER`,
   `ODW_LINT_REVIEW_CODERABBIT`, `ODW_LINT_REVIEW_LOCAL_SELF_RUN`, each one of
   `available`, `quota-blocked`, `unavailable`, `no-output`); absent such state
   the run defaults pessimistically and reports `degraded` `local-self-run`
   rather than claiming a scrutineer; and explicit `--scrutineer=` /
   `--coderabbit=` / `--local-self-run=` flags override the harness state.

Preserve the substrings the audit test
(`tests/build-gate/review-evidence-audit.test.ts`) requires within the section:
`` `make review-evidence` ``, a `required`/`must` token, a `record` token, and
the `coderabbit … no usable output` clause. These all live in sentences this
work item does not touch (the "must run … and record its report" opener and the
final CodeRabbit-fallback paragraph), so the rewrite above is safe; re-run
`bun test tests/build-gate/review-evidence-audit.test.ts` to confirm.

`docs/developers-guide.md` review-evidence subsection — two changes:

1. Rewrite the existing sentence (currently docs/developers-guide.md:218-219):
   "The df12 review/audit environment provides the full toolchain, including
   `nixie`, so a clean tree is expected to report `verified`." Replace it so the
   toolchain provisioning is credited only with making the re-run gates pass,
   and `verified` additionally requires the harness to export its observed
   reviewer state (for example `ODW_LINT_REVIEW_SCRUTINEER=available`) so a
   scrutineer or coderabbit dual-review path is selected; a clean tree with no
   exported reviewer state is honestly `degraded` (exit 3) on the
   `local-self-run` path.
2. Document the three availability environment variables, the precedence
   (flag > env > pessimistic default), and the new `--local-self-run=` flag.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-8`.

Work item 1 (extract; no behaviour change):

1. Create `tests/build-gate/review-evidence-availability.ts` and move the four
   primitives into it; update imports in `review-evidence-cli.ts`.
2. Add `tests/build-gate/review-evidence-availability.test.ts` covering
   `parseAvailabilityValue` (each valid value round-trips; an invalid value
   yields `invalid <name> availability: <value>`) and `setPathAvailability`
   (updates one path, leaves the others intact) using a table-driven test.
3. Validate:

       make all

   Expect the full gate suite to pass with no test changes elsewhere. The new
   unit test file passes; the file-size gate confirms
   `review-evidence-cli.ts` is now below 400 lines and the new module is well
   under it.
4. Commit (gated): a message such as
   `refactor(build-gate): extract review-evidence availability parsing`.

Work item 2 (derive from harness state; behaviour change):

1. Red — first make the suite ambient-independent, then add the new failing
   tests, then repair the existing tests.

   a. Change the `runCli` helper so `env` always resolves to a concrete object.
      Replace line 82,
      `...(options.env === undefined ? {} : { env: options.env }),`, with
      `env: options.env ?? {},`. Now a test that injects no `env` gets `{}`
      (pessimistic default) rather than the ambient `process.env`.

   b. Add the new behaviour tests (each passes an explicit `env`):
      - unparameterised (`env: {}`, no availability flags) → exit 3, output
        contains `dual-review path: local-self-run (degraded fallback` and does
        **not** contain `scrutineer (primary`;
      - `env: { ODW_LINT_REVIEW_SCRUTINEER: "available" }` → selects
        `scrutineer (primary; scrutineer available)`, exit 0;
      - flag overrides env: `env: { ODW_LINT_REVIEW_SCRUTINEER: "available" }`
        with `args: ["--scrutineer=quota-blocked"]` → not scrutineer primary
        (with no coderabbit declared, degrades to `local-self-run`);
      - `env: { ODW_LINT_REVIEW_CODERABBIT: "not-a-value" }` → exit 2 with
        `invalid coderabbit availability: not-a-value` on stderr;
      - `args: ["--local-self-run=unavailable", "--scrutineer=unavailable", "--coderabbit=unavailable"]`
        → degraded, and the report's reason line shows `local-self-run unavailable`.

   c. Repair every existing CLI test that breaks under the pessimistic default.
      This is the complete, closed change-set; apply all of it. "Break reason"
      names why the un-repaired test fails; "Remediation" is the exact edit.

      | Test (line) & name | Break reason under pessimistic default | Remediation |
      | --- | --- | --- |
      | `:90` returns verified evidence when every keyed gate passes | selects degraded `local-self-run` → status `degraded`/exit 3, and path line ≠ `scrutineer (primary …)`; inline snapshot mismatches | add `env: { ODW_LINT_REVIEW_SCRUTINEER: "available" }`; snapshot unchanged |
      | `:121` returns failed evidence and exit 1 when a required gate fails | degraded path outranks the failed gate (`review-evidence.ts:116`) → `degraded`/exit 3, not `failed`/exit 1 | add `env: { ODW_LINT_REVIEW_SCRUTINEER: "available" }`; snapshot unchanged |
      | `:151` returns degraded evidence and exit 3 when a gate cannot spawn | still exit 3, but path line becomes `local-self-run` and an extra `no independent dual-review path` reason appears; inline snapshot mismatches | add `env: { ODW_LINT_REVIEW_SCRUTINEER: "available" }`; snapshot unchanged |
      | `:171` returns failed evidence and exit 1 when a gate times out | degraded path outranks the timed-out gate → `degraded`/exit 3, not `failed`/exit 1 | add `env: { ODW_LINT_REVIEW_SCRUTINEER: "available" }` |
      | `:188` returns failed evidence and exit 1 when a gate is killed | degraded path outranks the killed gate → `degraded`/exit 3, not `failed`/exit 1 | add `env: { ODW_LINT_REVIEW_SCRUTINEER: "available" }` |
      | `:223` uses the documented default gate timeout | `runCli()` now yields pessimistic → `degraded`/exit 3, breaking `exit 0` | `runCli({ env: { ODW_LINT_REVIEW_SCRUTINEER: "available" } })` |
      | `:232` uses the CLI gate-timeout override for each gate command | pessimistic → exit 3, breaking `exit 0` | add `env: { ODW_LINT_REVIEW_SCRUTINEER: "available" }` alongside existing `args` |
      | `:241` uses the environment gate-timeout override | pessimistic → exit 3, breaking `exit 0` | extend env to `{ ODW_LINT_REVIEW_GATE_TIMEOUT_MS: "450000", ODW_LINT_REVIEW_SCRUTINEER: "available" }` |
      | `:257` reports coderabbit as the explicit fallback when scrutineer is quota-blocked | `coderabbit` now defaults `unavailable`, so `selectReviewPath` returns `local-self-run` instead of the asserted `coderabbit (fallback …)` | assert coderabbit availability: `args: ["--scrutineer=quota-blocked", "--coderabbit=available"]` (equivalently add `env: { ODW_LINT_REVIEW_CODERABBIT: "available" }`); assertion string unchanged |
      | `:309` derives required gates from the keyed gate-command list | pessimistic → exit 3, breaking `exit 0` | add `env: { ODW_LINT_REVIEW_SCRUTINEER: "available" }` |
      | `:317` uses the shared real command runner for a passing command | calls `runReviewEvidenceCli([], {…})` directly (bypasses `runCli`), so it reads ambient `process.env`; in a clean env it becomes `local-self-run`/exit 3, breaking `exit 0` / `verified` | inject `env: { ODW_LINT_REVIEW_SCRUTINEER: "available" }` into the options object passed to `runReviewEvidenceCli` |
      | `:330` maps a real missing executable to degraded unavailable evidence | direct call reads ambient env; already `degraded`/exit 3 from the missing gate, but the path derivation should be deterministic | inject `env: {}` into the options object (keeps exit 3; removes ambient dependence) |

      Tests that need **no** change (they already assert `degraded`/`usage-error`
      with no availability-dependent path assertion, or force availability via
      `args`): `:204` (`--no-exec`), `:215` (`ODW_LINT_REVIEW_EXEC=0`), `:250`
      (invalid timeout), `:266` (both reviewers `--…=unavailable`), `:276`
      (coderabbit `--…=no-output`; `local-self-run` still defaults `available`),
      `:288` (unknown flag), `:302` (invalid availability). After the helper
      change in (a) these all receive a deterministic `{}` env, so none silently
      reads ambient state.

   Run the focused file and confirm the new tests fail for the intended reason
   (and, before implementing (3), that the repaired tests fail because the
   optimistic default is still in place):

       bun test tests/build-gate/review-evidence-cli.test.ts

2. Add a `fast-check` property test (in
   `review-evidence-availability.test.ts` or the CLI property file) asserting
   the success-criterion invariant: for any generated combination of the three
   availability env vars in which `ODW_LINT_REVIEW_SCRUTINEER` is not
   `available`, `deriveHarnessPathAvailability` followed by `selectReviewPath`
   never yields `{ selected: "scrutineer", isFallback: false }`. Reuse the
   generator style in
   `tests/build-gate/review-evidence.property.test.ts:107-116` and a fixed
   `seed` for determinism.

3. Green — implement `pessimisticPathAvailability` and
   `deriveHarnessPathAvailability` in the availability module, rewire
   `parseCliArgs`, and add the `--local-self-run=` branch. Re-run:

       bun test tests/build-gate/review-evidence-cli.test.ts
       bun test tests/build-gate/review-evidence-availability.test.ts

   Expect all green.

4. Refactor and full gate:

       make all

5. Commit (gated): e.g.
   `feat(build-gate): derive reviewer availability from harness state`.

Work item 3 (docs):

1. Edit AGENTS.md and `docs/developers-guide.md` as described in Work item 3 of
   the Plan of work — in each file both *rewrite* the pre-existing optimistic
   `verified` sentence (AGENTS.md:121-124 and docs/developers-guide.md:218-219)
   to condition `verified` on the harness exporting scrutineer availability, and
   *add* the harness-availability contract (env vars, precedence, and the
   `--local-self-run=` flag). Grep each file afterwards to confirm no remaining
   sentence still asserts that a bare/clean run is `verified` on toolchain
   provisioning alone.
2. Format only the changed Markdown files, then gate:

       bunx mdtablefix AGENTS.md docs/developers-guide.md
       bunx markdownlint-cli2 --fix AGENTS.md docs/developers-guide.md
       make markdownlint
       make nixie
       make all

   (`make all` re-runs `make test`, which includes
   `review-evidence-audit.test.ts` verifying the AGENTS.md contract still
   matches.) If `mdtablefix` / `markdownlint-cli2` are invoked through a
   different entrypoint in this repo, use the repository's documented markdown
   formatter for exactly these two files; do not run a repo-global reformat.
3. Commit (gated): e.g.
   `docs: document harness-derived reviewer availability`.

## Validation and acceptance

Red-Green-Refactor evidence to record as work proceeds:

- Work item 2 Red: `bun test tests/build-gate/review-evidence-cli.test.ts`
  fails on the new "unparameterised cannot claim scrutineer" test because the
  current default still selects `scrutineer (primary …)`.
- Work item 2 Green: the same command passes after
  `deriveHarnessPathAvailability` and the pessimistic default are in place.
- Refactor: `make all` passes.

Behavioural acceptance (run from the worktree root):

- `bun run tests/build-gate/review-evidence-cli.ts --no-exec` prints
  `Review evidence: degraded`, a `dual-review path: local-self-run (degraded
  fallback; …)` line, and exits `3`; it never prints `scrutineer (primary`.
- `ODW_LINT_REVIEW_SCRUTINEER=available bun run
  tests/build-gate/review-evidence-cli.ts` prints
  `dual-review path: scrutineer (primary; scrutineer available)` and, with the
  real gates passing, exits `0`.
- `ODW_LINT_REVIEW_SCRUTINEER=bogus bun run
  tests/build-gate/review-evidence-cli.ts` prints
  `invalid scrutineer availability: bogus` on stderr and exits `2`.

Quality criteria ("done"):

- Tests: `make all` passes (it runs `make test`, i.e. `bun test`), including
  the new availability unit/property tests, the updated CLI tests, and the
  unchanged classifier, report, and audit-contract tests.
- Lint/typecheck: `make all` includes Biome, Oxlint, and `tsc --noEmit`; all
  clean. The file-size gate confirms no file exceeds 400 lines.
- Markdown (work item 3 only): `make markdownlint` and `make nixie` pass for
  the two edited documents.

Quality method: run `make all` before each commit; for the documentation
commit also run `make markdownlint` and `make nixie`.

## Idempotence and recovery

Each work item is an independent, gate-passable commit. Re-running `make all`
is safe and side-effect-free. The new tests inject `env` and command runners,
so they never touch the ambient environment or spawn real gate processes. If a
work item's gate fails, fix forward within the iteration tolerance; if the
extraction in work item 1 causes an import cycle, revert that file move and
re-attempt with the primitives split differently — no other file is affected
until the CLI import is updated.

## Interfaces and dependencies

New module `tests/build-gate/review-evidence-availability.ts`:

    export type PathAvailabilityFacts = Readonly<
      Record<ReviewPath, ReviewPathAvailability>
    >;

    export const reviewerAvailabilityValues: readonly ReviewPathAvailability[];
    export const pessimisticPathAvailability: PathAvailabilityFacts;

    export type ParsedAvailabilityValue =
      | { readonly ok: true; readonly value: ReviewPathAvailability }
      | { readonly ok: false; readonly usageError: string };

    export function parseAvailabilityValue(
      name: ReviewPath,
      value: string,
    ): ParsedAvailabilityValue;

    export function setPathAvailability(
      facts: PathAvailabilityFacts,
      path: ReviewPath,
      value: ReviewPathAvailability,
    ): PathAvailabilityFacts;

    export function deriveHarnessPathAvailability(
      env: NodeJS.ProcessEnv,
    ): PathAvailabilityFacts | string;

`review-evidence-cli.ts` consumes these; `parseCliArgs` seeds
`pathAvailability` from `deriveHarnessPathAvailability(env)` and applies
`--scrutineer=` / `--coderabbit=` / `--local-self-run=` flags on top.
`review-evidence.ts` and `review-evidence-report.ts` are unchanged. No new
external dependency: `fast-check` and `bun:test` are already project
dev-dependencies used by the existing property test.

## Addenda

- [ ] 1.5.8.1. Add real review-evidence CLI smoke coverage.
  - Source: review:1.5.8; severity low.
  - Scope: spawn `bun run tests/build-gate/review-evidence-cli.ts` for the
    documented bare degraded exit 3,
    `ODW_LINT_REVIEW_SCRUTINEER=available` verified exit 0, and invalid
    availability usage-error exit 2 paths.
  - Success: the smoke test proves process-level environment wiring and exit
    codes match the documented CLI behaviour instead of only exercising
    injected-env unit helpers.
- [ ] 1.5.8.2. Standardize review-evidence parse result signalling.
  - Source: audit:1.5.8; severity low.
  - Scope: replace mixed tagged and string-failure parse conventions in
    review-evidence CLI option parsing with one tagged result type.
  - Success: availability and timeout parsing return one discriminated result
    shape, and callers no longer branch on `typeof value === "string"` for
    usage errors.
- [ ] 1.5.8.3. Harden reviewer-availability unit coverage.
  - Source: audit:1.5.8; severity low.
  - Scope: expand `deriveHarnessPathAvailability` and `setPathAvailability`
    tests for positive mappings, environment precedence, invalid values, and
    immutable update behaviour.
  - Success: reviewer path selection cannot silently regress the
    quota-blocked-review guarantee through missing availability cases.
