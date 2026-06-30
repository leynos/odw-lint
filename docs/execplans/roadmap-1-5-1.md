# Add an automated file-size guard for source and test code

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 1.5.1 makes the repository's file-size convention executable.
`AGENTS.md` says no single code file should exceed 400 lines, and later parser,
rule, reporter, and fixture work will keep adding TypeScript. Today that rule
is mostly manual, with one narrow source-helper architecture test and
review-time `wc -l` checks in older plans.

After this plan is implemented, `make all` fails when a tracked TypeScript file
under `src/` or `tests/` exceeds the configured 400-line limit. Success is
observable by running `make all`: the default Bun test suite includes the new
guard, reports each oversized file with its path, line count and limit, and
passes when all tracked source and test TypeScript files remain within the
limit.

Implementation must not begin until this draft is reviewed and approved.

## Constraints

- Work only in the git-donkey worktree for branch `roadmap-1-5-1`:
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-1`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as canonical. Use `grepai search --workspace Projects
  --project odw-lint "<English intent query>" --toon --compact` as the primary
  intent search against the canonical main-branch index, then verify every
  branch-local fact inside this worktree.
- Use `leta` for branch-local TypeScript symbol navigation, references and
  source checks. Exact text inspection is acceptable for Markdown, JSON,
  Makefile rules, lockfile entries and literal command output.
- Use `sem` instead of raw Git history or blame if codebase history is needed.
  Ordinary `git status`, `git ls-files`, `git fetch`, and scoped diff checks
  remain acceptable for worktree hygiene and for the file-size guard itself.
- Read and obey `AGENTS.md`, `docs/terms-of-reference.md`,
  `docs/technical-design.md`, `docs/adr/0001-static-analysis-boundary.md`,
  `docs/developers-guide.md`, `docs/scripting-standards.md`,
  `docs/complexity-antipatterns-and-refactoring-strategies.md`,
  `docs/documentation-style-guide.md`, `docs/repository-layout.md`,
  `docs/contents.md`, and `docs/roadmap.md` before implementation.
- Use en-GB Oxford spelling in prose and comments. Preserve external API names
  exactly.
- Keep every work item independently committable and gate-passable. Commit only
  after the work item's tests and gates pass.
- Do not add, remove or update package dependencies. The selected mechanism
  uses existing Bun 1.3.11, Git 2.53.0, Node 24.13.1 built-ins, the installed
  type declarations from `bun.lock`, Biome, Oxlint, markdownlint, nixie and the
  repository Make targets.
- Do not add production `src/` code for this task. The guard belongs under
  `tests/build-gate/` so it runs through the default Bun test suite and
  therefore through `make all`.
- Do not import ODW runtime, loader, primitive, launcher, worker or
  agent-dispatch paths. This guard checks repository TypeScript files and does
  not need ODW loader parity.
- Do not execute workflow fixture source. JavaScript fixture snapshots under
  `tests/static-analysis/fixtures/` are out of scope for this guard unless a
  future roadmap task explicitly broadens the convention beyond TypeScript.
- The guard scope is tracked TypeScript source and test code under `src/` and
  `tests/`, including `.ts`, `.tsx`, `.mts` and `.cts` paths. It intentionally
  ignores snapshots, raw JavaScript workflow fixtures, `node_modules`, `dist`,
  docs and untracked scratch files.
- Count physical LF-delimited source lines as `wc -l` does for normal
  newline-terminated files: an empty file has 0 lines, a final trailing newline
  does not add an extra line, and a non-empty file with no trailing newline has
  1 line.
- Keep every new TypeScript file below the same 400-line limit.
- Format only changed files. For TypeScript changes, use path-scoped Biome
  formatting, for example `bunx biome format --write <changed-ts-files>`.
  For Markdown changes, run `mdtablefix` and `bunx markdownlint-cli2 --fix`
  only on the exact Markdown files touched by that work item. Do not run
  repository-global mutating formatters such as `make fmt`, `bun fmt`, or
  `mdformat-all`.
- Run the full repository gate before each commit with `make all`. When
  Markdown files change, also run `make markdownlint` and `make nixie`.
- Treat this ExecPlan as a changed Markdown file in every implementation work
  item. Each work item must update `Progress`; each work item must also update
  `Decision Log`, `Surprises & Discoveries`, and `Outcomes & Retrospective`
  whenever that work item produces a decision, finding or outcome. Run
  `mdtablefix docs/execplans/roadmap-1-5-1.md`,
  `bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-5-1.md`,
  `make markdownlint`, and `make nixie` in every work item because the living
  plan changes.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate before proceeding.

## Tolerances

- Scope: stop and escalate if implementation requires production `src/` code,
  a new package dependency, or more than three new TypeScript files.
- Gate wiring: stop and revise this plan if Bun test discovery no longer makes
  `tests/build-gate/*.test.ts` part of `make all`; do not silently replace the
  design with a different gate.
- File scope: stop and escalate if reviewers require JavaScript workflow
  fixtures, snapshots, docs, or generated files to be covered by this task.
  That would materially broaden the roadmap acceptance criterion.
- Path source: stop and escalate before scanning untracked files by default.
  The selected guard is for tracked repository source and test code.
- Dependencies: stop and escalate before adding a glob, filesystem walker,
  property-testing, shell helper, or command-wrapper package.
- API verification: stop and revise this plan if `git ls-files -z`, Bun test
  discovery, `node:child_process.spawnSync`, or `node:fs.readFileSync` cannot
  support the selected behaviour in the installed toolchain.
- Test proof: stop and escalate if the guard cannot be made to fail under a
  temporary low-limit mutation and pass again after restoring the 400-line
  limit.
- Gate attempts: stop and record options if `make all` still fails after three
  focused fix attempts in one work item.
- Formatting: if a formatter rewrites unrelated files, park that churn in a
  named discard stash using
  `df12-stash v1 task=1.5.1 kind=discard reason="<short>"`, restore the
  intended file set, and re-run only file-scoped formatting.

## Risks

- Risk: the guard scans too much and fails on copied ODW JavaScript examples or
  snapshots that are intentionally raw. Severity: high. Likelihood: medium.
  Mitigation: drive the scanner from `git ls-files -z -- src tests`, then
  filter to TypeScript extensions only.
- Risk: the guard scans too little because a pathspec or glob is interpreted
  differently by Git, the shell or Bun. Severity: high. Likelihood: medium.
  Mitigation: ask Git for all tracked paths under `src` and `tests` without
  shell globbing, then filter paths in TypeScript.
- Risk: line-count semantics disagree with reviewer expectations at trailing
  newlines or empty files. Severity: medium. Likelihood: medium. Mitigation:
  pin the physical-line counter with unit tests for empty source, no trailing
  newline, one trailing newline, multiple lines and blank final lines.
- Risk: a helper module grows into a general build-gate framework. Severity:
  medium. Likelihood: low. Mitigation: keep the helper test-only, small, and
  specific to tracked TypeScript file sizes.
- Risk: the real-repository guard passes even if the scanner returns no files.
  Severity: high. Likelihood: low. Mitigation: the guard must assert that the
  tracked TypeScript candidate list is non-empty before checking violations.
- Risk: adding another architecture test duplicates the existing
  `sourceLineCount` helper in
  `tests/static-analysis/source-file-architecture.test.ts`. Severity: low.
  Likelihood: medium. Mitigation: leave the existing source-helper ownership
  test in place for its local architecture purpose and keep the new helper in
  `tests/build-gate/`. Do not refactor unrelated tests unless duplication
  creates a failing gate.

## Progress

- [x] (2026-06-30T09:57Z) Confirmed this worktree is
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-1` on branch
  `roadmap-1-5-1`.
- [x] (2026-06-30T09:57Z) Loaded the `execplans`, `grepai`,
  `en-gb-oxendict-style`, `biome-typescript`, and `firecrawl-mcp` skills. No
  TypeScript router skill is available in this session; `biome-typescript` is
  the relevant TypeScript tooling skill. Python and Rust router skills do not
  apply because this plan touches no Python or Rust code.
- [x] (2026-06-30T09:57Z) Used GrepAI intent search against canonical `main`
  for file-size guard, build-gate and architecture-test surfaces. Verified
  branch-local facts in this worktree with `leta`, exact file inspection, Git
  tracked-file output and `sem diff`.
- [x] (2026-06-30T09:57Z) Added this worktree to Leta and verified the local
  source/test map. The largest current tracked TypeScript file under `src/` or
  `tests/` is `tests/static-analysis/fixture-metadata-refresh.test.ts` at 381
  lines.
- [x] (2026-06-30T09:57Z) Read the governing terms of reference, technical
  design, ADR, developers' guide, scripting standards, complexity guide,
  documentation style guide, repository layout, contents file, roadmap, and
  neighbouring ExecPlan/audit surfaces.
- [x] (2026-06-30T09:57Z) Ran `make build` to install locked dependencies for
  source-backed API verification. The installed packages include
  `bun-types@1.3.14`, `@types/node@26.0.1`, and `typescript@5.9.3`.
- [x] (2026-06-30T09:57Z) Verified the selected mechanism against installed
  declaration sources, local command help, and official docs fetched with
  Firecrawl.
- [x] (2026-06-30T10:02Z) Wrote the initial ExecPlan draft at
  `docs/execplans/roadmap-1-5-1.md` and added it to `docs/contents.md`.
- [x] (2026-06-30T10:02Z) Formatted only the changed Markdown files and
  validated this planning change with `make all`, `make markdownlint`, and
  `make nixie`.
- [x] (2026-06-30T10:13Z) Revised the draft after design review to make
  living-plan updates explicit in every work item, replace a path-unsafe work
  item 2 formatter command with a conditional support-module format step, cite
  Bun's official `spawnSync` and `readFileSync` references, and pin Git
  non-zero and cannot-spawn error behaviour with an injectable runner seam and
  unit tests.
- [x] (2026-06-30T10:28Z) Work item 1: added
  `tests/build-gate/file-size-support.ts` and
  `tests/build-gate/file-size-support.test.ts`. The initial red command
  `bun test ./tests/build-gate/file-size-support.test.ts` failed because the
  planned `./file-size-support` module did not exist, then the focused test
  passed after adding the support helpers and again after path-scoped Biome
  formatting.
- [x] (2026-06-30T10:28Z) Addressed work item 1 deterministic gate findings:
  path-scoped Biome organised imports, and focused JSDoc updates satisfied the
  repository's `df12` Oxlint rules for public and private helper functions.
- [x] (2026-06-30T10:28Z) Ran `coderabbit review --agent` for work item 1
  after deterministic gates passed. The review completed without rate
  limiting and raised two low-severity findings: add no-trailing-NUL parser
  coverage and keep the purpose acceptance criteria behaviour-focused.
  Both findings were addressed before the work item commit.
- [x] (2026-06-30T10:39Z) Work item 2: added
  `tests/build-gate/file-size.test.ts`, which scans tracked TypeScript paths
  from Git, asserts the candidate set is non-empty, reads each path with
  `readFileSync(path, "utf8")`, and reports any oversized file with its path,
  line count and limit.
- [x] (2026-06-30T10:39Z) Proved the work item 2 red stage by temporarily
  setting `SOURCE_AND_TEST_LINE_LIMIT` to `10` and running
  `bun test ./tests/build-gate/file-size.test.ts`. The test failed as
  expected and named existing tracked TypeScript files such as
  `src/diagnostics/report.ts: 113 physical lines exceeds 10` and
  `tests/static-analysis/fixture-metadata-refresh.test.ts: 381 physical lines
  exceeds 10`.
- [x] (2026-06-30T10:39Z) Restored `SOURCE_AND_TEST_LINE_LIMIT` to `400` and
  confirmed `bun test ./tests/build-gate/file-size.test.ts` passed, followed
  by a combined focused pass for
  `bun test ./tests/build-gate/file-size-support.test.ts ./tests/build-gate/file-size.test.ts`.
- [x] (2026-06-30T10:39Z) Ran `coderabbit review --agent` for work item 2
  after deterministic gates passed. The review completed without rate
  limiting and raised one low-severity finding: extract and test the oversized
  violation message formatter. Added `formatFileSizeViolations()` and a
  focused unit assertion before the work item commit.
- [x] (2026-06-30T10:47Z) Work item 3: verified the code guard before
  documentation changes with
  `bun test ./tests/build-gate/file-size-support.test.ts ./tests/build-gate/file-size.test.ts`.
  The focused guard suite passed with 20 tests.
- [x] (2026-06-30T10:47Z) Documented the file-size guard in
  `docs/developers-guide.md`, marked roadmap task 1.5.1 complete in
  `docs/roadmap.md`, and closed this ExecPlan as complete.

## Surprises & discoveries

- Observation: this worktree did not have a Leta workspace registered.
  Evidence: `leta files` initially returned "No workspace found for current
  directory"; `leta workspace add` registered the worktree.
  Impact: branch-local symbol checks now work with Leta for implementation.
- Observation: the repository already has a narrow source-helper line-limit
  assertion.
  Evidence: `tests/static-analysis/source-file-architecture.test.ts` defines
  `sourceLineCount()` and checks `SOURCE_HELPER_MODULES` against 400 lines.
  Impact: the new guard should live in `tests/build-gate/` and cover the whole
  tracked TypeScript source/test set instead of expanding that local
  architecture test.
- Observation: copied ODW JavaScript examples can exceed 400 lines.
  Evidence: `tests/static-analysis/fixtures/odw-examples/agent-daily-digest.js`
  is listed at 651 lines by `leta files`.
  Impact: the guard must stay scoped to TypeScript files, matching roadmap
  task 1.5.1's success criterion.
- Observation: the largest current tracked TypeScript source or test file is
  below the planned limit.
  Evidence: branch-local planning checks found
  `tests/static-analysis/fixture-metadata-refresh.test.ts` at 381 lines.
  Impact: the guard can be introduced without refactoring existing tracked
  TypeScript files first.
- Observation: Bun treats a missing new `*.test.ts` path as "no matches" until
  the file exists in the active worktree.
  Evidence: before correcting the file placement, focused `bun test` commands
  for `tests/build-gate/file-size-support.test.ts` reported no matching test
  files. After the test existed in this worktree, the same `./` path form
  loaded the file and failed for the intended missing helper module.
  Impact: future red-stage evidence should first verify the new test file is in
  the implementation worktree when Bun reports no matching path.

## Decision Log

- Decision: implement the guard as Bun tests under `tests/build-gate/`, not as
  production code or a standalone script.
  Rationale: `docs/developers-guide.md` "Commit Gate" states `make all` runs
  `make test`, and Bun's official docs confirm `bun test` recursively discovers
  `*.test.ts` files and exits non-zero on failures. This makes the convention
  executable in the existing repository gate without new Makefile or package
  script surface.
  Date/Author: 2026-06-30T09:57Z, planning agent.
- Decision: use `git ls-files -z -- src tests` as the candidate source, then
  filter TypeScript paths in TypeScript code.
  Rationale: Git's official `git-ls-files` docs and local Git 2.53.0 help say
  the default output is cached/tracked files and `-z` uses NUL termination.
  This avoids shell glob differences, untracked scratch files, ignored
  directories, snapshots, and raw JavaScript fixtures.
  Date/Author: 2026-06-30T09:57Z, planning agent.
- Decision: define physical line count as newline count plus one only for a
  non-empty file without a trailing LF.
  Rationale: this matches normal `wc -l` results for newline-terminated source
  while giving non-newline-terminated files a visible source line. Unit tests
  will pin edge cases so future implementers cannot change the convention by
  accident.
  Date/Author: 2026-06-30T09:57Z, planning agent.
- Decision: do not use `fast-check`, Behaviour-Driven Development (BDD),
  snapshots, CrossHair, Hypothesis, mutmut or lemmascript for this task.
  Rationale: the behaviour is a finite path-filtering and line-counting guard.
  Table-driven Bun unit tests and one real-repository architecture test cover
  the relevant happy path, unhappy path and edge cases without adding a
  dependency or a broader verification harness.
  Date/Author: 2026-06-30T09:57Z, planning agent.
- Decision: do not use the sibling ODW checkout for implementation research.
  Rationale: this task does not inspect, load, parse or execute ODW workflow
  source. The ODW checkout guidance is relevant to loader, workflow and example
  behaviour; the selected file-size guard is repository-gate infrastructure.
  Date/Author: 2026-06-30T09:57Z, planning agent.
- Decision: update and format this ExecPlan in every implementation work item.
  Rationale: the `execplans` skill defines the plan as a living document, and
  review found that omitting `docs/execplans/roadmap-1-5-1.md` from work-item
  Markdown formatting and gates made the plan internally inconsistent.
  Date/Author: 2026-06-30T10:13Z, planning agent.
- Decision: keep the file-size support helpers under `tests/build-gate/` as a
  named support module rather than sharing the existing
  `sourceLineCount()` helper from the static-analysis architecture test.
  Rationale: the new helper owns repository-wide tracked TypeScript file
  discovery, Git failure conversion, path filtering and violation reporting.
  The existing helper remains local to source-helper module architecture
  assertions.
  Date/Author: 2026-06-30T10:28Z, implementation agent.
- Decision: pin Git command failure behaviour with a test seam rather than
  relying on undocumented runtime side effects.
  Rationale: Bun's `spawnSync` reference and installed declarations expose
  `status`, `stdout`, `stderr`, and optional `error`, but the exact message the
  guard should throw for non-zero Git exits or spawn failures is project-owned
  behaviour. Unit tests must inject those outcomes and assert the error
  includes the command and stderr or error message.
  Date/Author: 2026-06-30T10:13Z, planning agent.

## Outcomes & Retrospective

Work item 1 added the testable support layer for the guard. Focused unit tests
now pin physical line-count semantics, NUL-separated Git path parsing,
TypeScript path filtering, oversized-file reporting, non-zero Git exit
conversion, failed-spawn conversion and injected successful Git listings. The
support layer is still test-only and is not exported from production package
entry points.

Work item 2 wired the support helpers into the default Bun suite with a
real-repository build-gate test. The temporary 10-line limit failed with
deterministic oversized-file messages, and the restored 400-line limit passed
against the current tracked TypeScript source and test set. CodeRabbit's
message-drift concern was addressed by moving failure formatting into a pure
support helper covered by unit tests.

Work item 3 completed the user-facing and roadmap documentation. The
developers' guide now states that `make all` runs the file-size guard through
`make test`, documents the tracked TypeScript scope and 400-line physical-line
limit, and records the deliberate exclusions for raw JavaScript workflow
fixtures, snapshots, docs and untracked files. `docs/roadmap.md` marks task
1.5.1 complete.

## Context and orientation

The current repository is a private Bun and TypeScript package. The Makefile is
the commit-gate entry point. `make all` runs `build`, `check-fmt`, `lint`,
`typecheck` and `test` in that order. The `test` target runs `bun test`, so any
new `*.test.ts` file under `tests/` becomes part of the default repository
gate.

The file-size convention comes from `AGENTS.md` "Keep file size manageable":
no single code file exceeds 400 lines. Roadmap task 1.5.1 narrows the
automated guard to source and test TypeScript files. Current branch-local
evidence shows 74 tracked TypeScript files under `src` and `tests`, with no
file above 400 lines.

The relevant current files are:

- `AGENTS.md`: repository-local process, style and quality-gate rules.
- `Makefile`: defines `all`, `test`, `check-fmt`, `lint`, `typecheck`,
  `markdownlint` and `nixie`.
- `package.json`: declares `bun test`, Biome, Oxlint and TypeScript scripts.
- `tests/build-gate/makefile.test.ts`: existing build-gate tests.
- `tests/static-analysis/source-file-architecture.test.ts`: contains a narrow
  400-line check for source-helper modules only.
- `docs/developers-guide.md`: explains commit-gate commands and testing
  expectations.
- `docs/roadmap.md`: contains task 1.5.1 and must be updated when the guard is
  implemented.

Terms used in this plan:

- "Tracked file" means a file listed by Git's index through `git ls-files`,
  not an ignored, generated or untracked file in the working tree.
- "TypeScript file" means a path ending in `.ts`, `.tsx`, `.mts` or `.cts`.
  The `.ts` suffix includes `.d.ts` files if they are added later.
- "Physical line" means an LF-delimited line in the file's UTF-8 text. A final
  trailing LF terminates the last line but does not create an additional
  counted line.

## External API and tool verification

The implementation must rely only on APIs verified here. If a future
implementation changes any load-bearing API, update this section before
continuing.

- Bun test runner: local runtime is Bun 1.3.11. Official Bun docs for
  <https://bun.sh/docs/cli/test> state that tests can be TypeScript, that
  `bun test` recursively searches for `*.test.{js|jsx|ts|tsx}`,
  `*_test.{js|jsx|ts|tsx}`, `*.spec.{js|jsx|ts|tsx}`, and
  `*_spec.{js|jsx|ts|tsx}`, and that the runner exits non-zero when a test
  fails. Installed `node_modules/bun-types/test.d.ts` declares the
  `bun:test` module at `node_modules/bun-types/test.d.ts:16`, `describe` at
  line 297, `test` at line 589, the `it` alias at line 590, and `expect` at
  line 613.
- Bun `node:child_process.spawnSync`: the guard runs under Bun 1.3.11, so the
  load-bearing command API is Bun's Node-compatible reference at
  <https://bun.com/reference/node/child_process/spawnSync>. That reference
  documents the `spawnSync(command, args?, options?)` overload, says the
  function does not return until the child process has fully closed, warns
  against enabling `shell` with unsanitized input, and defines
  `SpawnSyncReturns<T>` fields including `status`, `stdout`, `stderr`, and
  optional `error`. Installed `@types/node@26.0.1` confirms the same shape in
  `node_modules/@types/node/child_process.d.ts:1219-1262`.
- Bun `node:fs.readFileSync`: the guard reads repository files under Bun
  1.3.11. Bun's official reference at
  <https://bun.com/reference/node/fs/readFileSync> documents
  `readFileSync(path, options)` and states that specifying an encoding returns
  a string. Installed `@types/node@26.0.1` confirms `readFileSync(path,
  "utf8")` returns `string` in
  `node_modules/@types/node/fs.d.ts:3218-3265`. Repository-relative path
  resolution is pinned by the real-repository test in work item 2, which reads
  the Git-returned paths directly.
- Git command error handling: Bun and the declarations provide the raw
  `SpawnSyncReturns` fields, but the guard's human-facing error message for
  non-zero Git exits or spawn failures is project-owned. Work item 1 must add
  an injectable Git runner seam and unit tests for both cases.
- Git tracked paths: local Git is 2.53.0. Official `git-ls-files` docs state
  that `--cached` shows tracked files and is the default when no selection
  option is specified; `-z` terminates paths with NUL and does not quote file
  names. Local `git ls-files -h` confirms `-z` "separate paths with the NUL
  character".
- Biome and Oxlint: no new configuration is required. Existing
  `docs/developers-guide.md` "Formatting" and "Linting" sections define
  `make check-fmt`, `make lint`, and the path-scoped Biome formatter command
  to use for changed TypeScript files.

## Plan of work

### Work item 1: Add testable file-size guard support

Read before editing:

- `AGENTS.md` "Keep file size manageable", "Testing", "TypeScript Guidance",
  and "Change Quality & Committing".
- This ExecPlan's `Progress`, `Surprises & Discoveries`, `Decision Log`, and
  `Outcomes & Retrospective` sections before and after the work item.
- `docs/developers-guide.md` "Commit Gate", "Bun Scripts", "Formatting",
  "Linting", "Type Checking" and "Tests".
- `docs/repository-layout.md` "Test and fixture boundaries" and "Tooling
  boundaries".
- `docs/complexity-antipatterns-and-refactoring-strategies.md` §§2.B, 4.A and
  5.A for low-nesting, single-responsibility helper design.

Skills to load:

- `grepai` for intent search against canonical `main`.
- `execplans` for living-plan maintenance.
- `biome-typescript` for TypeScript formatting and linting conventions.
- `en-gb-oxendict-style` for comments and documentation prose.
- No Python, Rust, Hypothesis, CrossHair or mutmut skills apply.

Add `tests/build-gate/file-size-support.ts` with a `/** @file ... */` block and
small exported test-only helpers:

```typescript
export const SOURCE_AND_TEST_LINE_LIMIT = 400;
export const SOURCE_AND_TEST_ROOTS = ["src", "tests"] as const;

