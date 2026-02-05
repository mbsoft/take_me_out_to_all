-- Add share_token column for public itinerary sharing
ALTER TABLE itineraries ADD COLUMN IF NOT EXISTS share_token TEXT;

-- Partial unique index: ensures no duplicate tokens while allowing multiple NULLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_itineraries_share_token
  ON itineraries(share_token) WHERE share_token IS NOT NULL;
