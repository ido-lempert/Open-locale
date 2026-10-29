# Review 0040 - Grant-change audit log

Slice: member and group grant changes are recorded in the project activity
log (audit trail for the permissions surface built in reviews 0037-0039).

## Developer
- 8 new activity actions (member.added/updated/removed, group.created/
  updated/deleted, group.member.added/removed); every write and its audit
  record commit in one transaction (existing record(tx) pattern).
- Details carry what an auditor needs: target email, role/locale from-to
  on updates, group name + member email on membership changes, final
  state on delete. member.added vs member.updated distinguished on the
  upsert path by reading the prior row first.
- Activity UI: labels for all 8 actions + from/to detail rendering.

## PM
- The activity page now answers "who changed whose access, when, from
  what to what" - the audit-logs capability for grants, filterable by
  action like the rest of the feed.

## Designer
- Reuses the feed's existing label + muted detail pattern; no new visual
  elements. Detail strings kept short (from/to arrows, locale lists).

## Security
- Audit integrity: record and mutation commit or roll back together; the
  actor is the authenticated principal server-side, never client input.
- Details contain team-visible facts only (member emails are already
  visible to every member via the members list); no tokens or secrets.
- Read path unchanged: activity listing requires project membership.

## QA / integration
- groups-test extended to 44 checks: each new event type asserted with
  its detail payload (from/to roles and locales, emails, final state on
  delete) and actor attribution. permissions/activity/docs suites green.
  Full sweep + e2e-visual run separately.
