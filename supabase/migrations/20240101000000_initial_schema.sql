-- Player profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Game rooms
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT UNIQUE NOT NULL,          -- 6-char join code
  host_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'LOBBY',    -- LOBBY | IN_PROGRESS | COMPLETED
  number_sequence INTEGER[],               -- full 1-90 shuffled (hidden via RLS)
  called_numbers INTEGER[] DEFAULT '{}',   -- progressively revealed
  settings JSONB DEFAULT '{"autoCall": false, "callIntervalMs": 5000}'::jsonb,
  patterns TEXT[] DEFAULT '{"Early Five","Top Line","Middle Line","Bottom Line","Four Corners","Full House"}',
  max_players INTEGER DEFAULT 25,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Player tickets (one per player per game)
CREATE TABLE public.player_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES auth.users(id),
  ticket JSONB NOT NULL,                   -- 3×9 grid: [[null,12,null,...], ...]
  marked_numbers INTEGER[] DEFAULT '{}',
  UNIQUE(game_id, player_id)
);

-- Claim results
CREATE TABLE public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES auth.users(id),
  pattern_name TEXT NOT NULL,
  is_valid BOOLEAN NOT NULL,
  claimed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(game_id, pattern_name)            -- Only one winner per pattern per game
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING ( true );

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id );

-- Games Policies
CREATE POLICY "Games are viewable by everyone."
  ON public.games FOR SELECT
  USING ( true );

-- We do not allow clients to directly insert/update games to prevent cheating.
-- Edge Functions will handle inserts/updates using the service role key.

-- Player Tickets Policies
CREATE POLICY "Users can view their own tickets."
  ON public.player_tickets FOR SELECT
  USING ( auth.uid() = player_id );

-- We do not allow clients to insert tickets to prevent cheating.
-- They can update their marked numbers.
CREATE POLICY "Users can update their marked numbers."
  ON public.player_tickets FOR UPDATE
  USING ( auth.uid() = player_id )
  WITH CHECK ( auth.uid() = player_id );

-- Claims Policies
CREATE POLICY "Claims are viewable by everyone."
  ON public.claims FOR SELECT
  USING ( true );

-- Clients cannot insert claims directly, they must go through the Edge Function.

-- Realtime Publications
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.claims;
