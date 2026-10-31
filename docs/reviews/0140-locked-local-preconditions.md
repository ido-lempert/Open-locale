# 0140 - Locked local precondition validation

## Developer pass
Internal helper requires Serializable transaction and exact snapshot scope/key set,
locks existing keys and locale translation rows in deterministic order, validates
key identity/update generation/maxLength/flatness and rowId/version/value/absence.
Key read bounded10001, rejects oversize via expected max10000/exact count. No
mutation, authorization shortcut, public route or production apply caller. Caller
must authorize, validate target/baseline and execute eventual writes in same
transaction with serialization conflict handling. Absent rows are not reserved.

## Product pass
Transaction validation groundwork only, not successful sync or executable plan.
No translation import/removal/key creation, repository write or baseline advance.
No endpoint/UI claims. Coverage22FULL/7PARTIAL/1MISSING unchanged. Atomic apply
and provider acceptance remain open implementation/verification work.

## Designer pass
No UI change or new screenshot. Existing local-change review UI98 checks retained.
README/plan explain transaction helper limitations and no-effects boundary without
exposing an apply control or claiming a reservation.

## Security pass
Helper takes internal server-derived evidence; no HTTP path accepts arbitrary
preconditions. Wrong isolation rejected before locks. Exact key set includes
unchanged keys, immutable translation row identity closes recreated-row ABA,
metadata/plural/absent-row drift rejected. Row locks do not solve absent-row races;
Serializable same-transaction requirement explicit. No credential expansion,
registration, spending or license choice. No authorization claimed by this helper.

## QA/integration pass
Sync157->168 against real PostgreSQL: validates actual snapshot, rejects default
isolation/wrong scope/missing key set/status-only row generation/recreated ABA/
added untranslated key/metadata/new formerly absent translation; held transaction
blocks actual writer until release; failed validation rolls back earlier write.
Direct source helper imported by HTTP fixture, not mocked locks. Existing public
stale-source/no-write checks retained. API248/30,web48/7 unchanged,both builds,
reaper4 RC0.43 integration/config legs in13 completed fail-closed batches all
individual/outerRC0; units/builds/reaper=48 inventory legs. Native visual116+128=
244/two repeated startups/242 unique,every source label covered,both inner/outer
RC0,checkpoint removed. Staged not uninterrupted. TM15442/visual15434 isolated
local test ports. No failures or host interruptions. No active services retained.
