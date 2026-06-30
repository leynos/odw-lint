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
- [Audit 1.5.3](issues/audit-1.5.3.md) records review findings for roadmap
  workflow review gates.
- [Audit 2.1.6](issues/audit-2.1.6.md) records review findings for the
  no-side-effect metadata execution guard.

## Execution plans

- [Roadmap 1.1.1 ExecPlan](execplans/roadmap-1-1-1.md) plans the
  static-analysis and packaging boundary work.
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
- [Roadmap 1.5.3 ExecPlan](execplans/roadmap-1-5-3.md) plans roadmap workflow
  review-gate hardening.
- [Roadmap 2.1.4 ExecPlan](execplans/roadmap-2-1-4.md) plans the forbidden
  executable-runtime import architecture guard.
- [Roadmap 2.1.6 ExecPlan](execplans/roadmap-2-1-6.md) plans the
  no-side-effect metadata execution guard.
- [Roadmap 4.4.1 ExecPlan](execplans/roadmap-4-4-1.md) plans the documentation
  contents and repository-layout scaffolding work.

## Roadmap

- [Roadmap](roadmap.md) sequences delivery phases, steps and tasks. Update it
  when a planned task is completed, re-scoped, or replaced.
