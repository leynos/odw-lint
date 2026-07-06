# Audit after roadmap task 3.1.3

This post-step audit was run after roadmap task 3.1.3, which added the
strict-Claude severity-promotion transform (`promoteStrictClaudeSeverity`),
wired it through `lintWorkflowSource`, and documented the promoted Claude
compatibility diagnostics. The change merged into `origin/main` at commit
`f5b701b`. The audit verified every branch-local fact in a fresh worktree off
`origin/main` with targeted file inspection and `git` entity history; the
canonical `grepai` intent index was unavailable in this agent session, so
concept search fell back to exact text search inside the worktree.

Normative references used:

- `AGENTS.md`
- `docs/adr/0001-static-analysis-boundary.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/scripting-standards.md`
- `docs/technical-design.md`
- `docs/users-guide.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- `biomejs`: TypeScript conventions for the reviewed sources.

The 3.1.3 change introduced `src/diagnostics/strict-claude.ts` and merged its
transform into the `diagnostics` stream of `lintWorkflowSource`. The findings
below concentrate on that newly merged surface and on the rule catalogue and
documentation it depends on.

## Finding 1: `odw/no-odw-only-validate` is `released` but has no emitter

Category: inconsistency

Severity: medium

Location:

- `src/diagnostics/rule-catalogue.ts` (the `odw/no-odw-only-validate`
  definition)
- `docs/rules/no-odw-only-validate.md:9`
- `docs/developers-guide.md:158`

Description:

The `releaseStatus` field is documented as "Whether current checker code may
emit this rule." Every other rule carrying `releaseStatus: "released"` has a
production emitter under `src/static-analysis/` and a non-empty `messages`
array. `odw/no-odw-only-validate` is marked `released` yet appears nowhere in
`src/` except its own catalogue entry: no scanner emits it, and it declares no
reviewed `messages`. Its rule page presents a "Failing example", but a caller
linting that example today receives no `odw/no-odw-only-validate` diagnostic,
and the developers-guide states strict-Claude mode "includes preserving
informational Claude compatibility findings such as `odw/no-odw-only-validate`"
— behaviour that can never be observed because the finding is never produced.
The 3.1.3 strict-Claude work leaned on this rule as an example of a
non-promoted informational finding, so the inconsistency now has a documented
dependant.

Proposed fix:

Reclassify `odw/no-odw-only-validate` to `releaseStatus: "planned"` until its
emitter lands (mirroring the other not-yet-emitted rules), and soften the rule
page and developers-guide wording from present-tense reporting to
planned/forthcoming. Alternatively, if the rule is meant to be live, schedule
and implement its checker plus reviewed `messages` and reference it from a
roadmap task. Either way the catalogue release status, the emitter set, and the
prose must agree.

## Finding 2: no invariant test that every `released` rule has an emitter

Category: test-gap

Severity: medium

Location:

- `tests/diagnostics/rule-catalogue.test.ts:240`
- `src/diagnostics/rule-catalogue.ts`

Description:

The only test connecting release status to emitted behaviour,
"records messages for released rules with invalid fixture diagnostics", filters
to a hand-maintained `RULE_IDS_WITH_INVALID_FIXTURE_DIAGNOSTICS` whitelist and
asserts `messages.length > 0` for that subset only. Nothing asserts the general
invariant that every `RELEASED_RULE_IDS` entry is actually reachable from a
production emitter. That gap is exactly what allowed Finding 1 to pass all
gates: a rule can claim `released` while no checker can emit it, and no test
objects. This is the missing behavioural coverage behind the inconsistency.

Proposed fix:

Add a catalogue invariant test that cross-checks `RELEASED_RULE_IDS` against the
set of rule identifiers referenced by production emitters (for example, a
maintained `EMITTED_RULE_IDS` constant asserted equal to `RELEASED_RULE_IDS`,
or a source scan asserting that each released id appears outside
`rule-catalogue.ts`).
Rules deliberately released without an emitter should be an explicit, rationale-
bearing exception list rather than a silent omission.

## Finding 3: rule-catalogue lookup is expressed three different ways

Category: duplication

Severity: low

Location:

- `src/diagnostics/strict-claude.ts:30`
- `src/diagnostics/rule-catalogue.ts` (`ruleDefinitionFor`)
- `src/static-analysis/workflow-deterministic-time.ts:53`

Description:

Resolving a `RuleDefinition` from a rule identifier is implemented three ways.
`ruleDefinitionFor` does a throwing `RULE_CATALOGUE.find`; the
deterministic-time scanner preloads a `Map<RuleId, RuleDefinition>` for O(1)
reuse; and
`promoteStrictClaudeSeverity` performs an inline, non-throwing
`RULE_CATALOGUE.find((candidate) => candidate.id === diagnostic.rule)` per
diagnostic. The transform cannot reuse `ruleDefinitionFor` because that helper
throws on unknown rules, whereas the transform must tolerate uncatalogued rules
(an explicit test guarantees pass-through). The result is a repeated linear
scan and a fourth private copy of the same predicate in the strict-Claude test's
`findRule` helper.

Proposed fix:

Export a non-throwing `findRuleDefinition(ruleId): RuleDefinition | undefined`
from `rule-catalogue.ts` and have `promoteStrictClaudeSeverity` (and the test's
`findRule`) call it, so catalogue membership is resolved through one seam.
`ruleDefinitionFor` can then be a thin throwing wrapper over it.

## Finding 4: strict-Claude promotion policy lives in inline literals

Category: separation-of-concerns

Severity: low

Location:

- `src/diagnostics/strict-claude.ts:32`

Description:

The rule that defines strict-Claude promotion — which category is promoted and
which severity transition applies — is encoded as bare literals inside the
`map` predicate (`rule?.category !== "claude-compatibility"`,
`diagnostic.severity !== "warning"`, and the `"error"` result). The policy is
therefore not discoverable from a single named declaration, and a future
extension (for example promoting `info` to `warning`, or a second promotable
category) would require editing the control flow rather than a data table. This
is a mild altitude issue: transform mechanics and promotion policy live in the
same expression.

Proposed fix:

Hoist the policy into a named, documented constant (for example
`STRICT_CLAUDE_PROMOTION = { category: "claude-compatibility", from: "warning",
to: "error" }`) and drive the predicate and replacement from it, so the policy
reads declaratively and future promotions extend the data rather than the code.

## Finding 5: rule pages assert `--strict-claude` as a present-tense flag

Category: docs-gap

Severity: low

Location:

- `docs/rules/claude-pure-meta.md`
- `docs/rules/no-date-now.md`
- `docs/rules/no-math-random.md`
- `docs/rules/no-argless-new-date.md`

Description:

These rule pages state each finding "is promoted to an error under
`--strict-claude`" in the present tense, as though the flag is available today.
The developers-guide is careful to note that "the parsed `--strict-claude` CLI
flag and `strictClaude` configuration key ... are owned by the CLI tasks in
roadmap 2.4 and configuration tasks in roadmap 3.3", i.e. the flag is not yet
wired. The library exposes only `lintWorkflowSource(source, { strictClaude:
true })` and the `promoteStrictClaudeSeverity` transform; there is no CLI entry
point. A reader of the rule pages alone cannot invoke `--strict-claude` and is
given no forward-looking caveat.

Proposed fix:

Add the same forthcoming-flag caveat used in the developers-guide to each rule
page (a short note that the `--strict-claude` flag is planned under roadmap 2.4
and that the library transform is the current mechanism), or cross-link the
developers-guide section, so the rule pages match the project's own account of
what ships today.

## Summary

The 3.1.3 strict-Claude transform is small, pure, immutable, and well covered by
both example-based and property-based tests, with no command/query or boundary
violations observed. The substantive findings are a catalogue/documentation
inconsistency around `odw/no-odw-only-validate` being marked `released` without
an emitter (Finding 1) and the missing invariant test that would have caught it
(Finding 2); the remaining findings are low-severity consistency and
documentation tidy-ups on the catalogue lookup seam, the promotion policy's
altitude, and the rule pages' description of the not-yet-wired
`--strict-claude` flag.
