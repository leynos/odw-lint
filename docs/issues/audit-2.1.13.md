# Audit after roadmap task 2.1.13

This post-step audit was run after roadmap task 2.1.13 (`Extract shared scanner
primitives`) merged into `origin/main` at commit `0ecf09a`. The task
consolidated shared source-scanning classification, delimiter, comment, escape,
and identifier logic behind a new internal module,
`src/static-analysis/source-scanner-primitives.ts`, and migrated the source-mask
and workflow-metadata scanner families onto it.

The audit worked in a fresh worktree off `origin/main` and verified every
branch-local fact with targeted file inspection, `git` commit and history
inspection for the 2.1.13 change set, and exact-text search for cross-module
usages. It confirmed that 2.1.13 already resolved several findings from the
`audit-2.1.12` report: `isWhitespaceCharacter` now exists as a shared predicate
in `source-mask-delimiters.ts`, and identifier classification is centralized in
`javascript-identifiers.ts`. The findings below are the residue that the
extraction did not reach, plus documentation coverage gaps.

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
- `git` commit, diff, and history inspection for the 2.1.13 change set.

## Finding 1: Escaped-delimited scanning is implemented three times

Category: similarity

Severity: medium

Location:

- `src/static-analysis/source-mask-delimiters.ts:55`
  (`scanEscapedDelimitedEnd`)
- `src/static-analysis/workflow-metadata-comment-scan.ts:20`
  (`scanDelimitedEnd`)
- `src/static-analysis/source-scanner-primitives.ts:190`
  (`stringLikeRegionEnd`, nested inside `templateExpressionEnd`)

Description:

The 2.1.13 extraction unified the low-level classification helpers but left
three parallel implementations of the same "scan forward to the closing
delimiter, honouring backslash escapes" loop. `scanEscapedDelimitedEnd` uses
`sourceText.length` as its bound and does not handle `${` interpolation;
`scanDelimitedEnd` takes an explicit `endIndex` and does handle interpolation
via `templateExpressionEnd`; and `stringLikeRegionEnd` re-implements the same
loop a third time inside the primitive itself. The maintainers already
recognize the parallelism: a differential property test at
`tests/static-analysis/delimited-end-parity.property.test.ts` pins both
production scanners against frozen pre-refactor oracles.

The behavioural divergence is real and intentional (`scanEscapedDelimitedEnd`
also accepts the `/` regex delimiter and skips interpolation), which is why the
duplication survived. It nevertheless means the accepted escape and
interpolation rules live in three places that can drift apart, and the primitive
layer created precisely to prevent this still hosts one of the copies.

Proposed fix:

Promote a single parametrized `delimitedRegionEnd(text, start, delimiter, end,
options)` into `source-scanner-primitives.ts`, where `options` selects whether
`${` interpolation is followed. Express `scanDelimitedEnd` and
`scanEscapedDelimitedEnd` as thin adapters over it, and have
`templateExpressionEnd` call the shared primitive instead of its private
`stringLikeRegionEnd`. Keep the differential parity test as the guard for the
consolidation.

## Finding 2: Two exported `scanLineCommentEnd` functions with divergent semantics

Category: inconsistency

Severity: low

Location:

- `src/static-analysis/source-mask-comments.ts:60`
- `src/static-analysis/workflow-metadata-comment-scan.ts:51`

Description:

Two exported functions share the name `scanLineCommentEnd` but have different
signatures and, more importantly, different semantics. The source-mask copy
takes `(sourceText, startIndex)` and consumes the line terminator by delegating
to `lineCommentTerminatorEnd`. The workflow-metadata copy takes `(text,
startIndex, endIndex)` and stops before the terminator by delegating to
`lineCommentContentEnd`. A reader who navigates by symbol name will find two
"line comment end" scanners that return different indexes for the same input, a
latent trap when maintaining either scanner family.

Proposed fix:

Give the two functions names that state their terminator contract, for example
`maskLineCommentEnd` (terminator-inclusive) and `metadataLineCommentContentEnd`
(content-only). Better still, remove them entirely in favour of the primitives
they wrap (see Finding 3).

## Finding 3: Comment-scan wrappers add indirection inconsistently

Category: ergonomics

Severity: low

Location:

- `src/static-analysis/workflow-metadata-comment-scan.ts:51`
  (`scanLineCommentEnd`)
