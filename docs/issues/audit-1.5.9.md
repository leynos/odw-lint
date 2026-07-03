# Audit after roadmap task 1.5.9

This post-step audit was run after roadmap task 1.5.9 (`Consolidate build-gate
command-line support`) merged into `origin/main` at commit `b09739f`. The audit
used `grepai` against the canonical `main` index for intent search, then
verified every branch-local fact in a fresh worktree off `origin/main` with
`leta`, targeted file inspection, and `sem` entity history.

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

## Finding 1: The `isStringDelimiter` narrowing wrapper is defined three times

Category: duplication

Severity: medium

Location:

- `src/static-analysis/workflow-metadata-comment-scan.ts:111`
- `src/static-analysis/workflow-metadata-parser.ts:395`
- `src/static-analysis/workflow-metadata-parser-scan.ts:299`

Description:

Three metadata scanner modules each define a private, type-narrowing wrapper
that is byte-for-byte identical:

```ts
const isStringDelimiter = (character: string): character is "'" | '"' | "`" => {
  return isStringLikeDelimiter(character);
};
```

Audit `audit-2.1.12.md` (Finding 1) already flagged the same predicate. The
remediation folded the *body* onto the shared `isStringLikeDelimiter` helper in
`source-mask-delimiters.ts`, but left three copies of the narrowing wrapper in
place because `isStringLikeDelimiter` returns a plain `boolean` and cannot
narrow the delimiter type at call sites. The duplication is therefore only
half-resolved: the shared helper exists, yet the type-guard shim it needs is
still triplicated.

Proposed fix:

Change `isStringLikeDelimiter` in `source-mask-delimiters.ts:124` to be a type
guard that narrows to the string-delimiter union (single quote, double quote, or
backtick) rather than returning a plain `boolean`, then delete the three private
`isStringDelimiter` wrappers and call `isStringLikeDelimiter` directly. The
single narrowing helper serves both the source-mask and metadata scanner
families, closing the residue left by `audit-2.1.12`.

## Finding 2: Two parallel low-level source scanners duplicate lexing rules

Category: similarity

Severity: medium

Location:

- `src/static-analysis/source-mask-strings.ts`
- `src/static-analysis/source-mask-templates.ts`
- `src/static-analysis/source-mask-comments.ts`
- `src/static-analysis/workflow-metadata-string-scan.ts`
- `src/static-analysis/workflow-metadata-comment-scan.ts`

Description:

The codebase carries two independent character-level scanners over the same
JavaScript token grammar. The `source-mask-*` family scans strings, templates,
and comments to build *mask ranges* for inert-region detection, while the
`workflow-metadata-*-scan` family re-implements string, template, and comment
scanning to *prove literal values* for metadata parsing. Both handle backslash
escapes, line-terminator termination, CRLF line continuations, `${...}`
template-interpolation nesting, and block/line comment boundaries, with subtly
different semantics (for example, `scanQuotedStringEnd` in
`source-mask-strings.ts:47` stops a string at a line terminator, whereas
`scanStringLiteral` in `workflow-metadata-string-scan.ts:26` treats the same
boundary as "unprovable"). Maintaining two scanners over one grammar risks the
two drifting apart when the ECMAScript surface they model changes.

Proposed fix:

Extract a single low-level lexing primitive layer (delimiter classification,
escape consumption, template-expression nesting, comment boundaries) that both
families consume. The mask family would keep its range-building policy and the
metadata family its value-proving policy, but both would share one authoritative
implementation of "where does this token end". Treat this as an incremental
consolidation, not a rewrite, because the shared `source-mask-delimiters`
predicates already show the pattern works.

## Finding 3: Build-gate CLI entry points repeat the run-and-exit orchestration

Category: similarity

Severity: low

Location:

- `tests/build-gate/whitespace-hygiene.ts:31`
- `tests/build-gate/branch-freshness-git.ts:70`
- `tests/build-gate/review-evidence-cli.ts:73`

Description:

Task 1.5.9 correctly consolidated writer resolution and single-report dispatch
into `tests/build-gate/cli-support.ts`. The remaining orchestration around it is
still copied across all three gate CLIs: each parses arguments, produces a
result, formats it, calls `emitCliReport({ report, toErr, writers })`, returns a
gate-specific exit code, and ends with the identical module-main guard
`if (process.argv[1] === fileURLToPath(import.meta.url)) { ... }`. The exit-code
mapping (`exitCodeForBranchFreshness`, `exitCodeFor`, and the whitespace inline
codes) and the `toErr` derivation are each hand-written per module.

Proposed fix:

Add a small `runBuildGateCli` (or `makeGateMain`) helper to `cli-support.ts`
that accepts a formatted report, a `toErr` flag, an exit code, and the writers,
so each gate reduces to "compute outcome, hand it to the helper". This keeps the
per-gate policy (parsing, classification, exit-code semantics) local while
removing the repeated dispatch-and-guard boilerplate. Lower priority than
Findings 1 and 2 because the duplication is shallow and already partly reduced.

## Finding 4: `parseCliArg` scrutineer and coderabbit branches are near-identical

Category: ergonomics

Severity: low

Location:

- `tests/build-gate/review-evidence-cli.ts:234`

Description:

Within `parseCliArg`, the `--scrutineer=` and `--coderabbit=` branches are
structurally identical: each calls `parseFlagValue`, guards on `undefined`,
calls `parseAvailability(name, value)`, forwards a string usage error, and calls
`setPathAvailability(options, name, parsed.value)`. Adding a third
availability-carrying reviewer path would mean copying the block a third time,
and `setPathAvailability` is already typed to the closed
`"scrutineer" | "coderabbit"` union, so it must be widened by hand each time.

Proposed fix:

Drive the availability flags from a small table of
`{ flag: "--scrutineer=", path: "scrutineer" }` entries and iterate it inside
`parseCliArg`, so each new reviewer path is one data row rather than a copied
branch. This also lets `setPathAvailability` take a `ReviewPath` directly.

## Finding 5: The `--scrutineer=` CLI flag is undocumented

Category: docs-gap

Severity: low

Location:

- `docs/developers-guide.md:248`
- `tests/build-gate/review-evidence-cli.ts:234`

Description:

The review-evidence CLI accepts `--scrutineer=<availability>` as a first-class
flag, and it is exercised by tests
(`tests/build-gate/review-evidence-cli.test.ts:272` onwards). The developers
guide documents only the symmetric `--coderabbit=` variants
(`--coderabbit=quota-blocked`, `--coderabbit=unavailable`,
`--coderabbit=no-output`) and mentions the scrutineer *states* only in prose. A
reviewer following the guide has no documented way to mark the primary
reviewer's availability, even though the flag exists and is tested.

Proposed fix:

Add the `--scrutineer=<availability>` flag to the developers guide alongside the
`--coderabbit=` variants, listing the same `available`, `quota-blocked`,
`unavailable`, and `no-output` values, so the documented surface matches the
tested one.

## Proposed roadmap items

Adding roadmap items is reserved to the root agent; the following are proposals
only.

### Unify the string-delimiter type guard

Rationale: promote `isStringLikeDelimiter` to a type guard and delete the three
duplicated `isStringDelimiter` wrappers, closing the residue left by
`audit-2.1.12` Finding 1 (this audit, Finding 1).

Severity: medium

### Extract a shared source-scanning primitive layer

Rationale: the `source-mask-*` and `workflow-metadata-*-scan` families
re-implement the same JavaScript token grammar with subtly different semantics;
a shared low-level lexing layer would stop the two drifting apart (this audit,
Finding 2).

Severity: medium

### Consolidate build-gate CLI run-and-exit orchestration

Rationale: extend `cli-support.ts` with a run-and-exit helper so the three gate
CLIs stop repeating the format, dispatch, and module-main guard, and adopt a
table-driven reviewer-availability parser (this audit, Findings 3 and 4).

Severity: low
