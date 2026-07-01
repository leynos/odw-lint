# Split source-mask token scanners into focused modules

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

Implementation status: Work items 1, 2, 3, and 4 complete.

This is planning round 2. Do not begin implementation until the roadmap
workflow approves this plan.

## Purpose / big picture

Roadmap task 2.1.9 splits the source-mask token scanners into focused internal
modules without changing source-mask behaviour. The current
`src/static-analysis/source-mask.ts` file is 398 physical lines, two lines
under the repository's 400-line TypeScript file-size guard. It owns the public
masking facade, public mask data types, range construction, blanking, comment
scanning, quoted-string scanning, template scanning, regex-literal heuristics,
and regex flag scanning in one file.

After this plan is implemented, maintainers still call
`maskNonCodeSource(sourceFile)` through the existing `odw-lint` package facade.
The observable masking behaviour stays the same: comments, quoted strings,
whole template literals, and ODW-recognized regex literals are blanked while
line terminators and UTF-16 indexes stay aligned. The implementation gains
named homes for token-family logic so future envelope and AST-fact work can
extend one scanner family without reopening the whole masking module.

This task does not add parser-backed rules, metadata classification, SWC,
fixture refresh behaviour, a command-line interface, or new dependencies.

## Constraints

- Work only in
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-9`.
- Do not edit the root/control worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as the canonical integration branch.
- Use this GrepAI command shape first for intent search against the canonical
  main-branch index:

  ```sh
  grepai search --workspace 'Projects' --project 'odw-lint' \
    "<English intent query>" --toon --compact
  ```

  The GrepAI index reflects `main` only. Verify every branch-local fact inside
  this worktree with `leta`, exact text search, or file inspection before
  editing.
- Use `leta` for branch-local symbol navigation, references, call graphs, and
  code-shape verification when available. In this planning round,
  `leta workspace add /data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-9`
  succeeded and `leta calls --from maskNonCodeSource --max-depth 3` produced
  the source-mask call graph. Some `leta grep`, `leta refs`, and `leta show`
  queries intermittently failed with `Error: Connection closed unexpectedly`
  and `Error: EOF while parsing a value at line 1 column 0`; implementation
  agents should retry `leta` and, if it fails in the same way, record the exact
  failed command here and use precise branch-local file inspection.
- Use `sem` instead of raw Git history commands if implementation needs
  history, entity-level diffs, blame, or change impact analysis. In this
  planning round, `sem blame src/static-analysis/source-mask.ts` showed the
  whole source-mask module landed together in commit `073132bc` with subject
  `Add inert source masking`.
- Follow `AGENTS.md` "Code Style and Structure", "Documentation Maintenance",
  "Tooling Defaults", "Change Quality & Committing", "Refactoring Heuristics
  & Workflow", "Markdown Guidance", and "TypeScript Guidance".
- Use en-GB Oxford spelling in prose, comments, and commit messages while
  preserving code identifiers and external API names.
- Load the relevant skills before implementation work: `execplans`, `grepai`,
  `leta`, `sem`, `firecrawl-mcp`, and `biome-typescript`. This environment
  does not list a TypeScript router skill; use `biome-typescript` plus
  `AGENTS.md` TypeScript Guidance for TypeScript formatting and linting work.
  If a future environment provides a TypeScript router skill, load that router
  before touching TypeScript.
- Keep `src/static-analysis/source-mask.ts` as the only public source-mask
  facade. Callers must continue importing `maskNonCodeSource`, `MaskedSource`,
  `SourceMaskKind`, and `SourceMaskRange` through `src/static-analysis/index.ts`
  or `src/index.ts`; no caller should import a token-family module directly.
- Preserve the public package entry shape. Do not remove or rename root exports
  listed in `tests/diagnostics/public-api-fixtures.ts`.
- Production code must not import executable ODW runtime paths. ADR
  [0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md)
  forbids imports that evaluate metadata, compile workflow bodies, start runs,
  dispatch agents, or call runtime `validate(source)`.
- Do not copy or vendor sibling ODW private helper source into production
  `odw-lint` code. The split is mechanical ownership refactoring around the
  already owned `odw-lint` masker.
- Do not change masking semantics unless a focused red test first proves the
  current behaviour is inconsistent with the already documented `odw-lint`
  contract. A semantic change is out of scope for this roadmap task and
  requires an explicit `Decision Log` entry.
- Do not add, remove, or upgrade package dependencies.
- Do not change raw workflow fixtures under
  `tests/static-analysis/fixtures/invalid-workflows/` or copied ODW example
  snapshots under `tests/static-analysis/fixtures/odw-examples/`.
- Do not run repo-global mutating formatters such as `make fmt`, `bun fmt`, or
  `mdformat-all`. Format only changed files.
- For Markdown files changed in a work item, run file-scoped Markdown
  formatting on the changed paths:

  ```sh
  mdtablefix docs/execplans/roadmap-2-1-9.md
  bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-9.md
  ```

  If the work item also changes `docs/developers-guide.md`,
  `docs/technical-design.md`, `docs/repository-layout.md`, or
  `docs/roadmap.md`, include only those changed Markdown paths in the same
  commands after they exist.
- For TypeScript files changed in a work item, run Biome formatting only on the
  changed TypeScript paths after those paths exist.
- If a formatter rewrites unrelated files, park that churn with a named discard
  stash:

  ```sh
  git stash push -m 'df12-stash v1 task=2.1.9 kind=discard reason="formatter churn"'
  ```

- Each work item below is independently committable. Run its focused red
  check, focused green check, file-scoped formatter commands, `make all`,
  `make markdownlint`, and `make nixie` before committing that item.
- Before requesting review for the roadmap task branch, commit all intended
  changes so the worktree is clean, then run `make branch-freshness`.
  `make all` does not fetch or compare against `origin/main`; branch freshness
  is a separate review gate because it performs a network fetch and refuses a
  dirty worktree.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances

- Scope: stop and escalate if implementation requires metadata
  classification, SWC parser work, body normalization, rule-engine work, CLI
  work, fixture refresh logic, or changes outside the source-mask refactor and
  its tests/docs.
- File count: stop and escalate if the implementation needs more than six new
  production source-mask modules, three changed test files, four changed
  maintainer documentation files, this ExecPlan, and the final roadmap closure.
- Public API: stop and escalate before renaming, removing, or moving any root
  package export from `src/index.ts` or any current static-analysis facade
  export from `src/static-analysis/index.ts`.
- Dependencies: stop and escalate before adding, removing, or upgrading any
  dependency, including parser, lexer, formatter, test, or documentation tools.
- Runtime boundary: stop immediately if production code would need to import
  ODW runtime loaders, primitive factories, workflow files, `new Function`,
  `eval`, dynamic workflow imports, or agent-dispatch paths.
- Behaviour: stop and escalate if a focused test shows that preserving current
  masking behaviour conflicts with the source-span helper contract or the
  masking fixture corpus.
- Complexity: stop and refactor within the current work item if any new
  production function exceeds the configured lint complexity threshold, if a
  production TypeScript file exceeds 400 physical lines, or if a token-family
  module starts taking responsibility for another token family.
- Iterations: stop and record the failing command in `Decision Log` if the same
  focused test still fails for the same reason after three implementation
  attempts.
- Time: stop and escalate if one work item takes more than one focused working
  day after dependencies are installed.

## Risks

- Risk: the split accidentally changes regex-vs-division classification.
  Severity: high.
  Likelihood: medium.
  Mitigation: move regex logic in one work item, keep the existing property
  oracle unchanged except for imports if needed, and run
  `bun test ./tests/static-analysis/source-mask.property.test.ts` before and
  after the move.

- Risk: token modules import through the public facade and create import
  cycles.
  Severity: medium.
  Likelihood: medium.
  Mitigation: move shared mask data types into `source-mask-types.ts`, shared
  blanking and delimiter helpers into `source-mask-delimiters.ts`, then have
  the facade re-export public types while composing token modules.

- Risk: architecture tests become too loose and stop proving ownership.
  Severity: medium.
  Likelihood: medium.
  Mitigation: update `tests/static-analysis/source-file-architecture.test.ts`
  to pin the new module set and the top-level declarations owned by each
  source-mask module.

- Risk: documentation says the source-mask facade owns all internals after the
  code split.
  Severity: low.
  Likelihood: high.
  Mitigation: update the developer guide and repository layout only after the
  code split lands, naming the facade and each internal scanner home.

- Risk: a broad formatter command rewrites unrelated files.
  Severity: medium.
  Likelihood: low.
  Mitigation: use file-scoped `biome format --write`, `mdtablefix`, and
  `markdownlint-cli2 --fix` commands, then inspect `git status --short` before
  gates.

## Progress

- [x] (2026-07-01T16:54:45+01:00) Confirmed the worktree is
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-9` on branch
  `roadmap-2-1-9`.
