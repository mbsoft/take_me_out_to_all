-- Migration: Add OAuth support
-- Make password_hash nullable for OAuth users (Google SSO)

ALTER TABLE users
ALTER COLUMN password_hash DROP NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN users.password_hash IS 'Password hash for email/password authentication. NULL for OAuth users (Google, etc.)';
