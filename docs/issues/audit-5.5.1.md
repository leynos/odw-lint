# Audit after roadmap task 5.5.1

This post-step audit was run after roadmap task 5.5.1, "Resolve the body-syntax
span-narrowing surface", squash-merged into `origin/main` at commit `b7089d4`.
That change quarantined the dormant body-syntax span-narrowing seam in
`src/static-analysis/workflow-body-parser-spans.ts` as an intentionally
deferred internal fallback, recorded the decision in
`docs/adr/0003-body-syntax-span-narrowing-quarantine.md`, aligned the rule,
technical-design, and developers'-guide prose with the shipped whole-body
`odw/body-syntax` span, and added a characterization test
(`tests/static-analysis/body-syntax-span-narrowing-quarantine.test.ts`) pinning
that the shipped SWC parser keeps the whole-body fallback and that the seam
stays off the public package entry.

The audit verified every branch-local fact in a fresh worktree off
`origin/main` (base commit `b7089d4`) with targeted file inspection, `grep`,
and Git entity history. `grepai` intent search against the canonical `main`
index was used to orient, but every finding below is grounded in direct
branch-local inspection because the 5.5.1 tree is the same commit the `main`
index reflects.

The 5.5.1 reconciliation is sound at its core: the quarantine decision is
recorded in ADR 0003, and the rule doc (`docs/rules/body-syntax.md`), technical
design (`docs/technical-design.md` §on the span mapper), and developers' guide
all describe the shipped whole-body span and cite the ADR consistently. Code
and documentation agree that span narrowing is inert and intentionally
deferred. The findings below concentrate on the test surface the change grew:
the parser-error tests now triplicate a real-SWC capture helper, the
characterization guard keeps a private copy of the production allow-list it is
meant to pin, one assertion is redundant across two suites, and the upgrade
checklist does not name the mechanical guard that backs its manual
re-observation step.

Normative references used:

- `AGENTS.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/adr/0003-body-syntax-span-narrowing-quarantine.md`
- `docs/roadmap.md`
- `docs/technical-design.md`

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- `grepai`: canonical `main` intent search for orientation.
- Branch-local file inspection, `grep`, and Git entity history: source and
  entity-history verification.

## Finding 1: three parser-error suites triplicate the real-SWC capture helper

Category: duplication

Severity: medium

Location:

- `tests/static-analysis/body-syntax-span-narrowing-quarantine.test.ts:13`
- `tests/static-analysis/workflow-body-parser-ranges.test.ts:16`
- `tests/static-analysis/swc-parse-error-surface.test.ts:59`

Description:

Three test files that exercise the body-syntax parser-error surface each
declare their own `catchSwcParseError` helper that calls `parseSync` with the
same `{ syntax: "ecmascript", jsx: false }` options and returns the thrown
value. Two of them are byte-for-byte identical apart from the failure message:

```ts
const catchSwcParseError = (normalizedText: string): unknown => {
  try {
    parseSync(normalizedText, {
      syntax: "ecmascript",
      jsx: false,
    });
  } catch (error) {
    return error;
  }

  throw new Error("Expected SWC to reject the malformed normalized workflow body.");
};
```

The third (`swc-parse-error-surface.test.ts:59`) is the same idea with an
inlined envelope build. The parse options are the single most upgrade-sensitive
constant in the whole quarantine story — ADR 0003 pins the behaviour of exactly
this `parseSync` configuration — yet the options string now lives in three
places, so a future `@swc/core` upgrade that must flip `syntax` or `jsx` has to
edit three copies to keep the characterization suites honest. The task already
established `tests/static-analysis/normalized-byte-range-support.ts` as the
home for shared parser-span test helpers, so the pattern for a shared owner
exists.

Proposed fix:

Extract a single `captureSwcParseError(normalizedText)` (and, if worthwhile, a
`PARSE_OPTIONS` constant) into a shared support module — either the existing
`normalized-byte-range-support.ts` or a small sibling such as
`swc-parser-error-support.ts` — and import it from all three suites. Keep each
suite's assertion-specific message at the call site if the shared helper's
generic "Expected SWC to reject …" is not descriptive enough, but let the parse
options and the capture scaffold live once so an upgrade touches a single
definition.

## Finding 2: the parser-surface guard keeps a private copy of the production allow-list

Category: inconsistency

Severity: medium

Location:

- `tests/static-analysis/swc-parse-error-surface.test.ts:18`
- `src/static-analysis/workflow-body-parser-spans.ts:22`

Description:

`structuredNormalizedRangeFromParserError` reads only an allow-listed set of
structured fields from a parser error:

```ts
const STRUCTURED_RANGE_FIELDS = ["span", "byteOffset", "pos", "start", "offset"] as const;
```

`swc-parse-error-surface.test.ts` is the characterization guard whose stated
job (per its file docstring) is to pin the SWC parser-error surface "so
dependency upgrades cannot silently change body-syntax span fallback
behaviour". To do that it enumerates the same fields — but as an independent
copy:

```ts
const STRUCTURED_OFFSET_FIELDS = ["span", "byteOffset", "pos", "start", "offset"] as const;
```

The two lists are identical today, so the inline snapshot faithfully asserts
that all five production-consulted fields are absent on a real SWC error. But
the guard and the thing it guards are not connected: if a future change adds a
sixth field to the production `STRUCTURED_RANGE_FIELDS` allow-list (say a new
`byteRange`), the characterization test keeps asserting only the original five
and silently stops covering the newly-consulted field. The guard would report
"surface unchanged" while the production extractor had in fact grown a new,
unpinned input. This is precisely the silent drift the characterization test
was introduced to prevent.

Proposed fix:

Make the guard consume the production allow-list rather than mirror it. Export
`STRUCTURED_RANGE_FIELDS` (or a dedicated `PARSER_STRUCTURED_RANGE_FIELDS`
constant) from an internal module and import it into
`swc-parse-error-surface.test.ts` so `structuredParserOffsetSurface` iterates
the exact fields production consults. The inline snapshot then automatically
widens whenever the allow-list grows, keeping the "no structured offset"
guarantee bound to the real extractor input. If exporting the constant from the
production module is undesirable, relocate it to a shared internal allow-list
module that both the extractor and the test import.

## Finding 3: the quarantine test repeats the real-SWC range assertion already pinned by the ranges suite

Category: similarity

Severity: low

Location:

- `tests/static-analysis/body-syntax-span-narrowing-quarantine.test.ts:45`
- `tests/static-analysis/workflow-body-parser-ranges.test.ts:41`

Description:

Both suites build the same malformed fixture (`agent("draft"\n`), capture the
real SWC error, and assert that
`structuredNormalizedRangeFromParserError(realError, normalized)` is
`undefined`:

```ts
// quarantine suite, line 45
expect(structuredNormalizedRangeFromParserError(realError, normalized)).toBeUndefined();
```

```ts
// ranges suite, line 41
expect(structuredNormalizedRangeFromParserError(realError, normalized)).toBeUndefined();
```

The quarantine suite's distinctive contribution is the end-to-end assertion
(`diagnostic.span` equals the whole `envelope.bodySpan`) and the public-surface
absence checks; the raw "real SWC error yields no structured range" fact is
already owned by the ranges suite, which is the natural home for
extractor-level behaviour. The duplicated line is not harmful, but it is
redundant coverage of the same extractor contract across two files using the
same fixture, and it blurs which suite owns that assertion.

Proposed fix:

Drop the redundant `structuredNormalizedRangeFromParserError(realError, ...)`
assertion from the quarantine suite and let it focus on its unique contract:
the whole-body `diagnostic.span` fallback for a real parser failure and the
seam's absence from the public package entry. Leave the extractor-level
real-SWC assertion with the ranges suite that owns range extraction. This keeps
each suite's ownership boundary sharp without losing any coverage.

## Finding 4: the SWC upgrade checklist does not name the guard that backs its re-observation step

Category: docs-gap

Severity: low

Location:

- `docs/developers-guide.md:556`

Description:

The developers' guide SWC upgrade checklist instructs the upgrader to
"Re-observe the parser error object's structured range surface at the same
time" and to revisit ADR 0003 before accepting an upgrade that could activate
token-level narrowing. That re-observation is exactly what
`tests/static-analysis/swc-parse-error-surface.test.ts` already performs
mechanically through its inline snapshot of the structured-offset field
surface, yet the checklist frames the step as a manual observation and names
neither the characterization test nor the production allow-list
(`STRUCTURED_RANGE_FIELDS`) the observation must cover. The adjacent checklist
bullets are precise about which files and suites to re-run for the parser
detail surface, so this bullet reads as looser guidance than its neighbours and
risks an upgrader hand-checking a surface the suite already pins (or skipping
the suite because the checklist does not point at it).

Proposed fix:

Name the mechanical guard in the checklist: state that
`tests/static-analysis/swc-parse-error-surface.test.ts` pins the structured
parser-error field surface and must be re-run and re-snapshotted on an upgrade,
and reference the production allow-list it tracks. Sequence this after Finding
2 so the guide can describe a guard that genuinely consumes the production
allow-list rather than a private copy, making the "re-observe" step
reproducible instead of a matter of reviewer diligence.