export type FileSizeViolation = {
  readonly path: string;
  readonly lineCount: number;
  readonly limit: number;
};

export type GitFileListingResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error?: Error;
};

export type GitFileListingRunner = () => GitFileListingResult;

export function countPhysicalLines(sourceText: string): number;
export function isSourceOrTestTypeScriptPath(path: string): boolean;
export function parseNulSeparatedPaths(output: string): readonly string[];
export function findOversizedSourceAndTestFiles(
  paths: readonly string[],
  readSource: (path: string) => string,
  limit?: number,
): readonly FileSizeViolation[];
export function trackedSourceAndTestTypeScriptFiles(
  runGit?: GitFileListingRunner,
): readonly string[];
```

The helper must call `spawnSync("git", ["ls-files", "-z", "--", "src",
"tests"], { encoding: "utf8" })` without `shell: true`. The default runner
must be replaceable through the optional `runGit` parameter so tests can inject
Git failures without mutating `PATH` or process-global state. If Git exits
non-zero, throw an `Error` whose message includes `git ls-files -z -- src
tests`, the numeric status when present, and stderr. If Git cannot be spawned
and `error` is present, throw an `Error` whose message includes the same
command and the `error.message`. Keep command execution in one helper so unit
tests can cover command failure, filtering, and counting without invoking Git.

Add `tests/build-gate/file-size-support.test.ts` with table-driven unit tests
for:

- physical-line counts for empty text, one unterminated line, one
  newline-terminated line, two lines, and a deliberate blank final line;
- NUL-separated path parsing, including a final empty segment;
- TypeScript path filtering for `src/*.ts`, `tests/**/*.tsx`,
  `tests/**/*.mts`, `tests/**/*.cts`, ignored `docs/*.ts`, ignored
  JavaScript fixtures and ignored snapshots;
- violation reporting for an exactly-400-line source, a 401-line source, and a
  mixed path list where only TypeScript candidates are considered.
- tracked-file listing error conversion for an injected non-zero Git result
  with stderr and an injected cannot-spawn result with `error: new
  Error("spawn git ENOENT")`;
- tracked-file listing success through an injected NUL-separated Git result,
  proving that the public tracked-path helper filters Git output without
  invoking a real subprocess in unit tests.

Red-Green-Refactor:

1. Red: create `tests/build-gate/file-size-support.test.ts` first, importing
   the planned helpers. Run:

   ```sh
   bun test ./tests/build-gate/file-size-support.test.ts
   ```

   Expect failure because the support module or helper exports do not exist.
2. Green: add `tests/build-gate/file-size-support.ts` with the smallest
   implementation that satisfies the unit tests. Re-run the same focused
   command and expect it to pass.
3. Refactor: simplify helper names and branching while preserving behaviour.
   Run:

   ```sh
   bunx biome format --write tests/build-gate/file-size-support.ts tests/build-gate/file-size-support.test.ts
   mdtablefix docs/execplans/roadmap-1-5-1.md
   bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-5-1.md
   bun test ./tests/build-gate/file-size-support.test.ts
   make all
   make markdownlint
   make nixie
   ```

   Expect all commands to pass. This work item must update this ExecPlan with
   Red-Green-Refactor evidence and any decisions before the Markdown formatter
   commands run.

Tests required:

- Unit tests only. Use table-driven Bun tests.
- The unit tests must pin the project-owned Git error contract for non-zero Git
  exits and cannot-spawn failures through the injectable runner seam.
- No behavioural, property, snapshot or end-to-end tests are required because
  the behaviour is a finite helper contract with no user-facing CLI.

### Work item 2: Wire the tracked TypeScript file-size guard into the default Bun suite

Read before editing:

- `docs/roadmap.md` §1.5 and task 1.5.1.
- This ExecPlan's living sections, especially the work item 1 evidence and
  any decisions recorded there.
- `docs/developers-guide.md` "Commit Gate" and "Tests".
- `docs/repository-layout.md` "Tooling boundaries".
- `docs/technical-design.md` §15 for the release acceptance pattern of
  `make all`, `make markdownlint`, and related gates.
- Official Bun test docs and installed `bun-types` declaration source cited in
  "External API and tool verification".

Skills to load:

- `grepai` for a fresh intent search if files have changed since this plan.
- `execplans` for recording the temporary low-limit proof and the work-item
  outcome.
- `biome-typescript` for TypeScript formatting and linting.
- `en-gb-oxendict-style` for comments.
- No Python, Rust, Hypothesis, CrossHair or mutmut skills apply.

Add `tests/build-gate/file-size.test.ts` with a `/** @file ... */` block. The
test must:

- call `trackedSourceAndTestTypeScriptFiles()`;
- assert the returned file list is non-empty;
- call `findOversizedSourceAndTestFiles()` with `readFileSync(path, "utf8")`
  and `SOURCE_AND_TEST_LINE_LIMIT`;
- thereby pin Bun's repository-relative `readFileSync(path, "utf8")`
  behaviour against the Git-returned tracked paths in the real worktree;
- sort violations by path for deterministic output;
- fail with an assertion message or compared value that includes each
  oversized file's path, line count and limit.

Do not add a Makefile target. The official Bun docs verify that a
`tests/build-gate/file-size.test.ts` file is discovered by `bun test`; the
existing `Makefile` already wires `make all` through `make test`.

Red-Green-Refactor:

1. Red: add the real-repository test with `SOURCE_AND_TEST_LINE_LIMIT`
   temporarily set to `10` in the support module. Run:

   ```sh
   bun test ./tests/build-gate/file-size.test.ts
   ```

   Expect failure that names existing tracked TypeScript files above 10 lines.
   Restore the limit to `400` before proceeding.
2. Green: run the focused test with the restored 400-line limit:

   ```sh
   bun test ./tests/build-gate/file-size.test.ts
   ```

   Expect it to pass and to scan at least one tracked TypeScript file.
3. Refactor: if necessary, adjust error formatting and helper ownership without
   broadening scope. Run:

   ```sh
   if ! git diff --quiet -- tests/build-gate/file-size-support.ts; then
     bunx biome format --write tests/build-gate/file-size-support.ts
   fi
   bunx biome format --write tests/build-gate/file-size.test.ts
   mdtablefix docs/execplans/roadmap-1-5-1.md
   bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-5-1.md
   bun test ./tests/build-gate/file-size-support.test.ts ./tests/build-gate/file-size.test.ts
   make all
   make markdownlint
   make nixie
   ```

   Expect all commands to pass. The conditional Biome command is required
   because the temporary low-limit edit may leave
   `tests/build-gate/file-size-support.ts` with no net work-item change after
   the limit is restored. This work item must update this ExecPlan with the
   red low-limit evidence, restored green evidence, and final gate results
   before the Markdown formatter commands run.

Tests required:

- Architecture/build-gate test against the real repository tracked TypeScript
  file set.
- The temporary low-limit red check must be recorded in `Progress` and must not
  be committed.
- No BDD, property, snapshot or end-to-end tests are required.

### Work item 3: Document the guard and close out roadmap task 1.5.1

Read before editing:

- `AGENTS.md` "Documentation Maintenance", "Markdown Guidance", and "Change
  Quality & Committing".
- `docs/developers-guide.md` "Commit Gate", "Tests", "Markdown" and
  "Documentation Upkeep".
- `docs/documentation-style-guide.md` "Spelling", "Markdown rules",
  "Formatting" and "Roadmap task writing guidelines".
- `docs/roadmap.md` §1.5 and task 1.5.1.
- This ExecPlan's `Progress`, `Decision Log`, and
  `Outcomes & Retrospective` sections for final close-out.

Skills to load:

- `en-gb-oxendict-style` for docs prose.
- `execplans` for final living-plan close-out.
- `biome-typescript` only if TypeScript files are also touched during the same
  work item.

Update `docs/developers-guide.md` to document the new file-size guard in the
commit-gate or tests area. The text must state:

- `make all` runs the guard through `make test`;
- the guard covers tracked TypeScript files under `src/` and `tests/`;
- the limit is 400 physical source lines;
- raw JavaScript workflow fixtures, snapshots, docs and untracked files are
  intentionally out of scope for task 1.5.1.

Update `docs/roadmap.md` to mark task `1.5.1` complete. Do not alter other
roadmap tasks unless the implementation genuinely changes their scope.

Red-Green-Refactor:

1. Red: before changing docs, verify the code guard already passes:

   ```sh
   bun test ./tests/build-gate/file-size-support.test.ts ./tests/build-gate/file-size.test.ts
   ```

   This is a precondition rather than an expected failure; documentation should
   not claim an unimplemented guard.
2. Green: edit the docs, roadmap close-out, and ExecPlan close-out. Mark the
   work item complete in `Progress`; update `Outcomes & Retrospective` with
   the final behaviour and validation evidence; append a revision note.
3. Refactor: wrap prose, check spelling, and run path-scoped Markdown
   formatting:

   ```sh
   mdtablefix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-1-5-1.md
   bunx markdownlint-cli2 --fix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-1-5-1.md
   make all
   make markdownlint
   make nixie
   ```

   Expect all commands to pass.

Tests required:

- No new tests are required in this work item because it documents the
  test-backed behaviour from work items 1 and 2.
- `make markdownlint` and `make nixie` are required because Markdown files
  change.

## Concrete steps

All commands run from:

```sh
cd /data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-1
```

Before implementation, refresh branch-local reconnaissance:

```sh
grepai search --workspace Projects --project odw-lint \
  "file size guard source test TypeScript commit gate" --toon --compact
