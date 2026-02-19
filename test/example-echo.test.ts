import { createHmac } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEchoExampleRuntime } from '../src/example/echo.js';
import type { KakaoChannelProvider } from '../src/channel/kakao/provider.js';

const signPayload = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(payload).digest('hex');

describe('createEchoExampleRuntime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wires inbound webhook to outbound echo send', async () => {
    const send = vi.fn(async () => ({ success: true, messageId: 'dry-run-message-id' }));
    const provider: KakaoChannelProvider = {
      name: 'kakao',
      config: { dryRun: true },
      boot: vi.fn(async () => undefined),
      shutdown: vi.fn(async () => undefined),
      send,
      sendMessageAction: vi.fn()
    };

    const runtime = createEchoExampleRuntime({
      env: {
        KAKAO_DRY_RUN: 'true',
        KAKAO_WEBHOOK_SECRET: 'test-secret',
        EXAMPLE_PORT: '8877'
      },
      providerFactory: () => provider
    });

    await runtime.start();

    const payload = JSON.stringify({
      event: {
        id: 'evt_123',
        type: 'message',
        channel_id: 'room-1',
        user: { id: 'user-1' },
        message: { type: 'text', text: 'ping' }
      }
    });

    const response = await fetch('http://localhost:8877/webhooks/kakao', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-kakao-signature': signPayload(payload, 'test-secret')
      },
      body: payload
    });

    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledWith('room-1', 'echo: ping');

    await runtime.stop();

    expect(provider.boot).toHaveBeenCalledTimes(1);
    expect(provider.shutdown).toHaveBeenCalledTimes(1);
  });

  it('requires webhook secret in env', () => {
    expect(() => createEchoExampleRuntime({ env: { EXAMPLE_PORT: '8878' } })).toThrow(
      'KAKAO_WEBHOOK_SECRET is required'
    );
  });
});