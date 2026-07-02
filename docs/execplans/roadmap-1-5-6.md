# Add Independent Roadmap Audit Review Evidence Gates

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / Big Picture

Roadmap task 1.5.6 hardens how completed roadmap tasks are reviewed. Today the
benchmark, review, and audit steps of the roadmap workflow can trust a task
agent's self-reported "`make all` passed" claim, and they can silently fall
back from the intended independent `scrutineer` dual-review path to another
reviewer without recording that the substitution happened. The ExecPlans for
tasks 2.1.5, 2.1.10, and 1.5.5 all record exactly this friction: the
`scrutineer` sub-agent that re-runs `make all`, `make markdownlint`, and
`make nixie` was quota-blocked, so gates were re-run locally or through
`coderabbit`, and the deviation survived only as prose.

After this work, the repository owns an **independent review-evidence gate** —
a reviewer-run command, `make review-evidence`, backed by
`tests/build-gate/review-evidence-cli.ts`. A reviewer (human or a review
sub-agent) runs it in the task worktree to produce structured evidence that:

1. the repository gates were re-executed here, with command execution enabled,
   rather than accepting the task agent's self-reported output;
2. when command execution is unavailable (a sandboxed reviewer that cannot
   spawn `make`), the gate reports an explicit `degraded` status and a non-zero,
   non-`failed` exit code, never a silent pass; and
3. the dual-review path is selected and named explicitly — primary
   `scrutineer`, explicit fallback `coderabbit`, and a terminal degraded
   `local-self-run` when neither independent reviewer is available — so a
   quota-blocked `scrutineer` can never be silently substituted.

The gate re-runs the repository gates by spawning `make`. To avoid forking a
second subprocess contract (forbidden by roadmap task 1.5.5's own success
criterion, `docs/roadmap.md` line 281), the plan first **generalizes** the
existing git-only runner in `tests/build-gate/git-support.ts` into one shared
`createCommandRunner`, then reuses that single subprocess seam and its single
`CommandResult` output contract for the review-evidence CLI.

Success is observable when, from the task worktree, `make review-evidence`
prints an evidence report whose status is `verified` only when the required
gates truly ran to success here and an independent dual-review path was
selected; prints `failed` (exit 1) when a re-run gate fails; prints `degraded`
(exit 3) when execution is unavailable or no independent reviewer remains; and
when `make all`, `make markdownlint`, and `make nixie` all pass for the change
itself. Implementation must not begin until this draft is reviewed and
approved.

## Constraints

