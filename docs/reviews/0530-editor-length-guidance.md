# Loaded key length advisory

## Developer review
Use existing loaded Key.maxLength only when positive safe integer. No new reads,
state, API or schema. Base-value and displayed plural forms use current local
string.length (UTF-16 code units), matching QA length unit, not its complete
semantics. Absent/null/invalid limits omit advisory. Text is never truncated or
save/review blocked. Existing dirty/pending/inert/generation boundaries unchanged.

## Product review
Translator sees loaded limit and current local counts before save or QA. Explicit
not-fresh-QA/not-save confirmation and advisory-only wording. Not visual glyph or
byte count, complete QA result, all hidden plural categories or accepted server
state. Newer unread metadata stays unread until explicit current read. Fixture
reload discards checked local draft, not a product safe-reload feature.

## Design review
Initial focused10/0 but pixel inspection caught plural input squeezed by guidance
inside flex label. Scoped wrap/full-row advisory app fix restores usable fields;
fixed11/0, extended final12/0 includes separate desktop/mobile input-width checks.
Desktop390px pixels inspected readable counts/full-width plural inputs/nooverflow.
First mobile capture top input occluded by sticky header; fixture offset adjusted,
final pixels show input and guidance. Advisory naturally adds row height.

## Security review
Numbers and fixed text only, loaded metadata/current local values; no innerHTML,
extra private retrieval, upload/share/worker/account/credential/spend/license
change. Markup remains ordinary input text. No policy enforcement claims or
inferred refresh. Failed superseding read preserves advisory inside inert grid.

## QA/integration review
Ten new unit cases:9 invalid/absent limit forms plus exact positive/local raw
text+plural preservation. First9PASS1FAIL was incorrect unit expected count9;
actual JS length8 confirmed, fixture corrected only, fixed10/0. Initial build
web actual/APIcached0 before layout fix. Focusedfirst10/0, oldapp0PASS2FAIL missing
advisory/nulltext abortRC1, restored/fixed11/0, extendedfinal12/0. Real PG positive
limit3, null sibling, emoji/combining/markup8localunits, plural4units, zeroAPI from
local edits, newerunreadlimit100 remains3, explicitcurrentread updates saved2/100,
failed superseding branch retainsinert, currentnull removesbase/plural, no writes
or runtime errors. Separate desktop/mobileinput>=100px and documentnooverflow.
No complete-QA, hiddenplural, save-blocking or fresh-limit claim. Broad checks,
final docs/push remain.
Coverage22FULL7PARTIAL1MISSING/defaultOFF/externalacceptancegaps unchanged.

## Broad verification checkpoint (uncommitted)
Final web1573tests/154suitesactual, API265/31cached; webbuildactual/APIcachedRC0.
APIa/b/c/d/syncpreview644/automations132/2fa37/saml55 allfirstRC0/positivePASS/zeroFAIL.
Syncstaged95+144=239first0. Native116+111+19=246total242unique/fourstartuprepeats,
allfirst0, not an uninterrupted run claim. Config16/14,docs4,harness3,reaper4 all0.
One shell invocation initially called nonexistent run-reaped-test.py (RC2), then
actual reaped-runner-test.py4/0. Read attempt nonexistent automations-browser-test
found no such suite, no test claim from it; prior extra prebuilt automation leg
is the same132-checkAPI file, not12 browser checks. Current original132 run passed.
Stable156browserlist /tmp/browser464-list:001-020 allfirstRC0/positivePASS/zeroFAIL.
No executable/source changes during broad checks. Remaining021-156/finaldocs/
source authority/live repo/commitpush checks; no completed-sweep claim yet.
Browser checkpoint continued021-090 allfirstRC0/positivePASS/zeroFAIL. No source
changes during sweep; next091, preserve001-090 and earlier broad checks.

Final isolated156browser suites allfirstRC0/positivePASS/zeroFAIL,1719PASS.
Final156lengthguidance12/0 regenerated pixels, inspected for desktop/mobile
usable inputs/advisory wrapping. No executable changes during sweep. Fullstage
checks above preserved; finaldocs/authority/repo/pushverification remain.
Finaldocs4/0 and diffcheck0. Original authenticated owner request/re-focus and
live todo recovered before publication. Exact named public repo/defaultmain/
pushright/currentremotebase verified. No new account/worker/scope/spend/license.
