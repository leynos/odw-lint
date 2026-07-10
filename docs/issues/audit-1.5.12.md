# Audit after roadmap task 1.5.12

This post-step audit was run after roadmap task 1.5.12 (`Bind recorded review
evidence to tree state`) merged into `origin/main` at commit `5c8ccd5`. The
audit used `grepai` against the canonical `main` index for intent search, then
verified every branch-local fact in a fresh worktree off `origin/main` with
`leta`, targeted file inspection, and exact text search.

Task 1.5.12 recorded reviewed commit and tree provenance in review-evidence
artefacts (`tests/build-gate/review-evidence-provenance.ts`), taught the
artefact checker to reject unbound or mismatched reports
(`tests/build-gate/review-evidence-artefact.ts`), and threaded provenance
capture through the recording path
(`tests/build-gate/review-evidence-recording.ts`). The immediately preceding
task, 3.2.6 (`Complete SWC traversal adoption`, commit `92861ca`), rewired the
parser-backed deterministic-time, alias, scope, and binding collectors onto the
shared `traverseAstSubtree` driver in `src/static-analysis/swc-ast.ts`. The
audit therefore concentrates on the new provenance-binding surface and the
freshly consolidated traversal collectors, then extends across the wider
`tests/build-gate/`, `src/static-analysis/`, and `src/diagnostics/` trees.

Normative references used:

- `AGENTS.md`
- `docs/complexity-antipatterns-and-refactoring-strategies.md`
- `docs/developers-guide.md`
- `docs/documentation-style-guide.md`
- `docs/roadmap.md`
- `docs/scripting-standards.md`
- `docs/technical-design.md`
- `docs/issues/audit-1.5.11.md` (prior post-step audit, for continuity)

Skills and tools used:

- `code-review`: audit dimensions and finding structure.
- `en-gb-oxendict`: spelling and grammar convention.
- `grepai`: canonical `main` intent search.
- `leta`: branch-local symbol and source navigation.
- `sem`: entity-level history navigation of the 1.5.12 and 3.2.6 change sets.

## Finding 1: SWC node type-guards are duplicated across the traversal collectors

Category: duplication

Severity: medium

Location:

- `src/static-analysis/workflow-deterministic-time-aliases.ts:214`
  (`isIdentifier`)
- `src/static-analysis/workflow-deterministic-time-aliases.ts:219`
  (`isMemberExpression`)
- `src/static-analysis/workflow-deterministic-time-aliases.ts:224`
  (`isExpression`)
- `src/static-analysis/workflow-global-object-reference.ts:131`
  (`isIdentifier`)
- `src/static-analysis/workflow-global-object-reference.ts:136`
  (`isMemberExpression`)
- `src/static-analysis/workflow-global-object-reference.ts:141`
  (`isExpression`)

Description:

Both parser-backed collectors define byte-equivalent private node type-guards.
`isIdentifier` narrows on `type === "Identifier"`, `isMemberExpression` narrows
on `type === "MemberExpression"`, and `isExpression` is a verbatim alias for the
shared `isAstNode`:

```ts
const isExpression = (value: unknown): value is Expression => {
  return isAstNode(value);
};
```

The 3.2.6 traversal-adoption change routed both modules through the shared
`swc-ast.ts` driver, which already owns `isAstNode`, so the type-guard vocabulary
now has a natural home — yet each collector still carries its own copies. The
`aliases` module also locally re-implements `isCallExpression` (line 204) and
`isVariableDeclarator` (line 209) that other collectors express inline as
`node.type === "..."` checks, so the same narrowing intent is spelled several
ways across siblings.

Proposed fix:

Promote the shared SWC node type-guards (`isIdentifier`, `isMemberExpression`,
`isCallExpression`, `isVariableDeclarator`, and the `isExpression`/`isAstNode`
alias) into `src/static-analysis/swc-ast.ts` next to `traverseAstSubtree`, then
import them from both collectors and delete the private copies. This gives the
traversal seam one narrowing vocabulary and removes the duplicated `isExpression`
alias entirely.

## Finding 2: Git-command failure formatting is duplicated and forks between throw and result styles

