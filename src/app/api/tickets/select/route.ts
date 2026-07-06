import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getGameTicketsPool } from '@/lib/game/ticket-generator';
import type { SheetType, TambolaSheet } from '@/lib/game/ticket-generator';

/**
 * POST /api/tickets/select
 *
 * Player picks a starting ticket number. The system assigns
 * a consecutive block from that number:
 *   - Half sheet: 3 consecutive tickets  (e.g. startAt=40 → #40, #41, #42)
 *   - Full sheet: 6 consecutive tickets  (e.g. startAt=40 → #40–#45)
 *
 * Valid starting numbers:
 *   - Half sheet: 1 to 64  (64 + 2 = 66)
 *   - Full sheet: 1 to 61  (61 + 5 = 66)
 */
export async function POST(req: NextRequest) {
  try {
    const { accessToken, startAt } = await req.json();

    if (!accessToken || typeof startAt !== 'number') {
      return NextResponse.json(
        { error: 'accessToken and startAt (number) are required' },
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

    // 2. Calculate consecutive block
    const count = ticket.sheet_type === 'half' ? 3 : 6;
    const maxStart = 66 - count + 1; // half=64, full=61

    if (!Number.isInteger(startAt) || startAt < 1 || startAt > maxStart) {
      return NextResponse.json(
        { error: `Starting number must be between 1 and ${maxStart} for a ${ticket.sheet_type} sheet.` },
        { status: 400 }
      );
    }

    const selectedTickets = Array.from({ length: count }, (_, i) => startAt + i);

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

    // 4. Check for conflicts with other players
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

    const conflict = selectedTickets.find((n) => takenSet.has(n));
    if (conflict !== undefined) {
      return NextResponse.json(
        { error: `Ticket #${conflict} is already taken! Choose a different starting number.` },
        { status: 409 }
      );
    }

    // 5. Retrieve deterministic pool and assign consecutive tickets
    const pool = getGameTicketsPool(ticket.game_id);
    const assignedTickets = selectedTickets.map((n) => pool[n - 1]);

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

    const last = selectedTickets[selectedTickets.length - 1];
    return NextResponse.json({
      success: true,
      ticket: updated,
      message: `🎟️ Locked in Tickets #${startAt}–#${last}!`,
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
