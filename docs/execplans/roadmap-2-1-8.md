# Define diagnostic message templates for parser-backed rules

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

Implementation status: Complete.

This is planning round 2. Do not begin implementation until the plan is
approved by the roadmap workflow.

## Purpose / big picture

Roadmap task 2.1.8 introduces the typed diagnostic **message-template**
contract that later parser-backed body rules need before they start emitting
source-specific dynamic messages. A message template is a reviewed string with
zero or more named placeholders written as `{name}`, for example
`Workflow body must be syntactically complete after ODW normalization:
{detail}`. The contract lets a rule render a concrete message from a template
and lets a test decide whether a concrete message could have come from a
reviewed template.

Today the rule catalogue records only exact message strings
(`RuleDefinition.messages`), and the invalid-fixture parity test at
`tests/static-analysis/invalid-workflow-fixtures.test.ts` asserts
`expect(rule.messages).toContain(diagnostic.message)`. Exact strings cannot
describe a message that embeds a parser-produced detail such as an unexpected
token. Without a template contract, the only way to test such a message later
would be a broad substring assertion, which is exactly what roadmap task 2.1.8
exists to prevent.

The observable result of this task is not a new lint rule and not a new emitted
diagnostic. It is a new inert, tested contract module plus the wiring that pins
it:

- A novice can import `createMessageTemplate`, `renderMessageTemplate`, and
  `messageMatchesTemplate` from `odw-lint`, render a message from a reviewed
  template, and verify that a concrete message matches (or fails to match) a
  template.
- `tests/diagnostics/architecture-fixtures.ts` pins the on-disk module
  inventory and package-entry module specifier, and
  `tests/diagnostics/public-api-fixtures.ts` pins the exported symbols, so an
  accidental removal fails the default repository gate.
- `RuleDefinition` gains a `messageTemplates` field (empty for every current
  rule) so a future parser-backed rule can attach a reviewed template, and the
  invalid-fixture parity test accepts a diagnostic whose message either equals
  a reviewed exact message or matches a reviewed template.

Success, restated as behaviour a human can verify:

- `bun test tests/diagnostics/message-template.test.ts` passes and proves
  rendering and matching behaviour, including a template with a placeholder
  matching a rendered message while an unrelated string does not match.
- `bun test tests/diagnostics/architecture.test.ts` fails the moment the new
  module file exists on disk but before `EXPECTED_DIAGNOSTIC_MODULE_FILES` is
  updated (the inventory is derived from a `readdirSync` of `src/diagnostics`),
  and passes once the inventory fixture is updated in the same work item that
  adds the module.
- `bun test tests/diagnostics/package-entry.test.ts` and
  `bun test tests/diagnostics/public-api-surface.test.ts` fail (before their
  fixtures are updated) when the module and its exports are added to
  `src/index.ts`, and pass once `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS` and
  `EXPECTED_PUBLIC_PACKAGE_EXPORTS` are updated in the same work item that edits
  `src/index.ts`.
- `bun test tests/static-analysis/invalid-workflow-fixtures.test.ts` still
  passes for the current exact-message corpus and, in a focused unit assertion,
  accepts a synthetic dynamic message that matches a reviewed template while
  rejecting an unrelated message.
- `make all`, `make markdownlint`, and `make nixie` pass.

## Constraints

- Work only in `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-8` on
  branch `roadmap-2-1-8`. Do not read-modify-write any file in the
  root/control worktree at `/data/leynos/Projects/odw-lint`.
- Treat `origin/main` as the canonical integration branch.
- Use this GrepAI command shape first for intent search against the canonical
  main-branch index:

  ```sh
  grepai search --workspace 'Projects' --project 'odw-lint' \
    "<English intent query>" --toon --compact
  ```

  The GrepAI index reflects `main` only. Verify every branch-local fact with
  `leta`, exact text search, or file inspection inside this worktree before
  editing. In this planning session `grepai`, `leta`, and `sem` could not be
  invoked because the automated agent sandbox required interactive approval
  that no operator could grant; see `Surprises & Discoveries`. Implementation
  agents should retry these tools and record the exact failure if they remain
  unavailable, then fall back to precise branch-local file inspection. Tool
  unavailability is not a reason to mark this plan BLOCKED.
- Use `leta` for branch-local symbol navigation, references, and call graphs
  when available; use `sem` for entity-level history when history is needed.
- This task is a static, inert contract. Production code must not import
  executable ODW runtime paths. ADR
  [0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md)
  forbids imports that evaluate metadata, compile workflow bodies, start runs,
  dispatch agents, or call runtime `validate(source)`. The new
  `src/diagnostics/message-template.ts` module must import nothing from ODW
  runtime and nothing outside `src/diagnostics/`.
- Do not add a package dependency. The locked repository already provides Bun,
  TypeScript, Biome, Oxlint, and Fast-check. A `{name}` template parser is
  plain TypeScript string and `RegExp` work; do not add a templating or parser
  library.
- `src/diagnostics/rule-catalogue.ts` remains the production source of truth
  for rule identifiers, categories, default severities, configuration keys,
  documentation slugs, diagnostic message contracts, and release status. After
  this task it also owns the reviewed message templates a rule may emit.
- Do not implement the SWC parser adapter (roadmap task 2.2.1), body
  normalization (2.2.2), span snapshots (2.2.3), the lint entry point (2.1.12),
  or release any planned orchestration-risk rule. This task defines the
  contract only; no rule emits a dynamic message yet.
- Do not weaken any existing assertion. The invalid-fixture parity test must
  still fail when a fixture diagnostic carries a message that is neither a
  reviewed exact message nor a match for a reviewed template. Template
  acceptance must never degrade to a bare substring (`toContain`) match on the
  message text.
- Keep the `package.json` public export map unchanged. The single package
  entry is `src/index.ts`; the new module is re-exported through it, so the
  `public-api-surface` manifest guard stays green without a manifest edit.
- Every source module starts with a `/** @file ... */` block. Public and
  private declarations need useful JSDoc because Oxlint loads the local
  `df12-lints` plugin. Keep functions small and table-driven; the Oxlint
  configuration enforces low complexity, low nesting depth, and
  complex-conditional limits.
