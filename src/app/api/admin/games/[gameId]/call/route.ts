import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { createServerClient, supabase } from '@/lib/supabase';
import { validateSheetClaim, ALL_PATTERN_NAMES } from '@/lib/game/claim-validator';
import type { PatternName } from '@/lib/game/claim-validator';
import type { TambolaSheet } from '@/lib/game/ticket-generator';

interface RouteParams {
  params: Promise<{ gameId: string }>;
}

/** POST /api/admin/games/[gameId]/call — Call the next number + auto-claim */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { gameId } = await params;
  const sb = createServerClient();

  // Get game
  const { data: game, error } = await sb
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single();

  if (error || !game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (game.status !== 'LIVE') {
    return NextResponse.json({ error: 'Game is not live' }, { status: 400 });
  }

  const calledNumbers: number[] = game.called_numbers || [];
  const sequence: number[] = game.number_sequence || [];

  // Find next uncalled number
  const nextNumber = sequence.find((n: number) => !calledNumbers.includes(n));

  if (nextNumber === undefined) {
    await sb.from('games').update({ status: 'COMPLETED' }).eq('id', gameId);
    return NextResponse.json({ completed: true, calledNumbers });
  }

  const updatedCalled = [...calledNumbers, nextNumber];

  // Update game with new called number
  const { error: updateError } = await sb
    .from('games')
    .update({ called_numbers: updatedCalled })
    .eq('id', gameId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Broadcast number to all players
  const channel = supabase.channel(`game:${gameId}`);
  await channel.send({
    type: 'broadcast',
    event: 'number_called',
    payload: { number: nextNumber, calledNumbers: updatedCalled },
  });

  // ============ AUTO-CLAIM ============
  // Check ALL tickets for newly completed patterns and auto-claim them
  const { data: tickets } = await sb
    .from('tickets')
    .select('*')
    .eq('game_id', gameId)
    .not('selected_tickets', 'is', null);

  // Get already-won patterns for this game
  const { data: existingClaims } = await sb
    .from('claims')
    .select('pattern')
    .eq('game_id', gameId)
    .eq('is_valid', true);

  const wonPatterns = new Set((existingClaims || []).map((c) => c.pattern));
  const newWinners: { playerName: string; pattern: string; ticketIndex: number }[] = [];

  if (tickets && tickets.length > 0) {
    for (const ticket of tickets) {
      const sheet: TambolaSheet = ticket.ticket_data;
      if (!sheet || !sheet.tickets) continue;

      for (const patternName of ALL_PATTERN_NAMES) {
        // Skip if already won by someone
        if (wonPatterns.has(patternName)) continue;

        const result = validateSheetClaim(sheet, updatedCalled, patternName as PatternName);

        if (result.valid) {
          // Auto-claim: insert into claims table
          await sb.from('claims').insert({
            ticket_id: ticket.id,
            game_id: gameId,
            pattern: patternName,
            ticket_index: result.ticketIndex,
            is_valid: true,
            player_name: ticket.player_name,
          });

          wonPatterns.add(patternName); // Prevent double-win
          newWinners.push({
            playerName: ticket.player_name,
            pattern: patternName,
            ticketIndex: result.ticketIndex,
          });
        }
      }
    }
  }

  // Broadcast any new winners to all players
  for (const winner of newWinners) {
    await channel.send({
      type: 'broadcast',
      event: 'claim_result',
      payload: {
        playerName: winner.playerName,
        pattern: winner.pattern,
        isValid: true,
        ticketIndex: winner.ticketIndex,
        auto: true,
      },
    });
  }

  supabase.removeChannel(channel);

  return NextResponse.json({
    number: nextNumber,
    calledNumbers: updatedCalled,
    totalCalled: updatedCalled.length,
    remaining: 90 - updatedCalled.length,
    newWinners,
  });
}
