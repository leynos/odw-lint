# Add documentation contents and repository layout scaffolding

This ExecPlan (execution plan) is a living document. The sections `Constraints`,
`Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`, `Decision Log`,
and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Status: COMPLETE

Planning round: 2. Do not begin implementation until this plan is approved by
the roadmap workflow.

## Purpose / big picture

Roadmap task 4.4.1 adds the maintainer navigation documents that the
documentation style guide expects: `docs/contents.md` and
`docs/repository-layout.md`. After this task, a maintainer can start at one
canonical contents page, find every current documentation family, and follow a
repository layout guide that explains the purpose and ownership boundary of the
major source, test, fixture and tooling paths.

The observable result is Markdown-only. No `odw-lint` runtime behaviour,
diagnostic contract, command-line interface, public package export or
dependency changes. Success is visible when the new documents are present,
linked from the developer guide, the roadmap item is checked off, and the
repository gates `make all`, `make markdownlint`, and `make nixie` pass.

## Constraints

- Work only in the `roadmap-4-4-1` worktree.
- Do not edit the root/control worktree.
- Treat `origin/main` as the canonical integration branch.
- Use GrepAI first for intent search against the canonical main-branch index:

  ```sh
  grepai search --workspace 'Projects' --project 'odw-lint' \
    "<English intent query>" --toon --compact
  ```

  The GrepAI index reflects `main` only. Verify every branch-local fact with
  `leta`, exact text search, or file inspection inside this worktree.
- Use `leta` for branch-local symbol navigation, references, call graphs, and
  source-file mapping. Exact text search is acceptable for Markdown, JSON,
  Makefile rules, lockfile entries, and literal strings that are not code
  symbols.
- Use `sem` instead of raw Git history commands if implementation needs
  history, blame, entity-level diffs, or change-impact analysis.
- Read and obey `AGENTS.md`, `docs/terms-of-reference.md`,
  `docs/technical-design.md`, `docs/adr/0001-static-analysis-boundary.md`,
  `docs/developers-guide.md`, `docs/scripting-standards.md`,
  `docs/complexity-antipatterns-and-refactoring-strategies.md`,
  `docs/documentation-style-guide.md`, and `docs/roadmap.md`.
- Use en-GB Oxford spelling in prose, with `-ize` and `-yse` forms such as
  "organize" and "analyse".
- Keep the implementation Markdown-only unless this plan is explicitly revised
  and approved. Do not edit `src/`, `tests/`, package metadata, lockfiles,
  Makefile rules, lint configuration or generated artefacts for this task.
- Do not add, remove or update package dependencies.
- Do not create `docs/users-guide.md` in this task. The roadmap item asks for
  `docs/contents.md` and `docs/repository-layout.md`; the current worktree has
  no user guide.
- Do not make new ODW loader, workflow-runtime or example-behaviour claims.
  Link to existing design and developer-guide sections instead. If a future
  revision needs new ODW behavioural claims, first verify them against the
  `open-dynamic-workflows` sibling checkout and update this plan.
- Do not execute workflow source, import ODW runtime helpers, or call ODW
  loader, primitive, launcher, worker, or agent-dispatch paths.
- Keep each work item independently committable and gate-passable. Commit only
  after that work item's validation commands pass.
- Format only changed files. Do not run repository-global mutating formatters
  such as `make fmt` or `bun fmt`.
- For each Markdown-changing work item, run the path-scoped formatter sequence
  first, then the repository gates:

  ```sh
  mdtablefix --in-place --wrap <changed Markdown files>
  bunx markdownlint-cli2@0.20.0 --fix :<changed-file-1> :<changed-file-2>
  make all
  make markdownlint
  make nixie
  ```

  Every path in direct formatter and linter commands must exist at that point
  in the work item and must be edited by that work item.

## Tolerances (exception triggers)

- Scope: stop and escalate if implementation requires non-Markdown file edits.
- Interface: stop and escalate if a public package export, CLI contract,
  diagnostic schema, rule catalogue, Makefile target or fixture manifest must
  change.
- Dependencies: stop and escalate before adding, removing or updating any
  package dependency or lockfile entry.
- Documentation scope: stop and escalate before creating a user guide,
  rewriting existing design content, reorganizing the docs tree, or adding a
  new ADR.
- Path inventory: stop and escalate if the maintainer navigation cannot cover
  current docs, ADRs, issue audits, execution plans, source, tests and tooling
  responsibilities without changing repository structure.
- File count: stop and escalate if the implementation needs more than five
  tracked Markdown files: `docs/repository-layout.md`, `docs/contents.md`,
  `docs/developers-guide.md`, `docs/roadmap.md`, and this ExecPlan.
- Iterations: stop and escalate if the same gate still fails after three
  focused fix attempts.
- Ambiguity: stop and escalate if multiple valid navigation structures would
  materially change what counts as the canonical source of truth.

## Risks

