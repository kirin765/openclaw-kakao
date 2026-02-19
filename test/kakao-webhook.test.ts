import { createHmac } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { InMemoryKakaoChannelState } from '../src/channel/kakao/state.js';
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
        conversationId: 'channel-123:user-456',
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

  it('ignores duplicate inbound events deterministically', async () => {
    const webhookSecret = 'webhook-secret';
    const payload = JSON.stringify({
      event: {
        id: 'evt_dup_1',
        type: 'message',
        channel_id: 'channel-123',
        user: { id: 'user-456' },
        message: { type: 'text', text: 'hello from kakao' }
      }
    });

    const onIncomingMessage = vi.fn();
    const debug = vi.fn();
    const controller = createKakaoInboundWebhookController({
      webhookSecret,
      logger: { debug },
      onIncomingMessage
    });

    const headers = { 'x-kakao-signature': signPayload(payload, webhookSecret) };
    const first = await controller({ headers, body: payload });
    const second = await controller({ headers, body: payload });

    expect(first.status).toBe(200);
    expect(second.status).toBe(202);
    expect(second.body.reason).toBe('duplicate_event');
    expect(onIncomingMessage).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalledWith('[kakao-webhook] duplicate event ignored', {
      messageId: 'evt_dup_1'
    });
  });

  it('reuses mapped conversation id when injected state contains mapping', async () => {
    const webhookSecret = 'webhook-secret';
    const state = new InMemoryKakaoChannelState();
    state.setConversationId({ channelId: 'channel-999', userId: 'user-xyz' }, 'conv-existing');

    const payload = JSON.stringify({
      event: {
        id: 'evt_3',
        type: 'message',
        channel_id: 'channel-999',
        user: { id: 'user-xyz' },
        message: { type: 'text', text: 'mapped conversation' }
      }
    });

    const received: OpenClawIncomingMessageEvent[] = [];
    const controller = createKakaoInboundWebhookController({
      webhookSecret,
      state,
      onIncomingMessage: (event) => {
        received.push(event);
      }
    });

    const response = await controller({
      headers: { 'x-kakao-signature': signPayload(payload, webhookSecret) },
      body: payload
    });

    expect(response.status).toBe(200);
    expect(received[0]?.conversationId).toBe('conv-existing');
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
