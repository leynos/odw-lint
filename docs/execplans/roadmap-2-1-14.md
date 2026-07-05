# Consolidate delimited and balanced scanner loops

This ExecPlan (execution plan) is a living document. The sections
`Constraints`, `Tolerances`, `Risks`, `Progress`, `Surprises & Discoveries`,
`Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work
proceeds.

Status: COMPLETE

This is planning round 2. Do not begin implementation until the roadmap
workflow approves this plan.

## Purpose / big picture

Roadmap task 2.1.14 finishes the scanner-consolidation arc started by 2.1.13.
Task 2.1.13 extracted the shared low-level primitives (character classification,
escape advancement, comment boundaries, identifier runs) into
`src/static-analysis/source-scanner-primitives.ts`. Several **whole loops** that
walk escaped-delimited regions and balanced expressions were left forked across
the two scanner families, because 2.1.13 stopped at the character-level
primitives. Task 2.1.14 removes those remaining forked loops.

Two scanner families still each carry their own copies of the same two loop
shapes:

- **Escaped-delimited region loops** — walk from an opening `'`, `"`, or
  `` ` `` delimiter to its close, skipping backslash-escaped units, and (for
  template literals) recursing into `${ … }` interpolation. Today this loop
  exists four times:
  - `scanEscapedDelimitedEnd` in
    `src/static-analysis/source-mask-delimiters.ts` (no interpolation, no
    line-terminator stop, bound is source length);
  - `scanQuotedStringEnd` in `src/static-analysis/source-mask-strings.ts`
    (stops at an unescaped line terminator, treats an escaped CRLF as a line
    continuation, no interpolation);
  - `scanDelimitedEnd` in
    `src/static-analysis/workflow-metadata-comment-scan.ts` (handles backtick
    `${` interpolation, explicit `endIndex` bound);
  - the inner `stringLikeRegionEnd` helper nested inside
    `templateExpressionEnd` in `source-scanner-primitives.ts` (identical in
    contract to `scanDelimitedEnd`).
- **Balanced-expression loops** — walk a bracketed region tracking nesting
  depth, skipping string-like and comment regions so their braces do not move
  the depth. Today this loop exists three times:
  - the inner `expressionEnd` helper nested inside `templateExpressionEnd` in
    `source-scanner-primitives.ts` (single brace pair, returns at the matching
    `}`);
  - `scanBalancedEnd` in
    `src/static-analysis/workflow-metadata-parser-scan.ts` (single
    caller-supplied `open`/`close` pair, returns at the matching close);
  - `scanExpressionEnd` in the same file (full brace/bracket/paren depth via
    `nextDelimiterDepthState`, returns at a top-level terminator from a supplied
    set, and trims trailing trivia).

This duplication is exactly the "Duplicated Code" refactoring smell named in
`AGENTS.md` "Refactoring Heuristics & Workflow", and it violates
`docs/technical-design.md` §6.2, which states that scanner-family modules
"must not re-implement the shared UTF-16 grammar loops".

After this plan, both loop shapes live once in
`source-scanner-primitives.ts`:

- one parametrized delimited-region primitive
  (`scanDelimitedRegionEnd`) that expresses all four escaped-delimited scanners
  through options for the scan bound, template interpolation, and
  line-terminator termination; and
- one balanced-expression primitive (`scanBalancedExpressionEnd`) plus one
  shared inert-region skip step (`nextInertRegionEnd`). The balanced primitive
  replaces the two loops whose contracts match (`expressionEnd` and
  `scanBalancedEnd`). `scanExpressionEnd` keeps its own terminator-set and
  trailing-trivia contract but stops forking the string/comment skip by
  composing `nextInertRegionEnd`. This is the roadmap's explicit "and where
  contracts match one balanced-expression primitive" hedge, applied honestly.

The observable behaviour is unchanged: the source masker blanks the same
ranges, and the metadata parser returns the same `parsed` /
`not-statically-provable` results with the same spans. This is a pure,
behaviour-preserving internal refactor. Success is proven by the existing
masking, metadata, and parity suites staying green, plus new focused unit tests
for each new primitive and extended differential parity oracles.

This task adds no external dependency, no parser-backed rule, no CLI surface,
and no change to any public `odw-lint` export. It does not touch SWC, the body
parser, metadata classification semantics, or regex-literal scanning
(`source-mask-regex.ts` keeps its bespoke character-class state machine, which
is not an escaped-delimited or balanced loop — see the Decision Log).

### How to observe success

1. `make all` passes in the worktree (build, format, lint, typecheck, tests).
2. These existing behaviour suites stay green with no snapshot churn:
   `tests/static-analysis/source-mask.property.test.ts`,
   `source-mask-strings.test.ts`, `source-mask-internals.test.ts`,
   `source-scanner-delimited.test.ts`, `delimited-end-parity.property.test.ts`,
   `workflow-metadata.test.ts`, `invalid-workflow-metadata-parity.test.ts`,
   `invalid-workflow-fixtures.test.ts`, and
   `workflow-metadata-comment-scan.test.ts`.
3. New per-primitive suites prove each consolidated loop directly, and extended
   parity oracles prove the escaped-delimited and balanced walkers behave
   identically to their pre-refactor implementations over generated source.
4. Grepping the two scanner families shows the delimited-region and
   balanced-expression loops defined once each in
   `source-scanner-primitives.ts`, with every former call site importing a thin
   wrapper or the primitive directly (no local `for`/`while` walk over
   delimiters or depth remains in `source-mask-delimiters.ts`,
   `source-mask-strings.ts`, `workflow-metadata-comment-scan.ts`, or
   `workflow-metadata-parser-scan.ts`).

## Constraints

- Work exclusively inside the git worktree at
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-14`. Never edit the
  root/control worktree.
- No emitted diagnostic, mask range, metadata span, or parse-reason may change.
  This is behaviour-preserving.
- `src/static-analysis/source-scanner-primitives.ts` must remain the documented
  scanner seam (`docs/technical-design.md` §6.2,
  `docs/developers-guide.md` primitives bullet). If a new sibling module is
  introduced (see Tolerances), it must be re-exported through the primitives
  module so the seam's import surface is preserved.
- The primitives module must stay free of mask-range, parser-cursor,
  diagnostic, and public-package types (`docs/developers-guide.md`, primitives
  bullet; `docs/technical-design.md` §6.2).