Category: duplication

Severity: medium

Location:

- `tests/build-gate/git-support.ts:159` (`assertGitCommandSucceeded`)
- `tests/build-gate/git-support.ts:174` (`renderGitCommand`)
- `tests/build-gate/review-evidence-provenance.ts:158` (`renderGitCommand`)
- `tests/build-gate/review-evidence-provenance.ts:161`
  (`gitCommandFailureMessage`)

Description:

Task 1.5.12 added `review-evidence-provenance.ts`, which reads `HEAD` and
`HEAD^{tree}` through the shared `GitRunner`. To report failures it re-implements
`renderGitCommand` (identical to the `git-support.ts` copy) and a
`gitCommandFailureMessage` helper whose error / status / signal branches mirror
`assertGitCommandSucceeded`. The two now disagree on shape and detail: the
provenance copy returns a `string | undefined` result and wraps every field with
`singleLine(...)`, whereas the older `git-support.ts` copy throws and does not
sanitize multi-line `stderr`. The same "how do we phrase a failed git command"
decision is therefore encoded twice, in two error-handling idioms, and only one
of them normalizes whitespace.

Proposed fix:

Export `renderGitCommand` from `tests/build-gate/git-support.ts` and have
`review-evidence-provenance.ts` import it. Factor the error / status / signal
classification into one shared `gitCommandFailure(command, result)` helper that
returns a normalized `string | undefined`; let `assertGitCommandSucceeded` throw
on its non-`undefined` result and let the provenance reader return it. This
collapses the two copies to one and gives both call sites the `singleLine`
sanitization.

## Finding 3: `recordedReportContent` is a query that writes to stderr

Category: cqs

Severity: medium

Location:

- `tests/build-gate/review-evidence-recording.ts:98` (`recordedReportContent`)

Description:

`recordedReportContent` is named and typed as a pure query — it takes a report
plus a provenance reader and returns the report string, optionally with a
provenance trailer. But on the unavailable-provenance branch it performs I/O:

```ts
input.writers.writeErr(`review evidence provenance unavailable: ${result.message}\n`);
return input.report;
```

Emitting a diagnostic while computing a return value is a Command-Query
Separation violation: a caller cannot ask "what content would we record?" without
also provoking stderr output, and a unit test of the string-building logic must
inject and assert on a writer it should not need. It also splits the recording
path's user-facing messaging across two functions
(`maybeRecordReviewEvidence` already owns the write-failure message on line 60),
so provenance diagnostics live one layer deeper than the failure diagnostics
they sit beside.

Proposed fix:

Make `recordedReportContent` return a discriminated result, for example
`{ content: string; provenanceError?: string }`, and move the `writeErr` call up
into `maybeRecordReviewEvidence` alongside the existing write-failure diagnostic.
The content builder then becomes a pure query that is trivially testable without
a writer, and all recording-path diagnostics are emitted from one place.

## Finding 4: The metadata-value scanner re-implements the shared comment scanners

Category: duplication

Severity: medium

Location:

- `src/static-analysis/workflow-envelope-meta-value.ts:122` (`scanLineCommentEnd`)
- `src/static-analysis/workflow-envelope-meta-value.ts:133` (`scanBlockCommentEnd`)
- `src/static-analysis/workflow-metadata-comment-scan.ts:49` (`scanLineCommentEnd`)
- `src/static-analysis/workflow-metadata-comment-scan.ts:67` (`scanBlockCommentEnd`)

Description:

`workflow-metadata-comment-scan.ts` is the module whose file comment declares it
holds the "shared delimiter and comment scanners for metadata parsing", and it
exports `scanLineCommentEnd` and `scanBlockCommentEnd`. Yet
`workflow-envelope-meta-value.ts` defines its own private `scanLineCommentEnd`
and `scanBlockCommentEnd` with the same behaviour, differing only in that the
private pair hardcodes `text.length` as the scan bound instead of accepting an
explicit `endIndex`. The comment-inert skipping logic they support (lines
107-113) is exactly what the shared scanners exist to provide, so the "shared"
module is bypassed by a sibling in the same package.