- [x] (2026-07-01T16:54:45+01:00) Read the `execplans`, `grepai`,
  `leta`, `firecrawl-mcp`, and `biome-typescript` skills.
- [x] (2026-07-01T16:54:45+01:00) Ran GrepAI intent search against the
  canonical main-branch index for "source mask token scanners split focused
  modules lexer parser"; the top hit was
  `src/static-analysis/source-mask.ts`, followed by earlier source-mask
  ExecPlan and audit documents.
- [x] (2026-07-01T16:54:45+01:00) Added this worktree to Leta and captured the
  branch-local `maskNonCodeSource` call graph. Some Leta symbol queries failed
  intermittently as recorded in `Constraints`.
- [x] (2026-07-01T16:54:45+01:00) Used `sem blame` to confirm
  `source-mask.ts` was introduced as one module in commit `073132bc`.
- [x] (2026-07-01T16:54:45+01:00) Read the source-of-truth documents:
  `AGENTS.md`, `docs/terms-of-reference.md`, `docs/technical-design.md`,
  `docs/adr/0001-static-analysis-boundary.md`, `docs/developers-guide.md`,
  `docs/scripting-standards.md`,
  `docs/complexity-antipatterns-and-refactoring-strategies.md`,
  `docs/documentation-style-guide.md`, `docs/repository-layout.md`,
  `docs/users-guide.md`, `docs/issues/audit-2.1.7.md`, and
  `docs/roadmap.md`.
- [x] (2026-07-01T16:54:45+01:00) Read current source-mask production and test
  files: `src/static-analysis/source-mask.ts`,
  `src/static-analysis/index.ts`, `src/index.ts`,
  `tests/static-analysis/source-file-architecture.test.ts`,
  `tests/static-analysis/source-mask.test.ts`,
  `tests/static-analysis/source-mask.property.test.ts`,
  `tests/static-analysis/source-mask-fixtures.test.ts`,
  `tests/static-analysis/fixtures/masking.ts`, and the public API surface
  fixture tests.
- [x] (2026-07-01T16:54:45+01:00) Ran `make build` to install locked
  dependencies and verified local package versions and declarations for Bun
  test, Biome, and Fast-check.
- [x] (2026-07-01T16:54:45+01:00) Verified official Bun test, Fast-check, and
  Biome formatter documentation with Firecrawl search and submitted
  Firecrawl search feedback.
- [x] (2026-07-01T16:54:45+01:00) Read the sibling ODW checkout at
  `/data/leynos/Projects/open-dynamic-workflows` commit `ecc4867` for
  source-mask-adjacent loader behaviour.
- [x] (2026-07-01T16:54:45+01:00) Drafted this initial ExecPlan.
- [x] (2026-07-01T18:04:00+01:00) Revised the plan for design-review round 2:
  read `docs/developers-guide.md` branch freshness guidance, checked the
  `Makefile` `all` and `branch-freshness` targets, confirmed
  `git status --short --branch` reports
  `roadmap-2-1-9...origin/main [behind 1]`, and added the final clean-worktree
  `make branch-freshness` review gate.
- [x] (2026-07-01T18:16:23+01:00) Completed work item 1. Added
  `source-mask-types.ts` and `source-mask-delimiters.ts`, re-exported the
  public mask types through `source-mask.ts`, updated architecture coverage,
  added focused internal helper tests, and recorded the source-mask split in
  `docs/technical-design.md`.
- [x] (2026-07-01T18:16:23+01:00) Validated work item 1 with focused tests,
  `make all`, `make markdownlint`, and `make nixie`. CodeRabbit was run once
  plus three retries; the final retry still reported two medium and two low
  findings, all of which were fixed locally before the final deterministic
  gate.
- [x] (2026-07-01T20:54:00+01:00) Completed work item 2. Added
  `source-mask-comments.ts`, `source-mask-strings.ts`, and
  `source-mask-templates.ts`, moved the non-regex token-family scanners out
  of the facade, added focused comment and string scanner tests, extended
  internal template coverage, and kept `source-mask.ts` as the facade and
  orchestration home.
- [x] (2026-07-01T20:54:00+01:00) Validated work item 2 with focused scanner
  and architecture tests, `make all`, `make markdownlint`, and `make nixie`.
  CodeRabbit was run once plus the permitted three retries. The final retry
  reported a quoted-string CRLF line-continuation issue; it was fixed locally,
  covered by `tests/static-analysis/source-mask-strings.test.ts`, and the
  deterministic gates then passed. No further CodeRabbit retry was run because
  the configured retry cap had been reached.
- [x] (2026-07-01T22:58:00+01:00) Completed work item 3. Added
  `source-mask-regex.ts`, moved regex-literal detection and body scanning out
  of the facade, added token-context tracking to keep keyword-led regexes and
  postfix-operator division distinct, and added focused regex scanner
  regression tests.
- [x] (2026-07-01T22:58:00+01:00) Validated work item 3 with focused
  architecture, source-mask, property, fixture, internal, and regex scanner
  tests, followed by `make all`, `make markdownlint`, and `make nixie`.
  CodeRabbit initially hit a recoverable rate limit, so the required
  randomized `vsleep` backoff was used before retrying. CodeRabbit then ran
  once plus the permitted three retries. The final retry reported empty regex
  body handling and direct regex scanner coverage; both were fixed locally and
  the deterministic gates then passed. No further CodeRabbit retry was run
  because the configured retry cap had been reached.