- Risk: The contents index can become a stale duplicate of the file tree.
  Severity: medium. Likelihood: medium. Mitigation: describe audience and
  purpose, not only filenames, and state that the contents file must be updated
  when documentation files are added, renamed or removed.
- Risk: The repository layout guide can drift into architecture rationale that
  belongs in `docs/technical-design.md` or ADRs. Severity: medium. Likelihood:
  medium. Mitigation: keep the layout document focused on path responsibilities
  and link to design documents for rationale.
- Risk: Raw fixture and upstream ODW example paths can be accidentally described
  as ordinary source files. Severity: medium. Likelihood: low. Mitigation: copy
  the developer guide's fixture constraints into layout guidance and avoid
  making new ODW runtime claims.
- Risk: Direct formatter commands can accidentally target files not changed by
  the work item. Severity: medium. Likelihood: low. Mitigation: use the
  file-specific command lists in each work item and rely on repository gates
  for wider validation.
- Risk: `markdownlint-cli2` is not pinned in `package.json` or `bun.lock`.
  Severity: low. Likelihood: medium. Mitigation: use the repository Makefile
  target as the authoritative gate and use the locally verified CLI behaviour
  only for path-scoped `--fix` formatting.

## Progress

- [x] (2026-06-29T17:38Z) Drafted the first-round ExecPlan after GrepAI,
  `leta`, exact-text, tool-source, and official-documentation research.
- [x] (2026-06-29T17:57Z) Revised the ExecPlan for design-review blocking
  points: contents scope, `mdtablefix` evidence, and `markdownlint-cli2`
  versioned evidence.
- [x] (2026-06-29T17:57Z) Validated the round-2 plan revision with
  `mdtablefix --in-place --wrap docs/execplans/roadmap-4-4-1.md`,
  `bunx markdownlint-cli2@0.20.0 --fix :docs/execplans/roadmap-4-4-1.md`,
  `make markdownlint`, `make nixie`, and `make all`.
- [x] (2026-06-29T18:05Z) Created `docs/repository-layout.md` with current
  path responsibilities for documentation, source, tests, fixtures and tooling.
  Path-scoped formatting passed after splitting one long link line.
  `scrutineer` reported `make all`, `make markdownlint`, and `make nixie`
  green. CodeRabbit found a trivial host-specific-path issue in this ExecPlan;
  the plan now uses portable worktree, sibling-checkout, cache and
  temporary-log wording. A second CodeRabbit pass found version-pinning and
  shell-fence issues in validation snippets; direct `markdownlint-cli2` fixes
  are now pinned to v0.20.0, and `pipefail` snippets use Bash fences.
- [x] (2026-06-29T18:29Z) Created `docs/contents.md` with a self-link, direct
  link to `docs/repository-layout.md`, entries for every standalone
  documentation file and a documented rule-reference-family exception for
  individual rule pages. The implementing agent's deterministic gate pass ran
  `make all`, `make markdownlint`, and `make nixie` successfully before the run
  halted on a Codex adapter exit.
- [x] (2026-06-29T21:19Z) Linked the new navigation from
  `docs/developers-guide.md`, closed `docs/roadmap.md` task 4.4.1, and prepared
  the branch for operator-run final validation after the workflow halt.
- [x] (2026-06-29T21:19Z) Operator-run final validation passed:
  `mdtablefix --in-place --wrap` and `bunx markdownlint-cli2@0.20.0 --fix`
  against the changed Markdown files, followed by `make all`,
  `make markdownlint`, and `make nixie`.
- [x] (2026-06-29T21:23Z) Operator-run CodeRabbit review completed after
  punctuation fixes in `docs/contents.md`; the clean pass reported
  `findings: 0`.

## Surprises & Discoveries

- Observation: `docs/contents.md`, `docs/repository-layout.md`, and
  `docs/users-guide.md` are all absent in this branch. Evidence: branch-local
  `test -e` checks returned exit code 1 for each file. Impact: create only the
  two files named by roadmap task 4.4.1 and do not invent a user guide.
- Observation: `make all` does not include Markdown linting or Mermaid
  validation. Evidence: `Makefile` defines
  `all: build check-fmt lint typecheck test`, plus separate `markdownlint` and
  `nixie` targets. Impact: every Markdown-changing work item must run
  `make all`, `make markdownlint`, and `make nixie`.
- Observation: `docs/rules/index.md` is already a standalone rule-reference
  entry point that lists every current rule page. Evidence: branch-local
  inspection of `docs/rules/index.md` shows a table with links to all rule
  pages. Impact: `docs/contents.md` must list `docs/rules/index.md` exactly
  once and must deliberately document that individual rule pages are covered by
  that rule-reference family entry rather than listed as separate contents
  entries.
