# 0067 - Browser/server ICU mismatch: plural form merge on save

Correction to 0066's "sends every category the locale supports": that rule
would erase a stored category when the browser's ICU build is older than the
server's (e.g. server stored "many", browser knows only one/other and would
send just those two). The editor now sends mergeFormsForSave(saved, edited,
browserCategories):

- stored categories the browser does not know pass through untouched;
- browser-known categories carry the edited text ('' when untouched, so an
  intentional clear is written and "other" is always present);
- a category the BROWSER knows but the server's ICU rejects fails the save
  visibly (400 with the reason in the cell), never a silent drop.

The merge is a pure function in apps/web/src/app/plural-forms.ts with unit
tests covering preservation, fill, edit and clear. Verified behavior:
same-ICU round trip via e2e-visual (en one/other typed, saved, reloaded);
mismatch preservation via unit tests. Mobile browsers are not separately
verified; the merge rule is what keeps a narrower mobile ICU from erasing
server-side categories.
