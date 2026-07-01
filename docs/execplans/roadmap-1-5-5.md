# Consolidate Build-Gate Git Support

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / Big Picture

Roadmap task 1.5.5 removes duplicated Git process, tracked-file,
temporary-repository, repository-file-write, commit, and command-output helpers
from the build-gate test suite. After this work, maintainers can update Git
subprocess behaviour for build-gate checks in one documented test-support
module instead of keeping separate contracts synchronized across file-size,
whitespace hygiene, and branch-freshness gates.

Success is observable when build-gate tests exercise one shared
`tests/build-gate/git-support.ts` seam, no build-gate gate owns a forked
subprocess or tracked-file enumeration contract, and `make all`,
`make markdownlint`, and `make nixie` pass. Implementation must not begin until
this draft is reviewed and approved.

## Constraints

- Work only in the git-donkey worktree:
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-5`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as canonical and the integration branch as `main`.
- Refresh from `origin/main` before code implementation. If the branch is
  behind, rebase onto `origin/main` unless a merge commit is explicitly chosen
  and recorded in `Decision Log`.
- Use this GrepAI command shape as the primary intent-search tool:

  ```sh
  grepai search --workspace Projects --project odw-lint "<English intent query>" --toon --compact
  ```

  The GrepAI index reflects canonical `main` only. Verify every branch-local
  fact inside this worktree with `leta`, exact text search, or direct file
  inspection before acting.
- Use `leta` for branch-local TypeScript symbol navigation, references, call
  graphs, and refactoring. Exact text search is acceptable for Markdown,
  Makefile rules, lockfile entries, and string literals that are not code
  symbols. If `leta` fails transiently, record the exact command and failure
  in `Surprises & Discoveries`, then continue with bounded file inspection.
- Use `sem` instead of raw Git history or blame if codebase history navigation
  is needed. Ordinary `git status`, scoped diffs, and Git commands used by the
  build-gate tests remain acceptable.
- Read and obey `AGENTS.md`, `docs/terms-of-reference.md`,
  `docs/technical-design.md`, `docs/adr/0001-static-analysis-boundary.md`,
  `docs/developers-guide.md`, `docs/users-guide.md`,
  `docs/repository-layout.md`, `docs/scripting-standards.md`,
  `docs/complexity-antipatterns-and-refactoring-strategies.md`,
  `docs/documentation-style-guide.md`, and `docs/roadmap.md` before
  implementation.
- Use en-GB Oxford spelling in prose and comments. Preserve external API,
  command, and package names exactly.
- Keep every work item independently committable and gate-passable. Commit
  after each completed work item only after its gates pass.
- Do not add or update package dependencies. The selected mechanism uses the
  existing Git CLI, Bun 1.3.11, TypeScript 5.9.3, Node-compatible built-ins,
  Biome 2.5.1, Oxlint 1.71.0, markdownlint, nixie, and Make targets.
- Do not add production `src/` code. The helper seam is test/build-gate
  infrastructure only and must not be exported from the package entry point.
- Do not import executable ODW runtime paths. Do not execute workflow source,
  import workflow fixtures as modules, call ODW loader helpers, start ODW
  runs, or dispatch agents.
- Preserve each gate's feature-specific policy:
  `tests/build-gate/file-size-support.ts` still filters tracked TypeScript
  paths under `src/` and `tests/`; `tests/build-gate/whitespace-hygiene.ts`
  still scans tracked non-binary files; `tests/build-gate/branch-freshness.ts`
  and `tests/build-gate/branch-freshness-git.ts` still own roadmap freshness
  classification and CLI reporting.
- Keep source and test files under 400 physical lines. Split support code and
  tests before either file approaches that limit.
- Format only changed files. Do not run repository-global mutating formatters
  such as `make fmt`, `bun fmt`, or `mdformat-all`.
- For Markdown files changed by each work item, run `mdtablefix` and
  `markdownlint-cli2 --fix` only on those exact paths before gates.
- Validation commands must be path-safe. Do not list optional files in direct
  formatter or linter commands unless the same work item definitely creates or
  edits them. If a work item deletes a file, omit that path from direct
  formatter commands and rely on repository gates.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances

- Scope: stop and escalate if implementation needs production `src/` changes,
  package export changes, dependency changes, or Makefile target changes.
- Size: stop and escalate if implementation exceeds 6 changed TypeScript files
  excluding tests, 9 changed test files, or 350 net TypeScript lines.
- Interface: stop and escalate if a public package API signature must change.
  Test-helper APIs may change when all in-repository call sites are updated in
  the same work item.
- Dependencies: stop and escalate if a new external dependency is required.
- Behaviour: stop and escalate if a gate's externally observable exit codes,
  stdout/stderr messages, or path scope must change to complete the refactor.
- Iterations: stop and escalate if the same focused test or repository gate
  fails after 3 implementation attempts for reasons not explained by the
  expected Red stage.
- Ambiguity: stop and escalate if two valid helper boundaries remain after
  reading the cited docs and tests and the choice would materially affect
  future ownership.

## Risks

- Risk: The helper can become an over-broad test utility drawer.
  Severity: medium.
  Likelihood: medium.
  Mitigation: keep `git-support.ts` limited to Git command execution,
  tracked-file listing, temporary repository setup, repository-relative writes,
  commits, and CLI-output capture. Document that feature policy stays in each
  gate module.
- Risk: Consolidating process execution accidentally changes branch-freshness
  timeout or prompt-disabled behaviour.
  Severity: high.
  Likelihood: medium.
  Mitigation: add helper tests that prove `createGitRunner` passes
  `GIT_TERMINAL_PROMPT=0`, uses a bounded timeout, normalizes nullable
  `spawnSync` output to strings, and surfaces spawn errors.
- Risk: Moving tracked-file parsing could weaken file-size or whitespace error
  text.
  Severity: medium.
  Likelihood: medium.
  Mitigation: keep existing focused tests and add shared-helper tests for
  `git ls-files -z` parsing and failure messages before updating callers.
- Risk: Temporary-repository helpers might bake in branch-freshness-specific
  defaults that make whitespace hygiene tests harder to read.
  Severity: medium.
  Likelihood: low.
  Mitigation: expose a generic `createTemporaryRepository` with typed options
  for name, email, initial branch, and prefix; keep branch-freshness fixture
  composition in `branch-freshness-git-fixtures.ts`.

## Progress

- [x] (2026-07-01 00:00Z) Drafted the first planning round for roadmap task
  1.5.5.
- [x] (2026-07-01 13:20Z) Revised the plan after design review. Added an
  origin-main refresh work item, corrected the `GitCommandResult` output
  contract, and made formatter/linter commands path-safe.
- [x] (2026-07-01 13:58Z) Work item 0: Refresh from origin/main and
  re-baseline evidence.
- [x] (2026-07-01 14:23Z) Work item 1: Introduce shared Git command and
  tracked-file support.
- [x] (2026-07-01 18:20Z) Work item 2: Move tracked-file listing callers onto
  the shared seam.
- [x] (2026-07-01 18:38Z) Work item 3: Move temporary repositories and CLI
  capture onto the seam.
- [x] (2026-07-01 19:05Z) Work item 4: Document helper ownership and close
  out task 1.5.5.

## Surprises & Discoveries

- Observation: The assigned branch is stale relative to canonical
  `origin/main`.
  Evidence: `git status --short --branch` in the assigned worktree reported
  `## roadmap-1-5-5...origin/main [behind 1]`; `sem diff --from HEAD --to
  origin/main` reported protected docs/tests changes in
  `docs/execplans/roadmap-2-1-7.md`, `docs/roadmap.md`,
  `tests/diagnostics/public-consumer.test.ts`, and
  `tests/diagnostics/types.test.ts`.
  Impact: implementation must start with an explicit fetch/rebase or merge
  step before TypeScript work begins, and source evidence must be recomputed
  after that step.
- Observation: GrepAI was available and returned build-gate Git surfaces on the
  canonical main index.
  Evidence:
  `grepai search --workspace 'Projects' --project 'odw-lint'` with query
  `build gate git command helper branch freshness working tree status`
  returned `tests/build-gate/branch-freshness-git.ts`,
  `tests/build-gate/branch-freshness-git-fixtures.ts`,
  `tests/build-gate/branch-freshness.ts`, and
  `tests/build-gate/branch-freshness-git-runner.ts`.
  Impact: this plan still treats branch-freshness as the highest-density Git
  support surface while verifying local file-size and whitespace duplication
  in the worktree.
- Observation: `leta files` and `leta grep` are available in this worktree.
  Evidence: `leta files` listed the repository tree, and
  `leta grep "tracked|Git|git|repo|capture|commit|write|run" tests/build-gate
  -k function,method,type,interface,variable,const --docs --head 160` found
  `createGitRunner`, `runGit`, `trackedSourceAndTestTypeScriptFiles`,
  `trackedRepositoryFiles`, `createTemporaryRepository`, `writeRepositoryFile`,
  `commitAll`, and `createCapturedCliOutput`.
  Impact: implementation can use Leta for branch-local symbol movement.
- Observation: Bun 1.3.11 returns nullable output on executable-not-found
  `spawnSync` despite the locked `@types/node` `SpawnSyncReturns<T>` type
  declaring `stdout: T` and `stderr: T`.
  Evidence:
  `bun -e 'const { spawnSync } = require("node:child_process"); const r =
  spawnSync("definitely-not-a-real-command-odw-lint", [], { encoding:
  "utf8" }); console.log(JSON.stringify({ stdout: r.stdout, stderr:
  r.stderr, errorCode: r.error?.code }));'` printed
  `{"stdout":null,"stderr":null,"errorCode":"ENOENT"}`.
  Impact: the shared helper must normalize `result.stdout ?? ""` and
  `result.stderr ?? ""` at its boundary instead of exposing nullable fields.
