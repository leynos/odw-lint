# Adopt `make review-evidence` as a required roadmap review/audit step

This ExecPlan (execution plan) is a living document. The sections `Constraints`,
`Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 1.5.6 gave the repository a reviewer-run audit gate,
`make review-evidence`, backed by `tests/build-gate/review-evidence-cli.ts`. It
re-runs `make all`, `make markdownlint`, and `make nixie` through the shared
build-gate command runner and reports which dual-review path was selected.
Today that gate is *optional*: the developers' guide only tells a reviewer to
run it "when a roadmap review or audit needs independent evidence"
([docs/developers-guide.md](../developers-guide.md) line 183). Nothing makes a
normal review or audit run it; it depends on a reviewer remembering the target.

Roadmap task 1.5.7 ([docs/roadmap.md](../roadmap.md) lines 304-310) closes that
gap:

> Adopt `make review-evidence` in the roadmap review or audit workflow, or add
> an equivalent scheduled smoke path, so the gate is run automatically instead
> of depending on reviewer memory.
>
> Success: a normal roadmap review or audit path records review-evidence output
> without a manual reviewer opting into the target.

This plan takes the task's **first** option — *adopt `make review-evidence` in
the roadmap review or audit workflow* — because the roadmap itself identifies
that workflow and shows it is configurable from inside this repository. Task
1.5.8 ([docs/roadmap.md](../roadmap.md) lines 311-319) says to "wire
review-evidence reviewer availability from the roadmap **or df12-build
workflow's** observed reviewer state": the roadmap treats the df12-build
roadmap-review/audit orchestration as *the* review/audit workflow, with 1.5.7
as the invoke step and 1.5.8 as the availability-wiring step. The df12-build
audit agent's behaviour on this repository is governed by
[AGENTS.md](../../AGENTS.md) — its quality-gate contract — which **is**
in-repository and editable. Adopting the gate therefore means promoting
`make review-evidence` from an optional reviewer tool to a **required, recorded
step** of the roadmap review/audit path in that contract, and pinning the
adoption with a build-gate test so it cannot silently regress.

The roadmap's Success criterion (`docs/roadmap.md` line 309) is that a normal
review or audit **records review-evidence output** — it does **not** require a
`verified` verdict. That distinction is load-bearing for this plan: the adopted
contract requires the review/audit path to *run `make review-evidence` and
record its report, whatever the classification* (`verified`, `failed`,
`degraded`, or `usage-error`). The plan therefore makes no unproven claim that
the gate returns a green `verified` on any particular machine; the reviewer
acts on whatever the recorded report says (`failed`/`usage-error` block the
review as a real problem). This is what removes reliance on reviewer memory.

The roadmap review/audit path runs in the df12 toolchain environment, which
provides `make nixie` — the exact recipe this plan's own validation exercises
successfully. `make review-evidence` re-runs the identical `make nixie` recipe
(see "Renderer and nixie invocation" below), so in the fully-provisioned df12
environment the expected happy-path report is `verified` (exit 0). That green
outcome is illustrative, not a requirement the plan must prove: the adoption
succeeds by the review/audit path running-and-recording the gate.

After this change a maintainer can observe success three ways:

1. From the worktree, `make all` runs a new Bun test,
   `tests/build-gate/review-evidence-audit.test.ts`, which reads
   [AGENTS.md](../../AGENTS.md) and asserts it carries a dedicated review/audit
   section that requires running `make review-evidence` and recording its
   report. The test fails before the section exists and passes after.
2. Running `make review-evidence` from the worktree prints and records the
   review-evidence report (sample in `Artifacts and notes`); in the df12
   environment, where the same `make nixie` recipe this plan validates passes,
   the expected happy-path report is `verified`.
3. The developers' guide and repository layout describe the adoption, so a
   reviewer no longer chooses whether to run the target — the review/audit path
   runs it as a defined step and records the evidence.

## Constraints

Hard invariants that must hold throughout implementation. Violation requires
escalation, not a workaround.

- Work only in the assigned git-donkey worktree for branch `roadmap-1-5-7`.
  Change into the worktree root before running commands or editing files, and
  never edit the root/control worktree. Treat `origin/main` as canonical and
  the integration branch as `main`.
- Do **not** add `make review-evidence` to `make all`. Task 1.5.6's plan and
  the developers' guide keep review-evidence outside `make all` because it
  re-runs `make all` and would recurse
  ([docs/execplans/roadmap-1-5-6.md](roadmap-1-5-6.md) lines 62-66;
  [docs/developers-guide.md](../developers-guide.md) lines 183-188). This task
  makes the *review/audit path* run the existing target; it must not change what
  `make all` schedules. The Makefile `all` target ([Makefile](../../Makefile)
  line 5) stays `build check-fmt whitespace-hygiene lint typecheck test`.
- Do **not** change the review-evidence CLI contract from 1.5.6: its gate list
  (`make all`, `make markdownlint`, `make nixie`), its exit-code map (0
  verified, 1 failed, 2 usage-error, 3 degraded), its flags, or its report
  format. This task only *invokes* the existing target; CLI changes belong to
  tasks 1.5.8 and 1.5.9 (`docs/roadmap.md` lines 311-327).
- Preserve the static-analysis and non-execution boundary. Nothing here
  executes workflow fixture source or imports ODW runtime paths; the review/
  audit path only re-runs repository build gates. See
  [ADR 0001](../adr/0001-static-analysis-boundary.md) and
  [technical-design.md](../technical-design.md) §15, which requires the tool to
  "run in CI without executing workflow source" (line 578).
- Do not add a new runtime or dev dependency and do not add a new repository
  gate to `make all`. The new test runs under the existing `bun test`
  (`make test`); no new tooling is introduced.
  [docs/repository-layout.md](../repository-layout.md) lines 156-157 forbid
  adding tooling dependencies as part of adjacent work.
- Every code file stays at or below 400 lines
  ([AGENTS.md](../../AGENTS.md) "Keep file size manageable", line 31).
- All prose, comments, and commit messages use en-GB Oxford spelling
  ("-ize"/"-yse"/"-our") per AGENTS.md lines 25-27 and 45-47.

## Review-evidence invocation boundary

This task ships one invocation contract: the AGENTS.md review/audit section now
requires roadmap review and audit agents to run `make review-evidence` in the
task worktree and record its report. The existing Make target remains the
execution surface; this plan does not change its command list, exit-code map,
or report shape.

The relevant branch-local facts are:

- `make nixie` runs the bare recipe `nixie --no-sandbox` with **no**
  `--renderer` flag ([Makefile](../../Makefile) lines 51-52, read on this
  branch). `make review-evidence`'s nixie sub-gate invokes command `make` with
  args `["nixie"]` (`tests/build-gate/review-evidence-cli.ts` lines 50-54), so
  it runs the same recipe.
- The [Makefile](../../Makefile) and the review-evidence CLI are
  edit-forbidden by this plan's Constraints. Any future change to provision
  Mermaid tooling or choose a renderer belongs to the gate implementation or
  environment contract, not this invocation task.
- No repository configuration selects a renderer. Verified on this branch:
  `git grep -i renderer` over the tree (excluding `docs/execplans/` and
  `bun.lock`) returns nothing; there is no `.nixie*` config file; and
  `package.json` contains no `nixie`/`merman`/`mmdc`/`mermaid`/`renderer` key.

Consequence for implementation: the review/audit path records whatever
`make review-evidence` reports from the existing gates. In the df12 toolchain
environment, the expected clean-tree result is `verified`; if `make nixie` or
another required gate fails, the recorded report is `failed`/`usage-error` and
the review blocks honestly. The roadmap success criterion is therefore the
automatic run-and-record behaviour.

## Tolerances (exception triggers)

Stop and escalate rather than improvise when any of these is reached:

- Mechanism ambiguity: this plan realizes "adopt in the roadmap review or audit
  workflow" as a **required, test-pinned instruction** in the AGENTS.md
  quality-gate contract that the df12-build audit obeys. If a stakeholder
  instead requires a machine-enforced hosted-CI job that re-executes the gates,
  stop and escalate. An honest hosted-runner execution is **not achievable as
  scoped**: `make nixie` invokes the system-only `nixie` binary, a stock
  `ubuntu-latest` runner lacks it, and — proven below — `make review-evidence`
  then exits 1 (failed), not 3 (degraded), so such a job would be perpetually
  red. There is no verifiable public `nixie` install path (see Risks), and
  provisioning `nixie` or relaxing the 1.5.6 CLI contract is out of scope.
- Scope: if delivering the adoption requires touching more than the files named
  in `Interfaces and dependencies` (AGENTS.md, the new test, developers-guide,
  repository-layout, the roadmap tick, and this plan), stop and escalate.
- Recursion: if any change would cause `make all` to schedule
  `make review-evidence` (verified by `tests/build-gate/makefile.test.ts`
  "keeps review evidence outside the full gate", lines 173-184), stop and
  escalate. This plan does not touch the Makefile, so this must never occur.
- Iterations: if the new Bun test still fails after 3 focused attempts, stop and
  escalate.

## Risks

- Risk: a reviewer may judge that adopting the gate through the AGENTS.md
  quality-gate contract is "still documentation" and demand a machine-enforced
  hosted-CI job. Severity: medium. Likelihood: medium. Mitigation: the roadmap
  offers exactly this option — "Adopt `make review-evidence` in the roadmap
  review or audit workflow" — and 1.5.8 confirms the df12-build audit **is**
  that workflow. For an agent-driven audit workflow, its instruction contract
  (AGENTS.md) is the adoption surface, and the change here promotes the gate
  from optional to **required and recorded**, pinned by a build-gate test so it
  cannot silently regress. An honest hosted-CI execution is blocked by the
  unverifiable `nixie` install (next Risk), so it is not a lower-risk
  alternative — it is a perpetually-red job. If escalation nonetheless mandates
  hosted CI, that needs a verifiable `nixie` install path and belongs to a
  separate, escalated decision (see the Mechanism-ambiguity Tolerance).
- Risk: `nixie` is a system-installed df12 binary, not an npm/Bun package (it
  is absent from `package.json`/`bun.lock` and appears only in historical
  execplan validation transcripts under `docs/execplans/`, e.g.
  `docs/execplans/roadmap-1-3-2.md` line 1196). A stock GitHub-hosted
  `ubuntu-latest` runner will not have it. Severity: high (for the rejected
  hosted-CI option). Likelihood: high. Mitigation: do not place the automatic
  invocation on a stock hosted runner. Run it where the toolchain is complete —
  the df12 review/audit environment — which this plan's own `make nixie`
  validation confirms provides `nixie`. This removes the missing-binary failure
  mode entirely; the recorded report is `verified` (exit 0), not `failed` or
  `degraded`. The impossibility of an honest hosted-runner run is documented in
  the Decision Log so 1.5.8 inherits the finding.
- Risk: the pin test could become brittle if it over-asserts AGENTS.md prose
  (for example, matching a whole sentence or exact wording). Severity: low.
  Likelihood: medium. Mitigation: anchor the test to one stable heading and
  assert only load-bearing tokens inside that section — the literal target
  `make review-evidence` and a normative keyword (that it is required and its
  output recorded) — not the full wording, using a small table of substring
  checks rather than a snapshot.

## Progress

- [x] (2026-07-03 02:49Z) Work item 1: added the review/audit-evidence
  adoption to AGENTS.md and the build-gate pin test. Red evidence:
  `bun test tests/build-gate/review-evidence-audit.test.ts` failed because the
  `## Roadmap Review & Audit Evidence` section was absent. Green evidence: the
  focused test passed after adding the section. Scrutineer then ran `make all`,
  `make markdownlint`, and `make nixie` successfully after the final test and
  ExecPlan fixes. CodeRabbit ran once plus three follow-up retries; live
  findings were fixed locally, and remaining workflow comments target absent
  files.
