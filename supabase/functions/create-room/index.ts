import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

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
      // For MVP, we might allow anonymous users to act as hosts if we set up anon auth
      // But let's assume they are authenticated
      throw new Error('Unauthorized')
    }

    const { maxPlayers } = await req.json()

    // Generate a 6 character alphanumeric room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()

    const { data: game, error } = await supabaseAdmin
      .from('games')
      .insert({
        room_code: roomCode,
        host_id: user.id,
        status: 'LOBBY',
        max_players: maxPlayers || 25,
      })
      .select()
      .single()

    if (error) throw error

    return new Response(
      JSON.stringify({ roomCode, gameId: game.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
