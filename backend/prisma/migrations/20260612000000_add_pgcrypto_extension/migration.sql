-- Enable pgcrypto extension for UUID generation
-- Required for @default(dbgenerated("gen_random_uuid()))
CREATE EXTENSION IF NOT EXISTS pgcrypto;