- Observation: `markdownlint-cli2` is available locally as v0.20.0 but is not a
  locked project dependency. Evidence: `bunx markdownlint-cli2 --help` printed
  `markdownlint-cli2 v0.20.0`; `package.json` and `bun.lock` do not list it as
  a direct dependency; the installed package source and the upstream v0.20.0
  tag both document `--fix`, `:` literal paths, and `--` literal-tail handling.
  Impact: direct `--fix` use is limited to changed files, while
  `make markdownlint` remains the authoritative repository check.
- Observation: `mdtablefix` is installed from the sibling checkout
  the sibling `mdtablefix` checkout at command version 0.4.0. Evidence:
  `mdtablefix --version`, the sibling `Cargo.toml`, README, `src/main.rs`,
  upstream commit-permalink documentation, and a temporary-file smoke test all
  confirm file arguments, `--wrap`, and `--in-place`. Impact: use
  `mdtablefix --in-place --wrap` for changed Markdown files as required by the
  workflow instructions.

## Decision Log

- Decision: Keep this task Markdown-only and do not add a documentation
  navigation test. Rationale: roadmap 4.4.1 changes human navigation documents,
  not executable behaviour. The relevant validation is semantic review plus
  Markdown, Mermaid, and full repository gates. Adding a test would introduce a
  new documentation-enforcement policy outside the requested scope.
  Date/Author: 2026-06-29T17:38Z / Codex.
- Decision: Create `docs/repository-layout.md` before `docs/contents.md`.
  Rationale: the style guide requires the contents file to link directly to the
  repository layout document, so the layout page should exist before the index
  that points at it. Date/Author: 2026-06-29T17:38Z / Codex.
- Decision: Update `docs/developers-guide.md` only after both new navigation
  pages exist. Rationale: the developer-guide style requires early links to the
  repository layout and accepted decision records. Linking after both targets
  exist keeps each commit gate-passable. Date/Author: 2026-06-29T17:38Z / Codex.
- Decision: Do not create or update an ADR.
  Rationale: the task adds navigation scaffolding and records no new
  architecture, dependency, public behaviour or long-term maintenance decision
  beyond the already accepted documentation style. Date/Author:
  2026-06-29T17:38Z / Codex.
- Decision: Scope `docs/contents.md` to standalone documentation entries and
  documentation-family entry points. Rationale: the documentation style guide
  says to list each document exactly once, but `docs/rules/index.md` is already
  the canonical rule-reference document that enumerates every rule page.
  Listing every individual rule page again in `docs/contents.md` would
  duplicate the rule catalogue and make two indexes drift. The contents file
  must therefore list `docs/rules/index.md` exactly once and explicitly state
  that individual `docs/rules/*.md` pages are reached through that
  rule-reference entry. Date/Author: 2026-06-29T17:57Z / Codex.
- Decision: Treat local installed/source evidence and temporary smoke tests as
  load-bearing for Markdown tooling, with upstream documentation cited only at
  versioned or commit-permalink URLs. Rationale: the project invokes the
  locally available commands, and the current unversioned upstream
  `markdownlint-cli2` README can describe newer release lines than local
  v0.20.0. Date/Author: 2026-06-29T17:57Z / Codex.
- Decision: Replace machine-specific absolute paths in the committed ExecPlan
  with portable worktree, sibling-checkout, Bun-cache and temporary-log
  descriptions. Rationale: CodeRabbit correctly noted that committed
  documentation should not require another maintainer to share this machine's
  filesystem layout. The workflow still runs from the active worktree, and the
  final response can report the concrete path used in this run. Date/Author:
  2026-06-29T18:05Z / Codex.
- Decision: Pin direct `markdownlint-cli2` fix commands in the ExecPlan to
  v0.20.0 and mark `pipefail` snippets as Bash. Rationale: CodeRabbit noted
  that the plan mixed unpinned direct-fix commands with version-pinned tool
  evidence, and `set -o pipefail` is a Bash feature rather than portable POSIX
  `sh`. The repository-wide `make markdownlint` gate remains the authoritative
  check. Date/Author: 2026-06-29T18:05Z / Codex.

## Outcomes & Retrospective

Work item 1 created `docs/repository-layout.md` as the canonical
path-responsibility guide. Deterministic gates passed through `scrutineer` with
`make all`, `make markdownlint`, and `make nixie`. CodeRabbit reported one
trivial ExecPlan portability issue and one validation-snippet issue, which were
fixed by removing committed machine-specific absolute paths, pinning direct
`markdownlint-cli2` fix commands to v0.20.0 and using Bash fences for snippets
that set `pipefail`.

Work item 2 created `docs/contents.md` as the canonical documentation index. It
links every standalone documentation file and intentionally routes individual
rule pages through `docs/rules/index.md` rather than duplicating the rule
catalogue. The implementing agent verified that every expected contents link
exists, that no individual rule page is duplicated in the contents index, and
that `make all`, `make markdownlint`, and `make nixie` passed before the
workflow halted on a Codex adapter exit.

