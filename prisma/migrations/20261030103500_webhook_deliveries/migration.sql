-- Webhook deliveries: per-attempt delivery journal with bounded retention.
CREATE TABLE "webhook_deliveries" (
  "id" UUID NOT NULL,
  "webhookId" UUID NOT NULL,
  "event" TEXT NOT NULL,
  "httpStatus" INTEGER,
  "success" BOOLEAN NOT NULL,
  "attempts" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhook_deliveries_webhookId_createdAt_idx" ON "webhook_deliveries" ("webhookId", "createdAt");

ALTER TABLE "webhook_deliveries"
  ADD CONSTRAINT "webhook_deliveries_webhook_fkey" FOREIGN KEY ("webhookId") REFERENCES "webhooks" ("id") ON DELETE CASCADE;
