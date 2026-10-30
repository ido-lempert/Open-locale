-- Plural form storage: per-locale CLDR category map on translations.
-- Nullable; existing rows (all non-plural-valued) are untouched.
ALTER TABLE "translations" ADD COLUMN "pluralForms" jsonb;