- `src/static-analysis/workflow-metadata-comment-scan.ts:63`
  (`scanBlockCommentEnd`)
- `src/static-analysis/source-mask-comments.ts:33`

Description:

`scanLineCommentEnd` and `scanBlockCommentEnd` in
`workflow-metadata-comment-scan.ts` are one-line pass-throughs to the
`lineCommentContentEnd` and `blockCommentEnd` primitives, renaming parameters
but adding no behaviour. Meanwhile `source-mask-comments.ts` calls the
`blockCommentEnd` primitive directly (line 33) while wrapping the line-comment
primitive (line 60). The result is an inconsistent mix: some primitives are
imported directly, others are re-exported through thin aliases, with no rule
that predicts which. This is the same redundant-alias smell recorded as
Finding 5 in `audit-2.1.12`, recurring in a different module.

Proposed fix:

Standardize on importing the primitives directly at call sites and delete the
pass-through wrappers, or, if a domain-named seam is genuinely wanted, apply it
uniformly across both scanner families and document the convention in the
developers' guide.

## Finding 4: `indexAfterEscapedUnit` ignores its `text` parameter

Category: ergonomics

Severity: low

Location:

- `src/static-analysis/source-scanner-primitives.ts:66`

Description:

```ts
export const indexAfterEscapedUnit = (_text: string, backslashIndex: number):
  number => {
  return backslashIndex + 2;
};
```

The function takes a `text` argument (named `_text` to silence the unused-
parameter lint) but never reads it, and every call site passes a real source
string that is discarded. The signature implies the helper is EOF-aware when it
is not: the JSDoc pushes the EOF and line-continuation rules onto callers. This
is a small ergonomic footgun, because the returned index can point one past the
end of the string when the backslash is the final code unit.

Proposed fix:

Either drop the unused parameter so the signature stops advertising
text-awareness it does not have, or make the helper genuinely EOF-safe by
returning `Math.min(backslashIndex + 2, text.length)`, which would let the
parameter earn its place and remove the "callers own EOF" caveat from the
contract.

## Finding 5: Repository layout omits the new scanner-primitives layer

Category: docs-gap

Severity: low

Location:

- `docs/repository-layout.md:87`

Description:

The 2.1.13 change documented the new `source-scanner-primitives.ts` seam in
`docs/technical-design.md` and `docs/developers-guide.md`, but
`docs/repository-layout.md`, the map readers reach for first, was not updated.
Its `src/static-analysis/` section still describes only the source-mask facade
and its `source-mask-*` helpers; it does not mention the shared primitives layer
or the workflow-metadata scanner family that now depends on it, nor the
one-directional import rule that keeps the primitives free of mask-range,
metadata-parser, and diagnostic types.

Proposed fix:

Add a short paragraph to the `src/static-analysis/` section of
`docs/repository-layout.md` describing `source-scanner-primitives.ts` as the
shared low-level token-grammar home for the scanner families, and state the
no-domain-import rule so the boundary is discoverable from the layout map.

## Finding 6: Balanced-expression scanning has three overlapping shapes

Category: similarity

Severity: low

Location:

- `src/static-analysis/source-scanner-primitives.ts:208`
  (`expressionEnd`, nested inside `templateExpressionEnd`)
- `src/static-analysis/workflow-metadata-parser-scan.ts:72`
  (`scanExpressionEnd`)
- `src/static-analysis/workflow-metadata-parser-scan.ts:103`
  (`scanBalancedEnd`)

Description:

Three scanners share the same skeleton: iterate over source, skip string-like
regions via a delimiter scan, skip comments via `commentDispatchEnd`, and track
nesting depth. They differ only in their depth model: `expressionEnd` counts a
single `{` depth, `scanBalancedEnd` counts one configurable open/close pair, and
`scanExpressionEnd` tracks brace, bracket, and paren depth together against a
terminator set. The common control flow is copied three ways, so a fix to the
string- or comment-skipping logic must be applied in each.

Proposed fix:

Consider a shared balanced-scan primitive parametrized by a depth model or
terminator predicate, so the string- and comment-skipping backbone lives once.
This is a watch item rather than an urgent change: the depth models differ
enough that over-abstraction is a real risk, so weigh the shared backbone
against a bespoke abstraction before committing.
