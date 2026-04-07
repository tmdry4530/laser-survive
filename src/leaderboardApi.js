function getPublicConfig() {
  const config = window.__LASER_CONFIG__ ?? {};
  const supabaseUrl = config.supabaseUrl ?? '';
  const supabaseAnonKey = config.supabaseAnonKey ?? '';

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Leaderboard not configured');
  }

  return { supabaseUrl, supabaseAnonKey };
}

function buildHeaders(extra = {}) {
  const { supabaseAnonKey } = getPublicConfig();
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function requestSupabase(path, options = {}) {
  const { supabaseUrl } = getPublicConfig();
  const response = await fetch(`${supabaseUrl}${path}`, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || payload.error_description || payload.error || `Request failed (${response.status})`);
  }

  return payload;
}

function takeFirstRow(payload) {
  if (Array.isArray(payload)) {
    return payload[0] ?? {};
  }

  return payload ?? {};
}

export async function submitScore({ playerName, mode, survivalTime, isTestMode, clientVersion }) {
  const payload = await requestSupabase('/rest/v1/rpc/submit_score', {
    method: 'POST',
    headers: buildHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify({
      p_player_name: playerName,
      p_mode: mode,
      p_survival_time: survivalTime,
      p_is_test_mode: isTestMode,
      p_client_version: clientVersion,
    }),
  });

  const row = takeFirstRow(payload);
  return {
    rank: row.rank ?? 0,
    isPersonalBest: Boolean(row.is_personal_best),
  };
}

export async function fetchLeaderboard(mode, limit = 20) {
  const search = new URLSearchParams({
    select: 'player_name,mode,survival_time,created_at',
    mode: `eq.${mode}`,
    is_test_mode: 'eq.false',
    order: 'survival_time.desc,created_at.asc',
    limit: `${limit}`,
  });

  const payload = await requestSupabase(`/rest/v1/scores?${search.toString()}`, {
    method: 'GET',
    headers: buildHeaders(),
  });

  return payload.map((row, index) => ({
    rank: index + 1,
    playerName: row.player_name,
    mode: row.mode,
    survivalTime: row.survival_time,
    createdAt: row.created_at,
  }));
}

export async function fetchPlayerBest(playerName) {
  const payload = await requestSupabase('/rest/v1/rpc/player_best', {
    method: 'POST',
    headers: buildHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify({
      p_player_name: playerName,
    }),
  });

  const row = takeFirstRow(payload);
  return {
    endless: row.endless ?? 0,
    crazy: row.crazy ?? 0,
  };
}
