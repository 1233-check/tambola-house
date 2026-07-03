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
    if (!user) throw new Error('Unauthorized')

    const { gameId } = await req.json()

    // Validate game and host
    const { data: game, error: gameError } = await supabaseAdmin
      .from('games')
      .select('host_id, status, number_sequence, called_numbers')
      .eq('id', gameId)
      .single()

    if (gameError || !game) throw new Error('Game not found')
    if (game.host_id !== user.id) throw new Error('Only host can call numbers')
    if (game.status !== 'IN_PROGRESS') throw new Error('Game is not in progress')

    const seq = game.number_sequence || []
    const called = game.called_numbers || []

    if (called.length >= seq.length) {
      // Game over
      await supabaseAdmin.from('games').update({ status: 'COMPLETED', ended_at: new Date().toISOString() }).eq('id', gameId)
      return new Response(JSON.stringify({ number: null, completed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const nextNumber = seq[called.length]
    const newCalled = [...called, nextNumber]

    // Update called numbers
    const { error: updateError } = await supabaseAdmin
      .from('games')
      .update({ called_numbers: newCalled })
      .eq('id', gameId)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ number: nextNumber, calledNumbers: newCalled }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
