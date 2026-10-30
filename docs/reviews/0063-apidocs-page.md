# 0063 - Rendered API reference (GET /api/docs)

The OpenAPI spec (GET /api/openapi.json) gains a human-facing rendering:
GET /api/docs serves a zero-dependency HTML page (inline CSS/JS, no CDN, no
external assets) that fetches the same openapi.json and renders every
operation grouped by tag with method, path, summary and a "public" marker
for unauthenticated operations.

- Public like the spec itself: it carries no user data.
- Spec data is injected via textContent only, never innerHTML: spec strings
  cannot inject markup.
- The page is a docs surface, not a JSON API operation, so it joins GET /api
  in the docs-consistency "internal" set (implemented but intentionally not
  in the spec) rather than forcing an HTML page into the OpenAPI document.
- e2e-visual verifies the rendered operation count equals the spec's
  operation count (no stale or partial rendering) and captures a screenshot.
