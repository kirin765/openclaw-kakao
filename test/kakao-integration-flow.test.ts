import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { KakaoApiClient } from '../src/channel/kakao/client.js';
import { createKakaoChannelProvider } from '../src/channel/kakao/provider.js';
import { createKakaoInboundWebhookController } from '../src/channel/kakao/webhook.js';

const signPayload = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(payload).digest('hex');

describe('kakao end-to-end integration flow', () => {
  it('handles inbound text webhook and dispatches outbound send through provider boundary', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: () => null
      },
      text: async () => JSON.stringify({ success: true, messageId: 'msg_001' })
    }));

    const provider = createKakaoChannelProvider({
      env: {
        KAKAO_DRY_RUN: 'false',
        KAKAO_REST_API_KEY: 'rest_key_test',
        KAKAO_WEBHOOK_SECRET: 'webhook_secret_test',
        KAKAO_CHANNEL_TOKEN: 'channel_token_test',
        KAKAO_API_BASE_URL: 'https://mocked.kakao.local'
      },
      clientFactory: (config) => new KakaoApiClient(config, { fetchImpl })
    });

    await provider.boot();

    const outboundResults: Array<{ providerMessageId: string; target: string }> = [];
    const controller = createKakaoInboundWebhookController({
      webhookSecret: 'webhook_secret_test',
      onIncomingMessage: async (event) => {
        const result = await provider.sendMessageAction({
          channel: 'kakao',
          target: `room:${event.channelId}`,
          message: `echo: ${event.text}`
        });

        outboundResults.push({
          providerMessageId: result.providerMessageId,
          target: result.target
        });
      }
    });

    const payload = JSON.stringify({
      event: {
        id: 'evt_001',
        type: 'message',
        channel_id: 'room-001',
        user: { id: 'user-001' },
        message: { type: 'text', text: 'hello' }
      }
    });

    const response = await controller({
      headers: {
        'x-kakao-signature': signPayload(payload, 'webhook_secret_test')
      },
      body: payload
    });

    expect(response).toEqual({ status: 200, body: { ok: true } });
    expect(outboundResults).toEqual([{ providerMessageId: 'msg_001', target: 'room:room-001' }]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://mocked.kakao.local/v1/talk/channels/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer channel_token_test',
          'X-KakaoAK': 'rest_key_test',
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          channel_id: 'room-001',
          text: 'echo: hello'
        })
      })
    );

    await provider.shutdown();
  });

  it('rejects invalid signature and does not dispatch outbound send', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: {
        get: () => null
      },
      text: async () => JSON.stringify({ success: true, messageId: 'msg_should_not_send' })
    }));

    const provider = createKakaoChannelProvider({
      env: {
        KAKAO_DRY_RUN: 'false',
        KAKAO_REST_API_KEY: 'rest_key_test',
        KAKAO_WEBHOOK_SECRET: 'webhook_secret_test',
        KAKAO_CHANNEL_TOKEN: 'channel_token_test',
        KAKAO_API_BASE_URL: 'https://mocked.kakao.local'
      },
      clientFactory: (config) => new KakaoApiClient(config, { fetchImpl })
    });

    const onIncomingMessage = vi.fn(async (event: { channelId: string; text: string }) => {
      await provider.sendMessageAction({
        channel: 'kakao',
        target: `room:${event.channelId}`,
        message: `echo: ${event.text}`
      });
    });

    const controller = createKakaoInboundWebhookController({
      webhookSecret: 'webhook_secret_test',
      onIncomingMessage
    });

    const payload = JSON.stringify({
      event: {
        id: 'evt_bad_sig',
        type: 'message',
        channel_id: 'room-001',
        user: { id: 'user-001' },
        message: { type: 'text', text: 'hello' }
      }
    });

    const response = await controller({
      headers: {
        'x-kakao-signature': 'sha256=totally-invalid'
      },
      body: payload
    });

    expect(response).toEqual({
      status: 401,
      body: { ok: false, reason: 'invalid_signature' }
    });
    expect(onIncomingMessage).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