Proposed fix:

Delete the private `scanLineCommentEnd` / `scanBlockCommentEnd` from
`workflow-envelope-meta-value.ts` and import the exported pair from
`workflow-metadata-comment-scan.ts`, passing `text.length` as the `endIndex`
argument at the two call sites in `nextMetadataValueIndex`.

## Finding 5: Diagnostic copy helpers are duplicated with a freeze variance and an inconsistent optional-field idiom

Category: duplication

Severity: low

Location:

- `src/diagnostics/report.ts:56` (`cloneSourcePosition`)
- `src/diagnostics/report.ts:61` (`cloneSourceSpan`)
- `src/diagnostics/report.ts:75` (`cloneDiagnostic`)
- `src/diagnostics/rule-diagnostic.ts:50` (`frozenPosition`)
- `src/diagnostics/rule-diagnostic.ts:56` (`frozenSpan`)
- `src/diagnostics/rule-diagnostic.ts:34` (`createRuleDiagnostic`)

Description:

`report.ts` and `rule-diagnostic.ts` each own a parallel family of source-span
copy helpers. `cloneSourceSpan` / `cloneSourcePosition` shallow-copy a span's
start and end positions; `frozenSpan` / `frozenPosition` do the identical copy
and additionally `Object.freeze` each level. The structural traversal — copy a
position, copy both ends of a span, copy the optional suggestions — is written
twice, with `Object.freeze` as the only behavioural difference. The two modules
also handle the optional `suggestions` field in different idioms:
`cloneDiagnostic` builds a base object then conditionally re-spreads it with an
early return, whereas `createRuleDiagnostic` uses the cleaner inline
`...(suggestions === undefined ? {} : { suggestions: ... })` ternary within the
object literal.

Proposed fix:

Extract the span/position/suggestion copy into one shared helper (for example
`src/diagnostics/diagnostic-copy.ts`) parameterized on whether to freeze — for
instance `copySourceSpan(span, { freeze })` — and have both modules consume it.
Align `cloneDiagnostic` with the inline optional-field ternary already used by
`createRuleDiagnostic` so both spell the optional `suggestions` field the same
way.

## Finding 6: The `errorMessage` and `parseFlagValue` build-gate helpers remain duplicated after 1.5.12

Category: duplication

Severity: low

Location:

- `tests/build-gate/review-evidence-artefact-cli.ts:171` (`errorMessage`)
- `tests/build-gate/review-evidence-recording.ts:114` (`errorMessage`)
- `tests/build-gate/whitespace-hygiene.ts:91` (`errorMessage`)
- `tests/build-gate/review-evidence-artefact-cli.ts:176` (`parseFlagValue`)
- `tests/build-gate/review-evidence-cli.ts:313` (`parseFlagValue`)

Description:

`audit-1.5.10.md` and `audit-1.5.11.md` both recorded that the unknown-to-text
`errorMessage` helper is triplicated (and written in two syntactic forms — two
`const` arrows and one hoisted `function`) and that the `--name=value`
`parseFlagValue` reader is duplicated byte-for-byte across the two evidence CLIs.
Task 1.5.12 edited `review-evidence-recording.ts` (adding provenance capture
directly above the `errorMessage` copy at line 114) but did not lift either
helper, so both duplications persist unchanged. Error-text policy and flag
parsing for the gate family are still each defined in more than one place.

Proposed fix:

Add a single `errorMessage(error: unknown): string` to
`tests/build-gate/report-format-helpers.ts` (which already hosts `singleLine`,
the helper the recording path composes it with) and promote `parseFlagValue` to
`tests/build-gate/cli-support.ts`; import both from every call site and delete
the private copies. This completes the consolidation direction of
`audit-1.5.10.md` and `audit-1.5.11.md`.

## Finding 7: Delimiter-depth trackers diverge, and one omits the zero clamp

Category: inconsistency

Severity: low

Location:

- `src/static-analysis/workflow-envelope-meta-value.ts:222` (`nextObjectDepth`)
- `src/static-analysis/workflow-envelope-statement.ts:47` (`nextDepthState`)
- `src/static-analysis/workflow-metadata-parser-scan.ts:276`
  (`nextExpressionDepth`)

