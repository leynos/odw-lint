# Audit after roadmap task 1.5.11

This post-step audit was run after roadmap task 1.5.11
(`Consolidate build-gate CLI orchestration`) merged into `origin/main` at commit
`5c1a015`. The audit used `grepai` against the canonical `main` index for
intent search, then verified every branch-local fact in a fresh worktree off
`origin/main` with `leta`, targeted file inspection, and exact text search.

Task 1.5.11 added the shared run-and-exit entrypoint helper (`runCliEntrypoint`
in `tests/build-gate/cli-support.ts`), a structural seam test
(`tests/build-gate/cli-entrypoint-test-support.ts`), and reviewer availability
consolidation (`tests/build-gate/review-evidence-availability.ts`), and rewired
the four build-gate CLIs to call the shared entrypoint. The audit therefore
concentrates on the consolidated build-gate CLI surface, then extends across
the wider `tests/build-gate/` and `src/static-analysis/` trees.

Normative references used:

- `AGENTS.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/scripting-standards.md`
- `docs/technical-design.md`
- `docs/issues/audit-1.5.10.md` (prior post-step audit, for continuity)

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- `grepai`: canonical `main` intent search.
- `leta`: branch-local symbol and source navigation.
- `sem`: entity-level history navigation of the 1.5.11 change set.

## Finding 1: Named-import AST helpers are duplicated across the two build-gate seam tests

Category: duplication

Severity: medium

Location:

- `tests/build-gate/cli-entrypoint-test-support.ts:83` (`importSpecifierName`)
- `tests/build-gate/cli-support-test-support.ts:89` (`importSpecifierName`)
- `tests/build-gate/cli-entrypoint-test-support.ts:47` (`namedImportBindings`)
- `tests/build-gate/cli-support-test-support.ts:58` (`hasNamedImport`)

Description:

Task 1.5.11 added `cli-entrypoint-test-support.ts` alongside the pre-existing
`cli-support-test-support.ts`. Both files walk the TypeScript compiler AST to
inspect named imports, and both define a byte-for-byte identical helper:

```ts
function importSpecifierName(element: ts.ImportSpecifier): string {
  return element.propertyName?.text ?? element.name.text;
}
```

They also re-implement the same "does this import declaration bring in symbol
`X` from module path `P`" matching logic — `namedImportBindings` /
`matchingNamedImportBindings` in the new file (returning the local bindings) and
`hasNamedImport` / `hasMatchingNamedImport` in the sibling (returning a
boolean). The bodies share their entire structure (import-declaration guard,
string-literal module-specifier guard, `namedBindings` narrowing, per-element
predicate) and differ only in the reduction. A single change set introduced a
second copy of an import-inspection primitive the sibling seam test already
owned.

Proposed fix:

Extract the import-inspection primitives into one shared module (for example
`tests/build-gate/cli-ast-support.ts`): export `importSpecifierName` and a
`namedImportBindings(sourceFile, importPath, importedName)` query, then define
`hasNamedImport` as `namedImportBindings(...).length > 0`. Have both seam tests
consume the shared helpers and delete the duplicates.

## Finding 2: Build-gate CLIs still disagree on the process-exit contract, and the shared default is the truncation-prone one

Category: inconsistency

Severity: medium

Location:

- `tests/build-gate/cli-support.ts:60` (`runCliEntrypoint` mode default)
- `tests/build-gate/review-evidence-cli.ts:343` (`mode: "exitCode"`)
- `tests/build-gate/whitespace-hygiene.ts:95` (default `exit`)
- `tests/build-gate/branch-freshness-git.ts:366` (default `exit`)
- `tests/build-gate/review-evidence-artefact-cli.ts:144` (default `exit`)

Description:

`audit-1.5.10.md` Finding 4 recorded that the build-gate CLIs disagreed on
process-exit style, and proposed folding the guard into a shared helper so the
exit contract is defined once. Task 1.5.11 delivered that shared helper
(`runCliEntrypoint`), but the underlying divergence survives.
`runCliEntrypoint` defaults its `mode` to `"exit"`, which calls
`process.exit(code)`; only `review-evidence-cli.ts` opts into
`mode: "exitCode"`, which sets `process.exitCode` and lets Node drain buffered
output. The other three gates take the default and therefore still call
`process.exit()`, which can truncate not-yet-flushed `stdout` on a pipe. All
four gates emit their report immediately before returning, so the two styles
still carry different output-delivery guarantees — and the consolidation made
the truncation-prone form the default that three of the four gates silently
inherit.

