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

export interface KakaoClient {
  start(): Promise<void>;
  stop(): Promise<void>;
  send(message: OutboundMessage): Promise<void>;
  onMessage(handler: (message: InboundMessage) => Promise<void> | void): void;
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

  throw new Error('Non-dry-run Kakao client is not implemented yet.');
};

export { DryRunKakaoClient };