- Observation: Work item 0 rebased the branch onto current `origin/main`
  without conflicts.
  Evidence: `git rebase origin/main` completed with
  `Successfully rebased and updated refs/heads/roadmap-1-5-5`; subsequent
  `sem diff --from origin/main --to HEAD` reported no changes.
  Impact: implementation starts from current canonical protected docs and
  diagnostics tests.
- Observation: Refreshed canonical-main GrepAI results now identify the audit
  source and prior build-gate ExecPlan rather than branch-local code files.
  Evidence:
  `grepai search --workspace Projects --project odw-lint "build gate Git
  support helper seam" --toon --compact --limit 8` returned
  `docs/issues/audit-2.1.7.md` and
  `docs/execplans/roadmap-1-5-4.md`.
  Impact: use the audit finding as the canonical intent source, then verify
  all implementation facts directly in this refreshed worktree.
- Observation: Bun 1.3.11 can also return an undefined status for an
  executable-not-found `spawnSync` result.
  Evidence: the new `createGitRunner` focused test first failed with
  `Received: undefined` for `result.status` when `PATH` contained no `git`
  executable.
  Impact: `createGitRunner` now normalizes `result.status ?? null` along with
  stdout and stderr so callers receive the declared `GitCommandResult`
  contract.
- Observation: CodeRabbit review for work item 1 was rate-limited once, then
  returned six findings after the required backoff.
  Evidence: the first work item 1 review reported `Rate limit exceeded`; after
  an 87-minute `vsleep`, the retry returned six findings. Timeout injection,
  signal propagation, diagnostic snapshot coverage, parsed-payload snapshot
  coverage, and mutable mock call arrays were still valid and fixed. The
  suggestion to assign `result.status` directly was skipped because the
  focused Bun runtime test had already shown `undefined` for a missing
  executable.
  Impact: helper diagnostics now preserve child-process signals and focused
  tests can exercise timeout behaviour without waiting 30 seconds, while the
  project-owned status normalization remains in place.
