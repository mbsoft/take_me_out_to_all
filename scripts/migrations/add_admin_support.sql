-- Admin support: role, active status, API usage tracking, audit log

-- Add role column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add is_active column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  api_name TEXT NOT NULL,
  endpoint TEXT,
  method TEXT DEFAULT 'GET',
  status_code INTEGER,
  response_time_ms INTEGER,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_name ON api_usage_log(api_name, timestamp DESC);

-- Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id TEXT REFERENCES users(id) NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON admin_audit_log(created_at DESC);

-- Add cascade delete on itineraries.user_id for admin user deletion
-- First check if the constraint exists and recreate with CASCADE
DO $$ BEGIN
  ALTER TABLE itineraries DROP CONSTRAINT IF EXISTS itineraries_user_id_fkey;
  ALTER TABLE itineraries ADD CONSTRAINT itineraries_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;
