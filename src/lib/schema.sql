CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  verification_token TEXT,
  verification_token_expires TIMESTAMPTZ,
  password_reset_token TEXT,
  password_reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
  abbr TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  league TEXT NOT NULL,
  division TEXT NOT NULL,
  stadium_name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  game_id INTEGER PRIMARY KEY,
  day TEXT NOT NULL,
  date_time TEXT NOT NULL,
  date_time_utc TEXT NOT NULL,
  away_team TEXT NOT NULL REFERENCES teams(abbr),
  home_team TEXT NOT NULL REFERENCES teams(abbr),
  stadium_id INTEGER NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS itineraries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  travel_mode TEXT NOT NULL,
  start_date DATE,
  start_location TEXT,
  start_lat DOUBLE PRECISION,
  start_lon DOUBLE PRECISION,
  end_location TEXT,
  end_lat DOUBLE PRECISION,
  end_lon DOUBLE PRECISION,
  route_geometry TEXT,
  segment_modes TEXT,
  custom_teams TEXT,
  share_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itinerary_games (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES games(game_id),
  sort_order INTEGER NOT NULL,
  notes TEXT,
  locked BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS itinerary_game_photos (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES games(game_id),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itinerary_stopovers (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  after_index INTEGER NOT NULL,
  label TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

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
