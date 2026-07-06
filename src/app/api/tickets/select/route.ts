import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getGameTicketsPool } from '@/lib/game/ticket-generator';
import type { SheetType, TambolaSheet } from '@/lib/game/ticket-generator';

/** POST /api/tickets/select — Player chooses their 3 (half sheet) or 6 (full sheet) ticket numbers from 1-66 */
export async function POST(req: NextRequest) {
  try {
    const { accessToken, selectedTickets } = await req.json();

    if (!accessToken || !Array.isArray(selectedTickets)) {
      return NextResponse.json(
        { error: 'Valid access token and selectedTickets array are required' },
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

    // 2. Determine required ticket count
    const requiredCount = ticket.sheet_type === 'half' ? 3 : 6;
    if (selectedTickets.length !== requiredCount) {
      return NextResponse.json(
        { error: `You must select exactly ${requiredCount} tickets for a ${ticket.sheet_type} sheet.` },
        { status: 400 }
      );
    }

    // Validate numbers are integers between 1 and 66 with no duplicates
    const uniqueNums = new Set<number>();
    for (const n of selectedTickets) {
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 66) {
        return NextResponse.json({ error: 'All ticket numbers must be integers between 1 and 66.' }, { status: 400 });
      }
      uniqueNums.add(n);
    }
    if (uniqueNums.size !== requiredCount) {
      return NextResponse.json({ error: 'Duplicate ticket numbers are not allowed.' }, { status: 400 });
    }

    // 3. Check if game is already completed
    const { data: game, error: gameError } = await sb
      .from('games')
      .select('status')
      .eq('id', ticket.game_id)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (game.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Cannot change tickets after game is completed' }, { status: 400 });
    }

    // 4. Check if any selected ticket number is already taken in this game by another player
    const { data: allTickets } = await sb
      .from('tickets')
      .select('id, selected_tickets')
      .eq('game_id', ticket.game_id)
      .not('selected_tickets', 'is', null);

    const takenSet = new Set<number>();
    allTickets?.forEach((t) => {
      if (t.id !== ticket.id && Array.isArray(t.selected_tickets)) {
        t.selected_tickets.forEach((num: number) => takenSet.add(num));
      }
    });

    const conflict = selectedTickets.find((n: number) => takenSet.has(n));
    if (conflict !== undefined) {
      return NextResponse.json(
        { error: `Ticket #${conflict} is already taken by another player!` },
        { status: 409 }
      );
    }

    // 5. Retrieve deterministic 66-ticket pool and assign the exact selected tickets
    const pool = getGameTicketsPool(ticket.game_id);
    const assignedTickets = selectedTickets.map((n: number) => pool[n - 1]);

    const newSheet: TambolaSheet = {
      type: ticket.sheet_type as SheetType,
      tickets: assignedTickets,
    };

    const { data: updated, error: updateError } = await sb
      .from('tickets')
      .update({
        selected_tickets: selectedTickets,
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
      message: `🎟️ Successfully locked in Tickets #${selectedTickets.join(', #')}!`,
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