- [x] (2026-07-01T23:16:00+01:00) Completed work item 4. Updated the
  developer guide, repository layout, roadmap, and this ExecPlan to describe
  the final source-mask ownership split and mark roadmap task 2.1.9 complete.
- [x] (2026-07-01T23:16:00+01:00) Validated work item 4 with the final focused
  architecture, source-mask, property, fixture, and public API test suite,
  followed by file-scoped Markdown formatting, `make all`, `make markdownlint`,
  and `make nixie`. CodeRabbit review completed with zero findings.

## Surprises & discoveries

- Observation: GrepAI was available and the canonical `main` index already
  points at `src/static-analysis/source-mask.ts` as the relevant source for
  this task.
  Evidence: `grepai search --workspace 'Projects' --project 'odw-lint'
  "source mask token scanners split focused modules lexer parser" --toon
  --compact --limit 8` returned `Projects/odw-lint/src/static-analysis/source-mask.ts`
  as the highest-scoring result.
  Impact: this plan can use canonical-main intent search as intended, while
  still verifying all branch-local facts in the worktree.

- Observation: Leta worked for the call graph but not consistently for all
  symbol queries in this session.
  Evidence: `leta calls --from maskNonCodeSource --max-depth 3` showed the
  facade calling `scanMaskRange`, `blankMaskedRange`, and
  `nextSignificantCharacterAfterRange`, with token-family calls under
  `scanMaskRange`. Earlier and later `leta grep`, `leta refs`, and `leta show`
  attempts failed with `Error: Connection closed unexpectedly` and `Error: EOF
  while parsing a value at line 1 column 0`.
  Impact: implementation must retry Leta but may fall back to exact
  branch-local file inspection if the same transient tool failure recurs.

- Observation: `source-mask.ts` is exactly the file-size risk described by the
  audit.
  Evidence: `wc -l src/static-analysis/source-mask.ts` reported 398 lines, and
  `docs/issues/audit-2.1.7.md` Finding 1 describes the same near-limit module
  after roadmap task 2.1.7.
  Impact: the split should happen before feature work adds branches or helpers
  to the module.

- Observation: the current architecture test pins all source-mask helper
  declarations to one file.
  Evidence: `tests/static-analysis/source-file-architecture.test.ts` contains
  `SOURCE_HELPER_MODULES` with only `source-mask.ts` for masking, and the
  `keeps inert-region masking in source-mask` test expects every mask helper
  declaration in that one file.
  Impact: each extraction work item must update architecture tests as part of
  the same atomic change.

- Observation: the sibling ODW loader distinguishes envelope masking from
  dual-compatibility scanning.
  Evidence: `/data/leynos/Projects/open-dynamic-workflows/src/loader.ts` at
  commit `ecc4867` uses `maskNonCode(source)` for metadata extraction, while
  `scanDualCompat(source)` uses `maskForDualScan(source)` so template
  interpolation code remains visible for compatibility warnings.
  Impact: this plan preserves the current `odw-lint` whole-template masking
  contract and does not introduce a dual-scan mask.

- Observation: the locked toolchain supports the focused validation commands
  listed in this plan.
  Evidence: `make build` installed `@biomejs/biome@2.5.1`,
  `bun-types@1.3.14`, `fast-check@4.8.0`, `oxlint@1.71.0`, and
  `typescript@5.9.3`. `bun test --help` accepts file filters and
  `--test-name-pattern`. `bunx biome format --help` accepts
  `biome format [--write] [PATH]...`. Fast-check `4.8.0` declarations expose
  `assert`, `property`, `array`, and `constantFrom`.
  Impact: no dependency change is needed for this refactor or its tests.

- Observation: the roadmap branch freshness gate is separate from `make all`.
  Evidence: `docs/developers-guide.md` says to run `make branch-freshness`
  before requesting review for roadmap task branches and explains that the
  target refreshes `origin/main`, checks protected docs and tests changes, and
  requires a clean worktree. `Makefile` defines `all: build check-fmt
  whitespace-hygiene lint typecheck test` and a separate `branch-freshness`
  target. Current `git status --short --branch` reports
  `roadmap-2-1-9...origin/main [behind 1]`.
  Impact: final validation must include a clean-worktree `make
  branch-freshness` step, and this plan must not claim `make all` alone proves
  current-`origin/main` freshness.

- Observation: splitting the scanners exposed two valid quoted-string and
  template edge cases that the old facade tests did not isolate.
  Evidence: CodeRabbit reported that unterminated quoted strings consumed
  following-line code, escaped CRLF string continuations were not consumed as a
  single line-terminator sequence, and keyword-led regex literals inside
  template expressions needed to ignore comments before `/x/`. Focused tests
  now cover those cases in `tests/static-analysis/source-mask-strings.test.ts`
  and `tests/static-analysis/source-mask-internals.test.ts`.
  Impact: work item 2 made small behaviour corrections with direct regression
  coverage rather than preserving bugs during the mechanical split.

- Observation: extracting regex scanning exposed missing token context in the
  previous character-only heuristic.
  Evidence: CodeRabbit reported keyword-led regex contexts such as `return
  /x/`, `typeof /x/`, `case /x/:`, `else /x/`, and `for (x of /x/)`, plus the
  counter-example `counter++ / divisor`. The facade now tracks both previous
  significant character and previous significant token, while
  `source-mask-regex.ts` rejects postfix `++` and `--` before applying keyword
  and character allowlists.
  Impact: regex-vs-division behaviour is more precise than the original
  character-only heuristic and is covered by direct scanner, facade, fixture,
  and property tests.

- Observation: the source-mask regex scanner and the mirrored template regex
  scanner had the same character-class boundary edge case.
  Evidence: both scanners treated any `]` as a class close, so a regex such as
  `/[]/]/g` could close at the slash inside the class. The fix teaches both
  scanners that leading `]` and `[^]` positions are literals.
  Impact: the two regex scan implementations remain behaviourally aligned for
  class-leading `]` and slash characters.

## Decision log

- Decision: keep `source-mask.ts` as the public facade and move shared public
  data types into a private `source-mask-types.ts` module that the facade
  re-exports.
  Rationale: token-family modules need the mask range types, but importing
  those types from the facade would create a cycle once the facade imports the
  scanners. A private type module preserves the public surface while keeping
  dependencies acyclic.
  Date/Author: 2026-07-01T16:54:45+01:00 / Codex.

- Decision: create one shared delimiter/range-support module named
  `src/static-analysis/source-mask-delimiters.ts`.
  Rationale: `isLineTerminatorCharacter`, `blankMaskedRange`,
  `createMaskedRange`, `scanEscapedDelimitedEnd`, and
  `isStringLikeDelimiter` are shared by more than one scanner family. Grouping
  them separately avoids duplicating low-level delimiter handling in token
  modules.
  Date/Author: 2026-07-01T16:54:45+01:00 / Codex.