The operator recovered the halted branch by linking the new navigation from
`docs/developers-guide.md`, marking roadmap task 4.4.1 complete, and running
the final path-scoped Markdown formatter plus `make all`, `make markdownlint`,
and `make nixie`. CodeRabbit reported two minor serial-comma findings in
`docs/contents.md`; both were verified against the current file, fixed locally,
revalidated with the same gates and followed by a clean CodeRabbit pass with
zero findings. The final branch remains Markdown-only and adds no runtime,
package, dependency, source or test changes.

## Context and orientation

This repository is a private TypeScript/Bun project for `odw-lint`, a static
preflight checker for Open Dynamic Workflows (ODW) scripts. The terms of
reference define the product gap and constraints. The technical design defines
the static-analysis architecture, diagnostic contract, verification strategy,
security boundary, packaging decision and deferred integrations. ADR 0001
accepts the static-analysis boundary: production `odw-lint` owns its parser and
must not import or execute ODW runtime loader paths.

The current documentation tree already contains these families:

- `docs/terms-of-reference.md`, `docs/technical-design.md`, and
  `docs/adr/0001-static-analysis-boundary.md` for requirements and design
  rationale.
- `docs/developers-guide.md`,
  `docs/complexity-antipatterns-and-refactoring-strategies.md`,
  `docs/scripting-standards.md`, and `docs/documentation-style-guide.md` for
  maintainer practices.
- `docs/rules/` for rule reference pages and their index.
- `docs/issues/` for audit findings.
- `docs/execplans/` for roadmap execution plans.
- `docs/roadmap.md` for delivery sequencing.

The current source and test tree is small enough to describe directly:

- `src/diagnostics/` holds diagnostic reporting, severity, schema and rule
  catalogue code.
- `src/static-analysis/` holds static source-file and source-span helpers.
- `tests/diagnostics/` covers diagnostic contracts, public API shape, rule
  documentation parity and architecture checks.
- `tests/static-analysis/` covers source helpers and workflow fixture
  contracts.
- `tests/static-analysis/fixtures/odw-examples/` contains copied ODW example
  snapshots that must stay byte-for-byte identical to upstream examples.
- `tests/static-analysis/fixtures/invalid-workflows/` and
  `tests/static-analysis/fixtures/masking/` contain raw fixtures with special
  formatting and execution constraints.

Roadmap task 4.4.1 is in `docs/roadmap.md` section 4.4, "Add maintainer
documentation navigation". It requires steps 1.1.1 and 1.2.1, both of which are
already checked in the roadmap. The task asks to create `docs/contents.md` and
`docs/repository-layout.md` that index current docs, ADRs, issue audits,
execution plans, source, tests and tooling responsibilities. Its success
condition is that maintainers can find every current documentation family and
repository path from one canonical navigation trail without inferring layout
from filenames.

## Research notes

The following facts were verified before drafting this plan:

- GrepAI v0.35.0 intent search against the canonical `main` index returned the
  documentation style guide and prior roadmap/audit documents as the closest
  matches for repository-layout and documentation-navigation intent. Because
  GrepAI reflects `main`, all branch-local facts below were verified directly
  in this worktree.
- `leta files` mapped the live branch and confirmed current source, test,
  documentation, rule, issue and ExecPlan paths.
- Exact branch-local inspection confirmed `docs/roadmap.md` section 4.4 and
  task 4.4.1; `docs/documentation-style-guide.md` "Standard document types",
  "Contents file", "Developer's guide", "Repository layout document", and
  "Roadmap task writing guidelines"; `docs/developers-guide.md`
  "Static-Analysis Boundary", "Tests", "Workflow Fixture Corpus", "Markdown",
  and "Documentation Upkeep"; `docs/technical-design.md` sections 5, 6, 8, 9,
  11, 12, 15, and 16; `docs/terms-of-reference.md` sections 1, 8, 9 and 12; and
  all sections of ADR 0001.
- `Makefile` defines `make all`, `make markdownlint`, and `make nixie`. The
  default full code gate is `make all`; Markdown changes also require
  `make markdownlint` and `make nixie`.
- `.markdownlint-cli2.jsonc` sets dash bullets, ordered-list numbering, 80
  column prose wrapping, 120 column code-block wrapping, and ignores
  `node_modules` and `dist`.
- Local `mdtablefix` behaviour was pinned to command version 0.4.0. The
  command help says the syntax is `mdtablefix [OPTIONS] [FILES]...`, that
  `--in-place` rewrites files in place, and that `--wrap` wraps paragraphs and
  list items to 80 columns. The sibling source confirms the same contract: the
  sibling `mdtablefix` checkout `Cargo.toml` names version 0.4.0; the sibling
  `mdtablefix` checkout `src/main.rs` defines `files: Vec<PathBuf>`,
  `#[arg(long = "in-place", requires = "files")]`, `#[arg(long = "wrap")]`, and
  writes back through `fs::write` when `in_place` is true. Firecrawl scraped
  the official commit-permalink README and raw source at
  `https://github.com/leynos/mdtablefix/blob/25f148870087c63523bc31fb4877a4680fd4f7e4/README.md`
  and
  `https://raw.githubusercontent.com/leynos/mdtablefix/25f148870087c63523bc31fb4877a4680fd4f7e4/src/main.rs`.
  A local smoke test in a temporary directory ran
  `mdtablefix --in-place --wrap "$file"` against a temporary Markdown file and
  exited 0.
