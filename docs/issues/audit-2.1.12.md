# Audit after roadmap task 2.1.12

This post-step audit was run after roadmap task 2.1.12
(`Introduce a static workflow lint entry point`) merged into `origin/main` at
commit `7acad62`. The audit used `grepai` against the canonical `main` index
for intent search, then verified every branch-local fact in a fresh worktree off
`origin/main` with `leta`, targeted file inspection, and `sem` entity history.

Normative references used:

- `AGENTS.md`
- `docs/adr/0001-static-analysis-boundary.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/scripting-standards.md`
- `docs/technical-design.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- `grepai`: canonical `main` intent search.
- `leta`: branch-local symbol and source navigation.
- `sem`: entity-level diff and blame inspection.

## Finding 1: The string-delimiter predicate is duplicated three times

Category: duplication

Severity: medium

Location:

- `src/static-analysis/workflow-metadata-comment-scan.ts:121`
- `src/static-analysis/workflow-metadata-parser-scan.ts:274`
- `src/static-analysis/workflow-metadata-parser.ts:397`
- `src/static-analysis/source-mask-delimiters.ts:122`

Description:

The type-guarded predicate below is defined verbatim three times across the
workflow-metadata scanner family.

```ts
const isStringDelimiter = (character: string): character is "'" | '"' | "`" => {
  return character === "'" || character === '"' || character === "`";
};
```

A fourth, closely related predicate, `isStringLikeDelimiter` in
`source-mask-delimiters.ts`, expresses the same concept (`'`, `"`, or a
backtick) as `isQuotedStringDelimiter(character)` OR
`isTemplateDelimiter(character)`, but returns a plain `boolean` rather than
narrowing the type.

Commit `40833bf` (`Consolidate source-mask delimiter predicates`) already
pulled the source-mask token family onto shared delimiter helpers, but the
workflow-metadata family was not folded into that consolidation and kept three
private copies. Any change to the accepted delimiter set would have to be made
in four places, and the two families can silently drift apart.

Proposed fix:

Promote a single canonical string-delimiter predicate. Add a type-guarded
`isStringDelimiter` to `source-mask-delimiters.ts`, expressed in terms of the
existing `isQuotedStringDelimiter` and `isTemplateDelimiter` helpers, and
re-export it. Delete the three private copies in the workflow-metadata modules
and import the predicate. Consider whether `isStringLikeDelimiter` can then be
defined as, or replaced by, the shared type guard so there is exactly one
notion of a string-like delimiter.

## Finding 2: Identifier-character classification diverges

Category: inconsistency

Severity: medium

Location:

- `src/static-analysis/workflow-metadata-parser-scan.ts:172`
- `src/static-analysis/workflow-envelope.ts:159`
- `src/static-analysis/workflow-envelope-unsupported.ts:120`
- `src/static-analysis/source-mask.ts:128`
- `src/static-analysis/source-mask.ts:133`
- `src/static-analysis/source-mask-templates.ts:194`
- `src/static-analysis/source-mask-regex.ts:299`

Description:

Three different notions of "identifier-continuation character" coexist:

- The exported predicate in `workflow-metadata-parser-scan.ts` treats `$`, `_`,
  ZWNJ, ZWJ, and `\p{ID_Continue}` as identifier parts. This is the
  spec-correct ECMAScript `IdentifierPart` set.
- The two envelope copies (`workflow-envelope.ts` and
  `workflow-envelope-unsupported.ts`) use `/[$_\p{ID_Continue}]/u` and
  therefore omit ZWNJ and ZWJ, which `\p{ID_Continue}` does not match.
- Four call sites in the source-mask family use an inline, ASCII-only
  `/[A-Za-z0-9_$]/u`, which excludes every non-ASCII identifier character.

Beyond the plain duplication, the divergence is a latent correctness bug. The
envelope scanners use `isIdentifierPart` to decide whether a `meta` or `import`
or `export` keyword sits on an identifier boundary. An identifier that contains
a ZWNJ or ZWJ joiner, which is legal in JavaScript, would be treated as a
boundary by the envelope scanner but as part of an identifier by the metadata
parser, so the two stages can disagree about where a keyword ends. There is no
regression fixture pinning this boundary behaviour, so the divergence is
currently invisible to the suite.