Description:

Three sibling scanners each fold one source character into a running delimiter
depth, but they disagree on both shape and safety. `nextDepthState` tracks brace,
bracket, and paren depth in a struct and clamps every decrement with
`Math.max(0, …)`; `nextExpressionDepth` is a similar struct-based tracker; but
`nextObjectDepth` tracks only brace depth as a bare number and decrements
unconditionally:

```ts
if (character === "}") {
  return depth - 1;
}
```

On malformed input with an unbalanced `}` this can drive the depth negative,
where the clamping siblings would floor at zero — a latent inconsistency in how
the three scanners treat unbalanced delimiters, on top of the duplicated
increment/decrement intent.

Proposed fix:

At minimum, add the `Math.max(0, depth - 1)` clamp to `nextObjectDepth` so all
three trackers share the same unbalanced-delimiter semantics. Better, express the
brace-only tracker in terms of the shared `nextDepthState` (reading back
`braceDepth`) or extract a single depth-folding primitive the three scanners
consume, so the increment/decrement logic lives in one place.

## Finding 8: Exported CLI tuple types lack the doc-comments their siblings carry

Category: docs-gap

Severity: low

Location:

- `tests/build-gate/review-evidence-cli.ts:30` (`GateCommand`)
- `tests/build-gate/review-evidence-cli.ts:31` (`ReviewEvidenceExitCode`)

Description:

`GateCommand` (a `readonly [ReviewGateId, string, readonly string[]]` tuple) and
`ReviewEvidenceExitCode` (the `0 | 1 | 2 | 3` union) are exported without any
doc-comment, while the exported types and functions in the sibling
review-evidence modules (`review-evidence.ts`, `review-evidence-provenance.ts`,
`review-evidence-artefact.ts`) are consistently documented with JSDoc and, in
several cases, `@example` blocks. A reader cannot tell from `GateCommand` alone
what the three positional slots mean, nor which reviewer condition each
`ReviewEvidenceExitCode` value encodes.

Proposed fix:

Add a JSDoc block above each type: for `GateCommand`, name the three tuple slots
(gate id, human label, gate argv); for `ReviewEvidenceExitCode`, enumerate what
`0`/`1`/`2`/`3` mean. This matches the documentation convention the surrounding
review-evidence modules already follow.

## Proposed roadmap items

Adding roadmap items is reserved to the root agent; the following are proposals
only.

### Centralize the SWC traversal narrowing vocabulary

Rationale: the 3.2.6 traversal-adoption change routed the collectors through the
shared `swc-ast.ts` driver but left each collector re-implementing its own node
type-guards, including a verbatim `isExpression`/`isAstNode` alias (this audit,
Finding 1). Promote the shared node type-guards into `swc-ast.ts` so the
traversal seam has one narrowing vocabulary.

Severity: medium

### Unify the build-gate git-command and error/flag helpers

Rationale: task 1.5.12 added a second copy of `renderGitCommand` and a
throw-versus-result fork of the git-failure formatter (this audit, Finding 2),
while the `errorMessage` triplication and `parseFlagValue` duplication first
recorded in `audit-1.5.10.md` still persist (this audit, Finding 6). Share one
git-failure formatter and lift `errorMessage` / `parseFlagValue` into the
existing build-gate helper modules.

Severity: medium

### Restore Command-Query Separation in the review-evidence recording path

Rationale: `recordedReportContent` emits a stderr diagnostic while returning the
report content, so the content builder cannot be exercised without provoking I/O
(this audit, Finding 3). Return a provenance-error discriminator and move the
diagnostic up into `maybeRecordReviewEvidence` beside the existing
write-failure message.

Severity: medium

### Consolidate the duplicated static-analysis scanners

Rationale: `workflow-envelope-meta-value.ts` re-implements the shared comment
scanners it could import, and the three delimiter-depth trackers diverge with one
omitting the zero clamp (this audit, Findings 4 and 7). Import the shared comment
scanners and unify the depth-folding primitive so unbalanced delimiters are
handled identically.

Severity: low