- Observation: The follow-up CodeRabbit pass for work item 1 returned three
  small still-valid findings.
  Evidence: review asked to rename the `lsTrackedFiles` injected runner option,
  increase the focused timeout test from 1 ms, and exercise real UTF-8 output.
  Impact: the option is now `gitRunner`, the timeout test uses 20 ms with a
  shell-builtin busy loop, and the fake Git runner round-trips `café` through
  both arguments and stdout.
- Observation: The final CodeRabbit pass for work item 1 returned two
  still-valid findings before commit.
  Evidence: review asked for `NodeJS.ErrnoException` on `GitCommandResult.error`
  and a real cwd assertion in the fake Git runner test.
  Impact: the result type now preserves errno fields, and the test compares
  `realpathSync` of the captured `pwd` with the repository path before
  replacing it for snapshot readability.
- Observation: Scrutineer became unavailable during the final work item 1 gate
  loop because its fixed Codex Spark quota was exhausted.
  Evidence: attempting to spawn `scrutineer` for deterministic gates returned
  `You've hit your usage limit for GPT-5.3-Codex-Spark`.
  Impact: the same deterministic commands and CodeRabbit review were run
  locally from the assigned worktree to avoid blocking on an external quota.
- Observation: The local CodeRabbit pass for work item 1 returned three
  still-valid findings.
  Evidence: review asked for configurable `maxBuffer`, a serial-execution note
  around process environment mutation, and JSON escaping in the fake Git
  capture script.
  Impact: `createGitRunner` now uses a configurable 64 MiB default buffer, the
  test documents the process-wide environment assumption, and the fake Git
  capture script escapes quotes and backslashes before writing JSON.
- Observation: The final local CodeRabbit retry for work item 1 returned four
  findings, two still valid and two already covered.
  Evidence: review requested type-contract coverage and a less aggressive
  timeout test, which were fixed. It also repeated a request for
  failure-message snapshots, but the current `lsTrackedFiles` tests already
  snapshot the non-zero status, spawn-error, and signal branches.
  Impact: helper type shapes are pinned by type-only assertions, and the
  timeout test now uses a 150 ms timeout to avoid relying on a narrow CI
  scheduling window.

## Decision Log

- Decision: Extract one test-only helper module named
  `tests/build-gate/git-support.ts`.
  Rationale: roadmap task 1.5.5 and audit finding 2 both point to one helper
  seam. The helper is cohesive because all exported operations are about
  test/build-gate Git infrastructure, while file-size, whitespace, and
  branch-freshness policy remains colocated with the corresponding gate.
  Date/Author: 2026-07-01 / Codex.
- Decision: Make origin-main refresh work item 0.
  Rationale: the branch is behind `origin/main`, and protected docs/tests have
  changed on canonical main. Rebase or merge must happen before code changes so
  tests and validation assumptions reflect current integration state.
  Date/Author: 2026-07-01 / Codex.
- Decision: Keep `GitCommandResult.stdout` and `GitCommandResult.stderr` as
  strings by normalizing nullable `spawnSync` output to empty strings in
  `createGitRunner` and fixture Git helpers.
  Rationale: callers should not repeat runtime-specific null checks. Bun 1.3.11
  can return `null` for failed spawns, and tests must pin the project-owned
  normalized contract.
  Date/Author: 2026-07-01 / Codex.
- Decision: Keep `branch-freshness-git-fixtures.ts` as the
  branch-freshness-specific fixture composer rather than moving the whole file
  into `git-support.ts`.
  Rationale: the temporary bare origin, main clone, task clone, seeded roadmap,
  and roadmap mutation helpers are feature-specific policy. Only generic
  repository creation, file writes, commits, Git execution, and output capture
  belong in the shared seam.
  Date/Author: 2026-07-01 / Codex.
- Decision: Use existing Node-compatible `node:child_process.spawnSync` and
  the Git CLI, not a new Git library.
  Rationale: the repository already depends on this mechanism, the task is
  consolidation rather than dependency change, and official `spawnSync`
  documentation plus local Bun runtime evidence cover the needed process
  contract.
  Date/Author: 2026-07-01 / Codex.
- Decision: No sibling ODW checkout is needed for the implementation mechanism.
  Rationale: the task touches only build-gate Git support under `tests/`.
  It does not lean on ODW loader, workflow, or example behaviour. Static ODW
  runtime boundaries still apply as constraints.
  Date/Author: 2026-07-01 / Codex.

## Outcomes & Retrospective

Work item 0 refreshed the branch onto current `origin/main`, recomputed
GrepAI, Leta, and Sem evidence, and left no code changes. The implementation
baseline is current with canonical main before TypeScript work begins.

Work item 1 added `tests/build-gate/git-support.ts` and
`tests/build-gate/git-support.test.ts`. The focused helper test now proves
NUL-separated path parsing, shared `git ls-files -z --full-name` argument
construction, project-owned tracked-file listing errors, prompt-disabled Git
execution, UTF-8 output capture, bounded runner setup, and nullable or missing
subprocess output normalization. CodeRabbit follow-up added signal-aware
diagnostics, configurable test timeouts, and inline snapshots for helper-owned
error strings and captured command payloads. A second review pass tightened the
injected runner option name, made the short-timeout test less race-prone, and
added non-ASCII UTF-8 coverage. The final pre-commit review pass refined the
spawn error type and restored a real captured-cwd assertion. A local
CodeRabbit pass, used after scrutineer quota exhaustion, added configurable
output buffering and hardened the fake Git capture test. The last review retry
added type-contract assertions and relaxed the timeout test while confirming
the existing failure-message snapshots already cover the requested branches.

Work item 2 moved file-size and whitespace hygiene tracked-file listing onto
`lsTrackedFiles`. File-size remains responsible for filtering tracked
TypeScript paths under `src/` and `tests/`, while whitespace hygiene still
scans all tracked non-binary files. NUL-separated path parsing coverage now
lives in `git-support.test.ts`.