Proposed fix:

Change the `runCliEntrypoint` default to `"exitCode"` (the form that preserves
buffered output) and reserve explicit `mode: "exit"` for any gate that
genuinely needs an immediate exit, or convert the remaining three gates to
`mode: "exitCode"` so all four share the output-preserving contract. Add a
comment on the default recording why `exitCode` is the safe choice for
report-emitting gates.

## Finding 3: The entrypoint seam test prunes the AST subtree on the first non-matching call

Category: complexity

Severity: low

Location:

- `tests/build-gate/cli-entrypoint-test-support.ts:88` (`hasCallExpression`)

Description:

`hasCallExpression` decides whether a CLI actually calls `runCliEntrypoint`:

```ts
const visit = (node: ts.Node): void => {
  if (found) return;
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
    found = functionNames.includes(node.expression.text);
    return; // returns for every identifier call, matching or not
  }
  ts.forEachChild(node, visit);
};
```

On any `CallExpression` with an identifier callee, it assigns `found` and
returns without descending into that call's children. If the first identifier
call encountered is not `runCliEntrypoint`, the whole subtree beneath it is
pruned. For the current four gates — each of which calls `runCliEntrypoint` at
statement top level — this is correct, but a future gate that nests the call
(for example `wrap(runCliEntrypoint({ ... }))`) would be reported as not
calling the shared helper, producing a false
`build-gate CLI must call runCliEntrypoint` failure. The guard is more brittle
than its sibling checks, which recurse fully.

Proposed fix:

Only stop recursion when a match is found. Set `found` when the callee matches
and return; otherwise fall through to `ts.forEachChild(node, visit)` so nested
`runCliEntrypoint` calls are still discovered. This mirrors the full-recursion
pattern already used by `hasInlineRunAndExitGuard` in the same file.

## Finding 4: The shared run-and-exit seam added by 1.5.11 is undocumented in the developers guide

Category: docs-gap

Severity: low

Location:

- `docs/developers-guide.md:216`
- `tests/build-gate/cli-support.ts:43` (`runCliEntrypoint`)

Description:

The developers guide paragraph on `cli-support.ts` describes only writer
resolution, default `stdout`/`stderr` streams, and single-report dispatch, and
still states that "Gate modules keep their own report formatting and exit-code
mapping." Task 1.5.11's headline change — the shared `runCliEntrypoint`
run-and-exit orchestration seam, its `exit` vs `exitCode` termination modes,
and the structural test that enforces its use — is not mentioned. A developer
reading the guide would not learn that the module-main guard is now shared, nor
which termination mode to select for a new gate, even though the seam test
(`cli-entrypoint-test-support.ts`) will reject a gate that inlines its own
guard.

Proposed fix:

Extend the `cli-support.ts` paragraph in `docs/developers-guide.md` to document
`runCliEntrypoint`: that new gates invoke it from their module-main guard
rather than inlining `process.argv`/`process.exit` handling, and that
report-emitting gates should select `mode: "exitCode"` to preserve buffered
output (see Finding 2). Update the now-partly-stale "keep their own … exit-code
mapping" sentence accordingly.

## Finding 5: `parseFlagValue` remains duplicated across two evidence CLIs

Category: duplication

Severity: low

Location:

- `tests/build-gate/review-evidence-artefact-cli.ts:140`
- `tests/build-gate/review-evidence-cli.ts:311`

Description:

`audit-1.5.10.md` Finding 1 recorded that the `--name=value` flag reader was
duplicated byte-for-byte between the two evidence CLIs:

```ts
const parseFlagValue = (arg: string, prefix: string): string | undefined => {
  return arg.startsWith(prefix) ? arg.slice(prefix.length) : undefined;
};
```

Task 1.5.11 consolidated CLI *orchestration* (the run-and-exit guard) but did
not lift this argument-parsing helper, so both private copies persist. The
consolidation touched both files, so this was the natural moment to share the
helper.

