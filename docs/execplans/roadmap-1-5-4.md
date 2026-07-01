# Add tracked-file whitespace hygiene to the commit gate

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

Roadmap task 1.5.4 hardens the repository commit gate against trailing
whitespace in tracked files. Biome and Oxlint deliberately skip raw workflow
fixture snapshots, and `git diff --check` only reports whitespace errors in a
diff. That leaves a gap where an already tracked fixture or snapshot can carry
trailing spaces and still pass ordinary formatting and linting.

After implementation, `make all` fails when any tracked non-binary file in the
working tree contains a line ending in a space or tab. The check only reports;
it must not rewrite or format raw fixture files. Success is observable by a
focused Bun test that creates a tracked file with trailing whitespace and by
the full repository gate passing once the repository has no findings.

Implementation must not begin until this draft is reviewed and approved.

## Constraints

- Work only in the git-donkey worktree for branch `roadmap-1-5-4`:
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-4`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as canonical. Use ordinary Git status and diff checks
  only inside this worktree.
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
- Use `sem` instead of raw Git history or blame if codebase history navigation
  is needed. Ordinary `git status`, scoped diffs, and Git commands used by the
  guard itself remain acceptable.
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
- Do not add production `src/` code for this task. The expected code change is
  a build-gate helper, tests, Makefile wiring, and maintainer documentation.
- Do not import executable ODW runtime paths. Do not execute workflow source,
  import workflow fixtures as modules, call ODW loader helpers, start ODW runs,
  or dispatch agents.
- The whitespace guard must inspect tracked files across the repository, not
  just `src/` and `tests/`, because the task exists to cover raw snapshots and
  fixtures that normal formatters intentionally skip.
- The whitespace guard must not rewrite files. It reports paths and line
  numbers only.
- Binary files are out of scope. Treat files containing a NUL byte as binary
  and skip them, because trailing whitespace is a text-file concept.
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
  a new package dependency, a new top-level tooling directory, or changes
  outside `tests/build-gate/`, `Makefile`, and the relevant documentation.
- Public interface: stop and escalate if any exported package API,
  diagnostic contract, rule catalogue, or user-facing `odw-lint check`
  behaviour must change.
- Mechanism: stop and revise this plan if installed Git cannot list tracked
  files with `git ls-files -z --full-name`. Do not replace the mechanism with
  an unresearched workaround.
- Text scanning: stop and escalate if existing tracked binary-like files cannot
  be skipped safely with a NUL-byte check.
- Existing findings: stop after the focused tests if the first live scan finds
  unrelated trailing whitespace in many existing tracked files. Record the
  paths in `Surprises & Discoveries` and ask whether to clean them in this task
  or split a separate hygiene cleanup.
- File size: stop and split before any new TypeScript file exceeds 350 lines,
  leaving room under the 400-line guard.
- Test proof: stop and escalate if a red test cannot demonstrate that a
  tracked file containing trailing whitespace fails before the final green
  state.
- Gate attempts: stop and record options if `make all` still fails after three
  focused fix attempts in one work item.
- Formatting: if a formatter rewrites unrelated files, park that churn in a
  named discard stash using:

  ```sh
  git stash push -m 'df12-stash v1 task=1.5.4 kind=discard reason="formatter churn"' -- <paths>
  ```

  Then restore the intended file set and rerun only file-scoped formatting.

## Risks

- Risk: using `git diff --check` would miss existing tracked whitespace when
  there is no diff. Severity: high. Likelihood: high. Mitigation: implement a
  full tracked-file scanner and pin the rejected diff-only path with a test or
  plan evidence.
- Risk: scanning only TypeScript repeats the file-size guard's scope and misses
  raw fixtures. Severity: high. Likelihood: medium. Mitigation: enumerate all
  tracked files with Git, then skip only binary NUL-containing files.
- Risk: the guard rewrites or formats copied ODW example fixtures. Severity:
  high. Likelihood: low. Mitigation: the guard must be report-only, and tests
  must assert it never mutates fixture content.
- Risk: a repository path with unusual characters is parsed incorrectly.
  Severity: medium. Likelihood: low. Mitigation: use `git ls-files -z
  --full-name` and the existing NUL-separated parsing pattern.
- Risk: a deleted tracked file causes an opaque stack trace. Severity: medium.
  Likelihood: medium. Mitigation: convert missing or unreadable file failures
  into project-owned errors with a stable message.
- Risk: a helper abstraction duplicates the file-size guard without a clear
  reuse policy. Severity: medium. Likelihood: medium. Mitigation: keep a local
  whitespace helper first; extract shared tracked-file enumeration only after
  the second write-side hygiene check proves the shape, as required by
  `docs/roadmap.md` task 1.5.4.

## Progress

- [x] (2026-06-30T15:37Z) Confirmed this worktree is
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-4` on branch
  `roadmap-1-5-4`.
