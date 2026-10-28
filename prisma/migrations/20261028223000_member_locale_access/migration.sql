-- AlterTable
ALTER TABLE "team_members" ADD COLUMN "allowedLocales" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
