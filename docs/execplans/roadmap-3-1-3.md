# Implement `--strict-claude` severity promotion

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

## Purpose / big picture

`odw-lint` distinguishes ODW runtime validity from Claude Code portability. The
Claude-compatibility rules (`odw/claude-pure-meta`, `odw/no-date-now`,
`odw/no-math-random`, `odw/no-argless-new-date`) are warnings by default so an
ODW-valid workflow is not blocked merely for being Claude-incompatible. Some
callers, however, want portability to be blocking. The `--strict-claude` mode
exists for them: it promotes every Claude-compatibility warning to an error so
the run reports errors and (once the CLI exists) exits non-zero, while the
informational `odw/no-odw-only-validate` rule stays informational.

After this change a caller can take the diagnostics produced by the static lint
pipeline, apply strict-Claude promotion, and observe that the previously
warning-level Claude-compatibility findings are now errors. Because a report
whose `summary.errors` is greater than zero maps to exit code 1
([technical-design.md](../technical-design.md) §7.4), this is the library-level
mechanism that a future `--strict-claude` CLI flag and `strictClaude`
configuration key will switch on.

Observable success: for a workflow whose only findings are Claude-compatibility
warnings, `lintWorkflowSource(source, { strictClaude: true }).diagnostics`
contains error-severity diagnostics for those rules, and
`createDiagnosticReport({ ..., diagnostics })` reports `summary.errors > 0` and
`summary.warnings` reduced by the number promoted. Dialect errors,
dialect warnings such as `odw/meta-statically-unprovable`, and the info-level
`odw/no-odw-only-validate` finding are unchanged.

### Scope boundary (why this is a library mechanism, not a CLI flag)

The executable `odw-lint check` command (roadmap tasks 2.4.1–2.4.3) and the
configuration loader (roadmap step 3.3) are not yet built, so `--strict-claude`
cannot be wired end-to-end as a parsed CLI flag in this task. Task 3.1.3
requires only 3.1.1 and 3.1.2, both of which are library-layer. This plan
therefore delivers the reusable promotion mechanism and reaches it through the
existing `lintWorkflowSource` entry point via an options object. The CLI flag
and configuration key that toggle this mechanism are delivered by the later
tasks that own the CLI and configuration surfaces; this plan updates the
documentation to say so explicitly rather than claiming the flag is parseable
today.

## Constraints

Hard invariants that must hold throughout implementation.

1. Do not execute or evaluate workflow source. The promotion transform is a
   pure function over already-produced `Diagnostic` values and must import no
   ODW runtime code, consistent with
   [adr/0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md)
   and [technical-design.md](../technical-design.md) §6.4. It reads only the
   diagnostic and the inert rule catalogue.
2. Default behaviour is unchanged. `lintWorkflowSource(source)` with no options,
   and every existing exported function, must behave exactly as before. In
   particular `tests/static-analysis/workflow-lint.test.ts` asserts that
   `result.diagnostics` equals the concatenation of the stage sub-views under
   the default (non-strict) call; that invariant must continue to hold for the
   default path.
3. Promotion is catalogue-driven, not literal-list-driven. A diagnostic is
   promoted when, and only when, its rule's catalogue `category` is
   `claude-compatibility` and the diagnostic's effective `severity` is
   `warning`. This automatically covers future Claude-compatibility warnings and
   automatically leaves `odw/no-odw-only-validate` (category
   `claude-compatibility`, severity `info`) informational, matching
   [technical-design.md](../technical-design.md) §9.2.
4. Preserve the diagnostic contract. Promotion changes only `severity`; `file`,
   `rule`, `message`, `span`, `docs`, and `suggestions` are preserved
   byte-for-byte, and outputs stay frozen and immutable per
   [technical-design.md](../technical-design.md) §8 and the AGENTS.md
   immutability rule.
5. The rule catalogue at `src/diagnostics/rule-catalogue.ts` remains the single
   source of truth for categories and default severities; this task adds no new
   rule identifiers and changes no default severities.
6. No code file exceeds 400 lines and every module opens with a `/** @file … */`
   block (AGENTS.md Code Style).

