import { describe, expect, it } from 'vitest';

import { loadKakaoChannelConfig } from '../src/channel/kakao/config.js';

describe('kakao config schema', () => {
  it('defaults to dry-run mode and does not require secrets', () => {
    const config = loadKakaoChannelConfig({});

    expect(config.dryRun).toBe(true);
    expect(config.restApiKey).toBeUndefined();
    expect(config.webhookSecret).toBeUndefined();
    expect(config.channelToken).toBeUndefined();
  });

  it('rejects startup in non-dry-run mode when required credentials are missing', () => {
    expect(() =>
      loadKakaoChannelConfig({
        KAKAO_DRY_RUN: 'false'
      })
    ).toThrowError(
      '[kakao-config] Missing required Kakao credentials: KAKAO_REST_API_KEY, KAKAO_WEBHOOK_SECRET, KAKAO_CHANNEL_TOKEN'
    );
  });

  it('accepts non-dry-run config when required credentials are provided', () => {
    const config = loadKakaoChannelConfig({
      KAKAO_DRY_RUN: 'false',
      KAKAO_REST_API_KEY: 'rest-api-key',
      KAKAO_WEBHOOK_SECRET: 'webhook-secret',
      KAKAO_CHANNEL_TOKEN: 'channel-token'
    });

    expect(config.dryRun).toBe(false);
    expect(config.restApiKey).toBe('rest-api-key');
    expect(config.webhookSecret).toBe('webhook-secret');
    expect(config.channelToken).toBe('channel-token');
  });

  it('validates optional sandbox endpoint URLs', () => {
    expect(() =>
      loadKakaoChannelConfig({
        KAKAO_API_BASE_URL: 'not-a-url'
      })
    ).toThrowError(
      '[kakao-config] KAKAO_API_BASE_URL must be a valid http(s) URL. Received: "not-a-url"'
    );

    expect(() =>
      loadKakaoChannelConfig({
        KAKAO_WEBHOOK_BASE_URL: 'ftp://invalid.example.com'
      })
    ).toThrowError(
      '[kakao-config] KAKAO_WEBHOOK_BASE_URL must be a valid http(s) URL. Received: "ftp://invalid.example.com"'
    );
  });

  it('accepts valid optional sandbox endpoints', () => {
    const config = loadKakaoChannelConfig({
      KAKAO_API_BASE_URL: 'https://sandbox-api.kakao.example',
      KAKAO_WEBHOOK_BASE_URL: 'http://localhost:3000'
    });

    expect(config.apiBaseUrl).toBe('https://sandbox-api.kakao.example');
    expect(config.webhookBaseUrl).toBe('http://localhost:3000');
  });
});
