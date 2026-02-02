-- Migration: Add game photos table for storing event photos
CREATE TABLE IF NOT EXISTS itinerary_game_photos (
  id TEXT PRIMARY KEY,
  itinerary_id TEXT NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES games(game_id),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create storage bucket for game photos (run in Supabase dashboard if this doesn't work via SQL)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('game-photos', 'game-photos', true) ON CONFLICT DO NOTHING;
