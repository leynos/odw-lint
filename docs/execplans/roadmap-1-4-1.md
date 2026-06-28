# Make dependency installation sensitive to lockfile changes

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 1.4.1 hardens the repository build gate so dependency
installation is refreshed when either committed package input changes:
`package.json` or `bun.lock`. Today the branch-local `Makefile` declares
`node_modules: package.json`, so a lockfile-only dependency update can leave
`make build`, `make lint`, `make typecheck`, `make test`, and `make all` using
an already-installed `node_modules` tree.

After this task, `make build` treats `bun.lock` as a first-class build input.
Success is observable with a deterministic Bun test: in a temporary project
that uses the repository `Makefile`, `make --dry-run build` must schedule
`bun install` when `bun.lock` is newer than the `node_modules` marker and must
not schedule installation when `node_modules` is already newer than both
package inputs.

Implementation must not begin until this draft is reviewed and approved.

## Constraints

- Work only in the git-donkey worktree for branch `roadmap-1-4-1`:
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-4-1`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Use `grepai search --workspace Projects --project odw-lint "<English intent
  query>" --toon --compact` as the primary intent-search tool. Treat GrepAI
  results as canonical `main` evidence only. Recheck branch-local facts with
  `leta`, exact text search, or direct file inspection inside this worktree.
- Use `leta` for branch-local symbol navigation, references, call graphs, and
  TypeScript verification. Exact text search is acceptable for Markdown,
  JSON, Makefile rules, lockfile entries, and literal strings that are not code
  symbols.
- Use `sem` rather than raw `git log` or `git blame` if codebase history is
  needed.
- Read and obey `AGENTS.md`, `docs/terms-of-reference.md`,
  `docs/technical-design.md`, `docs/adr/0001-static-analysis-boundary.md`,
  `docs/developers-guide.md`, `docs/scripting-standards.md`,
  `docs/complexity-antipatterns-and-refactoring-strategies.md`,
  `docs/documentation-style-guide.md`, and `docs/roadmap.md` before
  implementation. No `docs/users-guide.md` is present in this worktree.
- Use en-GB Oxford spelling in prose and comments.
- Keep each work item independently committable and gate-passable. Commit after
  each completed work item, and run that work item's stated gates before the
  commit.
- Do not add or update external package dependencies. The expected change uses
  existing Bun, TypeScript, Node built-ins, GNU Make, and repository tooling.
- Do not change the package manager command from `bun install` to `bun ci` in
  this roadmap task. `bun ci` is useful for stricter Continuous Integration
  (CI) policy, but it changes mismatch behaviour beyond the requested
  Makefile dependency-marker fix.
- Do not execute workflow source, import ODW runtime helpers, or call ODW
  loader, primitive, launcher, worker, or agent-dispatch paths. This task is
  repository build-gate infrastructure only.
- Do not create Python or Rust code. If implementation unexpectedly needs a
  Python or Rust helper, stop, revise this plan, and load the appropriate
  language router skill before editing.
- Format only changed files. Do not run repository-global mutating formatters
  such as `make fmt` or `bun fmt`.
- Keep validation path-safe. Prefer repository gates (`make all`,
  `make markdownlint`, and `make nixie`). Any direct formatter or linter
  command must list only paths that exist at that point in the work item and
  that the work item edits.
- Run long validation commands through `tee` into `/tmp`, for example
  `/tmp/all-odw-lint-roadmap-1-4-1.out`.

## Tolerances (exception triggers)

- Scope: stop and escalate if the implementation requires production `src/`
  changes. The expected code change is limited to `Makefile` and tests, followed
  by documentation close-out.
- Interface: stop and escalate if a public package export, package entry point,
  CLI contract, or TypeScript public API signature must change.
- Dependency: stop and escalate before adding or updating any package
  dependency.
- Tool policy: stop and escalate if the task can pass only by replacing
  `bun install` with `bun ci`, adding a separate install script, or changing
  default Make targets beyond the `node_modules` prerequisites.
- Test shape: stop and escalate if a deterministic dry-run Makefile test cannot
  prove the lockfile-only freshness bug without performing a real dependency
  installation.
