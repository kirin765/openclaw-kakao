import type { InboundMessage } from './client.js';

export interface KakaoMessageContext {
  acknowledge(): Promise<void>;
}

export type KakaoMessageHandler = (
  message: InboundMessage,
  context: KakaoMessageContext
) => Promise<void>;

export const createDefaultMessageHandler = (): KakaoMessageHandler => {
  return async (_message, context) => {
    await context.acknowledge();
  };
};