- Decision: split token-family implementation homes as
  `source-mask-comments.ts`, `source-mask-strings.ts`,
  `source-mask-templates.ts`, and `source-mask-regex.ts`.
  Rationale: these names match the roadmap success criteria and the audit's
  proposed ownership shape. Each module has one token-family responsibility.
  Date/Author: 2026-07-01T16:54:45+01:00 / Codex.

- Decision: keep `scanMaskRange`, `nextSignificantCharacterAfterRange`, and
  `lastSignificantCharacterInRange` in `source-mask.ts`.
  Rationale: these helpers compose token-family scanners and maintain the
  previous-significant-character state across ranges. They are facade
  orchestration, not a token-family implementation.
  Date/Author: 2026-07-01T16:54:45+01:00 / Codex.

- Decision: preserve current unit, property, and fixture tests rather than
  replacing them with snapshots.
  Rationale: this is a refactor. Existing tests already cover token families,
  fixture behaviour, line terminators, freezing, regex-vs-division handling,
  and generated segment combinations. Snapshot tests would add review noise
  without improving the behavioural contract for this split.
  Date/Author: 2026-07-01T16:54:45+01:00 / Codex.

- Decision: keep `make branch-freshness` outside per-work-item gates and run
  it only after the final implementation commit leaves a clean worktree.
  Rationale: `docs/developers-guide.md` requires this review gate for roadmap
  task branches and states it exits with a usage error when the worktree is
  dirty. Per-work-item validation happens before each commit and therefore may
  be intentionally dirty; the correct point is after all intended changes are
  committed and before requesting review.
  Date/Author: 2026-07-01T18:04:00+01:00 / Codex.

- Decision: localize quoted-string line-terminator handling in
  `source-mask-strings.ts` instead of delegating to the shared escaped
  delimiter scanner.
  Rationale: quoted strings and template literals have different unterminated
  token rules. Quoted strings must stop before unescaped line terminators so
  valid code on the next line remains visible, while template literals may
  span lines and still use the shared escaped-delimiter scanner for nested
  delimiters.
  Date/Author: 2026-07-01T20:54:00+01:00 / Codex.

- Decision: track previous significant token in `source-mask.ts` while keeping
  previous significant character tracking.
  Rationale: regex recognition needs token context for keyword-led regexes and
  postfix-operator division, but the existing character heuristic remains
  useful for punctuation contexts such as `(`, `{`, `=`, and `,`. Keeping both
  values lets `source-mask-regex.ts` reject `++` and `--`, allow expression
  starter keywords, and preserve the previous punctuation behaviour.
  Date/Author: 2026-07-01T22:58:00+01:00 / Codex.

## Outcomes & retrospective

Work item 1 extracted the shared type and delimiter/range foundations without
changing public imports or source-mask behaviour. The public `source-mask.ts`
facade still exports `maskNonCodeSource`, `MaskedSource`, `SourceMaskKind`,
and `SourceMaskRange`; helper modules are internal implementation details. The
focused unit, architecture, and public API tests pass, and the full repository
gate plus Markdown and Mermaid gates passed after the final local fixes.

Work item 2 extracted the comment, quoted-string, and template scanners into
focused internal modules. The facade composes those scanners in the same order
as before, while direct scanner tests now cover comment dispatch, line
terminators, quoted-string newline boundaries, escaped CRLF continuations,
nested template expressions, comments inside template expressions, and
keyword-led regex literals inside templates. The full repository gate plus
Markdown and Mermaid gates passed after the final local fixes.

Work item 3 extracted regex scanning into `source-mask-regex.ts` and made the
regex-vs-division heuristic token-aware. Regex tests now cover keyword-led
regexes, operator-keyword regexes, postfix-operator division, escaped line
terminators, empty regex bodies, flag scanning, leading `]` literals inside
character classes, and the mirrored template-expression regex scanner. The
full repository gate plus Markdown and Mermaid gates passed after the final
local fixes.

Work item 4 closed the documentation and roadmap loop. Maintainer docs now
name `source-mask.ts` as the facade and orchestrator, name the internal
`source-mask-*` scanner modules by token family, and keep external scanner code
on `maskNonCodeSource`. Roadmap task 2.1.9 is marked complete. The final
focused suite, repository gate, Markdown lint, Mermaid validation, and
CodeRabbit review passed.

## Context and orientation

This repository is a private Bun and TypeScript package for static ODW (Open
Dynamic Workflows) workflow analysis. The source-helper modules live under
`src/static-analysis/`.

The current source-mask facade is `src/static-analysis/source-mask.ts`. It
exports:

- `SourceMaskKind`
- `SourceMaskRange`
- `MaskedSource`
- `maskNonCodeSource(sourceFile: OriginalSourceFile)`

The facade is re-exported by `src/static-analysis/index.ts` and `src/index.ts`.
`tests/diagnostics/public-api-fixtures.ts` pins those root exports.

The current branch-local `maskNonCodeSource` call graph is:

- `maskNonCodeSource`
- `scanMaskRange`
- `scanCommentRange`
- `scanQuotedStringRange`
- `scanTemplateRange`
- `scanRegexRange`
- `blankMaskedRange`
- `nextSignificantCharacterAfterRange`
- `lastSignificantCharacterInRange`

The task's target shape is:

- `src/static-analysis/source-mask.ts`: public facade and scan orchestration.
- `src/static-analysis/source-mask-types.ts`: `SourceMaskKind`,
  `SourceMaskRange`, and `MaskedSource`.
- `src/static-analysis/source-mask-delimiters.ts`: shared line terminator,
  range construction, range blanking, escaped delimiter scanning, and
  string-like delimiter helpers.
- `src/static-analysis/source-mask-comments.ts`: comment start and comment
  range scanning.
- `src/static-analysis/source-mask-strings.ts`: quoted string range scanning
  and quoted-string line-terminator handling.
- `src/static-analysis/source-mask-templates.ts`: whole-template range
  scanning, template state, and nested template step helpers.
- `src/static-analysis/source-mask-regex.ts`: regex start heuristic, regex
  range scanning, character-class handling, delimiter handling, and flag
  scanning.

The implementation must not expose token-family modules from `src/index.ts` or
`src/static-analysis/index.ts`. They are internal collaborators of the facade.

## Research evidence

- `docs/roadmap.md` §2.1 task 2.1.9 requires splitting source-mask token
  scanners into comment, string, template, regex, and delimiter helper homes.
  Its success criteria are that the source-mask facade preserves current
  masking behaviour, each token family has a named implementation home, and
  existing masking fixture and property tests remain green.
- `docs/issues/audit-2.1.7.md` Finding 1 says `source-mask.ts` is 398 lines
  and combines the public entry point, range creation, comment scanning,
  quoted string scanning, whole-template scanning, regex-literal heuristics,
  and regex flag scanning. It proposes keeping the facade while splitting
  token-family helpers.
- `docs/technical-design.md` §§5, 6.2, and 6.4 require an owned static-analysis
  implementation, a string/comment/template/regex masking strategy before
  envelope scanning, and no workflow source execution.
- `docs/adr/0001-static-analysis-boundary.md` forbids production imports of
  executable ODW loader, primitive, runtime, run-starting, metadata-evaluating,
  and agent-dispatch paths.