- File count: stop and escalate if work item 1 needs more than three tracked
  file edits, or if the whole task needs more than six tracked files before
  documentation close-out.
- Gate attempts: stop and escalate if the same gate still fails after three
  targeted fix attempts.
- Ambiguity: stop and document options if "lockfile-only dependency change"
  would need a materially different interpretation from "the `bun.lock`
  timestamp is newer than the `node_modules` Make target".

## Risks

- Risk: testing the Makefile by running a real `bun install` would make the test
  slow, network-sensitive, and able to mutate dependency state.
  Severity: medium.
  Likelihood: medium.
  Mitigation: test Make's scheduling behaviour with `make --dry-run
  --no-print-directory build` in a temporary project, and assert the printed
  recipe contains or omits `bun install` as appropriate.

- Risk: directory mtimes for `node_modules` may be awkward to reason about if
  tests depend on current wall-clock time.
  Severity: medium.
  Likelihood: medium.
  Mitigation: create a temporary `node_modules` directory and set deterministic
  timestamps with Node's `utimesSync` instead of using sleeps.

- Risk: an implementer may broaden the task into a stricter CI policy change by
  switching to `bun ci`.
  Severity: medium.
  Likelihood: low.
  Mitigation: keep `bun install` unchanged. The official Bun docs verify that
  `bun ci` is equivalent to `bun install --frozen-lockfile`, but that behaviour
  is out of scope for this marker-freshness task.

- Risk: documentation close-out could reformat unrelated Markdown.
  Severity: low.
  Likelihood: medium.
  Mitigation: run `mdtablefix` and `markdownlint-cli2 --fix` only on the
  Markdown files edited by work item 2.

## Progress

- [x] (2026-06-28 14:10Z) Confirmed the worktree and branch:
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-4-1` on
  `roadmap-1-4-1`.
- [x] (2026-06-28 14:16Z) Loaded `execplans`, `leta`, `grepai`, `sem`,
  `firecrawl-mcp`, `en-gb-oxendict-style`, `commit-message`, and
  `biome-typescript` skills for this planning pass.
- [x] (2026-06-28 14:10Z) Used GrepAI against canonical `main`; task-specific
  searches returned no code matches, so branch-local facts were verified with
  `leta`, exact text search, direct file inspection, and scratch Make probes.
- [x] (2026-06-28 14:10Z) Read the required design, roadmap, developer,
  scripting, documentation-style, complexity, and ADR guidance relevant to this
  task.
- [x] (2026-06-28 14:10Z) Verified branch-local `Makefile` currently declares
  `node_modules: package.json`, and `docs/roadmap.md` §1.4 requires refreshing
  `node_modules` when `package.json` or `bun.lock` changes.
- [x] (2026-06-28 14:10Z) Verified GNU Make and Bun behaviour from installed
  CLI output and official docs, using Firecrawl for official web documentation.
- [x] (2026-06-28 14:16Z) Wrote the initial ExecPlan draft, formatted only
  `docs/execplans/roadmap-1-4-1.md`, and validated the planning change with
  `make all`, `make markdownlint`, and `make nixie`.
- [x] (2026-06-28 15:21Z) Work item 1: Pin and fix Makefile lockfile
  freshness. Commit `79a5540` changed the `node_modules` prerequisites to
  include `bun.lock`, added deterministic dry-run Makefile tests for
  `package.json`, `bun.lock`, and equal-mtime boundaries, passed
  `mbake validate Makefile`, passed `make all`, ran CodeRabbit once, addressed
  both minor findings, and re-ran `make all` green.
- [x] (2026-06-28 15:35Z) Work item 2: Document build-gate freshness and close
  roadmap task 1.4.1. `docs/developers-guide.md` now documents the
  lockfile-sensitive `node_modules` marker, `docs/roadmap.md` marks only task
  1.4.1 complete, this ExecPlan records the final outcome, `make all`,
  `make markdownlint`, and `make nixie` passed, and CodeRabbit reported no
  findings on its second run.

## Surprises & discoveries

- Observation: GrepAI did not find code for the dependency-installation wording.
  Evidence: `grepai search --workspace Projects --project odw-lint "dependency
  installation lockfile only changes install dependencies cache workflow"
  --toon --compact` returned no results.
  Impact: the plan relies on branch-local Makefile and documentation evidence,
  not semantic main-index code hits.

