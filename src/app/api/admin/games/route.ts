import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';

function shuffleRange(min: number, max: number): number[] {
  const arr: number[] = [];
  for (let i = min; i <= max; i++) arr.push(i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** GET /api/admin/games — List today's games */
export async function GET() {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createServerClient();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await sb
    .from('games')
    .select('*, tickets(id, player_name, sheet_type)')
    .eq('date', today)
    .order('game_number', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ games: data });
}

/** POST /api/admin/games — Create today's 20 game slots (idempotent) */
export async function POST() {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createServerClient();
  const today = new Date().toISOString().split('T')[0];

  // Check if games already exist for today
  const { data: existing } = await sb
    .from('games')
    .select('id')
    .eq('date', today)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ message: 'Games already created for today' });
  }

  // Create 20 game slots
  const games = Array.from({ length: 20 }, (_, i) => ({
    game_number: i + 1,
    date: today,
    status: 'UPCOMING',
    called_numbers: [],
    number_sequence: shuffleRange(1, 90),
  }));

  const { data, error } = await sb.from('games').insert(games).select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ games: data, created: true });
}