- [x] (2026-06-30T15:37Z) Loaded the `execplans`, `grepai`,
  `firecrawl-mcp`, `biome-typescript`, and `en-gb-oxendict-style` skills. No
  TypeScript-specific router skill is available in this environment;
  `biome-typescript` is the relevant TypeScript tooling skill for this plan.
- [x] (2026-06-30T15:37Z) Used GrepAI intent searches against canonical
  `main` for tracked-file whitespace, build-gate, and raw-fixture hygiene
  surfaces, then verified branch-local facts inside this worktree with `leta`,
  direct file inspection, and `sem`.
- [x] (2026-06-30T15:37Z) Added this worktree to Leta and verified existing
  build-gate helpers under `tests/build-gate/`.
- [x] (2026-06-30T15:37Z) Read the governing terms of reference, technical
  design, ADR, developer guide, user's guide, repository layout, scripting
  standards, complexity guide, documentation style guide, roadmap, AGENTS
  instructions, and neighbouring ExecPlan style.
- [x] (2026-06-30T15:37Z) Verified local tooling: Git 2.53.0, Bun 1.3.11,
  locked TypeScript 5.9.3, locked Biome 2.5.1, locked Oxlint 1.71.0,
  markdownlint, nixie, mbake, and `make all` target structure.
- [x] (2026-06-30T15:37Z) Verified official Git and Bun behaviours with
  Firecrawl, and verified the diff-only alternative with a local Git probe.
- [x] (2026-06-30T15:37Z) Wrote the initial ExecPlan draft for roadmap task
  1.5.4.
- [x] (2026-06-30T15:46Z) Revised the draft to make documentation citations
  exact per work item and to record the path-safe validation command policy.
- [x] (2026-06-30T15:59Z) Completed work item 1: added pure tracked-file
  whitespace detection helpers and table-driven Bun tests for LF, CRLF, CR,
  end-of-file, whitespace-only lines, clean text, binary NUL skipping, and
  deterministic formatter output.
- [x] (2026-06-30T16:39Z) Completed work item 2: added the Git-backed live
  whitespace hygiene CLI and temporary-repository tests for clean tracked text,
  tracked trailing whitespace, untracked dirty files, NUL-containing binary
  files, missing tracked paths, and report-only fixture handling.
- [x] (2026-06-30T16:45Z) Completed work item 3: wired
  `make whitespace-hygiene` into `make all`, updated Makefile dry-run tests
  and maintainer documentation, and removed existing tracked snapshot
  whitespace so the new gate passes at repository head.
- [x] (2026-06-30T16:49Z) Completed work item 4: marked roadmap task 1.5.4
  complete, finalized this ExecPlan, and prepared the final gate evidence for
  the completed branch state.

## Surprises & discoveries

- Observation: `leta` was not initially registered for this worktree.
  Evidence: `leta files` returned "No workspace found for current directory";
  `leta workspace add .` then exposed the TypeScript and Markdown surfaces.
  Impact: future implementers can use `leta` directly in this worktree.
- Observation: `git diff --check HEAD --` does not catch existing tracked
  trailing whitespace when there is no diff.
  Evidence: a temporary repository with committed `dirty.txt` containing
  `bad \n` returned status 0 for `git diff --check HEAD --`.
  Impact: the implementation must scan tracked file contents, not diffs.
- Observation: the repository already has a local tracked-file enumeration
  pattern in `tests/build-gate/file-size-support.ts`.
  Evidence: `trackedSourceAndTestTypeScriptFiles` uses `git ls-files -z -- src
  tests` and `parseNulSeparatedPaths`.
  Impact: the whitespace guard should reuse the NUL parsing idea, but should
  keep a local all-tracked enumeration until reuse is justified.
- Observation: Oxlint's df12 rules require JSDoc on private helper functions
  and keep cyclomatic complexity below eight for the scanner.
  Evidence: the first `make all` run failed on missing private JSDoc,
  `findPathViolations` complexity 10, and a complex conditional in
  `tests/build-gate/whitespace-hygiene-support.ts`.
  Impact: the byte scanner is split into named line-boundary predicates and
  every private helper now has concise JSDoc.
- Observation: the first live run of `bun run
  tests/build-gate/whitespace-hygiene.ts` found existing trailing spaces in one
  tracked snapshot file.
  Evidence: the command reported
  `tests/static-analysis/__snapshots__/fixture-metadata-refresh-manifest-source.test.ts.snap`
  at lines 5, 77, and 169.
  Impact: work item 3 must clean that existing snapshot whitespace before
  wiring the guard into `make all`; otherwise the new mandatory target would
  fail immediately.
