import { createKakaoClient, type KakaoClient } from './client.js';
import { loadKakaoChannelConfig, type KakaoChannelConfig } from './config.js';
import {
  createDefaultMessageHandler,
  type KakaoMessageHandler
} from './handlers.js';

export interface KakaoChannelProvider {
  name: 'kakao';
  boot(): Promise<void>;
  shutdown(): Promise<void>;
  send(channelId: string, text: string): Promise<void>;
  readonly config: KakaoChannelConfig;
}

export interface CreateKakaoChannelProviderOptions {
  env?: NodeJS.ProcessEnv;
  messageHandler?: KakaoMessageHandler;
  clientFactory?: (config: KakaoChannelConfig) => KakaoClient;
}

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
      await client.send({ channelId, text });
    }
  };
};