If satisfying the objective requires violating a constraint, do not proceed:
record the conflict in the Decision Log and escalate.

## Tolerances (exception triggers)

1. Scope: if the change touches more than roughly eight files or exceeds about
   250 net lines of non-test code, stop and escalate.
2. Interface: if delivering the mechanism appears to require changing the
   signature or behaviour of any existing exported function other than adding an
   optional trailing `options` argument to `lintWorkflowSource`, stop and
   escalate.
3. Dependencies: if any new runtime or dev dependency seems required, stop and
   escalate. `fast-check` and `bun test` are already available and are the only
   test tools needed.
4. Ambiguity: if a reading of §9.2 would require promoting `info`/`hint`
   Claude-compatibility findings (contradicting the "validate remains
   informational" sentence), stop and present the options.
5. Iterations: if `make all` still fails after three focused attempts on a work
   item, stop and escalate.

## Risks

1. Risk: adding a module or export trips the diagnostics architecture inventory
   guard (`tests/diagnostics/architecture.test.ts` asserts
   `EXPECTED_DIAGNOSTIC_MODULE_FILES`) and the public-API surface guard
   (`tests/diagnostics/public-api-fixtures.ts`) and the package-entry specifier
   list (`EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS`).
   Severity: medium. Likelihood: high.
   Mitigation: WI-1 updates all three reviewed fixtures in the same commit as
   the new module and export.
2. Risk: applying promotion to the merged `diagnostics` field but not to the
   stage sub-views (`scan`, `classification`, `bodySyntax`,
   `claudeCompatibility`) makes the result internally inconsistent under
   `strictClaude: true`.
   Severity: low. Likelihood: medium.
   Mitigation: define and document an explicit contract — sub-views carry each
   stage's default-severity findings; only the merged `diagnostics` reflects
   `--strict-claude`. This keeps §8's "summary counts diagnostics after severity
   overrides" satisfied because summaries are built from the merged stream, and
   it avoids rebuilding structured stage results. Pin the contract with a test.
3. Risk: the promotion helper is public API and could be handed a diagnostic
   whose branded `rule` is not in the catalogue, making a throwing lookup
   (`ruleDefinitionFor`) crash.
   Severity: low. Likelihood: low.
   Mitigation: use a non-throwing catalogue lookup and pass through any rule
   that is absent or not a Claude-compatibility warning; cover with a test.

## Progress

- [x] WI-1: Add the strict-claude severity-promotion transform and export it
- [x] (2026-07-06 01:59Z) WI-2: Apply strict-claude promotion through the lint
  pipeline entry. Red: the new
  `tests/static-analysis/workflow-lint-strict-claude.test.ts` failed because
  `lintWorkflowSource(..., { strictClaude: true })` still returned warning
  severities. Green: the entry point now applies
  `promoteStrictClaudeSeverity` to the merged diagnostics only; the focused Bun
  test passed. Gate evidence: scrutineer re-ran `make all`, `make check-fmt`,
  `make typecheck`, `make lint`, and `make test`; all exited 0.
- [x] (2026-07-06 02:17Z) WI-3: Document the strict-claude promotion contract.
  The developer guide now documents the catalogue-category promotion rule,
  effective-severity semantics, the `lintWorkflowSource` `strictClaude` option,
  the merged-diagnostics-versus-stage-sub-view contract, and the deferred CLI
  and configuration wiring. The four warning-level Claude compatibility rule
  pages now state that `--strict-claude` promotes them to errors, while
  `odw/no-odw-only-validate` states that it stays informational. Gate evidence:
  the touched Markdown files were formatted with `bunx mdtablefix` and
  `bunx markdownlint-cli2 --fix`; scrutineer re-ran `make all`,
  `make check-fmt`, `make typecheck`, `make lint`, `make test`,
  `make markdownlint`, and `make nixie`; all exited 0.

## Surprises & discoveries

- Observation: the `claudeCompatibility` field of `WorkflowLintResult` holds
  only deterministic-time warnings; the `odw/claude-pure-meta` warning is
  emitted under `classification.diagnostics`, not `claudeCompatibility`.
  Evidence: `src/static-analysis/workflow-lint.ts` builds `claudeCompatibility`
  solely from `scanDeterministicTimeWarnings`, while `classifyWorkflowMetadata`
  emits `odw/claude-pure-meta` (`src/static-analysis/workflow-metadata.ts`).
  Impact: promotion must be applied to the merged `diagnostics` stream to catch
  every Claude-compatibility warning; applying it only to the
  `claudeCompatibility` sub-view would miss `odw/claude-pure-meta`.
- Observation: adding this ExecPlan to the branch requires listing it in the
  documentation contents index before the repository test gate is green.
  Evidence: `make test` failed in
  `tests/build-gate/documentation-contents.test.ts` until
  `docs/contents.md` linked `execplans/roadmap-3-1-3.md`; after the index
  update, `make test` passed.
  Impact: WI-1 includes the contents-index link as gate-required documentation
  maintenance, even though the strict-Claude rule-contract prose remains scoped
  to WI-3.
- Observation: the library lint pipeline does not yet emit
  `odw/no-odw-only-validate`.
  Evidence: exact branch-local search found only the catalogue entry, rule docs,
  and WI-1 promotion tests for that rule; the WI-2 pipeline test therefore
  verifies strict-Claude promotion using emitted `odw/claude-pure-meta`,
  `odw/no-date-now`, and `odw/no-math-random` findings.
  Impact: the info-level non-promotion case remains covered by WI-1's pure
  transform tests. WI-2 stays scoped to the currently implemented lint-pipeline
  emissions and does not add a new scanner for `validate(source)`.

## Decision log

- Decision: deliver 3.1.3 as a catalogue-driven, pure severity-promotion
  transform in the diagnostics layer, reached through a new optional
  `options.strictClaude` argument on `lintWorkflowSource`, rather than as a
  parsed CLI flag.
  Rationale: the CLI (2.4) and configuration loader (3.3) do not exist yet, and
  3.1.3 only requires 3.1.1 and 3.1.2. A library mechanism is the largest
  testable, atomic unit available now and is exactly what the future flag will
  call. Documentation records that the flag/config wiring is deferred to its
  owning tasks.
  Date/Author: 2026-07-06, planning agent.
- Decision: promote based on catalogue `category === "claude-compatibility"` and
  effective `severity === "warning"`, not on a hard-coded rule-id list.
  Rationale: matches §9.2 ("promotes all Claude compatibility warnings to
  errors … validate(source) rule should remain informational") and is
  future-proof for new Claude-compatibility warnings.
  Date/Author: 2026-07-06, planning agent.
- Decision: under `strictClaude: true`, only the merged `diagnostics` field
  reflects promotion; stage sub-views keep default severities.
  Rationale: summaries and reports are built from the merged stream (§8), so the
  observable exit-code behaviour is correct; rebuilding structured stage results
  would be invasive and out of scope. The contract is documented and tested.
  Date/Author: 2026-07-06, planning agent.
- Decision: for WI-1, export only `promoteStrictClaudeSeverity` and update the
  reviewed architecture and public-API fixture lists in the same commit.
  Rationale: the transform is the sole new public surface for this work item;
  the optional `lintWorkflowSource` integration surface remains deferred to
  WI-2 as planned.
  Date/Author: 2026-07-06, implementation agent.
- Decision: keep `WorkflowLintOptions` module-private for WI-2.
  Rationale: callers can pass `{ strictClaude: true }` without naming the type,
  and exporting it would grow the public API before the CLI/configuration tasks
  decide the stable consumer-facing option surface.
  Date/Author: 2026-07-06, implementation agent.
- Decision: test the `odw/no-odw-only-validate` non-promotion guarantee through
  WI-1's transform tests, not by adding a WI-2 pipeline fixture.
  Rationale: the current lint pipeline has no scanner that emits that
  informational rule. Adding one would start a separate rule-implementation
  work item, while WI-2 is only the strict-Claude entry-point integration.
  Date/Author: 2026-07-06, implementation agent.

## Outcomes & retrospective

Roadmap task 3.1.3 is complete. The diagnostics layer exports a
catalogue-driven `promoteStrictClaudeSeverity` transform, `lintWorkflowSource`
applies it to the merged diagnostics stream when called with
`{ strictClaude: true }`, and the focused tests prove the report summary shifts
promoted Claude compatibility warnings from warnings to errors while default
mode and stage sub-view severities stay unchanged.

The documentation now records the same contract: warning-level Claude
compatibility rules become errors under strict mode, the
`odw/no-odw-only-validate` information rule is not promoted, and the parsed
`--strict-claude` CLI flag plus `strictClaude` configuration key remain owned by
the later CLI and configuration roadmap tasks.

## Context and orientation

`odw-lint` is a Bun + TypeScript static linter for Open Dynamic Workflows (ODW)
workflow scripts. It never executes workflow source. Relevant files, by full
repository-relative path:

1. `src/diagnostics/rule-catalogue.ts` — the source of truth for rule
   identifiers, `category` (one of `dialect`, `claude-compatibility`,
   `orchestration-risk`), and `defaultSeverity`. Exposes `RULE_CATALOGUE`,
   `ruleDefinitionFor`, and related helpers. The four Claude-compatibility
   warnings and the info-level `odw/no-odw-only-validate` all carry
   `category: "claude-compatibility"`.
2. `src/diagnostics/types.ts` — the `Diagnostic` type
   (`file`, `rule`, `severity`, `message`, `span`, optional `docs`,
   `suggestions`) and `DiagnosticSummary`.
3. `src/diagnostics/severity.ts` — `DiagnosticSeverity`
   (`error | warning | info | hint`).
4. `src/diagnostics/report.ts` — `countDiagnostics` and `createDiagnosticReport`;
   `summary` counts diagnostics by their effective `severity`.
5. `src/diagnostics/rule-diagnostic.ts` — `createRuleDiagnostic`, the frozen
   diagnostic builder used by rule emitters.
6. `src/static-analysis/workflow-lint.ts` — `lintWorkflowSource(source)`, the
   merged static lint entry point. It returns a `WorkflowLintResult` with
   stage sub-views (`scan`, `classification`, `bodySyntax`,
   `claudeCompatibility`) and a merged `diagnostics` array in canonical order
   (`scan.diagnostics`, `classification.diagnostics`, `bodySyntax`,
   `claudeCompatibility`).
7. `src/index.ts` — the single public package entry that re-exports the
   diagnostics and static-analysis surface.
8. `tests/diagnostics/architecture-fixtures.ts` — reviewed inventory lists:
   `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS` (module specifiers imported by
   `src/index.ts`) and `EXPECTED_DIAGNOSTIC_MODULE_FILES` (files under
   `src/diagnostics/`). Guarded by `tests/diagnostics/architecture.test.ts`.
9. `tests/diagnostics/public-api-fixtures.ts` — `EXPECTED_PUBLIC_PACKAGE_EXPORTS`,
   guarded by `tests/diagnostics/public-api-surface.test.ts`.
10. `tests/static-analysis/workflow-lint.test.ts` — behavioural tests for the
    lint entry, using `fast-check` for property generation.
11. `docs/rules/*.md` — one page per rule; `docs/developers-guide.md`,
    `docs/users-guide.md`, and `docs/technical-design.md` describe the CLI and
    rule taxonomy.

Terms defined:

- Promotion: replacing a diagnostic's `severity` `warning` with `error`.
- Effective severity: the `severity` currently on a `Diagnostic`, which may
  already reflect earlier overrides.
- Stage sub-view: a `WorkflowLintResult` field holding one pipeline stage's
  findings (`scan`, `classification`, `bodySyntax`, `claudeCompatibility`).

Design references used: [technical-design.md](../technical-design.md) §§6.3
(metadata classification table: "Warning, promoted by `--strict-claude`"), 7.3
(flags table: `--strict-claude`), 7.4 (exit codes), 8 (diagnostic contract:
"summary counts diagnostics after severity overrides"), 9.2 (Claude
compatibility and the promotion sentence), 10 (`strictClaude` config key), and
11.4 (combinatorial surface: "Default mode versus `--strict-claude`"); roadmap
task 3.1.3; [adr/0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md);
and AGENTS.md quality gates.

## Plan of work

The work is three atomic, independently committable, gate-passing work items.
Each work item follows Red-Green-Refactor within itself: write the smallest
failing test first, observe the intended red failure, implement the minimal
change to reach green, then refactor. Each committed work item is green under
`make all`.

### WI-1: Add the strict-claude severity-promotion transform and export it

Implements [technical-design.md](../technical-design.md) §§8 and 9.2 and roadmap
task 3.1.3. Read before starting: §§8 and 9.2 of the technical design;
`src/diagnostics/rule-catalogue.ts`; AGENTS.md TypeScript Guidance and Testing.
Skills/tools: `execplans`, `biomejs` (formatting/lint expectations),
`en-gb-oxendict` (comments), and `leta` for symbol navigation; use `fast-check`
for the property test.

Create `src/diagnostics/strict-claude.ts` with a `/** @file … */` block and a
pure function:

```ts
export const promoteStrictClaudeSeverity = (
  diagnostics: readonly Diagnostic[],
): readonly Diagnostic[] => { /* … */ };
```

Behaviour: map each diagnostic. Look up its rule with a non-throwing catalogue
lookup (e.g. `RULE_CATALOGUE.find((rule) => rule.id === diagnostic.rule)`). If a
definition is found, its `category` is `"claude-compatibility"`, and the
diagnostic's `severity` is `"warning"`, return a new frozen diagnostic identical
except `severity: "error"`. Otherwise return the diagnostic unchanged (same
reference). Return a frozen array. Keep the module under 400 lines (it will be
small) and free of ODW runtime imports.

Export `promoteStrictClaudeSeverity` from `src/index.ts` via
`export { promoteStrictClaudeSeverity } from "./diagnostics/strict-claude";`.

Update the three reviewed fixtures in the same commit:

1. `tests/diagnostics/architecture-fixtures.ts`: add
   `"./diagnostics/strict-claude"` to `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS`
   (kept in the list's sorted position) and `"strict-claude.ts"` to
   `EXPECTED_DIAGNOSTIC_MODULE_FILES`.
2. `tests/diagnostics/public-api-fixtures.ts`: add `"promoteStrictClaudeSeverity"`
   to `EXPECTED_PUBLIC_PACKAGE_EXPORTS` in sorted position.

Add `tests/diagnostics/strict-claude.test.ts` (see Validation for cases).

Validation command: `make all`.

### WI-2: Apply strict-claude promotion through the lint pipeline entry

Implements [technical-design.md](../technical-design.md) §§7.4, 8, and 11.4 and
roadmap task 3.1.3 success criterion. Read before starting:
`src/static-analysis/workflow-lint.ts`;
`tests/static-analysis/workflow-lint.test.ts`; §§8 and 11.4 of the technical
design. Skills/tools: `execplans`, `biomejs`, `leta`, and `fast-check`.

Add an optional trailing options argument to `lintWorkflowSource`:

```ts
type WorkflowLintOptions = {
  /** Promote Claude-compatibility warnings to errors (mirrors --strict-claude). */
  readonly strictClaude?: boolean;
};

export const lintWorkflowSource = (
  source: WorkflowSource,
  options?: WorkflowLintOptions,
): WorkflowLintResult => { /* … */ };
```

Build the raw diagnostics exactly as today. When `options?.strictClaude` is
`true`, set the returned `diagnostics` field to
`Object.freeze(promoteStrictClaudeSeverity(rawMerged))`; otherwise keep the
current merged array. Leave the stage sub-views (`scan`, `classification`,
`bodySyntax`, `claudeCompatibility`) carrying default severities in both modes.
Document this contract in the module `@file` block and on the
`WorkflowLintResult` type: the sub-views hold each stage's default-severity
findings, and only `diagnostics` reflects `--strict-claude`. Do not export a new
symbol unless `WorkflowLintOptions` is needed by consumers; if it is exported,
extend the public-API and architecture fixtures accordingly and note it in the
Decision Log (prefer keeping it internal to avoid surface growth).

Add tests in a new `tests/static-analysis/workflow-lint-strict-claude.test.ts`
(keeps the existing file under the size guard). See Validation for cases.

Validation command: `make all`.

### WI-3: Document the strict-claude promotion contract

Implements the AGENTS.md Documentation Maintenance rule and keeps
[technical-design.md](../technical-design.md) §9.2 and the rule pages accurate.
Read before starting: `docs/documentation-style-guide.md`;
`docs/developers-guide.md`; `docs/rules/claude-pure-meta.md`,
`no-date-now.md`, `no-math-random.md`, `no-argless-new-date.md`,
`no-odw-only-validate.md`; `docs/users-guide.md`. Skills/tools: `execplans`,
`en-gb-oxendict`, `changelog` conventions are not required here.

Changes:

1. `docs/developers-guide.md`: add a short subsection documenting
   `promoteStrictClaudeSeverity` — its catalogue-`category` basis, its
   effective-severity semantics, the `lintWorkflowSource` `strictClaude` option,
   and the sub-view-versus-merged severity contract. State that the
   `--strict-claude` CLI flag and `strictClaude` configuration key that toggle it
   are delivered by the CLI (roadmap 2.4) and configuration (roadmap 3.3) tasks.
2. `docs/rules/claude-pure-meta.md`, `docs/rules/no-date-now.md`,
   `docs/rules/no-math-random.md`, `docs/rules/no-argless-new-date.md`: add one
   sentence each noting the rule is a warning by default and is promoted to an
   error under `--strict-claude`.
3. `docs/rules/no-odw-only-validate.md`: note it stays informational and is not
   promoted by `--strict-claude`.

Use en-GB Oxford spelling, wrap prose at 80 columns and code blocks at 120, and
use `-` bullets. Format only the touched Markdown files, then gate.

Validation commands: format each touched Markdown file with
`bunx mdtablefix <file>` then `bunx markdownlint-cli2 --fix <file>`; then run
`make all`, `make markdownlint`, and `make nixie`.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-3-1-3`.

For each work item:

1. Write the new/updated test(s) first and run the focused suite to observe the
   intended red failure, for example:

   ```bash
   bun test tests/diagnostics/strict-claude.test.ts
   ```

   Expect a failure because `promoteStrictClaudeSeverity` does not yet exist
   (WI-1), the `strictClaude` option is not yet honoured (WI-2), or the doc
   assertion has no backing prose (WI-3 has no code test; use the Markdown
   gates as its check).

2. Make the minimal production change to reach green, then re-run the focused
   suite and expect it to pass.

3. Refactor for clarity if needed, then run the full gate:

   ```bash
   make all
   ```

   For WI-3 also run:

   ```bash
   make markdownlint
   make nixie
   ```

4. Commit with an en-GB imperative subject, for example
   `Add strict-claude severity promotion transform`.

## Validation and acceptance

Quality criteria (what "done" means): `make all` passes at each work item's
HEAD; for WI-3, `make markdownlint` and `make nixie` also pass. No code file
exceeds 400 lines. Default (`strictClaude` absent/false) behaviour is bit-for-bit
unchanged.

Red-Green-Refactor evidence to record in Progress as each work item lands:

WI-1 tests (`tests/diagnostics/strict-claude.test.ts`), unit plus property:

1. Each of `odw/claude-pure-meta`, `odw/no-date-now`, `odw/no-math-random`,
   `odw/no-argless-new-date` at `warning` is promoted to `error`.
2. `odw/no-odw-only-validate` at `info` is unchanged.
3. Dialect errors (e.g. `odw/meta-required` at `error`) and dialect warnings
   (`odw/meta-statically-unprovable` at `warning`) are unchanged.
4. A Claude-compatibility rule already at a non-warning severity (construct one
   at `error`) is left unchanged, proving only `warning` is promoted.
5. A diagnostic whose branded `rule` has no catalogue entry (build a valid
   `RuleId` via `makeRuleId` with an unlisted slug) passes through unchanged.
6. `message`, `span`, `docs`, `suggestions`, `file`, and `rule` are preserved;
   output diagnostics and the output array are frozen.
7. Idempotence: applying the transform twice equals applying it once.
8. Property (`fast-check`): for diagnostics generated from arbitrary catalogue
   rules and severities, output severity is `error` iff input category is
   `claude-compatibility` and input severity is `warning`; otherwise output
   equals input; and double application equals single application.

WI-2 tests (`tests/static-analysis/workflow-lint-strict-claude.test.ts`),
behavioural:

1. Default call: a workflow containing `Date.now()` (and/or computed metadata
   for `odw/claude-pure-meta`) still yields those findings at `warning` in
   `result.diagnostics`; the existing concatenation invariant holds.
2. `{ strictClaude: true }`: the same workflow yields those Claude-compatibility
   findings at `error` in `result.diagnostics`, while `bodySyntax` dialect
   errors and any `odw/no-odw-only-validate` info finding are unchanged, and the
   stage sub-views still carry default severities (contract test).
3. Report proxy for exit code: feed `result.diagnostics` from the strict call
   into `createDiagnosticReport({ version: "0.0.0-test", files: 1, diagnostics })`
   and assert `summary.errors` increased and `summary.warnings` decreased by the
   number of promoted findings, so a report with `errors > 0` maps to exit 1
   per [technical-design.md](../technical-design.md) §7.4.

WI-3 acceptance: `make markdownlint` and `make nixie` pass; the developer guide
describes the mechanism and defers the flag/config wiring to its owning tasks;
each Claude-compatibility warning page states the promotion; the validate page
states it is not promoted.

Quality method: run the focused `bun test <file>` for red/green, then `make all`
(plus the Markdown gates for WI-3) before each commit. The workflow host
independently re-runs the configured gates against the committed HEAD.

## Idempotence and recovery

Every step is re-runnable. Tests and `make all` are read-only aside from build
caches and are safe to repeat. If a work item's gate fails, fix forward on the
same branch; nothing here is destructive and no data migration is involved. If
the architecture or public-API inventory guard fails after adding the module or
export, update the corresponding reviewed fixture list and re-run `make all`.

## Interfaces and dependencies

New production surface:

In `src/diagnostics/strict-claude.ts`:

```ts
import { RULE_CATALOGUE } from "./rule-catalogue";
import type { Diagnostic } from "./types";

/** Promote Claude-compatibility warnings to errors (mirrors --strict-claude). */
export const promoteStrictClaudeSeverity: (
  diagnostics: readonly Diagnostic[],
) => readonly Diagnostic[];
```

Re-exported from `src/index.ts` as `promoteStrictClaudeSeverity`.

In `src/static-analysis/workflow-lint.ts`:

```ts
type WorkflowLintOptions = {
  readonly strictClaude?: boolean;
};

export const lintWorkflowSource: (
  source: WorkflowSource,
  options?: WorkflowLintOptions,
) => WorkflowLintResult;
```

Dependencies: no new packages. Uses the existing `RULE_CATALOGUE`,
`Diagnostic`/`DiagnosticSeverity` types, `bun test`, and `fast-check`.

## Addenda

- [x] 3.1.3.1. Consolidate strict-Claude promotion policy helpers.
  - Source: audit:3.1.3; severity low.
  - Scope: add a shared non-throwing catalogue lookup and a named
    strict-Claude promotion policy constant where the current implementation
    duplicates lookup and inline policy literals.
  - Success: strict-Claude promotion, tests, and public examples consume the
    shared helper or policy constant where their contracts match, without
    changing promoted diagnostics or default severities.

## Revision note

Initial draft. Decomposes roadmap task 3.1.3 into three atomic work items:
add the catalogue-driven promotion transform (WI-1), reach it through the
`lintWorkflowSource` entry with an optional `strictClaude` flag (WI-2), and
document the contract (WI-3). Records the scope decision that this task delivers
the library mechanism because the CLI and configuration surfaces that would
parse `--strict-claude`/`strictClaude` are owned by later roadmap tasks.

2026-07-06 WI-2 revision. Records the lint-pipeline integration, focused
Red-Green-Refactor evidence, scrutineer gate evidence, and the decision to keep
`WorkflowLintOptions` module-private while leaving user-facing contract
documentation to WI-3.
