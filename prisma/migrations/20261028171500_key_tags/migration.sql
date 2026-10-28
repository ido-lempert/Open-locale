-- Key tags for filtering
ALTER TABLE "keys" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';