Work item 3 moved generic fixture Git operations into `git-support.ts`.
Branch-freshness still owns its origin/main/task repository choreography, while
shared helpers now own fail-fast fixture Git commands, temporary repository
creation, repository-relative writes, commit-all setup, and captured CLI
output. The Git support tests were split so each TypeScript file stays below
the 400-line limit.

Work item 4 documented the helper ownership boundary in the developer and
repository-layout guides, ticked roadmap task 1.5.5 complete, and re-ran the
focused build-gate tests before the final repository gates. The completed
seam leaves Git mechanics in `tests/build-gate/git-support.ts` and keeps each
gate's feature policy colocated with the corresponding gate.

## Context and Orientation

Roadmap task 1.5.5 appears in `docs/roadmap.md` under "1.5. Preserve public
API and review surfaces". It requires tasks 1.5.1, 1.5.2, and 1.5.4 and says:

```plaintext
Share the Git runner, tracked-file listing, temporary-repository setup, and
CLI output capture used by file-size, branch-freshness, and whitespace hygiene
gates while preserving each gate's feature-specific policy.
```

The current canonical build-gate surface under `tests/build-gate/` is:

- `file-size-support.ts` owns `trackedSourceAndTestTypeScriptFiles`,
  `runGitFileListing`, `assertGitFileListingSucceeded`, and
  `parseNulSeparatedPaths`.
- `whitespace-hygiene.ts` owns `trackedRepositoryFiles`,
  `runGitFileListing`, and `assertGitFileListingSucceeded`, and imports another
  `parseNulSeparatedPaths` from `whitespace-hygiene-support.ts`.
- `branch-freshness-git-runner.ts` owns `GitCommandResult`, `GitRunner`,
  `createGitRunner`, and `runGit`, with `GIT_TERMINAL_PROMPT=0` and a
  30-second timeout.
- `branch-freshness-git-fixtures.ts` owns a branch-freshness fixture composer,
  repository-relative file writes, captured CLI output, and a fail-fast test
  `git` helper.
- `whitespace-hygiene.test.ts` duplicates temporary repository setup, a
  fail-fast test `git` helper, repository-relative file writes, commits, and
  captured CLI output.

The new seam must be test-only. It exists to remove duplication in build-gate
tests and scripts, not to define a production Git abstraction.

## Source and Behaviour Research

This plan pins its load-bearing assumptions to current repository source,
locked versions, official documentation, and local runtime checks:

- `git status --short --branch` currently reports the branch as behind
  `origin/main` by one commit. `sem diff --from HEAD --to origin/main` shows
  protected docs/tests changes, so work item 0 must refresh the branch first.
- `grepai version` reports 0.35.0. GrepAI search on the canonical main index
  found the relevant build-gate Git support surfaces.
- `leta files` and `leta grep` verified branch-local build-gate symbols in the
  assigned worktree.
- `bun --version` reports 1.3.11, and `bun.lock` resolves
  `bun-types@1.3.14`, `@types/node@26.0.1`, `typescript@5.9.3`,
  `@biomejs/biome@2.5.1`, `oxlint@1.71.0`, `fast-check@4.8.0`, and
  `df12-lints@github:leynos/df12-lints#08ca59b`.
- `git --version` reports 2.53.0.
- The official Git `git-ls-files` documentation says `-c`/`--cached` shows
  tracked files by default when no other file-selection option is supplied;
  `-z` terminates path output with NUL and avoids pathname quoting; and
  `--full-name` forces repository-root-relative output when running from a
  subdirectory. This supports one helper that calls
  `git ls-files -z --full-name -- <pathspecs...>`.
- The official Node `child_process` documentation for `spawnSync` says it is
  synchronous, blocks until exit or termination, and supports options for
  `cwd`, `env`, `encoding`, `timeout`, `maxBuffer`, stdout, stderr, process
  status, and spawn errors. The same documentation describes child-process
  stdout and stderr as nullable or undefined when spawning fails, so the helper
  must not assume subprocess output is always present.
- The locked local source `node_modules/@types/node/child_process.d.ts`
  defines `SpawnSyncReturns<T>` with `status: number | null`, `error?: Error`,
  and string overloads for `spawnSync(..., { encoding: "utf8" })`. It does not
  express Bun's nullable output on failed spawn, so tests must pin the runtime
  behaviour the project relies on.
- A local Bun 1.3.11 runtime check showed `spawnSync` returns `stdout: null`
  and `stderr: null` for executable-not-found failures. The shared helper must
  normalize those values to empty strings.
- The official Bun test documentation says `bun test` runs JavaScript or
  TypeScript test files, supports snapshots and path filters, and exits
  non-zero when a test fails. This supports focused Red-Green-Refactor commands
  such as `bun test ./tests/build-gate/git-support.test.ts`.
- `docs/issues/audit-2.1.7.md` finding 2 states that build-gate Git helpers are
  duplicated and proposes a narrow `tests/build-gate/git-support.ts` module
  owning `GitCommandResult`, prompt-disabled bounded Git execution,
  `lsTrackedFiles`, temporary repository setup, repository-relative writes,
  commits, and CLI output capture while leaving feature policy in gate modules.
- `docs/developers-guide.md` "Commit Gate" documents `make all`,
  `make whitespace-hygiene`, `make branch-freshness`, and Markdown gate
  expectations.
- `docs/repository-layout.md` "Tooling boundaries" makes the Makefile the
  validation entry point and describes `tests/build-gate/` as part of the full
  gate.

## Documentation and Skill Trail

Read these before implementing each work item:

- `AGENTS.md` sections "Code Style and Structure", "Change Quality &
  Committing", "Refactoring Heuristics & Workflow", "Markdown Guidance", and
  "TypeScript Guidance".
- `docs/terms-of-reference.md` sections 1 "Purpose", 2 "Domain", 6 "Goals",
  7 "Non-goals", and 9 "Constraints".
- `docs/technical-design.md` sections 2 "Goals and non-goals",
  3 "Evidence and prior art", 5 "Static-analysis boundary", and
  6 "Architecture".