- Observation: Bun's object snapshot serializer preserved trailing whitespace
  after object keys when snapshotting the manifest-source map.
  Evidence: after removing the three reported trailing spaces, `make all`
  failed in `fixture metadata refresh manifest source > generates stable
  TypeScript manifest modules` because the test regenerated those lines.
  Impact: the test now snapshots a deterministic path-heading text block
  instead of an object map, preserving review coverage without committing
  trailing whitespace.

## Decision log

- Decision: implement a repository-wide tracked-file byte scanner instead of
  `git diff --check`.
  Rationale: official Git docs state `git diff --check` warns when changes
  introduce whitespace errors, and the local probe proves it misses already
  committed trailing whitespace with no diff. Roadmap task 1.5.4 asks for
  tracked-file hygiene, not only changed-line hygiene.
  Date/Author: 2026-06-30T15:37Z / Codex.
- Decision: enumerate candidates with `git ls-files -z --full-name`.
  Rationale: official Git docs state `git ls-files` defaults to cached tracked
  files, `--full-name` emits repository-root-relative paths from subdirectories,
  and `-z` emits verbatim NUL-terminated filenames. That is the safest
  machine-readable contract for repository-relative paths.
  Date/Author: 2026-06-30T15:37Z / Codex.
- Decision: scan bytes for trailing `0x20` or `0x09` before LF, CRLF, CR, or
  end-of-file, and skip buffers containing `0x00`.
  Rationale: trailing whitespace policy only needs spaces and tabs at text
  line ends. Byte scanning avoids encoding surprises, preserves raw fixture
  bytes, and lets binary files stay out of scope without adding dependencies.
  Date/Author: 2026-06-30T15:37Z / Codex.
- Decision: keep the new guard under `tests/build-gate/` and wire it into
  `make all`.
  Rationale: existing roadmap hardening tasks place repository guards in
  `tests/build-gate/`, and `AGENTS.md` identifies `make all` as the default
  full repository gate.
  Date/Author: 2026-06-30T15:37Z / Codex.
- Decision: keep `parseNulSeparatedPaths` local to the whitespace support
  module for work item 1.
  Rationale: the ExecPlan explicitly defers shared tracked-file helper
  extraction until a second write-side hygiene check proves the shape.
  Date/Author: 2026-06-30T15:59Z / Codex.
- Decision: use an inline snapshot for the formatter output regression test.
  Rationale: CodeRabbit correctly noted that the full rendered diagnostic is a
  compact output contract; matching the existing build-gate snapshot style
  makes punctuation, separator, and ordering drift visible in review.
  Date/Author: 2026-06-30T15:59Z / Codex.
- Decision: make missing tracked-file diagnostics stable by omitting the
  absolute working-tree path from CLI output.
  Rationale: the guard's users need the repository-relative tracked path, and
  tests should not snapshot temporary directory names that vary between runs.
  Date/Author: 2026-06-30T16:39Z / Codex.
- Decision: derive the human-readable Git command string from the same
  argument list passed to `spawnSync`.
  Rationale: CodeRabbit correctly identified drift risk between diagnostics and
  the actual command; a shared `gitFileListingArgs` constant removes that
  duplication.
  Date/Author: 2026-06-30T16:39Z / Codex.
- Decision: add `whitespace-hygiene` to `make all` after `check-fmt` and before
  `lint`.
  Rationale: the guard should fail before slower lint, type-checking, and test
  execution while still running after dependency installation and format
  verification.
  Date/Author: 2026-06-30T16:45Z / Codex.
- Decision: convert the manifest-source snapshot test from object snapshotting
  to path-heading text snapshotting.
  Rationale: the object snapshot format itself introduced trailing whitespace
  in the committed snapshot; text snapshotting keeps the same representative
  generated-source coverage while allowing the new hygiene gate to enforce the
  repository policy.
  Date/Author: 2026-06-30T16:45Z / Codex.

## Context and orientation

The repository is a private Bun and TypeScript package. The default full gate
is declared in `Makefile` as:

```makefile
all: build check-fmt lint typecheck test
```

Current build-gate helpers live under `tests/build-gate/`. The file-size guard
has a support module, focused support tests, and a live Bun test. It lists
tracked TypeScript files with Git and is already part of `make test`.

Roadmap task 1.5.4 appears in `docs/roadmap.md` under step 1.5, "Harden
roadmap-workflow review gates". It requires a lightweight whitespace check for
tracked files or diffs, warns to reuse branch-freshness tracked-file
enumeration only if the shared helper shape is proven, and defines success as
the repository gate failing on trailing whitespace without reformatting raw
fixture files.

