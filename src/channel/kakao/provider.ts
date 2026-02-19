import {
  createKakaoClient,
  KakaoApiError,
  type KakaoClient,
  type KakaoSendMessageResponse
} from './client.js';
import { loadKakaoChannelConfig, type KakaoChannelConfig } from './config.js';
import {
  createDefaultMessageHandler,
  type KakaoMessageHandler
} from './handlers.js';

export interface KakaoChannelProvider {
  name: 'kakao';
  boot(): Promise<void>;
  shutdown(): Promise<void>;
  send(channelId: string, text: string): Promise<KakaoSendMessageResponse>;
  sendMessageAction(action: OpenClawMessageSendAction): Promise<OpenClawMessageSendSuccess>;
  readonly config: KakaoChannelConfig;
}

export interface CreateKakaoChannelProviderOptions {
  env?: NodeJS.ProcessEnv;
  messageHandler?: KakaoMessageHandler;
  clientFactory?: (config: KakaoChannelConfig) => KakaoClient;
}

export interface OpenClawMessageSendAction {
  channel: string;
  target: string;
  message: string;
}

export interface OpenClawMessageSendSuccess {
  ok: true;
  channel: 'kakao';
  target: string;
  providerMessageId: string;
  provider: KakaoSendMessageResponse;
}

export class KakaoSendActionError extends Error {
  public readonly code: string;

  public readonly retryable: boolean;

  public readonly status?: number;

  public constructor(input: { code: string; message: string; retryable: boolean; status?: number }) {
    super(input.message);
    this.name = 'KakaoSendActionError';
    this.code = input.code;
    this.retryable = input.retryable;
    this.status = input.status;
  }
}

const parseKakaoTarget = (target: string): { type: 'room' | 'user'; id: string } => {
  const value = target.trim();
  const match = /^(room|user):([A-Za-z0-9._-]+)$/.exec(value);

  if (!match) {
    throw new KakaoSendActionError({
      code: 'INVALID_TARGET',
      message: 'Kakao target must follow "room:<id>" or "user:<id>" format.',
      retryable: false
    });
  }

  return {
    type: match[1] as 'room' | 'user',
    id: match[2]
  };
};

export const createKakaoChannelProvider = (
  options: CreateKakaoChannelProviderOptions = {}
): KakaoChannelProvider => {
  const config = loadKakaoChannelConfig(options.env);
  const client = (options.clientFactory ?? createKakaoClient)(config);
  const messageHandler = options.messageHandler ?? createDefaultMessageHandler();

  client.onMessage((message) =>
    messageHandler(message, {
      acknowledge: async () => undefined
    })
  );

  return {
    name: 'kakao',
    config,
    async boot() {
      await client.start();
    },
    async shutdown() {
      await client.stop();
    },
    async send(channelId, text) {
      return client.send({ channelId, text });
    },
    async sendMessageAction(action) {
      if (action.channel !== 'kakao') {
        throw new KakaoSendActionError({
          code: 'UNSUPPORTED_CHANNEL',
          message: `Unsupported channel: ${action.channel}`,
          retryable: false
        });
      }

      const parsedTarget = parseKakaoTarget(action.target);

      try {
        const providerResponse = await client.send({
          channelId: parsedTarget.id,
          text: action.message
        });

        return {
          ok: true,
          channel: 'kakao',
          target: action.target,
          providerMessageId: providerResponse.messageId,
          provider: providerResponse
        };
      } catch (error) {
        if (error instanceof KakaoApiError) {
          throw new KakaoSendActionError({
            code: 'KAKAO_API_ERROR',
            message: error.message,
            status: error.status,
            retryable: error.retryable
          });
        }

        throw new KakaoSendActionError({
          code: 'KAKAO_SEND_FAILED',
          message: error instanceof Error ? error.message : 'Unknown Kakao send failure',
          retryable: false
        });
      }
    }
  };
};

export { parseKakaoTarget };