- Every source and test file must stay at or under 400 physical lines
  (`AGENTS.md` "Keep file size manageable"; enforced by
  `tests/static-analysis/source-file-architecture.test.ts:375`).
- The top-level declaration inventory of **each** touched scanner module is
  asserted exactly by `tests/static-analysis/source-file-architecture.test.ts`
  through the `expectModuleDeclarations` helper, which calls
  `expect(topLevelDeclarationNames(path)).toEqual([...expected].sort())`
  (`source-file-architecture.test.ts:148-153`). `topLevelDeclarationNames`
  collects **every** named top-level declaration — exported and module-private
  alike — so the assertion pins the full inventory, not just the exports. Two
  inventories are load-bearing for this task:
  - `source-scanner-primitives.ts` at
    `source-file-architecture.test.ts:176-201` (the existing private
    `SOURCE_LINE_TERMINATORS` const is in that array); WI1 and WI4 **add**
    primitives here.
  - `source-mask-strings.ts` at
    `source-file-architecture.test.ts:241-246`, currently
    `["isEscapedCrLfLineContinuation", "nextEscapedQuotedStringIndex",
    "scanQuotedStringEnd", "scanQuotedStringRange"]`; WI3 **removes** the two
    private helpers `isEscapedCrLfLineContinuation` and
    `nextEscapedQuotedStringIndex`, so it must shrink this expected array to
    exactly `["scanQuotedStringEnd", "scanQuotedStringRange"]` (kept sorted) in
    the same commit.
  Any added or removed top-level declaration — including a private helper
  `const`/`type` — must update the matching expected array (kept sorted) in the
  same commit, or the `test` step of `make all` fails on `toEqual`. Prefer
  inlining small helpers into the primitive body over adding new module-private
  top-level names, to keep the inventory churn minimal.
- Public/consumed scanner symbol names and signatures that are imported outside
  the primitives module (`scanEscapedDelimitedEnd`, `scanQuotedStringEnd`,
  `scanDelimitedEnd`, `scanBalancedEnd`, `scanExpressionEnd`,
  `templateExpressionEnd`) must remain stable — they may become thin wrappers,
  but their names, signatures, and modules must not move, to avoid churn across
  `source-mask-templates.ts`, `workflow-metadata-string-scan.ts`,
  `workflow-metadata-parser.ts`, `workflow-metadata-parser-scan.ts`, and
  `workflow-envelope-meta-value.ts`.
- en-GB Oxford spelling ("-ize"/"-yse"/"-our") in all prose, comments, and
  commit messages.

## Tolerances (exception triggers)

- Scope: if any single work item needs to touch more than 8 source/test files
  (net), stop and escalate.
- File size: if adding the primitives would push
  `source-scanner-primitives.ts` beyond ~380 physical lines, do not exceed the
  400-line gate. Instead extract the region scanners into a new internal
  sibling `src/static-analysis/source-scanner-regions.ts` and re-export the new
  symbols through `source-scanner-primitives.ts` to preserve the documented
  seam. Record the split in the Decision Log. (Baseline: the module is 339
  lines today; folding the four delimited and three balanced loops nets an
  estimated +30 to +55 lines after the nested `stringLikeRegionEnd`/
  `expressionEnd` helpers are removed. This tolerance is expected to be
  approached; treat the sibling-module split as the planned mitigation, not an
  exception, if the line count crosses ~380.)
- Behaviour: if any existing behaviour or parity suite changes result (not just
  fails to compile) after a rewire, stop — the refactor is not
  behaviour-preserving and the divergence must be understood before continuing.
- Interface: if consolidating a loop would require changing a signature that is
  imported outside the primitives module, stop and escalate.
- Iterations: if a rewired scanner's parity suite still fails after 3 attempts,
  stop and escalate.
- Ambiguity: if a delimited or balanced contract cannot be expressed through
  the parametrized primitive without adding a third behavioural boolean beyond
  those specified here, stop and present the option set with trade-offs rather
  than growing the primitive's flag surface.

## Risks

- Risk: `source-scanner-primitives.ts` exceeds the 400-line gate after folding
  seven loops into it.
  Severity: medium
  Likelihood: medium
  Mitigation: the File-size tolerance above pre-authorizes the
  `source-scanner-regions.ts` sibling split with re-export through the seam.
  Measure the line count after WI1 and WI4 before adding more.
- Risk: the parity oracle in
  `tests/static-analysis/delimited-end-parity.property.test.ts` currently pins
  only two of the four delimited contracts (source-mask escaped-delimited and
  metadata delimited). Folding the quoted-string and template contracts could
  drift undetected.
  Severity: medium
  Likelihood: low
  Mitigation: WI3 and WI4 extend the parity oracles with frozen copies of the
  pre-refactor quoted-string and balanced loops before rewiring, so each
  contract has a differential guard.
- Risk: mutual recursion between the delimited primitive and
  `templateExpressionEnd` (delimited → interpolation → balanced → delimited)
  hits a temporal-dead-zone error because module-scope `const` arrow functions
  are not hoisted.
  Severity: low
  Likelihood: low
  Mitigation: all cross-references occur at call time, not definition time, so
  runtime recursion is safe; keep definitions in dependency order and rely on
  the existing `source-scanner-delimited.test.ts` nested-template cases to
  catch a TDZ regression immediately.
- Risk: an exact top-level-declaration architecture assertion fails when a
  primitive or module-private helper is added **or removed** without updating
  the matching expected inventory, since `expectModuleDeclarations` asserts
  `toEqual` over every named top-level declaration, not only exports. This bites
  in two directions here: WI1/WI4 add names to the
  `source-scanner-primitives.ts` inventory (`:176-201`), and WI3 removes the two
  private helpers `isEscapedCrLfLineContinuation` and
  `nextEscapedQuotedStringIndex` from the `source-mask-strings.ts` inventory
  (`:241-246`).
  Severity: low
  Likelihood: medium
  Mitigation: each work item that adds or removes a top-level declaration updates
  the matching expected array in the same commit; this is called out explicitly
  per work item below (WI1, WI3, WI4), and the plan prefers inlining small
  helpers over new module-private names to minimize inventory churn.

## Progress

- [x] WI1 — Introduce the parametrized delimited-region primitive and fold the
  template string-like scanner.
- [x] WI2 — Rewire the source-mask and metadata escaped-delimited scanners onto
  the primitive.
