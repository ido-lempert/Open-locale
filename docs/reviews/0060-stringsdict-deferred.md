# 0060 - stringsdict: deferred, plural model gap preserved

PLAN Phase 1 names iOS strings/stringsdict among the interchange formats.
`.strings` is implemented; `.stringsdict` is deliberately NOT, and this note
records why so the gap is visible instead of implied away.

A stringsdict file exists only to carry plural rules: every entry maps a key
to per-category variants (zero/one/two/few/many/other) per locale. The
Open-locale data model is flat key -> value per locale; it has no plural
category dimension. The only flat projections available would be lossy in
meaning, not just metadata: importing one category (say "other") and dropping
the rest would silently discard translations, and expanding categories into
suffixed keys (key.one, key.other) would invent a modeling convention that
then cannot roundtrip or merge with real plural-aware tooling.

Per the project rule that lossy format behavior must never imply broader
support, the plural-model gap is preserved: no stringsdict import/export is
offered until keys carry plural variants in the schema. When plural-aware key
metadata lands, stringsdict becomes implementable without loss.