Proposed fix:

Define one canonical, spec-correct identifier predicate pair
(`isIdentifierStart` and `isIdentifierPart`) in a shared low-level module,
using the ZWNJ and ZWJ-inclusive definition. Replace the two envelope copies
and the four inline `/[A-Za-z0-9_$]/u` uses with the shared predicate. Add a
targeted regression fixture that places a joiner-bearing identifier next to a
`meta` or `import` keyword so the boundary contract is pinned across both
stages.

## Finding 3: Whitespace classification is inlined thirteen times

Category: duplication

Severity: low

Location:

- `src/static-analysis/source-mask.ts` (multiple)
- `src/static-analysis/source-mask-templates.ts`
- `src/static-analysis/workflow-envelope-statement.ts`
- `src/static-analysis/workflow-envelope-unsupported.ts`
- `src/static-analysis/workflow-envelope-meta-value.ts`
- `src/static-analysis/workflow-metadata.ts`
- `src/static-analysis/workflow-metadata-parser-scan.ts`

Description:

The literal `/\s/u.test(character)` whitespace check appears thirteen times
across seven static-analysis modules, with no shared predicate. This contrasts
with the line-terminator concept, which was deliberately extracted into
`isLineTerminatorCharacter` in `source-mask-delimiters.ts`. The asymmetry means
one character-class concept is centralized while an equally common one is
scattered, and any future change would touch thirteen sites.

Proposed fix:

Add an `isWhitespaceCharacter` predicate to `source-mask-delimiters.ts` next to
`isLineTerminatorCharacter`, and replace the inline `/\s/u.test(...)` uses with
it. Keeping the regex compiled once behind the predicate also avoids repeatedly
re-parsing the same pattern.

## Finding 4: Two near-identical backward scans in the source masker

Category: similarity

Severity: low

Location:

- `src/static-analysis/source-mask.ts:99`
- `src/static-analysis/source-mask.ts:113`

Description:

`lastSignificantCharacterInRange` and `lastSignificantTokenInRange` share the
same backward scan: iterate from `range.endIndex - 1` down to
`range.startIndex`, skipping whitespace. They differ only in what they return
from the first non-whitespace index: the raw character or
`significantTokenEndingAt(...)`. The loop body is duplicated in full.

Proposed fix:

Extract a shared `lastSignificantIndexInRange(sourceText, range)` helper that
returns the index of the final non-whitespace character, or `undefined`, then
express both callers as thin projections over that index. This removes the
duplicated loop and localizes the whitespace-skipping logic.

## Finding 5: `textIndexForOffset` is a redundant pass-through alias

Category: ergonomics

Severity: low

Location:

- `src/static-analysis/workflow-metadata.ts:345`

Description:

```ts
const textIndexForOffset = (file: OriginalSourceFile, offset: number): number =>
  textIndexAtOffset(file, offset);
```

`textIndexForOffset` merely forwards to the already-imported
`textIndexAtOffset` with the same argument order and no added behaviour. It is
used only twice, both within the same file. The near-identical name adds a
layer of indirection that a reader must resolve to confirm nothing else happens.

Proposed fix:

Delete `textIndexForOffset` and call `textIndexAtOffset` directly at both use
sites.

## Finding 6: The report envelope is unfrozen while analysis results are frozen

Category: inconsistency

Severity: low

Location:

- `src/diagnostics/report.ts:97`
- `src/diagnostics/report.ts:31`

Description:

Across `src/static-analysis`, results are defensively frozen.
`lintWorkflowSource`, the metadata classifier, and the parser all return
`Object.freeze`d structures. `createDiagnosticReport` and `countDiagnostics`,
by contrast, return freshly built but mutable objects, even though the module
already clones caller-owned spans and suggestions so the report does not retain
external references. A caller that receives a report can mutate
`report.summary` or push into `report.diagnostics` in place, which is at odds
with the immutability contract the rest of the pipeline advertises.

Proposed fix:

Decide on one immutability contract for produced values and apply it uniformly.
If frozen results are the house style, freeze the report envelope, its
`summary`, and the `diagnostics` array in `createDiagnosticReport`. If the
report is intentionally a mutable data-transfer object, record that decision in
the developers' guide so the asymmetry is a documented choice rather than an
oversight.
