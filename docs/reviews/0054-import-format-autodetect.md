# 0054 — Import format auto-detection from file extension

Editor import picks the format from the uploaded file's extension instead of requiring the format select to be set first.

## Behavior
- Pure extension mapping (apps/web/src/app/import-format.ts): .json, .csv, .xml (Android strings), .strings, .po, .xlf/.xliff, .properties, .arb, .yaml/.yml.
- Detection fires on every file pick and overrides the current select value. This is the only workable point: the import fires immediately on file selection, there is no separate confirm step. The pick is the most recent user action, and importing under a stale explicit format would only produce a parse error.
- Unknown or missing extension: the user's explicit selection stands. No content sniffing anywhere (deterministic, no false positives on renamed files).
- Case-insensitive, basename only (directory segments never matter).
- Convention choices, stated: .xml is Android strings XML (XLIFF is .xlf/.xliff); .json is the flat/nested JSON format (Flutter ARB is .arb).

## Verification
- Web unit: 3 spec cases (full mapping, null cases incl. dotfiles and trailing dot, basename/case handling).
- e2e-visual +2: explicit JSON selection overridden by a .po upload (notice + select value), prior PO selection overridden by a .yml upload (notice + select value + key in grid).
