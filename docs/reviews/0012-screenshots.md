# Review 0012 - Screenshots on keys

Scope: Screenshot model (migration 20261028174000, binary payloads in Postgres),
upload/list/download/delete endpoints, editor "shots" panel with thumbnails,
upload and delete, count badge. Security constraints from review feedback:
image-only with verified contents, no SVG, bounded size, authz on every path.

## Pass 1 - Developer
- 2 MB cap enforced twice: multer limit (413) and service check (400). Declared
  Content-Type alone is never trusted: magic bytes must match the declared type
  (PNG/JPEG/GIF headers, RIFF+WEBP for WebP) and declared size must equal the
  actual buffer length.
- Filenames are basename-stripped and length-capped; Content-Disposition on
  download sanitizes anything left. Binary served with X-Content-Type-Options:
  nosniff and private cache.
- Upload/delete audit rows commit in the same transaction as the data change.

## Pass 2 - Product manager
- Screenshots answer "what does this string look like in the app" - the single
  biggest translation-quality lever. One click on "shots", drag in an image.
- Deferred and recorded: object storage (S3/GCS) for scale, screenshot linking
  to multiple keys, OCR-based key suggestions (Phase 2).

## Pass 3 - Designer
- Thumbnails at 160px with filename and uploader, wrapping row layout.
  Screenshot editor-15 inspected: image renders, count badge updates, upload
  control states allowed types and the size cap. Panel matches the comments
  pattern. Delete is a per-item control with an accessible label.

## Pass 4 - Security researcher
- SVG rejected outright (script-capable); HTML-as-image rejected by magic-byte
  check (proven: script bytes declared as image/png get 400).
- Cross-team list/download/upload/delete all 404 (proven). Read-only API token
  upload denied 403 (proven). Authenticated download via Bearer header; the web
  app fetches blobs with credentials and renders object URLs - no token in URLs.
- Upload, delete and download write nothing user-controlled into HTML.

## Pass 5 - QA / integration
- screenshots-test.mjs (real PostgreSQL + HTTP): 15/15 - PNG + GIF upload,
  metadata-only list, byte-exact download with safe headers, SVG 400, fake-PNG
  400, >2MB rejected, missing file 400, read-only token 403, cross-team 404
  on all three verbs, delete + gone + binary 404, activity events recorded.
- e2e-visual.mjs 28/28: real file upload through the UI, thumbnail rendered,
  count badge updates. Screenshot inspected and secret-scanned.
- Full regression: activity 24/24, imports 15/15, comments 18/18, tags 9/9,
  statuses 14/14, authz 28/28, integration 7/7, unit 5+5, builds green.

All findings fixed or recorded with their phase. Clean rerun achieved.
