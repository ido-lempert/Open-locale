-- Existing keys retain data and start at revision one. Every update, including
-- raw SQL or an explicit attempted revision overwrite, advances from OLD.
-- INTEGER overflow fails the update closed; it never wraps or reuses a revision.
ALTER TABLE "keys" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
CREATE FUNCTION open_locale_key_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."revision" := OLD."revision" + 1;
  RETURN NEW;
END;
$$;
CREATE TRIGGER keys_revision_before_update BEFORE UPDATE ON "keys"
FOR EACH ROW EXECUTE FUNCTION open_locale_key_revision();