- [x] (2026-07-03 04:00Z) Work item 2: documented the adoption in the
  developers' guide and repository layout. Scrutineer ran `make all`,
  `make markdownlint`, and `make nixie` successfully. The first CodeRabbit
  attempt hit a recoverable rate limit, so the implementation waited 53 minutes
  with `vsleep`; the retry completed and reported only stale findings against
  absent hosted-workflow/review artefact files.
- [x] (2026-07-03 04:00Z) Work item 3: marked roadmap task 1.5.7 complete,
  set this ExecPlan to COMPLETE, filled the retrospective, and appended the
  closeout revision note. Scrutineer ran `make all`, `make markdownlint`, and
  `make nixie` successfully. CodeRabbit completed and reported only stale
  findings against absent hosted-workflow files.
- [x] (2026-07-03 04:18Z) Fix round 1: replaced the brittle
  review-evidence audit pin-test sentence regex with the independent
  token-level checks required by Work item 1 and this plan's Risk mitigation.
  Focused evidence: `bun test tests/build-gate/review-evidence-audit.test.ts`
  passed with four assertions. Scrutineer ran `make all`, `make markdownlint`,
  and `make nixie` successfully, then `coderabbit review --agent` completed
  with only stale hosted-workflow findings against absent files
  (`.github/workflows/review-evidence.yml` and
  `tests/build-gate/review-evidence-workflow.test.ts`).

