const VALID_MODES = new Set(['endless', 'crazy']);
const NAME_REGEX = /^[A-Za-z0-9 _-]{1,12}$/;

export function validateScorePayload(payload) {
  const playerName = `${payload?.playerName ?? ''}`.trim();
  const mode = payload?.mode;
  const survivalTime = Number(payload?.survivalTime);
  const isTestMode = Boolean(payload?.isTestMode);
  const clientVersion = `${payload?.clientVersion ?? ''}`.trim().slice(0, 32);

  if (!NAME_REGEX.test(playerName)) {
    return { ok: false, status: 400, error: 'Invalid player name' };
  }

  if (!VALID_MODES.has(mode)) {
    return { ok: false, status: 400, error: 'Invalid mode' };
  }

  if (!Number.isFinite(survivalTime) || survivalTime < 0 || survivalTime > 7200) {
    return { ok: false, status: 400, error: 'Invalid survival time' };
  }

  if (isTestMode) {
    return { ok: false, status: 403, error: 'Test mode scores are not accepted' };
  }

  return {
    ok: true,
    value: {
      playerName,
      mode,
      survivalTime,
      isTestMode: 0,
      clientVersion,
    },
  };
}

export function validateLeaderboardQuery(query) {
  const mode = query?.mode;
  const limit = Math.min(50, Math.max(1, Number(query?.limit ?? 20)));

  if (!VALID_MODES.has(mode)) {
    return { ok: false, status: 400, error: 'Invalid mode' };
  }

  return { ok: true, value: { mode, limit } };
}

export function validatePlayerNameQuery(query) {
  const playerName = `${query?.playerName ?? ''}`.trim();
  if (!NAME_REGEX.test(playerName)) {
    return { ok: false, status: 400, error: 'Invalid player name' };
  }

  return { ok: true, value: playerName };
}