- Observation: the branch-local Makefile currently ignores lockfile-only
  freshness.
  Evidence: `Makefile` line 7 is `node_modules: package.json`, while
  `bun.lock` exists and is committed.
  Impact: the implementation path is concrete: add `bun.lock` as a prerequisite
  and test that scheduling behaviour.

- Observation: GNU Make's timestamp rule directly expresses the requested
  mechanism.
  Evidence: GNU Make 4.4.1 is installed. The official GNU Make manual says a
  target is remade when a prerequisite is more recent than the target, and a
  scratch Makefile with `marker: package.json bun.lock` rebuilt after touching
  `bun.lock`.
  Impact: no custom script or workaround is needed.

- Observation: Bun has a text lockfile and existing install command support
  that match the repository's current package files.
  Evidence: Bun 1.3.11 is installed. `bun install --help` lists
  `--frozen-lockfile` and `--lockfile-only`. The official Bun docs state that
  `bun install` writes `bun.lock`, `bun.lock` should be committed, and `bun ci`
  is equivalent to `bun install --frozen-lockfile`.
  Impact: this task should keep the current `bun install` command and only fix
  Makefile freshness. Stricter frozen-lockfile policy can be a later roadmap
  task if desired.

- Observation: the sibling ODW checkout is not load-bearing for this task.
  Evidence: task 1.4.1 concerns repository build-gate dependency freshness, not
  ODW loader, workflow, or example behaviour.
  Impact: do not cite or edit sibling ODW source for implementation.

- Observation: CodeRabbit found two useful test-hardening gaps after work item
  1 passed deterministic gates.
  Evidence: `coderabbit review --agent` reported minor findings to avoid
  `process.cwd()` for the fixture Makefile and to cover the exact equal-mtime
  boundary.
  Impact: the test now resolves the repository Makefile relative to
  `import.meta.url`, and verifies that Make schedules installation only when
  `package.json` or `bun.lock` is newer than `node_modules`.

## Decision Log

- Decision: use a Makefile prerequisite change, not a custom script.
  Rationale: roadmap task 1.4.1 specifically asks to update the build dependency
  marker, and GNU Make's documented prerequisite freshness rule already provides
  the required behaviour.
  Date/Author: 2026-06-28 14:10Z / planning agent.

- Decision: test the scheduling contract with `make --dry-run`, not real
  dependency installation.
  Rationale: the requested behaviour is whether Make schedules the `bun install`
  recipe after package-input timestamps change. A dry-run test is deterministic,
  fast, and avoids network or package-cache side effects.
  Date/Author: 2026-06-28 14:10Z / planning agent.

- Decision: keep `bun install` rather than switch to `bun ci`.
  Rationale: `bun ci` enforces frozen lockfile consistency, which is useful but
  broader than this task. The task's acceptance criterion is that a lockfile-only
  dependency change cannot leave Makefile gates using stale installed packages.
  Date/Author: 2026-06-28 14:10Z / planning agent.

- Decision: add equal-mtime coverage to the dry-run Makefile test.
  Rationale: GNU Make rebuilds when a prerequisite is newer than the target, not
  when timestamps are equal. Pinning that boundary makes the dependency marker
  contract explicit and avoids an accidental `>=` interpretation in future
  helper changes.
  Date/Author: 2026-06-28 15:21Z / implementation agent.

## Outcomes & Retrospective

Roadmap task 1.4.1 is complete. `Makefile` now declares
`node_modules: package.json bun.lock` while keeping the existing `bun install`
recipe and marker touch. `tests/build-gate/makefile.test.ts` proves dry-run
Make scheduling for stale, fresh, and equal package-input timestamps without
performing a dependency install.

The documentation close-out records the lockfile-sensitive marker in
`docs/developers-guide.md` and marks only roadmap task 1.4.1 complete in
`docs/roadmap.md`. Final validation for this task passed `make all`,
`make markdownlint`, and `make nixie`; work item 1 also passed
`mbake validate Makefile`.

## Context and orientation

