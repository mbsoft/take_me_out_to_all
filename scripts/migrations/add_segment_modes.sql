-- Add segment_modes column for per-segment transport (car/air).
-- Run this in your Supabase SQL editor if the column is missing.
ALTER TABLE itineraries
ADD COLUMN IF NOT EXISTS segment_modes TEXT;
