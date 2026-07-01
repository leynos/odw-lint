# Repository layout

`docs/repository-layout.md` is the canonical path-responsibility guide for
maintainers and contributors who need to locate source, tests, documentation,
fixtures and tooling. Update it when repository structure changes enough that a
new contributor could otherwise follow outdated guidance.

Use this page for ownership boundaries and path conventions. Use these
documents for the rationale behind those boundaries:

- [technical design](technical-design.md)
- [ADR 0001](adr/0001-static-analysis-boundary.md)
- [developers' guide](developers-guide.md)
- [rule reference](rules/index.md)
- [documentation style guide](documentation-style-guide.md)
- [scripting standards](scripting-standards.md)
- [complexity guide](complexity-antipatterns-and-refactoring-strategies.md)
- [roadmap](roadmap.md)

## Top-level files and directories

| Path                       | Responsibility and ownership boundary                                                                                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                | Repository-local instructions for agents and maintainers. Keep process, style and quality-gate rules here when they apply to all work in the repository.                                                                      |
| `docs/`                    | Long-lived requirements, design, maintenance and delivery documentation. Treat this directory as the knowledge base and keep it current when behaviour, architecture, dependencies or roadmap scope changes.                  |
| `src/diagnostics/`         | Diagnostic contracts, rule identifiers, rule catalogue data, severities, text rendering, JSON Schema support and report shapes. Changes here affect public diagnostic meaning and must stay aligned with rule docs and tests. |
| `src/static-analysis/`     | Static source-file, position, span, snippet and scan helpers. This is part of the static-analysis ownership boundary; production code here must not import or execute ODW runtime loaders or primitives.                      |
| `tests/diagnostics/`       | Tests for diagnostic contracts, public package exports, rule-catalogue parity, report rendering and architecture facts. Update these tests with any intentional diagnostic, schema, rule or export change.                    |
| `tests/static-analysis/`   | Tests for source helpers, span mapping, source diagnostics and workflow fixture contracts. Keep fixtures and manifests synchronized so tests explain the static-analysis contract without executing workflow source.          |
| `Makefile`                 | Canonical validation entry points. Prefer Make targets, especially `make all`, so local checks match the commit gate.                                                                                                         |
| `package.json`             | Bun package metadata, scripts, private package entry points and direct dependencies. Keep package exports explicit when the public surface changes.                                                                           |
| `bun.lock`                 | Bun dependency lockfile. Commit deliberate lockfile updates with the package metadata change that required them.                                                                                                              |
| `biome.jsonc`              | Biome formatting and lint configuration for source, tests and selected project configuration files.                                                                                                                           |
| `.oxlintrc.json`           | Oxlint and `df12-lints` configuration for maintainability and documentation rules over TypeScript source and tests.                                                                                                           |
| `.markdownlint-cli2.jsonc` | Markdown lint configuration. It defines repository Markdown wrapping, bullet and ignore rules.                                                                                                                                |
| `bunfig.toml`              | Bun configuration for the repository's TypeScript and package-script tooling.                                                                                                                                                 |
| `tsconfig.json`            | Strict TypeScript compiler configuration. Do not weaken strictness to make a change pass.                                                                                                                                     |

## Documentation tree

The `docs/` tree is the source of truth for the product problem, design
decisions, maintenance conventions and roadmap delivery state. It should
explain why the repository is shaped the way it is, while this file explains
where those materials live.

- `docs/terms-of-reference.md` defines the product gap, users, goals,
  constraints and handoff into design.
- `docs/technical-design.md` records the static-analysis architecture,
  diagnostic contract, verification strategy, security boundary, packaging
  decision and deferred integrations.
- `docs/adr/` contains accepted Architectural Decision Records. ADR 0001 owns
  the static-analysis boundary and the ban on executable ODW runtime imports in
  production code.
- `docs/developers-guide.md` describes day-to-day maintainer workflow,
  validation commands, fixture constraints and documentation upkeep.
- `docs/documentation-style-guide.md` defines documentation structure,
  spelling, Markdown style, document types, ADR conventions and roadmap task
  conventions.
- `docs/scripting-standards.md` records scripting practices for automation and
  operational scripts.
- `docs/complexity-antipatterns-and-refactoring-strategies.md` records
  maintainability guidance for recognizing and reducing complexity.
- `docs/rules/` contains rule reference pages. `docs/rules/index.md` is the
  rule-reference entry point and lists each individual rule page.
- `docs/issues/` contains audit findings and review follow-up records. Keep
  these as historical evidence and link from plans or decisions when they
  explain why work exists.
- `docs/execplans/` contains living execution plans for roadmap tasks. Update
  the active plan as implementation progresses, discoveries occur and
  validation evidence changes.
- `docs/roadmap.md` sequences delivery work. Update it when planned tasks are
  completed or re-scoped.

## Source boundaries

`src/diagnostics/` owns diagnostic data and presentation contracts. The rule
catalogue is the source of truth for rule identifiers, categories, default
severities, configuration keys, documentation slugs and release status. Any
catalogue change must stay aligned with JSON Schema generation, public exports,
rule documentation and parity tests.

`src/static-analysis/` owns source modelling and static source inspection. It
may build indexes, spans and snippets from workflow source, but production code
must not import workflow files, evaluate metadata, run workflow bodies or call
ODW runtime helpers that start runs or dispatch agents. The design rationale
lives in [technical-design.md](technical-design.md) and
[ADR 0001](adr/0001-static-analysis-boundary.md).

## Test and fixture boundaries

`tests/diagnostics/` protects the diagnostic surface. It includes tests for
rule catalogue documentation parity, public exports, report rendering, schema
shape and import architecture. When a diagnostic contract changes, update the
affected implementation, documentation, snapshots and tests together.

`tests/static-analysis/` protects source modelling and workflow fixture
contracts. Fixture subdirectories have different ownership rules:

- `tests/static-analysis/fixtures/odw-examples/` contains copied ODW example
  snapshots. Keep these byte-for-byte identical to the upstream examples and do
  not format or rewrite them in this repository.
- `tests/static-analysis/fixtures/invalid-workflows/` contains deliberately raw
  invalid workflow inputs, including hostile metadata fixtures. Do not import,
  evaluate, execute or format these files as ordinary JavaScript.
- `tests/static-analysis/fixtures/masking/` contains `odw-lint`-owned masking
  fixtures for decoy workflow syntax inside comments, strings, regex literals
  and template literals. These fixtures may be formatted by repository tooling,
  but their manifest hashes must stay synchronized.
- `tests/static-analysis/fixtures/refresh-metadata.ts` is the maintainer
  refresh script behind `make refresh-fixtures`. It refreshes copied ODW example
  snapshots and static-analysis fixture manifests without executing raw workflow
  fixture source.

## Tooling boundaries

Use the Makefile as the maintainer entry point for validation. `make all` is
the full code gate; it includes the tracked-file whitespace hygiene guard under
`tests/build-gate/`. Markdown changes also require `make markdownlint`, and
Mermaid changes require `make nixie`.
Use `make refresh-fixtures` when workflow fixture source or manifest metadata
changes.

Use package and configuration files for their narrow responsibilities:

- `package.json` and `bun.lock` own dependency and package-script state.
- `biome.jsonc`, `.oxlintrc.json` and `.markdownlint-cli2.jsonc` own
  formatter, linter and Markdown validation policy.
- `bunfig.toml` and `tsconfig.json` own Bun and TypeScript execution settings.

Do not add tooling dependencies, weaken compiler settings or broaden package
exports as part of a layout-only documentation change.
