import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { validateSheetClaim } from '@/lib/game/claim-validator';
import type { PatternName } from '@/lib/game/claim-validator';
import type { TambolaSheet } from '@/lib/game/ticket-generator';

/** POST /api/claims — Player submits a claim (server-side validation) */
export async function POST(req: NextRequest) {
  try {
    const { accessToken, pattern, ticketIndex } = await req.json();

    if (!accessToken || !pattern) {
      return NextResponse.json({ error: 'accessToken and pattern are required' }, { status: 400 });
    }

    const sb = createServerClient();

    // 1. Fetch ticket from DB (anti-cheat: server is source of truth)
    const { data: ticket, error: ticketError } = await sb
      .from('tickets')
      .select('*')
      .eq('access_token', accessToken)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // 2. Fetch game (anti-cheat: use server's called numbers, not client's)
    const { data: game, error: gameError } = await sb
      .from('games')
      .select('id, status, called_numbers')
      .eq('id', ticket.game_id)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.status !== 'LIVE') {
      return NextResponse.json({ error: 'Game is not live' }, { status: 400 });
    }

    // 3. Check if pattern already won
    const { data: existingClaim } = await sb
      .from('claims')
      .select('id')
      .eq('game_id', game.id)
      .eq('pattern', pattern)
      .eq('is_valid', true)
      .limit(1);

    if (existingClaim && existingClaim.length > 0) {
      return NextResponse.json({
        valid: false,
        message: `${pattern} has already been won`,
      });
    }

    // 4. Validate claim server-side
    const sheet: TambolaSheet = ticket.ticket_data;
    const calledNumbers: number[] = game.called_numbers || [];
    const result = validateSheetClaim(sheet, calledNumbers, pattern as PatternName, ticketIndex);

    // 5. Record the claim
    await sb.from('claims').insert({
      ticket_id: ticket.id,
      game_id: game.id,
      pattern,
      ticket_index: result.ticketIndex,
      is_valid: result.valid,
      player_name: ticket.player_name,
    });

    // 6. Broadcast claim result via Realtime
    const { supabase } = await import('@/lib/supabase');
    const channel = supabase.channel(`game:${game.id}`);
    await channel.send({
      type: 'broadcast',
      event: 'claim_result',
      payload: {
        playerName: ticket.player_name,
        pattern,
        isValid: result.valid,
        ticketIndex: result.ticketIndex,
      },
    });
    supabase.removeChannel(channel);

    return NextResponse.json({
      valid: result.valid,
      ticketIndex: result.ticketIndex,
      message: result.valid
        ? `🎉 ${pattern} claimed successfully!`
        : `❌ ${pattern} claim is invalid. Check your numbers.`,
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