leta files
git status --short --branch
```

After work item 1:

```sh
bunx biome format --write tests/build-gate/file-size-support.ts tests/build-gate/file-size-support.test.ts
mdtablefix docs/execplans/roadmap-1-5-1.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-5-1.md
bun test ./tests/build-gate/file-size-support.test.ts
make all
make markdownlint
make nixie
```

Expected focused output shape:

```plaintext
... file-size-support.test.ts:
(pass) file-size guard support > ...
```

After work item 2:

```sh
if ! git diff --quiet -- tests/build-gate/file-size-support.ts; then
  bunx biome format --write tests/build-gate/file-size-support.ts
fi
bunx biome format --write tests/build-gate/file-size.test.ts
mdtablefix docs/execplans/roadmap-1-5-1.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-1-5-1.md
bun test ./tests/build-gate/file-size-support.test.ts ./tests/build-gate/file-size.test.ts
make all
make markdownlint
make nixie
```

Expected failure shape during the temporary low-limit red check:

```plaintext
tests/build-gate/file-size.test.ts:
(fail) source and test file-size guard > keeps tracked TypeScript files under 400 lines
...
tests/static-analysis/fixture-metadata-refresh.test.ts ... lineCount ... limit ...
```

Expected final focused output shape:

```plaintext
... file-size-support.test.ts:
(pass) file-size guard support > ...
... file-size.test.ts:
(pass) source and test file-size guard > keeps tracked TypeScript files under 400 lines
```

After work item 3:

```sh
mdtablefix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-1-5-1.md
bunx markdownlint-cli2 --fix docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-1-5-1.md
make all
make markdownlint
make nixie
```

## Validation and acceptance

The implementation is accepted when:

- `bun test ./tests/build-gate/file-size-support.test.ts` passes.
- `bun test ./tests/build-gate/file-size.test.ts` passes with the 400-line
  limit.
- A temporary low-limit mutation makes
  `bun test ./tests/build-gate/file-size.test.ts` fail and name oversized
  tracked TypeScript files, then the restored 400-line limit passes.
- `make all` passes.
- `make markdownlint` passes after each work item because this ExecPlan changes
  in each work item.
- `make nixie` passes after each work item because this ExecPlan changes in
  each work item.
- `docs/developers-guide.md` documents the guard scope.
- `docs/roadmap.md` marks task 1.5.1 complete and does not change unrelated
  roadmap tasks.
- `docs/execplans/roadmap-1-5-1.md` contains current progress, decisions,
  discoveries, and outcomes for every completed work item.

Quality criteria:

- Tests: the new unit and real-repository Bun tests cover happy paths, unhappy
  paths and relevant edge cases.
- Lint/typecheck: `make all` passes, including Biome, Oxlint and TypeScript.
- Documentation: Markdown wrapping, spelling and roadmap status pass
  `make markdownlint` and `make nixie`.
- Security: no workflow fixture is imported, loaded or executed.

Quality method:

- Use focused Bun commands during Red-Green-Refactor.
- Use `make all` before every commit.
- Use `make markdownlint` and `make nixie` before every commit because this
  ExecPlan is updated in every work item.

## Idempotence and recovery

The guard is read-only in normal operation. It reads Git's tracked path list and
UTF-8 file contents, then reports violations. It does not write repository
files, mutate the index, execute workflow source, or depend on process-global
state beyond the current working directory.

If the temporary low-limit red check is interrupted, inspect `git diff` and
restore only the limit change by applying the inverse patch. Do not use a broad
reset. If path-scoped formatting rewrites unintended files, move that churn
into a named discard stash following the required
`df12-stash v1 task=1.5.1 kind=discard reason="<short>"` format, then restore
the intended file set and rerun formatting on explicit paths.

If `git ls-files` fails in the Bun test, the failure should include the command
and stderr for non-zero exits, or the command and `error.message` for spawn
failures. Fix the environment or Git invocation before changing scanner scope.

## Artifacts and notes

Research commands already run during planning:

```sh
grepai search --workspace Projects --project odw-lint \
  "file size guard source and test code roadmap lint limit" \
  --toon --compact --limit 10
