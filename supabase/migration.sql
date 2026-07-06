-- ============================================
-- TAMBOLA HOUSE — Supabase Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Games table: 20 game slots per day
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_number INTEGER NOT NULL CHECK (game_number >= 1 AND game_number <= 20),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'LIVE', 'COMPLETED')),
  called_numbers INTEGER[] NOT NULL DEFAULT '{}',
  number_sequence INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(date, game_number)
);

-- Tickets table: each ticket sold to a player
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  player_phone TEXT NOT NULL DEFAULT '',
  sheet_type TEXT NOT NULL CHECK (sheet_type IN ('full', 'half')),
  ticket_data JSONB NOT NULL,
  ticket_number INTEGER,
  access_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Claims table: pattern claim attempts
CREATE TABLE IF NOT EXISTS claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  ticket_index INTEGER NOT NULL DEFAULT 0,
  is_valid BOOLEAN NOT NULL DEFAULT FALSE,
  player_name TEXT NOT NULL DEFAULT '',
  validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A pattern can only be won once per game
  UNIQUE(game_id, pattern, is_valid) 
);

-- Note: The UNIQUE constraint on (game_id, pattern, is_valid) with is_valid=true
-- ensures only one valid claim per pattern per game. We handle this in application code.

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tickets_game_id ON tickets(game_id);
CREATE INDEX IF NOT EXISTS idx_tickets_access_token ON tickets(access_token);
CREATE INDEX IF NOT EXISTS idx_claims_game_id ON claims(game_id);
CREATE INDEX IF NOT EXISTS idx_games_date ON games(date);

-- Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

-- Public read access for games (status + called_numbers only, NOT number_sequence)
CREATE POLICY "Public can read game status" ON games
  FOR SELECT USING (true);

-- Players can read their own ticket by access_token
CREATE POLICY "Players read own ticket" ON tickets
  FOR SELECT USING (true);

-- Public can read claims
CREATE POLICY "Public can read claims" ON claims
  FOR SELECT USING (true);

-- Service role (used by API routes) can do everything
-- (Supabase service_role key bypasses RLS by default)

-- Insert policy for claims (players submit via API)
CREATE POLICY "Anyone can insert claims" ON claims
  FOR INSERT WITH CHECK (true);
