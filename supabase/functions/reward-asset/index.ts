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

    const { data: claim } = await supabase
      .from('reward_claims')
      .select('reward_id')
      .eq('mode', body.mode)
      .eq('device_id_hash', deviceIdHash)
      .maybeSingle()

    if (!claim) {
      throw new Error('Reward not claimed')
    }

    const { data: reward, error: rewardError } = await supabase
      .from('rewards')
      .select('name, description, storage_path')
      .eq('id', claim.reward_id)
      .maybeSingle()

    if (rewardError || !reward) {
      throw rewardError ?? new Error('Reward not found')
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from('reward-assets')
      .createSignedUrl(reward.storage_path, 60)

    if (signedError) throw signedError

    return new Response(JSON.stringify({
      name: reward.name,
      description: reward.description,
      signedUrl: signed.signedUrl,
    }), {
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