- Work only in the git-donkey worktree:
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-6`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as canonical and the integration branch as `main`.
- Refresh from `origin/main` before code implementation. If the branch is
  behind, rebase onto `origin/main` unless a merge commit is explicitly chosen
  and recorded in `Decision Log`.
- The review-evidence gate is a reviewer-run target only. It must **not** be
  added to `make all`. `make all` already runs `build`, `check-fmt`,
  `whitespace-hygiene`, `lint`, `typecheck`, and `test`; adding a gate that
  itself spawns `make all` would recurse. This mirrors `make branch-freshness`,
  which is documented as outside `make all` because it does external work.
- Unit tests for the classifier and report must be pure and must not spawn
  `make`, `git`, or any heavy process. Only the CLI integration test may spawn,
  and only trivial injected commands (a guaranteed-present no-op and a
  guaranteed-absent binary); it must never run `make all`, so `make test` stays
  fast and non-recursive.
- Keep command execution behind the shared, injectable build-gate runner so
  tests inject fake command results, per AGENTS.md "Environment-dependent tests:
  Prefer dependency injection over direct mutation of process-wide state".
- Do **not** fork a second subprocess or output-capture contract. Roadmap task
  1.5.5's success criterion (`docs/roadmap.md` line 281) requires that "no gate
  carries a forked subprocess or tracked-file enumeration contract", and the
  developers' guide places all build-gate command execution and captured CLI
  output in `tests/build-gate/git-support.ts` (the "Build-gate Git command
  execution … live in `tests/build-gate/git-support.ts`" paragraph). This plan
  honours that rule by **generalizing** the existing git-only runner
  (`createGitRunner`) into one shared `createCommandRunner` in `git-support.ts`
  (work item 3) and then reusing it — the same `spawnSync` wrapper and the same
  `CommandResult` output contract — for the review-evidence CLI (work item 4).
  The review-evidence CLI must **not** define its own `spawnSync` wrapper or its
  own command-result type; `branch-freshness-git.ts` (a reviewer-run build-gate
  CLI) already reuses the git-support seam (`branch-freshness-git.ts` line 17),
  and review-evidence follows the same precedent.
- Every code file stays at or below 400 lines (AGENTS.md "Keep file size
  manageable").
- Use GrepAI as the primary intent-search tool with this shape:

  ```sh
  grepai search --workspace Projects --project odw-lint "<English intent query>" --toon --compact
  ```

  The GrepAI index reflects canonical `main` only. Verify every branch-local
  fact inside this worktree with `leta`, exact text search, or direct file
  inspection before acting.
- Use `leta` for branch-local TypeScript symbol navigation, references, and
  refactoring. Exact text search is acceptable for Markdown, the Makefile, and
  string literals that are not code symbols. If `leta` fails transiently, record
  the exact command and failure in `Surprises & Discoveries`, then continue with
  bounded file inspection.
- Use `sem` instead of raw Git history or blame when history navigation is
  needed. Ordinary `git status`, scoped diffs, and the Git commands used by the
  build-gate tests remain acceptable.
- Read and obey `AGENTS.md`, `docs/terms-of-reference.md`,
  `docs/technical-design.md`, `docs/adr/0001-static-analysis-boundary.md`,
  `docs/developers-guide.md`, `docs/repository-layout.md`,
  `docs/scripting-standards.md`,
  `docs/complexity-antipatterns-and-refactoring-strategies.md`,
  `docs/documentation-style-guide.md`, and `docs/roadmap.md` before
  implementation.
- Use en-GB Oxford spelling ("-ize" / "-yse" / "-our") in prose and comments.
  Preserve external API, command, and package names exactly (`make`,
  `scrutineer`, `coderabbit`, `spawnSync`, `nixie`).

## Tolerances (exception triggers)

- Scope: if implementation needs to touch more than 12 files or add more than
  700 net lines, stop and escalate.
- New dependency: no new runtime or dev dependency is expected. `spawnSync`
  (Node/Bun built-in) and `fast-check` (already present) cover the work. If a
  new dependency seems required, stop and escalate.
- File size: if `review-evidence.ts` or the CLI module approaches 400 lines,
  split path selection into `tests/build-gate/review-evidence-path.ts` and
  record the split in `Decision Log`; if a clean split is not obvious, escalate.
  `git-support.ts` is 255 lines; the generic-runner extraction (work item 3)
  adds roughly 35 lines and stays well under 400. If it approaches 400, extract
  the runner into `tests/build-gate/command-runner.ts` re-exported by
  `git-support.ts`, and record the split in `Decision Log`.
- Interface: if the classifier's result contract must change after work item 2
  begins consuming it, stop and reconcile all consumers in one commit rather
  than leaving a half-migrated contract.
- Iterations: if a focused test still fails for an unexpected reason after 3
  attempts, stop and record the failure in `Surprises & Discoveries` before
  continuing.
- Ambiguity: if review determines the deliverable should instead be a
  workflow-harness artefact outside this repository (for example a df12-build
  permission profile file), stop and escalate, because this repository cannot
  own or gate the external harness.

## Risks

- Risk: the reviewer misreads the task as requiring changes to the external
  df12-build workflow harness rather than a repository-owned gate.
  Severity: medium. Likelihood: medium.
  Mitigation: the roadmap wording permits "a roadmap review or audit workflow
  check, permission profile, **or equivalent gate**". Phase 1.5 has consistently
  delivered repository-owned `tests/build-gate/*.ts` gates wired through the
  Makefile (`file-size`, `branch-freshness`, `whitespace-hygiene`). This plan
  delivers the same repository-owned shape; the harness cannot be edited from
  here.
- Risk: the review-evidence gate accidentally lands inside `make all` and
  recurses or slows the commit gate.
  Severity: high. Likelihood: low.
  Mitigation: work item 5 adds a `makefile.test.ts` dry-run assertion that
  `make all` does **not** schedule the review-evidence script, alongside the
  positive wiring assertion.
- Risk: unit tests spawn `make all` and make `make test` slow or recursive.
  Severity: high. Likelihood: low.
  Mitigation: the classifier and report are pure; the CLI test injects a fake
  runner factory for the state matrix and only spawns trivial `true`/absent-binary
  commands via an overridable gate-command list. This is a hard Constraint.
- Risk: a supervisor treats a `degraded` result as a pass.
  Severity: high. Likelihood: medium.
  Mitigation: `degraded` maps to a distinct non-zero exit code (3), separate
  from `verified` (0) and `failed` (1), and the report names each degraded
  reason on its own line. Exit codes are pinned by CLI tests.
- Risk: generalizing `git-support.ts`'s runner breaks existing importers
  (`branch-freshness-git.ts`, `file-size-support.ts`,
  `git-support-fixtures.test.ts`) or the `git-support.test.ts` contract asserts.
  Severity: high. Likelihood: low.
  Mitigation: work item 3 keeps `GitCommandResult` and `GitRunner` as aliases of
  the new `CommandResult` and `CommandRunner` (identical shapes), preserves
  `createGitRunner`'s signature, defaults, and `GIT_TERMINAL_PROMPT` env exactly,
  and reruns the existing `git-support.test.ts` contract and spawn tests
  unchanged. `make all` (typecheck + test) gates the refactor before the CLI
  consumes the new seam.
- Risk: `spawnSync` behaviour for a missing binary differs from assumption.
  Severity: medium. Likelihood: low.
  Mitigation: existing `tests/build-gate/git-support.ts` already relies on
  `spawnSync` surfacing a missing executable as `result.error` (see
  `createGitRunner` and `runFixtureGit`), and `git-support.test.ts` already pins
  the empty-`PATH` spawn-failure case. The generalized `createCommandRunner`
  inherits this behaviour, and the CLI test pins spawn-failure →
  `unavailable` → `degraded` against a guaranteed-absent binary.

## Progress

- [x] Work item 0: Refresh `origin/main` and confirm branch-local evidence
  (completed: 2026-07-02; remaining: none). `git fetch origin
  main:refs/remotes/origin/main` succeeded, `git rebase origin/main` advanced
  the branch, and `git merge-base --is-ancestor origin/main HEAD` then returned
  `behind=0`. Branch-local evidence was recomputed with GrepAI, Leta, exact
  text search, and `sem --version`. `make all` and `make markdownlint` passed;
  `make nixie` first hit a transient `BlockingIOError` after reporting all
  diagrams valid, then passed on rerun. `coderabbit review --agent` completed
  with zero findings.
- [x] Work item 1: Add the review-evidence classifier and result contract
  (completed: 2026-07-02; remaining: none). The red test pass failed because
  `tests/build-gate/review-evidence.ts` did not exist. The green slice added
  `tests/build-gate/review-evidence.ts`,
  `tests/build-gate/review-evidence.test.ts`, and
  `tests/build-gate/review-evidence.property.test.ts`. Focused tests passed
  with 23 tests, 9 snapshots, and 390 assertions. `make all` passed locally.
  `scrutineer` remained quota-blocked, so CodeRabbit was run locally after the
  deterministic gate; the final Work item 1 CodeRabbit pass completed with zero
  findings.
- [x] Work item 2: Add the reviewer-facing review-evidence report formatter
  (completed: 2026-07-02; remaining: none). The red test pass failed because
  `tests/build-gate/review-evidence-report.ts` did not exist. The green slice
  added `formatReviewEvidenceResult`, stable one-fact-per-line output, inline
  snapshots, semantic assertions, and a runtime defensive-branch test for
  malformed data that bypasses TypeScript. Focused formatter tests passed with
  11 tests, 7 snapshots, and 27 assertions. `make all` passed with 527 tests,
  52 snapshots, and 25111 assertions. `coderabbit review --agent` was run after
  deterministic gates; final review completed with zero findings.
- [x] Work item 3: Generalize the shared build-gate command runner in
  `git-support.ts` (completed: 2026-07-02; remaining: none). The red test pass
  failed because `createCommandRunner`, `CommandResult`, `CommandRunner`, and
  `CommandRunnerOptions` did not exist. The green slice added the generic
  runner contract, kept `GitCommandResult`/`GitRunner` as compatibility aliases,
  refactored `createGitRunner` onto `createCommandRunner("git", ...)`, and
  preserved the Git runner's prompt, timeout, output-buffer, and spawn-failure
  behaviour. Focused `git-support` tests passed with 14 tests, 4 snapshots, and
  30 assertions. `make all` passed with 529 tests, 52 snapshots, and 25117
  assertions. `coderabbit review --agent` completed with zero findings.
- [x] Work item 4: Add the CLI entry that reuses the shared runner, with real
  execution, degraded/spawn-failure handling, and pinned exit codes
  (completed: 2026-07-02; remaining: none). The red test pass failed because
  `tests/build-gate/review-evidence-cli.ts` did not exist. The green slice
  added the CLI, a keyed `GateCommand` contract, shared
  `createCommandRunner` reuse, injected runner coverage, real trivial-command
  coverage, and exit-code mapping. Focused CLI tests passed with 12 tests, 4
  snapshots, and 46 assertions. `make all` passed with 541 tests, 56 snapshots,
  and 25163 assertions. `coderabbit review --agent` was run after deterministic
  gates; final review completed with zero findings.
- [x] Work item 5: Wire the `make review-evidence` target, prove it is outside
  `make all`, and document the gate (and the generalized seam) in the
  developers' guide (completed: 2026-07-02; remaining: none). The red test pass
  failed because `make --dry-run review-evidence` returned status 2 before the
  target existed. The green slice added the Makefile target, a dry-run wiring
  assertion, a dry-run assertion that `make all` does not schedule the target,
  and developer documentation for the shared command-runner seam, exit codes,
  degraded `--no-exec` evidence, and reviewer fallback order. Focused Makefile
  tests passed with 11 tests and 27 assertions. `make all` passed with 543
  tests, 56 snapshots, and 25168 assertions; `make markdownlint` and
  `make nixie` passed. `coderabbit review --agent` completed with zero findings.
- [x] Work item 6: Close out — tick roadmap task 1.5.6 and finalize this
  ExecPlan's living sections (completed: 2026-07-02; remaining: none).
  `docs/roadmap.md` now marks task 1.5.6 complete. The close-out evidence
  includes `make review-evidence` verified output, `--no-exec` degraded output
  with exit 3, `make all`, `make markdownlint`, and `make nixie`. Final
  CodeRabbit review completed with zero findings.

## Surprises & Discoveries

- Observation (implementation, work item 0): the branch was one commit behind
  `origin/main` at handoff, while the ExecPlan existed only as an untracked
  branch-local Markdown file. Evidence: after `git fetch origin
  main:refs/remotes/origin/main`, `git merge-base --is-ancestor origin/main
  HEAD` returned `behind=1`; `git rebase origin/main` completed successfully;
  the same check then returned `behind=0`. Impact: implementation now proceeds
  from current `origin/main`, and the ExecPlan is staged as the first
  branch-local artefact.
- Observation (implementation, work item 0): GrepAI and Leta were available for
  the required evidence pass. Evidence: `grepai version` reported `0.35.0`,
  `grepai workspace status Projects` listed `odw-lint`, `grepai search
  --workspace 'Projects' --project 'odw-lint' "roadmap audit review evidence
  gates independent audit implementation" --toon --compact --limit 8` returned
  current roadmap and audit-plan matches, `leta workspace add
  /data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-6` succeeded, and
  `leta grep` found the expected build-gate symbols in this worktree. Impact:
  GrepAI remained the main-branch intent-search input, while branch-local code
  facts were verified directly inside the worktree.
- Observation (implementation, work item 0): `sem` is installed for semantic
  history navigation. Evidence: `sem --version` reported `sem 0.3.9`. Impact:
  no history question was needed before work item 1, but the required tool is
  available for later runner-contract checks.
- Observation (implementation, work item 0): the requested `scrutineer`
  deterministic-gate delegation was unavailable because the sub-agent's fixed
  model quota was exhausted. Evidence: spawning `scrutineer` returned "You've
  hit your usage limit for GPT-5.3-Codex-Spark. Switch to another model now, or
  try again at Jul 7th, 2026 11:20 AM." Impact: work item 0 used explicit
  degraded evidence: the task agent ran `make all`, `make markdownlint`, and
  `make nixie` locally, then ran `coderabbit review --agent` locally after the
  deterministic gates were green. The review completed with zero findings.
- Observation (implementation, work item 0): `make nixie` had one transient
  output-write failure after successful validation, not a diagram failure.
  Evidence: the first `make nixie` run printed "All diagrams validated
  successfully!" and then raised `BlockingIOError: [Errno 11] write could not
  complete without blocking`; rerunning `make nixie` exited 0. Impact: no
  Markdown content change was needed.
- Observation (implementation, work item 1): `scrutineer` was still
  quota-blocked when the Work item 1 deterministic gate was due. Evidence:
  spawning the `scrutineer` sub-agent again returned "You've hit your usage
  limit for GPT-5.3-Codex-Spark. Switch to another model now, or try again at
  Jul 7th, 2026 11:20 AM." Impact: Work item 1 used the recorded degraded
  fallback path: run deterministic gates locally first, then run
  `coderabbit review --agent` locally.
- Observation (implementation, work item 1): CodeRabbit found several edge
  cases that became part of the classifier contract before the item closed.
  Evidence: review passes requested scoping unavailable and failed gate evidence
  to `requiredGates`, rejecting duplicate per-gate execution evidence as a
  `usage-error`, broadening path-availability generators, proving both positive
  and negative property outcomes, snapshotting review-path reasons, and naming
  `local-self-run` availability in the degraded selection reason. Impact: the
  implementation now rejects contradictory caller evidence and ignores
  non-required gate failures or unavailability.
- Observation (implementation, work item 1): the first combined classifier test
  file exceeded the 400-line file-size policy after CodeRabbit-driven coverage
  was added. Evidence: `wc -l` reported
  `tests/build-gate/review-evidence.test.ts` at 442 lines. Impact: property and
  exhaustiveness tests were split into
  `tests/build-gate/review-evidence.property.test.ts`; the resulting files are
  295 and 183 lines respectively.
- Observation (implementation, work item 1): one CodeRabbit retry was
  rate-limited. Evidence: `coderabbit review --agent` returned
  `errorType: "rate_limit"` and a recoverable wait-time message. Impact: the
  workflow followed the task instruction and ran `vsleep 59m` before retrying.
- Observation (implementation, work item 2): `scrutineer` remained unavailable
  for delegated deterministic gates and review. Evidence: both configured
  sub-agent ids returned "You've hit your usage limit for
  GPT-5.3-Codex-Spark. Switch to another model now, or try again at Jul 7th,
  2026 11:20 AM." Impact: Work item 2 used the recorded degraded fallback path:
  local deterministic gates first, then local `coderabbit review --agent`.
- Observation (implementation, work item 2): CodeRabbit converted formatter
  edge cases into explicit report contracts. Evidence: review passes requested
  normalizing caller-owned free text, covering unavailable gate lines, narrowing
  impossible review-path flag combinations, deriving the path label from
  `isFallback`/`isDegraded`, throwing from the `assertNever` default branch, and
  adding a runtime malformed-result test. Impact: the report now preserves one
  fact per line, rejects impossible path states at compile time, and keeps the
  defensive default branch observable in tests.
- Observation (implementation, work item 2): one CodeRabbit retry was
  rate-limited. Evidence: `coderabbit review --agent` returned
  `errorType: "rate_limit"` and a recoverable wait-time message. Impact: the
  workflow followed the task instruction and ran `vsleep 64m` before retrying.
- Observation (implementation, work item 3): `scrutineer` was still
  quota-blocked for the delegated deterministic gate. Evidence: spawning a
  fresh `scrutineer` sub-agent returned "You've hit your usage limit for
  GPT-5.3-Codex-Spark. Switch to another model now, or try again at Jul 7th,
  2026 11:20 AM." Impact: Work item 3 used the recorded degraded fallback path:
  local `make all`, followed by local `coderabbit review --agent`.
- Observation (implementation, work item 3): the generic runner extraction
  initially passed focused tests but failed the repository format gate. Evidence:
  `make all` reported a Biome import-order fix for
  `tests/build-gate/git-support.test.ts` after focused tests passed. Impact: the
  import order was fixed before rerunning the full deterministic gate.
- Observation (implementation, work item 4): `scrutineer` remained
  quota-blocked for delegated deterministic gates and review. Evidence:
  spawning the `scrutineer` sub-agent returned "You've hit your usage limit for
  GPT-5.3-Codex-Spark. Switch to another model now, or try again at Jul 7th,
  2026 11:20 AM." Impact: Work item 4 used the recorded degraded fallback path:
  local deterministic gates first, then local `coderabbit review --agent`.
- Observation (implementation, work item 4): CodeRabbit hardened the CLI
  boundary before the work item closed. Evidence: review passes requested
  bounded default runner options, snapshots for verified/failed/degraded and
  usage-error report output, compile-time coverage that exit-code mapping is
  updated when the result union changes, and using `process.exitCode` in the
  main guard so output can flush naturally. Impact: the CLI now has stable
  output contracts for each process status, bounded child-process execution, and
  a safer executable entrypoint.
- Observation (implementation, work item 5): `scrutineer` remained
  quota-blocked for delegated deterministic gates and review. Evidence:
  spawning the `scrutineer` sub-agent returned the same
  GPT-5.3-Codex-Spark usage-limit message with a reset at Jul 7th, 2026 11:20
  AM. Impact: Work item 5 used local deterministic gates first, then local
  `coderabbit review --agent`; the final CodeRabbit review completed with zero
  findings.
- Observation (implementation, work item 6): the delivered gate itself produced
  both degraded and verified evidence at close-out. Evidence:
  `bun run tests/build-gate/review-evidence-cli.ts --no-exec` printed
  `Review evidence: degraded` and exited 3, while `make review-evidence`
  printed `Review evidence: verified` with all three required gates passed and
  the primary `scrutineer` path named. Impact: the observable contract in the
  roadmap task is exercised from the repository target, and degraded evidence is
  distinguishable from a gate failure or success.
- Observation: the planning agent's Bash sandbox allowed only the root worktree
  (`/data/leynos/Projects/odw-lint`), so early direct reads of the assigned
  worktree were blocked until the session entered the worktree explicitly.
  Evidence: "Claude Code may only … the allowed working directories for this
  session: '/data/leynos/Projects/odw-lint'". Impact: planning research used the
  shared `main`-based docs and sources in the root worktree (identical at this
  base commit) and was then re-confirmed inside the worktree
  (`git branch --show-current` reported `roadmap-1-5-6`; `tests/build-gate`
  listing and the `docs/roadmap.md` task line matched). The implementing agent
  must still re-verify every branch-local fact directly, per the Constraints.
- Observation (round 3): the round-2 CLI contract defined its own
  `CommandRunner`/`CommandResult` and a `spawnSync`-wrapping default runner in
  `review-evidence-cli.ts`, described as "reusing the shape" of
  `git-support.ts:createGitRunner`. That is a *copied* second subprocess
  contract, not reuse, and `git-support.ts` exposes only a git-specific runner
  (`createGitRunner` hardcodes `spawnSync("git", …)`, line 60) with no generic
  command runner. Evidence: `git-support.ts` lines 11-77; `grep` across
  `tests/build-gate/*.ts` shows the only `spawnSync` call sites are
  `git-support.ts` line 60 and `makefile.test.ts` line 60 (dry-run wiring), with
  no generic runner. `branch-freshness-git.ts` line 17 imports the git-support
  runner, proving a build-gate CLI already reuses that seam. Impact: work item 3
  now generalizes the seam and work item 4 reuses it, so no second contract is
  forked; see `Decision Log`.
- Observation (round 3): the planning session's Bash sandbox denied approval for
  commands run against the worktree path, so the Markdown formatter
  (`mdtablefix`, `markdownlint-cli2 --fix`) and the `make markdownlint` /
  `make nixie` gates could not be executed against this ExecPlan during
  planning. Evidence: `markdownlint-cli2 --fix docs/execplans/roadmap-1-5-6.md`
  returned "This command requires approval". Impact: the document was authored to
  the surrounding execplans' wrapping discipline; the implementing agent must run
  `mdtablefix docs/execplans/roadmap-1-5-6.md`, `markdownlint-cli2 --fix
  docs/execplans/roadmap-1-5-6.md`, then `make markdownlint` and `make nixie`
  before committing any change that touches this file.

## Decision Log

- Decision (implementation, work item 0): continue with local deterministic
  gates and local CodeRabbit review when `scrutineer` is quota-blocked, and
  record that as degraded evidence rather than silently treating it as the
  intended independent path.
  Rationale: the required `scrutineer` role cannot run in this environment
  until the reported quota reset, but the repository gates and CodeRabbit
  command are available locally. Recording the deviation preserves the audit
  trail while keeping the roadmap task executable. Date/Author: 2026-07-02,
  implementation agent.
- Decision (implementation, work item 1): classify duplicate execution
  evidence for the same gate as `usage-error`, even if one duplicate is a pass.
  Rationale: a reviewer-run gate must not choose between contradictory facts for
  the same required gate. Rejecting the input keeps the CLI and any future
  callers honest. Date/Author: 2026-07-02, implementation agent.
- Decision (implementation, work item 1): scope failed and unavailable gate
  evidence to `requiredGates` during classification.
  Rationale: the CLI may later report focused evidence for a subset of gates,
  and non-required extra facts must not make a focused evidence run fail or
  degrade spuriously. Date/Author: 2026-07-02, implementation agent.
- Decision (implementation, work item 1): keep the classifier as the pure
  decision core and split property/exhaustiveness coverage into a second test
  file.
  Rationale: CodeRabbit-requested edge coverage was useful, but the repository
  file-size policy still applies. Splitting tests preserves coverage without
  forcing an oversized file. Date/Author: 2026-07-02, implementation agent.
- Decision (implementation, work item 2): narrow `ReviewPathSelection` to the
  three legal path variants instead of leaving `isFallback` and `isDegraded` as
  broad booleans.
  Rationale: the report formatter and later CLI should not be able to express a
  degraded primary `scrutineer` path or a non-degraded `local-self-run` path.
  Encoding only legal states makes silent substitution and contradictory
  reviewer labels harder to introduce. Date/Author: 2026-07-02, implementation
  agent.
- Decision (implementation, work item 2): normalize caller-owned report fields
  at the formatter boundary.
  Rationale: gate details, degraded reasons, and path-selection reasons can be
  sourced from subprocess output or reviewer context. Collapsing whitespace
  keeps the reviewer-facing report greppable and preserves one fact per line
  without changing the classifier's pure data contract. Date/Author:
  2026-07-02, implementation agent.
- Decision (implementation, work item 3): keep `GitCommandResult` and
  `GitRunner` as direct aliases of the new generic command contracts.
  Rationale: existing build-gate callers and tests depend on the Git names, but
  the shapes are intentionally identical. Aliasing keeps compatibility while
  making `createCommandRunner` the single subprocess wrapper that later gates
  can reuse. Date/Author: 2026-07-02, implementation agent.
- Decision (implementation, work item 4): derive both required gates and gate
  executions from one keyed `GateCommand` list in the CLI.
  Rationale: the CLI should not be able to claim one set of required gates while
  executing another. Using the keyed list as the single source means a
  single-entry test override produces one required gate and one matching
  execution, while the classifier's missing-required-gate guard remains a
  defensive contract for direct callers. Date/Author: 2026-07-02,
  implementation agent.
- Decision (implementation, work item 4): bound real gate command execution in
  the default CLI runner.
  Rationale: the reviewer-run target can spawn `make all`, `make markdownlint`,
  and `make nixie`; a hung or noisy child process must surface as degraded
  evidence rather than leaving the reviewer with an unbounded wait or buffer
  growth. Date/Author: 2026-07-02, implementation agent.
- Decision: deliver a repository-owned reviewer-run gate
  (`make review-evidence` backed by `tests/build-gate/review-evidence-cli.ts`),
  not an edit to the external df12-build workflow harness.
  Rationale: this repository cannot own or gate the external harness; the
  roadmap permits an "equivalent gate"; phase 1.5 precedent is exactly this
  shape. Date/Author: 2026-07-02, planning agent.
- Decision: keep the review-evidence gate outside `make all` (reviewer-run
  only), mirroring `make branch-freshness`.
  Rationale: the gate re-runs `make all`; including it in `make all` would
  recurse. Date/Author: 2026-07-02, planning agent.
- Decision: model the dual-review path as an ordered discriminated union
  `scrutineer` → `coderabbit` → `local-self-run`, with an explicit
  `isFallback`/`isDegraded` record.
  Rationale: the ExecPlan history (2.1.5, 2.1.10, 1.5.5) shows exactly this
  primary/fallback/local sequence; encoding it makes silent substitution
  impossible. Date/Author: 2026-07-02, planning agent.
- Decision: exit-code contract `verified=0`, `failed=1`, `usage-error=2`,
  `degraded=3`.
  Rationale: `degraded` must be non-zero and distinguishable from a genuine gate
  failure so a supervisor cannot conflate the two; `2` is reserved for
  usage errors to match `branch-freshness-git.ts`. Date/Author: 2026-07-02,
  planning agent.
- Decision: document the gate in `docs/developers-guide.md` and do not add a new
  ADR.
  Rationale: phase 1.5 gates (`file-size`, `branch-freshness`,
  `whitespace-hygiene`) are documented in the developers' guide, not ADRs; ADR
  0001 covers the static-analysis boundary, which this does not change. If
  review requires an ADR, escalate. Date/Author: 2026-07-02, planning agent.
- Decision (round 3): satisfy the "no forked subprocess contract" rule by
  generalizing `git-support.ts`'s git-only runner into one shared
  `createCommandRunner` (generic `CommandResult`/`CommandRunner`), reused by both
  the git specialization (`createGitRunner`) and the review-evidence CLI, rather
  than defining a distinct `CommandRunner`/`CommandResult` inside the CLI.
  Rationale: the round-2 plan's CLI defined a second `spawnSync` wrapper and a
  second command-result type, which the round-3 design review correctly flagged
  as violating both the plan's own hard Constraint and roadmap task 1.5.5's
  success criterion (`docs/roadmap.md` line 281: "no gate carries a forked
  subprocess … contract"). The reviewer offered two resolutions: (a) generalize
  the git-support seam into one shared runner reused by both gates, or (b)
  reword the constraint and add a Decision Log entry justifying a distinct
  `CommandRunner`. Option (b) is rejected: it would leave the delivered gate in
  violation of roadmap 1.5.5's still-open success criterion, and the developers'
  guide already places build-gate command execution in `git-support.ts`. Option
  (a) is chosen: `branch-freshness-git.ts` (a reviewer-run build-gate CLI)
  already imports the git-support runner (`branch-freshness-git.ts` line 17), so
  reusing the shared seam from another gate CLI is established precedent, and
  generalizing keeps exactly one subprocess wrapper and one output contract.
  Date/Author: 2026-07-02, planning agent (round 3).

## Outcomes & Retrospective

Delivered roadmap task 1.5.6 as a repository-owned reviewer-run gate:
`make review-evidence` invokes `tests/build-gate/review-evidence-cli.ts`,
re-runs `make all`, `make markdownlint`, and `make nixie` through the shared
build-gate command runner, and reports the selected dual-review path. It stays
outside `make all`; `tests/build-gate/makefile.test.ts` pins both the positive
target wiring and the non-recursive `make all` exclusion.

The gate meets the roadmap success criterion. Reviewers no longer have to rely
solely on a task agent's self-reported gate output, because the target re-runs
the required gates in the task worktree and prints structured evidence. Silent
reviewer substitution is also blocked: the classifier and report name primary
`scrutineer`, fallback `coderabbit`, or degraded `local-self-run`, and the CLI
exits 3 when command execution or independent review evidence is degraded.

Final evidence:

- `make review-evidence` printed `Review evidence: verified`, listed
  `make all`, `make markdownlint`, and `make nixie` as passed, and named
  `scrutineer (primary; scrutineer available)`.
- `bun run tests/build-gate/review-evidence-cli.ts --no-exec` printed
  `Review evidence: degraded`, named command execution unavailable, and exited
  3.
- `make all` passed with 543 tests, 56 snapshots, and 25168 assertions after
  Work item 5, and final `make all` passed at HEAD after close-out.
- `make markdownlint` and `make nixie` passed after Markdown close-out edits.
- `coderabbit review --agent` was run after deterministic gates for each
  implementation work item; final close-out review completed with zero
  findings.

The requested `scrutineer` sub-agent could not execute in this environment
because its fixed GPT-5.3-Codex-Spark quota was exhausted until Jul 7th, 2026
11:20 AM. Each work item therefore used the explicit degraded operating path:
local deterministic gates first, then local `coderabbit review --agent`.

## Context and Orientation

`odw-lint` is a Bun and TypeScript project that statically lints Open Dynamic
Workflows (ODW) workflow files. Phase 1.5 of the roadmap, "Harden
roadmap-workflow review gates" (`docs/roadmap.md` lines 218-291), adds
executable guards to the repository gate so review no longer depends on manual
post-commit audits.

The build gates live under `tests/build-gate/`. Each gate is a small Bun CLI
script that can be run directly (for example `bun run
tests/build-gate/branch-freshness-git.ts`) and is also exercised by unit tests.
The gates share one Git and process seam:

- `tests/build-gate/git-support.ts` — the shared, build-gate seam for Git
  command execution (`createGitRunner`, `runGit`), tracked-file listing
  (`lsTrackedFiles`, `parseNulSeparatedPaths`), temporary repositories
  (`createTemporaryRepository`, `writeRepositoryFile`, `commitAll`,
  `runFixtureGit`), and captured CLI output (`createCapturedCliOutput`). The
  runner uses Node/Bun `spawnSync` (line 60, hardcoding the `git` executable); a
  missing executable surfaces as `result.error` and a non-zero status as
  `result.status`. Consolidated by task 1.5.5. Work item 3 of this plan
  generalizes `createGitRunner`'s `spawnSync` body into a shared
  `createCommandRunner` (generic `CommandResult`/`CommandRunner`) in this same
  file, keeping `createGitRunner` as a thin git specialization, so the
  review-evidence CLI reuses one subprocess seam rather than forking a second.
  `branch-freshness-git.ts` (line 17) already imports this seam, so reuse by
  another build-gate CLI is precedent, not new coupling.
- `tests/build-gate/branch-freshness.ts` — the pure classifier for
  branch-freshness, exposing a discriminated-union result
  (`BranchFreshnessResult` with `fresh` / `skipped` / `stale` / `usage-error`)
  and `classifyBranchFreshness`. This is the pattern to mirror: pure classifier
  separate from the Git/IO runner.
- `tests/build-gate/branch-freshness-report.ts` — `formatBranchFreshnessResult`,
  the reviewer-facing text formatter, a `switch` over the result union.
- `tests/build-gate/branch-freshness-git.ts` — the CLI/runner
  (`runBranchFreshnessCli`) that wires the Git runner, maps result → exit code
  (`0` fresh/skipped, `1` stale, `2` usage-error), and runs as `main` when
  invoked directly (`if (process.argv[1] === fileURLToPath(import.meta.url))`).
  It imports `createGitRunner`, `GitCommandResult`, `GitRunner`, and `runGit`
  from `git-support.ts` (line 17) — the reuse precedent for review-evidence.
- `tests/build-gate/whitespace-hygiene.ts` — a compact CLI gate
  (`runWhitespaceHygieneCli`) showing the writers pattern
  (`writeOut`/`writeErr`) and exit codes `0`/`1`/`2`.
- `tests/build-gate/makefile.test.ts` — dry-run wiring tests that assert each
  Make target invokes the expected `bun run …` command and that `make all`
  schedules gates in the right order. New targets are proven here.

The Makefile (`Makefile`) declares each gate target. `make all` is `build
check-fmt whitespace-hygiene lint typecheck test`. `make branch-freshness` is a
standalone target, documented in `docs/developers-guide.md` (Commit Gate
section) as deliberately outside `make all` because it performs a network
fetch. The review-evidence target follows that same "outside `make all`,
reviewer-run" convention.

The terms of art in the roadmap task come from the roadmap workflow's review
step, evidenced in prior ExecPlans:

- **scrutineer** — an independent review sub-agent that re-runs the
  deterministic gates (`make all`, `make markdownlint`, `make nixie`) and
  reports their results, so review does not trust the task agent's self-report
  (see `docs/execplans/roadmap-2-1-10.md` lines 201, 233-246;
  `docs/execplans/roadmap-2-1-5.md` lines 147-201).
- **dual-review path** — the intended independent second reviewer. When
  `scrutineer` is quota-blocked (its fixed Codex Spark quota is exhausted), the
  documented fallback is `coderabbit review --agent`; when that too is
  unavailable, the agent re-runs gates locally and records degraded,
  single-reviewer evidence (see `docs/execplans/roadmap-2-1-5.md` lines
  197-227; `docs/execplans/roadmap-1-5-5.md` lines 252-256).
- **degraded-mode evidence** — evidence explicitly stating that a gate or
  reviewer could not run here, rather than a silent pass or a silent
  substitution.

This ExecPlan turns those ad-hoc, prose-only behaviours into a deterministic,
tested repository gate.

## Plan of work

The work follows Red-Green-Refactor. Each work item is independently
committable and passes `make all` on its own. Work items 1-2 build the pure
classifier and formatter; work item 3 generalizes the existing subprocess seam
without changing its behaviour; work item 4 wires the CLI, so the only new
`spawnSync` call site is added last and is never exercised by pure unit tests.

### Stage A — Work item 0: refresh and confirm evidence (no code changes)

Docs to read: `AGENTS.md` (Tooling Defaults, Change Quality & Committing);
`docs/developers-guide.md` (Commit Gate); `docs/roadmap.md` §1.5.
Skills to load: `execplans` (this skill), `leta`, `sem`, `grepai`.

Refresh `origin/main` and confirm the branch is not behind. Recompute the
branch-local file evidence this plan depends on (the build-gate file list, the
`git-support.ts` runner shape, the Makefile target list, and the developers'
guide Commit Gate section) directly in the worktree; the GrepAI index reflects
`main` only. Record any drift from this plan's Context in
`Surprises & Discoveries` before writing code. No tests change in this work
item; it is a go/no-go checkpoint.

### Stage B/C/D — Work item 1: review-evidence classifier and result contract

Implements the decision core for the roadmap task
(`docs/roadmap.md` lines 282-291). Follows AGENTS.md "Error Handling"
(discriminated unions for recoverable conditions), "Runtime Validation & Types"
(narrow domain types), and "Testing" (table-driven for finite case sets,
`fast-check` for behaviour over a range of inputs).

Docs to read: `AGENTS.md` (TypeScript Guidance — Error Handling, Runtime
Validation & Types, Testing);
`docs/complexity-antipatterns-and-refactoring-strategies.md` (keep
`switch`/branching flat, extract predicates).
Skills to load: `leta` (symbol navigation and references). No Python
verification skill (`hypothesis`, `crosshair`, `mutmut`) applies because this is
TypeScript — `fast-check` is the property-test tool per AGENTS.md; the Rust
router skills do not apply either.

Add `tests/build-gate/review-evidence.ts` defining:

- `ReviewGateId` (`"make all" | "make markdownlint" | "make nixie"`).
- `GateExecution` — a discriminated union per gate: `passed` (exit 0),
  `failed` (non-zero exit + `detail`), `unavailable` (could not execute +
  `detail`).
- `ReviewPath` (`"scrutineer" | "coderabbit" | "local-self-run"`) and
  `ReviewPathAvailability` (`"available" | "quota-blocked" | "unavailable"`).
- `ReviewPathSelection` — `{ selected, reason, isFallback, isDegraded }`.
- `ReviewEvidenceResult` — union of `verified`, `failed` (with `failedGates`),
  `degraded` (with `reasons`), and `usage-error` (with `message`).
- `ClassifyReviewEvidenceInput` — `{ executionEnabled, executions,
  requiredGates, pathAvailability }`.
- `classifyReviewEvidence(input): ReviewEvidenceResult` and a small
  `selectReviewPath(pathAvailability): ReviewPathSelection` helper.

Classification rules (pure, deterministic):

1. `usage-error` if `requiredGates` is empty, or if `executionEnabled` is true
   but `executions` is missing a required gate. This is a pure defensive guard:
   the CLI (work item 4) derives both `requiredGates` and every
   `GateExecution.gate` from the one keyed `gateCommands` list, so the CLI can
   never produce this contradiction; the classifier still checks it so a direct
   caller with a hand-built input is rejected rather than silently
   misclassified.
2. Otherwise select the review path first: `scrutineer` if available (primary,
   not fallback, not degraded); else `coderabbit` if available (fallback, not
   degraded, reason names the `scrutineer` state); else `local-self-run`
   (fallback and degraded, reason names both unavailable reviewers).
3. `degraded` if `executionEnabled` is false (reason: command execution
   unavailable, gates not independently executed), or if any required gate is
   `unavailable` (reasons list those gates), or if the selected path is
   `local-self-run` (reason: no independent dual-review path).
4. `failed` if all required gates executed and at least one is `failed`
   (`failedGates` lists them).
5. `verified` only if all required gates are `passed` and a dual-review path
   (`scrutineer` or `coderabbit`) was selected.

Precedence when several conditions hold: `usage-error` first, then `degraded`
(missing execution or missing reviewer is a trust gap that outranks a mere gate
failure signal), then `failed`, then `verified`. Pin this precedence with tests
so a change is deliberate.

Red: write `tests/build-gate/review-evidence.test.ts` first. It fails to import
`./review-evidence` (module absent). Then add table-driven cases across the
matrix: `executionEnabled` (true/false) × gate outcomes (all passed / one
failed / one unavailable) × `scrutineer` availability (available /
quota-blocked / unavailable) × `coderabbit` availability. Add two explicit
rule-1 cases directly against the classifier (the CLI cannot generate them):
empty `requiredGates` → `usage-error`, and `executionEnabled: true` with an
`executions` list missing one required gate → `usage-error`. Add `fast-check`
property tests asserting the load-bearing invariants: (a) a `degraded` or
`failed` classification is never simultaneously `verified`; (b) a
`quota-blocked` or `unavailable` `scrutineer` is never selected as a
non-fallback primary; (c) whenever `executionEnabled` is false the status is
`degraded` regardless of other inputs. Green: implement the classifier. Refactor
for flat branching and named predicates; keep the file under 400 lines.

Validation: `make all`.

### Work item 2: reviewer-facing report formatter

Implements the "reports explicit … evidence" surface of the task
(`docs/roadmap.md` lines 284-291) and AGENTS.md "Observability" (structured
diagnostics with stable fields).

Docs to read: `AGENTS.md` (Observability; Testing — snapshot scope);
`docs/documentation-style-guide.md` for reviewer-facing prose wording.
Skills to load: `leta`.

Add `tests/build-gate/review-evidence-report.ts` exporting
`formatReviewEvidenceResult(result: ReviewEvidenceResult): string`, a `switch`
over the union (with a `never` guard). The report must emit stable, greppable
fields, one fact per line, for example:

```text
Review evidence: verified
- gate make all: passed
- gate make markdownlint: passed
- gate make nixie: passed
- dual-review path: scrutineer (primary)
```

Degraded and failed reports list each degraded reason or failed gate on its own
line, and always name the selected dual-review path and whether it was a
fallback, so a silent substitution is impossible.

Red: write `tests/build-gate/review-evidence-report.test.ts` first with inline
snapshots (`toMatchInlineSnapshot`) for `verified`, `failed`, `degraded`
(execution-unavailable), `degraded` (fallback-to-coderabbit and
local-self-run), and `usage-error`. It fails because the formatter is absent.
Pair each snapshot with a semantic assertion (for example, the `degraded` output
`.includes("dual-review path: coderabbit (fallback")`) per AGENTS.md snapshot
rules. Green: implement the formatter. Refactor to share line-building helpers.

Validation: `make all`.

### Work item 3: generalize the shared build-gate command runner

Implements the "no forked subprocess contract" rule (`docs/roadmap.md` line 281)
that governs how work item 4 spawns `make`. Follows AGENTS.md "Error Handling"
(one project-owned command boundary) and the DI testing rule; keeps the shared
seam that the developers' guide documents as living in `git-support.ts`.

Docs to read: `docs/developers-guide.md` (the "Build-gate Git command execution
… live in `tests/build-gate/git-support.ts`" paragraph); `AGENTS.md` (Error
Handling; Testing — DI; file-size);
`docs/complexity-antipatterns-and-refactoring-strategies.md`.
Skills to load: `leta` (to enumerate every importer of `createGitRunner`,
`GitRunner`, and `GitCommandResult` before refactoring), `sem` (to confirm the
`git-support.ts` `spawnSync` contract).

Generalize `tests/build-gate/git-support.ts` so it owns one shared subprocess
runner:

- Add `CommandResult` (the existing `GitCommandResult` shape: `status`,
  `signal`, `stdout`, `stderr`, optional `error`) and re-express
  `GitCommandResult` as `type GitCommandResult = CommandResult` so existing
  importers and the `git-support.test.ts` contract asserts are unchanged.
- Add `CommandRunner` (`{ readonly run: (args: readonly string[]) =>
  CommandResult }`) and re-express `GitRunner` as `type GitRunner =
  CommandRunner` (identical structural shape, so
  `branch-freshness-git.ts:GitRunner` usages still compile).
- Add `CommandRunnerOptions` (`{ cwd?, env?, timeoutMs?, maxBufferBytes? }`) and
  `createCommandRunner(command: string, options?: CommandRunnerOptions):
  CommandRunner` — the single `spawnSync` wrapper, factored out of the current
  `createGitRunner` body verbatim (same `encoding: "utf8"`, same result
  normalization, same optional-`error` spread).
- Reimplement `createGitRunner(repositoryPath, options)` as a thin
  specialization that calls `createCommandRunner("git", { cwd: repositoryPath,
  env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, timeoutMs: options.timeoutMs
  ?? gitCommandTimeoutMs, maxBufferBytes: options.maxBufferBytes ??
  gitCommandMaxBufferBytes })`. Its public signature, defaults, and env stay
  byte-for-byte equivalent.

Red: extend `tests/build-gate/git-support.test.ts` first with new asserts that
fail to import `createCommandRunner` / `CommandResult` / `CommandRunner`
(symbols absent): (a) a `CommandResult`/`CommandRunner` contract assert
mirroring the existing `GitCommandResult`/`GitRunner` ones; (b)
`createCommandRunner("true", {}).run([])` returns `status: 0` and no `error`
(guaranteed-present no-op); (c) `createCommandRunner` bound to a
guaranteed-absent binary surfaces `error !== undefined` (mirrors the existing
empty-`PATH` git spawn-failure test at `git-support.test.ts` lines 294-309).
The existing `createGitRunner`, `lsTrackedFiles`, and fixture tests must stay
unchanged and green — that is the regression guard for the refactor. Green:
perform the extraction and aliasing above. Refactor: keep `git-support.ts` under
400 lines (255 today; expected ≈ 290).

Validation: `make all`. This item touches only TypeScript and its unit tests, so
no Markdown gate runs here.

### Work item 4: CLI entry reusing the shared runner

Implements "re-runs repository gates with command execution enabled" and the
degraded/spawn-failure handling (`docs/roadmap.md` lines 284-288). Follows
AGENTS.md "Error Handling" (convert third-party failures to project-owned
shapes at the command boundary) and the DI testing rule. Reuses the shared
`createCommandRunner` seam from work item 3 — it defines **no** new `spawnSync`
wrapper and **no** new command-result type.

Docs to read: `AGENTS.md` (Error Handling; Testing — end-to-end for
command-line behaviour); `docs/developers-guide.md` (Commit Gate; the
`git-support.ts` seam paragraph).
Skills to load: `leta`, `sem` (to confirm the reused `createCommandRunner`
contract from work item 3).

Add `tests/build-gate/review-evidence-cli.ts` that imports `CommandResult`,
`CommandRunner`, `CommandRunnerOptions`, and `createCommandRunner` from
`./git-support` and `createCapturedCliOutput` from `./git-support`, then
exports:

- `GateCommand` — `readonly [ReviewGateId, string, readonly string[]]`, a gate
  id paired with the command and args that satisfy it. The keyed `ReviewGateId`
  is the load-bearing structure: it is the single source from which both
  `requiredGates` and every `GateExecution.gate` are derived.
- `runReviewEvidenceCli(args, options)` — parses signals, derives
  `requiredGates` as the ordered `ReviewGateId`s of `gateCommands`, builds one
  `GateExecution` per entry by running its `command`/`args` through a runner
  obtained from the injected runner factory and tagging the record with that
  entry's `ReviewGateId`, calls `classifyReviewEvidence`, formats via work item
  2, and returns the exit code. A `spawnSync` result with `error !== undefined`
  maps to a `GateExecution` of `unavailable`; a non-zero `status` maps to
  `failed`; a zero `status` maps to `passed`. Because `requiredGates` and the
  executions both come from the one `gateCommands` list, the executions always
  cover exactly the required gates, so the classifier's rule-1 usage-error
  (execution enabled but a required gate missing) is unreachable from the CLI
  and remains a pure defensive guard.
- Runner injection: an option `createRunner?: (command: string, options?:
  CommandRunnerOptions) => CommandRunner`, defaulting to the shared
  `createCommandRunner`. For each `GateCommand` `[id, command, args]`, the CLI
  calls `(options.createRunner ?? createCommandRunner)(command, { env,
  timeoutMs }).run(args)`. Tests inject a fake `createRunner` that returns a fake
  `CommandRunner` whose `.run(args)` yields a canned `CommandResult`, so the
  matrix never spawns a real process. Both `CommandRunner` and `CommandResult`
  are the shared git-support types — nothing is forked.
- Signals: `--no-exec` (or env `ODW_LINT_REVIEW_EXEC=0`) sets
  `executionEnabled = false`, modelling a sandboxed reviewer;
  `--scrutineer=<availability>` and `--coderabbit=<availability>` (defaulting to
  `available`) set `pathAvailability`. Keep the parser small, matching
  `branch-freshness-git.ts` style; unknown flags produce a `usage-error`.
- An overridable `gateCommands` option, typed `readonly GateCommand[]` and
  defaulting to the three keyed `make` gate commands
  (`["make all", "make", ["all"]]`, `["make markdownlint", "make",
  ["markdownlint"]]`, `["make nixie", "make", ["nixie"]]`), so tests substitute
  trivial keyed commands and never spawn `make`. Overriding it with a single
  entry yields a single required gate and a single execution.
- Exit-code mapping: `verified` → 0, `failed` → 1, `usage-error` → 2,
  `degraded` → 3. Run as `main` when invoked directly via the
  `import.meta.url` guard.

Red: write `tests/build-gate/review-evidence-cli.test.ts` first. Cover: (a) the
full state matrix with an injected fake `createRunner` (no real spawn),
asserting status, report text, and exit code; (b) one real-runner test that
substitutes `gateCommands` with a single keyed guaranteed-present no-op
(`[["make all", "true", []]]`) and the default `createRunner`, so
`requiredGates` derives to the single `"make all"` gate and the one execution
passes, proving the shared `createCommandRunner` path yields `verified` and exit
0; (c) one real-runner test substituting a single keyed guaranteed-absent binary
(`[["make all", "<absent-binary>", []]]`) so the one required gate's execution is
`unavailable`, proving spawn-failure → `unavailable` → `degraded` and exit 3;
(d) `--no-exec` yields `degraded` and exit 3 without spawning; (e)
`--scrutineer=quota-blocked` with `coderabbit` available yields an explicit
`coderabbit` fallback in the report; (f) both reviewers unavailable yields
`degraded` `local-self-run`. Also add (g) a `requiredGates`-derivation
assertion: overriding `gateCommands` with one keyed entry produces exactly one
`- gate …` line in the report (guarding that the CLI derives `requiredGates`
from `gateCommands` rather than the three fixed ids). Use `createCapturedCliOutput`
from `git-support.ts` for output capture. Green: implement the CLI. Refactor; if
the module nears 400 lines, split the runner-to-execution mapping into
`tests/build-gate/review-evidence-run.ts` and record it in `Decision Log`.

Validation: `make all`.

### Work item 5: Makefile target and documentation

Implements the "gate" delivery and keeps it independent
(`docs/roadmap.md` lines 282-291). Follows AGENTS.md "Tooling Defaults" (prefer
Makefile targets) and "Documentation Maintenance".

Docs to read: `docs/developers-guide.md` (Commit Gate section, and the
`git-support.ts` seam paragraph); `docs/documentation-style-guide.md`;
`AGENTS.md` (Markdown Guidance).
Skills to load: `leta`.

Red: extend `tests/build-gate/makefile.test.ts` first with two dry-run
assertions: `make review-evidence` schedules `bun run
tests/build-gate/review-evidence-cli.ts`, and `make all` does **not** schedule
that command (guarding against accidental inclusion and recursion). Green: add a
`review-evidence` target to the `Makefile` (and to `.PHONY`) invoking `bun run
tests/build-gate/review-evidence-cli.ts`, mirroring the `branch-freshness`
target. Then update `docs/developers-guide.md`: (1) broaden the `git-support.ts`
seam paragraph to state that build-gate command execution now flows through one
shared `createCommandRunner` (`git` via `createGitRunner`, other gate commands
directly), so gates share one subprocess contract; and (2) add a subsection
under the Commit Gate area explaining that `make review-evidence` re-runs the
repository gates with command execution enabled to produce independent evidence;
that it is deliberately outside `make all`; the `verified` / `failed` /
`degraded` / usage-error statuses and their exit codes (0/1/3/2); the
`--no-exec` degraded signal for sandboxed reviewers; and the explicit
`scrutineer` → `coderabbit` → `local-self-run` dual-review fallback ordering.

Validation: `make all`, then `make markdownlint` and `make nixie` (Markdown
changed). Before the Markdown gates, format only the changed Markdown with
`mdtablefix docs/developers-guide.md` then `markdownlint-cli2 --fix
docs/developers-guide.md` (this file is edited in this work item, so the path
exists).

### Work item 6: close-out

Docs to read: `docs/roadmap.md` §1.5; this ExecPlan.
Skills to load: `execplans`, `commit-message`, `pr-creation` (for the PR).

Tick `- [ ] 1.5.6` to `- [x] 1.5.6` in `docs/roadmap.md` and finalize this
ExecPlan's `Progress`, `Surprises & Discoveries`, `Decision Log`, and
`Outcomes & Retrospective`, appending a revision note. The branch-freshness
guard tolerates a roadmap completion tick that only marks the current task
done; if `make branch-freshness` flags anything, record it and confirm the tick
is the only roadmap change before proceeding.

Validation: `make all`, `make markdownlint`, `make nixie`. Format only the
changed Markdown files (`docs/roadmap.md`, `docs/execplans/roadmap-1-5-6.md`)
with `mdtablefix` then `markdownlint-cli2 --fix` before the Markdown gates;
both files are edited in this work item, so both paths exist.

## Concrete steps

Run all commands inside the worktree
`/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-6`.

1. Work item 0 — refresh and confirm:

   ```sh
   git fetch origin main:refs/remotes/origin/main
   git status --porcelain=v1
   git merge-base --is-ancestor origin/main HEAD; echo "behind=$?"
   ls tests/build-gate
   ```

   Expect a clean worktree and `behind=0` (HEAD contains `origin/main`). If
   `behind=1`, rebase onto `origin/main` and re-record evidence.

2. Work items 1-5 — for each, add the red test, run the focused test to observe
   the expected failure, implement, and re-run:

   ```sh
   bun test tests/build-gate/review-evidence.test.ts
   bun test tests/build-gate/review-evidence-report.test.ts
   bun test tests/build-gate/git-support.test.ts
   bun test tests/build-gate/review-evidence-cli.test.ts
   bun test tests/build-gate/makefile.test.ts
   ```

   Expect each focused command to fail before implementation (import error or
   assertion) and pass after. For work item 3, the existing
   `git-support.test.ts` cases must stay green throughout (regression guard);
   only the newly added `createCommandRunner` asserts fail red before the
   extraction.

3. After each work item, run the full gate:

   ```sh
   make all
   ```

4. For work items that change Markdown (5 and 6), also run:

   ```sh
   make markdownlint
   make nixie
   ```

5. Exercise the gate manually to confirm observable behaviour:

   ```sh
   bun run tests/build-gate/review-evidence-cli.ts --no-exec; echo "exit=$?"
   ```

   Expect a `Review evidence: degraded` report naming command execution as
   unavailable, and `exit=3`.

## Validation and Acceptance

Quality criteria (what "done" means):

- Tests: `make test` passes; the new focused tests
  (`review-evidence.test.ts`, `review-evidence-report.test.ts`,
  `review-evidence-cli.test.ts`) and the extended `git-support.test.ts` and
  `makefile.test.ts` each fail before their implementation commit and pass
  after; the pre-existing `git-support.test.ts` cases stay green across work
  item 3.
- Lint/typecheck/format: `make all` passes (it runs `build`, `check-fmt`,
  `whitespace-hygiene`, `lint`, `typecheck`, `test`).
- Markdown: `make markdownlint` and `make nixie` pass after documentation and
  roadmap changes.

Acceptance is behavioural. From the worktree:

- `bun run tests/build-gate/review-evidence-cli.ts --no-exec` prints
  `Review evidence: degraded`, names command execution as unavailable, still
  names a dual-review path, and exits 3 — proving degraded-mode evidence rather
  than a silent pass.
- With execution enabled and the required gates passing and `scrutineer`
  available, the report status is `verified`, the path line reads `scrutineer
  (primary)`, and the exit code is 0.
- With `--scrutineer=quota-blocked` and `coderabbit` available, the report names
  `coderabbit (fallback; scrutineer quota-blocked)` and does not silently claim
  `scrutineer` — proving no silent substitution of the dual-review path.
- A re-run gate that returns non-zero yields status `failed`, lists the failed
  gate, and exits 1.
- `make all` does not schedule the review-evidence script (dry-run assertion),
  proving the gate stays independent and non-recursive.
- The review-evidence CLI imports `createCommandRunner` from `git-support.ts`
  and defines no `spawnSync` call of its own — grep confirms `spawnSync` appears
  only in `git-support.ts` and `makefile.test.ts`, proving no forked subprocess
  contract.

Red-Green-Refactor evidence to record in `Progress` and `Decision Log`: the red
command and its expected failure, the green command and expected pass, and the
`make all` result after refactoring, for each of work items 1-5.

## Idempotence and Recovery

Every step is re-runnable. Tests create and remove their own temporary
repositories via `git-support.ts` helpers and inject fake runners, so reruns do
not drift. The only mutating filesystem changes are the new source and test
files, the generalized `git-support.ts` seam, the Makefile target, and the
documentation and roadmap edits; re-editing is safe. If a formatter parks
unrelated churn, name any stash precisely, for example `df12-stash v1
task=1.5.6 kind=discard reason="formatter churn"`, and discard it. No
destructive or irreversible operations are involved.

## Artifacts and Notes

Reference implementations to mirror (read before coding):

- `tests/build-gate/git-support.ts` — the shared runner to generalize; the
  current `createGitRunner` body (lines 54-77) becomes `createCommandRunner`.
- `tests/build-gate/branch-freshness.ts` — pure classifier with a
  discriminated-union result.
- `tests/build-gate/branch-freshness-report.ts` — `switch`-based reviewer
  report formatter.
- `tests/build-gate/branch-freshness-git.ts` — CLI/runner reusing the
  git-support seam (line 17), exit-code mapping, and the `import.meta.url` main
  guard.
- `tests/build-gate/whitespace-hygiene.ts` and its test — compact CLI with the
  writers pattern and `createCapturedCliOutput` usage.
- `tests/build-gate/makefile.test.ts` — dry-run wiring assertions for new
  targets.

## Interfaces and Dependencies

Use only existing dependencies: Node/Bun `spawnSync` (built-in, already the
process seam in `git-support.ts`) and `fast-check` (already used for property
tests). No new dependency is expected.

In `tests/build-gate/git-support.ts` (generalized in work item 3):

```ts
export type CommandResult = {
  readonly status: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error?: NodeJS.ErrnoException;
};

export type CommandRunner = {
  readonly run: (args: readonly string[]) => CommandResult;
};

export type CommandRunnerOptions = {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
  readonly maxBufferBytes?: number;
};

export function createCommandRunner(
  command: string,
  options?: CommandRunnerOptions,
): CommandRunner;

// Backwards-compatible git aliases; behaviour and signatures unchanged.
export type GitCommandResult = CommandResult;
export type GitRunner = CommandRunner;
export function createGitRunner(
  repositoryPath: string,
  options?: GitRunnerOptions,
): GitRunner;
```

In `tests/build-gate/review-evidence.ts`, define at minimum:

```ts
export type ReviewGateId = "make all" | "make markdownlint" | "make nixie";

export type GateExecution =
  | { readonly gate: ReviewGateId; readonly status: "passed" }
  | {
      readonly gate: ReviewGateId;
      readonly status: "failed";
      readonly exitCode: number;
      readonly detail: string;
    }
  | { readonly gate: ReviewGateId; readonly status: "unavailable"; readonly detail: string };

export type ReviewPath = "scrutineer" | "coderabbit" | "local-self-run";
export type ReviewPathAvailability = "available" | "quota-blocked" | "unavailable";

export type ReviewPathSelection = {
  readonly selected: ReviewPath;
  readonly reason: string;
  readonly isFallback: boolean;
  readonly isDegraded: boolean;
};

export type ReviewEvidenceResult =
  | {
      readonly status: "verified";
      readonly executions: readonly GateExecution[];
      readonly reviewPath: ReviewPathSelection;
    }
  | {
      readonly status: "failed";
      readonly executions: readonly GateExecution[];
      readonly reviewPath: ReviewPathSelection;
      readonly failedGates: readonly ReviewGateId[];
    }
  | {
      readonly status: "degraded";
      readonly executions: readonly GateExecution[];
      readonly reviewPath: ReviewPathSelection;
      readonly reasons: readonly string[];
    }
  | { readonly status: "usage-error"; readonly message: string };

export type ClassifyReviewEvidenceInput = {
  readonly executionEnabled: boolean;
  readonly executions: readonly GateExecution[];
  readonly requiredGates: readonly ReviewGateId[];
  readonly pathAvailability: Readonly<Record<ReviewPath, ReviewPathAvailability>>;
};

export function classifyReviewEvidence(input: ClassifyReviewEvidenceInput): ReviewEvidenceResult;
export function selectReviewPath(
  pathAvailability: Readonly<Record<ReviewPath, ReviewPathAvailability>>,
): ReviewPathSelection;
```

In `tests/build-gate/review-evidence-report.ts`:

```ts
import type { ReviewEvidenceResult } from "./review-evidence";

export function formatReviewEvidenceResult(result: ReviewEvidenceResult): string;
```

In `tests/build-gate/review-evidence-cli.ts` — note it imports the runner types
and factory from `./git-support` and defines **no** subprocess wrapper or
command-result type of its own:

```ts
import type { ReviewGateId } from "./review-evidence";
import {
  type CommandRunner,
  type CommandRunnerOptions,
  createCommandRunner,
} from "./git-support";

// Each gate command is keyed by its ReviewGateId. `requiredGates` and every
// `GateExecution.gate` are derived from this list (see work item 4), so the
// executions the CLI builds always cover exactly the required gates — the
// classifier's rule-1 contradiction can never be produced by the CLI. A default
// list maps the three fixed ReviewGateIds to their `make` invocations; a test
// that overrides it with a single entry yields a single required gate.
export type GateCommand = readonly [ReviewGateId, string, readonly string[]];

export type ReviewEvidenceExitCode = 0 | 1 | 2 | 3;

export function runReviewEvidenceCli(
  args?: readonly string[],
  options?: {
    // Injectable runner FACTORY; defaults to the shared createCommandRunner.
    readonly createRunner?: (command: string, options?: CommandRunnerOptions) => CommandRunner;
    readonly gateCommands?: readonly GateCommand[];
    readonly writeOut?: (message: string) => void;
    readonly writeErr?: (message: string) => void;
    readonly env?: NodeJS.ProcessEnv;
  },
): ReviewEvidenceExitCode;
```

The default `gateCommands` is:

```ts
const DEFAULT_GATE_COMMANDS: readonly GateCommand[] = [
  ["make all", "make", ["all"]],
  ["make markdownlint", "make", ["markdownlint"]],
  ["make nixie", "make", ["nixie"]],
];
```

`runReviewEvidenceCli` derives `requiredGates` as the `ReviewGateId` of each
entry in `gateCommands` (in order) and, for each entry, obtains a runner via
`(options.createRunner ?? createCommandRunner)(command, { env, timeoutMs })`,
runs `args` through it, and tags the resulting `GateExecution` with that same
`ReviewGateId`. This keyed structure is the single source of both
`requiredGates` and each `GateExecution.gate`, so overriding `gateCommands` with
one entry (for example `[["make all", "true", []]]`) produces exactly one
required gate and one matching execution. Because both `CommandRunner` and
`CommandResult` are the shared `git-support.ts` types and the default factory is
`createCommandRunner`, the CLI reuses one subprocess contract rather than
forking a second.

## Research evidence

Verified against branch-local sources inside the worktree (re-confirmed after
`EnterWorktree`; `git branch --show-current` reported `roadmap-1-5-6`).

- Build-gate architecture and the pure-classifier/report/CLI split:
  `tests/build-gate/branch-freshness.ts` lines 20-48 (result union),
  `tests/build-gate/branch-freshness-report.ts` (formatter),
  `tests/build-gate/branch-freshness-git.ts` lines 74-97 and 379-381 (CLI,
  exit-code mapping, main guard).
- The git-only runner and its `spawnSync` body to be generalized:
  `tests/build-gate/git-support.ts` lines 11-77 — `GitCommandResult` (11-17),
  `GitRunner` (20-22), `createGitRunner` hardcoding `spawnSync("git", …)` at
  line 60, capturing `result.error`/`result.status`/`result.signal`. There is no
  generic command runner today (a `grep` for `spawnSync`/`CommandRunner` across
  `tests/build-gate/*.ts` returns only `git-support.ts` line 60 and
  `makefile.test.ts` line 60), so work item 3 must add one rather than reuse a
  nonexistent symbol.
- Reuse precedent — a reviewer-run build-gate CLI already imports the git-support
  seam: `tests/build-gate/branch-freshness-git.ts` line 17 imports
  `createGitRunner`, `GitCommandResult`, `GitRunner`, and `runGit` from
  `./git-support`. `tests/build-gate/whitespace-hygiene.ts` line 9 and
  `tests/build-gate/file-size-support.ts` line 5 reuse other git-support
  exports. This makes review-evidence reusing the generalized seam consistent
  with existing coupling, not a new dependency direction.
- The `git-support.test.ts` contract asserts to preserve across the refactor:
  `tests/build-gate/git-support.test.ts` lines 21-52 (`GitCommandResult`,
  `GitRunner`, `GitRunnerOptions`, and run-args assignability) and lines 294-309
  (empty-`PATH` spawn-failure surfaced as `result.error`).
- Roadmap task 1.5.5 success criterion forbidding forked contracts:
  `docs/roadmap.md` line 281 — "no gate carries a forked subprocess or
  tracked-file enumeration contract". This is the rule work item 3 satisfies by
  generalizing rather than forking.
- Developers' guide seam ownership: `docs/developers-guide.md` — the "Build-gate
  Git command execution, tracked-file listing, temporary repository setup … and
  captured CLI output live in `tests/build-gate/git-support.ts`" paragraph. This
  places the shared runner in `git-support.ts`, so the generic runner belongs
  there too.
- Makefile target list and `make all` composition: `Makefile` lines 1-5 and
  39-49; `make branch-freshness` is a standalone target (lines 42-43).
- Dry-run wiring-test pattern for new targets:
  `tests/build-gate/makefile.test.ts` lines 59-167.
- `make branch-freshness` documented as deliberately outside `make all`:
  `docs/developers-guide.md` (Commit Gate area) — the precedent for a
  reviewer-run gate that is not part of the commit gate.
- Roadmap task and success criterion: `docs/roadmap.md` lines 218-223 (§1.5
  intent) and 282-291 (task 1.5.6).
- `scrutineer` / `coderabbit` / local fallback ordering and quota-blocking:
  `docs/execplans/roadmap-2-1-10.md` lines 201, 233-246;
  `docs/execplans/roadmap-2-1-5.md` lines 147-201 and 219-227;
  `docs/execplans/roadmap-1-5-5.md` lines 252-256.
- AGENTS.md governing rules: Testing (including the DI rule and property/table
  guidance), Error Handling, Observability, and file-size.

Tooling note: the sibling ODW checkout at
`/data/leynos/Projects/open-dynamic-workflows` was not consulted, because this
task is roadmap-workflow review tooling and does not touch ODW loader, workflow,
or example behaviour. No locked external library beyond Node/Bun `spawnSync` and
`fast-check` is load-bearing, so no Firecrawl documentation research was
required. GrepAI, `leta`, and `sem` were available for planning; the planning
session's Bash sandbox initially blocked direct worktree access, so file
evidence was first read from the shared `main`-based root worktree and then
re-confirmed inside the worktree (see `Surprises & Discoveries`).

## Revision note

- 2026-07-02: Initial DRAFT. Decomposed roadmap task 1.5.6 into six work items
  (0-5): refresh, pure classifier, report formatter, injectable-runner CLI,
  Makefile target plus documentation, and close-out. Pinned the deliverable to a
  repository-owned reviewer-run gate (`make review-evidence`) mirroring
  `make branch-freshness`, kept it outside `make all` to avoid recursion,
  modelled the explicit `scrutineer` → `coderabbit` → `local-self-run`
  dual-review fallback and the `degraded` exit-code contract, and cited the
  build-gate sources, AGENTS.md rules, and prior-ExecPlan evidence each work
  item relies on. No implementation performed.
- 2026-07-02 (round 2): Resolved the design reviewer's sole blocking point — the
  CLI contract was internally inconsistent because `gateCommands` carried no
  `ReviewGateId`, leaving no specified way to tag each `GateExecution.gate` or
  to derive `requiredGates`, which made the CLI real-runner tests (b)/(c)
  unsatisfiable (a single overridden command classified as `usage-error`, not
  `verified`/`degraded`). Introduced `GateCommand =
  readonly [ReviewGateId, string, readonly string[]]`; retyped `gateCommands` to
  `readonly GateCommand[]`; pinned a default keyed list mapping the three fixed
  `ReviewGateId`s to their `make` invocations; and specified that
  `runReviewEvidenceCli` derives both `requiredGates` and every
  `GateExecution.gate` from that one keyed list. Documented that a single-entry
  override yields exactly one required gate and one matching execution, so the
  (b) `verified`/exit 0 and (c) `degraded`/exit 3 tests hold; clarified that the
  classifier's rule-1 usage-error is thereby unreachable from the CLI and
  remains a pure defensive guard, and added explicit rule-1 unit cases (work
  item 1) plus a `requiredGates`-derivation assertion (CLI test (g)).
  No implementation performed.
- 2026-07-02 (round 3): Resolved the design reviewer's sole blocking point — the
  round-2 CLI (then work item 3) forked a second subprocess contract by defining
  its own `CommandRunner`/`CommandResult` and a `spawnSync`-wrapping default
  runner in `review-evidence-cli.ts`, directly violating the plan's own hard
  Constraint and roadmap task 1.5.5's success criterion (`docs/roadmap.md` line
  281: "no gate carries a forked subprocess … contract"). Verified that
  `git-support.ts` exposes only a git-specific runner (`createGitRunner`
  hardcodes `spawnSync("git", …)`, line 60) with no generic command runner, and
  that `branch-freshness-git.ts` (line 17) — a reviewer-run build-gate CLI —
  already reuses that seam. Adopted reviewer option (a): added a new work item 3
  that generalizes `createGitRunner`'s `spawnSync` body into one shared
  `createCommandRunner` (generic `CommandResult`/`CommandRunner`) in
  `git-support.ts`, keeping `createGitRunner` as a git specialization and
  preserving all existing importers and `git-support.test.ts` contract asserts
  via `GitCommandResult = CommandResult` / `GitRunner = CommandRunner` aliases.
  Renumbered the CLI to work item 4, which now imports and reuses
  `createCommandRunner` via an injectable runner **factory** (`createRunner`)
  and defines no subprocess wrapper or command-result type of its own; renumbered
  Makefile+docs to work item 5 (now also broadening the developers' guide seam
  paragraph) and close-out to work item 6. Rewrote the offending Constraint to
  state the generalize-then-reuse approach, added a Decision Log entry recording
  the choice of option (a) over option (b) (rejected because it would leave the
  gate in violation of roadmap 1.5.5), added a generalization-regression Risk,
  a `git-support.ts` file-size Tolerance, a `Surprises & Discoveries`
  observation, and Research-evidence citations (roadmap line 281,
  `git-support.ts` lines 11-77, `branch-freshness-git.ts` line 17,
  `git-support.test.ts` lines 21-52 and 294-309, the developers' guide seam
  paragraph). No implementation performed.
- 2026-07-02 (implementation, work item 2): Added
  `tests/build-gate/review-evidence-report.ts` and
  `tests/build-gate/review-evidence-report.test.ts`; updated
  `ReviewPathSelection` to a legal-variant union so the formatter can derive
  primary/fallback/degraded labels from the selected path state. The formatter
  emits stable, one-fact-per-line reports for verified, failed, degraded,
  unavailable-gate, fallback, local-self-run, and usage-error evidence. It also
  normalizes caller-owned text and throws with the malformed payload if an
  impossible result reaches the defensive default branch. Focused tests and
  `make all` passed; CodeRabbit completed with zero findings after one
  rate-limit sleep and several edge-case fixes.
- 2026-07-02 (implementation, work item 3): Generalized
  `tests/build-gate/git-support.ts` by adding `CommandResult`,
  `CommandRunner`, `CommandRunnerOptions`, and `createCommandRunner`. Refactored
  `createGitRunner` into a thin Git specialization that preserves the previous
  terminal-prompt, timeout, and buffer defaults. Extended `git-support` tests to
  assert the new contracts, a successful generic no-op command, and a missing
  command spawn failure. Focused tests and `make all` passed; CodeRabbit
  completed with zero findings.
- 2026-07-02 (implementation, work item 4): Added
  `tests/build-gate/review-evidence-cli.ts` and its CLI tests. The CLI derives
  required gates and executions from keyed `GateCommand` entries, reuses the
  shared `createCommandRunner` seam, converts spawn failures into unavailable
  gate evidence, maps statuses to exit codes 0/1/2/3, and exposes `--no-exec`,
  `--scrutineer=...`, and `--coderabbit=...` signals. Focused tests and
  `make all` passed; CodeRabbit completed with zero findings after requesting
  bounded runner defaults, output snapshots, exit-code coverage, and a
  non-terminating main guard.
- 2026-07-02 (implementation, work item 5): Added `make review-evidence` as a
  reviewer-run Makefile target and extended `makefile.test.ts` to prove the
  target is wired through Bun and excluded from `make all`. Updated the
  developers' guide to document the shared build-gate command runner,
  review-evidence exit codes, degraded sandbox signalling, and explicit
  `scrutineer` -> `coderabbit` -> `local-self-run` review order. Focused tests,
  `make all`, `make markdownlint`, and `make nixie` passed; CodeRabbit
  completed with zero findings.
- 2026-07-02 (implementation, work item 6): Marked roadmap task 1.5.6 complete
  and finalized this ExecPlan. Recorded final verified and degraded
  review-evidence transcripts, deterministic gate results, the continuing
  `scrutineer` quota-blocked fallback, and the final zero-finding CodeRabbit
  review.
