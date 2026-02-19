import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  KakaoApiClient,
  parseRetryAfterMs,
  redact,
  type KakaoSendMessageResponse
} from '../src/channel/kakao/client.js';
import type { KakaoChannelConfig } from '../src/channel/kakao/config.js';

const baseConfig: KakaoChannelConfig = {
  dryRun: false,
  restApiKey: 'rest-api-key-123456',
  webhookSecret: 'webhook-secret-123456',
  channelToken: 'channel-token-abcdef'
};

describe('KakaoApiClient', () => {
  it('sends message with authorization headers and typed response', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({ success: true, messageId: 'm-1' })
    }));

    const client = new KakaoApiClient(baseConfig, { fetchImpl });

    const response = await client.sendMessage({ channelId: 'room-1', text: 'hello' });

    expect(response).toEqual<KakaoSendMessageResponse>({ success: true, messageId: 'm-1' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://kapi.kakao.com/v1/talk/channels/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${baseConfig.channelToken}`,
          'X-KakaoAK': baseConfig.restApiKey,
          'Content-Type': 'application/json'
        })
      })
    );
  });

  it('refreshes token on 401 and retries once with updated token', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: { get: () => null },
        text: async () => 'unauthorized'
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify({ success: true, messageId: 'm-2' })
      });

    const refreshChannelToken = vi.fn(async () => 'channel-token-refreshed');
    const onChannelTokenUpdated = vi.fn();

    const client = new KakaoApiClient(baseConfig, {
      fetchImpl,
      refreshChannelToken,
      onChannelTokenUpdated,
      sleep: vi.fn(async () => undefined)
    });

    await expect(client.sendMessage({ channelId: 'room-1', text: 'hello' })).resolves.toEqual({
      success: true,
      messageId: 'm-2'
    });

    expect(refreshChannelToken).toHaveBeenCalledTimes(1);
    expect(onChannelTokenUpdated).toHaveBeenCalledWith('channel-token-refreshed');
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://kapi.kakao.com/v1/talk/channels/messages',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer channel-token-refreshed' })
      })
    );
  });

  it('retries 429/5xx with backoff and retry-after support', async () => {
    const sleep = vi.fn(async () => undefined);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => '2' },
        text: async () => 'rate limited'
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: { get: () => null },
        text: async () => 'server error'
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify({ success: true, messageId: 'm-3' })
      });

    const client = new KakaoApiClient(baseConfig, {
      fetchImpl,
      sleep,
      baseDelayMs: 100
    });

    await expect(client.sendMessage({ channelId: 'room-2', text: 'hello' })).resolves.toEqual({
      success: true,
      messageId: 'm-3'
    });

    expect(sleep).toHaveBeenNthCalledWith(1, 2000);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
  });

  it('verifies webhook signatures', () => {
    const client = new KakaoApiClient(baseConfig, { fetchImpl: vi.fn() as never });
    const payload = JSON.stringify({ event: 'message', text: 'hello' });
    const signature = createHmac('sha256', baseConfig.webhookSecret ?? '')
      .update(payload)
      .digest('hex');

    expect(client.verifyWebhookSignature({ payload, signature })).toBe(true);
    expect(client.verifyWebhookSignature({ payload, signature: `sha256=${signature}` })).toBe(true);
    expect(client.verifyWebhookSignature({ payload, signature: 'bad-signature' })).toBe(false);
  });

  it('redacts secrets in logs and utility helpers', async () => {
    const logger = { debug: vi.fn(), warn: vi.fn() };
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 500,
      headers: { get: () => null },
      text: async () => 'raw-error-body-with-secret-token'
    }));

    const client = new KakaoApiClient(baseConfig, {
      fetchImpl,
      logger,
      maxRetries: 0
    });

    await expect(client.sendMessage({ channelId: 'room-3', text: 'oops' })).rejects.toThrow(
      'status 500'
    );

    expect(logger.warn).toHaveBeenCalledWith(
      '[kakao-api] request failed without retry',
      expect.objectContaining({
        authHeader: expect.stringContaining('***'),
        apiKey: expect.stringContaining('***'),
        body: expect.stringContaining('***')
      })
    );

    expect(redact('abcdefghi')).toContain('***');
    expect(parseRetryAfterMs('2')).toBe(2000);
    expect(parseRetryAfterMs('invalid')).toBeUndefined();
  });
});