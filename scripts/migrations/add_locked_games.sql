-- Add locked column to itinerary_games for pinning games during regeneration.
ALTER TABLE itinerary_games ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE;
