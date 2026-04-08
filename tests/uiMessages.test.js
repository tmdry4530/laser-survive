import test from 'node:test';
import assert from 'node:assert/strict';
import { toUserMessage } from '../src/uiMessages.js';

test('maps known backend errors to user-friendly Korean messages', () => {
  assert.equal(toUserMessage('Invalid player name'), '닉네임을 확인해 주세요');
  assert.equal(toUserMessage('Rewards not configured'), '보상 기능이 아직 설정되지 않았어요');
  assert.equal(toUserMessage('Object not found'), '보상 이미지가 아직 등록되지 않았어요');
  assert.equal(toUserMessage('sold_out'), '보상이 모두 소진되었어요');
});

test('uses fallback for empty messages and passes through unknown values', () => {
  assert.equal(toUserMessage('', 'fallback'), 'fallback');
  assert.equal(toUserMessage('ALREADY CLAIMED'), 'ALREADY CLAIMED');
});
