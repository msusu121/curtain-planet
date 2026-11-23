BEGIN;
-- One shop aggregate is deliberately locked for every business transaction.
-- This gives cross-process atomicity without a distributed in-memory mutex.
CREATE TABLE "BusinessSnapshot" (
  "id" integer PRIMARY KEY CHECK ("id" = 1),
  "state" jsonb NOT NULL,
  "revision" bigint NOT NULL DEFAULT 0,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "BusinessRequest" (
  "actorId" uuid NOT NULL REFERENCES "User"("id"),
  "key" varchar(128) NOT NULL,
  "fingerprint" char(64) NOT NULL,
  "result" jsonb NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("actorId", "key")
);
CREATE TRIGGER business_requests_no_mutation BEFORE UPDATE OR DELETE ON "BusinessRequest"
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

COMMIT;

