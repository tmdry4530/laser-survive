import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function hashDeviceId(deviceId: string) {
  const encoder = new TextEncoder()
  return crypto.subtle.digest('SHA-256', encoder.encode(deviceId)).then((buffer) =>
    Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const body = await req.json()
    const deviceIdHash = await hashDeviceId(body.deviceId ?? '')

    const { data, error } = await supabase.rpc('claim_reward', {
      p_mode: body.mode,
      p_device_id_hash: deviceIdHash,
      p_player_name: body.playerName,
      p_survival_time: body.survivalTime,
    })

    if (error) throw error

    return new Response(JSON.stringify(data?.[0] ?? { status: 'error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message ?? 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
