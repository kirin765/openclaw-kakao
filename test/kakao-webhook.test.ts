import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import {
  createKakaoInboundWebhookController,
  type OpenClawIncomingMessageEvent
} from '../src/channel/kakao/webhook.js';

const signPayload = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(payload).digest('hex');

describe('createKakaoInboundWebhookController', () => {
  it('returns 200 for valid signed text message and maps to canonical event', async () => {
    const webhookSecret = 'webhook-secret';
    const payload = JSON.stringify({
      event: {
        id: 'evt_1',
        type: 'message',
        channel_id: 'channel-123',
        user: { id: 'user-456' },
        message: { type: 'text', text: 'hello from kakao' }
      }
    });

    const received: OpenClawIncomingMessageEvent[] = [];
    const controller = createKakaoInboundWebhookController({
      webhookSecret,
      onIncomingMessage: (event) => {
        received.push(event);
      }
    });

    const response = await controller({
      headers: { 'x-kakao-signature': signPayload(payload, webhookSecret) },
      body: payload
    });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(received).toEqual([
      {
        platform: 'kakao',
        channel: 'kakao',
        type: 'message.received',
        messageId: 'evt_1',
        channelId: 'channel-123',
        userId: 'user-456',
        text: 'hello from kakao',
        raw: JSON.parse(payload)
      }
    ]);
  });

  it('returns 401 for invalid signature', async () => {
    const controller = createKakaoInboundWebhookController({
      webhookSecret: 'webhook-secret',
      onIncomingMessage: vi.fn()
    });

    const response = await controller({
      headers: { 'x-kakao-signature': 'sha256=bad-signature' },
      body: JSON.stringify({ event: { type: 'message' } })
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ ok: false, reason: 'invalid_signature' });
  });

  it('ignores unhandled events with debug logging', async () => {
    const debug = vi.fn();
    const onIncomingMessage = vi.fn();
    const webhookSecret = 'webhook-secret';
    const payload = JSON.stringify({
      event: {
        id: 'evt_2',
        type: 'delivery',
        channel_id: 'channel-123'
      }
    });

    const controller = createKakaoInboundWebhookController({
      webhookSecret,
      logger: { debug },
      onIncomingMessage
    });

    const response = await controller({
      headers: { 'x-kakao-signature': signPayload(payload, webhookSecret) },
      body: payload
    });

    expect(response.status).toBe(202);
    expect(onIncomingMessage).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalledWith('[kakao-webhook] unhandled event ignored', {
      eventType: 'delivery',
      messageType: undefined
    });
  });
});