- `docs/adr/0001-static-analysis-boundary.md` sections "Decision" and
  "Consequences".
- `docs/developers-guide.md` sections "Commit Gate", "Tests", "Markdown", and
  "Documentation Upkeep".
- `docs/users-guide.md` sections "Command shape", "Exit codes", and
  "Current non-goals" for context on user-visible command behaviour.
- `docs/repository-layout.md` sections "Top-level files and directories",
  "Test and fixture boundaries", and "Tooling boundaries".
- `docs/scripting-standards.md` section "Plumbum: command calling and
  pipelines" as process-execution precedent, even though this TypeScript task
  uses `spawnSync` instead of Python Plumbum.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections
  "Relation to separation of concerns and command query responsibility
  segregation" and "Avoiding spaghetti code turning into ravioli code".
- `docs/documentation-style-guide.md` sections "Spelling", "Markdown rules",
  "Formatting", and "Roadmap task writing guidelines".
- `docs/roadmap.md` task 1.5.5 and its prerequisites 1.5.1, 1.5.2, and 1.5.4.
- `docs/issues/audit-2.1.7.md` finding 2.
- Official documentation:
  <https://git-scm.com/docs/git-ls-files>,
  <https://nodejs.org/api/child_process.html#child_processspawnsynccommand-args-options>,
  and <https://bun.com/docs/test>.
- Locked local type source:
  `node_modules/@types/node/child_process.d.ts`.

Use these skills:

- `execplans` for maintaining this living plan.
- `grepai` for canonical-main intent search.
- `leta` for branch-local TypeScript navigation and reference checks.
- `sem` for entity-level history or diff navigation if needed.
- `firecrawl-mcp` when refreshing official external documentation cited above.
- `biome-typescript` if Biome configuration or lint behaviour becomes
  load-bearing during implementation.

No TypeScript router skill is installed in this session. Use `leta` for
TypeScript navigation and the repository's TypeScript guidance in `AGENTS.md`.

## Plan of Work

### Work Item 0: Refresh from Origin/Main and Re-Baseline Evidence

Implements:

- `AGENTS.md` "Tooling Defaults" and "Change Quality & Committing" by
  validating against current repository gates.
- `docs/developers-guide.md` "Commit Gate" by aligning the branch with the
  current integration target before code work.
- `docs/roadmap.md` task 1.5.5 dependency on current completed prerequisite
  tasks.

Load skills: `execplans`, `grepai`, `leta`, and `sem`.

Steps:

1. Run:

   ```sh
   pwd
   git status --short --branch
   git fetch origin
   sem diff --from HEAD --to origin/main
   ```

2. If the branch is behind `origin/main`, run:

   ```sh
   git rebase origin/main
   ```

   If rebase conflicts touch protected docs/tests from `origin/main`, resolve
   by preserving canonical `origin/main` content unless this task's existing
   ExecPlan file has a direct, intentional edit. If rebase cannot complete
   without changing product scope, stop and record the conflict.

3. Recompute branch-local evidence after the refresh:

   ```sh
   grepai search --workspace Projects --project odw-lint \
     "build gate Git support helper seam" --toon --compact --limit 8
   leta files
   leta grep "tracked|Git|git|repo|capture|commit|write|run" \
     tests/build-gate \
     -k function,method,type,interface,variable,const \
     --docs \
     --head 160
   sem diff --from origin/main --to HEAD
   ```

4. Update this ExecPlan's living sections with refreshed branch status,
   surprising conflicts, and any changed source evidence.

Validation:

```sh
mdtablefix docs/execplans/roadmap-1-5-5.md
markdownlint-cli2 --fix docs/execplans/roadmap-1-5-5.md
make all
make markdownlint
make nixie
```

Commit this documentation-only refresh independently if it produces a plan
change.

### Work Item 1: Introduce Shared Git Command and Tracked-File Support

Implements:

- `docs/roadmap.md` task 1.5.5 success criterion that build-gate tests
  exercise one documented Git support helper.
- `docs/issues/audit-2.1.7.md` finding 2's proposed `git-support.ts` seam for
  `GitCommandResult`, bounded prompt-disabled Git execution, and tracked-file
  listing.
