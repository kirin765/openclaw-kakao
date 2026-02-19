import { createKakaoChannelProvider } from './channel/kakao/index.js';

export interface OpenClawPluginManifest {
  name: string;
  version: string;
  channels: string[];
}

export interface OpenClawChannelPlugin {
  manifest: OpenClawPluginManifest;
  channels: {
    kakao: ReturnType<typeof createKakaoChannelProvider>;
  };
  lifecycle: {
    onLoad(): Promise<void>;
    onUnload(): Promise<void>;
  };
}

export const kakaoPluginManifest: OpenClawPluginManifest = {
  name: 'openclaw-kakao',
  version: '0.1.0',
  channels: ['kakao']
};

export const createPlugin = (): OpenClawChannelPlugin => {
  const kakao = createKakaoChannelProvider();

  return {
    manifest: kakaoPluginManifest,
    channels: {
      kakao
    },
    lifecycle: {
      onLoad: async () => {
        await kakao.boot();
      },
      onUnload: async () => {
        await kakao.shutdown();
      }
    }
  };
};

const plugin = createPlugin();

export default plugin;
