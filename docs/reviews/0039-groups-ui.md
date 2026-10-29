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
- Group header controls wrap to separate rows (flex-wrap) and the role
  select has min-width 8rem: at 480px it renders the full word, no
  truncation. An earlier version truncated to "men" at 480px - reviewer
  rejected, fixed.
- Desktop (1280) and narrow (480) screenshots captured and pixel-inspected:
  heading fully visible, form wraps, no horizontal overflow; group rows
  show name, role badge, locale scope, role select, delete; member chips
  have remove buttons; the add-member dropdown excludes current members.
- Member (low-role) session: groups list is visible but every mutation
  control is absent (create form, role select, delete, add/remove member) -
  captured in editor-24c-groups-member-view.png.

## Security
- UI only surfaces what the API enforces: rank rules, cross-team 404s and
  token discipline are server-side (34/34 API checks). The effective-grant
  annotation is display-only; the server recomputes per request. The
  delete confirm states members keep direct access.
- Copy makes the union rule explicit so an admin is not surprised that a
  restrictive group cannot shrink a direct grant (documented behavior,
  not a silent widen).

## QA / integration
- e2e-visual extended with 17 groups-UI checks: copy lines x3, create via
  UI + listed, narrow viewport fit (an earlier check version had an
  operator-precedence bug, fixed and rerun), member add/remove via UI,
  promote/demote with the inherited Members annotation updating live,
  cancel-then-confirm delete (native dialog both ways), duplicate-name
  failure showing a visible error with no state change, and a member
  session verifying the read-only view. A wait-for-chip race (dropdown
  option text matched the member name before the add landed) was caught
  by a failing check and fixed to wait for the remove button.
  92 PASS / 0 FAIL, rc=0. unit-web rc=0, build-web rc=0. Full sweep at
  final tree separately.