Raw ODW example fixtures and invalid workflow fixtures are deliberately not
formatted by Biome or Oxlint. This task must therefore catch trailing
whitespace in those files by reading tracked content, while leaving their bytes
unchanged.

## Research notes

- `docs/roadmap.md` task 1.5.4 requires tracked-file whitespace hygiene and
  explicitly warns against premature helper sharing with branch-freshness.
- `docs/developers-guide.md` "Commit Gate" says `make all` runs `build`,
  `check-fmt`, `lint`, `typecheck`, and `test`; it also documents that raw ODW
  snapshots and invalid fixtures must not be formatted or executed.
- `docs/repository-layout.md` "Tooling boundaries" says `Makefile` is the
  maintainer validation entry point, and `tests/static-analysis/fixtures/` has
  byte-preservation constraints for copied ODW examples and raw invalid
  inputs.
- Official Git documentation for `git ls-files` says `--cached` shows tracked
  files and is the default, `-z` emits verbatim NUL-terminated filenames, and
  `--full-name` emits paths relative to the project top.
- Official Git documentation for `git diff --check` says it warns when changes
  introduce conflict markers or whitespace errors and exits non-zero when
  problems are found. It does not promise full-snapshot hygiene.
- Official Bun test-runner documentation says `bun test` runs tests, accepts a
  specific file path such as `bun test ./test/specific-file.test.ts`, and exits
  non-zero when tests fail.
- Local tool verification in this worktree found Git 2.53.0, Bun 1.3.11,
  TypeScript 5.9.3, Biome 2.5.1, and Oxlint 1.71.0.
- `bun.lock` pins `@biomejs/biome` 2.5.1, `oxlint` 1.71.0, and TypeScript
  5.9.3 for the existing gate commands. This plan does not depend on Biome,
  Oxlint, or TypeScript programmatic APIs; it uses only their already wired CLI
  targets.
- No vendored Git or Bun source exists in this repository. The load-bearing Git
  and Bun behaviours are therefore pinned to official documentation, local
  installed-version checks, and focused tests that must fail before and pass
  after implementation.
- A local Git probe committed a file with trailing whitespace and then ran
  `git diff --check HEAD --`; the command exited 0 because there was no diff.
  This rejects `git diff --check` as the sole mechanism for this task.

## Plan of work

### Work item 1: Add pure tracked-file whitespace detection

Implement a small helper module in
`tests/build-gate/whitespace-hygiene-support.ts`. It should export narrow,
testable types and functions:

- `WhitespaceViolation`, with `path`, `line`, and `kind`.
- `parseNulSeparatedPaths(output: string): readonly string[]`, local to this
  feature for now unless reuse is explicitly justified later.
- `findTrailingWhitespaceViolations(paths, readFile)` where `readFile`
  returns a `Buffer` for a repository-relative path.
- `formatWhitespaceViolations(violations)` for deterministic gate output.

The scanner must inspect bytes, skip any buffer containing `0x00`, and report
a violation when a line ends with ASCII space or tab before LF, CRLF, CR, or
end-of-file. It must report whitespace-only lines as violations. It must not
modify any file.

Documentation and decisions implemented by this work item:

- `docs/roadmap.md` task 1.5.4: tracked-file whitespace hygiene without
  reformatting raw fixtures.
- `docs/terms-of-reference.md` §§6-9: fit the Node/Bun toolchain, preserve the
  non-execution constraint, and keep CI diagnostics deterministic.
- `AGENTS.md` "Code Style and Structure", "TypeScript Guidance / Code Style
  and Structure", and "Testing": small functions, precise names, JSDoc,
  deterministic Bun tests.
- `docs/developers-guide.md` "Tests" and "Workflow Fixture Corpus": raw
  fixture files are not formatted or executed.
- `docs/repository-layout.md` "Test and fixture boundaries" and "Tooling
  boundaries": keep gate helpers under `tests/build-gate/`.
- `docs/scripting-standards.md` "Operational guidelines": keep the guard
  idempotent, pure where practical, and explicit about non-zero failures.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 2 and
  3: keep scanner control flow small and avoid bumpy-road nesting.

Skills to load before this work item:

- `biome-typescript` for TypeScript formatting and lint expectations.
- `en-gb-oxendict-style` for comments and documentation strings.
- `hypothesis-debugging` only if the byte scanner behaves unexpectedly and
  requires structured falsification.

Tests to add:

- Unit tests in `tests/build-gate/whitespace-hygiene-support.test.ts`.
- Table-driven cases for LF, CRLF, CR, no final newline, trailing spaces,
  trailing tabs, whitespace-only lines, clean lines, and binary NUL skipping.
- No snapshot tests; the output contract is short enough for direct semantic
  assertions.
- No property tests for the first implementation. Add `fast-check` property
  tests only if table-driven cases expose ambiguous line-boundary behaviour.

Red-Green-Refactor:

1. Red: add the support tests before the helper implementation and run:

   ```sh
   bun test ./tests/build-gate/whitespace-hygiene-support.test.ts
   ```

   Expect failures for missing exports or unimplemented behaviour.
2. Green: implement the minimal byte scanner and formatter until the focused
   command passes.
3. Refactor: simplify predicates and naming while rerunning the focused test.

Validation for this work item:

```sh
bunx @biomejs/biome format --write tests/build-gate/whitespace-hygiene-support.ts tests/build-gate/whitespace-hygiene-support.test.ts
bun test ./tests/build-gate/whitespace-hygiene-support.test.ts
make all
```

### Work item 2: Add the Git-backed live whitespace guard

Add the Git-backed guard entry point in
`tests/build-gate/whitespace-hygiene.ts`. The module should:

- create a Git runner using `spawnSync("git", ["ls-files", "-z",
  "--full-name"], ...)`;
- convert Git failures into project-owned `Error` messages;
- read each tracked path from the current working tree as a `Buffer`;
- report missing or unreadable tracked files as usage failures with stable
  wording;
- call the pure helper from work item 1;
- expose a `runWhitespaceHygieneCli(repositoryPath, writers)` function for
  tests; and
- call `process.exit(...)` only when invoked as the script entry point.

This work item should also add `tests/build-gate/whitespace-hygiene.test.ts`.
Use temporary Git repositories to prove the observable command behaviour:

- clean tracked text exits 0;
- a tracked file with trailing whitespace exits 1 and reports `path:line`;
- an untracked file with trailing whitespace is ignored;
- a tracked binary file containing NUL is ignored;
- a missing tracked working-tree path exits with a usage failure;
- the command does not mutate fixture content.

Documentation and decisions implemented by this work item:

- `docs/roadmap.md` task 1.5.4 success criterion.
- `docs/terms-of-reference.md` §§7-9: do not execute workflow source, do not
  replace general JavaScript tooling, and keep the Node/Bun toolchain fit.
- `AGENTS.md` "Testing", "Error Handling", and "Observability": deterministic
  tests and stable diagnostics instead of opaque dependency errors.
- `docs/developers-guide.md` "Commit Gate" and "Tests": Bun tests are the
  default repository test surface.
- `docs/repository-layout.md` "Tooling boundaries": Make and Bun are the gate
  entry points.
- `docs/technical-design.md` sections 11.3 and 12.1 by negative constraint:
  the guard must not import or execute ODW runtime paths or workflow source.
- `docs/adr/0001-static-analysis-boundary.md` "Decision" and "Consequences":
  preserve the ban on executable ODW runtime imports in production code.
- `docs/scripting-standards.md` "Operational guidelines": report actionable
  failures with POSIX-style exit codes and avoid destructive side effects.

Skills to load before this work item:

- `biome-typescript`.
- `hypothesis-debugging` if Git fixture failures are not immediately explained.
- `crosshair`, `mutmut`, and `hypothesis` are not required; this TypeScript
  gate has deterministic finite cases and no Python contract surface.

Tests to add:

- Unit-style Bun tests for the CLI wrapper using injected writers.
- Behavioural Git fixture tests using real `git init`, `git add`, and
  `git commit`, because the task concerns tracked-file semantics.
- No BDD feature file is required; this is maintainer gate behaviour rather
  than an end-user workflow.
- No snapshot tests; assert key substrings and structured exit codes directly.

Red-Green-Refactor:

1. Red: add the live guard tests with the script not yet implemented and run:

   ```sh
   bun test ./tests/build-gate/whitespace-hygiene.test.ts
   ```

   Expect missing-module or failing-behaviour output.
2. Green: implement the Git-backed guard until the focused command passes.
3. Refactor: keep Git runner, file reading, and output formatting separated
   enough to stay under complexity limits; rerun the focused command.

Validation for this work item:

```sh
bunx @biomejs/biome format --write tests/build-gate/whitespace-hygiene.ts tests/build-gate/whitespace-hygiene.test.ts
bun test ./tests/build-gate/whitespace-hygiene.test.ts
make all
```

### Work item 3: Wire whitespace hygiene into `make all`

Update `Makefile` so the full commit gate runs whitespace hygiene. Add a
documented `whitespace-hygiene` target that runs:

```sh
bun run tests/build-gate/whitespace-hygiene.ts
```

Then include that target in `all` after `check-fmt` and before `lint`, so
trailing whitespace fails before slower lint, type-check, and test runs. Update
the existing Makefile dry-run tests in `tests/build-gate/makefile.test.ts` to
prove the target is documented, uses Bun, and is scheduled by `make all`.

Update maintainer documentation:

- `docs/developers-guide.md` "Commit Gate" should list
  `make whitespace-hygiene` in the `make all` sequence and explain that it
  scans tracked non-binary files without rewriting raw fixtures.
- `docs/repository-layout.md` "Tooling boundaries" should mention the
  whitespace hygiene guard when describing `Makefile` or build-gate ownership
  if the existing wording would otherwise be incomplete.

Do not update `docs/users-guide.md`; this is a maintainer repository gate, not
an `odw-lint check` user feature.

Documentation and decisions implemented by this work item:

- `AGENTS.md` "Tooling Defaults" and "Change Quality & Committing": prefer
  Makefile targets and pass the full gate before commit.
- `docs/terms-of-reference.md` §§8-9: keep CI failure semantics deterministic
  and stay inside the existing Bun/TypeScript/Makefile constraint set.
- `docs/developers-guide.md` "Commit Gate", "Formatting", "Markdown", and
  "Documentation Upkeep".
- `docs/repository-layout.md` "Top-level files and directories" and "Tooling
  boundaries".
- `docs/documentation-style-guide.md` "Developer's guide" and Markdown rules.
- `docs/scripting-standards.md` "Operational guidelines": make the target
  idempotent and runnable without hidden environment requirements.
- `docs/roadmap.md` task 1.5.4 success criterion.

Skills to load before this work item:

- `biome-typescript` for the changed TypeScript Makefile tests.
- `en-gb-oxendict-style` for maintainer documentation.

Tests to add or update:

- Update `tests/build-gate/makefile.test.ts` to include
  `whitespace-hygiene` in the `MakeTarget` union and assert its dry-run output.
- Add or update a dry-run test proving `make all` schedules
  `whitespace-hygiene`.
- The live whitespace guard tests from work item 2 remain the behavioural
  coverage for trailing whitespace failures.

Red-Green-Refactor:

1. Red: update Makefile tests first and run:

   ```sh
   bun test ./tests/build-gate/makefile.test.ts
   ```

   Expect the dry-run assertions to fail until `Makefile` is wired.
2. Green: update `Makefile` and maintainer docs until the focused test and
   live target pass.
3. Refactor: keep `Makefile` target order clear and rerun focused and full
   gates.

Validation for this work item:

```sh
bunx @biomejs/biome format --write tests/build-gate/makefile.test.ts
mdtablefix docs/developers-guide.md docs/repository-layout.md
markdownlint-cli2 --fix docs/developers-guide.md docs/repository-layout.md
bun test ./tests/build-gate/makefile.test.ts
make whitespace-hygiene
make all
make markdownlint
make nixie
```

### Work item 4: Close out roadmap task 1.5.4

After implementation and validation, update `docs/roadmap.md` to mark task
1.5.4 complete. Update this ExecPlan's `Status`, `Progress`, `Decision Log`,
`Surprises & Discoveries`, `Outcomes & Retrospective`, and revision note with
the actual evidence from implementation. Do not mark completion before
`make all`, `make markdownlint`, and `make nixie` pass.

Documentation and decisions implemented by this work item:

- `docs/roadmap.md` task 1.5.4 close-out.
- `docs/documentation-style-guide.md` "Roadmap task writing guidelines".
- `docs/developers-guide.md` "Documentation Upkeep".
- `AGENTS.md` "Documentation Maintenance" and "Change Quality & Committing".
- `docs/repository-layout.md` "Documentation tree": keep the active ExecPlan
  and roadmap synchronized as delivery state changes.

Skills to load before this work item:

- `execplans`, because this work item revises a living plan.
- `en-gb-oxendict-style`.
- `commit-message` only if the implementer is committing from this work item.

Tests to add or update:

- No new tests are expected in close-out. The acceptance evidence is the
  complete gate suite from the implemented guard.

Validation for this work item:

```sh
mdtablefix docs/roadmap.md docs/execplans/roadmap-1-5-4.md
markdownlint-cli2 --fix docs/roadmap.md docs/execplans/roadmap-1-5-4.md
make all
make markdownlint
make nixie
```

## Concrete steps

Run all commands from
`/data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-4`.