- `docs/developers-guide.md` "Workflow envelope scanner" requires production
  scanner code to call `maskNonCodeSource` before looking for metadata,
  imports, exports, braces, comments, strings, templates, or regex-sensitive
  syntax.
- `docs/developers-guide.md` "Source-span helpers" says
  `src/static-analysis/source-mask.ts` currently owns inert-region masking and
  that new parser, mapper, and reporter code should use public facades unless
  an internal helper is explicitly needed.
- `docs/repository-layout.md` "Source boundaries" assigns
  `src/static-analysis/` to static source modelling and forbids workflow
  imports, metadata evaluation, workflow execution, and ODW runtime helper
  calls in production code.
- `docs/documentation-style-guide.md` requires en-GB Oxford spelling, sentence
  case headings, fenced code block languages, 80-column Markdown wrapping, and
  current documentation when code or governing decisions change.
- `docs/scripting-standards.md` is not directly changed by this task, but it
  remains part of the source-of-truth set for automation work; this task adds
  no Python or operational scripts.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` identifies
  single-responsibility extraction and well-named helper boundaries as the
  appropriate response to bumpy-road complexity.
- `AGENTS.md` requires every code module to start with a `/** @file ... */`
  block, comments to explain why rather than what, functions to remain small
  and meaningful, file size to stay at or below 400 lines, Bun and Makefile
  targets to be preferred, file-scoped formatting for changed Markdown, and
  `make all` as the full repository gate.
- The official Bun test runner documentation at <https://bun.sh/docs/test>
  confirms `bun test`, TypeScript test files, file filters, and non-zero exit
  on failure. The locked local runtime is Bun `1.3.11`, and
  `node_modules/bun-types/test.d.ts` exposes `describe`, `it`, `test`,
  `expect`, `toBe`, and `toEqual`.
- The official Fast-check documentation at
  <https://fast-check.dev/docs/introduction/getting-started/> confirms
  `fc.assert(fc.property(...))`, test-runner-agnostic integration, and
  shrinking. The locked local package is `fast-check@4.8.0`, and
  `node_modules/fast-check/lib/fast-check.d.ts` exposes `assert`, `property`,
  `array`, and `constantFrom`.
- The official Biome formatter documentation at
  <https://biomejs.dev/formatter/> and CLI reference at
  <https://biomejs.dev/reference/cli/> confirm `biome format --write` and that
  the command accepts file and directory paths. The locked local package is
  `@biomejs/biome@2.5.1`, and `bunx biome format --help` confirms
  `biome format [--write] [PATH]...`.
- The sibling ODW checkout at
  `/data/leynos/Projects/open-dynamic-workflows` commit `ecc4867` shows
  `src/loader.ts` using `maskNonCode(source)` for metadata extraction and a
  separate `maskForDualScan(source)` for dual-compatibility scanning where
  template interpolation code remains visible. This task preserves
  `odw-lint`'s current whole-template envelope masking and does not implement
  dual-scan behaviour.

## Plan of work

Each work item below follows Red-Green-Refactor. The "red" step updates the
smallest relevant test expectation first and runs the focused command to prove
the current code does not yet satisfy the new module boundary. The "green"
step moves code without changing observable behaviour. The "refactor" step
cleans imports, documentation, and formatting while rerunning focused tests and
repository gates.

### Work item 1: Extract source-mask types and delimiter support

Implement the shared foundation for scanner modules.

Read before editing:

- `AGENTS.md` "TypeScript Guidance", "Testing", and "Linting & Formatting".
- `docs/roadmap.md` §2.1 task 2.1.9.
- `docs/technical-design.md` §§5, 6.2, and 6.4.
- `docs/developers-guide.md` "Workflow envelope scanner" and
  "Source-span helpers".
- `docs/repository-layout.md` "Source boundaries" and "Tooling boundaries".
- `docs/issues/audit-2.1.7.md` Finding 1.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` §4.

Skills to load:

- `execplans`
- `grepai`
- `leta`
- `biome-typescript`
- a TypeScript router skill if a future environment provides one

Red:

1. Update `tests/static-analysis/source-file-architecture.test.ts` so
   `SOURCE_HELPER_MODULES` includes `source-mask-types.ts` and
   `source-mask-delimiters.ts`.
2. Add architecture expectations that:
   - `source-mask-types.ts` owns `MaskedSource`, `SourceMaskKind`, and
     `SourceMaskRange`;
   - `source-mask-delimiters.ts` owns `blankMaskedRange`,
     `createMaskedRange`, `isLineTerminatorCharacter`,
     `isStringLikeDelimiter`, and `scanEscapedDelimitedEnd`;
   - `source-mask.ts` still owns `maskNonCodeSource`,
     `scanMaskRange`, `nextSignificantCharacterAfterRange`, and
     `lastSignificantCharacterInRange`.
3. Run:

   ```sh
   bun test ./tests/static-analysis/source-file-architecture.test.ts
   ```

   Expect failure because the two new modules do not yet exist.

Green:

1. Add `src/static-analysis/source-mask-types.ts` with the current public
   mask data types and a `/** @file ... */` module block.
2. Add `src/static-analysis/source-mask-delimiters.ts` with:
   - `isLineTerminatorCharacter`;
   - `blankMaskedRange`;
   - `createMaskedRange`;
   - `scanEscapedDelimitedEnd`;
   - `isStringLikeDelimiter`.
3. Update `src/static-analysis/source-mask.ts` to import those helpers and
   types, and to re-export the public types from `source-mask-types.ts`.
4. Do not change `src/static-analysis/index.ts`, `src/index.ts`, or
   `tests/diagnostics/public-api-fixtures.ts`; the public facade names must
   remain unchanged.
5. Run:

   ```sh
   bun test ./tests/static-analysis/source-file-architecture.test.ts \
     ./tests/static-analysis/source-mask.test.ts \
     ./tests/diagnostics/public-api-surface.test.ts
   ```

   Expect all focused tests to pass.

Refactor and validation:

1. Run file-scoped formatting:

   ```sh
   bunx @biomejs/biome format --write \
     src/static-analysis/source-mask.ts \
     src/static-analysis/source-mask-types.ts \
     src/static-analysis/source-mask-delimiters.ts \
     tests/static-analysis/source-file-architecture.test.ts
   mdtablefix docs/execplans/roadmap-2-1-9.md
   bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-9.md
   ```

2. Run gates:

   ```sh
   make all
   make markdownlint
   make nixie
   ```

3. Acceptance: the public API surface remains unchanged, source-mask unit
   tests pass, and every source-helper module is still under 400 lines.

### Work item 2: Extract comment, quoted-string, and template scanners

Move the non-regex token families into focused scanner modules.

Read before editing:

- `docs/roadmap.md` §2.1 task 2.1.9.
- `docs/technical-design.md` §6.2.
- `docs/developers-guide.md` "Workflow envelope scanner".
- `docs/issues/audit-2.1.7.md` Finding 1.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` §4.
- The completed Work item 1 module layout.

Skills to load:

- `execplans`
- `grepai`
- `leta`
- `biome-typescript`
- a TypeScript router skill if available

Red:

1. Update `tests/static-analysis/source-file-architecture.test.ts` so
   `SOURCE_HELPER_MODULES` includes:
   - `source-mask-comments.ts`
   - `source-mask-strings.ts`
   - `source-mask-templates.ts`
2. Add architecture expectations that:
   - `source-mask-comments.ts` owns `isCommentStart`,
     `scanCommentRange`, and `scanLineCommentEnd`;
   - `source-mask-strings.ts` owns `scanQuotedStringRange`,
     `scanQuotedStringEnd`, and its escaped-CRLF helper predicates;
   - `source-mask-templates.ts` owns `TemplateScanState`,
     `TemplateScanStep`, `scanTemplateRange`, `scanTemplateEnd`,
     `nextTemplateStep`, `nextTemplateIndex`, `isTemplateClose`,
     `isTemplateExpressionOpen`, and `nextOrdinaryTemplateStep`;
   - `source-mask.ts` no longer owns those declarations.
3. Run:

   ```sh
   bun test ./tests/static-analysis/source-file-architecture.test.ts
   ```

   Expect failure because the scanner modules do not yet exist.

Green:

1. Add `src/static-analysis/source-mask-comments.ts` and move comment helpers
   into it. Include a `/** @file ... */` module block. It imports
   `createMaskedRange` and `isLineTerminatorCharacter` from
   `source-mask-delimiters.ts`.
2. Add `src/static-analysis/source-mask-strings.ts` and move quoted-string
   scanning into it. Include a `/** @file ... */` module block. It imports
   `createMaskedRange` and `isLineTerminatorCharacter` from
   `source-mask-delimiters.ts` because quoted strings stop before unescaped
   line terminators while template literals do not.
3. Add `src/static-analysis/source-mask-templates.ts` and move template
   scanning into it. Include a `/** @file ... */` module block. It imports
   `createMaskedRange`,
   `scanEscapedDelimitedEnd`, and `isStringLikeDelimiter` from
   `source-mask-delimiters.ts`.
4. Update `src/static-analysis/source-mask.ts` so `scanMaskRange` calls the
   imported `scanCommentRange`, `scanQuotedStringRange`, and
   `scanTemplateRange`.
5. Run:

   ```sh
   bun test ./tests/static-analysis/source-file-architecture.test.ts \
     ./tests/static-analysis/source-mask.test.ts \
     ./tests/static-analysis/source-mask-fixtures.test.ts
   ```

   Expect all focused tests to pass.

Refactor and validation:

1. Run file-scoped formatting:

   ```sh
   bunx @biomejs/biome format --write \
     src/static-analysis/source-mask.ts \
     src/static-analysis/source-mask-comments.ts \
     src/static-analysis/source-mask-strings.ts \
     src/static-analysis/source-mask-templates.ts \
     tests/static-analysis/source-file-architecture.test.ts
   mdtablefix docs/execplans/roadmap-2-1-9.md
   bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-9.md
   ```

2. Run gates:

   ```sh
   make all
   make markdownlint
   make nixie
   ```

3. Acceptance: line comments, block comments, quoted strings, escaped
   delimiters, quoted-string line terminators, whole template literals, nested
   template interpolation boundaries, and masking fixtures behave correctly and
   remain covered by focused regression tests.

### Work item 3: Extract regex scanner

Move regex-literal detection and body scanning into its own module while
preserving division handling.

Read before editing:

- `docs/roadmap.md` §2.1 task 2.1.9.
- `docs/technical-design.md` §6.2.
- `docs/developers-guide.md` "Workflow envelope scanner".
- `docs/issues/audit-2.1.7.md` Finding 1.
- `docs/execplans/roadmap-2-1-1.md` decisions about regex line terminators
  and previous-significant-character behaviour.
- The sibling ODW loader reference at
  `/data/leynos/Projects/open-dynamic-workflows/src/loader.ts` for historical
  context only; do not import from it.

Skills to load:

- `execplans`
- `grepai`
- `leta`
- `biome-typescript`
- a TypeScript router skill if available

Red:

1. Update `tests/static-analysis/source-file-architecture.test.ts` so
   `SOURCE_HELPER_MODULES` includes `source-mask-regex.ts`.
2. Add architecture expectations that `source-mask-regex.ts` owns:
   - `REGEX_ALLOWED_PREVIOUS_CHARACTERS`
   - `scanRegexRange`
   - `isRegexAllowedAfter`
   - `scanRegexEnd`
   - `isRegexClassBoundary`
   - `isRegexDelimiter`
   - `scanRegexFlagsEnd`
3. Add expectations that `source-mask.ts` no longer owns those declarations.
4. Run:

   ```sh
   bun test ./tests/static-analysis/source-file-architecture.test.ts
   ```

   Expect failure because `source-mask-regex.ts` does not yet exist.

Green:

1. Add `src/static-analysis/source-mask-regex.ts` and move regex helpers into
   it. Include a `/** @file ... */` module block. It imports
   `createMaskedRange` and `isLineTerminatorCharacter` from
   `source-mask-delimiters.ts`.
2. Update `src/static-analysis/source-mask.ts` so `scanMaskRange` calls the
   imported `scanRegexRange`.
3. Keep previous-significant-character state updates in the facade. Comments
   remain context-neutral; strings, templates, and regex ranges still update
   context from the last significant character inside the masked range.
4. Run:

   ```sh
   bun test ./tests/static-analysis/source-file-architecture.test.ts \
     ./tests/static-analysis/source-mask.test.ts \
     ./tests/static-analysis/source-mask.property.test.ts \
     ./tests/static-analysis/source-mask-fixtures.test.ts
   ```

   Expect all focused tests to pass.

Refactor and validation:

1. Run file-scoped formatting:

   ```sh
   bunx @biomejs/biome format --write \
     src/static-analysis/source-mask.ts \
     src/static-analysis/source-mask-regex.ts \
     tests/static-analysis/source-file-architecture.test.ts
   mdtablefix docs/execplans/roadmap-2-1-9.md
   bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-9.md
   ```

2. Run gates:

   ```sh
   make all
   make markdownlint
   make nixie
   ```

3. Acceptance: regex literals after ODW-allowed preceding characters are still
   masked, unterminated regex candidates at JavaScript line terminators remain
   visible, and division-like slashes after string, template, and regex
   expressions remain visible.

### Work item 4: Document the scanner ownership split and close the roadmap task

Update maintainer documentation after the code has the final module shape.

Read before editing:

- `docs/developers-guide.md` "Source-span helpers".
- `docs/technical-design.md` §6.2.
- `docs/repository-layout.md` "Source boundaries".
- `docs/roadmap.md` §2.1 task 2.1.9.
- `docs/documentation-style-guide.md` "Spelling", "Markdown rules", and
  "Formatting".
- `AGENTS.md` "Documentation Maintenance" and "Markdown Guidance".

Skills to load:

- `execplans`
- `grepai`
- `biome-typescript`
- a TypeScript router skill is not required unless code is touched

Red:

1. Run the final focused test suite before documentation closeout:

   ```sh
   bun test ./tests/static-analysis/source-file-architecture.test.ts \
     ./tests/static-analysis/source-mask.test.ts \
     ./tests/static-analysis/source-mask.property.test.ts \
     ./tests/static-analysis/source-mask-fixtures.test.ts \
     ./tests/diagnostics/public-api-surface.test.ts
   ```

   Expect pass. If this fails, do not edit documentation; return to the work
   item that introduced the failing code.

Green:

1. Update `docs/developers-guide.md` "Source-span helpers" so it says:
   - `source-mask.ts` is the facade and scan orchestrator;
   - `source-mask-types.ts` owns mask data types;
   - `source-mask-delimiters.ts` owns shared delimiter and range helpers;
   - `source-mask-comments.ts`, `source-mask-strings.ts`,
     `source-mask-templates.ts`, and `source-mask-regex.ts` own their token
     family scanners;
   - external scanner code still calls `maskNonCodeSource`.
2. Update `docs/repository-layout.md` only if the current source boundary
   wording would mislead a maintainer after the split. Keep the update short
   and maintainer-facing.
3. Update `docs/technical-design.md` §6.2 if the final implementation differs
   from the source-mask facade and token-family ownership note recorded during
   work item 1.
4. Update `docs/roadmap.md` to mark task 2.1.9 complete only after `make all`,
   `make markdownlint`, and `make nixie` pass on the final code state.
5. Update this ExecPlan's `Progress`, `Outcomes & Retrospective`, and revision
   note.

Refactor and validation:

1. Run file-scoped Markdown formatting for exactly the Markdown files changed
   in this work item:

   ```sh
   mdtablefix docs/execplans/roadmap-2-1-9.md docs/developers-guide.md docs/technical-design.md docs/roadmap.md
   bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-9.md docs/developers-guide.md docs/technical-design.md docs/roadmap.md
   ```

   If `docs/repository-layout.md` is changed, include it in both commands.
2. Run the full gates:

   ```sh
   make all
   make markdownlint
   make nixie
   ```

3. After committing the final documentation and roadmap updates, confirm the
   worktree is clean and run the roadmap branch review gate:

   ```sh
   git status --short
   make branch-freshness
   ```

   Expect `git status --short` to print no paths and `make branch-freshness`
   to pass. If `git status --short` prints any path, do not request review;
   commit intended changes or park unrelated churn with the named stash policy
   from `Constraints`, then rerun the command sequence.

4. Acceptance: documentation describes the implemented module split, roadmap
   task 2.1.9 is complete, and all repository gates pass.

## Concrete steps

Run all commands from
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-9`.

