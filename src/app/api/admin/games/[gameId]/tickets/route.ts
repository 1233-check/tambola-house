import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';
import { generateSheet } from '@/lib/game/ticket-generator';
import type { SheetType, TambolaSheet } from '@/lib/game/ticket-generator';

interface RouteParams {
  params: Promise<{ gameId: string }>;
}

/** POST /api/admin/games/[gameId]/tickets — Generate a ticket link for a player */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { gameId } = await params;
  const { playerName, playerPhone, sheetType } = await req.json();

  if (!playerName || !sheetType) {
    return NextResponse.json({ error: 'playerName and sheetType are required' }, { status: 400 });
  }

  if (!['full', 'half'].includes(sheetType)) {
    return NextResponse.json({ error: 'sheetType must be "full" or "half"' }, { status: 400 });
  }

  const sb = createServerClient();

  // Verify game exists
  const { data: game, error: gameError } = await sb
    .from('games')
    .select('id, game_number, status')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  // Check ticket count (max 25 players)
  const { count } = await sb
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('game_id', gameId);

  if (count !== null && count >= 25) {
    return NextResponse.json({ error: 'Maximum 25 players per game' }, { status: 400 });
  }

  // Generate a temporary placeholder sheet. The actual ticket_data will be
  // replaced when the player selects their ticket numbers via /api/tickets/select.
  // This ensures ticket_data is never null in the database.
  const placeholderSheet: TambolaSheet = generateSheet(sheetType as SheetType);

  const { data: ticket, error } = await sb
    .from('tickets')
    .insert({
      game_id: gameId,
      player_name: playerName,
      player_phone: playerPhone || '',
      sheet_type: sheetType,
      ticket_data: placeholderSheet,
      // selected_tickets left as null — player will choose from 1-66 pool
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build the shareable player link
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
  const playerLink = `${baseUrl}/play/${ticket.access_token}`;

  return NextResponse.json({
    ticket,
    playerLink,
    whatsappLink: `https://wa.me/${playerPhone}?text=${encodeURIComponent(
      `🎟️ Tambola House - Game #${game.game_number}\n\nHi ${playerName}!\n\nOpen this link to choose your lucky tickets:\n${playerLink}\n\nGood luck! 🍀`
    )}`,
  });
}