## Surprises & discoveries

- Observation: on a stock hosted runner, `make review-evidence` exits **1
  (failed)**, not 3 (degraded), when `nixie` is missing — so a scheduled GitHub
  Actions job invoking it would be perpetually red. Evidence, traced through
  worktree source on this branch: (a) the gate list invokes `make nixie` as
  command `make` with args `["nixie"]`
  (`tests/build-gate/review-evidence-cli.ts` lines 50-54); (b)
  `createCommandRunner` uses `spawnSync` and only sets `result.error` when the
  spawned command itself fails to spawn (`tests/build-gate/git-support.ts`
  lines 67-90). `make` is present on `ubuntu-latest`, so the spawn succeeds and
  `make` runs the recipe `nixie --no-sandbox` ([Makefile](../../Makefile) line
  52), which fails because `nixie` is absent; `make` therefore exits non-zero
  with `result.error === undefined`; (c) `gateExecutionFromResult` (CLI lines
  137-161) reaches the `result.status !== 0` branch (not the
  `result.error !== undefined` degraded branch), returning `status: "failed"`;
  (d) `classifyReviewEvidence` (`tests/build-gate/review-evidence.ts` lines
  108-147) maps any failed required gate to overall `failed`, and `exitCodeFor`
  (CLI lines 326-340) returns 1. The developers' guide states this exact rule:
  "Spawn-unavailable gates are degraded because they did not run; timed-out or
  killed gates are failed because they did run"
  ([docs/developers-guide.md](../developers-guide.md) lines 200-201). A
  missing recipe binary makes the gate (`make`) *run* and fail, so it is
  `failed`, not `unavailable`/degraded. Impact: retired the previous round's
  scheduled-GitHub-Actions design and its degraded-tolerant exit policy, which
  were built on the false exit-3 premise. The automatic invocation now runs in
  the df12 environment where `nixie` exists. See Decision Log.
- Observation: AGENTS.md currently never mentions `make review-evidence` and has
  no dedicated review/audit-path section; the review/audit path inherits only
  the developers' guide's optional "when … needs" phrasing (line 183).
  Evidence: full read of [AGENTS.md](../../AGENTS.md); the string
  `review-evidence` does not appear. Impact: the adoption is a genuine
  behaviour change (optional → required), not a restatement, and there is a
  clean place to add the contract section.
- Observation: nothing in the repository selects a Mermaid renderer for
  `nixie --no-sandbox`, so no plan may claim a specific renderer (merman/
  `mmdc`) is used. Evidence, verified on this branch: `git grep -i renderer`
  over the tree (excluding `docs/execplans/` and `bun.lock`) returns no
  matches; there is no `.nixie*` config file; and `package.json` has no `nixie`/
  `merman`/`mmdc`/`mermaid`/`renderer` key. The recipe is the bare
  `nixie --no-sandbox` ([Makefile](../../Makefile) lines 51-52) with no
  `--renderer` flag. Impact: this plan provisions no renderer and asserts none.
  Its nixie behaviour is defined solely by being the *same recipe* as the
  plan's own `make nixie` validation gate, run in the same environment (see
  "Renderer and nixie invocation"). The adoption's Success is decoupled from the
  `verified` verdict (roadmap line 309 requires *recording* output, not a
  green result), so no browser-runtime or renderer-selection claim is
  load-bearing anywhere.
