# Audit after roadmap task 2.2.7

This post-step audit was run after roadmap task 2.2.7
(`Reconcile workflow-body parser dialect scope`) merged into `origin/main`. The
2.2.7 work landed as commit `cfb0666`
(`Reconcile workflow body dialect scope`); the audit worktree was created off
`origin/main` at commit `b09739f`, which contains that merge.

The audit used `grepai` against the canonical `main` index for intent search,
then verified every branch-local fact in a fresh worktree off `origin/main`
with targeted file inspection and exact text search. Where a claim depends on
prior roadmap history, `docs/roadmap.md` in the audited tree was consulted
directly.

Normative references used:

- `AGENTS.md`
- `docs/adr/0002-workflow-body-parser-dialect-scope.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/scripting-standards.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- `grepai`: canonical `main` intent search.
- `leta` / targeted inspection: branch-local symbol and source navigation.

## Summary

The 2.2.7 dialect reconciliation itself is in good shape: the ECMAScript-only
decision is recorded in ADR 0002, mirrored in the developers guide and the
`odw/body-syntax` rule document, and locked down by
`tests/static-analysis/workflow-body-dialect.test.ts`, including the accepted
`identity<number>(1)` comparison boundary. No defects were found in the 2.2.7
change.

The findings below are pre-existing housekeeping issues surfaced by the audit.
The most material one is that roadmap task 2.1.12.5 — marked complete — claimed
to centralize the string-delimiter and whitespace predicates and "remove
duplicated local helpers", yet a shared `isWhitespaceCharacter` helper is
adopted in only one module while eleven raw call sites across six modules keep
the inline idiom, and three modules keep an identical type-guard wrapper. None
of the findings are behavioural defects; they are duplication, consistency, and
separation-of-concerns issues.

## Finding 1: Shared `isWhitespaceCharacter` helper is adopted in only one module

Category: inconsistency (duplication)

Severity: medium

Location:

- `src/static-analysis/source-mask-delimiters.ts:134` (the shared helper)
- `src/static-analysis/source-mask.ts:58`
- `src/static-analysis/source-mask.ts:105`
- `src/static-analysis/source-mask.ts:118`
- `src/static-analysis/source-mask-templates.ts:205`
- `src/static-analysis/workflow-envelope-statement.ts:30`
- `src/static-analysis/workflow-envelope-statement.ts:107`
- `src/static-analysis/workflow-envelope-unsupported.ts:160`
- `src/static-analysis/workflow-envelope-unsupported.ts:188`
- `src/static-analysis/workflow-envelope-meta-value.ts:99`
- `src/static-analysis/workflow-envelope-meta-value.ts:241`
- `src/static-analysis/workflow-metadata.ts:319`

Description:

`source-mask-delimiters.ts` exports a documented, single-source whitespace
predicate:

```ts
const WHITESPACE_PATTERN = /^\s$/u;