Proposed fix:

Promote `parseFlagValue` to `tests/build-gate/cli-support.ts` (the shared
build-gate CLI seam that `runCliEntrypoint` now also lives in) and import it
from both evidence CLIs, deleting the two private copies.

## Finding 6: The `errorMessage` unknown-to-text helper remains triplicated and stylistically inconsistent

Category: duplication

Severity: low

Location:

- `tests/build-gate/review-evidence-artefact-cli.ts:135` (`const`)
- `tests/build-gate/review-evidence-recording.ts:79` (`const`)
- `tests/build-gate/whitespace-hygiene.ts:91` (`function`)

Description:

`audit-1.5.10.md` Finding 2 recorded three private copies of the
unknown-to-text error helper. All three survive after 1.5.11, and they are not
even written consistently: two are `const` arrow expressions and the third is a
hoisted `function` declaration, though every body is identical:

```ts
error instanceof Error ? error.message : String(error)
```

Error-text policy for the gate family is therefore still defined in three
places and in two syntactic forms.

Proposed fix:

Add a single `errorMessage(error: unknown): string` to
`tests/build-gate/report-format-helpers.ts` — which already hosts the shared
`singleLine` and `assertNever` formatting helpers — and delete the three
private copies. The recording path already composes
`singleLine(errorMessage(error))`, so `report-format-helpers.ts` is the natural
home.

## Finding 7: The artefact CLI `--evidence-path=` flag is still undocumented

Category: docs-gap

Severity: low

Location:

- `docs/developers-guide.md:255`
- `tests/build-gate/review-evidence-artefact-cli.ts:60`

Description:

`audit-1.5.10.md` Finding 5 recorded that `runReviewEvidenceArtefactCli` accepts
`--evidence-path=<path>` as a first-class flag (parsed at
`review-evidence-artefact-cli.ts:60`, exercised by
`review-evidence-artefact-cli.test.ts`), yet the developers guide documents
only the `ODW_LINT_REVIEW_EVIDENCE_PATH` environment variable and the
`.review-evidence/report.txt` default. Task 1.5.11 did not touch the artefact
CLI's flag surface, so the documented surface still lags the tested one: a
reviewer following the guide has no documented way to point the artefact check
at an ad-hoc path.

Proposed fix:

Add `--evidence-path=<path>` to the `make review-evidence-artefact` paragraph of
`docs/developers-guide.md`, noting its precedence over the environment
variable and default, so the documented surface matches the tested one.

## Proposed roadmap items

Adding roadmap items is reserved to the root agent; the following are proposals
only.

### Finish the build-gate CLI helper consolidation

Rationale: task 1.5.11 shared the run-and-exit guard but left `parseFlagValue`
duplicated and `errorMessage` triplicated (and stylistically inconsistent), and
the exit contract still diverges with the truncation-prone mode as the shared
default (this audit, Findings 2, 5, 6). Lift `parseFlagValue` into
`cli-support.ts` and `errorMessage` into `report-format-helpers.ts`, and make
the `runCliEntrypoint` default (or all four gates) use the output-preserving
`exitCode` mode. This completes the consolidation direction of 1.5.11 and
`audit-1.5.10.md` Findings 1-4.

Severity: medium

### Share the build-gate seam-test AST primitives

Rationale: the structural seam tests `cli-entrypoint-test-support.ts` and
`cli-support-test-support.ts` duplicate `importSpecifierName` and the
named-import matching logic, and `hasCallExpression` prunes the AST subtree on
the first non-matching call (this audit, Findings 1, 3). Extract one shared
import-inspection helper module and fix the recursion so nested calls are
discovered.

Severity: medium

### Document the shared build-gate run-and-exit seam and artefact flag

Rationale: the developers guide does not mention the `runCliEntrypoint`
run-and-exit seam or its exit modes and still documents gate-local exit-code
mapping, and the `--evidence-path=` flag remains undocumented (this audit,
Findings 4, 7). Refresh the `cli-support.ts` and `review-evidence-artefact`
paragraphs so the documented surface matches the shipped one.

Severity: low
