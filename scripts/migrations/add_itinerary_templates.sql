-- Itinerary templates: admin-created templates that seed new user accounts

CREATE TABLE IF NOT EXISTS itinerary_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  goal TEXT NOT NULL,
  travel_mode TEXT NOT NULL,
  start_location TEXT,
  start_lat DOUBLE PRECISION,
  start_lon DOUBLE PRECISION,
  end_location TEXT,
  end_lat DOUBLE PRECISION,
  end_lon DOUBLE PRECISION,
  custom_teams TEXT,
  segment_modes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  source_itinerary_id TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itinerary_template_games (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES itinerary_templates(id) ON DELETE CASCADE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_id INTEGER,
  sort_order INTEGER NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS itinerary_template_stopovers (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES itinerary_templates(id) ON DELETE CASCADE,
  after_index INTEGER NOT NULL,
  label TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_templates_active ON itinerary_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_template_games_template ON itinerary_template_games(template_id, sort_order);