- Local `markdownlint-cli2` behaviour was pinned to v0.20.0 rather than the
  current unversioned upstream README. `bunx markdownlint-cli2 --help` printed
  `markdownlint-cli2 v0.20.0 (markdownlint v0.40.0)` and documents that `--fix`
  updates fixable issues, `:` starts a literal file path, and `--` makes all
  remaining parameters literal. The installed the local Bun package cache
  `package.json` for `markdownlint-cli2` v0.20.0 names version 0.20.0, and the
  installed the local Bun package cache `markdownlint-cli2.mjs` for
  `markdownlint-cli2` v0.20.0 preserves `:`-prefixed arguments in
  `processArgv`, converts them to literal files during enumeration, sets
  `fixDefault = true` for `--fix`, and writes fixed file contents with
  `fs.promises.writeFile`. Firecrawl scraped the upstream v0.20.0 README and
  raw source at
  `https://github.com/DavidAnson/markdownlint-cli2/blob/v0.20.0/README.md` and
  `https://raw.githubusercontent.com/DavidAnson/markdownlint-cli2/refs/tags/v0.20.0/markdownlint-cli2.mjs`.
  A local smoke test in a temporary directory ran
  `bunx markdownlint-cli2@0.20.0 --fix ":$file"` against a temporary Markdown
  file, inserted the required blank line after a heading, and exited 0.
- Local `nixie --help` confirms `nixie --no-sandbox` validates Mermaid
  diagrams in Markdown files, scanning the current directory when no paths are
  supplied. The repository gate uses this command through `make nixie`.

## Plan of work

### Work item 1: Create the repository layout reference

Implement `docs/repository-layout.md` as the canonical path-responsibility
guide.

Read before editing:

- `docs/roadmap.md` section 4.4, task 4.4.1.
- `docs/documentation-style-guide.md` "Standard document types" and
  "Repository layout document".
- `docs/developers-guide.md` "Static-Analysis Boundary", "Tests", "Workflow
  Fixture Corpus", "Markdown", and "Documentation Upkeep".
- `docs/technical-design.md` sections 5, 6, 8, 9, 11, 12, 15 and 16.
- `docs/terms-of-reference.md` sections 1, 8, 9 and 12.
- `docs/adr/0001-static-analysis-boundary.md` "Decision" and
  "Consequences".
- `AGENTS.md` "Documentation Maintenance", "Change Quality & Committing",
  "Markdown Guidance", and "TypeScript Guidance".
- `docs/complexity-antipatterns-and-refactoring-strategies.md` sections 1 and
  6.

Skills and tools to load or use:

- Keep the `execplans` skill active and update this ExecPlan's living sections.
- Use `grepai` for any new concept search and `leta files` or exact text
  search for branch-local verification.
- No language router is required because this work item is Markdown-only. If
  code edits become necessary, stop and revise this plan first.

Required document content:

- Title the document `# Repository layout`.
- Open with a short paragraph naming the audience: maintainers and
  contributors who need to locate source, tests, documentation and tooling.
- State that `docs/repository-layout.md` is the canonical path-responsibility
  guide and must be updated when repository structure changes.
- Describe top-level paths and important subpaths:
  - `AGENTS.md`
  - `docs/`, including `adr/`, `execplans/`, `issues/`, `rules/`, and the
    design/style/roadmap guides
  - `src/diagnostics/`
  - `src/static-analysis/`
  - `tests/diagnostics/`
  - `tests/static-analysis/`
  - `tests/static-analysis/fixtures/odw-examples/`
  - `tests/static-analysis/fixtures/invalid-workflows/`
  - `tests/static-analysis/fixtures/masking/`
  - `Makefile`, `package.json`, `bun.lock`, `biome.jsonc`, `.oxlintrc.json`,
    `.markdownlint-cli2.jsonc`, `bunfig.toml`, and `tsconfig.json`
- Explain ownership boundaries and constraints for each path. For fixtures,
  preserve the existing developer-guide distinction between copied ODW example
  snapshots, raw invalid workflow inputs and owned masking fixtures.
- Link out to the technical design, ADR 0001, developer guide, rule reference,
  documentation style guide, scripting standards, complexity guide and roadmap
  rather than duplicating their rationale.
- Avoid Mermaid diagrams unless the layout truly needs one. A prose list or a
  compact table is enough for this first scaffolding task.

Tests to add or update:

