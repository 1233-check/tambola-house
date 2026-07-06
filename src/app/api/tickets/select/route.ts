import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { generateSheet } from '@/lib/game/ticket-generator';
import type { SheetType } from '@/lib/game/ticket-generator';

/** POST /api/tickets/select — Player chooses their unique booklet/ticket number */
export async function POST(req: NextRequest) {
  try {
    const { accessToken, ticketNumber } = await req.json();

    if (!accessToken || typeof ticketNumber !== 'number' || ticketNumber < 1 || ticketNumber > 100) {
      return NextResponse.json(
        { error: 'Valid access token and ticket number (1-100) are required' },
        { status: 400 }
      );
    }

    const sb = createServerClient();

    // 1. Fetch ticket by token
    const { data: ticket, error: fetchError } = await sb
      .from('tickets')
      .select('*')
      .eq('access_token', accessToken)
      .single();

    if (fetchError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // 2. Check if game is already completed
    const { data: game, error: gameError } = await sb
      .from('games')
      .select('status')
      .eq('id', ticket.game_id)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Cannot change ticket after game is completed' }, { status: 400 });
    }

    // 3. Check if ticket number is already taken in this game by another player
    const { data: existing } = await sb
      .from('tickets')
      .select('id')
      .eq('game_id', ticket.game_id)
      .eq('ticket_number', ticketNumber)
      .neq('id', ticket.id)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: `Ticket Set #${ticketNumber} is already taken by another player!` },
        { status: 409 }
      );
    }

    // 4. Generate fresh valid sheet and assign the unique ticket number
    const newSheet = generateSheet(ticket.sheet_type as SheetType);

    const { data: updated, error: updateError } = await sb
      .from('tickets')
      .update({
        ticket_number: ticketNumber,
        ticket_data: newSheet,
      })
      .eq('id', ticket.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ticket: updated,
      message: `🎟️ Successfully locked in Ticket Set #${ticketNumber}!`,
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
