export interface ProjectBootstrapInfo {
  name: string;
  runtime: 'node';
  language: 'typescript';
}

export const bootstrapInfo: ProjectBootstrapInfo = {
  name: 'openclaw-kakao',
  runtime: 'node',
  language: 'typescript'
};

export * from './plugin.js';
export * from './channel/kakao/index.js';
export * from './example/echo.js';
