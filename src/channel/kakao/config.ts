export interface KakaoChannelConfig {
  dryRun: boolean;
  appKey?: string;
  adminKey?: string;
  botUserId?: string;
}

export const loadKakaoChannelConfig = (
  env: NodeJS.ProcessEnv = process.env
): KakaoChannelConfig => {
  const dryRun = env.KAKAO_DRY_RUN !== 'false';

  return {
    dryRun,
    appKey: env.KAKAO_APP_KEY,
    adminKey: env.KAKAO_ADMIN_KEY,
    botUserId: env.KAKAO_BOT_USER_ID
  };
};
