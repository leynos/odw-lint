# Post-step audit: roadmap task 2.3.4

Audit run after roadmap task 2.3.4 (Characterize ODW loader rejection of
TypeScript-only workflow body, commit `1ab5e8b`) merged to the integration
branch. Scope: the 2.3.4 body-parser neighbourhood plus a broader sweep of
`src/static-analysis/` and `src/diagnostics/`.

Trail followed: `AGENTS.md` quality gates and refactoring heuristics,
`docs/adr/0002-workflow-body-parser-dialect-scope.md`,
`docs/rules/body-syntax.md`, `docs/developers-guide.md`, and the roadmap. Code
navigated with `leta`/exact search inside the audit worktree; history read with
`git show` on the merge commit.

Every finding below was verified directly against the branch-local source.
Findings are ordered most-actionable first. Severities are advisory. Adding any
of the proposed roadmap items is reserved to the root agent; they are proposals
only.

## 1. Duplicated operator-token helper across mask modules

- Category: duplication
- Severity: medium
- Location: `src/static-analysis/source-mask.ts:135` and
  `src/static-analysis/source-mask-templates.ts:155`

`significantOperatorEndingAt` and `significantTemplateOperatorEndingAt` are
byte-for-byte identical: both read the character at `index` and its
predecessor, return `"++"` or `"--"` for a doubled `+`/`-`, and otherwise
return the single character. Two copies drift independently and duplicate the
compact-operator rule.

Proposed fix: extract one shared private helper (for example in
`source-scanner-primitives.ts` or `source-mask.ts`) and call it from both
`significantTokenEndingAt` and the template path, removing
`significantTemplateOperatorEndingAt`.

## 2. Source position/span cloning reimplemented in two diagnostics modules

- Category: duplication
- Severity: low
- Location: `src/diagnostics/rule-diagnostic.ts:51` and
  `src/diagnostics/report.ts:57`

`frozenPosition`/`frozenSpan` (rule-diagnostic) and `cloneSourcePosition`/
`cloneSourceSpan` (report) independently reimplement the same nested span
shallow-copy. They differ only in that the rule-diagnostic pair calls
`Object.freeze` on each copy while the report pair does not. The near-copy
hides that meaningful freeze difference and invites divergence.

Proposed fix: move span/position copying into one shared diagnostics helper
module exposing a single, documented copy (parameterized on freezing, or two
clearly named variants), then reuse it in both call sites so the freeze
contract is stated once.

## 3. Inline magic string for object-literal preceding characters

- Category: inconsistency
- Severity: low
- Location: `src/static-analysis/workflow-metadata.ts:305`

`isObjectLiteralOpening` decides whether a brace opens an object literal with
the inline expression
`"([{,;:?=+-*/%!&|^~<>".includes(text[previousIndex] ?? "")`. The set of
preceding characters encodes a JavaScript grammar rule but is neither named nor
commented, and it is inconsistent with the sibling heuristic
`REGEX_ALLOWED_PREVIOUS_CHARACTERS` in `source-mask-regex.ts:17`, which models
the same "expression-preceding character" concept as a named `Set`.

Proposed fix: hoist the string to a named `Set` constant (for example
`OBJECT_LITERAL_PRECEDING_CHARACTERS`) with a one-line comment describing the
grammar rule it encodes, and test membership against the set. This aligns with
the existing regex-detection convention and documents intent.

## 4. Exported regex-detection constants lack doc comments

- Category: docs-gap
- Severity: low
- Location: `src/static-analysis/source-mask-regex.ts:17`

`REGEX_ALLOWED_PREVIOUS_CHARACTERS`, `REGEX_ALLOWED_PREVIOUS_KEYWORDS`, and
`REGEX_DISALLOWED_PREVIOUS_TOKENS` are exported without JSDoc, while every
function beneath them in the same file carries a doc comment. A reader cannot
tell from the declaration why each set exists or how it feeds the regex-literal
heuristic.

Proposed fix: add a one-line JSDoc to each constant stating the heuristic role
(characters, keywords, and disallowed prior tokens that gate whether `/` begins
a regular-expression literal).

## 5. Asymmetric public export of the reviewed-rule accessors

- Category: inconsistency
- Severity: low
- Location: `src/diagnostics/rule-catalogue.ts:312` and `src/index.ts:19`

