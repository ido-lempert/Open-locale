# OTA exact prototype-named key preservation

## Developer
Real API accepts __proto__, constructor, toString, hasOwnProperty and dotted
constructor.prototype.label as flat keys. Prior publish silently omitted
__proto__. Null-prototype dictionaries alone still lost it at Prisma JSON
argument serialization, confirmed by direct PostgreSQL payload diagnostic.
Use null-prototype maps and bind JSON.stringify(payload) as text cast to
jsonb in the existing transaction. Initial empty ORM payload is never visible
outside the transaction. Local row payload matches committed JSON for counts.
No schema change, no key-name ban, no nested-key interpretation.

## Product
Preserve every valid stored key in latest and retained pinned OTA bundles.
Stored list metadata includes every translation. Source edits do not change
retained prototype-named value. Previously published incomplete bundles are
immutable and not repaired; republish to include previously omitted keys.

## Designer
Backend-only data correction, no UI/layout changes or screenshot claim.

## Security
Parameterized tagged SQL binds JSON text and generated row UUID, with no
string interpolation into SQL syntax. Transaction rolls back on write failure.
Prototype-free maps prevent inherited behavior; names remain literal data.
No external attack or global prototype pollution claim. Existing authorization,
locks, retention, digest and pin validation preserved. No worker/provider,
license, spending, sharing or credential-scope changes.

## QA/integration
Baseline real PostgreSQL/HTTP regression failed exactly3 targeted assertions:
publication count, latest flat keys and pinned flat keys. Null-map-only attempt
still failed those3, full correction passes. Final62 checks =54 prior+8 new,
including exact bytes/digests, persisted metadata and immutability. API build,
syntax/diff/docs checks pass. No web/browser/native/provider rerun claim.
Latest whole-web772315suites3863tests; coverage22FULL/7PARTIAL/1MISSING and
external acceptance gaps unchanged. Temporary diagnostic removed. All five
review perspectives complete before commit; no scoped findings remain.
