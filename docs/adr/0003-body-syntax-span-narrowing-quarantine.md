# 0003. Body-syntax span-narrowing quarantine

Status: Accepted
Date: 2026-07-05

## Context

`odw-lint` reports malformed workflow bodies with the `odw/body-syntax`
diagnostic. Roadmap task 2.2.6 added an internal span-mapping seam in
`src/static-analysis/workflow-body-parser-spans.ts` so a parser error carrying
a structured, machine-readable byte range could narrow that diagnostic from
the whole workflow body to the offending token.

The shipped parser path uses `@swc/core@^1.15.43` with
`syntax: "ecmascript"` and `jsx: false`. The characterization test
`tests/static-analysis/swc-parse-error-surface.test.ts` pins that SWC throws an
`Error` whose useful location data is rendered prose in `message`; it does not
expose an allow-listed structured numeric offset or range that `odw-lint` can
map back to original source. The range extractor also pins this with
`tests/static-analysis/workflow-body-parser-ranges.test.ts`.

Recovering token offsets from rendered diagnostic prose would make the checker
depend on display text that is not a stable parser contract. Wiring a real
structured channel would require an `@swc/core` upgrade, a different parser, or
another dependency decision. Those options are out of scope for the current
body-syntax reconciliation and must be considered deliberately.

## Decision

The body-syntax span-narrowing seam is quarantined as an intentionally deferred
internal fallback.

For the parser `odw-lint` currently ships, `odw/body-syntax` diagnostics span
the whole normalized workflow body while still pointing into original source.
`workflow-body-parser-spans.ts` remains wired into production parsing because
it owns the fallback path and the coordinate-base guards a future structured
channel needs. The seam remains internal and must not be exported from the
public package entry points.

Re-activating token-level narrowing is a future design decision. It is gated
on a parser surface that exposes stable, base-resolvable structured offsets or
ranges without parsing rendered diagnostic prose.

## Consequences

- User-facing documentation must describe the shipped whole-body
  `odw/body-syntax` span. It must not promise token-level narrowing while the
  shipped parser exposes no structured range.
- The span-narrowing helpers remain characterization-tested against both real
  SWC errors and synthetic structured errors. Real SWC errors continue to fall
  back to the whole-body span.
- The developers guide's SWC upgrade checklist must re-observe the parser
  error surface before accepting an upgrade. If SWC starts exposing a stable
  structured range, this ADR should be revisited before changing user-visible
  span behaviour.
- The span helpers remain absent from the public export surface.

## Rejected alternatives

- Wire a structured-offset parser channel now. That would require a parser
  dependency change or an `@swc/core` upgrade before the project has evidence
  that the new channel is stable, base-resolvable, and aligned with the
  static-analysis boundary.
- Parse rendered SWC diagnostic prose. Rendered messages are for humans, not a
  machine-readable contract; depending on them would make offsets fragile
  across parser versions, locales, and formatting changes.
- Delete the span-narrowing seam. The seam already owns the conservative
  fallback and the coordinate-base validation that a future structured channel
  would need. Removing it would lose tested behaviour without improving the
  shipped diagnostic contract.
