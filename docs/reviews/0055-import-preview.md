# 0055 — Import dry-run preview

`POST /projects/:id/import/:locale?dryRun=true` returns the counters a real import would produce without writing anything. Editor has a "Preview import" affordance next to the import picker.

## Semantics
- Shares the exact parse dispatch with the write path (parseImport): identical 400 rejections, identical order (parse errors before grant checks), all nine formats.
- Same locale write grant (403 outside the grant), same branch scoping, same locked-key outcome per key, including the assignee/group/ADMIN override mirroring assertKeysEditable.
- Strictly read-only: no snapshot, no ImportRun row, no key/translation writes. Verified byte-identical export + unchanged import-run count after a preview.
- Counts are a point-in-time snapshot: a concurrent change between preview and import shifts them. Lock reads take no advisory lock, unlike the write path.
- Status vocabulary mirrors the write path (COMPLETED/PARTIAL/FAILED) plus dryRun: true.
- UI notice is unmistakable: "Preview only - nothing imported: would create N keys, update M translations, K unchanged (FMT, locale)."

## Outcome safeguards (review follow-up)
- The preview response carries a `failures` list (up to 5) naming each failed key and its reason (locking task title, or the non-string rejection); the UI notice prints the count and reasons, not just successes.
- Mode safety: dry-run is never a persisted mode - it lives only in the pick handler and an open conflict object. Any new file pick (either input) clears an open conflict banner and stale notices before acting, so a preview conflict can never leak into a later real import or vice versa. Verified both directions through the UI.
- The conflict banner has a Cancel button: closes with no import and no residue.
- In a preview conflict BOTH non-cancel buttons name the read-only action ("Preview as <detected>" / "Preview as <current>"); "Keep <current>" only appears for real imports.
- Preview conflict banner verified at 480px: three buttons fit (bounding-box assertion + inspected capture editor-43-preview-480.png).

## Latent bug this slice exposed and fixed
Import counters used `createdAt === updatedAt` on the upserted key to decide whether it was created. The two timestamps are generated per row and can differ by a millisecond, so a never-updated existing key was misclassified as created at random; reimports overcounted keysCreated. The preview-vs-real equality check caught it (preview 1 vs real 2). Fixed with an atomic INSERT ... ON CONFLICT DO NOTHING ... RETURNING: the inserting statement itself reports whether it created the row, then the lock guard and translation write proceed in the same per-key transaction as before.
