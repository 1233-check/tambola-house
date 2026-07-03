import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

interface RouteParams {
  params: Promise<{ gameId: string }>;
}

/** POST /api/admin/games/[gameId]/call — Call the next number */
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

  // Find next uncalled number from the pre-shuffled sequence
  const nextNumber = sequence.find((n: number) => !calledNumbers.includes(n));

  if (nextNumber === undefined) {
    // All 90 numbers called — end game
    await sb
      .from('games')
      .update({ status: 'COMPLETED' })
      .eq('id', gameId);

    return NextResponse.json({ completed: true, calledNumbers });
  }

  const updatedCalled = [...calledNumbers, nextNumber];

  // Update game
  const { error: updateError } = await sb
    .from('games')
    .update({ called_numbers: updatedCalled })
    .eq('id', gameId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Broadcast via Supabase Realtime
  const channel = supabase.channel(`game:${gameId}`);
  await channel.send({
    type: 'broadcast',
    event: 'number_called',
    payload: { number: nextNumber, calledNumbers: updatedCalled },
  });
  supabase.removeChannel(channel);

  return NextResponse.json({
    number: nextNumber,
    calledNumbers: updatedCalled,
    totalCalled: updatedCalled.length,
    remaining: 90 - updatedCalled.length,
  });
}
