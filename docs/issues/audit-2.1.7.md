# Audit after roadmap task 2.1.7

This post-step audit was run after roadmap task 2.1.7 merged into
`origin/main`. The audit used `grepai` against the canonical `main` index for
intent search, then verified branch-local facts in this worktree with `leta`,
targeted file inspection, and `sem` entity history.

Normative references used:

- `AGENTS.md`
- `docs/adr/0001-static-analysis-boundary.md`
- `docs/contents.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/technical-design.md`
- `docs/users-guide.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict-style`: spelling and grammar convention.
- `grepai`: canonical `main` intent search.
- `leta`: branch-local symbol and source navigation.
- `sem`: entity-level diff and blame inspection.

## Finding 1: The source masker is at the file-size ceiling

Category: complexity

Severity: medium

Location:

- `src/static-analysis/source-mask.ts:35`
- `src/static-analysis/source-mask.ts:100`
- `src/static-analysis/source-mask.ts:144`
- `src/static-analysis/source-mask.ts:163`
- `src/static-analysis/source-mask.ts:180`
- `src/static-analysis/source-mask.ts:193`
- `src/static-analysis/source-mask.ts:270`
- `src/static-analysis/source-mask.ts:348`

Description:

`source-mask.ts` is 398 lines, two lines under the repository's 400-line code
file guard. It owns the public masking entry point, range creation, comment
scanning, quoted string scanning, whole-template scanning, regex-literal
heuristics, and regex flag scanning in one production module. `sem blame` shows
the whole module landed together in `073132bc` (`Add inert source masking`), so
there is no older split boundary to preserve.

The next envelope-scanner work in roadmap task 2.1.2 is likely to need nearby
changes to token handling and mask-range semantics. Any ordinary helper,
branch, or test-only probe added to this file will either trip the file-size
guard or force a structural refactor during a feature task.

Proposed fix:

Refactor before expanding envelope scanning. Keep `source-mask.ts` as the
public orchestration facade for `maskNonCodeSource`, then split token-family
helpers into focused internal modules such as `source-mask-comments.ts`,
`source-mask-strings.ts`, `source-mask-templates.ts`, and
`source-mask-regex.ts`. Document the internal ownership rule in the developer
guide's source-span helper section: callers use the facade, while only the mask
orchestrator composes token-family scanners.

## Finding 2: Build-gate Git helpers are duplicated

Category: duplication

Severity: medium

Location:

- `tests/build-gate/file-size-support.ts:112`
- `tests/build-gate/file-size-support.ts:123`
- `tests/build-gate/file-size-support.ts:145`
- `tests/build-gate/whitespace-hygiene.ts:71`
- `tests/build-gate/whitespace-hygiene.ts:82`
- `tests/build-gate/whitespace-hygiene.ts:107`
- `tests/build-gate/branch-freshness-git-runner.ts:28`
- `tests/build-gate/branch-freshness-git-fixtures.ts:179`
- `tests/build-gate/branch-freshness-git-fixtures.ts:191`
- `tests/build-gate/whitespace-hygiene.test.ts:22`
- `tests/build-gate/whitespace-hygiene.test.ts:35`
- `tests/build-gate/whitespace-hygiene.test.ts:46`
- `tests/build-gate/whitespace-hygiene.test.ts:64`

Description:

The build-gate suite now has three separate ways to run Git and two separate
tracked-file listers. `file-size-support.ts` and `whitespace-hygiene.ts` both
spawn `git ls-files -z`, convert `spawnSync` output into a local result shape,
and assert command success. `branch-freshness-git-runner.ts` owns a third
Git-runner result shape with prompt disabling and timeout behaviour.

The tests also repeat temporary repository helpers and captured CLI output
helpers between `branch-freshness-git-fixtures.ts` and
`whitespace-hygiene.test.ts`. This duplication has already produced small
contract differences, such as timeout and `GIT_TERMINAL_PROMPT` handling in
one runner but not the others.

Proposed fix:

Extract a narrow `tests/build-gate/git-support.ts` module that owns
`GitCommandResult`, the prompt-disabled bounded Git runner, `lsTrackedFiles`,
temporary repository setup, repository-relative file writes, commits, and CLI
output capture. Keep policy-specific filtering in the feature modules:
file-size support filters tracked TypeScript paths, whitespace hygiene scans
all tracked non-binary files, and branch freshness owns its roadmap freshness
classification. Document that this helper is build-gate test/support
infrastructure, not a production API.

## Finding 3: Rule-doc parsers mix queries and assertions

Category: cqs

Severity: low

Location:

- `tests/diagnostics/rule-catalogue-docs.test.ts:56`
- `tests/diagnostics/rule-catalogue-docs.test.ts:69`
- `tests/diagnostics/rule-catalogue-docs.test.ts:87`
- `tests/diagnostics/rule-catalogue-docs.test.ts:120`

