import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { createServerClient } from '@/lib/supabase';

interface RouteParams {
  params: Promise<{ gameId: string }>;
}

/** GET /api/admin/games/[gameId] — Game detail with tickets & claims */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { gameId } = await params;
  const sb = createServerClient();

  const { data: game, error } = await sb
    .from('games')
    .select('*, tickets(*), claims(*)')
    .eq('id', gameId)
    .single();

  if (error || !game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  return NextResponse.json({ game });
}

/** PATCH /api/admin/games/[gameId] — Update game status */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { gameId } = await params;
  const body = await req.json();
  const sb = createServerClient();

  // Allowed updates: status
  const updates: Record<string, unknown> = {};
  if (body.status) {
    if (!['UPCOMING', 'LIVE', 'COMPLETED'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    updates.status = body.status;
  }

  const { data, error } = await sb
    .from('games')
    .update(updates)
    .eq('id', gameId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ game: data });
}
