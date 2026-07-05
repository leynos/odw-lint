# Documentation contents

Start here: [Documentation contents](contents.md) is the canonical index for the
`odw-lint` documentation set. Update this file whenever a standalone
documentation file is added, renamed or removed.

Individual rule pages under `docs/rules/*.md` are intentionally not listed as
separate entries here. Use the single [rule reference](rules/index.md) family
entry; that index enumerates every current rule page.

## Start here and navigation

- [Documentation contents](contents.md) is this index and should be the first
  stop when choosing which document to open.
- [User's guide](users-guide.md) explains the intended command shape,
  diagnostic report contract, rule navigation, configuration placeholders and
  current non-goals for workflow authors.
- [Repository layout](repository-layout.md) explains repository paths,
  ownership boundaries, fixture constraints and tooling responsibilities.
- [Developers' guide](developers-guide.md) explains maintainer workflow,
  validation commands, testing expectations, fixture upkeep and documentation
  upkeep.

## Product scope and design

- [Terms of reference](terms-of-reference.md) defines the product gap, users,
  goals, non-goals, constraints and handoff into design.
- [Technical design](technical-design.md) explains the static-analysis
  architecture, diagnostic contract, rule taxonomy, verification strategy,
  security boundary, packaging decision and deferred integrations.

## Accepted ADRs

- [ADR 0001: static-analysis boundary](adr/0001-static-analysis-boundary.md)
  records the decision that `odw-lint` owns a non-executing static-analysis
  implementation and must not import executable ODW runtime paths in production
  code.

## Maintainer practices

- [Documentation style guide](documentation-style-guide.md) defines spelling,
  Markdown style, document types, ADR structure, repository-layout guidance and
  roadmap task conventions.
- [Scripting standards](scripting-standards.md) records conventions for
  repository automation and script authoring.
- [Complexity antipatterns and refactoring strategies](complexity-antipatterns-and-refactoring-strategies.md)
  explains complexity risks, refactoring heuristics and maintainability
  practices for code reviewers and implementers.

## Rule reference

- [Rule reference](rules/index.md) lists every released and planned rule from
  the typed catalogue. Open it before editing individual `docs/rules/*.md`
  pages so catalogue metadata, docs, and tests remain aligned.

## Issue audits

- [Audit 1.1.1](issues/audit-1.1.1.md) records review findings for the
  static-analysis and packaging boundary task.
- [Audit 1.2.1](issues/audit-1.2.1.md) records review findings for the
  diagnostic rule identifier and severity spine.
- [Audit 1.2.2](issues/audit-1.2.2.md) records review findings for the source
  position and span model.
- [Audit 1.2.3](issues/audit-1.2.3.md) records review findings for diagnostic
  report and schema work.
- [Audit 1.2.4](issues/audit-1.2.4.md) records review findings for rule
  catalogue documentation parity.
- [Audit 1.3.1](issues/audit-1.3.1.md) records review findings for workflow
  fixture corpus foundations.
- [Audit 1.3.2](issues/audit-1.3.2.md) records review findings for copied ODW
  example fixtures.
- [Audit 1.3.3](issues/audit-1.3.3.md) records review findings for invalid
  workflow fixture coverage.
- [Audit 1.3.4](issues/audit-1.3.4.md) records review findings for masking and
  source-scanning fixtures.
- [Audit 1.4.1](issues/audit-1.4.1.md) records review findings for repository
  build-gate freshness.
- [Audit 1.5.1](issues/audit-1.5.1.md) records review findings for the source
  and test file-size guard.
- [Audit 1.5.3](issues/audit-1.5.3.md) records review findings for roadmap
  workflow review gates.
- [Audit 1.5.8](issues/audit-1.5.8.md) records review findings for
  harness-derived reviewer availability.
- [Audit 1.5.9](issues/audit-1.5.9.md) records review findings for
  consolidated build-gate command-line support.
- [Audit 1.5.10](issues/audit-1.5.10.md) records review findings for recorded
  review-evidence artefact checks.
- [Audit 1.5.11](issues/audit-1.5.11.md) records review findings for
  consolidated build-gate CLI orchestration.
- [Audit 1.5.12](issues/audit-1.5.12.md) records review findings for recorded
  review evidence tree-state binding.
- [Audit 2.1.6](issues/audit-2.1.6.md) records review findings for the
  no-side-effect metadata execution guard.
- [Audit 2.1.7](issues/audit-2.1.7.md) records review findings for
  rule-catalogue parity checks for fixture diagnostics.
- [Audit 2.1.12](issues/audit-2.1.12.md) records review findings for the
  static workflow lint entry point.
- [Audit 2.1.13](issues/audit-2.1.13.md) records review findings for the
  shared scanner primitive layer.
- [Audit 2.1.14](issues/audit-2.1.14.md) records review findings for
  delimited and balanced scanner loop consolidation.
- [Audit 2.2.7](issues/audit-2.2.7.md) records review findings for
  workflow-body parser dialect scope.
- [Audit 2.3.1](issues/audit-2.3.1.md) records review findings for trusted
  ODW example loader-parity harness coverage.
- [Audit 2.3.2](issues/audit-2.3.2.md) records review findings for
  dual-compat parity fixtures.
- [Audit 2.3.3](issues/audit-2.3.3.md) records review findings for
  manifest-driven invalid-fixture diagnostics.
- [Audit 2.3.4](issues/audit-2.3.4.md) records review findings for
  TypeScript-only workflow-body loader rejection.
- [Audit 2.3.5](issues/audit-2.3.5.md) records review findings for fixture
  corpus and diagnostic projection ownership.
- [Audit 3.1.4](issues/audit-3.1.4.md) records review findings for
  deterministic-time lexical binding compatibility.
- [Audit 3.1.5](issues/audit-3.1.5.md) records review findings for
  scope-precise deterministic-time shadowing.
- [Audit 3.1.6](issues/audit-3.1.6.md) records review findings for
  deterministic-time alias lexical scopes.
- [Audit 3.2.5](issues/audit-3.2.5.md) records review findings for shared SWC
  AST guard and traversal helpers.
- [Audit 3.2.6](issues/audit-3.2.6.md) records review findings for complete
  SWC traversal-driver adoption.
- [Audit 3.2.7](issues/audit-3.2.7.md) records review findings for
  scope-owned and public binding fact reconciliation.

## Execution plans

- [Roadmap 1.1.1 ExecPlan](execplans/roadmap-1-1-1.md) plans the
  static-analysis and packaging boundary work.
- [Roadmap 1.1.3 ExecPlan](execplans/roadmap-1-1-3.md) records the public
  command contract addenda.
- [Roadmap 1.2.1 ExecPlan](execplans/roadmap-1-2-1.md) plans the diagnostic
  rule identifier and severity spine.
- [Roadmap 1.2.2 ExecPlan](execplans/roadmap-1-2-2.md) plans the source
  position and span model.
- [Roadmap 1.2.3 ExecPlan](execplans/roadmap-1-2-3.md) plans diagnostic report
  and schema work.
- [Roadmap 1.2.4 ExecPlan](execplans/roadmap-1-2-4.md) plans rule catalogue
  documentation parity.
- [Roadmap 1.3.1 ExecPlan](execplans/roadmap-1-3-1.md) plans workflow fixture
  corpus foundations.
- [Roadmap 1.3.2 ExecPlan](execplans/roadmap-1-3-2.md) plans copied ODW
  example fixtures.
- [Roadmap 1.3.3 ExecPlan](execplans/roadmap-1-3-3.md) plans invalid workflow
  fixture coverage.
- [Roadmap 1.3.4 ExecPlan](execplans/roadmap-1-3-4.md) plans masking and
  source-scanning fixtures.
- [Roadmap 1.3.5 ExecPlan](execplans/roadmap-1-3-5.md) plans fixture metadata
  generation and refresh tooling.
- [Roadmap 1.4.1 ExecPlan](execplans/roadmap-1-4-1.md) plans repository
  build-gate freshness.
- [Roadmap 1.5.1 ExecPlan](execplans/roadmap-1-5-1.md) plans the automated
  file-size guard for source and test code.
- [Roadmap 1.5.2 ExecPlan](execplans/roadmap-1-5-2.md) plans the
  branch-freshness review guard for roadmap tasks.
- [Roadmap 1.5.3 ExecPlan](execplans/roadmap-1-5-3.md) plans roadmap workflow
  review-gate hardening.
- [Roadmap 1.5.4 ExecPlan](execplans/roadmap-1-5-4.md) plans tracked-file
  whitespace hygiene in the commit gate.
- [Roadmap 1.5.5 ExecPlan](execplans/roadmap-1-5-5.md) plans consolidated
  build-gate Git support.
- [Roadmap 1.5.6 ExecPlan](execplans/roadmap-1-5-6.md) plans independent
  roadmap audit review-evidence gates.
- [Roadmap 1.5.7 ExecPlan](execplans/roadmap-1-5-7.md) plans
  `make review-evidence` as a required roadmap review and audit step.
- [Roadmap 1.5.8 ExecPlan](execplans/roadmap-1-5-8.md) plans harness-derived
  reviewer availability for review-evidence runs.
- [Roadmap 1.5.9 ExecPlan](execplans/roadmap-1-5-9.md) plans consolidated
  build-gate CLI writer and report-dispatch support.
- [Roadmap 1.5.10 ExecPlan](execplans/roadmap-1-5-10.md) plans recorded
  review-evidence artefact checks.
- [Roadmap 1.5.11 ExecPlan](execplans/roadmap-1-5-11.md) plans consolidated
  build-gate CLI run-and-exit orchestration.
- [Roadmap 1.5.12 ExecPlan](execplans/roadmap-1-5-12.md) plans binding
  recorded review evidence to the reviewed tree state.
- [Roadmap 2.1.1 ExecPlan](execplans/roadmap-2-1-1.md) plans source masking
  for inert workflow syntax.
- [Roadmap 2.1.2 ExecPlan](execplans/roadmap-2-1-2.md) plans static envelope
  extraction.
- [Roadmap 2.1.3 ExecPlan](execplans/roadmap-2-1-3.md) plans runtime-invalid
  and statically unprovable metadata classification.
- [Roadmap 2.1.4 ExecPlan](execplans/roadmap-2-1-4.md) plans the forbidden
  executable-runtime import architecture guard.
- [Roadmap 2.1.5 ExecPlan](execplans/roadmap-2-1-5.md) plans the hostile
  metadata security regression test.
- [Roadmap 2.1.6 ExecPlan](execplans/roadmap-2-1-6.md) plans the
  no-side-effect metadata execution guard.
- [Roadmap 2.1.7 ExecPlan](execplans/roadmap-2-1-7.md) plans rule-catalogue
  parity checks for fixture diagnostics.
- [Roadmap 2.1.8 ExecPlan](execplans/roadmap-2-1-8.md) plans diagnostic
  message templates for parser-backed rules.
- [Roadmap 2.1.9 ExecPlan](execplans/roadmap-2-1-9.md) plans focused
  source-mask token scanner modules.
- [Roadmap 2.1.10 ExecPlan](execplans/roadmap-2-1-10.md) plans canonical
  diagnostic rule documentation links.
- [Roadmap 2.1.11 ExecPlan](execplans/roadmap-2-1-11.md) plans broader
  hostile metadata side-effect fixtures.
- [Roadmap 2.1.12 ExecPlan](execplans/roadmap-2-1-12.md) plans the static
  workflow lint entry point.
- [Roadmap 2.1.13 ExecPlan](execplans/roadmap-2-1-13.md) plans the shared
  scanner primitive layer.
- [Roadmap 2.1.14 ExecPlan](execplans/roadmap-2-1-14.md) plans consolidated
  delimited and balanced scanner loops.
- [Roadmap 2.2.1 ExecPlan](execplans/roadmap-2-2-1.md) plans the SWC-backed
  workflow body parser adapter.
- [Roadmap 2.2.2 ExecPlan](execplans/roadmap-2-2-2.md) plans workflow-body
  normalization for top-level `return` and `await`.
- [Roadmap 2.2.3 ExecPlan](execplans/roadmap-2-2-3.md) plans span snapshot
  assertions for parser-backed diagnostics.
- [Roadmap 2.2.4 ExecPlan](execplans/roadmap-2-2-4.md) plans workflow AST
  facts for lexical bindings and source masks.
- [Roadmap 2.2.5 ExecPlan](execplans/roadmap-2-2-5.md) plans message-template
  adoption in the first parser-backed rule.
- [Roadmap 2.2.6 ExecPlan](execplans/roadmap-2-2-6.md) plans narrowed body
  syntax spans for structured parser offsets.
- [Roadmap 2.2.7 ExecPlan](execplans/roadmap-2-2-7.md) plans the
  workflow-body parser dialect scope reconciliation.
- [Roadmap 2.3.1 ExecPlan](execplans/roadmap-2-3-1.md) plans the minimal
  loader-parity harness against trusted ODW examples and invalid fixtures.
- [Roadmap 2.3.2 ExecPlan](execplans/roadmap-2-3-2.md) plans
  dual-compatibility parity fixtures for pure metadata and deterministic-time
  warnings.
- [Roadmap 2.3.3 ExecPlan](execplans/roadmap-2-3-3.md) plans manifest-driven
  invalid fixture diagnostic assertions.
- [Roadmap 2.3.4 ExecPlan](execplans/roadmap-2-3-4.md) plans TypeScript-only
  workflow-body loader rejection characterization.
- [Roadmap 2.3.5 ExecPlan](execplans/roadmap-2-3-5.md) plans consolidated
  fixture corpus and parity projection ownership.
- [Roadmap 3.1.2 ExecPlan](execplans/roadmap-3-1-2.md) plans
  deterministic-time and randomness warnings.
- [Roadmap 3.1.4 ExecPlan](execplans/roadmap-3-1-4.md) plans
  lexical-binding compatibility for deterministic-time diagnostics.
- [Roadmap 3.1.5 ExecPlan](execplans/roadmap-3-1-5.md) plans scope-precise
  deterministic-time shadowing.
- [Roadmap 3.1.6 ExecPlan](execplans/roadmap-3-1-6.md) plans lexical
  deterministic-time alias resolution.
- [Roadmap 3.2.5 ExecPlan](execplans/roadmap-3-2-5.md) plans shared SWC AST
  guard and traversal helpers for parser-backed rules.
- [Roadmap 3.2.6 ExecPlan](execplans/roadmap-3-2-6.md) plans complete SWC
  traversal-driver adoption for parser-backed collectors.
- [Roadmap 3.2.7 ExecPlan](execplans/roadmap-3-2-7.md) plans scope-owned and
  public binding fact reconciliation.
- [Roadmap 4.4.1 ExecPlan](execplans/roadmap-4-4-1.md) plans the documentation
  contents and repository-layout scaffolding work.

## Roadmap

- [Roadmap](roadmap.md) sequences delivery phases, steps and tasks. Update it
  when a planned task is completed, re-scoped, or replaced.