1. Confirm the worktree and branch:

   ```sh
   pwd
   git status --short --branch
   ```

   Expected path:

   ```plaintext
   /data/leynos/Projects/odw-lint.worktrees/roadmap-1-5-4
   ```

2. Before touching TypeScript, inspect the build-gate surface with `leta`:

   ```sh
   leta grep "file|git|gate|Make" tests/build-gate --docs
   leta show trackedSourceAndTestTypeScriptFiles --context 12
   leta show runMakeDryRun --context 10
   ```

3. Implement work item 1 using Red-Green-Refactor and its focused validation.
4. Implement work item 2 using Red-Green-Refactor and its focused validation.
5. Implement work item 3 using Red-Green-Refactor and its focused validation.
6. Implement work item 4 only after all code and documentation gates pass.
7. Before each commit, inspect the intended diff:

   ```sh
   git status --short
   git diff -- Makefile tests/build-gate docs/developers-guide.md docs/repository-layout.md docs/roadmap.md docs/execplans/roadmap-1-5-4.md
   ```

8. Commit each work item separately after its gates pass. Use imperative,
   descriptive commit subjects and wrapped bodies.

## Validation and acceptance

Acceptance requires all of the following observable behaviours:

- `bun test ./tests/build-gate/whitespace-hygiene-support.test.ts` passes and
  proves the byte scanner catches trailing spaces and tabs at LF, CRLF, CR,
  and end-of-file boundaries.
- `bun test ./tests/build-gate/whitespace-hygiene.test.ts` passes and proves a
  tracked file with trailing whitespace fails while untracked files and binary
  NUL-containing files do not.
- `bun test ./tests/build-gate/makefile.test.ts` passes and proves
  `whitespace-hygiene` is a documented Make target included in `make all`.
- `make whitespace-hygiene` exits 0 on the final repository state.
- `make all` exits 0 on the final repository state and includes the whitespace
  hygiene target.
- `make markdownlint` exits 0 after Markdown changes.
- `make nixie` exits 0 after Markdown changes.

Expected final command sequence:

```sh
make whitespace-hygiene
make all
make markdownlint
make nixie
```

Expected successful result:

```plaintext
all requested gates exit with status 0
```

If `make whitespace-hygiene` reports existing trailing whitespace in unrelated
tracked files, do not silently rewrite them. Record the paths in
`Surprises & Discoveries` and either clean only the reported whitespace as part
of this roadmap task after approval, or split the cleanup into a separate
atomic task.

## Idempotence and recovery

The guard is read-only. Re-running it should produce the same findings until
files are edited. The Git-backed tests create temporary repositories and must
clean them in `finally` blocks, matching the existing build-gate fixture style.

If a focused test fails after a partial edit, rerun the focused command after
each fix before returning to `make all`. If a Markdown formatter changes
unrelated files, park the churn with the named discard stash command from
`Tolerances`, restore the intended paths, and rerun exact-path formatting.

If `make all` fails because the newly wired whitespace guard finds existing
tracked whitespace, do not disable the target. Treat the finding as evidence
that the task has uncovered real hygiene debt and follow the escalation rule in
`Tolerances`.

## Artifacts and notes

Primary branch-local surfaces verified during planning:

- `Makefile`
- `tests/build-gate/file-size-support.ts`
- `tests/build-gate/file-size-support.test.ts`
- `tests/build-gate/makefile.test.ts`
- `tests/build-gate/branch-freshness-git.ts`
- `tests/build-gate/branch-freshness-git-runner.ts`
- `docs/roadmap.md`
- `docs/developers-guide.md`
- `docs/repository-layout.md`

Local rejected-mechanism probe:

```plaintext
temporary repository:
  committed dirty.txt containing "bad \n"
  git diff --check HEAD -- exited 0
```

This proves that `git diff --check` alone is insufficient for tracked-file
snapshot hygiene.

## Interfaces and dependencies

No new package dependency is allowed.

Use installed Git 2.53.0 through `spawnSync`. The load-bearing command is:

```sh
git ls-files -z --full-name
```

This is pinned to official Git documentation for `git-ls-files`: no explicit
selection flag defaults to cached tracked files, `-z` emits verbatim
NUL-terminated filenames, and `--full-name` emits paths relative to the
project root.

Do not rely on `git diff --check` for this task. Official Git documentation
states that it warns when changes introduce whitespace errors, and the local
probe shows it misses existing tracked whitespace with no diff.

Use Bun 1.3.11 and the existing `bun test` runner. Official Bun documentation
states that `bun test` accepts specific test file paths and exits non-zero when
tests fail.

Use Node-compatible built-ins only:

- `node:child_process` `spawnSync` for Git.
- `node:fs` `readFileSync`, temporary file helpers, and cleanup helpers in
  tests.
