import { describe, expect, it, vi } from 'vitest';

import {
  createKakaoChannelProvider,
  createPlugin,
  DryRunKakaoClient,
  kakaoPluginManifest
} from '../src/index.js';
import plugin from '../src/plugin.js';

describe('kakao channel scaffold', () => {
  it('exports discoverable kakao channel provider from plugin', () => {
    expect(plugin.manifest.channels).toContain('kakao');
    expect(kakaoPluginManifest.channels).toEqual(['kakao']);
    expect(plugin.channels.kakao.name).toBe('kakao');
  });

  it('boots in dry-run mode without Kakao credentials', async () => {
    const provider = createKakaoChannelProvider({
      env: {
        KAKAO_DRY_RUN: 'true'
      }
    });

    expect(provider.config.dryRun).toBe(true);
    await expect(provider.boot()).resolves.toBeUndefined();
    await expect(provider.shutdown()).resolves.toBeUndefined();
  });

  it('registers inbound message handler lifecycle on load/unload', async () => {
    const dryClient = new DryRunKakaoClient();
    const handler = vi.fn(async () => undefined);

    const provider = createKakaoChannelProvider({
      messageHandler: handler,
      clientFactory: () => dryClient,
      env: { KAKAO_DRY_RUN: 'true' }
    });

    await provider.boot();
    await dryClient.simulateInbound({ channelId: 'room-1', userId: 'u-1', text: 'hello' });
    await provider.shutdown();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'hello' }),
      expect.any(Object)
    );
  });

  it('createPlugin exposes lifecycle hooks', async () => {
    const created = createPlugin();

    await expect(created.lifecycle.onLoad()).resolves.toBeUndefined();
    await expect(created.lifecycle.onUnload()).resolves.toBeUndefined();
  });
});