- Observation: this session's package-registry and web tools were unavailable
  (network fetch and firecrawl calls could not run non-interactively), so live
  probes of an external `nixie` install path or renderer download could not be
  run. Read-only shell (`git grep`, `ls`, `grep`) and file inspection **were**
  available and were used to verify the branch-local facts above. Evidence:
  successful `git grep -i renderer`, `ls`, and `grep` over `package.json`
  during this round; no interactive network approvals were obtainable. Impact:
  all branch-local facts here were verified by direct worktree file inspection
  and read-only search (an acceptable fallback under the standing rules). The
  plan deliberately does **not** depend on any unverified external install path
  or renderer-download step; every load-bearing claim is either verified
  against worktree source and cited, or pinned by the work-item-1 test.
- Observation: CodeRabbit repeatedly reported hosted-workflow findings against
  `.github/workflows/review-evidence.yml` and
  `tests/build-gate/review-evidence-workflow.test.ts`, but neither file exists
  in this worktree. Evidence: `leta files .github` shows only
  `.github/dependabot.yml`; direct file inspection for
  `.github/workflows/review-evidence.yml` failed with "No such file or
  directory"; `git status --short` shows no workflow test file. Impact: those
  review findings are stale and non-actionable for this scoped implementation.
  Live CodeRabbit findings in `tests/build-gate/review-evidence-audit.test.ts`
  and this ExecPlan were fixed before the work item was committed.
- Observation: the untracked `docs/execplans/roadmap-1-5-7.review-r2.md`
  artefact described a retired scheduled-hosted-workflow design and continued
  to trigger review feedback even after the approved plan had moved to the
  AGENTS.md contract surface. Evidence: CodeRabbit's third follow-up pass
  reported the review artefact as stale because it still described the
  hosted-runner/exit-3 assumption. Impact: the stale artefact was removed from
  this worktree rather than committed, so future review sees the approved
  ExecPlan as the single current plan.
- Observation: CodeRabbit rate-limited the first work-item-2 review attempt but
  completed after the required randomized backoff. Evidence: scrutineer
  reported a recoverable `rate_limit` response with a one-minute service wait
  hint; this implementation followed the workflow rule by running `vsleep` for
  53 minutes before retrying. The retry completed and produced no live findings
  against files present in this worktree. Impact: no documentation changes were
  needed after the retry. Remaining CodeRabbit comments still target absent
  hosted-workflow files or the removed round-2 review artefact.
- Observation: the work-item-3 closeout CodeRabbit pass also reported only
  absent-file hosted-workflow findings. Evidence: scrutineer reported five
  CodeRabbit findings, all against `.github/workflows/review-evidence.yml` or
  `tests/build-gate/review-evidence-workflow.test.ts`; both files are absent in
  this worktree. Impact: no local closeout fixes were available or appropriate.
  The final commit proceeds with deterministic gates green and stale review
  comments recorded.

## Decision log

- Decision: implement the task's first option — adopt `make review-evidence`
  into the roadmap review/audit workflow — rather than a scheduled hosted-CI
  smoke path. Rationale: the roadmap treats the df12-build audit as *the*
  review/audit workflow (1.5.8 wires availability "from the roadmap or
  df12-build workflow's observed reviewer state", `docs/roadmap.md` lines
  311-319). That workflow obeys the in-repository AGENTS.md quality-gate
  contract, so it *is* editable from here. Promoting the gate from optional to
  required in that contract makes a normal review/audit run it and record its
  output "without a manual reviewer opting into the target". Date/Author:
  2026-07-03, planning agent (df12-build roadmap workflow).
- Decision: reject the scheduled GitHub Actions design used in rounds 1-2.
  Rationale: it rested on the false premise that `make review-evidence` exits 3
  (degraded) on a `nixie`-less hosted runner, so a `[ 0 ] || [ 3 ]` policy
  would keep the job green. Worktree source proves it exits **1 (failed)**
  there (see Surprises), so the job would be perpetually red — the exact
  failure the degraded-tolerant policy existed to prevent. Accepting exit 1
  would swallow real gate failures; `--no-exec` exits 3 but re-runs nothing
  (failing the Success criterion that gates were re-executed); classifying a
  missing recipe binary as `unavailable`/degraded is a 1.5.6 CLI-contract
  change this plan's Constraints forbid; and provisioning `nixie` needs a
  verifiable install path that is absent (not in `package.json`/`bun.lock`, no
  repo-documented install) and could not be verified in this session. A green
  scheduled hosted run that still re-runs the real gates is therefore not
  achievable as scoped, so the design is retired rather than patched.
  Date/Author: 2026-07-03, planning agent (round 3 revision).
- Decision: run the automatic invocation in the df12 review/audit environment,
  not on a stock hosted runner. Rationale: that environment provides the full
  toolchain, including `nixie` (this plan's own `make nixie` validation depends
  on and confirms it), so `make review-evidence` re-executes all three gates
  and, on a clean tree, is expected to report `verified` (exit 0). This
  eliminates the missing-binary failure mode with no CLI change and no
  exit-code tolerance logic; a real failed gate (1) or usage error (2) still
  surfaces honestly to the reviewer. Date/Author: 2026-07-03, planning agent
  (round 3 revision).
- Decision: make no renderer-selection claim and decouple the adoption's Success
  from the `verified` verdict. Rationale: the roadmap Success criterion (line
  309) requires the review/audit path to *record* review-evidence output, not
  to obtain a green `verified`. The `make nixie` recipe is the bare
  `nixie --no-sandbox` with no `--renderer` flag (Makefile 51-52), the Makefile
  and CLI are edit-forbidden, and nothing in the repository selects a renderer
  (verified: empty `git grep -i renderer`, no `.nixie*`, no `package.json`
  renderer key). The plan therefore neither provisions merman/`mmdc` nor
  asserts that bare nixie picks any backend. The nixie sub-gate under
  `make review-evidence` is the *same recipe* as the plan's own `make nixie`
  gate, so its outcome in the df12 environment is whatever that environment
  already produces for `make nixie`; the recorded report (verified, failed,
  degraded, or usage-error) is the deliverable, and a non-verified report
  blocks the review honestly. This closes the round-4 review point: the plan no
  longer relies on an unproven `verified` path for the command the workflow
  actually runs. Date/Author: 2026-07-03, planning agent (round 4 revision).
