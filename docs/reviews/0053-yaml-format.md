# 0053 — YAML format (Rails-style subset)

Ninth import/export format. Ships a deliberately small, fail-closed YAML subset rather than a general YAML parser.

## Supported subset (import)
- Nested block maps, flattened to dot-separated keys (`a.b.c`).
- Plain, single-quoted and double-quoted scalars. Double-quoted supports standard escapes (`\n`, `\t`, `\"`, `\\`, `\uXXXX`); single-quoted escapes `''` → `'`.
- Comments (`#` outside quotes) and blank lines.
- Every leaf is stored as a literal string — no YAML type resolution. `yes`, `1.5`, `2024-01-01` are stored exactly as typed, never coerced.

## Explicitly rejected (400, whole request, keys byte-identical after)
- Document markers (`---`, `...`), lists (`- item`), flow collections (`[a]`, `{a: b}`), anchors/aliases/tags (`&x`, `*x`, `!x`), block scalars (`|`, `>`), tabs in indentation, duplicate flattened keys, bare null leaves (`key:` with no value), bad escapes.

## Export
- Always emits double-quoted keys and values (escapes non-ASCII and control chars as `\uXXXX` except common whitespace escapes), keys sorted lexicographically.
- Nested maps by default; falls back to a flat `a.b: value` map when one key is a dot-prefix of another (a shape that cannot round-trip as nested).

## Boundaries verified
Branch scoping, member locale grants (403 outside grant, import inside, export unfiltered), locked-key skip (failed=1, unlocked keys still import) — all through the transport suite. UI picker option, import and export click-through covered by e2e-visual with pixel-inspected capture.
