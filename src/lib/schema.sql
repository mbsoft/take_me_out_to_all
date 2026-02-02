CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS itinerary_games (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES games(game_id),
  sort_order INTEGER NOT NULL,
  notes TEXT
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
