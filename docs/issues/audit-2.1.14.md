# Audit after roadmap task 2.1.14

This post-step audit was run after roadmap task 2.1.14 (`Consolidate delimited
and balanced scanner loops`) merged into `origin/main` at commit `b23bbac`. The
task promoted two shared region-level walkers, `scanDelimitedRegionEnd` and
`scanBalancedExpressionEnd`, into a new internal sibling module,
`src/static-analysis/source-scanner-regions.ts`, re-exported them through the
`source-scanner-primitives.ts` seam, and migrated the source-mask string and
delimiter scanners, the workflow-metadata comment and parser scanners, and the
`templateExpressionEnd` walk onto them.

The audit worked in a fresh worktree off `origin/main` and verified every
branch-local fact with targeted file inspection, `git` commit and history
inspection for the 2.1.14 change set, and exact-text search for cross-module
usages. It confirmed that 2.1.14 resolved Findings 1 and 6 of `audit-2.1.13`:
the escaped-delimited loop and the balanced-expression skeleton now live once in
`source-scanner-regions.ts`, guarded by the differential parity tests
`delimited-end-parity.property.test.ts` and the new
`balanced-end-parity.property.test.ts`. The findings below are the residue the
consolidation did not reach: one scanner family that still forks the shared
loops, a divergent copy of the regex-start heuristic, recurring thin wrappers,
and documentation and test-coverage gaps.

Normative references used:

- `AGENTS.md`
- `docs/adr/0001-static-analysis-boundary.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/repository-layout.md`
- `docs/roadmap.md`
- `docs/technical-design.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- `biomejs`: TypeScript lint and formatting conventions.
- Targeted file inspection and exact-text search for branch-local facts.
- `git` commit, diff, and history inspection for the 2.1.14 change set.

## Finding 1: Template-literal scanner still forks the consolidated region loops

Category: similarity

Severity: medium

Location:

- `src/static-analysis/source-mask-templates.ts:62` (`scanTemplateEnd`)
- `src/static-analysis/source-mask-templates.ts:135`
  (`nextTemplateExpressionIndex`)
- `src/static-analysis/source-mask-templates.ts:291`
  (`nextOrdinaryTemplateStep`)

Description:

Task 2.1.14's success criterion states that "source-mask and workflow-metadata
scanners no longer carry forked escaped-delimited or balanced-expression loops",
and the developers' guide it updated in the same commit now says scanner-family
modules "must not re-implement the shared UTF-16 delimited, balanced, string, or
comment-walk loops". `source-mask-templates.ts` still does exactly that.
`scanTemplateEnd` runs a hand-rolled state machine that tracks `${ ... }` brace
depth (`nextOrdinaryTemplateStep` increments and decrements `expressionDepth` on
`{` and `}`) and skips nested strings, comments, and templates
(`nextTemplateExpressionIndex`) — the same delimited-region and
balanced-expression backbone now owned by
`source-scanner-regions.ts:163` (`scanBalancedExpressionEnd`) and
`source-scanner-regions.ts:100` (`scanDelimitedRegionEnd`).

The reason it survived is real: the template scanner additionally recognizes
regex literals inside interpolation expressions (`isTemplateRegexStart`), which
the shared `nextInertRegionEnd` primitive does not model, so a naive delegation
would drop regex handling and mis-mask `` `${ a / b /g }` ``-style content. The
duplication is therefore intentional, but it is precisely the kind the task set
out to remove, and it leaves the brace-depth and inert-region rules maintained
in two places that can drift.

Proposed fix:

Extend the shared balanced walker to accept an optional inert-region resolver,
for example `scanBalancedExpressionEnd(text, start, end, { open, close,
resolveInertRegion })`, defaulting to `nextInertRegionEnd`. Have
`source-mask-templates.ts` supply a resolver that also recognizes its regex
literals, then express the outer template scan as a delimited-region scan whose
interpolation follows the shared balanced walker. Keep the template-mask
snapshot tests as the guard for the consolidation. If the contracts are judged
too divergent to merge safely, record the exclusion explicitly in the
developers' guide alongside the existing `scanExpressionEnd` "where contracts
match" carve-out, so the documented rule and the code agree.

## Finding 2: Regex-start heuristic is duplicated with divergent keyword sets

Category: inconsistency

Severity: medium

Location:

- `src/static-analysis/source-mask-regex.ts:17`
  (`REGEX_ALLOWED_PREVIOUS_CHARACTERS`, `REGEX_ALLOWED_PREVIOUS_KEYWORDS`,
  `REGEX_DISALLOWED_PREVIOUS_TOKENS`)
- `src/static-analysis/source-mask-templates.ts:26`
  (`TEMPLATE_REGEX_ALLOWED_PREVIOUS_CHARACTERS`,
  `TEMPLATE_REGEX_ALLOWED_PREVIOUS_KEYWORDS`)

Description:

Both the top-level source masker and the template-expression scanner decide
whether a `/` starts a regex literal using a preceding-significant-token
heuristic, and both encode that heuristic as local `Set` constants. The
character sets are byte-for-byte identical (`"([{,;:=!&|?+-*%<>~^"`), but the
keyword sets diverge sharply: `source-mask-regex.ts` allows thirteen keywords
(`await`, `case`, `delete`, `do`, `else`, `in`, `instanceof`, `of`, `return`,
`throw`, `typeof`, `void`, `yield`) and additionally rejects the `++` and `--`
postfix tokens, whereas the template copy allows only four (`await`, `return`,
`throw`, `yield`) and applies no disallowed-token guard. As a result the same
source produces different masking depending on nesting: a slash after `typeof`,
`instanceof`, `case`, `void`, or similar is treated as a regex at top level but
as division inside a template interpolation, so identical constructs mask
inconsistently and a workflow author's regex can be silently mis-scanned in one
context only.

Proposed fix:

Promote a single regex-start module (or extend `source-mask-regex.ts`'s exported
predicate) that owns the character set, keyword set, and disallowed-token set
once, and have both `source-mask-regex.ts` and `source-mask-templates.ts`
consume it. If the template context genuinely needs a narrower keyword set,
express that as an explicit, documented restriction of the shared set rather
than a silently forked copy, and add the parity test in Finding 6 to pin the
relationship.

## Finding 3: Region primitives accreted more thin pass-through wrappers

Category: ergonomics

Severity: low

Location:

- `src/static-analysis/source-mask-strings.ts:44` (`scanQuotedStringEnd`)
- `src/static-analysis/source-mask-delimiters.ts:55` (`scanEscapedDelimitedEnd`)
- `src/static-analysis/workflow-metadata-comment-scan.ts:18`
  (`scanDelimitedEnd`)
- `src/static-analysis/workflow-metadata-comment-scan.ts:38`
  (`scanBlockCommentEnd`)
- `src/static-analysis/workflow-metadata-parser-scan.ts:98` (`scanBalancedEnd`)

Description:

`audit-2.1.13` Finding 3 recorded that the metadata comment scanners are
one-line pass-throughs to shared primitives with no rule predicting which call
sites wrap and which import directly. The 2.1.14 change did not address it and
added another instance: `scanQuotedStringEnd` and `scanEscapedDelimitedEnd` are
now both single-statement adapters over `scanDelimitedRegionEnd`, differing only
in the `terminateAtLineTerminator` option, while `scanDelimitedEnd`,
`scanBlockCommentEnd`, and `scanBalancedEnd` remain thin renamings of
`scanDelimitedRegionEnd`, `blockCommentEnd`, and `scanBalancedExpressionEnd`.
The seam is still applied unevenly, so a reader cannot predict from a call site
whether the primitive or an alias is in use.

Proposed fix:

Decide the convention and apply it uniformly: either import the region
primitives directly at call sites and delete the option-only adapters, or keep a
domain-named seam per scanner family and document it in the developers' guide as
the single rule. Adapters that carry a real option (for example the
line-terminator variant) are defensible; the pure renamings are not.

## Finding 4: Repository layout still omits the scanner primitives and regions

Category: docs-gap

Severity: low

Location:

- `docs/repository-layout.md:87`

Description:

`audit-2.1.13` Finding 5 noted that `docs/repository-layout.md` — the map
readers reach for first — describes only the `source-mask` facade and its
`source-mask-*` helpers and never mentions `source-scanner-primitives.ts`. That
gap is still open, and 2.1.14 widened it: the new
`source-scanner-regions.ts` region-walker module and the primitives seam it is
re-exported through appear in `docs/technical-design.md` and
`docs/developers-guide.md` but not in the layout map. The `src/static-analysis/`
section still reads as though only the masking facade exists.

Proposed fix:

Add a short paragraph to the `src/static-analysis/` section of
`docs/repository-layout.md` naming `source-scanner-primitives.ts` as the shared
low-level token-grammar seam and `source-scanner-regions.ts` as its
region-walker sibling, and state the one-directional import rule (no
mask-range, parser-cursor, or diagnostic types) so the boundary is discoverable
from the layout map.

## Finding 5: Region walker references `templateExpressionEnd` before declaration

Category: ergonomics

Severity: low

Location:

- `src/static-analysis/source-scanner-regions.ts:69` (`delimitedRegionSkipEnd`)
- `src/static-analysis/source-scanner-regions.ts:202` (`templateExpressionEnd`)

Description:

`delimitedRegionSkipEnd` calls `templateExpressionEnd` at line 69, but that
`const` arrow function is not declared until line 202, near the bottom of the
module. The code is correct at run time — `delimitedRegionSkipEnd` is only
invoked after module evaluation completes, by which point the binding is
initialized — but the forward reference reads awkwardly, obscures the mutual
dependency between the delimited and balanced walkers, and would trip a
`no-use-before-define`-style lint if one were enabled. It is a small readability
cost in a module that is otherwise the documented scanner seam.

Proposed fix:

Reorder the module so `templateExpressionEnd` and `scanBalancedExpressionEnd`
precede the delimited-region helpers that depend on them, or hoist a short
declaration comment noting the intentional forward reference. No behavioural
change is intended.

## Finding 6: No parity test pins the two regex-start heuristics together

Category: test-gap

Severity: low

Location:

- `tests/static-analysis/source-mask-regex.test.ts`
- `tests/static-analysis/source-mask-internals.test.ts`

Description:

The 2.1.14 change added strong differential coverage for the shared loops
(`balanced-end-parity.property.test.ts` and the extended
`delimited-end-parity.property.test.ts`), but nothing pins the two regex-start
heuristics from Finding 2 against each other. Because the top-level and
template-embedded keyword sets are maintained independently and no test asserts
they agree, the divergence in Finding 2 went unnoticed. The masking tests
exercise each scanner in isolation, so a keyword added to one set but not the
other would still pass.

Proposed fix:

Once Finding 2's shared regex-start predicate exists, add a table-driven test
that feeds the same `<previous-token> /re/` construct through both the top-level
masker and a template interpolation and asserts identical regex-vs-division
classification (or, if the narrowing is intentional, asserts the documented
difference explicitly). This makes any future drift a test failure rather than a
silent inconsistency.