The repository is a private TypeScript/Bun package. The default commit gate is
`make all`, which runs `make build`, `make check-fmt`, `make lint`,
`make typecheck`, and `make test` in order. `make build` currently depends on
the `node_modules` Make target, and that target runs `bun install` before
touching `node_modules`.

The completed branch-local `Makefile` begins:

```makefile
all: build check-fmt lint typecheck test

node_modules: package.json bun.lock
	bun install
	@touch node_modules

build: node_modules ## Install dependencies
```

`bun.lock` is present and records the locked package graph for this repository.
Roadmap task 1.4.1, under `docs/roadmap.md` §1.4 "Harden repository
build-gate freshness", requires `make build` to refresh `node_modules` when
either `package.json` or `bun.lock` changes.

The implementation should add a small test file, likely
`tests/build-gate/makefile.test.ts`, because this is repository infrastructure
rather than diagnostic-domain code. The test should copy the repository
`Makefile` into a temporary directory, create `package.json`, `bun.lock`, and a
`node_modules` directory with controlled mtimes, then run `make --dry-run
--no-print-directory build` to inspect whether the recipe would run.

## Plan of work

### Work item 1: Pin and fix Makefile lockfile freshness

Read `AGENTS.md` "Change Quality & Committing", "Testing", "Dependency
Management", and "Linting & Formatting"; `docs/roadmap.md` §1.4;
`docs/developers-guide.md` "Commit Gate", "Bun Scripts", "Tests", "Linting",
and "Type Checking"; `docs/technical-design.md` §§13 and 15;
`docs/adr/0001-static-analysis-boundary.md`; `docs/scripting-standards.md`
"Operational guidelines"; and
`docs/complexity-antipatterns-and-refactoring-strategies.md` §§4.A, 5.A, and
5.C before editing. Load `leta`, `grepai`, `biome-typescript`,
`en-gb-oxendict-style`, and `commit-message`. No Python or Rust router skill is
needed because this work item touches Makefile and TypeScript test code only.

Add `tests/build-gate/makefile.test.ts`. The file must begin with a module
`/** @file ... */` block. Use Bun's test runner and Node built-ins only:
`bun:test`, `node:child_process`, `node:fs`, `node:os`, and `node:path`. Do not
run `bun install` inside the test.

The test should create an isolated temporary project with these files:

- a copy of repository `Makefile`;
- `package.json`;
- `bun.lock`; and
- a `node_modules` directory that acts as the Make target marker.

Use deterministic timestamps with `utimesSync`. Cover three cases:

- when `node_modules` is newer than both `package.json` and `bun.lock`,
  `make --dry-run --no-print-directory build` must not print `bun install`;
- when `package.json` is newer than `node_modules`, the dry run must print
  `bun install`; and
- when `bun.lock` is newer than `node_modules`, the dry run must print
  `bun install`.

The third case is the regression check. It fails against the current Makefile
because `bun.lock` is not a prerequisite.

Update `Makefile` line 7 from:

```makefile
node_modules: package.json
```

to:

```makefile
node_modules: package.json bun.lock
```

Do not change the recipe body in this task.

Tests: add the Bun test above. This is a unit-level repository-infrastructure
test with integration-style command execution against GNU Make. Behavioural
tests: none, because there is no user-facing CLI or Cucumber workflow in this
slice. Property tests: none, because the package-input matrix is finite and
table-driven. Snapshot tests: none, because the reviewer-useful contract is
the explicit recipe scheduling assertion. End-to-end tests: none beyond the
full repository gate.

After creating `tests/build-gate/makefile.test.ts`, format only that changed
TypeScript file:

```sh
bunx @biomejs/biome format --write tests/build-gate/makefile.test.ts
```

Validate before commit:

```sh
mbake validate Makefile 2>&1 | tee /tmp/mbake-odw-lint-roadmap-1-4-1.out
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-4-1.out
```

Commit this work item with a file-based commit message, for example
`Refresh installs after lockfile changes`.

### Work item 2: Document build-gate freshness and close roadmap task 1.4.1