- Respect the strict TypeScript configuration in `tsconfig.json`: `strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `useUnknownInCatchVariables`, and `noPropertyAccessFromIndexSignature` are all
  enabled. Guard every indexed access and regex match-group access.
- Format only files changed in the current work item. Do not run global
  mutating formatters such as `make fmt`, `bun fmt`, or `mdformat-all`. For
  Markdown changes, run `mdtablefix <files>` then
  `bunx markdownlint-cli2 --fix <files>` on the specific changed paths, then run
  the repository gates.
- If a formatter rewrites unrelated files, park that churn with a named discard
  stash:

  ```sh
  git stash push -m 'df12-stash v1 task=2.1.8 kind=discard reason="formatter churn"'
  ```

- Each work item below is independently committable. Run its focused red check,
  focused green check, file-scoped formatter commands, `make all`,
  `make markdownlint`, and `make nixie` before committing that item.
- Use the `commit-message` skill and `git commit -F <message-file>` for each
  implementation commit. Do not use `git commit -m`.
- Prose, comments, and commit messages follow en-GB Oxford spelling
  (`-ize`/`-yse`/`-our`) per the documentation style guide.

If satisfying the objective requires violating a constraint, stop, document the
conflict in `Decision Log`, and escalate.

## Tolerances

- Scope: stop and escalate if implementation needs more than one new
  production TypeScript file, one edited production TypeScript file
  (`src/diagnostics/rule-catalogue.ts`), the package entry `src/index.ts`,
  three test TypeScript files, three documentation files, this ExecPlan, and
  the final `docs/roadmap.md` closure.
- Public API: stop and escalate if an existing public export from `odw-lint`
  must be renamed, removed, or moved to a package subpath. Adding new named
  exports for the message-template contract and adding a readonly
  `messageTemplates` field to the exported `RuleDefinition` type are in scope
  because the package is private and the catalogue is a reviewed contract.
- Dependencies: stop and escalate before adding any package dependency or
  invoking an unpinned external code generator.
- Contract shape: stop and escalate if a reviewed message legitimately requires
  a literal `{` or `}` character inside template text, or requires an
  empty-string interpolation, because this plan pins placeholder-only brace
  syntax and non-empty placeholder matches (see `Decision Log`).
- Fixture scope: stop and escalate if proving template parity requires
  executing or importing raw JavaScript workflow fixtures.
- Tests: if `make all` still fails after three focused fix attempts in one work
  item, record the failing command and options in `Decision Log` before
  continuing.
- Time: stop and escalate if one work item takes more than four hours of
  focused implementation after dependencies are installed.

## Risks

- Risk: the template matcher accepts too much, so a wrong dynamic message would
  pass parity later.
  Severity: high.
  Likelihood: medium.
  Mitigation: `messageMatchesTemplate` builds a fully anchored regex from
  escaped literal segments and requires each placeholder to match one or more
  characters. Work item 1 adds explicit negative unit tests (unrelated message,
  missing literal prefix or suffix, empty placeholder) and a property test that
  every rendered message matches its own template.

- Risk: the template matcher rejects a legitimate rendered message because of
  regex-escaping bugs in literal segments (for example a literal `.` or `(`).
  Severity: medium.
  Likelihood: medium.
  Mitigation: escape all `RegExp` metacharacters in literal segments and cover
  literal punctuation in unit and property tests.

- Risk: adding `messageTemplates` to `RuleDefinition` churns the large
  `EXPECTED_RULE_ROWS` table in `tests/diagnostics/rule-catalogue.test.ts`.
  Severity: low.
  Likelihood: medium.
  Mitigation: work item 3 keeps the six-column `EXPECTED_RULE_ROWS` unchanged
  and adds a separate focused assertion that every rule currently declares an
  empty, frozen `messageTemplates` array, plus a type-level assertion of the
  field shape.

- Risk: the invalid-fixture parity change silently weakens the message check.
  Severity: high.
  Likelihood: low.
  Mitigation: work item 4 keeps the exact-message check first, adds the
  template path only through `messageMatchesTemplate` (never `toContain` on
  message text), and adds a focused test that a template match is accepted
  while an unrelated message is rejected.

- Risk: the module file is committed without updating the `readdirSync`-derived
  `EXPECTED_DIAGNOSTIC_MODULE_FILES`, so `architecture.test.ts` fails inside the
  same work item's `make all` gate and the work item is not independently
  committable.
  Severity: high.
  Likelihood: medium.
  Mitigation: work item 1 updates `EXPECTED_DIAGNOSTIC_MODULE_FILES` and
  `EXPECTED_PARSEABLE_SOURCE_FILES` in the same commit that adds
  `src/diagnostics/message-template.ts`. Because those fixtures are the only
  guards driven by the on-disk module inventory (not by `src/index.ts`), work
  item 1 passes `make all` on its own. The red-green demonstration of the
  inventory guard (add module → observe `architecture.test.ts` fail → update
  the inventory fixture → observe pass) is part of work item 1.

- Risk: the module or its exports are added to `src/index.ts` without updating
  the package-entry and public-API guard fixtures, so those guard tests fail
  confusingly.
  Severity: low.
  Likelihood: medium.
  Mitigation: work item 2 updates `src/index.ts`, the
  `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS` list in
  `tests/diagnostics/architecture-fixtures.ts`, and
  `EXPECTED_PUBLIC_PACKAGE_EXPORTS` in `tests/diagnostics/public-api-fixtures.ts`
  in the same commit, and its red step observes only the package-entry and
  public-API guard failures (the inventory guard was already pinned in work
  item 1).

- Risk: `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` reject the
  first implementation of the parser and builder.
  Severity: low.
  Likelihood: medium.
  Mitigation: guard every array and match-group access, and build the frozen
  `messageTemplates` array with a spread the way `messages` is built today.

## Progress

- [x] (2026-07-02) Confirm the worktree is
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-8` on branch
  `roadmap-2-1-8` and install locked dependencies with `make build`.
- [x] (2026-07-02) Work item 1: add the typed diagnostic message-template
  module with unit and property tests, and pin the on-disk inventory in
  `EXPECTED_DIAGNOSTIC_MODULE_FILES` and `EXPECTED_PARSEABLE_SOURCE_FILES` in
  the same commit.
- [x] (2026-07-02) Work item 2: re-export the contract from `src/index.ts` and
  pin it in the package-entry and public-API guard fixtures.
- [x] (2026-07-02) Work item 3: record message templates in the rule catalogue
  contract.
- [x] (2026-07-02) Work item 4: teach invalid-fixture parity to honour message
  templates.
- [x] (2026-07-02) Work item 5: close documentation and roadmap state.

## Surprises & discoveries

- Observation: the invalid-fixture parity check is a single line,
  `expect(rule.messages).toContain(diagnostic.message)`, at
  `tests/static-analysis/invalid-workflow-fixtures.test.ts` line 304, inside
  the "matches fixture diagnostics to the rule catalogue" test.
  Evidence: branch-local read of the test.
  Impact: work item 4 replaces only that line's message assertion with a helper
  that keeps the exact-message check and adds the template path.

- Observation: `tests/diagnostics/architecture.test.ts` derives the diagnostic
  module inventory from `readdirSync("src/diagnostics").sort()` and compares it
  to `EXPECTED_DIAGNOSTIC_MODULE_FILES`, and it compares
  `packageEntryModuleSpecifiers` (source order of `src/index.ts` re-exports) to
  `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS` (via
  `tests/diagnostics/package-entry.test.ts`).
  Evidence: branch-local read of `architecture.test.ts` (line 25 uses
  `readdirSync("src/diagnostics").filter(...).sort()`, a filesystem read),
  `package-entry.test.ts`, and `architecture-fixtures.ts`.
  Impact: the two guards fire at different moments. The inventory guard
  (`EXPECTED_DIAGNOSTIC_MODULE_FILES`) is driven by the on-disk directory, so it
  fails the instant `src/diagnostics/message-template.ts` exists — before any
  `src/index.ts` edit. It must therefore be updated in the same commit that adds
  the module file (work item 1), otherwise work item 1 cannot pass its own
  `make all` gate. The package-entry guard
  (`EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS`) is driven by the source order of
  `src/index.ts` re-exports, so it fails only once `src/index.ts` re-exports the
  module, and is updated in that same commit (work item 2). The module specifier
  and module filename both sort before `report`/`report.ts`, so the new entries
  lead their respective lists to keep the source order alphabetical and the
  `readdirSync().sort()` comparison green.
  `EXPECTED_PARSEABLE_SOURCE_FILES` is iterated rather than derived from disk, so
  adding its entry only fails if the listed file is missing; work item 1 adds
  the entry alongside the file it names.

- Observation: `tests/diagnostics/public-api-surface.test.ts` compares the
  parsed named exports of `src/index.ts` to `EXPECTED_PUBLIC_PACKAGE_EXPORTS`,
  which is a sorted list.
  Evidence: branch-local read of the test and fixture.
  Impact: the new export symbols must be inserted in ASCII sort order into the
  fixture.

- Observation: `grepai`, `leta files`, and `sem diff` could not run in this
  planning session; each invocation was intercepted by the agent Bash sandbox
  with "This command requires approval" and no operator was available to
  approve it.
  Evidence: repeated blocked invocations during planning.
  Impact: planning relied on direct `Read`/`grep` inspection of branch-local
  source, tests, and documentation, which was sufficient to pin every
  load-bearing fact used below. Implementation agents should retry the tools.

- Observation: implementation confirmed `grepai version` and
  `grepai workspace status Projects` succeed, `leta workspace add` and
  `leta files` succeed for the assigned worktree, and `make build` installed
  the expected locked versions (`typescript@5.9.3`, `bun-types@1.3.14`,
  `@biomejs/biome@2.5.1`, `oxlint@1.71.0`, and `fast-check@4.8.0`).
  Evidence: branch-local command output on 2026-07-02.
  Impact: the implementation proceeded with GrepAI and Leta available. A
  `sem diff origin/main -- src/diagnostics tests/diagnostics
  tests/static-analysis` invocation rejected the path form with a usage error,
  so no history-dependent decision used `sem`.

- Observation: the requested `scrutineer` sub-agent could not run gates or
  CodeRabbit because the role failed immediately with the GPT-5.3-Codex-Spark
  quota error "You've hit your usage limit ... try again at Jul 7th, 2026
  11:20 AM."
  Evidence: sub-agent notification for agent
  `019f208c-4585-75d1-83f2-4c286c7dfcc8`.
  Impact: deterministic gates and CodeRabbit were run directly from the
  assigned worktree, with the failure recorded here rather than blocking the
  work item.

- Observation: CodeRabbit found that allowing empty render values conflicted
  with non-empty template matching, inherited properties such as
  `{constructor}` could satisfy placeholder lookup, repeated placeholders could
  match different dynamic text, and the template grammar was duplicated across
  render and match paths.
  Evidence: four `coderabbit review --agent` runs during work item 1.
  Impact: `renderMessageTemplate` now requires own, non-empty placeholder
  values; `messageMatchesTemplate` uses backreferences for repeated
  placeholders; the module centralizes the placeholder grammar; and tests cover
  these behaviours. The final retry's findings were fixed and then validated
  with deterministic gates; no further CodeRabbit retry was run because the
  plan allows only three retries after the initial review.

- Observation: work item 2's package-entry re-export made
  `tests/diagnostics/package-entry.test.ts` and
  `tests/diagnostics/public-api-surface.test.ts` pass once
  `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS` and
  `EXPECTED_PUBLIC_PACKAGE_EXPORTS` were updated in the same change. The
  message-template tests now import from `"odw-lint"`, proving the contract is
  reachable through the package entry rather than a private module path.
  Evidence: focused
  `bun test tests/diagnostics/message-template.test.ts
  tests/diagnostics/package-entry.test.ts
  tests/diagnostics/public-api-surface.test.ts
  tests/diagnostics/architecture.test.ts` passed with 34 tests.
  Impact: future parser-backed rule tests can consume the template helpers
  through the reviewed public package surface.

- Observation: the first work item 2 `make all` run failed only because Biome
  wanted the type-only `MessageTemplateValues` export sorted before the value
  `messageMatchesTemplate` in the same re-export block.
  Evidence: `make all` reported `assist/source/organizeImports` on
  `src/index.ts`.
  Impact: the export block was reordered, file-scoped formatting was rerun,
  and the next `make all` passed.

- Observation: work item 2 CodeRabbit completed with no findings after the
  deterministic gates were green.
  Evidence: `coderabbit review --agent` returned
  `{"type":"complete","status":"review_completed","findings":0}`.
  Impact: no follow-up changes were needed before the work item 2 commit.

- Observation: work item 3's focused red test failed before implementation
  because `rule.messageTemplates` was absent from current catalogue entries.
  Evidence: `bun test tests/diagnostics/rule-catalogue.test.ts` failed at
  `expect(Array.isArray(rule.messageTemplates)).toBeTrue()`.
  Impact: the catalogue type and builder now expose a frozen
  `messageTemplates` array, defaulting to empty for every current rule, and map
  any future reviewed template strings through `createMessageTemplate`.

- Observation: adding the catalogue field did not require changing the reviewed
  six-column `EXPECTED_RULE_ROWS` table or any current rule message.
  Evidence: the focused catalogue test passed with 8 tests after the builder
  change, and `make all` passed with 503 tests.
  Impact: work item 3 introduced the future dynamic-message contract without
  releasing a new dynamic rule or changing existing fixture expectations.

- Observation: work item 3 CodeRabbit completed with no findings after the
  deterministic gates were green.
  Evidence: `coderabbit review --agent` returned
  `{"type":"complete","status":"review_completed","findings":0}`.
  Impact: no follow-up changes were needed before the work item 3 commit.

- Observation: work item 4 kept the invalid-fixture message contract exact by
  replacing `expect(rule.messages).toContain(diagnostic.message)` with a
  `ruleAllowsMessage` helper that checks exact reviewed messages first and then
  checks reviewed templates with `messageMatchesTemplate`.
  Evidence: focused
  `bun test tests/static-analysis/invalid-workflow-fixtures.test.ts` passed
  with 13 tests and the file-size guard still saw the file under 400 lines
  (370 lines before formatting).
  Impact: current fixtures still pass through exact messages, while future
  parser-backed dynamic diagnostics can use reviewed templates without broad
  substring assertions.

- Observation: the required temporary sabotage proved stale fixture messages
  still fail parity. Changing one manifest message to
  `"Workflow source must export stale literal metadata."` made the focused test
  fail at `expect(ruleAllowsMessage(rule, diagnostic.message)).toBeTrue()`;
  restoring the manifest made the same focused test pass again.
  Evidence: targeted sabotage and restore of
  `tests/static-analysis/fixtures/invalid-workflows/manifests/missing-metadata.ts`.
  Impact: the parity check rejects messages that are neither exact catalogue
  messages nor reviewed template matches.

- Observation: the first work item 4 CodeRabbit invocation hit a recoverable
  rate limit with a reported 17-minute wait. The workflow-required randomized
  backoff selected 76 minutes and completed via `vsleep`.
  Evidence: `coderabbit review --agent` returned `errorType:"rate_limit"` and
  `vsleep minutes=76` completed before retry.
  Impact: the review was retried after the backoff rather than skipped.

- Observation: the work item 4 CodeRabbit retry completed with no findings
  after the deterministic gates were green.
  Evidence: retrying `coderabbit review --agent` returned
  `{"type":"complete","status":"review_completed","findings":0}`.
  Impact: no follow-up changes were needed before the work item 4 commit.

- Observation: the status-only closeout work item passed deterministic gates on
  a clean tree before editing and again after marking the ExecPlan and roadmap
  task complete. The final CodeRabbit review also completed with no findings.
  Evidence: `make all`, `make markdownlint`, and `make nixie` passed before and
  after closeout edits; final `coderabbit review --agent` returned
  `{"type":"complete","status":"review_completed","findings":0}`.
  Impact: roadmap task 2.1.8 is closed with no unresolved review or gate
  issues.

## Decision log

- Decision: implement the message-template contract as a new inert module
  `src/diagnostics/message-template.ts` rather than extending an existing
  module.
  Rationale: roadmap task 2.1.8 says to update the architecture and public-API
  guard fixtures when "the template module or package-entry exports change",
  which presumes a distinct module. A focused module keeps the catalogue and
  types modules unchanged in shape.
  Date/Author: 2026-07-02, planning agent.

- Decision: placeholder syntax is `{name}` where `name` matches
  `[A-Za-z][A-Za-z0-9]*`; every `{` must open a valid placeholder and every `}`
  must close one. `createMessageTemplate` throws on malformed or unbalanced
  braces. There is no brace-escaping mechanism in this task.
  Rationale: templates are reviewed literals authored by maintainers, so a
  total, strict parser is simpler and safer than an escaping grammar. A future
  rule that genuinely needs a literal brace is an explicit, scoped extension,
  not a silent fork; the tolerance above requires escalation for that case.
  Date/Author: 2026-07-02, planning agent.

- Decision: `renderMessageTemplate` is strict — it throws when a required
  placeholder value is missing, empty, inherited rather than own, or when an
  unknown value key is supplied.
  Rationale: strictness surfaces author drift immediately and keeps the
  rendered message deterministic. Callers pass exactly the placeholder set the
  template declares.
  Date/Author: 2026-07-02, planning agent.

- Decision: `messageMatchesTemplate` compiles a fully anchored (`^...$`) regex
  from the template, escaping literal segments, capturing the first occurrence
  of each placeholder with a non-greedy one-or-more-character group
  (`[\s\S]+?`), and matching repeated placeholders with a backreference.
  Rationale: full anchoring plus non-empty placeholder groups prevents the
  broad-substring failure mode the task exists to avoid, while tolerating
  multi-character dynamic details.
  Date/Author: 2026-07-02, planning agent.

- Decision: expose unique placeholder names in first-appearance order in
  `MessageTemplate.placeholders`; a template may repeat a placeholder and both
  occurrences render and match the same value.
  Rationale: a stable, de-duplicated name set is the useful contract for
  callers and tests; repetition is a rendering detail, not a distinct
  placeholder.
  Date/Author: 2026-07-02, planning agent.

- Decision: add `messageTemplates` to `RuleDefinition` with an empty default
  for every current rule, and prove the parity template path with a synthetic
  rule contract in tests rather than releasing a dynamic rule.
  Rationale: no rule emits a dynamic message until roadmap task 2.2.x. The
  field and parity path must exist and be tested now so later parser-backed
  rules can attach templates without weakening parity; a synthetic contract
  proves the wiring without inventing a fixture that a released rule does not
  yet produce.
  Date/Author: 2026-07-02, planning agent.

- Decision: keep the exact-message check first in parity and combine it with
  the template path through a small local `ruleAllowsMessage` helper typed to
  `Pick<RuleDefinition, "messages" | "messageTemplates">`.
  Rationale: the structural `Pick` type lets the focused unit test build a
  synthetic contract without the private catalogue builder or a branded
  `RuleId`, while the real loop passes catalogue rules unchanged.
  Date/Author: 2026-07-02, planning agent.

## Outcomes & retrospective

Roadmap task 2.1.8 is complete. The delivered contract includes the inert
`src/diagnostics/message-template.ts` module, package-entry exports for
template creation, rendering, and matching, a `RuleDefinition.messageTemplates`
field, and invalid-fixture parity that accepts exact reviewed messages or
reviewed templates only. The implementation deliberately emits no new
diagnostic and releases no parser-backed dynamic rule.

The template contract is sufficient for the first parser-backed rule to attach
a reviewed template: placeholder names are parsed once, render values must be
own, exact, and non-empty, repeated placeholders render and match the same
dynamic value, and matching is fully anchored. The remaining parser-backed rule
work can focus on producing the dynamic detail and span mapping rather than
re-opening the diagnostic-message contract.

Validation evidence at closeout:

- `make all` passed with 504 tests and 34 snapshots.
- `make markdownlint` passed.
- `make nixie` passed.
- CodeRabbit completed with no unresolved findings for the final code work
  item after one recoverable rate-limit retry.
- The final status-only CodeRabbit review completed with no findings.

## Context and orientation

The diagnostic model lives under `src/diagnostics/`. Relevant modules:

- `src/diagnostics/severity.ts` defines `DIAGNOSTIC_SEVERITIES` and
  `DiagnosticSeverity`. It is the pattern to mirror for a small, frozen,
  well-documented module.
- `src/diagnostics/rule-id.ts` brands rule identifiers (`makeRuleId`,
  `RuleId`).
- `src/diagnostics/rule-catalogue.ts` exports `RULE_CATALOGUE`, the
  `RuleDefinition` type, the private `ruleDefinition` builder, `RULE_IDS`,
  `RELEASED_RULE_IDS`, `PLANNED_RULE_IDS`, `RuleCategory`, `RuleReleaseStatus`,
  `RuleDocumentationPath`, and `ruleDocsPath`. `RuleDefinition` currently has
  `id`, `category`, `defaultSeverity`, `configKey`, `docsSlug`, `messages`, and
  `releaseStatus`. The private builder accepts an options object
  `RuleDefinitionInput` and freezes each definition and its `messages` array.
- `src/diagnostics/types.ts` defines the `Diagnostic` shape, whose `message` is
  a plain `string`.
- `src/index.ts` is the single package entry. It re-exports diagnostic modules
  in alphabetical order by module path, then `./static-analysis`.

The public surface is guarded by two reviewed fixtures and their tests:

- `tests/diagnostics/architecture-fixtures.ts` lists
  `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS` (the module specifiers re-exported
  by `src/index.ts`, in source order), `EXPECTED_DIAGNOSTIC_MODULE_FILES` (the
  `.ts` files under `src/diagnostics/`, sorted), and
  `EXPECTED_PARSEABLE_SOURCE_FILES` (representative source files that must
  parse). `tests/diagnostics/architecture.test.ts` and
  `tests/diagnostics/package-entry.test.ts` consume these.
- `tests/diagnostics/public-api-fixtures.ts` lists
  `EXPECTED_PUBLIC_PACKAGE_EXPORTS` (the sorted named exports of
  `src/index.ts`). `tests/diagnostics/public-api-surface.test.ts` consumes it.

The rule-catalogue contract test is
`tests/diagnostics/rule-catalogue.test.ts`. It compares a six-column
`EXPECTED_RULE_ROWS` table (id, category, severity, docsSlug, messages,
releaseStatus) to the catalogue, asserts each rule and its `messages` array is
frozen, and asserts released rules with fixture diagnostics have at least one
message.

The invalid-fixture parity test is
`tests/static-analysis/invalid-workflow-fixtures.test.ts`. Its helper
`catalogueRuleForFixtureDiagnostic` maps each fixture diagnostic to its
catalogue rule; the "matches fixture diagnostics to the rule catalogue" test
asserts release status, default severity, exact message membership
(`expect(rule.messages).toContain(diagnostic.message)`), derived docs path, and
snapshot membership. The file is 330 lines; the 400-line TypeScript file guard
is close, so avoid large additions there (see work item 4 refactor note).

Property tests use `fast-check` (`import * as fc from "fast-check"`,
`fc.assert(fc.property(...), runnerOptions)`); see
`tests/static-analysis/source-mask.property.test.ts` and
`tests/static-analysis/source-file-property-oracle.ts`
(`SOURCE_SPAN_PROPERTY_RUNNER = { seed: ..., numRuns: 200 }`) for the local
convention of a fixed seed and bounded run count.

Design documents that bind this task:

- `docs/technical-design.md` §8 (diagnostic contract; the `message` invariant)
  and §9 (rule taxonomy; the catalogue is the source of truth for diagnostic
  message contracts).
- `docs/technical-design.md` §11.1 and §11.5 (differential corpus and
  span-mapping), which motivate why parser-backed body diagnostics carry
  dynamic detail.
- `docs/repository-layout.md` "Source boundaries" and "Test and fixture
  boundaries", which enumerate the catalogue-owned fields and the fixture
  parity contract.
- `docs/developers-guide.md` rule-catalogue paragraph and "Workflow Fixture
  Corpus" section.
- ADR
  [0001-static-analysis-boundary.md](../adr/0001-static-analysis-boundary.md)
  (the module must stay inert).
- `AGENTS.md` §"Testing" (runner, parameterized/table-driven tests, snapshot
  scope, `fast-check` property tests) and the commit-gate rules.

## Interfaces and dependencies

Use the existing Bun and TypeScript toolchain. Do not add dependencies. Confirm
the locked versions after `make build`; `package.json` pins `fast-check`
`^4.8.0`, and roadmap task 2.1.7 recorded the installed set as
`typescript@5.9.3`, `bun-types@1.3.14`, `@biomejs/biome@2.5.1`,
`oxlint@1.71.0`, and `fast-check@4.8.0`. Re-record the observed versions in
`Surprises & Discoveries` if they differ.

At the end of work item 1, `src/diagnostics/message-template.ts` must export the
following stable surface:

```ts
/** A reviewed diagnostic message with zero or more `{name}` placeholders. */
export type MessageTemplate = {
  /** Reviewed template text containing `{name}` placeholders. */
  readonly template: string;
  /** Unique placeholder names in first-appearance order. */
  readonly placeholders: readonly string[];
};

/** Placeholder values keyed by placeholder name. */
export type MessageTemplateValues = Readonly<Record<string, string>>;

/** Parses reviewed template text into a frozen message template. */
export const createMessageTemplate: (template: string) => MessageTemplate;

/** Renders a concrete message, requiring exactly the declared placeholders. */
export const renderMessageTemplate: (
  template: MessageTemplate,
  values: MessageTemplateValues,
) => string;

/** Reports whether a concrete message could come from the template. */
export const messageMatchesTemplate: (
  template: MessageTemplate,
  message: string,
) => boolean;
```

At the end of work item 3, `RuleDefinition` must have this additional public
field, and `RuleDefinitionInput` must accept raw template strings:

```ts
/** Reviewed message templates this rule may render for dynamic diagnostics. */
readonly messageTemplates: readonly MessageTemplate[];
```

Every current catalogue entry keeps an empty `messageTemplates` array until a
later task releases a rule that renders a dynamic message.

## Plan of work

Stages are ordered. Each work item ends with its focused red command, focused
green command, file-scoped formatting, and the repository gates `make all`,
`make markdownlint`, and `make nixie`. Do not batch work items into one commit.

### Work item 1: Add the message-template module and pin the on-disk inventory

This work item creates the inert contract module and its tests, and pins the
on-disk diagnostic module inventory in the same commit. It implements
`docs/roadmap.md` task 2.1.8 ("Introduce the typed template contract needed for
source-specific diagnostic interpolation"), `docs/technical-design.md` §8 (the
`message` invariant this contract will later satisfy), and ADR 0001 (the module
must not import ODW runtime code). It follows `AGENTS.md` §"Testing" for
table-driven unit tests and `fast-check` property tests.

Skills to load before editing: `execplans` (this file is a living plan),
`grepai` (main-branch intent search), and `biomejs` (Biome/TypeScript
formatting and CI). No TypeScript-specific router skill is available in this
session; follow the TypeScript guidance in `AGENTS.md`. Because this work item
adds a `fast-check` property test, keep the property minimal and follow the
local runner convention; the `hypothesis`, `crosshair`, and `mutmut` skills are
Python-only and do not apply.

Red step: add `tests/diagnostics/message-template.test.ts` first, importing the
contract. Cover, as table-driven cases where practical:

- `createMessageTemplate` extracts placeholder names in first-appearance order,
  de-duplicates repeats, and returns a frozen object with a frozen
  `placeholders` array.
- `createMessageTemplate` throws on an unclosed `{`, an unopened `}`, an empty
  `{}`, and an invalid placeholder name (for example `{1x}` or `{a b}`).
- `renderMessageTemplate` substitutes all occurrences of each placeholder,
  throws on a missing value, and throws on an unknown extra key.
- `messageMatchesTemplate` returns true for a rendered message, true when the
  placeholder value contains regex metacharacters and punctuation, and false
  for an unrelated message, a message missing the literal prefix or suffix, and
  a message with an empty run where a placeholder must match.
- A `fast-check` property: for a generated template built from safe literal and
  placeholder fragments and generated non-empty placeholder values,
  `messageMatchesTemplate(template, renderMessageTemplate(template, values))` is
  always true. Use `import * as fc from "fast-check"` and a fixed
  `{ seed, numRuns }` runner in the local style.

Run the focused red command from the repository root:

```sh
bun test tests/diagnostics/message-template.test.ts
```

Expect a module-resolution or type failure because
`src/diagnostics/message-template.ts` does not exist yet. The item 1 test uses
the direct module import for `createMessageTemplate`, `renderMessageTemplate`,
and `messageMatchesTemplate`; the package-level `odw-lint` re-export is added
in work item 2.

Green step: add `src/diagnostics/message-template.ts` with a `/** @file ... */`
header and JSDoc on every declaration. Implement:

- a placeholder scanner that walks the template once, matching `{name}` with a
  strict name pattern, throwing on malformed or unbalanced braces, and
  returning ordered unique names;
- `createMessageTemplate` returning
  `Object.freeze({ template, placeholders: Object.freeze([...names]) })`;
- `renderMessageTemplate` validating the value key set against
  `template.placeholders` (missing and extra keys throw) and replacing each
  `{name}` occurrence;
- `messageMatchesTemplate` building a fully anchored regex by escaping literal
  segments (escape all `RegExp` metacharacters), inserting `[\s\S]+?` for the
  first occurrence of each placeholder, and using backreferences for repeated
  placeholders before testing the whole message.

Guard every indexed and match-group access for `noUncheckedIndexedAccess`. Keep
each function small; extract private helpers (`escapeRegExp`,
`scanPlaceholders`) within the module if a function would otherwise exceed the
complexity limits.

At this point the test still fails because `odw-lint` does not re-export the
module; that re-export is work item 2. To keep work item 1 independently green,
import directly from the module path in the test for this work item —
`import { ... } from "../../src/diagnostics/message-template"` — matching how
other in-package tests import internal modules, and switch the test import to
`odw-lint` in work item 2 when the public export exists. Record this import
switch in `Progress`.

Re-run:

```sh
bun test tests/diagnostics/message-template.test.ts
```

Expect the module test to pass.

Inventory-guard red step (inside this same work item): now that
`src/diagnostics/message-template.ts` exists on disk, run the architecture
guard before touching its fixtures:

```sh
bun test tests/diagnostics/architecture.test.ts
```

Expect a failure: `diagnosticModuleFiles()` (derived from
`readdirSync("src/diagnostics")`) now returns eight entries including
`message-template.ts`, while `EXPECTED_DIAGNOSTIC_MODULE_FILES` still lists
seven. This is why the inventory fixture must be updated in this work item, not
deferred — `make all` runs the full `bun test`, so leaving it stale would break
this work item's own gate.

Inventory-guard green step: update `tests/diagnostics/architecture-fixtures.ts`:

- add `"message-template.ts"` as the first entry of
  `EXPECTED_DIAGNOSTIC_MODULE_FILES` (it sorts before `report.ts`, keeping the
  list aligned with `readdirSync().sort()`);
- add `"src/diagnostics/message-template.ts"` to
  `EXPECTED_PARSEABLE_SOURCE_FILES` in path order (before
  `src/diagnostics/report.ts`); the file exists at this point, so the iterated
  parse check stays green.

Do **not** edit `src/index.ts`, `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS`, or
`EXPECTED_PUBLIC_PACKAGE_EXPORTS` in this work item; those are driven by the
package-entry re-export and belong to work item 2. Because `src/index.ts` is
untouched here, `package-entry.test.ts` and `public-api-surface.test.ts` stay
green throughout work item 1.

Re-run the architecture guard:

```sh
bun test tests/diagnostics/architecture.test.ts \
  tests/diagnostics/message-template.test.ts
```

Expect both to pass.

Refactor step: keep helpers module-local and named. Run file-scoped formatting:

```sh
bunx @biomejs/biome format --write \
  src/diagnostics/message-template.ts \
  tests/diagnostics/message-template.test.ts \
  tests/diagnostics/architecture-fixtures.ts
mdtablefix docs/execplans/roadmap-2-1-8.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-8.md
```

Then run:

```sh
bun test tests/diagnostics/message-template.test.ts \
  tests/diagnostics/architecture.test.ts
make all
make markdownlint
make nixie
```

Commit only after all commands pass. This commit adds the module, its tests, and
the two on-disk-inventory fixtures together, so it is independently committable
and passes `make all` on its own.

### Work item 2: Re-export the contract and pin the package-entry and public-API guards

This work item re-exports the module from `src/index.ts` and updates the two
`src/index.ts`-driven guard fixtures (package-entry module specifiers and public
named exports) so the module's public surface is pinned. The on-disk inventory
fixtures were already pinned in work item 1. It implements `docs/roadmap.md`
task 2.1.8 success text (the guard fixtures "pin the new module and exports"),
`docs/repository-layout.md` "Source boundaries", and
`docs/developers-guide.md` catalogue paragraph (public-export upkeep guidance).

Skills to load before editing: `execplans`, `grepai`, and `biomejs`.

Red step: add the public export to `src/index.ts` first, then run the guard
tests before updating the fixtures so the failure is observed:

- Insert a re-export block for `./diagnostics/message-template` exporting the
  types `MessageTemplate` and `MessageTemplateValues` and the values
  `createMessageTemplate`, `messageMatchesTemplate`, and
  `renderMessageTemplate`. Place the block so the re-exported module specifiers
  stay in alphabetical order; `./diagnostics/message-template` sorts before
  `./diagnostics/report`, so it becomes the first diagnostics re-export.
- In work item 1's test, switch the import from the direct module path to
  `odw-lint`.

Run:

```sh
bun test tests/diagnostics/architecture.test.ts \
  tests/diagnostics/package-entry.test.ts \
  tests/diagnostics/public-api-surface.test.ts
```

Expect `package-entry.test.ts` and `public-api-surface.test.ts` to fail: the
package-entry module specifiers now contain `./diagnostics/message-template` and
the named exports now contain the new symbols, none of which are yet in the
reviewed fixtures. Expect `architecture.test.ts` to still **pass**: the on-disk
inventory (`EXPECTED_DIAGNOSTIC_MODULE_FILES`) was already updated in work item
1, and a re-export adds no top-level declarations to `src/index.ts`, so the
`topLevelDeclarationNames(parseSource("src/index.ts"))` assertion stays `[]`. It
is included in the command only to confirm it remains green.

Green step: update `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS` in
`tests/diagnostics/architecture-fixtures.ts`:

- add `"./diagnostics/message-template"` as the first entry of
  `EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS` (it sorts before
  `./diagnostics/report`).

Do not touch `EXPECTED_DIAGNOSTIC_MODULE_FILES` or
`EXPECTED_PARSEABLE_SOURCE_FILES` in this work item; work item 1 already pinned
them.

Update `tests/diagnostics/public-api-fixtures.ts` by inserting, in ASCII sort
order, `MessageTemplate` and `MessageTemplateValues` (after `MaskedSource`,
before `OriginalSourceFile`), `createMessageTemplate` (after
`createDiagnosticReport`, before `createOriginalSourceFile`),
`messageMatchesTemplate` (after `maskNonCodeSource`, before `parseRuleId`), and
`renderMessageTemplate` (after `positionAtOffset`, before `ruleDocsPath`).

Update `docs/repository-layout.md` "Source boundaries" so it records that
`src/diagnostics/` owns the diagnostic message-template contract module. Update
the `docs/developers-guide.md` catalogue/public-export paragraph so it notes the
message-template exports are part of the reviewed public surface.

Run:

```sh
bun test tests/diagnostics/architecture.test.ts \
  tests/diagnostics/package-entry.test.ts \
  tests/diagnostics/public-api-surface.test.ts \
  tests/diagnostics/message-template.test.ts
```

Expect all four to pass.

Refactor step: none expected. Run file-scoped formatting for the changed files:

```sh
bunx @biomejs/biome format --write \
  src/index.ts \
  tests/diagnostics/architecture-fixtures.ts \
  tests/diagnostics/public-api-fixtures.ts \
  tests/diagnostics/message-template.test.ts
mdtablefix docs/repository-layout.md docs/developers-guide.md \
  docs/execplans/roadmap-2-1-8.md
bunx markdownlint-cli2 --fix \
  docs/repository-layout.md \
  docs/developers-guide.md \
  docs/execplans/roadmap-2-1-8.md
```

Then run:

```sh
make all
make markdownlint
make nixie
```

Commit only after all commands pass.

### Work item 3: Record message templates in the rule catalogue contract

This work item adds the `messageTemplates` field to `RuleDefinition`,
defaulting to empty for every current rule, and documents that the catalogue
owns message templates. It implements `docs/roadmap.md` task 2.1.8 ("before
parser-backed body rules start emitting dynamic messages"),
`docs/technical-design.md` §8 (the `message` invariant extends to reviewed
templates) and §9 (catalogue is the source of truth for message contracts), and
`docs/developers-guide.md` rule-catalogue paragraph.

Skills to load before editing: `execplans`, `grepai`, and `biomejs`.

Red step: update `tests/diagnostics/rule-catalogue.test.ts` first. Keep the
six-column `EXPECTED_RULE_ROWS` table unchanged. Add a new focused test that:

- asserts `rule.messageTemplates` is an array, is frozen, and is empty for
  every current catalogue rule;
- asserts, at type level, that `RuleDefinition["messageTemplates"]` is
  `readonly MessageTemplate[]` (import `type MessageTemplate` from `odw-lint`).

Run:

```sh
bun test tests/diagnostics/rule-catalogue.test.ts
```

Expect a type or assertion failure because `RuleDefinition.messageTemplates`
does not exist yet.

Green step: update `src/diagnostics/rule-catalogue.ts`:

- import `type MessageTemplate` and `createMessageTemplate` from
  `./message-template`;
- add `readonly messageTemplates: readonly MessageTemplate[]` to
  `RuleDefinition` with JSDoc;
- add `readonly messageTemplates?: readonly string[]` to `RuleDefinitionInput`
  (raw reviewed template strings);
- in the private `ruleDefinition` builder, default `messageTemplates` to `[]`,
  map each raw template through `createMessageTemplate`, and freeze the
  resulting array the way `messages` is frozen. Do not add any template to a
  current rule.

Update `docs/technical-design.md` §8 so the `message` invariant states that a
diagnostic message must equal one of the rule's reviewed exact messages or match
one of the rule's reviewed message templates, and §9 so the catalogue is
described as the source of truth for both exact message contracts and message
templates. Update the `docs/developers-guide.md` rule-catalogue paragraph so it
lists message templates among the catalogue-owned message contracts and notes
that templates are used for dynamic parser-backed messages.

Run:

```sh
bun test tests/diagnostics/rule-catalogue.test.ts
```

Expect the catalogue test to pass.

Refactor step: keep the builder table-driven and small. Run file-scoped
formatting:

```sh
bunx @biomejs/biome format --write \
  src/diagnostics/rule-catalogue.ts \
  tests/diagnostics/rule-catalogue.test.ts
mdtablefix docs/technical-design.md docs/developers-guide.md \
  docs/execplans/roadmap-2-1-8.md
bunx markdownlint-cli2 --fix \
  docs/technical-design.md \
  docs/developers-guide.md \
  docs/execplans/roadmap-2-1-8.md
```

Then run:

```sh
make all
make markdownlint
make nixie
```

Commit only after all commands pass.

### Work item 4: Teach invalid-fixture parity to honour message templates

This work item makes the invalid-fixture parity accept a diagnostic whose
message equals a reviewed exact message or matches a reviewed template, without
weakening to a substring match. It implements `docs/roadmap.md` task 2.1.8
success text ("fixture parity can continue checking reviewed messages without
weakening dynamic diagnostics to broad string assertions"),
`docs/technical-design.md` §8, §11.1, and §11.5, `docs/repository-layout.md`
"Test and fixture boundaries", and `docs/developers-guide.md` "Workflow
Fixture Corpus".

Skills to load before editing: `execplans`, `grepai`, and `biomejs`.

Red step: update `tests/static-analysis/invalid-workflow-fixtures.test.ts`
first. Import `messageMatchesTemplate` and `createMessageTemplate` from
`odw-lint`. Add a small local helper:

```ts
type RuleMessageContract = Pick<RuleDefinition, "messages" | "messageTemplates">;

/** Reports whether a diagnostic message satisfies a rule's reviewed contract. */
const ruleAllowsMessage = (rule: RuleMessageContract, message: string): boolean => {
  return (
    rule.messages.includes(message) ||
    rule.messageTemplates.some((template) => messageMatchesTemplate(template, message))
  );
};
```

Replace the message assertion in the "matches fixture diagnostics to the rule
catalogue" test (currently
`expect(rule.messages).toContain(diagnostic.message)`) with
`expect(ruleAllowsMessage(rule, diagnostic.message)).toBeTrue()`. Keep the
release-status, severity, docs-path, and snapshot assertions unchanged.

Add a new focused test that proves the template path with a synthetic released
rule contract, without touching the real catalogue and without a fixture:

```ts
const template =
  "Workflow body must be syntactically complete after ODW normalization: {detail}";
const dynamicRule: RuleMessageContract = {
  messages: [],
  messageTemplates: [createMessageTemplate(template)],
};

// A rendered dynamic message matches the reviewed template.
const rendered =
  "Workflow body must be syntactically complete after ODW normalization: unexpected token }";
expect(ruleAllowsMessage(dynamicRule, rendered)).toBeTrue();

// An unrelated message does not match.
expect(ruleAllowsMessage(dynamicRule, "unrelated message")).toBeFalse();

// A rule with only exact messages still rejects a near-miss message.
const exactRule: RuleMessageContract = {
  messages: ["Workflow metadata must be an object literal."],
  messageTemplates: [],
};
expect(ruleAllowsMessage(exactRule, "Workflow metadata must be an object")).toBeFalse();
```

To prove the parity change is real, temporarily change one existing fixture
diagnostic message in a manifest to a stale string, run the focused test, and
confirm it fails at `ruleAllowsMessage`. Restore the change before continuing;
do not commit the sabotage.

Run:

```sh
bun test tests/static-analysis/invalid-workflow-fixtures.test.ts
```

Expect, after the temporary sabotage, a failure showing the stale message is
neither an exact catalogue message nor a template match. After restoring the
manifest, expect the test to pass (work item 3 keeps `messageTemplates` empty,
so existing fixtures still pass via the exact-message path).

Green step: with the manifest restored, re-run:

```sh
bun test tests/static-analysis/invalid-workflow-fixtures.test.ts
```

Expect the invalid-fixture test to pass. If the compact manifest snapshot
output shape did not change, do not update snapshots. Do not list the optional
snapshot file in any formatter command.

Refactor step: if adding the helper and test would push
`tests/static-analysis/invalid-workflow-fixtures.test.ts` past the 400-line
TypeScript file guard, extract the new `ruleAllowsMessage` helper and its type
to `tests/static-analysis/invalid-fixture-message-contract.ts` with a
`/** @file ... */` header and JSDoc, and import it back into the test. Do not
move unrelated existing helpers. Choose the formatter command that matches what
actually exists:

If no helper file was created:

```sh
bunx @biomejs/biome format --write \
  tests/static-analysis/invalid-workflow-fixtures.test.ts
mdtablefix docs/repository-layout.md docs/developers-guide.md \
  docs/execplans/roadmap-2-1-8.md
bunx markdownlint-cli2 --fix \
  docs/repository-layout.md \
  docs/developers-guide.md \
  docs/execplans/roadmap-2-1-8.md
```

If the helper file was created, include only that existing path:

```sh
bunx @biomejs/biome format --write \
  tests/static-analysis/invalid-workflow-fixtures.test.ts \
  tests/static-analysis/invalid-fixture-message-contract.ts
mdtablefix docs/repository-layout.md docs/developers-guide.md \
  docs/execplans/roadmap-2-1-8.md
bunx markdownlint-cli2 --fix \
  docs/repository-layout.md \
  docs/developers-guide.md \
  docs/execplans/roadmap-2-1-8.md
```

Update `docs/repository-layout.md` "Test and fixture boundaries" and
`docs/developers-guide.md` "Workflow Fixture Corpus" so both state that fixture
diagnostic messages are checked against the rule catalogue's exact messages or
its reviewed message templates, and that templates are how dynamic
parser-backed messages stay reviewable without broad substring assertions.

Then run:

```sh
make all
make markdownlint
make nixie
```

Commit only after all commands pass.

### Work item 5: Close documentation and roadmap state

This work item records completion after code, tests, and documentation have
landed. It implements `docs/roadmap.md` task 2.1.8 status,
`docs/documentation-style-guide.md` roadmap and Markdown style rules, and this
ExecPlan's mandatory living sections.

Skills to load before editing: `execplans` and `commit-message` (before the
commit).

Red step: there is no product red test for a status-only closeout. Before
editing, run on a clean tree:

```sh
make all
make markdownlint
make nixie
```

Expect all gates to pass on the completed work from items 1 to 4.

Green step: update this ExecPlan — mark work items complete in `Progress` with
command evidence and timestamps, add implementation findings to `Surprises &
Discoveries`, add final decisions to `Decision Log`, complete `Outcomes &
Retrospective`, set `Implementation status: Complete`, and set
`Status: COMPLETE`. Then change `docs/roadmap.md` task 2.1.8 from `[ ]` to
`[x]`. Do not mark any later roadmap task complete.

Format the touched Markdown files only:

```sh
mdtablefix docs/execplans/roadmap-2-1-8.md docs/roadmap.md
bunx markdownlint-cli2 --fix docs/execplans/roadmap-2-1-8.md docs/roadmap.md
```

Then run:

```sh
make all
make markdownlint
make nixie
```

Commit the closeout only after all commands pass.

## Concrete steps

All commands run from:

```sh
cd /data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-8
```

Before implementation, refresh branch-local context and install locked
dependencies:

```sh
git status --short --branch
make build
grepai search --workspace 'Projects' --project 'odw-lint' \
  "diagnostic message template interpolation" --toon --compact
leta files
sem diff
```

If `grepai`, `leta`, or `sem` fails in the implementation session, record the
exact failure under `Surprises & Discoveries` and use precise file inspection
for the files named in each work item. Do not mark the plan BLOCKED solely
because an advisory tool is unavailable.

Implement work items 1 to 5 in order. Each has its own focused red command,
focused green command, file-scoped formatter commands, and repository gates. Do
not batch work items into one commit.

## Validation and acceptance

The full acceptance bar is:

- `src/diagnostics/message-template.ts` exports `MessageTemplate`,
  `MessageTemplateValues`, `createMessageTemplate`, `renderMessageTemplate`, and
  `messageMatchesTemplate`, and imports nothing from ODW runtime code.
- `tests/diagnostics/message-template.test.ts` passes and includes negative
  matching cases and a render/match property.
- `src/index.ts` re-exports the contract,
  `tests/diagnostics/architecture-fixtures.ts` pins the new module file and
  module specifier, and `tests/diagnostics/public-api-fixtures.ts` pins the
  exported symbols;
  `tests/diagnostics/architecture.test.ts`,
  `tests/diagnostics/package-entry.test.ts`, and
  `tests/diagnostics/public-api-surface.test.ts` pass.
- `RuleDefinition` exposes a readonly `messageTemplates` array, empty for every
  current rule, and `tests/diagnostics/rule-catalogue.test.ts` passes.
- `tests/static-analysis/invalid-workflow-fixtures.test.ts` passes for the
  current corpus, accepts a synthetic template-matched dynamic message, rejects
  an unrelated message, and never uses a substring match on the message text.
- The final implementation passes:

  ```sh
  make all
  make markdownlint
  make nixie
  ```

`make all` runs `build`, `check-fmt`, `whitespace-hygiene`, `lint`,
`typecheck`, and `test`. `make markdownlint` and `make nixie` are required in
addition because Markdown changes are part of this plan and are not included in
`make all`.

Record Red-Green-Refactor evidence for each code work item: the focused red
command and its expected failure, the focused green command and its expected
pass, and the refactor/gate commands and their expected pass.

## Idempotence and recovery

All planned edits are ordinary file edits and can be re-run safely after
reviewing `git diff`.

If the work item 4 temporary sabotage is left in the tree, restore it by
reviewing the manifest diff and removing only the intentionally stale diagnostic
message. Do not use `git reset --hard` or `git checkout --` unless a human
explicitly requests that destructive operation.

If file-scoped Markdown formatting touches unrelated Markdown files, inspect the
diff and park unrelated churn with:

```sh
git stash push -m 'df12-stash v1 task=2.1.8 kind=discard reason="formatter churn"'
```

If `make build` updates `node_modules`, no commit action is needed because
`node_modules` is ignored. If it updates `bun.lock`, stop and investigate before
committing; this plan does not include dependency changes.

## Artifacts and notes

Planning evidence gathered by direct branch-local inspection (advisory tools
were unavailable in this session, see `Surprises & Discoveries`):

- `src/diagnostics/rule-catalogue.ts` — `RuleDefinition`, the private
  `ruleDefinition` builder, and the frozen `messages` array pattern to mirror
  for `messageTemplates`.
- `tests/diagnostics/architecture-fixtures.ts` and
  `tests/diagnostics/public-api-fixtures.ts` — the two reviewed guard lists.
- `tests/diagnostics/architecture.test.ts` and
  `tests/diagnostics/package-entry.test.ts` — the `readdirSync().sort()` and
  source-order module-specifier comparisons.
- `tests/diagnostics/public-api-surface.test.ts` — the sorted named-export
  comparison.
- `tests/static-analysis/invalid-workflow-fixtures.test.ts` line 304 — the exact
  `expect(rule.messages).toContain(diagnostic.message)` assertion this plan
  extends.
- `tests/static-analysis/source-mask.property.test.ts` and
  `tests/static-analysis/source-file-property-oracle.ts` — the local
  `fast-check` runner convention (`{ seed, numRuns: 200 }`).
- `tsconfig.json` — `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`, and
  `noPropertyAccessFromIndexSignature` all enabled.

## Revision note

Planning round 2. Resolves the design reviewer's single blocking point: work
item 1 could not pass its own `make all` gate because `architecture.test.ts`
derives the diagnostic module inventory from a `readdirSync` of
`src/diagnostics` (line 25), so `EXPECTED_DIAGNOSTIC_MODULE_FILES` would go
stale the instant `message-template.ts` existed on disk, while the round-1 plan
deferred that fixture update to work item 2. The fix folds the
`EXPECTED_DIAGNOSTIC_MODULE_FILES` and `EXPECTED_PARSEABLE_SOURCE_FILES` updates
— and the red-green demonstration of the inventory guard — into work item 1's
own commit, leaving only the `src/index.ts`-driven fixtures
(`EXPECTED_PACKAGE_ENTRY_MODULE_SPECIFIERS` and `EXPECTED_PUBLIC_PACKAGE_EXPORTS`)
for work item 2, whose red step now observes only the package-entry and
public-API guard failures. The Purpose success bullets, the guard-fixture Risk
entries, the Progress list, and the architecture Surprise observation were
updated to match. Verified branch-local against `architecture.test.ts`,
`architecture-fixtures.ts`, `public-api-fixtures.ts`, and `import-policy.test.ts`
in the worktree.

Planning round 1. Initial ExecPlan for roadmap task 2.1.8. Decomposes the task
into five ordered, independently committable work items: the message-template
module, the public export and guard-fixture pins, the catalogue
`messageTemplates` field, the invalid-fixture parity template acceptance, and
the roadmap closeout. Pins the placeholder syntax, strict rendering, anchored
matching, and non-empty placeholder decisions in `Decision Log`, and records
that `grepai`, `leta`, and `sem` were unavailable in the planning session.
