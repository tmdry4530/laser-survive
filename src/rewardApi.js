const DEVICE_ID_KEY = 'laser-device-id';

function getPublicConfig() {
  const config = window.__LASER_CONFIG__ ?? {};
  const supabaseUrl = config.supabaseUrl ?? '';
  const supabaseAnonKey = config.supabaseAnonKey ?? '';

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Rewards not configured');
  }

  return { supabaseUrl, supabaseAnonKey };
}

function buildHeaders() {
  const { supabaseAnonKey } = getPublicConfig();
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
  };
}

async function requestFunction(name, payload) {
  const { supabaseUrl } = getPublicConfig();
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(json.error || json.message || `Request failed (${response.status})`);
  }

  return json;
}

export function getDeviceId() {
  let deviceId = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = window.crypto?.randomUUID?.() ?? `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export function getRewardThreshold(mode) {
  return mode === 'crazy' ? 90 : 120;
}

export function isRewardEligible(mode, survivalTime) {
  return Number(survivalTime) >= getRewardThreshold(mode);
}

export async function claimReward({ mode, playerName, survivalTime }) {
  return requestFunction('claim-reward', {
    mode,
    playerName,
    survivalTime,
    deviceId: getDeviceId(),
  });
}

export async function fetchRewardAsset({ mode }) {
  return requestFunction('reward-asset', {
    mode,
    deviceId: getDeviceId(),
  });
}