`firstReviewedRuleMessage` (rule-catalogue:326) is re-exported from the package
entry `src/index.ts`, but its sibling `firstReviewedRuleTemplate`
(rule-catalogue:312) is not, even though both are module exports and the latter
is consumed internally by `workflow-body-parser.ts`. The asymmetry is
undocumented, so it is unclear whether the template accessor is deliberately
internal or an omission from the public surface pinned by
`tests/diagnostics/public-api-fixtures.ts`.

Proposed fix: decide the surface deliberately. Either re-export
`firstReviewedRuleTemplate` from `src/index.ts` and add it to the expected
public exports fixture, or annotate it as internal-only with a short comment
explaining why the message accessor is public while the template accessor is
not.

## 6. Structured-span narrowing is dormant under the pinned parser

- Category: separation-of-concerns
- Severity: low
- Location: `src/static-analysis/workflow-body-parser-spans.ts:1` and
  `docs/rules/body-syntax.md:22`

`workflow-body-parser-spans.ts` (277 lines) resolves a structured normalized
byte range from parser errors by reading allow-listed fields (`span`,
`byteOffset`, `pos`, `start`, `offset`) plus a required `base`/`coordinateBase`
string. The pinned `@swc/core` syntax errors expose none of these, so
`structuredNormalizedRangeFromParserError` always returns `undefined` and
`parseWorkflowBody` always falls back to the whole-body span in production; the
coordinate-base conversion and token-end scanning are exercised only by
synthetic test errors. The module header records this as intentional, retained
for a future parser channel, but `docs/rules/body-syntax.md` states "When the
parser exposes a structured byte range for the syntax error, the diagnostic
span narrows to that offending token" without noting that the current pin never
triggers narrowing.

Proposed fix: add one clarifying sentence to `docs/rules/body-syntax.md` (and
optionally ADR 0002) that the currently pinned SWC parser exposes no structured
range, so body-syntax spans currently always use the conservative whole-body
fallback. Track the decision to either wire a real SWC offset channel or
quarantine the speculative module as a roadmap item (see proposed item 2) so
the dormant surface does not silently rot.

## 7. Loader-parity test: duplicate helpers and a sync-constructor model gap

- Category: test-gap
- Severity: low
- Location: `tests/static-analysis/body-syntax-loader-parity.test.ts:38`

Two helpers, `constructsWithoutSyntaxError` and `constructionErrorFor`, each
wrap `construct(body)` in the same try/catch, differing only in whether they
return a boolean or the thrown value; three `describe` blocks re-iterate the
same `TYPESCRIPT_ONLY_DIALECT_BODIES` and `ACCEPTED_ECMASCRIPT_BOUNDARY_BODIES`
corpus. Separately, the parity probe includes the synchronous `Function`
constructor as a model of the ODW loader, but `odw-lint` normalizes bodies by
wrapping them in `async function` (`workflow-body-normalizer.ts:17`), so a body
that relies on top-level `await` would be rejected by the sync `Function` probe
while the real async loader accepts it. `loaderRejectsBody` masks this because
it requires both constructors to reject (`every(constructs === false)`), and no
`await`-bearing body appears in the corpus, so the async boundary is untested.

Proposed fix: derive `constructsWithoutSyntaxError` from a single
`constructionErrorFor` call to remove the duplication, document why both
constructors are required (or restrict the probe to `AsyncFunction`, matching
the async wrapper), and add an accepted top-level-`await` boundary body to
`typescript-only-dialect-bodies.ts` so the async loader semantics are locked by
a test.

## Proposed roadmap items (proposals only)

The root agent owns roadmap edits. These are candidates, not commitments.

1. Consolidate duplicated static-analysis helpers. Extract the shared
   compact-operator token helper (finding 1) and the source position/span
   copying helpers (finding 2) into single reviewed utilities, and replace the
   inline object-literal character string with a named set (finding 3), as one
   atomic refactor pass with tests. Rationale: removes verified duplication and
   an inconsistency the AGENTS.md refactoring heuristics call out, lowering
   drift risk. Severity: medium.
2. Resolve the dormant body-syntax span-narrowing surface. Decide whether to
   wire a real SWC structured-offset channel or explicitly quarantine
   `workflow-body-parser-spans.ts`, and align `docs/rules/body-syntax.md` and
   ADR 0002 with the current whole-body-fallback behaviour (finding 6).
   Rationale: ~200 lines of production-unreachable machinery and a rule doc
   that overstates current behaviour should be reconciled deliberately.
   Severity: low.