- Decision: pin the adoption with a build-gate test that reads AGENTS.md.
  Rationale: mirrors the existing `tests/build-gate/makefile.test.ts` pattern,
  which reads the tracked Makefile and asserts targets stay wired. Reading the
  tracked AGENTS.md contract and asserting the required review-evidence step
  stays present prevents a silent regression back to an optional gate.
  Date/Author: 2026-07-03, planning agent.
- Decision: keep the adoption scoped to the internal review-evidence audit gate
  and leave user-facing CI (running `odw-lint check`, `pull_request` triggers)
  to deferred task 4.2.2 (`docs/roadmap.md` lines 790-795). Rationale: avoids
  pre-empting 4.2.2's design and keeps this change atomic and reviewable.
  Date/Author: 2026-07-03, planning agent.
- Decision: treat CodeRabbit findings against absent hosted-workflow files as
  stale for work item 1 and continue with deterministic validation after fixing
  live findings. Rationale: this task does not ship a
  `.github/workflows/review-evidence.yml` file or a
  `tests/build-gate/review-evidence-workflow.test.ts` test; editing or
  inventing those files would violate this plan's scoped adoption through
  AGENTS.md. Live findings against the pin test and ExecPlan were fixed, while
  stale hosted-workflow comments were recorded as non-actionable evidence.
  Date/Author: 2026-07-03, implementation agent.

## Outcomes & retrospective

Implemented the roadmap's first allowed option: the repository now adopts
`make review-evidence` through the AGENTS.md roadmap review/audit contract. A
normal roadmap review or audit must run the target and record its report, so
the gate no longer depends on reviewer memory. The build-gate pin test
`tests/build-gate/review-evidence-audit.test.ts` protects that contract by
reading AGENTS.md and asserting the required run-and-record sentence remains
present.

The developers' guide and repository layout now describe the same contract:
`make review-evidence` is a required recorded review/audit step, it stays
outside `make all`, and it re-runs `make all`, `make markdownlint`, and
`make nixie` through the existing build-gate runner. The implementation did not
change the Makefile, review-evidence CLI, gate list, exit-code map, or Mermaid
renderer selection.

Task 1.5.8 should inherit the finding that a stock hosted runner cannot
honestly execute `make review-evidence` without the system `nixie` binary:
`make` runs the `nixie --no-sandbox` recipe, the missing recipe binary yields a
failed gate, and the review-evidence CLI exits 1 rather than degraded 3. Future
availability wiring should therefore distinguish real df12 review/audit
toolchain evidence from optimistic hosted-runner assumptions.

## Context and orientation

This is a Bun + TypeScript repository. The relevant surfaces:

- [AGENTS.md](../../AGENTS.md): the repository-local instruction and
  quality-gate contract every agent obeys, including the df12-build
  review/audit agents ([docs/repository-layout.md](../repository-layout.md)
  line 24). It has "Change Quality & Committing" (lines 67-108) for commit
  gates but **no** review/audit-path section and no mention of
  `make review-evidence`.
- [Makefile](../../Makefile): canonical validation entry points.
  `all: build check-fmt whitespace-hygiene lint typecheck test` (line 5).
  `review-evidence` is a separate target (lines 45-46) that runs
  `bun run tests/build-gate/review-evidence-cli.ts`. `make all` does **not**
  schedule review-evidence. `nixie` (lines 51-52) runs `nixie --no-sandbox`.
- `tests/build-gate/`: repository-maintenance gates. Shared subprocess
  execution and CLI-output capture live in `tests/build-gate/git-support.ts`;
  the review-evidence classifier, report, and CLI are
  `tests/build-gate/review-evidence.ts`,
  `tests/build-gate/review-evidence-report.ts`, and
  `tests/build-gate/review-evidence-cli.ts`
  ([docs/repository-layout.md](../repository-layout.md) lines 129-134).
- `tests/build-gate/makefile.test.ts`: reads the tracked Makefile and asserts
  targets stay wired (review-evidence through Bun, lines 145-157; outside
  `make all`, lines 173-184). It shows how a build-gate test locates the
  repository root:
  `repositoryRoot = resolve(dirname(fileURLToPath( import.meta.url)), "../..")`
  (line 37). The new pin test reuses this root resolution to read AGENTS.md.
- `docs/developers-guide.md` lines 183-205: documents `make review-evidence` as
  a non-recursive reviewer-run gate kept outside `make all`, including the
  exit-code table (196-203) and the spawn-vs-run distinction (200-201) that
  proves the missing-`nixie` case is `failed`, not degraded.
- `docs/repository-layout.md` lines 136-147: "Tooling boundaries" describes
  `make review-evidence` as roadmap-review support.

Terms used in this plan:

- "Review evidence": the classified result (`verified` / `failed` / `degraded`
  / `usage-error`) that `make review-evidence` prints, proving the repository
  gates were re-executed and naming the selected dual-review path.
- "Roadmap review/audit workflow": the df12-build orchestration's review/audit
  phase, whose behaviour on this repository is governed by AGENTS.md and which
  runs in the df12 toolchain environment.
