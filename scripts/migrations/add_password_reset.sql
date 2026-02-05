-- Add password reset token columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token_expires TIMESTAMPTZ;
