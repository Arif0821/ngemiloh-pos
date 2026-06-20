-- CreateIpLockout migration
CREATE TABLE "IpLockout" (
    "ip_address" VARCHAR(50) PRIMARY KEY,
    "failed_count" SMALLINT NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for updated_at
CREATE INDEX "IpLockout_updated_at_idx" ON "IpLockout"("updated_at");