leta files
sem diff --format terminal
make build
bun --version
node --version
git --version
git ls-files -h
firecrawl_scrape https://git-scm.com/docs/git-ls-files
firecrawl_search "site:bun.com/reference/node/child_process spawnSync Bun node:child_process spawnSync"
firecrawl_scrape https://bun.com/reference/node/child_process/spawnSync
firecrawl_search "site:bun.com/reference/node/fs readFileSync Bun node:fs readFileSync"
firecrawl_scrape https://bun.com/reference/node/fs/readFileSync
```

Relevant branch-local facts:

```plaintext
Bun: 1.3.11
Node: v24.13.1
Git: 2.53.0
Tracked TypeScript files under src/tests: 74
Largest tracked TypeScript file under src/tests:
tests/static-analysis/fixture-metadata-refresh.test.ts, 381 lines
```

## Interfaces and dependencies

The final test-only interface is:

```typescript
export const SOURCE_AND_TEST_LINE_LIMIT = 400;
export const SOURCE_AND_TEST_ROOTS = ["src", "tests"] as const;

export type FileSizeViolation = {
  readonly path: string;
  readonly lineCount: number;
  readonly limit: number;
};

export type GitFileListingResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error?: Error;
};

export type GitFileListingRunner = () => GitFileListingResult;