export const isWhitespaceCharacter = (character: string): boolean => {
  return WHITESPACE_PATTERN.test(character);
};
```

Roadmap task 2.1.12.5 ("Extract shared low-level scanner character predicates",
addendum from `audit:2.1.12`) is marked `[x]` and states its goal as:
"Centralize the remaining string-delimiter and whitespace predicates used by
the workflow-metadata and source-mask scanner families, then remove duplicated
local helpers." In the audited tree only `workflow-metadata-parser-scan.ts`
imports and uses `isWhitespaceCharacter`. Eleven other call sites across six
modules still inline the equivalent `/\s/u.test(character)` idiom on a single
character. For a single-character input `/\s/u.test(c)` and `/^\s$/u.test(c)`
are equivalent, so these are true duplicates of the shared helper rather than
intentionally different predicates.

The gap between the roadmap item's stated completion ("remove duplicated local
helpers") and the code is the reason this is ranked medium rather than low: the
centralization was only partially applied, and the residual raw idiom invites
further copies.

Proposed fix:

Replace each single-character `/\s/u.test(...)` call site listed above with
`isWhitespaceCharacter(...)` imported from `source-mask-delimiters.ts` (or a
re-export), matching the adoption already present in
`workflow-metadata-parser-scan.ts`. Leave any multi-character or anchored
`\s`-class usage that is not a single-character classification untouched. Add a
short lint-style check or reviewer note so new scanners reach for the shared
predicate.

## Finding 2: Identical `isStringDelimiter` narrowing wrapper is defined in three modules

Category: duplication

Severity: low

Location:

- `src/static-analysis/workflow-metadata-comment-scan.ts:111`
- `src/static-analysis/workflow-metadata-parser-scan.ts:299`
- `src/static-analysis/workflow-metadata-parser.ts:395`

Description:

After the 2.1.9.1 / 2.1.12.5 consolidation, the underlying predicate logic is
shared through `isStringLikeDelimiter`, but each of the three metadata-scanner
modules keeps a verbatim local type-guard wrapper whose only job is to
re-narrow the return type:

```ts
const isStringDelimiter = (character: string): character is "'" | '"' | "`" => {
  return isStringLikeDelimiter(character);
};
```

The wrapper exists because callers (for example `scanDelimitedEnd`) benefit
from the narrowed

```text
"'" | '"' | "`"
```

This type is not provided by the shared `isStringLikeDelimiter` (it returns
plain `boolean`). The result is a small but exact triplication that the earlier
consolidation missed because it centralized only the non-narrowing predicate.

Proposed fix:

Promote the narrowing to the shared helper: change `isStringLikeDelimiter` in
`source-mask-delimiters.ts` to a type guard returning
`character is "'" | '"' | "`"` (it already only returns true for those three
characters), then delete the three local `
isStringDelimiter ` wrappers and call `isStringLikeDelimiter
` directly. If a narrower name is preferred at call sites,
export a single aliased type guard from `source
-mask-delimiters.ts` instead of re-declaring it per module.

## Finding 3: Inline ASCII identifier-character regex is duplicated across mask modules

Category: duplication

Severity: low

Location:

- `src/static-analysis/source-mask.ts:128`
- `src/static-analysis/source-mask.ts:133`
- `src/static-analysis/source-mask-regex.ts:336`
- `src/static-analysis/source-mask-templates.ts:195`
- `src/static-analysis/workflow-body-parser.ts:234` (byte-level variant)

Description:

The masking and parser-range modules each inline the same ASCII
identifier-character test, `/[A-Za-z0-9_$]/u.test(...)` (and a single-character
anchored variant in `workflow-body-parser.ts`). These are deliberately
ASCII-only fast paths for token-boundary heuristics — regex-versus-division,
operator detection, and identifier-token scanning — and are distinct from the
Unicode-aware `isIdentifierStartCharacter` / `isIdentifierPartCharacter`
helpers in `javascript-identifiers.ts` (which task 2.1.12.4 made
ZWNJ/ZWJ-aware). Because they are genuinely a different, narrower predicate,
they should not fold into the Unicode helpers, but the raw pattern is copied
five times with no shared name to document that the ASCII scope is intentional.

Proposed fix:

Add one named, documented ASCII predicate — for example
`isAsciiIdentifierCharacter(character: string): boolean` in
`source-mask-delimiters.ts` or `javascript-identifiers.ts` — whose doc comment
states that it is the deliberate ASCII fast path used by masking heuristics,
distinct from the spec-aware identifier predicates. Replace the five inline
regexes with it. Keep the byte-level caller in `workflow-body-parser.ts` on the
same helper if it stays a single-character check.

## Finding 4: `TEXT_ENCODER` and UTF-8 byte-length logic are re-declared per module

Category: duplication

Severity: low

Location:

- `src/static-analysis/source-position.ts:14`
- `src/static-analysis/workflow-body-normalizer.ts:16`
- `src/static-analysis/workflow-body-parser.ts:220`

Description:

Three static-analysis modules each declare
`const TEXT_ENCODER = new TextEncoder();` and then compute UTF-8 byte lengths
of source slices with `TEXT_ENCODER.encode(...).byteLength`.
`workflow-body-parser.ts` wraps this in a local `byteLength(text)` helper; the
other two inline it. The encoder is stateless, so the duplication is harmless
at runtime, but it spreads the same UTF-8-length concern across three files
with no single home.

Proposed fix:

Introduce one shared helper — for example
`utf8ByteLength(text: string): number` in a small `source-bytes.ts` (or
alongside `source-position.ts`) — that owns the module-level `TextEncoder`, and
have the three modules import it instead of each holding their own encoder.
This also gives the eventual byte/offset mapping code (Finding 5) a single
byte-length primitive to build on.

## Finding 5: Speculative offset-conversion machinery is co-located with production body parsing

Category: separation-of-concerns

Severity: low

Location:

- `src/static-analysis/workflow-body-parser.ts:95-330`

Description:

`workflow-body-parser.ts` mixes two concerns in one 330-line module. The top of
the file assembles production `odw/body-syntax` diagnostics
(`parseWorkflowBody`, `bodySyntaxDiagnosticsForParse`, `bodySyntaxDiagnostic`).
The lower ~170 lines implement the parser-error span-narrowing seam
(`structuredNormalizedRangeFromParserError`, `narrowedSpanForParserError`, the
coordinate-base resolver, and a bespoke UTF-8-byte ↔ UTF-16-index conversion:
`normalizedTokenEndByte`, `textIndexAtByteOffset`, `identifierEndIndex`,
`nextCharacterIndex`). The developers guide and ADR 0002 record that the pinned
`@swc/core@1.15.43` never exposes structured error ranges, so this seam is
inert in production and is exercised only by synthetic errors in
`tests/static-analysis/workflow-body-parser-ranges.test.ts`. The narrowing
helpers are correctly kept out of the public `src/index.ts` surface, so this is
not a public-API defect — only an internal-cohesion one: the speculative
byte/index machinery already has its own test module but no module of its own.

Proposed fix:

Extract the range-narrowing helpers into a dedicated internal module — for
example `workflow-body-parser-ranges.ts`, mirroring the existing
`workflow-body-parser-ranges.test.ts` name — leaving `workflow-body-parser.ts`
focused on production diagnostic assembly. Fold the UTF-8/UTF-16 conversion
onto the shared byte-length primitive proposed in Finding 4 where practical,
and keep the inert-status note from the developers guide adjacent to the
extracted module.

## Non-findings confirmed

- The 2.2.7 dialect decision is consistently documented across ADR 0002, the
  developers guide (§ SWC upgrade checklist references the dialect ADR), the
  `odw/body-syntax` rule document, and the users guide dialect-category
  description.
- `tests/static-analysis/workflow-body-dialect.test.ts` covers the rejected
  TypeScript-only forms (type annotations, `interface`, `enum`, `as`,
  `satisfies`) and the accepted `identity<number>(1)` comparison boundary.
- The speculative span-narrowing helpers are not re-exported through
  `src/index.ts`, matching the developers-guide instruction to keep them
  internal until a production parser path exercises them.