- [x] WI3 — Fold the quoted-string scanner onto the primitive (line-terminator
  and CRLF-continuation contract).
- [x] WI4 — Introduce the balanced-expression primitive and shared inert-region
  step; fold the template balanced core.
- [x] WI5 — Rewire the metadata balanced scanners onto the shared primitives.
- [x] WI6 — Reconcile the design and developer documentation for the
  consolidated seam.

## Surprises & discoveries

- Observation: the balanced loops do not share one contract; `scanExpressionEnd`
  tracks all three delimiter families and trims trailing trivia, whereas
  `expressionEnd` and `scanBalancedEnd` track a single pair and return at the
  matching close.
  Evidence: `src/static-analysis/workflow-metadata-parser-scan.ts:71-130` and
  the nested `expressionEnd` in `source-scanner-primitives.ts:252-276`.
  Impact: shapes the "one primitive plus one shared skip step" design in WI4/WI5
  rather than a single all-cases balanced function; matches the roadmap's "where
  contracts match" wording.
- Observation: the check order for skipping strings versus comments differs
  between the three balanced loops, but is behaviourally irrelevant because a
  string delimiter (`'`, `"`, `` ` ``) can never also open a comment (`/`).
  Evidence: `scanExpressionEnd` checks string-like first
  (`workflow-metadata-parser-scan.ts:76-84`); `scanBalancedEnd` checks comments
  first (`:110-118`).
  Impact: a single `nextInertRegionEnd` step serves all three without changing
  any result.
- Observation: WI1's consolidated delimited primitive needed private predicate
  and skip helpers to satisfy Oxlint's complexity limit, even before the
  balanced primitive lands.
  Evidence: the first two `scrutineer` `make all` runs failed on
  `source-scanner-primitives.ts` complexity, private JSDoc, public JSDoc, and
  then the 400-line architecture guard. Focused tests passed after extracting
  `escapedDelimitedContinuationEnd`, `isTemplateInterpolationStart`,
  `delimitedRegionSkipEnd`, and `delimitedRegionEndIndex`.
  Impact: WI1 kept `source-scanner-primitives.ts` under the hard line limit by
  compacting comments; WI4 should expect to use the pre-authorized
  `source-scanner-regions.ts` split if the balanced primitive would push this
  module back over the guard.
- Observation: CodeRabbit reviewed WI1 only after one mandatory rate-limit
  backoff and returned two documentation-scope findings against this ExecPlan.
  Evidence: the initial `coderabbit review --agent` returned a recoverable
  `rate_limit` error with `waitTime: "6 minutes"`; the required randomized
  `vsleep` backoff selected 64 minutes; retry 1 completed with one `trivial`
  hard-coded-worktree-path finding and one `major` ADR request.
  Impact: both findings were dispositioned in the Decision Log because changing
  the exact assigned worktree path would conflict with the df12-build standing
  rules, and adding an ADR in WI1 would overstate an internal refactor that is
  already governed by the existing technical design seam. WI6 remains
  responsible for updating the design and developer documentation.
- Observation: WI4 needed the pre-authorized sibling split before adding the
  balanced primitive because `source-scanner-primitives.ts` had already reached
  396 physical lines after WI3.
  Evidence: the WI4 split leaves `source-scanner-primitives.ts` at 255 lines and
  the new `source-scanner-regions.ts` at 208 lines, both under the 400-line
  architecture guard.
  Impact: region-level delimited and balanced loops now live in
  `source-scanner-regions.ts` and are re-exported through
  `source-scanner-primitives.ts`, preserving the documented seam while keeping
  both modules reviewable.
- Observation: the first WI4 `make all` run caught the new sibling module in the
  global static-analysis inventory before CodeRabbit ran.
  Evidence: `tests/diagnostics/architecture.test.ts` rejected the unlisted
  `source-scanner-regions.ts`; adding it to
  `tests/diagnostics/architecture-fixtures.ts` made the focused architecture
  tests and the subsequent `scrutineer` `make all` run pass.
  Impact: the architecture inventories now pin the new module in both the
  source-helper and diagnostic fixture suites.
- Observation: the first WI4 CodeRabbit attempt was incomplete, but the retry
  completed with no findings.
  Evidence: the initial attempt exited 130 after `summarizing` with no usable
  output and no rate-limit message; the retry exited 0 with
  `review_completed` and `findings: 0`.
  Impact: no code changes were needed after AI review, and the incomplete
  attempt is counted as a review attempt rather than a deferred issue.
- Observation: WI5's frozen balanced parity test needed a real
  `ParserCursor.file` even though the scanner functions only read text indexes.
  Evidence: `scrutineer` caught a TypeScript failure because `ParserCursor`
  requires `file`; the helper now creates an `OriginalSourceFile` with
  `createOriginalSourceFile`.
  Impact: the property test uses the real parser cursor shape, so future cursor
  contract changes will be visible to the scanner parity suite.
- Observation: WI5 CodeRabbit was rate-limited once and then found one
  test-strength issue on retry.
  Evidence: the first review returned recoverable `rate_limit` with
  `waitTime: "14 minutes"`; the required randomized `vsleep` selected
  87 minutes. The retry completed with one trivial finding asking the balanced
  parity generator to cover backslash escapes.
  Impact: `SOURCE_FRAGMENT` now includes escaped single-quote, double-quote, and
  template-delimiter cases, and the follow-up `make all` run passed.
- Observation: WI6 documentation changes were limited to the scanner seam
  ownership text in `docs/technical-design.md` and `docs/developers-guide.md`.
  Evidence: §6.2 now names delimited-region, balanced-expression, and
  inert-region primitives; the developer guide now documents
  `source-scanner-regions.ts` as an internal sibling re-exported through
  `source-scanner-primitives.ts`.
  Impact: the docs now match the implemented split without adding a new ADR for
  an internal refactor covered by the existing static-analysis boundary.

## Decision log

- Decision: express all four escaped-delimited scanners through one
  `scanDelimitedRegionEnd(text, startIndex, delimiter, options)` primitive with
  exactly two behavioural options — `allowTemplateInterpolation` (backtick `${`
  recursion) and `terminateAtLineTerminator` (unescaped line-terminator stop,
  which also enables escaped-CRLF line-continuation advancement) — plus an
  `endIndex` bound (default `text.length`).
  Rationale: the four loops differ only along these axes. The CRLF-continuation
  `+1` in `scanQuotedStringEnd` is only meaningful when the scanner stops at
  line terminators, so it folds into the same flag rather than needing a third
  option. This keeps the primitive at two behavioural booleans, honouring the
  Ambiguity tolerance and `AGENTS.md` "Clarity over cleverness".
  Date/Author: 2026-07-05, planning agent.
- Decision: keep `scanExpressionEnd` as its own function rather than forcing it
  into `scanBalancedExpressionEnd`.
  Rationale: its terminator-set + trailing-trivia + three-family-depth contract
  genuinely differs from the single-pair "return at matching close" contract.
  The roadmap explicitly scopes the balanced primitive to "where contracts
  match". `scanExpressionEnd` still de-forks by composing the shared
  `nextInertRegionEnd` skip step.
  Date/Author: 2026-07-05, planning agent.
- Decision: leave `source-mask-regex.ts` untouched.
  Rationale: the regex scanner is a character-class state machine
  (`isInCharacterClass`, leading-`]` rules), not an escaped-delimited or
  balanced loop. It is out of scope for "delimited and balanced scanner loops"
  and already consumes the shared character primitives.
  Date/Author: 2026-07-05, planning agent.
- Decision: preserve the wrapper names `scanEscapedDelimitedEnd`,
  `scanQuotedStringEnd`, `scanDelimitedEnd`, `scanBalancedEnd`, and
  `templateExpressionEnd` in their current modules.
  Rationale: they are imported across five other modules and by the parity
  oracle; keeping them as thin adapters over the primitives minimizes blast
  radius and preserves the 2.1.13.5 "wrapper ownership" precedent. The parity
  oracle continues to import them by name, so it keeps proving the unified
  primitive matches each frozen contract.
  Date/Author: 2026-07-05, planning agent.
- Decision: keep the source-mask and metadata wrapper functions as the WI2
  integration points instead of importing `scanDelimitedRegionEnd` at every
  caller.
  Rationale: the wrappers carry scanner-family names and JSDoc contracts that
  existing tests and metadata/source-mask call sites already use. WI2's parity
  oracle stayed green after the wrappers delegated to the primitive, and the
  CodeRabbit review reported zero findings.
  Date/Author: 2026-07-05, implementation agent.
- Decision: keep quoted-string line-terminator semantics inside
  `scanDelimitedRegionEnd` behind `terminateAtLineTerminator`.
  Rationale: the focused source-mask string tests and the new frozen
  quoted-string parity property prove the primitive preserves unescaped
  terminator stops plus escaped CRLF and LF continuations. Removing the local
  quoted-string helpers also shrank the pinned source-mask string inventory to
  the two remaining scanner exports, as planned.
  Date/Author: 2026-07-05, implementation agent.
- Decision: keep the exact assigned worktree path in this ExecPlan's
  Constraints and Concrete Steps.
  Rationale: this plan is not a reusable public guide; it is an executable
  df12-build task document for a git-donkey worktree. The workflow standing
  rules require the exact path
  `/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-14` and forbid edits in
  the root/control worktree, so replacing the path with a generic environment
  variable would remove a safety guard.
  Date/Author: 2026-07-05, implementation agent after CodeRabbit review.
- Decision: do not add an ADR during WI1 for the scanner-boundary ownership
  wording.
  Rationale: WI1 adds an internal primitive and folds one nested helper without
  changing public behaviour, public exports, dependencies, or the documented
  ownership boundary. ADR 0001 already records the static-analysis boundary,
  and `docs/technical-design.md` §6.2 is the source of truth for the scanner
  seam. WI6 updates those docs for the completed consolidation; a new ADR is
  only justified if a later work item changes architecture materially, such as
  introducing a new long-term sibling module boundary beyond the
  pre-authorized file-size mitigation.
  Date/Author: 2026-07-05, implementation agent after CodeRabbit review.
- Decision: split region-level scanner loops into
  `source-scanner-regions.ts` and re-export them from
  `source-scanner-primitives.ts`.
  Rationale: adding the balanced primitive to the 396-line primitives module
  would violate the file-size tolerance and likely the 400-line gate. The split
  keeps low-level character and comment primitives in the original seam module,
  colocates delimited and balanced region walkers, and preserves existing
  imports through the primitives re-export.
  Date/Author: 2026-07-05, implementation agent.
- Decision: keep `scanExpressionEnd`'s terminator and trailing-trivia logic in
  `workflow-metadata-parser-scan.ts`, but share the string/comment skip through
  `nextInertRegionEnd`.
  Rationale: the full expression scanner still has the broader three-family
  delimiter-depth and terminator-set contract recorded during planning. WI5
  removes only the duplicated inert-region walk, while `scanBalancedEnd`
  delegates wholly to `scanBalancedExpressionEnd` because its contract matches
  the primitive.
  Date/Author: 2026-07-05, implementation agent.
- Decision: update the existing design and developer guides instead of adding a
  new ADR for the region-scanner split.
  Rationale: the split is a file-size and ownership refinement inside the
  existing static-analysis boundary. It does not change public behaviour,
  dependencies, CLI surface, or cross-package architecture, and ADR 0001 remains
  the governing boundary decision.
  Date/Author: 2026-07-05, implementation agent.

## Outcomes & retrospective

The delimited and balanced scanner loops now share the intended implementation
surface. `scanDelimitedRegionEnd`, `scanBalancedExpressionEnd`,
`nextInertRegionEnd`, and `templateExpressionEnd` are re-exported through
`source-scanner-primitives.ts`; the region-level loop bodies live in
`source-scanner-regions.ts` after the planned file-size split. The final source
line counts at WI6 were 255 lines for `source-scanner-primitives.ts`, 208 lines
for `source-scanner-regions.ts`, 233 lines for
`workflow-metadata-parser-scan.ts`, and 340 lines for the balanced parity
property test.

Behaviour stayed pinned by the original mask and metadata suites plus the new
focused primitive tests and parity oracles. The split was needed because
`source-scanner-primitives.ts` reached 396 lines before WI4; keeping the
region-level loops in a sibling module preserved the documented seam while
staying below the 400-line architecture guard.

## Addenda

- [ ] 2.1.14.1. Broaden scanner parity generators.
  - Source: review:2.1.14; severity low.
  - Scope: add paragraph separators, exotic whitespace, full delimiter
    interplay, and deeper nested-template fragments to the scanner parity
    generators.
  - Success: the parity properties exercise U+2029, tab, NBSP, form-feed,
    vertical-tab, nested-template, and delimiter-interplay cases across the
    scanner families they guard.
- [ ] 2.1.14.2. Fold template-literal scanning onto shared walkers.
  - Source: audit:2.1.14; severity medium.
  - Scope: make template-literal masking delegate matched delimited, balanced,
    or inert-region walk backbones through the shared region primitives or
    documented wrappers while keeping its regex handling intact.
  - Success: template-literal masking output is unchanged, and the template
    scanner no longer carries a forked brace-depth or inert-region walk where
    the shared region primitive contract matches.
- [ ] 2.1.14.3. Unify scanner regex-start heuristics.
  - Source: audit:2.1.14; severity medium.
  - Scope: share one preceding-token regex-start predicate and allowed-token
    source of truth across top-level and template scanners.
  - Success: top-level and template regex masking use the same reviewed
    regex-start decision, including the disallowed increment and decrement
    token guard, with focused parity or regression coverage.

## Context and orientation

The static-analysis scanners live in `src/static-analysis/`. Two families share
a JavaScript token grammar:

- The **source-mask** family blanks inert regions before envelope scanning. Its
  facade is `source-mask.ts`; token modules are `source-mask-comments.ts`,
  `source-mask-strings.ts`, `source-mask-templates.ts`, `source-mask-regex.ts`,
  and the shared `source-mask-delimiters.ts`.
- The **workflow-metadata** family statically parses the `meta` object literal
  without executing source. Its scanners are `workflow-metadata-parser.ts`,
  `workflow-metadata-parser-scan.ts`, `workflow-metadata-comment-scan.ts`, and
  `workflow-metadata-string-scan.ts`.

Both compose `source-scanner-primitives.ts` (the seam introduced by task
2.1.13). Terms used below:

- **Escaped-delimited region**: text from an opening string-like delimiter to
  its matching close, where a backslash escapes the next unit.
- **Template interpolation**: the `${ … }` code embedded in a template literal;
  scanning it requires a balanced walk because it can contain nested templates,
  strings, comments, and braces.
- **Balanced expression**: a bracketed region scanned by counting nesting depth
  while skipping string-like and comment regions so their brackets do not move
  the depth.
- **Inert region**: a string-like or comment region that a balanced walk skips
  wholesale.
- **Parity oracle**: a frozen, hand-copied pre-refactor implementation kept in a
  test file so a property test can prove the production scanner still matches
  its original behaviour over generated source
  (`tests/static-analysis/delimited-end-parity.property.test.ts`).

Load these skills before touching code: `leta` (symbol navigation and
references — already loaded at session start), `python-router` is **not**
applicable; load the TypeScript-relevant guidance from `AGENTS.md` "TypeScript
Guidance". For the property-test work, no Python verification skills apply; this
project uses `fast-check` (see `AGENTS.md` "Invariant testing").

Design documents to read before implementing: `docs/technical-design.md` §6.2
(static source model and the "must not re-implement the shared UTF-16 grammar
loops" rule), `docs/developers-guide.md` (the `source-scanner-primitives.ts`
bullet near line 596 and the UTF-16 index-space guidance near line 121),
`docs/complexity-antipatterns-and-refactoring-strategies.md` §4.A (parameter
and predicate extraction to avoid the bumpy-road antipattern), and `AGENTS.md`
"Refactoring Heuristics & Workflow" (Duplicated Code; the abstraction/adapter
policy requiring documented scope, ownership, and call sites) and "TypeScript
Guidance" (immutability, small functions, `never` guards, JSDoc).

## Plan of work

Each work item is a single atomic commit that passes `make all`. Work items are
ordered so each rewire lands only after its primitive and its differential guard
exist. Every code change follows Red-Green-Refactor: the new primitives get a
focused failing unit test first; the pure rewires are guarded by the existing
and extended parity/behaviour suites, which act as the differential
red-green harness (the execplans "nearest observable substitute" for a pure
refactor — the suite is green before, the loop is deleted, the suite stays
green).

### WI1 — Parametrized delimited-region primitive; fold the template string-like scanner

Docs to read: `docs/technical-design.md` §6.2; `docs/developers-guide.md`
primitives bullet; `AGENTS.md` "TypeScript Guidance" and "Refactoring
Heuristics". Skills: `leta` (find every caller of `templateExpressionEnd`),
`fast-check` guidance from `AGENTS.md`.

Red: add `tests/static-analysis/source-scanner-delimited-region.test.ts` with
table-driven cases for a new export `scanDelimitedRegionEnd`:

- plain closed delimiter returns index after the close;
- backslash-escaped delimiter is skipped;
- unterminated region returns the scan bound;
- `endIndex` shorter than the text bounds the scan;
- `allowTemplateInterpolation: false` treats backtick `${` as ordinary text;
- `allowTemplateInterpolation: true` skips a backtick `${ … }` region including
  a nested template and a comment holding the close delimiter.

Run `bun test tests/static-analysis/source-scanner-delimited-region.test.ts` and
expect failure because the symbol does not yet exist.

Green: in `src/static-analysis/source-scanner-primitives.ts` add:

```typescript
export type DelimitedRegionOptions = Readonly<{
  readonly endIndex?: number;
  readonly allowTemplateInterpolation?: boolean;
  readonly terminateAtLineTerminator?: boolean;
}>;

export const scanDelimitedRegionEnd = (
  text: string,
  startIndex: number,
  delimiter: string,
  options?: DelimitedRegionOptions,
): number => { /* single escaped-delimited loop */ };
```

The loop iterates from `startIndex + 1` to `options.endIndex ?? text.length`;
on `\` it advances via `indexAfterEscapedUnit` (and, only when
`terminateAtLineTerminator` is set, consumes a following LF after an escaped CR
so an escaped CRLF is one continuation); when `allowTemplateInterpolation` and
the delimiter is a backtick and the text starts `${`, it advances to
`templateExpressionEnd(text, index + 2, end)`; on `terminateAtLineTerminator`
and an unescaped line terminator it returns the current index; on the delimiter
it returns `index + 1`; otherwise it advances one unit. Re-express the nested
`stringLikeRegionEnd` inside `templateExpressionEnd` as a call to
`scanDelimitedRegionEnd(text, startIndex, delimiter, { endIndex: end,
allowTemplateInterpolation: true })`, deleting the duplicate inner loop.

Update the expected declaration array at
`tests/static-analysis/source-file-architecture.test.ts:176` to add
`DelimitedRegionOptions` and `scanDelimitedRegionEnd` — plus any module-private
top-level helper name introduced for the loop — keeping the array sorted. The
assertion lists every top-level declaration, not only exports.

Refactor: keep the primitive small and readable (one guard per branch, no
nested state object). Run `make all`.

Tests this item adds/updates: the new
`source-scanner-delimited-region.test.ts`; the export-inventory assertion in
`source-file-architecture.test.ts`. Guarded by the existing
`source-scanner-delimited.test.ts` (template nested/comment cases) staying
green.

Validation: `make all`.

### WI2 — Rewire the escaped-delimited scanners onto the primitive

Docs/skills as WI1. `leta refs scanEscapedDelimitedEnd` and
`leta refs scanDelimitedEnd` to confirm call sites before editing.

Baseline (red-substitute): confirm `make test` and specifically
`tests/static-analysis/delimited-end-parity.property.test.ts` are green — this
oracle already freezes the source-mask escaped-delimited and metadata delimited
contracts and is the differential harness for this rewire.

Green: replace the loop body of `scanEscapedDelimitedEnd`
(`src/static-analysis/source-mask-delimiters.ts`) with
`scanDelimitedRegionEnd(sourceText, startIndex, delimiter)`; replace the loop
body of `scanDelimitedEnd`
(`src/static-analysis/workflow-metadata-comment-scan.ts`) with
`scanDelimitedRegionEnd(text, startIndex, delimiter, { endIndex,
allowTemplateInterpolation: true })`. Keep both signatures and modules
unchanged; remove the now-unused local imports (`indexAfterEscapedUnit` in
`source-mask-delimiters.ts` only if no longer used elsewhere in that file —
`blankMaskedRange`/`scanEscapedDelimitedEnd` are the only users, so audit with
`leta`).

Refactor: the parity oracle imports these two symbols by name; it now proves the
unified primitive matches both frozen contracts. No oracle change is required in
this item beyond confirming it stays green.

Tests this item touches: none added; `delimited-end-parity.property.test.ts`,
`source-mask.property.test.ts`, `source-mask-internals.test.ts`,
`workflow-metadata-comment-scan.test.ts`, and `workflow-metadata.test.ts` are
the guards.

Validation: `make all`.

### WI3 — Fold the quoted-string scanner onto the primitive

Docs/skills as WI1. Read `tests/static-analysis/source-mask-strings.test.ts`
first — it pins the escaped-delimiter, unterminated, line-terminator-stop,
escaped-CRLF-continuation, and mask-range cases.

Red: extend `source-scanner-delimited-region.test.ts` with
`terminateAtLineTerminator: true` cases before wiring:

- an unescaped LF, CR, U+2028, and U+2029 each terminate at the terminator index
  (not past it);
- an escaped CRLF is consumed as a line continuation (scan continues);
- a lone escaped LF is consumed (scan continues).

Run the file and expect failure until the option is implemented.

Green: implement the `terminateAtLineTerminator` branch in
`scanDelimitedRegionEnd` (the line-terminator stop and the escaped-CRLF `+1`
described in WI1's loop, but only active under this flag). Then replace the loop
body of `scanQuotedStringEnd` (`src/static-analysis/source-mask-strings.ts`)
with `scanDelimitedRegionEnd(sourceText, startIndex, delimiter, {
terminateAtLineTerminator: true })`, deleting the local
`nextEscapedQuotedStringIndex` and `isEscapedCrLfLineContinuation` helpers.

This deletion has two mandatory knock-on edits that must land in **this same
commit**, or the `lint`, `typecheck`, and `test` steps of `make all` fail:

1. **Import surgery in `source-mask-strings.ts` (lines 10-15).** Once the two
   helpers are gone, `indexAfterEscapedUnit`, `isCrLfAt`, and
   `isSourceLineTerminator` are no longer referenced and must be removed from
   the `./source-scanner-primitives` import to satisfy no-unused-imports, and
   `scanDelimitedRegionEnd` must be **added** to that import so the rewired call
   resolves. Keep `isQuotedStringDelimiter` — it is still used by
   `scanQuotedStringRange`. Confirm the final unused set with
   `leta refs indexAfterEscapedUnit` / `isCrLfAt` / `isSourceLineTerminator`
   scoped to this file before deleting. Net import list becomes
   `{ isQuotedStringDelimiter, scanDelimitedRegionEnd }` (kept sorted).
2. **Inventory update in `source-file-architecture.test.ts:241-246`.** The
   `expectModuleDeclarations("src/static-analysis/source-mask-strings.ts", […])`
   assertion pins the full top-level inventory via `toEqual`, including the two
   private helpers being deleted. Shrink the expected array to exactly
   `["scanQuotedStringEnd", "scanQuotedStringRange"]` (kept sorted) in this
   commit, matching the two names WI3 leaves behind.

Confirm `source-mask-strings.test.ts` and the architecture inventory suite stay
green.

Refactor: add a frozen `expectedQuotedStringEnd` oracle and a `fast-check`
property to `delimited-end-parity.property.test.ts` (or, if that file nears the
400-line gate, a new `tests/static-analysis/quoted-string-end-parity.property.
test.ts`) so the quoted-string contract has a differential guard equal in
strength to the other delimited contracts.

Tests this item touches: extends `source-scanner-delimited-region.test.ts`
(line-terminator cases) and the parity oracle; updates the
`source-mask-strings.ts` expected inventory in `source-file-architecture.test.ts`.
Guarded by `source-mask-strings.test.ts` and `source-mask.property.test.ts`
staying green.

Validation: `make all`.

### WI4 — Balanced-expression primitive and shared inert-region step; fold the template balanced core

Docs to read: `docs/complexity-antipatterns-and-refactoring-strategies.md`
§4.A (extracting the shared step); others as WI1. Skills: `leta`, `fast-check`.

Red: add `tests/static-analysis/source-scanner-balanced.test.ts` with
table-driven cases for two new exports:

- `nextInertRegionEnd(text, index, endIndex)` returns the end of a string-like
  region and of a line/block comment, and `undefined` for an ordinary
  character;
- `scanBalancedExpressionEnd(text, startIndex, endIndex, options)` returns the
  index after the matching close for nested braces, ignores braces inside
  strings and comments, returns the bound when unterminated, and supports a
  bracket pair and the `initiallyOpen` entry (depth starts at 1, for `${`).

Run and expect failure.

Green: add to `source-scanner-primitives.ts`:

```typescript
export const nextInertRegionEnd = (
  text: string,
  index: number,
  endIndex: number,
): number | undefined => { /* comment or string-like skip, else undefined */ };

export type BalancedExpressionOptions = Readonly<{
  readonly open: "{" | "[" | "(";
  readonly close: "}" | "]" | ")";
  readonly initiallyOpen?: boolean;
}>;

export const scanBalancedExpressionEnd = (
  text: string,
  startIndex: number,
  endIndex: number,
  options: BalancedExpressionOptions,
): number => { /* single depth loop using nextInertRegionEnd */ };
```

`nextInertRegionEnd` returns `commentDispatchEnd(text, index, endIndex)` when
that is defined, else `scanDelimitedRegionEnd(text, index, character, {
endIndex, allowTemplateInterpolation: true })` when the character is
string-like, else `undefined`. `scanBalancedExpressionEnd` initializes depth to
`1` when `initiallyOpen`, else `0`; skips inert regions via
`nextInertRegionEnd`; increments on `open`, decrements on `close`, and returns
`index + 1` when depth reaches `0` on a close; returns `endIndex` when
unterminated. Re-express the nested `expressionEnd` inside
`templateExpressionEnd` as
`scanBalancedExpressionEnd(text, start, end, { open: "{", close: "}",
initiallyOpen: true })`, so `templateExpressionEnd` becomes a thin wrapper.

Update the expected declaration array at `source-file-architecture.test.ts:176`
to add `BalancedExpressionOptions`, `nextInertRegionEnd`, and
`scanBalancedExpressionEnd` — plus any module-private top-level helper name
introduced — keeping the array sorted (the assertion lists every top-level
declaration, not only exports).

Measure `source-scanner-primitives.ts` line count. If it is above ~380, apply
the File-size tolerance: move the region scanners into
`src/static-analysis/source-scanner-regions.ts` and re-export them from
`source-scanner-primitives.ts`; update the architecture assertions for both
modules and record the split in the Decision Log.

Refactor: confirm `source-scanner-delimited.test.ts` (template nested/comment
cases) stays green — it is the guard for the `templateExpressionEnd` rewrite.

Validation: `make all`.

### WI5 — Rewire the metadata balanced scanners onto the shared primitives

Docs/skills as WI4. `leta refs scanBalancedEnd` and `leta refs
scanExpressionEnd` to confirm the eleven call sites in
`workflow-metadata-parser.ts` are unaffected by the signature-preserving
rewire.

Red-substitute: add a frozen balanced-parity oracle. Create
`tests/static-analysis/balanced-end-parity.property.test.ts` holding frozen
copies of the pre-refactor `scanBalancedEnd` and `scanExpressionEnd` loops and
`fast-check` properties that assert the production functions match the frozen
copies over generated bracketed source (fragments including nested brackets,
strings/comments containing brackets, terminators, and trailing whitespace).
Establish it green against the current implementations first, then perform the
rewire and keep it green.

Green: replace the loop body of `scanBalancedEnd`
(`src/static-analysis/workflow-metadata-parser-scan.ts`) with
`scanBalancedExpressionEnd(cursor.text, cursor.index, cursor.endIndex, { open,
close })`. Rewrite `scanExpressionEnd` in the same file so its loop uses
`nextInertRegionEnd` for the string/comment skip step, keeping its
`nextDelimiterDepthState` depth model, its terminator-set check
(`isExpressionTerminator`), and its `trimTrailingTriviaIndex` call local. Remove
the now-unused direct `scanDelimitedEnd`/`commentDispatchEnd` imports if `leta`
confirms they are no longer referenced in that module.

Refactor: confirm the metadata behaviour suites
(`workflow-metadata.test.ts`, `invalid-workflow-metadata-parity.test.ts`,
`invalid-workflow-fixtures.test.ts`) stay green.

Validation: `make all`.

### WI6 — Reconcile design and developer documentation

Docs to read/update: `docs/technical-design.md` §6.2;
`docs/developers-guide.md` primitives bullet;
`docs/documentation-style-guide.md`. Skills: `en-gb-oxendict` conventions.

Update `docs/technical-design.md` §6.2 so the paragraph listing what the
primitives module owns names the parametrized delimited-region scanner and the
balanced-expression scanner (plus the shared inert-region step), and states
that scanner families compose these rather than re-implementing delimited or
balanced walks.

Update the `source-scanner-primitives.ts` bullet in
`docs/developers-guide.md` to list `scanDelimitedRegionEnd`,
`scanBalancedExpressionEnd`, and `nextInertRegionEnd`, and — per the `AGENTS.md`
abstraction/adapter policy — record the scope and permitted call sites (the two
scanner families and `templateExpressionEnd`) and the "where contracts match"
exception that keeps `scanExpressionEnd` separate. If WI4 created
`source-scanner-regions.ts`, document it as an internal sibling re-exported
through the seam.

Wrap Markdown prose at 80 columns and code blocks at 120 (`AGENTS.md` "Markdown
Guidance"). Format only the changed files:
`mdtablefix docs/technical-design.md docs/developers-guide.md` then
`markdownlint-cli2 --fix docs/technical-design.md docs/developers-guide.md`.

Validation: `make all`, then `make markdownlint` and `make nixie` for the
Markdown changes.

## Concrete steps

Run everything from the worktree root
`/data/leynos/Projects/odw-lint.worktrees/roadmap-2-1-14`.

Baseline before starting:

```bash
make all
```

Expect: build, format check, lint, typecheck, and all Bun tests pass.

Per work item, the focused red command is:

```bash
bun test tests/static-analysis/source-scanner-delimited-region.test.ts   # WI1, WI3
bun test tests/static-analysis/source-scanner-balanced.test.ts           # WI4
bun test tests/static-analysis/balanced-end-parity.property.test.ts      # WI5
```

Expect failure for the not-yet-implemented primitive (WI1/WI3/WI4), then a pass
after the green step. Each work item finishes with:

```bash
make all
```

WI6 additionally runs:

```bash
make markdownlint
make nixie
```

Expect: markdownlint reports no violations for the changed files, and nixie
validates any Mermaid diagrams (none are expected to change).

## Validation and acceptance

Acceptance is behavioural and differential:

- Tests: `make all` passes. The existing masking, metadata, and parity suites
  listed under "How to observe success" pass unchanged. The new
  per-primitive suites (`source-scanner-delimited-region.test.ts`,
  `source-scanner-balanced.test.ts`) and the extended parity oracles
  (quoted-string and balanced) pass. Each new-primitive test fails before its
  green step for the expected "symbol/option not implemented" reason and passes
  after.
- Lint/typecheck: `make lint` and `make typecheck` pass (folded into
  `make all`).
- Markdown (WI6 only): `make markdownlint` and `make nixie` pass.
- Structure: grepping `source-mask-delimiters.ts`, `source-mask-strings.ts`,
  `workflow-metadata-comment-scan.ts`, and `workflow-metadata-parser-scan.ts`
  shows no local `for`/`while` loop walking delimiters or nesting depth; each
  delegates to `scanDelimitedRegionEnd` or `scanBalancedExpressionEnd`
  (`scanExpressionEnd` retains only its terminator/trivia logic around
  `nextInertRegionEnd`).
- The `source-file-architecture.test.ts` export-inventory and 400-line
  assertions pass for `source-scanner-primitives.ts` (and
  `source-scanner-regions.ts` if the split was taken).

Quality method: CI-equivalent `make all` in the worktree after each commit,
plus the differential property tests as the behaviour-preservation proof.

## Idempotence and recovery

Every step is a normal source edit under Git; re-running `make all` is safe and
repeatable. If a rewire turns a parity suite red, revert that single work item's
commit (each is atomic) and re-examine the frozen oracle versus the primitive
before retrying. No destructive or migration steps are involved.

## Artifacts and notes

Key call sites confirmed during planning (for the implementer's orientation):

- `scanEscapedDelimitedEnd`: defined `source-mask-delimiters.ts:55`; consumed by
  `source-mask-templates.ts:148` and the parity oracle.
- `scanDelimitedEnd`: defined `workflow-metadata-comment-scan.ts:19`; consumed
  by `workflow-metadata-string-scan.ts:44,94`,
  `workflow-metadata-parser-scan.ts:77,116`,
  `workflow-envelope-meta-value.ts:189`, and the parity oracle.
- `scanQuotedStringEnd`: defined `source-mask-strings.ts:49`; consumed by
  `scanQuotedStringRange` in the same module and `source-mask-strings.test.ts`.
- `scanBalancedEnd`/`scanExpressionEnd`: defined
  `workflow-metadata-parser-scan.ts:102,71`; consumed across
  `workflow-metadata-parser.ts:140-306`.
- `templateExpressionEnd`: defined `source-scanner-primitives.ts:233`; consumed
  by `workflow-metadata-comment-scan.ts:32` and
  `source-scanner-delimited.test.ts`.

## Interfaces and dependencies

At the end of this plan, `src/static-analysis/source-scanner-primitives.ts`
(or its re-exporting sibling) exports:

```typescript
export type DelimitedRegionOptions = Readonly<{
  readonly endIndex?: number;
  readonly allowTemplateInterpolation?: boolean;
  readonly terminateAtLineTerminator?: boolean;
}>;

export const scanDelimitedRegionEnd: (
  text: string,
  startIndex: number,
  delimiter: string,
  options?: DelimitedRegionOptions,
) => number;

export const nextInertRegionEnd: (
  text: string,
  index: number,
  endIndex: number,
) => number | undefined;

export type BalancedExpressionOptions = Readonly<{
  readonly open: "{" | "[" | "(";
  readonly close: "}" | "]" | ")";
  readonly initiallyOpen?: boolean;
}>;

export const scanBalancedExpressionEnd: (
  text: string,
  startIndex: number,
  endIndex: number,
  options: BalancedExpressionOptions,
) => number;
```

`templateExpressionEnd` keeps its existing signature
`(text: string, start: number, end: number) => number` and becomes a wrapper
over `scanBalancedExpressionEnd`. `scanEscapedDelimitedEnd`,
`scanQuotedStringEnd`, `scanDelimitedEnd`, and `scanBalancedEnd` keep their
existing signatures and modules as thin wrappers. No new runtime dependency is
added; `fast-check` (already a dev dependency per `AGENTS.md` "Invariant
testing") backs the parity properties.

## Revision note

Planning round 2. Resolved both design-review blocking points against WI3, the
quoted-string fold:

1. **`source-mask-strings.ts` inventory maintenance.** WI3 deletes the private
   helpers `nextEscapedQuotedStringIndex` and `isEscapedCrLfLineContinuation`,
   which are pinned by the exact `toEqual` inventory assertion at
   `source-file-architecture.test.ts:241-246`. WI3's Green step now mandates
   shrinking that expected array to exactly
   `["scanQuotedStringEnd", "scanQuotedStringRange"]` (kept sorted) in the same
   commit, and the Constraints and Risks sections now track **both** the
   `source-scanner-primitives.ts` inventory (added-to by WI1/WI4) and the
   `source-mask-strings.ts` inventory (removed-from by WI3), noting the helper
   asserts `toEqual` over all top-level declarations, not just exports.
2. **Unused/missing imports in `source-mask-strings.ts`.** After
   `scanQuotedStringEnd` is rewired to `scanDelimitedRegionEnd`, the imports
   `indexAfterEscapedUnit`, `isCrLfAt`, and `isSourceLineTerminator` become
   unused and the call to `scanDelimitedRegionEnd` is unresolved. WI3's Green
   step now specifies removing those three imports, adding
   `scanDelimitedRegionEnd`, and retaining `isQuotedStringDelimiter` (still used
   by `scanQuotedStringRange`), landing in the same commit so `lint`,
   `typecheck`, and `test` all pass.

Round 1 draft established the six-work-item decomposition,
the two-option delimited-region primitive and the balanced-expression primitive
plus shared inert-region step, the "where contracts match" boundary that keeps
`scanExpressionEnd` separate, the declaration-inventory and 400-line architecture
gates as hard constraints, and the pre-authorized `source-scanner-regions.ts`
sibling split as the file-size mitigation. Refinement over the seed draft:
clarified that `source-file-architecture.test.ts:176` pins **all** top-level
declarations (exported and module-private), so private loop helpers must also be
inventoried; the plan now prefers inlining helpers to keep that array stable.
