const MESSAGE_MAP = new Map([
  ['Leaderboard not configured', '온라인 랭킹이 아직 설정되지 않았어요'],
  ['Rewards not configured', '보상 기능이 아직 설정되지 않았어요'],
  ['Invalid player name', '닉네임을 확인해 주세요'],
  ['Reward not claimed', '먼저 보상을 클레임해 주세요'],
  ['Object not found', '보상 이미지가 아직 등록되지 않았어요'],
  ['SCORE ALREADY SAVED', '이미 점수를 저장했어요'],
  ['REWARD NOT ELIGIBLE', '보상 조건을 아직 달성하지 못했어요'],
  ['sold_out', '보상이 모두 소진되었어요'],
]);

export function toUserMessage(rawMessage, fallback = '요청을 처리하지 못했어요') {
  const message = `${rawMessage ?? ''}`.trim();
  if (!message) {
    return fallback;
  }

  return MESSAGE_MAP.get(message) ?? message;
}
