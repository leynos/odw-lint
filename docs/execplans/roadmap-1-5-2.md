# Add a branch-freshness review guard for roadmap tasks

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 1.5.2 hardens roadmap-task review by detecting stale task branches
before their review diff presents newer `origin/main` documentation or test
work as deletions. The failure mode is common for long-lived roadmap branches:
the branch edits its own roadmap task block, `origin/main` advances nearby, and
a two-endpoint review diff from refreshed `origin/main` to the branch appears to
reverse unrelated main-branch work.

After this plan is implemented, a maintainer can run:

```sh
make branch-freshness
```

from a roadmap task branch. The target fetches current `origin/main`, verifies
whether that refreshed branch is already an ancestor of `HEAD`, and exits
non-zero with a reviewer-facing report when current `origin/main` contains
protected `docs/` or `tests/` changes outside the declared task scope that the
task branch does not contain by ancestry. This includes main-only protected
additions or edits that the task branch never touched, because a two-endpoint
review diff from current `origin/main` to the task branch would present those
newer paths as deletions. The guard is not an ODW workflow lint rule and must
not run workflow source. It is a repository review guard for roadmap task
branches.

Implementation must not begin until this draft is reviewed and approved.

## Constraints

- Work only in the git-donkey worktree for branch `roadmap-1-5-2`:
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-2`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as canonical. The guard must refresh it with:

  ```sh
  git fetch origin main:refs/remotes/origin/main
  ```

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
  symbols.
- Use `sem` instead of raw Git history or blame when codebase history
  navigation is needed. Ordinary `git fetch`, `git status`, and scoped diff
  commands remain acceptable for the guard itself.
- Read and obey `AGENTS.md`, `docs/terms-of-reference.md`,
  `docs/technical-design.md`, `docs/adr/0001-static-analysis-boundary.md`,
  `docs/developers-guide.md`, `docs/repository-layout.md`,
  `docs/scripting-standards.md`,
  `docs/complexity-antipatterns-and-refactoring-strategies.md`,
  `docs/documentation-style-guide.md`, and `docs/roadmap.md` before
  implementation. No `docs/users-guide.md` exists in this worktree.
- Use en-GB Oxford spelling in prose and comments. Preserve external API,
  command, and package names exactly.
- Keep each work item independently committable and gate-passable.
- Do not add or update package dependencies. The selected mechanism uses the
  existing Git CLI, Bun 1.3.11, Node-compatible built-ins, locked TypeScript
  gates, Biome, Oxlint, markdownlint, nixie, and Make targets.
- Do not add production `src/` code for this task. The expected code change is
  a build-gate support script/test plus Makefile and documentation wiring.
- Do not import executable ODW runtime paths. Do not execute workflow source,
  import workflow fixtures as modules, call ODW loader helpers, start ODW runs,
  or dispatch agents.
- Keep the guard path-specific. It protects `docs/**` and `tests/**`, with
  special line-level handling for `docs/roadmap.md`. It must not become a
  general merge-conflict detector for all files.
- Use an ancestry-first freshness model. If refreshed `origin/main` is not an
  ancestor of `HEAD`, any protected upstream change outside the declared task
  scope is stale, even when the task branch never touched that path. This
  intentionally treats "different protected paths changed on main and branch"
  as stale when the branch is behind current `origin/main`.
- Keep source and test files under 400 physical lines. Split support code and
  tests before either file approaches that limit.
- Format only changed files. Do not run repository-global mutating formatters
  such as `make fmt`, `bun fmt`, or `mdformat-all`.
- For Markdown files changed by each work item, run `mdtablefix` and
  `markdownlint-cli2 --fix` only on those exact paths before gates.
- Validation commands must be path-safe. Do not list optional files in
  formatter or linter commands unless the same work item definitely creates or
  edits them.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances

- Scope: stop and escalate if implementation needs production `src/` changes,
  a new package dependency, or changes outside `tests/build-gate/`, `Makefile`,
  and the relevant documentation.
- Public interface: stop and escalate if any exported package API or diagnostic
  contract must change.
- Git mechanism: stop and revise this plan if installed Git cannot express the
  guard with `fetch`, `merge-base`, `diff`, `show`, and `status`. Do not
  replace it with an unresearched workaround.
- Branch naming: stop and escalate if roadmap task branches are not named with
  the `roadmap-<dotted-task-with-hyphens>` convention and no explicit `--task`
  override is acceptable.
- Roadmap parsing: stop and escalate if `docs/roadmap.md` task blocks cannot be
  parsed from the current checkbox bullet structure without broad Markdown
  parsing or brittle whole-file assumptions.
- False positives: stop and escalate if the guard flags a branch that only
  changes its declared task block in `docs/roadmap.md` and task-scoped files
  while preserving newer protected main-branch work.
- False negatives: stop and escalate if the guard cannot flag a stale branch
  whose current `origin/main` contains protected docs, tests, or roadmap
  changes outside its task scope, including main-only protected paths the branch
  never touched.
- Test proof: stop and escalate if a red test cannot demonstrate the stale
  branch failure before the implementation passes.
- Gate attempts: stop and record options if `make all` still fails after three
  focused fix attempts in one work item.
- Formatting: if a formatter rewrites unrelated files, park that churn in a
  named discard stash using:

  ```sh
  git stash push -m 'df12-stash v1 task=1.5.2 kind=discard reason="formatter churn"' -- <paths>
  ```

  Then restore the intended file set and rerun only file-scoped formatting.

## Risks

- Risk: the guard becomes a generic merge-conflict tool and grows hard to
  review. Severity: medium. Likelihood: medium. Mitigation: limit protected
  scope to `docs/**` and `tests/**`, and keep the roadmap line-range exception
  as the only file-content rule.
- Risk: file-level overlap is too coarse for `docs/roadmap.md` because every
  task completion edits the same file. Severity: high. Likelihood: high.
  Mitigation: parse the declared task block and parse zero-context Git hunks so
  only changes outside that block fail the guard.
- Risk: the guard reports stale work before `origin/main` is actually current.
  Severity: high. Likelihood: medium. Mitigation: the runnable target must call
  `git fetch origin main:refs/remotes/origin/main` before analysis, and tests
  must use a local bare origin to prove that remote-tracking update.
- Risk: parsing ordinary newline-delimited Git path output breaks on unusual
  file names. Severity: medium. Likelihood: low. Mitigation: use `git diff
  --name-status -z` and `git status --porcelain=v1 -z` for machine-parsed path
  output.
- Risk: running this guard from a dirty worktree produces misleading results
  because it compares `HEAD` while the review work is unstaged. Severity:
  medium. Likelihood: medium. Mitigation: fail with a usage error when
  `git status --porcelain=v1 -z` reports tracked or untracked changes.
- Risk: a branch may have manually cherry-picked an upstream protected change
  without containing current `origin/main` by ancestry. Severity: low.
  Likelihood: low. Mitigation: keep the guard conservative; roadmap task 1.5.2
  is a branch-freshness guard, so the supported recovery is to rebase or merge
  current `origin/main` before review rather than prove patch equivalence.
- Risk: making the target part of `make all` would add network I/O and fail on
  non-roadmap branches. Severity: medium. Likelihood: high. Mitigation: add a
  dedicated `make branch-freshness` review target and document when to run it;
  keep `make all` deterministic and offline.
- Risk: future roadmap file formatting changes break the block parser.
  Severity: medium. Likelihood: medium. Mitigation: pin the accepted checkbox
  task-block shape in unit tests and cite the documentation style guide's
  roadmap formatting conventions.

## Progress

- [x] (2026-06-30 09:56Z) Confirmed this worktree is
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-2` on branch
  `roadmap-1-5-2`.
- [x] (2026-06-30 09:56Z) Loaded the `execplans`, `grepai`, `leta`, `sem`,
  `firecrawl-mcp`, `biome-typescript`, and `en-gb-oxendict-style` skills. No
  TypeScript router skill is available in this environment; `biome-typescript`
  is the relevant TypeScript tooling skill for this plan.
- [x] (2026-06-30 09:56Z) Used GrepAI intent searches against canonical `main`
  for roadmap freshness, review guard, and build-gate surfaces, then verified
  branch-local facts in this worktree with `leta`, exact text search, file
  inspection, and `sem`.
- [x] (2026-06-30 09:56Z) Read the governing terms of reference, technical
  design, ADR, developer guide, repository layout, scripting standards,
  complexity guide, documentation style guide, roadmap, AGENTS instructions,
  and neighbouring ExecPlan style.
- [x] (2026-06-30 09:56Z) Verified local tooling: Git 2.53.0, Bun 1.3.11,
  locked `@biomejs/biome` 2.5.1, `fast-check` 4.8.0, `oxlint` 1.71.0, and
  TypeScript 5.9.3 from `bun.lock`.
- [x] (2026-06-30 09:56Z) Verified official Git and Bun behaviours with
  Firecrawl and local command probes before selecting the mechanism.
- [x] (2026-06-30 09:56Z) Wrote the initial ExecPlan draft for roadmap task
  1.5.2.
- [x] (2026-06-30 10:14Z) Revised the ExecPlan after design review to make
  protected upstream changes outside the declared task scope stale whenever the
  task branch does not contain current `origin/main` by ancestry, and to split
  clean-tree freshness checks from dirty documentation close-out validation.
- [x] (2026-06-30 10:45Z) Work item 1: Add pure branch-freshness
  classification.
- [x] (2026-06-30 12:15Z) Work item 2: Add the Git-backed
  branch-freshness checker.
- [x] (2026-06-30 13:05Z) Work item 3: Wire the review target and
  maintainer documentation.
- [x] (2026-06-30 13:30Z) Work item 4: Close out roadmap task 1.5.2.

## Surprises & discoveries

- Observation: the repository already has a build-gate test surface.
  Evidence: `leta` verified `tests/build-gate/makefile.test.ts` symbols
  `createTemporaryProject`, `runMakeDryRun`, and `expectInstallScheduling`.
  Impact: add the branch-freshness guard next to existing build-gate tests
  instead of creating a new top-level tooling area.
- Observation: the stale roadmap failure mode is line-level, not file-level.
  Evidence: a throwaway Git probe in `/tmp` created a branch that changed only
  the 1.5.2 checkbox while `origin/main` changed the 1.5.3 checkbox; `git diff
  --unified=0 origin/main HEAD -- docs/roadmap.md` showed one intended hunk for
  1.5.2 and one stale reversal hunk for 1.5.3. Impact: `docs/roadmap.md` needs
  task-block-aware hunk classification.
- Observation: same-path overlap is too narrow for roadmap task 1.5.2.
  Evidence: a second throwaway Git probe in `/tmp` created a task branch that
  touched only `docs/roadmap.md` while current `origin/main` added
  `docs/upstream.md` and `tests/upstream.test.ts`; after fetching
  `origin/main`, `git merge-base --is-ancestor origin/main HEAD` exited 1,
  `git diff --name-status -z <merge-base> origin/main -- docs tests` reported
  those protected additions, and the two-endpoint diff from `origin/main` to
  `HEAD` reported them as deletions. Impact: classify protected upstream
  changes outside the declared task scope as stale unless current
  `origin/main` is an ancestor of `HEAD`.
- Observation: `git diff --name-status -z` is a suitable path-summary source
  for this guard. Evidence: the same local probe produced NUL-separated status
  and path fields such as `M`, `docs/roadmap.md`, `M`, and
  `tests/example.test.ts`. Impact: parse NUL fields instead of newline output.
- Observation: this task does not need the sibling ODW checkout. Evidence:
  the roadmap item concerns repository review freshness for docs and tests, not
  ODW loader, workflow, or example semantics. Impact: keep the implementation
  within build-gate tooling and do not import ODW runtime or fixture code.
- Observation: the first code slice stayed below the AGENTS.md file-size
  ceiling without splitting the support module. Evidence:
  `tests/build-gate/branch-freshness.ts` is 245 lines and
  `tests/build-gate/branch-freshness.test.ts` is 176 lines after
  file-scoped Biome formatting. Impact: keep the pure classifier and focused
  unit tests together for now, then reassess if the Git adapter pushes either
  file towards 400 lines.
- Observation: CodeRabbit correctly identified that roadmap hunk checks should
  use the post-change line range and fail closed when Git reports a roadmap
  path change but no hunk headers are available. Evidence: the second
  CodeRabbit pass on work item 1 returned major findings for `newStart` /
  `newLength` use and empty `roadmapHunks`. Impact: the pure classifier now
  uses current-roadmap hunk coordinates and treats missing hunk data as stale.
- Observation: pure roadmap hunk classification needs both old and new
  roadmap text. Evidence: the third CodeRabbit pass pointed out that deleting
  the first line of the declared task block has no new-side task range; focused
  tests now cover a zero-context hunk with `oldLength: 1` and `newLength: 0`.
  Impact: the classifier accepts hunk sides only when the side that changed is
  inside the matching old or new task block.
- Observation: work item 1 needed an early support-module split to stay below
  the file-size ceiling. Evidence: after the latest focused formatter run,
  `tests/build-gate/branch-freshness.ts` is 371 lines and report formatting
  lives in `tests/build-gate/branch-freshness-report.ts`. Impact: work item 2
  should add Git adapter or CLI support in separate build-gate modules rather
  than growing the classifier file.
- Observation: the Git adapter and temporary repository fixtures also needed
  separate modules to preserve the 400-line file-size ceiling. Evidence:
  after file-scoped Biome formatting, `tests/build-gate/branch-freshness-git.ts`
  is 366 lines, `tests/build-gate/branch-freshness-git-parsing.ts` is 59
  lines, `tests/build-gate/branch-freshness-git-runner.ts` is 57 lines,
  `tests/build-gate/branch-freshness-git-fixtures.ts` is 232 lines, and
  `tests/build-gate/branch-freshness-git.test.ts` is 275 lines after the
  CodeRabbit fixes. Impact: the runnable guard lives in the Git adapter module,
  Git-output parsing and Git command execution live in small focused modules,
  and the pure classifier remains dependency-light.
- Observation: temporary Git tests can prove the remote-tracking refresh
  contract without network access. Evidence:
  `bun test ./tests/build-gate/branch-freshness-git.test.ts` creates a bare
  local origin plus main and task clones, pushes new `origin/main` work, then
  verifies `git fetch origin main:refs/remotes/origin/main`, ancestry, dirty
  worktree, roadmap hunk, protected docs, protected tests, rename, skip, and
  explicit task override behaviours. Impact: no production `src/` changes or
  external dependencies are needed.
- Observation: the work item 2 CodeRabbit pass found two high-priority
  hardening gaps and two low-priority test or CLI polish gaps. Evidence:
  CodeRabbit reported missing-roadmap-blob handling, interactive Git prompt and
  hang risk, bare `--task` handling, and sync-only fixture disposal. Impact:
  the Git runner now disables terminal prompts and applies a timeout, missing
  historical roadmap blobs become empty text, the bare `--task` path returns a
  specific usage error, and the fixture helper supports future async test
  bodies.
- Observation: the Makefile dry-run test was enough to prove work item 3's
  wiring without invoking the networked branch-freshness target. Evidence:
  `tests/build-gate/makefile.test.ts` now dry-runs `make branch-freshness`,
  checks that it calls `bun run tests/build-gate/branch-freshness-git.ts`, and
  checks that it does not schedule `bun install`. Impact: the command remains a
  review helper outside `make all`.
- Observation: the new guard blocked close-out until this branch contained
  current protected `origin/main` work. Evidence: the pre-close-out
  clean-tree `make branch-freshness` run failed for upstream changes in
  `docs/contents.md`, `docs/developers-guide.md`,
  `docs/execplans/roadmap-1-5-1.md`, `docs/issues/audit-1.5.1.md`,
  `docs/roadmap.md`, and the file-size guard tests. Impact: merged
  `origin/main` before editing `docs/roadmap.md`, then reran the guard cleanly.
- Observation: the close-out edit happened only after branch freshness passed.
  Evidence: after merge commit `33dd17e`, `git status --porcelain=v1 -z`
  printed no bytes and `make branch-freshness` reported
  `Branch freshness check passed for roadmap task 1.5.2.` Impact: completing
  the roadmap checkbox did not mask stale upstream review work.

## Decision Log

- Decision: implement the guard as a dedicated review target,
  `make branch-freshness`, not as an always-on `make all` target. Rationale:
  roadmap task 1.5.2 asks for review or gate output, while `make all` should
  remain deterministic and should not fetch the network on every code gate.
  Date/Author: 2026-06-30 09:56Z / planning agent.
- Decision: use Git CLI commands instead of a Git library. Rationale: no
  dependency is needed, Git's official docs cover the required porcelain and
  plumbing behaviours, and local probes verified the relevant output shapes.
  Date/Author: 2026-06-30 09:56Z / planning agent.
- Decision: require a clean worktree for the runnable guard. Rationale: the
  guard compares committed branch state against refreshed `origin/main`; dirty
  state would make output ambiguous and could hide or invent stale deletions.
  Date/Author: 2026-06-30 09:56Z / planning agent.
- Decision: make ancestry the freshness boundary. Rationale: roadmap task
  1.5.2 is not limited to same-path conflicts; a branch behind current
  `origin/main` can present main-only protected docs or tests as deletions even
  when the branch changed different files. Therefore, after fetching, if
  `origin/main` is not an ancestor of `HEAD`, every protected upstream change
  outside the declared task scope is stale. Date/Author:
  2026-06-30 10:14Z / planning agent.
- Decision: use line-level hunk classification only for `docs/roadmap.md`.
  Rationale: roadmap task completion intentionally edits one shared file, while
  other protected docs and tests can be guarded at path level unless a later
  task proves a narrower content rule is needed. Date/Author:
  2026-06-30 09:56Z / planning agent.
- Decision: keep the guard under `tests/build-gate/` rather than `src/`.
  Rationale: task 1.5.2 hardens repository workflow review, not the public
  `odw-lint` analysis API described by the static-analysis design. Date/Author:
  2026-06-30 09:56Z / planning agent.
- Decision: close-out freshness checks must run only while the worktree is
  clean. Rationale: the guard deliberately exits 2 on any
  `git status --porcelain=v1 -z` output, so running it after editing
  `docs/roadmap.md` or this ExecPlan would validate the dirty-worktree
  precondition rather than branch freshness. Run the guard before close-out
  edits, then run it again only after the close-out commit restores a clean
  worktree. Date/Author: 2026-06-30 10:14Z / planning agent.
- Decision: the future `branch-freshness` Make target must not depend on
  `build`. Rationale: the guard is a review-surface freshness check and should
  still run when the ordinary build is broken; Bun can execute the checked-in
  TypeScript script with the already installed toolchain in a maintainer
  checkout. Date/Author: 2026-06-30 11:20Z / implementation agent.
- Decision: put the CLI entry point in
  `tests/build-gate/branch-freshness-git.ts` rather than the pure classifier
  module. Rationale: work item 1 left
  `tests/build-gate/branch-freshness.ts` close to the file-size ceiling, and
  separating Git execution from pure classification keeps the command boundary
  easier to test. Date/Author: 2026-06-30 12:15Z / implementation agent.
- Decision: do not update `docs/repository-layout.md` for work item 3.
  Rationale: the existing `tests/build-gate/` ownership and Makefile entries
  already describe repository workflow checks, and the new maintainer-facing
  behaviour is documented in `docs/developers-guide.md`. Date/Author:
  2026-06-30 13:05Z / implementation agent.

## Outcomes & retrospective

Implementation is complete. Work item 1 added the pure branch-freshness
classifier and focused Bun tests for branch/task parsing, task-scoped paths,
protected path detection, roadmap task-block parsing, zero-context hunk parsing,
stale protected upstream change classification, rename/copy path handling, and
reviewer-facing report formatting. Work item 2 added the Git-backed checker,
CLI exit mapping, NUL-delimited name-status parsing, zero-context roadmap diff
collection, and temporary local-origin integration tests. Work item 2
deterministic gates passed after the CodeRabbit fixes: `make all`,
`make markdownlint`, and `make nixie`. The second work item 2 CodeRabbit pass
completed with `findings:0`. Deterministic gates also passed after the
work-item 1 fixes: `make all`, `make markdownlint`, and `make nixie`. The
final work item 1 CodeRabbit pass completed with `findings:0`.
Work item 3 wired the `make branch-freshness` target, added Makefile dry-run
coverage, and documented the maintainer review guard. Its deterministic gates
passed: `make all`, `make markdownlint`, and `make nixie`; its CodeRabbit pass
completed with `findings:0`.
Work item 4 merged current `origin/main` after the new guard flagged stale
protected upstream work, reran `make branch-freshness` successfully on a clean
worktree, and marked roadmap task 1.5.2 complete. Its deterministic close-out
gates passed: `make all`, `make markdownlint`, and `make nixie`; its
CodeRabbit pass completed with `findings:0`.

## Context and orientation

The current repository is a private TypeScript and Bun package. The product
code lives under `src/diagnostics/` and `src/static-analysis/`; this task must
not modify those production modules. Repository workflow checks live under
`tests/build-gate/`, where `tests/build-gate/makefile.test.ts` already creates
temporary projects and uses `spawnSync` to dry-run Make targets.

The roadmap task to implement is `docs/roadmap.md` section 1.5.2:
"Add a branch-freshness review guard for roadmap tasks." Its success criterion
is that review or gate output flags stale task branches before they present
unrelated main-branch work as deletions. Section 1.5 frames this as
roadmap-workflow review hardening, not as part of the ODW static analyser.

The protected surfaces are:

- `docs/**`, because `docs/` is the repository knowledge base and source of
  truth under `AGENTS.md`, `docs/repository-layout.md`, and the developer
  guide.
- `tests/**`, because roadmap task 1.5.2 explicitly mentions test work and the
  repository's quality gate relies on the Bun test suite.
- `docs/roadmap.md`, with special handling because every roadmap task close-out
  may intentionally edit the same file.

The declared task scope for branch `roadmap-1-5-2` is task `1.5.2`.
Task-scoped files are:

- `docs/execplans/roadmap-1-5-2.md`
- `docs/issues/audit-1.5.2.md`
- the `1.5.2` task block in `docs/roadmap.md`

The guard should also accept an explicit task override for testability and
manual recovery:

```sh
bun run tests/build-gate/branch-freshness-git.ts --task 1.5.2
```

If no override is supplied, infer the task from the current branch name. For
`roadmap-1-5-2`, infer task id `1.5.2` and task slug `1-5-2`. On non-roadmap
branches, print a skip message and exit 0 because the target is a roadmap-task
review helper.

## Interfaces and dependencies

Use only existing tooling and standard command-line interfaces.

Git 2.53.0 is installed in this worktree. Official Git docs verified with
Firecrawl provide these load-bearing facts:

- `git fetch` updates remote-tracking branches and records fetched refs in
  `FETCH_HEAD`. Source: `https://git-scm.com/docs/git-fetch`, sections
  "DESCRIPTION" and "CONFIGURED REMOTE-TRACKING BRANCHES".
- `git merge-base` finds the best common ancestor for two commits, and
  `--is-ancestor` exits 0 when the first commit is an ancestor of the second
  and 1 when it is not. Source:
  `https://git-scm.com/docs/git-merge-base`, sections "DESCRIPTION" and
  "OPERATION MODES".
- `git diff A...B` compares from the merge base to `B`; `--name-status` shows
  changed file names and status; `--diff-filter` selects statuses; `-z`
  NUL-terminates fields; pathspecs limit output to named files or directories.
  Source: `https://git-scm.com/docs/git-diff`, sections "DESCRIPTION",
  "OPTIONS", and "EXAMPLES".
- `git show <object>:<path>` can display plain blob contents for a commit/path
  expression. Source: `https://git-scm.com/docs/git-show`, sections
  "DESCRIPTION" and "OPTIONS".
- `git status --porcelain=v1 -z` is stable for scripts and NUL-terminates
  entries. Source: `https://git-scm.com/docs/git-status`, sections "OPTIONS"
  and "OUTPUT".

Local Git probes in `/tmp` verified the exact behaviours this guard relies on:

```plaintext
git diff --name-status -z <merge-base> origin/main -- docs tests
=> b'M\x00docs/roadmap.md\x00M\x00tests/example.test.ts\x00'

git diff --unified=0 --no-color --no-ext-diff origin/main HEAD -- docs/roadmap.md
=> @@ -3 +3 @@ for the intended 1.5.2 hunk
=> @@ -5 +5 @@ for the stale 1.5.3 reversal hunk

git merge-base --is-ancestor origin/main HEAD
=> exit 1 when the task branch is behind current origin/main

git diff --name-status -z <merge-base> origin/main -- docs tests
=> b'M\x00docs/roadmap.md\x00A\x00docs/upstream.md\x00A\x00tests/upstream.test.ts\x00'

git diff --name-status -z origin/main HEAD -- docs tests
=> b'M\x00docs/roadmap.md\x00D\x00docs/upstream.md\x00D\x00tests/upstream.test.ts\x00'
```

Bun 1.3.11 is installed in this worktree. Official Bun docs verified with
Firecrawl provide these load-bearing facts:

- `bun test` runs JavaScript and TypeScript tests with a Jest-like API, finds
  `*.test.ts` files recursively, and accepts focused file paths and
  `--test-name-pattern` filters. Source: `https://bun.com/docs/test`, sections
  "Run tests" and "Snapshot testing".
- Bun documents `node:child_process` as partially implemented, and the missing
  pieces do not affect `spawnSync`; `node:fs` and `node:path` are documented as
  implemented. Source: `https://bun.com/docs/runtime/nodejs-compat`, sections
  `node:child_process`, `node:fs`, and `node:path`.

Branch-local source evidence confirms the Bun/Node pattern is already used in
this repository: `tests/build-gate/makefile.test.ts` defines
`runMakeDryRun`, which calls `spawnSync("make", ...)` under Bun tests.

The selected TypeScript support module should expose these internal names from
`tests/build-gate/branch-freshness.ts`; names may be adjusted during
implementation if tests keep the same responsibilities:

```ts
export type BranchFreshnessResult =
  | { readonly status: "fresh"; readonly taskId: string }
  | { readonly status: "skipped"; readonly reason: string }
  | {
      readonly status: "stale";
      readonly taskId: string;
      readonly findings: readonly BranchFreshnessFinding[];
    }
  | { readonly status: "usage-error"; readonly message: string };

export type BranchFreshnessFinding = {
  readonly path: string;
  readonly reason: string;
  readonly detail: string;
};
```

The CLI entry point in the same file should map statuses to exit codes:

- `fresh`: exit 0.
- `skipped`: exit 0 with a short skip message.
- `stale`: exit 1 with one line per finding.
- `usage-error`: exit 2 with the usage or Git-precondition message.

## Plan of work

### Work item 1: Add pure branch-freshness classification

Create `tests/build-gate/branch-freshness.ts` with pure, dependency-light
classification helpers, and create
`tests/build-gate/branch-freshness.test.ts` with table-driven Bun unit tests.
Do not call Git in this work item.

The support module should include:

- branch/task parsing for `roadmap-1-5-2` and `--task 1.5.2`;
- task-scoped path checks for `docs/execplans/roadmap-1-5-2.md` and
  `docs/issues/audit-1.5.2.md`;
- protected path checks for `docs/**` and `tests/**`;
- a pure decision function that accepts an `isOriginMainAncestor` boolean and
  immediately returns `fresh` when current `origin/main` is already an ancestor
  of `HEAD`;
- protected-upstream-change classification for the non-ancestor case, where
  every upstream `docs/**` or `tests/**` path outside the task-scoped paths is
  stale even if the branch changed a different protected path or never touched
  that path;
- roadmap task-block line-range parsing for checkbox bullets like
  `- [ ] 1.5.2. ...` and `- [x] 1.5.2. ...`;
- zero-context hunk-header parsing for Git headers such as
  `@@ -5 +5 @@` and `@@ -10,2 +10,3 @@`;
- a pure function that classifies upstream roadmap hunks as inside or outside
  the declared task block on `origin/main`.

Documentation and skills to read before this item:

- `docs/roadmap.md` section 1.5.2.
- `docs/documentation-style-guide.md` "Roadmap task writing guidelines" and
  "Roadmap formatting conventions".
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 4.A
  and 5.A for small functions, guard clauses, and separation of concerns.
- `AGENTS.md` "Code Style and Structure" and "TypeScript Guidance".
- Skills: `leta`, `grepai`, `biome-typescript`, and
  `en-gb-oxendict-style`.

Tests to add:

- unit tests for valid and invalid roadmap branch names;
- unit tests for explicit task override parsing;
- unit tests for task-scoped path acceptance and protected path detection;
- unit tests proving `isOriginMainAncestor: true` is fresh even when protected
  upstream changes are supplied, because the branch already contains current
  `origin/main`;
- unit tests proving `isOriginMainAncestor: false` plus an upstream
  `docs/**` or `tests/**` addition outside task scope is stale even when the
  branch changed no matching path;
- unit tests proving different protected paths changed on main and branch are
  stale when the branch is behind current `origin/main`;
- unit tests for task block parsing with continuation lines;
- unit tests for hunk headers with omitted lengths and explicit lengths;
- unit tests proving an upstream 1.5.2 hunk is accepted and an upstream 1.5.3
  hunk is rejected when current `origin/main` is not an ancestor of `HEAD`.

Red-Green-Refactor validation:

1. Red: add the tests first and run:

   ```sh
   bun test ./tests/build-gate/branch-freshness.test.ts
   ```

   Expect failures for missing helpers or failing assertions.
2. Green: implement the smallest pure helpers and rerun the same focused test.
   Expect it to pass.
3. Refactor: simplify helper boundaries without changing behaviour, then run:

   ```sh
   bun test ./tests/build-gate/branch-freshness.test.ts
   make all
   ```

   Expect both commands to pass.

No Markdown files are changed in this work item unless the ExecPlan progress is
updated. If this ExecPlan is updated, run:

```sh
mdtablefix docs/execplans/roadmap-1-5-2.md
markdownlint-cli2 --fix docs/execplans/roadmap-1-5-2.md
make markdownlint
make nixie
```

### Work item 2: Add the Git-backed branch-freshness checker

Extend `tests/build-gate/branch-freshness.ts` with the Git adapter and CLI
entry point. Keep command execution behind a small function so tests can run
against temporary local repositories and so pure classification remains easy
to test.

The checker must:

- fail with `usage-error` if `git status --porcelain=v1 -z` is non-empty;
- skip with exit 0 on non-roadmap branches when no `--task` override is
  supplied;
- run `git fetch origin main:refs/remotes/origin/main` before analysis;
- run `git merge-base --is-ancestor origin/main HEAD` after fetching and
  return `fresh` immediately when current `origin/main` is already contained in
  the task branch;
- compute the merge base between `HEAD` and `origin/main` only for the
  non-ancestor case;
- collect upstream protected changes with
  `git diff --name-status -z <merge-base> origin/main -- docs tests`;
- parse `R*` and `C*` `--name-status -z` records as source and destination
  path pairs, preserving the destination as the primary classified path while
  still considering both paths for protected-surface filtering;
- read `docs/roadmap.md` from `origin/main` with `git show` when upstream
  changed the roadmap;
- classify `docs/roadmap.md` with the task-block and hunk parser from work
  item 1;
- flag every upstream protected path outside task-scoped paths as stale in the
  non-ancestor case, including upstream paths the task branch never touched;
- print deterministic findings that include the path, the reason, and the
  recovery action: fetch/rebase or merge current `origin/main` before review.

Documentation and skills to read before this item:

- `docs/developers-guide.md` "Commit Gate", "Bun Scripts", and "Tests".
- `docs/repository-layout.md` "Tooling boundaries" and "Test and fixture
  boundaries".
- `docs/scripting-standards.md` "Language and runtime", "Testing
  expectations", and "Operational guidelines"; adapt the intent to TypeScript
  because repository tooling uses Bun for TypeScript scripts.
- Official Git docs listed in `Interfaces and dependencies`.
- Official Bun docs listed in `Interfaces and dependencies`.
- Skills: `leta`, `grepai`, `sem`, `firecrawl-mcp`, `biome-typescript`, and
  `en-gb-oxendict-style`.

Tests to add or update:

- integration tests that create a temporary bare origin and two working clones;
- a passing test for a fresh roadmap branch whose protected branch changes are
  limited to task-scoped files and the declared roadmap task block after it
  contains current `origin/main` by ancestry;
- a failing test for a stale branch where current `origin/main` changed another
  roadmap task block and the branch did not contain current `origin/main`;
- a failing test for a stale branch where current `origin/main` added or edited
  a protected `docs/**` file outside task scope that the branch never touched;
- a failing test for a stale branch where current `origin/main` added or edited
  a protected `tests/**` file outside task scope that the branch never touched;
- a failing test for unrelated protected paths where current `origin/main` and
  the task branch changed different files, because the branch is still behind
  current `origin/main` and would present the main-only protected path as a
  deletion;
- a failing test for a stale rename or copy where an `R*` or `C*`
  `--name-status -z` record has a protected destination outside task scope;
- a passing test for a behind branch where current `origin/main` changed only a
  task-scoped path or only the declared task block in `docs/roadmap.md`;
- a usage-error test for a dirty worktree;
- a skip test for non-roadmap branches without an explicit task override.

Red-Green-Refactor validation:

1. Red: add the temporary-repository tests before the Git adapter is complete
   and run:

   ```sh
   bun test ./tests/build-gate/branch-freshness.test.ts
   ```

   Expect the main-only protected addition, unrelated protected path, stale
   roadmap hunk, and dirty-worktree cases to fail for the missing checker
   behaviour.
2. Green: implement the Git adapter and CLI mapping, then rerun the focused
   test. Expect it to pass.
3. Refactor: clean up command parsing and output formatting, then run:

   ```sh
   bun test ./tests/build-gate/branch-freshness.test.ts
   make all
   ```

   Expect both commands to pass.

No Markdown files are changed in this work item unless the ExecPlan progress is
updated. If this ExecPlan is updated, run:

```sh
mdtablefix docs/execplans/roadmap-1-5-2.md
markdownlint-cli2 --fix docs/execplans/roadmap-1-5-2.md
make markdownlint
make nixie
```

### Work item 3: Wire the review target and maintainer documentation

Add a Make target named `branch-freshness` and document it for maintainers.
The target should run the Bun script directly without a `build` prerequisite,
so freshness review remains available when the ordinary build is broken:

```make
branch-freshness: ## Check roadmap task branch freshness
	bun run tests/build-gate/branch-freshness.ts
```

Update `tests/build-gate/makefile.test.ts` so the build-gate test suite proves
that the new target is documented and wired through Bun. Keep this test focused
on Makefile wiring; the branch freshness behaviour remains covered by
`branch-freshness.test.ts`.

Update `docs/developers-guide.md` to explain when maintainers should run:

```sh
make branch-freshness
```

The documentation should say it is a roadmap-task review guard that refreshes
`origin/main`, checks `docs/**` and `tests/**`, and fails when a task branch
would present unrelated newer main-branch work as deletions.

Update `docs/repository-layout.md` only if the new build-gate script changes
path ownership enough that the existing `tests/build-gate/` and Makefile
entries are incomplete. If no update is needed, record that decision in this
ExecPlan's `Decision Log`.

Documentation and skills to read before this item:

- `AGENTS.md` "Documentation Maintenance", "Tooling Defaults", and "Change
  Quality & Committing".
- `docs/developers-guide.md` "Commit Gate", "Bun Scripts", "Tests",
  "Markdown", and "Documentation Upkeep".
- `docs/repository-layout.md` "Tooling boundaries".
- `docs/documentation-style-guide.md` "Developer's guide" and Markdown rules.
- Skills: `leta`, `grepai`, `sem`, `biome-typescript`, and
  `en-gb-oxendict-style`.

Tests to add or update:

- update `tests/build-gate/makefile.test.ts` to include the new Make target in
  the target type and add a test that a dry run of `make branch-freshness`
  contains `bun run tests/build-gate/branch-freshness.ts`;
- no behavioural, property, snapshot, or e2e test is needed beyond the
  temporary Git integration tests from work item 2 because this item only wires
  the command and documentation.

Validation:

```sh
bun test ./tests/build-gate/makefile.test.ts
bun test ./tests/build-gate/branch-freshness.test.ts
mdtablefix docs/developers-guide.md docs/execplans/roadmap-1-5-2.md
markdownlint-cli2 --fix docs/developers-guide.md docs/execplans/roadmap-1-5-2.md
make all
make markdownlint
make nixie
```

If `docs/repository-layout.md` is also edited in this work item, include it in
the two file-scoped formatter commands:

```sh
mdtablefix docs/developers-guide.md docs/repository-layout.md docs/execplans/roadmap-1-5-2.md
markdownlint-cli2 --fix docs/developers-guide.md docs/repository-layout.md docs/execplans/roadmap-1-5-2.md
```

### Work item 4: Close out roadmap task 1.5.2

After the guard and documentation pass, finish work item 3 as a clean,
gate-passing commit. Then verify that the worktree is clean and run the new
review guard before marking the roadmap task complete:

```sh
git status --porcelain=v1 -z
git fetch origin main:refs/remotes/origin/main
make branch-freshness
```

`git status --porcelain=v1 -z` must print no bytes. If it prints anything,
finish, commit, or intentionally discard the previous work item before running
the guard. `make branch-freshness` must run while the worktree is clean because
the guard deliberately exits 2 on dirty tracked or untracked state.

If the guard reports stale protected work, stop and rebase or merge
`origin/main` before editing `docs/roadmap.md`. Do not complete the roadmap
checkbox on a stale branch.

Then update `docs/roadmap.md` so task 1.5.2 changes from `[ ]` to `[x]`.
Update this ExecPlan's `Progress`, `Decision Log`, and
`Outcomes & Retrospective` with final validation evidence. Do not run
`make branch-freshness` again while those documentation files are dirty. After
the close-out documentation commit is created and the worktree is clean again,
rerun `make branch-freshness` as a post-commit review guard before pushing or
requesting review.

Documentation and skills to read before this item:

- `docs/roadmap.md` section 1.5.2.
- `docs/documentation-style-guide.md` "Roadmap task writing guidelines".
- `docs/developers-guide.md` "Documentation Upkeep".
- `AGENTS.md` "Change Quality & Committing" and "Markdown Guidance".
- Skills: `leta`, `grepai`, `sem`, and `en-gb-oxendict-style`.

Tests and validation:

```sh
mdtablefix docs/roadmap.md docs/execplans/roadmap-1-5-2.md
markdownlint-cli2 --fix docs/roadmap.md docs/execplans/roadmap-1-5-2.md
make all
make markdownlint
make nixie
```

After committing the close-out documentation and returning to a clean
worktree, run:

```sh
git status --porcelain=v1 -z
make branch-freshness
```

Expect `git status --porcelain=v1 -z` to print no bytes and
`make branch-freshness` to exit 0. If it exits 1, rebase or merge current
`origin/main`, rerun the non-network gates and the clean-tree freshness check,
then amend or add a follow-up close-out commit. If it exits 2, fix the reported
usage precondition before treating close-out as complete.

Expected observable result:

- The pre-close-out and post-commit clean-tree `make branch-freshness` runs
  exit 0 after the branch contains current `origin/main` or current
  `origin/main` has no protected upstream changes outside task 1.5.2.
- `make all` passes.
- `make markdownlint` passes.
- `make nixie` validates all Mermaid diagrams.
- The only intentional `docs/roadmap.md` change in this work item is the
  1.5.2 checkbox.

## Concrete steps

All commands run from:

```sh
cd "$ROADMAP_1_5_2_WORKTREE"
```

Before work item 1, refresh orientation:

```sh
grepai search --workspace Projects --project odw-lint "roadmap branch freshness review guard" --toon --compact
leta files tests/build-gate
sem diff --from origin/main --to HEAD --format json
```

For each TypeScript work item, use `leta grep` and `leta show` for branch-local
symbol checks before editing known code symbols. Exact text search is
acceptable for Makefile target names and Markdown headings.

Use Red-Green-Refactor in each code-bearing item:

1. Write or update the focused test.
2. Run the focused `bun test ./tests/build-gate/...` command and observe the
   expected failure.
3. Implement the smallest code change.
4. Rerun the focused test and then `make all`.
5. Commit the work item only after its gates pass.

Do not run global mutating formatters. Use the path-specific formatter commands
listed under each work item.

## Validation and acceptance

The completed change is accepted when:

- `make branch-freshness` exists and runs the Bun branch-freshness script.
- A stale roadmap branch fixture that reverses a newer `origin/main` roadmap
  task block fails with exit code 1 and a finding for `docs/roadmap.md`.
- A stale branch fixture where current `origin/main` added or edited a
  protected docs file outside task scope and the branch never touched that path
  fails with exit code 1 and a finding for the docs path.
- A stale branch fixture where current `origin/main` added or edited a
  protected test file outside task scope and the branch never touched that path
  fails with exit code 1 and a finding for the test path.
- A stale branch fixture where current `origin/main` and the task branch
  changed different protected paths fails with exit code 1, because the branch
  is behind current `origin/main`.
- A branch that already contains current `origin/main` by ancestry passes when
  its protected changes are limited to task `1.5.2`.
- A non-roadmap branch without `--task` exits 0 with a skip message.
- A dirty worktree exits 2 with a usage error.
- `docs/developers-guide.md` explains when to run the review guard.
- `docs/roadmap.md` marks task 1.5.2 complete only after the guard and gates
  pass.

The final pre-close-out validation commands are:

```sh
git status --porcelain=v1 -z
make branch-freshness
```

The final post-edit validation commands are:

```sh
make all
make markdownlint
make nixie
```

After the close-out documentation commit returns the worktree to a clean state,
run the post-commit review guard:

```sh
git status --porcelain=v1 -z
make branch-freshness
```

`make branch-freshness` may fail with exit 1 by design if the branch is
genuinely stale. In that case, rebase or merge current `origin/main`, rerun the
target on a clean worktree, and only then proceed to review. It may fail with
exit 2 if the worktree is dirty; that is a usage error, not a freshness result.

## Idempotence and recovery

The branch-freshness target is safe to rerun. It updates only
`refs/remotes/origin/main` and `FETCH_HEAD` through the explicit fetch command.
It does not modify working-tree files.

Temporary Git repositories created by tests must live under the system temp
directory and be removed in `finally` blocks. Tests must configure local Git
user name and email inside those temporary repositories only.

If implementation leaves the worktree dirty after a failed experiment, inspect
the changed paths and remove only the experiment's own changes. Do not reset or
checkout unrelated user changes. If a formatter rewrites unrelated files, park
that churn in a named discard stash as described in `Tolerances`.

If the guard reports stale protected work during the pre-close-out check, do
not edit `docs/roadmap.md`. Rebase or merge current `origin/main`, rerun
`make branch-freshness` on a clean worktree, and continue only once the target
exits 0. If the post-commit clean-tree guard reports stale work, repeat the
same recovery and amend or add a follow-up close-out commit after the ordinary
gates pass again.

## Artifacts and notes

The local Git probe that informed this plan produced this representative stale
roadmap diff:

```plaintext
@@ -3 +3 @@
-- [ ] 1.5.2. Add branch-freshness review guard for roadmap tasks.
+- [x] 1.5.2. Add branch-freshness review guard for roadmap tasks.
@@ -5 +5 @@
-- [x] 1.5.3. Add a public API removal guard for package exports.
+- [ ] 1.5.3. Add a public API removal guard for package exports.
```

The first hunk is inside the declared task scope. The second hunk is the stale
deletion that this guard must flag.

## Revision note

- 2026-06-30 09:56Z: Initial ExecPlan draft for roadmap task 1.5.2. It
  selects a Git-backed dedicated review target, pins the load-bearing Git and
  Bun behaviours, and decomposes the task into four independently committable
  work items.
- 2026-06-30 10:14Z: Revised the detection model and close-out workflow after
  design review. Protected upstream docs, tests, and roadmap changes outside
  the declared task scope are now stale whenever the task branch does not
  contain current `origin/main` by ancestry, including main-only paths the
  branch never touched. Close-out now runs `make branch-freshness` only before
  documentation edits and after the close-out commit restores a clean worktree.
- 2026-06-30 13:55Z: Corrected the final ExecPlan status and retrospective
  wording after operator recovery review found the branch otherwise complete.