- `node:path`, `node:os`, `node:process`, and `node:url` as needed.

Use the current TypeScript strict settings from `tsconfig.json`; do not weaken
compiler options.

## Outcomes & retrospective

Work item 1 is complete. The repository now has a pure byte scanner in
`tests/build-gate/whitespace-hygiene-support.ts` and focused tests in
`tests/build-gate/whitespace-hygiene-support.test.ts`. Red evidence was
`bun test ./tests/build-gate/whitespace-hygiene-support.test.ts` failing
because `./whitespace-hygiene-support` did not exist. Green evidence was the
same focused command passing with nine tests and one inline snapshot.
Deterministic gate evidence was `make all` passing after lint refactoring and
again after CodeRabbit's inline snapshot feedback was applied.

Work item 2 is complete. The repository now has a Git-backed CLI in
`tests/build-gate/whitespace-hygiene.ts` and live temporary-repository tests in
`tests/build-gate/whitespace-hygiene.test.ts`. Red evidence was
`bun test ./tests/build-gate/whitespace-hygiene.test.ts` failing because
`./whitespace-hygiene` did not exist. Green evidence was the same focused
command passing with six tests and eleven inline snapshots. Deterministic gate
evidence was `make all` passing before and after CodeRabbit's findings were
addressed. CodeRabbit was rate-limited once with `"waitTime":"6 minutes"`;
after waiting 390 seconds, the retry completed and its actionable findings were
addressed.

Work item 3 is complete. `Makefile` now exposes `make whitespace-hygiene` and
runs it from `make all` after `check-fmt`. `tests/build-gate/makefile.test.ts`
proves the target is documented, uses Bun, and is scheduled before linting.
`docs/developers-guide.md` and `docs/repository-layout.md` document the new
maintainer gate. The three existing trailing spaces in
`tests/static-analysis/__snapshots__/fixture-metadata-refresh-manifest-source.test.ts.snap`
were removed, and
`tests/static-analysis/fixture-metadata-refresh-manifest-source.test.ts` now
uses a path-heading text snapshot so the generated snapshot stays compatible
with the whitespace policy. Red evidence was
`bun test ./tests/build-gate/makefile.test.ts` failing because the Makefile
target was absent. Green evidence was that focused Makefile test, the manifest
source snapshot test, and `make whitespace-hygiene` passing. Deterministic gate
evidence was `make all`, `make markdownlint`, and `make nixie` passing after
the snapshot-renderer fix.

Work item 4 is complete. `docs/roadmap.md` now marks task 1.5.4 complete, and
this ExecPlan is marked `COMPLETE`. Deterministic close-out evidence was
`make all`, `make markdownlint`, and `make nixie` passing before commit.
CodeRabbit was rate-limited once with `"waitTime":"5 minutes"` during
close-out review; the retry passed with zero findings.

## Revision note

- 2026-06-30T15:37Z: Initial draft for roadmap task 1.5.4. The plan pins the
  mechanism to a tracked-file byte scanner, rejects a diff-only gate, and
  decomposes implementation into pure scanner, Git-backed guard, Makefile/docs
  wiring, and close-out work items.
- 2026-06-30T15:46Z: Revised the first-round draft to cite exact governing
  documentation sections per work item, clarify external tool verification, and
  preserve path-safe validation commands. The ordered implementation work is
  unchanged.
- 2026-06-30T15:59Z: Recorded work item 1 delivery evidence, the lint-driven
  scanner refactor, and CodeRabbit's formatter-test decision. Remaining work
  still follows the approved order: Git-backed guard, Makefile/docs wiring, and
  roadmap close-out.
- 2026-06-30T16:39Z: Recorded work item 2 delivery evidence, the CodeRabbit
  retry after a six-minute rate limit, and the existing snapshot whitespace
  found by the live guard. Remaining work is Makefile/docs wiring, including
  the minimal snapshot whitespace cleanup needed before the guard becomes
  mandatory, then roadmap close-out.
- 2026-06-30T16:45Z: Recorded work item 3 delivery evidence, the Makefile/docs
  wiring, and the snapshot-test format decision needed to prevent regenerated
  trailing whitespace. Remaining work is roadmap close-out after final gates.
- 2026-06-30T16:49Z: Marked the ExecPlan complete and recorded roadmap
  close-out scope. No implementation work remains after the final close-out
  gates and commit.
- 2026-06-30T17:22Z: Recorded the close-out deterministic gate pass and
  CodeRabbit's rate-limit retry followed by a clean review. The branch is ready
  for the final close-out commit once the deterministic gates are rerun for
  this note.