export function countPhysicalLines(sourceText: string): number;
export function isSourceOrTestTypeScriptPath(path: string): boolean;
export function parseNulSeparatedPaths(output: string): readonly string[];
export function findOversizedSourceAndTestFiles(
  paths: readonly string[],
  readSource: (path: string) => string,
  limit?: number,
): readonly FileSizeViolation[];
export function trackedSourceAndTestTypeScriptFiles(
  runGit?: GitFileListingRunner,
): readonly string[];
```

The implementation must not expose this helper through `src/index.ts` or
`package.json`. It is test support only.

No new dependency is allowed. The load-bearing external/runtime behaviours are
limited to:

- `bun test` discovery and failure exit behaviour;
- `spawnSync("git", ["ls-files", "-z", "--", "src", "tests"], ...)`;
- `readFileSync(path, "utf8")`;
- the project-owned conversion of non-zero or failed Git spawns to a clear
  `Error`, pinned by injected-runner unit tests;
- Git's tracked-file list and NUL-separated output.

## Revision note

Initial planning round. Created the self-contained draft ExecPlan for roadmap
task 1.5.1, selected a test-only Bun guard using tracked Git paths, verified
the load-bearing APIs, and decomposed the work into three independently
committable work items.

Planning round 2 revision. Resolved design-review blockers by making every
implementation work item update and format this living ExecPlan, changing work
item 2's support-module formatter to run only when that file has a net diff,
citing Bun's official `spawnSync` and `readFileSync` references for the Bun
runtime, and adding an injectable Git runner seam plus unit tests for non-zero
and cannot-spawn Git failures.

Implementation close-out. Added the support helpers, the real-repository
default-suite guard, developer documentation, and the roadmap completion tick.
All work items followed the planned deterministic-gate-before-CodeRabbit
sequence, with CodeRabbit findings addressed before the relevant work item
commits.

Fix round 1 revision. Corrected stale branch-local evidence for the tracked
TypeScript source and test count from 71 to 74 after review found that the
completed task's three new TypeScript files were not reflected in the
ExecPlan's context and artifact notes. This does not reopen implementation
work; it keeps the completed plan aligned with the current branch.
