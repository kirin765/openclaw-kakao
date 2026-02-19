import { createHmac, timingSafeEqual } from 'node:crypto';

import type { KakaoChannelConfig } from './config.js';

export interface OutboundMessage {
  channelId: string;
  text: string;
}

export interface InboundMessage {
  channelId: string;
  userId: string;
  text: string;
}

export interface KakaoSendMessageRequest {
  channelId: string;
  text: string;
}

export interface KakaoSendMessageResponse {
  success: boolean;
  messageId: string;
}

export interface KakaoWebhookVerificationInput {
  payload: string;
  signature: string;
}

export interface KakaoClient {
  start(): Promise<void>;
  stop(): Promise<void>;
  send(message: OutboundMessage): Promise<void>;
  onMessage(handler: (message: InboundMessage) => Promise<void> | void): void;
}

interface KakaoLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

interface KakaoApiClientOptions {
  fetchImpl?: FetchLike;
  logger?: KakaoLogger;
  maxRetries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  refreshChannelToken?: () => Promise<string | undefined>;
  onChannelTokenUpdated?: (token: string) => void;
}

const DEFAULT_API_BASE_URL = 'https://kapi.kakao.com';

const defaultLogger: KakaoLogger = {
  debug: () => undefined,
  warn: () => undefined
};

const delay = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const redact = (value: string | undefined): string | undefined => {
  if (!value) {
    return value;
  }

  if (value.length <= 8) {
    return '***';
  }

  return `${value.slice(0, 4)}***${value.slice(-2)}`;
};

const parseRetryAfterMs = (value: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }

  const asSeconds = Number(value);
  if (!Number.isNaN(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const asDate = Date.parse(value);
  if (Number.isNaN(asDate)) {
    return undefined;
  }

  const delayMs = asDate - Date.now();
  return delayMs > 0 ? delayMs : 0;
};

const shouldRetryStatus = (status: number): boolean => status === 401 || status === 429 || status >= 500;

export class KakaoApiClient implements KakaoClient {
  private readonly fetchImpl: FetchLike;

  private readonly logger: KakaoLogger;

  private readonly maxRetries: number;

  private readonly baseDelayMs: number;

  private readonly sleep: (ms: number) => Promise<void>;

  private readonly refreshChannelToken?: () => Promise<string | undefined>;

  private readonly onChannelTokenUpdated?: (token: string) => void;

  private readonly restApiKey: string;

  private readonly webhookSecret: string;

  private channelToken: string;

  private readonly apiBaseUrl: string;

  private handler?: (message: InboundMessage) => Promise<void> | void;

  public constructor(config: KakaoChannelConfig, options: KakaoApiClientOptions = {}) {
    if (!config.restApiKey || !config.channelToken || !config.webhookSecret) {
      throw new Error('KakaoApiClient requires restApiKey, channelToken, and webhookSecret.');
    }

    this.restApiKey = config.restApiKey;
    this.channelToken = config.channelToken;
    this.webhookSecret = config.webhookSecret;
    this.apiBaseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.logger = options.logger ?? defaultLogger;
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 300;
    this.sleep = options.sleep ?? delay;
    this.refreshChannelToken = options.refreshChannelToken;
    this.onChannelTokenUpdated = options.onChannelTokenUpdated;
  }

  public async start(): Promise<void> {
    // webhook polling/registration will be wired in a later story.
  }

  public async stop(): Promise<void> {
    // webhook polling/registration will be wired in a later story.
  }

  public onMessage(handler: (message: InboundMessage) => Promise<void> | void): void {
    this.handler = handler;
  }

  public async send(message: OutboundMessage): Promise<void> {
    await this.sendMessage({ channelId: message.channelId, text: message.text });
  }

  public async sendMessage(request: KakaoSendMessageRequest): Promise<KakaoSendMessageResponse> {
    const response = await this.requestWithRetry<KakaoSendMessageResponse>('/v1/talk/channels/messages', {
      method: 'POST',
      body: {
        channel_id: request.channelId,
        text: request.text
      }
    });

    return response;
  }

  public verifyWebhookSignature(input: KakaoWebhookVerificationInput): boolean {
    const expected = createHmac('sha256', this.webhookSecret).update(input.payload).digest('hex');

    const actual = input.signature.trim().toLowerCase().replace(/^sha256=/, '');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const actualBuffer = Buffer.from(actual, 'utf8');

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  }

  public async emitInboundForTest(message: InboundMessage): Promise<void> {
    await this.handler?.(message);
  }

  private async requestWithRetry<T>(
    path: string,
    request: { method: 'POST' | 'GET'; body?: Record<string, unknown> }
  ): Promise<T> {
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      const response = await this.fetchImpl(`${this.apiBaseUrl}${path}`, {
        method: request.method,
        headers: {
          Authorization: `Bearer ${this.channelToken}`,
          'X-KakaoAK': this.restApiKey,
          'Content-Type': 'application/json'
        },
        body: request.body ? JSON.stringify(request.body) : undefined
      });

      if (response.ok) {
        const bodyText = await response.text();
        return JSON.parse(bodyText) as T;
      }

      if (!shouldRetryStatus(response.status) || attempt === this.maxRetries) {
        const errorText = await response.text();
        this.logger.warn('[kakao-api] request failed without retry', {
          status: response.status,
          attempt,
          authHeader: redact(`Bearer ${this.channelToken}`),
          apiKey: redact(this.restApiKey),
          body: redact(errorText)
        });
        throw new Error(`[kakao-api] request failed with status ${response.status}`);
      }

      if (response.status === 401 && this.refreshChannelToken) {
        const refreshed = await this.refreshChannelToken();
        if (refreshed) {
          this.channelToken = refreshed;
          this.onChannelTokenUpdated?.(refreshed);
          this.logger.warn('[kakao-api] refreshed channel token after 401', {
            attempt,
            channelToken: redact(refreshed)
          });
          attempt += 1;
          continue;
        }
      }

      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
      const backoffMs = retryAfterMs ?? this.baseDelayMs * 2 ** attempt;

      this.logger.warn('[kakao-api] transient failure, retrying', {
        status: response.status,
        attempt,
        delayMs: backoffMs,
        authHeader: redact(`Bearer ${this.channelToken}`),
        apiKey: redact(this.restApiKey)
      });

      await this.sleep(backoffMs);
      attempt += 1;
    }

    throw new Error('[kakao-api] exhausted retries unexpectedly');
  }
}

class DryRunKakaoClient implements KakaoClient {
  private handler?: (message: InboundMessage) => Promise<void> | void;

  public async start(): Promise<void> {
    // no-op in dry-run mode
  }

  public async stop(): Promise<void> {
    // no-op in dry-run mode
  }

  public async send(_message: OutboundMessage): Promise<void> {
    // no-op in dry-run mode
  }

  public onMessage(handler: (message: InboundMessage) => Promise<void> | void): void {
    this.handler = handler;
  }

  // test helper for scaffold flow validation
  public async simulateInbound(message: InboundMessage): Promise<void> {
    await this.handler?.(message);
  }
}

export const createKakaoClient = (config: KakaoChannelConfig): KakaoClient => {
  if (config.dryRun) {
    return new DryRunKakaoClient();
  }

  return new KakaoApiClient(config);
};

export { DryRunKakaoClient, redact, parseRetryAfterMs };