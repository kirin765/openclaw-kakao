import { describe, expect, it, vi } from 'vitest';

import {
  KakaoApiError,
  createKakaoChannelProvider,
  type KakaoClient,
  type KakaoChannelConfig,
  type KakaoSendMessageResponse,
  KakaoSendActionError
} from '../src/index.js';

const createMockClient = () => {
  const send = vi.fn(async (): Promise<KakaoSendMessageResponse> => ({
    success: true,
    messageId: 'provider-message-1'
  }));

  const client: KakaoClient = {
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    send,
    onMessage: vi.fn()
  };

  return { client, send };
};

describe('kakao outbound send flow', () => {
  it('routes OpenClaw message send action to Kakao client and returns metadata', async () => {
    const { client, send } = createMockClient();

    const provider = createKakaoChannelProvider({
      env: { KAKAO_DRY_RUN: 'true' },
      clientFactory: (_config: KakaoChannelConfig) => client
    });

    const result = await provider.sendMessageAction({
      channel: 'kakao',
      target: 'room:room-123',
      message: 'hello from openclaw'
    });

    expect(send).toHaveBeenCalledWith({ channelId: 'room-123', text: 'hello from openclaw' });
    expect(result).toEqual({
      ok: true,
      channel: 'kakao',
      target: 'room:room-123',
      providerMessageId: 'provider-message-1',
      provider: { success: true, messageId: 'provider-message-1' }
    });
  });

  it('validates supported target format before API call', async () => {
    const { client, send } = createMockClient();
    const provider = createKakaoChannelProvider({
      env: { KAKAO_DRY_RUN: 'true' },
      clientFactory: () => client
    });

    await expect(
      provider.sendMessageAction({
        channel: 'kakao',
        target: 'room-123',
        message: 'invalid target format'
      })
    ).rejects.toMatchObject({
      name: 'KakaoSendActionError',
      code: 'INVALID_TARGET',
      retryable: false
    });

    expect(send).not.toHaveBeenCalled();
  });

  it('surfaces Kakao API errors in structured retry-friendly format', async () => {
    const { client, send } = createMockClient();
    send.mockRejectedValue(new KakaoApiError(429, '[kakao-api] request failed with status 429', true));

    const provider = createKakaoChannelProvider({
      env: { KAKAO_DRY_RUN: 'true' },
      clientFactory: () => client
    });

    await expect(
      provider.sendMessageAction({
        channel: 'kakao',
        target: 'user:user-123',
        message: 'retry please'
      })
    ).rejects.toBeInstanceOf(KakaoSendActionError);

    await expect(
      provider.sendMessageAction({
        channel: 'kakao',
        target: 'user:user-123',
        message: 'retry please'
      })
    ).rejects.toMatchObject({
      code: 'KAKAO_API_ERROR',
      status: 429,
      retryable: true
    });
  });
});
