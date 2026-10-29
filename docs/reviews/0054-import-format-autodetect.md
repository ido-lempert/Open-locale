# 0054 — Import format detection from file extension (conflict-preserving)

Editor import can detect the format from the uploaded file's extension. An explicit format choice always wins; a conflict is presented for decision before anything is imported.

Supersedes the override-on-pick behavior first shipped in 2743333, which could silently override an explicit parser choice (flagged in review, corrected here).

## Behavior
- Pure extension mapping (apps/web/src/app/import-format.ts): .json, .csv, .xml (Android strings), .strings, .po, .xlf/.xliff, .properties, .arb, .yaml/.yml. Case-insensitive, basename only. No content sniffing.
- The format select tracks whether the user made a deliberate choice this mount (default JSON on load is not a deliberate choice).
- No deliberate choice: detection applies silently and imports (the pick is the only signal available; import fires immediately on pick with no confirm step).
- Deliberate choice matches detection: imports directly.
- Deliberate choice conflicts with detection: nothing is imported. A banner names the file, the detected format and the current selection, with two explicit buttons - "Import as <detected>" or "Keep <current>". Keeping the explicit choice imports under it even if that fails closed with a parse error; the selection itself is never changed by a file pick.
- Unknown or missing extension: no prompt, the current selection applies.
- Ambiguous extensions (.xml could be XLIFF, .json could be ARB) always take the conflict path when a deliberate choice exists; without one, the documented convention applies (.xml=Android, .json=flat JSON) and a wrong guess fails closed with a named-format parse error.

## Fail-closed gap found by this slice's tests
The conflict matrix exposed that XLIFF and Android imports of XML files without their root element (`<xliff>` / `<resources>`) previously succeeded as silent zero-key imports. Both parsers now reject missing-root documents 400 (covered by unit + formats-test, byte-identical keys after). A valid XLIFF with zero trans-units remains a legitimate empty import.

## Verification
- Web unit 18/18: mapping, null cases (dotfile, trailing dot), basename/case.
- e2e-visual +8: untouched select auto-detects without prompt; explicit JSON + .po conflict (banner, nothing imported, selection kept) then resolved as detected; explicit XLIFF + .xml conflict then "Keep XLIFF" fails closed with error notice and selection kept; explicit ARB + .json conflict then resolved as JSON; unknown .txt extension imports under the explicit PO selection with no prompt.
- Pixel-inspected capture editor-40-import-conflict.png of the conflict banner.
