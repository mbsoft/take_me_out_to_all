-- Add custom_teams column for per-itinerary custom ballpark selection.
-- Stores a JSON array of team abbreviations, e.g. '["NYY","BOS","CHC"]'
-- Only used when goal = 'custom'.
ALTER TABLE itineraries
ADD COLUMN IF NOT EXISTS custom_teams TEXT;
