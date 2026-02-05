-- Add email verification columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ;

-- Backfill: mark all existing users as verified (both OAuth and password)
UPDATE users SET email_verified = true;

-- Index for token lookup during verification
CREATE INDEX IF NOT EXISTS idx_users_verification_token
  ON users(verification_token) WHERE verification_token IS NOT NULL;
