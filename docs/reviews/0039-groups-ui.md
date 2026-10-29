# Review 0039 - Groups management UI

Slice: settings-page Groups panel (list/create/edit role/delete groups,
add/remove members) plus an effective-grant annotation on the Members
panel. Follows review 0038 (groups API).

## Developer
- ApiService: GroupInfo + 6 group methods; SettingsComponent: groups
  signals, CRUD methods, and effectiveNote() mirroring the server's union
  rule (strongest role wins, locale-list union, empty list unrestricted).
- Panel reuses existing .panel/.inline/.locale-list patterns and the
  settings reload flow; no new dependencies.

## PM
- The panel explains the model in place: groups are team-wide grant
  templates, everyone sees all groups (no per-project hiding), effective
  access is the union of direct + group grants, a restrictive group never
  reduces an unrestricted direct grant, and role changes apply immediately.
- Inherited grants are visible: members with group-derived access show an
  "effective:" annotation (role or widened locales) next to their direct
  grant, so a group promote/demote visibly changes the Members list.

## Designer
- Desktop (1280) and narrow (480) screenshots captured and pixel-inspected:
  heading fully visible, form wraps, no horizontal overflow; group rows
  show name, role badge, locale scope, role select, delete; member chips
  have remove buttons; the add-member dropdown excludes current members.
- Native select truncation ("men") at 480px matches the app's other narrow
  selects; accepted.

## Security
- UI only surfaces what the API enforces: rank rules, cross-team 404s and
  token discipline are server-side (34/34 API checks). The effective-grant
  annotation is display-only; the server recomputes per request. The
  delete confirm states members keep direct access.
- Copy makes the union rule explicit so an admin is not surprised that a
  restrictive group cannot shrink a direct grant (documented behavior,
  not a silent widen).

## QA / integration
- e2e-visual extended with 5 groups-UI checks (copy lines x3, create via
  UI + listed, narrow viewport fit with corrected measurement - an earlier
  version of the check had an operator-precedence bug, fixed and rerun):
  80 PASS / 0 FAIL, rc=0. unit-web rc=0, build-web rc=0. Full sweep at
  final tree separately.
