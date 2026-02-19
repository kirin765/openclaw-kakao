import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  createDefaultKakaoChannelState,
  type KakaoChannelState,
  type KakaoConversationRef
} from './state.js';

export interface OpenClawIncomingMessageEvent {
  platform: 'kakao';
  channel: 'kakao';
  type: 'message.received';
  messageId: string;
  channelId: string;
  userId: string;
  conversationId: string;
  text: string;
  raw: unknown;
}

export interface KakaoWebhookHttpRequest {
  headers: Record<string, string | undefined>;
  body: string;
}

export interface KakaoWebhookHttpResponse {
  status: number;
  body: { ok: boolean; reason?: string };
}

interface KakaoInboundWebhookPayload {
  event?: {
    id?: string;
    type?: string;
    channel_id?: string;
    user?: { id?: string };
    message?: {
      type?: string;
      text?: string;
    };
  };
}

interface KakaoWebhookLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
}

const defaultLogger: KakaoWebhookLogger = {
  debug: () => undefined
};

export interface CreateKakaoInboundWebhookControllerOptions {
  webhookSecret: string;
  channelToken?: string;
  logger?: KakaoWebhookLogger;
  state?: KakaoChannelState;
  onIncomingMessage: (event: OpenClawIncomingMessageEvent) => Promise<void> | void;
}

const normalizeHeaderMap = (
  headers: Record<string, string | undefined>
): Record<string, string | undefined> => {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }

  return normalized;
};

export const verifyKakaoWebhookSignature = (input: {
  payload: string;
  signature: string;
  webhookSecret: string;
}): boolean => {
  const expected = createHmac('sha256', input.webhookSecret).update(input.payload).digest('hex');
  const actual = input.signature.trim().toLowerCase().replace(/^sha256=/, '');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const actualBuffer = Buffer.from(actual, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
};

type ParsedInboundMessage = Omit<OpenClawIncomingMessageEvent, 'conversationId'>;

const toOpenClawIncomingMessage = (
  payload: KakaoInboundWebhookPayload
): ParsedInboundMessage | undefined => {
  const event = payload.event;
  if (!event || event.type !== 'message' || event.message?.type !== 'text') {
    return undefined;
  }

  if (!event.id || !event.channel_id || !event.user?.id || !event.message.text) {
    return undefined;
  }

  return {
    platform: 'kakao',
    channel: 'kakao',
    type: 'message.received',
    messageId: event.id,
    channelId: event.channel_id,
    userId: event.user.id,
    text: event.message.text,
    raw: payload
  };
};

const resolveConversationId = (
  state: KakaoChannelState,
  ref: KakaoConversationRef
): string => {
  const existing = state.getConversationId(ref);
  if (existing) {
    return existing;
  }

  const created = `${ref.channelId}:${ref.userId}`;
  state.setConversationId(ref, created);
  return created;
};

export const createKakaoInboundWebhookController = (
  options: CreateKakaoInboundWebhookControllerOptions
): ((request: KakaoWebhookHttpRequest) => Promise<KakaoWebhookHttpResponse>) => {
  const logger = options.logger ?? defaultLogger;
  const state = options.state ?? createDefaultKakaoChannelState();

  return async (request: KakaoWebhookHttpRequest): Promise<KakaoWebhookHttpResponse> => {
    const headers = normalizeHeaderMap(request.headers);
    const signature = headers['x-kakao-signature'];

    if (!signature) {
      return { status: 401, body: { ok: false, reason: 'missing_signature' } };
    }

    if (
      options.channelToken &&
      headers['x-kakao-channel-token'] &&
      headers['x-kakao-channel-token'] !== options.channelToken
    ) {
      return { status: 401, body: { ok: false, reason: 'invalid_token' } };
    }

    const isSignatureValid = verifyKakaoWebhookSignature({
      payload: request.body,
      signature,
      webhookSecret: options.webhookSecret
    });

    if (!isSignatureValid) {
      return { status: 401, body: { ok: false, reason: 'invalid_signature' } };
    }

    let parsed: KakaoInboundWebhookPayload;
    try {
      parsed = JSON.parse(request.body) as KakaoInboundWebhookPayload;
    } catch {
      return { status: 400, body: { ok: false, reason: 'invalid_json' } };
    }

    const incomingMessage = toOpenClawIncomingMessage(parsed);
    if (!incomingMessage) {
      logger.debug('[kakao-webhook] unhandled event ignored', {
        eventType: parsed.event?.type,
        messageType: parsed.event?.message?.type
      });
      return { status: 202, body: { ok: true } };
    }

    if (state.hasProcessedEvent(incomingMessage.messageId)) {
      logger.debug('[kakao-webhook] duplicate event ignored', {
        messageId: incomingMessage.messageId
      });
      return { status: 202, body: { ok: true, reason: 'duplicate_event' } };
    }

    const conversationId = resolveConversationId(state, {
      channelId: incomingMessage.channelId,
      userId: incomingMessage.userId
    });

    state.markEventProcessed(incomingMessage.messageId);
    await options.onIncomingMessage({
      ...incomingMessage,
      conversationId
    });
    return { status: 200, body: { ok: true } };
  };
};

export { toOpenClawIncomingMessage };