Read `docs/documentation-style-guide.md` "Spelling", "Markdown rules",
"Formatting", and "Roadmap task writing guidelines"; `docs/developers-guide.md`
"Commit Gate", "Bun Scripts", "Markdown", and "Documentation Upkeep";
`docs/roadmap.md` §1.4; and this ExecPlan before editing. Load `execplans`,
`en-gb-oxendict-style`, `biome-typescript`, and `commit-message`.

Update `docs/developers-guide.md` near "Commit Gate" or "Bun Scripts" to state
that `make build` installs dependencies through the `node_modules` Make target
and that the marker depends on both `package.json` and `bun.lock`. Make the
documentation specific enough that maintainers know a lockfile-only change is
expected to rerun dependency installation.

Update `docs/roadmap.md` §1.4 by marking task 1.4.1 complete only after work
item 1 has passed `mbake validate Makefile` and `make all`. Do not mark any
other roadmap task complete.

Update this ExecPlan's `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` sections with implementation evidence and final
validation output. Set `Status: COMPLETE` only when both work items have passed
their gates and been committed.

Tests: no new tests are required in this work item unless documentation changes
surface a broken invariant. Behavioural tests: none. Property tests: none.
Snapshot tests: none. End-to-end tests: none.

Format only changed Markdown files after they exist. These paths are existing
files by this work item:

```sh
mdtablefix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-1-4-1.md
bunx markdownlint-cli2 --fix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-1-4-1.md
```

Validate before commit:

```sh
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-4-1.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-4-1.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-4-1.out
```

Commit this work item with a file-based commit message, for example
`Document lockfile-sensitive build freshness`.

## Concrete steps

Start every implementation session in the worktree root:

```sh
cd /data/leynos/Projects/odw-lint.worktrees/roadmap-1-4-1
git branch --show
```

Expected branch output:

```plaintext
roadmap-1-4-1
```

Before editing code, refresh branch-local orientation:

```sh
grepai search --workspace Projects --project odw-lint \
  "dependency installation lockfile only changes install dependencies" \
  --toon --compact
leta files
leta grep "describe|it|expect" "tests/" -k function,method --head 120
```

If `node_modules` is absent, install dependencies through the repository target:

```sh
make build 2>&1 | tee /tmp/build-odw-lint-roadmap-1-4-1.out
```

Proceed through work items 1 and 2 in order. Do not combine commits. Do not
proceed to work item 2 if work item 1 validation fails.

## Validation and acceptance

Acceptance for the implemented roadmap task:

- `Makefile` declares `node_modules: package.json bun.lock`.
- `Makefile` keeps the existing `bun install` recipe and `@touch node_modules`
  marker update.
- A Bun test under `tests/build-gate/` proves `make --dry-run
  --no-print-directory build` schedules `bun install` when `package.json` is
  newer than `node_modules`.
- The same Bun test proves `make --dry-run --no-print-directory build`
  schedules `bun install` when `bun.lock` is newer than `node_modules`.
- The same Bun test proves `make --dry-run --no-print-directory build` does not
  schedule `bun install` when `node_modules` is newer than both package inputs.
- `docs/developers-guide.md` documents the lockfile-sensitive build marker.
- `docs/roadmap.md` marks 1.4.1 complete only after tests and gates pass.

Required gates:

```sh
mbake validate Makefile 2>&1 | tee /tmp/mbake-odw-lint-roadmap-1-4-1.out
make all 2>&1 | tee /tmp/all-odw-lint-roadmap-1-4-1.out
make markdownlint 2>&1 | tee /tmp/markdownlint-odw-lint-roadmap-1-4-1.out
make nixie 2>&1 | tee /tmp/nixie-odw-lint-roadmap-1-4-1.out
```

`make markdownlint` and `make nixie` are required for the work item that edits
Markdown. Running them after the whole roadmap task is also acceptable and
recommended before the final commit.

## Idempotence and recovery

The Makefile edit is idempotent: the final prerequisite list should be exactly
`package.json bun.lock`. Re-running the dry-run test must not modify
`node_modules`, package files, or dependency caches because it uses Make's
dry-run mode.

If the temporary-project test leaves files behind after an assertion failure,
fix the test cleanup with a `try`/`finally` block and `rmSync(tempDir, {
recursive: true, force: true })`. Do not use `/tmp` as a build target; it is
acceptable here only as scratch for the test's isolated Make dry run and for
validation logs.