Before implementation starts, refresh the branch-local research state:

```sh
grepai search --workspace 'Projects' --project 'odw-lint' \
  "source mask token scanners split focused modules lexer parser" --toon --compact
leta files src/
leta calls --from maskNonCodeSource --max-depth 3
sem blame src/static-analysis/source-mask.ts
```

Expected GrepAI result: `src/static-analysis/source-mask.ts` appears as the
primary code hit. Expected Leta result: either the source tree and call graph
print successfully, or a concrete Leta tool failure is recorded in
`Surprises & Discoveries` before falling back to exact branch-local file
inspection.

Then implement work items in order. Do not start a later work item while the
current work item's focused tests, file-scoped formatting, `make all`,
`make markdownlint`, or `make nixie` are failing.

After the final work item is committed and the worktree is clean, run:

```sh
git status --short
make branch-freshness
```

Expected result: `git status --short` prints no paths, and
`make branch-freshness` passes after refreshing `origin/main`. If
`make branch-freshness` fails because the branch is stale, follow the target's
diagnostic instead of requesting review. Do not describe `make all` as a
freshness check; it is the repository build, format, lint, typecheck, and test
gate only.

## Validation and acceptance

The final acceptance criteria are:

- `maskNonCodeSource` remains importable from `odw-lint` and
  `src/static-analysis/index.ts`.
- `MaskedSource`, `SourceMaskKind`, and `SourceMaskRange` remain importable
  from the same public facade paths as before.
- No production caller imports token-family modules directly.
- `source-mask.ts` is a facade and orchestration module, not the owner of every
  token-family scanner.
- Comment, string, template, regex, and delimiter/range helpers have named
  implementation homes.
- Existing masking unit, fixture, and property tests pass without weakening
  assertions.
- Public API surface tests pass without removing any current root export.
- Every TypeScript source and test file is at or below 400 physical lines.
- No dependency file changes are needed.
- Documentation describes the final ownership split.

Final validation commands:

```sh
bun test ./tests/static-analysis/source-file-architecture.test.ts \
  ./tests/static-analysis/source-mask.test.ts \
  ./tests/static-analysis/source-mask.property.test.ts \
  ./tests/static-analysis/source-mask-fixtures.test.ts \
  ./tests/diagnostics/public-api-surface.test.ts
make all
make markdownlint
make nixie
```

`make all` includes build, formatting verification, whitespace hygiene, lint,
type checking, and tests. It does not fetch or compare against `origin/main`.
`make markdownlint` and `make nixie` are required because this plan and the
closeout work change Markdown.

Final clean-worktree review gate before requesting review:

```sh
git status --short
make branch-freshness
```

`git status --short` must print no paths. `make branch-freshness` refreshes
`origin/main`, checks protected docs and tests changes for roadmap task
branches, and fails when the branch would present unrelated newer
`origin/main` work as review deletions.

## Idempotence and recovery

The planned edits are file moves and import updates. They are safe to repeat
when applied in work-item order. If a work item partially applies and tests
fail, inspect `git diff -- src/static-analysis tests/static-analysis
docs/execplans/roadmap-2-1-9.md` and finish or revert only the partial changes
from that same work item. Do not reset or revert unrelated user changes.

If a file-scoped formatter changes unrelated files, park only the unrelated
formatter churn with the named stash command in `Constraints`, then continue
with the intended files. Do not use an unnamed stash.

If `make build` refreshes `node_modules`, do not commit `node_modules`. If
`bun.lock` changes unexpectedly during this refactor, stop and investigate
before continuing because this task does not require dependency changes.

## Artifacts and notes

Useful research commands and outputs from planning round 1:

```plaintext
$ grepai version
grepai version 0.35.0

$ grepai search --workspace 'Projects' --project 'odw-lint' \
  "source mask token scanners split focused modules lexer parser" --toon --compact --limit 8
top result: Projects/odw-lint/src/static-analysis/source-mask.ts

$ leta calls --from maskNonCodeSource --max-depth 3
maskNonCodeSource -> scanMaskRange -> scanCommentRange
maskNonCodeSource -> scanMaskRange -> scanQuotedStringRange
maskNonCodeSource -> scanMaskRange -> scanTemplateRange
maskNonCodeSource -> scanMaskRange -> scanRegexRange
maskNonCodeSource -> blankMaskedRange
maskNonCodeSource -> nextSignificantCharacterAfterRange

$ sem blame src/static-analysis/source-mask.ts
all source-mask entities shown from commit 073132bc Add inert source masking

$ wc -l src/static-analysis/source-mask.ts
398 src/static-analysis/source-mask.ts

$ make build
installed @biomejs/biome@2.5.1, bun-types@1.3.14, fast-check@4.8.0,
oxlint@1.71.0, and typescript@5.9.3
```

