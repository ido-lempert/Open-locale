ALTER TABLE "translations" ADD COLUMN "rowId" UUID NOT NULL DEFAULT gen_random_uuid();