Do not use an unnamed stash. If unrelated formatter or build churn appears and
must be parked, use a named stash with the required format:

```sh
git stash push -m 'df12-stash v1 task=1.4.1 kind=discard reason="park unrelated formatter churn"'
```

If a gate fails because the test would need to execute `bun install` for real,
stop, document the conflict in `Decision Log`, and revise the test approach
before proceeding.

## Artifacts and notes

Research commands already run during planning:

```plaintext
grepai search --workspace Projects --project odw-lint \
  "dependency installation lockfile only changes install dependencies cache workflow" \
  --toon --compact
grepai search --workspace Projects --project odw-lint \
  "install dependencies bun lockfile package manager setup build makefile" \
  --toon --compact
leta files
sem blame Makefile --json
```

Important observed outputs:

```plaintext
roadmap-1-4-1
Makefile:7: node_modules: package.json
docs/roadmap.md §1.4: make build refreshes node_modules when either
package.json or bun.lock changes
GNU Make 4.4.1
Bun 1.3.11
```

Scratch verification of current branch-local behaviour:

```plaintext
before=<make: Nothing to be done for 'build'.|>
after=<make: Nothing to be done for 'build'.|>
```

The `after` output came from copying the current `Makefile` to a temporary
project, making `node_modules` newer than both package inputs, then touching
`bun.lock` newer than `node_modules`. Because the current target does not list
`bun.lock`, Make still reported nothing to do. Work item 1's test must encode
this regression.

External behaviour verified during planning:

- GNU Make official manual, "What a Rule Looks Like" and "How `make` Processes
  a Makefile", at
  <https://www.gnu.org/software/make/manual/html_node/Rule-Introduction.html>
  and
  <https://www.gnu.org/software/make/manual/html_node/How-Make-Works.html>.
  The load-bearing rule is that a target is remade when a prerequisite is newer
  than the target.
- Bun official docs, "`bun install`" and "Lockfile", at
  <https://bun.sh/docs/pm/cli/install> and
  <https://bun.sh/docs/pm/lockfile>. The load-bearing facts are that
  `bun install` installs project dependencies and writes `bun.lock`, `bun.lock`
  should be committed, and `bun ci` is equivalent to
  `bun install --frozen-lockfile`.
- Installed CLI help for Bun 1.3.11 lists `--frozen-lockfile` and
  `--lockfile-only`. The implementation does not rely on undocumented Bun
  internals; it relies on the existing `bun install` command already present in
  the repository Makefile and pins Make scheduling with tests.

## Interfaces and dependencies

This task should not add production interfaces.

The intended test-only helper shape is:

```typescript
type MakeDryRunResult = {
  readonly status: number | null;
  readonly output: string;
};
```

Use these existing dependencies and APIs only:

- GNU Make 4.4.1 through `make --dry-run --no-print-directory build`.
- Bun 1.3.11 and `bun:test` declarations from locked `bun-types@1.3.14` for
  `describe`, `it`, `expect`, and table-driven assertions.
- Node built-ins `node:child_process`, `node:fs`, `node:os`, and `node:path`.
- Locked Biome 2.5.1 through `bunx @biomejs/biome` for direct formatting of
  the new TypeScript test path.
- `mdtablefix`, `markdownlint-cli2`, and `nixie` for Markdown formatting and
  validation when closing the task.

Do not use:

- ODW `loadWorkflowScript`, `createPrimitives`, `validate(source)`, runtime
  launcher, worker, or agent-dispatch APIs.
- `@swc/core`; it belongs to later parser work, not this build-gate task.
- `fast-check`, because the package-input matrix is finite and table-driven.
- `hypothesis`, `crosshair`, or `mutmut`, because this task does not touch
  Python code. If Python code becomes necessary, revise the plan and load
  `python-router` plus the verification skill it routes to.

## Revision note

Initial draft for roadmap task 1.4.1. It records a Makefile-prerequisite
implementation path, cites the repository docs and official GNU Make/Bun
behaviour used by the plan, decomposes the task into two gate-passable commits,
and specifies path-safe validation commands.
