-- Review workflow: project-defined custom statuses.
-- Translation status becomes free text validated in the API against the base
-- statuses plus the project's custom list.
ALTER TABLE "projects" ADD COLUMN "customStatuses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "translations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "translations" ALTER COLUMN "status" TYPE TEXT;
ALTER TABLE "translations" ALTER COLUMN "status" SET DEFAULT 'UNVERIFIED';
ALTER TABLE "translation_history" ALTER COLUMN "status" TYPE TEXT;
DROP TYPE "TranslationStatus";