- `AGENTS.md` "Abstraction / adapter / helper policy" by sweeping existing
  helpers first and documenting ownership.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` guidance on
  separation of concerns and avoiding over-granular helpers.

Load skills: `execplans`, `grepai`, `leta`, and `firecrawl-mcp` if Git, Node,
or Bun behaviour citations need refreshing.

Red:

1. Add `tests/build-gate/git-support.test.ts` with tests for:
   - `parseNulSeparatedPaths` parses trailing and non-trailing NUL-separated
     output.
   - `lsTrackedFiles` calls an injected runner with
     `["ls-files", "-z", "--full-name"]` when no pathspecs are supplied.
   - `lsTrackedFiles` appends `["--", "src", "tests"]` when pathspecs are
     supplied.
   - non-zero Git status and spawn errors become stable project-owned errors
     that include the rendered command and stderr or error message.
   - `createGitRunner` disables terminal prompts with
     `GIT_TERMINAL_PROMPT=0`, uses UTF-8 string output, applies a bounded
     timeout, preserves `status` and `error`, and normalizes nullable
     `stdout`/`stderr` from `spawnSync` to empty strings.
2. Run:

   ```sh
   bun test ./tests/build-gate/git-support.test.ts
   ```

   Expect failure because `tests/build-gate/git-support.ts` does not exist.

Green:

1. Add `tests/build-gate/git-support.ts` with:
   - `GitCommandResult`, containing `status`, `stdout`, `stderr`, and optional
     `error`; `stdout` and `stderr` must be strings because the helper owns
     `result.stdout ?? ""` and `result.stderr ?? ""` normalization.
   - `GitRunner`, containing `run(args)`.
   - `export function createGitRunner(repositoryPath: string): GitRunner`.
   - `export function runGit(...)`.
   - `export function parseNulSeparatedPaths(...)`.
   - `export function lsTrackedFiles(...)`.
   - `export function assertGitCommandSucceeded(...)` only if both
     `lsTrackedFiles` and fixture helpers need the same conversion; otherwise
     keep the assertion private and test it through `lsTrackedFiles`.
2. Keep `gitCommandTimeoutMs` private unless tests need an exported named
   constant to assert the exact value. The value must remain 30,000 ms.
3. Run:

   ```sh
   bun test ./tests/build-gate/git-support.test.ts
   ```

   Expect all new tests to pass.

Refactor and validation:

```sh
bunx @biomejs/biome format --write tests/build-gate/git-support.ts tests/build-gate/git-support.test.ts
mdtablefix docs/execplans/roadmap-1-5-5.md
markdownlint-cli2 --fix docs/execplans/roadmap-1-5-5.md
bun test ./tests/build-gate/git-support.test.ts
make all
make markdownlint
make nixie
```

Commit this work item independently after the focused test and gates pass.

### Work Item 2: Move Tracked-File Listing Callers onto the Shared Seam

Implements:

- `docs/roadmap.md` task 1.5.5's requirement to share tracked-file listing
  while preserving each gate's feature-specific policy.
- `docs/developers-guide.md` "Commit Gate" contracts for file-size and
  whitespace hygiene gates.
- `AGENTS.md` "Testing" guidance for deterministic unit and command-line
  behaviour tests.

Load skills: `execplans`, `grepai`, and `leta`.

Red:

1. Update `tests/build-gate/file-size-support.test.ts` so the injected runner
   contract uses `GitRunner` from `./git-support`, and so the test proves
   `trackedSourceAndTestTypeScriptFiles` still passes `["src", "tests"]` as
   pathspecs to shared tracked-file listing.
2. Update `tests/build-gate/whitespace-hygiene.test.ts` so a focused assertion
   proves `runWhitespaceHygieneCli` still scans all tracked files through the
   shared listing contract.
3. Move NUL parsing expectations from
   `tests/build-gate/whitespace-hygiene-support.test.ts` to
   `tests/build-gate/git-support.test.ts`, because NUL parsing becomes
   Git-support policy.
4. Run:

   ```sh
   bun test \
     ./tests/build-gate/git-support.test.ts \
     ./tests/build-gate/file-size-support.test.ts \
     ./tests/build-gate/whitespace-hygiene-support.test.ts \
     ./tests/build-gate/whitespace-hygiene.test.ts
   ```

   Expect failure because feature modules still use local result shapes or
   local `spawnSync` listing.

Green:

1. In `tests/build-gate/file-size-support.ts`, remove the local
   `GitFileListingResult`, `GitFileListingRunner`, `runGitFileListing`,
   `assertGitFileListingSucceeded`, and local `parseNulSeparatedPaths`
   definitions. Import `GitRunner` and `lsTrackedFiles`, and keep
   `trackedSourceAndTestTypeScriptFiles` as the feature-policy wrapper that
   filters `src/` and `tests/` TypeScript paths.
2. In `tests/build-gate/whitespace-hygiene.ts`, remove the local
   `GitFileListingResult`, `runGitFileListing`, and
   `assertGitFileListingSucceeded` definitions. Import `lsTrackedFiles`, and
   keep `trackedRepositoryFiles` or an equivalent private helper as the
   feature-policy wrapper that asks for all tracked repository files.
3. In `tests/build-gate/whitespace-hygiene-support.ts`, remove
   `parseNulSeparatedPaths`. Its NUL parsing coverage must live in
   `git-support.test.ts`.
4. Preserve all existing user-facing whitespace and file-size error messages
   except where the message is explicitly about the shared Git command. Update
   snapshots only after confirming changed text reflects the new helper
   contract.

Refactor and validation:

```sh
bunx @biomejs/biome format --write \
  tests/build-gate/file-size-support.ts \
  tests/build-gate/file-size-support.test.ts \
  tests/build-gate/git-support.test.ts \
  tests/build-gate/whitespace-hygiene.ts \
  tests/build-gate/whitespace-hygiene-support.ts \
  tests/build-gate/whitespace-hygiene-support.test.ts \
  tests/build-gate/whitespace-hygiene.test.ts
mdtablefix docs/execplans/roadmap-1-5-5.md
markdownlint-cli2 --fix docs/execplans/roadmap-1-5-5.md
bun test \
  ./tests/build-gate/git-support.test.ts \
  ./tests/build-gate/file-size-support.test.ts \
  ./tests/build-gate/whitespace-hygiene-support.test.ts \
  ./tests/build-gate/whitespace-hygiene.test.ts
