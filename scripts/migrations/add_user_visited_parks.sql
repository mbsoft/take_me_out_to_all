-- Migration: Add user_visited_parks table for tracking which ballparks users have visited

CREATE TABLE IF NOT EXISTS user_visited_parks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_abbr TEXT NOT NULL REFERENCES teams(abbr),
  visited_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, team_abbr)
);

-- Create index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_user_visited_parks_user_id ON user_visited_parks(user_id);