- "Required, recorded step": a step the review/audit path must run as a matter
  of course (not a reviewer's ad hoc choice) and whose output is captured as
  the review evidence.

## Plan of work

Three ordered, atomic, independently committable work items. Each ends with the
repository gate passing.

### Work item 1 — Adopt the required review-evidence step in AGENTS.md (Red-Green)

Documentation to read first: [docs/roadmap.md](../roadmap.md) lines 304-319
(tasks 1.5.7 and 1.5.8); [docs/developers-guide.md](../developers-guide.md)
lines 183-205 (review-evidence target, exit codes, and the spawn-vs-run
distinction at 200-201); [AGENTS.md](../../AGENTS.md) "Change Quality &
Committing" (67-108), "Testing" (250-279), and "Keep file size manageable" (31);
[docs/documentation-style-guide.md](../documentation-style-guide.md) for prose
conventions. Skills to load: `execplans` (this skill), `en-gb-oxendict`
(AGENTS.md prose), `biomejs` (TypeScript formatting/lint for the new test),
`commit-message` (the commit).

Red. Add `tests/build-gate/review-evidence-audit.test.ts`. Using `bun:test`,
`node:fs`, `node:path`, and `node:url` (mirroring `makefile.test.ts`), resolve
the repository root as in `makefile.test.ts` line 37, read
[AGENTS.md](../../AGENTS.md), extract the section under the exact heading
`## Roadmap Review & Audit Evidence` (from that heading up to the next level-2
`##` heading or end of file), and assert the following load-bearing invariants
(driven by a small table of substring checks, per AGENTS.md lines 271-272 — a
`fast-check` property test is **not** warranted for a single static contract
file, recorded here as the testing decision):

1. the `## Roadmap Review & Audit Evidence` section exists (the review/audit
   contract has a stable anchor);
2. the section contains the literal target `make review-evidence` (the adopted
   gate is named);
3. the section contains a normative requirement keyword — it matches
   `/\brequired\b/i` or `/\bmust\b/i` — so the gate is mandatory, not optional
   (this is what removes reliance on reviewer memory);
4. the section states the output is recorded — it matches `/record/i` — so the
   Success criterion ("records review-evidence output") is anchored in the
   contract.

Run the focused test and observe it fail because the section does not yet exist:

```sh
bun test tests/build-gate/review-evidence-audit.test.ts
```

Green. Add the `## Roadmap Review & Audit Evidence` section to
[AGENTS.md](../../AGENTS.md) (placed immediately after "Change Quality &
Committing", before "Refactoring Heuristics & Workflow"). Its content, in en-GB
Oxford spelling, must state that:

- a roadmap review or audit (including the df12-build audit phase) **must** run
  `make review-evidence` as a required step and **record** its report as the
  review evidence — it is not optional and does not depend on a reviewer
  remembering to run it;
- `make review-evidence` re-runs `make all`, `make markdownlint`, and
  `make nixie` in the task worktree and reports the selected dual-review path,
  and it stays outside `make all` (a reviewer-run audit gate, not a commit-gate
  step);
- the recorded report is the deliverable whatever its classification: in the
  fully-provisioned df12 environment (the same toolchain that runs this plan's
  own `make nixie` gate) the expected happy-path result is `verified` (exit 0),
  while a `failed` (1) or `usage-error` (2) result must block the review as a
  real problem. Do **not** state or imply that any specific Mermaid renderer is
  selected — `make nixie` runs the bare `nixie --no-sandbox` and the plan
  provisions nothing (see "Renderer and nixie invocation").

Re-run the focused test; it passes.

Refactor. Only if the test grows repetitive, extract a small
`readAgentsSection` helper within the test file; keep it under 400 lines and
re-run the focused test.

Validation for this work item (path-safe repository gates only): `make all`
(runs the new Bun test and the tracked-file whitespace guard over the changed
files), then `make markdownlint` and `make nixie` because AGENTS.md (Markdown)
changed.

Tests added/updated: `tests/build-gate/review-evidence-audit.test.ts` (new unit
test). No fixture, snapshot, property, or behavioural test is appropriate here;
the change pins one static contract section, fully covered by the structural
substring assertions above.

Commit: a single commit containing the AGENTS.md section and its passing test.

### Work item 2 — Document the adoption

Documentation to read first: [docs/developers-guide.md](../developers-guide.md)
lines 176-210 (the review-target paragraphs this extends);
[docs/repository-layout.md](../repository-layout.md) lines 136-147 (tooling
boundaries) and 20-38 (top-level table); [AGENTS.md](../../AGENTS.md)
"Documentation Maintenance" (36-57) and "Markdown Guidance" (151-162);
[docs/documentation-style-guide.md](../documentation-style-guide.md) for
document-type and prose conventions. Skills to load: `execplans`,
`en-gb-oxendict`, `commit-message`.

Edits:

1. `docs/developers-guide.md`: revise the review-evidence paragraph (lines
   183-205) so it states the roadmap review/audit path **runs
   `make review-evidence` as a required step and records its report**, rather
   than only "when … needs independent evidence". Note that the review/audit
   environment provides the full toolchain (including `nixie`), so the gate
   reports `verified` on a clean tree, and cross-reference the new AGENTS.md
   "Roadmap Review & Audit Evidence" section. Keep the exit-code table
   (196-203) unchanged.
2. `docs/repository-layout.md`: in "Tooling boundaries" (lines 136-147), note
   that the roadmap review/audit path runs the non-recursive
   `make review-evidence` target as a required step and that it is not added to
   `make all`.

Keep every Markdown paragraph wrapped at 80 columns (AGENTS.md line 157). Do
not run a repository-global formatter; format only the files touched here.

Validation for this work item (path-safe repository gates only): `make all`,
then `make markdownlint` and `make nixie` because Markdown changed.

Tests added/updated: none (documentation only). The contract is already guarded
by work item 1's pin test.

Commit: a single documentation commit.

### Work item 3 — Close out the roadmap task and finalize the plan

Documentation to read first: [docs/roadmap.md](../roadmap.md) lines 304-310;
this ExecPlan's living sections. Skills to load: `execplans`, `commit-message`.

Edits:

1. `docs/roadmap.md`: change `- [ ] 1.5.7.` to `- [x] 1.5.7.` (line 304). This
   is the only roadmap change in this task; the branch-freshness guard (task
   1.5.2) protects unrelated `docs/**`/`tests/**` deletions, and a single
   completion tick is an intentional, in-scope edit.
2. This plan: set `Status:` to `COMPLETE`, tick the `Progress` items with
   timestamps, and fill `Outcomes & retrospective`, appending the required
   revision note.

Validation (path-safe repository gates): `make all`, then `make markdownlint`
and `make nixie` for the Markdown changes.

Tests added/updated: none.

Commit: a single closeout commit.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-7`.

1. Work item 1 — Red:

   ```sh
   bun test tests/build-gate/review-evidence-audit.test.ts
   ```

   Expected: the test fails because AGENTS.md has no
   `## Roadmap Review & Audit Evidence` section.

2. Work item 1 — Green: add the section to `AGENTS.md`, then:

   ```sh
   bun test tests/build-gate/review-evidence-audit.test.ts
   make all
   make markdownlint
   make nixie
   ```

   Expected: focused test passes; `make all` passes and its output does **not**
   contain `bun run tests/build-gate/review-evidence-cli.ts` (review-evidence
   stays outside the full gate); `make markdownlint` and `make nixie` pass.
   Commit.

3. Work item 2 — documentation:

   ```sh
   make all
   make markdownlint
   make nixie
   ```

   Expected: all pass. Commit.

4. Work item 3 — closeout: tick `docs/roadmap.md` 1.5.7 and finalize this plan,
   then:

   ```sh
   make all
   make markdownlint
   make nixie
   ```

   Expected: all pass. Commit.

## Validation and acceptance

Quality criteria ("done"):

- Tests: `make test` (via `make all`) passes, including the new
  `tests/build-gate/review-evidence-audit.test.ts`. That test fails before the
  AGENTS.md `## Roadmap Review & Audit Evidence` section exists and passes
  after (Red-Green evidence recorded in `Progress`).
- Lint/typecheck/format: `make all` passes (`build`, `check-fmt`,
  `whitespace-hygiene`, `lint`, `typecheck`, `test`).
- Markdown: `make markdownlint` and `make nixie` pass for the AGENTS.md and
  documentation commits. `make nixie` passing also demonstrates the
  implementation environment runs the `make nixie` recipe cleanly, which is the
  same recipe `make review-evidence` re-runs, so its nixie sub-gate is expected
  to pass there too (happy-path `verified`); the plan asserts no renderer
  choice.
- Non-recursion: `make all --dry-run` does not schedule
  `tests/build-gate/review-evidence-cli.ts`, as already guarded by
  `tests/build-gate/makefile.test.ts` lines 173-184.

Acceptance as observable behaviour: after this change, AGENTS.md — the contract
the df12-build review/audit agents obey — requires the roadmap review/audit
path to run `make review-evidence` and record its report, so a normal review or
audit records review-evidence output without a reviewer opting into the target
(`docs/roadmap.md` line 309). That recorded output — not any particular verdict
— is the Success criterion. Because the path runs in the df12 toolchain
environment (the same toolchain in which this plan's own `make nixie` gate
passes), `make review-evidence` re-executes `make all`, `make markdownlint`,
and the identical `make nixie` recipe, and on a clean tree is expected to report
`verified` (exit 0); a real failed gate (1) or usage error (2) still blocks
the review. The plan asserts no renderer selection: `make nixie` runs the bare
`nixie --no-sandbox` (no `--renderer`) and nothing is provisioned. The
build-gate pin test proves the required step stays wired in the contract,
guarding against a silent regression back to an optional gate.

Quality method: run the repository gates listed above from the worktree; inspect
`make all --dry-run` output to confirm non-recursion.

## Idempotence and recovery

- Re-running any listed command is safe and side-effect free; the Bun test only
  reads files.
- If work item 1's Green test still fails after edits, re-read the section the
  test expects (the exact `## Roadmap Review & Audit Evidence` heading, the
  literal `make review-evidence` token, a `required`/`must` keyword, and a
  `record` keyword) and adjust the AGENTS.md section text. Do not weaken the
  assertions to pass.
- To back out, delete `tests/build-gate/review-evidence-audit.test.ts`, remove
  the AGENTS.md section, revert the documentation edits and the roadmap tick;
  no generated artefacts persist.

## Artefacts and notes

Representative *expected happy-path* `make review-evidence` output (from
`tests/build-gate/review-evidence-report.ts`), which the review/audit path
records as the review evidence in the fully-provisioned df12 environment (the
recorded report — not this specific `verified` verdict — is the deliverable):

```plaintext
Review evidence: verified
- gate make all: passed
- gate make markdownlint: passed
- gate make nixie: passed
- dual-review path: scrutineer (primary; ...)
```

Why a stock hosted GitHub runner is the wrong venue (retired design): there,
`make nixie` runs the recipe `nixie --no-sandbox` with `nixie` absent, so
`make` runs and exits non-zero while `result.error` is undefined; the CLI
classifies that gate as `failed` (not `unavailable`), the overall result is
`failed`, and `make review-evidence` exits **1**. A scheduled job invoking it
would be perpetually red, and the exit code cannot distinguish a missing binary
from a genuine gate failure without a forbidden CLI-contract change. See
Surprises and the Decision Log.

## Interfaces and dependencies

New file `tests/build-gate/review-evidence-audit.test.ts`. Shape:

```typescript
/**
 * @file Asserts AGENTS.md requires the roadmap review/audit path to run and
 * record `make review-evidence`, so the gate is not left to reviewer memory.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const agentsPath = join(repositoryRoot, "AGENTS.md");
const sectionHeading = "## Roadmap Review & Audit Evidence";

// Read AGENTS.md, slice the section from `sectionHeading` to the next level-2
// "## " heading (or end of file), and assert invariants 1-4 from Work item 1 with a
// small table of { name, pattern } substring/regex checks.
```

Load-bearing repository facts (verified against worktree source, cited above):

- `make review-evidence` gate list and exit-code mapping
  (`tests/build-gate/review-evidence-cli.ts` lines 50-54, 137-161, 326-340).
- `createCommandRunner` sets `result.error` only on spawn failure
  (`tests/build-gate/git-support.ts` lines 67-90).
- `classifyReviewEvidence` maps a failed required gate to overall `failed`
  (`tests/build-gate/review-evidence.ts` lines 108-147).
- The spawn-vs-run degraded/failed rule
  (`docs/developers-guide.md` lines 200-201).

No new runtime or dev dependency is added; the test runs under the existing
`bun test`.

## Revision note

Round 3 revision (2026-07-03). Design review proved the round-1/2 scheduled
GitHub Actions design rested on a false premise: on a stock `ubuntu-latest`
runner lacking `nixie`, `make review-evidence` exits **1 (failed)**, not 3
(degraded), because `createCommandRunner` spawns `make` (present), which runs
the `nixie --no-sandbox` recipe and exits non-zero with `result.error`
undefined, so the gate classifies as `failed` and the overall result is
`failed` (verified via `tests/build-gate/review-evidence-cli.ts`,
`tests/build-gate/git-support.ts`, `tests/build-gate/review-evidence.ts`, and
`docs/developers-guide.md` lines 200-201). A `[ 0 ] || [ 3 ]` policy would
therefore leave the scheduled job perpetually red; accepting exit 1 swallows
real failures, `--no-exec` re-runs nothing, reclassifying a missing binary as
degraded is a forbidden 1.5.6 CLI change, and no verifiable `nixie` install
path exists. The plan is redesigned to the task's first option: adopt
`make review-evidence` as a **required, recorded step** of the roadmap
review/audit workflow via the in-repository AGENTS.md quality-gate contract
that the df12-build audit obeys, run in the df12 toolchain environment where
`nixie` is present (so the gate reports `verified`, exit 0), and pinned by a
new build-gate test. The scheduled workflow, its wiring test, the
degraded-tolerant exit policy, wiring-test invariant 6, and the
`Bun.YAML.parse` dependency are removed; Constraints, Tolerances, Risks,
Surprises, Decision Log, Acceptance, Artefacts, and the work items are
re-derived to match this reality.

Round 4 revision (2026-07-03). Design review flagged that a plan variant which
provisioned merman only (`cargo install merman-cli … --locked`) and asserted a
`verified` green path was unproven for the command the workflow actually runs:
`make nixie` executes the bare `nixie --no-sandbox` with **no** `--renderer`
flag (Makefile 51-52, re-verified this round), the Makefile and CLI are
edit-forbidden, and nothing in the repository selects a renderer (re-verified:
empty `git grep -i renderer`, no `.nixie*` config, no `package.json` renderer
key), so no `--renderer merman` can be forced and bare nixie's default backend
cannot be claimed to be browserless. This plan resolves that point by (a)
introducing **no** renderer provisioning and making **no** renderer-selection
claim — added the "Renderer and nixie invocation" section and a Surprises
observation recording the verified absence of any renderer config; and (b)
decoupling the adoption's Success from the `verified` verdict — the roadmap
Success criterion (line 309) requires the review/audit path to *record*
review-evidence output, so the contract requires run-and-record whatever the
classification, with `failed`/`usage-error` blocking the review honestly. The
`make nixie` sub-gate under `make review-evidence` is the *same recipe* as this
plan's own `make nixie` validation gate, run in the same df12 environment, so
its outcome is exactly what that environment already produces for `make nixie`;
the expected happy-path `verified` result is now illustrative, not a
load-bearing claim. Purpose, Decision Log, Acceptance, and Work item 1's Green
content were re-derived accordingly. No `cargo install`, merman, or
`--renderer` step exists anywhere in this plan.

Closeout revision (2026-07-03). Implementation completed all three work items:
AGENTS.md now requires roadmap review/audit runs to execute and record
`make review-evidence`; a build-gate test pins that contract; the developers'
guide and repository layout document the required recorded step; and
`docs/roadmap.md` marks task 1.5.7 complete. The work kept `make all`
non-recursive and left the review-evidence CLI unchanged. CodeRabbit produced
repeated stale comments against absent hosted-workflow files and an obsolete
round-2 review artefact; live comments against the pin test and ExecPlan were
fixed before commit.

Fix round 1 revision (2026-07-03). Dual review identified that
`tests/build-gate/review-evidence-audit.test.ts` had drifted from Work item 1
by replacing the planned independent invariants with one prose-shaped regex
that matched the AGENTS.md sentence too closely. The fix restores the intended
small table of checks: section presence remains a dedicated assertion, and the
table now separately pins the literal `make review-evidence` target, a
`required`/`must` normative keyword, and the `record` keyword. This keeps the
durability guarantee on load-bearing contract tokens rather than exact wording
or clause order. Final validation for this round passed `make all`,
`make markdownlint`, and `make nixie`; CodeRabbit found only stale
hosted-workflow issues against files absent from this worktree.
