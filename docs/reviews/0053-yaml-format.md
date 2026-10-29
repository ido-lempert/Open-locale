# 0053 — YAML format (Rails-style subset)

Ninth import/export format. Ships a deliberately small, fail-closed YAML subset rather than a general YAML parser.

## Supported subset (import)
- Nested block maps, flattened to dot-separated keys (`a.b.c`).
- Plain, single-quoted and double-quoted scalars. Double-quoted supports standard escapes (`\n`, `\t`, `\"`, `\\`, `\uXXXX`); single-quoted escapes `''` → `'`.
- Comments (`#` outside quotes) and blank lines.
- Every leaf is stored as a literal string — no YAML type resolution. `yes`, `1.5`, `2024-01-01` are stored exactly as typed, never coerced.

## Locale root (Rails convention)
- Export wraps the whole document in the target locale root (`he:\n  "yaml": ...`), so the file drops into `config/locales/`.
- On import, a single top-level map equal to the target locale is stripped (`en:\n  hello:` imported to `en` stores key `hello`, not `en.hello`). This only applies when the wrapper is the ONLY top-level entry: a top-level leaf alongside it, or a quoted literal dotted key like `"en.foo"`, keeps every key literally.
- A single top-level map that is a different locale-shaped code (`fr:` imported to `en`) is rejected 400: wrong file for the target, never silently re-rooted.

## Explicitly rejected (400, whole request, keys byte-identical after)
- Document markers (`---`, `...`), lists (`- item`), flow collections (`[a]`, `{a: b}`), anchors/aliases/tags (`&x`, `*x`, `!x`), block scalars (`|`, `>`), tabs in indentation, duplicate flattened keys, bare null leaves (`key:` with no value), bad escapes.

## Export
- Always emits double-quoted keys and values (escapes non-ASCII and control chars as `\uXXXX` except common whitespace escapes), keys sorted lexicographically.
- Nested maps by default; falls back to a flat `a.b: value` map when one key is a dot-prefix of another (a shape that cannot nest). Both shapes are verified to reimport to byte-identical keys, including through the locale root.

## Boundaries verified
Branch scoping, member locale grants (403 outside grant, import inside, export unfiltered), locked-key skip (failed=1, unlocked keys still import) — all through the transport suite. UI picker option, import and export click-through covered by e2e-visual with pixel-inspected capture.
