import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { generateTicket } from '../_shared/ticket-generator.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const { roomCode } = await req.json()

    // 1. Validate room exists and is in LOBBY
    const { data: game, error: gameError } = await supabaseAdmin
      .from('games')
      .select('id, status, max_players')
      .eq('room_code', roomCode)
      .single()

    if (gameError || !game) throw new Error('Room not found')
    if (game.status !== 'LOBBY') throw new Error('Game already started or finished')

    // 2. Check player limit
    const { count, error: countError } = await supabaseAdmin
      .from('player_tickets')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', game.id)

    if (countError) throw countError
    if (count !== null && count >= game.max_players) {
      throw new Error('Room is full')
    }

    // 3. Generate and assign ticket
    // Avoid duplicates for the player in the same game
    const { data: existingTicket } = await supabaseAdmin
      .from('player_tickets')
      .select('ticket')
      .eq('game_id', game.id)
      .eq('player_id', user.id)
      .maybeSingle()

    let ticket = existingTicket?.ticket
    if (!ticket) {
      ticket = generateTicket()
      const { error: insertError } = await supabaseAdmin
        .from('player_tickets')
        .insert({
          game_id: game.id,
          player_id: user.id,
          ticket: ticket
        })
      
      if (insertError) throw insertError
    }

    return new Response(
      JSON.stringify({ gameId: game.id, ticket }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
