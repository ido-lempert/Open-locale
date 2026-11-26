# Report/QA harness exact named script binding

## Developer
Port preflight now binds the package label to its convention-named script,
not only supported command syntax and PG_PORT override. Both plain and reaped
commands remain accepted. All16 current entries follow the explicit naming
contract. Future aliases require deliberate validator/test review.

## Product
Closes758 stated limitation: same-port script alias could exercise the wrong
flow under a valid label. This is harness identity, not application acceptance.
Fast check compares the exact16 PASS labels rather than only their count.

## Designer
No UI/copy/layout changes; no screenshot or changed-pixels claim.

## Security
Rejects command alias to a different script even if its PG override matches.
Does not authenticate arbitrary source contents or parse JavaScript. Existing
narrow syntax contract and argv execution retained. No provider, spend,
worker, license, share or credential-scope change.

## QA/integration
Fast preflight10 checks pass first try, including exact16 current entries.
Real package command mutation aliases refresh to download sharing the same
port variable: rejected before any PASS/startup. Mutation removed, restored
10/0. Actual occupied-port branch/project download subset6 checks pass.
Docs4 checks138routes, script syntax/diff pass. No complete16-case startup,
app build/unit/full-web/backend/product browser/native/sync/provider claim.
Coverage22FULL/7PARTIAL/1MISSING, defaultOFF and external acceptance unchanged.
Five review perspectives complete before commit, no scoped findings remain.
