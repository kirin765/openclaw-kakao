export interface KakaoChannelConfig {
  dryRun: boolean;
  restApiKey?: string;
  webhookSecret?: string;
  channelToken?: string;
  apiBaseUrl?: string;
  webhookBaseUrl?: string;
}

const REQUIRED_NON_DRY_RUN_VARS = [
  'KAKAO_REST_API_KEY',
  'KAKAO_WEBHOOK_SECRET',
  'KAKAO_CHANNEL_TOKEN'
] as const;

type OptionalUrlVar = 'KAKAO_API_BASE_URL' | 'KAKAO_WEBHOOK_BASE_URL';

const readOptionalTrimmed = (value: string | undefined): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const assertValidUrl = (variableName: OptionalUrlVar, value: string): void => {
  try {
    const parsed = new URL(value);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('invalid protocol');
    }
  } catch {
    throw new Error(
      `[kakao-config] ${variableName} must be a valid http(s) URL. Received: ${JSON.stringify(value)}`
    );
  }
};

export const loadKakaoChannelConfig = (
  env: NodeJS.ProcessEnv = process.env
): KakaoChannelConfig => {
  const dryRun = env.KAKAO_DRY_RUN !== 'false';

  const restApiKey = readOptionalTrimmed(env.KAKAO_REST_API_KEY);
  const webhookSecret = readOptionalTrimmed(env.KAKAO_WEBHOOK_SECRET);
  const channelToken = readOptionalTrimmed(env.KAKAO_CHANNEL_TOKEN);
  const apiBaseUrl = readOptionalTrimmed(env.KAKAO_API_BASE_URL);
  const webhookBaseUrl = readOptionalTrimmed(env.KAKAO_WEBHOOK_BASE_URL);

  const missingRequired = REQUIRED_NON_DRY_RUN_VARS.filter((variableName) => {
    switch (variableName) {
      case 'KAKAO_REST_API_KEY':
        return !restApiKey;
      case 'KAKAO_WEBHOOK_SECRET':
        return !webhookSecret;
      case 'KAKAO_CHANNEL_TOKEN':
        return !channelToken;
      default:
        return false;
    }
  });

  if (!dryRun && missingRequired.length > 0) {
    throw new Error(
      `[kakao-config] Missing required Kakao credentials: ${missingRequired.join(', ')}`
    );
  }

  if (apiBaseUrl) {
    assertValidUrl('KAKAO_API_BASE_URL', apiBaseUrl);
  }

  if (webhookBaseUrl) {
    assertValidUrl('KAKAO_WEBHOOK_BASE_URL', webhookBaseUrl);
  }

  return {
    dryRun,
    restApiKey,
    webhookSecret,
    channelToken,
    apiBaseUrl,
    webhookBaseUrl
  };
};