## Interfaces and dependencies

End-state production module interfaces:

```ts
// src/static-analysis/source-mask-types.ts
export type SourceMaskKind = "comment" | "string" | "template" | "regex";
export type SourceMaskRange = Readonly<{
  kind: SourceMaskKind;
  startIndex: number;
  endIndex: number;
}>;
export type MaskedSource = Readonly<{
  sourceFile: OriginalSourceFile;
  maskedText: string;
  ranges: readonly SourceMaskRange[];
}>;
```

```ts
// src/static-analysis/source-mask-delimiters.ts
export const isLineTerminatorCharacter = (character: string): boolean => {
  // existing behaviour moved here
};
export const blankMaskedRange = (
  characters: string[],
  sourceText: string,
  range: SourceMaskRange,
): void => {
  // existing behaviour moved here
};
export const createMaskedRange = (
  kind: SourceMaskKind,
  startIndex: number,
  endIndex: number,
): SourceMaskRange => {
  // existing behaviour moved here
};
export const scanEscapedDelimitedEnd = (
  sourceText: string,
  startIndex: number,
  delimiter: string,
): number => {
  // existing behaviour moved here
};
export const isStringLikeDelimiter = (character: string): boolean => {
  // existing behaviour moved here
};
```

```ts
// src/static-analysis/source-mask-comments.ts
export const isCommentStart = (character: string, nextCharacter: string): boolean => {
  // existing behaviour moved here
};
export const scanCommentRange = (
  sourceText: string,
  startIndex: number,
  character: string,
  nextCharacter: string,
): SourceMaskRange | undefined => {
  // existing behaviour moved here
};
export const scanLineCommentEnd = (sourceText: string, startIndex: number): number => {
  // existing behaviour moved here
};
```

```ts
// src/static-analysis/source-mask-strings.ts
export const scanQuotedStringRange = (
  sourceText: string,
  startIndex: number,
  character: string,
): SourceMaskRange | undefined => {
  // existing behaviour moved here
};
```

```ts
// src/static-analysis/source-mask-templates.ts
export type TemplateScanState = {
  readonly expressionDepth: number;
  readonly index: number;
};
export type TemplateScanStep = TemplateScanState & { readonly endIndex?: number };
export const scanTemplateRange = (
  sourceText: string,
  startIndex: number,
  character: string,
): SourceMaskRange | undefined => {
  // existing behaviour moved here
};
export const scanTemplateEnd = (sourceText: string, startIndex: number): number => {
  // existing behaviour moved here
};
export const nextTemplateStep = (
  sourceText: string,
  state: TemplateScanState,
): TemplateScanStep => {
  // existing behaviour moved here
};
export const nextTemplateIndex = (
  sourceText: string,
  index: number,
  expressionDepth: number,
): number | undefined => {
  // existing behaviour moved here
};
export const isTemplateClose = (
  sourceText: string,
  state: TemplateScanState,
): boolean => {
  // existing behaviour moved here
};
export const isTemplateExpressionOpen = (
  sourceText: string,
  index: number,
): boolean => {
  // existing behaviour moved here
};
export const nextOrdinaryTemplateStep = (
  sourceText: string,
  state: TemplateScanState,
): TemplateScanState => {
  // existing behaviour moved here
};
```

```ts
// src/static-analysis/source-mask-regex.ts
export const REGEX_ALLOWED_PREVIOUS_CHARACTERS = new Set(
  "([{,;:=!&|?+-*%<>~^".split(""),
);
export const scanRegexRange = (
  sourceText: string,
  startIndex: number,
  character: string,
  previousSignificantCharacter: string,
): SourceMaskRange | undefined => {
  // existing behaviour moved here
};
export const isRegexAllowedAfter = (previousSignificantCharacter: string): boolean => {
  // existing behaviour moved here
};
export const scanRegexEnd = (
  sourceText: string,
  startIndex: number,
): number | undefined => {
  // existing behaviour moved here
};
export const isRegexClassBoundary = (character: string): boolean => {
  // existing behaviour moved here
};
export const isRegexDelimiter = (
  character: string,
  isInCharacterClass: boolean,
): boolean => {
  // existing behaviour moved here
};
export const scanRegexFlagsEnd = (sourceText: string, startIndex: number): number => {
  // existing behaviour moved here
};
```

`src/static-analysis/source-mask.ts` remains the only public source-mask
facade. It imports these helpers, exports the public mask types, and exports
`maskNonCodeSource`.

No external runtime dependency is added. The plan relies only on existing
locked development tooling:

- Bun `1.3.11` for `bun test`.
- `fast-check@4.8.0` for the existing property tests.
- `@biomejs/biome@2.5.1` for file-scoped TypeScript formatting.
- Repository Makefile targets for full validation.

## Revision note

Planning round 1 created the ExecPlan for roadmap task 2.1.9. It fixed the
implementation mechanism to a facade-plus-focused-internal-modules split,
recorded the current GrepAI, Leta, sem, Firecrawl, sibling ODW, and locked
toolchain evidence, and decomposed delivery into four independently gateable
work items.

Planning round 2 resolved the design-review blocker about validation. The plan
now includes a final clean-worktree `make branch-freshness` step before
requesting review, records why that gate is separate from per-work-item dirty
worktree validation, and corrects the `make all` wording so it only claims
build, formatting, whitespace, lint, typecheck, and test coverage. It no
longer claims that `make all` fetches or compares against current
`origin/main`.

Work item 1 revision completed the shared source-mask foundation extraction.
It added internal type and delimiter modules, focused internal tests for their
contracts, and the technical-design source-mask ownership note requested by
review. CodeRabbit review reached the configured retry cap; the final reported
items were fixed locally and then `make all`, `make markdownlint`, and
`make nixie` passed.

Work item 2 revision completed the comment, quoted-string, and template
scanner extraction. CodeRabbit review found valid edge cases in template
regex-predecessor handling and quoted-string line-terminator handling; those
were fixed with focused tests. The final CodeRabbit retry reached the
configured cap, so the last accepted fix was validated deterministically with
`make all`, `make markdownlint`, and `make nixie` rather than another
CodeRabbit pass.

Work item 3 revision completed the regex scanner extraction. CodeRabbit review
found valid gaps in keyword-led regex detection, postfix-operator division,
escaped line-terminator handling, leading character-class `]` handling, and
empty regex bodies. Those were fixed with focused facade and direct scanner
tests. The final CodeRabbit retry reached the configured cap, so the last
accepted fix was validated deterministically with `make all`,
`make markdownlint`, and `make nixie` rather than another CodeRabbit pass.

Work item 4 revision completed documentation closeout. It updated maintainer
documentation, marked roadmap task 2.1.9 complete, set this ExecPlan status to
complete, and passed deterministic gates plus CodeRabbit with zero findings.