make all
make markdownlint
make nixie
```

Commit this work item independently after the focused tests and gates pass.

### Work Item 3: Move Temporary Repositories and CLI Capture onto the Seam

Implements:

- `docs/roadmap.md` task 1.5.5's requirement to share temporary-repository
  setup and CLI output capture.
- `docs/issues/audit-2.1.7.md` finding 2's specific duplicated helper list.
- `docs/repository-layout.md` "Test and fixture boundaries" by keeping
  feature fixtures under `tests/build-gate/` and raw workflow fixtures out of
  scope.

Load skills: `execplans`, `grepai`, and `leta`.

Red:

1. Add tests to `tests/build-gate/git-support.test.ts` for:
   - `createTemporaryRepository` initializes a repository, configures
     deterministic commit identity, and returns a disposable repository path.
   - `writeRepositoryFile` writes string and `Buffer` content and creates
     parent directories.
   - `commitAll` stages and commits all current fixture changes.
   - `runFixtureGit` or the chosen fail-fast helper throws a diagnostic that
     includes the command, cwd, stdout, and stderr on non-zero exit.
   - `createCapturedCliOutput` captures stdout and stderr independently.
2. Run:

   ```sh
   bun test ./tests/build-gate/git-support.test.ts
   ```

   Expect failure because these generic fixture helpers are not implemented.

Green:

1. Extend `tests/build-gate/git-support.ts` with:
   - `CapturedCliOutput`, containing `stdout`, `stderr`, `writeOut`, and
     `writeErr`.
   - `export function createCapturedCliOutput(): CapturedCliOutput`.
   - `export function runFixtureGit(cwd: string, args: readonly string[]):
     void`.
   - `export function createTemporaryRepository(...)`.
   - `export function writeRepositoryFile(...)`.
   - `export function commitAll(repositoryPath: string, message?: string):
     void`.
2. Update `tests/build-gate/branch-freshness-git-runner.ts` by deleting it and
   importing `createGitRunner`, `GitCommandResult`, `GitRunner`, and `runGit`
   from `./git-support` at all call sites. If deletion causes a temporary
   compatibility bridge during editing, remove the bridge before this work item
   is committed.
3. Update `tests/build-gate/branch-freshness-git.ts` imports to use
   `./git-support`.
4. Update `tests/build-gate/branch-freshness-git-fixtures.ts` to import
   `runFixtureGit`, `writeRepositoryFile`, and `createCapturedCliOutput`.
   Keep `createGitFixture`, `commitMainChange`, `commitRoadmapChange`,
   `deleteMainRoadmap`, `renameMainPath`, `mergeMainIntoTask`, and
   `checkoutTaskBranch` in this file because they express branch-freshness
   fixture policy.
5. Update `tests/build-gate/whitespace-hygiene.test.ts` to import
   `createTemporaryRepository`, `writeRepositoryFile`, `commitAll`, and
   `createCapturedCliOutput` from `./git-support`.
6. Preserve branch-freshness CLI output and whitespace-hygiene CLI output
   snapshots unless the only changed text is a helper-owned error message that
   the Red tests already pin.

Refactor and validation:

```sh
bunx @biomejs/biome format --write \
  tests/build-gate/git-support.ts \
  tests/build-gate/git-support.test.ts \
  tests/build-gate/branch-freshness-git.ts \
  tests/build-gate/branch-freshness-git-fixtures.ts \
  tests/build-gate/whitespace-hygiene.test.ts
mdtablefix docs/execplans/roadmap-1-5-5.md
markdownlint-cli2 --fix docs/execplans/roadmap-1-5-5.md
bun test \
  ./tests/build-gate/git-support.test.ts \
  ./tests/build-gate/branch-freshness-git.test.ts \
  ./tests/build-gate/whitespace-hygiene.test.ts
make all
make markdownlint
make nixie
```

`tests/build-gate/branch-freshness-git-runner.ts` is deleted in this work
item, so do not include it in direct formatter commands. Use `make all` to
verify the final file graph.

Commit this work item independently after the focused tests and gates pass.

### Work Item 4: Document Helper Ownership and Close Out Task 1.5.5

Implements:

- `docs/developers-guide.md` "Documentation Upkeep".
- `docs/repository-layout.md` "Documentation tree" and "Tooling boundaries".
- `docs/documentation-style-guide.md` "Spelling", "Markdown rules",
  "Formatting", and "Roadmap task writing guidelines".
- `docs/roadmap.md` task 1.5.5 completion tracking.

Load skills: `execplans`, `grepai`, `leta` only if code references need
checking, and `sem` if reviewing the final entity-level diff is helpful.

Red:

No additional failing code test is expected for documentation close-out. The
observable contract comes from the tests added and preserved in work items 1,
2, and 3. Before editing docs, run:

```sh
bun test \
  ./tests/build-gate/git-support.test.ts \
  ./tests/build-gate/file-size-support.test.ts \
  ./tests/build-gate/whitespace-hygiene.test.ts \
  ./tests/build-gate/branch-freshness-git.test.ts