Description:

`readRulePageMetadata` parses one rule page, asserts the metadata keys with
`expect(Object.keys(metadata)).toEqual(...)`, then casts the result to
`RulePageMetadata`. That makes the helper both a query and a test assertion.
Malformed table rows are proven through matcher side effects rather than a
typed parse result.

`ruleIndexRows` has a related ergonomics issue: after it finds the rule index
header, it filters every later line beginning with `|`. If
`docs/rules/index.md` later gains another Markdown table below the rule list,
the helper will try to parse that unrelated table as rule metadata and fail
with a misleading rule-index-cell error.

Proposed fix:

Add a small Markdown table parser for fixed tables. It should start at a known
header, consume only contiguous table rows, validate the expected cell count,
and return either typed row data or a project-owned parse error. Keep
`expect(...)` calls in the tests rather than in parser helpers, so the helpers
stay query-only and future failures identify the violated Markdown contract.

## Finding 4: Diagnostic documentation links have no canonical shape

Category: inconsistency

Severity: medium

Location:

- `src/diagnostics/types.ts:63`
- `src/diagnostics/rule-catalogue.ts:233`
- `src/diagnostics/schema.ts:80`
- `docs/technical-design.md:294`
- `docs/users-guide.md:90`
- `tests/static-analysis/invalid-workflow-fixtures.test.ts:299`

Description:

The diagnostic `docs` field is described as an optional documentation URL in
the TypeScript model. The catalogue helper returns repository-relative paths
such as `docs/rules/meta-required.md`, and the user's guide shows that
repository-relative value in the JSON example. The technical design's JSON
example instead shows a GitHub URL. The JSON Schema accepts any string, and the
fixture parity test only checks that `ruleDocsPath(rule)` exists on disk; it
does not clarify what emitters should put into diagnostics.

This is a small but user-facing contract gap. CI integrations, SARIF adapters,
and future text reporters need to know whether `docs` is a stable
repository-relative rule path, a package-site URL, or an absolute URL resolved
by the reporter.

Proposed fix:

Choose one canonical shape before the first executable reporter lands. A
pragmatic v1 contract is to store repository-relative rule paths in diagnostic
objects and let reporters or hosted documentation layers convert them to
absolute URLs. Rename the TypeScript comment from "URL" to "path or URL" only
if both forms are intentionally supported; otherwise, update the technical
design example and add a schema/test assertion that emitted fixture
diagnostics use `ruleDocsPath(rule)`.

## Finding 5: The documentation contents index has stale audit and plan entries

Category: docs-gap

Severity: low

Location:

- `docs/contents.md:57`
- `docs/contents.md:78`
- `docs/contents.md:119`
- `docs/issues/audit-2.1.6.md:1`
- `docs/execplans/roadmap-1-5-4.md:1`
- `docs/execplans/roadmap-2-1-7.md:1`

Description:

`docs/contents.md` is the canonical documentation index, but it is already
drifting from the current files. The issue audit entry for `audit-2.1.6.md`
says it records findings for the "no-side-effect metadata execution guard",
while the file itself is the audit after roadmap task 2.1.6 and covers the
rule-catalogue parity slice. The execution-plan list also omits current plan
files that now exist, including `roadmap-1-5-4.md` and
`roadmap-2-1-7.md`.

This does not break code, but it weakens the "start here" path that the
documentation guide assigns to `docs/contents.md`. New contributors following
the index can miss recently merged plan context or open the wrong audit for a
roadmap slice.

Proposed fix:

Add a lightweight documentation-index upkeep pass after each roadmap merge:
correct stale descriptions, list newly added ExecPlans, and add the new audit
file once the root workflow agent accepts it. If this keeps recurring, add a
docs test that compares `docs/execplans/roadmap-*.md` and
`docs/issues/audit-*.md` against the corresponding sections in
`docs/contents.md`, while still allowing intentionally deferred entries through
a reviewed exception list.

## Proposed roadmap items

These are proposals only. Editing `docs/roadmap.md` is reserved to the root
workflow agent.

### Split the source-mask token scanners

Rationale: the production source masker is at the 400-line guard and combines
several token families in one file. Splitting it before roadmap task 2.1.2
reduces the chance that envelope-scanner work has to mix feature behaviour with
a file-size refactor.

Severity: medium

### Consolidate build-gate Git support

Rationale: file-size, whitespace hygiene, and branch-freshness checks all run
Git with slightly different local helpers. A shared build-gate support module
would remove duplicated runners, tracked-file listing, temporary repository
setup, and CLI output capture while preserving feature-specific policy.

Severity: medium

### Canonicalize diagnostic rule documentation links

Rationale: the diagnostic contract currently mixes URL wording with
repository-relative rule paths. Choosing and testing one emitted shape before
the first reporter lands prevents downstream integrations from depending on a
near-miss field contract.

Severity: medium
