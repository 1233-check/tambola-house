import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { validateClaim, PatternName } from '../_shared/claim-validator.ts'

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
    if (!user) throw new Error('Unauthorized')

    const { gameId, patternName } = await req.json()

    // 1. Get Game State
    const { data: game, error: gameError } = await supabaseAdmin
      .from('games')
      .select('status, called_numbers')
      .eq('id', gameId)
      .single()
    
    if (gameError || !game) throw new Error('Game not found')
    if (game.status !== 'IN_PROGRESS') throw new Error('Game is not in progress')

    // 2. Get Player Ticket
    const { data: playerTicket, error: ticketError } = await supabaseAdmin
      .from('player_tickets')
      .select('ticket')
      .eq('game_id', gameId)
      .eq('player_id', user.id)
      .single()

    if (ticketError || !playerTicket) throw new Error('Ticket not found')

    // 3. Check if pattern already claimed by someone else
    const { data: existingClaim } = await supabaseAdmin
      .from('claims')
      .select('id')
      .eq('game_id', gameId)
      .eq('pattern_name', patternName)
      .eq('is_valid', true)
      .maybeSingle()
    
    if (existingClaim) {
      throw new Error(`Pattern '${patternName}' has already been claimed!`)
    }

    // 4. Validate claim
    const isValid = validateClaim(playerTicket.ticket, game.called_numbers || [], patternName as PatternName)

    // 5. Record claim
    const { error: claimError } = await supabaseAdmin
      .from('claims')
      .insert({
        game_id: gameId,
        player_id: user.id,
        pattern_name: patternName,
        is_valid: isValid
      })
    
    // Ignore duplicate key error if someone claimed at the exact same millisecond
    if (claimError && claimError.code !== '23505') throw claimError

    return new Response(
      JSON.stringify({ valid: isValid, message: isValid ? `Valid claim for ${patternName}` : `Bogey for ${patternName}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