- Unit tests: none. This item adds a human navigation document only.
- Behavioural tests: none. No CLI, diagnostic or runtime behaviour changes.
- Property tests: none. No generated input space is introduced.
- Snapshot tests: none. No snapshot contract changes.
- End-to-end tests: none. Repository gates below are the observable validation.
- Manual semantic check: confirm every documented path exists now, except paths
  explicitly described as generated or ignored such as `node_modules` and
  `dist`.

Path-safe validation commands:

```bash
mdtablefix --in-place --wrap docs/repository-layout.md docs/execplans/roadmap-4-4-1.md
bunx markdownlint-cli2@0.20.0 --fix :docs/repository-layout.md :docs/execplans/roadmap-4-4-1.md
LOG_DIR="$(mktemp -d)"
set -o pipefail
make all 2>&1 | tee $LOG_DIR/make-all-odw-lint-roadmap-4-4-1-layout.out
make markdownlint 2>&1 | tee $LOG_DIR/make-markdownlint-odw-lint-roadmap-4-4-1-layout.out
make nixie 2>&1 | tee $LOG_DIR/make-nixie-odw-lint-roadmap-4-4-1-layout.out
```

Commit after the commands pass.

### Work item 2: Create the documentation contents index

Implement `docs/contents.md` as the canonical documentation index and link it to
`docs/repository-layout.md`.

Read before editing:

- `docs/roadmap.md` section 4.4, task 4.4.1.
- `docs/documentation-style-guide.md` "Standard document types", "Contents
  file", "Developer's guide", "Design document, ADR, and RFC", "Repository
  layout document", and "Roadmap task writing guidelines".
- `docs/developers-guide.md` "Documentation Upkeep" and the rule-catalogue
  guidance in "Tests".
- `docs/rules/index.md` to capture the rule-reference entry point.
- `docs/issues/` and `docs/execplans/` file names from `leta files` or exact
  branch-local file inspection.
- The tool evidence in this plan's "Research notes" if any formatter or linter
  command behaviour is questioned.

Skills and tools to load or use:

- Keep the `execplans` skill active and update this ExecPlan's living sections.
- Use the `en-gb-oxendict-style` skill while writing or revising prose.
- Use GrepAI only for new intent search. Use `leta files` and exact text search
  to enumerate branch-local Markdown files.
- Do not use `hypothesis`, `crosshair`, `mutmut`, or a language router for this
  work item unless the approved scope changes from Markdown-only documentation
  to executable code.
- No language router is required because this work item is Markdown-only.

Required document content:

- Title the document `# Documentation contents`.
- Begin with a link to itself, as required by the style guide.
- Link to every current standalone documentation file exactly once. For this
  task, "standalone documentation file" means top-level documentation files,
  ADRs, issue audits, execution plans, and canonical family index pages such as
  `docs/rules/index.md`.
- Make a deliberate, documented exception for individual rule pages under
  `docs/rules/*.md`: do not list them as separate `docs/contents.md` entries.
  Instead, list `docs/rules/index.md` exactly once as the rule-reference family
  entry, and state that the rule index enumerates the individual rule pages.
- Group material by audience or purpose, not strict alphabetic order:
  - start-here and navigation documents
  - product scope and design documents
  - accepted ADRs
  - maintainer practices
  - rule reference
  - issue audits
  - execution plans
  - roadmap
- Include `docs/repository-layout.md` directly and describe it as the path and
  responsibility guide.
- Enumerate ADRs, issue audits, and execution plans enough that maintainers can
  navigate without guessing from filenames.
- Include these current execution plan entries unless the implementation
  verifies that a file has been intentionally removed before editing:
  `roadmap-1-1-1.md`, `roadmap-1-2-1.md`, `roadmap-1-2-2.md`,
  `roadmap-1-2-3.md`, `roadmap-1-2-4.md`, `roadmap-1-3-1.md`,
  `roadmap-1-3-2.md`, `roadmap-1-3-3.md`, `roadmap-1-3-4.md`,
  `roadmap-1-4-1.md`, `roadmap-1-5-3.md`, `roadmap-2-1-4.md`,
  `roadmap-2-1-6.md`, and `roadmap-4-4-1.md`.
- Include these current issue audit entries unless the implementation verifies
  that a file has been intentionally removed before editing: `audit-1.1.1.md`,
  `audit-1.2.1.md`, `audit-1.2.2.md`, `audit-1.2.3.md`, `audit-1.2.4.md`,
  `audit-1.3.1.md`, `audit-1.3.2.md`, `audit-1.3.3.md`, `audit-1.3.4.md`,
  `audit-1.4.1.md`, `audit-1.5.3.md`, and `audit-2.1.6.md`.
- Do not list `docs/users-guide.md`, because it does not exist in this
  worktree.
- Keep descriptions audience-focused, explaining why someone would open each
  document.

Tests to add or update:

- Unit tests: none. This item adds a human documentation index only.
- Behavioural tests: none. No executable behaviour changes.
- Property tests: none.
- Snapshot tests: none.
- End-to-end tests: none.
- Manual semantic check: confirm every linked Markdown target exists; every
  current standalone document from `leta files docs` appears exactly once; and
  every individual rule page under `docs/rules/*.md` other than
  `docs/rules/index.md` is reachable from `docs/rules/index.md` and covered by
  the explicit rule-reference-family exception.

Path-safe validation commands:

```bash
mdtablefix --in-place --wrap docs/contents.md docs/execplans/roadmap-4-4-1.md
bunx markdownlint-cli2@0.20.0 --fix :docs/contents.md :docs/execplans/roadmap-4-4-1.md
LOG_DIR="$(mktemp -d)"
set -o pipefail
make all 2>&1 | tee $LOG_DIR/make-all-odw-lint-roadmap-4-4-1-contents.out
make markdownlint 2>&1 | tee $LOG_DIR/make-markdownlint-odw-lint-roadmap-4-4-1-contents.out
make nixie 2>&1 | tee $LOG_DIR/make-nixie-odw-lint-roadmap-4-4-1-contents.out
```

Commit after the commands pass.

### Work item 3: Wire navigation into the developer guide and close the roadmap

Update existing maintainer entry points after both new documents exist.

Read before editing:

- `docs/documentation-style-guide.md` "Developer's guide", "Repository layout
  document", and "Roadmap task writing guidelines".
- `docs/developers-guide.md` opening paragraph and "Documentation Upkeep".
- `docs/roadmap.md` section 4.4, task 4.4.1.
- `AGENTS.md` "Documentation Maintenance", "Change Quality & Committing", and
  "Markdown Guidance".

Skills and tools to load or use:

- Keep the `execplans` skill active and update Progress, Decision Log, and
  Outcomes & Retrospective with final evidence.
- Use exact text search for the roadmap checkbox and developer-guide opening.
- No language router is required because this work item is Markdown-only.

Required document changes:

- In `docs/developers-guide.md`, update the opening orientation so it links
  early to:
  - `docs/contents.md`
  - `docs/repository-layout.md`
  - `docs/technical-design.md`
  - `docs/adr/0001-static-analysis-boundary.md`
  - `docs/rules/index.md`
- Keep the developer guide focused on maintainer workflow. Do not embed
  repository-layout detail there; link to the new layout document instead.
- In `docs/roadmap.md`, change task 4.4.1 from `[ ]` to `[x]` only after the
  contents and layout documents exist and validation has passed for work items
  1 and 2.
- In this ExecPlan, mark completed progress items, record validation evidence,
  and fill the outcomes section.

Tests to add or update:

- Unit tests: none. This item links documentation and closes a roadmap
  checkbox.
- Behavioural tests: none. No executable behaviour changes.
- Property tests: none.
- Snapshot tests: none.
- End-to-end tests: none.
- Manual semantic check: confirm the developer-guide links resolve and the
  roadmap checkbox closes exactly task 4.4.1.

Path-safe validation commands:

```bash
mdtablefix --in-place --wrap docs/developers-guide.md docs/roadmap.md docs/execplans/roadmap-4-4-1.md
bunx markdownlint-cli2@0.20.0 --fix :docs/developers-guide.md :docs/roadmap.md :docs/execplans/roadmap-4-4-1.md
LOG_DIR="$(mktemp -d)"
set -o pipefail
make all 2>&1 | tee $LOG_DIR/make-all-odw-lint-roadmap-4-4-1-close.out
make markdownlint 2>&1 | tee $LOG_DIR/make-markdownlint-odw-lint-roadmap-4-4-1-close.out
make nixie 2>&1 | tee $LOG_DIR/make-nixie-odw-lint-roadmap-4-4-1-close.out
```

Commit after the commands pass.

## Concrete steps

Run all commands from the `roadmap-4-4-1` worktree.

1. Confirm the worktree and branch-local file map:

   ```sh
   pwd
   leta files
   ```

   Expected result: `pwd` prints the git-donkey worktree path and `leta files`
   lists `docs/`, `src/`, `tests/`, `Makefile`, `package.json`, and existing
   ExecPlans.

2. For each work item, edit only the files listed in that work item, update the
   living sections of this ExecPlan, run the work item's formatter sequence,
   and then run the work item's validation commands.

3. If a validation command fails, fix only the changed files for that work
   item, re-run that work item's path-scoped formatter sequence, and re-run the
   failing gate. Stop after three focused attempts for the same gate.

4. Commit each work item only after the listed gates pass. Use an imperative
   commit subject and a body that explains what changed and why.

5. At final close-out, run a clean status check:

   ```sh
   git status --short
   ```

   Expected result: only intentional committed changes remain; no formatter or
   build churn is parked in the worktree.

## Validation and acceptance

Acceptance is documentation navigation, not new runtime behaviour.

The task is complete when:

- `docs/repository-layout.md` exists and explains current repository path
  responsibilities, including docs, ADRs, issue audits, execution plans,
  source, tests, fixtures and tooling.
- `docs/contents.md` exists, links to itself first, links to
  `docs/repository-layout.md`, lists every current standalone documentation
  file exactly once, and documents that individual `docs/rules/*.md` pages are
  reached through the single `docs/rules/index.md` rule-reference entry.
- `docs/developers-guide.md` links early to the documentation contents,
  repository layout, technical design, ADR 0001, and rule reference.
- `docs/roadmap.md` marks task 4.4.1 complete.
- This ExecPlan records progress, validation evidence and outcomes.
- `make all`, `make markdownlint`, and `make nixie` pass after the final work
  item.

No Red-Green-Refactor loop is required because this task does not change
executable code or observable command behaviour. The nearest observable
substitute is a documentation semantic review plus repository validation gates.
If implementation adds executable checks, stop and revise this plan to include
red tests before code changes.

Quality criteria:

- Tests: no unit, behavioural, property, snapshot or end-to-end tests are added
  for this Markdown-only task.
- Lint/typecheck: `make all` passes.
- Markdown: `make markdownlint` passes.
- Mermaid: `make nixie` passes.
- Security: no workflow source is executed and no ODW runtime paths are
  imported.

## Idempotence and recovery

The planned edits are additive except for small link additions in the developer
guide and a roadmap checkbox update. Re-running `mdtablefix --in-place --wrap`
and `bunx markdownlint-cli2@0.20.0 --fix` on the changed Markdown files is safe
and should converge.

If formatting introduces unexpected churn outside the listed changed files,
stop. Do not commit unrelated churn. If it must be parked, use a named stash
with this exact pattern:

```sh
git stash push -m 'df12-stash v1 task=4.4.1 kind=discard reason="formatter churn"'
```

Do not use a bare or default-message stash.

If a file is accidentally changed outside this plan's scope, inspect the diff
and revert only the accidental change you made. Never revert unrelated user or
workflow changes.

## Artifacts and notes

Keep the temporary validation logs from each work item until final close-out.
At minimum, record in this ExecPlan whether these commands passed:

- `$LOG_DIR/make-all-odw-lint-roadmap-4-4-1-layout.out`
- `$LOG_DIR/make-markdownlint-odw-lint-roadmap-4-4-1-layout.out`
- `$LOG_DIR/make-nixie-odw-lint-roadmap-4-4-1-layout.out`
- `$LOG_DIR/make-all-odw-lint-roadmap-4-4-1-contents.out`
- `$LOG_DIR/make-markdownlint-odw-lint-roadmap-4-4-1-contents.out`
- `$LOG_DIR/make-nixie-odw-lint-roadmap-4-4-1-contents.out`
- `$LOG_DIR/make-all-odw-lint-roadmap-4-4-1-close.out`
- `$LOG_DIR/make-markdownlint-odw-lint-roadmap-4-4-1-close.out`
- `$LOG_DIR/make-nixie-odw-lint-roadmap-4-4-1-close.out`

Do not commit temporary validation logs.

## Interfaces and dependencies

No TypeScript interfaces, runtime dependencies, package exports, command-line
options, diagnostic schema fields, rule identifiers or fixture manifests are
created or changed.

The only command-line tools the plan relies on are already available in this
environment or defined by the repository:

- `mdtablefix` command version 0.4.0: use `--in-place --wrap` with explicit
  Markdown file paths. Verified against local CLI help, sibling source,
  official commit-permalink README/source, and a temporary-file smoke test.
- `markdownlint-cli2` v0.20.0 locally: use `--fix` with `:`-prefixed literal
  Markdown paths for direct changed-file fixes. Verified against local CLI
  help, installed v0.20.0 source, upstream v0.20.0 README/source, and a
  temporary-file smoke test. Do not rely on the current unversioned upstream
  README for this plan.
- `make all`: repository full code gate as defined in `Makefile`.
- `make markdownlint`: repository Markdown lint gate as defined in `Makefile`.
- `make nixie`: repository Mermaid validation gate as defined in `Makefile`.

If any of these tools are unavailable during implementation, stop and document
the exact failure in the Decision Log before choosing a substitute.

## Initial draft note

This first draft creates the self-contained implementation plan for roadmap
task 4.4.1. It records the branch-local documentation state, pins the
load-bearing Markdown tool behaviours, decomposes the task into three atomic
Markdown work items, and keeps implementation blocked pending roadmap workflow
approval.

## Round 2 revision note

This revision resolves the design-review blockers without beginning
implementation. It makes the contents-file scope explicit, documents the
rule-reference family exception for individual rule pages, pins `mdtablefix` and
`markdownlint-cli2` behaviour to local source plus temporary smoke tests, and
replaces unversioned upstream README reliance with commit-permalink or
versioned Firecrawl-scraped URLs. The work item order and Markdown-only
implementation scope remain unchanged.
