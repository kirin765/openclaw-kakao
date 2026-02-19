import { describe, expect, it } from 'vitest';

import {
  InMemoryKakaoChannelState,
  toConversationKey
} from '../src/channel/kakao/state.js';

describe('InMemoryKakaoChannelState', () => {
  it('tracks processed event ids for deduplication', () => {
    const state = new InMemoryKakaoChannelState();

    expect(state.hasProcessedEvent('evt_1')).toBe(false);
    state.markEventProcessed('evt_1');
    expect(state.hasProcessedEvent('evt_1')).toBe(true);
  });

  it('maps conversation ids by channel/user pair', () => {
    const state = new InMemoryKakaoChannelState();
    const ref = { channelId: 'channel-1', userId: 'user-1' };

    expect(state.getConversationId(ref)).toBeUndefined();
    state.setConversationId(ref, 'conv-1');
    expect(state.getConversationId(ref)).toBe('conv-1');
  });

  it('builds deterministic key for conversation map entries', () => {
    expect(toConversationKey({ channelId: 'c', userId: 'u' })).toBe('c:u');
  });
});
