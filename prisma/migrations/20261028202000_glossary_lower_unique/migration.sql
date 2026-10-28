-- Case-insensitive per-project uniqueness for glossary terms.
-- The service checks before insert for a friendly 409; this index closes the race.
DROP INDEX IF EXISTS "glossary_terms_project_term_key";
CREATE UNIQUE INDEX "glossary_terms_project_lower_term_key" ON "glossary_terms" ("projectId", lower("term"));