```

Expect all focused build-gate tests to pass.

Green:

1. Update `docs/developers-guide.md` under "Commit Gate" with a short
   maintainer note: build-gate Git command execution, tracked-file listing,
   fixture repository setup, repository-relative writes, commits, and captured
   CLI output live in `tests/build-gate/git-support.ts`; feature-specific
   policy stays in each gate module.
2. Update `docs/repository-layout.md` "Top-level files and directories" or
   "Tooling boundaries" so `tests/build-gate/` ownership names the shared Git
   support helper.
3. Update `docs/roadmap.md` to tick task 1.5.5 complete only after work items
   1 through 3 have passed gates.
4. Update this ExecPlan's `Progress`, `Surprises & Discoveries`,
   `Decision Log`, and `Outcomes & Retrospective` with final implementation
   evidence.

Validation:

```sh
mdtablefix docs/developers-guide.md docs/repository-layout.md docs/roadmap.md docs/execplans/roadmap-1-5-5.md
markdownlint-cli2 --fix docs/developers-guide.md docs/repository-layout.md docs/roadmap.md docs/execplans/roadmap-1-5-5.md
make all
make markdownlint
make nixie
```

Commit this work item independently after all gates pass.

## Concrete Steps

Run all commands from
`/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-5`.

1. Confirm the worktree and branch:

   ```sh
   pwd
   git status --short --branch
   ```

   Expected path:

   ```plaintext
   /data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-5
   ```

2. Complete work item 0 before touching TypeScript. Recompute source evidence
   after the refresh and update this plan.
3. Implement work item 1 using Red-Green-Refactor and commit it after its gates
   pass.
4. Implement work item 2 using Red-Green-Refactor and commit it after its gates
   pass.
5. Implement work item 3 using Red-Green-Refactor and commit it after its gates
   pass.
6. Implement work item 4 only after all code gates pass.
7. Before each commit, inspect the intended change:

   ```sh
   git status --short
   sem diff
   git diff -- tests/build-gate docs/developers-guide.md docs/repository-layout.md docs/roadmap.md docs/execplans/roadmap-1-5-5.md
   ```

8. Commit each work item separately after its gates pass. Use imperative,
   descriptive commit subjects and wrapped bodies.

## Validation and Acceptance

Acceptance requires all of the following observable behaviours:

- `bun test ./tests/build-gate/git-support.test.ts` passes and proves the
  shared helper owns Git command result mapping, prompt-disabled bounded Git
  execution, helper-owned normalization of nullable `spawnSync` stdout/stderr
  to strings, NUL-separated tracked-file parsing, tracked-file listing failure
  conversion, temporary repository setup, repository-relative writes, commits,
  and captured CLI output.
- `bun test ./tests/build-gate/file-size-support.test.ts` passes and proves
  file-size policy still filters tracked TypeScript paths under `src/` and
  `tests/` while using the shared tracked-file listing seam.
- `bun test ./tests/build-gate/whitespace-hygiene.test.ts` passes and proves
  whitespace hygiene still scans tracked non-binary files, ignores untracked
  files, preserves fixture bytes, and uses shared temporary repository and CLI
  capture helpers.
- `bun test ./tests/build-gate/branch-freshness-git.test.ts` passes and proves
  branch freshness still detects stale protected changes, preserves CLI
  output, and uses the shared Git runner and fixture helpers.
- `make all` exits 0 and includes build, formatting check, whitespace hygiene,
  lint, typecheck, and tests. On current `origin/main`, `make all` includes the
  `typecheck` target.
- `make markdownlint` exits 0 after Markdown changes.
- `make nixie` exits 0 after Markdown changes.
- No build-gate module other than `tests/build-gate/git-support.ts` imports
  `spawnSync` solely to run Git, parses `git ls-files -z` output, or owns a
  generic captured CLI output helper.

Expected final command sequence:

```sh
make all
make markdownlint
make nixie
```

Expected successful result:

```plaintext
all requested gates exit with status 0
```

## Idempotence and Recovery

The implementation steps are safe to repeat in the assigned worktree. If a Red
test fails for a reason other than the expected missing helper or mismatched
contract, stop and update `Surprises & Discoveries` before editing helper code.

Temporary repositories created by tests must be disposed with `rmSync(...,
{ recursive: true, force: true })` in `finally` blocks or through helper-owned
disposers. If a test aborts and leaves a temporary directory behind, delete
only directories under the OS temp path with prefixes introduced by
`git-support.ts`, such as `odw-lint-git-support-`,
`odw-lint-whitespace-`, or `odw-lint-branch-freshness-`.

If Markdown formatting creates unrelated churn, do not keep it. Revert only
the unrelated formatter edits after confirming they are outside the files
changed by the current work item. If a stash is unavoidable, name it using:

```sh
git stash push -m 'df12-stash v1 task=1.5.5 kind=discard reason="park unrelated formatter churn"'
```

## Artifacts and Notes

Current planning-round discovery commands and outcomes:

```plaintext
pwd
/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-5

git status --short --branch
## roadmap-1-5-5...origin/main [behind 1]

sem diff --from HEAD --to origin/main
Summary: 9 added, 3 modified across 4 files

bun --version
1.3.11

git --version
git version 2.53.0
```

The locked dependency evidence from `bun.lock` includes:

```plaintext
@biomejs/biome@2.5.1
@types/node@26.0.1
bun-types@1.3.14
df12-lints@github:leynos/df12-lints#08ca59b
fast-check@4.8.0
oxlint@1.71.0
typescript@5.9.3
```

Bun 1.3.11 spawn-failure evidence:

```plaintext
{
  "signal": null,
  "stdout": null,
  "stderr": null,
  "errorName": "Error",
  "errorCode": "ENOENT",
  "errorMessage": "Executable not found in $PATH: \"definitely-not-a-real-command-odw-lint\""
}
```

## Interfaces and Dependencies

At the end of work item 3, `tests/build-gate/git-support.ts` must be the only
generic build-gate Git support seam. Its intended interface is:

```typescript
export type GitCommandResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error?: Error;
};

export type GitRunner = {
  readonly run: (args: readonly string[]) => GitCommandResult;
};

export type CapturedCliOutput = {
  readonly stdout: string;
  readonly stderr: string;
  readonly writeOut: (message: string) => void;
  readonly writeErr: (message: string) => void;
};

export function createGitRunner(repositoryPath: string): GitRunner;
export function runGit(git: GitRunner, args: readonly string[]): GitCommandResult;
export function parseNulSeparatedPaths(output: string): readonly string[];
export function lsTrackedFiles(options?: {
  readonly repositoryPath?: string;
  readonly pathspecs?: readonly string[];
  readonly runGit?: GitRunner;
}): readonly string[];
export function createCapturedCliOutput(): CapturedCliOutput;
export function runFixtureGit(cwd: string, args: readonly string[]): void;
export function createTemporaryRepository(options?: {
  readonly prefix?: string;
  readonly initialBranch?: string;
  readonly userName?: string;
  readonly userEmail?: string;
}): string;
export function writeRepositoryFile(
  repositoryPath: string,
  path: string,
  content: string | Buffer,
): void;
export function commitAll(repositoryPath: string, message?: string): void;
```

`createGitRunner` and any helper that wraps `spawnSync` must convert
`result.stdout ?? ""` and `result.stderr ?? ""` before returning
`GitCommandResult` or rendering diagnostics. This is a project-owned contract,
not a claim about every runtime's `spawnSync` implementation.

Use no new external libraries. The implementation depends on:

- `node:child_process.spawnSync` for synchronous Git subprocess execution.
- `node:fs` helpers for temporary fixture file writes, reads, and cleanup.
- `node:os.tmpdir` and `node:path.join`/`dirname` for fixture paths.
- The Git CLI for `init`, `clone`, `config`, `add`, `commit`, `push`,
  `fetch`, `merge`, `checkout`, `mv`, `status`, and `ls-files`.
- Bun's built-in `bun:test` runner for unit and snapshot tests.

## Revision Note

Round 3 revision for roadmap task 1.5.5. It preserves the round 2 corrections
and resolves the remaining design-review blocker by adding
`tests/build-gate/git-support.test.ts` to work item 2's direct Biome formatter
file list, because that work item moves NUL parsing expectations into the
shared helper test. No implementation has started.
